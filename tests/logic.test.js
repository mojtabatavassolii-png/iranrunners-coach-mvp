// اجرای تست‌ها: node tests/logic.test.js
'use strict';
var assert = require('assert');
var C = require('../js/logic.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; }
}

function profile(over) {
  return Object.assign({
    level: 'intermediate', age: 30, weightKg: 70, heightCm: 175,
    days: [0, 1, 2, 3, 4, 5, 6], locations: ['park'], injury: '',
    race: { has: false }, pb: null, currentWeeklyKm: 0,
    startDate: '2026-09-26' // شنبه
  }, over || {});
}

function allDays(p, weeks) {
  var out = [], start = C.parseDate(p.startDate);
  for (var w = 0; w < weeks; w++) out = out.concat(C.buildWeek(p, C.addDays(start, w * 7)).days);
  return out;
}

var LEVELS = ['beginner', 'intermediate', 'advanced'];
var DAY_SETS = [[0, 2, 4], [0, 1, 2, 3, 4, 5, 6], [5, 6], [1, 3, 5, 6], [0, 1, 2, 3, 4], [6], [2, 3, 4, 5]];

test('هیچ دو روز سختی پشت‌سرهم نیست (همه‌ی سطوح و ترکیب روزها، ۲۰ هفته)', function () {
  LEVELS.concat('absolute').forEach(function (lvl) {
    DAY_SETS.forEach(function (days) {
      var d = allDays(profile({ level: lvl, days: days }), 20);
      for (var i = 1; i < d.length; i++)
        assert(!(d[i].hard && d[i - 1].hard), lvl + ' ' + days + ' ' + d[i].date);
    });
  });
});

test('بدون دو روز سخت پشت‌سرهم، حتی با مسابقه و تیپر', function () {
  ['5', '10', '21', '42'].forEach(function (rk) {
    LEVELS.forEach(function (lvl) {
      DAY_SETS.forEach(function (days) {
        var p = profile({ level: lvl, days: days, race: { has: true, distance: rk, date: '2026-12-10' } });
        var d = allDays(p, 14);
        for (var i = 1; i < d.length; i++)
          assert(!(d[i].hard && d[i - 1].hard), lvl + ' ' + rk + ' ' + days + ' ' + d[i].date);
      });
    });
  });
});

test('قانون ۱۰٪: حجم هفتگی هیچ‌وقت بیش از ۱۰٪ از آخرین هفته‌ی کامل بیشتر نمی‌شه', function () {
  LEVELS.forEach(function (lvl) {
    var p = profile({ level: lvl });
    var lastFull = null;
    for (var w = 0; w < 30; w++) {
      var v = C.weeklyVolumeKm(p, w);
      if (C.progression(w).deload) { assert(v <= lastFull + 1e-9); continue; }
      if (lastFull !== null) assert(v <= lastFull * 1.1 + 1e-9, lvl + ' week ' + w);
      lastFull = v;
    }
  });
});

test('قانون ۱۰٪ روی حجم واقعی جلسات (با گرد کردن ≤ ۱ کیلومتر خطا)', function () {
  LEVELS.forEach(function (lvl) {
    var p = profile({ level: lvl, days: [0, 1, 2, 3, 4, 5, 6] });
    var start = C.parseDate(p.startDate), lastFull = null;
    for (var w = 0; w < 20; w++) {
      var wk = C.buildWeek(p, C.addDays(start, w * 7));
      if (wk.phase.key === 'deload') continue;
      if (lastFull !== null) assert(wk.totalKm <= lastFull * 1.1 + 1e-9, lvl + ' w' + w + ' ' + wk.totalKm + ' vs ' + lastFull);
      lastFull = wk.totalKm;
    }
  });
});

test('نسبت ۸۰/۲۰: بخش پرشدت ≤ ۲۰٪', function () {
  LEVELS.forEach(function (lvl) {
    DAY_SETS.forEach(function (days) {
      var p = profile({ level: lvl, days: days }), start = C.parseDate(p.startDate);
      for (var w = 0; w < 16; w++) {
        var wk = C.buildWeek(p, C.addDays(start, w * 7));
        assert(wk.hardPct <= 20, lvl + ' ' + days + ' w' + w + ' hard=' + wk.hardPct);
      }
    });
  });
});

test('مبتدی مطلق: فقط دو-پیاده، بدون جلسه‌ی سخت، حداکثر ۳ جلسه', function () {
  var d = allDays(profile({ level: 'absolute' }), 12);
  d.forEach(function (s) { assert(['runwalk', 'rest', 'none'].indexOf(s.type) >= 0, s.type); });
  var wk = C.buildWeek(profile({ level: 'absolute' }), C.parseDate('2026-09-26'));
  assert.strictEqual(wk.days.filter(function (s) { return s.type === 'runwalk'; }).length, 3);
  assert(/۱ دقیقه دویدن|1 دقیقه دویدن/.test(wk.days.find(function (s) { return s.type === 'runwalk'; }).steps[1]));
});

