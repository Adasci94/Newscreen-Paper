# Fonti — verifica, criteri e ranking

Questo documento è **generato** da `ingest/report.py` a partire da `data/sources.json` e `data/creators.json`. I numeri non sono scritti a mano: sono quelli risultati dalla verifica automatica dei feed, eseguita da `ingest/discover.py`.

Ultima verifica: **2026-09-12**

## Riepilogo

| Metrica | Valore |
|---|---|
| analizzate | 114 |
| verificate | 102 |
| con feed attivo | 85 |
| senza feed | 17 |
| RSS/Atom | 85 |
| sitemap | 69 |
| YouTube | 27 |
| fonti primarie | 22 |
| documentazione ufficiale | 4 |
| editoriali | 29 |
| tecniche | 13 |
| ricerca | 6 |
| benchmark | 2 |
| tutorial | 2 |
| creator | 26 |
| community | 1 |
| creator valutati | 34 |
| creator inclusi | 26 |
| creator esclusi | 8 |

## Come è stata fatta la verifica

Per ogni candidato lo script prova, **in quest'ordine**:

1. i feed dichiarati dalla pagina nei tag `<link rel="alternate">`;
2. i percorsi convenzionali (`/feed/`, `/rss.xml`, `/atom.xml`, `/index.xml`, …);
3. per i canali YouTube, il `channel_id` estratto dal link canonico e poi `youtube.com/feeds/videos.xml?channel_id=…`.

Ogni candidato viene **scaricato e parsato davvero**: conta come valido solo se restituisce XML che contiene almeno un elemento. Viene registrato anche il titolo e la data dell'ultimo contenuto, così si vede subito se un feed è fermo.

Lo scraping HTML **non è mai la prima scelta** e non è implementato: le fonti senza feed sono scritte in `sources.json` con `active: false` e una nota su cosa servirebbe.

## Peso delle fonti

Il punteggio **non** dipende dalla popolarità. La formula è in `data/source-priority.json` e si può modificare senza toccare il codice:

```
source_score = reliability×0.35 + technical_depth×0.30 + editorial_quality×0.25
               + creator_score×0.10 + bonus (primary, documentazione, ricerca,
                 benchmark, specializzazione) − penalità (community)
```

Conseguenza pratica: una pagina ufficiale OpenAI pesa più di un articolo che la riassume, un paper pesa più di un video promozionale, e un ricercatore con pochi iscritti pesa più di un canale generalista con molti.

## Tipi di fonte

| Tipo | N. | Significato |
|---|---|---|
| editorial | 29 | testata giornalistica |
| creator | 26 | voce individuale, video o podcast |
| primary | 19 | autore diretto dell'informazione |
| technical | 13 | approfondimento tecnico specializzato |
| research | 6 | ricerca, paper, blog accademici |
| official_documentation | 4 | documentazione o changelog ufficiale |
| benchmark | 2 | misurazione indipendente |
| tutorial | 2 | guide e workflow pratici |
| community | 1 | contenuti generati dalla community |

### La distinzione creator / fonte primaria

Un creator **non** è mai una fonte primaria, salvo sia l'autore diretto di ciò di cui parla. Esempio concreto applicato dalla pipeline:

- OpenAI annuncia un modello → `primary`
- Ars Technica scrive dell'annuncio → `editorial`
- Artificial Analysis lo misura → `benchmark`
- un ingegnere lo commenta sul suo canale → `creator`
- qualcuno pubblica un workflow per usarlo → `tutorial`

Tutti e cinque finiscono nello **stesso evento**, ma con pesi diversi, e sulla Home compare la fonte primaria con le altre elencate sotto.

## Categorie

| Categoria | Fonti |
|---|---|
| cinema | 37 |
| ai | 35 |
| tech_curiosities | 12 |
| generative_media | 10 |
| tutorials | 6 |
| models | 2 |

## TOP 20 fonti

| # | Fonte | Tipo | Affid. | Tecnica | Score |
|---|---|---|---|---|---|
| 1 | Lil'Log — Lilian Weng | research | 96 | 98 | 98.5 |
| 2 | Ahead of AI — Sebastian Raschka | research | 94 | 95 | 96.4 |
| 3 | Google DeepMind | primary | 97 | 93 | 95.8 |
| 4 | Berkeley BAIR Blog | research | 96 | 96 | 95.4 |
| 5 | Anthropic | primary | 97 | 90 | 94.9 |
| 6 | Interconnects — Nathan Lambert | research | 92 | 92 | 94.8 |
| 7 | OpenAI | primary | 97 | 88 | 93.6 |
| 8 | ARRI | primary | 92 | 85 | 93.4 |
| 9 | ComfyUI Blog | official_documentation | 92 | 90 | 93.2 |
| 10 | Meta AI | primary | 95 | 90 | 92.8 |
| 11 | Mistral AI | primary | 94 | 88 | 91.3 |
| 12 | Google Research | research | 96 | 94 | 91.0 |
| 13 | Microsoft Research | research | 95 | 93 | 90.2 |
| 14 | Black Forest Labs | primary | 92 | 88 | 89.3 |
| 15 | American Cinematographer | technical | 94 | 95 | 88.9 |
| 16 | Runway | primary | 92 | 80 | 88.2 |
| 17 | fxguide | technical | 92 | 95 | 87.7 |
| 18 | Artificial Analysis | benchmark | 92 | 90 | 87.7 |
| 19 | Quanta Magazine | editorial | 95 | 85 | 87.5 |
| 20 | Stability AI | primary | 90 | 82 | 86.8 |

