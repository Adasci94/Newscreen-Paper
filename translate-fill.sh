#!/usr/bin/env bash
# Top up article translations without re-fetching the feeds.
#
# The keyless providers (MyMemory, Lingva) are capped per day, so running this
# on consecutive days gradually fills the archive — the cache is permanent, so
# nothing is ever translated twice.
#
# To translate everything in one pass, set a free DeepL key first:
#   export DEEPL_API_KEY="your-key:fx"
# 500,000 characters a month is free and covers this dataset several times over.
set -euo pipefail
cd "$(dirname "$0")"
python3 ingest/build.py --translate-only
