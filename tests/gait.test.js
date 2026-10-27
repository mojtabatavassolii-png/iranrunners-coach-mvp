// تست‌های تحلیل بیومکانیک: دونده‌ی مصنوعی با پارامترهای معلوم → نقاط کلیدی → همون عددها باید برگردن
// اجرا: node tests/gait.test.js
'use strict';
var assert = require('assert');
var G = require('../js/gait.js');
var P = G.P;

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; }
}
var R = Math.PI / 180;
function near(a, b, tol, what) { assert.ok(a != null && Math.abs(a - b) <= tol, (what || '') + ' expected ' + b + '±' + tol + ', got ' + a); }

// ---------- دونده‌ی مصنوعی از کنار ----------
// o: cadence، ic (فاصله‌ی مچ پا جلوتر از لگن در برخورد ÷ طول پا)، fsa (زاویه‌ی پا در برخورد)، elbow، neck، gaze، trunk، amp (نوسان لگن به px)، dir
function sideRunner(o) {
  o = Object.assign({ cadence: 175, ic: 0.12, fsa: 4, elbow: 90, neck: 10, gaze: 8, trunk: 7, amp: 14, dir: 1, fps: 30, dur: 10, asym: 0 }, o);
  var L = 200, l = L / 2, F = 0.26 * L, W = 1000, H = 800, ground = 700, x0 = 500, Hh = 0.9 * L;
  var Ts = 60 / o.cadence, T = 2 * Ts, st = 0.36, frames = [], truth = { kneeIc: [] };
  for (var k = 0; k * (1 / o.fps) < o.dur; k++) {
    var t = k / o.fps;
    // لگن: پایین‌ترین وسط فاز تماس، بالاترین در فاز پرواز
    var hipY = ground - 0.08 * L - 0.98 * L - o.amp / 2 + o.amp / 2 * Math.cos(2 * Math.PI * (((t / Ts) % 1) - st / 2) );
    var hip = { x: x0, y: hipY };
    var lm = [];
    for (var i = 0; i < 33; i++) lm.push([0, 0, 0.9]);
    var put = function (idx, p, v) { lm[idx] = [p.x / W, p.y / H, v]; };
    ['r', 'l'].forEach(function (side, si) {
      var stLen = st * (side === 'l' ? 1 + o.asym : 1);
      var ph = ((t / T + (si ? 0.5 : 0)) % 1 + 1) % 1, heel, alpha;
      var xIC = x0 + o.dir * o.ic * L, xTO = x0 - o.dir * 0.42 * L;
      if (ph < stLen) {
        var s = ph / stLen;
        alpha = s < 0.15 ? o.fsa * (1 - s / 0.15) : 0;
        heel = { x: xIC + (xTO - xIC) * s - o.dir * (o.fsa < 0 && s < 0.15 ? 0 : 0), y: ground };
      } else {
        var s2 = (ph - stLen) / (1 - stLen);
        alpha = 20 * Math.sin(Math.PI * s2) + o.fsa * Math.max(0, s2 - 0.85) / 0.15;
        heel = { x: xTO + (xIC - xTO) * s2, y: ground - 0.5 * L * Math.pow(Math.sin(Math.PI * s2), 0.6) };
      }
      var u = { x: o.dir * Math.cos(alpha * R), y: -Math.sin(alpha * R) };
      var toe = { x: heel.x + F * u.x, y: heel.y + F * u.y };
      // پنجه‌ی پایین‌تر از پاشنه (فرود پنجه): پنجه روی زمین
      if (toe.y > heel.y && ph < stLen) { var dy = toe.y - ground; heel.y -= dy; toe.y -= dy; }
      var ank = { x: heel.x + 0.22 * F * u.x, y: Math.min(heel.y, toe.y) - 0.08 * L };
      // زانو با IK دو قطعه‌ی هم‌اندازه، خم به سمت جلو
      var dx = ank.x - hip.x, dy2 = ank.y - hip.y, d = Math.min(Math.hypot(dx, dy2), L * 0.999);
      var m = { x: hip.x + dx / 2, y: hip.y + dy2 / 2 }, hgt = Math.sqrt(Math.max(0, l * l - d * d / 4));
      var nx = -dy2 / (Math.hypot(dx, dy2) || 1), ny = dx / (Math.hypot(dx, dy2) || 1);
      if (nx * o.dir < 0) { nx = -nx; ny = -ny; }
      var knee = { x: m.x + nx * hgt, y: m.y + ny * hgt };
      if (!si && ph < 0.001 + 1 / o.fps / T) truth.kneeIc.push(180 - G.angle3(hip, knee, ank));
      var v = si ? 0.6 : 0.95, off = si ? 6 : -6;
      var S = side === 'l' ? { hip: P.lHip, knee: P.lKnee, ank: P.lAnk, heel: P.lHeel, toe: P.lToe } : { hip: P.rHip, knee: P.rKnee, ank: P.rAnk, heel: P.rHeel, toe: P.rToe };
      put(S.hip, { x: hip.x + off, y: hip.y }, v); put(S.knee, knee, v); put(S.ank, ank, v); put(S.heel, heel, v); put(S.toe, toe, v);
    });
    // تنه، سر و دست راست (سمت نزدیک)
    var torso = 0.75 * L, sh = { x: hip.x + o.dir * torso * Math.sin(o.trunk * R), y: hip.y - torso * Math.cos(o.trunk * R) };
    var ear = { x: sh.x + o.dir * 0.32 * L * Math.sin(o.neck * R), y: sh.y - 0.32 * L * Math.cos(o.neck * R) };
    var nose = { x: ear.x + o.dir * 0.1 * L * Math.cos(o.gaze * R), y: ear.y + 0.1 * L * Math.sin(o.gaze * R) };
    var swing = 35 * Math.sin(2 * Math.PI * t / T), ua = 0.36 * L, fa = 0.33 * L;
    var el = { x: sh.x + o.dir * ua * Math.sin(-swing * R), y: sh.y + ua * Math.cos(swing * R) };
    var fAng = (-swing + (180 - o.elbow)) * R;
    var wr = { x: el.x + o.dir * fa * Math.sin(fAng), y: el.y + fa * Math.cos(fAng) };
    // سمت نزدیک (راست) کل بالاتنه ۶px جابه‌جا، هم‌راستا با لگن راست؛ سمت دور ۱۲px اون‌طرف‌تر
    var sN = function (p, d) { return { x: p.x - 6 + (d || 0), y: p.y }; };
    put(P.rSh, sN(sh), 0.95); put(P.lSh, sN(sh, 12), 0.6);
    put(P.rEar, sN(ear), 0.95); put(P.lEar, sN(ear, 10), 0.6); put(P.nose, sN(nose), 0.95);
    put(P.rEl, sN(el), 0.95); put(P.rWr, sN(wr), 0.95); put(P.lEl, sN(el, 12), 0.5); put(P.lWr, sN(wr, 12), 0.5);
    frames.push({ t: t, lm: lm });
  }
  return { video: { w: W, h: H, frames: frames }, truth: truth, legPx: L };
}

