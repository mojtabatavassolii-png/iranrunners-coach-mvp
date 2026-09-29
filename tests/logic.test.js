// اجرای تست‌ها: node tests/logic.test.js
'use strict';
var assert = require('assert');
var C = require('../js/logic.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; }
}
function hms(h, m, s) { return (h * 60 + m) * 60 + (s || 0); }

// ورودی‌هایی که (بدون رکورد) دقیقاً به سطح n می‌رسن: حجم وسط بازه‌ی سطح، سابقه‌ی کافی
var KM_FOR = [null, 8, 20, 30, 42, 57, 72, 90, 115, 150, 190];
function profileFor(n, over) {
  return Object.assign({
    age: 30, weightKg: 70, heightCm: 175,
    days: [0, 1, 2, 3, 4, 5, 6], locations: ['park'], injury: '',
    race: { has: false }, pb: null,
    currentWeeklyKm: KM_FOR[n],
    experience: n === 1 ? 'lt3m' : (n === 2 ? '3to12m' : 'gt3y'),
    structured: n >= 3,
    startDate: '2026-09-26' // شنبه
  }, over || {});
}
function weekAt(p, w) { return C.buildWeek(p, C.addDays(C.parseDate(p.startDate), w * 7)); }
function allDays(p, weeks) {
  var out = [];
  for (var w = 0; w < weeks; w++) out = out.concat(weekAt(p, w).days);
  return out;
}
var ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var DAY_SETS = [[0, 2, 4], [0, 1, 2, 3, 4, 5, 6], [5, 6], [1, 3, 5, 6], [0, 1, 2, 3, 4], [6], [2, 3, 4, 5]];

// ---------- تعیین سطح ----------
test('VDOT مطابق جدول دنیلز', function () {
  assert(Math.abs(C.vdotFromRace(5, hms(0, 20)) - 49.8) < 0.5);
  assert(Math.abs(C.vdotFromRace(42.195, hms(3, 0)) - 53.5) < 0.5);
  assert(Math.abs(C.raceTimeFromVdot(C.vdotFromRace(10, hms(0, 40)), 10) - hms(0, 40)) < 1);
});

test('سطح‌بندی پایه از روی حجم فعلی (بدون رکورد)', function () {
  ALL.forEach(function (n) { assert.strictEqual(C.assessLevel(profileFor(n)).level, n, 'level ' + n); });
});

test('سناریو ۱: ۲۰ کیلومتر، شش ماه سابقه → سطح ۲', function () {
  assert.strictEqual(C.assessLevel(profileFor(2, { currentWeeklyKm: 20, experience: '3to12m', structured: false })).level, 2);
});
test('سناریو ۲: ۷۰ کیلومتر + ماراتن ۳:۲۵ → سطح ۶', function () {
  var a = C.assessLevel(profileFor(6, { currentWeeklyKm: 70, pb: { distanceKm: 42.195, timeSec: hms(3, 25) } }));
  assert.strictEqual(a.level, 6); assert(!a.cautious);
});
test('سناریو ۳: ۱۱۰ کیلومتر + ماراتن ۲:۵۰ → سطح ۸', function () {
  var a = C.assessLevel(profileFor(8, { currentWeeklyKm: 110, pb: { distanceKm: 42.195, timeSec: hms(2, 50) } }));
  assert.strictEqual(a.level, 8); assert(!a.cautious);
});

test('رکورد با هر فاصله‌ای: VDOT معادل همون سطح رو می‌ده', function () {
  // ۱۰ کیلومتر ۴۳:۴۵ ≈ معادل ماراتن ۳:۲۵ (VDOT ~۴۶)
  assert.strictEqual(C.assessLevel(profileFor(6, { pb: { distanceKm: 10, timeSec: hms(0, 43, 45) } })).level, 6);
});

test('حجم کم ولی رکورد سریع → سطح از رکورد + پیام احتیاط + رشد کند', function () {
  var p = profileFor(3, { currentWeeklyKm: 30, pb: { distanceKm: 10, timeSec: hms(0, 36) } });
  var a = C.assessLevel(p);
  assert(a.level >= 7, 'level ' + a.level);
  assert(a.cautious);
  assert(a.notes.indexOf('برنامه‌ات را با احتیاط حجم رو افزایش می‌دیم چون حجم فعلیت با سرعتت هم‌خوانی نداره.') >= 0);
  assert(C.volumeCeiling(p) <= 30 * 1.3);
  assert.strictEqual(weekAt(p, 0).totalKm, 30);
  assert(weekAt(p, 1).totalKm <= 30 * 1.05 + 0.5, 'cautious growth ' + weekAt(p, 1).totalKm);
});

