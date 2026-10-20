/*
 * تحلیل بیومکانیک دویدن از روی نقاط کلیدی بدن (خروجی خام MediaPipe Pose)؛ کاملاً محلی و بدون هیچ سرویس بیرونی.
 * ورودی هر فیلم: { w, h, frames: [{ t: ثانیه, lm: [[x, y, visibility] × ۳۳] (نرمال‌شده ۰ تا ۱) یا null }] }
 * خروجی: عددها (زاویه‌ها، آهنگ گام، ...) و یافته‌ها با وضعیت good / warn / bad؛ متن‌ها در دیکشنری‌ها (gait.*).
 *
 * مرجع آستانه‌ها:
 *  - آهنگ گام و بیش‌گامی: Heiderscheit و همکاران ۲۰۱۱ (افزایش ۵ تا ۱۰٪ آهنگ گام → زاویه‌ی زانو و بار مفصل کمتر)
 *  - زاویه‌ی برخورد پا: Altman & Davis ۲۰۱۲ (بیشتر از ۸° پاشنه، ۸ تا ۱٫۶- وسط پا، کمتر از ۱٫۶- پنجه)
 *  - افت لگن و زانوی رو به داخل: Noehren ۲۰۰۷، Souza ۲۰۱۶ (تحلیل بالینی دویدن)
 *  - نوسان عمودی، زاویه‌ی ساق در برخورد و خم شدن تنه: Folland ۲۰۱۷، Souza ۲۰۱۶
 */
