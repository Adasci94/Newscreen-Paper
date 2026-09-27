"""Merge verified technical facts (discover.py) with editorial judgement
(source_meta.json / creator_meta.json) into data/sources.json, sources.csv
and data/creators.json.

Nothing here invents a feed: a source without a verified feed is written out
with active=false and a note saying what would be needed to ingest it.
"""
import csv
import json
import os
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
INGEST = os.path.join(ROOT, "ingest")


def load(path):
    with open(path) as fh:
        return json.load(fh)


def discovery_index():
    """Later files win, so retries override the first pass."""
    idx = {}
    for name in ("_discovery_main.json", "_discovery.json", "_discovery_retry.json"):
        p = os.path.join(DATA, name)
        if not os.path.exists(p):
            continue
        for rec in load(p):
            if rec["feeds"] or rec["id"] not in idx:
                idx[rec["id"]] = rec
    return idx


def domain_of(url):
    net = urlparse(url).netloc.lower()
    return net[4:] if net.startswith("www.") else net


def build():
    disc = discovery_index()
    smeta = load(os.path.join(INGEST, "source_meta.json"))
    cmeta = load(os.path.join(INGEST, "creator_meta.json"))["creators"]
    defaults = smeta["defaults"]
    curated = smeta["sources"]

    sources, creators = [], []
    skipped = []

    for sid, rec in sorted(disc.items()):
        is_creator = sid in cmeta
        meta = cmeta.get(sid) if is_creator else curated.get(sid)

        if meta is None:
            skipped.append((sid, "no metadata entry — assess it before enabling"))
            continue
        if is_creator and not meta.get("include", True):
            skipped.append((sid, "creator excluded by review"))
            continue

        feed = rec["feeds"][0] if rec["feeds"] else None
        is_youtube = rec["kind"] == "youtube"

        def m(key, fallback=None):
            return meta.get(key, defaults.get(key, fallback))

        source = {
            "id": sid,
            "name": meta.get("name", rec["name"]),
            "domain": domain_of(rec["url"]),
            "url": rec["url"],
            "category": m("category"),
            "subcategory": m("subcategory"),
            "source_type": "creator" if is_creator else m("source_type"),
            "reliability": m("reliability"),
            "editorial_quality": m("editorial_quality"),
            "technical_depth": m("technical_depth"),
            "creator_score": meta.get("creator_score", 0) if is_creator else 0,
            "specialization_bonus": bool(meta.get("specialization_bonus", False)),
            "update_frequency": meta.get("update_frequency", "weekly"),
            "primary_source": bool(meta.get("primary_source", False)),
            "language": meta.get("language", defaults["language"]),
            "topics": meta.get("topics", []),
            "description": {"it": meta.get("desc_it", ""), "en": meta.get("desc_en", "")},

            "rss_available": bool(feed),
            "rss_url": feed["url"] if feed else None,
            "rss_type": feed["type"] if feed else None,
            "api_available": False,
            "api_url": None,
            "sitemap_available": bool(rec.get("sitemap")),
            "sitemap_url": rec.get("sitemap"),
            "youtube_available": is_youtube,
            "youtube_url": rec["url"] if is_youtube else meta.get("youtube"),
            "youtube_channel_id": rec.get("channel_id"),
            "podcast_available": bool(meta.get("podcast")),
            "podcast_url": meta.get("podcast"),
            "tutorial_available": m("source_type") == "tutorial" or meta.get("category") == "tutorials",
            "official_documentation": m("source_type") == "official_documentation",
            "commercial_use_possible": "check_terms",
            "active": bool(feed),
            "verified_at": "2026-09-12",
            "last_item_seen": feed.get("latest_date") if feed else None,
            "notes": meta.get("verdict") or (
                "No feed found during verification; would need sitemap parsing or a manual check."
                if not feed else "")
        }
        sources.append(source)

        if is_creator:
            creators.append({
                "id": sid.replace("yt-", "cr-"),
                "source_id": sid,
                "name": meta["name"],
                "alias": meta.get("alias"),
                "website": meta.get("website"),
                "youtube": rec["url"] if is_youtube else meta.get("youtube"),
                "github": meta.get("github"),
                "x": meta.get("x"),
                "linkedin": meta.get("linkedin"),
                "instagram": meta.get("instagram"),
                "podcast": meta.get("podcast"),
                "language": meta.get("language", ["en"]),
                "country": meta.get("country"),
                "specialization": meta.get("topics", [])[:3],
                "creator_type": meta.get("creator_type", "creator"),
                "technical_depth": meta["technical_depth"],
                "editorial_quality": meta["editorial_quality"],
                "reliability": meta["reliability"],
                "creator_score": meta.get("creator_score", 0),
                "topics": meta.get("topics", []),
                "description": {"it": meta.get("desc_it", ""), "en": meta.get("desc_en", "")},
                "assessment": meta.get("verdict", "")
            })

    # Curated entries that never made it into a discovery run at all
    for sid, meta in curated.items():
        if sid in disc:
            continue
        skipped.append((sid, "never verified"))

    sources.sort(key=lambda s: (-(s["reliability"] + s["technical_depth"]), s["name"]))
    creators.sort(key=lambda c: -(c["reliability"] + c["technical_depth"]))

    generated = "2026-09-12"
    json.dump({"generated_at": generated, "count": len(sources), "sources": sources},
              open(os.path.join(DATA, "sources.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({"generated_at": generated, "count": len(creators), "creators": creators},
              open(os.path.join(DATA, "creators.json"), "w"), indent=1, ensure_ascii=False)

    cols = ["id", "name", "domain", "url", "category", "subcategory", "source_type",
            "reliability", "editorial_quality", "technical_depth", "creator_score",
            "primary_source", "language", "update_frequency", "rss_available", "rss_url",
            "sitemap_available", "youtube_available", "podcast_available",
            "official_documentation", "active"]
    with open(os.path.join(DATA, "sources.csv"), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for s in sources:
            row = dict(s)
            row["language"] = "|".join(s["language"]) if isinstance(s["language"], list) else s["language"]
            w.writerow(row)

    active = sum(1 for s in sources if s["active"])
    print(f"sources.json   {len(sources)} sources ({active} active with a verified feed)")
    print(f"creators.json  {len(creators)} creators")
    print(f"sources.csv    {len(cols)} columns")
    if skipped:
        print(f"\nnot written ({len(skipped)}):")
        for sid, why in skipped:
            print(f"  {sid:<24} {why}")


if __name__ == "__main__":
    build()