// ---------- دونده‌ی مصنوعی از پشت ----------
function backRunner(o) {
  o = Object.assign({ cadence: 175, dropL: 3, dropR: 3, valgL: 4, valgR: 4, cross: 0, armCross: false, pron: 4, fps: 30, dur: 10 }, o);
  var L = 200, l = L / 2, W = 1000, H = 800, ground = 700, cx = 500, hw = 0.18 * L;
  var T = 120 / o.cadence, st = 0.36, frames = [];
  for (var k = 0; k * (1 / o.fps) < o.dur; k++) {
    var t = k / o.fps, lm = [];
    for (var i = 0; i < 33; i++) lm.push([0, 0, 0.9]);
    var put = function (idx, p) { lm[idx] = [p.x / W, p.y / H, 0.9]; };
    var phL = (t / T) % 1, phR = (t / T + 0.5) % 1;
    var hipY = ground - 0.9 * L;
    // در تصویر از پشت، پای چپ دونده سمت چپ تصویره
    var hipL = { x: cx - hw, y: hipY }, hipR = { x: cx + hw, y: hipY };
    if (phL < st) hipR.y += 2 * hw * Math.tan(o.dropL * R) * Math.sin(Math.PI * phL / st);
    if (phR < st) hipL.y += 2 * hw * Math.tan(o.dropR * R) * Math.sin(Math.PI * phR / st);
    [['l', phL, hipL, -1, o.valgL], ['r', phR, hipR, 1, o.valgR]].forEach(function (a) {
      var side = a[0], ph = a[1], hip = a[2], sgn = a[3], valg = a[4];
      var footX = hip.x - sgn * o.cross * hw * 1.4, footY = ph < st ? ground : ground - 0.4 * L * Math.pow(Math.sin(Math.PI * (ph - st) / (1 - st)), 0.6);
      var ank = { x: footX, y: footY - 0.08 * L };
      // زانو به سمت خط وسط (رو به داخل) به اندازه‌ی زاویه‌ی valg، فقط در فاز تماس
      var v = ph < st ? valg : 0, mid = { x: (hip.x + ank.x) / 2, y: (hip.y + ank.y) / 2 };
      var half = Math.hypot(ank.x - hip.x, ank.y - hip.y) / 2, offs = half * Math.tan(v / 2 * R);
      var knee = { x: mid.x - sgn * offs, y: mid.y };
      var S = side === 'l' ? { hip: P.lHip, knee: P.lKnee, ank: P.lAnk, heel: P.lHeel, toe: P.lToe } : { hip: P.rHip, knee: P.rKnee, ank: P.rAnk, heel: P.rHeel, toe: P.rToe };
      // پاشنه به سمت بیرون (پرونیشن) به اندازه‌ی pron نسبت به ادامه‌ی خط ساق، فقط در فاز تماس
      var expX = ank.x + (ank.x - knee.x) * (0.08 * L) / ((ank.y - knee.y) || 1);
      var heelX = expX + (ph < st ? sgn * Math.tan(o.pron * R) * 0.08 * L : 0);
      put(S.hip, hip); put(S.knee, knee); put(S.ank, ank); put(S.heel, { x: heelX, y: footY }); put(S.toe, { x: footX, y: footY - 4 });
    });
    var shY = hipY - 0.75 * L, shL = { x: cx - 0.24 * L, y: shY }, shR = { x: cx + 0.24 * L, y: shY };
    put(P.lSh, shL); put(P.rSh, shR);
    var sw = Math.sin(2 * Math.PI * t / T);
    put(P.lWr, { x: o.armCross && sw > 0 ? cx + 0.08 * L : shL.x + 6, y: shY + 0.5 * L });
    put(P.rWr, { x: o.armCross && sw < 0 ? cx - 0.08 * L : shR.x - 6, y: shY + 0.5 * L });
    put(P.lEl, { x: shL.x, y: shY + 0.35 * L }); put(P.rEl, { x: shR.x, y: shY + 0.35 * L });
    put(P.nose, { x: cx, y: shY - 0.4 * L }); put(P.lEar, { x: cx - 20, y: shY - 0.4 * L }); put(P.rEar, { x: cx + 20, y: shY - 0.4 * L });
    frames.push({ t: t, lm: lm });
  }
  return { video: { w: W, h: H, frames: frames } };
}
function find(r, id) { return r.findings.filter(function (f) { return f.id === id; })[0]; }