test('سابقه و تمرین ساختاریافته سطح تخمینی از حجم رو محدود می‌کنن', function () {
  assert.strictEqual(C.assessLevel(profileFor(1, { currentWeeklyKm: 10, experience: 'lt3m' })).level, 1);
  assert.strictEqual(C.assessLevel(profileFor(2, { currentWeeklyKm: 60, experience: '3to12m' })).level, 2);
  assert.strictEqual(C.assessLevel(profileFor(5, { currentWeeklyKm: 75, structured: false })).level, 4);
  assert.strictEqual(C.assessLevel(profileFor(7, { currentWeeklyKm: 120, experience: '1to3y' })).level, 6);
});

// ---------- حجم ----------
test('هفته‌ی اول دقیقاً هم‌اندازه‌ی حجم فعلی کاربره', function () {
  [2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (n) {
    [[0, 1, 2, 3, 4, 5, 6], [0, 2, 3, 4, 6]].forEach(function (days) {
      var wk = weekAt(profileFor(n, { days: days }), 0);
      assert(Math.abs(wk.totalKm - KM_FOR[n]) <= 0.5, 'L' + n + ' days=' + days + ' → ' + wk.totalKm);
    });
  });
});

test('قانون ۱۰٪ روی حجم واقعی جلسات، همه‌ی سطوح', function () {
  [2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (n) {
    var p = profileFor(n), lastFull = null;
    for (var w = 0; w < 20; w++) {
      var wk = weekAt(p, w);
      if (wk.phase.key === 'deload') continue;
      if (lastFull !== null) assert(wk.totalKm <= lastFull * 1.1 + 1e-9, 'L' + n + ' w' + w + ' ' + lastFull + ' → ' + wk.totalKm);
      lastFull = wk.totalKm;
    }
  });
});

// ---------- قوانین ایمنی ----------
test('هیچ دو روز سختی پشت‌سرهم نیست (۱۰ سطح، ترکیب روزها، ۲۰ هفته)', function () {
  ALL.forEach(function (n) {
    DAY_SETS.forEach(function (days) {
      var d = allDays(profileFor(n, { days: days }), 20);
      for (var i = 1; i < d.length; i++) assert(!(d[i].hard && d[i - 1].hard), 'L' + n + ' ' + days + ' ' + d[i].date);
    });
  });
});

test('بدون دو روز سخت پشت‌سرهم، حتی با مسابقه و تیپر', function () {
  ['5', '10', '21', '42'].forEach(function (rk) {
    ALL.forEach(function (n) {
      DAY_SETS.forEach(function (days) {
        var d = allDays(profileFor(n, { days: days, race: { has: true, distance: rk, date: '2026-12-10' } }), 14);
        for (var i = 1; i < d.length; i++) assert(!(d[i].hard && d[i - 1].hard), 'L' + n + ' ' + rk + ' ' + days + ' ' + d[i].date);
      });
    });
  });
});

test('۸۰/۲۰ در همه‌ی سطوح ۳ به بالا', function () {
  [3, 4, 5, 6, 7, 8, 9, 10].forEach(function (n) {
    DAY_SETS.forEach(function (days) {
      var p = profileFor(n, { days: days });
      for (var w = 0; w < 16; w++) {
        var wk = weekAt(p, w);
        assert(wk.hardPct <= 20, 'L' + n + ' ' + days + ' w' + w + ' hard=' + wk.hardPct);
      }
    });
  });
});