(function (root) {
  'use strict';
  var P = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24,
    lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28, lHeel: 29, rHeel: 30, lToe: 31, rToe: 32 };
  var SIDES = { l: { sh: P.lSh, el: P.lEl, wr: P.lWr, hip: P.lHip, knee: P.lKnee, ank: P.lAnk, heel: P.lHeel, toe: P.lToe, ear: P.lEar },
    r: { sh: P.rSh, el: P.rEl, wr: P.rWr, hip: P.rHip, knee: P.rKnee, ank: P.rAnk, heel: P.rHeel, toe: P.rToe, ear: P.rEar } };
  var DEG = 180 / Math.PI;
  // طول پا (لگن تا مچ پا) نسبت به قد؛ برای تبدیل پیکسل به سانتی‌متر
  var LEG_RATIO = 0.47;

  // آستانه‌ها: [حد «خوب»، حد «قابل توجه»]؛ بیرون از اون‌ها «نیاز به اصلاح»
  var REF = {
    cadence: { good: 170, warn: 160 },                 // گام در دقیقه (کمتر = بدتر)
    overstride: { good: 0.22, warn: 0.32 },            // فاصله‌ی افقی مچ پا جلوتر از لگن در برخورد ÷ طول پا
    shank: { good: 7, warn: 12 },                      // زاویه‌ی ساق با خط عمود در برخورد (درجه، مچ جلوتر از زانو)
    kneeIc: { lo: 10, hi: 30, warnLo: 5, warnHi: 40 }, // خم شدن زانو در لحظه‌ی برخورد (درجه)
    fsaHeel: 8, fsaFore: -1.6,                         // زاویه‌ی برخورد پا
    neck: { good: 20, warn: 30 },                      // جلو رفتن سر (خط شانه تا گوش با عمود)
    gaze: { lo: -10, hi: 20, warnHi: 30 },             // زاویه‌ی نگاه (مثبت = پایین)
    trunk: { lo: 2, hi: 12, warnLo: -2, warnHi: 18 },  // خم شدن تنه به جلو
    elbow: { lo: 70, hi: 110, warnLo: 55, warnHi: 130 }, // زاویه‌ی داخلی آرنج
    vo: { good: 10, warn: 12 },                        // نوسان عمودی (سانتی‌متر)
    pelvic: { good: 5, warn: 8 },                      // افت لگن سمت مقابل (درجه)
    valgus: { good: 8, warn: 14 },                     // زاویه‌ی زانوی رو به داخل در صفحه‌ی جلو (درجه)
    cross: { good: 0.15, warn: 0.35 },                 // سهم فریم‌هایی که دست از خط وسط بدن رد می‌شه
    sym: { good: 8, warn: 15 }                         // اختلاف چپ و راست (درصد)
  };

  // ---------- کمکی‌ها ----------
  function median(a) {
    var v = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; });
    if (!v.length) return null;
    var m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  function pct(a, p) {
    var v = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (x, y) { return x - y; });
    if (!v.length) return null;
    var i = Math.min(v.length - 1, Math.max(0, Math.round((v.length - 1) * p)));
    return v[i];
  }
  function mean(a) { var v = a.filter(function (x) { return x != null && isFinite(x); }); return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : null; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  // زاویه‌ی داخلی در b (درجه)
  function angle3(a, b, c) {
    var v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
    var d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (!d) return null;
    return Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * DEG;
  }
  function round1(x) { return x == null ? null : Math.round(x * 10) / 10; }
  // درصد اختلاف چپ و راست؛ tol = اختلافی که از دقت اندازه‌گیری کمتره (مثلاً یک فریم ویدیو) نادیده گرفته می‌شه
  function symIndex(a, b, tol) { return a == null || b == null || !(a + b) ? null : Math.max(0, Math.abs(a - b) - (tol || 0)) / ((Math.abs(a) + Math.abs(b)) / 2) * 100; }

  // فریم‌ها به پیکسل، با پر کردن فاصله‌های کوتاه و صاف کردن (میانگین ۳ فریمی)
  function prepare(video) {
    var W = video.w || 1, H = video.h || 1, F = video.frames || [];
    var raw = F.map(function (f) {
      if (!f || !f.lm) return null;
      return f.lm.map(function (p) { return { x: p[0] * W, y: p[1] * H, v: p[2] == null ? 1 : p[2] }; });
    });
    var n = raw.length, out = [];
    for (var i = 0; i < n; i++) {
      if (!raw[i]) { out.push(null); continue; }
      var pts = raw[i].map(function (p, k) {
        var sx = 0, sy = 0, c = 0;
        for (var j = i - 1; j <= i + 1; j++) if (raw[j]) { sx += raw[j][k].x; sy += raw[j][k].y; c++; }
        return { x: sx / c, y: sy / c, v: p.v };
      });
      out.push(pts);
    }
    var dt = F.length > 1 ? (F[F.length - 1].t - F[0].t) / (F.length - 1) : 1 / 30;
    return { pts: out, raw: raw, t: F.map(function (f) { return f ? f.t : null; }), dt: dt, w: W, h: H, n: n };
  }
  function vis(p, ids) { return mean(ids.map(function (k) { return p[k].v; })); }

  // برخورد پا با زمین: پایین‌ترین نقطه‌ی پا (پاشنه یا پنجه) نزدیک سطح زمین
  function contacts(D, s, L) {
    var y = D.raw.map(function (p) { return p ? Math.max(p[s.heel].y, p[s.toe].y) : null; });
    // فریم‌های گم‌شده‌ی کوتاه (تا ۲ فریم) با درون‌یابی پر می‌شن تا برخوردی جا نیفته
    for (var g = 1; g < y.length - 1; g++) {
      if (y[g] != null) continue;
      var a = g - 1, b = g + 1;
      while (b < y.length && y[b] == null && b - a <= 3) b++;
      if (y[a] != null && b < y.length && y[b] != null && b - a <= 3) for (var q2 = a + 1; q2 < b; q2++) y[q2] = y[a] + (y[b] - y[a]) * (q2 - a) / (b - a);
    }
    var ground = pct(y, 0.92);
    if (ground == null) return { ic: [], stance: [] };
    var thr = ground - 0.06 * L;
    var on = y.map(function (v) { return v != null && v >= thr; });
    var ic = [], stance = [];
    for (var i = 1; i < on.length; i++) {
      if (on[i] && !on[i - 1] && y[i - 1] != null) {
        var j = i;
        while (j + 1 < on.length && on[j + 1]) j++;
        if (j - i >= 1) { ic.push(i); stance.push([i, j]); }
        i = j;
      }
    }
    return { ic: ic, stance: stance };
  }
  function legLen(D, s) {
    return median(D.pts.map(function (p) { return p ? dist(p[s.hip], p[s.knee]) + dist(p[s.knee], p[s.ank]) : null; }));
  }
  function validRate(D) { return D.n ? D.pts.filter(Boolean).length / D.n : 0; }
  // نسبت پهنای شونه به طول تنه: کم = فیلم از کنار، زیاد = فیلم از پشت/جلو
  function viewRatio(D) {
    return median(D.pts.map(function (p) {
      if (!p) return null;
      var sh = Math.abs(p[P.lSh].x - p[P.rSh].x), tr = dist({ x: (p[P.lSh].x + p[P.rSh].x) / 2, y: (p[P.lSh].y + p[P.rSh].y) / 2 }, { x: (p[P.lHip].x + p[P.rHip].x) / 2, y: (p[P.lHip].y + p[P.rHip].y) / 2 });
      return tr ? sh / tr : null;
    }));
  }

  // ---------- فیلم از کنار ----------
  function analyzeSide(video, heightCm) {
    var D = prepare(video), q = { frames: D.n, valid: validRate(D) };
    if (q.valid < 0.5) return { ok: false, reason: 'noPerson', quality: q };
    var view = viewRatio(D);
    if (view != null && view > 0.55) return { ok: false, reason: 'notSide', quality: q };
    // سمت نزدیک به دوربین: دیده‌شدن بیشتر
    var visL = mean(D.pts.map(function (p) { return p ? vis(p, [P.lHip, P.lKnee, P.lAnk, P.lEl]) : null; }));
    var visR = mean(D.pts.map(function (p) { return p ? vis(p, [P.rHip, P.rKnee, P.rAnk, P.rEl]) : null; }));
    var nearK = visR > visL ? 'r' : 'l', near = SIDES[nearK];
    // جهت دویدن در تصویر: پنجه جلوتر از پاشنه
    var dir = median(D.pts.map(function (p) { return p ? (p[P.lToe].x - p[P.lHeel].x) + (p[P.rToe].x - p[P.rHeel].x) : null; })) >= 0 ? 1 : -1;
    var L = legLen(D, near);
    if (!L) return { ok: false, reason: 'noPerson', quality: q };
    var cN = contacts(D, near, L), cF = contacts(D, SIDES[nearK === 'l' ? 'r' : 'l'], L);
    q.steps = cN.ic.length + cF.ic.length;
    if (cN.ic.length < 2) return { ok: false, reason: 'fewSteps', quality: q };
    var m = {};
    // برخورد پای نزدیک
    var kneeIc = [], shank = [], over = [], fsa = [];
    // لحظه‌ی برخورد از فریم خام (صاف کردن، فریم قبل از برخورد رو هم قاطی می‌کنه)
    cN.ic.forEach(function (i) {
      var p = D.raw[i] || D.pts[i];
      if (!p) return;
      kneeIc.push(180 - angle3(p[near.hip], p[near.knee], p[near.ank]));
      shank.push(Math.atan2((p[near.ank].x - p[near.knee].x) * dir, p[near.ank].y - p[near.knee].y) * DEG);
      over.push((p[near.ank].x - p[near.hip].x) * dir / L);
      fsa.push(Math.atan2(p[near.heel].y - p[near.toe].y, Math.abs(p[near.toe].x - p[near.heel].x)) * DEG);
    });
    m.kneeIc = round1(median(kneeIc));
    m.shank = round1(median(shank));
    m.overstride = Math.round(median(over) * 100) / 100;
    m.fsa = round1(median(fsa));
    m.strike = m.fsa > REF.fsaHeel ? 'heel' : m.fsa < REF.fsaFore ? 'fore' : 'mid';
    // آهنگ گام از برخوردهای هر دو پا
    var all = cN.ic.concat(cF.ic).sort(function (a, b) { return a - b; });
    var tt = all.map(function (i) { return D.t[i]; });
    // میانه‌ی فاصله‌ی گام‌ها (یک برخورد جاافتاده فقط یک فاصله رو دو برابر می‌کنه، میانه عوض نمی‌شه)
    var gaps = [];
    for (var gi = 1; gi < tt.length; gi++) if (tt[gi] > tt[gi - 1]) gaps.push(tt[gi] - tt[gi - 1]);
    if (gaps.length >= 2) m.cadence = Math.round(60 / median(gaps));
    else if (cN.ic.length >= 2) m.cadence = Math.round(2 * (cN.ic.length - 1) / (D.t[cN.ic[cN.ic.length - 1]] - D.t[cN.ic[0]]) * 60);
    // زمان تماس با زمین و تقارن زمان‌بندی
    var gct = function (c) { return median(c.stance.map(function (s) { return (s[1] - s[0] + 1) * D.dt * 1000; })); };
    m.gctNear = Math.round(gct(cN)); m.gctFar = cF.ic.length >= 2 ? Math.round(gct(cF)) : null;
    var stepNF = [], stepFN = [];
    cN.ic.forEach(function (i) {
      var nextF = cF.ic.filter(function (j) { return j > i; })[0];
      if (nextF != null) {
        var nextN = cN.ic.filter(function (j) { return j > nextF; })[0];
        stepNF.push((nextF - i) * D.dt);
        if (nextN != null) stepFN.push((nextN - nextF) * D.dt);
      }
    });
    m.stepSym = stepNF.length && stepFN.length ? round1(symIndex(median(stepNF), median(stepFN), D.dt)) : null;
    m.gctSym = m.gctFar ? round1(symIndex(m.gctNear, m.gctFar, D.dt * 1000)) : null;
    // سر، نگاه، تنه، آرنج و دست‌ها (سمت نزدیک، کل فیلم)
    var neck = [], gaze = [], trunk = [], elbow = [], swing = [];
    D.pts.forEach(function (p) {
      if (!p) return;
      var sh = p[near.sh], ear = p[near.ear], hip = p[near.hip];
      neck.push(Math.atan2((ear.x - sh.x) * dir, sh.y - ear.y) * DEG);
      gaze.push(Math.atan2(p[P.nose].y - ear.y, Math.abs(p[P.nose].x - ear.x)) * DEG);
      trunk.push(Math.atan2((sh.x - hip.x) * dir, hip.y - sh.y) * DEG);
      elbow.push(angle3(sh, p[near.el], p[near.wr]));
      swing.push((p[near.wr].x - sh.x) * dir / (dist(sh, hip) || 1));
    });
    m.neck = round1(median(neck)); m.gaze = round1(median(gaze)); m.trunk = round1(median(trunk));
    m.elbow = Math.round(median(elbow));
    m.armSwing = Math.round(((pct(swing, 0.95) || 0) - (pct(swing, 0.05) || 0)) * 100) / 100;
    // نوسان عمودی لگن (به سانتی‌متر، با قد کاربر)
    var hy = D.pts.map(function (p) { return p ? (p[P.lHip].y + p[P.rHip].y) / 2 : null; });
    var amp = [];
    for (var k = 1; k < all.length; k++) {
      var seg = hy.slice(all[k - 1], all[k] + 1).filter(function (v) { return v != null; });
      if (seg.length > 2) amp.push(Math.max.apply(null, seg) - Math.min.apply(null, seg));
    }
    var ampPx = median(amp);
    m.vo = heightCm && ampPx != null ? round1(ampPx / L * LEG_RATIO * heightCm) : null;
    // فریم نمونه برای نمایش: برخورد پای نزدیک وسط فیلم
    var key = cN.ic[Math.floor(cN.ic.length / 2)];
    return { ok: true, view: 'side', near: nearK, dir: dir, metrics: m, quality: q, keyFrame: key, keyT: D.t[key], ic: cN.ic };
  }

  // ---------- فیلم از پشت ----------
  function analyzeBack(video) {
    var D = prepare(video), q = { frames: D.n, valid: validRate(D) };
    if (q.valid < 0.5) return { ok: false, reason: 'noPerson', quality: q };
    var view = viewRatio(D);
    if (view != null && view < 0.4) return { ok: false, reason: 'notBack', quality: q };
    var L = mean([legLen(D, SIDES.l), legLen(D, SIDES.r)]);
    var cL = contacts(D, SIDES.l, L), cR = contacts(D, SIDES.r, L);
    q.steps = cL.ic.length + cR.ic.length;
    if (cL.stance.length < 1 || cR.stance.length < 1) return { ok: false, reason: 'fewSteps', quality: q };
    var m = {};
    // وسط فاز تماس هر پا: افت لگن سمت مقابل و زاویه‌ی زانو در صفحه‌ی جلو
    function midStance(c) { return c.stance.map(function (s) { return Math.round((s[0] + s[1]) / 2); }); }
    function stanceMetrics(c, s, o) {
      var drop = [], valg = [], cross = [];
      midStance(c).forEach(function (i) {
        var p = D.pts[i];
        if (!p) return;
        var hs = p[s.hip], ho = p[o.hip], dx = Math.abs(ho.x - hs.x) || 1;
        drop.push(Math.atan2(ho.y - hs.y, dx) * DEG);
        // زانو نسبت به خط لگن تا مچ پا: به سمت خط وسط بدن = رو به داخل
        var mid = (p[P.lHip].x + p[P.rHip].x) / 2, k = p[s.knee], a = p[s.ank], h = p[s.hip];
        var ang = 180 - angle3(h, k, a), lineX = h.x + (a.x - h.x) * ((k.y - h.y) / ((a.y - h.y) || 1));
        var medial = Math.sign(mid - h.x) || 1;
        valg.push((k.x - lineX) * medial > 0 ? ang : -ang);
        // پا از خط وسط بدن رد شده؟ (فرود ضربدری)
        cross.push(Math.sign(a.x - mid) !== Math.sign(h.x - mid) ? 1 : 0);
      });
      return { drop: median(drop), valgus: median(valg), crossover: mean(cross) };
    }
    var sl = stanceMetrics(cL, SIDES.l, SIDES.r), sr = stanceMetrics(cR, SIDES.r, SIDES.l);
    m.pelvicL = round1(sl.drop); m.pelvicR = round1(sr.drop);
    m.valgusL = round1(sl.valgus); m.valgusR = round1(sr.valgus);
    m.crossover = round1(((sl.crossover || 0) + (sr.crossover || 0)) / 2 * 100);
    // دست از خط وسط بدن رد می‌شه؟
    var armX = [];
    D.pts.forEach(function (p) {
      if (!p) return;
      var mid = (p[P.lSh].x + p[P.rSh].x) / 2, w = Math.abs(p[P.lSh].x - p[P.rSh].x) || 1;
      var l = (p[P.lWr].x - mid) * Math.sign(p[P.lSh].x - mid) < -0.05 * w ? 1 : 0;
      var r = (p[P.rWr].x - mid) * Math.sign(p[P.rSh].x - mid) < -0.05 * w ? 1 : 0;
      armX.push((l + r) / 2);
    });
    m.armCross = Math.round(mean(armX) * 100) / 100;
    var gct = function (c) { return median(c.stance.map(function (s) { return (s[1] - s[0] + 1) * D.dt * 1000; })); };
    m.gctL = Math.round(gct(cL)); m.gctR = Math.round(gct(cR));
    m.gctSym = round1(symIndex(m.gctL, m.gctR, D.dt * 1000));
    m.pelvicSym = round1(Math.abs((m.pelvicL || 0) - (m.pelvicR || 0)));
    m.valgusSym = round1(Math.abs((m.valgusL || 0) - (m.valgusR || 0)));
    var key = midStance(cR)[0];
    return { ok: true, view: 'back', metrics: m, quality: q, keyFrame: key, keyT: D.t[key] };
  }

  // ---------- قواعد: عدد → وضعیت ----------
  function band(v, r) { return v == null ? null : v <= r.good ? 'good' : v <= r.warn ? 'warn' : 'bad'; }
  function range(v, r) { return v == null ? null : v >= r.lo && v <= r.hi ? 'good' : v >= r.warnLo && v <= r.warnHi ? 'warn' : 'bad'; }
  function worst(a, b) { var o = { good: 0, warn: 1, bad: 2 }; return a == null ? b : b == null ? a : o[a] >= o[b] ? a : b; }
  function findings(side, back) {
    var F = [];
    var add = function (id, area, status, value, extra) { if (status) F.push(Object.assign({ id: id, area: area, status: status, value: value }, extra || {})); };
    if (side && side.ok) {
      var m = side.metrics;
      add('head', 'head', worst(band(m.neck, REF.neck), m.gaze == null ? null : m.gaze > REF.gaze.warnHi ? 'bad' : m.gaze > REF.gaze.hi ? 'warn' : m.gaze < REF.gaze.lo ? 'warn' : 'good'),
        m.neck, { gaze: m.gaze, look: m.gaze > REF.gaze.hi ? 'down' : m.gaze < REF.gaze.lo ? 'up' : 'ahead' });
      add('trunk', 'trunk', range(m.trunk, REF.trunk), m.trunk, { lean: m.trunk < REF.trunk.lo ? 'back' : m.trunk > REF.trunk.hi ? 'forward' : 'ok' });
      add('elbow', 'arms', range(m.elbow, REF.elbow), m.elbow, { bend: m.elbow > REF.elbow.hi ? 'straight' : m.elbow < REF.elbow.lo ? 'tight' : 'ok' });
      add('kneeIc', 'knee', range(m.kneeIc, REF.kneeIc), m.kneeIc, { form: m.kneeIc < REF.kneeIc.lo ? 'straight' : m.kneeIc > REF.kneeIc.hi ? 'bent' : 'ok' });
      add('overstride', 'knee', worst(band(m.overstride, REF.overstride), band(m.shank, REF.shank)), m.overstride, { shank: m.shank });
      // نوع فرود پا خودش «اشتباه» نیست؛ فرود پاشنه فقط همراه بیش‌گامی مسئله‌ست
      var os = worst(band(m.overstride, REF.overstride), band(m.shank, REF.shank));
      add('strike', 'foot', m.strike === 'heel' && os !== 'good' ? 'warn' : 'good', m.fsa, { strike: m.strike });
      add('cadence', 'cadence', m.cadence == null ? null : m.cadence >= REF.cadence.good ? 'good' : m.cadence >= REF.cadence.warn ? 'warn' : 'bad', m.cadence);
      add('vo', 'bounce', band(m.vo, REF.vo), m.vo);
      var ss = Math.max(m.stepSym || 0, m.gctSym || 0);
      if (m.stepSym != null || m.gctSym != null) add('timing', 'symmetry', band(ss, REF.sym), round1(ss));
    }
    if (back && back.ok) {
      var b = back.metrics;
      var pd = Math.max(b.pelvicL || 0, b.pelvicR || 0);
      add('pelvic', 'pelvis', band(pd, REF.pelvic), round1(pd), { left: b.pelvicL, right: b.pelvicR });
      var vg = Math.max(b.valgusL || 0, b.valgusR || 0);
      add('valgus', 'kneeIn', band(vg, REF.valgus), round1(vg), { left: b.valgusL, right: b.valgusR });
      add('armCross', 'arms', band(b.armCross, REF.cross), b.armCross);
      add('crossover', 'foot', b.crossover > 30 ? 'warn' : 'good', b.crossover);
      var bs = Math.max(b.gctSym || 0, (b.pelvicSym || 0) / REF.pelvic.good * REF.sym.good, (b.valgusSym || 0) / REF.valgus.good * REF.sym.good);
      add('sides', 'symmetry', band(bs, REF.sym), round1(b.gctSym), { pelvicSym: b.pelvicSym, valgusSym: b.valgusSym });
    }
    // اولویت: «نیاز به اصلاح» قبل از «قابل توجه»؛ در هر گروه، موارد پرتأثیرتر روی آسیب جلوتر
    var ORDER = ['overstride', 'cadence', 'pelvic', 'valgus', 'kneeIc', 'vo', 'trunk', 'timing', 'sides', 'head', 'elbow', 'armCross', 'crossover', 'strike'];
    var S = { bad: 0, warn: 1, good: 2 };
    F.sort(function (a, b) { return S[a.status] - S[b.status] || ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });
    return F;
  }
  function analyze(input) {
    var side = input.side ? analyzeSide(input.side, input.heightCm) : null;
    var back = input.back ? analyzeBack(input.back) : null;
    var F = findings(side, back);
    return { side: side, back: back, findings: F,
      score: F.length ? Math.round(F.reduce(function (s, f) { return s + (f.status === 'good' ? 1 : f.status === 'warn' ? 0.5 : 0); }, 0) / F.length * 100) : null };
  }

  var api = { analyze: analyze, analyzeSide: analyzeSide, analyzeBack: analyzeBack, findings: findings, REF: REF, P: P, angle3: angle3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachGait = api;
})(this);
