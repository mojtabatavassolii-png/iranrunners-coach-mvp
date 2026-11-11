// مرحله‌ی سوم شبیه‌ساز: ۱۰۰ شخصیت جعلی (۱۰ شخصیت دستی + ۹۰ شخصیت ساخته‌شده از محورها).
// ترکیب‌ها حریصانه انتخاب می‌شن تا هر جفت مقدار از دو محور مختلف دست‌کم یک بار کنار هم بیاد (پوشش جفتی)،
// به‌جز جفت‌هایی که با قیدها ممکن نیستن (مثلاً پیاده‌روی و ماراتن). بذر ثابت → همیشه همین ۱۰۰ شخصیت.
'use strict';
var C = require('../../js/logic.js');
var makeRng = require('./lib/rng.js');
var HAND = require('./personas.js');

var AXES = {
  sex: ['f', 'm'],
  age: ['young', 'mid', 'senior'],
  activity: ['run', 'walk'],
  level: ['zero', 'low', 'mid', 'high'],
  history: ['new', 'regular', 'returning'],
  goal: ['health', '5', '10', '21', '42', 'ultra'],
  temperament: ['disciplined', 'erratic', 'obsessive', 'sensitive', 'bored', 'competitive'],
  injury: ['low', 'high'],
  event: ['none', 'travel', 'sick', 'busy', 'unmotivated', 'goalChange', 'injury', 'irregularCycle'],
  mind: ['detail', 'holistic']
};
var KEYS = Object.keys(AXES);

// قیدها: ترکیب‌هایی که در اپ معنی ندارن
function valid(t) {
  if (t.activity === 'walk' && (t.goal !== 'health' || ['low', 'mid'].indexOf(t.level) < 0 || t.history === 'returning' || t.event === 'goalChange')) return false;
  if (t.level === 'zero' && (t.history !== 'new' || ['health', '5', '10'].indexOf(t.goal) < 0)) return false;
  if (t.history === 'new' && ['zero', 'low'].indexOf(t.level) < 0) return false;
  if (t.history === 'returning' && ['low', 'mid'].indexOf(t.level) < 0) return false;
  if (t.level === 'high' && t.history !== 'regular') return false;
  if (t.goal === 'ultra' && ['mid', 'high'].indexOf(t.level) < 0) return false;
  if (t.goal === '42' && ['zero', 'low'].indexOf(t.level) >= 0) return false;
  if (t.event === 'irregularCycle' && (t.sex !== 'f' || t.age === 'senior')) return false;
  return true;
}
// محورهای ۱۰ شخصیت دستی (برای شمردن پوشش)
var HAND_TRAITS = {
  P01: { sex: 'f', age: 'young', activity: 'run', level: 'zero', history: 'new', goal: 'health', temperament: 'disciplined', injury: 'low', event: 'goalChange', mind: 'detail' },
  P02: { sex: 'm', age: 'mid', activity: 'run', level: 'mid', history: 'regular', goal: '42', temperament: 'competitive', injury: 'high', event: 'goalChange', mind: 'detail' },
  P03: { sex: 'f', age: 'young', activity: 'run', level: 'low', history: 'returning', goal: '10', temperament: 'disciplined', injury: 'low', event: 'goalChange', mind: 'detail' },
  P04: { sex: 'f', age: 'mid', activity: 'run', level: 'mid', history: 'regular', goal: '21', temperament: 'erratic', injury: 'low', event: 'irregularCycle', mind: 'holistic' },
  P05: { sex: 'm', age: 'senior', activity: 'walk', level: 'low', history: 'regular', goal: 'health', temperament: 'bored', injury: 'low', event: 'unmotivated', mind: 'holistic' },
  P06: { sex: 'm', age: 'young', activity: 'run', level: 'low', history: 'regular', goal: '5', temperament: 'erratic', injury: 'low', event: 'travel', mind: 'holistic' },
  P07: { sex: 'f', age: 'mid', activity: 'run', level: 'high', history: 'regular', goal: 'ultra', temperament: 'obsessive', injury: 'low', event: 'goalChange', mind: 'detail' },
  P08: { sex: 'm', age: 'mid', activity: 'run', level: 'mid', history: 'regular', goal: '10', temperament: 'disciplined', injury: 'low', event: 'injury', mind: 'detail' },
  P09: { sex: 'f', age: 'young', activity: 'run', level: 'low', history: 'regular', goal: '10', temperament: 'sensitive', injury: 'low', event: 'goalChange', mind: 'holistic' },
  P10: { sex: 'm', age: 'young', activity: 'run', level: 'high', history: 'regular', goal: '42', temperament: 'disciplined', injury: 'low', event: 'unmotivated', mind: 'holistic' }
};

