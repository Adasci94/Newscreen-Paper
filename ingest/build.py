"""Build articles.json and events.json from the verified sources.

Pipeline: fetch -> parse -> normalise -> deduplicate -> cluster into events
-> score -> emit. Run it daily; it is idempotent and needs no database.
"""
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import enrich
import feedparse
import models_watch
import translate
from http_util import fetch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
WEB_DATA = os.path.join(ROOT, "web", "data")

MAX_ITEMS_PER_SOURCE = 25
MAX_AGE_DAYS = 45

SHORTS_RE = re.compile(r"#shorts?\b", re.I)
PROMO_RE = re.compile(r"https?://|\bsign up\b|\benroll\b|\bfree access\b|"
                      r"\bjoin (?:my|our|the) (?:course|community|academy)\b|"
                      r"\buse code\b|\bdiscount\b", re.I)

STOPWORDS = set("""a an the and or of to in on for with at by from as is are was were be been
il lo la i gli le un uno una di a da in con su per tra fra e o che non si del della dello dei
degli delle al allo alla ai agli alle dal dalla nel nella sul sulla è ha hanno come più
new nuovo nuova now just first best top how why what""".split())


# ---------------------------------------------------------------- utilities

def canonicalise(url, strip_params):
    try:
        p = urlparse(url)
    except ValueError:
        return url
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=False)
         if k.lower() not in strip_params]
    path = p.path.rstrip("/") or "/"
    netloc = p.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    if netloc.startswith("m."):
        netloc = netloc[2:]
    return urlunparse(("https", netloc, path, "", urlencode(q), ""))


def title_tokens(title):
    words = re.findall(r"[\w'’]+", title.lower())
    return {w for w in words if len(w) > 2 and w not in STOPWORDS}


def norm_title(title):
    return " ".join(sorted(title_tokens(title)))


def similar(a, b):
    return SequenceMatcher(None, a, b).ratio()


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


# ---------------------------------------------------------------- fetch stage

def collect(source):
    url = source.get("rss_url")
    if not url or not source.get("active", True):
        return source["id"], [], "skipped"
    status, ct, raw, final = fetch(url, timeout=25, retries=1)
    if raw is None:
        return source["id"], [], f"error {status}"
    items = feedparse.parse(raw)[:MAX_ITEMS_PER_SOURCE]
    return source["id"], items, f"{len(items)} items"


# ---------------------------------------------------------------- normalise

