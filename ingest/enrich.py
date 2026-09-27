"""Classification, entity extraction and scoring.

All the knobs live in data/lexicon.json and data/source-priority.json; this
module only applies them. Keeping the rules in data is what lets the taxonomy
grow without rewriting the pipeline.
"""
import json
import math
import re
from datetime import datetime, timezone

_LEX = None
_PRIO = None
_TAXONOMY = None


def load_config(data_dir="data"):
    global _LEX, _PRIO, _TAXONOMY
    if _LEX is None:
        _LEX = json.load(open(f"{data_dir}/lexicon.json"))
        _PRIO = json.load(open(f"{data_dir}/source-priority.json"))
        cats = json.load(open(f"{data_dir}/categories.json"))
        _TAXONOMY = {m["id"]: {sc["id"] for sc in m["subcategories"]} for m in cats["macro"]}
    return _LEX, _PRIO


def valid_subcategory(category, sub):
    """A subcategory only belongs to its own macro category.

    Creator sources carry labels like 'podcasts' or 'educators', which live under
    'creators'. Letting those leak into AI or Tech produced chips pointing at
    subcategories that do not exist there.
    """
    if not sub or _TAXONOMY is None:
        return None
    return sub if sub in _TAXONOMY.get(category, set()) else None


def _word_re(term):
    esc = re.escape(term)
    if term[0].isalnum() and term[-1].isalnum():
        return re.compile(rf"(?<![\w-]){esc}(?![\w-])", re.I)
    return re.compile(esc, re.I)


_RE_CACHE = {}


def _matches(term, haystack):
    if term not in _RE_CACHE:
        _RE_CACHE[term] = _word_re(term)
    return bool(_RE_CACHE[term].search(haystack))


def _count_hits(terms, haystack):
    return [t for t in terms if _matches(t, haystack)]


# ---------------------------------------------------------------- language

_IT_MARKERS = re.compile(
    r"(?<![\w])(?:che|non|per|con|della|delle|degli|dell|nella|nelle|sono|anche|come|"
    r"più|così|perché|perche|questo|questa|questi|queste|quando|dove|essere|stato|stata|"
    r"uscita|nuovo|nuova|nuovi|nuove|ancora|dopo|prima|sulla|sugli|sulle|tra|fra|gli|"
    r"il|lo|la|le|un|uno|una|dal|dalla|dai|nel|nei|sui|suo|sua|loro|ha|hanno|è|ai|al|allo|"
    r"alla|agli|alle|si|ne|da|di|in|su|e|o|ma|se)(?![\w])",
    re.I)

# Words that are decisive on their own: an Italian editorial headline almost
# always carries one, even when it is mostly proper nouns.
_IT_STRONG = re.compile(
    r"(?<![\w])(?:recensione|recensioni|intervista|interviste|regista|registi|sceneggiatura|"
    r"riprese|montaggio|fotografia|premi|premio|vincitori|vincitore|anteprima|uscita|"
    r"stagione|puntata|trama|doppiaggio|sala|incassi|proviamo|guida|come funziona|"
    r"perché|perche|spiegato|spiegazione|approfondimento|curiosità|novità|"
    r"secondo|infatti|inoltre|invece|mentre|senza|contro|verso|oltre)(?![\w])",
    re.I)


def detect_language(text):
    """Cheap heuristic: good enough to tag a badge and to pick a translation
    direction. Short headlines made mostly of proper nouns are the hard case,
    so a single decisive Italian word counts as much as overall density."""
    if not text:
        return "en"
    if _IT_STRONG.search(text):
        return "it"
    hits = len(_IT_MARKERS.findall(text))
    words = max(len(text.split()), 1)
    return "it" if (hits / words > 0.12 and hits >= 3) else "en"


# ---------------------------------------------------------------- entities

def extract_entities(text):
    lex, _ = load_config()
    return {
        "models": _count_hits(lex["models"], text)[:8],
        "companies": _count_hits(lex["companies"], text)[:8],
        "tools": _count_hits(lex["tools"], text)[:8],
        "people": [],
        "films": [],
    }


# ---------------------------------------------------------------- category

def classify(text, source):
    """Return (category, subcategory). The source's own category is the prior;
    lexical evidence can override it when it is strong enough."""
    lex, _ = load_config()
    default_cat = source.get("category", "ai")

    specific = set(lex.get("subcategory_specific", []))
    scores = {}
    best_sub = {}
    for cat, subs in lex["subcategory_keywords"].items():
        total = 0
        best, best_rank = None, (0, 0)
        for sub, kws in subs.items():
            n = len(_count_hits(kws, text))
            total += n
            # A specific label beats a broad one at equal evidence: an article
            # about image-to-video belongs there, not in "video generation".
            rank = (n, 1 if sub in specific else 0)
            if n and rank > best_rank:
                best, best_rank = sub, rank
        if total:
            scores[cat] = total
            best_sub[cat] = best

    # The source keeps priority unless another macro category wins clearly.
    cat = default_cat
    if scores:
        top = max(scores, key=scores.get)
        own = scores.get(default_cat, 0)
        if top != default_cat and scores[top] >= own + 2:
            cat = top

    sub = valid_subcategory(cat, best_sub.get(cat)) \
        or valid_subcategory(cat, source.get("subcategory"))
    return cat, sub


# ---------------------------------------------------------------- content type

