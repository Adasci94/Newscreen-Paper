# Newscreen paper

Piattaforma editoriale di discovery su **cinema, AI, generative media e creative technology**.

Non è un aggregatore di news. È un sistema che raccoglie da fonti verificate, riconosce quando
più testate stanno raccontando lo stessa cosa, distingue un annuncio ufficiale da un commento e
da un tutorial, e ordina la Home per autorevolezza invece che per popolarità.

Il principio, applicato in ogni scelta tecnica del progetto:

```
ACCURATEZZA        >  VELOCITÀ
PROFONDITÀ TECNICA >  HYPE
FONTI PRIMARIE     >  RUMOR
QUALITÀ            >  QUANTITÀ
UTILITÀ            >  CLICKBAIT
```

---

## Avvio rapido

Servono solo Python 3 (già presente su macOS) e un browser. Nessuna installazione, nessun
`npm install`, nessuna API key.

```bash
./update.sh      # scarica i contenuti dalle fonti e genera i JSON
./serve.sh       # avvia la webapp su http://localhost:8080
```

`update.sh` va rieseguito quando vuoi aggiornare (una volta al giorno è sufficiente).
`verify-sources.sh` ricontrolla che i feed esistano ancora — utile una volta al mese.

> La webapp **deve** essere servita da un server locale. Aprendo `web/index.html` con un doppio
> clic il browser blocca il caricamento dei JSON per policy di sicurezza.

### Aggiornamento automatico ogni mattina

```bash
crontab -e
# poi aggiungi questa riga, che aggiorna ogni giorno alle 7:30
30 7 * * * cd ~/Desktop/NEWS && ./update.sh >> data/_cron.log 2>&1
```

---


## Versione portabile — iPhone e Mac

`./build-portable.sh` genera **`newscreen-paper.html`**: un file singolo con dentro tutto —
interfaccia, stili, codice e dati. Nessun server, nessuna connessione richiesta per leggere.

```bash
./build-portable.sh          # tutti gli articoli (~1,5 MB)
./build-portable.sh 300      # solo i 300 più recenti, file più leggero
```

**Sul Mac**: doppio clic, si apre nel browser.

**Su iPhone**: mandalo con AirDrop, oppure copialo in iCloud Drive e aprilo dall'app File.
Da Safari si può aggiungere alla schermata Home (Condividi → Aggiungi a Home): grazie ai meta
tag Apple si apre a tutto schermo, senza barre del browser, come un'app.

L'interfaccia è pensata anche per il tocco: aree di tocco maggiorate, rispetto di notch e home
indicator, nessuno zoom automatico sui campi di ricerca, scorrimento con inerzia sulle barre di
categoria, e il logo che si accorcia sugli schermi stretti per lasciare spazio al selettore di
lingua.

Cosa cambia rispetto alla versione servita:

| | Servita (`./serve.sh`) | Portabile (file singolo) |
|---|---|---|
| Server | serve `python3` | nessuno |
| Aggiornamento contenuti | `./update.sh` | va rigenerato il file |
| Font e interfaccia | da Google Fonts | **incorporati nel file** |
| Immagini | dalle fonti (serve rete) | dalle fonti (serve rete) |
| Testo, ricerca, filtri | sempre | sempre, **anche offline** |
| Traduzioni | quelle in cache + al volo | quelle nel file al momento della generazione |

I caratteri sono incorporati nel file in base64 (sottoinsieme latino, woff2), quindi senza rete
la pagina ha esattamente lo stesso aspetto: nessuna richiesta esterna per il rendering. Per
rigenerarli dopo un cambio di tipografia si riscrive `data/fonts-inline.css`.

Senza rete il testo, la ricerca e i filtri funzionano comunque: mancano solo le anteprime delle
immagini e la traduzione al volo. Per questo conviene eseguire `./translate-fill.sh` **prima** di
rigenerare il file portabile: le traduzioni accumulate finiscono dentro e restano leggibili
offline.

## Struttura

