"""Translation with a persistent cache and a pluggable provider.

Default provider is MyMemory, which needs no API key. If ANTHROPIC_API_KEY or
DEEPL_API_KEY is present in the environment the better provider is used
automatically — the rest of the pipeline does not change.

Two rules matter here:
  * never translate twice — the cache is permanent, so each day only pays for
    what is genuinely new;
  * never mangle a proper noun — model names, brands and tools are checked
    after translation and the result is rejected if they went missing.
"""
import json
import os
import re
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from http_util import fetch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_PATH = os.path.join(ROOT, "data", "translations.json")

_lock = threading.Lock()
_cache = None
_glossary = None
_budget = {"date": None, "words": 0, "limit": 4500}


# ------------------------------------------------------------------ cache

def load_cache():
    global _cache
    if _cache is None:
        try:
            with open(CACHE_PATH) as fh:
                _cache = json.load(fh)
        except (OSError, ValueError):
            _cache = {"version": 1, "entries": {}, "budget": {}}
        _cache.setdefault("entries", {})
        _cache.setdefault("budget", {})
        today = date.today().isoformat()
        b = _cache["budget"]
        _budget["date"] = today
        _budget["words"] = b.get(today, 0)
    return _cache


def save_cache():
    if _cache is None:
        return
    _cache["budget"][_budget["date"]] = _budget["words"]
    # keep only the last week of budget counters
    for k in sorted(_cache["budget"])[:-7]:
        _cache["budget"].pop(k, None)
    tmp = CACHE_PATH + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(_cache, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, CACHE_PATH)


def key_for(text, target):
    return f"{target}:{text}"


# ------------------------------------------------------------------ glossary

def load_glossary(data_dir=None):
    """Terms that must survive translation untouched."""
    global _glossary
    if _glossary is None:
        d = data_dir or os.path.join(ROOT, "data")
        terms = []
        try:
            lex = json.load(open(os.path.join(d, "lexicon.json")))
            terms += lex["models"] + lex["companies"] + lex["tools"]
        except (OSError, ValueError, KeyError):
            pass
        # Publication and creator names are proper nouns too: a translator that
        # turns "Criterion" into "il criterio" has destroyed the attribution.
        for fname, key in (("sources.json", "sources"), ("creators.json", "creators")):
            try:
                for row in json.load(open(os.path.join(d, fname)))[key]:
                    for name in (row["name"], row.get("alias")):
                        if not name:
                            continue
                        terms.append(name)
                        # "Criterion — The Current" must also protect "Criterion",
                        # which is how the outlet is actually named in a headline.
                        head = re.split(r"\s[—–|(-]\s|\s\(", name)[0].strip()
                        if len(head) >= 4 and head[0].isupper() and head != name:
                            terms.append(head)
            except (OSError, ValueError, KeyError):
                pass
        # long terms first, so "Black Forest Labs" is checked before "Labs"
        _glossary = sorted({t for t in terms if len(t) > 2}, key=len, reverse=True)
    return _glossary


def _protected_in(text):
    out = []
    for term in load_glossary():
        if re.search(r"(?<![\w-])" + re.escape(term) + r"(?![\w-])", text, re.I):
            out.append(term)
    return out


def _keeps_proper_nouns(src, translated):
    """Reject a translation that swallowed the names the story is about."""
    expected = _protected_in(src)
    if not expected:
        return True
    missing = [t for t in expected
               if not re.search(r"(?<![\w-])" + re.escape(t) + r"(?![\w-])", translated, re.I)]
    return len(missing) <= 1 and len(missing) < len(expected)


# ------------------------------------------------------------------ providers

def _provider_lingva(text, src, target):
    """Public Lingva instance. No key, CORS-enabled, occasionally flaky — used as
    a fallback when the primary provider is rate limited."""
    url = f"https://lingva.ml/api/v1/{src}/{target}/" + urllib.parse.quote(text, safe="")
    status, _, raw, _ = fetch(url, timeout=18, retries=1)
    if not raw:
        return None
    try:
        d = json.loads(raw.decode("utf-8", "replace"))
    except ValueError:
        return None
    out = (d.get("translation") or "").strip()
    return out or None


def _provider_mymemory(text, src, target):
    url = ("https://api.mymemory.translated.net/get?q=" + urllib.parse.quote(text)
           + f"&langpair={src}|{target}")
    status, _, raw, _ = fetch(url, timeout=20, retries=1)
    if not raw:
        return None
    try:
        d = json.loads(raw.decode("utf-8", "replace"))
    except ValueError:
        return None
    if d.get("responseStatus") != 200:
        return None
    out = (d.get("responseData") or {}).get("translatedText") or ""
    out = out.strip()
    # MyMemory sometimes echoes a quota or error string instead of a translation
    if not out or "MYMEMORY WARNING" in out.upper() or "QUOTA" in out.upper():
        return None
    return out