test('تیپر: حجم ۱۴ روز قبل از مسابقه کمتر از ۱۴ روز قبل‌ترشه، روز قبل استراحته', function () {
  ['5', '10', '21', '42'].forEach(function (rk) {
    var p = profile({ race: { has: true, distance: rk, date: '2026-12-18' } });
    var race = C.parseDate('2026-12-18');
    function vol(from, to) { var s = 0; for (var i = from; i <= to; i++) s += C.sessionFor(p, C.addDays(race, -i)).km || 0; return s; }
    assert.strictEqual(C.sessionFor(p, race).type, 'race');
    assert.strictEqual(C.sessionFor(p, C.addDays(race, -1)).type, 'rest');
    assert(vol(1, 7) < vol(15, 21) * 0.75, rk + ' last week ' + vol(1, 7) + ' vs ' + vol(15, 21));
    if (rk === '21' || rk === '42') assert(vol(8, 14) < vol(15, 21), rk + ' ' + vol(8, 14) + ' vs ' + vol(15, 21));
    for (var i = 1; i <= 7; i++) assert.notStrictEqual(C.sessionFor(p, C.addDays(race, -i)).type, 'long');
    assert.strictEqual(C.buildWeek(p, race).phase.key, 'race');
    if (rk === '21' || rk === '42') assert.strictEqual(C.buildWeek(p, C.addDays(race, -7)).phase.key, 'taper');
  });
});

test('Riegel: 10k در 50:00 → نیمه‌ماراتن ≈ 1:50:40', function () {
  var t = C.riegel(3000, 10, 21.0975);
  assert(Math.abs(t - 3000 * Math.pow(2.10975, 1.06)) < 1e-6);
  assert.strictEqual(C.formatDuration(t), '1:50:' + C.formatDuration(t).slice(-2));
  assert.strictEqual(C.parseTime('۰۰:۲۵:۳۰'), 1530);
  assert.strictEqual(C.parseTime('25:30'), 1530);
  assert.strictEqual(C.parseTime('25:70'), null);
});

test('چک‌این: خستگی بالا → جلسه‌ی سخت به ایزی تبدیل می‌شه', function () {
  var p = profile(), wk = C.buildWeek(p, C.parseDate('2026-09-26'));
  var hard = wk.days.find(function (s) { return s.hard; });
  var r = C.adaptSession(hard, { fatigue: 4, sleep: 4, pain: false }, null);
  assert.strictEqual(r.session.type, 'easy');
  assert.strictEqual(r.adaptation.kind, 'downgrade');
  assert(r.session.km <= hard.km);
});

test('چک‌این: خواب بد دو شب پشت‌سرهم → تبدیل؛ یک شب → بدون تغییر', function () {
  var p = profile(), wk = C.buildWeek(p, C.parseDate('2026-09-26'));
  var hard = wk.days.find(function (s) { return s.hard; });
  assert.strictEqual(C.adaptSession(hard, { fatigue: 2, sleep: 2 }, { sleep: 1 }).session.type, 'easy');
  assert.strictEqual(C.adaptSession(hard, { fatigue: 2, sleep: 2 }, { sleep: 4 }).session.type, hard.type);
  assert.strictEqual(C.adaptSession(hard, { fatigue: 2, sleep: 2 }, null).session.type, hard.type);
});

test('چک‌این: درد → لغو با پیام دقیق', function () {
  var p = profile(), s = C.buildWeek(p, C.parseDate('2026-09-26')).days[0];
  var r = C.adaptSession(s, { fatigue: 1, sleep: 5, pain: true, painWhere: 'زانو' }, null);
  assert.strictEqual(r.session.type, 'cancelled');
  assert.strictEqual(r.adaptation.message, 'این می‌تونه نشونه آسیب باشه. مربی نمی‌تونه این رو تشخیص بده. لطفاً به پزشک مراجعه کن.');
});

test('روزهای قبل از تاریخ شروع «قبل از شروع» هستند', function () {
  var p = profile({ startDate: '2026-09-29' }); // سه‌شنبه
  var wk = C.buildWeek(p, C.parseDate('2026-09-29'));
  assert.strictEqual(wk.days[0].type, 'none');
  assert.strictEqual(wk.days[2].type, 'none');
  assert.notStrictEqual(wk.days[3].type, 'none');
});

console.log(passed + ' تست موفق' + (process.exitCode ? ' — برخی ناموفق' : ''));