```
NEWS/
├── update.sh                 esegue l'ingest quotidiano
├── serve.sh                  avvia il server locale
├── verify-sources.sh         ri-verifica tutti i feed
├── translate-fill.sh         completa le traduzioni mancanti
├── build-portable.sh         genera il file singolo per iPhone e Mac
│
├── newscreen-paper.html      il file portabile (generato)
│
├── ingest/                   pipeline Python (solo libreria standard)
│   ├── discover.py           trova e verifica i feed delle fonti
│   ├── build_sources.py      unisce verifica tecnica e giudizio editoriale
│   ├── build.py              ingest quotidiano: fetch, classifica, deduplica, ordina
│   ├── feedparse.py          parsing RSS / Atom / feed YouTube
│   ├── enrich.py             classificazione, entità, punteggi
│   ├── http_util.py          HTTP con gzip, redirect, timeout
│   ├── report.py             genera README_SOURCES.md dai dati reali
│   ├── translate.py          traduzione con cache permanente e glossario protetto
│   ├── models_watch.py       segnala i modelli citati ma non ancora tracciati
│   ├── build_standalone.py   impacchetta tutto in un unico file HTML
│   ├── candidates.json       fonti candidate da verificare
│   ├── source_meta.json      giudizio editoriale sulle fonti
│   └── creator_meta.json     valutazione dei creator, uno per uno
│
├── data/                     dati: curati a mano + generati
│   ├── sources.json / .csv   fonti verificate  (generato)
│   ├── creators.json         creator selezionati (generato)
│   ├── articles.json         contenuti          (generato)
│   ├── events.json           cluster di notizie (generato)
│   ├── categories.json       tassonomia         (curato)
│   ├── source-priority.json  pesi dello scoring (curato)
│   ├── lexicon.json          dizionario di classificazione (curato)
│   ├── models.json           database modelli   (curato)
│   ├── columns.json          rubriche editoriali (curato)
│   └── schemas/              schemi JSON di articles, events, models
│
└── web/                      webapp statica
    ├── index.html
    ├── assets/css/app.css
    ├── assets/js/            i18n · store · ui · app
    └── data/                 copia dei JSON, generata da build.py
```

**Curato** significa scritto a mano: è dove vive il giudizio editoriale.
**Generato** significa prodotto dalla pipeline: non va modificato a mano, viene riscritto.

---

## Come funziona la pipeline

```
sources.json ──▶ fetch RSS/Atom ──▶ parsing ──▶ normalizzazione
                                                      │
                                                      ▼
                                            classificazione + entità
                                                      │
                                                      ▼
                                             deduplicazione URL
                                                      │
                                                      ▼
                                            clustering in eventi
                                                      │
                                                      ▼
                                                  scoring
                                                      │
                                                      ▼
                                    articles.json + events.json ──▶ webapp
```

### 1. Fetch

Solo feed RSS/Atom pubblici, in parallelo su dieci thread. L'ordine di preferenza per accedere a
una fonte è documentato e rispettato: **API ufficiale → RSS → Atom → sitemap → JSON → HTML
strutturato → scraping**. Lo scraping non è implementato ed è l'ultima opzione, non la prima.

### 2. Classificazione

Ogni contenuto riceve una categoria macro, una sottocategoria e un tipo (`official_release`,
`research`, `tutorial`, `curiosity`, `benchmark`, `video`, `podcast`, `news`, …). Le regole sono
in `data/lexicon.json`: aggiungere un termine lì cambia il comportamento di tutta la pipeline
senza toccare una riga di Python.

La categoria della fonte fa da ipotesi di partenza e viene sovrascritta solo quando l'evidenza
lessicale è chiaramente a favore di un'altra categoria. Un pezzo di Ars Technica sui data center
finisce in Tech, non in AI, anche se la fonte è indicizzata altrove.

### 3. Deduplicazione

- **URL normalizzato**: rimozione dei parametri di tracking (`utm_*`, `fbclid`, `gclid`, …),
  `https` forzato, `www.` e slash finale rimossi. Lo stesso articolo raggiunto per due strade
  diverse viene riconosciuto come uno solo.
- **Titoli quasi identici della stessa fonte**: ripubblicazioni e aggiornamenti vengono uniti.
  Testate diverse **non** vengono unite qui — quello è compito del clustering, che conserva
  l'informazione su chi altro ha coperto la notizia.

