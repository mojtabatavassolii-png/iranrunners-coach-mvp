/*
 * ایران رانرز — مربی خودت باش (MVP)
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

  // ---------- تاریخ (همه‌چیز با تاریخ محلی، بدون UTC) ----------
  // ایندکس روزهای هفته به ترتیب ایرانی: ۰=شنبه ... ۶=جمعه
  var DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) {
    var p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function persianDayIndex(d) { return (d.getDay() + 1) % 7; }
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
    if (h) parts.push(h + ' ساعت');
    if (m) parts.push(m + ' دقیقه');
    if (x) parts.push(x + ' ثانیه');
    return parts.join(' و ');
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
  var LEVELS = [
    null,
    { n: 1, name: 'کاملاً مبتدی', km: [0, 15], marathon: [hms(5, 30), Infinity], tier: 'A', sessions: 3, longCap: 10, wuKm: 0, maxKm: 25,
      desc: 'بدون سابقه‌ی دویدن منظم یا کمتر از سه ماه سابقه' },
    { n: 2, name: 'مبتدی', km: [15, 25], marathon: [hms(5, 0), hms(5, 30)], tier: 'A', sessions: 4, longCap: 12, wuKm: 0, maxKm: 35,
      desc: 'سه تا دوازده ماه سابقه‌ی دویدن منظم' },
    { n: 3, name: 'تازه‌کار پیشرفته', km: [25, 35], marathon: [hms(4, 30), hms(5, 0)], tier: 'B', sessions: 4, longCap: 16, wuKm: 2, maxKm: 45,
      desc: 'بیش از یک سال سابقه، اولین مسابقه‌ها رو رفته' },
    { n: 4, name: 'متوسط پایین', km: [35, 50], marathon: [hms(4, 0), hms(4, 30)], tier: 'B', sessions: 5, longCap: 20, wuKm: 2, maxKm: 60,
      desc: 'چند مسابقه رفته، ساختار تمرینی داره' },
    { n: 5, name: 'متوسط', km: [50, 65], marathon: [hms(3, 40), hms(4, 0)], tier: 'C', sessions: 5, longCap: 24, wuKm: 3, maxKm: 75,
      desc: 'چند سال تمرین منظم، آشنا با پیس‌های تمرینی' },
    { n: 6, name: 'متوسط بالا', km: [65, 80], marathon: [hms(3, 20), hms(3, 40)], tier: 'C', sessions: 6, longCap: 28, wuKm: 3, maxKm: 90,
      desc: 'رقابتی در سطح محلی، تمرین ساختاریافته با تناوب شدت' },
    { n: 7, name: 'پیشرفته', km: [80, 100], marathon: [hms(3, 0), hms(3, 20)], tier: 'D', sessions: 6, longCap: 32, wuKm: 4, maxKm: 110,
      desc: 'چندین سال تمرین جدی، شرکت منظم در مسابقات' },
    { n: 8, name: 'پیشرفته بالا / نیمه‌حرفه‌ای', km: [100, 130], marathon: [hms(2, 40), hms(3, 0)], tier: 'D', sessions: 7, longCap: 35, wuKm: 4, maxKm: 140,
      desc: 'سابقه‌ی رقابتی جدی، احتمالاً با مربی اختصاصی' },
    { n: 9, name: 'زیرِ الیت', km: [130, 170], marathon: [hms(2, 20), hms(2, 40)], tier: 'E', sessions: 7, longCap: 38, wuKm: 5, maxKm: 180,
      desc: 'رقابت در سطح ملی' },
    { n: 10, name: 'الیت جهانی', km: [170, Infinity], marathon: [0, hms(2, 20)], tier: 'E', sessions: 7, longCap: 40, wuKm: 5, maxKm: 220,
      desc: 'دونده‌ی حرفه‌ای بین‌المللی، اسپانسر یا تیم ملی' }
  ];

  var EXPERIENCE = {
    lt3m: { label: 'کمتر از سه ماه' },
    '3to12m': { label: 'سه تا دوازده ماه' },
    '1to3y': { label: 'یک تا سه سال' },
    gt3y: { label: 'بیش از سه سال' }
  };

  var TIER_INFO = {
    A: 'فقط دو-پیاده (run-walk) و ایزی ران؛ بدون اینتروال و تمپو.',
    B: 'ایزی ران غالب، یک تمپوی ملایم در هفته و اینتروال‌های خیلی کوتاه (۲۰۰ تا ۴۰۰ متر) با استراحت طولانی.',
    C: 'ترکیب کامل ایزی، تمپو، اینتروال ساختاریافته (۴۰۰ تا ۱۰۰۰ متر) و لانگ‌ران با بخش‌های تمپو.',
    D: 'برنامه‌ی دوره‌بندی‌شده (پایه/ساخت/اوج) با تمرین‌های دنیلز: تکرار (R)، VO2max (I)، آستانه (T) و پیس ماراتن (M).',
    E: 'برنامه‌ی حرفه‌ای با روزهای دوجلسه‌ای، اسپرینت سربالایی و تمرین قدرتی، و مدیریت دقیق ریکاوری.'
  };

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
   * تعیین سطح:
   *  ۱) سطح تقریبی از حجم فعلی، محدود به سابقه و تجربه‌ی تمرین ساختاریافته
   *  ۲) اگه رکورد وارد شده: VDOT → سطح. رکورد اولویت داره (فیتنس واقعی)
   *  ۳) اگه رکورد خیلی سریع‌تر از حجم باشه (۲+ سطح فاصله): افزایش حجم با احتیاط
   */
  function assessLevel(profile) {
    var km = Number(profile.currentWeeklyKm) || 0;
    var exp = profile.experience || 'gt3y';
    var structured = profile.structured !== false;
    var volLevel = levelFromKm(km);
    var capped = Math.min(volLevel, experienceCap(exp, km));
    if (!structured) capped = Math.min(capped, 4);
    var notes = [];
    if (capped < volLevel) {
      notes.push(!structured && volLevel > 4 && experienceCap(exp, km) > 4
        ? 'چون هنوز تمرین ساختاریافته (اینتروال/تمپو) انجام ندادی، سطح از ' + volLevel + ' به ' + capped + ' محدود شد.'
        : 'با توجه به سابقه‌ی دویدنت (' + EXPERIENCE[exp].label + ')، سطح از ' + volLevel + ' به ' + capped + ' محدود شد.');
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
        out.notes.push('برنامه‌ات را با احتیاط حجم رو افزایش می‌دیم چون حجم فعلیت با سرعتت هم‌خوانی نداره.');
      } else if (pbLevel <= volLevel - 2) {
        out.notes.push('سطحت بر اساس رکوردت تعیین شد که فیتنس واقعی رو بهتر نشون می‌ده. حجم فعلیت حفظ می‌شه، ولی شدت تمرین‌ها با سرعتت تنظیم شده.');
      }
    }
    out.info = LEVELS[out.level];
    return out;
  }

  // ---------- هدف مسابقه ----------
  var RACE_DISTANCES = { '5': 5, '10': 10, '21': 21.0975, '42': 42.195 };
  var RACE_LABELS = { '5': '۵ کیلومتر', '10': '۱۰ کیلومتر', '21': 'نیمه‌ماراتن (۲۱.۱ کیلومتر)', '42': 'ماراتن (۴۲.۲ کیلومتر)' };
  var GOAL_TYPES = { none: 'بدون هدف مشخص', '5': '۵ کیلومتر', '10': '۱۰ کیلومتر', '21': 'نیمه‌ماراتن', '42': 'ماراتن', ultra: 'اولترا و تریل' };
  var TERRAIN_LABELS = { technical: 'کوهستانی فنی', trail: 'تریل ساده', gravel: 'جاده‌ی شنی', mixed: 'ترکیبی' };
  var RACE_LONG_CAP = { '5': 22, '10': 25, '21': 28, '42': 40, ultra: 45 };

  // شاخص «فنی بودن مسیر» = متر صعود ÷ کیلومتر
  function ultraClass(ratio) { return ratio < 15 ? 'flat' : ratio < 35 ? 'rolling' : ratio < 60 ? 'hilly' : 'mountain'; }
  var ULTRA_CLASS_INFO = {
    flat: { label: 'تقریباً تخت (کمتر از ۱۵ متر صعود در هر کیلومتر)', emphasis: 'استقامت پایه و دویدن با سرعت ثابت؛ تمرین تپه کمتر' },
    rolling: { label: 'تپه‌ماهوری (۱۵ تا ۳۵ متر در کیلومتر)', emphasis: 'ترکیب متعادل استقامت با سرعت ثابت و تمرین تپه' },
    hilly: { label: 'تپه‌ای/کوهستانی (۳۵ تا ۶۰ متر در کیلومتر)', emphasis: 'تمرین تپه‌ی بلند و قدرت پا در اولویت، به‌علاوه‌ی تمرین فرود' },
    mountain: { label: 'کوهستانی سنگین (بیش از ۶۰ متر در کیلومتر)', emphasis: 'بیشترین تمرکز روی تپه، راه‌رفتن تند در سربالایی (power hike)، فرود و قدرت' }
  };

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
    return 'اولترا/تریل ' + g.km + ' کیلومتر، ' + g.gain + ' متر صعود';
  }

  // حداقل هفته‌های آماده‌سازی توصیه‌شده (ایندکس = سطح - ۱)
  var MIN_PREP_WEEKS = {
    '5': [8, 6, 4, 3, 2, 2, 2, 2, 2, 2],
    '10': [14, 10, 8, 6, 4, 4, 3, 2, 2, 2],
    '21': [26, 18, 14, 10, 8, 8, 6, 6, 6, 6],
    '42': [40, 30, 24, 18, 16, 16, 14, 12, 12, 12]
  };
  function minPrepWeeks(g, level) {
    if (g.type !== 'ultra') return MIN_PREP_WEEKS[g.type][level - 1];
    var w = [44, 36, 30, 24, 20, 18, 16, 14, 12, 12][level - 1];
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
    rest: { label: 'استراحت', hard: false },
    easy: { label: 'ایزی ران', hard: false },
    runwalk: { label: 'ایزی ران (دو-پیاده)', hard: false },
    tempo: { label: 'تمپو', hard: true },
    interval: { label: 'اینتروال', hard: true },
    reps: { label: 'تکرار سرعتی', hard: true },
    fartlek: { label: 'فارتلک', hard: true },
    hills: { label: 'تپه', hard: true },
    long: { label: 'لانگ ران', hard: true },
    race: { label: 'روز مسابقه', hard: true },
    cancelled: { label: 'لغو شد', hard: false },
    none: { label: 'قبل از شروع', hard: false }
  };
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
    return formatDuration(range[0]) + ' تا ' + formatDuration(range[1]) + ' دقیقه در هر کیلومتر';
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
  var TALK_TEST = 'تست حرف زدن: باید بتونی در حین دویدن به‌راحتی و بدون نفس‌نفس زدن صحبت کنی. اگر نمی‌تونی، سرعتت رو کم کن، حتی اگر از پیس هدف کندتر بشه.';
  var EASY_RPE_WARNING = 'به نظر می‌رسه این پیس الان برات ایزی نیست. پیشنهاد می‌کنیم پیس ایزی رو کمی کندتر تنظیم کنیم یا یک تایم‌تست تازه ثبت کنی.';

  // بازخورد بعد از جلسه‌ی ایزی. pace: 'ok' (داخل بازه یا کندتر) | 'fast' (تندتر از بازه) | 'unknown'
  function easyRunFeedback(post, sessionType) {
    if (!post || !(post.rpe >= 1)) return null;
    if (post.rpe <= 6) return { kind: 'ok', message: 'عالی؛ این همون شدتیه که دویدن ایزی باید داشته باشه.' };
    if (sessionType === 'runwalk') return { kind: 'runwalk', message: 'این جلسه برات سخت بود. دفعه‌ی بعد تکه‌های پیاده‌روی رو طولانی‌تر و دویدن رو آهسته‌تر کن؛ اگه تکرار شد، یه هفته همون مرحله رو تکرار کن.' };
    if (post.pace === 'fast') return { kind: 'fast', message: 'سرعتت از بازه‌ی ایزی بیشتر بوده و برای همین سخت شده. دفعه‌ی بعد داخل بازه یا حتی کندتر بدو؛ ایزی ران باید آسون باشه.' };
    if (post.pace === 'ok') return { kind: 'warn', message: EASY_RPE_WARNING };
    return { kind: 'check', message: 'این جلسه برای «ایزی» زیادی سخت بود. دفعه‌ی بعد با تست حرف زدن سرعتت رو تنظیم کن و پیست رو هم نگاه کن.' };
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
      ? { side: 'slow', message: 'با توجه به خستگی/خواب امروز، نیمه‌ی کند بازه (یا حتی کندتر) رو هدف بگیر.' }
      : { side: 'any', message: 'امروز هر جای بازه که با تست حرف زدن جور باشه خوبه؛ در هوای گرم (بالای ۲۵ درجه) نیمه‌ی کند بازه رو بدو.' };
  }

  // یادآوری تایم‌تست
  function fitnessReminder(profile, today) {
    var fit = currentFitness(profile);
    if (!fit) return { kind: 'none', message: 'هنوز رکورد یا تایم‌تستی ثبت نکردی. با یه تایم‌تست ۲ یا ۵ کیلومتری، پیس‌های تمرینی (از جمله بازه‌ی ایزی) دقیق محاسبه می‌شن.' };
    var weeks = Math.floor(daysBetween(parseDate(fit.entry.date), today) / 7);
    if (weeks >= FITNESS_STALE_WEEKS) return { kind: 'stale', weeks: weeks, message: 'آخرین تایم‌تست یا رکوردت ' + weeks + ' هفته پیش بوده. فیتنس در این مدت عوض می‌شه؛ یه تایم‌تست تازه ثبت کن تا پیس‌ها به‌روز بشن (پیشنهاد: هر ۴ تا ۶ هفته).' };
    return null;
  }

  // آیا فیتنس فعلی به سطح دیگه‌ای رسیده؟ (برنامه خودکار سطح عوض نمی‌کنه تا حجم پرش نکنه؛ به کاربر پیشنهاد می‌ده)
  function fitnessLevelSuggestion(profile) {
    var fit = currentFitness(profile);
    if (!fit || fit.entry.kind === 'baseline') return null;
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

  function startKm(profile) { return Math.max(5, floor05(Number(profile.currentWeeklyKm) || 0)); }

  // سقف رشد: حالت عادی = حجم فعلی × ضریب احتیاط، محدود به سقف سطح.
  // حالت احتیاط (رکورد خیلی سریع‌تر از حجم): حداکثر ۳۰٪ بالاتر و نه بیشتر از کف حجم سطح. هیچ‌وقت کمتر از حجم فعلی نیست.
  function volumeCeiling(profile, a) {
    a = a || assessLevel(profile);
    var s = startKm(profile);
    var cap = a.cautious ? Math.min(s * 1.3, Math.max(s, a.info.km[0])) : Math.min(s * growthLimit(profile), a.info.maxKm);
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
    var km = Number(profile.currentWeeklyKm) || 0;
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
  var PERIOD_LABELS = { base: 'دوره‌ی پایه', build: 'دوره‌ی ساخت', peak: 'دوره‌ی اوج' };

  // چرخه‌های هفتگی هر دسته (گروه C و دوره‌ی ساخت D/E). long: نوع لانگ‌ران و سهم بخش تندش
  var ROTATIONS = {
    // بدون هدف: چرخش بین اینتروال کوتاه، تمپو، فارتلک، تپه و آستانه تا سیستم‌های انرژی مختلف تحریک بشن
    general: [
      { q: [Q('shortInt', 0.08, { rep: 400 }), Q('tempoRun', 0.08)] },
      { q: [Q('speedFartlek', 0.07, { form: 'oneone' }), Q('thresholdInt', 0.08)] },
      { q: [Q('midInt', 0.08, { rep: 1000 }), Q('tempoRun', 0.08)] },
      { q: [Q('shortHills', 0.04), Q('longInt', 0.08, { rep: 1600 })], long: { kind: 'tempo', share: 0.04 } },
      { q: [Q('shortInt', 0.08, { rep: 800 }), Q('thresholdInt', 0.08)] },
      { q: [Q('speedFartlek', 0.07, { form: 'pyramid' }), Q('tempoRun', 0.08)] }
    ],
    // ۵ و ۱۰ کیلومتر: VO2max و سرعت
    speed: [
      { q: [Q('shortInt', 0.08, { rep: 400 }), Q('tempoRun', 0.07)] },
      { q: [Q('midInt', 0.08, { rep: 1000 }), Q('speedFartlek', 0.07, { form: 'pyramid' })] },
      { q: [Q('shortInt', 0.08, { rep: 800 }), Q('shortHills', 0.04)], long: { kind: 'tempo', share: 0.04 } },
      { q: [Q('midInt', 0.08, { rep: 1600 }), Q('speedFartlek', 0.07, { form: 'oneone' })] }
    ],
    // نیمه‌ماراتن: آستانه + VO2max
    half: [
      { q: [Q('thresholdInt', 0.08), Q('longInt', 0.08, { rep: 1600 })] },
      { q: [Q('longInt', 0.08, { rep: 2000 }), Q('tempoRun', 0.09, { max: 40 })] },
      { q: [Q('thresholdInt', 0.08), Q('speedFartlek', 0.05, { form: 'oneone' })], long: { kind: 'tempo', share: 0.05 } }
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
  function rpeLine(t) {
    return {
      easy: 'شدت: آسون (RPE ۳-۴ از ۱۰). باید بتونی جمله‌ی کامل بگی.',
      long: 'شدت: آسون و یکنواخت (RPE ۴ از ۱۰). هدف مسافته، نه سرعت.',
      tempo: 'شدت: آستانه، «سخت ولی قابل کنترل» (RPE ۷ از ۱۰). فقط چند کلمه می‌تونی بگی.',
      interval: 'شدت: سخت (RPE ۸ از ۱۰)، ولی همه‌ی تکرارها با سرعت یکسان.',
      reps: 'شدت: سریع و روان (RPE ۸ از ۱۰)؛ تمرکز روی فرم و سرعت، با ریکاوری کامل بین تکرارها.'
    }[t];
  }
  function paceNote(label, range) { return range ? ' ' + label + ': ' + paceText(range) + '.' : ''; }
  // راهنمای شدت ایزی: بازه‌ی پیس (نه یک عدد) + ضربان هدف (اگه داریم)
  function easyGuide(zones) {
    if (!zones) return '';
    var out = '';
    if (zones.easy) out += ' بازه‌ی پیس ایزی: ' + paceText(zones.easy) + ' (حد تندتر برای روزهای خوب، حد کندتر برای گرما، خستگی یا خواب بد).';
    if (zones.hrEasy) out += ' ضربان هدف: ' + zones.hrEasy[0] + ' تا ' + zones.hrEasy[1] + ' ضربه در دقیقه.';
    return out;
  }

  function makeRunWalk(rw, factor, extraNote) {
    var runTotal = rw.runTotal * factor;
    var reps = Math.max(4, Math.round(runTotal / rw.run));
    var total = 10 + reps * (rw.run + rw.walk);
    return {
      type: 'runwalk', minutes: Math.round(total), km: null, hardKm: 0,
      target: Math.round(total) + ' دقیقه',
      steps: ['۵ دقیقه پیاده‌روی تند برای گرم کردن',
        reps + ' بار: ' + rw.run + ' دقیقه دویدن خیلی آرام + ' + rw.walk + ' دقیقه پیاده‌روی',
        '۵ دقیقه پیاده‌روی آرام برای سرد کردن'],
      how: 'دویدن اون‌قدر آرام که نفس‌نفس نزنی. اگه یه تکرار سخت بود، پیاده‌روی رو طولانی‌تر کن — این شکست نیست، بخشی از برنامه‌ست.' + (extraNote ? ' ' + extraNote : ''),
      talk: TALK_TEST, easyEffort: true
    };
  }

  function makeEasy(km, zones, note) {
    km = Math.max(2, round05(km));
    return {
      type: 'easy', km: km, hardKm: 0, target: km + ' کیلومتر',
      steps: [km + ' کیلومتر دویدن پیوسته و آرام'],
      how: rpeLine('easy') + easyGuide(zones) + (note ? ' ' + note : ''),
      talk: TALK_TEST, easyEffort: true
    };
  }

  // روز دوجلسه‌ای (سطح ۹-۱۰): صبح ۶۰٪، عصر ۴۰٪، هر دو آسون
  function makeDouble(s) {
    var am = round05(s.km * 0.6), pm = round05(s.km - am);
    s.double = { am: am, pm: pm };
    s.variant = 'دوجلسه‌ای';
    s.target = am + ' + ' + pm + ' کیلومتر';
    s.steps = ['صبح: ' + am + ' کیلومتر دویدن آسون', 'عصر: ' + pm + ' کیلومتر دویدن آسون'].concat(s.steps.slice(1));
    s.how += ' بین دو جلسه حداقل ۶ ساعت فاصله بذار و بینشون خوب غذا بخور.';
    return s;
  }

  function addStrides(s) {
    s.steps.push('در انتها ۶ × ۲۰ ثانیه سرعت روان و کنترل‌شده (استرایدز)، بین هر کدوم ریکاوری کامل');
    s.strides = true;
    return s;
  }
  function addHills(s) {
    s.steps.push('در انتها ۸ × ۱۰ ثانیه اسپرینت سربالایی (شیب تند)، با ۲ دقیقه ریکاوری کامل');
    s.hills = true;
    return s;
  }
  function addStrength(s) {
    s.steps.push('+ ۳۰ تا ۴۰ دقیقه تمرین قدرتی و پلایومتریک (اسکوات، ددلیفت سبک، لانج، پرش‌های کوتاه)');
    s.strength = true;
    return s;
  }

  function makeTempo(mainKm, wuKm, zones, mild) {
    mainKm = Math.min(mild ? 6 : 12, Math.max(1.5, floor05(mainKm)));
    var half = wuKm / 2;
    var main = mild && mainKm >= 3
      ? [floor05(mainKm / 2) + ' کیلومتر ریتم تمپو، ۲ دقیقه جاگ، ' + round05(mainKm - floor05(mainKm / 2)) + ' کیلومتر ریتم تمپو']
      : [mainKm + ' کیلومتر پیوسته با پیس آستانه (T)'];
    var s = {
      type: 'tempo', km: round05(mainKm + wuKm), hardKm: mainKm, target: round05(mainKm + wuKm) + ' کیلومتر', mild: !!mild,
      steps: (half ? [half + ' کیلومتر گرم کردن آسون'] : []).concat(main, half ? [half + ' کیلومتر سرد کردن آسون'] : []),
      how: (mild ? 'تمپوی ملایم: کمی آهسته‌تر از تمپوی کامل (RPE ۶-۷ از ۱۰).' : rpeLine('tempo')) + paceNote('پیس', zones && zones.tempo)
    };
    s.variant = mild ? 'ملایم' : 'آستانه، T';
    return s;
  }

  // کروز اینتروال دنیلز: تکرارهای ۱٫۶ کیلومتری با پیس آستانه و ۱ دقیقه استراحت
  function makeCruise(mainKm, wuKm, zones) {
    var reps = Math.min(6, Math.max(2, Math.floor(mainKm / 1.6 + 1e-9)));
    var hardKm = round05(reps * 1.6), half = wuKm / 2;
    return {
      type: 'tempo', km: round05(hardKm + wuKm + reps * 0.2), hardKm: hardKm, cruise: true, variant: 'کروز اینتروال، T',
      target: round05(hardKm + wuKm + reps * 0.2) + ' کیلومتر',
      steps: [half + ' کیلومتر گرم کردن آسون', reps + ' × ۱٫۶ کیلومتر با پیس آستانه (T)، بین هر تکرار ۱ دقیقه استراحت', half + ' کیلومتر سرد کردن آسون'],
      how: rpeLine('tempo') + paceNote('پیس T', zones && zones.tempo)
    };
  }

  // اینتروال. kind: short (سطح ۳-۴: کوتاه با استراحت طولانی) | struct (سطح ۵-۶) | daniels (VO2max، سطح ۷+)
  function makeInterval(mainKm, wuKm, rep, zones, kind) {
    var maxReps = { 200: 12, 400: kind === 'short' ? 8 : 16, 800: 10, 1000: 8, 1200: 6 }[rep] || 10;
    var minReps = kind === 'short' ? 4 : 3;
    var reps = Math.min(maxReps, Math.max(minReps, Math.floor(mainKm * 1000 / rep + 1e-9)));
    var hardKm = reps * rep / 1000, half = wuKm / 2;
    var rest = kind === 'short' ? '۲ تا ۳ دقیقه پیاده‌روی یا جاگ خیلی آرام' :
      kind === 'daniels' ? 'جاگ آرام هم‌زمان با مدت تکرار' :
      (rep <= 400 ? '۹۰ ثانیه جاگ آرام' : (rep === 800 ? '۲ تا ۳ دقیقه جاگ آرام' : '۳ دقیقه جاگ آرام'));
    var total = round05(hardKm + wuKm + reps * (rep >= 800 ? 0.3 : 0.2));
    var s = {
      type: 'interval', km: total, hardKm: hardKm, rep: rep, kind: kind || 'struct', target: total + ' کیلومتر',
      steps: [(half ? half + ' کیلومتر گرم کردن + ' : '۱۰ دقیقه دویدن آرام + ') + '۴ سرعت کوتاه ۲۰ ثانیه‌ای',
        reps + ' × ' + rep + ' متر، بین هر تکرار ' + rest,
        half ? half + ' کیلومتر سرد کردن آسون' : '۱۰ دقیقه دویدن آرام'],
      how: (kind === 'short' ? 'تکرارها تند ولی کنترل‌شده (RPE ۷-۸ از ۱۰)، نه تمام‌توان. استراحت طولانی عمدیه.' : rpeLine('interval')) +
        paceNote(kind === 'daniels' ? 'پیس I' : 'پیس تکرارها', zones && zones.interval)
    };
    s.variant = kind === 'short' ? 'کوتاه' : (kind === 'daniels' ? 'VO2max، I' : null);
    return s;
  }

  // تکرار سرعتی دنیلز (R): ۲۰۰/۴۰۰ متر با ریکاوری کامل
  function makeReps(mainKm, wuKm, rep, zones) {
    var reps = Math.min(rep === 200 ? 12 : 8, Math.max(6, Math.floor(mainKm * 1000 / rep + 1e-9)));
    var hardKm = reps * rep / 1000, half = wuKm / 2;
    var total = round05(hardKm * 2 + wuKm);
    return {
      type: 'reps', km: total, hardKm: hardKm, rep: rep, variant: 'پیس R', target: total + ' کیلومتر',
      steps: [half + ' کیلومتر گرم کردن + ۴ سرعت کوتاه', reps + ' × ' + rep + ' متر با پیس R، بین هر تکرار ' + rep + ' متر جاگ آرام (ریکاوری کامل)', half + ' کیلومتر سرد کردن آسون'],
      how: rpeLine('reps') + paceNote('پیس R', zones && zones.reps)
    };
  }

  function makeFartlek(mainKm, wuKm, zones) {
    var reps = Math.min(12, Math.max(4, Math.floor(mainKm / 0.4 + 1e-9)));
    var hardKm = round05(reps * 0.4), half = wuKm / 2;
    var total = round05(hardKm + wuKm + reps * 0.3);
    return {
      type: 'fartlek', km: total, hardKm: hardKm, target: total + ' کیلومتر',
      steps: [half + ' کیلومتر گرم کردن آسون', reps + ' بار: ۲ دقیقه تند (حس ریتم ۱۰ کیلومتر) + ۲ دقیقه دویدن آرام', half + ' کیلومتر سرد کردن آسون'],
      how: 'فارتلک یعنی «بازی با سرعت»: تکه‌های تند با حس، نه با ساعت. شدت تکه‌های تند RPE ۷-۸ از ۱۰.' + paceNote('پیس تقریبی تکه‌های تند', zones && zones.tempo)
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
      pT: paceAtPct(v, 0.88), pE: paceAtPct(v, 0.70) + adj };
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function round10(x) { return Math.round(x / 10) * 10; }
  function hoursText(min) {
    min = Math.round(min / 5) * 5;
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + ' ساعت' : '') + (h && m ? ' و ' : '') + (m ? m + ' دقیقه' : '');
  }
  // پیس فقط وقتی نشون داده می‌شه که از تایم‌تست واقعی باشه، و نه در تمرین‌های تریل (اون‌جا RPE و زمان ملاکه)
  function paceHint(ctx, label, a, b) {
    if (!ctx.P.known || ctx.rpeOnly) return '';
    return ' ' + label + ': ' + formatDuration(a) + (b ? ' تا ' + formatDuration(b) : '') + ' دقیقه در کیلومتر.';
  }
  function wuStep(ctx) { var h = ctx.wu / 2; return (h ? h + ' کیلومتر گرم کردن آسون' : '۱۰ دقیقه دویدن آرام') + ' + ۴ سرعت کوتاه ۲۰ ثانیه‌ای'; }
  function cdStep(ctx) { var h = ctx.wu / 2; return h ? h + ' کیلومتر سرد کردن آسون' : '۱۰ دقیقه دویدن آرام'; }
  function sess(type, variant, hardKm, totalKm, steps, how, extra) {
    var km = Math.max(round05(totalKm), round05(hardKm));
    var s = { type: type, variant: variant, km: km, hardKm: r1(hardKm), target: km + ' کیلومتر', steps: steps, how: how };
    for (var k in extra) s[k] = extra[k];
    return s;
  }

  // ۵/۱۰ کیلومتر — اینتروال کوتاه: ۴۰۰ تا ۸۰۰ متر با پیس ۵ کیلومتر، استراحت برابر یا کمی بیشتر
  function makeShortInt(main, ctx, rep) {
    rep = rep || 400;
    var reps = clamp(Math.floor(main * 1000 / rep + 1e-9), 4, { 400: 16, 600: 12, 800: 10 }[rep] || 10);
    var hard = reps * rep / 1000, jog = hard * ctx.P.p5 / ctx.P.pE * 1.1;
    return sess('interval', 'کوتاه، پیس ۵ کیلومتر', hard, hard + ctx.wu + jog,
      [wuStep(ctx), reps + ' × ' + rep + ' متر با پیس ۵ کیلومتر؛ استراحت: جاگ آرام هم‌زمان با تکرار یا کمی بیشتر', cdStep(ctx)],
      'شدت: VO2max (RPE ۸ از ۱۰)؛ همه‌ی تکرارها با سرعت یکسان، آخری هم نباید تمام‌توان باشه.' + paceHint(ctx, 'پیس ۵ کیلومتر', ctx.P.p5),
      { rep: rep, kind: 'short5k' });
  }
  // اینتروال متوسط: ۱۰۰۰ تا ۱۶۰۰ متر با پیس بین ۵ تا ۱۰ کیلومتر، استراحت ۲ تا ۳ دقیقه
  function makeMidInt(main, ctx, rep) {
    rep = rep || 1000;
    var reps = clamp(Math.floor(main * 1000 / rep + 1e-9), 3, { 1000: 8, 1200: 6, 1600: 5 }[rep] || 6);
    var hard = reps * rep / 1000;
    return sess('interval', 'متوسط، پیس ۵ تا ۱۰ کیلومتر', hard, hard + ctx.wu + reps * 0.4,
      [wuStep(ctx), reps + ' × ' + rep + ' متر با پیسی بین ۵ و ۱۰ کیلومتر؛ بین هر تکرار ۲ تا ۳ دقیقه جاگ آرام', cdStep(ctx)],
      'شدت: سخت (RPE ۸ از ۱۰)، یکنواخت از اول تا آخر.' + paceHint(ctx, 'پیس', ctx.P.p5, ctx.P.p10),
      { rep: rep, kind: 'mid' });
  }
  // فارتلک سرعتی: ۱ دقیقه تند / ۱ دقیقه ایزی، یا هرمی ۱-۲-۳-۴-۳-۲-۱
  function makeSpeedFartlek(main, ctx, form) {
    var pF = (ctx.P.p5 + ctx.P.p10) / 2, hardMin, recMin, step, variant;
    if (form === 'pyramid') {
      var full = main * pF / 60 >= 14;
      hardMin = full ? 16 : 9; recMin = full ? 6 : 4;
      step = full ? 'هرمی: ۱-۲-۳-۴-۳-۲-۱ دقیقه تند، بین هر تکه ۱ دقیقه ایزی' : 'هرمی کوتاه: ۱-۲-۳-۲-۱ دقیقه تند، بین هر تکه ۱ دقیقه ایزی';
      variant = 'هرمی';
    } else {
      hardMin = clamp(Math.round(main * pF / 60), 6, 15); recMin = hardMin;
      step = hardMin + ' بار: ۱ دقیقه تند + ۱ دقیقه ایزی';
      variant = 'سرعتی ۱-۱';
    }
    var hard = hardMin * 60 / pF;
    return sess('fartlek', variant, hard, hard + recMin * 60 / ctx.P.pE + ctx.wu, [wuStep(ctx), step, cdStep(ctx)],
      'تکه‌های تند بین پیس ۵ و ۱۰ کیلومتر (RPE ۷-۸)، دقیقه‌های ایزی واقعاً آسون.' + paceHint(ctx, 'پیس تکه‌های تند', ctx.P.p5, ctx.P.p10),
      { form: form });
  }
  // تپه‌ی کوتاه: ۸ تا ۱۲ تکرار سرعتی حدود ۱۰۰ متر، برگشت با پیاده‌روی
  function makeShortHills(main, ctx) {
    var reps = clamp(Math.round(main / 0.1), 8, 12), hard = reps * 0.1;
    return sess('hills', 'تپه‌ی کوتاه', hard, ctx.wu + reps * 0.2,
      [wuStep(ctx), reps + ' × حدود ۱۰۰ متر دویدن تند روی سربالایی کوتاه (شیب ۶ تا ۱۰٪)؛ برگشت با پیاده‌روی', cdStep(ctx)],
      'شدت: تند و قدرتی (RPE ۸-۹) با فرم خوب: قدم کوتاه، زانو بالا، دست‌ها فعال. ریکاوری کامل با پیاده‌روی.',
      { vert: reps * 8 });
  }
  // نیمه‌ماراتن — اینتروال آستانه: ۳ تا ۴ × ۸ تا ۱۰ دقیقه، استراحت ۹۰ ثانیه تا ۲ دقیقه
  function makeThresholdInt(main, ctx) {
    var mm = main * ctx.P.pT / 60, reps = mm >= 32 ? 4 : 3, repMin = clamp(Math.round(mm / reps), 8, 10);
    var hard = reps * repMin * 60 / ctx.P.pT;
    return sess('tempo', 'اینتروال آستانه', hard, hard + ctx.wu + reps * 0.3,
      [wuStep(ctx), reps + ' × ' + repMin + ' دقیقه با پیس آستانه؛ بین هر تکرار ۹۰ ثانیه تا ۲ دقیقه جاگ آرام', cdStep(ctx)],
      rpeLine('tempo') + paceHint(ctx, 'پیس آستانه', ctx.P.pT - 4, ctx.P.pT + 6), { thresholdInt: true });
  }
  // اینتروال بلند: ۱۶۰۰ تا ۲۰۰۰ متر با پیس بین ۱۰ کیلومتر و نیمه‌ماراتن
  function makeLongInt(main, ctx, rep) {
    rep = rep || 1600;
    var reps = clamp(Math.floor(main * 1000 / rep + 1e-9), 3, rep >= 2000 ? 5 : 6), hard = reps * rep / 1000;
    return sess('interval', 'بلند', hard, hard + ctx.wu + reps * 0.4,
      [wuStep(ctx), reps + ' × ' + rep + ' متر با پیسی بین ۱۰ کیلومتر و نیمه‌ماراتن؛ بین هر تکرار ۲ تا ۳ دقیقه جاگ', cdStep(ctx)],
      'شدت: سخت ولی پایدار (RPE ۷-۸).' + paceHint(ctx, 'پیس', ctx.P.p10, ctx.P.pHM), { rep: rep, kind: 'long' });
  }
  // تمپوی پیوسته: ۲۰ تا ۴۰ دقیقه با پیس آستانه
  function makeTempoRun(main, ctx, maxMin) {
    var min = clamp(Math.round(main * ctx.P.pT / 60), 20, maxMin || 40), hard = min * 60 / ctx.P.pT;
    return sess('tempo', 'پیوسته', hard, hard + ctx.wu,
      [wuStep(ctx), min + ' دقیقه دویدن پیوسته با پیس آستانه (پیسی که حدوداً یک ساعت قابل حفظه)', cdStep(ctx)],
      (ctx.rpeOnly ? 'شدت: «سخت ولی قابل کنترل» (RPE ۷ از ۱۰)؛ ملاک تلاشه، نه پیس.' : rpeLine('tempo')) + paceHint(ctx, 'پیس آستانه', ctx.P.pT - 4, ctx.P.pT + 6));
  }
  // ماراتن — تمپوی پیوسته‌ی بلند: ۳۰ تا ۵۰ دقیقه با پیس آستانه یا کمی کندتر
  function makeLongTempo(main, ctx) {
    var p = ctx.P.pT + 8, min = clamp(Math.round(main * p / 60), 30, 50), hard = min * 60 / p;
    return sess('tempo', 'پیوسته‌ی بلند', hard, hard + ctx.wu,
      [wuStep(ctx), min + ' دقیقه پیوسته با پیس آستانه یا کمی کندتر', cdStep(ctx)],
      'شدت: RPE ۶-۷؛ ریتمی که می‌تونی بدون افت تا آخر نگهش داری.' + paceHint(ctx, 'پیس', ctx.P.pT, ctx.P.pT + 15));
  }
  // اینتروال پیس ماراتن: ۳ تا ۵ کیلومتر با پیس دقیق ماراتن، استراحت کوتاه
  function makeMpInt(main, ctx) {
    var repKm = main >= 13 ? 5 : (main >= 10 ? 4 : 3), reps = clamp(Math.floor(main / repKm + 1e-9), 2, 4), hard = reps * repKm;
    return sess('tempo', 'اینتروال پیس ماراتن', hard, hard + ctx.wu + (reps - 1),
      [wuStep(ctx), reps + ' × ' + repKm + ' کیلومتر با پیس دقیق ماراتن؛ بین هر تکرار ۱ کیلومتر دویدن آسون', cdStep(ctx)],
      'هدف: یاد گرفتن ریتم دقیق مسابقه؛ نه تندتر، نه کندتر (RPE ۶-۷).' + paceHint(ctx, 'پیس ماراتن', ctx.P.pM - 3, ctx.P.pM + 3));
  }
  // فارتلک درازمدت: یک ران ۶۰ تا ۹۰ دقیقه‌ای با چند بخش ۱۰ دقیقه‌ای پیس ماراتن یا کمی سریع‌تر
  function makeLongFartlek(main, ctx, weeklyKm) {
    var dur = clamp(Math.round(weeklyKm * 1.2 / 5) * 5, 60, 90);
    var n = clamp(Math.floor(main * ctx.P.pM / 600 + 1e-9), 2, Math.floor(dur / 20));
    var hard = n * 600 / ctx.P.pM, easyKm = (dur - n * 10) * 60 / ctx.P.pE;
    return sess('fartlek', 'درازمدت', hard, hard + easyKm,
      [dur + ' دقیقه دویدن که داخلش ' + n + ' بخش ۱۰ دقیقه‌ای با پیس ماراتن یا کمی سریع‌تر داره', 'بین بخش‌ها حداقل ۵ دقیقه آسون؛ ۱۵ دقیقه‌ی اول و ۱۰ دقیقه‌ی آخر آسون'],
      'بخش‌های تند با ریتم مسابقه (RPE ۶-۷)؛ تمرین حفظ ریتم با خستگی.' + paceHint(ctx, 'پیس ماراتن', ctx.P.pM - 5, ctx.P.pM + 3), { minutes: null });
  }
  // تریل — تپه‌ی بلند: ۴ تا ۸ × ۵ تا ۱۰ دقیقه سربالایی مداوم با تلاش کنترل‌شده، پایین اومدن آروم
  function makeLongHills(main, ctx) {
    var pUp = ctx.P.pE * 1.35, mm = main * pUp / 60;
    var repMin = clamp(Math.round(mm / 6), 5, 10), reps = clamp(Math.round(mm / repMin), 4, 8);
    var hard = reps * repMin * 60 / pUp, vert = round10(reps * repMin * 10);
    return sess('hills', 'تپه‌ی بلند', hard, ctx.wu + hard * 2,
      [wuStep(ctx), reps + ' × ' + repMin + ' دقیقه دویدن سربالایی مداوم با تلاش کنترل‌شده (RPE ۶-۷، نه اسپرینت)', 'برگشت: پایین اومدن آروم (جاگ یا پیاده) به‌عنوان ریکاوری', cdStep(ctx)],
      'شدت با تلاش ادراک‌شده و زمان تعریف می‌شه، نه پیس. نفس کنترل‌شده بمونه؛ اگه شیب خیلی تنده، تند راه رفتن (power hike) مجازه. صعود تقریبی: ' + vert + ' متر.',
      { vert: vert, rpeOnly: true });
  }
  // تمرین فرود: تکرارهای کوتاه سرازیری کنترل‌شده برای عضلات چهارسر
  function makeDownhill(main, ctx) {
    var reps = clamp(Math.round(main / 0.3), 6, 10), hard = reps * 0.3;
    return sess('hills', 'فرود (سرازیری)', hard, ctx.wu + reps * 0.6,
      [wuStep(ctx), reps + ' × ۶۰ تا ۹۰ ثانیه سرازیری کنترل‌شده روی شیب ملایم (۴ تا ۸٪)', 'برگشت به بالا با پیاده‌روی یا جاگ خیلی آرام', cdStep(ctx)],
      'هدف: آماده کردن عضلات چهارسر برای فشار سرازیری. قدم کوتاه و سریع، بدن کمی رو به جلو، فرود نرم؛ سرعت کنترل‌شده، نه رها (RPE ۶). کوفتگی ران در روزهای بعد طبیعیه؛ اولین بار با ۶ تکرار شروع کن.',
      { rpeOnly: true, descent: reps * 12 });
  }
  // تریل با مسیر نسبتاً تخت — دویدن استیدی بر اساس RPE
  function makeSteady(main, ctx) {
    var pS = ctx.P.pM + 12, min = clamp(Math.round(main * pS / 60), 20, 40), hard = min * 60 / pS;
    return sess('tempo', 'استیدی', hard, hard + 30 * 60 / ctx.P.pE,
      ['۱۵ دقیقه آسون', min + ' دقیقه با تلاش «استیدی» (RPE ۵-۶): کمی سخت‌تر از ایزی، هنوز می‌تونی جمله‌های کوتاه بگی', '۱۵ دقیقه آسون'],
      'ملاک تلاش و زمانه، نه پیس؛ روی زمین ناهموار پیس قابل اعتماد نیست. هدف، نگه داشتن یک ریتم پایدار برای مدت طولانیه.',
      { rpeOnly: true });
  }
  // سطح ۳-۴ تریل/عمومی: تپه‌ی کوتاه کنترل‌شده
  function makeHillsB(main, ctx) {
    var reps = clamp(Math.round(main / 0.12), 6, 8), hard = reps * 0.12;
    return sess('hills', 'تپه‌ی کوتاه کنترل‌شده', hard, Math.max(2, ctx.wu) + reps * 0.25,
      ['۱۰ دقیقه دویدن آرام', reps + ' × ۳۰ تا ۴۵ ثانیه سربالایی با تلاش کنترل‌شده (RPE ۶-۷)', 'برگشت با پیاده‌روی کامل', '۱۰ دقیقه دویدن آرام'],
      'تپه‌ی کوتاه قدرت پا رو بدون فشار سرعت بالا می‌سازه. تلاش کنترل‌شده، نه تمام‌توان.', { vert: reps * 6 });
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
      var steps = [(opts.b2b === 'day2' ? 'روز دوم پشت‌سرهم، با پاهای خسته از دیروز: ' : '') + km + ' کیلومتر روی تریل یا مسیر ناهموار، حدود ' + hoursText(tof) + ' روی پا'];
      if (vert) steps.push('ارتفاع‌گیری تجمعی هدف: حدود ' + vert + ' متر (اگه تپه‌ی بزرگ نداری، یه سربالایی رو چند بار تکرار کن)');
      if ((g.ratio || 0) >= 35) steps.push('سربالایی‌های تند رو تند راه برو (power hike)؛ این مهارت مسابقه‌ست، نه ضعف');
      steps.push('هر ۳۰ تا ۴۵ دقیقه بخور و بنوش، همون چیزی که روز مسابقه استفاده می‌کنی');
      var how = 'شدت: آسون و بر اساس تلاش (RPE ۴-۵)، نه پیس؛ روی زمین ناهموار پیس قابل اعتماد نیست. هدف، زمان روی پا و ارتفاع‌گیریه.';
      if (g.terrain === 'technical') how += ' مسیر مسابقه فنیه؛ اگه می‌تونی روی تریل سنگلاخی و سرازیری فنی تمرین کن.';
      if (opts.b2b) how += ' روزهای پشت‌سرهم خستگی تجمعی پایان مسابقه رو شبیه‌سازی می‌کنن؛ روز دوم هم آسون بدو.';
      if (ctx.zones && ctx.zones.hrEasy) how += ' ضربان هدف: ' + ctx.zones.hrEasy[0] + ' تا ' + ctx.zones.hrEasy[1] + '.';
      var su = { type: 'long', km: km, hardKm: 0, target: km + ' کیلومتر' + (vert ? '، +' + vert + ' متر' : ''), segKm: 0, kind: 'ultra', vert: vert,
        steps: steps, how: how + ' لانگ‌ران به‌خاطر فشار حجمی جزو «روزهای سخت» حساب می‌شه.', talk: TALK_TEST, rpeOnly: true };
      su.variant = opts.b2b ? (opts.b2b === 'day2' ? 'پشت‌سرهم، روز دوم' : 'پشت‌سرهم، روز اول') : 'تریل';
      if (opts.b2b) su.b2b = opts.b2b;
      return su;
    }
    segKm = segKm > 0 && kind !== 'plain' ? Math.min(floor05(segKm), floor05(km * 0.4)) : 0;
    var st, extra = '';
    if (!segKm) {
      st = [km + ' کیلومتر دویدن یکنواخت', 'برای بیش از ۶۰ دقیقه، آب همراه داشته باش'];
    } else if (kind === 'mp') {
      st = [round05(km - segKm) + ' کیلومتر آسون', segKm + ' کیلومتر پایانی با پیس ماراتن (شبیه‌سازی خستگی پایان مسابقه)', 'تغذیه‌ی حین دویدن رو مثل روز مسابقه تمرین کن'];
      extra = paceNote('پیس ماراتن', zones && zones.marathon);
    } else {
      var half = floor05(segKm / 2);
      st = segKm >= 3
        ? [round05((km - segKm) / 2) + ' کیلومتر آسون', half + ' کیلومتر تمپو، ۱ کیلومتر آسون، ' + round05(segKm - half) + ' کیلومتر تمپو', 'بقیه تا ' + km + ' کیلومتر آسون']
        : [round05(km - segKm) + ' کیلومتر آسون', segKm + ' کیلومتر آخر با ریتم تمپو'];
      extra = paceNote('پیس بخش تمپو', zones && zones.tempo);
    }
    var s = {
      type: 'long', km: km, hardKm: segKm, target: km + ' کیلومتر', segKm: segKm, kind: segKm ? kind : 'plain',
      steps: st,
      how: rpeLine('long') + easyGuide(zones) + extra + ' لانگ‌ران به‌خاطر فشار حجمی جزو «روزهای سخت» حساب می‌شه.',
      talk: TALK_TEST
    };
    if (segKm) s.variant = kind === 'mp' ? 'پایان با پیس ماراتن' : 'با بخش‌های تمپو';
    return s;
  }

  function makeRest(note) {
    return {
      type: 'rest', km: null, hardKm: 0, target: '—',
      steps: ['استراحت کامل یا پیاده‌روی سبک / حرکات کششی'],
      how: note || 'ریکاوری بخشی از تمرینه؛ بدن توی روزهای استراحت قوی‌تر می‌شه.'
    };
  }

  function makeRace(profile, ctx, level) {
    var race = raceInfo(profile), g = race.goal, fit = currentFitness(profile);
    if (g.type === 'ultra') {
      var how = 'روز مسابقه! هیچ چیز جدیدی (کفش، غذا، لباس) امتحان نکن. شدت رو با تلاش (RPE) تنظیم کن، نه پیس؛ نیمه‌ی اول باید آسون به نظر بیاد.';
      if (fit) {
        // تخمین خیلی تقریبی: هر ۱۰۰ متر صعود ≈ ۱ کیلومتر مسافت معادل، به‌علاوه‌ی ضریب زمین
        var eq = g.km + g.gain / 100, tf = { technical: 1.15, trail: 1.08, gravel: 1.02, mixed: 1.08 }[g.terrain] || 1.08;
        how += ' زمان تخمینی خیلی تقریبی: حدود ' + hoursText(riegel(fit.entry.timeSec, fit.entry.distanceKm, eq) * tf / 60) + ' (معادل ' + Math.round(eq) + ' کیلومتر تخت).';
      }
      return { type: 'race', km: round05(g.km), hardKm: g.km, target: goalLabel(g), vert: g.gain, rpeOnly: true,
        steps: ['شروع خیلی محتاطانه؛ سربالایی‌های تند رو راه برو', 'هر ۳۰ تا ۴۵ دقیقه بخور و بنوش', 'سرازیری‌ها رو کنترل‌شده برو تا ران‌ها برای انتها بمونن', 'تجهیزات اجباری مسابقه (آب، چراغ پیشانی، لباس گرم) رو چک کن'],
        how: how };
    }
    var d = RACE_DISTANCES[g.type];
    var steps = ['۱۰ تا ۱۵ دقیقه گرم کردن آسون', 'کیلومترهای اول کمی آهسته‌تر از پیس هدف شروع کن',
      'از ایستگاه‌های آب استفاده کن', 'بعد از خط پایان: پیاده‌روی و آب'];
    var h = 'روز مسابقه! هیچ چیز جدیدی (کفش، غذا، لباس) امتحان نکن.';
    if (fit) h += ' زمان پیش‌بینی (Riegel، از آخرین تایم‌تست/رکوردت): حدود ' + formatDuration(riegel(fit.entry.timeSec, fit.entry.distanceKm, d)) + '.';
    if (level === 1) h += ' با همون پروتکل دو-پیاده برو؛ هدف فقط رسیدن سالم به خط پایانه.';
    return { type: 'race', km: round05(d), hardKm: d, target: RACE_LABELS[g.type], steps: steps, how: h };
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
    var ctx = { wu: L.wuKm, zones: zones, P: paceSet(profile, level), rpeOnly: ultra, goal: goal };
    var pr = progression(W);
    var race = raceInfo(profile);
    var avail = (profile.days || []).slice();
    var nSessions = Math.min(avail.length, L.sessions);
    var sessionDays = chooseSessionDays(avail, nSessions);
    var longDay = sessionDays.indexOf(6) >= 0 ? 6 : sessionDays[sessionDays.length - 1];
    var days = [], weeklyKm = null, template = {}, vol = null, workouts = null, period = null, b2bDay = null;

    // ضریب برگشت بعد از مسابقه برای کل هفته (۰٫۷، ۰٫۷۷، ... تا ۱)
    var rfWeek = race && race.date < ws ? returnFactor(daysBetween(addDays(ws, 6), race.date)) : 1;
    var tier = L.tier;
    // بدون تجربه‌ی تمرین ساختاریافته: ۴ هفته‌ی اول تمرین‌های کیفی در حد گروه B
    if (profile.structured === false && W < 4 && 'CDE'.indexOf(tier) >= 0) tier = 'B';

    if (level === 1) {
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
      if (date < start) s = { type: 'none', km: null, hardKm: 0, target: '—', steps: [], how: 'برنامه از روز ثبت‌نام شروع می‌شه.' };
      else if (template._rw && template[i]) s = makeRunWalk(template._rw, 1);
      else if (template[i]) s = JSON.parse(JSON.stringify(template[i].session));
      else s = makeRest();
      if (race && s.type !== 'none') s = applyRace(profile, s, date, race, ctx, template._rw, level);
      s.date = dateKey(date);
      s.dayName = DAY_NAMES[i];
      s.label = TYPE_INFO[s.type].label + (s.variant ? ' (' + s.variant + ')' : '');
      s.hard = isHard(s.type);
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
      totalKm: round05(totalKm), totalMin: totalMin, vert: vert,
      hardPct: totalKm ? Math.round(hardKm / totalKm * 100) : 0
    };
  }

  function weekPhase(profile, ws, pr, w, vol) {
    var race = raceInfo(profile);
    if (w === -1 && addDays(ws, 6) >= parseDate(profile.startDate)) return { key: 'intro', label: 'هفته‌ی شروع (چند روز تا اولین هفته‌ی کامل)' };
    if (w < 0) return { key: 'before', label: 'قبل از شروع برنامه' };
    if (race) {
      var we = addDays(ws, 6);
      var minDaysToRace = daysBetween(we, race.date);
      if (race.date >= ws && race.date <= we) return { key: 'race', label: 'هفته‌ی مسابقه' };
      if (race.date < ws && daysBetween(race.date, ws) < 7) return { key: 'recovery', label: 'ریکاوری بعد از مسابقه' };
      if (inPostRaceRamp(profile, ws)) return { key: 'return', label: 'برگشت تدریجی بعد از مسابقه (+۱۰٪ در هفته)' };
      var taperDays = taperWeeks(race.key) * 7;
      var inTaper = Math.max(0, Math.min(7, taperDays - minDaysToRace + 1));
      if (minDaysToRace > 0 && inTaper >= 3) return { key: 'taper', label: 'تیپر (کاهش حجم قبل از مسابقه)' };
    }
    if (pr.deload) return { key: 'deload', label: 'هفته‌ی ریکاوری (۸۰٪ حجم)' };
    if (w === 0) return { key: 'first', label: 'هفته‌ی اول: هم‌اندازه‌ی حجم فعلی تو' };
    if (vol && vol.atCeiling) return { key: 'maintain', label: 'حفظ حجم (به سقف رشد این دوره رسیدی)' };
    return { key: 'build', label: 'افزایش حجم (حداکثر +۱۰٪ نسبت به هفته‌ی کامل قبل)' };
  }

  function applyRace(profile, s, date, race, ctx, rw, level) {
    var diff = daysBetween(date, race.date); // روز تا مسابقه
    var zones = ctx.zones;
    if (diff === 0) return makeRace(profile, ctx, level);
    if (diff === 1) return makeRest('روز قبل از مسابقه: استراحت، آب کافی، وسایل مسابقه رو آماده کن.');
    if (diff < 0 && diff >= -3) return makeRest('ریکاوری بعد از مسابقه. پیاده‌روی سبک آزاده.');
    if (diff < -3 && diff >= -7) {
      if (s.type === 'rest') return s;
      if (rw) return makeRunWalk(rw, 0.5, 'هفته‌ی ریکاوری بعد از مسابقه.');
      return makeEasy((s.km || 4) * 0.5, zones, 'هفته‌ی ریکاوری بعد از مسابقه؛ فقط دویدن آسون.');
    }
    // برگشت تدریجی بعد از مسابقه در buildWeek روی حجم کل هفته اعمال می‌شه
    if (diff < 0) return s;
    var f = taperFactor(race.key, diff);
    if (f === 1 || s.type === 'rest') return s;
    var note = 'تیپر: حجم کم شده تا روز مسابقه تازه باشی.';
    if (rw) return makeRunWalk(rw, f, note);
    var out;
    if (s.type === 'long') {
      if (diff <= 7) return makeEasy(s.km * f, zones, note);
      out = makeLong(s.km * f, ctx, (s.segKm || 0) * f, s.kind || 'plain', { vert: s.vert ? round10(s.vert * f) : 0 });
    } else if (isHard(s.type) && diff <= 3) {
      var e = makeEasy(Math.min(6, (s.km || 5) * f), zones, note);
      e.steps.push('در انتها ۴ × ۲۰ ثانیه سرعت نزدیک پیس مسابقه، با ریکاوری کامل');
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

  // ---------- تطبیق با چک‌این روزانه ----------
  var PAIN_MESSAGE = 'این می‌تونه نشونه آسیب باشه. مربی نمی‌تونه این رو تشخیص بده. لطفاً به پزشک مراجعه کن.';

  function adaptSession(session, checkin, prevCheckin, zones) {
    if (!checkin) return { session: session, adaptation: null };
    if (checkin.pain) {
      var c = {
        type: 'cancelled', label: TYPE_INFO.cancelled.label, hard: false, km: null, hardKm: 0, target: '—',
        date: session.date, dayName: session.dayName, original: session,
        steps: ['امروز تمرین نکن'], how: PAIN_MESSAGE
      };
      return { session: c, adaptation: { kind: 'pain', message: PAIN_MESSAGE } };
    }
    var highFatigue = checkin.fatigue >= 4;
    var badSleep2 = checkin.sleep <= 2 && prevCheckin && prevCheckin.sleep <= 2;
    if (!(highFatigue || badSleep2)) return { session: session, adaptation: null };

    var why = highFatigue ? 'سطح خستگیت بالاست (' + checkin.fatigue + ' از ۵)' : 'دو شب پشت‌سرهم خواب بد داشتی';
    if (session.type === 'race') {
      return { session: session, adaptation: { kind: 'caution', message:
        why + '. امروز روز مسابقه‌ست؛ هدف رو «تموم کردن با حس خوب» بذار، نه رکورد. اگه حالت خوب نیست، نرفتن هم تصمیم درستیه.' } };
    }
    if (session.hard) {
      var km = session.km ? Math.max(Math.min(3, session.km), round05(session.km * 0.6)) : null;
      var e = km ? makeEasy(km, zones || null) : makeRunWalk({ runTotal: 8, run: 1, walk: 2 }, 1);
      e.date = session.date; e.dayName = session.dayName;
      e.label = TYPE_INFO[e.type].label; e.hard = false; e.original = session;
      var msg = why + '، پس جلسه‌ی ' + session.label + ' امروز به ایزی ران کوتاه‌تر تبدیل شد. ' +
        'تمرین سخت روی بدن خسته، ریسک آسیب رو بالا می‌بره و فایده‌ی کمتری داره. فردا دوباره چک‌این کن.';
      return { session: e, adaptation: { kind: 'downgrade', message: msg } };
    }
    if (session.type !== 'rest' && session.type !== 'none') {
      return { session: session, adaptation: { kind: 'note', message:
        why + '. جلسه‌ی امروز آسونه و تغییر نکرد، ولی اگه خیلی خسته‌ای، کوتاه‌ترش کن' +
        (session.double ? ' (مثلاً جلسه‌ی عصر رو حذف کن)' : '') + ' یا استراحت کن.' } };
    }
    return { session: session, adaptation: null };
  }

  // ---------- هشدارهای پروفایل ----------
  function profileWarnings(profile, today) {
    var out = [];
    var a = assessLevel(profile); // یادداشت‌های سطح (مثل پیام احتیاط) توی کارت سطح نشون داده می‌شن
    if (profile.structured === false && a.info.tier !== 'A' && a.info.tier !== 'B')
      out.push('چون هنوز تمرین ساختاریافته انجام ندادی، ۴ هفته‌ی اول تمرین‌های کیفی ساده‌تره (تمپوی ملایم و اینتروال کوتاه) و بعد به سطح کامل خودت می‌رسه.');
    var race = raceInfo(profile), goal = goalInfo(profile);
    if (race) {
      var weeks = Math.floor(daysBetween(today, race.date) / 7);
      var need = minPrepWeeks(goal, a.level);
      if (daysBetween(today, race.date) >= 0 && weeks < need) {
        out.push('تا مسابقه حدود ' + weeks + ' هفته مونده، ولی برای سطح ' + a.level + ' («' + a.info.name + '») و ' +
          goalLabel(goal) + ' حداقل ' + need + ' هفته آماده‌سازی توصیه می‌شه. هدفت رو فقط «تموم کردن سالم» بذار یا مسابقه‌ی کوتاه‌تری انتخاب کن.');
      }
    }
    if (goal.category === 'ultra') {
      if (a.level <= 4) out.push('برای سطح ' + a.level + '، اولترا و تریل طولانی زوده. برنامه فعلاً روی پایه‌سازی و تپه‌ی کنترل‌شده تمرکز داره؛ ران‌های پشت‌سرهم از سطح ۵ و با پایه‌ی کافی فعال می‌شن.');
      if (goal.altitude >= 2000) out.push('مسابقه در ارتفاع ' + goal.altitude + ' متری برگزار می‌شه. در ارتفاع، ضربان و تنفس برای یک سرعت مشخص بالاتره؛ ملاکت RPE باشه. اگه می‌تونی چند روز زودتر برو یا حداقل یک تمرین در ارتفاع مشابه داشته باش.');
      if (goal.netDownhill) out.push('مسیرت سرازیری خیلی بیشتری از صعود داره؛ تمرین فرود توی برنامه پررنگ‌تره تا عضلات ران آماده باشن.');
    }
    if (profile.injury && profile.injury.trim())
      out.push('سابقه‌ی آسیب/محدودیت ثبت کردی؛ برنامه از حجم فعلیت شروع می‌کنه ولی بیشتر از ۱۰٪ بالای اون نمی‌ره. قبل از شروع حتماً با پزشک یا فیزیوتراپ مشورت کن.');
    if (profile.age >= 50) out.push('برای سن بالای ۵۰، رشد حجم محدودتره (حداکثر ۲۰٪ بالای حجم فعلی). چکاپ قلب قبل از شروع توصیه می‌شه.');
    if (profile.age < 18) out.push('برای زیر ۱۸ سال، این برنامه باید زیر نظر والدین یا مربی اجرا بشه.');
    if (bmi(profile) >= 30) out.push('برای کم کردن فشار روی مفاصل، رشد حجم محدودتره؛ سطوح نرم (پارک، تردمیل) رو ترجیح بده.');
    if ((profile.days || []).length < 2) out.push('با فقط یک روز در هفته پیشرفت کند می‌شه؛ اگه می‌تونی حداقل ۳ روز رو آزاد کن.');
    if (a.level >= 9) out.push('برای سطح ' + a.level + '، این برنامه یه چارچوب کلیه؛ هماهنگی با مربی اختصاصی و پایش پزشکی منظم (آزمایش خون، آهن، ریکاوری) ضروریه.');
    return out;
  }

  var LOCATION_TIPS = {
    park: 'پارک: سطح خاکی/چمن برای ایزی ران و لانگ‌ران عالیه و فشار کمتری به مفاصل میاره.',
    gym: 'باشگاه: روزهای استراحت، تمرین قدرتی سبک (اسکوات، لانج، پلانک) کمک زیادی به پیشگیری از آسیب می‌کنه.',
    treadmill: 'تردمیل: شیب رو روی ۱٪ بذار تا به دویدن بیرون نزدیک‌تر بشه. برای اینتروال، سرعت رو از قبل تنظیم کن.',
    road: 'جاده/خیابان: کفش با ضربه‌گیری مناسب بپوش، خلاف جهت ماشین‌ها بدو و در تاریکی لباس شبرنگ بپوش.'
  };
  var LOCATION_LABELS = { park: 'پارک', gym: 'باشگاه', treadmill: 'تردمیل', road: 'جاده/خیابان' };

  var api = {
    DAY_NAMES: DAY_NAMES, LEVELS: LEVELS, EXPERIENCE: EXPERIENCE, TIER_INFO: TIER_INFO, PERIOD_LABELS: PERIOD_LABELS,
    RACE_DISTANCES: RACE_DISTANCES, RACE_LABELS: RACE_LABELS,
    TYPE_INFO: TYPE_INFO, LOCATION_TIPS: LOCATION_TIPS, LOCATION_LABELS: LOCATION_LABELS, PAIN_MESSAGE: PAIN_MESSAGE,
    dateKey: dateKey, parseDate: parseDate, addDays: addDays, weekStart: weekStart, daysBetween: daysBetween,
    persianDayIndex: persianDayIndex, parseTime: parseTime, formatDuration: formatDuration, describeDuration: describeDuration,
    riegel: riegel, vdotFromRace: vdotFromRace, raceTimeFromVdot: raceTimeFromVdot,
    levelFromKm: levelFromKm, levelFromVdot: levelFromVdot, assessLevel: assessLevel,
    paceZones: paceZones, bmi: bmi, progression: progression, weeklyVolumeKm: weeklyVolumeKm,
    weeklyVolume: weeklyVolume, volumeCeiling: volumeCeiling, weekWorkouts: weekWorkouts, periodFor: periodFor,
    chooseSessionDays: chooseSessionDays, placeQuality: placeQuality, circDist: circDist,
    buildWeek: buildWeek, sessionFor: sessionFor, adaptSession: adaptSession, isHard: isHard,
    currentFitness: currentFitness, fitnessEntries: fitnessEntries, hrZones: hrZones, easyRunFeedback: easyRunFeedback,
    easyRpeTrend: easyRpeTrend, easyDayHint: easyDayHint, fitnessReminder: fitnessReminder,
    fitnessLevelSuggestion: fitnessLevelSuggestion, TALK_TEST: TALK_TEST, EASY_RPE_WARNING: EASY_RPE_WARNING,
    EASY_ADJUST_MAX: EASY_ADJUST_MAX,
    profileWarnings: profileWarnings, raceInfo: raceInfo, taperWeeks: taperWeeks,
    goalInfo: goalInfo, goalLabel: goalLabel, GOAL_TYPES: GOAL_TYPES, TERRAIN_LABELS: TERRAIN_LABELS,
    ULTRA_CLASS_INFO: ULTRA_CLASS_INFO, ultraClass: ultraClass, minPrepWeeks: minPrepWeeks, paceSet: paceSet
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachLogic = api;
})(this);