## TOP 20 creator

| # | Creator | Tipo | Lingua | Tecnica | Affid. |
|---|---|---|---|---|---|
| 1 | Andrej Karpathy | researcher | EN | 98 | 96 |
| 2 | 3Blue1Brown | educator | EN | 92 | 95 |
| 3 | Salvatore Sanfilippo | researcher | IT/EN | 95 | 92 |
| 4 | StatQuest | educator | EN | 85 | 92 |
| 5 | Welch Labs | educator | EN | 88 | 90 |
| 6 | Computerphile | educator | EN | 85 | 92 |
| 7 | Yannic Kilcher | researcher | EN | 95 | 88 |
| 8 | In Depth Cine | filmmaker | EN | 88 | 88 |
| 9 | Machine Learning Street Talk | podcast | EN | 92 | 88 |
| 10 | This Guy Edits | filmmaker | EN | 82 | 86 |
| 11 | Dwarkesh Patel | podcast | EN | 80 | 86 |
| 12 | wolfcrow | filmmaker | EN | 88 | 82 |
| 13 | Cinematography Database | filmmaker | EN | 88 | 82 |
| 14 | Corridor Crew | vfx_artist | EN | 82 | 80 |
| 15 | AI Explained | analyst | EN | 78 | 85 |
| 16 | Enkk | educator | IT | 78 | 85 |
| 17 | StudioBinder | educator | EN | 70 | 82 |
| 18 | bycloud | analyst | EN | 82 | 78 |
| 19 | Fireship | educator | EN | 70 | 78 |
| 20 | Film Riot | filmmaker | EN | 72 | 78 |

## TOP 10 fonti tutorial

| # | Fonte | Tipo | Affid. | Tecnica | Score |
|---|---|---|---|---|---|
| 1 | ComfyUI Blog | official_documentation | 92 | 90 | 93.2 |
| 2 | ComfyUI Releases (GitHub) | official_documentation | 95 | 92 | 85.3 |
| 3 | Film Riot | creator | 78 | 72 | 77.4 |
| 4 | Curious Refuge | creator | 76 | 68 | 74.8 |
| 5 | Sebastian Kamph | creator | 74 | 74 | 74.0 |
| 6 | Curious Refuge | tutorial | 76 | 68 | 72.0 |
| 7 | No Film School | tutorial | 78 | 70 | 67.8 |

## TOP 10 fonti tech

| # | Fonte | Tipo | Affid. | Tecnica | Score |
|---|---|---|---|---|---|
| 1 | 3Blue1Brown | creator | 95 | 92 | 94.8 |
| 2 | Salvatore Sanfilippo | creator | 92 | 95 | 90.0 |
| 3 | Welch Labs | creator | 90 | 88 | 90.0 |
| 4 | Computerphile | creator | 92 | 85 | 89.5 |
| 5 | Quanta Magazine | editorial | 95 | 85 | 87.5 |
| 6 | NVIDIA Blog | primary | 90 | 75 | 86.0 |
| 7 | antirez — blog | technical | 92 | 95 | 81.9 |
| 8 | IEEE Spectrum AI | technical | 92 | 85 | 80.2 |
| 9 | Ars Technica | editorial | 90 | 80 | 78.5 |
| 10 | Fireship | creator | 78 | 70 | 78.5 |

## TOP 10 fonti AI research

| # | Fonte | Tipo | Affid. | Tecnica | Score |
|---|---|---|---|---|---|
| 1 | Lil'Log — Lilian Weng | research | 96 | 98 | 98.5 |
| 2 | Ahead of AI — Sebastian Raschka | research | 94 | 95 | 96.4 |
| 3 | Google DeepMind | primary | 97 | 93 | 95.8 |
| 4 | Berkeley BAIR Blog | research | 96 | 96 | 95.4 |
| 5 | Anthropic | primary | 97 | 90 | 94.9 |
| 6 | Interconnects — Nathan Lambert | research | 92 | 92 | 94.8 |
| 7 | OpenAI | primary | 97 | 88 | 93.6 |
| 8 | Meta AI | primary | 95 | 90 | 92.8 |
| 9 | Mistral AI | primary | 94 | 88 | 91.3 |
| 10 | Google Research | research | 96 | 94 | 91.0 |

## TOP 10 fonti cinema

