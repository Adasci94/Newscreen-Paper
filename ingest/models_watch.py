"""Flag models the feeds are talking about that data/models.json does not know.

The model table goes stale faster than anything else on the platform, so the
pipeline reports the gap instead of pretending to be complete. It never writes
to models.json by itself: a model is added by hand, with a source, on purpose.
"""
import json
import os
import re
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

# Names carrying a version number are almost always products.
VERSIONED = re.compile(
    r"\b([A-Z][A-Za-z]*(?:[ -][A-Z][A-Za-z.]*){0,2}"
    r"[ -]?v?\d+(?:\.\d+)*"
    r"(?:[ -](?:Flash|Pro|Turbo|Ultra|Mini|Max|Lite|Preview|Astra|Cyber|Animate|Instruct))?)\b")

STOP_PREFIX = re.compile(
    r"^(The|A|An|In|On|At|To|Top|No|US|UK|EU|Q[1-4]|Part|Episode|Season|Day|Week|Chapter|"
    r"Watch|Get|Meet|How|Why|What|Introducing|Announcing)\b", re.I)

# A model name is not a festival edition, a trade show or a date.
NOISE = re.compile(
    r"\b(19|20)\d{2}\b"                                   # any year
    r"|\b(festival|biennale|venezia|venice|cannes|sundance|berlinale|locarno|oscar|award|"
    r"edition|concorso|competition|lineup|selection|ibc|nab|siggraph|ces|conference|summit|"
    r"january|february|march|april|may|june|july|august|september|october|november|december|"
    r"filmmaker|episode|season|volume|chapter|issue|"
    r"geforce|simulator|fortran|cobol|python|javascript|windows|android|ios|"
    r"nvl\d|rtx|gpu|using|with|from|and|the)\b", re.I)

# Only these categories can plausibly contain a model release.
MODEL_CATEGORIES = {"ai", "generative_media", "models", "tutorials"}


def load(name):
    with open(os.path.join(DATA, name)) as fh:
        return json.load(fh)


def known_names():
    models = load("models.json")["models"]
    lex = load("lexicon.json")
    names = {m["name"].lower() for m in models}
    names |= {m.lower() for m in lex["models"]}
    return names, models


def candidates(articles, sources_by_id, min_mentions=2):
    names, _ = known_names()
    counter = Counter()
    evidence = {}

    for a in articles:
        if a["category"] not in MODEL_CATEGORIES:
            continue
        text = a["title_original"] + " " + (a.get("summary_original") or "")
        weight = 3 if sources_by_id.get(a["source_id"], {}).get("source_type") in (
            "primary", "official_documentation") else 1
        for m in VERSIONED.finditer(text):
            name = m.group(1).strip().rstrip(".")
            if len(name) < 4 or STOP_PREFIX.match(name) or NOISE.search(name):
                continue
            low = name.lower()
            if low in names:
                continue
            # skip things that are versions of something already tracked
            if any(low.startswith(k) or k.startswith(low) for k in names if len(k) > 4):
                continue
            counter[name] += weight
            evidence.setdefault(name, []).append(a)

    return [(n, c, evidence[n]) for n, c in counter.most_common() if c >= min_mentions]


def report(articles=None, sources=None, limit=12):
    if articles is None:
        articles = load("articles.json")["articles"]
    if sources is None:
        sources = load("sources.json")["sources"]
    by_id = {s["id"]: s for s in sources}

    found = candidates(articles, by_id)
    if not found:
        print("model watch: nothing new named in the feeds")
        return []

    print(f"\nmodel watch: {len(found)} names mentioned but missing from models.json")
    for name, score, arts in found[:limit]:
        lead = max(arts, key=lambda a: (
            by_id.get(a["source_id"], {}).get("source_type") in ("primary", "official_documentation"),
            a["published_at"]))
        src = by_id.get(lead["source_id"], {})
        print(f"  {score:>3}  {name:<26} {src.get('name', '?')[:20]:<20} {lead['url'][:66]}")
    if len(found) > limit:
        print(f"  … and {len(found) - limit} more")
    return found


if __name__ == "__main__":
    report()
