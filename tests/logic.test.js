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
// پروفایل سناریو: شنبه، سه‌شنبه، پنجشنبه، جمعه → اینتروال سه‌شنبه
function adaptProfile(over) {
  return Object.assign({ age: 33, weightKg: 68, heightCm: 175, days: [0, 3, 5, 6], locations: ['park'], injury: '', currentWeeklyKm: 45, lastWeekKm: 45, monthAvgKm: 45,
    experience: 'gt3y', structured: true, schemaVersion: 3, goal: goalOf('10', '2027-02-12'), pb: { distanceKm: 10, timeSec: hms(0, 44), date: '2026-09-01' }, startDate: '2026-09-26' }, over || {});
}
var ADAPT_TUE = '2026-10-06';
function adaptOn(p, key, checkins) {
  return C.adaptSession(C.sessionFor(p, C.parseDate(key)), checkins[key], null, C.paceZones(p), { profile: p, checkins: checkins });
}
function ck(f, sl, extra) { return Object.assign({ fatigue: f, sleep: sl, pain: false }, extra || {}); }
test('چک‌این: درجه‌بندی تطبیق متناسب با شدت علائم', function () {
  var p = adaptProfile(), base = C.sessionFor(p, C.parseDate(ADAPT_TUE));
  assert.strictEqual(base.type, 'interval');
  var on = function (c) { var m = {}; m[ADAPT_TUE] = c; return adaptOn(p, ADAPT_TUE, m); };
  // خفیف: همون اینتروال با حجم کمتر
  var mild = on(ck(3, 4));
  assert.strictEqual(mild.adaptation.tier, 'mild');
  assert.strictEqual(mild.session.type, 'interval');
  assert(mild.session.hardKm < base.hardKm);
  // متوسط (یک روز خستگی ۴ تصادفی): همون اینتروال، سبک‌تر از خفیف، با استراحت بیشتر
  var mod = on(ck(4, 4));
  assert.strictEqual(mod.adaptation.tier, 'moderate');
  assert.strictEqual(mod.session.type, 'interval');
  assert(mod.session.hardKm < mild.session.hardKm);
  assert(mod.session.steps.some(function (x) { return /۵۰٪/.test(x); }));
  // جدی: ایزی ران، و با خواب بد هم: استراحت فعال
  assert.strictEqual(on(ck(5, 4)).session.type, 'easy');
  assert.strictEqual(on(ck(5, 2)).session.type, 'rest');
  // بدون علائم: بدون تغییر
  assert.strictEqual(on(ck(2, 4)).adaptation, null);
});
test('چک‌این: تاریخچه‌ی روزهای قبل واکنش رو تغییر می‌ده', function () {
  var p = adaptProfile(), m = {};
  // خستگی ۴ + خواب ضعیف + دو چک‌این قبلی خسته → تمپوی ملایم (نه ایزی، نه همون اینتروال)
  m['2026-10-04'] = ck(3, 3); m['2026-10-05'] = ck(3, 3); m[ADAPT_TUE] = ck(4, 2, { hours: 5.5 });
  var r = adaptOn(p, ADAPT_TUE, m);
  assert.strictEqual(r.adaptation.tier, 'moderate');
  assert.strictEqual(r.session.type, 'tempo');
  assert(/5\.5/.test(r.adaptation.why) && /4/.test(r.adaptation.why), r.adaptation.why);
  // خستگی بالا سه روز پشت‌سرهم → جدی
  var m2 = {}; m2['2026-10-04'] = ck(4, 3); m2['2026-10-05'] = ck(4, 3); m2[ADAPT_TUE] = ck(4, 3);
  var r2 = adaptOn(p, ADAPT_TUE, m2);
  assert.strictEqual(r2.adaptation.tier, 'severe');
  assert(['easy', 'rest'].indexOf(r2.session.type) >= 0);
  // خواب: یک شب بد → خفیف (همون نوع)، دو شب → متوسط (نه ایزی)
  var m3 = {}; m3[ADAPT_TUE] = ck(2, 2);
  assert.strictEqual(adaptOn(p, ADAPT_TUE, m3).adaptation.tier, 'mild');
  assert.strictEqual(adaptOn(p, ADAPT_TUE, m3).session.type, 'interval');
  m3['2026-10-05'] = ck(2, 1);
  var r3 = adaptOn(p, ADAPT_TUE, m3);
  assert.strictEqual(r3.adaptation.tier, 'moderate');
  assert.notStrictEqual(r3.session.type, 'easy');
  // سازگاری با فراخوانی قدیمی (بدون تاریخچه)
  var hard = weekAt(profileFor(6), 0).days.find(function (s) { return s.hard; });
  assert.strictEqual(C.adaptSession(hard, { fatigue: 2, sleep: 2 }, { sleep: 4 }).session.type, hard.type);
});
test('چک‌این: توضیح علت و معلول، اثر روی هفته، جبران جزئی و خلاصه', function () {
  var p = adaptProfile(), m = {};
  m['2026-10-04'] = ck(3, 3); m['2026-10-05'] = ck(3, 3); m[ADAPT_TUE] = ck(4, 2);
  var a = adaptOn(p, ADAPT_TUE, m).adaptation;
  assert(a.why && a.action && a.impact, JSON.stringify(a));
  assert.strictEqual(a.impactKind, 'makeup');
  assert.strictEqual(a.makeupDay, '2026-10-08');
  // پنجشنبه با حال خوب: افزودنی اختیاری استراید
  m['2026-10-08'] = ck(2, 4);
  var thu = adaptOn(p, '2026-10-08', m);
  assert.strictEqual(thu.adaptation, null);
  assert(thu.session.makeup && /استراید/.test(thu.session.makeup.text));
  // پنجشنبه هنوز خسته: افزودنی نداره
  m['2026-10-08'] = ck(3, 3);
  assert(!adaptOn(p, '2026-10-08', m).session.makeup);
  // نزدیک مسابقه: اطمینان‌دادن، بدون جبران
  var pr = adaptProfile({ goal: goalOf('10', '2026-10-15') }), m4 = {};
  var raceTue = '2026-10-06';
  m4[raceTue] = ck(4, 4);
  var ar = adaptOn(pr, raceTue, m4);
  if (ar.adaptation && ar.adaptation.kind === 'downgrade') assert.strictEqual(ar.adaptation.impactKind, 'raceNear');
  // خلاصه‌ی هفته
  var done = { '2026-10-03': true };
  var sum = C.weekAdaptSummary(p, m, done, C.parseDate(ADAPT_TUE));
  assert.strictEqual(sum.asPlanned, 1);
  assert.strictEqual(sum.adapted, 1);
  assert(/۱۰ کیلومتر/.test(sum.text) && /درسته/.test(sum.text), sum.text);
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
      assert(/<h2>/.test(a.body) && !/<h3>/.test(a.body) && /class="learn-src"/.test(a.body), id);
      // HTML متوازن (بدون تگ باز مونده)
      ['p', 'ul', 'li', 'h2', 'b', 'i'].forEach(function (tag) {
        var open = (a.body.match(new RegExp('<' + tag + '[ >]', 'g')) || []).length, close = (a.body.match(new RegExp('</' + tag + '>', 'g')) || []).length;
        assert.strictEqual(open, close, id + ' <' + tag + '>');
      });
    });
    assert.strictEqual(lf.articles[id].body.split('<h2>').length, le.articles[id].body.split('<h2>').length, id + ': تعداد زیرعنوان‌ها');
    assert(!/[؀-ۿ]/.test(JSON.stringify(le.articles[id])), id + ': متن فارسی در نسخه‌ی انگلیسی');
  });
  // در دسترس از طریق t()
  var I = C.i18n;
  assert.strictEqual(I.t('learn.articles.vdot.title'), lf.articles.vdot.title);
  I.setLang('en', false);
  try { assert.strictEqual(I.t('learn.readMin', { n: 2 }), '2 min read'); } finally { I.setLang('fa', false); }
});

