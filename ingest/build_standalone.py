"""Build a single self-contained HTML file.

Everything — CSS, JavaScript and all the data — goes into one file, so it opens
with a double-click on a Mac and from Files or iCloud Drive on an iPhone, with
no server and no network. Feeds cannot be refreshed from inside it: regenerate
the file whenever you want fresher content.
"""
import json
import os
import re
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
WEB = os.path.join(ROOT, "web")
OUT = os.path.join(ROOT, "newscreen-paper.html")

# Fields the interface never reads. Dropping them keeps the file small enough
# to open comfortably on a phone.
ARTICLE_DROP = ("canonical_url", "ingested_at", "updated_at", "available_languages",
                "thumbnail_url")
SOURCE_KEEP = ("id", "name", "domain", "url", "category", "subcategory", "source_type",
               "reliability", "editorial_quality", "technical_depth", "creator_score",
               "primary_source", "language", "topics", "description", "rss_url",
               "youtube_url", "api_url", "active")


def load(name):
    with open(os.path.join(DATA, name)) as fh:
        return json.load(fh)


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def slim_articles(payload, limit):
    arts = payload["articles"][:limit] if limit else payload["articles"]
    out = []
    for a in arts:
        b = {k: v for k, v in a.items() if k not in ARTICLE_DROP and v not in (None, [], "")}
        # thumbnail equals image everywhere; the UI falls back on its own
        if a.get("image_url"):
            b["thumbnail_url"] = a["image_url"]
        ent = b.get("entities") or {}
        b["entities"] = {k: v for k, v in ent.items() if v}
        if not b["entities"]:
            b.pop("entities")
        out.append(b)
    return {"generated_at": payload.get("generated_at"), "count": len(out), "articles": out}


def slim_sources(payload):
    return {"sources": [{k: v for k, v in s.items() if k in SOURCE_KEEP and v not in (None, [], "")}
                        for s in payload["sources"]]}


def live_url():
    """Indirizzo dell'edizione viva. Usa il nome Bonjour del Mac invece
    dell'IP: l'IP glielo cambia il router, il nome no."""
    import subprocess
    try:
        name = subprocess.run(["scutil", "--get", "LocalHostName"],
                              capture_output=True, text=True, timeout=5).stdout.strip()
        if name:
            return "http://%s.local:8080" % name
    except Exception:
        pass
    return "http://localhost:8080"


def build(limit=None):
    articles = slim_articles(load("articles.json"), limit)
    kept = {a["id"] for a in articles["articles"]}

    events = load("events.json")
    events["events"] = [e for e in events["events"]
                        if any(i in kept for i in e["article_ids"])]

    bundle = {
        "categories": load("categories.json"),
        "articles": articles,
        "events": events,
        "sources": slim_sources(load("sources.json")),
        "creators": load("creators.json"),
        "models": load("models.json"),
        "columns": load("columns.json"),
    }
    payload = json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    # </script> inside the JSON would close the tag early
    payload = payload.replace("</", "<\\/")

    css = read(os.path.join(WEB, "assets", "css", "app.css"))
    # Inline the font faces so the file looks the same with no network at all.
    fonts_path = os.path.join(DATA, "fonts-inline.css")
    fonts = read(fonts_path) if os.path.exists(fonts_path) else ""
    js = "\n".join(read(os.path.join(WEB, "assets", "js", f))
                   for f in ("i18n.js", "store.js", "translate.js", "ui.js", "app.js"))

    html = read(os.path.join(WEB, "index.html"))

    # strip the external references — everything is inlined below
    html = re.sub(r'<link rel="stylesheet" href="assets/css/app\.css">', "", html)
    if fonts:
        # the remote stylesheet is no longer needed
        html = re.sub(r'<link href="https://fonts\.googleapis\.com[^>]*>', "", html)
        html = re.sub(r'<link rel="preconnect" href="https://fonts\.g[^>]*>', "", html)
    html = re.sub(r'\s*<script src="assets/js/[^"]+"></script>', "", html)

    # index.html already carries the iOS meta tags; only add what is missing.
    ios_meta = "" if "apple-mobile-web-app-capable" in html else '''
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Newscreen">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#FBFAF8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B0C0F" media="(prefers-color-scheme: dark)">
<meta name="format-detection" content="telephone=no">'''

    head_extra = ios_meta + '''
<link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' rx='40' fill='%2314161A'/%3E%3Ccircle cx='90' cy='90' r='40' fill='none' stroke='%23F2F1EE' stroke-width='11'/%3E%3Ccircle cx='90' cy='90' r='12' fill='%23F2F1EE'/%3E%3C/svg%3E">
<style>
''' + fonts + css + '''
</style>'''

    html = html.replace("</head>", head_extra + "\n</head>")
    live = ('<script>window.__NEWSCREEN_LIVE_URL__=' +
            json.dumps(live_url()) + ';</script>\n')
    html = html.replace("</body>",
                        live +
                        '<script type="application/json" id="newscreen-data">' + payload +
                        '</script>\n<script>\n' + js + '\n</script>\n</body>')

    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)

    size = os.path.getsize(OUT)
    print(f"wrote {os.path.relpath(OUT, ROOT)}")
    print(f"  {len(articles['articles'])} articles · {len(bundle['sources']['sources'])} sources · "
          f"{len(bundle['models']['models'])} models · {len(bundle['columns']['columns'])} columns")
    print(f"  {size/1048576:.2f} MB — opens with no server, on a Mac or an iPhone")
    return OUT


if __name__ == "__main__":
    n = None
    for arg in sys.argv[1:]:
        if arg.startswith("--limit="):
            n = int(arg.split("=", 1)[1])
    build(n)