test('کنار: آهنگ گام، زانو و فرود پا از دونده‌ی خوب', function () {
  var x = sideRunner({ cadence: 176, ic: 0.12, fsa: 3 });
  var r = G.analyze({ side: x.video, heightCm: 175 });
  assert.ok(r.side.ok, JSON.stringify(r.side));
  var m = r.side.metrics;
  near(m.cadence, 176, 6, 'cadence');
  var tk = x.truth.kneeIc.slice().sort(function (a, b) { return a - b; });
  near(m.kneeIc, tk[Math.floor(tk.length / 2)], 4, 'knee at IC');
  assert.ok(m.kneeIc > 5 && m.kneeIc < 35, 'plausible knee ' + m.kneeIc);
  near(m.overstride, 0.12 + 0.057, 0.04, 'overstride (ankle = heel + 0.057 L)');
  assert.strictEqual(m.strike, 'mid');
  near(m.elbow, 90, 6, 'elbow'); near(m.neck, 10, 3, 'neck'); near(m.gaze, 8, 3, 'gaze'); near(m.trunk, 7, 3, 'trunk');
  // کادنس و نوع فرود فقط توصیفی‌ان (خوب و بد ندارن)
  assert.strictEqual(find(r, 'cadence').status, 'info');
  assert.strictEqual(find(r, 'overstride').status, 'good');
  assert.strictEqual(find(r, 'strike').status, 'info');
  near(find(r, 'peakKnee').value, 40, 25, 'peak knee plausible');
  assert.ok(find(r, 'peakKnee').value > m.kneeIc, 'peak knee > knee at IC');
  // ۳۰ فریم: لحظه‌ی برخورد تا ۳۳ms جابه‌جا → حداکثر «تخمینی»؛ سر و تنه از کل فیلم → مطمئن
  assert.strictEqual(find(r, 'kneeIc').conf, 'est');
  assert.strictEqual(find(r, 'gct').conf, 'est');
  assert.strictEqual(find(r, 'trunk').conf, 'sure');
  assert.ok(!r.findings.some(function (f) { return f.id === 'pronation'; }));
});
test('کنار: بیش‌گامی با فرود پاشنه و آهنگ پایین → پیشنهاد اصلاح', function () {
  var x = sideRunner({ cadence: 152, ic: 0.34, fsa: 16 });
  var r = G.analyze({ side: x.video, heightCm: 175 });
  var m = r.side.metrics;
  near(m.cadence, 152, 6, 'cadence');
  assert.strictEqual(m.strike, 'heel');
  assert.strictEqual(find(r, 'cadence').status, 'warn');
  assert.strictEqual(find(r, 'overstride').status, 'bad');
  assert.strictEqual(find(r, 'strike').status, 'info');
  assert.strictEqual(r.findings[0].status, 'bad');
});
test('کنار: فرود پنجه، آرنج صاف، سر پایین، جهت دویدن برعکس', function () {
  var x = sideRunner({ fsa: -8, elbow: 150, gaze: 35, dir: -1 });
  var r = G.analyze({ side: x.video, heightCm: 175 });
  var m = r.side.metrics;
  assert.strictEqual(r.side.dir, -1);
  assert.strictEqual(m.strike, 'fore');
  assert.strictEqual(find(r, 'elbow').status, 'info'); assert.strictEqual(find(r, 'elbow').bend, 'straight');
  assert.strictEqual(find(r, 'head').look, 'down');
});
test('کنار: نوسان عمودی به سانتی‌متر و عدم تقارن زمان‌بندی', function () {
  var x = sideRunner({ amp: 28 });
  var r = G.analyze({ side: x.video, heightCm: 175 });
  near(r.side.metrics.vo, 28 / 200 * 0.47 * 175, 2.5, 'vo cm');
  var a = G.analyze({ side: sideRunner({ asym: 0.35 }).video, heightCm: 175 });
  assert.ok(find(a, 'timing').value > 8, JSON.stringify(a.side.metrics));
  assert.strictEqual(find(a, 'vo').conf, 'est');
});
test('پشت: افت لگن، زانوی رو به داخل و عبور دست از خط وسط', function () {
  var good = G.analyze({ back: backRunner({}).video });
  assert.ok(good.back.ok, JSON.stringify(good.back));
  near(good.back.metrics.pelvicL, 3, 1.5, 'pelvic L'); near(good.back.metrics.valgusR, 4, 2, 'valgus R');
  assert.strictEqual(find(good, 'pelvic').status, 'good');
  assert.strictEqual(find(good, 'valgus').status, 'good');
  assert.strictEqual(find(good, 'armCross').status, 'info');
  var bad = G.analyze({ back: backRunner({ dropL: 11, valgR: 18, armCross: true }).video });
  near(bad.back.metrics.pelvicL, 11, 2, 'pelvic L');
  near(bad.back.metrics.valgusR, 18, 3, 'valgus R');
  assert.strictEqual(find(bad, 'pelvic').status, 'bad');
  assert.strictEqual(find(bad, 'valgus').status, 'bad');
  assert.ok(find(bad, 'armCross').value > find(good, 'armCross').value);
  assert.ok(find(bad, 'sides').pelvicSym > 5, 'asymmetry measured');
});
test('کیفیت: فیلم اشتباه یا بدون آدم', function () {
  assert.strictEqual(G.analyzeSide(backRunner({}).video, 175).reason, 'notSide');
  assert.strictEqual(G.analyzeBack(sideRunner({}).video).reason, 'notBack');
  var empty = { w: 100, h: 100, frames: [{ t: 0, lm: null }, { t: 0.03, lm: null }] };
  assert.strictEqual(G.analyzeSide(empty, 175).reason, 'noPerson');
  var short = sideRunner({ dur: 0.3 });
  assert.strictEqual(G.analyzeSide(short.video, 175).reason, 'fewSteps');
});