// ---------- پیشرفت من (آنالیز) ----------
function analyticsData(over) {
  var p = profileFor(5, Object.assign({ goal: goalOf('10', '2027-03-12'), pb: { distanceKm: 10, timeSec: hms(0, 45), date: '2026-09-10' } }, over || {}));
  var st = { profile: p, checkins: {}, done: {}, postRuns: {}, cycleChoices: {}, doneLog: {} };
  // ۸ هفته: همه‌ی جلسه‌های دویدن انجام شده، به‌جز سه‌شنبه‌ها
  for (var d = C.parseDate(p.startDate); d <= C.parseDate('2026-11-20'); d = C.addDays(d, 1)) {
    var k = C.dateKey(d), s = C.sessionFor(p, d);
    if (['rest', 'none'].indexOf(s.type) < 0 && d.getDay() !== 2) st.done[k] = true;
  }
  return st;
}
test('آنالیز: حجم هفتگی = جمع جلسه‌های انجام‌شده، میانگین ۴ هفته و بازه', function () {
  var st = analyticsData(), today = C.parseDate('2026-11-20');
  var a = C.analytics(st, today, null);
  var w0 = a.weeks[0], sum = 0;
  for (var i = 0; i < 7; i++) {
    var d = C.addDays(C.parseDate(w0.start), i), s = C.sessionFor(st.profile, d);
    if (st.done[C.dateKey(d)]) sum += s.km || 0;
  }
  assert(Math.abs(w0.km - sum) < 0.05, w0.km + ' vs ' + sum);
  assert.strictEqual(a.weeks[a.weeks.length - 1].partial, true);
  assert.strictEqual(a.weeks[2].maKm, null);
  var w4 = a.weeks[4];
  assert(Math.abs(w4.maKm - (a.weeks[1].km + a.weeks[2].km + a.weeks[3].km + a.weeks[4].km) / 4) < 1e-6);
  // بازه‌ی ۴ هفته
  var a4 = C.analytics(st, today, 28);
  assert(a4.weeks.length <= 5 && a4.weeks.length >= 4, a4.weeks.length);
  assert(a4.pmc.length === 28);
  // خلاصه‌ی ذخیره‌شده بر محاسبه‌ی دوباره مقدمه (تاریخچه با تغییر برنامه عوض نمی‌شه)
  var k = Object.keys(st.done)[0];
  st.doneLog[k] = { type: 'easy', km: 99 };
  assert(Math.abs(C.analytics(st, today, null).weeks[0].km - (sum - (C.sessionFor(st.profile, C.parseDate(k)).km || 0) + 99)) < 0.05);
});
test('آنالیز: CTL/ATL/TSB با میانگین نمایی ۴۲ و ۷ روزه', function () {
  var st = analyticsData(), a = C.analytics(st, C.parseDate('2026-11-20'), null);
  a.pmc.forEach(function (d) { assert(Math.abs(d.tsb - (d.ctl - d.atl)) < 1e-9); });
  // یک هفته بدون تمرین: خستگی سریع‌تر از فیتنس افت می‌کنه، TSB بالا می‌ره
  var b = C.analytics(st, C.parseDate('2026-11-27'), null), p = b.pmc, n = p.length;
  var dAtl = p[n - 8].atl - p[n - 1].atl, dCtl = p[n - 8].ctl - p[n - 1].ctl;
  assert(dAtl > dCtl && dCtl > 0, dAtl + ' ' + dCtl);
  assert(p[n - 1].tsb > p[n - 8].tsb);
  // بار جلسه = دقیقه × RPE؛ RPE ثبت‌شده‌ی کاربر جای پیش‌فرض رو می‌گیره
  var e = { type: 'easy', km: 10 };
  assert(Math.abs(C.sessionLoad(e, 5, 360) - 60 * 5) < 1e-9);
  assert(Math.abs(C.sessionLoad(e, null, 360) - 60 * 3.5) < 1e-9);
  assert.strictEqual(C.sessionLoad({ type: 'rest' }, 5, 360), 0);
});
test('آنالیز: پیس و پیش‌بینی مسابقه از رکوردها؛ چک‌این و پایبندی', function () {
  var st = analyticsData({ fitnessTests: [{ date: '2026-10-24', distanceKm: 5, timeSec: hms(0, 21, 0), kind: 't5' }] });
  st.checkins['2026-11-03'] = { fatigue: 5, sleep: 3, pain: false };   // سه‌شنبه؛ جلسه‌ی سخت تعدیل می‌شه
  st.checkins['2026-11-05'] = { fatigue: 2, sleep: 4, pain: true };
  st.done['2026-11-05'] = false; delete st.done['2026-11-05'];
  var a = C.analytics(st, C.parseDate('2026-11-20'), null);
  var first = a.samples[0], last = a.samples[a.samples.length - 1];
  assert(last.vdot > first.vdot && last.e < first.e && last.t < first.t && last.i < first.i);
  assert(Math.abs(last.riegel - C.riegel(hms(0, 21), 5, 10)) < 1e-6);
  assert(Math.abs(first.riegel - hms(0, 45)) < 1e-6);
  assert.strictEqual(a.checkins.length, 2);
  var A = a.adherence;
  assert.strictEqual(A.planned, A.completed + A.adapted + A.pain + A.missed);
  var s5 = C.sessionFor(st.profile, C.parseDate('2026-11-05'));
  assert.strictEqual(A.pain, ['rest', 'none'].indexOf(s5.type) < 0 ? 1 : 0);
  assert(A.missed > 0); // سه‌شنبه‌ها انجام نشدن
  // بدون هیچ داده‌ای: بدون خطا و خالی
  var empty = C.analytics({ profile: st.profile, checkins: {}, done: {} }, C.parseDate('2026-09-27'), 91);
  assert.strictEqual(empty.runsDone, 0);
  assert.strictEqual(empty.checkins.length, 0);
  // اولترا: صعود هفتگی از جلسه‌ها
  var u = analyticsData({ goal: goalOf('ultra', '2027-03-12', { km: 60, gain: 3000 }) });
  var au = C.analytics(u, C.parseDate('2026-11-20'), null);
  assert(au.goal.ultra && au.weeks.some(function (w) { return w.vert > 0; }));
});

