/*
 * تحلیل بیومکانیک دویدن از روی نقاط کلیدی بدن (خروجی خام MediaPipe Pose)؛ کاملاً محلی و بدون هیچ سرویس بیرونی.
 * ورودی هر فیلم: { w, h, input: { w, h } اندازه‌ی تصویر داده‌شده به MediaPipe، frames: [{ t: ثانیه, lm: [[x, y, visibility, z?] × ۳۳] (نرمال‌شده ۰ تا ۱) یا null }] }
 * خروجی: عددها (زاویه‌ها، آهنگ گام، ...) برای هر سمت بدن جدا (bi: { پارامتر: { l, r } } با عدد، اطمینان، تعداد گام، انحراف معیار و دلیل)،
 * و یافته‌ها با وضعیت good / warn / bad / info / na؛ متن‌ها در دیکشنری‌ها (gait.*). حدهای انتشار هر عدد در PUBLISH.
 * One Euro filter: Casiez 2012 (CHI).
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
  var P = { nose: 0, lEye: 2, rEye: 5, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24,
    lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28, lHeel: 29, rHeel: 30, lToe: 31, rToe: 32 };
  var SIDES = { l: { sh: P.lSh, el: P.lEl, wr: P.lWr, hip: P.lHip, knee: P.lKnee, ank: P.lAnk, heel: P.lHeel, toe: P.lToe, ear: P.lEar, eye: P.lEye },
    r: { sh: P.rSh, el: P.rEl, wr: P.rWr, hip: P.rHip, knee: P.rKnee, ank: P.rAnk, heel: P.rHeel, toe: P.rToe, ear: P.rEar, eye: P.rEye } };
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
    crossover: 30,                                     // درصد برخوردهایی که پا از خط وسط بدن رد می‌شه (تخمین)
    // ۹ فاکتور گزارش (js/gait.js factors): بازه‌هایی که از مقاله‌ی مشخصی نیومدن «تخمین»ـن
    ankleDf: { lo: 15, hi: 30, warnLo: 8, warnHi: 38 }, // بیشترین خم مچ پا به بالا در فاز تماس (زاویه‌ی ساق و پا؛ تخمین، شاخص غیرمستقیم کشش آشیل)
    rearfoot: { good: 8, warn: 13 },                   // چرخش پاشنه به بیرون نسبت به ساق از پشت (درجه؛ تخمین)
    armCross: { good: 15, warn: 35 }                   // درصد زمانی که مچ دست از خط وسط بدن رد می‌شه (تخمین)
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

  // فیلتر One Euro (Casiez 2012) برای یک سری عددی: لرزش در حرکت آهسته کم می‌شه و در حرکت سریع (مثل پا در فاز پرواز) تأخیر کم می‌مونه
  // rate: نمونه در ثانیه (زمان واقعی)، minCut: فرکانس قطع پایه (هرتز)، beta: حساسیت به سرعت (واحد سری بر ثانیه)
  function oneEuro(y, rate, minCut, beta) {
    var out = new Array(y.length), xp = null, dxp = 0;
    var alpha = function (fc) { var tau = 1 / (2 * Math.PI * fc), te = 1 / rate; return 1 / (1 + tau / te); };
    for (var i = 0; i < y.length; i++) {
      if (y[i] == null) { out[i] = null; xp = null; dxp = 0; continue; }
      if (xp == null) { xp = y[i]; out[i] = xp; continue; }
      var dx = (y[i] - xp) * rate, ad = alpha(1);
      dxp = ad * dx + (1 - ad) * dxp;
      var a = alpha(minCut + beta * Math.abs(dxp));
      xp = a * y[i] + (1 - a) * xp;
      out[i] = xp;
    }
    return out;
  }
  // فریم‌ها به پیکسل:
  //  raw: نقاط خام، فقط با اصلاح «پرش» (نقطه‌ای که در یک یا دو فریم بیش از ربع طول پا از همسایه‌هاش دور می‌شه، با میانه‌ی همسایه‌ها جایگزین می‌شه)
  //  pts: همون نقاط با فیلتر One Euro (برای زاویه‌های پیوسته)؛ jump[i]: مفاصلی که در فریم i پرش داشتن
  // scale: ضریب اسلوموشن (۸ = هر ثانیه‌ی فیلم یک‌هشتم ثانیه‌ی واقعیه)؛ همه‌ی زمان‌های تحلیل به ثانیه‌ی واقعی
  // عدد چهارم هر نقطه (اگه باشه): عمق تخمینی MediaPipe (منفی = نزدیک‌تر به دوربین)، هم‌مقیاس x
  function prepare(video, scale) {
    scale = scale > 0 ? scale : 1;
    var W = video.w || 1, H = video.h || 1, F = video.frames || [];
    var raw = F.map(function (f) {
      if (!f || !f.lm) return null;
      return f.lm.map(function (p) { return { x: p[0] * W, y: p[1] * H, v: p[2] == null ? 1 : p[2], z: p[3] == null ? null : p[3] * W }; });
    });
    var n = raw.length;
    var dt = (F.length > 1 ? (F[F.length - 1].t - F[0].t) / (F.length - 1) : 1 / 30) / scale;
    // طول پا برای مقیاس آستانه‌ها
    var Ls = raw.map(function (p) { return p ? (dist(p[P.lHip], p[P.lKnee]) + dist(p[P.lKnee], p[P.lAnk]) + dist(p[P.rHip], p[P.rKnee]) + dist(p[P.rKnee], p[P.rAnk])) / 2 : null; });
    var Lg = median(Ls) || Math.max(W, H) / 4;
    var jump = raw.map(function () { return null; }), clean = raw.map(function (p) { return p ? p.map(function (q) { return { x: q.x, y: q.y, v: q.v, z: q.z }; }) : null; });
    for (var i = 0; i < n; i++) {
      if (!raw[i]) continue;
      for (var k = 0; k < 33; k++) {
        var xs = [], ys = [];
        for (var j = i - 2; j <= i + 2; j++) if (j !== i && raw[j]) { xs.push(raw[j][k].x); ys.push(raw[j][k].y); }
        if (xs.length < 3) continue;
        var mx = median(xs), my = median(ys);
        if (Math.hypot(raw[i][k].x - mx, raw[i][k].y - my) > 0.25 * Lg) { clean[i][k].x = mx; clean[i][k].y = my; (jump[i] = jump[i] || []).push(k); }
      }
    }
    // One Euro روی مختصات نسبت به طول پا (پارامترها برای دویدن: فرکانس قطع پایه‌ی ۷ هرتز تا نوسان لگن و افت لگن کم‌دامنه نشن)
    var rate = 1 / dt, pts = clean.map(function (p) { return p ? p.map(function (q) { return { x: q.x, y: q.y, v: q.v, z: q.z }; }) : null; });
    for (var k2 = 0; k2 < 33; k2++) {
      ['x', 'y'].forEach(function (ax) {
        var y = oneEuro(clean.map(function (p) { return p ? p[k2][ax] / Lg : null; }), rate, 7, 2);
        for (var i2 = 0; i2 < n; i2++) if (pts[i2]) pts[i2][k2][ax] = y[i2] * Lg;
      });
    }
    // نرخ فریم مؤثر (در زمان واقعی): نمونه‌برداری، ولی نه بیشتر از نرخ فریم خود فیلم (فریم‌های تکراری دقت زمانی نمی‌دن)
    var fps = Math.round(Math.min(1 / dt, (video.fps || Infinity) * scale));
    // اندازه‌ی تصویری که به MediaPipe داده شده (برای اندازه‌ی پا به پیکسل)؛ گزارش‌های قبلی: حداکثر ۹۶۰
    var inp = video.input && video.input.w ? video.input : { w: W * Math.min(1, 960 / Math.max(W, H)), h: H * Math.min(1, 960 / Math.max(W, H)) };
    // t: زمان واقعی؛ tv: زمان خود فیلم (برای پیدا کردن فریم در ویدیو)
    return { pts: pts, raw: clean, jump: jump, t: F.map(function (f) { return f ? f.t / scale : null; }), tv: F.map(function (f) { return f ? f.t : null; }),
      dt: dt, fps: fps, scale: scale, w: W, h: H, n: n, L: Lg, inScale: inp.w / W, hasZ: raw.some(function (p) { return p && p[P.lHip].z != null && p[P.lHip].z !== 0; }) };
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
    if (pct(y, 0.92) == null) return { ic: [], stance: [] };
    // خط زمین محلی (حدود یک ثانیه‌ی واقعی دور هر فریم) و طول پای محلی: دونده‌ای که از دوربین دور یا بهش نزدیک می‌شه در تصویر
    // بالا یا پایین می‌ره و کوچیک یا بزرگ می‌شه؛ با یک خط زمین برای کل فیلم، بیشتر برخوردها زیر آستانه نمی‌رسیدن
    var half = Math.max(8, Math.round(0.5 / (D.dt || 1 / 30)));
    var Lf = D.pts.map(function (p) { return p ? (dist(p[s.hip], p[s.knee]) + dist(p[s.knee], p[s.ank])) : null; });
    var on = y.map(function (v, i) {
      if (v == null) return false;
      var a = Math.max(0, i - half), b = Math.min(y.length, i + half + 1);
      var g = pct(y.slice(a, b), 0.92), Li = median(Lf.slice(a, b)) || L;
      return g != null && v >= g - 0.06 * Li;
    });
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
    // دو پای متفاوت (عدم تقارن): خودهمبستگی ممکنه یک چرخه‌ی کامل (دو گام) رو بگیره؛ با فاصله‌ی قله‌ها کنترل می‌شه
    var gm0 = median(gap);
    if (per && gm0 && per.lag / gm0 > 1.7 && per.lag / gm0 < 2.3) per = { lag: per.lag / 2, r: per.r, stride: true };
    var T = per ? per.lag : gm0 || 8, w = Math.max(2, Math.round(0.25 * T));
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
      var a = Math.max(0, pk - Math.max(2, Math.round(0.3 * T))), b = Math.min(n - 1, pk + Math.max(2, Math.round(0.4 * T))), ic = pk;
      // لحظه‌ی برخورد = اولین فریمی که پایین‌ترین نقطه‌ی پای جلویی به «خط زمین» می‌رسه. خط زمین = پایین‌ترین نقطه‌ی پاها در همین
      // گام (صدک ۹۰ در فریم‌های اطراف، y مطلق تصویر). چند صدم ثانیه‌ی دور برخورد، حرکت عمودی دوربین ناچیزه؛ برخلاف روش‌های
      // نسبت به لگن، بالا و پایین رفتن خود لگن در فاز تماس اینجا اثری نداره.
      var lowAbs = function (i, any) {
        var p = D.raw[i]; if (!p) return null;
        var yl = Math.max(p[P.lHeel].y, p[P.lToe].y), yr = Math.max(p[P.rHeel].y, p[P.rToe].y);
        return any ? Math.max(yl, yr) : (fr(i) === 'l' ? yl : yr);
      };
      var gw = []; for (var g0 = a; g0 <= Math.min(n - 1, pk + Math.round(0.5 * T)); g0++) gw.push(lowAbs(g0, true));
      var gY = pct(gw, 0.9), tol = 0.04 * (Lloc[pk] || D.L);
      if (gY != null) for (var i4 = a; i4 <= b; i4++) { var y4 = lowAbs(i4); if (y4 != null && y4 >= gY - tol) { ic = i4; break; } }
      // داخل این نوار، لحظه‌ی دقیق: اولین فریمی که پا در ۲۰ میلی‌ثانیه‌ی بعد (زمان واقعی) دیگه پایین‌تر نمی‌ره (کمتر از ۲٪ طول پا، بیشتر از لرزش نقاط)
      if (gY != null && ic !== pk) {
        var kf = Math.max(1, Math.round(0.02 / D.dt)), Lk = Lloc[ic] || D.L;
        for (var i5 = ic; i5 <= Math.min(b, ic + Math.round(0.15 * T)); i5++) {
          var ya = lowAbs(i5), yb = lowAbs(Math.min(n - 1, i5 + kf));
          if (ya != null && yb != null && yb - ya <= 0.02 * Lk) { ic = i5; break; }
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
        // این قله ممکنه یک چرخه‌ی کامل (دو گام) باشه، اگه قله‌ی گام ضعیف‌تر از حد بوده (نقاط پرنوسان، یا دو پای متفاوت):
        // وسط این فاصله هم قله‌ی مثبت داره (گام‌های چپ و راست شبیه هم‌ان). در فیلم درست یا اسلوموشن، نصف یک گام
        // همبستگی منفی داره، پس این بررسی آهنگ واقعی رو نصف یا دوبرابر نمی‌کنه.
        var h0 = Math.round(k / 2), hb = -1;
        for (var j = Math.max(2, h0 - 2); j <= h0 + 2 && j < ac.length - 1; j++) {
          if (ac[j] != null && ac[j - 1] != null && ac[j + 1] != null && ac[j] >= ac[j - 1] && ac[j] >= ac[j + 1] && ac[j] >= 0.25 && (hb < 0 || ac[j] > ac[hb])) hb = j;
        }
        var q = hb > 0 ? hb : k;
        var den = ac[q - 1] - 2 * ac[q] + ac[q + 1], off = den ? 0.5 * (ac[q - 1] - ac[q + 1]) / den : 0;
        var res = { lag: q + Math.max(-0.5, Math.min(0.5, off)), r: Math.round(ac[q] * 100) / 100 };
        if (hb > 0) res.fromStride = true;
        return res;
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
    // فقط از فاصله‌ی برخوردها (بدون خودهمبستگی) و دوبرابر بازه‌ی ممکن: احتمالاً هر گام دو بار شمرده شده (نقاط پرنوسان پا)؛
    // نصفش در بازه باشه → همون، با حداکثر اطمینان «تخمینی» (فیلم تندشده‌ی دویدن خیلی نادره)
    if (out.method === 'ic' && exact > CAD_OK.hi && exact / 2 >= CAD_OK.lo && exact / 2 <= CAD_OK.hi) { exact /= 2; out.method = 'ic-half'; out.fromIc = Math.round(exact); }
    out.cadence = Math.round(exact);
    // دو روش با هم نمی‌خونن (بیش از ۱۵٪ اختلاف) → حداکثر «تخمینی»
    out.agree = out.method !== 'ic-half' && (out.fromIc == null || Math.abs(out.fromIc - out.cadence) / out.cadence <= 0.15);
    out.valid = out.cadence >= CAD_OK.lo && out.cadence <= CAD_OK.hi;
    // زمان فیلم واقعی فرض شده ولی عدد غیرممکنه: ضریب اسلوموشنی که عدد رو به بازه‌ی دویدن (۱۴۰ تا ۲۱۰) می‌بره؛
    // ضریب‌ها دوبرابر هم‌ان و این بازه کمتر از دوبرابره، پس حداکثر یک ضریب جواب می‌ده
    if (!out.valid && D.scale === 1) {
      var k = SLOW.filter(function (x) { return exact * x >= 140 && exact * x <= 210; })[0];
      if (k) out.suggest = { k: k, cadence: Math.round(exact * k) };
    }
    return out;
  }

  // ---------- انتشار عدد: هر پارامتر، هر سمت بدن ----------
  // عدد هر پارامتر از «گام‌های قابل‌قبول» (یا چرخه‌های گام) به دست میاد و فقط وقتی منتشر می‌شه که از این حدها رد بشه؛ قابل تنظیم:
  //  est / sure: حداقل تعداد گام برای «تخمینی» / «مطمئن»
  //  sdEst / sdSure: حداکثر پراکندگی بین گام‌ها (انحراف معیار، بعد از حذف گام‌های دورافتاده) — پراکندگی زیاد یعنی خطای نقاط، نه تفاوت واقعی گام‌ها
  //  floor: کمترین انحراف مقاوم برای حذف دورافتاده‌ها (تا گام‌های تقریباً یکسان بی‌دلیل حذف نشن)
  //  cap: بالاترین سطح ممکن برای این پارامتر (محدودیت ذاتی روش)
  var PUBLISH = {
    vis: { est: 0.6, sure: 0.8 },
    kneeIc: { est: 3, sure: 6, sdEst: 8, sdSure: 5, floor: 2 },
    overstride: { est: 3, sure: 6, sdEst: 0.08, sdSure: 0.05, floor: 0.02 },
    shank: { est: 3, sure: 6, sdEst: 6, sdSure: 4, floor: 1.5 },
    peakKnee: { est: 3, sure: 6, sdEst: 8, sdSure: 5, floor: 2, cap: 'est' },
    strike: { est: 3, sure: 6, footEst: 40, footSure: 70 },
    gct: { est: 3, sure: 6, sdEst: 50, sdSure: 25, floor: 8 },
    elbow: { est: 3, sure: 6, sdEst: 15, sdSure: 8, floor: 3 },
    head: { est: 3, sure: 6, sdEst: 8, sdSure: 5, floor: 2 },
    trunk: { est: 3, sure: 6, sdEst: 5, sdSure: 3, floor: 1 },
    cadence: { est: 4, sure: 8 },
    pelvic: { est: 3, sure: 6, sdEst: 4, sdSure: 2.5, floor: 1 },
    valgus: { est: 3, sure: 6, sdEst: 7, sdSure: 4, floor: 1.5 },
    // همیشه حداکثر «تخمینی»: از ویدیوی دوبعدی فقط شاخص غیرمستقیم‌ان
    ankleDf: { est: 3, sure: 6, sdEst: 8, sdSure: 5, floor: 2, cap: 'est' },
    rearfoot: { est: 3, sure: 6, sdEst: 8, sdSure: 5, floor: 2, cap: 'est' },
    gaze: { est: 3, sure: 6, sdEst: 10, sdSure: 6, floor: 2, cap: 'est' },
    armCross: { est: 3, sure: 6, sdEst: 35, sdSure: 20, floor: 5 },
    // قبول هر گام: نسبت پهنای شونه به تنه در لحظه‌ی برخورد (دوربین عمود بر مسیر)، اختلاف طول پا با میانه
    stepView: 0.5, stepLeg: 0.18
  };
  function stdev(a) { var m = mean(a); return a.length < 2 ? null : Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)); }
  function finite(a) { return a.filter(function (x) { return x != null && isFinite(x); }); }
  // حذف گام‌های دورافتاده: بیش از ۳ برابر انحراف مقاوم (MAD × ۱٫۴۸۲۶) از میانه
  function dropOutliers(a, floor) {
    var v = finite(a);
    if (v.length < 4) return v;
    var m = median(v), s = Math.max(1.4826 * median(v.map(function (x) { return Math.abs(x - m); })), floor || 0);
    return s ? v.filter(function (x) { return Math.abs(x - m) <= 3 * s; }) : v;
  }
  function minConf(a, b) { return !b ? a : !a ? b : CONF[a] <= CONF[b] ? a : b; }
  // vals: مقدار هر گام؛ visv: میانگین دیده‌شدن مفاصل لازم؛ o: { cap, why (اجبار به غیرقابل‌اطمینان با این دلیل)، dec }
  function publish(id, vals, visv, o) {
    o = o || {};
    var R0 = PUBLISH[id], v = dropOutliers(vals, R0.floor), n = v.length, sd = stdev(v), val = median(v), c, why = null;
    if (o.why) { c = 'low'; why = o.why; }
    else if (val == null || n < R0.est) { c = 'low'; why = 'fewSteps'; }
    else if (visv != null && visv < PUBLISH.vis.est) { c = 'low'; why = 'unseen'; }
    else if (R0.sdEst != null && sd != null && sd > R0.sdEst) { c = 'low'; why = 'spread'; }
    else c = n >= R0.sure && (visv == null || visv >= PUBLISH.vis.sure) && (R0.sdSure == null || sd == null || sd <= R0.sdSure) ? 'sure' : 'est';
    c = minConf(minConf(c, R0.cap), o.cap);
    if (c === 'low' && !why) why = o.capWhy || 'fewSteps';
    var d = o.dec == null ? 1 : o.dec, r = function (x) { return x == null ? null : Math.round(x * Math.pow(10, d)) / Math.pow(10, d); };
    return { v: r(val), conf: c, why: why, n: n, sd: r(sd) };
  }

  // ---------- نوع فرود پا ----------
  // زاویه‌ی پا (خط پاشنه تا پنجه نسبت به افق؛ مثبت = پنجه بالاتر) در لحظه‌ی برخورد، منهای زاویه‌ی همون پا وقتی وسط فاز تماس صاف روی زمینه
  // (معادل کالیبراسیون ایستاده در Altman & Davis 2012؛ نقطه‌های پاشنه و پنجه‌ی MediaPipe دقیقاً روی کف کفش نیستن).
  // پای روی زمین وسط فاز تماس از هندسه پیدا می‌شه (پایی که پایین‌تره)، نه از برچسب چپ و راست MediaPipe.
  // خم مچ پا به بالا (درجه): ۹۰ − زاویه‌ی بین بردار مچ→زانو و پاشنه→پنجه؛ مثبت = ساق جلوتر از عمود بر پا
  function ankleDf(p, s) {
    var ux = p[s.knee].x - p[s.ank].x, uy = p[s.knee].y - p[s.ank].y, fx = p[s.toe].x - p[s.heel].x, fy = p[s.toe].y - p[s.heel].y;
    var d = Math.hypot(ux, uy) * Math.hypot(fx, fy);
    return d ? 90 - Math.acos(Math.max(-1, Math.min(1, (ux * fx + uy * fy) / d))) * DEG : null;
  }
  function footAngle(p, s) { return Math.atan2(p[s.heel].y - p[s.toe].y, Math.abs(p[s.toe].x - p[s.heel].x)) * DEG; }
  function footLen(p, s) { return dist(p[s.heel], p[s.toe]); }
  function lowerTrack(p) { return Math.max(p[P.lHeel].y, p[P.lToe].y) >= Math.max(p[P.rHeel].y, p[P.rToe].y) ? 'l' : 'r'; }
  function stanceFlat(D, x) {
    if (x.to == null) return null;
    var len = x.to - x.i, a = [];
    for (var f = x.i + Math.round(0.25 * len); f <= x.i + Math.round(0.5 * len); f++) { var p = D.raw[f]; if (p) a.push(footAngle(p, SIDES[lowerTrack(p)])); }
    return median(a);
  }
  function strikeType(a) { return a > REF.fsaHeel ? 'heel' : a < REF.fsaFore ? 'fore' : 'mid'; }
  function strikeSummary(steps) {
    var n = steps.length, cnt = { heel: 0, mid: 0, fore: 0 }, pc = { heel: 0, mid: 0, fore: 0 };
    steps.forEach(function (x) { cnt[x.type]++; });
    // درصدها با جمع دقیق ۱۰۰ (بزرگ‌ترین باقی‌مانده)
    if (n) {
      var ks = ['heel', 'mid', 'fore'], left = 100;
      ks.forEach(function (k) { pc[k] = Math.floor(cnt[k] / n * 100); left -= pc[k]; });
      ks.slice().sort(function (a, b) { return (cnt[b] / n * 100 - pc[b]) - (cnt[a] / n * 100 - pc[a]); }).slice(0, left).forEach(function (k) { pc[k]++; });
    }
    var fsa = round1(median(steps.map(function (x) { return x.fsa; })));
    var type = n ? ['heel', 'mid', 'fore'].sort(function (a, b) { return cnt[b] - cnt[a]; })[0] : null;
    // تساوی تعداد: دسته‌ی میانه‌ی زاویه‌ها
    if (n && ['heel', 'mid', 'fore'].filter(function (k) { return cnt[k] === cnt[type]; }).length > 1) type = strikeType(fsa);
    return { n: n, fsa: fsa, type: type, heel: pc.heel, mid: pc.mid, fore: pc.fore, border: steps.filter(function (x) { return x.border; }).length };
  }

  // ---------- فیلم از کنار ----------
  // هر گام: پای فرودآمده از هندسه (پای جلویی در لحظه‌ی برخورد)، و سمت آناتومیک (چپ یا راست) از یکی‌درمیون بودن گام‌ها،
  // نه از برچسب MediaPipe (که در نمای کنار معمولاً دنبال «پای جلویی» می‌ره). کدوم گروه از گام‌ها پای نزدیک به دوربینه:
  // عمق تخمینی (z)، طول پا در تصویر (پای نزدیک کمی بزرگ‌تره) و دیده‌شدن، با هم.
  // سمت نزدیک آناتومیک: دونده‌ای که در تصویر به راست می‌دوه سمت راست بدنش رو به دوربینه (و برعکس)؛ اگه دیده‌شدن بالاتنه
  // واضحاً خلافش رو بگه (فیلم آینه‌ای دوربین جلو)، دیده‌شدن ملاکه.
  function analyzeSide(video, heightCm, scale) {
    var D = prepare(video, scale), q = { frames: D.n, valid: validRate(D), fps: D.fps, scale: D.scale, realSec: round1(D.n * D.dt) };
    if (q.valid < 0.5) return { ok: false, reason: 'noPerson', quality: q };
    var view = viewRatio(D);
    if (view != null && view > 0.55) return { ok: false, reason: 'notSide', quality: q };
    var dir = median(D.pts.map(function (p) { return p ? (p[P.lToe].x - p[P.lHeel].x) + (p[P.rToe].x - p[P.rHeel].x) : null; })) >= 0 ? 1 : -1;
    var visUp = function (k) { var s = SIDES[k]; return mean(D.raw.map(function (p) { return p ? vis(p, [s.sh, s.el, s.wr, s.ear]) : null; })); };
    var vuL = visUp('l'), vuR = visUp('r');
    var nearK = Math.abs(vuL - vuR) > 0.15 ? (vuR > vuL ? 'r' : 'l') : (dir > 0 ? 'r' : 'l'), farK = nearK === 'l' ? 'r' : 'l', near = SIDES[nearK];
    var L = D.L;
    if (!L) return { ok: false, reason: 'noPerson', quality: q };
    var C2 = sideContacts(D, dir), A = C2.all;
    q.steps = A.length;
    if (A.length < 2) return { ok: false, reason: 'fewSteps', quality: q };
    var gp = [];
    for (var a0 = 1; a0 < A.length; a0++) gp.push(A[a0].i - A[a0 - 1].i);
    var T = C2.period ? C2.period.lag : median(gp);
    // ۱. یکی‌درمیون: شماره‌ی هر گام از فاصله تا گام قبلی ÷ زمان یک گام (گام جاافتاده = فاصله‌ی دوبرابر)؛ فاصله‌ی نامعلوم = شروع بخش تازه
    var seg = 0, slot = 0;
    A.forEach(function (x, k) {
      if (k) {
        var g = (x.i - A[k - 1].i) / T, r = Math.round(g);
        if (!r || Math.abs(g - r) > 0.3) { seg++; slot = 0; } else slot += r;
      }
      x.seg = seg; x.par = slot % 2;
      // پای جلویی در لحظه‌ی برخورد (برچسب همون مجموعه‌ی نقاط، نه سمت بدن)
      var p = D.raw[x.i];
      x.tr = p ? ((p[P.lHeel].x - p[P.rHeel].x) * dir >= 0 ? 'l' : 'r') : null;
    });
    // ۲. قبول هر گام: دوربین عمود بر مسیر، بدون پرش نقطه، طول پای فرودآمده نزدیک معمول
    var legOf = function (p, s) { return dist(p[s.hip], p[s.knee]) + dist(p[s.knee], p[s.ank]); };
    var dropped = { angle: 0, jump: 0, leg: 0 };
    A.forEach(function (x) {
      var p = D.raw[x.i];
      if (!p || !x.tr) { x.bad = 'jump'; return; }
      var s = SIDES[x.tr];
      // زاویه‌ی دوربین: میانه‌ی یک چرخه‌ی کامل (دو گام) دور برخورد، چون پهنای ظاهری شونه با چرخش طبیعی تنه در هر گام عوض می‌شه
      var vrs = [];
      for (var f0 = Math.max(0, x.i - Math.round(T)); f0 <= Math.min(D.n - 1, x.i + Math.round(T)); f0++) {
        var q2 = D.pts[f0]; if (!q2) continue;
        var trl = dist({ x: (q2[P.lSh].x + q2[P.rSh].x) / 2, y: (q2[P.lSh].y + q2[P.rSh].y) / 2 }, { x: (q2[P.lHip].x + q2[P.rHip].x) / 2, y: (q2[P.lHip].y + q2[P.rHip].y) / 2 });
        if (trl) vrs.push(Math.abs(q2[P.lSh].x - q2[P.rSh].x) / trl);
      }
      var vr = median(vrs);
      // پرش نقطه‌های لگن، زانو یا مچ همون پا = گام کنار می‌ره؛ پرش پاشنه یا پنجه فقط نوع فرود همون گام رو حذف می‌کنه
      var jumpIn = function (ks) { return [x.i - 1, x.i, x.i + 1].some(function (i) { return D.jump[i] && D.jump[i].some(function (k) { return ks.indexOf(k) >= 0; }); }); };
      var js = jumpIn([s.hip, s.knee, s.ank]);
      x.footJump = jumpIn([s.heel, s.toe]);
      // طول پای فرودآمده نسبت به اندازه‌ی محلی دونده (دونده ممکنه به دوربین نزدیک یا ازش دور بشه)
      x.lr = legOf(p, s) / (median(D.raw.slice(Math.max(0, x.i - Math.round(T)), x.i + Math.round(T) + 1).map(function (q4) { return q4 ? (legOf(q4, SIDES.l) + legOf(q4, SIDES.r)) / 2 : null; })) || L);
      if (vr != null && vr > PUBLISH.stepView) x.bad = 'angle';
      else if (js) x.bad = 'jump';
      // دست سمت نزدیک در لحظه‌ی برخورد (هم‌زمانی مخالف دست و پا در دویدن: وقتی پای راست فرود میاد، دست راست عقبه).
      // برچسب دست‌ها برخلاف پاها قابل‌اعتماده (صورت و بالاتنه جهت بدن رو مشخص می‌کنن). مثبت = دست نزدیک جلوتر از شونه
      var q3 = D.pts[x.i] || p;
      x.arm = (((q3[near.el].x + q3[near.wr].x) / 2) - q3[near.sh].x) * dir / L;
    });
    // طول پای فرودآمده دور از میانه‌ی همه‌ی برخوردها = نقطه‌ی جابه‌جاشده (پای فرودآمده معمولاً بازه، پس با میانه‌ی خودش مقایسه می‌شه)
    var lrMed = median(A.map(function (x) { return x.lr; }));
    A.forEach(function (x) { if (!x.bad && x.lr != null && lrMed && Math.abs(x.lr / lrMed - 1) > PUBLISH.stepLeg) x.bad = 'leg'; if (x.bad) dropped[x.bad]++; });
    // ۳. در هر بخش، گروه زوج یا فردی که دست نزدیکش موقع فرود عقب‌تره = پای نزدیک.
    // (عمق تخمینی MediaPipe و طول پا در تصویر هم بررسی شدن ولی در فیلم واقعی فقط دنبال برچسب خود MediaPipe می‌رفتن؛ استفاده نمی‌شن.)
    // اختلاف کمتر از ۰٫۰۸ طول پا بین دو گروه = سمت گام‌ها نامعلوم → عددهای پا بدون سمت منتشر نمی‌شن
    var unsure = false;
    for (var sg = 0; sg <= seg; sg++) {
      var arm = [0, 1].map(function (par) { return mean(A.filter(function (x) { return x.seg === sg && x.par === par; }).map(function (x) { return x.arm; })); });
      var nearPar = (arm[0] == null ? 0 : arm[0]) <= (arm[1] == null ? 0 : arm[1]) ? 0 : 1;
      if (arm[0] == null || arm[1] == null || Math.abs(arm[0] - arm[1]) < 0.08) unsure = true;
      A.forEach(function (x) { if (x.seg === sg) x.side = x.par === nearPar ? nearK : farK; });
    }
    var good = A.filter(function (x) { return !x.bad; });
    q.used = good.length; q.dropped = dropped;
    // ۴. اندازه‌ها برای هر گام، با نقاط پای فرودآمده (خام، بدون صاف کردن؛ صاف کردن فریم قبل از برخورد رو هم قاطی می‌کنه)
    var sc = D.inScale;
    var footMed = median(D.raw.map(function (p) { return p ? Math.max(footLen(p, SIDES.l), footLen(p, SIDES.r)) : null; }));
    var footPx = footMed == null ? null : Math.round(footMed * sc);
    var flat = finite(good.map(function (x) { return stanceFlat(D, x); }));
    var flatCal = median(flat) || 0;
    good.forEach(function (x) {
      var p = D.raw[x.i], s = SIDES[x.tr];
      x.kneeIc = 180 - angle3(p[s.hip], p[s.knee], p[s.ank]);
      x.shank = Math.atan2((p[s.ank].x - p[s.knee].x) * dir, p[s.ank].y - p[s.knee].y) * DEG;
      var hx = (p[P.lHip].x + p[P.rHip].x) / 2;
      x.over = (p[s.ank].x - hx) * dir / L;
      x.vis = vis(p, [s.hip, s.knee, s.ank]);
      // زاویه‌ی پا: پاشنه، پنجه و مچ دیده بشن و طول پا نزدیک معمول باشه
      var fv = Math.min(p[s.heel].v, p[s.toe].v, p[s.ank].v);
      if (!x.footJump && fv >= 0.6 && footMed && Math.abs(footLen(p, s) / footMed - 1) <= 0.35) {
        var c = stanceFlat(D, x);
        x.fsa = footAngle(p, s) - (c == null ? flatCal : c);
        x.fv = fv;
      }
      if (x.to != null) {
        // حداکثر خم شدن زانو در فاز تماس: پای روی زمین در هر فریم (پایین‌تر)
        var mx = null;
        // فقط ۶۰٪ اول فاز تماس (حداکثر خم شدن نزدیک وسط تماسه؛ انتهای فاز با تشخیص جدا شدن پا ممکنه به فاز پرواز برسه)
        for (var f = x.i; f <= x.i + Math.round(0.6 * (x.to - x.i)); f++) { var q2 = D.pts[f]; if (q2) { var t2 = SIDES[lowerTrack(q2)], a2 = 180 - angle3(q2[t2.hip], q2[t2.knee], q2[t2.ank]); if (mx == null || a2 > mx) mx = a2; } }
        x.peak = mx;
        x.gct = (x.to - x.i + 1) * D.dt * 1000;
        // کشش آشیل (غیرمستقیم): بیشترین خم مچ پا به بالا در ۸۰٪ اول فاز تماس = ۹۰ − زاویه‌ی بین ساق (مچ تا زانو) و پا (پاشنه تا پنجه)
        var df = null;
        for (var f2 = x.i; f2 <= x.i + Math.round(0.8 * (x.to - x.i)); f2++) {
          var q5 = D.pts[f2]; if (!q5) continue;
          var t5 = SIDES[lowerTrack(q5)];
          if (Math.min(q5[t5.knee].v, q5[t5.ank].v, q5[t5.heel].v, q5[t5.toe].v) < 0.5) continue;
          var a5 = ankleDf(q5, t5);
          if (a5 != null && (df == null || a5 > df)) df = a5;
        }
        x.df = df;
      }
    });
    // ۵. آهنگ گام از همه‌ی برخوردها (هر دو پا)، با زمان واقعی
    var all = A.map(function (x) { return x.i; });
    var cad = cadenceOf(D, all, C2.period);
    var m = { cadence: cad.cadence, steps: cad.steps, span: cad.span, timeScale: D.scale };
    if (cad.suggest) m.slowSuggest = cad.suggest;
    var timeOk = cad.valid, icCap = D.fps >= 60 ? null : 'est';
    // ۶. هر پارامتر برای هر سمت
    var bi = {}, sideSteps = function (k) { return good.filter(function (x) { return x.side === k; }); };
    var forSide = function (k) {
      var S0 = sideSteps(k), isFar = k === farK, vv = mean(S0.map(function (x) { return x.vis; }));
      // سمت گام‌ها نامعلوم: هیچ عددی برای پا با برچسب چپ یا راست منتشر نمی‌شه
      // پای دور از دوربین: خط‌هاش در تصویر دیده می‌شن ولی نیمه‌پنهان‌ان؛ عدد منتشر می‌شه، حداکثر «تخمینی»
      var farLow = unsure ? { why: 'sideUnknown' } : isFar ? { cap: 'est' } : {};
      var legX = unsure ? { why: 'sideUnknown' } : {};
      var st = S0.filter(function (x) { return x.fsa != null; }).map(function (x) {
        return { t: Math.round(D.t[x.i] * 1000) / 1000, foot: k, fsa: round1(x.fsa), type: strikeType(x.fsa),
          border: Math.min(Math.abs(x.fsa - REF.fsaHeel), Math.abs(x.fsa - REF.fsaFore)) < 2, v: round1(x.fv) };
      });
      var ss = strikeSummary(st), R0 = PUBLISH.strike;
      var strikeWhy = unsure ? 'sideUnknown' : footPx != null && footPx < R0.footEst ? 'footSmall' : null;
      var sp = publish('kneeIc', st.map(function (x) { return x.fsa; }), mean(st.map(function (x) { return x.v; })), { why: strikeWhy, cap: minConf(minConf(footPx >= R0.footSure ? null : 'est', ss.border / (ss.n || 1) > 0.5 ? 'est' : icCap), isFar ? 'est' : null) });
      if (!strikeWhy && ss.n < R0.est) { sp.conf = 'low'; sp.why = 'fewSteps'; }
      return {
        kneeIc: publish('kneeIc', S0.map(function (x) { return x.kneeIc; }), vv, Object.assign({}, farLow, { cap: minConf(icCap, farLow.cap) })),
        overstride: publish('overstride', S0.map(function (x) { return x.over; }), vv, Object.assign({ cap: minConf(icCap, isFar ? 'est' : null), dec: 2 }, legX)),
        shank: publish('shank', S0.map(function (x) { return x.shank; }), vv, Object.assign({ cap: minConf(icCap, isFar ? 'est' : null) }, legX)),
        peakKnee: publish('peakKnee', S0.map(function (x) { return x.peak; }), vv, farLow),
        ankleDf: publish('ankleDf', S0.map(function (x) { return x.df; }), vv, farLow),
        // زمان تماس فقط به جای پا نیاز داره: برای پای دور حد دیده‌شدن اعمال نمی‌شه (حداکثر «تخمینی»)
        gct: publish('gct', S0.map(function (x) { return x.gct; }), isFar ? null : vv, Object.assign(timeOk ? { cap: D.fps >= 100 ? (isFar ? 'est' : null) : 'est', dec: 0 } : { why: 'slow', dec: 0 }, legX)),
        strike: { v: ss.fsa, type: ss.type, conf: sp.conf, why: sp.why, n: ss.n, sd: round1(stdev(st.map(function (x) { return x.fsa; }))), pct: { heel: ss.heel, mid: ss.mid, fore: ss.fore }, border: ss.border, steps: st }
      };
    };
    var bl = { l: forSide('l'), r: forSide('r') };
    ['kneeIc', 'overstride', 'shank', 'peakKnee', 'ankleDf', 'gct', 'strike'].forEach(function (id) { bi[id] = { l: bl.l[id], r: bl.r[id] }; });
    // ۷. بالاتنه، هر چرخه‌ی گام یک عدد (میانه‌ی فریم‌های بین دو برخورد): آرنج هر سمت، سر و تنه
    var cyc = [];
    for (var c0 = 1; c0 < A.length; c0++) if (A[c0].bad !== 'angle' && A[c0 - 1].bad !== 'angle') cyc.push([A[c0 - 1].i, A[c0].i]);
    var perCycle = function (fn) { return cyc.map(function (cc) { var v = []; for (var f = cc[0]; f < cc[1]; f++) { var p = D.pts[f]; if (p) v.push(fn(p)); } return median(v); }); };
    var visCyc = function (ids) { return visAt(D, ids); };
    bi.elbow = {};
    ['l', 'r'].forEach(function (k) {
      var s = SIDES[k];
      bi.elbow[k] = publish('elbow', perCycle(function (p) { return angle3(p[s.sh], p[s.el], p[s.wr]); }), visCyc([s.sh, s.el, s.wr]), Object.assign({ dec: 0 }, k === farK ? { cap: 'est' } : {}));
    });
    var hd = publish('head', perCycle(function (p) { return Math.atan2((p[near.ear].x - p[near.sh].x) * dir, p[near.sh].y - p[near.ear].y) * DEG; }), visCyc([near.ear, near.sh, P.nose]));
    var tk = publish('trunk', perCycle(function (p) { return Math.atan2((p[near.sh].x - p[near.hip].x) * dir, p[near.hip].y - p[near.sh].y) * DEG; }), visCyc([near.sh, near.hip]));
    var gaze = median(perCycle(function (p) { return Math.atan2(p[P.nose].y - p[near.ear].y, Math.abs(p[P.nose].x - p[near.ear].x)) * DEG; }));
    // جهت نگاه: خط گوش تا چشم سمت نزدیک (مثبت = پایین)؛ مدلی که چشم نداره (دیده‌شدن صفر) → غیرقابل‌اطمینان
    var gz = publish('gaze', perCycle(function (p) { return p[near.eye].v < 0.3 ? null : Math.atan2(p[near.eye].y - p[near.ear].y, Math.abs(p[near.eye].x - p[near.ear].x) || 1e-6) * DEG; }), visCyc([near.ear, near.eye]));
    var swing = [];
    D.pts.forEach(function (p) { if (p) swing.push((p[near.wr].x - p[near.sh].x) * dir / (dist(p[near.sh], p[near.hip]) || 1)); });
    // ۸. فیلدهای قبلی گزارش (سمت نزدیک)، برای گزارش‌های ذخیره‌شده و کارت‌ها
    var nb = function (id) { return bi[id][nearK]; };
    m.kneeIc = nb('kneeIc').v; m.shank = nb('shank').v; m.overstride = nb('overstride').v; m.peakKnee = nb('peakKnee').v;
    m.gctNear = nb('gct').v; m.gctFar = bi.gct[farK].conf !== 'low' ? bi.gct[farK].v : null;
    var ns = nb('strike');
    m.fsa = ns.v; m.strike = ns.type;
    m.strikes = { n: ns.n, footPx: footPx, heel: ns.pct.heel, mid: ns.pct.mid, fore: ns.pct.fore, border: ns.border, steps: ns.steps.concat(bi.strike[farK].steps), reason: ns.why };
    m.neck = hd.v; m.gaze = round1(gaze); m.trunk = tk.v; m.elbow = nb('elbow').v;
    m.armSwing = Math.round(((pct(swing, 0.95) || 0) - (pct(swing, 0.05) || 0)) * 100) / 100;
    // تقارن زمان‌بندی: زمان گام نزدیک→دور و دور→نزدیک (فقط از گام‌های پشت‌سرهم با سمت معلوم)
    var stepNF = [], stepFN = [];
    for (var k3 = 1; k3 < A.length; k3++) {
      var g3 = (A[k3].i - A[k3 - 1].i) * D.dt;
      if (A[k3].seg !== A[k3 - 1].seg || Math.round((A[k3].i - A[k3 - 1].i) / T) !== 1) continue;
      (A[k3 - 1].side === nearK ? stepNF : stepFN).push(g3);
    }
    m.stepSym = stepNF.length >= 3 && stepFN.length >= 3 ? round1(symIndex(median(stepNF), median(stepFN), D.dt)) : null;
    m.gctSym = m.gctFar != null && m.gctNear != null ? round1(symIndex(m.gctNear, m.gctFar, D.dt * 1000)) : null;
    // نوسان عمودی لگن (به سانتی‌متر، با قد کاربر)
    var hy = D.pts.map(function (p) { return p ? (p[P.lHip].y + p[P.rHip].y) / 2 : null; });
    var amp = [];
    for (var k = 1; k < all.length; k++) {
      var sgm = hy.slice(all[k - 1], all[k] + 1).filter(function (v) { return v != null; });
      // نسبت به طول پای همون لحظه (دونده ممکنه به دوربین نزدیک یا ازش دور بشه)
      var Lh = median(D.raw.slice(all[k - 1], all[k] + 1).map(function (q4) { return q4 ? (legOf(q4, SIDES.l) + legOf(q4, SIDES.r)) / 2 : null; })) || L;
      if (sgm.length > 2) amp.push((Math.max.apply(null, sgm) - Math.min.apply(null, sgm)) / Lh);
    }
    var ampL = median(amp);
    // حداقل ۶ گام برای نوسان عمودی (یک گام کوتاه یا بلندتر عدد رو جابه‌جا نکنه)
    m.vo = heightCm && ampL != null && amp.length >= 6 ? round1(ampL * LEG_RATIO * heightCm) : null;
    // تقارن هر پارامتر: فقط وقتی هر دو سمت قابل‌اطمینانه
    m.bi = bi; m.near = nearK; m.sideUnsure = unsure || undefined;
    m.conf = {
      kneeIc: nb('kneeIc').conf, overstride: minConf(nb('overstride').conf, nb('shank').conf), strike: ns.conf, peakKnee: nb('peakKnee').conf, gct: nb('gct').conf,
      cadence: timeOk ? (cad.steps >= PUBLISH.cadence.sure && cad.agree ? 'sure' : cad.steps >= PUBLISH.cadence.est ? 'est' : 'low') : 'low',
      vo: m.vo == null ? 'low' : 'est',
      timing: m.stepSym != null ? 'est' : 'low',
      head: hd.conf, trunk: tk.conf, elbow: nb('elbow').conf
    };
    m.why = { head: hd.why, trunk: tk.why, cadence: timeOk ? (cad.steps < PUBLISH.cadence.est ? 'fewSteps' : null) : (m.slowSuggest ? 'slow' : 'range'), timing: m.stepSym == null ? 'fewSteps' : null, vo: m.vo != null ? null : heightCm ? 'fewSteps' : 'noHeight' };
    m.headN = hd; m.trunkN = tk; m.gazeN = gz;
    // فریم نمونه برای نمایش: برخورد پای نزدیک وسط فیلم
    var nIc = good.filter(function (x) { return x.side === nearK; }).map(function (x) { return x.i; });
    var key = nIc.length ? nIc[Math.floor(nIc.length / 2)] : all[Math.floor(all.length / 2)];
    return { ok: true, view: 'side', near: nearK, dir: dir, metrics: m, quality: q, keyFrame: key, keyT: D.tv[key], ic: all };
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
      // چرخش پاشنه به بیرون (شاخص تخمینی پرونیشن): خط ساق (زانو تا مچ) تا ارتفاع پاشنه ادامه داده می‌شه؛
      // پاشنه به سمت بیرون (دور از خط وسط) = مثبت. فقط تخمینی: یک نقطه روی پاشنه خط وسط استخوان پاشنه نیست
      // و پرونیشن در مطالعه‌ی آینده‌نگر (Nielsen 2014) با آسیب مرتبط نبود
      var rf = [];
      midStance(c).forEach(function (i) {
        var p = D.raw[i];
        if (!p || Math.min(p[s.knee].v, p[s.ank].v, p[s.heel].v) < 0.6) return;
        var k = p[s.knee], a = p[s.ank], h = p[s.heel], mid = (p[P.lHip].x + p[P.rHip].x) / 2, dy = h.y - a.y;
        if (!(dy > 0) || !(a.y - k.y > 0)) return;
        var lineX = a.x + (a.x - k.x) * (dy / (a.y - k.y)), lat = -(Math.sign(mid - p[s.hip].x) || 1);
        rf.push(Math.atan2((h.x - lineX) * lat, dy) * DEG);
      });
      return { drop: median(drop), valgus: median(valg), crossover: mean(cross), dropA: drop, valgA: valg, rfA: rf };
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
    // هر دست جدا: درصد فریم‌هایی از هر چرخه‌ی گام (دو برخورد پشت‌سرهم) که مچ از خط وسط شونه‌ها رد شده
    var icAll = cL.ic.concat(cR.ic).sort(function (a, b) { return a - b; });
    var armSide = function (k) {
      var s = SIDES[k], out = [];
      for (var c1 = 2; c1 < icAll.length; c1++) {
        var n1 = 0, x1 = 0;
        for (var f = icAll[c1 - 2]; f < icAll[c1]; f++) {
          var p = D.pts[f]; if (!p || p[s.wr].v < 0.5) continue;
          var mid = (p[P.lSh].x + p[P.rSh].x) / 2, w = Math.abs(p[P.lSh].x - p[P.rSh].x) || 1;
          n1++; if ((p[s.wr].x - mid) * Math.sign(p[s.sh].x - mid) < -0.05 * w) x1++;
        }
        if (n1 >= 3) out.push(x1 / n1 * 100);
      }
      return out;
    };
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
    // هر سمت جدا: افت لگن در فاز تماس همون پا (لگن سمت مقابل پایین میاد) و زاویه‌ی زانوی همون پا
    var legVis = function (k, c) { var s = SIDES[k]; return visAt(D, [P.lHip, P.rHip, s.knee, s.ank], midStance(c)); };
    m.bi = {
      pelvic: { l: publish('pelvic', sl.dropA, legVis('l', cL)), r: publish('pelvic', sr.dropA, legVis('r', cR)) },
      valgus: { l: publish('valgus', sl.valgA, legVis('l', cL), { cap: 'est' }), r: publish('valgus', sr.valgA, legVis('r', cR), { cap: 'est' }) },
      rearfoot: { l: publish('rearfoot', sl.rfA, null), r: publish('rearfoot', sr.rfA, null) },
      armCross: { l: publish('armCross', armSide('l'), visAt(D, [P.lSh, P.rSh, P.lWr]), { dec: 0 }), r: publish('armCross', armSide('r'), visAt(D, [P.lSh, P.rSh, P.rWr]), { dec: 0 }) }
    };
    ['pelvic', 'valgus'].forEach(function (id) {
      var u = id === 'pelvic' ? 'pelvic' : 'valgus';
      m[u + 'L'] = m.bi[id].l.conf === 'low' ? null : m.bi[id].l.v; m[u + 'R'] = m.bi[id].r.conf === 'low' ? null : m.bi[id].r.v;
      m.conf[id] = ['l', 'r'].map(function (k) { return m.bi[id][k].conf; }).reduce(function (a, b) { return CONF[a] >= CONF[b] ? a : b; });
    });
    m.pelvicSym = m.pelvicL != null && m.pelvicR != null ? round1(Math.abs(m.pelvicL - m.pelvicR)) : null;
    m.valgusSym = m.valgusL != null && m.valgusR != null ? round1(Math.abs(m.valgusL - m.valgusR)) : null;
    var key = midStance(cR)[0];
    return { ok: true, view: 'back', metrics: m, quality: q, keyFrame: key, keyT: D.tv[key] };
  }

  // ---------- قواعد: عدد → وضعیت ----------
  // وضعیت‌ها: good = در محدوده‌ی معمول، warn = کمی بیرون، bad = بیرون از محدوده‌ی معمول — فقط برای پارامترهایی که مقایسه‌ی
  // منتشرشده دارن (زانو و ساق در برخورد: Souza 2016، Bramah 2018؛ افت لگن: Bramah 2018)؛ info = فقط توصیفی (بازه‌ای که از
  // مقاله‌ی مشخصی اومده باشه نداره)؛ na = غیرقابل‌اطمینان (عدد داده نمی‌شه، با دلیل)
  function band(v, r) { return v == null ? null : v <= r.good ? 'good' : v <= r.warn ? 'warn' : 'bad'; }
  function range(v, r) { return v == null ? null : v >= r.lo && v <= r.hi ? 'good' : v >= r.warnLo && v <= r.warnHi ? 'warn' : 'bad'; }
  function worst(a, b) { var o = { good: 0, warn: 1, bad: 2 }; return a == null ? b : b == null ? a : o[a] >= o[b] ? a : b; }
  // هر یافته مال یک نما (view) ـه. پارامترهای دوطرفه برای هر سمت بدن جدا: sides: { l, r } هر کدوم با عدد، اطمینان و وضعیت خودش
  // (یا na با دلیل)؛ sym: اختلاف دو سمت، فقط وقتی هر دو قابل‌اطمینانه. وضعیت کلی = بیرون‌ترین سمت قابل‌اطمینان.
  function findings(side, back, cond, condBack) {
    var ok = function (c) { return CONDITIONS.indexOf(c) >= 0 ? c : 'easy'; };
    var cS = ok(cond), cB = ok(condBack || cond);
    var F = [], view = 'side';
    var add = function (id, area, status, value, c, extra) {
      if (!status) return;
      if (c === 'low' || value == null) F.push({ id: id, view: view, area: area, status: 'na', value: null, conf: 'low', why: extra && extra.why || null });
      else F.push(Object.assign({ id: id, view: view, area: area, status: status, value: value, conf: c || 'est' }, extra || {}, { why: null }));
    };
    var bil = function (id, area, per, nearK, judge, ext) {
      if (!per) return;
      var sides = {}, st = [], vals = {};
      ['l', 'r'].forEach(function (k) {
        var b = per[k];
        if (!b) return;
        if (b.conf === 'low' || b.v == null) { sides[k] = { status: 'na', conf: 'low', value: null, why: b.why || null }; return; }
        var s0 = judge ? judge(b.v, k) || 'info' : 'info';
        sides[k] = Object.assign({ status: s0, conf: b.conf, value: b.v, n: b.n, sd: b.sd }, ext ? ext(k) : {});
        st.push(s0); vals[k] = b.v;
      });
      var good = ['l', 'r'].filter(function (k) { return sides[k] && sides[k].status !== 'na'; });
      if (!good.length) {
        var w = (sides[nearK] || {}).why || (sides.l || {}).why || (sides.r || {}).why || null;
        F.push({ id: id, view: view, area: area, status: 'na', value: null, conf: 'low', why: w, sides: sides });
        return;
      }
      var status = st.filter(function (x) { return x !== 'info'; }).reduce(function (a, b) { return worst(a, b); }, null) || 'info';
      // متن کلی از سمتی که وضعیت کلی رو ساخته (بیرون‌ترین سمت)، وگرنه سمت نزدیک به دوربین
      var worstK = good.filter(function (k) { return sides[k].status === status; })[0];
      var main = status !== 'info' && worstK ? worstK : good.indexOf(nearK) >= 0 ? nearK : good[0];
      var f = Object.assign({ id: id, view: view, area: area, status: status, value: sides[main].value, conf: sides[main].conf, main: main, sides: sides }, ext ? ext(main) : {});
      if (good.length === 2) f.sym = round1(Math.abs(vals.l - vals.r));
      F.push(f);
    };
    // آهنگ گام: فقط توصیفی (مرز ثابتی از پژوهش نداره؛ به سرعت و قد بستگی داره). Heiderscheit 2011: افزایش ۵ تا ۱۰٪ نسبت به آهنگ
    // خود دونده بار زانو و لگن رو کم کرد؛ همین بازه‌ی نسبی (نه عدد ثابت) کنار عدد گفته می‌شه.
    var cadence = function (mm, c, cnd) {
      var v = mm.cadence, why = mm.why && mm.why.cadence || (v != null && (v < CAD_OK.lo || v > CAD_OK.hi) ? (mm.slowSuggest ? 'slow' : 'range') : null);
      if (v == null && !why) return;
      add('cadence', 'cadence', 'info', why ? null : v, why ? 'low' : c, { cond: cnd, why: why, plus5: v && Math.round(v * 1.05), plus10: v && Math.round(v * 1.1) });
    };
    if (side && side.ok) {
      var m = side.metrics, C = m.conf || {}, nk = side.near || m.near || 'r', B0 = m.bi || {};
      var shankOk = function (k) { var b = B0.shank && B0.shank[k]; return b && b.conf !== 'low' ? b.v : null; };
      bil('overstride', 'knee', B0.overstride, nk, function (v, k) { return worst(band(v, REF.overstride), band(shankOk(k), REF.shank)); }, function (k) { return { shank: shankOk(k) }; });
      bil('kneeIc', 'knee', B0.kneeIc, nk, function (v) { return range(v, REF.kneeIc); }, function (k) { var v = B0.kneeIc[k].v; return { form: v < REF.kneeIc.lo ? 'straight' : v > REF.kneeIc.hi ? 'bent' : 'ok' }; });
      cadence(m, C.cadence, cS);
      bil('strike', 'foot', B0.strike, nk, null, function (k) { var b = B0.strike[k]; return { strike: b.type, pct: b.pct, n: b.n, px: m.strikes ? m.strikes.footPx : null }; });
      bil('peakKnee', 'knee', B0.peakKnee, nk);
      bil('gct', 'timing', B0.gct, nk);
      if (m.vo != null || C.vo) add('vo', 'bounce', 'info', m.vo, m.vo == null ? 'low' : C.vo, { why: m.vo == null ? (m.why && m.why.vo) || 'noHeight' : null });
      add('trunk', 'trunk', 'info', m.trunk, C.trunk, { lean: m.trunk < REF.trunk.lo ? 'back' : m.trunk > REF.trunk.hi ? 'forward' : 'ok', why: m.why && m.why.trunk });
      add('head', 'head', 'info', m.neck, C.head, { gaze: m.gaze, look: m.gaze > REF.gaze.hi ? 'down' : m.gaze < REF.gaze.lo ? 'up' : 'ahead', why: m.why && m.why.head });
      bil('elbow', 'arms', B0.elbow, nk, null, function (k) { var v = B0.elbow[k].v; return { bend: v > REF.elbow.hi ? 'straight' : v < REF.elbow.lo ? 'tight' : 'ok' }; });
      if (m.stepSym != null || m.gctSym != null) add('timing', 'symmetry', 'info', round1(Math.max(m.stepSym || 0, m.gctSym || 0)), C.timing);
    }
    if (back && back.ok) {
      view = 'back';
      var b = back.metrics, BB = b.bi || {};
      cadence(b, (b.conf || {}).cadence, cB);
      if (b.trunkLat != null) add('trunkLat', 'trunk', 'info', b.trunkLat, b.conf.trunkLat);
      bil('pelvic', 'pelvis', BB.pelvic, 'l', function (v) { return band(v, REF.pelvic); });
      bil('valgus', 'kneeIn', BB.valgus, 'l');
      add('crossover', 'foot', 'info', b.crossover, b.conf.crossover);
      add('armCross', 'arms', 'info', b.armCross, b.conf.armCross);
      if (b.armSym != null) add('armSym', 'arms', 'info', b.armSym, b.conf.armSym);
      add('sides', 'symmetry', 'info', round1(b.gctSym), b.conf.sides, { pelvicSym: b.pelvicSym, valgusSym: b.valgusSym });
    }
    // ترتیب: بیرون از محدوده‌ی معمول → کمی بیرون → معمول → توصیفی → غیرقابل‌اطمینان؛ در هر گروه به ترتیب اهمیت
    var ORDER = ['cadence', 'strike', 'overstride', 'kneeIc', 'elbow', 'head', 'trunk', 'pelvic', 'valgus', 'crossover', 'peakKnee', 'gct', 'vo', 'trunkLat', 'timing', 'sides', 'armCross', 'armSym'];
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
  // دو فیلم از کنار، از دو طرف دونده: هر سمت بدن از فیلمی گرفته می‌شه که اون سمت نزدیک دوربینه
  function mergeSides(a, b) {
    var m = Object.assign({}, a.metrics), mb = b.metrics, bi = {};
    Object.keys(m.bi || {}).forEach(function (id) {
      bi[id] = {};
      ['l', 'r'].forEach(function (k) { bi[id][k] = k === b.near && mb.bi && mb.bi[id] ? mb.bi[id][k] : m.bi[id][k]; });
    });
    m.bi = bi;
    var g = bi.gct && bi.gct[b.near];
    m.gctFar = g && g.conf !== 'low' ? g.v : null;
    m.gctSym = m.gctFar != null && m.gctNear != null ? round1(symIndex(m.gctNear, m.gctFar, 1000 / Math.max(a.quality.fps || 30, b.quality.fps || 30))) : m.gctSym;
    m.second = { src: b.src, near: b.near, quality: b.quality, cadence: mb.cadence };
    return Object.assign({}, a, { metrics: m, both: true });
  }
  // input: { side, side2 (اختیاری: فیلم دوم از کنار، از طرف دیگه‌ی دونده)، back: خروجی js/pose.js، heightCm،
  //   conditions: { side, side2, back } شرایط دویدنِ هر فیلم (کلید = خونه‌ای که فیلم توش گذاشته شده) (یا condition برای همه)،
  //   load: { acute, chronic } کیلومتر در هفته، timeScale: { side, side2, back } ضریب اسلوموشن هر فیلم (۱ یا خالی = زمان واقعی) }
  function analyze(input) {
    var ts = input.timeScale || {};
    var res = ['side', 'side2', 'back'].filter(function (k) { return input[k]; }).map(function (k) {
      var r = classify(input[k], input.heightCm, k === 'back' ? 'back' : 'side', ts[k]);
      r.src = k;
      return r;
    });
    var side = null, side2 = null, back = null;
    // هر نتیجه‌ی موفق در جای زاویه‌ی واقعی خودش؛ دو فیلم از کنار فقط اگه از دو طرف مختلف باشن با هم ترکیب می‌شن
    res.forEach(function (r) {
      if (!r.ok) return;
      if (r.view === 'side' && !side) side = r;
      else if (r.view === 'side' && !side2 && r.near !== side.near) side2 = r;
      else if (r.view === 'back' && !back) back = r;
      else r.dup = true;
    });
    var failed = res.filter(function (r) { return !r.ok || r.dup; }).map(function (r) { return { src: r.src, reason: r.dup ? 'sameView' : r.reason }; });
    var okc = function (c) { return CONDITIONS.indexOf(c) >= 0 ? c : null; };
    var cs = input.conditions || {};
    var conds = { side: side ? okc(cs[side.src]) || okc(input.condition) || 'easy' : null, back: back ? okc(cs[back.src]) || okc(input.condition) || 'easy' : null };
    var cond = conds.side || conds.back || 'easy';
    var sideM = side && side2 ? mergeSides(side, side2) : side;
    var F = findings(sideM, back, conds.side || cond, conds.back || cond);
    var R = risks(F);
    // بار تمرینی فقط «زمینه»ست (شواهد نسبت بار حاد به مزمن خودش محل بحثه) و سطح الگوها رو عوض نمی‌کنه
    var ld = input.load, load = ld && ld.chronic > 0 ? { acute: ld.acute, chronic: ld.chronic, ratio: Math.round(ld.acute / ld.chronic * 100) / 100 } : null;
    if (load) load.high = load.ratio >= 1.5;
    var J = F.filter(judged);
    var FX = factors(sideM ? sideM.metrics : null, back ? back.metrics : null, conds.side || conds.back || cond);
    return { side: sideM, side2: side2, back: back, failed: failed, findings: F, factors: FX, risks: R, condition: cond, conditions: conds, load: load,
      axes: { performance: axisScore(F, AXIS.performance), form: axisScore(F, AXIS.form), risk: R.length ? R[0].level : null },
      score: J.length ? Math.round(J.reduce(function (s, f) { return s + (f.status === 'good' ? 1 : f.status === 'warn' ? 0.5 : 0); }, 0) / J.length * 100) : null };
  }


  // ---------- ۹ فاکتور گزارش کاربر ----------
  // هر فاکتور: یک گیج با نشانگر برای هر سمت (یا یکی برای آهنگ گام و سر). pos: جای نشانگر از ۰ تا ۱؛
  // دوطرفه (two): بازه‌ی رایج وسط (۰٫۳۶ تا ۰٫۶۴)، «کمی بیرون» تا ۰٫۲ و ۰٫۸؛ یک‌طرفه (one): رایج از ۰ تا ۰٫۴۵، کمی بیرون تا ۰٫۷.
  // conf: sure = نشانگر پر، est = توخالی و «تخمینی»، low = بدون نشانگر («قابل ارزیابی نبود») با دلیل.
  // ورودی: معیارهای ذخیره‌شده‌ی نمای کنار و پشت (همون r.side / r.back گزارش) و شرایط دویدن؛ پس برای گزارش‌های قبلی هم کار می‌کنه
  // (فاکتورهایی که اون موقع اندازه‌گیری نمی‌شدن: why = 'old').
  var FACTOR_IDS = ['cadence', 'knee', 'pelvis', 'pronation', 'landing', 'achilles', 'elbow', 'head', 'arms'];
  var FACTOR_VIEW = { cadence: 'both', knee: 'side', pelvis: 'back', pronation: 'back', landing: 'side', achilles: 'side', elbow: 'side', head: 'side', arms: 'back' };
  function pw(v, m) {
    if (v <= m[0][0]) return m[0][1];
    for (var i = 1; i < m.length; i++) if (v <= m[i][0]) return m[i - 1][1] + (m[i][1] - m[i - 1][1]) * (v - m[i - 1][0]) / (m[i][0] - m[i - 1][0]);
    return m[m.length - 1][1];
  }
  function twoMap(r, min, max) { return [[min, 0], [r.warnLo, 0.2], [r.lo, 0.36], [r.hi, 0.64], [r.warnHi, 0.8], [max, 1]]; }
  function oneMap(r, max) { return [[0, 0], [r.good, 0.45], [r.warn, 0.7], [max, 1]]; }
  function zoneOf(kind, p) { return kind === 'two' ? (p >= 0.36 && p <= 0.64 ? 'good' : p >= 0.2 && p <= 0.8 ? 'warn' : 'bad') : p <= 0.45 ? 'good' : p <= 0.7 ? 'warn' : 'bad'; }
  function factors(sm, bm, cond) {
    var cd = CONDITIONS.indexOf(cond) >= 0 ? cond : 'easy';
    var low = function (why) { return { conf: 'low', why: why || 'fewSteps' }; };
    var need = function (view) { return view === 'side' ? (sm ? null : 'noSide') : (bm ? null : 'noBack'); };
    // یک سمت از جدول دوطرفه (bi) با نقشه‌ی گیج
    var mark = function (m, id, k, map, kind, view) {
      if (!m) return low(view === 'side' ? 'noSide' : 'noBack');
      var b = m.bi && m.bi[id] && m.bi[id][k];
      if (!b) return low(m.bi ? 'old' : 'old');
      if (b.conf === 'low' || b.v == null) return low(b.why);
      var p = pw(b.v, map);
      return { conf: b.conf, v: b.v, n: b.n, sd: b.sd, pos: Math.round(p * 1000) / 1000, zone: zoneOf(kind, p) };
    };
    var one = function (v, c, why, map, kind) {
      if (v == null || c === 'low' || !c) return low(why);
      var p = pw(v, map);
      return { conf: c, v: v, pos: Math.round(p * 1000) / 1000, zone: zoneOf(kind, p) };
    };
    // بدترین از دو گیج (مثلاً محل فرود: فاصله‌ی جلوی پا و زاویه‌ی ساق) با پایین‌ترین اطمینان
    var worse = function (a, b) {
      if (a.conf === 'low') return b.conf === 'low' ? a : Object.assign({}, b);
      if (b.conf === 'low') return Object.assign({}, a);
      var w = b.pos > a.pos ? b : a;
      return Object.assign({}, w, { conf: CONF[a.conf] <= CONF[b.conf] ? a.conf : b.conf });
    };
    var out = [];
    var add = function (id, kind, marks, extra) {
      var ok = marks.filter(function (x) { return x.m.conf !== 'low'; });
      var f = Object.assign({ id: id, view: FACTOR_VIEW[id], kind: kind, marks: marks.map(function (x) { return Object.assign({ k: x.k }, x.m); }) }, extra || {});
      f.status = ok.length ? 'ok' : 'na';
      if (!ok.length) f.why = (marks.filter(function (x) { return x.m.why; })[0] || { m: {} }).m.why || 'fewSteps';
      // وضعیت کلی = بیرون‌ترین سمت قابل‌اطمینان؛ اطمینان کلی = بالاترین (نشانگرها هر کدوم اطمینان خودشون رو دارن)
      if (ok.length) {
        var Z = { good: 0, warn: 1, bad: 2 };
        f.zone = ok.map(function (x) { return x.m.zone; }).reduce(function (a, b) { return Z[b] > Z[a] ? b : a; });
        f.conf = ok.map(function (x) { return x.m.conf; }).reduce(function (a, b) { return CONF[b] > CONF[a] ? b : a; });
      }
      out.push(f);
    };
    // ۱. آهنگ گام: از نمایی که اطمینان بیشتری داره (برابر: کنار). یک‌طرفه: کمتر از حد معمول شرایط دویدن = دورتر از سبز
    var fl = REF.cadence[cd], cMap = [[fl - 25, 1], [fl - 10, 0.7], [fl, 0.45], [fl + 25, 0]];
    var cad = function (m) { return m ? one(m.cadence, m.conf && m.conf.cadence, m.why && m.why.cadence || (m.cadence == null ? 'fewSteps' : null), cMap, 'one') : low(); };
    var cs = cad(sm), cb = cad(bm), cv = CONF[cb.conf] > CONF[cs.conf] ? cb : cs;
    if (!sm && !bm) cv = low('noVideo');
    add('cadence', 'one', [{ k: null, m: cv }], { from: cv === cb && bm ? 'back' : 'side', floor: fl, cond: cd });
    // ۲. زاویه‌ی زانو در لحظه‌ی فرود (بیشترین خم در فاز تماس در گزارش تخصصی)
    var kMap = twoMap(REF.kneeIc, 0, 50);
    add('knee', 'two', ['l', 'r'].map(function (k) { return { k: k, m: mark(sm, 'kneeIc', k, kMap, 'two', 'side') }; }));
    // ۳. افتادگی لگن (سمت مقابل، در فاز تماس هر پا)
    var pMap = oneMap(REF.pelvic, 12);
    add('pelvis', 'one', ['l', 'r'].map(function (k) { return { k: k, m: mark(bm, 'pelvic', k, pMap, 'one', 'back') }; }));
    // ۴. چرخش زانو و مچ به داخل: بیرون‌ترینِ زانوی رو به داخل و چرخش پاشنه؛ همیشه حداکثر «تخمینی»
    var vMap = oneMap(REF.valgus, 20), rMap = oneMap(REF.rearfoot, 20);
    add('pronation', 'one', ['l', 'r'].map(function (k) {
      var a = mark(bm, 'valgus', k, vMap, 'one', 'back'), b = mark(bm, 'rearfoot', k, rMap, 'one', 'back'), w = worse(a, b);
      if (w.conf === 'sure') w.conf = 'est';
      w.valgus = a.conf === 'low' ? null : a.v; w.rearfoot = b.conf === 'low' ? null : b.v;
      return { k: k, m: w };
    }));
    // ۵. فرود پا: محل فرود (فاصله‌ی مچ پا جلوی لگن و زاویه‌ی ساق) روی گیج؛ نوع فرود (پاشنه، میان‌پا، جلوپا) فقط برچسب
    var oMap = oneMap(REF.overstride, 0.45), sMap = oneMap(REF.shank, 20);
    var types = {};
    add('landing', 'one', ['l', 'r'].map(function (k) {
      var a = mark(sm, 'overstride', k, oMap, 'one', 'side'), b = mark(sm, 'shank', k, sMap, 'one', 'side'), w = worse(a, b);
      var st = sm && sm.bi && sm.bi.strike && sm.bi.strike[k];
      if (st && st.conf !== 'low' && st.type) { w.strike = st.type; w.strikeConf = st.conf; types[st.type] = 1; }
      w.over = a.conf === 'low' ? null : a.v; w.shank = b.conf === 'low' ? null : b.v;
      return { k: k, m: w };
    }), { strikes: Object.keys(types) });
    // ۶. کشش آشیل (غیرمستقیم: خم مچ پا به بالا در فاز تماس)؛ همیشه حداکثر «تخمینی»
    var aMap = twoMap(REF.ankleDf, 0, 45);
    add('achilles', 'two', ['l', 'r'].map(function (k) { return { k: k, m: mark(sm, 'ankleDf', k, aMap, 'two', 'side') }; }));
    // ۷. زاویه‌ی آرنج
    var eMap = twoMap(REF.elbow, 30, 170);
    add('elbow', 'two', ['l', 'r'].map(function (k) { return { k: k, m: mark(sm, 'elbow', k, eMap, 'two', 'side') }; }));
    // ۸. سر و گردن (جلو بودن سر، روی گیج) و جهت نگاه (برچسب)
    var hMap = oneMap(REF.neck, 45);
    var hd = sm ? (sm.headN ? one(sm.headN.v, sm.headN.conf, sm.headN.why, hMap, 'one') : one(sm.neck, sm.conf && sm.conf.head, sm.why && sm.why.head, hMap, 'one')) : low('noSide');
    var gz = sm && sm.gazeN && sm.gazeN.conf !== 'low' ? sm.gazeN.v : null;
    add('head', 'one', [{ k: null, m: hd }], { gaze: gz, look: gz == null ? null : gz > REF.gaze.hi ? 'down' : gz < REF.gaze.lo ? 'up' : 'ahead' });
    // ۹. عبور دست‌ها از خط وسط بدن (از پشت)؛ دامنه‌ی تاب جلو و عقب از کنار فقط در گزارش تخصصی
    var xMap = oneMap(REF.armCross, 60);
    add('arms', 'one', ['l', 'r'].map(function (k) { return { k: k, m: mark(bm, 'armCross', k, xMap, 'one', 'back') }; }), { swing: sm ? sm.armSwing : null });
    return out;
  }

  var api = { factors: factors, FACTOR_IDS: FACTOR_IDS, FACTOR_VIEW: FACTOR_VIEW, stepPeriod: stepPeriod, PUBLISH: PUBLISH, analyze: analyze, cadenceOf: cadenceOf, CAD_OK: CAD_OK, analyzeSide: analyzeSide, analyzeBack: analyzeBack, findings: findings, risks: risks, axisScore: axisScore, judged: judged,
    AXIS: AXIS, INJURIES: INJURIES, REF: REF, CONDITIONS: CONDITIONS, P: P, angle3: angle3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachGait = api;
})(this);
