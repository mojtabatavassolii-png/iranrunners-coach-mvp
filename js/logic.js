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

  function parseTime(str) {
    // "hh:mm:ss" یا "mm:ss" → ثانیه
    if (!str) return null;
    var s = String(str).replace(/[۰-۹]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); }).trim();
    if (!/^\d{1,2}(:\d{1,2}){1,2}$/.test(s)) return null;
    var p = s.split(':').map(Number);
    var sec = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
    if (p.slice(1).some(function (v) { return v >= 60; })) return null;
    return sec > 0 ? sec : null;
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

  // ---------- مسابقه ----------
  var RACE_DISTANCES = { '5': 5, '10': 10, '21': 21.0975, '42': 42.195 };
  var RACE_LABELS = { '5': '۵ کیلومتر', '10': '۱۰ کیلومتر', '21': 'نیمه‌ماراتن (۲۱.۱ کیلومتر)', '42': 'ماراتن (۴۲.۲ کیلومتر)' };
  var RACE_LONG_CAP = { '5': 22, '10': 25, '21': 28, '42': 40 };

  // حداقل هفته‌های آماده‌سازی توصیه‌شده (ایندکس = سطح - ۱)
  var MIN_PREP_WEEKS = {
    '5': [8, 6, 4, 3, 2, 2, 2, 2, 2, 2],
    '10': [14, 10, 8, 6, 4, 4, 3, 2, 2, 2],
    '21': [26, 18, 14, 10, 8, 8, 6, 6, 6, 6],
    '42': [40, 30, 24, 18, 16, 16, 14, 12, 12, 12]
  };

  function taperFactor(raceKey, daysToRace) {
    var long = raceKey === '21' || raceKey === '42';
    if (daysToRace >= 2 && daysToRace <= 7) return long ? 0.5 : 0.6;
    if (long && daysToRace >= 8 && daysToRace <= 14) return raceKey === '42' ? 0.7 : 0.75;
    return 1;
  }
  function taperWeeks(raceKey) { return raceKey === '21' || raceKey === '42' ? 2 : 1; }
  // ضریب حجم بعد از مسابقه؛ diff = روز تا مسابقه (منفی = بعد از مسابقه). هفته‌ی اول بعد: ریکاوری جدا.
  function returnFactor(diff) {
    if (diff > -8) return 1;
    var k = Math.floor((-diff - 8) / 7); // ۰ = هفته‌ی دوم بعد از مسابقه
    var f = 0.7 * Math.pow(1.1, k);
    return f >= 1 ? 1 : f;
  }
  function raceInfo(profile) {
    if (!profile.race || !profile.race.has || !profile.race.date || !RACE_DISTANCES[profile.race.distance]) return null;
    return { key: profile.race.distance, date: parseDate(profile.race.date), km: RACE_DISTANCES[profile.race.distance] };
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
    long: { label: 'لانگ ران', hard: true },
    race: { label: 'روز مسابقه', hard: true },
    cancelled: { label: 'لغو شد', hard: false },
    none: { label: 'قبل از شروع', hard: false }
  };
  function isHard(type) { return !!(TYPE_INFO[type] && TYPE_INFO[type].hard); }

  // ---------- پیس‌ها ----------
  // با رکورد: پیس‌های دنیلز از VDOT (E، M، T، I، R). بدون رکورد: فقط RPE.
  function paceZones(profile) {
    var pb = profile.pb;
    if (!pb || !pb.distanceKm || !pb.timeSec) return null;
    var vd = vdotFromRace(pb.distanceKm, pb.timeSec);
    var I = paceAtPct(vd, 0.98);
    var M = raceTimeFromVdot(vd, 42.195) / 42.195;
    return {
      vdot: vd,
      easy: [paceAtPct(vd, 0.74), paceAtPct(vd, 0.65)],
      marathon: [M - 3, M + 3],
      tempo: [paceAtPct(vd, 0.90), paceAtPct(vd, 0.86)],
      interval: [paceAtPct(vd, 1.0), paceAtPct(vd, 0.96)],
      reps: [I - 18, I - 12]
    };
  }
  function paceText(range) {
    if (!range) return '';
    return formatDuration(range[0]) + ' تا ' + formatDuration(range[1]) + ' دقیقه در هر کیلومتر';
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

  function chooseSessionDays(avail, n) {
    avail = avail.slice().sort(function (a, b) { return a - b; });
    if (avail.length <= n) return avail;
    // لانگ‌ران: جمعه اگر آزاد باشد، وگرنه آخرین روز آزاد
    var chosen = [avail.indexOf(6) >= 0 ? 6 : avail[avail.length - 1]];
    while (chosen.length < n) {
      var best = null, bestScore = -1;
      avail.forEach(function (d) {
        if (chosen.indexOf(d) >= 0) return;
        var score = Math.min.apply(null, chosen.map(function (c) { return circDist(c, d); }));
        if (score > bestScore) { bestScore = score; best = d; }
      });
      chosen.push(best);
    }
    return chosen.sort(function (a, b) { return a - b; });
  }

  // جای جلسات سخت: هیچ روز سختی مجاور (حلقوی، جمعه↔شنبه) روز سخت دیگر نیست
  function placeQuality(sessionDays, longDay, count) {
    var hard = [longDay], placed = [];
    var candidates = sessionDays.filter(function (d) { return d !== longDay; })
      .sort(function (a, b) { return circDist(b, longDay) - circDist(a, longDay) || a - b; });
    candidates.forEach(function (d) {
      if (placed.length >= count) return;
      var ok = hard.every(function (h) { return circDist(h, d) > 1; });
      if (ok) { hard.push(d); placed.push(d); }
    });
    return placed.sort(function (a, b) { return a - b; });
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

  // ---------- منوی تمرین بر اساس گروه سطح ----------
  // سهم بخش پرشدت هر جلسه از حجم هفته؛ جمع هر منو ≤ ۲۰٪ (قانون ۸۰/۲۰)
  var HARD_SHARE = {
    tempoMild: 0.07, shortint: 0.05, tempo: 0.08, cruise: 0.08, interval: 0.08, reps: 0.05, fartlek: 0.06, longSeg: 0.04
  };

  // دوره‌بندی (سطح ۷ به بالا): پایه → ساخت → اوج.
  // با مسابقه: از روی هفته‌های باقی‌مونده؛ بدون مسابقه: چرخه‌ی ۱۲ هفته‌ای.
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

  function weekWorkouts(tier, level, w, deload, race, period) {
    var longRace = race && (race.key === '21' || race.key === '42');
    var marathon = race && race.key === '42';
    if (tier === 'A') return { quality: [], long: 'plain', strides: false };
    if (tier === 'B') {
      if (deload) return { quality: [{ type: 'tempoMild' }], long: 'plain', strides: true };
      var q = [{ type: 'tempoMild' }];
      // سطح ۳: اینتروال کوتاه یک هفته در میان؛ سطح ۴: هر هفته
      if (level >= 4 || w % 2 === 1) q.push({ type: 'shortint', rep: level >= 4 && w % 2 === 1 ? 400 : 200 });
      return { quality: q, long: 'plain', strides: true };
    }
    if (tier === 'C') {
      if (deload) return { quality: [{ type: 'fartlek' }], long: 'plain', strides: true };
      var iv = { type: 'interval', rep: [400, 800, 1000][w % 3] }, tp = { type: 'tempo' };
      return { quality: longRace ? [tp, iv] : [iv, tp], long: w % 2 === 1 || longRace ? 'tempo' : 'plain', strides: true };
    }
    // D و E: دوره‌بندی‌شده با انواع تمرین دنیلز
    var extra = { strides: true, hills: true, strength: tier === 'E' ? 2 : 1, doubles: tier === 'E' };
    function withExtra(o) { for (var k in extra) o[k] = extra[k]; return o; }
    if (deload) return withExtra({ quality: [{ type: 'reps', rep: 200 }], long: 'plain' });
    if (period === 'base') return withExtra({ quality: [{ type: 'reps', rep: w % 2 ? 400 : 200 }, { type: 'tempo' }], long: 'plain' });
    if (period === 'build') return withExtra({ quality: [{ type: 'interval', rep: [800, 1000, 1200][w % 3], daniels: true }, { type: 'cruise' }], long: w % 2 ? 'tempo' : 'plain' });
    // اوج: برای نیمه‌ماراتن/ماراتن اولویت با آستانه و پیس ماراتن؛ برای ۵ و ۱۰ کیلومتر با VO2max
    var I = { type: 'interval', rep: w % 2 ? 1200 : 1000, daniels: true }, T = { type: 'cruise' };
    return withExtra({ quality: longRace ? [T, I] : [I, T], long: marathon ? 'mp' : (longRace ? 'tempo' : 'plain') });
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
      how: 'دویدن اون‌قدر آرام که نفس‌نفس نزنی. اگه یه تکرار سخت بود، پیاده‌روی رو طولانی‌تر کن — این شکست نیست، بخشی از برنامه‌ست.' + (extraNote ? ' ' + extraNote : '')
    };
  }

  function makeEasy(km, zones, note) {
    km = Math.max(2, round05(km));
    return {
      type: 'easy', km: km, hardKm: 0, target: km + ' کیلومتر',
      steps: [km + ' کیلومتر دویدن پیوسته و آرام'],
      how: rpeLine('easy') + paceNote('پیس تقریبی', zones && zones.easy) + (note ? ' ' + note : '')
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

  // لانگ‌ران؛ kind: plain | tempo (بخش‌های تمپو داخل لانگ) | mp (بخش پیس ماراتن)
  function makeLong(km, zones, segKm, kind) {
    km = round05(km);
    segKm = segKm > 0 && kind !== 'plain' ? Math.min(floor05(segKm), floor05(km * 0.4)) : 0;
    var steps, extra = '';
    if (!segKm) {
      steps = [km + ' کیلومتر دویدن یکنواخت', 'برای بیش از ۶۰ دقیقه، آب همراه داشته باش'];
    } else if (kind === 'mp') {
      steps = [round05(km - segKm) + ' کیلومتر آسون', segKm + ' کیلومتر آخر با پیس ماراتن (M)', 'تغذیه‌ی حین دویدن رو مثل روز مسابقه تمرین کن'];
      extra = paceNote('پیس ماراتن', zones && zones.marathon);
    } else {
      var half = floor05(segKm / 2);
      steps = segKm >= 3
        ? [round05((km - segKm) / 2) + ' کیلومتر آسون', half + ' کیلومتر تمپو، ۱ کیلومتر آسون، ' + round05(segKm - half) + ' کیلومتر تمپو', 'بقیه تا ' + km + ' کیلومتر آسون']
        : [round05(km - segKm) + ' کیلومتر آسون', segKm + ' کیلومتر آخر با ریتم تمپو'];
      extra = paceNote('پیس بخش تمپو', zones && zones.tempo);
    }
    var s = {
      type: 'long', km: km, hardKm: segKm, target: km + ' کیلومتر', segKm: segKm, kind: segKm ? kind : 'plain',
      steps: steps,
      how: rpeLine('long') + paceNote('پیس بخش آسون', zones && zones.easy) + extra +
        ' لانگ‌ران به‌خاطر فشار حجمی جزو «روزهای سخت» حساب می‌شه.'
    };
    if (segKm) s.variant = kind === 'mp' ? 'با پیس ماراتن' : 'با بخش‌های تمپو';
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

  function makeQuality(spec, weeklyKm, L, zones) {
    var sh = HARD_SHARE[spec.type] || 0.06;
    if (spec.type === 'tempoMild') return makeTempo(weeklyKm * sh, L.wuKm, zones, true);
    if (spec.type === 'tempo') return makeTempo(weeklyKm * sh, L.wuKm, zones, false);
    if (spec.type === 'cruise') return makeCruise(weeklyKm * sh, L.wuKm, zones);
    if (spec.type === 'shortint') return makeInterval(weeklyKm * sh, L.wuKm, spec.rep, zones, 'short');
    if (spec.type === 'interval') return makeInterval(weeklyKm * sh, L.wuKm, spec.rep, zones, spec.daniels ? 'daniels' : 'struct');
    if (spec.type === 'reps') return makeReps(weeklyKm * sh, L.wuKm, spec.rep, zones);
    return makeFartlek(weeklyKm * sh, L.wuKm, zones);
  }

  function makeRest(note) {
    return {
      type: 'rest', km: null, hardKm: 0, target: '—',
      steps: ['استراحت کامل یا پیاده‌روی سبک / حرکات کششی'],
      how: note || 'ریکاوری بخشی از تمرینه؛ بدن توی روزهای استراحت قوی‌تر می‌شه.'
    };
  }

  function makeRace(profile, zones, level) {
    var r = profile.race;
    var d = RACE_DISTANCES[r.distance];
    var steps = ['۱۰ تا ۱۵ دقیقه گرم کردن آسون', 'کیلومترهای اول کمی آهسته‌تر از پیس هدف شروع کن',
      'از ایستگاه‌های آب استفاده کن', 'بعد از خط پایان: پیاده‌روی و آب'];
    var how = 'روز مسابقه! هیچ چیز جدیدی (کفش، غذا، لباس) امتحان نکن.';
    if (profile.pb && profile.pb.timeSec) {
      how += ' زمان پیش‌بینی (Riegel): حدود ' + formatDuration(riegel(profile.pb.timeSec, profile.pb.distanceKm, d)) + '.';
    }
    if (level === 1) how += ' با همون پروتکل دو-پیاده برو؛ هدف فقط رسیدن سالم به خط پایانه.';
    return { type: 'race', km: round05(d), hardKm: d, target: RACE_LABELS[r.distance], steps: steps, how: how };
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
    var pr = progression(W);
    var race = raceInfo(profile);
    var avail = (profile.days || []).slice();
    var nSessions = Math.min(avail.length, L.sessions);
    var sessionDays = chooseSessionDays(avail, nSessions);
    var longDay = sessionDays.indexOf(6) >= 0 ? 6 : sessionDays[sessionDays.length - 1];
    var days = [], weeklyKm = null, template = {}, vol = null, workouts = null, period = null;

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
      workouts = weekWorkouts(tier, level, W, pr.deload, race, period);
      // اولین هفته‌ی برگشت بعد از مسابقه: فقط دویدن آسون
      if (rfWeek < 0.75) workouts = { quality: [], long: 'plain', strides: false };
      var specs = nSessions >= 3 ? workouts.quality : [];
      var qDays = specs.length ? placeQuality(sessionDays, longDay, specs.length) : [];
      var longShare = nSessions <= 3 ? 0.35 : (nSessions >= 7 ? 0.25 : 0.3);
      var longCap = L.longCap;
      if (race) longCap = Math.min(longCap, RACE_LONG_CAP[race.key]);
      var longKm = nSessions >= 2 ? round05(Math.min(longCap, weeklyKm * longShare)) : 0;
      var longSegKm = nSessions >= 2 && workouts.long !== 'plain' ? weeklyKm * HARD_SHARE.longSeg : 0;

      // جلسات کیفی به ترتیب اولویت؛ اگه جای کافی (روز غیرمجاور) نبود، کم‌اولویت‌ترها حذف می‌شن
      var qSessions = {};
      qDays.forEach(function (d, i) { qSessions[d] = makeQuality(specs[i], weeklyKm, L, zones); });

      // سقف ۸۰/۲۰: اگه به‌خاطر حداقل تکرارها رد شد، اول بخش تند لانگ‌ران، بعد جلسات کم‌اولویت حذف می‌شن
      var hardBudget = weeklyKm * 0.2;
      var hardSum = function () {
        return Object.keys(qSessions).reduce(function (s, k) { return s + qSessions[k].hardKm; }, 0) +
          Math.min(floor05(longSegKm), floor05(longKm * 0.4));
      };
      if (hardSum() > hardBudget + 1e-9) longSegKm = 0;
      while (hardSum() > hardBudget + 1e-9 && qDays.length) delete qSessions[qDays.pop()];
      // حجم خیلی کم: اگه لانگ‌ران + جلسات کیفی از حجم هفته بیشتر شد، جلسه‌ی کیفی کم‌اولویت حذف می‌شه
      var qSum = function () { return Object.keys(qSessions).reduce(function (s, k) { return s + qSessions[k].km; }, 0); };
      while (longKm + qSum() > weeklyKm + 1e-9 && qDays.length) delete qSessions[qDays.pop()];

      var qKm = qSum();
      var easyDays = sessionDays.filter(function (d) { return nSessions < 2 || (d !== longDay && !qSessions[d]); });
      // جلسه‌ی آسون کمتر از ۳ کیلومتر نمی‌سازیم؛ اگه حجم کافی نیست، روز آسون به استراحت تبدیل می‌شه
      var remaining = weeklyKm - longKm - qKm;
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
      // استرایدز/اسپرینت سربالایی روی روز آسونی که فرداش روز سخت نیست؛ تمرین قدرتی روی روزهای آسون بعدی
      var hardDays = Object.keys(qSessions).map(Number).concat(nSessions >= 2 ? [longDay] : []);
      var safeEasy = easyDays.filter(function (d) { return hardDays.indexOf((d + 1) % 7) < 0; });
      var accentDay = (workouts.strides || workouts.hills) ? safeEasy[0] : undefined;
      // تمرین قدرتی: اول روزهای آسونی که فرداشون سخت نیست، بعد بقیه‌ی روزهای آسون
      var strengthDays = safeEasy.slice(1).concat(easyDays.filter(function (d) { return safeEasy.indexOf(d) < 0; }))
        .slice(0, workouts.strength || 0);

      sessionDays.forEach(function (d) {
        if (qSessions[d]) template[d] = { session: qSessions[d] };
        else if (d === longDay && nSessions >= 2) template[d] = { session: makeLong(longKm, zones, longSegKm, workouts.long) };
        else if (easyAlloc[d] !== undefined) {
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
      if (race && s.type !== 'none') s = applyRace(profile, s, date, race, zones, template._rw, L, level);
      s.date = dateKey(date);
      s.dayName = DAY_NAMES[i];
      s.label = TYPE_INFO[s.type].label + (s.variant ? ' (' + s.variant + ')' : '');
      s.hard = isHard(s.type);
      days.push(s);
    }

    var totalKm = days.reduce(function (x, s) { return x + (s.km || 0); }, 0);
    var hardKm = days.reduce(function (x, s) { return x + (s.type === 'race' ? 0 : (s.hardKm || 0)); }, 0);
    var totalMin = days.reduce(function (x, s) { return x + (s.minutes || 0); }, 0);
    return {
      weekIndex: w, start: dateKey(ws), days: days, level: level, tier: tier,
      period: period, periodLabel: period ? PERIOD_LABELS[period] : null,
      phase: weekPhase(profile, ws, pr, w, vol),
      volumeTarget: weeklyKm,
      totalKm: round05(totalKm), totalMin: totalMin,
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

  function applyRace(profile, s, date, race, zones, rw, L, level) {
    var diff = daysBetween(date, race.date); // روز تا مسابقه
    if (diff === 0) return makeRace(profile, zones, level);
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
    var wu = L.wuKm, out;
    if (s.type === 'long') {
      if (diff <= 7) return makeEasy(s.km * f, zones, note);
      out = makeLong(s.km * f, zones, (s.segKm || 0) * f, s.kind || 'plain');
    } else if (isHard(s.type) && diff <= 3) {
      var e = makeEasy(Math.min(6, (s.km || 5) * f), zones, note);
      e.steps.push('در انتها ۴ × ۲۰ ثانیه سرعت نزدیک پیس مسابقه، با ریکاوری کامل');
      return e;
    } else if (s.type === 'tempo') out = s.cruise ? makeCruise(s.hardKm * f, wu, zones) : makeTempo(s.hardKm * f, wu, zones, s.mild);
    else if (s.type === 'interval') out = makeInterval(s.hardKm * f, wu, s.rep, zones, s.kind);
    else if (s.type === 'reps') out = makeReps(s.hardKm * f, wu, s.rep, zones);
    else if (s.type === 'fartlek') out = makeFartlek(s.hardKm * f, wu, zones);
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

  function adaptSession(session, checkin, prevCheckin) {
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
      var e = km ? makeEasy(km, null) : makeRunWalk({ runTotal: 8, run: 1, walk: 2 }, 1);
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
    var race = raceInfo(profile);
    if (race) {
      var weeks = Math.floor(daysBetween(today, race.date) / 7);
      var need = MIN_PREP_WEEKS[race.key][a.level - 1];
      if (daysBetween(today, race.date) >= 0 && weeks < need) {
        out.push('تا مسابقه حدود ' + weeks + ' هفته مونده، ولی برای سطح ' + a.level + ' («' + a.info.name + '») و ' +
          RACE_LABELS[race.key] + ' حداقل ' + need + ' هفته آماده‌سازی توصیه می‌شه. هدفت رو فقط «تموم کردن سالم» بذار یا مسابقه‌ی کوتاه‌تری انتخاب کن.');
      }
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
    persianDayIndex: persianDayIndex, parseTime: parseTime, formatDuration: formatDuration,
    riegel: riegel, vdotFromRace: vdotFromRace, raceTimeFromVdot: raceTimeFromVdot,
    levelFromKm: levelFromKm, levelFromVdot: levelFromVdot, assessLevel: assessLevel,
    paceZones: paceZones, bmi: bmi, progression: progression, weeklyVolumeKm: weeklyVolumeKm,
    weeklyVolume: weeklyVolume, volumeCeiling: volumeCeiling, weekWorkouts: weekWorkouts, periodFor: periodFor,
    chooseSessionDays: chooseSessionDays, placeQuality: placeQuality, circDist: circDist,
    buildWeek: buildWeek, sessionFor: sessionFor, adaptSession: adaptSession, isHard: isHard,
    profileWarnings: profileWarnings, raceInfo: raceInfo, taperWeeks: taperWeeks
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachLogic = api;
})(this);
