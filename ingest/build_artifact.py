"""Build a variant of the standalone page that works inside an Artifact.

Artifacts run under a strict content policy: external images and network calls
are blocked. So this build inlines the thumbnails that matter as data URIs and
turns off the on-demand translator, which could not reach its provider anyway.
Everything else — text, search, filters, columns, model table — is unchanged.
"""
import base64
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_standalone
from http_util import fetch

ROOT = build_standalone.ROOT
DATA = build_standalone.DATA
OUT = os.path.join(ROOT, "newscreen-paper-artifact.html")

MAX_IMAGE_BYTES = 90_000       # skip anything heavier; the page must stay loadable
DEFAULT_COUNT = 70


def smaller_variant(url):
    """YouTube serves several sizes; mqdefault is a third of hqdefault."""
    return url.replace("/hqdefault.jpg", "/mqdefault.jpg")


def fetch_one(item):
    aid, url = item
    status, ct, raw, _ = fetch(smaller_variant(url), timeout=20, max_bytes=MAX_IMAGE_BYTES + 1)
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        return aid, None
    if not ct.startswith("image/"):
        return aid, None
    return aid, f"data:{ct};base64," + base64.b64encode(raw).decode()


def inline_images(count):
    payload = json.load(open(os.path.join(DATA, "articles.json")))
    ranked = sorted(payload["articles"], key=lambda a: -a["scores"]["overall_score"])
    targets = [(a["id"], a["image_url"]) for a in ranked
               if (a.get("image_url") or "").startswith("http")][:count]

    print(f"scaricando {len(targets)} anteprime…")
    inlined = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        for aid, data_uri in ex.map(fetch_one, targets):
            if data_uri:
                inlined[aid] = data_uri

    total = sum(len(v) for v in inlined.values())
    print(f"  {len(inlined)}/{len(targets)} incorporate · {total/1048576:.2f} MB")
    return inlined


def build(count=DEFAULT_COUNT):
    inlined = inline_images(count)

    # Reuse the standalone builder, then rewrite the payload it produced.
    build_standalone.build()
    html = build_standalone.read(build_standalone.OUT)

    m = re.search(r'(<script type="application/json" id="newscreen-data">)(.*?)(</script>)',
                  html, re.S)
    bundle = json.loads(m.group(2).replace("<\\/", "</"))

    kept = 0
    for a in bundle["articles"]["articles"]:
        if a["id"] in inlined:
            a["image_url"] = inlined[a["id"]]
            a["thumbnail_url"] = inlined[a["id"]]
            kept += 1
        else:
            # An image the policy would block renders as a broken frame, so drop it.
            a.pop("image_url", None)
            a.pop("thumbnail_url", None)

    new_payload = json.dumps(bundle, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = html[:m.start(2)] + new_payload + html[m.end(2):]

    # In a gallery the page needs a name, not a caption.
    html = re.sub(r"<title>.*?</title>", "<title>Newscreen paper</title>", html, flags=re.S)

    # The translator cannot reach its provider under the artifact policy.
    html = html.replace("if (global.Translator) global.Translator.scan(els.main);",
                        "/* translator disabled: outbound requests are blocked here */")
    html = html.replace("if (global.Translator) global.Translator.scan(els.searchResults);",
                        "/* translator disabled */")

    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)

    size = os.path.getsize(OUT)
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")
    print(f"  {kept} articoli con anteprima incorporata · {size/1048576:.2f} MB")
    return OUT


if __name__ == "__main__":
    n = DEFAULT_COUNT
    for arg in sys.argv[1:]:
        if arg.startswith("--images="):
            n = int(arg.split("=", 1)[1])
    build(n)
