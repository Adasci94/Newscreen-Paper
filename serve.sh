#!/usr/bin/env bash
# Serve la webapp. Di default è raggiungibile dagli altri dispositivi sulla
# stessa Wi-Fi, così la leggi da iPhone mentre il Mac fa da server.
#
#   ./serve.sh            porta 8080, raggiungibile dal telefono
#   ./serve.sh 9000       porta diversa
#   ./serve.sh 8080 local solo su questo Mac
#
# Oltre ai file, espone due comandi che servono al tasto "Aggiorna notizie":
#   GET  /api/status   → dice se un aggiornamento è in corso e di quando è
#                        l'edizione attualmente sul disco
#   POST /api/refresh  → lancia update.sh e risponde subito, senza aspettare
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

cd "$(dirname "$0")/web"
PORT="${1:-8080}"
SCOPE="${2:-lan}"

if [ "$SCOPE" = "local" ]; then
  BIND="127.0.0.1"
else
  BIND="0.0.0.0"
fi

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")"
HOST="$(scutil --get LocalHostName 2>/dev/null || echo "")"

echo "Newscreen paper"
echo "  su questo Mac   →  http://localhost:${PORT}"
if [ "$SCOPE" != "local" ]; then
  if [ -n "$HOST" ]; then
    echo "  da iPhone/iPad  →  http://${HOST}.local:${PORT}     ← usa questo"
    echo "                      (non cambia mai, anche se il router"
    echo "                       riassegna l'indirizzo al Mac)"
  fi
  [ -n "$IP" ] && echo "  ripiego numerico →  http://${IP}:${PORT}   (può cambiare)"
  echo
  echo "  Sul telefono devi essere sulla stessa rete Wi-Fi."
  echo "  In Safari: apri il link, poi Condividi → Aggiungi a Home"
  echo "  per averlo come app a tutto schermo."
fi
echo
echo "Ctrl+C per fermare"
"$PYTHON" - "$PORT" "$BIND" <<'PYEOF'
import http.server, json, os, subprocess, sys, time

WEB = os.getcwd()                      # .../Newscreen/web
PROJECT = os.path.dirname(WEB)         # .../Newscreen
UPDATE = os.path.join(PROJECT, "update.sh")
LOCKDIR = os.path.join(PROJECT, "logs", ".ingest.lock")
REFRESH_LOG = os.path.join(PROJECT, "logs", "refresh.log")


def ingest_running():
    """Vero se un ingest è davvero vivo. Il lock è condiviso con update.sh,
    quindi vede anche gli aggiornamenti lanciati da launchd o da terminale."""
    try:
        with open(os.path.join(LOCKDIR, "pid")) as fh:
            pid = int(fh.read().strip())
    except Exception:
        return False
    try:
        os.kill(pid, 0)          # non lo tocca, controlla solo che esista
        return True
    except OSError:
        return False


def edition():
    try:
        with open(os.path.join(WEB, "data", "articles.json")) as fh:
            d = json.load(fh)
        return d.get("generated_at"), len(d.get("articles") or [])
    except Exception:
        return None, 0


class Handler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        # Niente cache: ricarichi la pagina e vedi subito l'ultimo build.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _status(self):
        gen, n = edition()
        return {"running": ingest_running(), "generated_at": gen, "articles": n}

    def do_GET(self):
        if self.path.split("?")[0] == "/api/status":
            return self._json(self._status())
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/refresh":
            return self.send_error(405, "Method Not Allowed")

        st = self._status()
        if st["running"]:
            st["started"] = False
            return self._json(st)

        try:
            log = open(REFRESH_LOG, "a")
            log.write("\n=== avviato dall'app · %s ===\n"
                      % time.strftime("%Y-%m-%d %H:%M:%S"))
            log.flush()
            # start_new_session: l'ingest sopravvive anche se il server viene
            # riavviato mentre sta lavorando.
            subprocess.Popen([UPDATE], cwd=PROJECT, stdout=log,
                             stderr=subprocess.STDOUT, start_new_session=True)
        except Exception as exc:
            return self._json({"started": False, "running": False,
                               "error": str(exc)}, 500)

        st["started"] = True
        st["running"] = True
        return self._json(st, 202)

    def log_message(self, fmt, *args):
        # Il log di accesso riga-per-riga non serve e sporca serve.log.
        pass


port, bind = int(sys.argv[1]), sys.argv[2]
http.server.ThreadingHTTPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer((bind, port), Handler) as httpd:
    httpd.serve_forever()
PYEOF
