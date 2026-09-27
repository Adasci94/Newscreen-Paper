"""Feed discovery + verification.

For every candidate source we try, in order of preference:
  1. feeds declared in the HTML <link rel="alternate"> tags
  2. well-known feed path patterns
Every candidate is then actually fetched and XML-parsed, so the resulting
sources.json records what really works today instead of what ought to work.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse

from http_util import fetch, text

COMMON_PATHS = [
    "/feed/", "/feed", "/rss/", "/rss", "/rss.xml", "/feed.xml", "/atom.xml",
    "/index.xml", "/blog/rss.xml", "/feeds/posts/default", "/en/rss",
]

LINK_RE = re.compile(
    r'<link[^>]+(?:rel=["\']alternate["\'][^>]*type=["\']application/(?:rss|atom)\+xml["\']'
    r'|type=["\']application/(?:rss|atom)\+xml["\'][^>]*rel=["\']alternate["\'])[^>]*>',
    re.I)
HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)
TITLE_ATTR_RE = re.compile(r'title=["\']([^"\']*)["\']', re.I)
CANONICAL_CHANNEL_RE = re.compile(r'rel="canonical"\s+href="https://www\.youtube\.com/channel/(UC[\w-]{20,})"')
EXTERNAL_ID_RE = re.compile(r'"externalId"\s*:\s*"(UC[\w-]{20,})"')
SITEMAP_RE = re.compile(r'^\s*Sitemap:\s*(\S+)', re.I | re.M)


def parse_feed(raw):
    """Return (kind, item_count, latest_title, latest_date) if the payload is a feed."""
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return None
    tag = root.tag.lower()
    ns = {"a": "http://www.w3.org/2005/Atom"}
    if tag.endswith("rss") or tag.endswith("rdf"):
        items = root.findall(".//item")
        kind = "rss"
        get = lambda it, n: (it.findtext(n) or "").strip()  # noqa: E731
        first = items[0] if items else None
        title = get(first, "title") if first is not None else ""
        date = (get(first, "pubDate") or get(first, "{http://purl.org/dc/elements/1.1/}date")) if first is not None else ""
    elif tag.endswith("feed"):
        items = root.findall("a:entry", ns) or root.findall(".//{http://www.w3.org/2005/Atom}entry")
        kind = "atom"
        first = items[0] if items else None
        title = (first.findtext("a:title", "", ns) or "").strip() if first is not None else ""
        date = (first.findtext("a:updated", "", ns) or first.findtext("a:published", "", ns) or "").strip() if first is not None else ""
    else:
        return None
    return kind, len(items), title[:110], date[:40]


def probe(url):
    status, ct, raw, final = fetch(url, timeout=18)
    if raw is None:
        return {"url": url, "ok": False, "status": status, "note": ct}
    parsed = parse_feed(raw)
    if not parsed:
        return {"url": url, "ok": False, "status": status, "note": f"not a feed ({ct})"}
    kind, n, title, date = parsed
    return {"url": final, "ok": True, "status": status, "type": kind,
            "items": n, "latest_title": title, "latest_date": date}


def html_declared_feeds(page_url):
    status, ct, raw, final = fetch(page_url, timeout=20)
    out = []
    if raw is None or "html" not in (ct or ""):
        return out, status
    html = text(raw, 600_000)
    for tag in LINK_RE.findall(html):
        m = HREF_RE.search(tag)
        if not m:
            continue
        href = urljoin(final, m.group(1).replace("&amp;", "&"))
        t = TITLE_ATTR_RE.search(tag)
        if href not in [o[0] for o in out]:
            out.append((href, t.group(1) if t else ""))
    return out, status


def youtube_channel_id(handle_url):
    status, ct, raw, final = fetch(handle_url, timeout=20)
    if raw is None:
        return None, status
    body = text(raw)                      # YouTube pages run past 1 MB; never truncate
    m = CANONICAL_CHANNEL_RE.search(body) or EXTERNAL_ID_RE.search(body)
    return (m.group(1) if m else None), status


def has_sitemap(site_url):
    root = f"{urlparse(site_url).scheme}://{urlparse(site_url).netloc}"
    status, ct, raw, _ = fetch(root + "/robots.txt", timeout=12)
    if raw:
        m = SITEMAP_RE.search(text(raw, 60_000))
        if m:
            return m.group(1)
    status, ct, raw, final = fetch(root + "/sitemap.xml", timeout=12)
    if raw and parse_feed(raw) is None and b"<urlset" in raw[:4000] or (raw and b"<sitemapindex" in raw[:4000]):
        return final
    return None


def investigate(entry):
    """entry: {id, name, url, kind: web|youtube, hints:[urls]}"""
    res = {"id": entry["id"], "name": entry["name"], "url": entry["url"],
           "kind": entry.get("kind", "web"), "feeds": [], "channel_id": None,
           "sitemap": None, "html_status": None}

    if entry.get("kind") == "youtube":
        cid, status = youtube_channel_id(entry["url"])
        res["html_status"] = status
        res["channel_id"] = cid
        if cid:
            r = probe(f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}")
            if r["ok"]:
                res["feeds"].append(r)
        return res

    tried = set()
    candidates = list(entry.get("hints", []))
    declared, status = html_declared_feeds(entry["url"])
    res["html_status"] = status
    candidates += [d[0] for d in declared]
    base = f"{urlparse(entry['url']).scheme}://{urlparse(entry['url']).netloc}"
    fallbacks = [urljoin(base, p) for p in COMMON_PATHS]

    for c in candidates + fallbacks:
        if res["feeds"] and c in fallbacks:
            break                       # a declared feed already works; stop guessing
        cn = c.rstrip("/") or c
        if cn in tried or len(res["feeds"]) >= 3:
            continue
        tried.add(cn)
        r = probe(c)
        if r["ok"] and r["items"] > 0:
            res["feeds"].append(r)
    res["sitemap"] = has_sitemap(entry["url"])
    return res


def main(path, out_name="_discovery.json"):
    entries = json.load(open(path))
    out = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, r in enumerate(ex.map(investigate, entries), 1):
            flag = "OK " if r["feeds"] else ("YT-NO-ID" if r["kind"] == "youtube" else "-- ")
            print(f"[{i:>3}/{len(entries)}] {flag} {r['name'][:38]:<38} "
                  f"feeds={len(r['feeds'])} sitemap={'y' if r['sitemap'] else 'n'}", flush=True)
            out.append(r)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dest = os.path.join(root, "data", out_name)
    json.dump(out, open(dest, "w"), indent=2, ensure_ascii=False)
    ok = sum(1 for r in out if r["feeds"])
    print(f"\nwrote {dest} — {ok}/{len(out)} with a working feed")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "_discovery.json")