### 4. Event clustering

Due contenuti finiscono nello stesso evento quando sono nella stessa finestra temporale
(72 ore) e nella stessa categoria, e inoltre **o** i titoli normalizzati si somigliano oltre la
soglia, **o** condividono almeno due entità nominate (modelli, aziende, tool).

Sulla Home un evento occupa **una sola card**, quella della fonte più autorevole del gruppo —
con preferenza assoluta per la fonte primaria. Le altre coperture sono elencate nella pagina
dell'articolo sotto *Coperta anche da*. Un evento con più fonti indipendenti riceve un bonus di
rilevanza, perché la copertura multipla è essa stessa un segnale.

### 5. Scoring

```
overall = importance×0.30 + credibility×0.22 + quality×0.18
        + technical×0.15  + freshness×0.15   − hype×0.20
```

- **freshness** decade esponenzialmente, con emivita 30 ore. Ricerca, tutorial e curiosità usano
  un'emivita di 240 ore: non scadono allo stesso modo di una notizia.
- **hype** è una penalità lessicale sul solo titolo (`you won't believe`, `cambia tutto`,
  `nessuno ne parla`, maiuscolo eccessivo, punteggiatura enfatica). Sottrae fino a 70 punti.
  È il meccanismo che tiene i contenuti sensazionalistici fuori dalla prima schermata.
- **importance** cresce con l'autorevolezza della fonte, la presenza di aziende rilevanti, le
  release ufficiali, i festival e la copertura multi-fonte.

Tutti i pesi sono in `data/source-priority.json`. La Home non è ordinata dal traffico né dalla
popolarità, che non sono nemmeno raccolti come dato.

Nessuna fonte può occupare più di due posizioni fra le storie in primo piano: è la regola che
impedisce a una testata prolifica di monopolizzare la prima schermata.

---

## Sistema multilingua

L'interfaccia è completamente bilingue: **tutte** le stringhe stanno in `web/assets/js/i18n.js`,
tradotte a mano in italiano e inglese.

Al primo accesso la lingua viene rilevata dal browser e salvata. Il selettore `IT | EN` la cambia
in qualsiasi momento **senza ricaricare la pagina**: si conservano pagina corrente, filtri, query
di ricerca e posizione di scroll.

### Traduzione dei contenuti

Anche titoli e summary degli articoli vengono tradotti, su due livelli:

1. **In fase di ingest** — `ingest/translate.py` traduce gli articoli in ordine di punteggio,
   titoli prima e summary poi. Il risultato finisce in `data/translations.json`, una cache
   permanente: **nulla viene mai tradotto due volte**, quindi ogni giorno si paga solo il nuovo.
2. **Nel browser** — quello che il budget giornaliero non ha coperto viene tradotto al volo da
   `web/assets/js/translate.js`, solo per gli elementi che entrano nello schermo, con cache in
   `localStorage`.

Il risultato pratico: scegliendo italiano la parte alta delle pagine è già tradotta (sono gli
articoli con punteggio più alto, cioè quelli che si leggono davvero), e il resto si traduce
scorrendo.

**I nomi propri sono protetti.** Dopo ogni traduzione il sistema verifica che i termini del
glossario — nomi di modelli, aziende, tool, **testate e creator** — siano ancora presenti. Se la
traduzione li ha persi, viene scartata e resta l'originale. Senza questo controllo un titolo su
Criterion diventa "il criterio" e l'attribuzione è distrutta.

### Provider e limiti — leggere prima di aspettarsi il 100%

Il provider viene scelto da solo:

| Condizione | Provider | Copertura |
|---|---|---|
| `DEEPL_API_KEY` presente | DeepL | **tutto l'archivio in una passata** |
| `ANTHROPIC_API_KEY` presente | Claude Haiku | tutto l'archivio, qualità più alta sui titoli |
| nessuna chiave (default) | MyMemory + Lingva | poche centinaia di stringhe al giorno |

