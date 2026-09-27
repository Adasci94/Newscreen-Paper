#!/usr/bin/env bash
# Build newscreen-paper.html: one self-contained file, no server needed.
#
#   ./build-portable.sh              tutti gli articoli
#   ./build-portable.sh 300          solo i 300 più recenti (file più leggero)
#
# Il file si apre con un doppio clic sul Mac e da File/iCloud su iPhone.
# Le traduzioni già presenti in data/translations.json finiscono dentro il file,
# quindi conviene lanciare ./translate-fill.sh prima di rigenerarlo.
set -euo pipefail
cd "$(dirname "$0")"
if [ $# -gt 0 ]; then
  python3 ingest/build_standalone.py --limit="$1"
else
  python3 ingest/build_standalone.py
fi
echo
echo "Per aprirlo subito:  open newscreen-paper.html"
echo "Per mandarlo su iPhone: AirDrop, oppure copialo in iCloud Drive"