// ---------- نوع تمرین بر اساس سطح ----------
function scan(p, weeks) {
  var s = { types: {}, reps: {}, kinds: {}, longKinds: {}, periods: {}, doubles: 0, hills: 0, strength: 0, mild: 0, cruise: 0 };
  for (var w = 0; w < weeks; w++) {
    var wk = weekAt(p, w);
    if (wk.period) s.periods[wk.period] = true;
    wk.days.forEach(function (d) {
      s.types[d.type] = true;
      if (d.type === 'interval') { s.reps[d.rep] = true; s.kinds[d.kind] = true; }
      if (d.type === 'long') s.longKinds[d.kind] = true;
      if (d.type === 'tempo' && d.mild) s.mild++;
      if (d.cruise) s.cruise++;
      if (d.double) s.doubles++;
      if (d.hills) s.hills++;
      if (d.strength) s.strength++;
    });
  }
  return s;
}

test('سطح ۱-۲: فقط دو-پیاده و ایزی ران، بدون تمپو/اینتروال', function () {
  var s1 = scan(profileFor(1), 16);
  Object.keys(s1.types).forEach(function (t) { assert(['runwalk', 'rest', 'none'].indexOf(t) >= 0, 'L1 ' + t); });
  var s2 = scan(profileFor(2), 16);
  Object.keys(s2.types).forEach(function (t) { assert(['easy', 'long', 'rest', 'none'].indexOf(t) >= 0, 'L2 ' + t); });
  assert.deepStrictEqual(Object.keys(s2.longKinds), ['plain']);
});

test('سطح ۳-۴: تمپوی ملایم + اینتروال خیلی کوتاه (۲۰۰-۴۰۰) با استراحت طولانی', function () {
  [3, 4].forEach(function (n) {
    var s = scan(profileFor(n), 16);
    assert(s.mild > 0 && s.types.interval, 'L' + n);
    Object.keys(s.reps).forEach(function (r) { assert(['200', '400'].indexOf(r) >= 0, 'L' + n + ' rep ' + r); });
    assert.deepStrictEqual(Object.keys(s.kinds), ['short']);
    ['reps', 'fartlek'].forEach(function (t) { assert(!s.types[t], 'L' + n + ' ' + t); });
    assert.deepStrictEqual(Object.keys(s.longKinds), ['plain']);
  });
  var p = profileFor(4);
  for (var w = 0; w < 12; w++) {
    var wk = weekAt(p, w);
    if (wk.phase.key === 'deload') continue;
    assert.strictEqual(wk.days.filter(function (d) { return d.type === 'tempo'; }).length, 1, 'w' + w);
  }
});

test('سطح ۵-۶: اینتروال ساختاریافته ۴۰۰ تا ۱۰۰۰، تمپو، لانگ‌ران با بخش تمپو', function () {
  [5, 6].forEach(function (n) {
    var s = scan(profileFor(n), 12);
    [400, 800, 1000].forEach(function (r) { assert(s.reps[r], 'L' + n + ' rep ' + r); });
    assert(s.types.tempo && s.longKinds.tempo, 'L' + n);
    assert(!s.types.reps && !s.doubles);
  });
});

test('سطح ۷-۸: دوره‌بندی پایه/ساخت/اوج و انواع دنیلز (R، I، T)', function () {
  [7, 8].forEach(function (n) {
    var s = scan(profileFor(n), 12);
    ['base', 'build', 'peak'].forEach(function (k) { assert(s.periods[k], 'L' + n + ' ' + k); });
    assert(s.types.reps, 'R'); assert(s.kinds.daniels, 'I'); assert(s.cruise > 0, 'T cruise');
    assert(!s.doubles, 'no doubles below 9');
  });
  var pm = profileFor(8, { race: { has: true, distance: '42', date: '2027-01-29' } });
  assert(scan(pm, 16).longKinds.mp, 'marathon peak has M-pace long run');
});

test('سطح ۹-۱۰: روزهای دوجلسه‌ای، اسپرینت سربالایی، تمرین قدرتی', function () {
  [9, 10].forEach(function (n) {
    var s = scan(profileFor(n), 12);
    assert(s.doubles > 0 && s.hills > 0 && s.strength > 0, 'L' + n + ' ' + JSON.stringify([s.doubles, s.hills, s.strength]));
  });
});

test('بدون تجربه‌ی تمرین ساختاریافته: ۴ هفته‌ی اول تمرین‌های ساده‌تر', function () {
  var p = profileFor(4, { currentWeeklyKm: 45, structured: false, pb: { distanceKm: 10, timeSec: hms(0, 44) } });
  assert(C.assessLevel(p).level >= 5);
  for (var w = 0; w < 4; w++) weekAt(p, w).days.forEach(function (d) {
    if (d.type === 'interval') assert.strictEqual(d.kind, 'short');
    assert(['reps', 'fartlek'].indexOf(d.type) < 0);
  });
});