Senza chiave funziona, ma **gli endpoint gratuiti rispondono `429` già a una richiesta al
secondo**: coprono la parte alta delle pagine e poco altro. La cache è permanente, quindi
eseguendo `./translate-fill.sh` per qualche giorno l'archivio si riempie comunque.

Per avere tutto tradotto subito, una chiave DeepL gratuita (500.000 caratteri al mese, che
bastano per diverse passate su questo dataset) si attiva così:

```bash
export DEEPL_API_KEY="la-tua-chiave:fx"
./translate-fill.sh
```

Nessun'altra modifica: la pipeline riconosce la chiave da sola e alza anche la concorrenza.

### Cosa non viene mai tradotto

| Tradotto | Mai tradotto |
|---|---|
| interfaccia, etichette, categorie, tag | nome della fonte |
| titoli e summary degli articoli | URL |
| rubriche editoriali (scritte in entrambe le lingue) | nome del canale e del creator |
| | nome del modello, brand, nomi propri |
| | termini tecnici che restano invariati |

Il link porta **sempre** al contenuto originale, e la fonte è sempre visibile.

## Interfaccia

Header fisso con logo, le categorie, ricerca e selettore di lingua. Nelle pagine di categoria
compare una seconda barra con le sottocategorie.

**Nessun controllo che non porta da nessuna parte.** Sottocategorie, filtri e opzioni vengono
calcolati sui contenuti realmente presenti: una sottocategoria vuota non viene mostrata, un
filtro con un solo valore possibile non viene mostrato, e ogni voce riporta il numero di
contenuti che contiene. La sezione Tutorial, per esempio, mostra le sottocategorie che oggi
hanno materiale invece dell'elenco completo della tassonomia.

- **Home** — storie in primo piano (una card grande + quattro), le tre rubriche del giorno,
  i blocchi Cinema / AI / Tech, Gen Media, tutorial, creator, Model Watch e il flusso completo.
- **Categoria** — griglia filtrabile per sottocategoria, tipo di contenuto, fonte, lingua e
  ordinamento. I filtri finiscono nell'URL, quindi una vista filtrata è condivisibile.
- **Articolo** — categoria, titolo, summary, immagine, data, fonte, lingua, tag, punteggi,
  storie collegate, altre coperture dello stesso evento, e il pulsante verso l'originale
  (*Leggi l'originale* / *Guarda su YouTube* / *Apri il tutorial* / *Ascolta l'episodio*).
- **Mestiere** — la sezione dedicata alla tecnica: le tre rubriche del giorno, l'archivio
  completo delle schede e gli articoli su fotografia, montaggio, color e VFX raccolti dalle
  fonti verificate. È una vista trasversale: pesca da cinema, tutorial e gen media, così la
  tecnica ha un indirizzo solo invece di essere sparsa.
- **Fonte** e **Creator** — pagine dedicate con descrizione, punteggi, argomenti, link e
  ultimi contenuti.
- **Model Watch** — tabella dei modelli filtrabile per tipo, con i link ai benchmark.
- **Ricerca** — `⌘K` o `/`, cerca contemporaneamente in articoli, fonti, creator e modelli.

Tipografia: **Space Grotesk** per i titoli, **Inter** per il testo, **JetBrains Mono** per dati e
metadati. Tema chiaro e scuro, con rispetto della preferenza di sistema al primo accesso.
Nessun framework, nessuna dipendenza JavaScript esterna.

---

## Le rubriche

Tre schede al giorno, scritte a mano e disponibili in entrambe le lingue: una **tecnica di
montaggio**, una **tecnica di ripresa** e una **curiosità dal mondo del cinema**.

Ruotano in modo deterministico sulla base della data, quindi tutti vedono le stesse tre per
tutta la giornata. Sono 45 schede in `data/columns.json`, quindi quindici giorni senza
ripetizioni; aggiungerne altre allunga automaticamente la rotazione.

---

## Modelli

`data/models.json` è curato a mano e segue una regola precisa: **nessun numero non verificato**.

