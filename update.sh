#!/usr/bin/env bash
# Rigenera l'edizione: legge ogni feed verificato, classifica, deduplica,
# raggruppa in eventi e assegna i punteggi. Si può rilanciare quante volte
# si vuole — ricostruisce i JSON da zero ogni volta.
#
# Lo chiamano in tre: launchd agli orari programmati, tu da terminale, e il
# tasto "Aggiorna notizie" dentro l'app (tramite serve.sh).
set -euo pipefail

# macOS puo' rompere il comando "python3" quando xcode-select punta a un Xcode
# la cui licenza non e' stata accettata. Qui si sceglie il primo interprete che
# parte davvero, cosi' il giornale continua a funzionare senza password.
pick_python() {
  for candidate in python3 \
                   /Library/Developer/CommandLineTools/usr/bin/python3 \
                   /opt/homebrew/bin/python3 \
                   /usr/local/bin/python3; do
    if command -v "$candidate" >/dev/null 2>&1 \
       && "$candidate" -c "import sys" >/dev/null 2>&1; then
      printf "%s" "$candidate"; return 0
    fi
  done
  echo "Nessun Python funzionante trovato sul Mac." >&2
  return 1
}
PYTHON="$(pick_python)" || exit 1

# Chiavi private. Il lavoro programmato di macOS riceve un ambiente spoglio
# (solo PATH), quindi una "export" nel profilo della shell non arriverebbe qui:
# le chiavi vanno lette da questo file. Non finisce in nessun backup condiviso
# e ha permessi 600, leggibile solo dal tuo utente.
if [ -f "$(dirname "$0")/.secrets" ]; then
  set -a
  . "$(dirname "$0")/.secrets"
  set +a
fi


cd "$(dirname "$0")"
mkdir -p logs

# Un solo ingest per volta. Se l'aggiornamento programmato parte mentre stai
# premendo il tasto nell'app, il secondo si ferma invece di scrivere sugli
# stessi file a metà lavoro.
LOCKDIR="logs/.ingest.lock"
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  OLDPID="$(cat "$LOCKDIR/pid" 2>/dev/null || echo "")"
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    echo "── aggiornamento già in corso (pid $OLDPID), non ne parte un secondo ──"
    exit 0
  fi
  # lock rimasto da un processo morto male: lo tolgo e procedo
  rm -rf "$LOCKDIR"
  mkdir "$LOCKDIR"
fi
echo $$ > "$LOCKDIR/pid"
trap 'rm -rf "$LOCKDIR"' EXIT

echo "── Newscreen paper ingest · $(date '+%Y-%m-%d %H:%M') ──"
"$PYTHON" ingest/build.py
echo "── fatto · $(date '+%H:%M') · il server mostra subito questa edizione ──"
