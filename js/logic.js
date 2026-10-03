/*
 * مربی خودت باش (MVP)
 * موتور قوانین ساخت برنامه. همه‌ی منطق قوانین ثابت است (if/else و جدول تصمیم)،
 * بدون هیچ اتصال به API یا سرویس خارجی.
 *
 * قوانین اصلی:
 *  - سطح (۱ تا ۱۰) از روی حجم فعلی، سابقه، رکورد (VDOT دنیلز) و تجربه‌ی تمرین ساختاریافته محاسبه می‌شه.
 *  - سطح نوع و پیچیدگی تمرین رو تعیین می‌کنه؛ حجم هفته‌ی اول = حجم فعلی کاربر.
 *  - قانون ۱۰٪: از هفته‌ی دوم، حجم هر هفته حداکثر ۱۰٪ بیشتر از آخرین هفته‌ی کامل.
 *    هر هفته‌ی چهارم «هفته‌ی ریکاوری» با ۸۰٪ حجم است.
 *  - نسبت ۸۰/۲۰ (سطح ۳ به بالا): بخش پرشدت حداکثر ۲۰٪ حجم هفته.
 *  - هیچ دو روز سختی (تمپو، اینتروال، تکرار، فارتلک، لانگ‌ران، مسابقه) پشت‌سرهم نیست.
 *  - تیپر: ۱ هفته قبل از ۵ و ۱۰ کیلومتر، ۲ هفته قبل از نیمه‌ماراتن و ماراتن.
 */
