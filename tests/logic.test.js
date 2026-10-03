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
// دو روز سخت پشت‌سرهم، به‌جز جفت ران‌های پشت‌سرهم اولترا (روز اول + روز دوم)
function hardPair(a, b) { return a.hard && b.hard && !(a.b2b === 'day1' && b.b2b === 'day2'); }
function goalOf(type, date, ultra) {
  var g = { type: type, date: date || null };
  if (type === 'ultra') g.ultra = ultra || { km: 50, gain: 2000 };
  return g;
}
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
      for (var i = 1; i < d.length; i++) assert(!hardPair(d[i - 1], d[i]), 'L' + n + ' ' + days + ' ' + d[i].date);
    });
  });
});

test('بدون دو روز سخت پشت‌سرهم، حتی با مسابقه و تیپر (همه‌ی هدف‌ها)', function () {
  ['5', '10', '21', '42', 'ultra'].forEach(function (rk) {
    ALL.forEach(function (n) {
      DAY_SETS.forEach(function (days) {
        var d = allDays(profileFor(n, { days: days, goal: goalOf(rk, '2026-12-10') }), 14);
        for (var i = 1; i < d.length; i++) assert(!hardPair(d[i - 1], d[i]), 'L' + n + ' ' + rk + ' ' + days + ' ' + d[i].date);
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

test('سطح ۷-۸: دوره‌بندی پایه/ساخت/اوج؛ پایه با تکرار R، ساخت/اوج با تمرین‌های هدف', function () {
  [7, 8].forEach(function (n) {
    var s = scan(profileFor(n), 12);
    ['base', 'build', 'peak'].forEach(function (k) { assert(s.periods[k], 'L' + n + ' ' + k); });
    assert(s.types.reps, 'R in base');
    assert(s.types.interval && s.types.tempo && s.types.fartlek, 'L' + n + ' variety');
    assert(!s.doubles, 'no doubles below 9');
  });
  var pm = profileFor(8, { goal: goalOf('42', '2027-01-29') });
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

test('ورود زمان از کیبورد عددی موبایل (بدون «:») و رقم‌های فارسی/عربی', function () {
  var cases = { '9:40': 580, '09:40': 580, '0940': 580, '940': 580, '9.40': 580, '9 40': 580, '۹:۴۰': 580, '٠٩:٤٠': 580,
    '٩٤٠': 580, '19:40': 1180, '1940': 1180, '1:25:30': 5130, '12530': 5130, '012530': 5130, '1.25.30': 5130, '85:30': 5130, '3:25:00': 12300 };
  Object.keys(cases).forEach(function (k) { assert.strictEqual(C.parseTime(k), cases[k], k); });
  ['', '40', '9:75', '1:70:00', 'abc', '1234567'].forEach(function (k) { assert.strictEqual(C.parseTime(k), null, k); });
  assert.strictEqual(C.describeDuration(580), '9 دقیقه و 40 ثانیه');
});

// ---------- کتابخانه‌ی تمرین بر اساس هدف ----------
function variants(p, weeks) {
  var v = {};
  for (var w = 0; w < weeks; w++) weekAt(p, w).days.forEach(function (d) { if (d.spec) v[d.spec.type] = (v[d.spec.type] || 0) + 1; if (d.type === 'long') v['long:' + d.kind] = (v['long:' + d.kind] || 0) + 1; });
  return v;
}
test('هدف ۵/۱۰ کیلومتر: اینتروال کوتاه و متوسط، فارتلک سرعتی، تپه‌ی کوتاه', function () {
  ['5', '10'].forEach(function (g) {
    var v = variants(profileFor(6, { goal: goalOf(g) }), 12);
    ['shortInt', 'midInt', 'speedFartlek', 'shortHills'].forEach(function (k) { assert(v[k], g + ' ' + k); });
    ['mpInt', 'longHills', 'thresholdInt'].forEach(function (k) { assert(!v[k], g + ' no ' + k); });
  });
  // سطح ۶+: فارتلک مونا (۲×۹۰، ۴×۶۰، ۴×۳۰، ۴×۱۵ ثانیه با شناور هم‌طول)؛ زیر ۶: هرمی
  var s = weekAt(profileFor(6, { goal: goalOf('5') }), 1).days.find(function (d) { return d.spec && d.spec.type === 'speedFartlek'; });
  assert.strictEqual(s.steps.length, 4); assert(/^۲ × ۹۰ ثانیه/.test(s.steps[0]) && /^۴ × ۱۵ ثانیه/.test(s.steps[3]), s.steps.join(' | '));
  assert(s.how.indexOf('پیوسته‌ست') >= 0 && s.wuCat === 'interval');
  var s5 = weekAt(profileFor(5, { goal: goalOf('5') }), 1).days.find(function (d) { return d.spec && d.spec.type === 'speedFartlek'; });
  assert(/۱-۲-۳-۴-۳-۲-۱/.test(s5.steps[0]), s5.steps[0]);
});
test('گرم کردن اختصاصی: بر اساس نوع جلسه و سطح، جدا از تمرین اصلی', function () {
  function first(n, pred) {
    for (var w = 0; w < 12; w++) { var d = weekAt(profileFor(n), w).days.find(pred); if (d) return d; }
  }
  var easy = first(5, function (d) { return d.type === 'easy'; });
  assert(easy.warmup.lines.length === 1 && !easy.cooldown && /خیلی آروم/.test(easy.warmup.lines[0]));
  var tempo = first(5, function (d) { return d.wuCat === 'tempo'; });
  assert(/حرکات دینامیک/.test(tempo.warmup.lines.join(' ')) && /۳–۴ استراید|3–4 استراید/.test(tempo.warmup.lines.join(' ')), tempo.warmup.lines.join(' | '));
  var int6 = first(6, function (d) { return d.wuCat === 'interval'; }), int8 = first(8, function (d) { return d.wuCat === 'interval'; });
  assert(/باند/.test(int6.warmup.lines.join(' ')) && /4–6/.test(int6.warmup.lines.join(' ')));
  assert(/A-skip/.test(int8.warmup.lines.join(' ')) && int8.warmup.lines.length > int6.warmup.lines.length);
  var int3 = first(3, function (d) { return d.wuCat === 'interval'; });
  assert(/^15 دقیقه/.test(int3.warmup.lines[0]) && !/باند/.test(int3.warmup.lines.join(' ')), int3.warmup.lines[0]);
  [int6, tempo].forEach(function (d) { d.steps.forEach(function (x) { assert(!/گرم کردن|سرد کردن|استراید/.test(x), x); }); });
});
test('هدف نیمه‌ماراتن: اینتروال آستانه، اینتروال بلند، تمپوی پیوسته', function () {
  var v = variants(profileFor(6, { goal: goalOf('21') }), 9);
  ['thresholdInt', 'longInt', 'tempoRun'].forEach(function (k) { assert(v[k], k); });
  var th = weekAt(profileFor(6, { goal: goalOf('21') }), 0).days.find(function (d) { return d.spec && d.spec.type === 'thresholdInt'; });
  assert(/^[34] × (8|9|10) دقیقه/.test(th.steps[0]), th.steps[0]);
});
test('هدف ماراتن: تمپوی بلند، اینتروال پیس ماراتن، فارتلک درازمدت، لانگ‌ران با پایان پیس ماراتن', function () {
  var v = variants(profileFor(6, { goal: goalOf('42') }), 9);
  ['longTempo', 'mpInt', 'longFartlek', 'long:mp'].forEach(function (k) { assert(v[k], k); });
});
test('هدف اولترا: تپه‌ی بلند، فرود، لانگ‌ران با ارتفاع‌گیری، شدت فقط با RPE', function () {
  var p = profileFor(7, { goal: goalOf('ultra', null, { km: 50, gain: 2000 }), pb: { distanceKm: 10, timeSec: hms(0, 42) } });
  var v = variants(p, 12);
  ['longHills', 'downhill', 'long:ultra'].forEach(function (k) { assert(v[k], k); });
  for (var w = 0; w < 12; w++) weekAt(p, w).days.forEach(function (d) {
    if (d.spec || d.type === 'long') assert(d.how.indexOf('دقیقه در کیلومتر') < 0, 'no pace in trail: ' + d.label);
    if (d.type === 'long') assert(d.vert > 0, 'vert target');
  });
});
test('اولترا ۵۰ کیلومتر: ۳۰۰۰ متر صعود در مقابل مسیر تقریباً تخت', function () {
  var steep = profileFor(7, { goal: goalOf('ultra', null, { km: 50, gain: 3000 }) });
  var flat = profileFor(7, { goal: goalOf('ultra', null, { km: 50, gain: 400 }) });
  assert.strictEqual(C.goalInfo(steep).cls, 'mountain'); // ۶۰ متر بر کیلومتر
  assert.strictEqual(C.goalInfo(flat).cls, 'flat');
  var vs = variants(steep, 12), vf = variants(flat, 12);
  var hillsS = (vs.longHills || 0) + (vs.downhill || 0), hillsF = (vf.longHills || 0) + (vf.downhill || 0);
  assert(hillsS > hillsF * 2, hillsS + ' vs ' + hillsF);
  assert((vf.steady || 0) > (vs.steady || 0));
  var vertS = 0, vertF = 0;
  for (var w = 0; w < 12; w++) { vertS += weekAt(steep, w).vert; vertF += weekAt(flat, w).vert; }
  assert(vertS > vertF * 3, vertS + ' vs ' + vertF);
});
test('ران‌های پشت‌سرهم: فقط اولترا، سطح ۵+، با پایه‌ی کافی؛ دو روز متوالی', function () {
  var p = profileFor(7, { goal: goalOf('ultra') });
  var found = 0;
  for (var w = 0; w < 12; w++) {
    var wk = weekAt(p, w);
    if (w < 4 || wk.phase.key === 'deload' || wk.period === 'base') assert(!wk.b2b, 'w' + w);
    if (wk.b2b) {
      found++;
      var d1 = wk.days.findIndex(function (d) { return d.b2b === 'day1'; });
      assert(d1 >= 0 && wk.days[d1 + 1].b2b === 'day2' && wk.days[d1].km > wk.days[d1 + 1].km);
    }
  }
  assert(found > 0, 'b2b for level 7');
  [3, 4].forEach(function (n) { for (var w = 0; w < 16; w++) assert(!weekAt(profileFor(n, { goal: goalOf('ultra') }), w).b2b); });
  for (var x = 0; x < 16; x++) assert(!weekAt(profileFor(7, { goal: goalOf('21') }), x).b2b);
});
test('جلسات کیفی اوایل هفته، با حداقل ۴۸ ساعت فاصله تا لانگ‌ران', function () {
  ['none', '5', '21', '42', 'ultra'].forEach(function (g) {
    [5, 6, 7, 8].forEach(function (n) {
      for (var w = 0; w < 8; w++) {
        var wk = weekAt(profileFor(n, { goal: goalOf(g) }), w);
        var q = wk.days.map(function (d, i) { return d.spec ? i : -1; }).filter(function (i) { return i >= 0; });
        if (!q.length) continue;
        assert(q[0] <= 2, g + ' L' + n + ' w' + w + ' first quality on ' + q[0]);
        q.forEach(function (i) { assert(i <= 3, g + ' L' + n + ' quality on ' + i); });
      }
    });
  });
});
test('بدون هدف: چرخه‌ی متنوع در ۱۲ هفته (اینتروال کوتاه، تمپو، فارتلک، تپه، آستانه)', function () {
  [5, 6].forEach(function (n) {
    var v = variants(profileFor(n), 12);
    ['shortInt', 'tempoRun', 'speedFartlek', 'thresholdInt', 'shortHills'].forEach(function (k) { assert(v[k], 'L' + n + ' ' + k); });
  });
});
test('۸۰/۲۰ برای همه‌ی هدف‌ها', function () {
  ['5', '10', '21', '42', 'ultra'].forEach(function (g) {
    [3, 5, 6, 7, 8, 9].forEach(function (n) {
      for (var w = 0; w < 12; w++) {
        var wk = weekAt(profileFor(n, { goal: goalOf(g) }), w);
        assert(wk.hardPct <= 20, g + ' L' + n + ' w' + w + ' ' + wk.hardPct);
        assert(Math.abs(wk.totalKm - wk.volumeTarget) <= 0.5 || w >= 0 && wk.totalKm <= wk.volumeTarget + 0.5, g + ' L' + n + ' w' + w + ' km ' + wk.totalKm + '/' + wk.volumeTarget);
      }
    });
  });
});
test('هدف بدون تاریخ: تمرین‌های هدف بدون تیپر؛ پروفایل قدیمی (race) هم خونده می‌شه', function () {
  var p = profileFor(6, { goal: goalOf('21') });
  assert.strictEqual(C.raceInfo(p), null);
  assert.strictEqual(C.goalInfo(p).category, 'half');
  var old = profileFor(6, { race: { has: true, distance: '42', date: '2026-12-18' } });
  assert.strictEqual(C.goalInfo(old).category, 'marathon');
  assert.strictEqual(C.raceInfo(old).key, '42');
});
test('تیپر و روز مسابقه برای اولترا', function () {
  var p = profileFor(7, { goal: goalOf('ultra', '2026-12-18', { km: 50, gain: 2000, terrain: 'technical' }) });
  var race = C.parseDate('2026-12-18');
  var r = C.sessionFor(p, race);
  assert.strictEqual(r.type, 'race'); assert.strictEqual(r.vert, 2000);
  assert.strictEqual(C.sessionFor(p, C.addDays(race, -1)).type, 'rest');
  assert.strictEqual(C.buildWeek(p, C.addDays(race, -7)).phase.key, 'taper');
});

// ---------- حجم هفته‌ی اخیر + میانگین ماه ----------
function volProfile(last, avg, reason, over) {
  return Object.assign(profileFor(4, { experience: 'gt3y', structured: true, pb: null }), { lastWeekKm: last, monthAvgKm: avg, volumeReason: reason }, over || {});
}
function weekKms(p, n) {
  var out = [];
  for (var w = 0; w < n; w++) out.push(C.buildWeek(p, C.addDays(C.parseDate(p.startDate), w * 7)).totalKm);
  return out;
}
test('حجم: میانگین وزنی ۷۰٪ ماه + ۳۰٪ هفته؛ بدون فاصله‌ی زیاد، شروع = میانگین وزنی', function () {
  var v = C.volumeInfo(volProfile(36, 40, null));
  assert.strictEqual(v.gap, null); assert.strictEqual(v.weighted, 38.5); assert.strictEqual(v.start, 38.5);
  assert.strictEqual(C.assessLevel(volProfile(36, 40, null)).level, 4);
  // پروفایل قدیمی (فقط یک عدد) مثل قبل
  assert.strictEqual(C.volumeInfo(profileFor(4)).start, profileFor(4).currentWeeklyKm);
});
test('حجم: افت به‌خاطر سفر → سطح از میانگین ماه، شروع ۷۵٪، برگشت تا میانگین با قانون ۱۰٪', function () {
  var p = volProfile(10, 40, 'travel');
  var v = C.volumeInfo(p), a = C.assessLevel(p);
  assert.strictEqual(v.gap, 'drop'); assert.strictEqual(v.level, 40); assert.strictEqual(v.start, 30);
  assert.strictEqual(a.level, 4);
  assert(a.notes.some(function (n) { return n.indexOf('سفر') >= 0; }));
  var k = weekKms(p, 8);
  assert.strictEqual(k[0], 30);
  assert.strictEqual(Math.max.apply(null, k), 40);
  // قانون ۱۰٪ نسبت به آخرین هفته‌ی کامل (هفته‌ی سبک حساب نمی‌شه)
  for (var i = 1; i < k.length; i++) assert(k[i] <= Math.max.apply(null, k.slice(0, i)) * 1.1 + 0.5, k.join(','));
});
test('حجم: افت به‌خاطر آسیب → سطح از میانگین وزنی، شروع ۵۰٪، هشدار پزشکی', function () {
  var p = volProfile(10, 40, 'injury');
  var v = C.volumeInfo(p);
  assert.strictEqual(v.level, 31); assert.strictEqual(v.start, 20); assert.strictEqual(v.ceiling, 40);
  assert.strictEqual(C.assessLevel(p).level, 3);
  assert(C.profileWarnings(p, C.parseDate(p.startDate)).some(function (x) { return x.indexOf('آسیب‌دیدگی') >= 0; }));
  assert.strictEqual(weekKms(p, 1)[0], 20);
});
test('حجم: افت بدون دلیل خاص = کاهش واقعی؛ جهش یک‌هفته‌ای سطح رو بالا نمی‌بره؛ رکورد ناسازگار → همون قانون احتیاط', function () {
  var real = C.volumeInfo(volProfile(10, 40, 'none'));
  assert.strictEqual(real.start, 20); assert.strictEqual(real.ceiling, null);
  var rise = C.volumeInfo(volProfile(60, 30, null));
  assert.strictEqual(rise.gap, 'rise'); assert.strictEqual(rise.start, 39); assert.strictEqual(C.assessLevel(volProfile(60, 30, null)).level, 4);
  // رکورد خیلی سریع‌تر از حجم → سطح از رکورد + رشد با احتیاط
  var fast = C.assessLevel(volProfile(10, 40, 'travel', { pb: { distanceKm: 10, timeSec: hms(0, 36) } }));
  assert(fast.level >= 6 && fast.cautious);
  assert(fast.notes.length >= 2);
});

// ---------- تقویم و شروع هفته ----------
test('شروع هفته از دوشنبه: هفته دوشنبه تا یکشنبه، لانگ‌ران یکشنبه، بدون دو روز سخت پشت‌سرهم', function () {
  C.setWeekStart(1);
  try {
    [3, 5, 7].forEach(function (n) {
      var p = profileFor(n, { startDate: '2026-09-28' }); // دوشنبه
      for (var w = 0; w < 8; w++) {
        var wk = C.buildWeek(p, C.addDays(C.parseDate(p.startDate), w * 7));
        assert.strictEqual(C.parseDate(wk.days[0].date).getDay(), 1);
        assert.strictEqual(wk.days[6].type === 'long' || wk.days[6].type === 'rest' || wk.days[6].type === 'race', true, wk.days[6].type);
        for (var i = 0; i < 6; i++) assert(!(wk.days[i].hard && wk.days[i + 1].hard) || wk.days[i + 1].b2b === 'day2', n + ' ' + w + ' ' + i);
      }
    });
    // روزهای آزاد با مبنای شنبه ذخیره می‌شن: فقط سه‌شنبه (۳) و یکشنبه (۱) → همون روزها
    var q = profileFor(4, { startDate: '2026-09-28', days: [1, 3] });
    var wk2 = C.buildWeek(q, C.parseDate('2026-10-05'));
    var runDays = wk2.days.filter(function (d) { return d.type !== 'rest'; }).map(function (d) { return C.parseDate(d.date).getDay(); }).sort();
    assert.deepStrictEqual(runDays, [0, 2]);
    assert.deepStrictEqual(C.WEEK_ORDER, [2, 3, 4, 5, 6, 0, 1]);
  } finally { C.setWeekStart(6); }
  assert.strictEqual(C.parseDate(C.buildWeek(profileFor(5), C.parseDate('2026-10-05')).days[0].date).getDay(), 6);
});
test('تبدیل تقویم: jalaali-js با تقویم ICU برای ۲۰ سال یکیه؛ نمونه‌های شناخته‌شده', function () {
  var J = require('../js/vendor/jalaali.js');
  assert.deepStrictEqual(J.toJalaali(2026, 10, 1), { jy: 1405, jm: 7, jd: 9 });
  assert.deepStrictEqual(J.toGregorian(1403, 1, 1), { gy: 2024, gm: 3, gd: 20 });
  assert.strictEqual(J.jalaaliMonthLength(1403, 12), 30);
  assert.strictEqual(J.jalaaliMonthLength(1404, 12), 29);
  var f = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
  var bad = 0;
  for (var d = new Date(2020, 0, 1); d < new Date(2040, 0, 1); d = C.addDays(d, 1)) {
    var parts = {}; f.formatToParts(d).forEach(function (x) { parts[x.type] = x.value; });
    var r = J.toJalaali(d);
    if (+parts.year !== r.jy || +parts.month !== r.jm || +parts.day !== r.jd) bad++;
  }
  assert.strictEqual(bad, 0);
});

// ---------- چرخه‌ی قاعدگی ----------
function cycleProfile(start, over) {
  return Object.assign(profileFor(5), { sex: 'female', cycle: { enabled: true, lastStart: start, cycleLen: 28, periodLen: 5 } }, over || {});
}
test('چرخه: فازها از تاریخ شروع، طول چرخه و طول پریود؛ تکرار در چرخه‌های بعدی', function () {
  var p = cycleProfile('2026-10-04');
  function ph(d) { var i = C.cycleInfo(p, C.parseDate(d)); return i.phase + ':' + i.day + (i.heavy ? 'h' : ''); }
  assert.strictEqual(ph('2026-10-04'), 'period:1h');
  assert.strictEqual(ph('2026-10-05'), 'period:2h');
  assert.strictEqual(ph('2026-10-08'), 'period:5');
  assert.strictEqual(ph('2026-10-09'), 'follicular:6');
  assert.strictEqual(ph('2026-10-16'), 'ovulation:13');   // روز ۱۴ = ۲۸−۱۴؛ پنجره ۱۲ تا ۱۵
  assert.strictEqual(ph('2026-10-20'), 'luteal:17');
  assert.strictEqual(ph('2026-10-27'), 'lateLuteal:24');
  assert.strictEqual(ph('2026-11-01'), 'period:1h');      // چرخه‌ی بعد
  assert.strictEqual(ph('2026-09-30'), 'lateLuteal:25');  // قبل از تاریخ ثبت‌شده هم تخمین زده می‌شه
  var np = C.nextPeriod(p, C.parseDate('2026-10-25'));
  assert.strictEqual(C.dateKey(np.next), '2026-11-01'); assert.strictEqual(np.daysTo, 7);
});
test('چرخه: فقط با رضایت (زن + فعال)؛ پیشنهاد فقط برای جلسه‌ی سخت، بدون تغییر خودکار', function () {
  assert.strictEqual(C.cycleInfo(cycleProfile('2026-10-04', { sex: 'na' }), C.parseDate('2026-10-05')), null);
  assert.strictEqual(C.cycleInfo(cycleProfile('2026-10-04', { cycle: { enabled: false, lastStart: '2026-10-04' } }), C.parseDate('2026-10-05')), null);
  var p = cycleProfile('2026-10-04');
  var week = C.buildWeek(p, C.parseDate('2026-10-05'));
  var noCycle = C.buildWeek(profileFor(5), C.parseDate('2026-10-05'));
  // برنامه‌ی موتور دست نخورده: همون جلسه‌های بدون چرخه
  assert.deepStrictEqual(week.days.map(function (d) { return d.type; }), noCycle.days.map(function (d) { return d.type; }));
  var hard = week.days.filter(function (d) { return d.hard && d.type !== 'race'; })[0];
  var info = C.cycleInfo(p, C.parseDate('2026-10-05'));
  var sug = C.cycleSuggestion(hard, info, null);
  assert(sug && sug.alt.type === 'easy' && sug.alt.km <= hard.km && sug.rest.type === 'rest');
  var easy = week.days.filter(function (d) { return d.type === 'easy'; })[0];
  assert.strictEqual(C.cycleSuggestion(easy, info, null), null);
  assert.strictEqual(C.cycleSuggestion(hard, C.cycleInfo(p, C.parseDate('2026-10-12')), null), null); // فولیکولار
  var late = C.cycleSuggestion(hard, C.cycleInfo(p, C.parseDate('2026-10-28')), null);
  assert(late && late.phase === 'lateLuteal' && late.rest === null);
});

// ---------- سطح ۰ ----------
function zeroProfile(over) {
  return Object.assign({ age: 40, weightKg: 80, heightCm: 172, days: [0, 1, 2, 3, 4, 5, 6], locations: ['park'], injury: '',
    currentWeeklyKm: 0, experience: 'never', structured: false, schemaVersion: 3, pb: null, startDate: '2026-09-26' }, over || {});
}
test('سطح ۰: «هیچ‌وقت ندویده‌ام» همیشه سطح ۰، حتی با حجم یا رکورد', function () {
  assert.strictEqual(C.assessLevel(zeroProfile()).level, 0);
  assert.strictEqual(C.assessLevel(zeroProfile({ currentWeeklyKm: 30, pb: { distanceKm: 5, timeSec: 1500 } })).level, 0);
  assert.strictEqual(C.assessLevel(profileFor(1)).level, 1);
  assert.strictEqual(C.LEVELS[0].name, 'تازه‌وارد کامل');
  assert.strictEqual(C.LEVELS[1].name, 'تازه‌کار');
  for (var n = 2; n <= 10; n++) assert.strictEqual(C.LEVELS[n].n, n);
});
test('سطح ۰: فقط پیاده‌روی و دویدن سبک، ۳ جلسه، هفته‌ی اول پیاده‌روی قدرتی، بدون روز سخت', function () {
  var p = zeroProfile();
  var w1 = C.buildWeek(p, C.parseDate('2026-09-26'));
  var s = w1.days.filter(function (d) { return d.type !== 'rest'; });
  assert.strictEqual(s.length, 3);
  s.forEach(function (d) {
    assert.strictEqual(d.type, 'walkrun'); assert.strictEqual(d.hard, false); assert.strictEqual(d.km, null);
    assert(d.minutes <= 30, d.minutes); assert(d.cheer && d.how.indexOf('RPE') < 0);
  });
  assert.strictEqual(w1.zeroStage, 0);
  assert(/پیاده‌روی تند/.test(s[0].steps[0]), s[0].steps[0]);
});
test('سطح ۰: «مناسب» → ۸ هفته تا ۱۵ دقیقه، «راحت» → ۴ هفته، «سخت» → تکرار مرحله', function () {
  function weeksTo(feel) {
    var p = zeroProfile({ zeroWeeks: {} });
    for (var w = 0; w < 20; w++) {
      var wk = C.buildWeek(p, C.addDays(C.parseDate(p.startDate), w * 7));
      if (wk.zeroStage === wk.zeroFinal) return w + 1;
      if (feel) p.zeroWeeks[wk.start] = { feel: feel, src: 'user' };
    }
    return 99;
  }
  assert.strictEqual(weeksTo(null), 8);
  assert.strictEqual(weeksTo('ok'), 8);
  assert.strictEqual(weeksTo('easy'), 5);
  assert.strictEqual(weeksTo('hard'), 99);
  var last = C.buildWeek(zeroProfile(), C.addDays(C.parseDate('2026-09-26'), 7 * 7)).days.filter(function (d) { return d.type === 'walkrun'; })[0];
  assert.strictEqual(last.minutes, 25);
  assert(/۱۵ دقیقه دویدن آروم و پیوسته/.test(last.steps[0]));
});
test('سطح ۰: بدون هشدار تمرین ساختاریافته و یادآوری تایم‌تست؛ مسابقه بدون تیپر روی جلسه‌ها', function () {
  var p = zeroProfile({ goal: goalOf('5', '2026-12-18') });
  assert.strictEqual(C.fitnessReminder(p, C.parseDate('2026-10-01')), null);
  var w = C.profileWarnings(p, C.parseDate('2026-10-01'));
  assert(w.every(function (x) { return x.indexOf('ساختاریافته') < 0; }));
  assert(w.some(function (x) { return x.indexOf('هفته آماده‌سازی') >= 0; }));
  var race = C.parseDate('2026-12-18');
  assert.strictEqual(C.sessionFor(p, race).type, 'race');
  assert.strictEqual(C.sessionFor(p, C.addDays(race, -1)).type, 'rest');
  C.buildWeek(p, C.addDays(race, -5)).days.forEach(function (d) { assert(['walkrun', 'rest', 'race'].indexOf(d.type) >= 0, d.type); });
});

// ---------- دوزبانه ----------
test('دیکشنری فارسی و انگلیسی دقیقاً کلیدهای یکسان دارن', function () {
  var fa = require('../js/i18n/fa.js'), en = require('../js/i18n/en.js');
  function keys(o, pre, out) {
    Object.keys(o).forEach(function (k) {
      var v = o[k], path = pre ? pre + '.' + k : k;
      // جمع انگلیسی ({one, other}) معادل یک رشته‌ست
      if (v && typeof v === 'object' && !Array.isArray(v) && !('other' in v)) keys(v, path, out); else out.push(path);
    });
    return out;
  }
  var a = keys(fa, '', []), b = keys(en, '', []);
  var missingEn = a.filter(function (k) { return b.indexOf(k) < 0; }), missingFa = b.filter(function (k) { return a.indexOf(k) < 0; });
  assert.deepStrictEqual([missingEn, missingFa], [[], []]);
});
test('برنامه به انگلیسی: هیچ متن فارسی در جلسه‌ها، هشدارها و پیام‌ها نیست', function () {
  var I = C.i18n;
  I.setLang('en', false);
  try {
    var fa = /[؀-ۿ]/, found = [];
    var scan = function (o) {
      if (typeof o === 'string') { if (fa.test(o)) found.push(o); } else if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { scan(o[k]); });
    };
    [1, 3, 5, 7, 9].forEach(function (n) {
      ['none', '10', '21', '42', 'ultra'].forEach(function (g) {
        var p = profileFor(n, { age: 55, injury: 'knee', hrMax: 185, hrRest: 50,
          goal: g === 'ultra' ? goalOf('ultra', '2026-12-18', { km: 60, gain: 3000, loss: 4000, terrain: 'technical', altitude: 2500 }) : goalOf(g, g === 'none' ? null : '2026-12-18') });
        for (var w = 0; w < 16; w++) {
          var week = C.buildWeek(p, C.addDays(C.parseDate(p.startDate), w * 7));
          scan(week);
          week.days.forEach(function (s) { scan(C.adaptSession(s, { fatigue: 5, sleep: 1, pain: false }, { sleep: 1 }, null)); });
        }
        scan(C.profileWarnings(p, C.parseDate(p.startDate)));
        scan(C.assessLevel(p).notes);
      });
    });
    scan([C.PAIN_MESSAGE, C.TALK_TEST, C.EASY_RPE_WARNING, C.DAY_NAMES, C.describeDuration(5130)]);
    assert.deepStrictEqual(found.slice(0, 5), []);
    assert.strictEqual(C.describeDuration(580), '9 min 40 s');
    assert.strictEqual(C.TYPE_INFO.tempo.label, 'Tempo');
  } finally { I.setLang('fa', false); }
  assert.strictEqual(C.TYPE_INFO.tempo.label, 'تمپو');
});

test('بخش آموزش: هشت مقاله‌ی دوزبانه با ساختار و طول یکسان', function () {
  var lf = require('../js/i18n/learn-fa.js'), le = require('../js/i18n/learn-en.js');
  var ids = ['vdot', 'rpe', 'eighty', 'types', 'fartleks', 'tenpct', 'warmup', 'cycle'];
  assert.deepStrictEqual(Object.keys(lf.articles), ids);
  assert.deepStrictEqual(Object.keys(le.articles), ids);
  assert.deepStrictEqual(Object.keys(lf).sort(), Object.keys(le).sort());
  function words(html) {
    return html.replace(/<p class="learn-src">[\s\S]*?<\/p>/, '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(function (w) { return /[\p{L}\p{N}]/u.test(w); }).length;
  }
  ids.forEach(function (id) {
    [lf, le].forEach(function (d) {
      var a = d.articles[id];
      assert(a.title && a.summary && a.body, id);
      var n = words(a.body);
      assert(n >= 300 && n <= 500, id + ': ' + n + ' کلمه');
      assert(/<h3>/.test(a.body) && /class="learn-src"/.test(a.body), id);
      // HTML متوازن (بدون تگ باز مونده)
      ['p', 'ul', 'li', 'h3', 'b', 'i'].forEach(function (tag) {
        var open = (a.body.match(new RegExp('<' + tag + '[ >]', 'g')) || []).length, close = (a.body.match(new RegExp('</' + tag + '>', 'g')) || []).length;
        assert.strictEqual(open, close, id + ' <' + tag + '>');
      });
    });
    assert.strictEqual(lf.articles[id].body.split('<h3>').length, le.articles[id].body.split('<h3>').length, id + ': تعداد زیرعنوان‌ها');
    assert(!/[؀-ۿ]/.test(JSON.stringify(le.articles[id])), id + ': متن فارسی در نسخه‌ی انگلیسی');
  });
  // در دسترس از طریق t()
  var I = C.i18n;
  assert.strictEqual(I.t('learn.articles.vdot.title'), lf.articles.vdot.title);
  I.setLang('en', false);
  try { assert.strictEqual(I.t('learn.readMin', { n: 2 }), '2 min read'); } finally { I.setLang('fa', false); }
});

console.log(passed + ' تست موفق' + (process.exitCode ? ' — برخی ناموفق' : ''));