def _provider_deepl(text, src, target):
    key = os.environ.get("DEEPL_API_KEY")
    host = ("https://api-free.deepl.com" if key and key.endswith(":fx")
            else "https://api.deepl.com")
    body = urllib.parse.urlencode({
        "auth_key": key, "text": text,
        "source_lang": src.upper(), "target_lang": target.upper()}).encode()
    import urllib.request
    req = urllib.request.Request(host + "/v2/translate", data=body,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            d = json.loads(r.read().decode())
        return d["translations"][0]["text"]
    except Exception:                                     # noqa: BLE001
        return None


def _provider_anthropic(text, src, target):
    key = os.environ.get("ANTHROPIC_API_KEY")
    lang = {"it": "Italian", "en": "English"}.get(target, target)
    payload = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1024,
        "system": ("You translate headlines and article summaries for a technology and cinema "
                   "publication. Reply with the translation only, no preamble. Keep product "
                   "names, model names, company names, people's names and established technical "
                   "terms exactly as they appear in the source."),
        "messages": [{"role": "user", "content": f"Translate to {lang}:\n\n{text}"}],
    }).encode()
    import urllib.request
    req = urllib.request.Request(
        (os.environ.get("ANTHROPIC_BASE_URL") or "https://api.anthropic.com") + "/v1/messages",
        data=payload,
        headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            d = json.loads(r.read().decode())
        return "".join(b.get("text", "") for b in d.get("content", [])).strip() or None
    except Exception:                                     # noqa: BLE001
        return None


def provider_chain():
    """Ordered providers. A paid key, when present, is used alone; otherwise the
    two free endpoints back each other up, because either can be rate limited."""
    if os.environ.get("DEEPL_API_KEY"):
        return [("deepl", _provider_deepl)]
    if os.environ.get("ANTHROPIC_API_KEY"):
        return [("anthropic", _provider_anthropic)]
    return [("mymemory", _provider_mymemory), ("lingva", _provider_lingva)]


def active_provider():
    return provider_chain()[0]


# A provider is only given up on after several failures in a row: the free
# endpoints fail intermittently, and one flaky response is not an outage.
_fails = {}
_dead = set()
_FAIL_LIMIT = 5


# ------------------------------------------------------------------ public API

def translate(text, src, target, use_budget=True):
    """Return the translation, or None when it is unavailable or untrustworthy."""
    text = (text or "").strip()
    if not text or src == target:
        return None
    cache = load_cache()
    k = key_for(text, target)
    with _lock:
        if k in cache["entries"]:
            return cache["entries"][k] or None

    words = len(text.split())
    if use_budget:
        with _lock:
            if _budget["words"] + words > _budget["limit"]:
                return None
            _budget["words"] += words          # refunded below if nothing comes back

    out, name = None, None
    for pname, fn in provider_chain():
        if pname in _dead:
            continue
        out = fn(text, src, target)
        name = pname
        if out:
            with _lock:
                _fails[pname] = 0             # it is alive; forget earlier hiccups
            break
        with _lock:
            _fails[pname] = _fails.get(pname, 0) + 1
            if _fails[pname] >= _FAIL_LIMIT:
                _dead.add(pname)              # consistently refusing: stop asking

    if name in ("mymemory", "lingva"):
        time.sleep(0.8 if out else 0.2)       # be a good citizen on a free endpoint
    if out and not _keeps_proper_nouns(text, out):
        out = None                            # names were mangled: keep the original
    if out and out.strip().lower() == text.strip().lower():
        out = None                            # provider echoed the input

    with _lock:
        if out:
            cache["entries"][k] = out
        else:
            if use_budget:
                _budget["words"] -= words      # nothing was translated, nothing was spent
            if len(_dead) < len(provider_chain()):
                cache["entries"][k] = ""       # a real refusal for this text, not a rate limit
    return out


def translate_many(items, workers=None):
    """items: iterable of (text, src, target). Returns {(text,target): translation}."""
    results = {}
    if workers is None:
        # A paid key tolerates concurrency; the free endpoints answer 429 even at
        # one request per second, so they are called one at a time.
        workers = 4 if os.environ.get("DEEPL_API_KEY") or os.environ.get("ANTHROPIC_API_KEY") else 1

    def one(it):
        text, src, target = it
        return (text, target), translate(text, src, target)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        for k, v in ex.map(one, items):
            if v:
                results[k] = v
    return results


def budget_state():
    load_cache()
    return dict(_budget)


def set_budget(limit):
    load_cache()
    _budget["limit"] = int(limit)


def stats():
    c = load_cache()
    entries = c["entries"]
    done = sum(1 for v in entries.values() if v)
    return {"cached": len(entries), "translated": done, "failed": len(entries) - done,
            "provider": "+".join(p for p, _ in provider_chain()),
            "exhausted": sorted(_dead),
            "words_today": _budget["words"], "budget": _budget["limit"]}
