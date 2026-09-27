/* =========================================================================
   translate.js — on-demand translation for anything the ingest budget did
   not already cover.

   The ingest pre-translates the highest-scoring articles into a shared cache.
   Everything else is translated here, in the browser, only when it is actually
   on screen — so selecting Italian gives an Italian page without waiting for
   the whole archive to be processed.
   ========================================================================= */
(function (global) {
  'use strict';

  // Two keyless providers backing each other up: either can be rate limited,
  // and a single endpoint would mean the page silently stops translating.
  const PROVIDERS = [
    {
      name: 'mymemory',
      url: (t, s, d) => 'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(t) + '&langpair=' + s + '|' + d,
      read: d => {
        if (!d || d.responseStatus !== 200) return null;
        const out = ((d.responseData && d.responseData.translatedText) || '').trim();
        const up = out.toUpperCase();
        if (!out || up.indexOf('MYMEMORY WARNING') >= 0 || up.indexOf('QUOTA') >= 0) return null;
        return out;
      }
    },
    {
      name: 'lingva',
      url: (t, s, d) => 'https://lingva.ml/api/v1/' + s + '/' + d + '/' +
        encodeURIComponent(t),
      read: d => ((d && d.translation) || '').trim() || null
    }
  ];
  const STORE_PREFIX = 'nsp.tr.';
  const MAX_PARALLEL = 3;
  const MAX_CHARS = 480;          // endpoint limit; longer text keeps its original

  const memory = new Map();       // session cache, avoids touching localStorage in a loop
  const pending = new Map();      // text|target -> Promise, so the same string is fetched once
  let active = 0;
  const queue = [];
  let disabled = false;           // every provider refused: stop asking
  const dead = Object.create(null);
  const fails = Object.create(null);
  const FAIL_LIMIT = 5;           // free endpoints hiccup; one failure is not an outage

  /**
   * Proper nouns that must survive translation. A result that lost the name the
   * story is about is worse than the untranslated original, so it is discarded.
   */
  let glossary = null;
  function buildGlossary() {
    if (glossary) return glossary;
    const terms = [];
    const S = global.Store && global.Store.state;
    if (S) {
      (S.sources || []).forEach(x => { terms.push(x.name); });
      (S.creators || []).forEach(x => { terms.push(x.name); if (x.alias) terms.push(x.alias); });
      (S.models || []).forEach(x => { terms.push(x.name); terms.push(x.provider); });
    }
    const out = [];
    terms.forEach(t => {
      if (!t || t.length < 4) return;
      out.push(t);
      const head = t.split(/\s[—–|(-]\s|\s\(/)[0].trim();
      if (head.length >= 4 && head !== t && head[0] === head[0].toUpperCase()) out.push(head);
    });
    glossary = [...new Set(out)].sort((a, b) => b.length - a.length);
    return glossary;
  }

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function keepsNames(src, out) {
    const present = buildGlossary().filter(t =>
      new RegExp('(?![\\w-])' + escRe(t) + '(?![\\w-])', 'i').test(src));
    if (!present.length) return true;
    const missing = present.filter(t =>
      !new RegExp('(?![\\w-])' + escRe(t) + '(?![\\w-])', 'i').test(out));
    return missing.length <= 1 && missing.length < present.length;
  }

  function keyOf(text, target) {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return STORE_PREFIX + target + '.' + (h >>> 0).toString(36) + '.' + text.length;
  }

  function readStore(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function writeStore(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* quota or private mode */ }
  }

  function cached(text, target) {
    const k = keyOf(text, target);
    if (memory.has(k)) return memory.get(k);
    const v = readStore(k);
    if (v !== null) { memory.set(k, v); return v; }
    return null;
  }

  function pump() {
    while (active < MAX_PARALLEL && queue.length) {
      const job = queue.shift();
      active++;
      run(job).finally(() => { active--; pump(); });
    }
  }

  function run(job) {
    const { text, src, target, resolve } = job;
    const live = PROVIDERS.filter(p => !dead[p.name]);
    if (!live.length) { disabled = true; resolve(null); return Promise.resolve(); }

    const attempt = (i) => {
      if (i >= live.length) { resolve(null); return Promise.resolve(); }
      const p = live[i];
      return fetch(p.url(text, src, target))
        .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
        .then(d => {
          const out = p.read(d);
          if (!out) throw new Error('empty');
          if (!keepsNames(text, out)) throw new Error('mangled');
          fails[p.name] = 0;
          const k = keyOf(text, target);
          memory.set(k, out);
          writeStore(k, out);
          resolve(out);
        })
        .catch(err => {
          // A mangled result is this string's problem, not the provider's.
          // Anything else counts against the provider, which is only given up
          // on after several failures in a row.
          if (!err || err.message !== 'mangled') {
            fails[p.name] = (fails[p.name] || 0) + 1;
            if (fails[p.name] >= FAIL_LIMIT) dead[p.name] = true;
          }
          return attempt(i + 1);
        });
    };
    return attempt(0);
  }

  /** Translate one string. Resolves with null when unavailable — callers keep the original. */
  function request(text, src, target) {
    text = (text || '').trim();
    if (!text || src === target || text.length > MAX_CHARS || disabled) {
      return Promise.resolve(null);
    }
    const hit = cached(text, target);
    if (hit !== null) return Promise.resolve(hit || null);

    const pk = target + '|' + text;
    if (pending.has(pk)) return pending.get(pk);

    const p = new Promise(resolve => {
      queue.push({ text: text, src: src, target: target, resolve: resolve });
      pump();
    }).then(v => { pending.delete(pk); return v; });
    pending.set(pk, p);
    return p;
  }

  // ------------------------------------------------------------ DOM binding

  let observer = null;

  function apply(el, out) {
    if (!out) { el.removeAttribute('data-tr'); return; }
    el.textContent = out;
    el.removeAttribute('data-tr');
    el.classList.add('is-translated');
    const article = el.closest('[data-article-id]');
    if (article && global.Store) {
      // Write it back onto the record so search and the next render reuse it.
      const a = Store.state.byId.article[article.getAttribute('data-article-id')];
      const field = el.getAttribute('data-tr-field');
      if (a && field) a[field + '_' + I18N.lang] = out;
    }
  }

  function handle(el) {
    const text = el.getAttribute('data-tr');
    const src = el.getAttribute('data-tr-src') || 'en';
    if (!text) return;
    el.removeAttribute('data-tr');           // claim it before the async hop
    request(text, src, I18N.lang).then(out => apply(el, out));
  }

  /** Translate what is on screen first, then the rest as the reader scrolls. */
  function scan(root) {
    if (disabled) return;
    const nodes = (root || document).querySelectorAll('[data-tr]');
    if (!nodes.length) return;

    if (!('IntersectionObserver' in global)) {
      nodes.forEach(handle);
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { observer.unobserve(e.target); handle(e.target); }
        });
      }, { rootMargin: '400px 0px' });
    }
    nodes.forEach(n => observer.observe(n));
  }

  global.Translator = {
    request: request,
    scan: scan,
    get disabled() { return disabled; },
    clearCache: function () {
      memory.clear();
      try {
        Object.keys(localStorage)
          .filter(k => k.indexOf(STORE_PREFIX) === 0)
          .forEach(k => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
    }
  };
})(window);