test('نویز: لرزش نقاط و فریم‌های گم‌شده (مثل خروجی واقعی MediaPipe)', function () {
  var seed = 7; var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  var gauss = function () { return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd()); };
  var x = sideRunner({ cadence: 168, ic: 0.3, fsa: 14 });
  x.video.frames.forEach(function (f, i) {
    if (i % 17 === 5) { f.lm = null; return; }
    f.lm = f.lm.map(function (p) { return [p[0] + gauss() * 0.002, p[1] + gauss() * 0.002, p[2]]; });
  });
  var r = G.analyze({ side: x.video, heightCm: 175 });
  assert.ok(r.side.ok, JSON.stringify(r.side));
  near(r.side.metrics.cadence, 168, 10, 'cadence');
  assert.strictEqual(r.side.metrics.strike, 'heel');
  assert.ok(find(r, 'overstride').status !== 'good');
});

test('پشت: پرونیشن دیگه سنجیده و گزارش نمی‌شه', function () {
  var r = G.analyze({ back: backRunner({ pron: 18 }).video });
  assert.ok(!r.findings.some(function (f) { return f.id === 'pronation'; }));
  assert.strictEqual(r.back.metrics.pronL, undefined);
});
test('ریسک آسیب: از الگوهای حرکتی، با عامل‌هاش', function () {
  var good = G.analyze({ side: sideRunner({}).video, back: backRunner({}).video, heightCm: 175 });
  good.risks.forEach(function (r) { assert.strictEqual(r.level, 'low', r.id + ' ' + JSON.stringify(r.factors)); });
  assert.ok(good.axes.performance >= 80 && good.axes.form >= 80, JSON.stringify(good.axes));
  var bad = G.analyze({ side: sideRunner({ cadence: 150, ic: 0.36, fsa: 16 }).video, back: backRunner({ dropL: 11, valgR: 16, cross: 1.1 }).video, heightCm: 175 });
  var rk = bad.risks.filter(function (r) { return r.id === 'runnersKnee'; })[0], sh = bad.risks.filter(function (r) { return r.id === 'shin'; })[0];
  assert.strictEqual(rk.level, 'high'); assert.ok(rk.factors.indexOf('overstride') >= 0 && rk.factors.indexOf('valgus') >= 0, JSON.stringify(rk));
  assert.strictEqual(sh.level, 'high');
  assert.strictEqual(bad.axes.risk, 'high');
  assert.ok(bad.axes.performance < 75 && bad.axes.form < 75, JSON.stringify(bad.axes));
  // فرود پنجه به‌تنهایی الگوی آسیب حساب نمی‌شه
  var fore = G.analyze({ side: sideRunner({ fsa: -8 }).video, heightCm: 175 });
  var ach = fore.risks.filter(function (r) { return r.id === 'achilles'; })[0];
  assert.ok(ach && ach.level === 'low', JSON.stringify(ach));
  // بدون فیلم از پشت، آسیب‌هایی که فقط از پشت سنجیده می‌شن (مثل ITBS) گزارش نمی‌شن
  assert.ok(!fore.risks.some(function (r) { return r.id === 'itbs'; }));
});

