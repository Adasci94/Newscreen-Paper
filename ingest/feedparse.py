"""RSS / Atom / YouTube-feed parsing into a single normalised item shape.

Only stdlib. We keep the excerpt the publisher chose to put in the feed and cut
it to a short summary — we never fetch or store the full article body.
"""
import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "media": "http://search.yahoo.com/mrss/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
}

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
IMG_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.I)
SUMMARY_MAX = 420


def clean_text(raw, limit=None):
    if not raw:
        return ""
    s = TAG_RE.sub(" ", raw)
    s = html.unescape(s)
    s = WS_RE.sub(" ", s).strip()
    if limit and len(s) > limit:
        cut = s[:limit].rsplit(" ", 1)[0]
        s = cut.rstrip(" ,;:—-") + "…"
    return s


def parse_date(raw):
    if not raw:
        return None
    raw = raw.strip()
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (TypeError, ValueError, IndexError):
        pass
    iso = raw.replace("Z", "+00:00")
    iso = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", iso)
    for candidate in (iso, iso.split(".")[0] + ("+00:00" if "+" in iso else "")):
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            continue
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
    return None


def _first_image(elem, description_html):
    for path in ("media:content", "media:thumbnail"):
        node = elem.find(path, NS)
        if node is not None and node.get("url"):
            return node.get("url")
    for node in elem.findall("enclosure"):
        if (node.get("type") or "").startswith("image") and node.get("url"):
            return node.get("url")
    group = elem.find("media:group", NS)
    if group is not None:
        thumb = group.find("media:thumbnail", NS)
        if thumb is not None and thumb.get("url"):
            return thumb.get("url")
    if description_html:
        m = IMG_RE.search(description_html)
        if m:
            return m.group(1)
    return None


def _audio_enclosure(elem):
    for node in elem.findall("enclosure"):
        if (node.get("type") or "").startswith("audio") and node.get("url"):
            return node.get("url")
    return None


def parse(raw_bytes):
    """Return a list of normalised feed items, newest-first order preserved from the feed."""
    try:
        root = ET.fromstring(raw_bytes)
    except ET.ParseError:
        return []
    tag = root.tag.lower()
    if tag.endswith("feed"):
        return _parse_atom(root)
    return _parse_rss(root)


def _parse_rss(root):
    items = []
    for it in root.findall(".//item"):
        desc_html = it.findtext("description") or it.findtext("content:encoded", "", NS) or ""
        link = (it.findtext("link") or "").strip()
        if not link:
            guid = it.findtext("guid") or ""
            if guid.startswith("http"):
                link = guid.strip()
        if not link:
            continue
        items.append({
            "title": clean_text(it.findtext("title")),
            "url": link,
            "summary": clean_text(desc_html, SUMMARY_MAX),
            "published": parse_date(it.findtext("pubDate") or it.findtext("dc:date", "", NS)),
            "author": clean_text(it.findtext("dc:creator", "", NS) or it.findtext("author") or ""),
            "image": _first_image(it, desc_html),
            "audio_url": _audio_enclosure(it),
            "duration": (it.findtext("itunes:duration", "", NS) or "").strip() or None,
            "categories": [clean_text(c.text) for c in it.findall("category") if c.text],
        })
    return items


def _parse_atom(root):
    items = []
    for e in root.findall("atom:entry", NS):
        link = ""
        for ln in e.findall("atom:link", NS):
            rel = ln.get("rel") or "alternate"
            if rel == "alternate" and ln.get("href"):
                link = ln.get("href")
                break
        if not link:
            ln = e.find("atom:link", NS)
            link = ln.get("href") if ln is not None else ""
        if not link:
            continue

        group = e.find("media:group", NS)
        summary_src = (e.findtext("atom:summary", "", NS)
                       or e.findtext("atom:content", "", NS))
        if group is not None and not summary_src:
            summary_src = group.findtext("media:description", "", NS)

        video_id = e.findtext("yt:videoId", "", NS) or None
        channel_id = e.findtext("yt:channelId", "", NS) or None

        items.append({
            "title": clean_text(e.findtext("atom:title", "", NS)),
            "url": link,
            "summary": clean_text(summary_src, SUMMARY_MAX),
            "published": parse_date(e.findtext("atom:published", "", NS)
                                    or e.findtext("atom:updated", "", NS)),
            "author": clean_text(e.findtext("atom:author/atom:name", "", NS)),
            "image": _first_image(e, summary_src),
            "audio_url": None,
            "duration": None,
            "categories": [c.get("term") for c in e.findall("atom:category", NS) if c.get("term")],
            "video_id": video_id,
            "channel_id": channel_id,
        })
    return items