def build_article(item, source, creators_by_source, strip_params):
    if not item.get("title") or not item.get("url"):
        return None
    published = item.get("published")
    if published is None:
        return None
    age = datetime.now(timezone.utc) - published
    if age > timedelta(days=MAX_AGE_DAYS) or age < timedelta(days=-2):
        return None

    canonical = canonicalise(item["url"], strip_params)
    aid = hashlib.sha1(canonical.encode()).hexdigest()[:16]

    title = item["title"]
    summary = item.get("summary") or ""
    text = f"{title} {summary}"

    if SHORTS_RE.search(title):
        return None                      # Shorts are promo clips, not content

    lang = source.get("language")
    if isinstance(lang, list):
        # Bilingual sources (antirez, enkk) declare several: decide per item.
        lang = enrich.detect_language(text) if len(lang) > 1 else lang[0]
    if lang in (None, "both", "mixed"):
        lang = enrich.detect_language(text)

    has_video = bool(item.get("video_id")) or source.get("source_type") == "creator" and source.get("youtube_available")
    has_audio = bool(item.get("audio_url"))

    ctype = enrich.content_type(title, summary, source, has_video, has_audio)
    category, subcategory = enrich.classify(text, source)
    entities = enrich.extract_entities(text)

    art = {
        "id": aid,
        "source_id": source["id"],
        "creator_id": creators_by_source.get(source["id"]),
        "title_original": title,
        "title_it": title if lang == "it" else None,
        "title_en": title if lang == "en" else None,
        "summary_original": summary or None,
        "summary_it": summary if lang == "it" and summary else None,
        "summary_en": summary if lang == "en" and summary else None,
        "url": item["url"],
        "canonical_url": canonical,
        "published_at": iso(published),
        "updated_at": None,
        "ingested_at": iso(datetime.now(timezone.utc)),
        "original_language": lang,
        "available_languages": [lang],
        "category": category,
        "subcategory": subcategory,
        "tags": sorted(set(
            (entities["models"] + entities["tools"] + entities["companies"])[:6]
            + [c for c in (item.get("categories") or [])[:3] if c and len(c) < 30]
        )),
        "entities": entities,
        "content_type": ctype,
        "source_type": source.get("source_type", "editorial"),
        "image_url": item.get("image"),
        "thumbnail_url": item.get("image"),
        "media": None,
        "tutorial": None,
        "event_id": None,
        "is_event_primary": False,
    }

    if item.get("video_id"):
        art["media"] = {
            "kind": "youtube", "video_id": item["video_id"],
            "channel": source["name"], "channel_id": item.get("channel_id"),
            "duration": None, "audio_url": None, "transcript_available": None,
        }
        if not art["image_url"]:
            art["image_url"] = f"https://i.ytimg.com/vi/{item['video_id']}/hqdefault.jpg"
            art["thumbnail_url"] = art["image_url"]
    elif has_audio:
        art["media"] = {
            "kind": "podcast", "video_id": None, "channel": source["name"],
            "channel_id": None, "duration": item.get("duration"),
            "audio_url": item.get("audio_url"), "transcript_available": None,
        }

    if ctype in ("tutorial", "workflow"):
        meta = enrich.tutorial_meta(title, summary)
        meta["author"] = item.get("author") or source["name"]
        art["tutorial"] = meta

    # scores
    freshness = enrich.freshness_score(published, ctype)
    tech = enrich.technical_score(text, source)
    hype = enrich.hype_score(title)
    if PROMO_RE.search(title):
        hype = min(70.0, hype + 35.0)    # course/link promos are not editorial content
    importance = enrich.importance_score(art, source, entities)
    art["scores"] = {
        "importance_score": round(importance, 1),
        "quality_score": round(float(source.get("editorial_quality", 50)), 1),
        "credibility_score": round(float(source.get("reliability", 50)), 1),
        "technical_score": round(tech, 1),
        "freshness_score": round(freshness, 1),
        "creator_score": round(float(source.get("creator_score", 0)), 1),
        "hype_score": round(hype, 1),
        "overall_score": 0.0,
    }
    art["scores"]["overall_score"] = enrich.overall_score(art["scores"])
    return art


# ---------------------------------------------------------------- dedupe

def deduplicate(articles, cfg):
    by_canonical = {}
    for a in sorted(articles, key=lambda x: -x["scores"]["overall_score"]):
        by_canonical.setdefault(a["canonical_url"], a)
    kept = list(by_canonical.values())

    # Near-duplicates: same story republished under a different URL by the same
    # outlet, or syndicated. Different outlets are NOT dropped here — they are
    # clustered into one event later, which preserves the "who else covered it".
    out, dropped = [], 0
    seen = []
    for a in sorted(kept, key=lambda x: -x["scores"]["overall_score"]):
        nt = norm_title(a["title_original"])
        dup = False
        for prev_nt, prev in seen:
            if prev["source_id"] != a["source_id"]:
                continue
            if similar(nt, prev_nt) >= cfg["title_similarity_threshold"]:
                dup = True
                break
        if dup:
            dropped += 1
            continue
        seen.append((nt, a))
        out.append(a)
    return out, len(articles) - len(kept), dropped


# ---------------------------------------------------------------- clustering

