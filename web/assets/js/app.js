/* =========================================================================
   app.js — router, language switch, theme, search wiring.
   Switching language re-renders in place: route, filters, search query and
   scroll position all survive, which is the whole point of the requirement.
   ========================================================================= */
(function (global) {
  'use strict';

  const T = () => global.I18N;
  const S = () => global.Store;
  const V = () => global.UI;

  const THEME_KEY = 'newscreen.theme';

  const els = {};
  let currentRoute = { name: 'home', params: {}, query: {} };

  // ---------------------------------------------------------------- routing

  function parseHash() {
    return parseHashString(location.hash || '#/');
  }

  function parseHashString(hash) {
    const raw = (hash || '#/').replace(/^#/, '');
    const [pathPart, queryPart] = raw.split('?');
    const segs = pathPart.split('/').filter(Boolean);
    const query = {};
    if (queryPart) {
      new URLSearchParams(queryPart).forEach((v, k) => { if (v) query[k] = v; });
    }
    if (!segs.length) return { name: 'home', params: {}, query };
    const [head, arg] = segs;
    const map = {
      c: 'category', article: 'article', source: 'source', creator: 'creator',
      sources: 'sources', creators: 'creators', models: 'models', latest: 'latest',
      craft: 'craft'
    };
    const name = map[head] || 'home';
    return { name: name, params: { id: arg || null }, query: query };
  }

  function buildHash(route) {
    const q = new URLSearchParams(route.query || {}).toString();
    let path = '#/';
    if (route.name === 'category') path = '#/c/' + route.params.id;
    else if (route.name === 'article') path = '#/article/' + route.params.id;
    else if (route.name === 'source') path = '#/source/' + route.params.id;
    else if (route.name === 'creator') path = '#/creator/' + route.params.id;
    else if (route.name !== 'home') path = '#/' + route.name;
    return path + (q ? '?' + q : '');
  }

  /**
   * Lo stato della pagina e' `currentRoute`, non location.hash. L'indirizzo
   * viene aggiornato subito dopo, ma se l'ambiente lo rifiuta (una sandbox
   * che blocca la navigazione, un file aperto senza server) la pagina si
   * disegna lo stesso. Prima dipendevamo dall'evento hashchange: dove quello
   * non arriva, gli articoli non si aprivano.
   */
  const backStack = [];
  let suppressHash = false;

  function syncHash(hash) {
    if (location.hash === hash) return;
    suppressHash = true;
    try { location.hash = hash; }
    catch (e) { /* ambiente che non permette di cambiare indirizzo */ }
    setTimeout(() => { suppressHash = false; }, 0);
  }

  function go(hash, opts) {
    const o = opts || {};
    const next = parseHashString(hash);
    if (!o.noHistory) {
      const cur = buildHash(currentRoute);
      if (cur !== hash) backStack.push(cur);
      if (backStack.length > 60) backStack.shift();
    }
    currentRoute = next;
    render(false);
    syncHash(hash);
  }

  /** Dove porta "indietro" quando non c'e' nulla nella pila: il livello sopra. */
  function parentHash(route) {
    if (route.name === 'article') {
      const a = S().state.byId.article[route.params.id];
      if (a && a.category) {
        return a.category === 'craft' ? '#/craft' : '#/c/' + a.category;
      }
      return '#/';
    }
    if (route.name === 'source') return '#/sources';
    if (route.name === 'creator') return '#/creators';
    return '#/';
  }

  function goBack() {
    if (backStack.length) {
      const hash = backStack.pop();
      currentRoute = parseHashString(hash);
      render(false);
      syncHash(hash);
      return;
    }
    go(parentHash(currentRoute), { noHistory: true });
  }

  function renderBackBar() {
    if (!els.backbar) return;
    const home = currentRoute.name === 'home';
    els.backbar.hidden = home;
    if (home) return;
    els.backbar.innerHTML =
      '<div class="backbar-inner">' +
        '<button class="back-btn" id="backBtn" type="button">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 2L4 8l6 6" fill="none" ' +
          'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          V().esc(T().t('nav.back')) +
        '</button>' +
        '<a class="back-home" href="#/">' + V().esc(T().t('nav.home')) + '</a>' +
      '</div>';
  }

  function render(keepScroll) {
    const scrollY = window.scrollY;
    const r = currentRoute;
    let html = '';

    switch (r.name) {
      case 'category': html = V().renderCategory(r.params.id, r.query); break;
      case 'article':  html = V().renderArticle(r.params.id); break;
      case 'source':   html = V().renderSource(r.params.id, r.query); break;
      case 'creator':  html = V().renderCreator(r.params.id, r.query); break;
      case 'sources':  html = V().renderSources(r.query); break;
      case 'creators': html = V().renderCreators(r.query); break;
      case 'models':   html = V().renderModels(r.query); break;
      case 'craft':    html = V().renderCraft(r.query); break;
      case 'latest':   html = V().renderLatest(r.query); break;
      default:         html = V().renderHome();
    }

    els.main.innerHTML = html;
    renderNav();
    renderSubnav();
    renderFooter();
    renderBackBar();
    if (Refresh.available) setRefreshUI(Refresh.running ? 'running' : 'idle');
    renderDateline();
    applyStaticStrings();
    document.title = pageTitle();

    if (keepScroll) window.scrollTo(0, scrollY);
    else window.scrollTo(0, 0);

    // Anything still showing its original language gets translated on demand.
    if (global.Translator) global.Translator.scan(els.main);
  }

  function pageTitle() {
    const base = 'Newscreen paper';
    const r = currentRoute;
    if (r.name === 'category') return V().catLabel(r.params.id) + ' · ' + base;
    if (r.name === 'article') {
      const a = S().state.byId.article[r.params.id];
      return a ? T().pick(a, 'title').slice(0, 70) + ' · ' + base : base;
    }
    if (r.name === 'source') {
      const s = S().state.byId.source[r.params.id];
      return s ? s.name + ' · ' + base : base;
    }
    if (r.name === 'creator') {
      const c = S().state.byId.creator[r.params.id];
      return c ? c.name + ' · ' + base : base;
    }
    if (r.name === 'craft') return V().catLabel('craft') + ' · ' + base;
    if (r.name !== 'home') return T().t('nav.' + r.name, r.name) + ' · ' + base;
    return base + ' — ' + T().t('home.tagline');
  }

  // ---------------------------------------------------------------- chrome

  function renderNav() {
    const macros = S().macroList();
    const active = currentRoute.name === 'category' ? currentRoute.params.id : null;
    const links = macros
      .filter(m => ['models', 'creators'].indexOf(m.id) < 0)
      .map(m => m.id === 'craft'
        ? navLink('#/craft', T().label(m.label), currentRoute.name === 'craft', 'craft')
        : navLink('#/c/' + m.id, T().label(m.label), active === m.id, m.id));
    links.push(navLink('#/creators', T().t('nav.creators'), currentRoute.name === 'creators', 'creators'));
    links.push(navLink('#/models', T().t('nav.models'), currentRoute.name === 'models', 'models'));
    els.nav.innerHTML = links.join('');
  }

  function navLink(href, text, isActive, catId) {
    return '<a class="nav-link' + (isActive ? ' is-active' : '') + '" href="' + href + '"' +
      (catId ? ' style="--nav-accent:' + V().accent(catId) + '"' : '') + '>' +
      V().esc(text) + '</a>';
  }

  function renderSubnav() {
    if (currentRoute.name !== 'category') { els.subnav.hidden = true; return; }
    const m = S().macro(currentRoute.params.id);
    if (!m) { els.subnav.hidden = true; return; }

    // Only subcategories that actually hold something today. A chip that leads
    // to an empty page is worse than no chip.
    const counts = S().facets({ category: m.id }).subcategory;
    const live = m.subcategories
      .map(sc => ({ sc: sc, n: counts[sc.id] || 0 }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n);

    if (!live.length) { els.subnav.hidden = true; return; }

    const cur = currentRoute.query.subcategory || '';
    const total = S().facets({ category: m.id }).total;
    const chips = ['<button class="chip' + (!cur ? ' is-active' : '') + '" data-sub="">' +
      V().esc(T().t('label.all')) + ' <span class="chip-n">' + total + '</span></button>']
      .concat(live.map(x =>
        '<button class="chip' + (cur === x.sc.id ? ' is-active' : '') + '" data-sub="' +
        V().esc(x.sc.id) + '">' + V().esc(T().label(x.sc.label)) +
        ' <span class="chip-n">' + x.n + '</span></button>'));

    els.subnav.innerHTML = '<div class="subnav-inner">' + chips.join('') + '</div>';
    els.subnav.hidden = false;
  }

  /** Spiega che questa copia non si aggiorna, e dove trovare quella che lo fa. */
  function showStaticNotice() {
    const el = document.getElementById('footerLive');
    if (!el) return;
    const url = global.__NEWSCREEN_LIVE_URL__;
    el.innerHTML = V().esc(T().t('static.notice')) +
      (url ? ' <a href="' + V().esc(url) + '" data-ext="1">' + V().esc(url) + '</a>' : '');
    el.hidden = false;
  }

  /** "vecchia di 4 giorni" / "vecchia di 30 ore", in parole. */
  function staleLabel(hours) {
    const days = Math.floor(hours / 24);
    if (days >= 1) {
      return T().t('stale.days').replace('{n}', days) +
             T().t(days === 1 ? 'stale.pluralSuffix' : 'stale.pluralSuffixMany') +
             T().t('stale.daysTail');
    }
    return T().t('stale.hours').replace('{n}', Math.floor(hours));
  }

  function renderDateline() {
    if (!els.datelineDate) return;
    const st = S().state;
    const d = st.generatedAt ? new Date(st.generatedAt) : new Date();
    let long = '';
    try {
      long = d.toLocaleDateString(T().lang === 'it' ? 'it-IT' : 'en-GB',
        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { long = d.toISOString().slice(0, 10); }
    els.datelineDate.textContent = long.charAt(0).toUpperCase() + long.slice(1);
    // Un guasto alla pipeline non deve passare inosservato: se l'edizione
    // ha piu' di un giorno lo si dice qui, dove l'occhio cade per primo.
    const ageH = st.generatedAt
      ? (Date.now() - new Date(st.generatedAt).getTime()) / 3600000 : 0;
    const stale = ageH >= 24;
    els.datelineEdition.textContent =
      T().t('masthead.edition') + ' ' + d.toISOString().slice(0, 10).replace(/-/g, '.') +
      ' \u00b7 ' + st.articles.length + ' ' + T().t('stat.articles') +
      (stale ? ' \u00b7 ' + staleLabel(ageH) : '');
    els.datelineEdition.classList.toggle('is-stale', stale);
  }

  function renderFooter() {
    const st = S().state;
    els.footerUpdated.textContent = st.generatedAt ? T().formatDateTime(st.generatedAt) : '—';
    els.footerCounts.textContent =
      st.articles.length + ' ' + T().t('stat.articles') + ' · ' +
      st.sources.length + ' ' + T().t('stat.sources') + ' · ' +
      st.events.length + ' ' + T().t('stat.events') + ' · ' +
      st.creators.length + ' ' + T().t('stat.creators');
  }

  function applyStaticStrings() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = T().t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = T().t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', T().t(el.getAttribute('data-i18n-aria')));
    });
    document.querySelectorAll('.lang-opt').forEach(b => {
      b.classList.toggle('is-active', b.dataset.lang === T().lang);
    });
  }

  // ------------------------------------------------------- aggiornamento

  /**
   * L'aggiornamento vero (leggere 85 fonti, classificare, raggruppare) lo fa
   * la pipeline Python sul Mac: il browser non può farlo da solo. Qui si
   * chiede al server di partire, si aspetta che finisca, e si rileggono i
   * dati nuovi. Dove il server non c'è — file offline, versione pubblicata —
   * il tasto non compare affatto, invece di esserci e non funzionare.
   */
  const Refresh = {
    available: false,
    running: false,
    timer: null,
    POLL_MS: 4000,
    MAX_WAIT_MS: 15 * 60 * 1000
  };

  async function api(path, opts) {
    const res = await fetch(path, Object.assign({ cache: 'no-store' }, opts || {}));
    if (!res.ok && res.status !== 202) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  /** C'è un Mac dall'altra parte che sa aggiornare? */
  async function detectRefresh() {
    if (S().state.standalone) return false;
    try {
      const st = await api('api/status');
      return typeof st.running === 'boolean';
    } catch (e) {
      return false;
    }
  }

  function setRefreshUI(mode) {
    if (!els.refreshBtn) return;
    els.refreshBtn.classList.toggle('is-running', mode === 'running');
    els.refreshBtn.disabled = mode === 'running';
    const key = mode === 'running' ? 'refresh.running' : 'refresh.button';
    if (els.refreshLabel) els.refreshLabel.textContent = T().t(key);
    els.refreshBtn.setAttribute('aria-label', T().t(key));
    setPullUI(mode === 'running' ? 'running' : 'idle');
  }

  function toast(msg, kind) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.className = 'toast' + (kind ? ' is-' + kind : '');
    els.toast.hidden = false;
    clearTimeout(els.toast._t);
    els.toast._t = setTimeout(() => { els.toast.hidden = true; }, 5200);
  }

  /** Rilegge i dati dal disco e ridisegna senza far saltare la posizione. */
  async function pickUpNewEdition(announce) {
    const r = await S().reload();
    render(true);
    if (announce) {
      const n = r.added;
      toast(n > 0
        ? T().t('refresh.done') + ' · ' + n + ' ' + T().t('refresh.newArticles')
        : T().t('refresh.done'), 'ok');
    }
    return r;
  }

  async function startRefresh() {
    if (!Refresh.available || Refresh.running) return;
    Refresh.running = true;
    setRefreshUI('running');

    let startedGen = S().state.generatedAt;
    try {
      // Se nel frattempo il Mac ha già prodotto un'edizione più recente
      // (l'aggiornamento programmato), la mostriamo subito: qualcosa di
      // nuovo da leggere mentre il resto arriva.
      const pre = await api('api/status');
      if (pre.generated_at && pre.generated_at !== startedGen) {
        const r = await pickUpNewEdition(false);
        startedGen = S().state.generatedAt;
        if (r.added) toast(T().t('refresh.done') + ' · ' + r.added + ' ' +
                           T().t('refresh.newArticles'), 'ok');
      }

      const res = await api('api/refresh', { method: 'POST' });
      if (!res.started && !res.running) throw new Error('avvio rifiutato');
      if (!res.started && res.running) toast(T().t('refresh.already'), null);

      await waitForIngest(startedGen);
    } catch (e) {
      toast(T().t('refresh.failed'), 'bad');
    } finally {
      Refresh.running = false;
      setRefreshUI('idle');
    }
  }

  /** Aspetta che il lock si liberi, poi raccoglie il risultato. */
  function waitForIngest(previousGen) {
    const deadline = Date.now() + Refresh.MAX_WAIT_MS;
    return new Promise((resolve, reject) => {
      const tick = async () => {
        if (Date.now() > deadline) return reject(new Error('timeout'));
        let st;
        try { st = await api('api/status'); }
        catch (e) { return reject(e); }

        if (st.running) {
          Refresh.timer = setTimeout(tick, Refresh.POLL_MS);
          return;
        }
        // finito: se l'edizione è cambiata la raccogliamo, altrimenti
        // vuol dire che non c'era nulla di nuovo da pubblicare.
        if (st.generated_at && st.generated_at !== previousGen) {
          await pickUpNewEdition(true);
        } else {
          toast(T().t('refresh.nothingNew'), null);
        }
        resolve();
      };
      Refresh.timer = setTimeout(tick, Refresh.POLL_MS);
    });
  }

  // --------------------------------------------- trascina per aggiornare

  const Pull = { startY: 0, dist: 0, active: false, touch: false, THRESHOLD: 72 };

  function setPullUI(mode, dist) {
    const el = els.pullIndicator;
    // Su un Mac col mouse non esiste il trascinamento: l'indicatore non deve
    // comparire, altrimenti si sovrappone alla testata durante l'attesa.
    if (!el || !Pull.touch) return;
    if (mode === 'idle') {
      el.className = 'pull-indicator';
      el.style.transform = '';
      if (els.pullText) els.pullText.textContent = '';
      return;
    }
    if (mode === 'running') {
      el.className = 'pull-indicator is-visible is-running';
      el.style.transform = 'translateY(' + Pull.THRESHOLD + 'px)';
      if (els.pullText) els.pullText.textContent = T().t('refresh.running');
      return;
    }
    const ready = dist >= Pull.THRESHOLD;
    el.className = 'pull-indicator is-visible' + (ready ? ' is-ready' : '');
    el.style.transform = 'translateY(' + Math.min(dist, Pull.THRESHOLD * 1.4) + 'px)';
    if (els.pullText) {
      els.pullText.textContent = T().t(ready ? 'refresh.release' : 'refresh.pull');
    }
  }

  function wirePullToRefresh() {
    if (!('ontouchstart' in global)) return;
    Pull.touch = true;

    document.addEventListener('touchstart', (e) => {
      if (Refresh.running || !Refresh.available) return;
      if (global.scrollY > 0 || e.touches.length !== 1) return;
      Pull.startY = e.touches[0].clientY;
      Pull.active = true;
      Pull.dist = 0;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!Pull.active) return;
      if (global.scrollY > 0) { Pull.active = false; setPullUI('idle'); return; }
      Pull.dist = e.touches[0].clientY - Pull.startY;
      if (Pull.dist <= 0) { setPullUI('idle'); return; }
      // resistenza: più tiri, meno scende
      setPullUI('pulling', Pull.dist * 0.5);
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!Pull.active) return;
      const go = Pull.dist * 0.5 >= Pull.THRESHOLD;
      Pull.active = false;
      Pull.dist = 0;
      if (go) startRefresh(); else setPullUI('idle');
    }, { passive: true });
  }

  // ---------------------------------------------------------------- theme

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private mode */ }
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    if (saved !== 'light' && saved !== 'dark') {
      saved = global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark' : 'light';
    }
    applyTheme(saved);
  }

  // ---------------------------------------------------------------- search

  let searchTimer = null;

  function openSearch() {
    els.searchOverlay.hidden = false;
    els.searchInput.focus();
    els.searchInput.select();
    runSearch();
  }

  function closeSearch() {
    els.searchOverlay.hidden = true;
  }

  function runSearch() {
    const q = els.searchInput.value;
    const res = q.trim().length >= 2 ? S().search(q) : null;
    els.searchResults.innerHTML = V().renderSearchResults(res);
    if (global.Translator) global.Translator.scan(els.searchResults);
  }

  // ---------------------------------------------------------------- events

  function setQuery(patch, keepScroll) {
    const q = Object.assign({}, currentRoute.query, patch);
    Object.keys(q).forEach(k => { if (!q[k]) delete q[k]; });
    currentRoute.query = q;
    const hash = buildHash(currentRoute);
    if (hash !== location.hash) {
      suppressHash = true;
      try { history.replaceState(null, '', hash); }
      catch (e) { try { location.hash = hash; } catch (e2) { /* niente indirizzo */ } }
      setTimeout(() => { suppressHash = false; }, 0);
    }
    render(keepScroll !== false);
  }

  function wire() {
    global.addEventListener('hashchange', () => {
      if (suppressHash) return;                 // e' un cambio che abbiamo fatto noi
      const next = parseHash();
      if (buildHash(next) === buildHash(currentRoute)) return;
      currentRoute = next;
      closeSearch();
      els.nav.classList.remove('is-open');
      if (els.menuBtn) els.menuBtn.setAttribute('aria-expanded', 'false');
      render(false);
    });

    // Ogni link interno passa di qui: cosi' la navigazione non dipende piu'
    // da come l'ambiente tratta gli indirizzi con #.
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a || a.hasAttribute('data-ext') || a.classList.contains('skip-link')) return;
      const hash = a.getAttribute('href');
      if (!hash || hash === '#') return;
      e.preventDefault();
      closeSearch();
      go(hash);
    });

    document.addEventListener('click', (e) => {
      const b = e.target.closest ? e.target.closest('#backBtn') : null;
      if (b) { e.preventDefault(); goBack(); }
    });

    // language: re-render in place, nothing is lost
    document.querySelectorAll('.lang-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.lang === T().lang) return;
        T().set(btn.dataset.lang);
        render(true);
        if (!els.searchOverlay.hidden) runSearch();
      });
    });

    els.themeBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });

    if (els.refreshBtn) {
      els.refreshBtn.addEventListener('click', startRefresh);
    }
    wirePullToRefresh();

    els.searchBtn.addEventListener('click', openSearch);
    els.searchOverlay.addEventListener('click', (e) => {
      if (e.target === els.searchOverlay) closeSearch();
    });
    els.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 110);
    });
    els.searchResults.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeSearch();
    });

    if (els.menuBtn) {
      els.menuBtn.addEventListener('click', () => {
        const open = els.nav.classList.toggle('is-open');
        els.menuBtn.setAttribute('aria-expanded', String(open));
      });
    }

    // Link verso la fonte originale. In un iframe con sandbox stretta
    // target="_blank" viene bloccato senza dire nulla: in quel caso si apre
    // nella stessa finestra, cosi' il link funziona ovunque.
    document.addEventListener('click', (e) => {
      const ext = e.target.closest ? e.target.closest('a[data-ext]') : null;
      if (!ext) return;
      const url = ext.getAttribute('href');
      if (!url || !/^https?:/i.test(url)) return;
      e.preventDefault();
      let w = null;
      try { w = global.open(url, '_blank', 'noopener'); } catch (err) { w = null; }
      if (w) { try { w.opener = null; } catch (err) { /* noop */ } return; }

      // Popup bloccato: riproviamo con un click vero su un link temporaneo,
      // che alcuni browser accettano anche quando window.open no.
      try {
        const a2 = document.createElement('a');
        a2.href = url; a2.target = '_blank'; a2.rel = 'noopener noreferrer';
        document.body.appendChild(a2);
        a2.click();
        document.body.removeChild(a2);
        return;
      } catch (err) { /* ultima spiaggia sotto */ }

      // Mai toccare window.top: dentro un iframe porterebbe via l'intera
      // pagina ospite. Al massimo navighiamo questa cornice.
      try { global.location.href = url; } catch (err) { /* niente da fare */ }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.searchOverlay.hidden) { closeSearch(); return; }
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); openSearch(); return;
      }
      if (e.key === '/' && els.searchOverlay.hidden &&
          !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault(); openSearch();
      }
    });

    // filters and chips are delegated, so re-rendered markup keeps working
    els.main.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-filter]');
      if (!sel) return;
      setQuery({ [sel.dataset.filter]: sel.value });
    });

    els.main.addEventListener('click', (e) => {
      const more = e.target.closest('[data-more]');
      if (more) { setQuery({ show: more.dataset.more }, true); return; }
      const allChip = e.target.closest('[data-all]');
      if (allChip) { setQuery({ all: allChip.dataset.all, show: '' }, false); return; }
      const chip = e.target.closest('[data-model-type]');
      if (chip) { setQuery({ modelType: chip.dataset.modelType }); return; }
      const kindChip = e.target.closest('[data-kind]');
      if (kindChip) { setQuery({ kind: kindChip.dataset.kind }); }
    });

    els.subnav.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-sub]');
      if (!chip) return;
      setQuery({ subcategory: chip.dataset.sub }, false);
      window.scrollTo(0, 0);
    });
  }

  // ---------------------------------------------------------------- boot

  async function boot() {
    els.main = document.getElementById('main');
    els.nav = document.getElementById('mainNav');
    els.subnav = document.getElementById('subnav');
    els.searchBtn = document.getElementById('searchBtn');
    els.themeBtn = document.getElementById('themeBtn');
    els.menuBtn = document.getElementById('menuBtn');
    els.searchOverlay = document.getElementById('searchOverlay');
    els.searchInput = document.getElementById('searchInput');
    els.searchResults = document.getElementById('searchResults');
    els.footerUpdated = document.getElementById('footerUpdated');
    els.footerCounts = document.getElementById('footerCounts');
    els.backbar = document.getElementById('backbar');
    els.refreshBtn = document.getElementById('refreshBtn');
    els.refreshLabel = document.getElementById('refreshLabel');
    els.pullIndicator = document.getElementById('pullIndicator');
    els.pullText = document.getElementById('pullText');
    els.toast = document.getElementById('toast');
    els.datelineDate = document.getElementById('datelineDate');
    els.datelineEdition = document.getElementById('datelineEdition');

    initTheme();
    T().init();
    applyStaticStrings();

    els.main.innerHTML = '<div class="loading">loading…</div>';

    try {
      await S().init();
    } catch (err) {
      els.main.innerHTML =
        '<div class="empty-state"><h3>' + V().esc(T().t('empty.noData')) + '</h3>' +
        '<p>' + V().esc(T().t('empty.noDataDesc')) + '<br><br>' +
        '<code>python3 ingest/build.py</code><br><br>' +
        '<span style="font-size:12px;opacity:.7">' + V().esc(err.message) + '</span></p></div>';
      return;
    }

    currentRoute = parseHash();
    wire();
    render(false);

    // Il tasto compare solo se c'è davvero un Mac che può aggiornare.
    Refresh.available = await detectRefresh();
    if (Refresh.available && els.refreshBtn) {
      els.refreshBtn.hidden = false;
      setRefreshUI('idle');
    } else if (S().state.standalone) {
      // Solo il file unico e' davvero congelato. Su GitHub Pages non c'e' il
      // tasto (manca il Mac a cui dare l'ordine) ma i dati vengono comunque
      // rigenerati ogni giorno: dire "copia fissa" li' sarebbe falso.
      showStaticNotice();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
