#!/usr/bin/env bash
# Re-verify every candidate feed and rebuild sources.json / creators.json.
# Run this occasionally (monthly is plenty): feeds move, sites change CMS.
set -euo pipefail
cd "$(dirname "$0")"
echo "── verifica fonti (richiede qualche minuto) ──"
( cd ingest && python3 discover.py candidates.json _discovery_main.json )
python3 ingest/build_sources.py
echo "── fatto. Ora esegui ./update.sh per scaricare i contenuti ──"