// ---------- مسابقه ----------
test('تیپر: حجم هفته‌ی آخر کمتره، روز قبل استراحته، بدون لانگ‌ران', function () {
  ['5', '10', '21', '42'].forEach(function (rk) {
    var p = profileFor(5, { race: { has: true, distance: rk, date: '2026-12-18' } });
    var race = C.parseDate('2026-12-18');
    function vol(from, to) { var s = 0; for (var i = from; i <= to; i++) s += C.sessionFor(p, C.addDays(race, -i)).km || 0; return s; }
    assert.strictEqual(C.sessionFor(p, race).type, 'race');
    assert.strictEqual(C.sessionFor(p, C.addDays(race, -1)).type, 'rest');
    assert(vol(1, 7) < vol(15, 21) * 0.75, rk + ' ' + vol(1, 7) + ' vs ' + vol(15, 21));
    for (var i = 1; i <= 7; i++) assert.notStrictEqual(C.sessionFor(p, C.addDays(race, -i)).type, 'long');
  });
});

test('بعد از مسابقه: برگشت تدریجی، هر هفته حداکثر ~۱۰٪ بیشتر', function () {
  ['2026-09-26', '2026-10-03', '2026-10-10', '2026-10-17'].forEach(function (start) {
    var p = profileFor(7, { startDate: start, race: { has: true, distance: '21', date: '2026-11-27' } });
    var race = C.parseDate('2026-11-27'), prev = null;
    var w2 = C.buildWeek(p, C.addDays(race, 11));
    assert(!w2.days.some(function (d) { return ['tempo', 'interval', 'reps', 'fartlek'].indexOf(d.type) >= 0 || d.segKm; }));
    for (var i = 1; i <= 8; i++) {
      var wk = C.buildWeek(p, C.addDays(race, 7 * i - 3));
      if (prev !== null && wk.phase.key !== 'deload') assert(wk.totalKm <= prev * 1.1 + 1, start + ' w+' + i + ': ' + prev + ' → ' + wk.totalKm);
      if (wk.phase.key !== 'deload' && wk.phase.key !== 'recovery') prev = wk.totalKm;
    }
  });
});

test('Riegel و تبدیل زمان', function () {
  assert(Math.abs(C.riegel(3000, 10, 21.0975) - 3000 * Math.pow(2.10975, 1.06)) < 1e-6);
  assert.strictEqual(C.parseTime('۰۰:۲۵:۳۰'), 1530);
  assert.strictEqual(C.parseTime('25:70'), null);
});

// ---------- چک‌این ----------
test('چک‌این: خستگی بالا → جلسه‌ی سخت به ایزی تبدیل می‌شه', function () {
  var hard = weekAt(profileFor(6), 0).days.find(function (s) { return s.hard; });
  var r = C.adaptSession(hard, { fatigue: 4, sleep: 4, pain: false }, null);
  assert.strictEqual(r.session.type, 'easy');
  assert(r.session.km <= hard.km);
});
test('چک‌این: خواب بد دو شب پشت‌سرهم → تبدیل؛ یک شب → بدون تغییر', function () {
  var hard = weekAt(profileFor(6), 0).days.find(function (s) { return s.hard; });
  assert.strictEqual(C.adaptSession(hard, { fatigue: 2, sleep: 2 }, { sleep: 1 }).session.type, 'easy');
  assert.strictEqual(C.adaptSession(hard, { fatigue: 2, sleep: 2 }, { sleep: 4 }).session.type, hard.type);
});
test('چک‌این: درد → لغو با پیام دقیق', function () {
  var r = C.adaptSession(weekAt(profileFor(5), 0).days[0], { fatigue: 1, sleep: 5, pain: true }, null);
  assert.strictEqual(r.session.type, 'cancelled');
  assert.strictEqual(r.adaptation.message, 'این می‌تونه نشونه آسیب باشه. مربی نمی‌تونه این رو تشخیص بده. لطفاً به پزشک مراجعه کن.');
});