function pairsOf(t) {
  var out = [];
  for (var i = 0; i < KEYS.length; i++) for (var j = i + 1; j < KEYS.length; j++) out.push(KEYS[i] + '=' + t[KEYS[i]] + '|' + KEYS[j] + '=' + t[KEYS[j]]);
  return out;
}
function randomTraits(rnd) {
  for (;;) {
    var t = {};
    KEYS.forEach(function (k) { t[k] = rnd.pick(AXES[k]); });
    if (valid(t)) return t;
  }
}
// همه‌ی جفت‌های ممکن (از یک نمونه‌ی بزرگ ترکیب‌های معتبر)
function feasiblePairs(rnd) {
  var set = {};
  for (var i = 0; i < 60000; i++) pairsOf(randomTraits(rnd)).forEach(function (p) { set[p] = 1; });
  return set;
}

function pairwise(n, seed) {
  var rnd = makeRng(seed), all = feasiblePairs(rnd), covered = {};
  var list = HAND.map(function (h) { var t = HAND_TRAITS[h.id]; pairsOf(t).forEach(function (p) { covered[p] = 1; }); return t; });
  while (list.length < n) {
    var best = null, bestScore = -1;
    for (var c = 0; c < 400; c++) {
      var t = randomTraits(rnd), score = pairsOf(t).filter(function (p) { return !covered[p]; }).length;
      if (score > bestScore) { best = t; bestScore = score; }
    }
    pairsOf(best).forEach(function (p) { covered[p] = 1; });
    list.push(best);
  }
  var total = Object.keys(all).length, got = Object.keys(all).filter(function (p) { return covered[p]; }).length;
  return { traits: list, coverage: { pairs: total, covered: got, missing: Object.keys(all).filter(function (p) { return !covered[p]; }) } };
}

// ---------- محورها → پروفایل ----------
function hms(h, m, s) { return (h * 60 + m) * 60 + (s || 0); }
var LV = { // سطح هدف، حجم، VDOT
  zero: { km: [0, 0], vdot: [22, 27], room: [8, 10] },
  low: { km: [8, 20], vdot: [29, 35], room: [6, 9] },
  mid: { km: [25, 55], vdot: [36, 45], room: [4, 6] },
  high: { km: [70, 110], vdot: [50, 58], room: [2, 3] }
};
var AGE = { young: [18, 34], mid: [35, 49], senior: [50, 68] };
var FA_GOAL = { health: 'سلامتی', 5: '۵ کیلومتر', 10: '۱۰ کیلومتر', 21: 'نیمه‌ماراتن', 42: 'ماراتن', ultra: 'اولترا' };
var FA_TEMP = { disciplined: 'منظم', erratic: 'بی‌نظم', obsessive: 'وسواسی', sensitive: 'زودرنج', bored: 'بی‌حوصله', competitive: 'رقابت‌جو' };
var FA_LV = { zero: 'تازه‌کار کامل', low: 'سطح پایین', mid: 'سطح متوسط', high: 'سطح بالا' };
var FA_HIST = { new: 'تازه', regular: 'منظم', returning: 'برگشتی' };
var FA_EV = { none: 'بدون رویداد خاص', travel: 'سفرهای مکرر', sick: 'بیماری', busy: 'شلوغی کاری', unmotivated: 'بی‌انگیزگی', goalChange: 'تغییر هدف', injury: 'آسیب تأییدشده', irregularCycle: 'چرخه‌ی نامنظم' };
var FOLLOW = { competitive: 0.9, obsessive: 0.8, disciplined: 0.7, sensitive: 0.5, erratic: 0.4, bored: 0.2 };
function fa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
function pickDays(rnd, n) { var all = [6, 0, 1, 2, 3, 4, 5], out = []; while (out.length < n) { var d = rnd.pick(all); if (out.indexOf(d) < 0) out.push(d); } return out.sort(); }
function goalOf(rnd, type, dateIn) {
  if (type === 'health') return { type: 'none', date: null };
  var g = { type: type, dateIn: dateIn };
  if (type === 'ultra') { var km = rnd.pick([50, 50, 80]); g.ultra = { km: km, gain: km * 50, loss: km * 50, terrain: rnd.pick(['mountain', 'hilly', 'trail']), altitude: rnd.pick([800, 1800, 2400]), weeklyVert: rnd.pick([300, 600, 900, 1200]), hillAccess: rnd.pick(['yes', 'some']) }; }
  return g;
}