| # | Fonte | Tipo | Affid. | Tecnica | Score |
|---|---|---|---|---|---|
| 1 | ARRI | primary | 92 | 85 | 93.4 |
| 2 | American Cinematographer | technical | 94 | 95 | 88.9 |
| 3 | fxguide | technical | 92 | 95 | 87.7 |
| 4 | befores & afters | technical | 88 | 90 | 84.0 |
| 5 | VFX Voice | technical | 88 | 85 | 82.5 |
| 6 | ProVideo Coalition | technical | 84 | 88 | 80.8 |
| 7 | postPerspective | technical | 84 | 85 | 79.9 |
| 8 | Festival de Cannes | primary | 97 | 30 | 74.9 |
| 9 | Sundance Institute | primary | 97 | 30 | 74.9 |
| 10 | Academy — Oscars | primary | 98 | 30 | 74.8 |

## TOP fonti benchmark

| # | Fonte | Tipo | Affid. | Tecnica | Score |
|---|---|---|---|---|---|
| 1 | Artificial Analysis | benchmark | 92 | 90 | 87.7 |
| 2 | LMArena | benchmark | 90 | 85 | 85.0 |

## Fonti senza feed verificato

Presenti in `sources.json` con `active: false`. Non vengono interrogate dall'ingest finché non si trova un percorso legittimo.

| Fonte | Dominio | Sitemap | Nota |
|---|---|---|---|
| Berkeley BAIR Blog | bair.berkeley.edu | no | No feed found during verification; would need sitemap parsing or a manual check. |
| Anthropic | anthropic.com | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| Meta AI | ai.meta.com | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| Artificial Analysis | artificialanalysis.ai | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| Black Forest Labs | bfl.ai | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| LMArena | lmarena.ai | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| Runway | runwayml.com | no | No feed found during verification; would need sitemap parsing or a manual check. |
| xAI | x.ai | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| Luma AI | lumalabs.ai | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| The Batch — DeepLearning.AI | deeplearning.ai | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| ElevenLabs | elevenlabs.io | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| Adobe Blog | blog.adobe.com | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| Academy — Oscars | oscars.org | no | No feed found during verification; would need sitemap parsing or a manual check. |
| Festival de Cannes | festival-cannes.com | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| Berlinale | berlinale.de | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| Little White Lies | lwlies.com | sì | No feed found during verification; would need sitemap parsing or a manual check. |
| CineFacts | cinefacts.it | sì | No feed found during verification; would need sitemap parsing or a manual check. |

## Creator valutati ed esclusi

La richiesta era di **non** inserire automaticamente tutti i creator. Queste sono le esclusioni, con la motivazione; riattivarne uno significa cambiare `include` in `ingest/creator_meta.json`.

- **Matt Wolfe** — EXCLUDED. Large audience, but the format is a tool roundup with strong promotional framing and little verification. It would add volume without adding accuracy, which is exactly what this platform is built to avoid. Kept in this file so the decision is documented and reversible.
- **Two Minute Papers** — EXCLUDED for now. The author is a genuine researcher and the paper selection is good, but the delivery is built on superlatives that inflate incremental results. Reconsider if a version with more technical detail appears; the entry stays here so it is one flag away from being enabled.
- **Team Deakins** — EXCLUDED only because the YouTube handle did not resolve during verification. The podcast RSS on libsyn is the right ingest path and should be added as a podcast source — flagged as pending rather than dropped.
- **Aputure** — EXCLUDED: the @Aputure and @AputureChannel handles did not resolve to a channel ID during verification. It is a lighting manufacturer, so it would be a primary source on its own products rather than a creator. Re-check the handle before enabling.
- **Blackmagic Design** — EXCLUDED: handle did not resolve. Would be a primary source for DaVinci Resolve releases, which matters for the post-production desk. Worth re-checking the correct channel URL.
- **Lights Film School** — EXCLUDED: handle did not resolve, and the channel overlaps with sources already covered (No Film School, StudioBinder). Low priority.
- **Every Frame a Painting** — EXCLUDED from the daily ingest only because the channel publishes almost nothing: a feed that never updates adds no value to a daily platform. The quality is not in question — worth linking manually from the Cinema section.
- **Welch Labs (handle non risolto)** — EXCLUDED as a duplicate: the @WelchLabsVideo handle does not resolve, while @welchlabs does. The working entry is yt-welchlabs2.

## Copyright e termini d'uso

La piattaforma memorizza **solo** titolo, estratto fornito dal feed stesso, metadati e URL originale. Non scarica né archivia il testo integrale degli articoli, non copia i transcript dei video e non rehosta le immagini: le thumbnail sono collegate all'URL della fonte quando il feed lo espone.

`commercial_use_possible` è impostato su `check_terms` per ogni fonte: **non** è un'autorizzazione. Prima di qualsiasi uso commerciale vanno letti i termini di ciascuna testata, che in diversi casi vietano esplicitamente la ripubblicazione degli estratti.

Il fatto che un contenuto sia raggiungibile pubblicamente non implica che sia riutilizzabile.