(function (root) {
  'use strict';

  // همه‌ی متن‌ها از دیکشنری ترجمه (js/i18n/*.js)
  var I18N = typeof module !== 'undefined' && module.exports ? require('./i18n.js') : root.CoachI18n;
  var T = I18N.t;
  // شیئی که مقدار هر کلیدش هنگام خوندن از زبان فعلی ترجمه می‌شه
  function i18nMap(keys, prefix, sub) {
    var o = {};
    keys.forEach(function (k) {
      Object.defineProperty(o, k, { enumerable: true, get: function () { return T(prefix + '.' + k + (sub ? '.' + sub : '')); } });
    });
    return o;
  }

  // ---------- تاریخ (همه‌چیز با تاریخ محلی، بدون UTC) ----------
  // روز شروع هفته قابل تنظیمه (روز هفته‌ی JS: ۶=شنبه پیش‌فرض، ۱=دوشنبه، ۰=یکشنبه).
  // ایندکس روز داخل هفته نسبت به همین شروع حساب می‌شه؛ آخرین روز هفته = روز لانگ‌ران.
  // روزهای آزاد کاربر (profile.days) همیشه با مبنای شنبه ذخیره می‌شن (۰=شنبه ... ۶=جمعه).
  var WEEK_START = 6;
  function setWeekStart(js) { if (js >= 0 && js <= 6) WEEK_START = js; }
  function getWeekStart() { return WEEK_START; }
  function satToRel(satIdx) { return ((satIdx + 6) % 7 - WEEK_START + 7) % 7; }
  function relToSat(rel) { return ((rel + WEEK_START) % 7 + 1) % 7; }
  function weekOrder() { var o = []; for (var r = 0; r < 7; r++) o.push(relToSat(r)); return o; }
  function dayNames() { return T('days'); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) {
    var p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function persianDayIndex(d) { return (d.getDay() - WEEK_START + 7) % 7; }
  function weekStart(d) { return addDays(d, -persianDayIndex(d)); }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }

  // ---------- ابزار ----------
  function round05(x) { return Math.round(x * 2) / 2; }
  function floor05(x) { return Math.floor(x * 2 + 1e-9) / 2; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function hms(h, m) { return (h * 60 + m) * 60; }

  // زمان → ثانیه. قالب‌های قابل قبول (برای کیبورد عددی موبایل که «:» نداره):
  //  «9:40»، «1:25:30»، «9.40»، «9 40»، فقط رقم: «940» / «1940» (دقیقه‌ثانیه)، «12530» / «012530» (ساعت‌دقیقه‌ثانیه)
  //  رقم‌های فارسی (۰-۹) و عربی (٠-٩) هم پذیرفته می‌شن.
  function parseTime(str) {
    if (str == null) return null;
    var s = String(str)
      .replace(/[۰-۹]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); })
      .replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); })
      .trim()
      .replace(/[\s.,٫٬،'"’\/\-]+/g, ':')
      .replace(/^:+|:+$/g, '');
    var p;
    if (/^\d+$/.test(s)) {
      if (s.length < 3 || s.length > 6) return null;
      p = s.length <= 4 ? [s.slice(0, -2), s.slice(-2)] : [s.slice(0, -4), s.slice(-4, -2), s.slice(-2)];
    } else if (/^\d{1,3}(:\d{1,2}){1,2}$/.test(s)) {
      p = s.split(':');
    } else return null;
    p = p.map(Number);
    if (p[p.length - 1] >= 60 || (p.length === 3 && p[1] >= 60)) return null;
    var sec = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
    return sec > 0 ? sec : null;
  }
  // نمایش خوانا برای تأیید ورودی: «۹ دقیقه و ۴۰ ثانیه»
  function describeDuration(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = Math.round(sec % 60);
    var parts = [];
    if (h) parts.push(T('dur.h', { n: h }));
    if (m) parts.push(T('dur.m', { n: m }));
    if (x) parts.push(T('dur.s', { n: x }));
    return parts.join(T('dur.join'));
  }
  function formatDuration(sec) {
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s);
  }

  // ---------- VDOT (فرمول Daniels–Gilbert، مبنای جدول‌های جک دنیلز) ----------
  function vo2AtVelocity(v) { return -4.60 + 0.182258 * v + 0.000104 * v * v; } // v: متر بر دقیقه
  function velocityAtVo2(vo2) {
    var a = 0.000104, b = 0.182258, c = -4.60 - vo2;
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  }
  function vdotFromRace(distKm, timeSec) {
    var t = timeSec / 60, v = distKm * 1000 / t;
    var pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
    return vo2AtVelocity(v) / pct;
  }
  // زمان معادل برای یک فاصله با VDOT مشخص (دوبخشی؛ VDOT با زمان کم می‌شه)
  function raceTimeFromVdot(vdot, distKm) {
    var lo = distKm * 90, hi = distKm * 1200;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (vdotFromRace(distKm, mid) > vdot) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function paceAtPct(vdot, pct) { return 60000 / velocityAtVo2(vdot * pct); } // ثانیه بر کیلومتر

  // ---------- فرمول Riegel (پیش‌بینی زمان مسابقه) ----------
  function riegel(t1Sec, d1Km, d2Km) {
    return t1Sec * Math.pow(d2Km / d1Km, 1.06);
  }

  // ---------- جدول ده سطح ----------
  //  km: بازه‌ی حجم هفتگی (کیلومتر)، marathon: بازه‌ی رکورد ماراتن مرجع [سریع‌ترین، کندترین] (ثانیه)
  //  tier: گروه پیچیدگی تمرین، sessions: حداکثر جلسه در هفته، longCap: سقف لانگ‌ران، wuKm: گرم/سرد کردن
  //  maxKm: سقف رشد حجم در این سطح
  // سطح ۰: تازه‌وارد کامل (هیچ‌وقت منظم ندویده) — برنامه‌ی جدا: پیاده‌روی قدرتی و دو-پیاده‌ی خیلی تدریجی
  var LEVELS = [
    { n: 0, km: [0, 0], marathon: [hms(6, 0), Infinity], tier: '0', sessions: 3, longCap: 0, wuKm: 0, maxKm: 0 },
    { n: 1, km: [0, 15], marathon: [hms(5, 30), Infinity], tier: 'A', sessions: 3, longCap: 10, wuKm: 0, maxKm: 25 },
    { n: 2, km: [15, 25], marathon: [hms(5, 0), hms(5, 30)], tier: 'A', sessions: 4, longCap: 12, wuKm: 0, maxKm: 35 },
    { n: 3, km: [25, 35], marathon: [hms(4, 30), hms(5, 0)], tier: 'B', sessions: 4, longCap: 16, wuKm: 2, maxKm: 45 },
    { n: 4, km: [35, 50], marathon: [hms(4, 0), hms(4, 30)], tier: 'B', sessions: 5, longCap: 20, wuKm: 2, maxKm: 60 },
    { n: 5, km: [50, 65], marathon: [hms(3, 40), hms(4, 0)], tier: 'C', sessions: 5, longCap: 24, wuKm: 3, maxKm: 75 },
    { n: 6, km: [65, 80], marathon: [hms(3, 20), hms(3, 40)], tier: 'C', sessions: 6, longCap: 28, wuKm: 3, maxKm: 90 },
    { n: 7, km: [80, 100], marathon: [hms(3, 0), hms(3, 20)], tier: 'D', sessions: 6, longCap: 32, wuKm: 4, maxKm: 110 },
    { n: 8, km: [100, 130], marathon: [hms(2, 40), hms(3, 0)], tier: 'D', sessions: 7, longCap: 35, wuKm: 4, maxKm: 140 },
    { n: 9, km: [130, 170], marathon: [hms(2, 20), hms(2, 40)], tier: 'E', sessions: 7, longCap: 38, wuKm: 5, maxKm: 180 },
    { n: 10, km: [170, Infinity], marathon: [0, hms(2, 20)], tier: 'E', sessions: 7, longCap: 40, wuKm: 5, maxKm: 220 }
  ];
  // اسم و توضیح هر سطح از دیکشنری
  LEVELS.forEach(function (L) {
    Object.defineProperty(L, 'name', { enumerable: true, get: function () { return T('levels.' + L.n + '.name'); } });
    Object.defineProperty(L, 'desc', { enumerable: true, get: function () { return T('levels.' + L.n + '.desc'); } });
  });

  var EXPERIENCE = {};
  ['never', 'lt3m', '3to12m', '1to3y', 'gt3y'].forEach(function (k) {
    EXPERIENCE[k] = {};
    Object.defineProperty(EXPERIENCE[k], 'label', { enumerable: true, get: function () { return T('exp.' + k); } });
  });

  var TIER_INFO = i18nMap(['0', 'A', 'B', 'C', 'D', 'E'], 'tier');

  function levelFromKm(km) {
    for (var n = 10; n >= 1; n--) if (km >= LEVELS[n].km[0]) return n;
    return 1;
  }
  function levelFromVdot(vdot) {
    // مرزها = VDOT رکوردهای ماراتن مرجع (کندترین زمان هر سطح)
    for (var n = 10; n >= 2; n--) {
      if (vdot >= vdotFromRace(42.195, LEVELS[n].marathon[1] === Infinity ? hms(5, 30) : LEVELS[n].marathon[1])) return n;
    }
    return 1;
  }

  // سقف سطح بر اساس سابقه (فقط برای سطحی که از روی حجم تخمین زده می‌شه)
  function experienceCap(exp, km) {
    if (exp === 'lt3m') return km >= 15 ? 2 : 1;
    if (exp === '3to12m') return 2;
    if (exp === '1to3y') return 6;
    return 10;
  }

  /*
   * حجم فعلی از دو عدد: حجم هفته‌ی اخیر و میانگین هفتگی ماه اخیر (۴ هفته).
   *  - میانگین وزنی = ۷۰٪ میانگین ماه + ۳۰٪ هفته‌ی اخیر (میانگین ماه پایدارتره)
   *  - افت شدید (هفته‌ی اخیر < ۶۰٪ میانگین و حداقل ۵ کیلومتر کمتر) → دلیلش پرسیده می‌شه:
   *      سفر / دلیل موقتی دیگه: فیتنس سر جاشه → سطح از میانگین ماه، شروع از ۷۵٪ میانگین، برگشت تا میانگین
   *      آسیب / بیماری: سطح از میانگین وزنی، شروع از ۵۰٪ میانگین، برگشت تدریجی تا میانگین
   *      بدون دلیل خاص (کاهش واقعی): سطح از میانگین وزنی، شروع از ۵۰٪ میانگین، سقف رشد عادی
   *  - جهش (هفته‌ی اخیر > ۱۵۰٪ میانگین): سطح و شروع از میانگین وزنی (یه هفته‌ی استثنایی برنامه رو سنگین نکنه)
   * پروفایل‌های قدیمی که فقط currentWeeklyKm دارن مثل قبل رفتار می‌کنن.
   */
  function volumeGap(last, avg) {
    if (avg - last >= 5 && last < avg * 0.6) return 'drop';
    if (last - avg >= 5 && last > avg * 1.5) return 'rise';
    return null;
  }
  function volumeInfo(profile) {
    var cw = Number(profile.currentWeeklyKm) || 0;
    if (profile.lastWeekKm == null || profile.monthAvgKm == null || profile.experience === 'never') {
      return { start: cw, level: cw, weighted: cw, ceiling: null, gap: null, reason: null, last: cw, avg: cw };
    }
    var last = Number(profile.lastWeekKm) || 0, avg = Number(profile.monthAvgKm) || 0;
    var w = floor05(0.7 * avg + 0.3 * last);
    var gap = volumeGap(last, avg);
    var out = { last: last, avg: avg, weighted: w, gap: gap, reason: null, level: w, start: w, ceiling: null };
    if (gap === 'drop') {
      var reason = profile.volumeReason || 'none';
      out.reason = reason;
      if (reason === 'travel' || reason === 'other') {
        out.level = avg; out.start = Math.max(last, floor05(avg * 0.75)); out.ceiling = avg;
      } else {
        out.start = Math.max(last, floor05(avg * 0.5));
        out.ceiling = reason === 'none' ? null : avg;
      }
    }
    return out;
  }
  function volumeNote(v) {
    if (!v.gap) return null;
    var p = { last: v.last, avg: v.avg, w: v.weighted, start: v.start };
    if (v.gap === 'rise') return T('levelNote.rise', p);
    if (v.reason === 'travel' || v.reason === 'other') { p.reason = T('volReason.' + v.reason); return T('levelNote.dropTemp', p); }
    if (v.reason === 'injury' || v.reason === 'illness') { p.reason = T('volReason.' + v.reason); return T('levelNote.dropHealth', p); }
    return T('levelNote.dropReal', p);
  }

  /*
   * تعیین سطح:
   *  ۱) سطح تقریبی از حجم فعلی، محدود به سابقه و تجربه‌ی تمرین ساختاریافته
   *  ۲) اگه رکورد وارد شده: VDOT → سطح. رکورد اولویت داره (فیتنس واقعی)
   *  ۳) اگه رکورد خیلی سریع‌تر از حجم باشه (۲+ سطح فاصله): افزایش حجم با احتیاط
   */
  function assessLevel(profile) {
    var vi = volumeInfo(profile);
    var km = vi.level;
    var exp = profile.experience || 'gt3y';
    // «هیچ‌وقت ندویده‌ام»: همیشه سطح ۰، بدون توجه به حجم یا رکورد
    if (exp === 'never') return { level: 0, volLevel: 0, vdot: null, pbLevel: null, cautious: false, notes: [], source: 'never', info: LEVELS[0] };
    var structured = profile.structured !== false;
    var volLevel = levelFromKm(km);
    var capped = Math.min(volLevel, experienceCap(exp, km));
    if (!structured) capped = Math.min(capped, 4);
    var notes = [];
    if (capped < volLevel) {
      notes.push(!structured && volLevel > 4 && experienceCap(exp, km) > 4
        ? T('levelNote.structuredCap', { from: volLevel, to: capped })
        : T('levelNote.expCap', { exp: EXPERIENCE[exp].label, from: volLevel, to: capped }));
    }
    var out = { level: capped, volLevel: volLevel, vdot: null, pbLevel: null, cautious: false, notes: notes, source: 'volume' };
    var pb = profile.pb;
    if (pb && pb.distanceKm >= 1 && pb.timeSec > 0) {
      var vd = vdotFromRace(pb.distanceKm, pb.timeSec);
      var pbLevel = levelFromVdot(vd);
      out.vdot = vd;
      out.pbLevel = pbLevel;
      out.level = pbLevel;
      out.source = 'pb';
      out.notes = [];
      if (pbLevel >= volLevel + 2) {
        out.cautious = true;
        out.notes.push(T('levelNote.cautious'));
      } else if (pbLevel <= volLevel - 2) {
        out.notes.push(T('levelNote.pbLower'));
      }
    }
    var vn = volumeNote(vi);
    if (vn) out.notes.push(vn);
    out.volume = vi;
    out.info = LEVELS[out.level];
    return out;
  }

  // ---------- هدف مسابقه ----------
  var RACE_DISTANCES = { '5': 5, '10': 10, '21': 21.0975, '42': 42.195 };
  var RACE_LABELS = i18nMap(['5', '10', '21', '42'], 'raceLabels');
  var GOAL_TYPES = i18nMap(['none', '5', '10', '21', '42', 'ultra'], 'goalTypes');
  var TERRAIN_LABELS = i18nMap(['technical', 'trail', 'gravel', 'mixed'], 'terrain');
  var RACE_LONG_CAP = { '5': 22, '10': 25, '21': 28, '42': 40, ultra: 45 };

  // شاخص «فنی بودن مسیر» = متر صعود ÷ کیلومتر
  function ultraClass(ratio) { return ratio < 15 ? 'flat' : ratio < 35 ? 'rolling' : ratio < 60 ? 'hilly' : 'mountain'; }
  var ULTRA_CLASS_INFO = {};
  ['flat', 'rolling', 'hilly', 'mountain'].forEach(function (k) {
    ULTRA_CLASS_INFO[k] = i18nMap(['label', 'short', 'emphasis'], 'ultraClass.' + k);
  });

  // هدف کاربر؛ پروفایل‌های قدیمی (race: {has, distance, date}) هم خونده می‌شن
  function goalInfo(profile) {
    var g = profile.goal;
    if (!g && profile.race && profile.race.has && RACE_DISTANCES[profile.race.distance]) g = { type: profile.race.distance, date: profile.race.date };
    if (!g || !g.type || g.type === 'none' || !GOAL_TYPES[g.type]) return { type: 'none', category: 'general', date: null };
    var cat = g.type === '5' || g.type === '10' ? 'speed' : g.type === '21' ? 'half' : g.type === '42' ? 'marathon' : 'ultra';
    var out = { type: g.type, category: cat, date: g.date || null };
    if (g.type === 'ultra') {
      var u = g.ultra || {};
      out.km = Number(u.km) || 0;
      out.gain = Number(u.gain) || 0;
      out.loss = u.loss ? Number(u.loss) : null;
      out.terrain = u.terrain || null;
      out.altitude = u.altitude ? Number(u.altitude) : null;
      out.ratio = out.km ? out.gain / out.km : 0;
      out.cls = ultraClass(out.ratio);
      // مسیر با سرازیری خیلی بیشتر از صعود (نقطه به نقطه)
      out.netDownhill = out.loss !== null && out.loss > out.gain * 1.2;
    } else out.km = RACE_DISTANCES[g.type];
    return out;
  }
  function goalLabel(g) {
    if (!g || g.type === 'none') return GOAL_TYPES.none;
    if (g.type !== 'ultra') return RACE_LABELS[g.type];
    return T('goalUltra', { km: g.km, gain: g.gain });
  }

  // حداقل هفته‌های آماده‌سازی توصیه‌شده (ایندکس = سطح - ۱)
  var MIN_PREP_WEEKS = {
    '5': [8, 6, 4, 3, 2, 2, 2, 2, 2, 2],
    '10': [14, 10, 8, 6, 4, 4, 3, 2, 2, 2],
    '21': [26, 18, 14, 10, 8, 8, 6, 6, 6, 6],
    '42': [40, 30, 24, 18, 16, 16, 14, 12, 12, 12]
  };
  function minPrepWeeks(g, level) {
    var extra0 = level === 0 ? 8 : 0;
    level = Math.max(1, level);
    if (g.type !== 'ultra') return MIN_PREP_WEEKS[g.type][level - 1] + extra0;
    var w = [44, 36, 30, 24, 20, 18, 16, 14, 12, 12][level - 1] + extra0;
    if (g.km > 50) w += 4;
    if (g.km > 100) w += 8;
    if (g.ratio >= 35) w += 2;
    return w;
  }

  function isLongRace(key) { return key === '21' || key === '42' || key === 'ultra'; }
  function taperFactor(raceKey, daysToRace) {
    var long = isLongRace(raceKey);
    if (daysToRace >= 2 && daysToRace <= 7) return long ? 0.5 : 0.6;
    if (long && daysToRace >= 8 && daysToRace <= 14) return raceKey === '21' ? 0.75 : 0.7;
    return 1;
  }
  function taperWeeks(raceKey) { return isLongRace(raceKey) ? 2 : 1; }
  // ضریب حجم بعد از مسابقه؛ diff = روز تا مسابقه (منفی = بعد از مسابقه). هفته‌ی اول بعد: ریکاوری جدا.
  function returnFactor(diff) {
    if (diff > -8) return 1;
    var k = Math.floor((-diff - 8) / 7); // ۰ = هفته‌ی دوم بعد از مسابقه
    var f = 0.7 * Math.pow(1.1, k);
    return f >= 1 ? 1 : f;
  }
  // مسابقه با تاریخ مشخص (برای تیپر و روز مسابقه)؛ هدف بدون تاریخ فقط تمرکز تمرین‌ها رو تعیین می‌کنه
  function raceInfo(profile) {
    var g = goalInfo(profile);
    if (g.type === 'none' || !g.date || !(g.km > 0)) return null;
    return { key: g.type, date: parseDate(g.date), km: g.km, goal: g };
  }
  function inPostRaceRamp(profile, ws) {
    var race = raceInfo(profile);
    if (!race || race.date >= ws) return false;
    return returnFactor(daysBetween(addDays(ws, 6), race.date)) < 1 || daysBetween(race.date, ws) < 7;
  }

  // مراحل پروتکل دو-پیاده (دقیقه دویدن / دقیقه پیاده‌روی) بر اساس تعداد گام پیشرفت
  var RUN_WALK_STAGES = [
    [1, 2], [1, 2], [1.5, 2], [1.5, 2], [2, 2], [2, 2], [3, 2], [3, 2],
    [4, 1.5], [4, 1.5], [5, 1.5], [5, 1.5], [8, 1], [8, 1], [10, 1]
  ];

  var TYPE_INFO = {
    rest: { hard: false }, easy: { hard: false }, runwalk: { hard: false }, walkrun: { hard: false }, tempo: { hard: true }, interval: { hard: true },
    reps: { hard: true }, fartlek: { hard: true }, hills: { hard: true }, long: { hard: true }, race: { hard: true },
    cancelled: { hard: false }, none: { hard: false }
  };
  Object.keys(TYPE_INFO).forEach(function (k) {
    Object.defineProperty(TYPE_INFO[k], 'label', { enumerable: true, get: function () { return T('types.' + k); } });
  });
  function isHard(type) { return !!(TYPE_INFO[type] && TYPE_INFO[type].hard); }

  // ---------- فیتنس فعلی (تطبیقی) ----------
  // VDOT همیشه از «آخرین» رکورد یا تایم‌تست میاد، نه بهترینِ قدیمی؛ فیتنس در طول زمان تغییر می‌کنه.
  // profile.pb = رکورد پایه‌ی تعیین سطح (موقع ساخت برنامه)، profile.fitnessTests = تایم‌تست‌ها و مسابقه‌های بعدی
  var FITNESS_STALE_WEEKS = 6;
  var EASY_ADJUST_MAX = 30;       // حداکثر کندتر کردن دستی پیس ایزی (ثانیه بر کیلومتر)
  var EASY_BAND = [-15, 25];      // بازه‌ی پیس ایزی نسبت به ۷۰٪ VDOT → ۴۰ ثانیه عرض

  function fitnessEntries(profile) {
    var list = (profile.fitnessTests || []).filter(function (t) { return t && t.distanceKm >= 1 && t.timeSec > 0 && t.date; });
    var pb = profile.pb;
    // رکورد پایه، مگه اینکه همون تایم‌تستی باشه که قبلاً ثبت شده (بعد از تغییر سطح بر اساس تایم‌تست)
    if (pb && pb.distanceKm && pb.timeSec && !list.some(function (t) { return t.distanceKm === pb.distanceKm && t.timeSec === pb.timeSec && t.date === pb.date; })) {
      list = list.concat([{ date: pb.date || profile.startDate, distanceKm: pb.distanceKm, timeSec: pb.timeSec, kind: 'baseline' }]);
    }
    // مرتب بر اساس تاریخ؛ در تاریخ یکسان، تایم‌تست بعدی بر رکورد پایه مقدمه
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.kind === 'baseline' ? 0 : 1) - (b.kind === 'baseline' ? 0 : 1);
    });
  }
  function currentFitness(profile) {
    var list = fitnessEntries(profile);
    if (!list.length) return null;
    var last = list[list.length - 1];
    return { vdot: vdotFromRace(last.distanceKm, last.timeSec), entry: last, count: list.length };
  }

  // ---------- پیس‌ها ----------
  // با رکورد/تایم‌تست: پیس‌های دنیلز از VDOT فعلی. ایزی = بازه‌ی ۴۰ ثانیه‌ای حول ۷۰٪ VDOT.
  // بدون هیچ رکوردی: پیس نداریم؛ تست حرف زدن، RPE و (اگه باشه) ضربان قلب راهنمان.
  function paceZones(profile) {
    var fit = currentFitness(profile);
    var hr = hrZones(profile);
    if (!fit) return hr ? { vdot: null, hrEasy: hr.easy, hr: hr } : null;
    var vd = fit.vdot;
    var adj = clamp(Number(profile.easyAdjustSec) || 0, 0, EASY_ADJUST_MAX);
    var E = paceAtPct(vd, 0.70) + adj;
    var I = paceAtPct(vd, 0.98);
    var M = raceTimeFromVdot(vd, 42.195) / 42.195;
    return {
      vdot: vd, fitness: fit, easyAdjustSec: adj,
      easyCenter: E,
      easy: [E + EASY_BAND[0], E + EASY_BAND[1]],
      marathon: [M - 3, M + 3],
      tempo: [paceAtPct(vd, 0.90), paceAtPct(vd, 0.86)],
      interval: [paceAtPct(vd, 1.0), paceAtPct(vd, 0.96)],
      reps: [I - 18, I - 12],
      hrEasy: hr ? hr.easy : null, hr: hr
    };
  }
  function paceText(range) {
    if (!range) return '';
    return T('pace.range', { a: formatDuration(range[0]), b: formatDuration(range[1]) });
  }

  // ---------- ضربان قلب (اختیاری) ----------
  // Karvonen: ضربان هدف = استراحت + درصد × (حداکثر − استراحت)؛ ایزی = ۶۰ تا ۷۵٪ ذخیره‌ی ضربان.
  // اگه حداکثر وارد نشده ولی استراحت هست: حداکثر تخمینی از سن (Tanaka: ۲۰۸ − ۰٫۷ × سن).
  // اگه فقط حداکثر هست: ۶۵ تا ۷۸٪ حداکثر ضربان (تقریب).
  function hrZones(profile) {
    var max = Number(profile.hrMax) || 0, rest = Number(profile.hrRest) || 0;
    if (!max && !rest) return null;
    var estimated = false;
    if (!max && rest && profile.age) { max = Math.round(208 - 0.7 * profile.age); estimated = true; }
    if (!max || (rest && rest >= max - 20)) return null;
    if (rest) {
      var r = max - rest;
      return { easy: [Math.round(rest + 0.60 * r), Math.round(rest + 0.75 * r)], method: 'karvonen', max: max, rest: rest, maxEstimated: estimated };
    }
    return { easy: [Math.round(max * 0.65), Math.round(max * 0.78)], method: 'max', max: max, rest: null, maxEstimated: false };
  }

  // ---------- «ایزی» واقعاً ایزیه؟ ----------
  function talkTest() { return T('talkTest'); }

  // بازخورد بعد از جلسه‌ی ایزی. pace: 'ok' (داخل بازه یا کندتر) | 'fast' (تندتر از بازه) | 'unknown'
  function easyRunFeedback(post, sessionType) {
    if (!post || !(post.rpe >= 1)) return null;
    if (sessionType !== 'walkrun' && post.rpe <= 6) return { kind: 'ok', message: T('feedback.ok') };
    if (sessionType === 'walkrun') return post.rpe <= 6 ? { kind: 'ok', message: T('zero.feedbackOk') } : { kind: 'runwalk', message: T('zero.feedbackHard') };
    if (sessionType === 'runwalk') return { kind: 'runwalk', message: T('feedback.runwalk') };
    if (post.pace === 'fast') return { kind: 'fast', message: T('feedback.fast') };
    if (post.pace === 'ok') return { kind: 'warn', message: T('easyRpeWarning') };
    return { kind: 'check', message: T('feedback.check') };
  }

  // الگو در ۱۴ روز اخیر: چند جلسه‌ی ایزی با پیس درست، ولی RPE بالای ۶
  function easyRpeTrend(postRuns, today) {
    var from = dateKey(addDays(today, -14)), n = 0;
    Object.keys(postRuns || {}).forEach(function (k) {
      var p = postRuns[k];
      if (k >= from && p && p.easy && p.rpe > 6 && p.pace === 'ok') n++;
    });
    return n;
  }

  // شرایط امروز (از چک‌این) → کدوم سمت بازه‌ی ایزی رو هدف بگیره
  function easyDayHint(checkin, prevCheckin) {
    if (!checkin) return null;
    var tired = checkin.fatigue >= 3 || checkin.sleep <= 2 || (prevCheckin && prevCheckin.sleep <= 2);
    return tired
      ? { side: 'slow', message: T('dayHint.slow') }
      : { side: 'any', message: T('dayHint.any') };
  }

  // یادآوری تایم‌تست
  function fitnessReminder(profile, today) {
    if (profile.experience === 'never') return null;
    var fit = currentFitness(profile);
    if (!fit) return { kind: 'none', message: T('reminder.none') };
    var weeks = Math.floor(daysBetween(parseDate(fit.entry.date), today) / 7);
    if (weeks >= FITNESS_STALE_WEEKS) return { kind: 'stale', weeks: weeks, message: T('reminder.stale', { weeks: weeks, n: weeks }) };
    return null;
  }

  // آیا فیتنس فعلی به سطح دیگه‌ای رسیده؟ (برنامه خودکار سطح عوض نمی‌کنه تا حجم پرش نکنه؛ به کاربر پیشنهاد می‌ده)
  function fitnessLevelSuggestion(profile) {
    var fit = currentFitness(profile);
    if (!fit || fit.entry.kind === 'baseline' || profile.experience === 'never') return null;
    var planLevel = assessLevel(profile).level;
    var fitLevel = levelFromVdot(fit.vdot);
    if (fitLevel === planLevel) return null;
    return { from: planLevel, to: fitLevel, up: fitLevel > planLevel };
  }

  // ---------- ضرایب احتیاط ----------
  function bmi(profile) {
    var h = profile.heightCm / 100;
    return h > 0 ? profile.weightKg / (h * h) : 0;
  }
  // احتیاط روی «سقف رشد» اعمال می‌شه، نه روی حجم هفته‌ی اول (هفته‌ی اول = حجم فعلی کاربر)
  function growthLimit(profile) {
    if (profile.injury && profile.injury.trim()) return 1.1;
    if (profile.age >= 50 || bmi(profile) >= 30) return 1.2;
    return 1.3;
  }

  // ---------- انتخاب روزها ----------
  function circDist(a, b) { var d = Math.abs(a - b) % 7; return Math.min(d, 7 - d); }

  // انتخاب روزهای تمرین: لانگ‌ران جمعه (یا آخرین روز آزاد)، بعد به ترتیب ترجیح نسبت به لانگ‌ران:
  // +۲ و +۴ (یکشنبه و سه‌شنبه: جای جلسات کیفی اوایل هفته)، +۱ (شنبه: ریکاوری بعد از لانگ)، +۵، +۳، +۶
  var DAY_PREF_OFFSETS = [2, 4, 1, 5, 3, 6];
  function chooseSessionDays(avail, n) {
    avail = avail.slice().sort(function (a, b) { return a - b; });
    if (avail.length <= n) return avail;
    var longD = avail.indexOf(6) >= 0 ? 6 : avail[avail.length - 1];
    var chosen = [longD];
    DAY_PREF_OFFSETS.forEach(function (o) {
      var d = (longD + o) % 7;
      if (chosen.length < n && avail.indexOf(d) >= 0 && chosen.indexOf(d) < 0) chosen.push(d);
    });
    return chosen.sort(function (a, b) { return a - b; });
  }

  // جای جلسات سخت: حداقل ۴۸ ساعت بین دو جلسه‌ی سخت (هیچ روز سختی مجاور روز سخت دیگه نیست، حلقوی: جمعه↔شنبه)،
  // و جلسات کیفی تا جای ممکن اوایل هفته تا فاصله‌ی کافی تا لانگ‌ران آخر هفته بمونه.
  // hardFixed: روزهای سخت ثابت (لانگ‌ران و در صورت وجود روز دوم پشت‌سرهم)
  function placeQuality(sessionDays, hardFixed, count) {
    hardFixed = [].concat(hardFixed);
    var hard = hardFixed.slice(), placed = [];
    sessionDays.filter(function (d) { return hardFixed.indexOf(d) < 0; })
      .sort(function (a, b) { return a - b; })
      .forEach(function (d) {
        if (placed.length >= count) return;
        if (hard.every(function (h) { return circDist(h, d) > 1; })) { hard.push(d); placed.push(d); }
      });
    return placed;
  }

  // ---------- حجم: هفته‌ی اول = حجم فعلی کاربر، بعد قانون ۱۰٪ ----------
  function progression(weekIdx) {
    var deload = weekIdx % 4 === 3;
    var steps = deload ? (weekIdx - 1) - Math.floor(weekIdx / 4) : weekIdx - Math.floor((weekIdx + 1) / 4);
    return { deload: deload, steps: steps };
  }

  function startKm(profile) { return Math.max(5, floor05(volumeInfo(profile).start)); }

  // سقف رشد: حالت عادی = حجم فعلی × ضریب احتیاط، محدود به سقف سطح.
  // حالت احتیاط (رکورد خیلی سریع‌تر از حجم): حداکثر ۳۰٪ بالاتر و نه بیشتر از کف حجم سطح. هیچ‌وقت کمتر از حجم فعلی نیست.
  function volumeCeiling(profile, a) {
    a = a || assessLevel(profile);
    var s = startKm(profile);
    var cap = a.cautious ? Math.min(s * 1.3, Math.max(s, a.info.km[0])) : Math.min(s * growthLimit(profile), a.info.maxKm);
    // افت موقت (سفر، آسیب، بیماری): اجازه‌ی برگشت تا میانگین قبلی ماه
    var vc = volumeInfo(profile).ceiling;
    if (vc) cap = Math.max(cap, Math.min(vc, a.info.maxKm || vc));
    return Math.max(s, floor05(cap));
  }
  // نرخ رشد هفتگی: ۱۰٪، در حالت احتیاط ۵٪
  function growthRate(a) { return a.cautious ? 1.05 : 1.1; }

  // گرد کردن تکراری رو به پایین تا قانون ۱۰٪ روی عدد نهایی هم برقرار باشه
  function weeklyVolume(profile, weekIdx, noDeload, a) {
    a = a || assessLevel(profile);
    var pr = progression(weekIdx);
    if (noDeload && pr.deload) pr = { deload: false, steps: pr.steps };
    var ceil = volumeCeiling(profile, a), rate = growthRate(a);
    var v = startKm(profile);
    for (var i = 0; i < pr.steps; i++) v = Math.min(ceil, floor05(v * rate));
    return { km: pr.deload ? floor05(v * 0.8) : v, atCeiling: pr.steps > 0 && v >= ceil };
  }
  function weeklyVolumeKm(profile, weekIdx) { return weeklyVolume(profile, weekIdx).km; }

  // سطح ۱: زمان دویدن هر جلسه از حجم فعلی (حدود ۸ دقیقه برای هر کیلومتر) شروع می‌شه
  function runWalkMinutes(profile, weekIdx, nSessions) {
    var pr = progression(weekIdx);
    var km = volumeInfo(profile).start;
    var start = clamp(km * 8 / Math.max(1, nSessions), 8, 30);
    var cap = profile.injury && profile.injury.trim() ? Math.min(30, Math.max(12, start * 1.5)) : 30;
    var runMin = Math.min(cap, start * Math.pow(1.1, pr.steps));
    if (pr.deload) runMin *= 0.8;
    var stageIdx = Math.min(RUN_WALK_STAGES.length - 1, pr.steps + Math.floor((start - 8) / 3));
    var stage = RUN_WALK_STAGES[stageIdx];
    return { runTotal: runMin, run: stage[0], walk: stage[1] };
  }

  // ---------- منوی تمرین بر اساس هدف و گروه سطح ----------
  // هر جلسه‌ی کیفی یک «سهم» از حجم هفته برای بخش پرشدتش داره؛ جمع سهم‌های هر منو (به‌علاوه‌ی بخش تند لانگ‌ران) ≤ ۲۰٪.
  // ترتیب جلسات در منو = ترتیب در هفته (اولی زودتر).
  function Q(type, share, extra) { var o = { type: type, share: share }; for (var k in extra) o[k] = extra[k]; return o; }

  // دوره‌بندی (سطح ۷ به بالا): پایه → ساخت → اوج.
  // با مسابقه‌ی تاریخ‌دار: از روی هفته‌های باقی‌مونده؛ بدون تاریخ: چرخه‌ی ۱۲ هفته‌ای.
  function periodFor(w, ws, race) {
    if (race && race.date > ws) {
      var weeksToRace = Math.floor(daysBetween(ws, race.date) / 7);
      if (weeksToRace <= 5) return 'peak';
      if (weeksToRace <= 11) return 'build';
      return 'base';
    }
    var m = ((w % 12) + 12) % 12;
    return m < 4 ? 'base' : (m < 8 ? 'build' : 'peak');
  }
  var PERIOD_LABELS = i18nMap(['base', 'build', 'peak'], 'periods');

  // چرخه‌های هفتگی هر دسته (گروه C و دوره‌ی ساخت D/E). long: نوع لانگ‌ران و سهم بخش تندش
  var ROTATIONS = {
    // بدون هدف: چرخش بین اینتروال کوتاه، تمپو، فارتلک، تپه و آستانه تا سیستم‌های انرژی مختلف تحریک بشن
    general: [
      { q: [Q('shortInt', 0.08, { rep: 400 }), Q('tempoRun', 0.08)] },
      { q: [Q('speedFartlek', 0.07, { form: 'landmark' }), Q('thresholdInt', 0.08)] },
      { q: [Q('midInt', 0.08, { rep: 1000 }), Q('tempoRun', 0.08)] },
      { q: [Q('shortHills', 0.04), Q('longInt', 0.08, { rep: 1600 })], long: { kind: 'tempo', share: 0.04 } },
      { q: [Q('shortInt', 0.08, { rep: 800 }), Q('thresholdInt', 0.08)] },
      { q: [Q('speedFartlek', 0.07, { form: 'mona' }), Q('tempoRun', 0.08)] }
    ],
    // ۵ و ۱۰ کیلومتر: VO2max و سرعت
    speed: [
      { q: [Q('shortInt', 0.08, { rep: 400 }), Q('tempoRun', 0.07)] },
      { q: [Q('midInt', 0.08, { rep: 1000 }), Q('speedFartlek', 0.07, { form: 'mona' })] },
      { q: [Q('shortInt', 0.08, { rep: 800 }), Q('shortHills', 0.04)], long: { kind: 'tempo', share: 0.04 } },
      { q: [Q('midInt', 0.08, { rep: 1600 }), Q('speedFartlek', 0.07, { form: 'pyramid' })] },
      { q: [Q('shortInt', 0.08, { rep: 600 }), Q('speedFartlek', 0.07, { form: 'landmark' })] }
    ],
    // نیمه‌ماراتن: آستانه + VO2max
    half: [
      { q: [Q('thresholdInt', 0.08), Q('longInt', 0.08, { rep: 1600 })] },
      { q: [Q('longInt', 0.08, { rep: 2000 }), Q('tempoRun', 0.09, { max: 40 })] },
      { q: [Q('thresholdInt', 0.08), Q('speedFartlek', 0.05, { form: 'landmark' })], long: { kind: 'tempo', share: 0.05 } }
    ],
    // ماراتن: آستانه و استقامت ویژه
    marathon: [
      { q: [Q('longTempo', 0.1), Q('shortHills', 0.03)] },
      { q: [Q('mpInt', 0.09), Q('tempoRun', 0.06)] },
      { q: [Q('longFartlek', 0.08)], long: { kind: 'mp', share: 0.09 } }
    ],
    // اولترا/تریل بر اساس شاخص فنی بودن مسیر
    ultra_mountain: [
      { q: [Q('longHills', 0.07), Q('downhill', 0.03)] },
      { q: [Q('longHills', 0.07), Q('steady', 0.05)] },
      { q: [Q('longHills', 0.07), Q('downhill', 0.03)] }
    ],
    ultra_hilly: [
      { q: [Q('longHills', 0.07), Q('steady', 0.06)] },
      { q: [Q('longHills', 0.06), Q('downhill', 0.03)] },
      { q: [Q('steady', 0.07), Q('longHills', 0.06)] }
    ],
    ultra_rolling: [
      { q: [Q('steady', 0.07), Q('longHills', 0.06)] },
      { q: [Q('tempoRun', 0.07), Q('downhill', 0.03)] },
      { q: [Q('longHills', 0.06), Q('steady', 0.07)] }
    ],
    ultra_flat: [
      { q: [Q('steady', 0.08), Q('tempoRun', 0.07)] },
      { q: [Q('longTempo', 0.09), Q('longHills', 0.04)] },
      { q: [Q('longFartlek', 0.08), Q('steady', 0.06)] }
    ]
  };
  // اوج (سطح ۷+): تمرین‌های اختصاصی مسابقه
  var PEAK = {
    general: null,
    speed: [
      { q: [Q('shortInt', 0.08, { rep: 600 }), Q('midInt', 0.07, { rep: 1200 })] },
      { q: [Q('shortInt', 0.08, { rep: 400 }), Q('tempoRun', 0.07)] }
    ],
    half: [
      { q: [Q('thresholdInt', 0.08), Q('longInt', 0.08, { rep: 2000 })] },
      { q: [Q('tempoRun', 0.09, { max: 40 }), Q('longInt', 0.07, { rep: 1600 })], long: { kind: 'tempo', share: 0.04 } }
    ],
    marathon: [
      { q: [Q('mpInt', 0.09)], long: { kind: 'mp', share: 0.09 } },
      { q: [Q('longTempo', 0.1)], long: { kind: 'mp', share: 0.07 } }
    ]
  };

  function rotationKey(goal) {
    if (goal.category === 'ultra') {
      var cls = goal.cls || 'rolling';
      // مسیر نقطه‌به‌نقطه با سرازیری غالب: حداقل به اندازه‌ی «تپه‌ای» تمرین فرود
      if (goal.netDownhill && (cls === 'flat' || cls === 'rolling')) cls = 'hilly';
      return 'ultra_' + cls;
    }
    return goal.category;
  }

  // menu: { quality: [...], long: {kind, share}, strides, hills, strength, doubles, vertFactor }
  function weekWorkouts(tier, level, w, deload, goal, period) {
    goal = goal || { category: 'general', type: 'none' };
    var ultra = goal.category === 'ultra';
    var plainLong = { kind: ultra ? 'ultra' : 'plain', share: 0 };
    if (tier === 'A') return { quality: [], long: plainLong, strides: false, vertFactor: 0.3 };
    if (tier === 'B') {
      // تمپوی ملایم + اینتروال خیلی کوتاه با استراحت طولانی؛ برای تریل به‌جای اون تپه‌ی کوتاه کنترل‌شده
      if (deload) return { quality: [Q('tempoMild', 0.06)], long: plainLong, strides: true, vertFactor: 0.4 };
      var q = [Q('tempoMild', 0.07)];
      var second = ultra ? (w % 2 ? Q('hillsB', 0.04) : null)
        : goal.category === 'general' ? [Q('shortint', 0.05, { rep: 200 }), Q('hillsB', 0.04), Q('shortint', 0.05, { rep: 400 })][w % 3]
        : (level >= 4 || w % 2 === 1 ? Q('shortint', 0.05, { rep: level >= 4 && w % 2 === 1 ? 400 : 200 }) : null);
      if (second) q.push(second);
      return { quality: q, long: plainLong, strides: true, vertFactor: 0.4 };
    }
    var key = rotationKey(goal);
    var rot = ROTATIONS[key];
    var extra = tier === 'C' ? { strides: true } : { strides: true, hills: !ultra, strength: tier === 'E' ? 2 : (ultra ? 2 : 1), doubles: tier === 'E' };
    if (ultra && tier === 'C') extra.strength = 1;
    function pack(row, vf) {
      var o = { quality: row.q.slice(), long: row.long || plainLong, vertFactor: vf };
      if (ultra) o.long = { kind: 'ultra', share: 0 };
      for (var k in extra) o[k] = extra[k];
      return o;
    }
    if (deload) {
      var dq = ultra ? [Q(goal.cls === 'flat' ? 'steady' : 'longHills', 0.04)] : (tier === 'C' ? [Q('speedFartlek', 0.05, { form: 'oneone' })] : [Q('reps', 0.04, { rep: 200 })]);
      return pack({ q: dq }, 0.5);
    }
    if (tier === 'C') return pack(rot[w % rot.length], Math.min(1, 0.5 + w * 0.05));
    // D و E
    if (period === 'base') {
      var bq = ultra ? [Q('longHills', 0.05), Q('steady', 0.07)] : [Q('reps', 0.05, { rep: w % 2 ? 400 : 200 }), Q('tempoRun', 0.08)];
      return pack({ q: bq }, 0.5);
    }
    if (period === 'peak' && PEAK[key]) return pack(PEAK[key][w % PEAK[key].length], 1);
    return pack(rot[w % rot.length], period === 'peak' ? 1 : 0.75);
  }

  // ---------- سازنده‌ی جلسات ----------
  function rpeLine(t) { return T('rpe.' + t); }
  function paceNote(label, range) { return range ? ' ' + label + ': ' + paceText(range) + '.' : ''; }
  // راهنمای شدت ایزی: بازه‌ی پیس (نه یک عدد) + ضربان هدف (اگه داریم)
  function easyGuide(zones) {
    if (!zones) return '';
    var out = '';
    if (zones.easy) out += T('guideLine.pace', { p: paceText(zones.easy) });
    if (zones.hrEasy) out += T('guideLine.hr', { a: zones.hrEasy[0], b: zones.hrEasy[1] });
    return out;
  }

  // ---------- گرم کردن و سرد کردن اختصاصی هر جلسه ----------
  // دسته‌ی جلسه (easy / long / tempo / interval / hills / light / race) و گروه سطح:
  //  basic (۰ تا ۳): ساده‌تر و آماده‌سازی تدریجی‌تر؛ mid (۴ تا ۶)؛ adv (۷ تا ۱۰): فشرده‌تر با drillهای تخصصی‌تر
  var WU_LEVEL = 5;
  function wuGroup(level) { return level <= 3 ? 'basic' : level <= 6 ? 'mid' : 'adv'; }
  var WU_JOG = { basic: [15, 15], mid: [12, 15], adv: [10, 12] };     // دقیقه دویدن آروم رو به افزایش
  var WU_STRIDES = { tempo: { basic: '3', mid: '3–4', adv: '4' }, interval: { basic: '4', mid: '4–6', adv: '6' } };
  var WU_COOL = { tempo: 10, interval: 12, hills: 12 };
  function rangeText(a, b) { return a === b ? String(a) : a + '–' + b; }
  // فاصله‌ی دویدن گرم و سرد کردن (کیلومتر)، برای حساب حجم جلسه
  function wuKmFor(level, pE) {
    var g = wuGroup(level), jog = (WU_JOG[g][0] + WU_JOG[g][1]) / 2;
    return round05((jog + WU_COOL.interval) * 60 / pE);
  }
  function warmupFor(cat, level, extra) {
    var g = wuGroup(level), lines = [], cool = [], min = null;
    var jog = T('wu.jog', { min: rangeText(WU_JOG[g][0], WU_JOG[g][1]) });
    if (cat === 'easy' || cat === 'long') {
      lines.push(T(g === 'basic' ? 'wu.easyBasic' : 'wu.easyJog'));
      if (cat === 'long' && g === 'adv') lines.push(T('wu.mobility'));
      if (cat === 'long') cool.push(T('wu.coolLong'));
      min = 10;
    } else if (cat === 'tempo') {
      lines.push(jog, T('wu.drills.tempo.' + g), T('wu.strides.tempo', { n: WU_STRIDES.tempo[g] }), T('wu.whyTempo'));
      cool.push(T('wu.cool', { min: WU_COOL.tempo }));
      min = WU_JOG[g][1] + 10;
    } else if (cat === 'interval' || cat === 'hills') {
      lines.push(jog, T('wu.drills.' + cat + '.' + g), T('wu.strides.' + cat, { n: WU_STRIDES.interval[g] }));
      if (g === 'adv') lines.push(T('wu.stridesAdv'));
      lines.push(T(cat === 'hills' ? 'wu.whyHills' : 'wu.whyInterval'));
      cool.push(T('wu.cool', { min: rangeText(10, 15) }));
      min = WU_JOG[g][1] + 12;
    } else if (cat === 'light') {
      lines.push(T('wu.light'), T('wu.lightStrides'));
      if (g !== 'basic') lines.splice(1, 0, T('wu.drills.tempo.' + g));
    } else if (cat === 'race') {
      var key = extra === 'short' ? 'raceShort' : extra === 'half' ? 'raceHalf' : 'raceLong';
      lines = T('wu.' + key).slice();
      cool.push(T('wu.raceCool'));
    }
    return { warmup: { lines: lines, min: min }, cooldown: cool.length ? { lines: cool } : null };
  }
  function attachWarmup(s, cat, level, extra) {
    var w = warmupFor(cat, level == null ? WU_LEVEL : level, extra);
    s.warmup = w.warmup; s.cooldown = w.cooldown; s.wuCat = cat;
    return s;
  }
  var QUALITY_CAT = {
    shortInt: 'interval', midInt: 'interval', longInt: 'interval', shortint: 'interval', reps: 'interval', speedFartlek: 'interval',
    thresholdInt: 'tempo', tempoRun: 'tempo', longTempo: 'tempo', mpInt: 'tempo', tempoMild: 'tempo',
    shortHills: 'hills', longHills: 'hills', hillsB: 'hills', downhill: 'hills', steady: 'light', longFartlek: 'light'
  };

  function makeRunWalk(rw, factor, extraNote) {
    var runTotal = rw.runTotal * factor;
    var reps = Math.max(4, Math.round(runTotal / rw.run));
    var total = 10 + reps * (rw.run + rw.walk);
    return {
      type: 'runwalk', minutes: Math.round(total), km: null, hardKm: 0,
      target: T('s.min', { n: Math.round(total) }),
      steps: [T('s.runwalk.main', { reps: reps, run: rw.run, walk: rw.walk })],
      warmup: { lines: [T('s.runwalk.warm')], min: 5 }, cooldown: { lines: [T('s.runwalk.cool')] },
      how: T('s.runwalk.how') + (extraNote ? ' ' + extraNote : ''),
      talk: talkTest(), easyEffort: true
    };
  }

  // ---------- سطح ۰: از پیاده‌روی قدرتی تا ۱۵ دقیقه دویدن پیوسته ----------
  // هر مرحله: [ثانیه دویدن، ثانیه پیاده‌روی، تعداد تکرار]. مرحله‌ی آخر = ۱۵ دقیقه دویدن پیوسته (آمادگی سطح ۱)
  var ZERO_STAGES = [[20, 150, 6], [30, 120, 8], [60, 120, 8], [90, 120, 6], [120, 90, 6], [180, 90, 5], [420, 90, 2], [900, 0, 1]];
  var ZERO_FINAL = ZERO_STAGES.length - 1;
  // بازخورد هفتگی: «راحت» = دو مرحله جلو، «مناسب» یا بی‌جواب = یک مرحله، «سخت» = تکرار همون مرحله
  var ZERO_STEP = { easy: 2, ok: 1, hard: 0 };
  function zeroStage(profile, w) {
    var st = 0, ps = planStart(profile), log = profile.zeroWeeks || {};
    for (var i = 0; i < w; i++) {
      var f = log[dateKey(addDays(ps, i * 7))];
      st = Math.min(ZERO_FINAL, st + ZERO_STEP[(f && f.feel) || 'ok']);
    }
    return st;
  }
  function secText(sec) { return sec < 60 ? T('dur.s', { n: sec }) : T('dur.m', { n: Math.round(sec / 6) / 10 }); }
  function makeWalkRun(stage) {
    var S = ZERO_STAGES[stage], run = S[0], walk = S[1], reps = S[2];
    var main = stage === ZERO_FINAL ? T('zero.continuous')
      : T(stage === 0 ? 'zero.mainPower' : 'zero.main', { reps: reps, run: secText(run), walk: secText(walk) });
    return {
      type: 'walkrun', minutes: Math.round(10 + reps * (run + walk) / 60), km: null, hardKm: 0, stage: stage,
      target: T('s.min', { n: Math.round(10 + reps * (run + walk) / 60) }),
      steps: [main], warmup: { lines: [T('zero.warm')], min: 5 }, cooldown: { lines: [T('zero.cool')] },
      how: T('zero.how'), cheer: T('zero.cheer.' + stage), easyEffort: true
    };
  }

  function makeEasy(km, zones, note) {
    km = Math.max(2, round05(km));
    return attachWarmup({
      type: 'easy', km: km, hardKm: 0, target: T('s.km', { n: km }),
      steps: [T('s.easy', { km: km })],
      how: rpeLine('easy') + easyGuide(zones) + (note ? ' ' + note : ''),
      talk: talkTest(), easyEffort: true
    }, 'easy');
  }

  // روز دوجلسه‌ای (سطح ۹-۱۰): صبح ۶۰٪، عصر ۴۰٪، هر دو آسون
  function makeDouble(s) {
    var am = round05(s.km * 0.6), pm = round05(s.km - am);
    s.double = { am: am, pm: pm };
    s.variant = T('s.double.variant');
    s.target = T('s.double.target', { am: am, pm: pm });
    s.steps = [T('s.double.am', { n: am }), T('s.double.pm', { n: pm })].concat(s.steps.slice(1));
    s.how += T('s.double.how');
    return s;
  }

  function addStrides(s) {
    s.steps.push(T('s.strides'));
    s.strides = true;
    return s;
  }
  function addHills(s) {
    s.steps.push(T('s.hillSprints'));
    s.hills = true;
    return s;
  }
  function addStrength(s) {
    s.steps.push(T('s.strength'));
    s.strength = true;
    return s;
  }

  function makeTempo(mainKm, wuKm, zones, mild) {
    mainKm = Math.min(mild ? 6 : 12, Math.max(1.5, floor05(mainKm)));
    var half = wuKm / 2;
    var main = mild && mainKm >= 3
      ? [T('s.tempo.mildMain', { a: floor05(mainKm / 2), b: round05(mainKm - floor05(mainKm / 2)) })]
      : [T('s.tempo.main', { km: mainKm })];
    var s = {
      type: 'tempo', km: round05(mainKm + wuKm), hardKm: mainKm, target: T('s.km', { n: round05(mainKm + wuKm) }), mild: !!mild,
      steps: main,
      how: (mild ? T('s.tempo.mildHow') : rpeLine('tempo')) + paceNote(T('lbl.pace'), zones && zones.tempo)
    };
    s.variant = mild ? T('s.tempo.vMild') : T('s.tempo.vT');
    return s;
  }

  // کروز اینتروال دنیلز: تکرارهای ۱٫۶ کیلومتری با پیس آستانه و ۱ دقیقه استراحت
  function makeCruise(mainKm, wuKm, zones) {
    var reps = Math.min(6, Math.max(2, Math.floor(mainKm / 1.6 + 1e-9)));
    var hardKm = round05(reps * 1.6), half = wuKm / 2;
    return {
      type: 'tempo', km: round05(hardKm + wuKm + reps * 0.2), hardKm: hardKm, cruise: true, variant: T('s.cruise.variant'),
      target: T('s.km', { n: round05(hardKm + wuKm + reps * 0.2) }),
      steps: [T('s.cruise.main', { reps: reps })],
      how: rpeLine('tempo') + paceNote(T('lbl.paceT'), zones && zones.tempo)
    };
  }

  // اینتروال. kind: short (سطح ۳-۴: کوتاه با استراحت طولانی) | struct (سطح ۵-۶) | daniels (VO2max، سطح ۷+)
  function makeInterval(mainKm, wuKm, rep, zones, kind) {
    var maxReps = { 200: 12, 400: kind === 'short' ? 8 : 16, 800: 10, 1000: 8, 1200: 6 }[rep] || 10;
    var minReps = kind === 'short' ? 4 : 3;
    var reps = Math.min(maxReps, Math.max(minReps, Math.floor(mainKm * 1000 / rep + 1e-9)));
    var hardKm = reps * rep / 1000, half = wuKm / 2;
    var rest = kind === 'short' ? T('s.interval.restShort') :
      kind === 'daniels' ? T('s.interval.restDaniels') :
      (rep <= 400 ? T('s.interval.rest90') : (rep === 800 ? T('s.interval.rest23') : T('s.interval.rest3')));
    var total = round05(hardKm + wuKm + reps * (rep >= 800 ? 0.3 : 0.2));
    var s = {
      type: 'interval', km: total, hardKm: hardKm, rep: rep, kind: kind || 'struct', target: T('s.km', { n: total }),
      steps: [T('s.interval.main', { reps: reps, rep: rep, rest: rest })],
      how: (kind === 'short' ? T('s.interval.shortHow') : rpeLine('interval')) +
        paceNote(kind === 'daniels' ? T('lbl.paceI') : T('lbl.paceReps'), zones && zones.interval)
    };
    s.variant = kind === 'short' ? T('s.interval.vShort') : (kind === 'daniels' ? T('s.interval.vI') : null);
    return s;
  }

  // تکرار سرعتی دنیلز (R): ۲۰۰/۴۰۰ متر با ریکاوری کامل
  function makeReps(mainKm, wuKm, rep, zones) {
    var reps = Math.min(rep === 200 ? 12 : 8, Math.max(6, Math.floor(mainKm * 1000 / rep + 1e-9)));
    var hardKm = reps * rep / 1000, half = wuKm / 2;
    var total = round05(hardKm * 2 + wuKm);
    return {
      type: 'reps', km: total, hardKm: hardKm, rep: rep, variant: T('s.reps.variant'), target: T('s.km', { n: total }),
      steps: [T('s.reps.main', { reps: reps, rep: rep })],
      how: rpeLine('reps') + paceNote(T('lbl.paceR'), zones && zones.reps)
    };
  }

  function makeFartlek(mainKm, wuKm, zones) {
    var reps = Math.min(12, Math.max(4, Math.floor(mainKm / 0.4 + 1e-9)));
    var hardKm = round05(reps * 0.4), half = wuKm / 2;
    var total = round05(hardKm + wuKm + reps * 0.3);
    return {
      type: 'fartlek', km: total, hardKm: hardKm, target: T('s.km', { n: total }),
      steps: [T('s.fartlek.main', { reps: reps })],
      how: T('s.fartlek.how') + paceNote(T('lbl.paceFast'), zones && zones.tempo) + T('s.fartlekVsInterval')
    };
  }

  // ---------- کتابخانه‌ی تمرین‌های شدید ----------
  // پیس‌های مرجع (ثانیه بر کیلومتر) برای تبدیل زمان↔مسافت. با تایم‌تست از VDOT فعلی، بدون اون از ماراتن مرجع سطح.
  function refVdot(profile, level) {
    var fit = currentFitness(profile);
    if (fit) return fit.vdot;
    var m = LEVELS[level].marathon;
    var slow = m[1] === Infinity ? hms(6, 15) : m[1], fast = m[0] || hms(2, 8);
    return vdotFromRace(42.195, (slow + fast) / 2);
  }
  function paceSet(profile, level) {
    var v = refVdot(profile, level);
    var race = function (d) { return raceTimeFromVdot(v, d) / d; };
    var adj = clamp(Number(profile.easyAdjustSec) || 0, 0, EASY_ADJUST_MAX);
    return { vdot: v, known: !!currentFitness(profile), p5: race(5), p10: race(10), pHM: race(21.0975), pM: race(42.195),
      pT: paceAtPct(v, 0.88), pE: paceAtPct(v, 0.70) + adj,
      // همون بازه‌ای که صفحه‌ی فیتنس برای آستانه نشون می‌ده
      tRange: [paceAtPct(v, 0.90), paceAtPct(v, 0.86)] };
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function round10(x) { return Math.round(x / 10) * 10; }
  function hoursText(min) {
    min = Math.round(min / 5) * 5;
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? T('dur.h', { n: h }) : '') + (h && m ? T('dur.join') : '') + (m ? T('dur.m', { n: m }) : '');
  }
  // پیس فقط وقتی نشون داده می‌شه که از تایم‌تست واقعی باشه، و نه در تمرین‌های تریل (اون‌جا RPE و زمان ملاکه)
  function paceHint(ctx, label, a, b) {
    if (!ctx.P.known || ctx.rpeOnly) return '';
    return b ? T('paceHint.two', { label: label, a: formatDuration(a), b: formatDuration(b) }) : T('paceHint.one', { label: label, a: formatDuration(a) });
  }
  function sess(type, variant, hardKm, totalKm, steps, how, extra) {
    var km = Math.max(round05(totalKm), round05(hardKm));
    var s = { type: type, variant: variant, km: km, hardKm: r1(hardKm), target: T('s.km', { n: km }), steps: steps, how: how };
    for (var k in extra) s[k] = extra[k];
    return s;
  }

  // ۵/۱۰ کیلومتر — اینتروال کوتاه: ۴۰۰ تا ۸۰۰ متر با پیس ۵ کیلومتر، استراحت برابر یا کمی بیشتر
  function makeShortInt(main, ctx, rep) {
    rep = rep || 400;
    var reps = clamp(Math.floor(main * 1000 / rep + 1e-9), 4, { 400: 16, 600: 12, 800: 10 }[rep] || 10);
    var hard = reps * rep / 1000, jog = hard * ctx.P.p5 / ctx.P.pE * 1.1;
    return sess('interval', T('s.shortInt.variant'), hard, hard + ctx.wu + jog,
      [T('s.shortInt.main', { reps: reps, rep: rep })],
      rpeLine('interval') + paceHint(ctx, T('lbl.pace5k'), ctx.P.p5),
      { rep: rep, kind: 'short5k' });
  }
  // اینتروال متوسط: ۱۰۰۰ تا ۱۶۰۰ متر با پیس بین ۵ تا ۱۰ کیلومتر، استراحت ۲ تا ۳ دقیقه
  function makeMidInt(main, ctx, rep) {
    rep = rep || 1000;
    var reps = clamp(Math.floor(main * 1000 / rep + 1e-9), 3, { 1000: 8, 1200: 6, 1600: 5 }[rep] || 6);
    var hard = reps * rep / 1000;
    return sess('interval', T('s.midInt.variant'), hard, hard + ctx.wu + reps * 0.4,
      [T('s.midInt.main', { reps: reps, rep: rep })],
      rpeLine('interval') + paceHint(ctx, T('lbl.pace'), ctx.P.p5, ctx.P.p10),
      { rep: rep, kind: 'mid' });
  }
  // فارتلک: پیوسته و بدون توقف (ریکاوری = دویدن آروم). فرم‌ها:
  //  oneone (۱ دقیقه تند/۱ دقیقه آروم)، pyramid (۱-۲-۳-۴-۳-۲-۱)، mona (مونا، سطح ۶+)، landmark (آزاد بر اساس نشونه‌های محیطی، سطح ۴+)
  // مونا (Steve Moneghetti، طراحی Chris Wardlaw): ۲×۹۰، ۴×۶۰، ۴×۳۰، ۴×۱۵ ثانیه حدود پیس ۵ کیلومتر،
  // با «شناور» هم‌طول هر تکه (جاگ نسبتاً سریع، بدون توقف) = ۲۰ دقیقه بخش اصلی
  function makeSpeedFartlek(main, ctx, form) {
    var pF = (ctx.P.p5 + ctx.P.p10) / 2, hardMin, recMin, step, variant, steps;
    var level = ctx.level || WU_LEVEL;
    if (form === 'mona' && level < 6) form = 'pyramid';
    if (form === 'landmark' && level < 4) form = 'oneone';
    if (form === 'mona') {
      var hardM = 600 / ctx.P.p5;  // ۱۰ دقیقه تند
      return sess('fartlek', T('s.speedFartlek.vMona'), hardM, hardM + 600 / (ctx.P.pE * 0.93) + ctx.wu,
        T('s.speedFartlek.monaSteps').slice(),
        T('s.speedFartlek.monaHow') + paceHint(ctx, T('lbl.pace5k'), ctx.P.p5) + T('s.fartlekVsInterval'),
        { form: 'mona' });
    }
    if (form === 'landmark') {
      var n = clamp(Math.round(main * ctx.P.p10 / 60 / 0.9), 6, 10), tot = clamp(30 + (n - 6) * 3, 30, 45);
      var hardL = n * 50 / ctx.P.p10;
      return sess('fartlek', T('s.speedFartlek.vLandmark'), hardL, (tot * 60 - n * 50) / ctx.P.pE + hardL + ctx.wu,
        [T('s.speedFartlek.landmark1', { min: tot, n: n }), T('s.speedFartlek.landmark2'), T('s.speedFartlek.landmark3')],
        T('s.speedFartlek.landmarkHow') + T('s.fartlekVsInterval'),
        { form: 'landmark' });
    }
    if (form === 'pyramid') {
      var full = main * pF / 60 >= 14;
      hardMin = full ? 16 : 9; recMin = full ? 6 : 4;
      step = full ? T('s.speedFartlek.pyramid') : T('s.speedFartlek.pyramidShort');
      variant = T('s.speedFartlek.vPyramid');
    } else {
      hardMin = clamp(Math.round(main * pF / 60), 6, 15); recMin = hardMin;
      step = T('s.speedFartlek.oneone', { n: hardMin });
      variant = T('s.speedFartlek.vOneone');
    }
    var hard = hardMin * 60 / pF;
    return sess('fartlek', variant, hard, hard + recMin * 60 / ctx.P.pE + ctx.wu, [step],
      T('s.fartlek.how') + paceHint(ctx, T('lbl.paceFast'), ctx.P.p5, ctx.P.p10) + T('s.fartlekVsInterval'),
      { form: form });
  }
  // تپه‌ی کوتاه: ۸ تا ۱۲ تکرار سرعتی حدود ۱۰۰ متر، برگشت با پیاده‌روی
  function makeShortHills(main, ctx) {
    var reps = clamp(Math.round(main / 0.1), 8, 12), hard = reps * 0.1;
    return sess('hills', T('s.shortHills.variant'), hard, ctx.wu + reps * 0.2,
      [T('s.shortHills.main', { reps: reps })],
      T('s.shortHills.how'),
      { vert: reps * 8 });
  }
  // نیمه‌ماراتن — اینتروال آستانه: ۳ تا ۴ × ۸ تا ۱۰ دقیقه، استراحت ۹۰ ثانیه تا ۲ دقیقه
  function makeThresholdInt(main, ctx) {
    var mm = main * ctx.P.pT / 60, reps = mm >= 32 ? 4 : 3, repMin = clamp(Math.round(mm / reps), 8, 10);
    var hard = reps * repMin * 60 / ctx.P.pT;
    return sess('tempo', T('s.thresholdInt.variant'), hard, hard + ctx.wu + reps * 0.3,
      [T('s.thresholdInt.main', { reps: reps, min: repMin })],
      rpeLine('tempo') + paceHint(ctx, T('lbl.pace'), ctx.P.tRange[0], ctx.P.tRange[1]), { thresholdInt: true });
  }
  // اینتروال بلند: ۱۶۰۰ تا ۲۰۰۰ متر با پیس بین ۱۰ کیلومتر و نیمه‌ماراتن
  function makeLongInt(main, ctx, rep) {
    rep = rep || 1600;
    var reps = clamp(Math.floor(main * 1000 / rep + 1e-9), 3, rep >= 2000 ? 5 : 6), hard = reps * rep / 1000;
    return sess('interval', T('s.longInt.variant'), hard, hard + ctx.wu + reps * 0.4,
      [T('s.longInt.main', { reps: reps, rep: rep })],
      T('s.longInt.how') + paceHint(ctx, T('lbl.pace'), ctx.P.p10, ctx.P.pHM), { rep: rep, kind: 'long' });
  }
  // تمپوی پیوسته: ۲۰ تا ۴۰ دقیقه با پیس آستانه
  function makeTempoRun(main, ctx, maxMin) {
    var min = clamp(Math.round(main * ctx.P.pT / 60), 20, maxMin || 40), hard = min * 60 / ctx.P.pT;
    return sess('tempo', T('s.tempoRun.variant'), hard, hard + ctx.wu,
      [T('s.tempoRun.main', { min: min })],
      rpeLine('tempo') + paceHint(ctx, T('lbl.pace'), ctx.P.tRange[0], ctx.P.tRange[1]));
  }
  // ماراتن — تمپوی پیوسته‌ی بلند: ۳۰ تا ۵۰ دقیقه با پیس آستانه یا کمی کندتر
  function makeLongTempo(main, ctx) {
    var p = ctx.P.pT + 8, min = clamp(Math.round(main * p / 60), 30, 50), hard = min * 60 / p;
    return sess('tempo', T('s.longTempo.variant'), hard, hard + ctx.wu,
      [T('s.longTempo.main', { min: min })],
      T('s.longTempo.how') + paceHint(ctx, T('lbl.pace'), ctx.P.tRange[0], ctx.P.tRange[1] + 10));
  }
  // اینتروال پیس ماراتن: ۳ تا ۵ کیلومتر با پیس دقیق ماراتن، استراحت کوتاه
  function makeMpInt(main, ctx) {
    var repKm = main >= 13 ? 5 : (main >= 10 ? 4 : 3), reps = clamp(Math.floor(main / repKm + 1e-9), 2, 4), hard = reps * repKm;
    return sess('tempo', T('s.mpInt.variant'), hard, hard + ctx.wu + (reps - 1),
      [T('s.mpInt.main', { reps: reps, km: repKm })],
      T('s.mpInt.how') + paceHint(ctx, T('lbl.pace'), ctx.P.pM - 3, ctx.P.pM + 3));
  }
  // فارتلک درازمدت: یک ران ۶۰ تا ۹۰ دقیقه‌ای با چند بخش ۱۰ دقیقه‌ای پیس ماراتن یا کمی سریع‌تر
  function makeLongFartlek(main, ctx, weeklyKm) {
    var dur = clamp(Math.round(weeklyKm * 1.2 / 5) * 5, 60, 90);
    var n = clamp(Math.floor(main * ctx.P.pM / 600 + 1e-9), 2, Math.floor(dur / 20));
    var hard = n * 600 / ctx.P.pM, easyKm = (dur - n * 10) * 60 / ctx.P.pE;
    return sess('fartlek', T('s.longFartlek.variant'), hard, hard + easyKm,
      [T('s.longFartlek.main', { dur: dur, n: n }), T('s.longFartlek.rest')],
      T('s.longFartlek.how') + paceHint(ctx, T('lbl.paceFastParts'), ctx.P.pM - 5, ctx.P.pM + 3) + T('s.fartlekVsInterval'), { minutes: null });
  }
  // تریل — تپه‌ی بلند: ۴ تا ۸ × ۵ تا ۱۰ دقیقه سربالایی مداوم با تلاش کنترل‌شده، پایین اومدن آروم
  function makeLongHills(main, ctx) {
    var pUp = ctx.P.pE * 1.35, mm = main * pUp / 60;
    var repMin = clamp(Math.round(mm / 6), 5, 10), reps = clamp(Math.round(mm / repMin), 4, 8);
    var hard = reps * repMin * 60 / pUp, vert = round10(reps * repMin * 10);
    return sess('hills', T('s.longHills.variant'), hard, ctx.wu + hard * 2,
      [T('s.longHills.main', { reps: reps, min: repMin }), T('s.longHills.back')],
      T('s.longHills.how', { vert: vert }),
      { vert: vert, rpeOnly: true });
  }
  // تمرین فرود: تکرارهای کوتاه سرازیری کنترل‌شده برای عضلات چهارسر
  function makeDownhill(main, ctx) {
    var reps = clamp(Math.round(main / 0.3), 6, 10), hard = reps * 0.3;
    return sess('hills', T('s.downhill.variant'), hard, ctx.wu + reps * 0.6,
      [T('s.downhill.main', { reps: reps }), T('s.downhill.back')],
      T('s.downhill.how'),
      { rpeOnly: true, descent: reps * 12 });
  }
  // تریل با مسیر نسبتاً تخت — دویدن استیدی بر اساس RPE
  function makeSteady(main, ctx) {
    var pS = ctx.P.pM + 12, min = clamp(Math.round(main * pS / 60), 20, 40), hard = min * 60 / pS;
    return sess('tempo', T('s.steady.variant'), hard, hard + 30 * 60 / ctx.P.pE,
      [T('s.steady.easy15'), T('s.steady.main', { min: min }), T('s.steady.easy15')],
      T('s.steady.how'),
      { rpeOnly: true });
  }
  // سطح ۳-۴ تریل/عمومی: تپه‌ی کوتاه کنترل‌شده
  function makeHillsB(main, ctx) {
    var reps = clamp(Math.round(main / 0.12), 6, 8), hard = reps * 0.12;
    return sess('hills', T('s.hillsB.variant'), hard, Math.max(2, ctx.wu) + reps * 0.25,
      [T('s.hillsB.main', { reps: reps }), T('s.hillsB.back')],
      T('s.hillsB.how'), { vert: reps * 6 });
  }

  function makeQuality(spec, weeklyKm, ctx) {
    var main = weeklyKm * spec.share, s;
    switch (spec.type) {
      case 'shortInt': s = makeShortInt(main, ctx, spec.rep); break;
      case 'midInt': s = makeMidInt(main, ctx, spec.rep); break;
      case 'speedFartlek': s = makeSpeedFartlek(main, ctx, spec.form); break;
      case 'shortHills': s = makeShortHills(main, ctx); break;
      case 'thresholdInt': s = makeThresholdInt(main, ctx); break;
      case 'longInt': s = makeLongInt(main, ctx, spec.rep); break;
      case 'tempoRun': s = makeTempoRun(main, ctx, spec.max); break;
      case 'longTempo': s = makeLongTempo(main, ctx); break;
      case 'mpInt': s = makeMpInt(main, ctx); break;
      case 'longFartlek': s = makeLongFartlek(main, ctx, weeklyKm); break;
      case 'longHills': s = makeLongHills(main, ctx); break;
      case 'downhill': s = makeDownhill(main, ctx); break;
      case 'steady': s = makeSteady(main, ctx); break;
      case 'hillsB': s = makeHillsB(main, ctx); break;
      case 'tempoMild': s = makeTempo(main, ctx.wu, ctx.zones, true); break;
      case 'shortint': s = makeInterval(main, ctx.wu, spec.rep, ctx.zones, 'short'); break;
      case 'reps': s = makeReps(main, ctx.wu, spec.rep, ctx.zones); break;
      default: s = makeTempoRun(main, ctx);
    }
    s.spec = spec; s.specWeekly = weeklyKm;
    attachWarmup(s, QUALITY_CAT[spec.type] || 'tempo', ctx.level);
    if (s.type === 'interval' || s.type === 'reps') s.how += T('s.intervalVsFartlek');
    return s;
  }

  // لانگ‌ران. kind: plain | tempo (بخش‌های تمپو) | mp (پایان با پیس ماراتن) | ultra (زمان روی پا + ارتفاع‌گیری)
  function makeLong(km, ctx, segKm, kind, opts) {
    opts = opts || {};
    var zones = ctx.zones;
    km = round05(km);
    if (kind === 'ultra') {
      var vert = opts.vert || 0, g = ctx.goal || {};
      var tof = km * ctx.P.pE * 1.08 / 60 + vert * 0.06;
      var steps = [(opts.b2b === 'day2' ? T('s.ultraLong.day2Prefix') : '') + T('s.ultraLong.main', { km: km, time: hoursText(tof) })];
      if (vert) steps.push(T('s.ultraLong.vert', { vert: vert }));
      if ((g.ratio || 0) >= 35) steps.push(T('s.ultraLong.hike'));
      steps.push(T('s.ultraLong.fuel'));
      var how = T('s.ultraLong.how');
      if (g.terrain === 'technical') how += T('s.ultraLong.technical');
      if (opts.b2b === 'day2') how += T('s.ultraLong.day2How');
      if (ctx.zones && ctx.zones.hrEasy) how += T('guideLine.hr', { a: ctx.zones.hrEasy[0], b: ctx.zones.hrEasy[1] });
      var su = { type: 'long', km: km, hardKm: 0, target: vert ? T('s.ultraLong.targetVert', { km: km, vert: vert }) : T('s.km', { n: km }), segKm: 0, kind: 'ultra', vert: vert,
        steps: steps, how: how, talk: talkTest(), rpeOnly: true };
      su.variant = opts.b2b ? (opts.b2b === 'day2' ? T('s.ultraLong.vDay2') : T('s.ultraLong.vDay1')) : T('s.ultraLong.vTrail');
      if (opts.b2b) su.b2b = opts.b2b;
      return attachWarmup(su, 'long', ctx.level);
    }
    segKm = segKm > 0 && kind !== 'plain' ? Math.min(floor05(segKm), floor05(km * 0.4)) : 0;
    var st, extra = '';
    if (!segKm) {
      st = [T('s.long.plain', { km: km }), T('s.long.water')];
    } else if (kind === 'mp') {
      st = [T('s.long.easyKm', { km: round05(km - segKm) }), T('s.long.mpEnd', { km: segKm }), T('s.long.mpFuel')];
      extra = paceNote(T('lbl.paceMarathon'), zones && zones.marathon);
    } else {
      var half = floor05(segKm / 2);
      st = segKm >= 3
        ? [T('s.long.easyKm', { km: round05((km - segKm) / 2) }), T('s.long.tempoSplit', { a: half, b: round05(segKm - half) }), T('s.long.restEasy', { km: km })]
        : [T('s.long.easyKm', { km: round05(km - segKm) }), T('s.long.lastTempo', { km: segKm })];
      extra = paceNote(T('lbl.paceTempoPart'), zones && zones.tempo);
    }
    var s = {
      type: 'long', km: km, hardKm: segKm, target: T('s.km', { n: km }), segKm: segKm, kind: segKm ? kind : 'plain',
      steps: st,
      how: rpeLine('long') + easyGuide(zones) + extra,
      talk: talkTest()
    };
    if (segKm) s.variant = kind === 'mp' ? T('s.long.vMp') : T('s.long.vTempo');
    return attachWarmup(s, 'long', ctx.level);
  }

  function makeRest(note) {
    return {
      type: 'rest', km: null, hardKm: 0, target: '—',
      steps: [T('s.rest')],
      how: note || ''
    };
  }

  function makeRace(profile, ctx, level) {
    var race = raceInfo(profile), g = race.goal, fit = currentFitness(profile);
    if (g.type === 'ultra') {
      var how = T('s.race.ultraHow');
      if (fit) {
        // تخمین خیلی تقریبی: هر ۱۰۰ متر صعود ≈ ۱ کیلومتر مسافت معادل، به‌علاوه‌ی ضریب زمین
        var eq = g.km + g.gain / 100, tf = { technical: 1.15, trail: 1.08, gravel: 1.02, mixed: 1.08 }[g.terrain] || 1.08;
        how += T('s.race.ultraEst', { time: hoursText(riegel(fit.entry.timeSec, fit.entry.distanceKm, eq) * tf / 60), km: Math.round(eq) });
      }
      return attachWarmup({ type: 'race', km: round05(g.km), hardKm: g.km, target: goalLabel(g), vert: g.gain, rpeOnly: true,
        steps: T('s.race.ultraSteps').slice(),
        how: how }, 'race', level, 'long');
    }
    var d = RACE_DISTANCES[g.type];
    var steps = T('s.race.steps').slice();
    var h = T('s.race.how');
    if (fit) h += T('s.race.pred', { time: formatDuration(riegel(fit.entry.timeSec, fit.entry.distanceKm, d)) });
    if (level <= 1) h += T('s.race.runwalk');
    var rk = level <= 1 ? 'long' : (g.type === '5' || g.type === '10') ? 'short' : g.type === '21' ? 'half' : 'long';
    return attachWarmup({ type: 'race', km: round05(d), hardKm: d, target: RACE_LABELS[g.type], steps: steps, how: h }, 'race', level, rk);
  }

  // ---------- ساخت هفته ----------
  // هفته‌ی اول برنامه = اولین هفته‌ی کامل (شنبه تا جمعه). اگه کاربر وسط هفته شروع کنه،
  // روزهای باقی‌مونده‌ی همون هفته «هفته‌ی شروع» (index = -1) هستن.
  function planStart(profile) {
    var s = parseDate(profile.startDate);
    return persianDayIndex(s) === 0 ? s : addDays(weekStart(s), 7);
  }
  function weekIndexFor(profile, date) { return Math.floor(daysBetween(planStart(profile), weekStart(date)) / 7); }

  function buildWeek(profile, anyDateInWeek) {
    var a = assessLevel(profile);
    var L = a.info, level = a.level;
    var ws = weekStart(anyDateInWeek);
    var w = weekIndexFor(profile, ws), W = Math.max(0, w);
    var start = parseDate(profile.startDate);
    var zones = paceZones(profile);
    var goal = goalInfo(profile);
    var ultra = goal.category === 'ultra';
    var ctx = { wu: L.wuKm, zones: zones, P: paceSet(profile, level), rpeOnly: ultra, goal: goal, level: level };
    WU_LEVEL = level;
    // گرم و سرد کردن کامل (دویدن آروم + حرکات + استرایدز) برای جلسه‌های کیفی؛ فاصله از زمانش حساب می‌شه
    if (level >= 3) ctx.wu = Math.max(L.wuKm, wuKmFor(level, ctx.P.pE));
    var pr = progression(W);
    var race = raceInfo(profile);
    var avail = (profile.days || []).map(satToRel);
    var nSessions = Math.min(avail.length, L.sessions);
    var sessionDays = chooseSessionDays(avail, nSessions);
    var longDay = sessionDays.indexOf(6) >= 0 ? 6 : sessionDays[sessionDays.length - 1];
    var days = [], weeklyKm = null, template = {}, vol = null, workouts = null, period = null, b2bDay = null;

    // ضریب برگشت بعد از مسابقه برای کل هفته (۰٫۷، ۰٫۷۷، ... تا ۱)
    var rfWeek = race && race.date < ws ? returnFactor(daysBetween(addDays(ws, 6), race.date)) : 1;
    var tier = L.tier;
    // بدون تجربه‌ی تمرین ساختاریافته: ۴ هفته‌ی اول تمرین‌های کیفی در حد گروه B
    if (profile.structured === false && W < 4 && 'CDE'.indexOf(tier) >= 0) tier = 'B';

    if (level === 0) {
      template._zero = zeroStage(profile, W);
      sessionDays.forEach(function (d) { template[d] = { kind: 'walkrun' }; });
    } else if (level === 1) {
      var rw = runWalkMinutes(profile, W, nSessions);
      if (rfWeek < 1) rw.runTotal *= rfWeek;
      sessionDays.forEach(function (d) { template[d] = { kind: 'runwalk' }; });
      template._rw = rw;
    } else {
      // در دوره‌ی برگشت بعد از مسابقه، خود رمپ حجم رو کم کرده؛ هفته‌ی ریکاوری دوره‌ای اعمال نمی‌شه
      var postRace = inPostRaceRamp(profile, ws);
      if (postRace) pr = { deload: false, steps: pr.steps };
      vol = weeklyVolume(profile, W, postRace, a);
      weeklyKm = rfWeek < 1 ? floor05(vol.km * rfWeek) : vol.km;
      period = 'DE'.indexOf(tier) >= 0 ? periodFor(W, ws, race) : null;
      workouts = weekWorkouts(tier, level, W, pr.deload, goal, period);
      // اولین هفته‌ی برگشت بعد از مسابقه: فقط دویدن آسون
      if (rfWeek < 0.75) workouts = { quality: [], long: { kind: ultra ? 'ultra' : 'plain', share: 0 }, strides: false, vertFactor: 0.3 };

      // ران‌های پشت‌سرهم (اولترا): سطح ۵+، پایه‌ی کافی (۵۰+ کیلومتر، بعد از ۴ هفته)، نه در هفته‌ی ریکاوری، دوره‌ی پایه یا نزدیک مسابقه
      var nearRace = race && race.date >= ws && daysBetween(ws, race.date) <= 20;
      if (ultra && level >= 5 && weeklyKm >= 50 && W >= 4 && !pr.deload && rfWeek === 1 && !nearRace &&
          period !== 'base' && nSessions >= 4 && longDay > 0 && avail.indexOf(longDay - 1) >= 0) {
        b2bDay = longDay - 1;
        if (sessionDays.indexOf(b2bDay) < 0) {
          if (sessionDays.length >= L.sessions) {
            var drop = sessionDays.filter(function (d) { return d !== longDay; })
              .sort(function (x, y) { return circDist(x, b2bDay) - circDist(y, b2bDay); })[0];
            sessionDays.splice(sessionDays.indexOf(drop), 1);
          }
          sessionDays.push(b2bDay);
          sessionDays.sort(function (x, y) { return x - y; });
        }
      }
      var hardFixed = b2bDay !== null ? [longDay, b2bDay] : [longDay];
      var specs = nSessions >= 3 ? workouts.quality : [];
      var qDays = specs.length ? placeQuality(sessionDays, hardFixed, specs.length) : [];
      var longShare = nSessions <= 3 ? 0.35 : (nSessions >= 7 ? 0.25 : 0.3);
      if (ultra) longShare = b2bDay !== null ? 0.27 : Math.max(longShare, 0.33);
      var longCap = ultra ? Math.min(L.longCap * 1.2, RACE_LONG_CAP.ultra) : L.longCap;
      if (race && !ultra) longCap = Math.min(longCap, RACE_LONG_CAP[race.key]);
      var longKm = nSessions >= 2 ? round05(Math.min(longCap, weeklyKm * longShare)) : 0;
      var b2bKm = b2bDay !== null ? round05(Math.min(longKm * 0.7, weeklyKm * 0.18)) : 0;
      var longSegKm = nSessions >= 2 && workouts.long.share ? weeklyKm * workouts.long.share : 0;

      // جلسات کیفی به ترتیب منو (اولی زودتر در هفته)؛ اگه روز غیرمجاور کافی نبود، آخری‌ها حذف می‌شن
      var qSessions = {};
      qDays.forEach(function (d, i) { qSessions[d] = makeQuality(specs[i], weeklyKm, ctx); });

      // سقف ۸۰/۲۰: اگه به‌خاطر حداقل تکرارها رد شد، اول بخش تند لانگ‌ران، بعد جلسات آخر منو حذف می‌شن
      var hardBudget = weeklyKm * 0.2;
      var hardSum = function () {
        return Object.keys(qSessions).reduce(function (s, k) { return s + qSessions[k].hardKm; }, 0) +
          Math.min(floor05(longSegKm), floor05(longKm * 0.4));
      };
      if (hardSum() > hardBudget + 1e-9) longSegKm = 0;
      while (hardSum() > hardBudget + 1e-9 && qDays.length) delete qSessions[qDays.pop()];
      var qSum = function () { return Object.keys(qSessions).reduce(function (s, k) { return s + qSessions[k].km; }, 0); };
      while (longKm + b2bKm + qSum() > weeklyKm + 1e-9 && qDays.length) delete qSessions[qDays.pop()];

      var qKm = qSum();
      var easyDays = sessionDays.filter(function (d) { return nSessions < 2 || (d !== longDay && d !== b2bDay && !qSessions[d]); });
      var remaining = weeklyKm - longKm - b2bKm - qKm;
      while (easyDays.length && remaining / easyDays.length < 3) easyDays.splice(easyDays.length - 1, 1);
      if (!easyDays.length && nSessions >= 2 && remaining > 0) { longKm = round05(longKm + remaining); remaining = 0; }
      // لانگ‌ران همیشه از جلسه‌ی آسون بلندتر یا مساویه (مگه اینکه جلسه‌ی آسون دوجلسه‌ای باشه)
      if (easyDays.length && nSessions >= 2 && !workouts.doubles && remaining / easyDays.length > longKm) {
        var pool = longKm + remaining;
        longKm = Math.ceil(pool / (easyDays.length + 1) * 2) / 2;
        remaining = pool - longKm;
      }
      var easyAlloc = {};
      if (easyDays.length) {
        var units = Math.max(0, Math.round(remaining * 2));
        var each = Math.floor(units / easyDays.length);
        easyDays.forEach(function (d, i) { easyAlloc[d] = (each + (i < units - each * easyDays.length ? 1 : 0)) / 2; });
      }
      // ارتفاع‌گیری هدف لانگ‌ران تریل = مسافت × شاخص مسیر × ضریب دوره
      var r = ultra ? (goal.ratio || 0) : 0, vf = workouts.vertFactor || 0.5;
      var longVert = ultra ? Math.min(round10(longKm * r * vf), round10(longKm * 80)) : 0;
      var b2bVert = ultra && b2bKm ? Math.min(round10(b2bKm * r * vf * 0.8), round10(b2bKm * 80)) : 0;

      var hardDays = Object.keys(qSessions).map(Number).concat(nSessions >= 2 ? hardFixed : []);
      var safeEasy = easyDays.filter(function (d) { return hardDays.indexOf((d + 1) % 7) < 0; });
      var accentDay = (workouts.strides || workouts.hills) ? safeEasy[0] : undefined;
      var strengthDays = safeEasy.slice(1).concat(easyDays.filter(function (d) { return safeEasy.indexOf(d) < 0; }))
        .slice(0, workouts.strength || 0);

      sessionDays.forEach(function (d) {
        if (qSessions[d]) template[d] = { session: qSessions[d] };
        else if (b2bDay !== null && d === b2bDay) template[d] = { session: makeLong(longKm, ctx, 0, 'ultra', { vert: longVert, b2b: 'day1' }) };
        else if (d === longDay && nSessions >= 2) {
          template[d] = { session: b2bDay !== null
            ? makeLong(b2bKm, ctx, 0, 'ultra', { vert: b2bVert, b2b: 'day2' })
            : makeLong(longKm, ctx, longSegKm, workouts.long.kind, { vert: longVert }) };
        } else if (easyAlloc[d] !== undefined) {
          var e = makeEasy(easyAlloc[d], zones);
          if (workouts.doubles && e.km >= 14) makeDouble(e);
          if (d === accentDay) (workouts.hills && W % 2 === 1 ? addHills : addStrides)(e);
          if (strengthDays.indexOf(d) >= 0) addStrength(e);
          template[d] = { session: e };
        }
      });
    }

    for (var i = 0; i < 7; i++) {
      var date = addDays(ws, i);
      var s;
      if (date < start) s = { type: 'none', km: null, hardKm: 0, target: '—', steps: [], how: T('s.notStarted') };
      else if (template._zero !== undefined && template[i]) s = makeWalkRun(template._zero);
      else if (template._rw && template[i]) s = makeRunWalk(template._rw, 1);
      else if (template[i]) s = JSON.parse(JSON.stringify(template[i].session));
      else s = makeRest();
      if (race && s.type !== 'none') s = applyRace(profile, s, date, race, ctx, template._rw, level);
      s.date = dateKey(date);
      s.dayName = T('days')[(date.getDay() + 1) % 7];
      s.dayShort = T('daysShort')[(date.getDay() + 1) % 7];
      s.label = TYPE_INFO[s.type].label + (s.variant ? ' (' + s.variant + ')' : '');
      s.hard = isHard(s.type);
      // برای ساخت نسخه‌ی سبک‌تر همین جلسه در تطبیق با چک‌این (ذخیره/کپی نمی‌شه)
      Object.defineProperty(s, '_ctx', { value: ctx, enumerable: false, configurable: true, writable: true });
      days.push(s);
    }

    var totalKm = days.reduce(function (x, s) { return x + (s.km || 0); }, 0);
    var hardKm = days.reduce(function (x, s) { return x + (s.type === 'race' ? 0 : (s.hardKm || 0)); }, 0);
    var totalMin = days.reduce(function (x, s) { return x + (s.minutes || 0); }, 0);
    var vert = days.reduce(function (x, s) { return x + (s.type === 'race' ? 0 : (s.vert || 0)); }, 0);
    return {
      weekIndex: w, start: dateKey(ws), days: days, level: level, tier: tier, goal: goal,
      period: period, periodLabel: period ? PERIOD_LABELS[period] : null,
      phase: weekPhase(profile, ws, pr, w, vol),
      volumeTarget: weeklyKm, b2b: b2bDay !== null,
      zeroStage: level === 0 ? template._zero : null, zeroFinal: ZERO_FINAL,
      totalKm: round05(totalKm), totalMin: totalMin, vert: vert,
      hardPct: totalKm ? Math.round(hardKm / totalKm * 100) : 0
    };
  }

  function weekPhase(profile, ws, pr, w, vol) {
    var race = raceInfo(profile);
    if (w === -1 && addDays(ws, 6) >= parseDate(profile.startDate)) return { key: 'intro', label: T('phase.intro') };
    if (w < 0) return { key: 'before', label: T('phase.before') };
    if (race) {
      var we = addDays(ws, 6);
      var minDaysToRace = daysBetween(we, race.date);
      if (race.date >= ws && race.date <= we) return { key: 'race', label: T('phase.race') };
      if (race.date < ws && daysBetween(race.date, ws) < 7) return { key: 'recovery', label: T('phase.recovery') };
      if (inPostRaceRamp(profile, ws)) return { key: 'return', label: T('phase.return') };
      var taperDays = taperWeeks(race.key) * 7;
      var inTaper = Math.max(0, Math.min(7, taperDays - minDaysToRace + 1));
      if (minDaysToRace > 0 && inTaper >= 3) return { key: 'taper', label: T('phase.taper') };
    }
    if (pr.deload) return { key: 'deload', label: T('phase.deload') };
    if (w === 0) return { key: 'first', label: T('phase.first') };
    if (vol && vol.atCeiling) return { key: 'maintain', label: T('phase.maintain') };
    return { key: 'build', label: T('phase.build') };
  }

  function applyRace(profile, s, date, race, ctx, rw, level) {
    var diff = daysBetween(date, race.date); // روز تا مسابقه
    var zones = ctx.zones;
    if (diff === 0) return makeRace(profile, ctx, level);
    if (s.type === 'walkrun' && (diff > 1 || diff < -3)) return s;
    if (diff === 1) return makeRest(T('s.taper.dayBefore'));
    if (diff < 0 && diff >= -3) return makeRest(T('s.taper.recovery'));
    if (diff < -3 && diff >= -7) {
      if (s.type === 'rest') return s;
      if (rw) return makeRunWalk(rw, 0.5, T('s.taper.recoveryWeekRw'));
      return makeEasy((s.km || 4) * 0.5, zones, T('s.taper.recoveryWeek'));
    }
    // برگشت تدریجی بعد از مسابقه در buildWeek روی حجم کل هفته اعمال می‌شه
    if (diff < 0) return s;
    var f = taperFactor(race.key, diff);
    if (f === 1 || s.type === 'rest') return s;
    var note = T('s.taper.note');
    if (rw) return makeRunWalk(rw, f, note);
    var out;
    if (s.type === 'long') {
      if (diff <= 7) return makeEasy(s.km * f, zones, note);
      out = makeLong(s.km * f, ctx, (s.segKm || 0) * f, s.kind || 'plain', { vert: s.vert ? round10(s.vert * f) : 0 });
    } else if (isHard(s.type) && diff <= 3) {
      var e = makeEasy(Math.min(6, (s.km || 5) * f), zones, note);
      e.steps.push(T('s.taper.raceStrides'));
      return e;
    } else if (s.spec) out = makeQuality(s.spec, s.specWeekly * f, ctx);
    else {
      var ez = makeEasy(s.km * f, zones, note);
      return s.double && ez.km >= 14 ? makeDouble(ez) : ez;
    }
    out.how = note + ' ' + out.how;
    return out;
  }

  function sessionFor(profile, date) {
    return buildWeek(profile, date).days[persianDayIndex(date)];
  }

  // ---------- تطبیق هوشمند با چک‌این روزانه ----------
  // درجه‌بندی‌شده (خفیف / متوسط / جدی) و آگاه از تاریخچه‌ی چند روز اخیر؛ درد همیشه = توقف کامل.
  //  خفیف: خستگی ۳ یا یک شب خواب ضعیف → کاهش کوچک حجم/تکرار، همون نوع جلسه
  //  متوسط: خستگی ۴، دو شب خواب ضعیف یا خستگی ۳ چندروزه → نسخه‌ی سبک‌تر همون جلسه، یا تمپوی ملایم اگه عوامل روی هم جمع شدن
  //  جدی: خستگی ۵، خواب خیلی بد پشت‌سرهم یا خستگی بالای چندروزه → ایزی ران کوتاه یا استراحت فعال
  // هر تصمیم با دلیل (علت → معنی → ریسک → تصمیم) و اثرش روی هفته و هدف توضیح داده می‌شه.
  function poorSleep(c) { return !!c && (c.sleep <= 2 || (c.hours > 0 && c.hours < 6)); }
  function veryPoorSleep(c) { return !!c && (c.sleep === 1 || (c.hours > 0 && c.hours < 5)); }
  // hist: چک‌این روزهای قبل، از دیروز به عقب
  function readiness(ci, hist) {
    var F = Number(ci.fatigue) || 0, i;
    var streak3 = 0, streak4 = 0, sleepStreak = poorSleep(ci) ? 1 : 0;
    for (i = 0; i < hist.length && hist[i] && hist[i].fatigue >= 3; i++) streak3++;
    for (i = 0; i < hist.length && hist[i] && hist[i].fatigue >= 4; i++) streak4++;
    if (sleepStreak) for (i = 0; i < hist.length && poorSleep(hist[i]); i++) sleepStreak++;
    var tier = null;
    if (F >= 5 || (veryPoorSleep(ci) && sleepStreak >= 2) || (F >= 4 && streak4 >= 2) || (sleepStreak >= 3 && F >= 3)) tier = 'severe';
    else if (F === 4 || sleepStreak >= 2 || (F === 3 && streak3 >= 2)) tier = 'moderate';
    else if (F === 3 || poorSleep(ci)) tier = 'mild';
    return {
      tier: tier, F: F, S: Number(ci.sleep) || 0, H: Number(ci.hours) || 0, streak3: streak3, streak4: streak4, sleepStreak: sleepStreak,
      // چند عامل هم‌زمان (خستگی بالا + خواب بد یا خستگی روزهای قبل) → واکنش یک درجه جدی‌تر
      compound: (F >= 4 && (poorSleep(ci) || streak3 >= 1)) || (sleepStreak >= 2 && F >= 3),
      rest: (F >= 5 && poorSleep(ci)) || (F >= 4 && streak4 >= 2) || sleepStreak >= 3,
      fresh: F <= 2 && !poorSleep(ci) && !ci.pain
    };
  }
  function joinList(parts) {
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(T('adapt.comma')) + T('adapt.and') + parts[parts.length - 1];
  }
  function reasonText(r) {
    var p = [];
    if (r.F >= 3) p.push(T('adapt.r.fatigue', { n: r.F }));
    if (r.sleepStreak >= 2) p.push(T('adapt.r.sleepStreak', { n: r.sleepStreak }));
    else if (r.H > 0 && r.H < 6) p.push(T('adapt.r.hours', { n: r.H }));
    else if (r.S && r.S <= 2) p.push(T('adapt.r.sleep', { n: r.S }));
    if (r.streak4 >= 1) p.push(T('adapt.r.streak4', { n: r.streak4 }));
    else if (r.streak3 >= 1 && r.F >= 3) p.push(T('adapt.r.streak3', { n: r.streak3 }));
    return joinList(p);
  }
  // سه چک‌این آخر در ۴ روز گذشته (روز بدون چک‌این، مثلاً روز استراحت، رشته رو قطع نمی‌کنه)
  function histFor(date, checkins, prevCheckin) {
    if (!checkins || !date) return [prevCheckin || null];
    var d = parseDate(date), out = [];
    for (var i = 1; i <= 4 && out.length < 3; i++) { var c = checkins[dateKey(addDays(d, -i))]; if (c) out.push(c); }
    return out;
  }
  var INTENSE = ['interval', 'reps', 'hills', 'fartlek'];
  function withDay(n, s) {
    n.date = s.date; n.dayName = s.dayName; n.dayShort = s.dayShort;
    n.label = TYPE_INFO[n.type].label + (n.variant ? ' (' + n.variant + ')' : '');
    n.hard = isHard(n.type); n.original = s;
    return n;
  }
  // تکرار کوتاه‌تر وقتی تعداد تکرار به حداقل رسیده (مثلاً ۳ × ۱۰۰۰ → ۳ × ۸۰۰)
  var REP_DOWN = { 2000: 1600, 1600: 1200, 1200: 1000, 1000: 800, 800: 600, 600: 400 };
  function rebuild(s, factor, type, rep) {
    var ctx = s._ctx;
    if (!ctx || !s.spec) return null;
    WU_LEVEL = ctx.level;
    var spec = {};
    for (var k in s.spec) spec[k] = s.spec[k];
    if (type) { spec.type = type; delete spec.form; delete spec.rep; }
    if (rep) spec.rep = rep;
    return makeQuality(spec, s.specWeekly * factor, ctx);
  }
  // همون جلسه، سبک‌تر: اول تکرار کمتر، اگه نشد تکرار کوتاه‌تر
  function lighter(s, factor, need) {
    var a = rebuild(s, factor);
    if (a && a.hardKm < s.hardKm * need) return a;
    var rep = s.spec && (s.spec.rep || (s.spec.type === 'midInt' ? 1000 : s.spec.type === 'longInt' ? 1600 : s.spec.type === 'shortInt' ? 400 : 0));
    while (rep && REP_DOWN[rep]) {
      rep = REP_DOWN[rep];
      var b = rebuild(s, factor, null, rep);
      if (b && b.hardKm < s.hardKm * need) return b;
    }
    return null;
  }
  // نسخه‌ی تطبیق‌یافته‌ی جلسه بر اساس درجه؛ { session, act, params } یا null (بدون تغییر ساختاری)
  function adaptedVersion(s, r, zones) {
    var t = s.type, label = s.label;
    var rw = t === 'runwalk' || t === 'walkrun';
    if (r.tier === 'severe') {
      if (r.rest || rw) return { session: { type: 'rest', km: null, hardKm: 0, target: T('cycle.activeRestTarget'), steps: [T('cycle.activeRestStep')], how: T('cycle.activeRestHow') }, act: 'rest' };
      var ekm = Math.max(3, Math.min(t === 'easy' ? (s.km || 5) * 0.6 : 6, (s.km || 5) * 0.5));
      return { session: makeEasy(ekm, zones), act: 'easy', params: { km: round05(Math.max(2, ekm)) } };
    }
    if (rw) return r.tier === 'moderate' ? { session: null, act: 'rwShorter' } : null;
    if (t === 'long') {
      var f = r.tier === 'moderate' ? 0.75 : 0.9;
      var ctx = s._ctx;
      if (!ctx || !s.km) return null;
      var lg = makeLong(s.km * f, ctx, (s.segKm || 0) * f * 0.5, s.kind === 'mp' ? 'plain' : (s.kind || 'plain'), { vert: s.vert ? round10(s.vert * f) : 0 });
      return { session: lg, act: 'shorterLong', params: { km: lg.km, orig: s.km } };
    }
    if (t === 'easy') {
      if (r.tier === 'mild') return null;
      var e = makeEasy((s.km || 5) * 0.8, zones);
      return { session: e, act: 'shorterEasy', params: { km: e.km, orig: s.km } };
    }
    if (s.hard && s.spec) {
      var intense = INTENSE.indexOf(t) >= 0;
      if (r.tier === 'mild') {
        var m = lighter(s, 0.8, 0.9);
        return m ? { session: m, act: 'fewer', params: { label: label }, moreRest: false } : null;
      }
      // متوسط: اگه عوامل روی هم جمع شدن، جلسه‌ی شدید → تمپوی ملایم؛ وگرنه همون جلسه با حجم کمتر و استراحت بیشتر
      if (!r.compound || !intense) {
        var l = lighter(s, 0.6, 0.75);
        if (l) return { session: l, act: 'fewer', params: { label: label }, moreRest: intense };
      }
      // تمپوی ملایم حداقل ۳ کیلومتر (دو تکه با جاگ بین‌شون)
      var mt = rebuild(s, Math.max(intense ? 0.7 : 0.55, 3 / ((s.specWeekly * s.spec.share) || 3)), 'tempoMild');
      if (mt) return { session: mt, act: 'mildTempo', params: { label: label } };
    }
    return null;
  }
  // پیدا کردن روز جبران جزئی در همون هفته: اولین ایزی ران حداقل دو روز بعد، که فرداش جلسه‌ی سخت نیست
  // استراید کوتاهه و قبل از لانگ‌ران هم مشکلی نداره؛ بقیه‌ی افزودنی‌ها نه قبل از هیچ جلسه‌ی سختی
  function makeupDay(week, idx, strides) {
    for (var j = idx + 2; j < 7; j++) {
      var s = week.days[j], next = week.days[j + 1];
      if (s.type === 'easy' && !s.double && (!next || !next.hard || (strides && next.type === 'long'))) return j;
    }
    return -1;
  }
  function isStridesMakeup(orig, adapted) {
    return lostStim(orig, adapted) >= 0.3 && INTENSE.indexOf(orig.type) >= 0;
  }
  // تحریک تمرینی وزن‌دار با شدت (تمپوی ملایم جای اینتروال رو کامل پر نمی‌کنه)
  function stimulus(s) {
    if (!s || !s.hardKm) return 0;
    var w = INTENSE.indexOf(s.type) >= 0 ? 1 : s.type === 'tempo' ? (s.spec && s.spec.type === 'tempoMild' ? 0.5 : 0.8) : s.type === 'long' ? 0.6 : 0;
    return s.hardKm * w;
  }
  function lostStim(orig, adapted) { return Math.max(0, stimulus(orig) - stimulus(adapted)); }
  function makeupWhat(orig, adapted) {
    var lostHard = lostStim(orig, adapted);
    if (lostHard >= 0.3) return INTENSE.indexOf(orig.type) >= 0 ? T('adapt.what.strides') : T('adapt.what.steady');
    var lostKm = (orig.km || 0) - (adapted && adapted.km || 0);
    var x = round05(Math.min(lostKm / 3, 3));
    return x >= 1 ? T('adapt.what.km', { n: x }) : null;
  }
  function weekImpact(profile, s, adapted, r) {
    var date = parseDate(s.date), race = raceInfo(profile);
    var toRace = race ? daysBetween(date, race.date) : null;
    var out = { kind: null, text: '' };
    var lostHard = lostStim(s, adapted), lostKm = (s.km || 0) - (adapted && adapted.km || 0);
    if (toRace !== null && toRace >= 0 && toRace <= 14) out = { kind: 'raceNear', text: T('adapt.impact.raceNear', { n: toRace }) };
    else if (lostHard < 0.3 && lostKm < 1.5) out = { kind: 'tiny', text: T('adapt.impact.tiny') };
    else {
      var week = buildWeek(profile, date), idx = persianDayIndex(date), j = makeupDay(week, idx, isStridesMakeup(s, adapted)), what = makeupWhat(s, adapted);
      if (j >= 0 && what) out = { kind: 'makeup', day: week.days[j].date, text: T('adapt.impact.makeup', { day: week.days[j].dayName, what: what }) };
      else out = { kind: 'noRoom', text: T('adapt.impact.noRoom') };
    }
    if (r.tier === 'severe' || r.streak4 >= 2 || r.sleepStreak >= 3) out.text += T('adapt.impact.persist');
    return out;
  }
  // جبران جزئی روی روز D: اگه یک جلسه‌ی قبلی همین هفته سبک شده و روز جبرانش امروزه و امروز حالت خوبه
  function makeupFor(session, ci, opts) {
    if (!opts || !opts.profile || !opts.checkins || session.type !== 'easy' || !ci) return null;
    var r = readiness(ci, histFor(session.date, opts.checkins));
    if (!r.fresh) return null;
    var d = parseDate(session.date), week = buildWeek(opts.profile, d), idx = persianDayIndex(d);
    for (var i = 0; i < idx - 1; i++) {
      var e = week.days[i], eci = opts.checkins[e.date];
      if (!eci || eci.pain || ['rest', 'none'].indexOf(e.type) >= 0) continue;
      var core = adaptCore(e, eci, histFor(e.date, opts.checkins), paceZones(opts.profile));
      if (!core || !core.changed || !opts.profile) continue;
      if (makeupDay(week, i, isStridesMakeup(e, core.session)) !== idx) continue;
      var what = makeupWhat(e, core.session);
      if (what) return { from: e.dayName, what: what, text: T('adapt.makeupBox.text', { day: e.dayName, what: what }) };
    }
    return null;
  }
  // هسته‌ی تصمیم (بدون اثر هفتگی): { session, changed, r, version }
  function adaptCore(session, checkin, hist, zones) {
    var r = readiness(checkin, hist);
    if (!r.tier || ['rest', 'none', 'race', 'cancelled'].indexOf(session.type) >= 0) return { session: session, changed: false, r: r, version: null };
    var v = adaptedVersion(session, r, zones);
    if (v && v.session) {
      var n = withDay(v.session, session);
      if (v.moreRest) n.steps = n.steps.concat([T('adapt.moreRestStep')]);
      return { session: n, changed: true, r: r, version: v };
    }
    return { session: session, changed: false, r: r, version: v };
  }
  // opts (اختیاری): { profile, checkins } برای تاریخچه، اثر هفتگی و جبران جزئی
  function adaptSession(session, checkin, prevCheckin, zones, opts) {
    if (!checkin) return { session: session, adaptation: null };
    if (checkin.pain) {
      var c = {
        type: 'cancelled', label: TYPE_INFO.cancelled.label, hard: false, km: null, hardKm: 0, target: '—',
        date: session.date, dayName: session.dayName, original: session,
        steps: [T('adapt.noTrain')], how: T('painMessage')
      };
      return { session: c, adaptation: { kind: 'pain', message: T('painMessage') } };
    }
    var hist = histFor(session.date, opts && opts.checkins, prevCheckin);
    var core = adaptCore(session, checkin, hist, zones), r = core.r;
    if (!r.tier) {
      var mk = makeupFor(session, checkin, opts);
      if (mk) {
        var ms = {};
        for (var k in session) ms[k] = session[k];
        ms.makeup = mk;
        return { session: ms, adaptation: null };
      }
      return { session: session, adaptation: null };
    }
    if (session.type === 'rest' || session.type === 'none') return { session: session, adaptation: null };
    var reasons = reasonText(r);
    var why = T('adapt.because', { reasons: reasons });
    if (session.type === 'race') {
      return { session: session, adaptation: { kind: 'caution', tier: r.tier, message: T('adapt.race', { why: reasons }) } };
    }
    var v = core.version, act = v ? v.act : (session.hard ? 'keepHard' : session.type === 'long' ? 'keepLong' : 'keepEasy');
    var meaning = T('adapt.mean.' + r.tier) + ((r.streak3 >= 2 || r.streak4 >= 1 || r.sleepStreak >= 2) && r.tier !== 'mild' ? T('adapt.mean.accum') : '');
    var risk = !core.changed && !v ? '' : r.tier === 'mild' ? (session.hard ? T('adapt.risk.mildHard') : '') :
      T(session.hard && session.type !== 'long' ? 'adapt.risk.hard' : session.type === 'long' ? 'adapt.risk.long' : 'adapt.risk.easy', { label: session.label });
    var p = (v && v.params) || {};
    var main = core.changed && core.session.steps && core.session.steps.length ? core.session.steps[0] : '';
    var action = T('adapt.act.' + act, { label: session.label, main: main, km: p.km, orig: p.orig }) +
      (v && v.moreRest ? T('adapt.act.fewerRest') : '') + (session.double && r.tier !== 'mild' ? T('adapt.act.dropPm') : '');
    var impact = opts && opts.profile && core.changed ? weekImpact(opts.profile, session, core.session, r) : null;
    var ad = {
      kind: core.changed ? 'downgrade' : 'note', tier: r.tier, act: act,
      why: why + ' ' + meaning + (risk ? ' ' + risk : ''), action: action,
      impact: impact ? impact.text : '', impactKind: impact ? impact.kind : null, makeupDay: impact && impact.day || null
    };
    ad.message = ad.why + ' ' + ad.action + (ad.impact ? ' ' + ad.impact : '');
    return { session: core.session, adaptation: ad };
  }
  // خلاصه‌ی هفته: جلسه‌های این هفته تا امروز (با چک‌این یا انجام‌شده) طبق برنامه / تعدیل‌شده
  function weekAdaptSummary(profile, checkins, done, date) {
    date = parseDate(dateKey(date));
    var week = buildWeek(profile, date), zones = paceZones(profile), a = 0, b = 0;
    week.days.forEach(function (s) {
      if (s.date > dateKey(date) || ['rest', 'none'].indexOf(s.type) >= 0) return;
      var ci = checkins[s.date];
      if (!ci && !(done && done[s.date])) return;
      if (ci && ci.pain) { b++; return; }
      var r = ci ? adaptSession(s, ci, null, zones, { checkins: checkins }) : null;
      if (r && r.adaptation && r.adaptation.kind === 'downgrade') b++; else a++;
    });
    var g = goalInfo(profile), race = raceInfo(profile);
    var goal = race ? T('adapt.goal.race', { race: goalLabel(g), date: I18N.date(race.date) }) : T('adapt.goal.general');
    var text = T('adapt.summary.line', { a: T('adapt.summary.n', { n: a }), b: T('adapt.summary.n', { n: b }) }) +
      T(b >= 3 ? 'adapt.summary.many' : 'adapt.summary.ok', { goal: goal });
    return { asPlanned: a, adapted: b, text: text };
  }

  // ---------- چرخه‌ی قاعدگی (اختیاری؛ فقط با رضایت و داده‌ی خود کاربر) ----------
  // فاز تخمینی هر روز از تاریخ شروع آخرین پریود، طول چرخه و طول پریود:
  //  period (روز ۱ تا P؛ روز ۱ و ۲ = heavy) → follicular → ovulation (حدود ۱۴ روز قبل از پریود بعدی، ±۲ روز)
  //  → luteal → lateLuteal (۵ روز آخر). برنامه هیچ‌وقت خودکار عوض نمی‌شه؛ فقط پیشنهاد می‌ده.
  function cycleSettings(profile) {
    var c = profile && profile.cycle;
    if (!c || !c.enabled || !c.lastStart || profile.sex !== 'female') return null;
    var L = clamp(Number(c.cycleLen) || 28, 21, 45), P = clamp(Number(c.periodLen) || 5, 2, 10);
    return { start: parseDate(c.lastStart), L: L, P: Math.min(P, L - 10) };
  }
  function cycleInfo(profile, date) {
    var c = cycleSettings(profile);
    if (!c) return null;
    var k = ((daysBetween(c.start, date) % c.L) + c.L) % c.L;  // روز چرخه از ۰
    var ov = c.L - 14;
    var phase = k < c.P ? 'period' : (k >= ov - 2 && k <= ov + 1) ? 'ovulation' : k < ov - 2 ? 'follicular' : k >= c.L - 5 ? 'lateLuteal' : 'luteal';
    return { phase: phase, day: k + 1, heavy: phase === 'period' && k < 2, length: c.L, nextStart: addDays(date, c.L - k) };
  }
  // شروع پریود بعدی (اگه امروز روز پریوده، شروع پریود فعلی هم برگردونده می‌شه)
  function nextPeriod(profile, today) {
    var info = cycleInfo(profile, today);
    if (!info) return null;
    return { date: info.phase === 'period' ? addDays(today, -(info.day - 1)) : info.nextStart, inPeriod: info.phase === 'period', day: info.day,
      next: info.nextStart, daysTo: info.phase === 'period' ? 0 : daysBetween(today, info.nextStart) };
  }
  // پیشنهاد تطبیق برای یک جلسه‌ی سخت؛ خودِ کاربر تصمیم می‌گیره (adapt / rest / keep)
  function cycleSuggestion(session, info, zones) {
    if (!info || !session || !session.hard || session.type === 'race') return null;
    if (info.phase !== 'period' && info.phase !== 'lateLuteal') return null;
    var km = session.km ? Math.max(Math.min(4, session.km), round05(session.km * (info.heavy ? 0.5 : 0.65))) : 4;
    var alt = makeEasy(km, zones || null, T(info.phase === 'period' ? 'cycle.altNote' : 'cycle.altNoteLuteal'));
    var rest = info.phase === 'period' ? { type: 'rest', km: null, hardKm: 0, target: T('cycle.activeRestTarget'), steps: [T('cycle.activeRestStep')], how: T('cycle.activeRestHow') } : null;
    return { phase: info.phase, heavy: info.heavy, day: info.day, alt: alt, rest: rest };
  }
  var CYCLE_PHASES = ['period', 'follicular', 'ovulation', 'luteal', 'lateLuteal'];

  // ---------- هشدارهای پروفایل ----------
  function profileWarnings(profile, today) {
    var out = [];
    var a = assessLevel(profile); // یادداشت‌های سطح (مثل پیام احتیاط) توی کارت سطح نشون داده می‌شن
    if (profile.structured === false && 'CDE'.indexOf(a.info.tier) >= 0)
      out.push(T('warn.structured'));
    var race = raceInfo(profile), goal = goalInfo(profile);
    if (race) {
      var weeks = Math.floor(daysBetween(today, race.date) / 7);
      var need = minPrepWeeks(goal, a.level);
      if (daysBetween(today, race.date) >= 0 && weeks < need) {
        out.push(T('warn.prep', { weeks: weeks, n: weeks, level: a.level, name: a.info.name, goal: goalLabel(goal), need: need }));
      }
    }
    if (goal.category === 'ultra') {
      if (a.level <= 4) out.push(T('warn.ultraEarly', { level: a.level }));
      if (goal.altitude >= 2000) out.push(T('warn.altitude', { alt: goal.altitude }));
      if (goal.netDownhill) out.push(T('warn.downhill'));
    }
    if (a.volume && a.volume.reason === 'injury') out.push(T('warn.recentInjury'));
    if (a.volume && a.volume.reason === 'illness') out.push(T('warn.recentIllness'));
    if (profile.injury && profile.injury.trim())
      out.push(T('warn.injury'));
    if (profile.age >= 50) out.push(T('warn.age50'));
    if (profile.age < 18) out.push(T('warn.under18'));
    if (bmi(profile) >= 30) out.push(T('warn.bmi'));
    if ((profile.days || []).length < 2) out.push(T('warn.oneDay'));
    if (a.level >= 9) out.push(T('warn.elite', { level: a.level }));
    return out;
  }

  var LOCATION_TIPS = i18nMap(['park', 'gym', 'treadmill', 'road'], 'location.tips');
  var LOCATION_LABELS = i18nMap(['park', 'gym', 'treadmill', 'road'], 'location.labels');

  // =====================================================================
  // آنالیز پیشرفت: همه از داده‌ی واقعی کاربر (جلسه‌های انجام‌شده، چک‌این‌ها، RPE بعد از جلسه، رکوردها)
  // =====================================================================
  // RPE پیش‌فرض هر نوع جلسه (اگه کاربر بعد از جلسه RPE ثبت نکرده باشه)
  var LOAD_RPE = { easy: 3.5, long: 4.5, runwalk: 3, walkrun: 2.5, tempo: 7, interval: 8, reps: 8, fartlek: 7, hills: 7, race: 9 };
  // نسبت پیس میانگین جلسه به پیس ایزی (برای تخمین مدت از کیلومتر)
  var LOAD_PACE = { tempo: 0.9, interval: 0.92, reps: 0.95, fartlek: 0.95, hills: 1.05, race: 0.85 };
  var CTL_DAYS = 42, ATL_DAYS = 7;
  function isRunType(t) { return !!t && ['rest', 'none', 'cancelled'].indexOf(t) < 0; }
  function sessionMinutes(s, pE) {
    if (!s) return 0;
    if (s.minutes) return s.minutes;
    return s.km ? s.km * pE * (LOAD_PACE[s.type] || 1) / 60 : 0;
  }
  // بار تمرینی جلسه = مدت (دقیقه) × RPE (روش session-RPE فاستر)
  function sessionLoad(s, rpe, pE) {
    if (!s || !isRunType(s.type)) return 0;
    var r = Number(rpe) || (s.type === 'race' && s.rpeOnly ? 7 : LOAD_RPE[s.type]) || 4;
    return sessionMinutes(s, pE) * r;
  }
  // خلاصه‌ی فشرده‌ی یک جلسه برای ذخیره موقع «انجام شد» (تا تاریخچه با تغییر بعدی پروفایل عوض نشه)
  function sessionSnapshot(s) {
    if (!s) return null;
    var o = { type: s.type, km: s.km || 0 };
    if (s.minutes) o.minutes = s.minutes;
    if (s.vert) o.vert = s.vert;
    if (s.rpeOnly) o.rpeOnly = true;
    return o;
  }
  // وضعیت واقعی هر روز: برنامه، تطبیق با چک‌این و انتخاب چرخه، انجام شدن
  function dayRecords(data, from, to) {
    var p = data.profile, zones = paceZones(p), weeks = {}, out = [];
    var checkins = data.checkins || {}, done = data.done || {}, logs = data.doneLog || {}, choices = data.cycleChoices || {};
    for (var d = from; d <= to; d = addDays(d, 1)) {
      var k = dateKey(d), wk = dateKey(weekStart(d));
      if (!weeks[wk]) weeks[wk] = buildWeek(p, d);
      var base = weeks[wk].days[persianDayIndex(d)];
      var ci = checkins[k], r = adaptSession(base, ci, checkins[dateKey(addDays(d, -1))], zones, { checkins: checkins });
      var eff = r.session, adapted = !!(r.adaptation && r.adaptation.kind === 'downgrade');
      var ch = choices[k];
      if ((ch === 'adapt' || ch === 'rest') && eff.type !== 'cancelled') {
        var sug = cycleSuggestion(eff, cycleInfo(p, d), zones);
        var alt = sug && (ch === 'adapt' ? sug.alt : sug.rest);
        if (alt) { eff = alt; adapted = true; }
      }
      var isDone = !!done[k];
      out.push({ date: k, d: d, planned: base, eff: eff, adapted: adapted, pain: !!(ci && ci.pain), done: isDone,
        actual: isDone ? (logs[k] || eff) : null, checkin: ci || null });
    }
    return out;
  }
  function firstDataDate(data) {
    var p = data.profile, keys = Object.keys(data.done || {}).concat(Object.keys(data.checkins || {}));
    var first = p.startDate || dateKey(new Date());
    keys.forEach(function (k) { if (k < first) first = k; });
    return parseDate(first);
  }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  // range: تعداد روز آخر (۲۸، ۹۱) یا null برای «از ابتدا»
  function analytics(data, today, rangeDays) {
    var p = data.profile;
    if (!p) return null;
    today = parseDate(dateKey(today));
    var start = firstDataDate(data);
    if (start > today) start = today;
    var from = rangeDays ? addDays(today, -(rangeDays - 1)) : start;
    if (from < start) from = start;
    var fromKey = dateKey(from), todayKey = dateKey(today);
    var level = assessLevel(p).level, P = paceSet(p, level), pE = P.pE || 390;
    var recs = dayRecords(data, start, today);
    var postRuns = data.postRuns || {};

    // ---- بار تمرینی، CTL / ATL / TSB (میانگین نمایی؛ مقدار اولیه از حجم قبلی خود کاربر) ----
    var priorKm = Number(p.monthAvgKm) || Number(p.currentWeeklyKm) || 0;
    var seed = priorKm * pE / 60 * 4 / 7;
    var kC = 1 - Math.exp(-1 / CTL_DAYS), kA = 1 - Math.exp(-1 / ATL_DAYS), ctl = seed, atl = seed;
    var pmc = [];
    recs.forEach(function (r) {
      var post = postRuns[r.date];
      var load = r.actual ? sessionLoad(r.actual, post && post.rpe, pE) : 0;
      r.load = load;
      ctl += (load - ctl) * kC;
      atl += (load - atl) * kA;
      if (r.date >= fromKey) pmc.push({ date: r.date, load: Math.round(load), ctl: ctl, atl: atl, tsb: ctl - atl });
    });

    // ---- حجم و صعود هفتگی + میانگین متحرک ۴ هفته (فقط هفته‌های کامل) ----
    var weekMap = {}, weekKeys = [];
    recs.forEach(function (r) {
      var wk = dateKey(weekStart(r.d));
      if (!weekMap[wk]) { weekMap[wk] = { start: wk, km: 0, vert: 0, runs: 0 }; weekKeys.push(wk); }
      if (r.actual && isRunType(r.actual.type)) {
        weekMap[wk].km += r.actual.km || 0;
        weekMap[wk].vert += r.actual.vert || 0;
        weekMap[wk].runs++;
      }
    });
    var curWeek = dateKey(weekStart(today));
    var allWeeks = weekKeys.map(function (k) { var w = weekMap[k]; w.km = Math.round(w.km * 10) / 10; w.partial = k === curWeek; return w; });
    allWeeks.forEach(function (w, i) {
      var full = allWeeks.slice(Math.max(0, i - 3), i + 1).filter(function (x) { return !x.partial; });
      w.maKm = !w.partial && i >= 3 ? mean(full.map(function (x) { return x.km; })) : null;
      w.maVert = !w.partial && i >= 3 ? mean(full.map(function (x) { return x.vert; })) : null;
    });
    var fromWeek = dateKey(weekStart(from));
    var weeks = allWeeks.filter(function (w) { return w.start >= fromWeek; });

    // ---- پیس در شدت‌های مختلف و پیش‌بینی مسابقه (از رکوردها و تایم‌تست‌ها) ----
    var entries = fitnessEntries(p).map(function (e) { return { date: e.date, distanceKm: e.distanceKm, timeSec: e.timeSec, kind: e.kind || null, vdot: vdotFromRace(e.distanceKm, e.timeSec) }; });
    var adj = clamp(Number(p.easyAdjustSec) || 0, 0, EASY_ADJUST_MAX);
    function entryAt(k) { var e = null; entries.forEach(function (x) { if (x.date <= k) e = x; }); return e; }
    function pacesOf(v) { return { e: paceAtPct(v, 0.70) + adj, t: paceAtPct(v, 0.88), i: paceAtPct(v, 0.98) }; }
    var g = goalInfo(p), D = g.category !== 'ultra' ? RACE_DISTANCES[g.type] : null;
    // نمونه‌ی هفتگی (آخر هر هفته یا امروز)
    var samples = weeks.map(function (w) {
      var end = addDays(parseDate(w.start), 6), k = end > today ? todayKey : dateKey(end);
      var e = entryAt(k);
      if (!e) return { date: k, week: w.start, vdot: null };
      var pc = pacesOf(e.vdot);
      return { date: k, week: w.start, vdot: e.vdot, e: pc.e, t: pc.t, i: pc.i, entry: e.date,
        riegel: D ? riegel(e.timeSec, e.distanceKm, D) : null, vdotTime: D ? raceTimeFromVdot(e.vdot, D) : null };
    });
    var testsInRange = entries.filter(function (e) { return e.date >= fromKey && e.date <= todayKey; });

    // ---- چک‌این‌ها ----
    var checks = recs.filter(function (r) { return r.date >= fromKey && r.checkin; }).map(function (r) {
      return { date: r.date, fatigue: Number(r.checkin.fatigue) || null, sleep: Number(r.checkin.sleep) || null, pain: !!r.checkin.pain };
    });

    // ---- پایبندی: جلسه‌های برنامه‌ریزی‌شده‌ی گذشته (امروز فقط اگه انجام یا لغو شده) ----
    var adh = { planned: 0, completed: 0, adapted: 0, pain: 0, missed: 0 };
    recs.forEach(function (r) {
      if (r.date < fromKey || r.date < (p.startDate || '') || !isRunType(r.planned && r.planned.type)) return;
      if (r.date === todayKey && !r.done && !r.pain) return;
      adh.planned++;
      if (r.pain) adh.pain++;
      else if (r.done) adh[r.adapted ? 'adapted' : 'completed']++;
      else adh.missed++;
    });

    return {
      from: fromKey, today: todayKey, start: dateKey(start), days: Math.round(daysBetween(from, today)) + 1,
      runsDone: recs.filter(function (r) { return r.date >= fromKey && r.actual && isRunType(r.actual.type); }).length,
      weeks: weeks, pmc: pmc, samples: samples, tests: testsInRange, entriesCount: entries.length,
      checkins: checks, adherence: adh,
      goal: { type: g.type, category: g.category, km: D || g.km || null, ultra: g.category === 'ultra' },
      paceKnown: entries.length > 0
    };
  }

  var api = {
    LEVELS: LEVELS, EXPERIENCE: EXPERIENCE, TIER_INFO: TIER_INFO, PERIOD_LABELS: PERIOD_LABELS,
    RACE_DISTANCES: RACE_DISTANCES, RACE_LABELS: RACE_LABELS,
    TYPE_INFO: TYPE_INFO, LOCATION_TIPS: LOCATION_TIPS, LOCATION_LABELS: LOCATION_LABELS,
    dateKey: dateKey, parseDate: parseDate, addDays: addDays, weekStart: weekStart, daysBetween: daysBetween,
    persianDayIndex: persianDayIndex, dayIndex: persianDayIndex, setWeekStart: setWeekStart, getWeekStart: getWeekStart, satToRel: satToRel, parseTime: parseTime, formatDuration: formatDuration, describeDuration: describeDuration,
    riegel: riegel, vdotFromRace: vdotFromRace, raceTimeFromVdot: raceTimeFromVdot,
    levelFromKm: levelFromKm, levelFromVdot: levelFromVdot, assessLevel: assessLevel,
    paceZones: paceZones, bmi: bmi, progression: progression, weeklyVolumeKm: weeklyVolumeKm,
    weeklyVolume: weeklyVolume, volumeCeiling: volumeCeiling, weekWorkouts: weekWorkouts, periodFor: periodFor,
    chooseSessionDays: chooseSessionDays, placeQuality: placeQuality, circDist: circDist,
    buildWeek: buildWeek, sessionFor: sessionFor, adaptSession: adaptSession, isHard: isHard, readiness: readiness, weekAdaptSummary: weekAdaptSummary,
    currentFitness: currentFitness, fitnessEntries: fitnessEntries, hrZones: hrZones, easyRunFeedback: easyRunFeedback,
    easyRpeTrend: easyRpeTrend, easyDayHint: easyDayHint, fitnessReminder: fitnessReminder,
    fitnessLevelSuggestion: fitnessLevelSuggestion,
    EASY_ADJUST_MAX: EASY_ADJUST_MAX,
    profileWarnings: profileWarnings, raceInfo: raceInfo, taperWeeks: taperWeeks,
    goalInfo: goalInfo, goalLabel: goalLabel, GOAL_TYPES: GOAL_TYPES, TERRAIN_LABELS: TERRAIN_LABELS,
    cycleInfo: cycleInfo, nextPeriod: nextPeriod, cycleSuggestion: cycleSuggestion, CYCLE_PHASES: CYCLE_PHASES,
    ZERO_FINAL: ZERO_FINAL, zeroStage: zeroStage, volumeInfo: volumeInfo, volumeGap: volumeGap,
    ULTRA_CLASS_INFO: ULTRA_CLASS_INFO, ultraClass: ultraClass, minPrepWeeks: minPrepWeeks, paceSet: paceSet,
    analytics: analytics, sessionLoad: sessionLoad, sessionSnapshot: sessionSnapshot, CTL_DAYS: CTL_DAYS, ATL_DAYS: ATL_DAYS
  };
  // متن‌هایی که به زبان فعلی بستگی دارن، موقع خوندن ترجمه می‌شن
  Object.defineProperty(api, 'DAY_NAMES', { enumerable: true, get: dayNames });
  Object.defineProperty(api, 'WEEK_ORDER', { enumerable: true, get: weekOrder });
  Object.defineProperty(api, 'DAY_SHORT', { enumerable: true, get: function () { return T('daysShort'); } });
  Object.defineProperty(api, 'PAIN_MESSAGE', { enumerable: true, get: function () { return T('painMessage'); } });
  Object.defineProperty(api, 'TALK_TEST', { enumerable: true, get: talkTest });
  Object.defineProperty(api, 'EASY_RPE_WARNING', { enumerable: true, get: function () { return T('easyRpeWarning'); } });
  api.i18n = I18N;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachLogic = api;
})(this);