Le voci nuove non vengono inventate: si ricavano dagli annunci realmente presenti nei feed.
`ingest/models_watch.py` gira a ogni ingest e segnala i nomi di modello che le fonti citano ma
che il database non conosce ancora, con il link all'annuncio — così la tabella non invecchia in
silenzio. Non scrive mai da solo in `models.json`: un modello si aggiunge a mano, con la sua
fonte, di proposito.

Punteggi di benchmark, prezzi e velocità cambiano di settimana in settimana e appartengono alle
piattaforme che li misurano. Per questo non vengono copiati: ogni modello riporta provider,
tipo, modalità, licenza e `open_weights`, e rimanda a **Artificial Analysis** e **LMArena** per
i dati aggiornati. I campi che non è stato possibile confermare da una pagina ufficiale restano
`null` invece di essere riempiti con una stima.

È la stessa regola che la piattaforma applica ai contenuti: un dato non verificato è peggio di
un dato assente.

---

## Copyright

- Vengono memorizzati **solo** titolo, l'estratto che il feed stesso pubblica, i metadati e
  l'URL originale.
- Non viene scaricato né archiviato il testo integrale degli articoli.
- Non vengono copiati i transcript dei video.
- Le immagini non vengono rehostate: si usa l'URL esposto dal feed, quando c'è.
- Ogni contenuto ha un collegamento diretto e ben visibile all'originale.

In `sources.json` il campo `commercial_use_possible` vale `check_terms` per ogni fonte. **Non è
un'autorizzazione**: prima di un uso commerciale vanno letti i termini di ciascuna testata, che
in diversi casi vietano esplicitamente la ripubblicazione anche di estratti brevi.

Il fatto che un contenuto sia pubblicamente accessibile non implica che sia liberamente
riutilizzabile.

---

## Estendere il progetto

**Aggiungere una fonte** — inserisci un oggetto in `ingest/candidates.json` con `id`, `name`,
`url` e gli eventuali `hints`; aggiungi il giudizio editoriale in `ingest/source_meta.json`;
esegui `./verify-sources.sh`. Se il feed esiste, entra nell'ingest al giro successivo.

**Aggiungere un creator** — stessa procedura, ma la valutazione va in
`ingest/creator_meta.json`, dove il campo `verdict` obbliga a motivare per iscritto sia
l'inclusione sia l'esclusione. I creator esclusi restano nel file: la decisione è documentata e
si annulla cambiando un flag.

**Aggiungere una categoria** — `data/categories.json`. Navigazione, filtri e ricerca la prendono
automaticamente.

**Cambiare il ranking** — `data/source-priority.json`. Nessun codice da toccare.

**Aggiungere una lingua** — un nuovo blocco in `i18n.js` e il campo corrispondente nello schema
degli articoli.

### Piattaforme ancora da valutare

Instagram, TikTok, Reddit, X, Substack, GitHub, arXiv, Hacker News, Product Hunt.

Non sono state aggiunte deliberatamente: alcune non hanno un accesso pubblico stabile, altre
hanno termini d'uso che vanno letti prima di costruirci sopra. Substack, GitHub, arXiv e Hacker
News espongono feed pubblici e sono le candidate più immediate; le piattaforme social richiedono
prima una verifica concreta di fattibilità tecnica e policy.

### Integrazioni predisposte ma non attive

TMDB (dati strutturati sui film), YouTube Data API (durata, tag, statistiche), Guardian Open
Platform e NewsAPI. Lo schema ha già i campi che riempirebbero; oggi la pipeline funziona
interamente senza API key, usando i feed pubblici.

---

## Migrare a Next.js

La separazione fra dati e presentazione è pensata per questo. `data/*.json` e tutta la pipeline
Python restano identici: cambia solo il livello di presentazione. `store.js` diventa un data
layer server-side, `i18n.js` diventa il dizionario di `next-intl`, `ui.js` diventa componenti
React, e le rotte hash (`#/c/ai`) diventano rotte reali (`/it/ai`) con il vantaggio del
rendering server-side per i motori di ricerca.

---

## Verifica delle fonti

Il dettaglio completo — metodo di verifica, fonti trovate, fonti scartate e perché, classifiche
per categoria — è in **[README_SOURCES.md](README_SOURCES.md)**, generato dai dati reali da
`ingest/report.py`.
