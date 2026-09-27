"""Minimal HTTP helpers built on the standard library only (no pip required)."""
import gzip
import io
import ssl
import time
import urllib.error
import urllib.request
import zlib

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0 Safari/537.36")

HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,it;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "close",
}

_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE


def _decode_body(resp, raw):
    enc = (resp.headers.get("Content-Encoding") or "").lower()
    if "gzip" in enc:
        try:
            raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
        except OSError:
            pass
    elif "deflate" in enc:
        try:
            raw = zlib.decompress(raw, -zlib.MAX_WBITS)
        except zlib.error:
            pass
    return raw


def fetch(url, timeout=20, max_bytes=3_000_000, retries=1):
    """Return (status, content_type, bytes, final_url) or (status, ct, None, url) on failure."""
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as resp:
                raw = _decode_body(resp, resp.read(max_bytes))
                ct = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
                return resp.status, ct, raw, resp.geturl()
        except urllib.error.HTTPError as e:
            return e.code, "", None, url
        except Exception as e:                      # noqa: BLE001 - network is best-effort
            last = f"{type(e).__name__}: {e}"
            if attempt < retries:
                time.sleep(1.5)
    return 0, last or "error", None, url


def text(raw, limit=None):
    if raw is None:
        return ""
    s = raw.decode("utf-8", "replace")
    return s[:limit] if limit else s
