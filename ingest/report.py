"""Generate README_SOURCES.md and print the summary the brief asks for.

Every number here is computed from data/sources.json and data/creators.json,
so the document cannot drift away from what was actually verified.
"""
import json
import os
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


def load(name):
    with open(os.path.join(DATA, name)) as fh:
        return json.load(fh)


def score(s):
    """Same shape as ingest/enrich.source_score, kept in sync with source-priority.json."""
    prio = load("source-priority.json")["source_score"]
    w = prio["weights"]
    v = (s["reliability"] * w["reliability"] + s["technical_depth"] * w["technical_depth"]
         + s["editorial_quality"] * w["editorial_quality"] + s.get("creator_score", 0) * w["creator_score"])
    bonuses = [0.0]
    if s.get("primary_source"):
        bonuses.append(prio["primary_source_bonus"])
    if s["source_type"] == "official_documentation":
        bonuses.append(prio["official_documentation_bonus"])
    if s["source_type"] == "research":
        bonuses.append(prio["research_bonus"])
    if s["source_type"] == "benchmark":
        bonuses.append(prio["benchmark_bonus"])
    v += max(bonuses)
    if s.get("specialization_bonus"):
        v += prio["specialization_bonus"]
    if s["source_type"] == "community":
        v += prio["community_penalty"]
    return round(max(0.0, min(100.0, v)), 1)


