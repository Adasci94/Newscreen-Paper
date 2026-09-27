/* =========================================================================
   i18n — every UI string lives here, in both languages.
   Source names, URLs, model names, creator handles and brands are never
   translated: they are data, not interface.
   ========================================================================= */
(function (global) {
  'use strict';

  const STRINGS = {
    it: {
      'a11y.skip': 'Vai al contenuto',
      'masthead.motto': 'Fonti primarie · Profondità tecnica · Niente hype',
      'masthead.edition': 'Edizione',
      'stale.days': 'FERMA DA {n} GIORN',
      'stale.pluralSuffix': 'O',
      'stale.pluralSuffixMany': 'I',
      'stale.hours': 'FERMA DA {n} ORE',
      'stale.daysTail': '',
      'article.openOriginal': 'Apri la fonte originale',
      'a11y.search': 'Cerca',
      'a11y.theme': 'Cambia tema',

      'nav.home': 'Home',
      'nav.cinema': 'Cinema',
      'nav.ai': 'AI',
      'nav.generative_media': 'Gen Media',
      'nav.tutorials': 'Tutorial',
      'nav.tech_curiosities': 'Tech',
      'nav.creators': 'Creator',
      'nav.models': 'Modelli',
      'nav.sources': 'Fonti',
      'nav.craft': 'Mestiere',
      'static.notice': 'Questa è una copia fissa: non si aggiorna. L\u2019edizione che si aggiorna, col tasto per farlo, è qui \u2192',
      'refresh.button': 'Aggiorna notizie',
      'refresh.running': 'Aggiorno…',
      'refresh.done': 'Edizione aggiornata',
      'refresh.nothingNew': 'Nessuna notizia nuova da pubblicare',
      'refresh.newArticles': 'nuovi articoli',
      'refresh.already': 'Aggiornamento già in corso',
      'refresh.failed': 'Aggiornamento non riuscito',
      'refresh.pull': 'Trascina per aggiornare',
      'refresh.release': 'Rilascia per aggiornare',
      'nav.back': 'Indietro',
      'nav.latest': 'Ultime notizie',
      'latest.grouped': 'Una voce per storia',
      'latest.everything': 'Tutte le riprese',
      'action.loadMore': 'Mostra altri',
      'action.showingOf': 'di',

      'home.tagline': 'Discovery e curation su cinema, AI e creative technology',
      'home.top': 'In primo piano',
      'home.top.sub': 'Le storie più rilevanti delle ultime 48 ore, pesate per autorevolezza della fonte e non per popolarità',
      'home.columns': 'Le rubriche di oggi',
      'craft.library': 'Archivio delle rubriche',
      'craft.librarySub': 'Tutte le schede scritte per questa sezione, consultabili quando servono',
      'craft.fromSources': 'Dalle fonti',
      'craft.fromSourcesSub': 'Articoli e video su fotografia, montaggio, color e VFX dalle fonti verificate',
      'home.columns.sub': 'Tre approfondimenti brevi: una tecnica di montaggio, una di ripresa e una curiosità dal mondo del cinema',
      'home.latest': 'Ultime notizie',
      'home.latest.sub': 'Tutto il flusso, in ordine cronologico',
      'home.modelwatch': 'Model Watch',
      'home.modelwatch.sub': 'Release, benchmark e confronti tra modelli',
      'home.creators': 'Dai creator',
      'home.creators.sub': 'Video e podcast selezionati da voci tecniche affidabili',
      'home.tutorials': 'Tutorial e workflow',
      'home.tutorials.sub': 'Guide pratiche, verificate, senza fuffa',

      'section.all': 'Vedi tutto',
      'section.viewAll': 'Tutti gli articoli',

      'label.source': 'Fonte',
      'label.sources': 'Fonti',
      'label.creator': 'Creator',
      'label.creators': 'Creator',
      'label.category': 'Categoria',
      'label.subcategory': 'Sottocategoria',
      'label.language': 'Lingua',
      'label.date': 'Data',
      'label.type': 'Tipo',
      'label.difficulty': 'Difficoltà',
      'label.tool': 'Tool',
      'label.tags': 'Tag',
      'label.all': 'Tutte',
      'label.allMasc': 'Tutti',
      'label.provider': 'Provider',
      'label.model': 'Modello',
      'label.released': 'Release',
      'label.context': 'Contesto',
      'label.openWeights': 'Open weights',
      'label.links': 'Link',
      'label.topics': 'Argomenti',
      'label.specialization': 'Specializzazione',
      'label.sortBy': 'Ordina',

      'sort.relevance': 'Rilevanza',
      'sort.newest': 'Più recenti',
      'sort.technical': 'Profondità tecnica',

      'article.readOriginal': 'Leggi l’originale',
      'article.watchYoutube': 'Guarda su YouTube',
      'article.openTutorial': 'Apri il tutorial',
      'article.listen': 'Ascolta l’episodio',
      'article.originalNotice': 'Newscreen paper mostra titolo, estratto e metadati. Il contenuto integrale resta sulla fonte originale, che riceve sempre la visita.',
      'article.related': 'Storie collegate',
      'article.alsoCovered': 'Coperta anche da',
      'article.scores': 'Valutazione',
      'article.fromSource': 'Altro da questa fonte',
      'article.entities': 'Nominati nell’articolo',
      'article.originalLang': 'Lingua originale',
      'article.backHome': 'Torna alla home',

      'score.overall': 'Complessivo',
      'score.importance': 'Rilevanza',
      'score.credibility': 'Credibilità',
      'score.technical': 'Tecnico',
      'score.freshness': 'Attualità',
      'score.hype': 'Hype',

      'event.coverage': 'fonti',
      'event.primarySource': 'fonte primaria',

      'search.placeholder': 'Cerca articoli, fonti, creator, modelli…',
      'search.articles': 'Articoli',
      'search.sources': 'Fonti',
      'search.creators': 'Creator',
      'search.models': 'Modelli',
      'search.events': 'Eventi',
      'search.empty': 'Nessun risultato',
      'search.hint': 'Scrivi almeno due caratteri',

      'sources.title': 'Fonti',
      'sources.desc': 'Ogni fonte ha un peso diverso. Una pagina ufficiale di OpenAI non vale quanto un post su un forum, e un paper non vale quanto un video promozionale.',
      'sources.latest': 'Ultimi contenuti',
      'sources.type.primary': 'Fonte primaria',
      'sources.type.official_documentation': 'Documentazione ufficiale',
      'sources.type.research': 'Ricerca',
      'sources.type.benchmark': 'Benchmark',
      'sources.type.technical': 'Tecnica',
      'sources.type.editorial': 'Editoriale',
      'sources.type.tutorial': 'Tutorial',
      'sources.type.creator': 'Creator',
      'sources.type.podcast': 'Podcast',
      'sources.type.database': 'Database',
      'sources.type.community': 'Community',

      'creators.title': 'Creator',
      'creators.desc': 'Voci tecniche selezionate, valutate una per una. Un creator non è una fonte primaria, a meno che non sia l’autore diretto di ciò di cui parla.',
      'creators.latest': 'Ultimi video',

      'models.title': 'Model Watch',
      'models.desc': 'Modelli tracciati con provider, modalità, contesto e link ai benchmark indipendenti. I numeri di benchmark restano sulle piattaforme che li misurano.',
      'models.checkBenchmarks': 'I dati aggiornati di qualità, prezzo e velocità si consultano su Artificial Analysis e LMArena, che restano la fonte autorevole.',
      'models.noPrice': 'n/d',

      'type.breaking_news': 'Breaking',
      'type.news': 'Notizia',
      'type.analysis': 'Approfondimento',
      'type.official_release': 'Release ufficiale',
      'type.research': 'Ricerca',
      'type.tutorial': 'Tutorial',
      'type.workflow': 'Workflow',
      'type.benchmark': 'Benchmark',
      'type.curiosity': 'Curiosità',
      'type.review': 'Recensione',
      'type.interview': 'Intervista',
      'type.video': 'Video',
      'type.podcast': 'Podcast',
      'type.documentation': 'Documentazione',

      'diff.beginner': 'Base',
      'diff.intermediate': 'Intermedio',
      'diff.advanced': 'Avanzato',

      'column.editing': 'Tecnica di montaggio',
      'column.shooting': 'Tecnica di ripresa',
      'column.curiosity': 'Curiosità dal cinema',

      'time.now': 'ora',
      'time.minutes': 'min fa',
      'time.hours': 'h fa',
      'time.yesterday': 'ieri',
      'time.days': 'g fa',

      'empty.title': 'Nessun contenuto qui',
      'empty.desc': 'Prova a cambiare filtro, oppure esegui l’ingestione per scaricare i contenuti più recenti.',
      'empty.noData': 'Dati non ancora generati',
      'empty.noDataDesc': 'Esegui l’ingestione dalla cartella del progetto:',
      'empty.filters': 'Nessun risultato con questi filtri',

      'footer.note': 'Newscreen paper aggrega, classifica e ordina contenuti da fonti verificate. Privilegia accuratezza sulla velocità, profondità tecnica sull’hype, fonti primarie sui rumor.',
      'footer.updated': 'Ultimo aggiornamento',
      'footer.legal': 'Tutti i contenuti appartengono alle rispettive fonti. Newscreen paper mostra titolo, breve estratto e metadati, e rimanda sempre all’originale. Nessun testo integrale viene copiato o ripubblicato.',

      'stat.articles': 'articoli',
      'stat.sources': 'fonti',
      'stat.events': 'eventi',
      'stat.creators': 'creator',
      'stat.reliability': 'affidabilità',
      'stat.technical': 'profondità tecnica',
      'stat.editorial': 'qualità editoriale',
      'stat.results': 'risultati'
    },

    en: {
      'a11y.skip': 'Skip to content',
      'masthead.motto': 'Primary sources · Technical depth · No hype',
      'masthead.edition': 'Edition',
      'stale.days': '{n} DAY',
      'stale.pluralSuffix': '',
      'stale.pluralSuffixMany': 'S',
      'stale.hours': '{n} HOURS OLD',
      'stale.daysTail': ' OLD',
      'article.openOriginal': 'Open the original source',
      'a11y.search': 'Search',
      'a11y.theme': 'Toggle theme',

      'nav.home': 'Home',
      'nav.cinema': 'Cinema',
      'nav.ai': 'AI',
      'nav.generative_media': 'Gen Media',
      'nav.tutorials': 'Tutorials',
      'nav.tech_curiosities': 'Tech',
      'nav.creators': 'Creators',
      'nav.models': 'Models',
      'nav.sources': 'Sources',
      'nav.craft': 'Craft',
      'static.notice': 'This is a frozen copy: it does not update. The live edition, with the refresh button, is here \u2192',
      'refresh.button': 'Refresh news',
      'refresh.running': 'Refreshing…',
      'refresh.done': 'Edition updated',
      'refresh.nothingNew': 'Nothing new to publish',
      'refresh.newArticles': 'new articles',
      'refresh.already': 'A refresh is already running',
      'refresh.failed': 'Refresh failed',
      'refresh.pull': 'Pull to refresh',
      'refresh.release': 'Release to refresh',
      'nav.back': 'Back',
      'nav.latest': 'Latest',
      'latest.grouped': 'One entry per story',
      'latest.everything': 'Every pickup',
      'action.loadMore': 'Show more',
      'action.showingOf': 'of',

      'home.tagline': 'Discovery and curation across cinema, AI and creative technology',
      'home.top': 'Top stories',
      'home.top.sub': 'The most relevant stories of the last 48 hours, weighted by source authority rather than by popularity',
      'home.columns': 'Today’s columns',
      'craft.library': 'Column archive',
      'craft.librarySub': 'Every card written for this section, there when you need it',
      'craft.fromSources': 'From the sources',
      'craft.fromSourcesSub': 'Articles and videos on cinematography, editing, colour and VFX from verified sources',
      'home.columns.sub': 'Three short reads: one editing technique, one shooting technique and one piece of cinema history',
      'home.latest': 'Latest',
      'home.latest.sub': 'The full stream, newest first',
      'home.modelwatch': 'Model Watch',
      'home.modelwatch.sub': 'Releases, benchmarks and model comparisons',
      'home.creators': 'From creators',
      'home.creators.sub': 'Videos and podcasts from technical voices worth trusting',
      'home.tutorials': 'Tutorials and workflows',
      'home.tutorials.sub': 'Practical, verified guides — no filler',

      'section.all': 'See all',
      'section.viewAll': 'All articles',

      'label.source': 'Source',
      'label.sources': 'Sources',
      'label.creator': 'Creator',
      'label.creators': 'Creators',
      'label.category': 'Category',
      'label.subcategory': 'Subcategory',
      'label.language': 'Language',
      'label.date': 'Date',
      'label.type': 'Type',
      'label.difficulty': 'Difficulty',
      'label.tool': 'Tool',
      'label.tags': 'Tags',
      'label.all': 'All',
      'label.allMasc': 'All',
      'label.provider': 'Provider',
      'label.model': 'Model',
      'label.released': 'Released',
      'label.context': 'Context',
      'label.openWeights': 'Open weights',
      'label.links': 'Links',
      'label.topics': 'Topics',
      'label.specialization': 'Specialisation',
      'label.sortBy': 'Sort',

      'sort.relevance': 'Relevance',
      'sort.newest': 'Newest',
      'sort.technical': 'Technical depth',

      'article.readOriginal': 'Read original',
      'article.watchYoutube': 'Watch on YouTube',
      'article.openTutorial': 'Open tutorial',
      'article.listen': 'Listen to episode',
      'article.originalNotice': 'Newscreen paper shows the title, an excerpt and metadata. The full piece stays on the original source, which always gets the visit.',
      'article.related': 'Related stories',
      'article.alsoCovered': 'Also covered by',
      'article.scores': 'Scoring',
      'article.fromSource': 'More from this source',
      'article.entities': 'Mentioned in this story',
      'article.originalLang': 'Original language',
      'article.backHome': 'Back to home',

      'score.overall': 'Overall',
      'score.importance': 'Importance',
      'score.credibility': 'Credibility',
      'score.technical': 'Technical',
      'score.freshness': 'Freshness',
      'score.hype': 'Hype',

      'event.coverage': 'sources',
      'event.primarySource': 'primary source',

      'search.placeholder': 'Search articles, sources, creators, models…',
      'search.articles': 'Articles',
      'search.sources': 'Sources',
      'search.creators': 'Creators',
      'search.models': 'Models',
      'search.events': 'Events',
      'search.empty': 'No results',
      'search.hint': 'Type at least two characters',

      'sources.title': 'Sources',
      'sources.desc': 'Not every source carries the same weight. An official OpenAI page is not a forum post, and a paper is not a promo video.',
      'sources.latest': 'Latest content',
      'sources.type.primary': 'Primary source',
      'sources.type.official_documentation': 'Official documentation',
      'sources.type.research': 'Research',
      'sources.type.benchmark': 'Benchmark',
      'sources.type.technical': 'Technical',
      'sources.type.editorial': 'Editorial',
      'sources.type.tutorial': 'Tutorial',
      'sources.type.creator': 'Creator',
      'sources.type.podcast': 'Podcast',
      'sources.type.database': 'Database',
      'sources.type.community': 'Community',

      'creators.title': 'Creators',
      'creators.desc': 'Technical voices, assessed one by one. A creator is not a primary source unless they are the direct author of what they are describing.',
      'creators.latest': 'Latest videos',

      'models.title': 'Model Watch',
      'models.desc': 'Tracked models with provider, modality, context and links to independent benchmarks. Benchmark numbers stay on the platforms that measure them.',
      'models.checkBenchmarks': 'Current quality, price and speed figures live on Artificial Analysis and LMArena, which remain the authority.',
      'models.noPrice': 'n/a',

      'type.breaking_news': 'Breaking',
      'type.news': 'News',
      'type.analysis': 'Analysis',
      'type.official_release': 'Official release',
      'type.research': 'Research',
      'type.tutorial': 'Tutorial',
      'type.workflow': 'Workflow',
      'type.benchmark': 'Benchmark',
      'type.curiosity': 'Curiosity',
      'type.review': 'Review',
      'type.interview': 'Interview',
      'type.video': 'Video',
      'type.podcast': 'Podcast',
      'type.documentation': 'Documentation',

      'diff.beginner': 'Beginner',
      'diff.intermediate': 'Intermediate',
      'diff.advanced': 'Advanced',

      'column.editing': 'Editing technique',
      'column.shooting': 'Shooting technique',
      'column.curiosity': 'Cinema curiosity',

      'time.now': 'now',
      'time.minutes': 'min ago',
      'time.hours': 'h ago',
      'time.yesterday': 'yesterday',
      'time.days': 'd ago',

      'empty.title': 'Nothing here yet',
      'empty.desc': 'Try changing the filters, or run the ingest to pull the latest content.',
      'empty.noData': 'No data generated yet',
      'empty.noDataDesc': 'Run the ingest from the project folder:',
      'empty.filters': 'No results for these filters',

      'footer.note': 'Newscreen paper aggregates, classifies and ranks content from verified sources. It favours accuracy over speed, technical depth over hype, primary sources over rumours.',
      'footer.updated': 'Last updated',
      'footer.legal': 'All content belongs to its respective sources. Newscreen paper shows the title, a short excerpt and metadata, and always links back to the original. No full text is copied or republished.',

      'stat.articles': 'articles',
      'stat.sources': 'sources',
      'stat.events': 'events',
      'stat.creators': 'creators',
      'stat.reliability': 'reliability',
      'stat.technical': 'technical depth',
      'stat.editorial': 'editorial quality',
      'stat.results': 'results'
    }
  };

  const STORAGE_KEY = 'newscreen.lang';
  let current = 'it';

  function detect() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'it' || saved === 'en') return saved;
    } catch (e) { /* private mode: fall through to browser language */ }
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return nav.toLowerCase().startsWith('it') ? 'it' : 'en';
  }

  function t(key, fallback) {
    const table = STRINGS[current] || STRINGS.en;
    if (key in table) return table[key];
    if (key in STRINGS.en) return STRINGS.en[key];
    return fallback !== undefined ? fallback : key;
  }

  /** Pick the localised field of a data object, falling back to the original. */
  function pick(obj, base) {
    if (!obj) return '';
    return obj[base + '_' + current] || obj[base + '_original']
        || obj[base + '_en'] || obj[base + '_it'] || obj[base] || '';
  }

  /** Localised label from a { it, en } pair coming out of categories.json. */
  function label(pair, fallback) {
    if (!pair) return fallback || '';
    if (typeof pair === 'string') return pair;
    return pair[current] || pair.en || pair.it || fallback || '';
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 2) return t('time.now');
    if (mins < 60) return mins + ' ' + t('time.minutes');
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + t('time.hours');
    const days = Math.floor(hours / 24);
    if (days === 1) return t('time.yesterday');
    if (days < 8) return days + t('time.days');
    return formatDate(iso);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(current === 'it' ? 'it-IT' : 'en-GB',
      { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(current === 'it' ? 'it-IT' : 'en-GB',
      { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const I18N = {
    get lang() { return current; },
    set(lang) {
      if (lang !== 'it' && lang !== 'en') return;
      current = lang;
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* non-fatal */ }
      document.documentElement.lang = lang;
    },
    init() { this.set(detect()); return current; },
    t: t, pick: pick, label: label,
    relativeTime: relativeTime, formatDate: formatDate, formatDateTime: formatDateTime
  };

  global.I18N = I18N;
})(window);