// ---------- PWA ----------
test('PWA: مانیفست، آیکون‌ها و هماهنگی کش سرویس‌ورکر با index.html', function () {
  var fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  var m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.strictEqual(m.display, 'standalone');
  assert(m.name && m.short_name && m.start_url && m.theme_color && m.background_color);
  ['192x192', '512x512'].forEach(function (sz) {
    assert(m.icons.some(function (i) { return i.sizes === sz && i.purpose === 'any'; }), sz);
    assert(m.icons.some(function (i) { return i.sizes === sz && i.purpose === 'maskable'; }), sz + ' maskable');
  });
  m.icons.forEach(function (i) {
    var buf = fs.readFileSync(path.join(root, i.src));
    // ابعاد واقعی PNG (IHDR)
    assert.strictEqual(buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20), i.sizes, i.src);
  });
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  var ver = /var VERSION = '(\d+)'/.exec(sw)[1];
  var assets = (html.match(/(?:src|href)="([^"#:]+\?v=\d+)"/g) || []).map(function (x) { return x.replace(/^(src|href)="|"$/g, ''); });
  assert(assets.length >= 10);
  assets.forEach(function (a) {
    assert.strictEqual(a.split('?v=')[1], ver, 'نسخه‌ی ' + a + ' با VERSION سرویس‌ورکر یکی نیست');
    assert(sw.indexOf("'" + a.split('?v=')[0] + "?v=' + VERSION") >= 0, a + ' در فهرست کش نیست');
    assert(fs.existsSync(path.join(root, a.split('?')[0])), a);
  });
  assert(/rel="manifest"/.test(html) && /apple-mobile-web-app-capable/.test(html) && /apple-touch-icon/.test(html) && /theme-color/.test(html));
});

// ---------- روزهای پریود: تنظیم خودکار و تغییر دستی یک دوره ----------
function periodProfile(mode, over) {
  // شروع آخرین پریود ۲۰۲۶-۱۰-۰۱، چرخه‌ی ۲۸ روزه، پریود ۵ روزه → دوره‌ها: ۱۰-۰۱، ۱۰-۲۹، ۱۱-۲۶ ...
  return profileFor(5, Object.assign({ sex: 'female', cycle: { enabled: true, lastStart: '2026-10-01', cycleLen: 28, periodLen: 5, periodMode: mode } }, over || {}));
}
function hardDayIn(p, from, to) {
  for (var d = C.parseDate(from); d <= C.parseDate(to); d = C.addDays(d, 1)) {
    var s = C.sessionFor(p, d);
    if (s && s.hard && s.type !== 'race') return { d: d, s: s };
  }
  return null;
}
test('پریود: حالت «فقط سبک» جلسه‌ی سخت رو به ایزی ران کوتاه‌تر تبدیل می‌کنه', function () {
  var p = periodProfile('easy');
  var h = hardDayIn(p, '2026-10-29', '2026-11-02');
  assert(h, 'یه جلسه‌ی سخت در دوره‌ی پریود لازمه');
  var plan = C.periodPlan(p, h.d);
  assert.strictEqual(plan.mode, 'easy');
  assert.strictEqual(plan.start, '2026-10-29');
  var alt = C.periodSession(h.s, plan, C.paceZones(p));
  assert.strictEqual(alt.type, 'easy');
  assert(alt.km <= h.s.km);
  assert(alt.periodCut && alt.periodCut.intensity);
});
test('پریود: «فقط سبک» حجم رو هم کم می‌کنه، نه فقط شدت (لانگ‌ران، ایزی ران، جلسه‌ی زمانی)', function () {
  var normal = { mode: 'easy', info: { heavy: false } }, heavy = { mode: 'easy', info: { heavy: true } };
  // لانگ‌ران ۱۴ کیلومتری نباید ۱۴ کیلومتر بمونه
  var l = C.periodSession({ type: 'long', km: 14, hard: true }, normal, null);
  assert.strictEqual(l.type, 'easy'); assert.strictEqual(l.km, 9);
  assert.deepStrictEqual([l.periodCut.from, l.periodCut.to], [14, 9]);
  assert.strictEqual(C.periodSession({ type: 'long', km: 14, hard: true }, heavy, null).km, 7);
  // سقف ۱۰ کیلومتر در روزهای پریود
  assert.strictEqual(C.periodSession({ type: 'long', km: 20, hard: true }, normal, null).km, 10);
  // ایزی ران هم کوتاه‌تر می‌شه؛ ایزی ران خیلی کوتاه دست نمی‌خوره
  var e = C.periodSession({ type: 'easy', km: 8 }, normal, null);
  assert.strictEqual(e.km, 5); assert.strictEqual(e.periodCut.intensity, false);
  assert.strictEqual(C.periodSession({ type: 'easy', km: 3 }, normal, null), null);
  // دو-پیاده: مدت کمتر، حداقل ۱۰ دقیقه
  var rw = C.periodSession({ type: 'runwalk', minutes: 30, km: null, steps: ['x'] }, normal, null);
  assert.strictEqual(rw.minutes, 20); assert.strictEqual(rw.periodCut.unit, 'min');
  assert.strictEqual(C.periodSession({ type: 'runwalk', minutes: 30, km: null, steps: ['x'] }, heavy, null).minutes, 15);
  assert.strictEqual(C.periodSession({ type: 'walkrun', minutes: 12, km: null, steps: [] }, normal, null).minutes, 10);
});
test('پریود: «استراحت کامل» هر جلسه‌ی دویدن رو استراحت می‌کنه؛ «عادی» هیچ تغییری نمی‌ده؛ مسابقه هیچ‌وقت', function () {
  var pr = periodProfile('rest'), d = C.parseDate('2026-10-30');
  var plan = C.periodPlan(pr, d);
  assert.strictEqual(C.periodSession({ type: 'easy', km: 6 }, plan, null).type, 'rest');
  assert.strictEqual(C.periodSession({ type: 'race', km: 10, hard: true }, plan, null), null);
  var pn = periodProfile('normal');
  assert.strictEqual(C.periodSession({ type: 'tempo', km: 8, hard: true }, C.periodPlan(pn, d), null), null);
  // بیرون از روزهای پریود هیچ تنظیمی نیست
  assert.strictEqual(C.periodPlan(pr, C.parseDate('2026-11-10')), null);
});
test('پریود: بدون انتخاب حالت، تنظیم خودکار نیست (همون پیشنهاد روزانه‌ی قبلی)', function () {
  var p = periodProfile(undefined);
  assert.strictEqual(C.periodPlan(p, C.parseDate('2026-10-30')), null);
});
test('پریود: تغییر دستی فقط همون دوره رو عوض می‌کنه و پیش‌فرض ماه‌های بعد ثابت می‌مونه', function () {
  var p = periodProfile('easy');
  p.cycle.periodOverrides = { '2026-10-29': 'rest' };
  assert.strictEqual(C.periodPlan(p, C.parseDate('2026-10-31')).mode, 'rest');
  assert.strictEqual(C.periodPlan(p, C.parseDate('2026-10-31')).overridden, true);
  assert.strictEqual(C.periodPlan(p, C.parseDate('2026-11-27')).mode, 'easy');
  assert.strictEqual(C.periodPlan(p, C.parseDate('2026-11-27')).overridden, false);
  var ahead = C.periodsAhead(p, C.parseDate('2026-10-15'), 3);
  assert.deepStrictEqual(ahead.map(function (e) { return e.start + ':' + e.mode; }), ['2026-10-29:rest', '2026-11-26:easy', '2026-12-24:easy']);
});
test('پریود: اگه شروع واقعی چند روز با تخمین فرق کنه، تغییر دستی هنوز به همون دوره می‌خوره', function () {
  var p = periodProfile('easy');
  p.cycle.periodOverrides = { '2026-10-29': 'rest' };
  p.cycle.lastStart = '2026-10-27'; // «پریودم امروز شروع شد» دو روز زودتر
  var plan = C.periodPlan(p, C.parseDate('2026-10-28'));
  assert.strictEqual(plan.start, '2026-10-27');
  assert.strictEqual(plan.mode, 'rest');
  assert.strictEqual(C.periodPlan(p, C.parseDate('2026-11-24')).mode, 'easy');
});
test('پریود: آمار و نمودارها همون جلسه‌ی تنظیم‌شده رو می‌بینن', function () {
  var p = periodProfile('rest');
  var recs = C.dayRecords({ profile: p, checkins: {}, done: {} }, C.parseDate('2026-10-29'), C.parseDate('2026-11-02'));
  recs.forEach(function (r) { if (r.planned.type !== 'race') assert(['rest', 'none'].indexOf(r.eff.type) >= 0, r.date + ' ' + r.eff.type); });
});

// ---------- مسافت و زمان واقعی ثبت‌شده با «انجام شد» ----------
test('انجام‌شده: مسافت و زمان واقعی جای عدد برنامه رو در آمار می‌گیرن', function () {
  var log = { type: 'easy', km: 8, actual: { km: 7.2, sec: 2700 } };
  var d = C.doneSession(log);
  assert.strictEqual(d.km, 7.2); assert.strictEqual(d.realMin, 45);
  assert.strictEqual(Math.round(C.actualPace(log)), 375);
  assert.strictEqual(C.doneSession({ type: 'easy', km: 8 }).km, 8);       // بدون عدد واقعی = همون برنامه
  assert.strictEqual(C.actualPace({ type: 'easy', km: 8, actual: { km: 8 } }), null);
  // نمودارها: حجم هفته از مسافت واقعی
  var p = profileFor(4);
  var day = C.parseDate('2026-10-05'), s = C.sessionFor(p, day);
  var k = C.dateKey(day), logs = {}; logs[k] = Object.assign(C.sessionSnapshot(s), { actual: { km: 3.3, sec: 1200 } });
  var data = { profile: p, checkins: {}, done: {}, doneLog: logs }; data.done[k] = true;
  var rec = C.dayRecords(data, day, day)[0];
  assert.strictEqual(rec.actual.km, 3.3);
});

// ---------- صبح یا عصر؟ ----------
function todData(spec) {
  // spec: [[start, km, sec, rpe, type?], ...] روی روزهای پشت‌سرهم
  var d = { done: {}, doneLog: {}, postRuns: {} };
  spec.forEach(function (x, i) {
    var k = C.dateKey(C.addDays(C.parseDate('2026-11-01'), i));
    d.done[k] = true;
    d.doneLog[k] = { type: x[4] || 'easy', km: x[1], actual: { start: x[0], km: x[1], sec: x[2] } };
    if (x[3]) d.postRuns[k] = { rpe: x[3] };
  });
  return d;
}
test('صبح یا عصر: با داده‌ی کافی، بازه‌ی بهتر و اختلاف پیس و سختی', function () {
  var spec = [];
  for (var i = 0; i < 4; i++) spec.push(['06:30', 8, 8 * 360, 4]);   // صبح: ۶:۰۰ در کیلومتر، سختی ۴
  for (var j = 0; j < 4; j++) spec.push(['18:15', 8, 8 * 380, 5]);   // عصر: ۶:۲۰، سختی ۵
  spec.push(['13:00', 5, 5 * 370, 4]);                                // بعدازظهر: کمتر از حد لازم
  var r = C.timeOfDayStats(todData(spec));
  assert.strictEqual(r.enough, true);
  assert.strictEqual(r.best, 'morning'); assert.strictEqual(r.next, 'evening');
  assert.strictEqual(r.paceDiff, 20); assert.strictEqual(r.rpeDiff, 1);
  assert.strictEqual(r.same, false);
  assert.strictEqual(r.slots[1].runs, 1); assert.strictEqual(r.slots[1].enough, false);
});
test('صبح یا عصر: داده‌ی ناکافی یا اختلاف ناچیز', function () {
  var few = C.timeOfDayStats(todData([['06:30', 8, 2880, 4], ['18:00', 8, 2900, 4]]));
  assert.strictEqual(few.enough, false); assert.strictEqual(few.total, 2);
  var spec = [];
  for (var i = 0; i < 3; i++) spec.push(['07:00', 8, 8 * 360, 4]);
  for (var j = 0; j < 3; j++) spec.push(['19:00', 8, 8 * 363, 4.1]);
  assert.strictEqual(C.timeOfDayStats(todData(spec)).same, true);
  // جلسه‌ی سخت یا بدون ساعت شروع حساب نمی‌شه
  var d = todData([['06:00', 8, 2400, 7, 'tempo']]);
  assert.strictEqual(C.timeOfDayStats(d).total, 0);
});

// ---------- مسابقه‌های فرعی ----------
function sideSetup() {
  var p = profileFor(6, { goal: goalOf('42', '2027-03-20') });
  var base = JSON.parse(JSON.stringify(p));
  // یک روز سخت در هفته‌ی ششم برای مسابقه‌ی فرعی
  var wk = weekAt(p, 6), hardDay = wk.days.filter(function (d) { return d.hard && d.type !== 'long'; })[0];
  return { p: p, base: base, day: hardDay.date };
}
test('مسابقه‌ی فرعی: روز مسابقه، روزهای سبک قبل و ریکاوری بعد', function () {
  var x = sideSetup(), p = x.p;
  p.races = [{ id: 'r1', name: 'تهران', km: 10, date: x.day }];
  var d0 = C.parseDate(x.day), at = function (n) { return C.sessionFor(p, C.addDays(d0, n)); }, was = function (n) { return C.sessionFor(x.base, C.addDays(d0, n)); };
  var r = at(0);
  assert.strictEqual(r.type, 'race'); assert.strictEqual(r.side, true); assert.strictEqual(r.km, 10);
  assert.ok(/تهران/.test(r.target));
  [-2, -1, 1, 2].forEach(function (n) {
    var s = at(n);
    assert.ok(!s.hard, 'day ' + n + ' should not be hard: ' + s.type);
    if (was(n).type !== 'rest') assert.ok(s.km <= (was(n).km || 99), 'day ' + n + ' should not grow');
  });
  assert.ok(at(-1).km <= 4);
  // بیرون از پنجره‌ی مسابقه، جلسه‌ها همون برنامه‌ی اصلی‌ان
  [-5, -4, 5, 6, 10].forEach(function (n) { assert.deepStrictEqual(JSON.parse(JSON.stringify(at(n))), JSON.parse(JSON.stringify(was(n)))); });
});
test('مسابقه‌ی فرعی: فاز و هدف حجم هفته‌ها عوض نمی‌شن', function () {
  var x = sideSetup(), p = x.p;
  p.races = [{ id: 'r1', km: 21.1, date: x.day }];
  for (var w = 0; w < 14; w++) {
    var a = weekAt(p, w), b = weekAt(x.base, w);
    assert.strictEqual(a.phase.key, b.phase.key);
    assert.strictEqual(a.volumeTarget, b.volumeTarget);
  }
  // نیمه‌ماراتن: روز قبل و روز بعد استراحت
  var d0 = C.parseDate(x.day);
  assert.strictEqual(C.sessionFor(p, C.addDays(d0, -1)).type, 'rest');
  assert.strictEqual(C.sessionFor(p, C.addDays(d0, 1)).type, 'rest');
});
test('مسابقه‌ی فرعی: روز استراحت هم مسابقه می‌شه؛ هم‌تاریخ با هدف اصلی نادیده گرفته می‌شه', function () {
  var x = sideSetup(), p = x.p, wk = weekAt(p, 6);
  var rest = wk.days.filter(function (d) { return d.type === 'rest'; })[0];
  p.days = [0, 2, 4];
  var restDay = weekAt(p, 6).days.filter(function (d) { return d.type === 'rest'; })[0].date;
  p.races = [{ id: 'a', km: 5, date: restDay }, { id: 'b', km: 10, date: '2027-03-20' }];
  assert.strictEqual(C.sessionFor(p, C.parseDate(restDay)).type, 'race');
  assert.strictEqual(C.otherRaces(p).length, 1);
  var main = C.sessionFor(p, C.parseDate('2027-03-20'));
  assert.strictEqual(main.type, 'race'); assert.ok(!main.side); assert.strictEqual(main.km, 42);
  void rest;
});
test('مسابقه‌ی فرعی: پنجره‌ی سبک و ریکاوری بر اساس مسافت', function () {
  assert.deepStrictEqual(C.sideRaceWindow(5), { pre: 2, post: 1 });
  assert.deepStrictEqual(C.sideRaceWindow(10), { pre: 2, post: 2 });
  assert.deepStrictEqual(C.sideRaceWindow(21.1), { pre: 3, post: 4 });
  assert.deepStrictEqual(C.sideRaceWindow(42.2), { pre: 5, post: 7 });
  assert.strictEqual(C.raceDistLabel(21.1), C.RACE_LABELS['21']);
});

// ---------- تاریخ شروع انتخابی ----------
test('تاریخ شروع: قبلش جلسه‌ای نیست، از همون روز جلسه‌ی آشنایی، هفته‌ی اول از شنبه‌ی بعد', function () {
  var p = profileFor(5, { startDate: '2026-10-28' }); // چهارشنبه
  assert.strictEqual(C.sessionFor(p, C.parseDate('2026-10-27')).type, 'none');
  var wk = C.buildWeek(p, C.parseDate('2026-10-28'));
  assert.strictEqual(wk.weekIndex, -1);
  wk.days.forEach(function (d) { assert.strictEqual(d.type === 'none', d.date < '2026-10-28', d.date + ' ' + d.type); });
  assert.ok(wk.days.some(function (d) { return d.date >= '2026-10-28' && d.type !== 'none' && d.type !== 'rest'; }));
  var w0 = C.buildWeek(p, C.parseDate('2026-10-31')); // شنبه
  assert.strictEqual(w0.weekIndex, 0); assert.strictEqual(w0.start, '2026-10-31');
  // شروع روز شنبه: همون هفته، هفته‌ی اوله
  var q = profileFor(5, { startDate: '2026-10-31' });
  assert.strictEqual(C.buildWeek(q, C.parseDate('2026-10-31')).weekIndex, 0);
  assert.strictEqual(C.sessionFor(q, C.parseDate('2026-10-30')).type, 'none');
});


// ---------- برنامه‌های پیشنهادی ----------
test('پیشنهاد: سطح ۰ تا ۲ فقط حجم و مسافت؛ از سطح ۳ پیس هم داره', function () {
  [0, 1, 2].forEach(function (n) {
    var p = n === 0 ? profileFor(1, { experience: 'never', currentWeeklyKm: 0 }) : profileFor(n);
    ['5', '10', '21', '42'].forEach(function (k) {
      var s = C.planSuggestion(p, k, 1200);
      assert.strictEqual(s.pace, false, n + ' ' + k);
      assert.strictEqual(s.predSec, undefined); assert.strictEqual(s.targetSec, undefined);
    });
  });
  [3, 6, 10].forEach(function (n) {
    var s = C.planSuggestion(profileFor(n), '10', 0);
    assert.ok(s.pace && s.predSec > 0 && s.presets.length === 3, String(n));
  });
});
test('پیشنهاد: مسافت بلندتر و سطح پایین‌تر = زمان آماده‌سازی بیشتر، هیچ‌وقت کمتر از حداقل موتور', function () {
  [1, 2, 3, 5, 8].forEach(function (n) {
    var p = profileFor(n), prev = 0;
    ['5', '10', '21', '42'].forEach(function (k) {
      var s = C.planSuggestion(p, k, 0);
      assert.ok(s.weeks >= prev, n + ' ' + k);
      assert.ok(s.weeks >= C.minPrepWeeks({ type: k }, n), n + ' ' + k);
      assert.ok(s.weeksHi >= s.weeks && s.peakKm >= s.startKm && s.peakKm >= C.PLAN_NEEDS[k].km);
      prev = s.weeks;
    });
  });
  var zero = C.planSuggestion(profileFor(1, { experience: 'never', currentWeeklyKm: 0 }), '42', 0);
  assert.ok(zero.zeroWeeks > 0 && zero.weeks > C.planSuggestion(profileFor(4), '42', 0).weeks);
});
test('پیشنهاد: رشد حجم با همون قانون ۱۰٪ و هفته‌ی سبک موتور اصلی', function () {
  assert.strictEqual(C.weeksToVolume(30, 30, 1.1), 0);
  // ۲۰ → ۳۰: ۵ پله‌ی رشد + یک هفته‌ی سبک
  assert.strictEqual(C.weeksToVolume(20, 30, 1.1), 6);
  assert.ok(C.weeksToVolume(20, 30, 1.05) > C.weeksToVolume(20, 30, 1.1));
});
test('پیشنهاد: سن بالای ۵۰ زمان بیشتری لازم داره', function () {
  var a = C.planSuggestion(profileFor(4, { age: 30 }), '21', 0), b = C.planSuggestion(profileFor(4, { age: 62 }), '21', 0);
  assert.ok(b.weeks > a.weeks && b.ageAdjusted && !a.ageAdjusted);
});
test('پیشنهاد: زمان هدف → پله‌های VDOT (۴ تا ۶ هفته)، هدف خیلی دور = هدف میانی', function () {
  var p = profileFor(6, { pb: { distanceKm: 5, timeSec: 960, date: '2026-09-01' } });
  var s = C.planSuggestion(p, '5', 900); // ۱۶:۰۰ → ۱۵:۰۰
  assert.ok(s.targetVdot > s.vdot && s.steps >= 4);
  assert.strictEqual(s.paceWeeks, s.steps * C.vdotStepWeeks(s.level));
  assert.ok(s.ambitious && s.mid.sec < 960 && s.mid.sec > 900);
  assert.ok(Math.abs(s.targetPace - 180) < 0.01);
  var easy = C.planSuggestion(p, '5', s.presets[0].sec);
  assert.strictEqual(easy.steps, 1); assert.ok(!easy.ambitious);
  assert.ok(C.planSuggestion(p, '5', 1000).already);
});
test('زمان هدف مسابقه‌ی اصلی: فقط پیس همون مسافت، حداکثر ۲ واحد VDOT جلوتر؛ زیر سطح ۳ بی‌اثر', function () {
  var pb = { distanceKm: 10, timeSec: hms(0, 45), date: '2026-09-01' };
  var p = profileFor(5, { pb: pb, goal: { type: '10', date: '2027-03-01', targetSec: hms(0, 40) } });
  var lv = C.assessLevel(p).level, P0 = C.paceSet(profileFor(5, { pb: pb, goal: { type: '10', date: '2027-03-01' } }), lv), P = C.paceSet(p, lv);
  assert.ok(P.p10 < P0.p10 && P.goal && P.goal.capped);
  assert.strictEqual(P.p5, P0.p5); assert.strictEqual(P.pT, P0.pT); assert.strictEqual(P.pE, P0.pE);
  assert.ok(Math.abs(P.goal.vdot - (P0.vdot + 2)) < 1e-9);
  var low = profileFor(2, { goal: { type: '10', targetSec: hms(0, 40) } });
  assert.ok(!C.paceSet(low, C.assessLevel(low).level).goal);
});
test('پله‌ی VDOT: بعد از ۴ تا ۶ هفته، فقط وقتی ایزی‌ها سخت نبودن، حداکثر تا هدف', function () {
  var p = profileFor(5, { pb: { distanceKm: 10, timeSec: hms(0, 45), date: '2026-09-01' }, goal: { type: '10', targetSec: hms(0, 44) } });
  assert.strictEqual(C.vdotStepSuggestion(p, {}, C.parseDate('2026-09-15')), null);
  var sg = C.vdotStepSuggestion(p, {}, C.parseDate('2026-10-20'));
  assert.ok(sg && sg.to > sg.from && sg.to <= C.vdotFromRace(10, hms(0, 44)) + 1e-9 && sg.entry.kind === 'step');
  var hard = { '2026-10-15': { easy: true, rpe: 8, pace: 'ok' }, '2026-10-18': { easy: true, rpe: 7, pace: 'ok' } };
  assert.strictEqual(C.vdotStepSuggestion(p, hard, C.parseDate('2026-10-20')), null);
  // پله‌ی ثبت‌شده پیشنهاد تغییر سطح نمی‌سازه
  p.fitnessTests = [sg.entry];
  assert.strictEqual(C.fitnessLevelSuggestion(p), null);
});


test('مسیر تا هدف: باقی‌مونده با گذشت هفته‌ها کم می‌شه، وضعیت نسبت به تاریخ مسابقه', function () {
  var p = profileFor(4, { startDate: '2026-09-26', goal: { type: '21', date: '2027-06-01' } });
  var a = C.goalPath(p, C.parseDate('2026-09-26')), b = C.goalPath(p, C.parseDate('2026-11-21'));
  assert.strictEqual(a.elapsed, 0); assert.strictEqual(b.elapsed, 8);
  assert.ok(a.weeks > 0 && b.weeks < a.weeks, a.weeks + ' → ' + b.weeks);
  assert.ok(b.frac > a.frac && b.frac < 1);
  assert.strictEqual(a.status, 'ok');
  var tight = C.goalPath(profileFor(2, { startDate: '2026-09-26', goal: { type: '42', date: '2026-11-01' } }), C.parseDate('2026-09-26'));
  assert.strictEqual(tight.status, 'tight');
  assert.ok(C.goalPath(profileFor(4, { goal: { type: 'none' } }), C.parseDate('2026-09-26')).none);
  var past = C.goalPath(profileFor(4, { goal: { type: '10', date: '2026-09-01' } }), C.parseDate('2026-09-26'));
  assert.ok(past.past);
  var ultra = C.goalPath(profileFor(6, { goal: goalOf('ultra', '2027-09-01') }), C.parseDate('2026-09-26'));
  assert.ok(ultra.weeks >= C.minPrepWeeks(C.goalInfo(profileFor(6, { goal: goalOf('ultra') })), 6));
});


// ---------- مسیر پیاده‌روی ----------
function walkP(over) {
  return Object.assign({ age: 40, days: [0, 1, 2, 3, 4, 5, 6], locations: ['park'], activity: 'walk', walkMin: 0, walkExp: 'never', walk30: 'no', startDate: '2026-09-26' }, over || {});
}
function walkWeek(p, w) { return C.buildWeek(p, C.addDays(C.parseDate(p.startDate), w * 7)); }
test('پیاده‌روی: سطح از دقیقه‌ی هفتگی، محدود به سابقه، توان ۳۰ دقیقه و سن', function () {
  assert.strictEqual(C.assessLevel(walkP()).level, 1);
  assert.strictEqual(C.assessLevel(walkP({ walkMin: 160, walkExp: 'gt1y', walk30: 'yes' })).level, 6);
  assert.strictEqual(C.assessLevel(walkP({ walkMin: 500, walkExp: 'lt3m', walk30: 'yes' })).level, 3);
  assert.strictEqual(C.assessLevel(walkP({ walkMin: 500, walkExp: 'gt1y', walk30: 'no' })).level, 4);
  var old = C.assessLevel(walkP({ walkMin: 500, walkExp: 'gt1y', walk30: 'yes', age: 65 }));
  assert.strictEqual(old.level, 9); assert.ok(old.walk && old.notes.length >= 1);
});
test('پیاده‌روی: فقط جلسه‌های پیاده‌روی، حداقل یک روز استراحت، بدون دو روز سخت پشت‌سرهم', function () {
  [[0, 'never'], [45, 'lt3m'], [100, '3to12m'], [160, 'gt1y'], [220, 'gt1y'], [320, 'gt1y'], [450, 'gt1y']].forEach(function (x) {
    var p = walkP({ walkMin: x[0], walkExp: x[1], walk30: 'yes' });
    for (var w = 0; w < 12; w++) {
      var d = walkWeek(p, w).days;
      assert.ok(d.every(function (s) { return s.type === 'rest' || C.WALK_TYPES.indexOf(s.type) >= 0; }), x + ' w' + w);
      assert.ok(d.some(function (s) { return s.type === 'rest'; }), 'rest ' + x + ' w' + w);
      for (var i = 0; i < 7; i++) assert.ok(!(d[i].hard && d[(i + 1) % 7].hard), 'hard pair ' + x + ' w' + w + ' d' + i);
      d.forEach(function (s) { if (s.strength) assert.ok(!d[(d.indexOf(s) + 1) % 7].hard, 'strength before hard'); });
    }
  });
});
test('پیاده‌روی: رشد هفتگی حداکثر ۱۰٪ (۶۰+ سال ۵٪)، هفته‌ی سبک هر ۴ هفته، سقف سطح', function () {
  [walkP({ walkMin: 100, walkExp: 'gt1y', walk30: 'yes' }), walkP({ walkMin: 100, walkExp: 'gt1y', walk30: 'yes', age: 66 })].forEach(function (p) {
    var a = C.assessLevel(p), rate = a.cautious ? 1.05 : 1.1, prev = C.walkWeeklyMin(p, 0, a).min;
    for (var w = 1; w < 16; w++) {
      var v = C.walkWeeklyMin(p, w, a);
      assert.ok(v.min <= a.info.cap);
      if (v.deload) assert.ok(v.min < prev, 'deload ' + w);
      else if (!C.walkWeeklyMin(p, w - 1, a).deload) assert.ok(v.min <= Math.max(prev + 5, Math.round(prev * rate / 5) * 5) + 1e-9, 'growth ' + w + ': ' + prev + '→' + v.min);
      prev = v.min;
    }
  });
});
test('پیاده‌روی: شدت‌ها و کراس‌ترینینگ به سطح بستگی داره', function () {
  var types = function (p) { var t = {}; for (var w = 0; w < 8; w++) walkWeek(p, w).days.forEach(function (s) { t[s.type] = 1; if (s.strength) t.S = 1; if (s.cross) t.X = 1; }); return t; };
  var l1 = types(walkP()), l5 = types(walkP({ walkMin: 130, walkExp: 'gt1y', walk30: 'yes' })), l9 = types(walkP({ walkMin: 320, walkExp: 'gt1y', walk30: 'yes' }));
  assert.ok(l1.walkEasy && !l1.walkBrisk && !l1.walkPower && !l1.S);
  assert.ok(l5.walkBrisk && !l5.walkPower && !l5.S);
  assert.ok(l9.walkPower && l9.walkLong && l9.S && l9.X);
});
test('پیاده‌روی: تطبیق با چک‌این (متوسط = ملایم و کوتاه‌تر، جدی = استراحت، درد = لغو)', function () {
  var p = walkP({ walkMin: 320, walkExp: 'gt1y', walk30: 'yes' }), d = walkWeek(p, 1).days;
  var pw = d.filter(function (s) { return s.type === 'walkPower'; })[0];
  var mod = C.adaptSession(pw, { fatigue: 4, sleep: 3 }, null, null);
  assert.strictEqual(mod.session.type, 'walkEasy'); assert.ok(mod.session.minutes < pw.minutes);
  assert.strictEqual(C.adaptSession(pw, { fatigue: 5, sleep: 1 }, null, null).session.type, 'rest');
  assert.strictEqual(C.adaptSession(pw, { fatigue: 2, sleep: 4, pain: true }, null, null).session.type, 'cancelled');
});
test('پیاده‌روی: پروفایل دویدن تغییری نمی‌کنه', function () {
  var p = profileFor(5);
  assert.ok(!C.isWalk(p));
  assert.ok(weekAt(p, 3).days.every(function (s) { return C.WALK_TYPES.indexOf(s.type) < 0; }));
});


test('پیاده‌روی، اهداف: سریع‌تر = یک جلسه‌ی تند بیشتر؛ رویداد = پیاده‌روی بلند، هفته‌ی سبک قبلش، روز رویداد', function () {
  var base = walkP({ walkMin: 100, walkExp: 'gt1y', walk30: 'yes' });
  var cnt = function (p, t) { return walkWeek(p, 1).days.filter(function (s) { return s.type === t; }).length; };
  assert.strictEqual(cnt(Object.assign({}, base, { walkGoal: { kind: 'faster' } }), 'walkBrisk'), cnt(base, 'walkBrisk') + 1);
  var ev = Object.assign({}, base, { walkGoal: { kind: 'event', km: 21.1, date: '2026-12-19' } });
  assert.ok(walkWeek(ev, 2).days.some(function (s) { return s.type === 'walkLong'; }));
  var d = C.sessionFor(ev, C.parseDate('2026-12-19'));
  assert.strictEqual(d.type, 'walkEvent');
  assert.strictEqual(C.sessionFor(ev, C.parseDate('2026-12-18')).type, 'rest');
  var taper = C.buildWeek(ev, C.parseDate('2026-12-15')).days.filter(function (s) { return s.date >= '2026-12-13' && s.date < '2026-12-18'; });
  assert.ok(taper.every(function (s) { return s.type !== 'walkPower'; }));
});
test('پیاده‌روی، مسیر: هفته‌ها تا ۱۵۰ دقیقه کم می‌شه با پیشرفت؛ رسیده = ready', function () {
  var p = walkP({ walkMin: 60, walkExp: '3to12m', walk30: 'yes', walkGoal: { kind: 'min150' } });
  var a = C.walkPath(p, C.parseDate('2026-09-26')), b = C.walkPath(p, C.parseDate('2026-11-07'));
  assert.ok(a.weeks > 0 && a.need === 150);
  assert.ok(b.weekMin >= a.weekMin && b.weeks <= a.weeks);
  var done = C.walkPath(walkP({ walkMin: 200, walkExp: 'gt1y', walk30: 'yes', walkGoal: { kind: 'min150' } }), C.parseDate('2026-09-26'));
  assert.strictEqual(done.weeks, 0); assert.strictEqual(done.status, 'ready');
  assert.ok(C.walkPath(walkP(), C.parseDate('2026-09-26')).none);
  var ev = C.walkPath(walkP({ walkMin: 30, walkExp: 'lt3m', walk30: 'no', walkGoal: { kind: 'event', km: 42.2, date: '2026-10-20' } }), C.parseDate('2026-09-26'));
  assert.strictEqual(ev.status, 'tight');
});
test('پیاده‌روی، پیشنهاد سطح بعد: فقط بعد از دو هفته روی سقف سطح', function () {
  var p = walkP({ walkMin: 100, walkExp: 'gt1y', walk30: 'yes' });
  assert.strictEqual(C.walkLevelSuggestion(p, C.parseDate('2026-10-03')), null);
  var late = C.walkLevelSuggestion(p, C.parseDate('2027-01-30'));
  assert.ok(late && late.to > late.from && late.next.walkMin === C.WALK_LEVELS[late.from].cap);
  assert.strictEqual(C.walkLevelSuggestion(profileFor(5), C.parseDate('2027-01-30')), null);
});
test('پیاده‌روی، آمار: دقیقه و قدم هفتگی، قدم روزانه بر قدم جلسه مقدمه', function () {
  var p = walkP({ walkMin: 100, walkExp: 'gt1y', walk30: 'yes' });
  var d1 = '2026-09-26', d2 = '2026-09-27';
  var data = { profile: p, checkins: {}, done: {}, postRuns: {}, doneLog: {}, steps: {} };
  data.done[d1] = true; data.doneLog[d1] = { type: 'walkBrisk', km: 0, minutes: 20, actual: { sec: 1800, steps: 4000 } };
  data.steps[d2] = 9000;
  var a = C.analytics(data, C.parseDate('2026-09-28'), null);
  assert.ok(a.walk);
  assert.strictEqual(a.weeks[0].min, 30);
  assert.strictEqual(C.daySteps(data, d1), 4000); assert.strictEqual(C.daySteps(data, d2), 9000);
  data.steps[d1] = 11000; assert.strictEqual(C.daySteps(data, d1), 11000);
});

console.log(passed + ' تست موفق' + (process.exitCode ? ' — برخی ناموفق' : ''));