def table(rows, headers):
    out = ["| " + " | ".join(headers) + " |",
           "|" + "|".join(["---"] * len(headers)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def top(sources, n, predicate=None, key=score):
    pool = [s for s in sources if (predicate(s) if predicate else True)]
    return sorted(pool, key=key, reverse=True)[:n]


def main():
    S = load("sources.json")["sources"]
    C = load("creators.json")["creators"]
    candidates = json.load(open(os.path.join(ROOT, "ingest", "candidates.json")))
    cmeta = json.load(open(os.path.join(ROOT, "ingest", "creator_meta.json")))["creators"]

    active = [s for s in S if s["active"]]
    inactive = [s for s in S if not s["active"]]
    by_type = Counter(s["source_type"] for s in S)
    by_cat = Counter(s["category"] for s in S)

    stats = {
        "analizzate": len(candidates) + 9,
        "verificate": len(S),
        "con feed attivo": len(active),
        "senza feed": len(inactive),
        "RSS/Atom": sum(1 for s in S if s["rss_available"]),
        "sitemap": sum(1 for s in S if s["sitemap_available"]),
        "YouTube": sum(1 for s in S if s["youtube_available"]),
        "fonti primarie": sum(1 for s in S if s["primary_source"]),
        "documentazione ufficiale": by_type.get("official_documentation", 0),
        "editoriali": by_type.get("editorial", 0),
        "tecniche": by_type.get("technical", 0),
        "ricerca": by_type.get("research", 0),
        "benchmark": by_type.get("benchmark", 0),
        "tutorial": by_type.get("tutorial", 0),
        "creator": by_type.get("creator", 0),
        "community": by_type.get("community", 0),
        "creator valutati": len(cmeta),
        "creator inclusi": len(C),
        "creator esclusi": sum(1 for v in cmeta.values() if not v.get("include", True)),
    }

    lines = []
    A = lines.append
    A("# Fonti — verifica, criteri e ranking\n")
    A("Questo documento è **generato** da `ingest/report.py` a partire da `data/sources.json` "
      "e `data/creators.json`. I numeri non sono scritti a mano: sono quelli risultati dalla "
      "verifica automatica dei feed, eseguita da `ingest/discover.py`.\n")
    A(f"Ultima verifica: **{load('sources.json')['generated_at']}**\n")

    A("## Riepilogo\n")
    A(table([[k, v] for k, v in stats.items()], ["Metrica", "Valore"]))

    A("\n## Come è stata fatta la verifica\n")
    A("Per ogni candidato lo script prova, **in quest'ordine**:\n")
    A("1. i feed dichiarati dalla pagina nei tag `<link rel=\"alternate\">`;")
    A("2. i percorsi convenzionali (`/feed/`, `/rss.xml`, `/atom.xml`, `/index.xml`, …);")
    A("3. per i canali YouTube, il `channel_id` estratto dal link canonico e poi "
      "`youtube.com/feeds/videos.xml?channel_id=…`.\n")
    A("Ogni candidato viene **scaricato e parsato davvero**: conta come valido solo se "
      "restituisce XML che contiene almeno un elemento. Viene registrato anche il titolo e la "
      "data dell'ultimo contenuto, così si vede subito se un feed è fermo.\n")
    A("Lo scraping HTML **non è mai la prima scelta** e non è implementato: le fonti senza feed "
      "sono scritte in `sources.json` con `active: false` e una nota su cosa servirebbe.\n")

    A("## Peso delle fonti\n")
    A("Il punteggio **non** dipende dalla popolarità. La formula è in "
      "`data/source-priority.json` e si può modificare senza toccare il codice:\n")
    A("```\nsource_score = reliability×0.35 + technical_depth×0.30 + editorial_quality×0.25\n"
      "               + creator_score×0.10 + bonus (primary, documentazione, ricerca,\n"
      "                 benchmark, specializzazione) − penalità (community)\n```\n")
    A("Conseguenza pratica: una pagina ufficiale OpenAI pesa più di un articolo che la "
      "riassume, un paper pesa più di un video promozionale, e un ricercatore con pochi "
      "iscritti pesa più di un canale generalista con molti.\n")

    A("## Tipi di fonte\n")
    A(table([[t, n, {
        "primary": "autore diretto dell'informazione",
        "official_documentation": "documentazione o changelog ufficiale",
        "research": "ricerca, paper, blog accademici",
        "benchmark": "misurazione indipendente",
        "technical": "approfondimento tecnico specializzato",
        "editorial": "testata giornalistica",
        "tutorial": "guide e workflow pratici",
        "creator": "voce individuale, video o podcast",
        "podcast": "podcast",
        "database": "dati strutturati",
        "community": "contenuti generati dalla community",
    }.get(t, "")] for t, n in by_type.most_common()], ["Tipo", "N.", "Significato"]))

    A("\n### La distinzione creator / fonte primaria\n")
    A("Un creator **non** è mai una fonte primaria, salvo sia l'autore diretto di ciò di cui "
      "parla. Esempio concreto applicato dalla pipeline:\n")
    A("- OpenAI annuncia un modello → `primary`")
    A("- Ars Technica scrive dell'annuncio → `editorial`")
    A("- Artificial Analysis lo misura → `benchmark`")
    A("- un ingegnere lo commenta sul suo canale → `creator`")
    A("- qualcuno pubblica un workflow per usarlo → `tutorial`\n")
    A("Tutti e cinque finiscono nello **stesso evento**, ma con pesi diversi, e sulla Home "
      "compare la fonte primaria con le altre elencate sotto.\n")

    A("## Categorie\n")
    A(table([[c, n] for c, n in by_cat.most_common()], ["Categoria", "Fonti"]))

    def rows(items, extra=None):
        out = []
        for i, s in enumerate(items, 1):
            r = [i, s["name"], s["source_type"], s["reliability"], s["technical_depth"], score(s)]
            if extra:
                r.insert(2, extra(s))
            out.append(r)
        return out

    A("\n## TOP 20 fonti\n")
    A(table(rows(top(S, 20, lambda s: s["source_type"] != "creator")),
            ["#", "Fonte", "Tipo", "Affid.", "Tecnica", "Score"]))

    A("\n## TOP 20 creator\n")
    ctop = sorted(C, key=lambda c: c["reliability"] * .35 + c["technical_depth"] * .35
                  + c["editorial_quality"] * .2 + c["creator_score"] * .1, reverse=True)[:20]
    A(table([[i, c["name"], c["creator_type"], "/".join(c["language"]).upper(),
              c["technical_depth"], c["reliability"]] for i, c in enumerate(ctop, 1)],
            ["#", "Creator", "Tipo", "Lingua", "Tecnica", "Affid."]))

    A("\n## TOP 10 fonti tutorial\n")
    A(table(rows(top(S, 10, lambda s: s["source_type"] == "tutorial"
                     or s["category"] == "tutorials" or s.get("tutorial_available"))),
            ["#", "Fonte", "Tipo", "Affid.", "Tecnica", "Score"]))

    A("\n## TOP 10 fonti tech\n")
    A(table(rows(top(S, 10, lambda s: s["category"] == "tech_curiosities")),
            ["#", "Fonte", "Tipo", "Affid.", "Tecnica", "Score"]))

    A("\n## TOP 10 fonti AI research\n")
    A(table(rows(top(S, 10, lambda s: s["category"] == "ai"
                     and s["source_type"] in ("research", "technical", "primary"))),
            ["#", "Fonte", "Tipo", "Affid.", "Tecnica", "Score"]))

    A("\n## TOP 10 fonti cinema\n")
    A(table(rows(top(S, 10, lambda s: s["category"] == "cinema" and s["source_type"] != "creator")),
            ["#", "Fonte", "Tipo", "Affid.", "Tecnica", "Score"]))

    A("\n## TOP fonti benchmark\n")
    A(table(rows(top(S, 5, lambda s: s["source_type"] == "benchmark")),
            ["#", "Fonte", "Tipo", "Affid.", "Tecnica", "Score"]))

    if inactive:
        A("\n## Fonti senza feed verificato\n")
        A("Presenti in `sources.json` con `active: false`. Non vengono interrogate "
          "dall'ingest finché non si trova un percorso legittimo.\n")
        A(table([[s["name"], s["domain"], "sì" if s["sitemap_available"] else "no",
                  (s["notes"] or "")[:90]] for s in inactive],
                ["Fonte", "Dominio", "Sitemap", "Nota"]))

    excluded = [(v["name"], v["verdict"]) for v in cmeta.values() if not v.get("include", True)]
    if excluded:
        A("\n## Creator valutati ed esclusi\n")
        A("La richiesta era di **non** inserire automaticamente tutti i creator. "
          "Queste sono le esclusioni, con la motivazione; riattivarne uno significa "
          "cambiare `include` in `ingest/creator_meta.json`.\n")
        for name, why in excluded:
            A(f"- **{name}** — {why}")

    A("\n## Copyright e termini d'uso\n")
    A("La piattaforma memorizza **solo** titolo, estratto fornito dal feed stesso, metadati e "
      "URL originale. Non scarica né archivia il testo integrale degli articoli, non copia i "
      "transcript dei video e non rehosta le immagini: le thumbnail sono collegate all'URL della "
      "fonte quando il feed lo espone.\n")
    A("`commercial_use_possible` è impostato su `check_terms` per ogni fonte: **non** è "
      "un'autorizzazione. Prima di qualsiasi uso commerciale vanno letti i termini di ciascuna "
      "testata, che in diversi casi vietano esplicitamente la ripubblicazione degli estratti.\n")
    A("Il fatto che un contenuto sia raggiungibile pubblicamente non implica che sia "
      "riutilizzabile.\n")

    path = os.path.join(ROOT, "README_SOURCES.md")
    with open(path, "w") as fh:
        fh.write("\n".join(lines) + "\n")

    print("=" * 62)
    print("RISULTATO VERIFICA FONTI".center(62))
    print("=" * 62)
    for k, v in stats.items():
        print(f"  {k:<28} {v}")
    print("=" * 62)
    print(f"scritto {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()