test('یک فیلم کافیه؛ زاویه خودکار تشخیص داده می‌شه', function () {
  // فیلم از پشت در خونه‌ی «کنار»
  var r = G.analyze({ side: backRunner({}).video, heightCm: 175 });
  assert.ok(!r.side && r.back && r.back.ok && r.back.src === 'side', JSON.stringify({ side: !!r.side, back: r.back && r.back.src }));
  assert.ok(r.findings.length >= 4 && r.failed.length === 0);
  // فقط فیلم از کنار، در خونه‌ی «پشت»
  var r2 = G.analyze({ back: sideRunner({}).video, heightCm: 175 });
  assert.ok(r2.side && r2.side.ok && r2.side.src === 'back' && !r2.back);
  // دو فیلم از کنار: دومی «هم‌زاویه» گزارش می‌شه
  var r3 = G.analyze({ side: sideRunner({}).video, back: sideRunner({ cadence: 160 }).video, heightCm: 175 });
  assert.ok(r3.side.src === 'side' && !r3.back);
  assert.deepStrictEqual(r3.failed, [{ src: 'back', reason: 'sameView' }]);
  // فیلم بدون آدم
  var r4 = G.analyze({ side: sideRunner({}).video, back: { w: 100, h: 100, frames: [{ t: 0, lm: null }, { t: 0.03, lm: null }] }, heightCm: 175 });
  assert.ok(r4.side.ok); assert.deepStrictEqual(r4.failed, [{ src: 'back', reason: 'noPerson' }]);
});

