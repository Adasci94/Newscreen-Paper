#!/usr/bin/env python3
"""Scarica i woff2 (subset latin) dei font della testata e li incorpora
in data/fonts-inline.css, cosi' il file singolo funziona anche offline."""
import base64, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from http_util import fetch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "fonts-inline.css")

FAMILIES = [
    "Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..700",
    "Libre+Baskerville:ital,wght@0,400;0,700;1,400",
    "Spectral:ital,wght@0,400;0,500;0,600;1,400",
    "Barlow+Condensed:wght@400;500;600",
    "JetBrains+Mono:wght@400;500",
]
URL = "https://fonts.googleapis.com/css2?" + "&".join("family=" + f for f in FAMILIES) + "&display=swap"

def main():
    status, _ctype, raw, _final = fetch(URL, timeout=30, max_bytes=4_000_000)
    if status != 200:
        raise SystemExit("google fonts ha risposto %s" % status)
    css = raw.decode("utf-8", "replace")

    # Teniamo solo i blocchi latin / latin-ext: il resto non serve.
    blocks, keep = [], []
    for chunk in css.split("@font-face"):
        if not chunk.strip():
            continue
        blocks.append("@font-face" + chunk)
    for b in blocks:
        m = re.search(r"/\*\s*([a-z-]+)\s*\*/", b)
        subset = m.group(1) if m else "latin"
        if subset not in ("latin", "latin-ext"):
            continue
        keep.append(b)

    cache, out = {}, []
    for b in keep:
        m = re.search(r"src:\s*url\((https://[^)]+\.woff2)\)", b)
        if not m:
            continue
        url = m.group(1)
        if url not in cache:
            st, _c, data, _f = fetch(url, timeout=30, max_bytes=3_000_000)
            if st != 200 or not data:
                print("  salto (%s) %s" % (st, url))
                continue
            cache[url] = base64.b64encode(data).decode("ascii")
            print("  ok %6d B  %s" % (len(data), url.rsplit("/", 1)[-1]))
        b = b.replace(url, "data:font/woff2;base64," + cache[url])
        b = re.sub(r"\s+", " ", b).strip()
        out.append(b)

    header = ("/* Font incorporati: il file singolo si legge identico anche offline.\n"
              "   Subset latin, woff2, da Google Fonts (Open Font License). */\n")
    with open(OUT, "w") as fh:
        fh.write(header + "\n".join(out) + "\n")
    print("scritto %s  (%d facce, %.0f KB)" % (OUT, len(out), os.path.getsize(OUT) / 1024))

if __name__ == "__main__":
    main()