function build(t, idx, rnd) {
  var id = 'P' + (idx < 99 ? ('0' + (idx + 1)).slice(-2) : String(idx + 1));
  var age = rnd.int(AGE[t.age][0], AGE[t.age][1]), female = t.sex === 'f';
  var start = C.dateKey(C.addDays(C.parseDate('2026-11-14'), rnd.int(0, 6)));
  var p = { name: 'شخصیت', lastName: fa(idx + 1), age: age, weightKg: female ? rnd.int(52, 78) : rnd.int(64, 95), heightCm: female ? rnd.int(155, 175) : rnd.int(168, 190),
    sex: female ? 'female' : 'male', locations: t.goal === 'ultra' ? ['trail', 'park'] : [rnd.pick(['park', 'road', 'track', 'treadmill'])], injury: '', race: { has: false },
    pb: null, pbOld: null, fitnessTests: [], races: [], easyAdjustSec: 0, schemaVersion: 3, activity: t.activity, structured: false,
    hrMax: null, hrRest: null, cycle: { enabled: false }, startDate: start };
  var lv = LV[t.level], vdot = rnd.range(lv.vdot[0], lv.vdot[1]), room = rnd.range(lv.room[0], lv.room[1]);
  var hidden = { vdot: vdot, room: room };
  if (t.activity === 'walk') {
    p.walkMin = t.level === 'low' ? rnd.int(30, 80) : rnd.int(100, 200);
    p.walkExp = rnd.pick(t.level === 'low' ? ['never', 'lt3m', '3to12m'] : ['3to12m', 'gt1y']);
    p.walk30 = t.level === 'low' ? rnd.pick(['yes', 'no']) : 'yes';
    p.walkGoal = { kind: 'health' }; p.experience = null; p.currentWeeklyKm = 0;
    p.days = pickDays(rnd, rnd.int(4, 7)); hidden.vdot = rnd.range(20, 26);
  } else {
    var km = rnd.int(lv.km[0], lv.km[1]);
    p.days = pickDays(rnd, t.level === 'zero' || t.level === 'low' ? 3 : t.level === 'mid' ? rnd.int(4, 5) : 6);
    if (t.level === 'zero') { p.experience = 'never'; p.runMonths = 0; km = 0; }
    else if (t.history === 'new') { p.experience = 'lt3m'; p.runMonths = rnd.int(1, 2); }
    else if (t.history === 'returning') {
      p.experience = t.level === 'low' ? '3to12m' : '1to3y'; p.runMonths = t.level === 'low' ? rnd.int(6, 11) : rnd.int(18, 60); p.structured = t.level === 'mid';
      p.gap = 'slider'; p.gapDays = rnd.pick([90, 180, 365, 730, 1095, 1825]); p.xtrain = rnd.pick(['none', 'some', 'often']); p.walkMinNow = rnd.pick([0, 60, 120]);
      var oldV = vdot + rnd.range(3, 8);
      p.pbOld = { distanceKm: 10, timeSec: Math.round(C.raceTimeFromVdot(oldV, 10)) };
      km = rnd.int(0, 8); room = hidden.room = room + 4;
    } else {
      p.experience = t.level === 'high' ? 'gt3y' : t.level === 'mid' ? rnd.pick(['1to3y', 'gt3y']) : '3to12m';
      p.runMonths = { gt3y: rnd.int(40, 120), '1to3y': rnd.int(14, 36), '3to12m': rnd.int(4, 11) }[p.experience];
      p.structured = t.level !== 'low' && rnd.chance(0.7);
      if (t.level !== 'low' || rnd.chance(0.5)) {
        var d = rnd.pick([5, 10, 21.1]);
        p.pb = { distanceKm: d, timeSec: Math.round(C.raceTimeFromVdot(vdot + rnd.range(-1, 1), d)) };
      }
    }
    p.currentWeeklyKm = km; p.lastWeekKm = Math.max(0, km + rnd.int(-3, 3)); p.monthAvgKm = km;
  }
  p.goal = goalOf(rnd, t.goal, rnd.int(70, 250));
  if (t.goal === 'ultra' && p.days.length < 5) p.days = pickDays(rnd, 5);

  // چرخه
  var cyc = null;
  if (female && t.age !== 'senior' && (t.event === 'irregularCycle' || rnd.chance(0.75))) {
    var mean = rnd.int(26, 32), last = C.dateKey(C.addDays(C.parseDate(start), -rnd.int(1, 20)));
    p.cycle = { enabled: true, lastStart: last, cycleLen: mean, periodLen: 5, periodMode: rnd.pick(['auto', 'auto', 'normal']), periodOverrides: {}, starts: [] };
    var logP = { obsessive: 1, disciplined: 0.9, sensitive: 0.8, competitive: 0.75, erratic: 0.6, bored: 0.55 }[t.temperament];
    cyc = t.event === 'irregularCycle' ? { mean: mean + 2, sd: 7, logProb: logP, absent: [[rnd.int(200, 450), 0]] } : { mean: mean, sd: rnd.range(1.2, 3), logProb: logP };
    if (cyc.absent) cyc.absent[0][1] = cyc.absent[0][0] + rnd.int(80, 120);
  }
  hidden.cycle = cyc;

  // رویدادها
  var ev = [], traits = { sex: female ? 'female' : 'male', temperament: t.temperament, injuryRisk: t.injury === 'high' ? rnd.range(0.8, 1) : rnd.range(0.25, 0.5), mind: t.mind };
  if (t.activity === 'walk') traits.walk = true;
  if (t.event === 'travel') traits.travelEvery = rnd.int(40, 70);
  if (t.event === 'sick') for (var s = 0; s < rnd.int(1, 2); s++) ev.push({ day: rnd.int(30, 650), type: 'sick', days: rnd.int(7, 14) });
  if (t.event === 'busy') for (var b = 0; b < rnd.int(2, 3); b++) ev.push({ day: rnd.int(30, 650), type: 'busy', days: rnd.int(14, 28), doProb: rnd.range(0.25, 0.4) });
  if (t.event === 'unmotivated') for (var u = 0; u < rnd.int(1, 2); u++) ev.push({ day: rnd.int(60, 600), type: 'unmotivated', days: rnd.int(30, 60), doProb: rnd.range(0.05, 0.2) });
  if (t.event === 'injury' && t.activity === 'run') ev.push({ day: rnd.int(40, 300), type: 'injury', weeks: rnd.int(3, 8), area: rnd.pick(['shin', 'knee', 'achilles', 'foot', 'hip']) });
  var raceDay = p.goal.dateIn != null ? p.goal.dateIn : null;
  if (t.event === 'goalChange' && t.activity === 'run') {
    var cd = raceDay ? rnd.int(30, Math.max(31, raceDay - 30)) : rnd.int(60, 300);
    var types = ['5', '10', '21', '42'].filter(function (x) { return x !== t.goal && (t.level !== 'zero' && t.level !== 'low' || x !== '42'); });
    var ng = goalOf(rnd, rnd.pick(types), rnd.int(90, 220));
    ev.push(rnd.chance(0.5) && raceDay ? { day: cd, type: 'swapMain', goal: ng } : { day: cd, type: 'goal', goal: ng });
    raceDay = cd + ng.dateIn;
  }
  // بعد از مسابقه، هدف بعدی (یا هیچ)
  while (raceDay != null && raceDay < 600 && t.activity === 'run') {
    if (!rnd.chance(FOLLOW[t.temperament])) break;
    var nd = raceDay + rnd.int(14, 60), nt = t.goal === 'health' ? rnd.pick(['5', '10']) : t.goal;
    var g2 = goalOf(rnd, nt, rnd.int(100, 240));
    ev.push({ day: nd, type: 'goal', goal: g2 });
    raceDay = nd + g2.dateIn;
  }
  ev.sort(function (a, b) { return a.day - b.day; });

  var title = (female ? 'زن ' : 'مرد ') + fa(age) + '، ' + (t.activity === 'walk' ? 'پیاده‌روی' : FA_LV[t.level] + (t.history === 'returning' ? ' (برگشتی)' : '')) + '، ' + FA_GOAL[t.goal] + '، ' + FA_TEMP[t.temperament];
  return { id: id, title: title, focus: FA_EV[t.event] + (t.injury === 'high' ? '، حساس به آسیب' : ''), seed: 5000 + idx * 37, traits: traits, axes: t, hidden: hidden, profile: p, events: ev };
}

function generate(n, seed) {
  n = n || 100;
  var pw = pairwise(n, seed || 2026), rnd = makeRng((seed || 2026) + 1);
  var list = HAND.map(function (h) { return Object.assign({}, h, { axes: HAND_TRAITS[h.id] }); });
  for (var i = HAND.length; i < n; i++) list.push(build(pw.traits[i], i, rnd));
  list.coverage = pw.coverage;
  return list;
}
module.exports = { generate: generate, AXES: AXES, valid: valid, FA: { goal: FA_GOAL, temp: FA_TEMP, lv: FA_LV, hist: FA_HIST, ev: FA_EV } };
