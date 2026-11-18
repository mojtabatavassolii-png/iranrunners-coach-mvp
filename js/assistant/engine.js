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
      .replace(/\s+/g, ' ').trim()
      .replace(/(^| )80 (به |تا )?20( |$)/g, '$1هشتاد بیست$3')
      .replace(/(^| )180( |$)/g, '$1صدوهشتاد$2');                 // «۸۰/۲۰»: عدد تنها حذف می‌شه، پس به کلمه
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
   'میتونم میتونه نمیتونم تونم کردم کرد کرده شد شده شدم میشد دیگه خیلی کمی ای ولی اما فقط انجام اصلا اصن').split(' ').forEach(function (w) { if (w) STOP[normalize(w)] = 1; });

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
    if (last === 'م' && t.length >= 4) return t.slice(0, -1);
    if (last === 'ت' && t.length >= 5) return t.slice(0, -1); // «گوشت» و «پوست» بُن نیستن
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
  var SHORT_SUFFIX = {};
  ['م', 'ت', 'ش', 'ی', 'و', 'ها', 'های', 'رو', 'مو', 'تو', 'شو', 'ام', 'ات', 'اش', 'یم', 'ید', 'ن', 'تر', 'ترین'].forEach(function (x) { SHORT_SUFFIX[x] = 1; });
  function wordSim(a, b) {
    if (a === b) return 1;
    var la = a.length, lb = b.length, m = Math.min(la, lb);
    if (m >= 3 && Math.abs(la - lb) <= 3 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) {
      // کلمه‌ی سه‌حرفی فقط با پسوند واقعی: «ساقم» = «ساق»، ولی «آهنگ» ≠ «آهن»
      if (m > 3 || SHORT_SUFFIX[(la > lb ? a : b).slice(3)]) return 0.85;
    }
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
    'صدای تق', 'تق صدا', 'پارگی', 'یهو تیر کشید',
    'گرمازدگی', 'گرمازده', 'گرما زده', 'گرما زدگی', 'از حال رفت',
    // سرما و ارتفاع
    'سرمازدگی', 'سرمازده', 'سرما زده', 'سرما زدگی', 'یخ زدگی', 'یخزدگی', 'هیپوترمی', 'لرز شدید', 'لرزم بند نمیاد',
    /(ارتفاع|کوه|قله|دماوند).*(سردرد شدید|گیج|تعادل|نفسم بند|تهوع|بالا اوردم)|(سردرد شدید|گیج|تعادل|تهوع|بالا اوردم).*(ارتفاع|کوه|قله|دماوند)/,
    // بارداری: خونریزی، آبریزش، انقباض یا کم شدن حرکت جنین
    'کیسه آب', 'کیسه ابم', 'خونریزی شدید', 'حرکت جنین', 'جنین تکون', 'بچه تکون نمیخوره', 'بچم تکون',
    /(باردار|حامله|جنین|بارداری).*(خونریزی|آبریزش|ابریزش|انقباض|لکه بینی|درد شکم|درد زیر شکم)|(خونریزی|آبریزش|ابریزش|انقباض|لکه بینی|درد زیر شکم).*(باردار|حامله|بارداری)/,
    // گرما + نشونه (گیجی، تهوع، حال بد) در یک جمله
    /گرما.*(گیج|تهوع|حالت تهوع|حالم بد|بالا اوردم)|(گیج|تهوع|حالم بد|بالا اوردم).*گرما/,
    /ن(می)?(تونست?م|تونه|تونست) (راه|وزن|بایست|پا)/,
    /ن(می)?تون(ست)?م (رو |روی )?(پا|پنجه)/,
    /ن(می)?تون(ست)?م (وایس|بایست|بایس)/
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
      // کلیدواژه‌ی چندکلمه‌ای («زانوی دونده») مثل عبارت حساب می‌شه، نه چند کلیدواژه‌ی جدا («دونده» تنها لنگر نیست)
      var multi = [];
      (e.keywords || []).forEach(function (k) { var t = tokens(k); if (t.length > 1) { add(t, 1); multi.push(k); } else add(t, 2); });
      add(tokens(e.q), 1);
      (e.phrases || []).forEach(function (p) { add(tokens(p), 1); });
      var phr = [e.q].concat(e.phrases || [], multi).map(function (p) { return { n: normalize(p), g: trigrams(p), t: tokens(p) }; });
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
      for (var j = 0; j < idx.domain.length; j++) {
        var sm = wordSim(qt[i], idx.domain[j]);
        // غلط املایی فقط در کلمه‌های بلند؛ «گوشی» نباید «گوشت» حساب بشه
        if (sm >= 0.85 || (sm >= 0.6 && qt[i].length >= 6 && idx.domain[j].length >= 6)) return true;
      }
    }
    return false;
  }

  function nearPhrase(idx, text) {
    var g = trigrams(text);
    return idx.entries.some(function (x) { return x.phrases.some(function (p) { return dice(g, p.g) >= 0.5; }); });
  }

  // امتیاز هر مدخل برای سؤال (۰ تا ۱)
  function scoreEntry(idx, x, qt, qg, qn, qw, qreal) {
    var num = 0, den = 0, anchor = false, word = false;
    for (var i = 0; i < qt.length; i++) {
      var t = qt[i], best = 0, bw = 0, floor = qreal[i] ? 0.85 : 0;
      for (var term in x.terms) {
        var s = wordSim(t, term);
        if (s > floor || (s && s === floor)) {
          var v = s * (x.terms[term] >= 2 ? 1 : 0.8) * (idx.idf[term] || 0);
          if (v > best) { best = v; bw = idx.idf[term]; }
          if (s >= 0.85 && x.terms[term] >= 2) word = true; // کلیدواژه‌ی مدخل، نه کلمه‌ی عمومی مثل «دویدن»
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
    return { s: 0.65 * tok + 0.35 * ph, anchor: anchor, word: word };
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

  // ---------- سلام و احوال‌پرسی ----------
  // ترتیب مهمه: اولین نوعی که پیدا بشه جواب داده می‌شه
  var SMALL = [
    ['who', ['تو کی هستی', 'کی هستی', 'اسمت چیه', 'تو چی هستی', 'رباتی', 'ربات هستی', 'هوش مصنوعی هستی', 'ادمی', 'آدمی']],
    ['how', ['خوبی', 'خوبین', 'خوب هستی', 'چطوری', 'چطورین', 'حالت چطوره', 'حالت خوبه', 'احوالت', 'چه خبر', 'چخبر', 'خسته نباشی', 'خسته نباشید']],
    ['thanks', ['مرسی', 'ممنون', 'ممنونم', 'سپاس', 'سپاسگزارم', 'تشکر', 'دمت گرم', 'دستت درد نکنه', 'مچکرم', 'متشکرم', 'عالی بود', 'مرسی ازت']],
    ['bye', ['خداحافظ', 'خدافظ', 'خدانگهدار', 'بای', 'بدرود', 'شب خوش', 'شب بخیر', 'فعلا']],
    ['hello', ['سلام', 'سلام علیکم', 'سلامم', 'درود', 'هلو', 'صبح بخیر', 'ظهر بخیر', 'عصر بخیر', 'وقت بخیر', 'روز بخیر', 'صبحت بخیر']]
  ].map(function (g) { return [g[0], g[1].map(normalize).sort(function (a, b) { return b.length - a.length; })]; });
  function smallTalk(n) {
    var found = [], rest = ' ' + n + ' ';
    SMALL.forEach(function (g) {
      g[1].forEach(function (w) {
        var re = new RegExp('(^| )' + w + '(?= |$)', 'g');
        if (re.test(rest)) { if (found.indexOf(g[0]) < 0) found.push(g[0]); rest = rest.replace(re, ' '); }
      });
    });
    return { kinds: found, rest: rest.replace(/\s+/g, ' ').trim() };
  }
  function smallReply(kb, kind, ctx) {
    var t = kb.smallTalk[kind], name = ctx && ctx.name ? ' ' + ctx.name : '';
    var a = t.text.replace('{name}', name);
    if (kind === 'hello' && ctx && ctx.today && t.today) a += ' ' + t.today.replace('{today}', ctx.today);
    return { kind: 'small', small: kind, answer: a, links: t.links || [], suggestions: kind === 'hello' || kind === 'how' ? popular(kb, ctx, []) : [] };
  }
  // پیشنهادهای پرکاربرد وقتی جواب نداریم (پیاده‌روی جدا)
  function popular(kb, ctx, skip) {
    var ids = (ctx && ctx.walk ? kb.popularWalk : kb.popular) || [];
    return ids.filter(function (id) { return skip.indexOf(id) < 0; }).map(function (id) {
      var e = kb.entries.filter(function (x) { return x.id === id; })[0];
      return e ? { id: e.id, q: e.q } : null;
    }).filter(Boolean);
  }

  // پرسش: نتیجه‌ی ساختاریافته برای رابط کاربری و آزمون
  // kind: answer | pending | suggest | none | ood | urgent | small | empty
  function ask(idx, text, ctx) {
    var n0 = normalize(text);
    if (!n0) return { kind: 'empty' };
    // ایمنی همیشه اول، حتی وسط سلام و احوال‌پرسی
    var u = hasAny(n0, URGENT);
    if (u) return urgentResult(idx.kb, u, ctx);
    var st = smallTalk(n0);
    if (st.kinds.length) {
      if (!tokens(st.rest).length) return smallReply(idx.kb, st.kinds[0], ctx);
      var r = askWalk(idx, st.rest, ctx);
      // سلام جدا از متن پاسخ، تا اسم کاربر هیچ‌وقت در سؤال ذخیره‌شده برای تیم نره
      if (st.kinds.indexOf('hello') >= 0 && r.kind !== 'urgent') r.greet = idx.kb.smallTalk.prefix.replace('{name}', ctx && ctx.name ? ' ' + ctx.name : '');
      return r;
    }
    return askWalk(idx, text, ctx);
  }
  // «پیاده‌روی» جای «دویدن»: اگه جواب روشنی پیدا نشد، با «دویدن» هم می‌گردیم
  // (مدخل‌ها با کلمه‌ی دویدن نوشته شدن؛ نسخه‌ی پیاده‌روی پاسخ با ctx.walk انتخاب می‌شه)
  var WALK_RE = /پیاده[\u200c ]?(روی|روی‌ها)|راه رفتن|راه برم|راه میرم/g;
  function askWalk(idx, text, ctx) {
    var r = askCore(idx, text, ctx);
    if ((r.kind !== 'suggest' && r.kind !== 'none') || !WALK_RE.test(text)) return r;
    WALK_RE.lastIndex = 0;
    var r2 = askCore(idx, text.replace(WALK_RE, 'دویدن'), ctx);
    WALK_RE.lastIndex = 0;
    return r2.kind === 'answer' || r2.kind === 'intake' || r2.kind === 'urgent' ? r2 : r;
  }
  function askCore(idx, text, ctx) {
    var kb = idx.kb, n = normalize(text);
    var qtAll = tokens(text, true), qt = tokens(text);
    if (!qtAll.length) return { kind: 'empty' };
    // ۱. ایمنی، قبل از هر چیز
    var u = hasAny(n, URGENT);
    if (u) return urgentResult(kb, u, ctx);
    if (!qt.length) return { kind: 'none', answer: kb.texts.none, suggestions: popular(kb, ctx, []) };
    // ۲. خارج از حوزه
    // «به درد می‌خوره» یعنی «مفیده»، نه درد
    var pain = hasAny(n.replace(/(^| )ب(ه )?درد(م|ت|ش)? ?(ن?می)?(خوره|خورن|بخوره)/g, ' '), PAIN);
    if (!pain && !inDomain(idx, qt) && !nearPhrase(idx, text)) return { kind: 'ood', answer: kb.texts.ood, suggestions: popular(kb, ctx, []) };
    // ۳. جست‌وجو
    var qreal = [], qg = trigrams(text), qw = qt.map(function (t, i) {
      var b = bestVocab(idx, t);
      qreal[i] = b.sim >= 0.85; // کلمه‌ی درست و شناخته: شباهت املایی با کلمه‌ی دیگه حساب نمی‌شه («کفشی» ≠ «کششی»)
      return b.sim >= 0.75 ? b.idf : idx.maxIdf * 0.5; // کلمه‌ی ناشناخته هم وزن داره تا با یک کلمه‌ی مشترک جواب قطعی ندیم
    });
    var ranked = idx.entries.filter(function (x) { return visibleEntry(x.e, ctx); }).map(function (x) {
      var sc = scoreEntry(idx, x, qt, qg, n, qw, qreal);
      return { x: x, s: sc.s, anchor: sc.anchor, word: sc.word };
    }).sort(function (a, b) { return b.s - a.s; });
    // درد: فقط مدخل‌های ایمنی‌دار؛ اگه هیچ‌کدوم روشن نبود، پاسخ محتاطانه‌ی عمومی درد
    if (pain) {
      // مدخل منتظر تأیید هیچ‌وقت جای پاسخ محتاطانه‌ی درد رو نمی‌گیره
      var safe = ranked.filter(function (r) { return r.x.e.safety && r.x.e.safety !== 'none' && r.x.e.status !== 'pending'; });
      var top = safe[0] && safe[0].anchor && safe[0].s >= T_ANSWER && (!safe[1] || safe[0].s - safe[1].s >= T_MARGIN) ? safe[0].x.e : kb.entries.filter(function (e) { return e.id === kb.painEntry; })[0];
      // کاربر از درد خودش می‌گه: اول سؤال‌های معاینه (کجا، چطور، چند وقته، نشونه‌های هشدار)
      if (kb.intake && !(ctx && ctx.noIntake) && INTAKE_ENTRIES.indexOf(top.id) >= 0 && personalPain(n)) return intakeStart(idx, n, ctx);
      return result(top, safe[0] && safe[0].x.e === top ? safe[0].s : null, ctx);
    }
    if (ctx && ctx.debug) ctx.debug.ranked = ranked.slice(0, 5).map(function (r) { return [r.x.e.id, round(r.s), r.anchor]; }); // فقط برای آزمون
    var r1 = ranked[0], r2 = ranked[1];
    if (r1 && r1.anchor && r1.s >= T_ANSWER && (!r2 || r1.s - r2.s >= T_MARGIN || r1.x.e.topic === r2.x.e.topic && r1.s - r2.s >= T_MARGIN / 2)) return result(r1.x.e, r1.s, ctx);
    // پیشنهاد فقط مدخل‌هایی که جواب دارن
    // و دست‌کم یک کلمه‌ی واقعاً مشترک («آهنگ» به «آهن» پیشنهاد نمی‌ده)
    var sug = ranked.filter(function (r) { return r.s >= T_SUGGEST && r.word && r.x.e.status !== 'pending'; }).slice(0, 3).map(function (r) { return { id: r.x.e.id, q: r.x.e.q, score: round(r.s) }; });
    if (sug.length) return { kind: 'suggest', answer: kb.texts.suggest, suggestions: sug, score: round(r1.s) };
    // بی‌جواب: نزدیک‌ترین‌ها (حتی ضعیف) و بعد پرکاربردها، تا کاربر دست‌خالی نمونه
    var near = ranked.filter(function (r) { return r.s >= T_SUGGEST * 0.6 && r.word && r.x.e.status !== 'pending'; }).slice(0, 2).map(function (r) { return { id: r.x.e.id, q: r.x.e.q }; });
    var more = popular(kb, ctx, near.map(function (x) { return x.id; }));
    return { kind: 'none', answer: kb.texts.none, suggestions: near.concat(more).slice(0, 3), score: r1 ? round(r1.s) : 0 };
  }
  function round(x) { return Math.round(x * 1000) / 1000; }
  function result(e, s, ctx) {
    if (e.status === 'pending') return { kind: 'pending', id: e.id, entry: e, answer: e.pendingText || '', topic: e.topic, score: s == null ? null : round(s) };
    var nx = (ctx && ctx.walk && e.nextWalk) || e.next || null;
    // منبع نسخه‌ی پیاده‌روی، اگه منبع جدا داره
    var src = (ctx && ctx.walk && e.answerWalk && e.sourcesWalk) || e.sources || null;
    return { kind: 'answer', id: e.id, entry: e, answer: fill(e, ctx), links: linksFor(e, ctx), next: nx, sources: src, safety: e.safety || 'none', score: s == null ? null : round(s) };
  }
  // ---------- گفت‌وگوی درد ----------
  var INTAKE_ENTRIES = ['pain-general', 'shin-pain', 'knee-front', 'knee-outer', 'achilles', 'heel-pain'];
  var STEPS = ['region', 'onset', 'duration', 'flags'];
  function personalPain(n) {
    // «ساقم درد میکنه»، «پاشنه‌ام صبح‌ها درد میکنه»، «درد دارم»: گزارش درد خود کاربر، حتی اگه آخرش «چیه؟» داشته باشه
    if (/دردم|درد دارم|درد داشتم|مصدوم شدم|اسیب دیدم|[^ ]م( [^ ]+){0,3} (درد|تیر)/.test(n)) return true;
    if (/چیه|یعنی چی|پیشگیری|جلوگیری|چطوری? (درمان|خوب)/.test(n)) return false;
    return /دارم|داره|داشتم|داشت|میکنه|میکرد|کرده|گرفته|گرفت|میگیره|میکشه|دردم|م درد|مصدوم شدم|اسیب دیدم/.test(n);
  }
  function detectRegion(n) {
    if (/(بیرون|کنار)(ی)? ?زانو|itb|ایلیوتیبیال|(ا|ای) ?تی ?بی/.test(n)) return 'knee-outer';
    if (/کشکک|جلو(ی)? ?زانو/.test(n)) return 'knee-front';
    if (/زانو/.test(n)) return 'knee';
    if (/اشیل|پشت (ی )?پاشن/.test(n)) return 'achilles';
    if (/کف (ی )?پا|پاشن|پلانتار/.test(n)) return 'heel';
    if (/ساق|شین|اسپلینت/.test(n)) return 'shin';
    if (/(^| )(ران|همسترینگ|باسن|کمر|لگن|کشاله|مچ|پهلو|شونه|شانه|گردن|انگشت)/.test(n)) return 'other';
    return null;
  }
  function opt(kb, list, v) {
    var all = kb.intake.region.options.concat(kb.intake.knee.options.filter(function (o) { return typeof o === 'object'; }), kb.intake.onset.options, kb.intake.duration.options, kb.intake.flags.options);
    return all.filter(function (o) { return o.v === v; })[0] || null;
  }
  function stepOptions(kb, step) {
    var I = kb.intake;
    if (step === 'knee') return I.knee.options.map(function (o) { return typeof o === 'string' ? opt(kb, null, o) : o; });
    return I[step].options;
  }
  function question(idx, st, lead, ctx) {
    var I = idx.kb.intake, q = (ctx && ctx.walk && I[st.step].qWalk) || I[st.step].q;
    return { kind: 'intake', answer: (lead ? lead + ' ' : '') + q, options: stepOptions(idx.kb, st.step).map(function (o) { return { v: o.v, label: o.label }; }),
      state: st, safety: st.step === 'flags' ? 'caution' : 'none' };
  }
  function urgentResult(kb, why, ctx) { return { kind: 'urgent', answer: (ctx && ctx.walk && kb.texts.urgentWalk) || kb.texts.urgent, links: kb.urgentLinks, safety: 'urgent', matched: why }; }
  // قدم بعدی؛ چیزی که کاربر از قبل گفته دوباره پرسیده نمی‌شه
  function nextStep(st) {
    if (!st.region) return 'region';
    if (st.region === 'knee') return 'knee';
    for (var i = 1; i < STEPS.length; i++) if (!st[STEPS[i]]) return STEPS[i];
    return null;
  }
  function parseOnset(n) {
    return /یهو|ناگهان|ضربه|پیچ|تق|زمین خوردم|افتادم/.test(n) ? 'sudden' : /حجم|سرعت|بیشتر کردم|زیاد کردم|اضافه کردم/.test(n) ? 'load' : /کم ?کم|تدریجی|ا?روم ا?روم/.test(n) ? 'gradual' : null;
  }
  function intakeStart(idx, n, ctx) {
    var st = { region: detectRegion(n) || undefined, onset: parseOnset(n) || undefined, duration: parseDuration(n) || undefined };
    if (st.onset === 'sudden') return urgentResult(idx.kb, 'intake:onset', ctx);
    st.step = nextStep(st);
    return question(idx, st, idx.kb.intake.start, ctx);
  }
  // «رد شدن»: با همون چیزی که تا حالا گفته جواب می‌ده
  function intakeSkip(idx, state, ctx) { return intakeFinal(idx, JSON.parse(JSON.stringify(state || {})), ctx); }
  // جواب یکی از گزینه‌ها
  function intake(idx, state, v, ctx) {
    var kb = idx.kb, st = JSON.parse(JSON.stringify(state || {})), o = opt(kb, null, v);
    if (!o || stepOptions(kb, st.step).indexOf(o) < 0) return null;
    if (o.urgent) return urgentResult(kb, 'intake:' + st.step, ctx);
    if (st.step === 'region' || st.step === 'knee') st.region = v;
    else st[st.step] = v;
    st.step = nextStep(st);
    return st.step ? question(idx, st, null, ctx) : intakeFinal(idx, st, ctx);
  }
  var NUMW = { 'یک': 1, 'یه': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'ده': 10, 'چند': 3 };
  function parseDuration(n) {
    if (/امروز|دیروز|دیشب|همین الان|تازه/.test(n)) return 'lt3';
    var m = /(?:^| )(?:(\d+|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|ده|چند) ?)?(روز|هفته|ماه|سال)(?:ه|هست|ست|ی|ه که)?(?= |$)/.exec(n);
    if (!m) return null;
    var k = m[1] ? (/\d/.test(m[1]) ? +m[1] : NUMW[m[1]]) : 1, days = k * { 'روز': 1, 'هفته': 7, 'ماه': 30, 'سال': 365 }[m[2]];
    return days < 3 ? 'lt3' : days <= 14 ? 'lt14' : 'gt14';
  }
  // جواب نوشتاری وسط گفت‌وگو؛ اگه فهمیده نشد null (رابط اون رو سؤال تازه حساب می‌کنه)
  function intakeText(idx, state, text, ctx) {
    var kb = idx.kb, n = normalize(text);
    if (!n) return null;
    var u = hasAny(n, URGENT);
    if (u) return urgentResult(kb, u, ctx);
    var st = JSON.parse(JSON.stringify(state || {})), v = null;
    if (st.step === 'region') { v = detectRegion(n); if (v === 'knee') return question(idx, { step: 'knee', region: 'knee' }, null, ctx); }
    else if (st.step === 'knee') v = /بیرون|کنار/.test(n) ? 'knee-outer' : /جلو|کشکک/.test(n) ? 'knee-front' : /نمیدونم|جای دیگه|پشت|داخل|پشتش|توش/.test(n) ? 'knee-other' : null;
    else if (st.step === 'onset') v = parseOnset(n) || (/نمیدونم|یادم نیست|مطمئن نیستم/.test(n) ? 'unknown' : null);
    else if (st.step === 'duration') v = parseDuration(n);
    else if (st.step === 'flags') v = /^(نه|نخیر|هیچ ?کدوم|ندارم|نه ندارم)( |$)/.test(n) ? 'no' : /^(اره|بله|اوهوم|دارم|یکیش|اره دارم)( |$)/.test(n) ? 'yes' : null;
    return v ? intake(idx, st, v, ctx) : null;
  }
  function intakeFinal(idx, st, ctx) {
    var kb = idx.kb, I = kb.intake, reg = opt(kb, null, st.region) || opt(kb, null, 'other');
    var e = kb.entries.filter(function (x) { return x.id === reg.entry; })[0];
    // مدخل منتظر تأیید هیچ‌وقت جای پاسخ محتاطانه‌ی درد رو نمی‌گیره
    if (!e || e.status === 'pending') { e = kb.entries.filter(function (x) { return x.id === kb.painEntry; })[0]; reg = { say: reg.say }; }
    var r = result(e, null, ctx);
    var parts = [I.painWord + (reg.say ? ' ' + reg.say : '')];
    ['onset', 'duration'].forEach(function (k) { var o = opt(kb, null, st[k]); if (o && o.say) parts.push(o.say); });
    var extra = [];
    if (st.onset === 'load') extra.push(I.load);
    if (st.duration === 'gt14') extra.push(I.long);
    if (!st.flags) extra.push((ctx && ctx.walk && I.flagsNoteWalk) || I.flagsNote);
    r.answer = (parts.length > 1 || reg.say ? I.summary.replace('{parts}', parts.join('، ')) + ' ' : '') + r.answer + (extra.length ? ' ' + extra.join(' ') : '');
    if (!(r.links || []).some(function (l) { return l.page === I.checkin.page; })) r.links = [I.checkin].concat(r.links || []);
    r.intake = { region: st.region, onset: st.onset, duration: st.duration };
    if (st.duration === 'gt14' && r.safety === 'none') r.safety = 'caution';
    return r;
  }

  // نمایش مستقیم یک مدخل (وقتی کاربر یکی از پیشنهادها رو می‌زنه)
  function byId(idx, id, ctx) {
    var x = idx.entries.filter(function (y) { return y.e.id === id; })[0];
    return x ? result(x.e, null, ctx) : null;
  }

  return {
    normalize: normalize, tokens: tokens, stem: stem, wordSim: wordSim,
    createIndex: createIndex, ask: ask, byId: byId, intake: intake, intakeText: intakeText, intakeSkip: intakeSkip,
    THRESHOLDS: { answer: T_ANSWER, margin: T_MARGIN, suggest: T_SUGGEST }
  };
});