def content_type(title, summary, source, has_video, has_audio):
    lex, prio = load_config()
    text = f"{title} {summary}"
    st = source.get("source_type")

    if has_audio:
        return "podcast"
    if _hits_any(prio["tutorial_signals"]["patterns_en"] + prio["tutorial_signals"]["patterns_it"], text):
        return "tutorial"
    if st == "benchmark":
        return "benchmark"
    if _hits_any(prio["curiosity_signals"]["patterns_en"] + prio["curiosity_signals"]["patterns_it"], text):
        return "curiosity"
    if st in ("research",) or _hits_any(["paper", "arxiv", "we introduce", "we present", "ablation"], text):
        return "research"
    if st == "primary" and _hits_any(
            ["introducing", "announcing", "we're releasing", "now available", "launch", "release",
             "presentiamo", "disponibile da oggi"], text):
        return "official_release"
    if st == "official_documentation":
        return "documentation"
    if has_video:
        return "video"
    if _hits_any(["review", "recensione", "★", "stars"], title):
        return "review"
    if _hits_any(["interview", "intervista", "in conversation", "talks about"], title):
        return "interview"
    return "news"


def _hits_any(patterns, text):
    low = text.lower()
    return any(p.lower() in low for p in patterns)


def tutorial_meta(title, summary):
    lex, _ = load_config()
    text = f"{title} {summary}"
    tool = None
    for key, kws in lex["tutorial_tool_map"].items():
        if _hits_any(kws, text):
            tool = key
            break
    diff = "intermediate"
    if _hits_any(lex["difficulty_signals"]["beginner"], text):
        diff = "beginner"
    elif _hits_any(lex["difficulty_signals"]["advanced"], text):
        diff = "advanced"
    return {"tool": tool, "difficulty": diff, "estimated_time": None, "author": None}


# ---------------------------------------------------------------- scoring

def source_score(source):
    _, prio = load_config()
    cfg = prio["source_score"]
    w = cfg["weights"]
    s = (source.get("reliability", 50) * w["reliability"]
         + source.get("technical_depth", 50) * w["technical_depth"]
         + source.get("editorial_quality", 50) * w["editorial_quality"]
         + source.get("creator_score", 0) * w["creator_score"])
    st = source.get("source_type")
    # A source has one nature. Stacking "primary" on top of "official documentation"
    # and "specialisation" let a changelog outrank a frontier research lab, so the
    # type bonuses are alternatives: the largest applicable one wins.
    bonuses = [0.0]
    if source.get("primary_source"):
        bonuses.append(cfg["primary_source_bonus"])
    if st == "official_documentation":
        bonuses.append(cfg["official_documentation_bonus"])
    if st == "research":
        bonuses.append(cfg["research_bonus"])
    if st == "benchmark":
        bonuses.append(cfg["benchmark_bonus"])
    s += max(bonuses)
    if source.get("specialization_bonus"):
        s += cfg["specialization_bonus"]
    if st == "community":
        s += cfg["community_penalty"]
    return max(0.0, min(100.0, s))


def hype_score(title):
    _, prio = load_config()
    cfg = prio["hype_signals"]
    low = title.lower()
    matches = sum(1 for p in cfg["patterns_en"] + cfg["patterns_it"] if p in low)
    score = matches * cfg["penalty_per_match"]
    letters = [c for c in title if c.isalpha()]
    if len(letters) > 12 and sum(1 for c in letters if c.isupper()) / len(letters) > 0.7:
        score += cfg["all_caps_title_penalty"]
    if title.count("!") >= 2 or "?!" in title:
        score += cfg["excessive_punctuation_penalty"]
    return min(float(cfg["max_penalty"]), float(score))


def technical_score(text, source):
    _, prio = load_config()
    cfg = prio["technical_signals"]
    pts = len(_count_hits(cfg["terms"], text)) * cfg["points_per_term"]
    return min(float(cfg["max_points"]), float(pts)) * 0.6 + source.get("technical_depth", 50) * 0.4


def freshness_score(published_at, ctype):
    _, prio = load_config()
    cfg = prio["freshness"]
    if not published_at:
        return 0.0
    hl = cfg["slow_decay_half_life_hours"] if ctype in cfg["slow_decay_content_types"] else cfg["half_life_hours"]
    age_h = (datetime.now(timezone.utc) - published_at).total_seconds() / 3600.0
    if age_h < 0:
        age_h = 0.0
    return 100.0 * math.pow(0.5, age_h / hl)


def importance_score(article, source, entities):
    _, prio = load_config()
    cfg = prio["importance_signals"]
    base = source_score(source) * 0.6
    if article["content_type"] == "official_release":
        base += cfg["official_release"]
    if article["content_type"] == "benchmark":
        base += cfg["benchmark_update"]
    if any(c in cfg["major_companies"] for c in entities["companies"]):
        base += cfg["major_company"]
    if article.get("subcategory") in ("festival", "awards"):
        base += cfg["festival_or_awards"]
    return max(0.0, min(100.0, base))


def overall_score(scores):
    _, prio = load_config()
    w = prio["article_score"]["weights"]
    v = (scores["importance_score"] * w["importance"]
         + scores["credibility_score"] * w["credibility"]
         + scores["quality_score"] * w["quality"]
         + scores["technical_score"] * w["technical"]
         + scores["freshness_score"] * w["freshness"]
         - scores["hype_score"] * w["hype_penalty"])
    return round(max(0.0, min(100.0, v)), 1)
