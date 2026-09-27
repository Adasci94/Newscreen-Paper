/* =========================================================================
   store.js — loads the generated JSON and answers queries over it.
   Everything is in memory: the whole dataset is a few hundred KB.
   ========================================================================= */
(function (global) {
  'use strict';

  const FILES = {
    articles: 'data/articles.json',
    events: 'data/events.json',
    sources: 'data/sources.json',
    creators: 'data/creators.json',
    categories: 'data/categories.json',
    models: 'data/models.json',
    columns: 'data/columns.json'
  };

  const state = {
    ready: false,
    standalone: false,
    error: null,
    generatedAt: null,
    articles: [],
    events: [],
    sources: [],
    creators: [],
    models: [],
    columns: [],
    categories: null,
    byId: { article: {}, source: {}, creator: {}, event: {}, model: {} }
  };

  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(path + ' → HTTP ' + res.status);
    return res.json();
  }

  async function loadOptional(path) {
    try { return await loadJSON(path); } catch (e) { return null; }
  }

  /**
   * The standalone build inlines every dataset into the page, so the same code
   * runs from a web server and from a file:// double-click with no network.
   */
  function embedded() {
    const raw = global.__NEWSCREEN_DATA__;
    if (raw) return raw;
    const tag = document.getElementById('newscreen-data');
    if (!tag) return null;
    try {
      const parsed = JSON.parse(tag.textContent);
      global.__NEWSCREEN_DATA__ = parsed;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  async function init() {
    const inline = embedded();
    let categories, articles, events, sources, creators, models, columns;

    if (inline) {
      categories = inline.categories;
      articles = inline.articles;
      events = inline.events;
      sources = inline.sources;
      creators = inline.creators;
      models = inline.models;
      columns = inline.columns;
    } else {
      // categories is the only hard requirement: without the taxonomy there is no UI.
      categories = await loadJSON(FILES.categories);
      [articles, events, sources, creators, models, columns] = await Promise.all([
        loadOptional(FILES.articles), loadOptional(FILES.events),
        loadOptional(FILES.sources), loadOptional(FILES.creators),
        loadOptional(FILES.models), loadOptional(FILES.columns)
      ]);
    }

    fill({ categories: categories, articles: articles, events: events,
           sources: sources, creators: creators, models: models,
           columns: columns }, !!inline);
    return state;
  }

  /** Riempie lo stato e ricostruisce gli indici. Usata sia al primo
      caricamento sia dopo un aggiornamento, così non esistono due strade
      diverse che possono divergere. */
  function fill(d, inline) {
    state.categories = d.categories;
    state.articles = (d.articles && d.articles.articles) || [];
    state.events = (d.events && d.events.events) || [];
    state.sources = (d.sources && d.sources.sources) || [];
    state.creators = (d.creators && d.creators.creators) || [];
    state.models = (d.models && d.models.models) || [];
    state.columns = (d.columns && d.columns.columns) || [];
    state.generatedAt = (d.articles && d.articles.generated_at) || null;
    state.standalone = !!inline;

    state.byId = { article: {}, source: {}, creator: {}, event: {}, model: {} };
    state.articles.forEach(a => { state.byId.article[a.id] = a; });
    state.events.forEach(e => { state.byId.event[e.event_id] = e; });
    state.sources.forEach(s => { state.byId.source[s.id] = s; });
    state.creators.forEach(c => { state.byId.creator[c.id] = c; });
    state.models.forEach(m => { state.byId.model[m.id] = m; });

    state.ready = true;
  }

  /**
   * Rilegge dal server l'edizione sul disco. Non scarica niente da internet:
   * quello lo fa la pipeline sul Mac. Qui si raccoglie solo il risultato.
   * Restituisce quanti articoli sono comparsi rispetto a prima.
   */
  async function reload() {
    if (state.standalone) return { changed: false, added: 0 };
    const before = state.articles.length;
    const beforeGen = state.generatedAt;

    const categories = await loadJSON(FILES.categories);
    const [articles, events, sources, creators, models, columns] = await Promise.all([
      loadOptional(FILES.articles), loadOptional(FILES.events),
      loadOptional(FILES.sources), loadOptional(FILES.creators),
      loadOptional(FILES.models), loadOptional(FILES.columns)
    ]);

    fill({ categories: categories, articles: articles, events: events,
           sources: sources, creators: creators, models: models,
           columns: columns }, false);

    return { changed: state.generatedAt !== beforeGen,
             added: Math.max(0, state.articles.length - before) };
  }

  // ------------------------------------------------------------ accessors

  function macro(id) {
    if (!state.categories) return null;
    return state.categories.macro.find(m => m.id === id) || null;
  }

  function macroList() { return state.categories ? state.categories.macro : []; }

  function subLabel(catId, subId) {
    const m = macro(catId);
    if (!m || !subId) return null;
    const s = m.subcategories.find(x => x.id === subId);
    return s ? s.label : null;
  }

  function contentTypeLabel(id) {
    if (!state.categories) return id;
    const ct = state.categories.content_types.find(c => c.id === id);
    return ct ? ct.label : null;
  }

  function score(a) { return (a.scores && a.scores.overall_score) || 0; }

  // ------------------------------------------------------------ queries

  /** One card per event: keeps the primary article, drops the duplicate coverage. */
  function collapseEvents(list) {
    const out = [];
    const seen = new Set();
    for (const a of list) {
      if (!a.event_id) { out.push(a); continue; }
      if (seen.has(a.event_id)) continue;
      seen.add(a.event_id);
      // Prefer the article flagged as the cluster lead, if it is in this list.
      const lead = list.find(x => x.event_id === a.event_id && x.is_event_primary) || a;
      out.push(lead);
    }
    return out;
  }

  function byCategory(catId) {
    return state.articles.filter(a => a.category === catId);
  }

  function topStories(limit) {
    const cfg = { minScore: 40, maxPerSource: 2 };
    const perSource = {};
    return collapseEvents(state.articles.slice().sort((a, b) => score(b) - score(a)))
      .filter(a => {
        if (score(a) < cfg.minScore) return false;
        perSource[a.source_id] = (perSource[a.source_id] || 0) + 1;
        return perSource[a.source_id] <= cfg.maxPerSource;
      })
      .slice(0, limit || 5);
  }

  function highlights(catId, limit) {
    const perSource = {};
    return collapseEvents(byCategory(catId).sort((a, b) => score(b) - score(a)))
      .filter(a => {
        perSource[a.source_id] = (perSource[a.source_id] || 0) + 1;
        return perSource[a.source_id] <= 2;
      })
      .slice(0, limit || 4);
  }

  function latest(limit) {
    return collapseEvents(state.articles).slice(0, limit || 24);
  }

  function byContentType(types, limit) {
    const set = new Set(Array.isArray(types) ? types : [types]);
    return collapseEvents(
      state.articles.filter(a => set.has(a.content_type)).sort((a, b) => score(b) - score(a))
    ).slice(0, limit || 8);
  }

  function bySource(sourceId, limit) {
    const list = state.articles.filter(a => a.source_id === sourceId);
    return limit ? list.slice(0, limit) : list;
  }

  function byCreator(creatorId, limit) {
    const list = state.articles.filter(a => a.creator_id === creatorId);
    return limit ? list.slice(0, limit) : list;
  }

  function eventArticles(eventId) {
    const ev = state.byId.event[eventId];
    if (!ev) return [];
    return ev.article_ids.map(id => state.byId.article[id]).filter(Boolean);
  }

  function related(article, limit) {
    if (!article) return [];
    const e0 = article.entities || {};
    const ents = new Set([
      ...(e0.models || []), ...(e0.companies || []), ...(e0.tools || [])
    ]);
    const scored = state.articles
      .filter(a => a.id !== article.id && a.event_id !== article.event_id)
      .map(a => {
        let s = 0;
        if (a.category === article.category) s += 2;
        if (a.subcategory && a.subcategory === article.subcategory) s += 2;
        const ae = a.entities || {};
        const aEnts = [...(ae.models || []), ...(ae.companies || []), ...(ae.tools || [])];
        s += aEnts.filter(e => ents.has(e)).length * 3;
        return { a, s };
      })
      .filter(x => x.s > 1)
      .sort((x, y) => y.s - x.s || score(y.a) - score(x.a));
    return scored.slice(0, limit || 5).map(x => x.a);
  }

  /**
   * Filter + sort used by every category page.
   * opts: { category, subcategory, source, creator, language, contentType, tool,
   *         difficulty, days, sort }
   */
  function filter(opts) {
    const o = opts || {};
    let list = state.articles.slice();

    if (o.category) list = list.filter(a => a.category === o.category);
    if (o.subcategory) list = list.filter(a => a.subcategory === o.subcategory);
    if (o.source) list = list.filter(a => a.source_id === o.source);
    if (o.creator) list = list.filter(a => a.creator_id === o.creator);
    if (o.language) list = list.filter(a => a.original_language === o.language);
    if (o.contentType) list = list.filter(a => a.content_type === o.contentType);
    if (o.tool) list = list.filter(a => a.tutorial && a.tutorial.tool === o.tool);
    if (o.difficulty) list = list.filter(a => a.tutorial && a.tutorial.difficulty === o.difficulty);
    if (o.sourceType) list = list.filter(a => a.source_type === o.sourceType);

    if (o.days) {
      const cutoff = Date.now() - Number(o.days) * 86400000;
      list = list.filter(a => new Date(a.published_at).getTime() >= cutoff);
    }

    if (o.collapse !== false) list = collapseEvents(list);

    const sort = o.sort || 'relevance';
    if (sort === 'newest') {
      list.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    } else if (sort === 'technical') {
      list.sort((a, b) => ((b.scores && b.scores.technical_score) || 0) -
                          ((a.scores && a.scores.technical_score) || 0));
    } else {
      list.sort((a, b) => score(b) - score(a));
    }
    return list;
  }


  /**
   * Counts for every filter value inside a scope, so the UI can hide the
   * options that would lead to an empty page. A control that does nothing
   * is worse than no control.
   */
  function facets(scope) {
    const base = (scope && scope.category)
      ? state.articles.filter(a => a.category === scope.category)
      : state.articles;

    const count = (list, key) => {
      const m = Object.create(null);
      list.forEach(a => {
        const v = typeof key === 'function' ? key(a) : a[key];
        if (v) m[v] = (m[v] || 0) + 1;
      });
      return m;
    };

    return {
      total: base.length,
      subcategory: count(base, 'subcategory'),
      contentType: count(base, 'content_type'),
      source: count(base, 'source_id'),
      language: count(base, 'original_language'),
      creator: count(base, 'creator_id'),
      tool: count(base, a => a.tutorial && a.tutorial.tool),
      difficulty: count(base, a => a.tutorial && a.tutorial.difficulty)
    };
  }

  /** Macro categories that actually hold something today. */
  function populatedMacros() {
    const counts = {};
    state.articles.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });
    return macroList().filter(m =>
      counts[m.id] > 0 || m.id === 'models' || m.id === 'creators' || m.id === 'craft');
  }

  // ------------------------------------------------------------ search

  function normalise(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function search(query) {
    const q = normalise(query.trim());
    if (q.length < 2) return null;
    const terms = q.split(/\s+/).filter(Boolean);
    const hit = (hay) => { const h = normalise(hay); return terms.every(t => h.includes(t)); };

    const articles = state.articles.filter(a =>
      hit([a.title_original, a.summary_original, (a.tags || []).join(' '),
           a.category, a.subcategory || ''].join(' '))
    ).sort((a, b) => score(b) - score(a)).slice(0, 8);

    const sources = state.sources.filter(s =>
      hit([s.name, s.domain, (s.topics || []).join(' ')].join(' '))).slice(0, 5);

    const creators = state.creators.filter(c =>
      hit([c.name, c.alias || '', (c.topics || []).join(' ')].join(' '))).slice(0, 5);

    const models = state.models.filter(m =>
      hit([m.name, m.provider, (m.tags || []).join(' ')].join(' '))).slice(0, 5);

    const events = state.events.filter(e => hit(e.title)).slice(0, 4);

    return { articles, sources, creators, models, events,
             total: articles.length + sources.length + creators.length + models.length + events.length };
  }

  // ------------------------------------------------------------ columns

  /** Deterministic daily rotation: the same three columns for everyone, all day. */
  function todaysColumns() {
    if (!state.columns.length) return [];
    const epochDay = Math.floor(Date.now() / 86400000);
    const kinds = ['editing', 'shooting', 'curiosity'];
    return kinds.map(kind => {
      const pool = state.columns.filter(c => c.kind === kind);
      if (!pool.length) return null;
      return pool[epochDay % pool.length];
    }).filter(Boolean);
  }

  global.Store = {
    state: state, init: init, reload: reload,
    macro: macro, macroList: macroList, subLabel: subLabel, contentTypeLabel: contentTypeLabel,
    score: score, collapseEvents: collapseEvents,
    byCategory: byCategory, topStories: topStories, highlights: highlights, latest: latest,
    byContentType: byContentType, bySource: bySource, byCreator: byCreator,
    eventArticles: eventArticles, related: related, filter: filter, search: search,
    todaysColumns: todaysColumns, facets: facets, populatedMacros: populatedMacros
  };
})(window);
