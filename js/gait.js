/*
 * تحلیل بیومکانیک دویدن از روی نقاط کلیدی بدن (خروجی خام MediaPipe Pose)؛ کاملاً محلی و بدون هیچ سرویس بیرونی.
 * ورودی هر فیلم: { w, h, frames: [{ t: ثانیه, lm: [[x, y, visibility] × ۳۳] (نرمال‌شده ۰ تا ۱) یا null }] }
 * خروجی: عددها (زاویه‌ها، آهنگ گام، ...) و یافته‌ها با وضعیت good / warn / bad؛ متن‌ها در دیکشنری‌ها (gait.*).
 *
 * مرجع‌ها (جزئیات، قدرت شواهد و نحوه‌ی بیان در گزارش تخصصی؛ gait.expert.* در دیکشنری‌ها):
 *  - روش دوبعدی و زاویه‌ی ساق/زانو در برخورد: Souza 2016 (PM&R Clin N Am)
 *  - الگوهای دونده‌های آسیب‌دیده (افت لگن، تنه، زانوی صاف و ساق جلو در برخورد): Bramah 2018 (AJSM، مقطعی)
 *  - آهنگ گام: Heiderscheit 2011 (افزایش ۵ تا ۱۰٪ → بار زانو کمتر)؛ اثر سرعت: Cavanagh & Kram 1989
 *  - رویدادهای گام از حرکت پا نسبت به لگن: Zeni 2008
 *  - زاویه‌ی برخورد پا: Altman & Davis 2012؛ نوع فرود و آسیب: Anderson 2020 (شواهد محدود)
 *  - نوسان عمودی، زاویه‌ی ساق و duty factor: Folland 2017 (اقتصاد و عملکرد)
 *  - شیب تنه: Teng & Powers 2014 (بده‌بستان زانو و لگن)؛ تاب بازو: Arellano & Kram 2014
 *  - عرض گام: Meardon 2012 (نوار ایلیوتیبیال) و 2014 (فشار ساق)، هر دو مدل‌سازی
 *  - شواهد آینده‌نگر کلی: Ceyssens 2019 (کم و ناهمسو)؛ پرونیشن: Nielsen 2014 (ارتباط نداشت؛ از گزارش حذف شده)
 * آستانه‌هایی که از مقاله‌ی مشخصی نیومدن، در REF با «تخمین» مشخص شدن.
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
    // آهنگ گام: حد پایین «معمول» بر اساس شرایط دویدن (با سرعت بالا می‌ره)؛ فقط «کمتر از معمول» علامت می‌خوره (تخمین)
    cadence: { easy: 160, tempo: 165, interval: 170, race: 170 },
    overstride: { good: 0.22, warn: 0.32 },            // فاصله‌ی افقی مچ پا جلوتر از لگن در برخورد ÷ طول پا
    shank: { good: 7, warn: 12 },                      // زاویه‌ی ساق با خط عمود در برخورد (درجه، مچ جلوتر از زانو)
    kneeIc: { lo: 10, hi: 30, warnLo: 5, warnHi: 40 }, // خم شدن زانو در لحظه‌ی برخورد (درجه)
    fsaHeel: 8, fsaFore: -1.6,                         // زاویه‌ی برخورد پا
    neck: { good: 20, warn: 30 },                      // جلو رفتن سر (خط شانه تا گوش با عمود)
    gaze: { lo: -10, hi: 20, warnHi: 30 },             // زاویه‌ی نگاه (مثبت = پایین)
    trunk: { lo: 2, hi: 12, warnLo: -2, warnHi: 18 },  // خم شدن تنه به جلو
    elbow: { lo: 70, hi: 110, warnLo: 55, warnHi: 130 }, // زاویه‌ی داخلی آرنج
    pelvic: { good: 5, warn: 8 },                      // افت لگن سمت مقابل (درجه)
    valgus: { good: 8, warn: 14 },                     // زاویه‌ی زانوی رو به داخل در صفحه‌ی جلو (درجه)
    crossover: 30                                      // درصد برخوردهایی که پا از خط وسط بدن رد می‌شه (تخمین)
  };
  var CONDITIONS = ['easy', 'tempo', 'interval', 'race'];

  // ---------- سطح اطمینان هر اندازه‌گیری ----------
  // sure = اندازه‌گیری مطمئن، est = تخمینی، low = غیرقابل‌اطمینان (عدد نشون داده نمی‌شه)
  // v: میانگین «دیده‌شدن» مفاصل لازم (۰ تا ۱)، n: تعداد نمونه (برخورد یا فریم)، cap: بالاترین سطح ممکن برای این پارامتر
  var CONF = { sure: 2, est: 1, low: 0 };
  function conf(v, n, nSure, nEst, cap) {
    var c = v != null && v >= 0.8 && n >= nSure ? 'sure' : v != null && v >= 0.6 && n >= nEst ? 'est' : 'low';
    return cap && CONF[cap] < CONF[c] ? cap : c;
  }

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
  // scale: ضریب اسلوموشن (۸ = هر ثانیه‌ی فیلم یک‌هشتم ثانیه‌ی واقعیه)؛ همه‌ی زمان‌های تحلیل به ثانیه‌ی واقعی
  function prepare(video, scale) {
    scale = scale > 0 ? scale : 1;
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
    var dt = (F.length > 1 ? (F[F.length - 1].t - F[0].t) / (F.length - 1) : 1 / 30) / scale;
    // نرخ فریم مؤثر (در زمان واقعی): نمونه‌برداری، ولی نه بیشتر از نرخ فریم خود فیلم (فریم‌های تکراری دقت زمانی نمی‌دن)
    var fps = Math.round(Math.min(1 / dt, (video.fps || Infinity) * scale));
    // t: زمان واقعی؛ tv: زمان خود فیلم (برای پیدا کردن فریم در ویدیو)
    return { pts: out, raw: raw, t: F.map(function (f) { return f ? f.t / scale : null; }), tv: F.map(function (f) { return f ? f.t : null; }),
      dt: dt, fps: fps, scale: scale, w: W, h: H, n: n };
  }
  function vis(p, ids) { return mean(ids.map(function (k) { return p[k].v; })); }
  // میانگین دیده‌شدن مفاصل در فریم‌های مشخص (یا همه‌ی فریم‌ها)
  function visAt(D, ids, idx) {
    var list = idx ? idx.map(function (i) { return D.raw[i]; }) : D.raw;
    return mean(list.map(function (p) { return p ? vis(p, ids) : null; }));
  }

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
  // درون‌یابی فاصله‌های کوتاه (تا ۳ فریم) در یک سری عددی
  function fillGaps(y) {
    for (var g = 1; g < y.length - 1; g++) {
      if (y[g] != null) continue;
      var a = g - 1, b = g + 1;
      while (b < y.length && y[b] == null && b - a <= 4) b++;
      if (y[a] != null && b < y.length && y[b] != null && b - a <= 4) for (var q = a + 1; q < b; q++) y[q] = y[a] + (y[b] - y[a]) * (q - a) / (b - a);
    }
    return y;
  }
  // قله‌ها (یا دره‌ها با sign = -1) با پسماند h: هر قله باید حداقل h از دره‌ی قبل و بعدش بالاتر باشه (نویز کوچیک‌تر از h قله نمی‌شه)
  function extrema(y, h, sign) {
    var out = [], mode = 0, best = 0, bi = -1, lo = null; // mode ۰ = هنوز بالا رفتنی ندیده، ۱ = دنبال قله، -۱ = دنبال دره
    for (var i = 0; i < y.length; i++) {
      if (y[i] == null) { mode = 0; lo = null; continue; }
      var v = y[i] * sign;
      if (mode === 1) {
        if (v > best) { best = v; bi = i; }
        else if (best - v >= h) { out.push(bi); mode = -1; lo = v; }
      } else {
        if (lo == null || v < lo) lo = v;
        else if (v - lo >= h) { mode = 1; best = v; bi = i; }
      }
    }
    return out;
  }
  // برخوردهای پا از نمای کنار، مستقل از حرکت دوربین (چرخش، لرزش، نزدیک یا دور شدن دونده):
  //  ۱. نامزد برخورد = جلوترین وضعیت پای جلویی نسبت به لگن (روش Zeni 2008؛ مختصات نسبت به لگن و تقسیم بر طول پا)
  //  ۲. لحظه‌ی دقیق برخورد = جایی که سرعت پایین آمدن پایین‌ترین نقطه‌ی پا (پاشنه یا پنجه) نزدیک صفر می‌شه
  //  ۳. جدا شدن پا = عقب‌ترین وضعیت پنجه‌ی پای عقبی نسبت به لگن
  // برچسب چپ و راست MediaPipe وقتی پاها از کنار هم رد می‌شن گاهی جابه‌جا می‌شه؛ برای همین «پای جلویی» و «پای عقبی» بدون برچسب پیدا می‌شن
  // و برچسب فقط در خود لحظه‌ی برخورد (پاها بیشترین فاصله رو دارن) خونده می‌شه.
  function sideContacts(D, dir) {
    var n = D.n, front = [], lead = [], rear = [], Lf = [];
    for (var i = 0; i < n; i++) {
      var p = D.pts[i];
      if (!p) { front.push(null); lead.push(null); rear.push(null); Lf.push(null); continue; }
      var Ll = dist(p[P.lHip], p[P.lKnee]) + dist(p[P.lKnee], p[P.lAnk]), Lr = dist(p[P.rHip], p[P.rKnee]) + dist(p[P.rKnee], p[P.rAnk]);
      Lf.push((Ll + Lr) / 2 || null);
    }
    // طول پا در هر فریم (میانه‌ی همسایه‌ها): مقیاس با نزدیک یا دور شدن دونده عوض می‌شه
    var Lloc = Lf.map(function (v, i) { return v == null ? null : median(Lf.slice(Math.max(0, i - 7), i + 8)); });
    for (var j = 0; j < n; j++) {
      var q = D.pts[j], L = Lloc[j];
      if (!q || !L) continue;
      var hx = (q[P.lHip].x + q[P.rHip].x) / 2;
      var hl = (q[P.lHeel].x - hx) * dir / L, hr = (q[P.rHeel].x - hx) * dir / L;
      var tl = (q[P.lToe].x - hx) * dir / L, tr = (q[P.rToe].x - hx) * dir / L;
      front[j] = Math.max(hl, hr); lead[j] = hl >= hr ? 'l' : 'r';
      rear[j] = Math.min(tl, tr);
    }
    fillGaps(front); fillGaps(rear);
    // پرش یکی‌دو فریمی کل اسکلت (خطای لحظه‌ای MediaPipe) با میانه‌ی ۵ فریمی حذف می‌شه؛ جای قله‌ها عوض نمی‌شه
    var med5 = function (y) { return y.map(function (v, i) { return v == null ? null : median(y.slice(Math.max(0, i - 2), i + 3)); }); };
    front = med5(front); rear = med5(rear);
    var span = function (y) { var a = pct(y, 0.95), b = pct(y, 0.05); return a == null ? 0 : a - b; };
    // نامزد هر گام: بیشترین فاصله‌ی افقی دو پا (کمی قبل از برخورد، در فاز پرواز)؛ قدر مطلق فاصله به جابه‌جایی برچسب‌ها حساس نیست
    var sep = sepSignal(D, 'x');
    var peaks = extrema(sep, Math.max(0.06, 0.35 * span(sep)), 1), toes = extrema(rear, Math.max(0.06, 0.35 * span(rear)), -1);
    var per = stepPeriod(sep), gap = [];
    for (var k = 1; k < peaks.length; k++) gap.push(peaks[k] - peaks[k - 1]);
    var T = per ? per.lag : median(gap) || 8, w = Math.max(2, Math.round(0.25 * T));
    // پایین‌ترین نقطه‌ی پای جلویی (پیکسل، y رو به پایین)
    // نسبت به لگن و تقسیم بر طول پا، تا نزدیک شدن دونده به دوربین یا کج شدن دوربین «پایین آمدن» حساب نشه
    // پای جلویی هر فریم از روی هندسه (نه برچسب)، تا جابه‌جا شدن برچسب‌ها برخورد اشتباه نسازه
    var fr = function (i) { var p = D.raw[i]; return p ? ((p[P.lHeel].x - p[P.rHeel].x) * dir >= 0 ? 'l' : 'r') : null; };
    var low = function (i) { var p = D.raw[i], s = fr(i); return p && s && Lloc[i] ? (Math.max(p[SIDES[s].heel].y, p[SIDES[s].toe].y) - (p[P.lHip].y + p[P.rHip].y) / 2) / Lloc[i] : null; };
    var res = { l: { ic: [], stance: [] }, r: { ic: [], stance: [] }, all: [] };
    peaks.forEach(function (pk, idx) {
      // پای جلویی در لحظه‌ی بیشترین فاصله = پایی که داره فرود میاد؛ برخورد کمی قبل یا بعد از این لحظه‌ست
      var s = lead[pk];
      if (!s) return;
      var a = Math.max(0, pk - Math.max(2, Math.round(0.3 * T))), b = Math.min(n - 2, pk + Math.max(2, Math.round(0.4 * T))), vmax = 0, m = -1, ic = pk;
      // سرعت پایین آمدن (فریم به فریم بعدی)
      var vf = function (i) { var y0 = low(i), y1 = low(i + 1); return y0 == null || y1 == null ? null : y1 - y0; };
      for (var i2 = a; i2 <= b; i2++) { var v = vf(i2); if (v != null && v > vmax) { vmax = v; m = i2; } }
      if (m >= 0 && vmax > 0.004) {
        // «روی زمین»: نزدیک سطح پا در فریم‌های بعد از قله
        var after = []; for (var i3 = m; i3 <= b + 1; i3++) after.push(low(i3));
        after = [pct(after, 0.8)];
        var yG = median(after);
        for (var i4 = m; i4 <= b; i4++) {
          var v4 = vf(i4), y4 = low(i4);
          if (v4 != null && v4 <= 0.2 * vmax && y4 != null && (yG == null || y4 >= yG - 0.03)) { ic = i4; break; }
        }
      }
      // دو قله‌ی نزدیک که به یک برخورد رسیدن: یک گام
      var last = res.all[res.all.length - 1];
      if (last && ic - last.i < 0.35 * T) return;
      s = fr(ic) || s;
      var next = peaks[idx + 1] != null ? peaks[idx + 1] : n;
      var to = toes.filter(function (t) { return t > ic && t < next + w; })[0];
      res.all.push({ i: ic, foot: s, to: to != null && to - ic >= 1 ? to : null });
      res[s].ic.push(ic);
      if (to != null && to - ic >= 1) res[s].stance.push([ic, to]);
    });
    res.period = per;
    return res;
  }
  // فاصله‌ی دو مچ پا (افقی از کنار، عمودی از پشت) ÷ طول پا: در هر گام یک بار بیشینه می‌شه، بدون نیاز به برچسب چپ و راست
  function sepSignal(D, axis) {
    var y = D.pts.map(function (p) {
      if (!p) return null;
      var L = (dist(p[P.lHip], p[P.lKnee]) + dist(p[P.lKnee], p[P.lAnk]) + dist(p[P.rHip], p[P.rKnee]) + dist(p[P.rKnee], p[P.rAnk])) / 2;
      return L ? Math.abs(p[P.lAnk][axis] - p[P.rAnk][axis]) / L : null;
    });
    fillGaps(y);
    return y.map(function (v, i) { return v == null ? null : median(y.slice(Math.max(0, i - 2), i + 3)); });
  }
  // زمان یک گام از خودهمبستگی همین سیگنال (اولین قله با همبستگی ۰٫۵ یا بیشتر، با دقت کمتر از یک فریم)؛
  // از همه‌ی فریم‌ها استفاده می‌کنه، پس به یک برخورد جاافتاده یا اضافه حساس نیست
  function stepPeriod(y) {
    var v = y.filter(function (x) { return x != null; });
    if (v.length < 12) return null;
    var mu = mean(v), n = y.length, ac = [];
    for (var lag = 0; lag <= Math.floor(n / 2); lag++) {
      var s = 0, s0 = 0, s1 = 0, c = 0;
      for (var i = 0; i + lag < n; i++) {
        if (y[i] == null || y[i + lag] == null) continue;
        var a = y[i] - mu, b = y[i + lag] - mu;
        s += a * b; s0 += a * a; s1 += b * b; c++;
      }
      ac.push(c > 6 && s0 && s1 ? s / Math.sqrt(s0 * s1) : null);
    }
    // اولین قله بعد از اولین عبور از صفر
    var k = 1;
    while (k < ac.length && ac[k] != null && ac[k] > 0) k++;
    for (; k < ac.length - 1; k++) {
      if (ac[k] == null || ac[k - 1] == null || ac[k + 1] == null) continue;
      if (ac[k] >= ac[k - 1] && ac[k] >= ac[k + 1] && ac[k] >= 0.5) {
        var den = ac[k - 1] - 2 * ac[k] + ac[k + 1], off = den ? 0.5 * (ac[k - 1] - ac[k + 1]) / den : 0;
        return { lag: k + Math.max(-0.5, Math.min(0.5, off)), r: Math.round(ac[k] * 100) / 100 };
      }
    }
    return null;
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

  // ---------- آهنگ گام با زمان واقعی ----------
  // بازه‌ی قابل قبول آهنگ گام در دویدن (خارج از اون، زمان فیلم احتمالاً واقعی نیست، مثلاً اسلوموشن)
  var CAD_OK = { lo: 130, hi: 230 }, SLOW = [2, 4, 8, 16, 32];
  // حداقل طول پا (پاشنه تا پنجه، پیکسل در ورودی MediaPipe) برای تشخیص نوع فرود (تخمین)
  var FOOT_MIN_PX = 40;
  // per: زمان گام از خودهمبستگی (فریم)؛ اگه بود، مبنای آهنگ گامه و فاصله‌ی برخوردها فقط برای کنترل
  function cadenceOf(D, ics, per) {
    var tt = ics.slice().sort(function (a, b) { return a - b; }).map(function (i) { return D.t[i]; });
    var diff = function (a) { var g = []; for (var i = 1; i < a.length; i++) if (a[i] > a[i - 1]) g.push(a[i] - a[i - 1]); return g; };
    // دو برخورد خیلی نزدیک به هم = یک برخورد دوبار شمرده‌شده (فقط اولی می‌مونه)؛ بعد میانه‌ی فاصله‌ها
    // (یک برخورد جاافتاده فقط یک فاصله رو دوبرابر می‌کنه و میانه رو عوض نمی‌کنه)
    var med = median(diff(tt));
    tt = tt.filter(function (t, i, a) { return !i || t - a[i - 1] >= 0.35 * med; });
    var gaps = diff(tt);
    var out = { cadence: null, steps: tt.length, span: tt.length > 1 ? Math.round((tt[tt.length - 1] - tt[0]) * 1000) / 1000 : 0, valid: false, suggest: null,
      method: null, fromIc: gaps.length >= 2 ? Math.round(60 / median(gaps)) : null };
    var exact;
    // گام‌های کامل داخل فیلم (روش خودهمبستگی از همه‌ی فریم‌ها استفاده می‌کنه؛ اطمینان با تعداد گام‌ها)
    if (per && per.lag) { exact = 60 / (per.lag * D.dt); out.method = 'period'; out.r = per.r; out.cycles = Math.floor(D.pts.filter(Boolean).length / per.lag); }
    else if (gaps.length >= 2) { exact = 60 / median(gaps); out.method = 'ic'; }
    else return out;
    out.cadence = Math.round(exact);
    // دو روش با هم نمی‌خونن (بیش از ۱۵٪ اختلاف) → حداکثر «تخمینی»
    out.agree = out.fromIc == null || Math.abs(out.fromIc - out.cadence) / out.cadence <= 0.15;
    out.valid = out.cadence >= CAD_OK.lo && out.cadence <= CAD_OK.hi;
    // زمان فیلم واقعی فرض شده ولی عدد غیرممکنه: ضریب اسلوموشنی که عدد رو به بازه‌ی دویدن (۱۴۰ تا ۲۱۰) می‌بره؛
    // ضریب‌ها دوبرابر هم‌ان و این بازه کمتر از دوبرابره، پس حداکثر یک ضریب جواب می‌ده
    if (!out.valid && D.scale === 1) {
      var k = SLOW.filter(function (x) { return exact * x >= 140 && exact * x <= 210; })[0];
      if (k) out.suggest = { k: k, cadence: Math.round(exact * k) };
    }
    return out;
  }

  // ---------- نوع فرود پا برای هر گام ----------
  // زاویه‌ی پا (خط پاشنه تا پنجه نسبت به افق؛ مثبت = پنجه بالاتر) در لحظه‌ی برخورد، منهای زاویه‌ی همون پا وقتی وسط فاز تماس صاف روی زمینه
  // (معادل کالیبراسیون ایستاده در Altman & Davis 2012؛ نقطه‌های پاشنه و پنجه‌ی MediaPipe دقیقاً روی کف کفش نیستن)
  function footAngle(p, s) { return Math.atan2(p[s.heel].y - p[s.toe].y, Math.abs(p[s.toe].x - p[s.heel].x)) * DEG; }
  function strikes(D, C2) {
    var steps = [], cal = {};
    var calib = function (foot, i) {
      var st = C2[foot].stance.filter(function (x) { return x[0] === i; })[0];
      if (!st) return null;
      var len = st[1] - st[0], a = [];
      for (var f = st[0] + Math.round(0.25 * len); f <= st[0] + Math.round(0.5 * len); f++) if (D.pts[f]) a.push(footAngle(D.pts[f], SIDES[foot]));
      return median(a);
    };
    C2.all.forEach(function (x) { var c = calib(x.foot, x.i); if (c != null) (cal[x.foot] = cal[x.foot] || []).push(c); });
    // طول پا (پاشنه تا پنجه) در تصویری که به MediaPipe داده می‌شه (حداکثر ۹۶۰ پیکسل؛ js/pose.js)
    var sc = Math.min(1, 960 / Math.max(D.w, D.h));
    var footLen = function (p, s) { return dist(p[s.heel], p[s.toe]); };
    var lenMed = { l: median(D.raw.map(function (p) { return p ? footLen(p, SIDES.l) : null; })), r: median(D.raw.map(function (p) { return p ? footLen(p, SIDES.r) : null; })) };
    var skipped = 0;
    C2.all.forEach(function (x) {
      var p = D.raw[x.i], s = SIDES[x.foot];
      // پاشنه، پنجه و مچ همون پا باید در لحظه‌ی برخورد دیده بشن، و طول پا نزدیک طول معمولش باشه (نه نقطه‌ی جابه‌جاشده)
      if (!p || Math.min(p[s.heel].v, p[s.toe].v, p[s.ank].v) < 0.6 || Math.abs(footLen(p, s) / (lenMed[x.foot] || 1) - 1) > 0.35) { skipped++; return; }
      var c = calib(x.foot, x.i);
      if (c == null) c = median(cal[x.foot] || []) || 0;
      var a = footAngle(p, s) - c;
      var type = a > REF.fsaHeel ? 'heel' : a < REF.fsaFore ? 'fore' : 'mid';
      steps.push({ t: Math.round(D.t[x.i] * 1000) / 1000, foot: x.foot, fsa: round1(a), type: type,
        // نزدیک مرز دو دسته (کمتر از ۲ درجه): خطای چند درجه‌ای نقاط می‌تونه دسته رو عوض کنه
        border: Math.min(Math.abs(a - REF.fsaHeel), Math.abs(a - REF.fsaFore)) < 2, v: round1(Math.min(p[s.heel].v, p[s.toe].v, p[s.ank].v)) });
    });
    var n = steps.length, cnt = { heel: 0, mid: 0, fore: 0 };
    steps.forEach(function (x) { cnt[x.type]++; });
    // درصدها با جمع دقیق ۱۰۰ (بزرگ‌ترین باقی‌مانده)
    var pc = { heel: 0, mid: 0, fore: 0 };
    if (n) {
      var ks = ['heel', 'mid', 'fore'], left = 100;
      ks.forEach(function (k) { pc[k] = Math.floor(cnt[k] / n * 100); left -= pc[k]; });
      ks.slice().sort(function (a, b) { return (cnt[b] / n * 100 - pc[b]) - (cnt[a] / n * 100 - pc[a]); }).slice(0, left).forEach(function (k) { pc[k]++; });
    }
    var fsa = round1(median(steps.map(function (x) { return x.fsa; })));
    var type = n ? ['heel', 'mid', 'fore'].sort(function (a, b) { return cnt[b] - cnt[a]; })[0] : null;
    // تساوی تعداد: دسته‌ی میانه‌ی زاویه‌ها
    if (n && ['heel', 'mid', 'fore'].filter(function (k) { return cnt[k] === cnt[type]; }).length > 1) type = fsa > REF.fsaHeel ? 'heel' : fsa < REF.fsaFore ? 'fore' : 'mid';
    var footPx = Math.round(median([lenMed.l, lenMed.r]) * sc);
    return { fsa: fsa, type: type, vis: mean(steps.map(function (x) { return x.v; })), footPx: footPx,
      summary: { n: n, skipped: skipped, footPx: footPx, heel: pc.heel, mid: pc.mid, fore: pc.fore, border: steps.filter(function (x) { return x.border; }).length, steps: steps } };
  }

  // ---------- فیلم از کنار ----------
  function analyzeSide(video, heightCm, scale) {
    var D = prepare(video, scale), q = { frames: D.n, valid: validRate(D), fps: D.fps, scale: D.scale };
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
    var C2 = sideContacts(D, dir), A = C2.all;
    q.steps = A.length;
    // دو پا: گام‌ها یکی‌درمیون مال یک پان (زوج و فرد)، که به برچسب چپ و راست MediaPipe بستگی نداره؛ برچسب گاهی برای مدت طولانی
    // دنبال «پای جلویی» می‌ره نه پای واقعی. فقط اگه گامی جا افتاده باشه (فاصله‌ی نامنظم) از برچسب‌ها استفاده می‌شه.
    var gp = [];
    for (var a0 = 1; a0 < A.length; a0++) gp.push(A[a0].i - A[a0 - 1].i);
    var gm = median(gp), regular = gp.every(function (g) { return g >= 0.6 * gm && g <= 1.5 * gm; });
    var legVis = function (G0) { return mean(G0.map(function (x) { var p = D.raw[x.i], sd = SIDES[x.foot]; return p ? vis(p, [sd.hip, sd.knee, sd.ank]) : null; })); };
    var g0, g1;
    if (regular) { g0 = A.filter(function (x, k) { return k % 2 === 0; }); g1 = A.filter(function (x, k) { return k % 2 === 1; }); }
    else { g0 = A.filter(function (x) { return x.foot === nearK; }); g1 = A.filter(function (x) { return x.foot !== nearK; }); }
    if (regular && (legVis(g1) || 0) > (legVis(g0) || 0)) { var tg = g0; g0 = g1; g1 = tg; }
    var grp = function (G0) { return { ic: G0.map(function (x) { return x.i; }), legs: G0, stance: G0.filter(function (x) { return x.to != null; }).map(function (x) { return [x.i, x.to]; }) }; };
    var cN = grp(g0), cF = grp(g1);
    if (cN.ic.length < 2) return { ok: false, reason: 'fewSteps', quality: q };
    var m = {};
    // برخورد پای نزدیک (نقاط پایی که در اون لحظه فرود اومده)
    var kneeIc = [], shank = [], over = [];
    // لحظه‌ی برخورد از فریم خام (صاف کردن، فریم قبل از برخورد رو هم قاطی می‌کنه)
    cN.legs.forEach(function (x) {
      var p = D.raw[x.i] || D.pts[x.i], sd = SIDES[x.foot];
      if (!p) return;
      kneeIc.push(180 - angle3(p[sd.hip], p[sd.knee], p[sd.ank]));
      shank.push(Math.atan2((p[sd.ank].x - p[sd.knee].x) * dir, p[sd.ank].y - p[sd.knee].y) * DEG);
      over.push((p[sd.ank].x - p[sd.hip].x) * dir / L);
    });
    m.kneeIc = round1(median(kneeIc));
    m.shank = round1(median(shank));
    m.overstride = Math.round(median(over) * 100) / 100;
    // نوع فرود برای هر گام (هر دو پا، هر جا پاشنه و پنجه و مچ دیده می‌شن)
    var ST = strikes(D, C2);
    m.strikes = ST.summary; m.fsa = ST.fsa; m.strike = ST.type;
    // حداکثر خم شدن زانو در فاز تماس پای نزدیک
    var peak = cN.legs.filter(function (x) { return x.to != null; }).map(function (x) {
      var mx = null, sd = SIDES[x.foot];
      for (var f = x.i; f <= x.to; f++) { var p = D.pts[f]; if (p) { var a = 180 - angle3(p[sd.hip], p[sd.knee], p[sd.ank]); if (mx == null || a > mx) mx = a; } }
      return mx;
    });
    m.peakKnee = round1(median(peak));
    // آهنگ گام از برخوردهای هر دو پا، با زمان واقعی
    var all = A.map(function (x) { return x.i; });
    var cad = cadenceOf(D, all, C2.period);
    m.cadence = cad.cadence; m.steps = cad.steps; m.span = cad.span; m.timeScale = D.scale;
    if (cad.suggest) m.slowSuggest = cad.suggest;
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
    // سطح اطمینان هر عدد: دیده‌شدن مفاصل لازم، تعداد برخوردها، نرخ فریم و محدودیت ذاتی خود پارامتر
    var legIds = [near.hip, near.knee, near.ank, near.heel, near.toe];
    // دیده‌شدن پایی که در هر برخورد فرود اومده
    var landVis = function (G0) { return mean(G0.map(function (x) { var p = D.raw[x.i], sd = SIDES[x.foot]; return p ? vis(p, [sd.hip, sd.knee, sd.ank, sd.heel, sd.toe]) : null; })); };
    var icVis = landVis(cN.legs), nIC = cN.ic.length, fps = D.fps;
    var minFr = function (sec) { return Math.round(sec * fps); };
    var fv = landVis(cF.legs);
    // لحظه‌ی برخورد در فیلم کمتر از ۶۰ فریم تا ۱ فریم (۱۷ تا ۳۳ میلی‌ثانیه) جابه‌جا می‌شه → حداکثر «تخمینی»
    var icCap = fps >= 60 ? 'sure' : 'est';
    // زمان فیلم واقعی نیست (آهنگ گام خارج از بازه‌ی دویدن، مثلاً اسلوموشن بدون ضریب): هر عدد زمانی غیرقابل‌اطمینانه
    var timeOk = cad.valid;
    // برای نوع فرود، هر گام قابل‌خوندن (هر دو پا) یک نمونه‌ست؛ کمتر از ۳ گام = غیرقابل‌اطمینان
    var stN = m.strikes.n, stBorder = stN && m.strikes.border / stN > 0.5;
    // پای کوچیک در تصویر: خطای چندپیکسلی نقطه‌ها چند درجه خطای زاویه می‌ده (۳ پیکسل روی پای ۳۰ پیکسلی ≈ ۶°)،
    // در حالی که فاصله‌ی دسته‌ها کمتر از ۱۰ درجه‌ست → غیرقابل‌اطمینان
    var footSmall = ST.footPx != null && ST.footPx < FOOT_MIN_PX;
    if (footSmall) m.strikes.reason = 'footSmall';
    else if (stN < 3) m.strikes.reason = 'fewSteps';
    m.conf = {
      kneeIc: conf(icVis, nIC, 6, 3, icCap), overstride: conf(icVis, nIC, 6, 3, icCap),
      strike: footSmall ? 'low' : conf(ST.vis, stN, 6, 3, stBorder ? 'est' : icCap),
      // زاویه‌های حداکثری در MediaPipe خطای بیشتری دارن
      peakKnee: conf(visAt(D, legIds), nIC, 6, 3, 'est'),
      cadence: timeOk ? conf(visAt(D, [P.lHeel, P.rHeel, P.lToe, P.rToe], all), Math.max(all.length, cad.cycles || 0), 8, 4, cad.agree ? null : 'est') : 'low',
      // زمان تماس: دقت زمانی ±۱ فریم؛ زیر ۱۰۰ فریم در ثانیه حداکثر «تخمینی»، زیر ۲۵ غیرقابل‌اطمینان
      gct: fps < 25 || !timeOk ? 'low' : conf(icVis, nIC, 6, 3, fps >= 100 ? 'sure' : 'est'),
      // نوسان عمودی: به قد واردشده و ثابت بودن دوربین بستگی داره → حداکثر «تخمینی»
      vo: m.vo == null ? 'low' : conf(visAt(D, [P.lHip, P.rHip]), all.length, 8, 4, 'est'),
      // پای دور معمولاً کمتر دیده می‌شه؛ برای زمان برخوردش فقط جای پا لازمه، پس حد دیده‌شدنش پایین‌تره
      timing: cF.ic.length >= 3 && fv >= 0.5 ? conf(icVis, Math.min(nIC, cF.ic.length), 6, 3, 'est') : 'low',
      head: conf(visAt(D, [near.ear, near.sh, P.nose]), D.pts.filter(Boolean).length, minFr(2), minFr(0.7)),
      trunk: conf(visAt(D, [near.sh, near.hip]), D.pts.filter(Boolean).length, minFr(2), minFr(0.7)),
      elbow: conf(visAt(D, [near.sh, near.el, near.wr]), D.pts.filter(Boolean).length, minFr(2), minFr(0.7))
    };
    // فریم نمونه برای نمایش: برخورد پای نزدیک وسط فیلم
    var key = cN.ic[Math.floor(cN.ic.length / 2)];
    return { ok: true, view: 'side', near: nearK, dir: dir, metrics: m, quality: q, keyFrame: key, keyT: D.tv[key], ic: cN.ic };
  }

  // ---------- فیلم از پشت ----------
  function analyzeBack(video, scale) {
    var D = prepare(video, scale), q = { frames: D.n, valid: validRate(D), fps: D.fps, scale: D.scale };
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
      // پرونیشن عمداً سنجیده نمی‌شه: نقطه‌ی پاشنه‌ی MediaPipe معادل خط وسط پاشنه نیست و
      // پرونیشن در مطالعه‌ی آینده‌نگر (Nielsen 2014) با آسیب مرتبط نبود
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
    var msL = midStance(cL), msR = midStance(cR), nSt = Math.min(msL.length, msR.length), all = msL.concat(msR);
    var minFr = Math.round(2 * D.fps);
    // آهنگ گام از نمای پشت (برخوردهای هر دو پا)
    var ics = cL.ic.concat(cR.ic).sort(function (a, b) { return a - b; });
    var cad = cadenceOf(D, ics, stepPeriod(sepSignal(D, 'y')));
    m.cadence = cad.cadence; m.steps = cad.steps; m.span = cad.span; m.timeScale = D.scale;
    if (cad.suggest) m.slowSuggest = cad.suggest;
    // شیب جانبی تنه در وسط فاز تماس: خط وسط لگن تا وسط شونه نسبت به عمود (درجه، بدون جهت)
    m.trunkLat = round1(median(all.map(function (i) {
      var p = D.pts[i]; if (!p) return null;
      var hx = (p[P.lHip].x + p[P.rHip].x) / 2, hy = (p[P.lHip].y + p[P.rHip].y) / 2, sx = (p[P.lSh].x + p[P.rSh].x) / 2, sy = (p[P.lSh].y + p[P.rSh].y) / 2;
      return Math.abs(Math.atan2(sx - hx, hy - sy) * DEG);
    })));
    // تقارن تاب دست‌ها: دامنه‌ی بالا و پایین رفتن مچ دست هر سمت نسبت به شونه‌ی همون سمت
    var swingL = [], swingR = [];
    D.pts.forEach(function (p) { if (p) { swingL.push(p[P.lWr].y - p[P.lSh].y); swingR.push(p[P.rWr].y - p[P.rSh].y); } });
    var ampL = (pct(swingL, 0.95) || 0) - (pct(swingL, 0.05) || 0), ampR = (pct(swingR, 0.95) || 0) - (pct(swingR, 0.05) || 0);
    m.armSym = round1(symIndex(ampL, ampR));
    m.conf = {
      pelvic: conf(visAt(D, [P.lHip, P.rHip], all), nSt, 6, 3),
      valgus: conf(visAt(D, [P.lHip, P.rHip, P.lKnee, P.rKnee, P.lAnk, P.rAnk], all), nSt, 6, 3),
      crossover: conf(visAt(D, [P.lHip, P.rHip, P.lAnk, P.rAnk], all), nSt, 6, 3),
      armCross: conf(visAt(D, [P.lSh, P.rSh, P.lWr, P.rWr]), D.pts.filter(Boolean).length, minFr, Math.round(minFr / 3)),
      armSym: conf(visAt(D, [P.lSh, P.rSh, P.lWr, P.rWr]), D.pts.filter(Boolean).length, minFr, Math.round(minFr / 3), 'est'),
      trunkLat: conf(visAt(D, [P.lSh, P.rSh, P.lHip, P.rHip], all), nSt, 6, 3),
      cadence: cad.valid ? conf(visAt(D, [P.lHeel, P.rHeel, P.lToe, P.rToe], ics), ics.length, 8, 4, cad.agree ? null : 'est') : 'low',
      sides: conf(visAt(D, [P.lHip, P.rHip, P.lKnee, P.rKnee, P.lAnk, P.rAnk], all), nSt, 6, 3, 'est')
    };
    var key = midStance(cR)[0];
    return { ok: true, view: 'back', metrics: m, quality: q, keyFrame: key, keyT: D.tv[key] };
  }

  // ---------- قواعد: عدد → وضعیت ----------
  // وضعیت‌ها: good = در محدوده‌ی معمول، warn = کمی بیرون، bad = بیرون از محدوده‌ی معمول (فقط برای پارامترهایی که
  // بازه‌ی مرجع قابل دفاع دارن)؛ info = فقط توصیفی (بازه‌ی معتبر یا شواهد کافی نداره)؛ na = غیرقابل‌اطمینان (عدد داده نمی‌شه)
  function band(v, r) { return v == null ? null : v <= r.good ? 'good' : v <= r.warn ? 'warn' : 'bad'; }
  function range(v, r) { return v == null ? null : v >= r.lo && v <= r.hi ? 'good' : v >= r.warnLo && v <= r.warnHi ? 'warn' : 'bad'; }
  function worst(a, b) { var o = { good: 0, warn: 1, bad: 2 }; return a == null ? b : b == null ? a : o[a] >= o[b] ? a : b; }
  // شرایط دویدن روی برداشت از بعضی عددها اثر داره (کادنس، زمان تماس، شیب تنه، نوع فرود)
  // هر یافته مال یک نما (view) ـه و با شرایط دویدنِ همون فیلم سنجیده می‌شه
  function findings(side, back, cond, condBack) {
    var ok = function (c) { return CONDITIONS.indexOf(c) >= 0 ? c : 'easy'; };
    var cS = ok(cond), cB = ok(condBack || cond);
    var F = [], view = 'side';
    var add = function (id, area, status, value, c, extra) {
      if (!status) return;
      // غیرقابل‌اطمینان: یافته می‌مونه (تا کاربر بدونه سنجیده نشد) ولی بدون عدد و بدون وضعیت
      if (c === 'low') F.push({ id: id, view: view, area: area, status: 'na', value: null, conf: 'low', why: extra && extra.why || null });
      else F.push(Object.assign({ id: id, view: view, area: area, status: status, value: value, conf: c || 'est' }, extra || {}));
    };
    // آهنگ گام خارج از بازه‌ی دویدن = زمان فیلم واقعی نیست (اسلوموشن): بدون عدد، با دلیل
    var cadence = function (v, c, cond, mm) { if (v != null) add('cadence', 'cadence', v < REF.cadence[cond] ? 'warn' : 'info', v, c, { floor: REF.cadence[cond], cond: cond, why: v < CAD_OK.lo || v > CAD_OK.hi ? (mm.slowSuggest ? 'slow' : 'range') : null }); };
    if (side && side.ok) {
      var m = side.metrics, C = m.conf || {}, cond = cS;
      add('overstride', 'knee', worst(band(m.overstride, REF.overstride), band(m.shank, REF.shank)), m.overstride, C.overstride, { shank: m.shank });
      add('kneeIc', 'knee', range(m.kneeIc, REF.kneeIc), m.kneeIc, C.kneeIc, { form: m.kneeIc < REF.kneeIc.lo ? 'straight' : m.kneeIc > REF.kneeIc.hi ? 'bent' : 'ok' });
      cadence(m.cadence, C.cadence, cond, m);
      if (m.peakKnee != null) add('peakKnee', 'knee', 'info', m.peakKnee, C.peakKnee);
      var S0 = m.strikes;
      if (m.strike || C.strike) add('strike', 'foot', 'info', m.fsa, m.strike ? C.strike : 'low', { strike: m.strike, pct: S0 ? { heel: S0.heel, mid: S0.mid, fore: S0.fore } : null, n: S0 ? S0.n : null,
        why: S0 && S0.reason ? S0.reason : null, px: S0 ? S0.footPx : null });
      if (m.gctNear != null) add('gct', 'timing', 'info', m.gctNear, C.gct, { far: m.gctFar });
      if (m.vo != null || C.vo) add('vo', 'bounce', 'info', m.vo, m.vo == null ? 'low' : C.vo);
      add('trunk', 'trunk', 'info', m.trunk, C.trunk, { lean: m.trunk < REF.trunk.lo ? 'back' : m.trunk > REF.trunk.hi ? 'forward' : 'ok' });
      add('head', 'head', 'info', m.neck, C.head, { gaze: m.gaze, look: m.gaze > REF.gaze.hi ? 'down' : m.gaze < REF.gaze.lo ? 'up' : 'ahead' });
      add('elbow', 'arms', 'info', m.elbow, C.elbow, { bend: m.elbow > REF.elbow.hi ? 'straight' : m.elbow < REF.elbow.lo ? 'tight' : 'ok' });
      if (m.stepSym != null || m.gctSym != null) add('timing', 'symmetry', 'info', round1(Math.max(m.stepSym || 0, m.gctSym || 0)), C.timing);
    }
    if (back && back.ok) {
      view = 'back';
      var b = back.metrics, B = b.conf || {};
      cadence(b.cadence, B.cadence, cB, b);
      if (b.trunkLat != null) add('trunkLat', 'trunk', 'info', b.trunkLat, B.trunkLat);
      var pd = Math.max(b.pelvicL || 0, b.pelvicR || 0);
      add('pelvic', 'pelvis', band(pd, REF.pelvic), round1(pd), B.pelvic, { left: b.pelvicL, right: b.pelvicR });
      var vg = Math.max(b.valgusL || 0, b.valgusR || 0);
      add('valgus', 'kneeIn', band(vg, REF.valgus), round1(vg), B.valgus, { left: b.valgusL, right: b.valgusR });
      add('crossover', 'foot', b.crossover > REF.crossover ? 'warn' : 'good', b.crossover, B.crossover);
      add('armCross', 'arms', 'info', b.armCross, B.armCross);
      if (b.armSym != null) add('armSym', 'arms', 'info', b.armSym, B.armSym);
      add('sides', 'symmetry', 'info', round1(b.gctSym), B.sides, { pelvicSym: b.pelvicSym, valgusSym: b.valgusSym });
    }
    // ترتیب: بیرون از محدوده‌ی معمول → کمی بیرون → معمول → توصیفی → غیرقابل‌اطمینان؛ در هر گروه به ترتیب اهمیت
    var ORDER = ['pelvic', 'overstride', 'kneeIc', 'cadence', 'valgus', 'crossover', 'strike', 'peakKnee', 'gct', 'vo', 'trunk', 'trunkLat', 'timing', 'sides', 'armCross', 'armSym', 'elbow', 'head'];
    var S = { bad: 0, warn: 1, good: 2, info: 3, na: 4 };
    F.sort(function (a, b) { return S[a.status] - S[b.status] || ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });
    return F;
  }
  function judged(f) { return f.status === 'good' || f.status === 'warn' || f.status === 'bad'; }
  // ---------- محورهای گزارش ----------
  // کارایی: ترمز و بالا و پایین رفتن؛ فرم: الگوی حرکت مفاصل. امتیاز فقط از پارامترهایی که بازه‌ی مرجع دارن
  var AXIS = {
    performance: ['cadence', 'overstride', 'vo', 'gct', 'trunk', 'armCross', 'timing'],
    form: ['kneeIc', 'peakKnee', 'strike', 'pelvic', 'valgus', 'crossover', 'head', 'elbow', 'sides', 'trunkLat', 'armSym']
  };
  function axisScore(F, ids) {
    var f = F.filter(function (x) { return ids.indexOf(x.id) >= 0 && judged(x); });
    return f.length ? Math.round(f.reduce(function (s, x) { return s + (x.status === 'good' ? 1 : x.status === 'warn' ? 0.5 : 0); }, 0) / f.length * 100) : null;
  }
  // ---------- الگوهای مرتبط با آسیب ----------
  // هر ناحیه: پارامترهایی که در پژوهش‌ها با فشار بیشتر روی اون ناحیه مرتبط شدن. یک یافته‌ی تنها هیچ‌وقت کافی نیست:
  // ناحیه فقط وقتی «الگوی مرتبط» داره که حداقل ۲ عامل بیرون از محدوده‌ی معمول (و قابل‌اطمینان) دیده بشه.
  // وزن عامل: ۲ برای «بیرون از محدوده»، ۱ برای «کمی بیرون»؛ جمع ۴ یا ۳ عامل و بیشتر = «واضح». این پیش‌بینی آسیب نیست.
  var INJURIES = {
    runnersKnee: ['pelvic', 'overstride', 'kneeIc', 'valgus', 'cadence'],  // جلوی زانو: Bramah 2018، Heiderscheit 2011، Ceyssens 2019 (ادداکشن ران در زنان)
    itbs: ['pelvic', 'valgus', 'crossover'],                               // بیرون زانو (نوار ایلیوتیبیال): Bramah 2018، Noehren 2007، Meardon 2012
    shin: ['pelvic', 'overstride', 'cadence', 'crossover'],                // ساق: Bramah 2018 (MTSS)، Meardon 2014
    achilles: ['pelvic', 'overstride', 'kneeIc']                           // آشیل: Bramah 2018
  };
  function risks(F) {
    var by = {};
    var S = { good: 0, warn: 1, bad: 2 };
    // یک پارامتر از دو نما (مثلاً آهنگ گام): بیرون‌ترین حساب می‌شه
    F.forEach(function (f) { if (judged(f) && (!by[f.id] || S[f.status] > S[by[f.id].status])) by[f.id] = f; });
    var out = [];
    Object.keys(INJURIES).forEach(function (k) {
      var seen = INJURIES[k].filter(function (id) { return by[id]; });
      if (seen.length < 2) return; // برای قضاوت ترکیبی، حداقل دو پارامتر قابل‌اطمینان لازمه
      var factors = seen.filter(function (id) { return by[id].status !== 'good'; });
      var w = factors.reduce(function (s, id) { return s + (by[id].status === 'bad' ? 2 : 1); }, 0);
      var level = factors.length < 2 ? 'low' : w >= 4 || factors.length >= 3 ? 'high' : 'moderate';
      out.push({ id: k, level: level, weight: w, factors: factors, checked: seen.length, of: INJURIES[k].length });
    });
    var L = { high: 0, moderate: 1, low: 2 };
    out.sort(function (a, b) { return L[a.level] - L[b.level] || b.weight - a.weight; });
    return out;
  }
  // هر فیلم اول با زاویه‌ی خونه‌ای که کاربر انتخاب کرده سنجیده می‌شه؛ اگه زاویه‌ش اون نبود، با زاویه‌ی دیگه.
  // پس یک فیلم تنها (از کنار یا از پشت، در هر خونه) کافیه و جابه‌جا گذاشتن فیلم‌ها هم مشکلی نیست.
  function classify(v, h, pref, k) {
    var a = pref === 'back' ? analyzeBack(v, k) : analyzeSide(v, h, k);
    if (!a.ok && (a.reason === 'notSide' || a.reason === 'notBack')) {
      var b = pref === 'back' ? analyzeSide(v, h, k) : analyzeBack(v, k);
      if (b.ok) return b;
    }
    return a;
  }
  // input: { side, back: خروجی js/pose.js، heightCm، conditions: { side, back } شرایط دویدنِ هر فیلم (کلید = خونه‌ای که فیلم توش گذاشته شده)
  //   (یا condition برای هر دو)، load: { acute, chronic } کیلومتر در هفته،
  //   timeScale: { side, back } ضریب اسلوموشن هر فیلم (کلید = خونه؛ ۱ یا خالی = زمان واقعی) }
  function analyze(input) {
    var ts = input.timeScale || {};
    var A = input.side ? classify(input.side, input.heightCm, 'side', ts.side) : null;
    var B = input.back ? classify(input.back, input.heightCm, 'back', ts.back) : null;
    if (A) A.src = 'side';
    if (B) B.src = 'back';
    var side = null, back = null;
    // هر نتیجه‌ی موفق در جای زاویه‌ی واقعی خودش؛ دو فیلم با یک زاویه → اولی حساب می‌شه
    [A, B].forEach(function (r) {
      if (!r || !r.ok) return;
      if (r.view === 'side' && !side) side = r;
      else if (r.view === 'back' && !back) back = r;
      else r.dup = true;
    });
    // فیلم‌هایی که تحلیل نشدن با دلیلشون (برای نمایش به کاربر)
    var failed = [A, B].filter(function (r) { return r && (!r.ok || r.dup); }).map(function (r) {
      return { src: r.src, reason: r.dup ? 'sameView' : r.reason };
    });
    var okc = function (c) { return CONDITIONS.indexOf(c) >= 0 ? c : null; };
    var cs = input.conditions || {};
    // شرایط هر نما از فیلمی که اون نما رو داده (اگه فیلم «کنار» در واقع از پشت بود، برچسبش با خودش می‌ره)
    var conds = { side: side ? okc(cs[side.src]) || okc(input.condition) || 'easy' : null, back: back ? okc(cs[back.src]) || okc(input.condition) || 'easy' : null };
    var cond = conds.side || conds.back || 'easy';
    var F = findings(side, back, conds.side || cond, conds.back || cond);
    var R = risks(F);
    // بار تمرینی فقط «زمینه»ست (شواهد نسبت بار حاد به مزمن خودش محل بحثه) و سطح الگوها رو عوض نمی‌کنه
    var ld = input.load, load = ld && ld.chronic > 0 ? { acute: ld.acute, chronic: ld.chronic, ratio: Math.round(ld.acute / ld.chronic * 100) / 100 } : null;
    if (load) load.high = load.ratio >= 1.5;
    var J = F.filter(judged);
    return { side: side, back: back, failed: failed, findings: F, risks: R, condition: cond, conditions: conds, load: load,
      axes: { performance: axisScore(F, AXIS.performance), form: axisScore(F, AXIS.form),
        risk: R.length ? R[0].level : null },
      score: J.length ? Math.round(J.reduce(function (s, f) { return s + (f.status === 'good' ? 1 : f.status === 'warn' ? 0.5 : 0); }, 0) / J.length * 100) : null };
  }

  var api = { analyze: analyze, cadenceOf: cadenceOf, CAD_OK: CAD_OK, analyzeSide: analyzeSide, analyzeBack: analyzeBack, findings: findings, risks: risks, axisScore: axisScore, judged: judged,
    AXIS: AXIS, INJURIES: INJURIES, REF: REF, CONDITIONS: CONDITIONS, P: P, angle3: angle3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachGait = api;
})(this);