test('شروع وسط هفته: هفته‌ی شروع ناقص، اولین هفته‌ی کامل = حجم فعلی', function () {
  var p = profileFor(5, { currentWeeklyKm: 50, startDate: '2026-09-29' });
  assert.strictEqual(C.buildWeek(p, C.parseDate('2026-09-29')).phase.key, 'intro');
  assert.strictEqual(C.buildWeek(p, C.parseDate('2026-10-03')).totalKm, 50);
  assert.strictEqual(C.buildWeek(p, C.parseDate('2026-10-10')).totalKm, 55);
});

// ---------- پیس تطبیقی ----------
test('پیس ایزی: بازه‌ی ۳۰ تا ۴۵ ثانیه‌ای حول ۷۰٪ VDOT', function () {
  var p = profileFor(6, { pb: { distanceKm: 42.195, timeSec: hms(3, 25) } });
  var z = C.paceZones(p);
  var width = z.easy[1] - z.easy[0];
  assert(width >= 30 && width <= 45, 'width ' + width);
  assert(z.easy[0] < z.easyCenter && z.easyCenter < z.easy[1]);
  // مرکز = پیسی که در اون VO2 = ۷۰٪ VDOT
  var v = 1000 / (z.easyCenter / 60);
  var vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  assert(Math.abs(vo2 / z.vdot - 0.70) < 0.005, 'pct ' + vo2 / z.vdot);
});

test('به‌روزرسانی فیتنس: آخرین تایم‌تست (نه بهترین رکورد قدیمی) پیس‌ها رو تعیین می‌کنه', function () {
  var p = profileFor(6, { pb: { distanceKm: 42.195, timeSec: hms(3, 25), date: '2026-09-26' } });
  var before = C.paceZones(p);
  // بعد از وقفه/آسیب: تایم‌تست ۵ کیلومتر کندتر
  p.fitnessTests = [{ date: '2026-11-07', distanceKm: 5, timeSec: hms(0, 25), kind: 'test' }];
  var after = C.paceZones(p);
  assert(after.vdot < before.vdot);
  assert(after.easy[0] > before.easy[0] && after.tempo[0] > before.tempo[0] && after.interval[0] > before.interval[0]);
  // تایم‌تست ۲ کیلومتری سریع‌تر، تاریخ جدیدتر
  p.fitnessTests.push({ date: '2026-12-05', distanceKm: 2, timeSec: hms(0, 7, 30), kind: 'test' });
  assert(C.paceZones(p).vdot > after.vdot);
  // پیس داخل جلسه‌ی ایزی برنامه هم عوض می‌شه
  var easyDay = C.buildWeek(p, C.parseDate('2026-12-05')).days.find(function (d) { return d.type === 'easy'; });
  assert(easyDay.how.indexOf(C.formatDuration(C.paceZones(p).easy[0])) >= 0);
});

test('کندتر کردن دستی پیس ایزی (حداکثر ۳۰ ثانیه)', function () {
  var p = profileFor(5, { pb: { distanceKm: 10, timeSec: hms(0, 48) } });
  var base = C.paceZones(p).easy;
  p.easyAdjustSec = 10;
  assert.strictEqual(Math.round(C.paceZones(p).easy[0] - base[0]), 10);
  p.easyAdjustSec = 90;
  assert.strictEqual(Math.round(C.paceZones(p).easy[0] - base[0]), 30);
});

test('ضربان قلب: Karvonen ۶۰–۷۵٪ ذخیره، یا تخمین از سن', function () {
  var z = C.hrZones({ hrMax: 190, hrRest: 50, age: 30 });
  assert.deepStrictEqual(z.easy, [134, 155]);
  assert.strictEqual(z.method, 'karvonen');
  var e = C.hrZones({ hrRest: 60, age: 40 });
  assert(e.maxEstimated && e.max === 180);
  assert.deepStrictEqual(C.hrZones({ hrMax: 200, age: 30 }).easy, [130, 156]);
  assert.strictEqual(C.hrZones({ age: 30 }), null);
  assert.strictEqual(C.hrZones({ hrMax: 120, hrRest: 110, age: 30 }), null);
  // بدون رکورد ولی با ضربان: راهنمای ضربان روی جلسه‌ی ایزی
  var p = profileFor(3, { hrMax: 190, hrRest: 50 });
  var easy = weekAt(p, 0).days.find(function (d) { return d.type === 'easy'; });
  assert(easy.how.indexOf('134 تا 155') >= 0);
});

