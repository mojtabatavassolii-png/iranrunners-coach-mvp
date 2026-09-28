/*
 * ایران رانرز — مربی خودت باش (MVP)
 * موتور قوانین ساخت برنامه. همه‌ی منطق قوانین ثابت است (if/else و جدول تصمیم)،
 * بدون هیچ اتصال به API یا سرویس خارجی.
 *
 * قوانین اصلی:
 *  - قانون ۱۰٪: حجم هفتگی هر هفته حداکثر ۱۰٪ بیشتر از آخرین هفته‌ی کامل قبلی.
 *    هر هفته‌ی چهارم «هفته‌ی ریکاوری» با ۸۰٪ حجم است.
 *  - نسبت ۸۰/۲۰: بخش پرشدت (ست اصلی تمپو/اینتروال) حداکثر ۲۰٪ حجم هفته.
 *  - هیچ دو روز سختی (تمپو، اینتروال، لانگ‌ران، مسابقه) پشت‌سرهم نیست.
 *  - مبتدی مطلق: فقط پروتکل دو-پیاده (run-walk)، بدون جلسه‌ی سخت.
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

  // ---------- جدول‌های تصمیم ----------
  var LEVELS = {
    absolute: { label: 'مبتدی مطلق', maxSessions: 3, runWalk: true },
    beginner: { label: 'تازه‌کار', maxSessions: 4, baseKm: 10, capKm: 30, longCap: 14, wuKm: 2 },
    intermediate: { label: 'متوسط', maxSessions: 5, baseKm: 25, capKm: 55, longCap: 24, wuKm: 3 },
    advanced: { label: 'پیشرفته', maxSessions: 6, baseKm: 40, capKm: 85, longCap: 32, wuKm: 3 }
  };

  var RACE_DISTANCES = { '5': 5, '10': 10, '21': 21.0975, '42': 42.195 };
  var RACE_LABELS = { '5': '۵ کیلومتر', '10': '۱۰ کیلومتر', '21': 'نیمه‌ماراتن (۲۱.۱ کیلومتر)', '42': 'ماراتن (۴۲.۲ کیلومتر)' };
  var RACE_LONG_CAP = { '5': 12, '10': 16, '21': 20, '42': 32 };

  // حداقل هفته‌های آماده‌سازی توصیه‌شده برای هر سطح و فاصله
  var MIN_PREP_WEEKS = {
    absolute: { '5': 8, '10': 14, '21': 26, '42': 40 },
    beginner: { '5': 4, '10': 8, '21': 14, '42': 24 },
    intermediate: { '5': 2, '10': 4, '21': 8, '42': 16 },
    advanced: { '5': 2, '10': 2, '21': 6, '42': 12 }
  };

  // ضریب تیپر بر اساس فاصله تا روز مسابقه
  function taperFactor(raceKey, daysToRace) {
    var long = raceKey === '21' || raceKey === '42';
    if (daysToRace >= 2 && daysToRace <= 7) return long ? 0.5 : 0.6;
    if (long && daysToRace >= 8 && daysToRace <= 14) return raceKey === '42' ? 0.7 : 0.75;
    return 1;
  }
  function taperWeeks(raceKey) { return raceKey === '21' || raceKey === '42' ? 2 : 1; }

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
    long: { label: 'لانگ ران', hard: true },
    race: { label: 'روز مسابقه', hard: true },
    cancelled: { label: 'لغو شد', hard: false },
    none: { label: 'قبل از شروع', hard: false }
  };
  function isHard(type) { return !!(TYPE_INFO[type] && TYPE_INFO[type].hard); }

  // ---------- ابزار ----------
  function round05(x) { return Math.round(x * 2) / 2; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

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

  // ---------- فرمول Riegel ----------
  function riegel(t1Sec, d1Km, d2Km) {
    return t1Sec * Math.pow(d2Km / d1Km, 1.06);
  }

  // محدوده‌ی پیس (ثانیه بر کیلومتر) بر اساس رکورد، از طریق معادل ۵ کیلومتر
  function paceZones(profile) {
    var pb = profile.pb;
    if (!pb || !pb.distanceKm || !pb.timeSec) return null;
    var t5 = riegel(pb.timeSec, pb.distanceKm, 5);
    var p5 = t5 / 5;
    return {
      easy: [p5 * 1.25, p5 * 1.4],
      tempo: [p5 * 1.07, p5 * 1.1],
      interval: [p5 * 0.98, p5 * 1.02]
    };
  }
  function paceText(range) {
    if (!range) return '';
    return formatDuration(range[0]) + ' تا ' + formatDuration(range[1]) + ' دقیقه در هر کیلومتر';
  }

  // ---------- ضرایب احتیاط بر اساس پروفایل ----------
  function bmi(profile) {
    var h = profile.heightCm / 100;
    return h > 0 ? profile.weightKg / (h * h) : 0;
  }
  function safetyFactor(profile) {
    var f = 1;
    if (profile.injury && profile.injury.trim()) f *= 0.8;
    if (profile.age >= 50) f *= 0.9;
    if (bmi(profile) >= 30) f *= 0.9;
    return f;
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

  function qualityCount(level, weekIdx, nSessions) {
    if (level === 'absolute') return 0;
    if (level === 'beginner') return weekIdx >= 3 && nSessions >= 3 ? 1 : 0;
    if (nSessions < 3) return 0;
    if (level === 'intermediate') return nSessions >= 5 ? 2 : 1;
    return nSessions >= 4 ? 2 : 1;
  }

  // ---------- قانون ۱۰٪ و هفته‌ی ریکاوری ----------
  function progression(weekIdx) {
    var deload = weekIdx % 4 === 3;
    var steps = deload ? (weekIdx - 1) - Math.floor(weekIdx / 4) : weekIdx - Math.floor((weekIdx + 1) / 4);
    return { deload: deload, steps: steps };
  }

  function floor05(x) { return Math.floor(x * 2 + 1e-9) / 2; }

  // حجم هفتگی با گرد کردن تکراری (رو به پایین) تا قانون ۱۰٪ روی عدد نهایی هم برقرار باشه
  function weeklyVolumeKm(profile, weekIdx) {
    var L = LEVELS[profile.level];
    var pr = progression(weekIdx);
    var sf = safetyFactor(profile);
    var cap = floor05(L.capKm * sf);
    var base = L.baseKm;
    if (profile.currentWeeklyKm > 0) base = clamp(profile.currentWeeklyKm, 5, L.capKm);
    var v = Math.min(cap, floor05(base * sf));
    for (var i = 0; i < pr.steps; i++) v = Math.min(cap, floor05(v * 1.1));
    return pr.deload ? floor05(v * 0.8) : v;
  }

  function runWalkMinutes(profile, weekIdx) {
    var pr = progression(weekIdx);
    var runMin = Math.min(30, 8 * Math.pow(1.1, pr.steps)) * safetyFactor(profile);
    if (pr.deload) runMin *= 0.8;
    var stage = RUN_WALK_STAGES[Math.min(pr.steps, RUN_WALK_STAGES.length - 1)];
    return { runTotal: runMin, run: stage[0], walk: stage[1] };
  }

  // ---------- سازنده‌ی جلسات ----------
  function rpeLine(t) {
    return {
      easy: 'شدت: آسون (RPE ۳-۴ از ۱۰). باید بتونی جمله‌ی کامل بگی.',
      long: 'شدت: آسون و یکنواخت (RPE ۴ از ۱۰). هدف مسافته، نه سرعت.',
      tempo: 'شدت: «سخت ولی قابل کنترل» (RPE ۷ از ۱۰). فقط چند کلمه می‌تونی بگی.',
      interval: 'شدت: سخت (RPE ۸ از ۱۰)، ولی همه‌ی تکرارها با سرعت یکسان.'
    }[t];
  }

  function makeRunWalk(rw, factor, extraNote) {
    var runTotal = rw.runTotal * factor;
    var reps = Math.max(4, Math.round(runTotal / rw.run));
    var total = 10 + reps * (rw.run + rw.walk);
    var steps = [
      '۵ دقیقه پیاده‌روی تند برای گرم کردن',
      reps + ' بار: ' + rw.run + ' دقیقه دویدن خیلی آرام + ' + rw.walk + ' دقیقه پیاده‌روی',
      '۵ دقیقه پیاده‌روی آرام برای سرد کردن'
    ];
    return {
      type: 'runwalk', minutes: Math.round(total), km: null, hardKm: 0,
      target: Math.round(total) + ' دقیقه',
      steps: steps,
      how: 'دویدن اون‌قدر آرام که نفس‌نفس نزنی. اگه یه تکرار سخت بود، پیاده‌روی رو طولانی‌تر کن — این شکست نیست، بخشی از برنامه‌ست.' + (extraNote ? ' ' + extraNote : '')
    };
  }

  function makeEasy(km, zones, note) {
    km = Math.max(3, round05(km));
    return {
      type: 'easy', km: km, hardKm: 0, target: km + ' کیلومتر',
      steps: [km + ' کیلومتر دویدن پیوسته و آرام'],
      how: rpeLine('easy') + (zones ? ' پیس تقریبی: ' + paceText(zones.easy) + '.' : '') + (note ? ' ' + note : '')
    };
  }

  function makeLong(km, zones) {
    km = round05(km);
    return {
      type: 'long', km: km, hardKm: 0, target: km + ' کیلومتر',
      steps: [km + ' کیلومتر دویدن یکنواخت', 'برای بیش از ۶۰ دقیقه، آب همراه داشته باش'],
      how: rpeLine('long') + (zones ? ' پیس تقریبی: ' + paceText(zones.easy) + '.' : '') +
        ' لانگ‌ران از نظر شدت آسونه، ولی به‌خاطر فشار حجمی جزو «روزهای سخت» حساب می‌شه.'
    };
  }

  function makeTempo(mainKm, wuKm, zones) {
    mainKm = Math.max(1.5, round05(mainKm));
    var half = wuKm / 2;
    return {
      type: 'tempo', km: round05(mainKm + wuKm), hardKm: mainKm, target: round05(mainKm + wuKm) + ' کیلومتر',
      steps: [half + ' کیلومتر گرم کردن آسون', mainKm + ' کیلومتر با ریتم تمپو', half + ' کیلومتر سرد کردن آسون'],
      how: rpeLine('tempo') + (zones ? ' پیس تمپو: ' + paceText(zones.tempo) + '.' : '')
    };
  }

  function makeInterval(mainKm, wuKm, level, zones) {
    var rep = level === 'advanced' && mainKm >= 5 ? 1000 : (mainKm >= 3.5 ? 800 : 400);
    var reps = Math.max(4, Math.round(mainKm * 1000 / rep));
    var hardKm = reps * rep / 1000;
    var jog = rep === 400 ? '۲ دقیقه' : (rep === 800 ? '۲ تا ۳ دقیقه' : '۳ دقیقه');
    var half = wuKm / 2;
    return {
      type: 'interval', km: round05(hardKm + wuKm + reps * 0.2), hardKm: hardKm,
      target: round05(hardKm + wuKm + reps * 0.2) + ' کیلومتر',
      steps: [half + ' کیلومتر گرم کردن + ۴ سرعت کوتاه ۲۰ ثانیه‌ای',
        reps + ' × ' + rep + ' متر، بین هر تکرار ' + jog + ' جاگ آرام',
        half + ' کیلومتر سرد کردن آسون'],
      how: rpeLine('interval') + (zones ? ' پیس تکرارها: ' + paceText(zones.interval) + '.' : '')
    };
  }

  function makeRest(note) {
    return {
      type: 'rest', km: null, hardKm: 0, target: '—',
      steps: ['استراحت کامل یا پیاده‌روی سبک / حرکات کششی'],
      how: note || 'ریکاوری بخشی از تمرینه؛ بدن توی روزهای استراحت قوی‌تر می‌شه.'
    };
  }

  function makeRace(profile, zones) {
    var r = profile.race;
    var d = RACE_DISTANCES[r.distance];
    var steps = ['۱۰ تا ۱۵ دقیقه گرم کردن آسون', 'کیلومترهای اول کمی آهسته‌تر از پیس هدف شروع کن',
      'از ایستگاه‌های آب استفاده کن', 'بعد از خط پایان: پیاده‌روی و آب'];
    var how = 'روز مسابقه! هیچ چیز جدیدی (کفش، غذا، لباس) امتحان نکن.';
    if (profile.pb && profile.pb.timeSec) {
      var t = riegel(profile.pb.timeSec, profile.pb.distanceKm, d);
      how += ' زمان پیش‌بینی (Riegel): حدود ' + formatDuration(t) + '.';
    }
    if (profile.level === 'absolute') how += ' با همون پروتکل دو-پیاده برو؛ هدف فقط رسیدن سالم به خط پایانه.';
    return { type: 'race', km: round05(d), hardKm: d, target: RACE_LABELS[r.distance], steps: steps, how: how };
  }

  // ---------- ساخت هفته ----------
  function planStart(profile) { return weekStart(parseDate(profile.startDate)); }
  function weekIndexFor(profile, date) { return Math.floor(daysBetween(planStart(profile), weekStart(date)) / 7); }

  function raceInfo(profile) {
    if (!profile.race || !profile.race.has || !profile.race.date || !RACE_DISTANCES[profile.race.distance]) return null;
    return { key: profile.race.distance, date: parseDate(profile.race.date), km: RACE_DISTANCES[profile.race.distance] };
  }

  function buildWeek(profile, anyDateInWeek) {
    var ws = weekStart(anyDateInWeek);
    var w = weekIndexFor(profile, ws);
    var start = parseDate(profile.startDate);
    var L = LEVELS[profile.level];
    var zones = paceZones(profile);
    var pr = progression(Math.max(0, w));
    var avail = (profile.days || []).slice();
    var nSessions = Math.min(avail.length, L.maxSessions);
    var sessionDays = chooseSessionDays(avail, nSessions);
    var longDay = sessionDays.indexOf(6) >= 0 ? 6 : sessionDays[sessionDays.length - 1];
    var days = [];
    var weeklyKm = null, template = {};

    if (L.runWalk) {
      var rw = runWalkMinutes(profile, Math.max(0, w));
      sessionDays.forEach(function (d) { template[d] = { kind: 'runwalk' }; });
      template._rw = rw;
    } else {
      weeklyKm = weeklyVolumeKm(profile, Math.max(0, w));
      var q = qualityCount(profile.level, Math.max(0, w), nSessions);
      var qDays = nSessions >= 2 ? placeQuality(sessionDays, longDay, q) : [];
      var longShare = nSessions <= 3 ? 0.35 : 0.3;
      var race = raceInfo(profile);
      var longCap = L.longCap;
      if (race) longCap = Math.min(longCap, RACE_LONG_CAP[race.key]);
      var longKm = nSessions >= 2 ? Math.min(longCap, weeklyKm * longShare) : 0;

      // نسبت ۸۰/۲۰: بخش پرشدت حداکثر ۲۰٪
      var qTypes = qDays.length === 2 ? ['interval', 'tempo'] :
        (profile.level === 'beginner' ? ['tempo'] : [w % 2 === 0 ? 'tempo' : 'interval']);
      var qSessions = {};
      qDays.forEach(function (d, i) {
        var t = qTypes[i];
        var share = t === 'tempo' ? (profile.level === 'beginner' ? 0.08 : 0.11) : 0.08;
        qSessions[d] = t === 'tempo' ? makeTempo(weeklyKm * share, L.wuKm, zones)
          : makeInterval(weeklyKm * share, L.wuKm, profile.level, zones);
      });
      // سقف ۲۰٪ پرشدت: اگه رد شد، جلسه‌ی کیفی دوم حذف می‌شه
      var hardBudget = weeklyKm * 0.2;
      function hardSum() { return Object.keys(qSessions).reduce(function (s, k) { return s + qSessions[k].hardKm; }, 0); }
      while (hardSum() > hardBudget + 1e-9 && qDays.length) {
        delete qSessions[qDays.pop()];
      }
      var qKm = Object.keys(qSessions).reduce(function (s, k) { return s + qSessions[k].km; }, 0);
      longKm = round05(longKm);
      var easyDays = sessionDays.filter(function (d) { return nSessions < 2 || (d !== longDay && !qSessions[d]); });
      // جلسه‌ی آسون کمتر از ۳ کیلومتر نمی‌سازیم؛ اگه حجم کافی نیست، روز آسون به استراحت تبدیل می‌شه
      var remaining = weeklyKm - longKm - qKm;
      while (easyDays.length && remaining / easyDays.length < 3) {
        easyDays.splice(easyDays.length - 1, 1);
      }
      if (!easyDays.length && nSessions >= 2 && remaining > 0) { longKm = round05(longKm + remaining); remaining = 0; }
      // لانگ‌ران همیشه از جلسه‌ی آسون بلندتر یا مساویه
      if (easyDays.length && nSessions >= 2 && remaining / easyDays.length > longKm) {
        var pool = longKm + remaining;
        longKm = Math.ceil(pool / (easyDays.length + 1) * 2) / 2;
        remaining = pool - longKm;
      }
      // تقسیم دقیق باقیمانده بین روزهای آسون (به نیم کیلومتر)
      var easyAlloc = {};
      if (easyDays.length) {
        var units = Math.max(0, Math.round(remaining * 2));
        var each = Math.floor(units / easyDays.length);
        easyDays.forEach(function (d, i) { easyAlloc[d] = (each + (i < units - each * easyDays.length ? 1 : 0)) / 2; });
      }

      sessionDays.forEach(function (d) {
        if (qSessions[d]) template[d] = { session: qSessions[d] };
        else if (d === longDay && nSessions >= 2) template[d] = { session: makeLong(longKm, zones) };
        else if (easyAlloc[d] !== undefined) template[d] = { session: makeEasy(easyAlloc[d], zones) };
      });
    }

    var race2 = raceInfo(profile);
    for (var i = 0; i < 7; i++) {
      var date = addDays(ws, i);
      var s;
      if (date < start) s = { type: 'none', km: null, hardKm: 0, target: '—', steps: [], how: 'برنامه از روز ثبت‌نام شروع می‌شه.' };
      else if (template._rw && template[i]) s = makeRunWalk(template._rw, 1);
      else if (template[i]) s = JSON.parse(JSON.stringify(template[i].session));
      else s = makeRest();
      if (race2 && s.type !== 'none') s = applyRace(profile, s, date, race2, zones, template._rw);
      s.date = dateKey(date);
      s.dayName = DAY_NAMES[i];
      s.label = TYPE_INFO[s.type].label;
      s.hard = isHard(s.type);
      days.push(s);
    }

    var totalKm = days.reduce(function (a, s) { return a + (s.km || 0); }, 0);
    var hardKm = days.reduce(function (a, s) { return a + (s.type === 'race' ? 0 : (s.hardKm || 0)); }, 0);
    var totalMin = days.reduce(function (a, s) { return a + (s.minutes || 0); }, 0);
    return {
      weekIndex: w, start: dateKey(ws), days: days,
      phase: weekPhase(profile, ws, pr, w),
      totalKm: round05(totalKm), totalMin: totalMin,
      hardPct: totalKm ? Math.round(hardKm / totalKm * 100) : 0
    };
  }

  function weekPhase(profile, ws, pr, w) {
    var race = raceInfo(profile);
    if (w < 0) return { key: 'before', label: 'قبل از شروع برنامه' };
    if (race) {
      var we = addDays(ws, 6);
      var minDaysToRace = daysBetween(we, race.date); // نزدیک‌ترین روز این هفته تا مسابقه
      if (race.date >= ws && race.date <= we) return { key: 'race', label: 'هفته‌ی مسابقه' };
      if (race.date < ws && daysBetween(race.date, ws) < 7) return { key: 'recovery', label: 'ریکاوری بعد از مسابقه' };
      // اگه حداقل ۳ روز این هفته داخل بازه‌ی تیپر باشه
      var taperDays = taperWeeks(race.key) * 7;
      var inTaper = Math.max(0, Math.min(7, taperDays - minDaysToRace + 1));
      if (minDaysToRace > 0 && inTaper >= 3)
        return { key: 'taper', label: 'تیپر (کاهش حجم قبل از مسابقه)' };
    }
    if (pr.deload) return { key: 'deload', label: 'هفته‌ی ریکاوری (۸۰٪ حجم)' };
    return { key: 'build', label: 'ساخت پایه (حداکثر +۱۰٪)' };
  }

  function applyRace(profile, s, date, race, zones, rw) {
    var diff = daysBetween(date, race.date); // روز تا مسابقه
    if (diff === 0) return makeRace(profile, zones);
    if (diff === 1) return makeRest('روز قبل از مسابقه: استراحت، آب کافی، وسایل مسابقه رو آماده کن.');
    if (diff < 0 && diff >= -3) return makeRest('ریکاوری بعد از مسابقه. پیاده‌روی سبک آزاده.');
    if (diff < -3 && diff >= -7) {
      if (s.type === 'rest') return s;
      if (rw) return makeRunWalk(rw, 0.5, 'هفته‌ی ریکاوری بعد از مسابقه.');
      return makeEasy((s.km || 4) * 0.5, zones, 'هفته‌ی ریکاوری بعد از مسابقه؛ فقط دویدن آسون.');
    }
    if (diff < 0) return s;
    var f = taperFactor(race.key, diff);
    if (f === 1 || s.type === 'rest') return s;
    var note = 'تیپر: حجم کم شده تا روز مسابقه تازه باشی.';
    if (rw) return makeRunWalk(rw, f, note);
    if (s.type === 'long') {
      if (diff <= 7) return makeEasy(s.km * f, zones, note);
      var l = makeLong(s.km * f, zones); l.how = note + ' ' + l.how; return l;
    }
    if ((s.type === 'tempo' || s.type === 'interval') && diff <= 3) {
      var e = makeEasy(Math.min(5, (s.km || 5) * f), zones, note);
      e.steps.push('در انتها ۴ × ۲۰ ثانیه سرعت نزدیک پیس مسابقه، با ریکاوری کامل');
      return e;
    }
    if (s.type === 'tempo') {
      var t = makeTempo(s.hardKm * f, LEVELS[profile.level].wuKm, zones); t.how = note + ' ' + t.how; return t;
    }
    if (s.type === 'interval') {
      var iv = makeInterval(s.hardKm * f, LEVELS[profile.level].wuKm, profile.level, zones); iv.how = note + ' ' + iv.how; return iv;
    }
    return makeEasy(s.km * f, zones, note);
  }

  function sessionFor(profile, date) {
    var week = buildWeek(profile, date);
    return week.days[persianDayIndex(date)];
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

    var why = highFatigue ? 'سطح خستگیت بالاست (' + checkin.fatigue + ' از ۵)'
      : 'دو شب پشت‌سرهم خواب بد داشتی';
    if (session.type === 'race') {
      return { session: session, adaptation: { kind: 'caution', message:
        why + '. امروز روز مسابقه‌ست؛ هدف رو «تموم کردن با حس خوب» بذار، نه رکورد. اگه حالت خوب نیست، نرفتن هم تصمیم درستیه.' } };
    }
    if (session.hard) {
      var km = session.km ? Math.max(3, round05(session.km * 0.6)) : null;
      var e = km ? makeEasy(km, null) : makeRunWalk({ runTotal: 8, run: 1, walk: 2 }, 1);
      e.date = session.date; e.dayName = session.dayName;
      e.label = TYPE_INFO[e.type].label; e.hard = false; e.original = session;
      var msg = why + '، پس جلسه‌ی ' + session.label + ' امروز به ایزی ران کوتاه‌تر تبدیل شد. ' +
        'تمرین سخت روی بدن خسته، ریسک آسیب رو بالا می‌بره و فایده‌ی کمتری داره. فردا دوباره چک‌این کن.';
      return { session: e, adaptation: { kind: 'downgrade', message: msg } };
    }
    if (session.type !== 'rest' && session.type !== 'none') {
      return { session: session, adaptation: { kind: 'note', message:
        why + '. جلسه‌ی امروز آسونه و تغییر نکرد، ولی اگه خیلی خسته‌ای، کوتاه‌ترش کن یا استراحت کن.' } };
    }
    return { session: session, adaptation: null };
  }

  // ---------- هشدارهای پروفایل ----------
  function profileWarnings(profile, today) {
    var out = [];
    var race = raceInfo(profile);
    if (race) {
      var weeks = Math.floor(daysBetween(today, race.date) / 7);
      var need = MIN_PREP_WEEKS[profile.level][race.key];
      if (daysBetween(today, race.date) >= 0 && weeks < need) {
        out.push('تا مسابقه حدود ' + weeks + ' هفته مونده، ولی برای سطح «' + LEVELS[profile.level].label + '» و ' +
          RACE_LABELS[race.key] + ' حداقل ' + need + ' هفته آماده‌سازی توصیه می‌شه. هدفت رو فقط «تموم کردن سالم» بذار یا مسابقه‌ی کوتاه‌تری انتخاب کن.');
      }
    }
    if (profile.injury && profile.injury.trim())
      out.push('سابقه‌ی آسیب/محدودیت ثبت کردی؛ حجم برنامه ۲۰٪ محتاطانه‌تره. قبل از شروع حتماً با پزشک یا فیزیوتراپ مشورت کن.');
    if (profile.age >= 50) out.push('برای سن بالای ۵۰، حجم برنامه کمی محتاطانه‌تره. چکاپ قلب قبل از شروع توصیه می‌شه.');
    if (profile.age < 18) out.push('برای زیر ۱۸ سال، این برنامه باید زیر نظر والدین یا مربی اجرا بشه.');
    if (bmi(profile) >= 30) out.push('برای کم کردن فشار روی مفاصل، حجم محتاطانه‌تره؛ سطوح نرم (پارک، تردمیل) رو ترجیح بده.');
    if ((profile.days || []).length < 2) out.push('با فقط یک روز در هفته پیشرفت کند می‌شه؛ اگه می‌تونی حداقل ۳ روز رو آزاد کن.');
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
    DAY_NAMES: DAY_NAMES, LEVELS: LEVELS, RACE_DISTANCES: RACE_DISTANCES, RACE_LABELS: RACE_LABELS,
    TYPE_INFO: TYPE_INFO, LOCATION_TIPS: LOCATION_TIPS, LOCATION_LABELS: LOCATION_LABELS, PAIN_MESSAGE: PAIN_MESSAGE,
    dateKey: dateKey, parseDate: parseDate, addDays: addDays, weekStart: weekStart, daysBetween: daysBetween,
    persianDayIndex: persianDayIndex, parseTime: parseTime, formatDuration: formatDuration,
    riegel: riegel, paceZones: paceZones, bmi: bmi, progression: progression, weeklyVolumeKm: weeklyVolumeKm,
    chooseSessionDays: chooseSessionDays, placeQuality: placeQuality, circDist: circDist,
    buildWeek: buildWeek, sessionFor: sessionFor, adaptSession: adaptSession, isHard: isHard,
    profileWarnings: profileWarnings, raceInfo: raceInfo, taperWeeks: taperWeeks
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachLogic = api;
})(this);