def cluster_events(articles, sources_by_id, cfg):
    window = timedelta(hours=cfg["cluster_window_hours"])
    thr = cfg["title_similarity_threshold"]
    min_ent = cfg["entity_overlap_min"]
    ent_title_min = cfg.get("entity_title_min_similarity", 0.35)

    ordered = sorted(articles, key=lambda a: a["published_at"])
    clusters = []

    for a in ordered:
        ts = datetime.strptime(a["published_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        nt = norm_title(a["title_original"])
        ents = set(a["entities"]["models"] + a["entities"]["companies"] + a["entities"]["tools"])
        placed = False
        for c in reversed(clusters):
            if ts - c["last_ts"] > window:
                continue
            if c["category"] != a["category"]:
                continue
            if all(x["source_id"] == a["source_id"] for x in c["articles"]):
                continue          # an event exists to join different outlets, not one outlet's own posts
            sim = similar(nt, c["norm_title"])
            title_close = sim >= thr
            # Entity overlap alone merges unrelated stories that merely name the same
            # big company, so it still has to clear a low title-similarity floor.
            ent_close = (len(ents & c["entities"]) >= min_ent and len(ents) >= min_ent
                         and sim >= ent_title_min)
            if title_close or ent_close:
                c["articles"].append(a)
                c["entities"] |= ents
                c["last_ts"] = max(c["last_ts"], ts)
                placed = True
                break
        if not placed:
            clusters.append({
                "articles": [a], "entities": ents, "norm_title": nt,
                "first_ts": ts, "last_ts": ts, "category": a["category"],
            })

    events = []
    for c in clusters:
        arts = c["articles"]
        if len(arts) < 2:
            continue
        arts.sort(key=lambda x: (
            0 if sources_by_id.get(x["source_id"], {}).get("primary_source") else 1,
            -x["scores"]["overall_score"]))
        lead = arts[0]
        eid = "ev_" + hashlib.sha1((lead["id"] + str(len(arts))).encode()).hexdigest()[:12]
        src_ids = []
        for x in arts:
            if x["source_id"] not in src_ids:
                src_ids.append(x["source_id"])
        primary = next((s for s in src_ids if sources_by_id.get(s, {}).get("primary_source")), None)

        boost = min(20, 5 * (len(src_ids) - 1)) + (10 if primary else 0)
        for i, x in enumerate(arts):
            x["event_id"] = eid
            x["is_event_primary"] = (i == 0)
            x["scores"]["importance_score"] = round(min(100.0, x["scores"]["importance_score"] + boost), 1)
            x["scores"]["overall_score"] = enrich.overall_score(x["scores"])

        events.append({
            "event_id": eid,
            "title": lead["title_original"],
            "title_it": lead["title_it"],
            "title_en": lead["title_en"],
            "summary": lead["summary_original"],
            "date": iso(c["first_ts"]),
            "last_update": iso(c["last_ts"]),
            "category": c["category"],
            "subcategory": lead.get("subcategory"),
            "entities": {
                "models": sorted({m for x in arts for m in x["entities"]["models"]}),
                "companies": sorted({m for x in arts for m in x["entities"]["companies"]}),
                "tools": sorted({m for x in arts for m in x["entities"]["tools"]}),
                "people": [], "films": [],
            },
            "importance": round(min(100.0, lead["scores"]["importance_score"]), 1),
            "primary_source": primary,
            "primary_article_id": lead["id"],
            "secondary_sources": [s for s in src_ids if s != primary],
            "sources": src_ids,
            "article_ids": [x["id"] for x in arts],
            "coverage_count": len(arts),
        })
    events.sort(key=lambda e: (-e["importance"], e["last_update"]), reverse=False)
    return events


# ---------------------------------------------------------------- main

def translate_articles(articles, cfg):
    """Fill title_it/title_en and summary_it/summary_en, best articles first.

    Titles come first across the whole set, then summaries with whatever budget
    is left: a reader scanning a page needs 400 translated headlines far more
    than 40 fully translated cards. Anything the budget cannot reach is
    translated on demand in the browser.
    """
    translate.set_budget(cfg.get("daily_word_budget", 4500))
    targets = cfg.get("targets", ["it", "en"])
    do_summaries = cfg.get("translate_summaries", True)
    limit = cfg.get("max_articles", 400)

    ranked = sorted(articles, key=lambda a: -a["scores"]["overall_score"])[:limit]

    def collect(field):
        jobs, owners = [], {}
        for a in ranked:
            src = a["original_language"]
            if src not in ("it", "en"):
                continue
            value = a["title_original"] if field == "title" else a.get("summary_original")
            if not value:
                continue
            for target in targets:
                if target == src or a.get(f"{field}_{target}"):
                    continue
                jobs.append((value, src, target))
                owners.setdefault((value, target), []).append(a)
        seen, unique = set(), []
        for j in jobs:
            if (j[0], j[2]) not in seen:
                seen.add((j[0], j[2]))
                unique.append(j)
        return unique, owners

    provider = translate.active_provider()[0]
    total = 0

    for field in (["title", "summary"] if do_summaries else ["title"]):
        jobs, owners = collect(field)
        if not jobs:
            continue
        print(f"translating {len(jobs)} {field}s via {provider}…")
        results = translate.translate_many(jobs)
        total += len(results)
        for (text, target), out in results.items():
            for art in owners.get((text, target), []):
                art[f"{field}_{target}"] = out
                if target not in art["available_languages"]:
                    art["available_languages"].append(target)
        if translate.budget_state()["words"] >= translate.budget_state()["limit"]:
            print("  daily translation budget reached — the browser covers the rest on demand")
            break

    translate.save_cache()
    st = translate.stats()
    titled = sum(1 for a in articles
                 if all(a.get(f"title_{t}") or a["original_language"] == t for t in targets))
    print(f"translated {total} strings · {titled}/{len(articles)} articles have a title in both "
          f"languages · {st['words_today']}/{st['budget']} words used today · cache holds "
          f"{st['translated']} entries")


def translate_only():
    """Top up translations for the articles already ingested.

    The keyless providers are capped per day, so the archive fills in over a few
    runs. Nothing is ever translated twice: the cache is permanent.
    """
    prio = json.load(open(os.path.join(DATA, "source-priority.json")))
    enrich.load_config(DATA)
    payload = json.load(open(os.path.join(DATA, "articles.json")))
    articles = payload["articles"]

    translate_articles(articles, prio.get("translation", {}))

    payload["articles"] = articles
    with open(os.path.join(DATA, "articles.json"), "w") as fh:
        json.dump(payload, fh, indent=1, ensure_ascii=False)
    with open(os.path.join(WEB_DATA, "articles.json"), "w") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    print("articles.json updated with the new translations")


def main():
    sources = json.load(open(os.path.join(DATA, "sources.json")))["sources"]
    creators = json.load(open(os.path.join(DATA, "creators.json")))["creators"]
    prio = json.load(open(os.path.join(DATA, "source-priority.json")))
    enrich.load_config(DATA)

    strip = set(prio["deduplication"]["url_strip_params"])
    creators_by_source = {c["source_id"]: c["id"] for c in creators if c.get("source_id")}
    sources_by_id = {s["id"]: s for s in sources}
    active = [s for s in sources if s.get("rss_url") and s.get("active", True)]

    print(f"fetching {len(active)} active feeds…")
    raw_items = {}
    with ThreadPoolExecutor(max_workers=10) as ex:
        for sid, items, note in ex.map(collect, active):
            raw_items[sid] = items
            print(f"  {sid:<26} {note}")

    articles = []
    for sid, items in raw_items.items():
        src = sources_by_id[sid]
        for it in items:
            a = build_article(it, src, creators_by_source, strip)
            if a:
                articles.append(a)

    print(f"\nnormalised {len(articles)} articles")
    articles, dup_url, dup_title = deduplicate(articles, prio["deduplication"])
    print(f"deduplicated: -{dup_url} same URL, -{dup_title} near-duplicate titles → {len(articles)}")

    events = cluster_events(articles, sources_by_id, prio["deduplication"])
    print(f"clustered {len(events)} multi-source events")

    tcfg = prio.get("translation", {})
    if tcfg.get("enabled", True):
        translate_articles(articles, tcfg)

    articles.sort(key=lambda a: a["published_at"], reverse=True)

    generated = iso(datetime.now(timezone.utc))
    os.makedirs(WEB_DATA, exist_ok=True)
    json.dump({"generated_at": generated, "count": len(articles), "articles": articles},
              open(os.path.join(DATA, "articles.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({"generated_at": generated, "count": len(events), "events": events},
              open(os.path.join(DATA, "events.json"), "w"), indent=1, ensure_ascii=False)

    # data/ stays indented and readable for humans; web/data/ is minified, since
    # articles.json is served on every page load.
    for name in ("articles.json", "events.json", "sources.json", "creators.json",
                 "categories.json", "models.json", "columns.json", "lexicon.json"):
        src_path = os.path.join(DATA, name)
        if not os.path.exists(src_path):
            continue
        with open(src_path) as fh:
            payload = json.load(fh)
        with open(os.path.join(WEB_DATA, name), "w") as fh:
            json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))

    by_cat = defaultdict(int)
    for a in articles:
        by_cat[a["category"]] += 1
    print("\nper category: " + ", ".join(f"{k}={v}" for k, v in sorted(by_cat.items())))
    print(f"wrote data/articles.json, data/events.json and copied into web/data/")

    # The model table ages faster than anything else: say what the feeds named
    # that models.json does not know yet.
    try:
        models_watch.report(articles, sources, limit=8)
    except Exception as e:                                   # noqa: BLE001
        print(f"model watch skipped: {e}")


if __name__ == "__main__":
    if "--translate-only" in sys.argv:
        sys.exit(translate_only())
    sys.exit(main())
