/* =========================================================================
   ui.js — pure rendering. Every function returns an HTML string; nothing
   here touches the router or the network.
   ========================================================================= */
(function (global) {
  'use strict';

  const T = () => global.I18N;
  const S = () => global.Store;

  const ACCENT = {
    cinema: 'var(--cat-cinema)', ai: 'var(--cat-ai)',
    generative_media: 'var(--cat-genmedia)', tutorials: 'var(--cat-tutorials)',
    tech_curiosities: 'var(--cat-tech)', creators: 'var(--cat-creators)',
    models: 'var(--cat-models)', craft: 'var(--cat-craft)'
  };
  const accent = (id) => ACCENT[id] || 'var(--ink)';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const attr = esc;

  function safeUrl(u) {
    if (!u) return '';
    return /^https?:\/\//i.test(u) ? u : '';
  }

  // ---------------------------------------------------------------- atoms

  function catLabel(catId) {
    const m = S().macro(catId);
    return m ? T().label(m.label, catId) : catId;
  }

  function typeLabel(id) {
    const l = S().contentTypeLabel(id);
    return l ? T().label(l, id) : T().t('type.' + id, id);
  }

  function sourceName(id) {
    const s = S().state.byId.source[id];
    return s ? s.name : id;
  }

  function langBadge(lang) {
    return '<span class="badge badge-lang">' + esc((lang || 'en').toUpperCase()) + '</span>';
  }

  function coveragePill(article) {
    if (!article.event_id) return '';
    const ev = S().state.byId.event[article.event_id];
    if (!ev || ev.coverage_count < 2) return '';
    return '<span class="coverage-pill">' + ev.coverage_count + ' ' + T().t('event.coverage') + '</span>';
  }

  function playBadge(article) {
    if (!article.media) return '';
    if (article.media.kind === 'youtube') {
      return '<span class="play-badge"><svg viewBox="0 0 10 10" aria-hidden="true">' +
             '<path d="M2 1l7 4-7 4z" fill="currentColor"/></svg>VIDEO</span>';
    }
    return '<span class="play-badge"><svg viewBox="0 0 10 10" aria-hidden="true">' +
           '<path d="M2 1l7 4-7 4z" fill="currentColor"/></svg>PODCAST</span>';
  }

  function mediaBlock(article) {
    const img = safeUrl(article.image_url);
    if (!img) return '<div class="card-media is-empty"></div>';
    return '<div class="card-media">' +
      '<img src="' + attr(img) + '" alt="" loading="lazy" decoding="async" ' +
      'onerror="this.parentNode.classList.add(\'is-empty\')">' +
      playBadge(article) + '</div>';
  }


  /**
   * Text of a translatable field. When the translation for the current
   * language is missing, the original is emitted wrapped in a marker that
   * translate.js picks up once the element scrolls into view.
   */
  function trField(article, base) {
    const lang = T().lang;
    const ready = article[base + '_' + lang];
    if (ready) return esc(ready);
    const original = article[base + '_original'] || '';
    if (!original || article.original_language === lang) return esc(original);
    return '<span data-tr="' + attr(original) + '" data-tr-src="' +
           attr(article.original_language) + '" data-tr-field="' + attr(base) + '">' +
           esc(original) + '</span>';
  }

  // ---------------------------------------------------------------- elenchi

  const PAGE = 30;

  /**
   * Taglia un elenco lungo e restituisce il pulsante per allungarlo. Serve a
   * due cose insieme: il telefono non deve disegnare 300 schede in un colpo
   * (diventa lento e i tocchi non rispondono) e tutto resta comunque
   * raggiungibile, senza limiti nascosti.
   */
  function paged(list, filters) {
    const want = Math.max(PAGE, parseInt((filters || {}).show, 10) || PAGE);
    const items = list.slice(0, want);
    const rest = list.length - items.length;
    const foot = rest > 0
      ? '<div class="load-more-wrap"><button class="load-more" type="button" data-more="' +
          Math.min(want * 2, want + PAGE * 8) + '">' + esc(T().t('action.loadMore')) +
          ' <span class="load-more-n">' + Math.min(rest, PAGE * 2) + '</span></button>' +
        '<p class="load-more-meta">' + items.length + ' ' + esc(T().t('action.showingOf')) +
          ' ' + list.length + '</p></div>'
      : (list.length > PAGE
          ? '<p class="load-more-meta">' + list.length + ' ' + esc(T().t('action.showingOf')) +
            ' ' + list.length + '</p>' : '');
    return { items: items, foot: foot };
  }

  // ---------------------------------------------------------------- cards

  function articleCard(article, opts) {
    const o = opts || {};
    const title = trField(article, 'title');
    const summary = trField(article, 'summary');
    const sub = S().subLabel(article.category, article.subcategory);

    const hasMedia = !o.noMedia && !!safeUrl(article.image_url);
    return '<a class="card' + (o.lead ? ' lead-card' : '') +
      (o.lead && !hasMedia ? ' is-textonly' : '') + '" href="#/article/' + attr(article.id) + '"' +
      ' data-article-id="' + attr(article.id) + '"' +
      ' style="--cat-color:' + accent(article.category) + '">' +
      (o.noMedia ? '' : mediaBlock(article)) +
      '<div class="card-body">' +
        '<div class="card-kicker">' +
          '<span class="kicker-cat">' + esc(sub ? T().label(sub) : catLabel(article.category)) + '</span>' +
          '<span class="kicker-sep">·</span>' +
          '<span class="kicker-type">' + esc(typeLabel(article.content_type)) + '</span>' +
        '</div>' +
        '<h3 class="card-title">' + title + '</h3>' +
        (summary && !o.compact ? '<p class="card-summary">' + summary + '</p>' : '') +
        '<div class="card-foot">' +
          '<span class="card-source">' + esc(sourceName(article.source_id)) + '</span>' +
          '<span>·</span><span>' + esc(T().relativeTime(article.published_at)) + '</span>' +
          (article.original_language !== T().lang ? langBadge(article.original_language) : '') +
          coveragePill(article) +
        '</div>' +
      '</div></a>';
  }

  function rowItem(article, index) {
    const title = trField(article, 'title');
    const img = safeUrl(article.thumbnail_url);
    const sub = S().subLabel(article.category, article.subcategory);
    return '<a class="row-item" href="#/article/' + attr(article.id) + '"' +
      ' data-article-id="' + attr(article.id) + '"' +
      ' style="--cat-color:' + accent(article.category) + '">' +
      '<div>' +
        '<div class="card-kicker">' +
          (index != null ? '<span class="row-index">' + String(index).padStart(2, '0') + '</span>' : '') +
          '<span class="kicker-cat">' + esc(sub ? T().label(sub) : catLabel(article.category)) + '</span>' +
          '<span class="kicker-sep">·</span>' +
          '<span class="kicker-type">' + esc(typeLabel(article.content_type)) + '</span>' +
        '</div>' +
        '<h3 class="row-title">' + title + '</h3>' +
        '<div class="card-foot" style="border:0;padding:0">' +
          '<span class="card-source">' + esc(sourceName(article.source_id)) + '</span>' +
          '<span>·</span><span>' + esc(T().relativeTime(article.published_at)) + '</span>' +
          (article.original_language !== T().lang ? langBadge(article.original_language) : '') +
          coveragePill(article) +
        '</div>' +
      '</div>' +
      (img ? '<img class="row-thumb" src="' + attr(img) + '" alt="" loading="lazy" ' +
             'onerror="this.remove()">' : '<span></span>') +
      '</a>';
  }

  function sectionHead(title, sub, link, catId) {
    return '<div class="section-head" style="--sec-accent:' + accent(catId) + '">' +
      '<div><h2 class="section-title">' +
        (catId ? '<span class="dot"></span>' : '') + esc(title) + '</h2>' +
        (sub ? '<p class="section-sub">' + esc(sub) + '</p>' : '') +
      '</div>' +
      (link ? '<a class="section-link" href="' + attr(link.href) + '">' + esc(link.text) + '</a>' : '') +
      '</div>';
  }

  function emptyState(titleKey, descKey) {
    return '<div class="empty-state"><h3>' + esc(T().t(titleKey)) + '</h3>' +
           '<p>' + esc(T().t(descKey)) + '</p></div>';
  }

  function noDataState() {
    return '<div class="empty-state"><h3>' + esc(T().t('empty.noData')) + '</h3>' +
      '<p>' + esc(T().t('empty.noDataDesc')) + '<br><br>' +
      '<code>python3 ingest/build.py</code></p></div>';
  }

  // ---------------------------------------------------------------- home

  function renderHome() {
    const st = S().state;
    if (!st.articles.length) return noDataState();

    const top = S().topStories(5);
    const parts = [];

    // --- Top stories: one lead + four secondary
    if (top.length) {
      parts.push('<section class="section">' +
        sectionHead(T().t('home.top'), T().t('home.top.sub'),
                    { href: '#/latest', text: T().t('section.all') }) +
        '<div class="top-stories">' +
          articleCard(top[0], { lead: true }) +
          '<div class="top-side">' +
            top.slice(1, 5).map((a, i) => rowItem(a, i + 2)).join('') +
          '</div>' +
        '</div></section>');
    }

    // --- Daily columns
    const cols = S().todaysColumns();
    if (cols.length) {
      parts.push('<section class="section">' +
        sectionHead(T().t('home.columns'), T().t('home.columns.sub')) +
        '<div class="columns-grid">' + cols.map(columnCard).join('') + '</div>' +
        '</section>');
    }

    // --- The three macro blocks the brief asks for on the Home
    const blocks = ['cinema', 'ai', 'tech_curiosities'].map(id => {
      const items = S().highlights(id, 4);
      if (!items.length) return '';
      const m = S().macro(id);
      return '<div class="macro-block">' +
        sectionHead(T().label(m.label, id), null, { href: '#/c/' + id, text: T().t('section.all') }, id) +
        items.map((a, i) => i === 0 ? articleCard(a, { compact: false })
                                    : rowItem(a)).join('') +
        '</div>';
    }).filter(Boolean);
    if (blocks.length) {
      parts.push('<section class="section"><div class="macro-blocks">' + blocks.join('') + '</div></section>');
    }

    // --- Generative media
    const gen = S().highlights('generative_media', 4);
    if (gen.length) {
      const m = S().macro('generative_media');
      parts.push('<section class="section">' +
        sectionHead(T().label(m.label), T().label(m.tagline),
                    { href: '#/c/generative_media', text: T().t('section.all') }, 'generative_media') +
        '<div class="grid grid-4">' + gen.map(a => articleCard(a, { compact: true })).join('') + '</div>' +
        '</section>');
    }

    // --- Tutorials
    const tuts = S().byContentType(['tutorial', 'workflow'], 4);
    if (tuts.length) {
      parts.push('<section class="section">' +
        sectionHead(T().t('home.tutorials'), T().t('home.tutorials.sub'),
                    { href: '#/c/tutorials', text: T().t('section.all') }, 'tutorials') +
        '<div class="grid grid-4">' + tuts.map(a => articleCard(a, { compact: true })).join('') + '</div>' +
        '</section>');
    }

    // --- Creators
    const vids = S().state.articles.filter(a => a.source_type === 'creator')
      .sort((a, b) => S().score(b) - S().score(a)).slice(0, 4);
    if (vids.length) {
      parts.push('<section class="section">' +
        sectionHead(T().t('home.creators'), T().t('home.creators.sub'),
                    { href: '#/creators', text: T().t('section.all') }, 'creators') +
        '<div class="grid grid-4">' + vids.map(a => articleCard(a, { compact: true })).join('') + '</div>' +
        '</section>');
    }

    // --- Model watch
    if (st.models.length) {
      parts.push('<section class="section">' +
        sectionHead(T().t('home.modelwatch'), T().t('home.modelwatch.sub'),
                    { href: '#/models', text: T().t('section.all') }, 'models') +
        modelsTable(st.models.slice(0, 6)) +
        '</section>');
    }

    // --- Latest
    const latest = S().latest(12);
    if (latest.length) {
      parts.push('<section class="section">' +
        sectionHead(T().t('home.latest'), T().t('home.latest.sub'),
                    { href: '#/latest', text: T().t('section.all') }) +
        '<div>' + latest.map((a, i) => rowItem(a, i + 1)).join('') + '</div>' +
        '</section>');
    }

    return parts.join('');
  }

  function columnCard(col) {
    const tint = { editing: 'var(--cat-tutorials)', shooting: 'var(--cat-cinema)',
                   curiosity: 'var(--cat-tech)' }[col.kind] || 'var(--ink)';
    return '<article class="column-card" style="--col-accent:' + tint + '">' +
      '<div class="column-kicker">' + esc(T().t('column.' + col.kind)) + '</div>' +
      '<h3 class="column-title">' + esc(T().pick(col, 'title')) + '</h3>' +
      '<p class="column-body">' + esc(T().pick(col, 'body')) + '</p>' +
      '<div class="column-tags">' +
        (col['tags_' + T().lang] || col.tags_en || col.tags || [])
          .map(t => '<span class="tag-mini">' + esc(t) + '</span>').join('') +
      '</div></article>';
  }


  // ---------------------------------------------------------------- craft

  /** Subcategories, across cinema and tutorials, that count as craft. */
  const CRAFT_SUBS = ['cinematography', 'post_production', 'color', 'vfx',
                      'virtual_production', 'editing', 'shooting',
                      'video_workflow', 'vfx_workflow'];

  function craftArticles(sub) {
    const wanted = sub ? [sub] : CRAFT_SUBS;
    return S().state.articles
      .filter(a => (a.category === 'cinema' || a.category === 'tutorials'
                    || a.category === 'generative_media')
                   && wanted.indexOf(a.subcategory) >= 0)
      .sort((a, b) => S().score(b) - S().score(a));
  }

  function renderCraft(filters) {
    const m = S().macro('craft');
    const f = filters || {};
    const kind = f.kind || '';
    const columns = S().state.columns;
    const today = S().todaysColumns();

    // The columns answer "teach me something"; the feed answers "what is new".
    const pool = kind ? columns.filter(c => c.kind === kind) : columns;
    const isColumnKind = ['editing', 'shooting', 'curiosity'].indexOf(kind) >= 0;

    // Scegliendo una rubrica si restringe anche il flusso dalle fonti: un
    // filtro che lascia sotto tutti gli articoli non filtra niente.
    const KIND_SUBS = {
      editing: ['editing', 'post_production', 'video_workflow', 'color'],
      shooting: ['shooting', 'cinematography', 'virtual_production'],
      curiosity: []
    };
    let feed;
    if (!kind) feed = craftArticles(null);
    else if (isColumnKind) {
      const wanted = KIND_SUBS[kind];
      feed = wanted.length
        ? craftArticles(null).filter(a => wanted.indexOf(a.subcategory) >= 0)
        : [];
    } else feed = craftArticles(kind);

    const counts = { editing: 0, shooting: 0, curiosity: 0 };
    columns.forEach(c => { if (counts[c.kind] !== undefined) counts[c.kind]++; });

    const chip = (id, label, n) =>
      '<button class="chip' + (kind === id ? ' is-active' : '') + '" data-kind="' + attr(id) + '">' +
      esc(label) + (n ? ' <span class="chip-n">' + n + '</span>' : '') + '</button>';

    const feedSubs = {};
    craftArticles(null).forEach(a => { feedSubs[a.subcategory] = (feedSubs[a.subcategory] || 0) + 1; });

    const chips = [chip('', T().t('label.all'), columns.length + craftArticles(null).length),
                   chip('editing', T().t('column.editing'), counts.editing),
                   chip('shooting', T().t('column.shooting'), counts.shooting),
                   chip('curiosity', T().t('column.curiosity'), counts.curiosity)]
      .concat(m.subcategories
        .filter(sc => feedSubs[sc.id] > 0)
        .map(sc => chip(sc.id, T().label(sc.label), feedSubs[sc.id])));

    let body = '';

    if (!kind) {
      body += '<section class="section" style="margin-top:30px">' +
        sectionHead(T().t('home.columns'), T().t('home.columns.sub'), null, 'craft') +
        '<div class="columns-grid">' + today.map(columnCard).join('') + '</div></section>';
    }

    if (pool.length && (!kind || isColumnKind)) {
      const rest = kind ? pool : pool.filter(c => today.indexOf(c) < 0);
      if (rest.length) {
        body += '<section class="section">' +
          sectionHead(T().t('craft.library'), T().t('craft.librarySub'), null, 'craft') +
          '<div class="columns-grid">' + rest.map(columnCard).join('') + '</div></section>';
      }
    }

    if (feed.length) {
      const pg = paged(feed, f);
      body += '<section class="section">' +
        sectionHead(T().t('craft.fromSources'), T().t('craft.fromSourcesSub'), null, 'craft') +
        '<div class="grid grid-3">' + pg.items.map(a => articleCard(a)).join('') +
        '</div>' + pg.foot + '</section>';
    }

    if (!body) body = emptyState('empty.filters', 'empty.desc');

    return '<div class="page-head" style="--pg-accent:' + accent('craft') + '">' +
        '<div class="page-eyebrow">' + esc(T().t('label.category')) + '</div>' +
        '<h1 class="page-title">' + esc(T().label(m.label)) + '</h1>' +
        '<p class="page-desc">' + esc(T().label(m.tagline)) + '</p>' +
      '</div>' +
      '<div class="subnav-inner" style="padding:14px 0 0">' + chips.join('') + '</div>' +
      body;
  }

  // ---------------------------------------------------------------- category page

  function renderCategory(catId, filters) {
    const m = S().macro(catId);
    if (!m) return emptyState('empty.title', 'empty.desc');
    if (!S().state.articles.length) return noDataState();

    const list = S().filter(Object.assign({ category: catId }, filters));
    const pg = paged(list, filters);
    return '<div class="page-head" style="--pg-accent:' + accent(catId) + '">' +
        '<div class="page-eyebrow">' + esc(T().t('label.category')) + '</div>' +
        '<h1 class="page-title">' + esc(T().label(m.label)) + '</h1>' +
        '<p class="page-desc">' + esc(T().label(m.tagline)) + '</p>' +
      '</div>' +
      filterBar(catId, filters, list.length) +
      (list.length
        ? '<div class="grid grid-3" style="margin-top:24px">' +
            pg.items.map(a => articleCard(a)).join('') + '</div>' + pg.foot
        : emptyState('empty.filters', 'empty.desc'));
  }

  function renderLatest(filters) {
    if (!S().state.articles.length) return noDataState();
    const f = filters || {};
    const list = S().filter(Object.assign({ sort: 'newest' }, f,
      f.all ? { collapse: false } : {}));
    const pg = paged(list, f);
    const grouped = S().state.articles.length - S().filter({ sort: 'newest' }).length;
    return '<div class="page-head">' +
        '<div class="page-eyebrow">' + esc(T().t('home.latest')) + '</div>' +
        '<h1 class="page-title">' + esc(T().t('home.latest')) + '</h1>' +
        '<p class="page-desc">' + esc(T().t('home.latest.sub')) + '</p>' +
      '</div>' +
      filterBar(null, f, list.length, 'newest') +
      (grouped > 0
        ? '<div class="subnav-inner" style="padding:12px 0 0">' +
            '<button class="chip' + (!f.all ? ' is-active' : '') + '" data-all="">' +
              esc(T().t('latest.grouped')) + '</button>' +
            '<button class="chip' + (f.all ? ' is-active' : '') + '" data-all="1">' +
              esc(T().t('latest.everything')) +
              ' <span class="chip-n">+' + grouped + '</span></button>' +
          '</div>'
        : '') +
      '<div style="margin-top:12px">' + pg.items.map((a, i) => rowItem(a, i + 1)).join('') +
      '</div>' + pg.foot;
  }

  function filterBar(catId, filters, count, defaultSort) {
    const f = filters || {};
    const fc = S().facets({ category: catId });

    // Only offer a value that leads somewhere: every option carries its count,
    // and options with no content are not rendered at all.
    const options = (items, current) => items.map(i =>
      '<option value="' + attr(i.value) + '"' + (current === i.value ? ' selected' : '') + '>' +
      esc(i.label) + (i.n ? ' (' + i.n + ')' : '') + '</option>').join('');

    const group = (key, label, items, allLabel) => {
      const live = items.filter(i => i.n > 0);
      if (live.length < 2 && !f[key]) return '';        // a single choice is not a filter
      return '<div class="filter-group"><span class="filter-label">' + esc(label) + '</span>' +
        '<select class="select" data-filter="' + key + '">' +
        '<option value="">' + esc(allLabel) + '</option>' + options(live, f[key]) +
        '</select></div>';
    };

    const types = S().state.categories.content_types
      .map(c => ({ value: c.id, label: T().label(c.label), n: fc.contentType[c.id] || 0 }))
      .sort((a, b) => b.n - a.n);

    const sources = S().state.sources
      .map(s => ({ value: s.id, label: s.name, n: fc.source[s.id] || 0 }))
      .filter(s => s.n > 0)
      .sort((a, b) => a.label.localeCompare(b.label));

    const langs = [{ value: 'it', label: 'IT', n: fc.language.it || 0 },
                   { value: 'en', label: 'EN', n: fc.language.en || 0 }];

    // Tutorials get the two filters that matter there, and nowhere else.
    const tools = Object.keys(fc.tool)
      .map(k => ({ value: k, label: k.replace(/_/g, ' '), n: fc.tool[k] }))
      .sort((a, b) => b.n - a.n);
    const diffs = ['beginner', 'intermediate', 'advanced']
      .map(d => ({ value: d, label: T().t('diff.' + d), n: fc.difficulty[d] || 0 }));

    const sortSelect =
      '<div class="filter-group"><span class="filter-label">' + esc(T().t('label.sortBy')) +
      '</span><select class="select" data-filter="sort">' +
      options([{ value: 'relevance', label: T().t('sort.relevance') },
               { value: 'newest', label: T().t('sort.newest') },
               { value: 'technical', label: T().t('sort.technical') }],
              f.sort || defaultSort || 'relevance') +
      '</select></div>';

    const parts = [
      group('contentType', T().t('label.type'), types, T().t('label.allMasc')),
      group('source', T().t('label.source'), sources, T().t('label.all')),
      catId === 'tutorials' ? group('tool', T().t('label.tool'), tools, T().t('label.allMasc')) : '',
      catId === 'tutorials' ? group('difficulty', T().t('label.difficulty'), diffs, T().t('label.all')) : '',
      group('language', T().t('label.language'), langs, T().t('label.all')),
      sortSelect
    ].filter(Boolean);

    return '<div class="filter-bar">' + parts.join('') +
      '<span class="result-count">' + count + ' ' + esc(T().t('stat.results')) + '</span>' +
      '</div>';
  }

  // ---------------------------------------------------------------- article page

  function renderArticle(id) {
    const a = S().state.byId.article[id];
    if (!a) return emptyState('empty.title', 'empty.desc');

    const src = S().state.byId.source[a.source_id];
    const creator = a.creator_id ? S().state.byId.creator[a.creator_id] : null;
    const sub = S().subLabel(a.category, a.subcategory);
    const ev = a.event_id ? S().state.byId.event[a.event_id] : null;
    const others = ev ? S().eventArticles(a.event_id).filter(x => x.id !== a.id) : [];
    const rel = S().related(a, 5);
    const more = S().bySource(a.source_id, 6).filter(x => x.id !== a.id).slice(0, 4);

    let cta = T().t('article.readOriginal');
    if (a.media && a.media.kind === 'youtube') cta = T().t('article.watchYoutube');
    else if (a.media && a.media.kind === 'podcast') cta = T().t('article.listen');
    else if (a.content_type === 'tutorial' || a.content_type === 'workflow') cta = T().t('article.openTutorial');

    // entities e' facoltativo: il generatore del file singolo lo toglie quando
    // e' vuoto, e leggerlo alla cieca faceva fallire l'intera pagina articolo.
    const ae = a.entities || {};
    const ents = [].concat(ae.models || [], ae.companies || [], ae.tools || []);
    const uniqEnts = ents.filter((v, i) => ents.indexOf(v) === i).slice(0, 12);

    const main =
      '<div class="page-eyebrow" style="--pg-accent:' + accent(a.category) + '">' +
        esc(catLabel(a.category)) + (sub ? ' · ' + esc(T().label(sub)) : '') + '</div>' +
      '<h1 class="article-title">' + trField(a, 'title') + '</h1>' +
      '<div class="article-meta">' +
        '<a class="card-source" href="#/source/' + attr(a.source_id) + '">' +
          esc(src ? src.name : a.source_id) + '</a>' +
        (creator && creator.name !== (src && src.name)
          ? '<span>·</span><a class="card-source" href="#/creator/' + attr(creator.id) + '">' +
            esc(creator.name) + '</a>' : '') +
        '<span>·</span><span>' + esc(T().formatDate(a.published_at)) + '</span>' +
        '<span class="badge">' + esc(typeLabel(a.content_type)) + '</span>' +
        langBadge(a.original_language) +
        (src && src.primary_source ? '<span class="badge badge-primary">' +
          esc(T().t('event.primarySource')) + '</span>' : '') +
      '</div>' +
      (safeUrl(a.image_url)
        ? '<img class="article-hero" src="' + attr(a.image_url) + '" alt="" loading="lazy" onerror="this.remove()">'
        : '') +
      (a.summary_original
        ? '<p class="article-summary">' + trField(a, 'summary') + '</p>' : '') +
      '<div class="original-notice">' +
        '<p>' + esc(T().t('article.originalNotice')) + '</p>' +
        '<a class="btn" href="' + attr(safeUrl(a.url)) + '" target="_blank" rel="noopener noreferrer" data-ext="1">' +
          esc(cta) +
          '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9L9 3M9 3H4M9 3v5" fill="none" ' +
          'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</a>' +
        (safeUrl(a.url) ? '<p class="article-url">' + esc(a.url) + '</p>' : '') +
      '</div>' +
      (a.tutorial ? tutorialBox(a.tutorial) : '') +
      (others.length ? '<div class="aside-block" style="margin-top:34px">' +
        '<div class="aside-title">' + esc(T().t('article.alsoCovered')) + ' · ' +
          others.length + ' ' + esc(T().t('event.coverage')) + '</div>' +
        '<div>' + others.map(x => rowItem(x)).join('') + '</div></div>' : '') +
      (rel.length ? '<div class="aside-block">' +
        '<div class="aside-title">' + esc(T().t('article.related')) + '</div>' +
        '<div>' + rel.map(x => rowItem(x)).join('') + '</div></div>' : '');

    const side =
      '<div class="aside-block">' +
        '<div class="aside-title">' + esc(T().t('article.scores')) + '</div>' +
        scoreBlock(a.scores) +
      '</div>' +
      (uniqEnts.length ? '<div class="aside-block">' +
        '<div class="aside-title">' + esc(T().t('article.entities')) + '</div>' +
        '<div class="column-tags">' + uniqEnts.map(e =>
          '<span class="tag-mini">' + esc(e) + '</span>').join('') + '</div></div>' : '') +
      (src ? '<div class="aside-block">' +
        '<div class="aside-title">' + esc(T().t('label.source')) + '</div>' +
        '<a class="aside-item" href="#/source/' + attr(src.id) + '">' + esc(src.name) +
          '<span class="aside-meta">' + esc(T().t('sources.type.' + src.source_type, src.source_type)) +
          ' · ' + esc(src.domain) + '</span></a>' +
        '</div>' : '') +
      (more.length ? '<div class="aside-block">' +
        '<div class="aside-title">' + esc(T().t('article.fromSource')) + '</div>' +
        '<div class="aside-list">' + more.map(x =>
          '<a class="aside-item" href="#/article/' + attr(x.id) + '" data-article-id="' +
          attr(x.id) + '">' + trField(x, 'title') +
          '<span class="aside-meta">' + esc(T().relativeTime(x.published_at)) + '</span></a>').join('') +
        '</div></div>' : '');

    return '<div class="article-layout" data-article-id="' + attr(a.id) + '">' +
           '<div class="article-main">' + main + '</div>' +
           '<aside>' + side + '</aside></div>';
  }

  function tutorialBox(t) {
    const rows = [];
    if (t.tool) rows.push([T().t('label.tool'), t.tool]);
    if (t.difficulty) rows.push([T().t('label.difficulty'), T().t('diff.' + t.difficulty, t.difficulty)]);
    if (t.estimated_time) rows.push([T().t('label.date'), t.estimated_time]);
    if (t.author) rows.push([T().t('label.creator'), t.author]);
    if (!rows.length) return '';
    return '<div class="aside-block"><div class="aside-title">' + esc(T().t('type.tutorial')) + '</div>' +
      '<dl class="score-grid">' + rows.map(r =>
        '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl></div>';
  }

  function scoreBlock(s) {
    if (!s) return '';
    const rows = [
      ['score.overall', s.overall_score],
      ['score.importance', s.importance_score],
      ['score.credibility', s.credibility_score],
      ['score.technical', s.technical_score],
      ['score.freshness', s.freshness_score]
    ];
    if (s.hype_score > 0) rows.push(['score.hype', -s.hype_score]);
    return '<div class="meter"><span style="width:' + Math.max(2, Math.min(100, s.overall_score)) + '%"></span></div>' +
      '<dl class="score-grid">' + rows.map(r =>
        '<dt>' + esc(T().t(r[0])) + '</dt><dd>' + esc(Math.round(r[1])) + '</dd>').join('') + '</dl>';
  }

  // ---------------------------------------------------------------- sources

  function renderSources(filters) {
    const list = S().state.sources.slice().sort((a, b) =>
      (b.reliability + b.technical_depth) - (a.reliability + a.technical_depth));
    if (!list.length) return noDataState();
    const pg = paged(list, filters);
    return '<div class="page-head">' +
        '<div class="page-eyebrow">' + esc(T().t('nav.sources')) + '</div>' +
        '<h1 class="page-title">' + esc(T().t('sources.title')) + '</h1>' +
        '<p class="page-desc">' + esc(T().t('sources.desc')) + '</p></div>' +
      '<div class="grid grid-3" style="margin-top:26px">' +
        pg.items.map(s => '<a class="card" href="#/source/' + attr(s.id) + '"' +
          ' style="--cat-color:' + accent(s.category) + '"><div class="card-body">' +
          '<div class="card-kicker"><span class="kicker-cat">' +
            esc(T().t('sources.type.' + s.source_type, s.source_type)) + '</span>' +
            '<span class="kicker-sep">·</span><span class="kicker-type">' +
            esc(catLabel(s.category)) + '</span></div>' +
          '<h3 class="card-title">' + esc(s.name) + '</h3>' +
          '<p class="card-summary">' + esc(s.domain) + '</p>' +
          '<div class="card-foot">' +
            '<span class="mono">' + esc(T().t('stat.reliability')) + ' ' + s.reliability + '</span>' +
            '<span>·</span><span class="mono">' + esc(T().t('stat.technical')) + ' ' + s.technical_depth + '</span>' +
            (s.primary_source ? '<span class="badge badge-primary">primary</span>' : '') +
          '</div></div></a>').join('') +
      '</div>' + pg.foot;
  }

  function renderSource(id, filters) {
    const s = S().state.byId.source[id];
    if (!s) return emptyState('empty.title', 'empty.desc');
    const all = S().bySource(id, 9999);
    const pg = paged(all, filters);
    const items = pg.items;
    const links = [];
    if (s.url) links.push(['Website', s.url]);
    if (s.youtube_url) links.push(['YouTube', s.youtube_url]);
    if (s.rss_url) links.push(['RSS', s.rss_url]);
    if (s.api_url) links.push(['API', s.api_url]);

    return '<div class="profile-head" style="--pg-accent:' + accent(s.category) + '">' +
        '<div class="profile-avatar">' + esc(s.name.charAt(0)) + '</div>' +
        '<div class="profile-info">' +
          '<div class="page-eyebrow">' + esc(T().t('sources.type.' + s.source_type, s.source_type)) + '</div>' +
          '<h1 class="profile-name">' + esc(s.name) + '</h1>' +
          '<p class="profile-desc">' + esc(T().label(s.description, s.domain)) + '</p>' +
          '<div class="profile-links">' + links.map(l =>
            '<a class="profile-link" href="' + attr(safeUrl(l[1])) + '" target="_blank" rel="noopener noreferrer" data-ext="1">' +
            esc(l[0]) + ' ↗</a>').join('') + '</div>' +
        '</div></div>' +
      '<div class="stat-strip">' +
        stat(s.reliability, T().t('stat.reliability')) +
        stat(s.technical_depth, T().t('stat.technical')) +
        stat(s.editorial_quality, T().t('stat.editorial')) +
        stat(all.length, T().t('stat.articles')) +
      '</div>' +
      ((s.topics || []).length ? '<div class="column-tags" style="margin:16px 0 8px">' +
        s.topics.map(t => '<span class="tag-mini">' + esc(t) + '</span>').join('') + '</div>' : '') +
      '<section class="section" style="margin-top:28px">' +
        sectionHead(T().t('sources.latest'), null, null, s.category) +
        (items.length ? '<div class="grid grid-3">' + items.map(a => articleCard(a)).join('') + '</div>' + pg.foot
                      : emptyState('empty.title', 'empty.desc')) +
      '</section>';
  }

  function stat(value, label) {
    return '<div class="stat"><span class="stat-value">' + esc(value) + '</span>' +
           '<span class="stat-label">' + esc(label) + '</span></div>';
  }

  // ---------------------------------------------------------------- creators

  function renderCreators(filters) {
    const list = S().state.creators.slice().sort((a, b) =>
      (b.technical_depth + b.reliability) - (a.technical_depth + a.reliability));
    if (!list.length) return noDataState();
    const pg = paged(list, filters);
    return '<div class="page-head" style="--pg-accent:' + accent('creators') + '">' +
        '<div class="page-eyebrow">' + esc(T().t('nav.creators')) + '</div>' +
        '<h1 class="page-title">' + esc(T().t('creators.title')) + '</h1>' +
        '<p class="page-desc">' + esc(T().t('creators.desc')) + '</p></div>' +
      '<div class="grid grid-3" style="margin-top:26px">' +
        pg.items.map(c => '<a class="card" href="#/creator/' + attr(c.id) + '"' +
          ' style="--cat-color:var(--cat-creators)"><div class="card-body">' +
          '<div class="card-kicker"><span class="kicker-cat">' + esc(c.creator_type) + '</span>' +
            '<span class="kicker-sep">·</span><span class="kicker-type">' +
            esc((c.language || []).join(' / ').toUpperCase()) + '</span></div>' +
          '<h3 class="card-title">' + esc(c.name) +
            (c.alias ? ' <span style="color:var(--faint);font-weight:400">· ' + esc(c.alias) + '</span>' : '') +
          '</h3>' +
          '<p class="card-summary">' + esc(T().label(c.description)) + '</p>' +
          '<div class="card-foot">' +
            '<span class="mono">' + esc(T().t('stat.technical')) + ' ' + c.technical_depth + '</span>' +
            '<span>·</span><span class="mono">' + S().byCreator(c.id).length + ' ' +
              esc(T().t('stat.articles')) + '</span>' +
          '</div></div></a>').join('') +
      '</div>' + pg.foot;
  }

  function renderCreator(id, filters) {
    const c = S().state.byId.creator[id];
    if (!c) return emptyState('empty.title', 'empty.desc');
    const all = S().byCreator(id, 9999);
    const pg = paged(all, filters);
    const items = pg.items;
    const links = [];
    if (c.website) links.push(['Website', c.website]);
    if (c.youtube) links.push(['YouTube', c.youtube]);
    if (c.github) links.push(['GitHub', c.github]);
    if (c.podcast) links.push(['Podcast', c.podcast]);
    if (c.x) links.push(['X', c.x]);

    return '<div class="profile-head" style="--pg-accent:var(--cat-creators)">' +
        '<div class="profile-avatar">' + esc(c.name.charAt(0)) + '</div>' +
        '<div class="profile-info">' +
          '<div class="page-eyebrow">' + esc(c.creator_type) + '</div>' +
          '<h1 class="profile-name">' + esc(c.name) +
            (c.alias ? ' <span style="color:var(--faint);font-weight:400;font-size:.7em">' +
              esc(c.alias) + '</span>' : '') + '</h1>' +
          '<p class="profile-desc">' + esc(T().label(c.description)) + '</p>' +
          '<div class="profile-links">' + links.map(l =>
            '<a class="profile-link" href="' + attr(safeUrl(l[1])) + '" target="_blank" rel="noopener noreferrer" data-ext="1">' +
            esc(l[0]) + ' ↗</a>').join('') + '</div>' +
        '</div></div>' +
      '<div class="stat-strip">' +
        stat(c.technical_depth, T().t('stat.technical')) +
        stat(c.reliability, T().t('stat.reliability')) +
        stat(all.length, T().t('stat.articles')) +
        stat((c.language || []).join('/').toUpperCase(), T().t('label.language')) +
      '</div>' +
      ((c.topics || []).length ? '<div class="column-tags" style="margin:16px 0 8px">' +
        c.topics.map(t => '<span class="tag-mini">' + esc(t) + '</span>').join('') + '</div>' : '') +
      '<section class="section" style="margin-top:28px">' +
        sectionHead(T().t('creators.latest'), null, null, 'creators') +
        (items.length ? '<div class="grid grid-3">' + items.map(a => articleCard(a)).join('') + '</div>' + pg.foot
                      : emptyState('empty.title', 'empty.desc')) +
      '</section>';
  }

  // ---------------------------------------------------------------- models

  /**
   * Una colonna compare solo se almeno un modello dell'elenco la valorizza:
   * una colonna piena di "n/d" occupa spazio e non dice niente.
   */
  function modelsTable(list) {
    const na = '<span class="cell-na">' + T().t('models.noPrice') + '</span>';
    const ctx = (m) => m.context_window
      ? (m.context_window / 1000).toFixed(0) + 'K'
      : (m.max_duration_s ? m.max_duration_s + 's' : '');
    const links = (m) => [
      m.official_url ? '<a class="profile-link" href="' + attr(safeUrl(m.official_url)) +
        '" target="_blank" rel="noopener noreferrer" data-ext="1">Official</a>' : '',
      m.artificial_analysis_url ? '<a class="profile-link" href="' + attr(safeUrl(m.artificial_analysis_url)) +
        '" target="_blank" rel="noopener noreferrer" data-ext="1">AA</a>' : '',
      m.lmarena_url ? '<a class="profile-link" href="' + attr(safeUrl(m.lmarena_url)) +
        '" target="_blank" rel="noopener noreferrer" data-ext="1">Arena</a>' : ''
    ].filter(Boolean).join(' ');

    const cols = [
      { key: 'name', label: T().t('label.model'), always: true,
        cell: m => '<td><div class="model-name">' + esc(m.name) + '</div>' +
                   '<div class="model-provider">' + esc(m.provider) + '</div></td>' },
      { key: 'type', label: T().t('label.type'), always: true,
        cell: m => '<td><span class="type-pill">' + esc(m.type) + '</span></td>' },
      { key: 'ctx', label: T().t('label.context'), has: m => !!ctx(m),
        cell: m => '<td class="cell-mono">' + (ctx(m) || na) + '</td>' },
      { key: 'released', label: T().t('label.released'), has: m => !!m.release_date,
        cell: m => '<td class="cell-mono">' + (m.release_date ? esc(m.release_date) : na) + '</td>' },
      { key: 'open', label: T().t('label.openWeights'), has: m => !!m.open_weights,
        cell: m => '<td class="cell-mono">' + (m.open_weights ? '\u2713 ' + esc(m.license || '') : '\u2014') + '</td>' },
      { key: 'links', label: T().t('label.links'), has: m => !!links(m),
        cell: m => '<td>' + links(m) + '</td>' }
    ].filter(c => c.always || list.some(c.has));

    return '<div class="table-wrap"><table class="data"><thead><tr>' +
      cols.map(c => '<th>' + esc(c.label) + '</th>').join('') +
      '</tr></thead><tbody>' +
      list.map(m => '<tr>' + cols.map(c => c.cell(m)).join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  function renderModels(filters) {
    const all = S().state.models;
    if (!all.length) return noDataState();
    const f = filters || {};
    const list = f.modelType ? all.filter(m => m.type === f.modelType) : all;
    const types = [...new Set(all.map(m => m.type))];

    return '<div class="page-head" style="--pg-accent:' + accent('models') + '">' +
        '<div class="page-eyebrow">' + esc(T().t('nav.models')) + '</div>' +
        '<h1 class="page-title">' + esc(T().t('models.title')) + '</h1>' +
        '<p class="page-desc">' + esc(T().t('models.desc')) + '</p></div>' +
      '<div class="subnav-inner" style="padding:16px 0">' +
        '<button class="chip' + (!f.modelType ? ' is-active' : '') + '" data-model-type="">' +
          esc(T().t('label.allMasc')) + ' <span class="chip-n">' + all.length + '</span></button>' +
        types.map(t => '<button class="chip' + (f.modelType === t ? ' is-active' : '') +
          '" data-model-type="' + attr(t) + '">' + esc(t) +
          ' <span class="chip-n">' + all.filter(m => m.type === t).length + '</span></button>').join('') +
      '</div>' +
      modelsTable(list) +
      '<p class="footer-legal" style="margin-top:18px">' + esc(T().t('models.checkBenchmarks')) + '</p>' +
      (() => {
        const news = S().state.articles.filter(a =>
          a.content_type === 'official_release' || a.content_type === 'benchmark')
          .sort((a, b) => S().score(b) - S().score(a)).slice(0, 6);
        return news.length ? '<section class="section">' +
          sectionHead(T().t('home.modelwatch.sub'), null, null, 'models') +
          '<div>' + news.map((a, i) => rowItem(a, i + 1)).join('') + '</div></section>' : '';
      })();
  }

  // ---------------------------------------------------------------- search

  function renderSearchResults(res) {
    if (!res) return '<div class="sr-empty">' + esc(T().t('search.hint')) + '</div>';
    if (!res.total) return '<div class="sr-empty">' + esc(T().t('search.empty')) + '</div>';

    const group = (titleKey, items, fn) => items.length
      ? '<div class="sr-group-title">' + esc(T().t(titleKey)) + '</div>' + items.map(fn).join('')
      : '';

    return group('search.articles', res.articles, a =>
        '<a class="sr-item" href="#/article/' + attr(a.id) + '">' +
          '<span class="sr-title">' + trField(a, 'title') + '</span>' +
          '<span class="sr-meta">' + esc(sourceName(a.source_id)) + '</span></a>') +
      group('search.sources', res.sources, s =>
        '<a class="sr-item" href="#/source/' + attr(s.id) + '">' +
          '<span class="sr-title">' + esc(s.name) + '</span>' +
          '<span class="sr-meta">' + esc(s.source_type) + '</span></a>') +
      group('search.creators', res.creators, c =>
        '<a class="sr-item" href="#/creator/' + attr(c.id) + '">' +
          '<span class="sr-title">' + esc(c.name) + '</span>' +
          '<span class="sr-meta">' + esc(c.creator_type) + '</span></a>') +
      group('search.models', res.models, m =>
        '<a class="sr-item" href="#/models">' +
          '<span class="sr-title">' + esc(m.name) + '</span>' +
          '<span class="sr-meta">' + esc(m.provider) + '</span></a>');
  }

  global.UI = {
    esc: esc, accent: accent, articleCard: articleCard, rowItem: rowItem,
    sectionHead: sectionHead, emptyState: emptyState, noDataState: noDataState,
    renderHome: renderHome, renderCategory: renderCategory, renderLatest: renderLatest,
    renderArticle: renderArticle, renderSources: renderSources, renderSource: renderSource,
    renderCreators: renderCreators, renderCreator: renderCreator, renderModels: renderModels,
    renderCraft: renderCraft,
    renderSearchResults: renderSearchResults, catLabel: catLabel
  };
})(window);