test('یک یافته‌ی تنها کافی نیست: حداقل دو عامل برای «الگوی مرتبط»', function () {
  var r = G.analyze({ side: sideRunner({}).video, back: backRunner({ dropL: 11 }).video, heightCm: 175 });
  assert.strictEqual(find(r, 'pelvic').status, 'bad');
  r.risks.forEach(function (x) { assert.strictEqual(x.level, 'low', x.id + ' ' + JSON.stringify(x.factors)); });
  var two = G.analyze({ side: sideRunner({ ic: 0.36 }).video, back: backRunner({ dropL: 11 }).video, heightCm: 175 });
  var ach = two.risks.filter(function (x) { return x.id === 'achilles'; })[0];
  assert.ok(ach.level !== 'low' && ach.factors.length >= 2, JSON.stringify(ach));
});
test('شرایط دویدن: حد پایین معمول کادنس با سرعت بالا می‌ره', function () {
  var v = sideRunner({ cadence: 163 }).video;
  assert.strictEqual(find(G.analyze({ side: v, heightCm: 175, condition: 'easy' }), 'cadence').status, 'info');
  var iv = G.analyze({ side: v, heightCm: 175, condition: 'interval' });
  assert.strictEqual(find(iv, 'cadence').status, 'warn'); assert.strictEqual(iv.condition, 'interval');
  assert.strictEqual(G.analyze({ side: v, heightCm: 175, condition: 'xyz' }).condition, 'easy');
});
test('سطح اطمینان: دید کم → بدون عدد؛ ۶۰ فریم → برخورد مطمئن', function () {
  var x = sideRunner({});
  x.video.frames.forEach(function (f) { [P.rHip, P.rKnee, P.rAnk, P.rHeel, P.rToe, P.lHip, P.lKnee, P.lAnk, P.lHeel, P.lToe].forEach(function (k) { f.lm[k][2] = 0.45; }); });
  var r = G.analyze({ side: x.video, heightCm: 175 });
  if (r.side) {
    var k = find(r, 'kneeIc');
    assert.strictEqual(k.status, 'na'); assert.strictEqual(k.value, null);
    r.risks.forEach(function (z) { assert.ok(z.factors.indexOf('kneeIc') < 0); });
  }
  var h = G.analyze({ side: sideRunner({ fps: 60 }).video, heightCm: 175 });
  assert.strictEqual(h.side.quality.fps, 60);
  assert.strictEqual(find(h, 'kneeIc').conf, 'sure');
  assert.strictEqual(find(h, 'gct').conf, 'est');
  // نرخ فریم خود فیلم (۳۰) با نمونه‌برداری ۶۰: فریم‌های تکراری دقت نمی‌دن
  var dup = sideRunner({ fps: 60 }).video; dup.fps = 30;
  assert.strictEqual(find(G.analyze({ side: dup, heightCm: 175 }), 'kneeIc').conf, 'est');
  // بدون قد: نوسان عمودی غیرقابل‌اطمینان
  assert.strictEqual(find(G.analyze({ side: sideRunner({}).video }), 'vo').status, 'na');
});
test('بار تمرینی فقط زمینه‌ست', function () {
  var r = G.analyze({ side: sideRunner({}).video, heightCm: 175, load: { acute: 30, chronic: 18 } });
  assert.strictEqual(r.load.ratio, 1.67); assert.strictEqual(r.load.high, true);
  assert.strictEqual(G.analyze({ side: sideRunner({}).video, heightCm: 175, load: { acute: 5, chronic: 0 } }).load, null);
});

