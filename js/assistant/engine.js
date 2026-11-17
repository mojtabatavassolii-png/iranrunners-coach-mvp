/* دستیار گام (آزمایشی): موتور جست‌وجوی متنی، بدون مدل زبانی و بدون هیچ درخواست شبکه.
 * نرمال‌سازی فارسی، بُن‌سازی سبک، وزن کلمه‌ها (IDF)، شباهت برای غلط املایی، لایه‌ی ایمنی و تشخیص خارج از حوزه.
 * بدون وابستگی به صفحه؛ در Node هم اجرا می‌شه (tests/assistant*.js). */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.GaamAssistantEngine = factory();
})(this, function () {
  'use strict';

  // ---------- نرمال‌سازی ----------
  var CHAR_MAP = { 'ي': 'ی', 'ى': 'ی', 'ئ': 'ی', 'ك': 'ک', 'ة': 'ه', 'ۀ': 'ه', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ؤ': 'و' };
  var DIGITS = '۰۱۲۳۴۵۶۷۸۹', ADIGITS = '٠١٢٣٤٥٦٧٨٩';
  function normalize(s) {
    s = String(s == null ? '' : s).toLowerCase();
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i], d = DIGITS.indexOf(c), a = ADIGITS.indexOf(c);
      if (d >= 0) c = String(d);
      else if (a >= 0) c = String(a);
      else if (CHAR_MAP[c]) c = CHAR_MAP[c];
      out += c;
    }
    out = out
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')                 // اعراب و کشیده
      .replace(/[\u200C\u200D\u200E\u200F\u00AD]/g, '')           // فاصله‌ی مجازی و نویسه‌های نامرئی: چسبیده
      .replace(/[\u060C\u061B\u061F\u066A-\u066C\u06D4]/g, ' ')    // علائم فارسی (، ؛ ؟ ٪)
      .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')                     // بقیه‌ی علائم
      .replace(/\s+/g, ' ').trim();
    // «می کنه» و «نمی تونم» با فاصله‌ی کامل = «میکنه» و «نمیتونم»
    out = out.replace(/(^| )(ن?می) (?=\S)/g, '$1$2');
    return out;
  }

  // کلمه‌های پرتکرار بی‌معنی برای جست‌وجو
  var STOP = {};
  ('و یا به از با در بر که را رو این اون ان آن یه یک یکی برای واسه تا هم هر همه من تو ما شما او اونا ' +
   'چی چیه چیست چه چطور چطوری چجوری چگونه چرا کی کجا کدوم کدام آیا ایا مگه اگه اگر ' +
   'است هست هستش نیست بود بوده باشه باشد باید بشه میشه میشم می شه کنم کنیم کنه کنی میکنم میکنه بکنم ' +
   'دارم داره داری داریم ندارم میخوام میخواستم خواستم بدم بگو بگید بگین لطفا سلام ممنون مرسی ' +
   'چقدر چقد چند خوبه خوب بهتر بهترین درسته درست الان یعنی مثلا ' +
   'میتونم میتونه نمیتونم تونم کردم کرد کرده شد شده شدم میشد دیگه خیلی کمی ای ولی اما فقط انجام').split(' ').forEach(function (w) { if (w) STOP[normalize(w)] = 1; });

  var SUFFIXES = ['هایی', 'های', 'ها', 'ترین', 'مون', 'تون', 'شون', 'مان', 'تان', 'شان', 'ام', 'ات', 'اش'];
  function stem(t) {
    var a = stem1(t);
    return a === t ? a : stem1(a);
  }
  function stem1(t) {
    if (t.length <= 3) return t;
    // «کیلومترمو»، «ایزیرانو»: «رو»ی محاوره‌ای چسبیده
    if (t.length >= 6 && t[t.length - 1] === 'و' && t[t.length - 2] !== 'و') return t.slice(0, -1);
    for (var i = 0; i < SUFFIXES.length; i++) {
      var s = SUFFIXES[i];
      if (t.length - s.length >= 3 && t.slice(-s.length) === s) return t.slice(0, -s.length);
    }
    var last = t[t.length - 1];
    if ((last === 'م' || last === 'ت') && t.length >= 4) return t.slice(0, -1);
    if ((last === 'ش' || last === 'ی') && t.length >= 5) return t.slice(0, -1);
    return t;
  }
  function tokens(s, keepStop) {
    var n = normalize(s);
    if (!n) return [];
    return n.split(' ').filter(function (t) { return keepStop || (!STOP[t] && !/^[0-9]+$/.test(t)); }).map(stem);
  }

  // ---------- شباهت کلمه‌ها (برای غلط املایی و چسبیده‌نویسی) ----------
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var best = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function wordSim(a, b) {
    if (a === b) return 1;
    var la = a.length, lb = b.length, m = Math.min(la, lb);
    if (m >= 3 && Math.abs(la - lb) <= 3 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return 0.85;
    if (m >= 4 && lev(a, b, 1) <= 1) return 0.75;
    if (m >= 7 && lev(a, b, 2) <= 2) return 0.6;
    return 0;
  }
  function trigrams(s) {
    var t = ' ' + normalize(s).replace(/ /g, '') + ' ', g = {};
    for (var i = 0; i < t.length - 2; i++) g[t.substr(i, 3)] = 1;
    return g;
  }
  function dice(ga, gb) {
    var na = 0, nb = 0, both = 0, k;
    for (k in ga) { na++; if (gb[k]) both++; }
    for (k in gb) nb++;
    return na + nb ? 2 * both / (na + nb) : 0;
  }

  // ---------- لایه‌ی ایمنی ----------
  // نشونه‌های جدی (از متن‌های خود اپ: پیام درد، برنامه‌ی درد، قانون ۱۰٪، ایمنی پیاده‌روی)
  var URGENT = [
    'ورم', 'تورم', 'باد کرده', 'پف کرده',
    'درد شدید', 'دردش شدید', 'شدید درد', 'خیلی درد', 'درد خیلی زیاد', 'درد زیادی', 'درد وحشتناک', 'درد تیز',
    'تو استراحت', 'در استراحت', 'موقع استراحت', 'حتی استراحت', 'وقتی استراحت', 'بدون حرکت', 'شبها درد', 'شب درد', 'شبا درد', 'درد شب',
    'نمیتونم وزن', 'وزنم رو', 'نمیتونم راه', 'راه نمیتونم', 'لنگ', 'قفل شد', 'قفل میشه',
    'بی حس', 'بیحس', 'سر شده', 'گز گز',
    'قفسه سین', 'قفسه ی سین', 'درد سینه', 'سینه درد', 'سینم درد', 'تنگی نفس', 'نفسم بالا نمیاد', 'نفس کم میارم شدید',
    'غش', 'بیهوش', 'از هوش', 'سرگیجه',
    'درد نقطه ای', 'روی استخوان', 'شکستگی',
    /ن(می)?(تونست?م|تونه|تونست) (راه|وزن|بایست|پا)/
  ].map(function (w) { return typeof w === 'string' ? normalize(w) : w; });
  var PAIN = ['درد', 'دردمیکنه', 'دردناک', 'مصدوم', 'تیر میکشه', 'تیرمیکشه', 'کشیدگی', 'گرفتگی', 'شین اسپلینت', 'اسپلینت'].map(normalize);
  function hasAny(n, list) {
    var padded = ' ' + n + ' ';
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w instanceof RegExp) { var m = n.match(w); if (m) return m[0]; continue; }
      if (w.indexOf(' ') >= 0 ? n.indexOf(w) >= 0 : (padded.indexOf(' ' + w) >= 0)) return w;
    }
    return null;
  }

  // ---------- ساخت نمایه ----------
  function createIndex(kb, opts) {
    opts = opts || {};
    var entries = kb.entries.map(function (e) {
      var terms = {};
      function add(list, w) {
        list.forEach(function (t) { if (t && (!terms[t] || terms[t] < w)) terms[t] = w; });
      }
      (e.keywords || []).forEach(function (k) { add(tokens(k), 2); });
      add(tokens(e.q), 1);
      (e.phrases || []).forEach(function (p) { add(tokens(p), 1); });
      var phr = [e.q].concat(e.phrases || []).map(function (p) { return { n: normalize(p), g: trigrams(p), t: tokens(p) }; });
      return { e: e, terms: terms, phrases: phr };
    });
    // IDF: کلمه‌ی کمیاب مهم‌تر
    var df = {}, N = entries.length;
    entries.forEach(function (x) { Object.keys(x.terms).forEach(function (t) { df[t] = (df[t] || 0) + 1; }); });
    var idf = {};
    Object.keys(df).forEach(function (t) { idf[t] = Math.log(1 + N / df[t]); });
    // واژه‌های حوزه: کلیدواژه‌های مدخل‌ها + فهرست اضافه
    var domain = {};
    entries.forEach(function (x) { Object.keys(x.terms).forEach(function (t) { if (x.terms[t] >= 2) domain[t] = 1; }); });
    (kb.domainWords || []).forEach(function (w) { tokens(w).forEach(function (t) { domain[t] = 1; }); });
    return { kb: kb, entries: entries, idf: idf, vocab: Object.keys(idf), domain: Object.keys(domain), maxIdf: Math.log(1 + N), opts: opts };
  }

  function bestVocab(idx, t) {
    var best = 0, w = 0;
    for (var i = 0; i < idx.vocab.length; i++) {
      var s = wordSim(t, idx.vocab[i]);
      if (s > best || (s === best && s > 0 && idx.idf[idx.vocab[i]] > w)) { best = s; w = idx.idf[idx.vocab[i]]; }
    }
    return { sim: best, idf: w };
  }
  function inDomain(idx, qt) {
    for (var i = 0; i < qt.length; i++) {
      for (var j = 0; j < idx.domain.length; j++) if (wordSim(qt[i], idx.domain[j]) >= 0.75) return true;
    }
    return false;
  }

  function nearPhrase(idx, text) {
    var g = trigrams(text);
    return idx.entries.some(function (x) { return x.phrases.some(function (p) { return dice(g, p.g) >= 0.5; }); });
  }

  // امتیاز هر مدخل برای سؤال (۰ تا ۱)
  function scoreEntry(idx, x, qt, qg, qn, qw, qreal) {
    var num = 0, den = 0, anchor = false;
    for (var i = 0; i < qt.length; i++) {
      var t = qt[i], best = 0, bw = 0, floor = qreal[i] ? 0.85 : 0;
      for (var term in x.terms) {
        var s = wordSim(t, term);
        if (s > floor || (s && s === floor)) {
          var v = s * (x.terms[term] >= 2 ? 1 : 0.8) * (idx.idf[term] || 0);
          if (v > best) { best = v; bw = idx.idf[term]; }
          // لنگر: کلیدواژه‌ی مدخل، دقیق یا با بُن؛ غلط املایی فقط در کلمه‌های بلند (۶ حرف به بالا)
          if (x.terms[term] >= 2 && (s >= 0.85 || (t.length >= 6 && term.length >= 6))) anchor = true;
        }
      }
      num += best;
      den += qw[i];
    }
    var tok = den ? Math.min(1, num / den) : 0;
    var ph = 0;
    for (var k = 0; k < x.phrases.length; k++) {
      var p = x.phrases[k];
      var d = p.n && qn.indexOf(p.n) >= 0 ? 1 : dice(qg, p.g);
      // عبارت چندکلمه‌ای که همه‌ی کلمه‌هاش در سؤال هست
      if (p.t.length >= 2) {
        var hit = 0;
        for (var a = 0; a < p.t.length; a++) for (var b = 0; b < qt.length; b++) if (wordSim(p.t[a], qt[b]) >= 0.85) { hit++; break; }
        d = Math.max(d, 0.9 * hit / p.t.length * (hit === p.t.length ? 1 : 0.8));
        if (hit === p.t.length) anchor = true;
      }
      if (d === 1) anchor = true;
      if (d > ph) ph = d;
    }
    return { s: 0.65 * tok + 0.35 * ph, anchor: anchor };
  }

  var T_ANSWER = 0.5, T_MARGIN = 0.07, T_SUGGEST = 0.3;

  function visibleEntry(e, ctx) {
    if (e.audience === 'cycle' && !(ctx && ctx.cycle)) return false;
    return true;
  }

  // پر کردن جای داده‌ی کاربر؛ نبودش = متن عمومی
  function fill(e, ctx) {
    var walk = ctx && ctx.walk && e.answerWalk;
    var a = walk ? e.answerWalk : e.answer;
    if (e.personal) {
      var v = ctx && ctx[e.personal];
      if (v) a = a.replace('{' + e.personal + '}', v);
      else a = (walk && e.fallbackWalk) || e.fallback || a.replace(/[^.؛]*\{[a-zA-Z]+\}[^.؛]*[.؛]?/g, '').trim();
    }
    return a;
  }
  function linksFor(e, ctx) {
    return (ctx && ctx.walk && e.linksWalk) || e.links || [];
  }

  // پرسش: نتیجه‌ی ساختاریافته برای رابط کاربری و آزمون
  // kind: answer | pending | suggest | none | ood | urgent | empty
  function ask(idx, text, ctx) {
    var kb = idx.kb, n = normalize(text);
    var qtAll = tokens(text, true), qt = tokens(text);
    if (!qtAll.length) return { kind: 'empty' };
    // ۱. ایمنی، قبل از هر چیز
    var u = hasAny(n, URGENT);
    if (u) return { kind: 'urgent', answer: kb.texts.urgent, links: kb.urgentLinks, safety: 'urgent', matched: u };
    if (!qt.length) return { kind: 'none', answer: kb.texts.none, suggestions: [] };
    // ۲. خارج از حوزه
    var pain = hasAny(n, PAIN);
    if (!pain && !inDomain(idx, qt) && !nearPhrase(idx, text)) return { kind: 'ood', answer: kb.texts.ood };
    // ۳. جست‌وجو
    var qreal = [], qg = trigrams(text), qw = qt.map(function (t, i) {
      var b = bestVocab(idx, t);
      qreal[i] = b.sim >= 0.85; // کلمه‌ی درست و شناخته: شباهت املایی با کلمه‌ی دیگه حساب نمی‌شه («کفشی» ≠ «کششی»)
      return b.sim >= 0.75 ? b.idf : idx.maxIdf * 0.5; // کلمه‌ی ناشناخته هم وزن داره تا با یک کلمه‌ی مشترک جواب قطعی ندیم
    });
    var ranked = idx.entries.filter(function (x) { return visibleEntry(x.e, ctx); }).map(function (x) {
      var sc = scoreEntry(idx, x, qt, qg, n, qw, qreal);
      return { x: x, s: sc.s, anchor: sc.anchor };
    }).sort(function (a, b) { return b.s - a.s; });
    // درد: فقط مدخل‌های ایمنی‌دار؛ اگه هیچ‌کدوم روشن نبود، پاسخ محتاطانه‌ی عمومی درد
    if (pain) {
      var safe = ranked.filter(function (r) { return r.x.e.safety && r.x.e.safety !== 'none'; });
      var top = safe[0] && safe[0].anchor && safe[0].s >= T_ANSWER && (!safe[1] || safe[0].s - safe[1].s >= T_MARGIN) ? safe[0].x.e : kb.entries.filter(function (e) { return e.id === kb.painEntry; })[0];
      return result(top, safe[0] && safe[0].x.e === top ? safe[0].s : null, ctx);
    }
    var r1 = ranked[0], r2 = ranked[1];
    if (r1 && r1.anchor && r1.s >= T_ANSWER && (!r2 || r1.s - r2.s >= T_MARGIN || r1.x.e.topic === r2.x.e.topic && r1.s - r2.s >= T_MARGIN / 2)) return result(r1.x.e, r1.s, ctx);
    var sug = ranked.filter(function (r) { return r.s >= T_SUGGEST; }).slice(0, 3).map(function (r) { return { id: r.x.e.id, q: r.x.e.q, score: round(r.s) }; });
    if (sug.length) return { kind: 'suggest', answer: kb.texts.suggest, suggestions: sug, score: round(r1.s) };
    return { kind: 'none', answer: kb.texts.none, suggestions: [], score: r1 ? round(r1.s) : 0 };
  }
  function round(x) { return Math.round(x * 1000) / 1000; }
  function result(e, s, ctx) {
    if (e.status === 'pending') return { kind: 'pending', id: e.id, entry: e, answer: e.pendingText || '', topic: e.topic, score: s == null ? null : round(s) };
    return { kind: 'answer', id: e.id, entry: e, answer: fill(e, ctx), links: linksFor(e, ctx), safety: e.safety || 'none', score: s == null ? null : round(s) };
  }
  // نمایش مستقیم یک مدخل (وقتی کاربر یکی از پیشنهادها رو می‌زنه)
  function byId(idx, id, ctx) {
    var x = idx.entries.filter(function (y) { return y.e.id === id; })[0];
    return x ? result(x.e, null, ctx) : null;
  }

  return {
    normalize: normalize, tokens: tokens, stem: stem, wordSim: wordSim,
    createIndex: createIndex, ask: ask, byId: byId,
    THRESHOLDS: { answer: T_ANSWER, margin: T_MARGIN, suggest: T_SUGGEST }
  };
});