test('تست حرف زدن روی هر جلسه‌ی ایزی', function () {
  [1, 3, 6, 9].forEach(function (n) {
    weekAt(profileFor(n), 0).days.forEach(function (d) {
      if (d.type === 'easy' || d.type === 'runwalk') assert.strictEqual(d.talk, C.TALK_TEST);
    });
  });
});

test('RPE بعد از جلسه‌ی ایزی: بالای ۶ با پیس درست → پیام دقیق', function () {
  assert.strictEqual(C.easyRunFeedback({ rpe: 7, pace: 'ok' }, 'easy').message,
    'به نظر می‌رسه این پیس الان برات ایزی نیست. پیشنهاد می‌کنیم پیس ایزی رو کمی کندتر تنظیم کنیم یا یک تایم‌تست تازه ثبت کنی.');
  assert.strictEqual(C.easyRunFeedback({ rpe: 6, pace: 'ok' }, 'easy').kind, 'ok');
  assert.strictEqual(C.easyRunFeedback({ rpe: 8, pace: 'fast' }, 'easy').kind, 'fast');
  assert.strictEqual(C.easyRunFeedback({ rpe: 8 }, 'runwalk').kind, 'runwalk');
  var today = C.parseDate('2026-10-20');
  assert.strictEqual(C.easyRpeTrend({ '2026-10-10': { easy: true, rpe: 7, pace: 'ok' }, '2026-10-15': { easy: true, rpe: 8, pace: 'ok' },
    '2026-10-16': { easy: true, rpe: 8, pace: 'fast' }, '2026-09-01': { easy: true, rpe: 9, pace: 'ok' } }, today), 2);
});

test('راهنمای روز: خستگی یا خواب بد → نیمه‌ی کند بازه', function () {
  assert.strictEqual(C.easyDayHint({ fatigue: 3, sleep: 4 }).side, 'slow');
  assert.strictEqual(C.easyDayHint({ fatigue: 1, sleep: 2 }).side, 'slow');
  assert.strictEqual(C.easyDayHint({ fatigue: 2, sleep: 4 }, { sleep: 2 }).side, 'slow');
  assert.strictEqual(C.easyDayHint({ fatigue: 2, sleep: 4 }, { sleep: 4 }).side, 'any');
});

test('یادآوری تایم‌تست بعد از ۶ هفته و پیشنهاد تغییر سطح', function () {
  var p = profileFor(5, { pb: { distanceKm: 10, timeSec: hms(0, 48), date: '2026-09-26' } });
  assert.strictEqual(C.fitnessReminder(p, C.parseDate('2026-10-20')), null);
  assert.strictEqual(C.fitnessReminder(p, C.parseDate('2026-11-10')).kind, 'stale');
  assert.strictEqual(C.fitnessReminder(profileFor(5), C.parseDate('2026-11-10')).kind, 'none');
  assert.strictEqual(C.fitnessLevelSuggestion(p), null);
  p.fitnessTests = [{ date: '2026-11-07', distanceKm: 5, timeSec: hms(0, 19, 30), kind: 'test' }];
  var sgg = C.fitnessLevelSuggestion(p);
  assert(sgg && sgg.up && sgg.to > sgg.from, JSON.stringify(sgg));
  // تغییر سطح خودکار اعمال نمی‌شه (حجم پرش نمی‌کنه)
  assert.strictEqual(C.assessLevel(p).level, 5);
});

test('تاریخچه‌ی فیتنس: رکورد پایه‌ای که همون تایم‌تسته تکراری نشون داده نمی‌شه', function () {
  var e = { date: '2026-10-03', distanceKm: 5, timeSec: hms(0, 19, 40), kind: 'test' };
  var p = profileFor(6, { fitnessTests: [e], pb: { distanceKm: 5, timeSec: hms(0, 19, 40), date: '2026-10-03' } });
  assert.strictEqual(C.fitnessEntries(p).length, 1);
});

console.log(passed + ' تست موفق' + (process.exitCode ? ' — برخی ناموفق' : ''));