test('شرایط دویدن جدا برای هر فیلم؛ هر یافته مال یک نماست', function () {
  // ۱۶۳ گام: برای ایزی معمول، برای اینتروال کمتر از معمول
  var r = G.analyze({ side: sideRunner({ cadence: 163 }).video, back: backRunner({ cadence: 163 }).video, heightCm: 175, conditions: { side: 'easy', back: 'interval' } });
  assert.deepStrictEqual(r.conditions, { side: 'easy', back: 'interval' });
  var cs = r.findings.filter(function (f) { return f.id === 'cadence'; });
  var sc = cs.filter(function (f) { return f.view === 'side'; })[0], bc = cs.filter(function (f) { return f.view === 'back'; })[0];
  near(bc.value, 163, 8, 'back cadence');
  assert.strictEqual(sc.status, 'info'); assert.strictEqual(bc.status, 'warn'); assert.strictEqual(bc.cond, 'interval');
  r.findings.forEach(function (f) { assert.ok(f.view === 'side' || f.view === 'back', f.id); });
  ['pelvic', 'valgus', 'crossover', 'trunkLat', 'armCross', 'sides'].forEach(function (id) {
    assert.ok(r.findings.some(function (f) { return f.id === id && f.view === 'back'; }), id); });
  ['overstride', 'kneeIc', 'elbow', 'head', 'trunk', 'strike'].forEach(function (id) {
    assert.ok(r.findings.some(function (f) { return f.id === id && f.view === 'side'; }), id); });
  // برچسب با خود فیلم می‌ره: فیلم از پشت در خونه‌ی «کنار»
  var sw = G.analyze({ side: backRunner({}).video, heightCm: 175, conditions: { side: 'race', back: 'easy' } });
  assert.strictEqual(sw.conditions.back, 'race'); assert.strictEqual(sw.conditions.side, null);
});
console.log(passed + ' تست تحلیل دویدن موفق' + (process.exitCode ? ' — برخی ناموفق' : ''));
