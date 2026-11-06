/*
 * استخراج نقاط بدن با RTMPose-m (۲۶ نقطه، شش نقطه روی پا) و YOLOX-tiny، کاملاً داخل مرورگر با ONNX Runtime Web (WebAssembly).
 * فقط لایه‌ی استخراج: خروجی هر فریم همون قالب MediaPipe ـه ([x, y, visibility, z] × ۳۳، نرمال‌شده)، پس پخش‌کننده و تحلیل دست نمی‌خورن.
 * انتخاب: در مجموعه‌ی آزمایش (۴ ویدیو: کنار اسلوموشن، پشت، جلو، پشت با نور از روبه‌رو) آهنگ گام همه درست درومد
 * (MediaPipe در دو ویدیو نصف)، بدن در همه‌ی فریم‌ها پیدا شد و پراکندگی زاویه‌ی زانو بین گام‌ها ۲ تا ۳ درجه بود به‌جای ۱۲.
 *
 * خط لوله (همون پیاده‌سازی rtmlib که آزمایش با اون انجام شد):
 *  - تشخیص آدم با YOLOX-tiny فقط هر ۱۵ فریم یا وقتی دونده گم شده؛ بین‌شون کادر از نقاط فریم قبل
 *  - برش کادر ×۱٫۲۵ با نسبت ۱۹۲×۲۵۶، کانال‌ها به ترتیب BGR با میانگین و انحراف معیار ImageNet
 *  - خروجی SimCC: بیشینه‌ی هر محور ÷ ۲، اطمینان = میانگین دو بیشینه
 */
(function (root) {
  'use strict';
  var ORT = 'js/vendor/onnxruntime/', POSE = 'models/rtmpose-m-halpe26-fp16.onnx', DET = 'models/yolox-tiny-humanart-int8.onnx';
  var PW = 192, PH = 256, DS = 416, DET_EVERY = 15;
  var MEAN = [123.675, 116.28, 103.53], STD = [58.395, 57.12, 57.375];
  // Halpe26 → شماره‌ی نقطه در MediaPipe (چشم‌ها برای جهت نگاه)
  var MAP = { 0: 0, 1: 2, 2: 5, 3: 7, 4: 8, 5: 11, 6: 12, 7: 13, 8: 14, 9: 15, 10: 16, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28, 24: 29, 25: 30 };
  // اطمینان SimCC مثل «دیده‌شدن» MediaPipe کالیبره نیست: ۰٫۵ و بیشتر = کاملاً دیده‌شده (همون فرض آزمایش)
  var VIS = 0.5;
  function abs(p) { return new URL(p, document.baseURI).href; }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // پردازنده‌ی گرافیکی (WebGPU، مثلاً سافاری iOS 26) اگه باشه، وگرنه CPU (WebAssembly). هر دستگاه فقط یکی از دو نسخه‌ی
  // ONNX Runtime رو دانلود می‌کنه. ?gpu=0 در آدرس برای مقایسه CPU رو اجباری می‌کنه.
  function gpuAdapter() {
    if (!navigator.gpu || /[?&]gpu=0\b/.test(location.search)) return Promise.resolve(null);
    // مدل نیم‌دقت (float16) روی پردازنده‌ی گرافیکی به قابلیت shader-f16 نیاز داره؛ بدونش خروجی خالی می‌ده
    return navigator.gpu.requestAdapter().then(function (a) { return a && a.features && a.features.has('shader-f16') ? a : null; }).catch(function () { return null; });
  }
  function create() {
    return gpuAdapter().then(function (adapter) {
      return import(abs(ORT + (adapter ? 'ort.webgpu.min.mjs' : 'ort.wasm.min.mjs'))).then(function (m) {
        var ort = m.InferenceSession ? m : m.default;
        ort.env.wasm.wasmPaths = abs(ORT);
        // چندنخی به crossOriginIsolated نیاز داره (سرآیندهایی که GitHub Pages نمی‌ده)
        ort.env.wasm.numThreads = 1;
        var opt = function (ep) { return { executionProviders: [ep], graphOptimizationLevel: 'all' }; };
        // تشخیص آدم (۸ بیتی، هر ۱۵ فریم یک بار) همیشه روی CPU؛ مدل نقاط اول روی پردازنده‌ی گرافیکی، اگه نشد CPU
        var ep = adapter ? 'webgpu' : 'wasm';
        // پشت‌سرهم، نه هم‌زمان: ساختن هم‌زمان دو مدل، WebAssembly رو دو بار راه می‌اندازه و نسخه‌ی WebGPU خطا می‌ده
        var det;
        return ort.InferenceSession.create(abs(DET), opt('wasm')).then(function (d) {
          det = d;
          return ort.InferenceSession.create(abs(POSE), opt(ep)).catch(function (e) {
            if (ep === 'wasm') throw e;
            if (root.console) console.warn('rtmpose webgpu', e);
            ep = 'wasm'; return ort.InferenceSession.create(abs(POSE), opt('wasm'));
          });
        }).then(function (pose) {
          // یک اجرای آزمایشی: اگه پردازنده‌ی گرافیکی خروجی معتبر نداد (خطای بی‌صدای WebGPU)، همون مدل روی CPU
          return ep === 'wasm' ? pose : selfTest(ort, pose).then(function (ok) {
            if (ok) return pose;
            if (root.console) console.warn('rtmpose webgpu: invalid output, using wasm');
            ep = 'wasm'; try { pose.release(); } catch (e) { /* */ }
            return ort.InferenceSession.create(abs(POSE), opt('wasm'));
          });
        }).then(function (pose) { var en = engine(ort, det, pose); en.backend = ep; return en; });
      });
    });
  }

  function selfTest(ort, s) {
    var x = new Float32Array(3 * PW * PH);
    for (var i = 0; i < x.length; i++) x[i] = Math.sin(i * 0.37);
    var feeds = {}; feeds[s.inputNames[0]] = new ort.Tensor('float32', x, [1, 3, PH, PW]);
    return s.run(feeds).then(function (o) {
      var d = o[s.outputNames[0]].data, lo = Infinity, hi = -Infinity;
      for (var j = 0; j < d.length; j++) { if (!isFinite(d[j])) return false; lo = Math.min(lo, d[j]); hi = Math.max(hi, d[j]); }
      return hi - lo > 1e-3;
    }).catch(function () { return false; });
  }
  function engine(ort, sDet, sPose) {
    var dc = canvas(DS, DS), pc = canvas(PW, PH), dx = dc.getContext('2d', { willReadFrequently: true }), px = pc.getContext('2d', { willReadFrequently: true });
    var box = null, n = 0;
    // تصویر بوم → داده‌ی CHW به ترتیب BGR (مثل OpenCV در آزمایش)؛ norm: با میانگین و انحراف معیار. out/off: نوشتن داخل یک دسته
    function pixels(ctx, w, h, norm, out, off) {
      var d = ctx.getImageData(0, 0, w, h).data, s = w * h;
      out = out || new Float32Array(3 * s); off = off || 0;
      for (var i = 0; i < s; i++) {
        var r = d[4 * i], g = d[4 * i + 1], b = d[4 * i + 2], o = off + i;
        if (norm) { out[o] = (b - MEAN[0]) / STD[0]; out[s + o] = (g - MEAN[1]) / STD[1]; out[2 * s + o] = (r - MEAN[2]) / STD[2]; }
        else { out[o] = b; out[s + o] = g; out[2 * s + o] = r; }
      }
      return out;
    }
    function tensor(ctx, w, h, norm) { return new ort.Tensor('float32', pixels(ctx, w, h, norm), [1, 3, h, w]); }
    // بزرگ‌ترین آدم (دونده معمولاً نزدیک‌ترین آدم به دوربینه)؛ کادر به پیکسل همون بوم ورودی
    function detect(src, W, H) {
      var r = Math.min(DS / H, DS / W), feeds = {};
      dx.setTransform(1, 0, 0, 1, 0, 0); dx.fillStyle = 'rgb(114,114,114)'; dx.fillRect(0, 0, DS, DS);
      dx.drawImage(src, 0, 0, Math.floor(W * r), Math.floor(H * r));
      feeds[sDet.inputNames[0]] = tensor(dx, DS, DS, false);
      return sDet.run(feeds).then(function (o) {
        var t = o[sDet.outputNames[0]], d = t.data, k = t.dims[1], best = null, ba = 0;
        for (var i = 0; i < k; i++) {
          if (d[5 * i + 4] < 0.3) continue;
          var x1 = d[5 * i] / r, y1 = d[5 * i + 1] / r, x2 = d[5 * i + 2] / r, y2 = d[5 * i + 3] / r, a = (x2 - x1) * (y2 - y1);
          if (a > ba) { ba = a; best = [x1, y1, x2, y2]; }
        }
        return best;
      });
    }
    // کادر → پنجره‌ی برش (×۱٫۲۵ با نسبت ۱۹۲×۲۵۶) کشیده‌شده روی بوم کوچک
    function crop(src, W, H, b) {
      var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, w = (b[2] - b[0]) * 1.25, h = (b[3] - b[1]) * 1.25, ar = PW / PH;
      if (w > h * ar) h = w / ar; else w = h * ar;
      var k = PW / w;
      px.setTransform(1, 0, 0, 1, 0, 0); px.fillStyle = '#000'; px.fillRect(0, 0, PW, PH);
      px.setTransform(k, 0, 0, k, -(cx - w / 2) * k, -(cy - h / 2) * k); px.drawImage(src, 0, 0, W, H);
      px.setTransform(1, 0, 0, 1, 0, 0);
      return { cx: cx, cy: cy, w: w, h: h };
    }
    // خروجی SimCC نمونه‌ی i ام دسته → نقاط به پیکسل بوم ورودی
    function decode(o, i, c) {
      var sx = o[sPose.outputNames[0]], sy = o[sPose.outputNames[1]], K = sx.dims[1], WX = sx.dims[2], WY = sy.dims[2], kp = [];
      var ox = i * K * WX, oy = i * K * WY;
      for (var j = 0; j < K; j++) {
        var bx = 0, mx = -Infinity, by = 0, my = -Infinity, q;
        for (q = 0; q < WX; q++) { var vx = sx.data[ox + j * WX + q]; if (vx > mx) { mx = vx; bx = q; } }
        for (q = 0; q < WY; q++) { var vy = sy.data[oy + j * WY + q]; if (vy > my) { my = vy; by = q; } }
        kp.push([bx / 2 / PW * c.w + c.cx - c.w / 2, by / 2 / PH * c.h + c.cy - c.h / 2, (mx + my) / 2]);
      }
      return kp;
    }
    function pose(src, W, H, b) {
      var c = crop(src, W, H, b), feeds = {};
      feeds[sPose.inputNames[0]] = tensor(px, PW, PH, true);
      return sPose.run(feeds).then(function (o) { return decode(o, 0, c); });
    }
    // میانگین اطمینان ۱۷ نقطه‌ی بدن؛ کمتر از ۰٫۳ یعنی دونده گم شده
    function bodyOk(kp) { var body = 0; for (var i = 0; i < 17; i++) body += kp[i][2]; return body / 17 >= 0.3; }
    function kpBox(kp) {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      kp.forEach(function (p) { if (p[2] > 0.2) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } });
      return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : null;
    }
    // سرعت کادر (جابه‌جایی مرکز بین دو فریم تحلیل‌شده‌ی پشت‌سرهم، هر دو از نقاط)؛ فقط حالت دسته‌ای ازش استفاده می‌کنه
    // مرکز تنه (دو شونه و دو لگن)، نه مرکز کادر: کادر با تاب خوردن دست و پا عوض می‌شه و سرعت رو اشتباه نشون می‌ده
    var kb = null, vel = null;
    function track(kp) {
      var nb = kpBox(kp), t = [5, 6, 11, 12], c = [0, 0];
      t.forEach(function (i) { c[0] += kp[i][0] / 4; c[1] += kp[i][1] / 4; });
      // فقط افقی: بالا و پایین رفتن تنه در هر گام رفت‌وبرگشتیه و ادامه دادنش پیش‌بینی رو خراب می‌کنه
      if (nb && kb) vel = [c[0] - kb[0], 0]; else vel = null;
      kb = nb ? c : null;
      if (nb) box = nb;
    }
    function lost() { box = null; kb = null; vel = null; }
    // یک فریم (بوم با اندازه‌ی W×H) → ۳۳ نقطه‌ی نرمال‌شده یا null
    function run(src) {
      var W = src.width, H = src.height;
      var need = !box || n % DET_EVERY === 0;
      n++;
      return (need ? detect(src, W, H).then(function (b) { if (b) box = b; }) : Promise.resolve()).then(function () {
        if (!box) return null;
        return pose(src, W, H, box).then(function (kp) {
          if (!bodyOk(kp)) { lost(); return null; }
          // کادر فریم بعد از همین نقاط (RTMPose خودش ×۱٫۲۵ حاشیه می‌گیره)
          track(kp);
          return to33(kp, W, H);
        });
      });
    }
    // آزمایشی (?batch=1): چند فریم با هم در یک اجرای مدل (روی پردازنده‌ی گرافیکی هزینه‌ی هر اجرا زیاده، نه هر فریم).
    // کادر هر فریم دسته از پیش‌بینی حرکت افقی تنه (دو فریم آخر)؛ از اولین فریمی که دونده رو گم کرد یا تنه‌اش از جای پیش‌بینی‌شده
    // دور بود (پیش‌بینی غلط، مثلاً دوربین دستی)، دوباره: همون فریم یکی‌یکی و بقیه دسته‌ی بعدی. تشخیص آدم مثل قبل هر ۱۵ فریم.
    // stats: batched = فریم‌های قبول‌شده‌ی دسته‌ای، redo = دفعه‌هایی که پیش‌بینی رد شد
    var stats = { batched: 0, redo: 0 };
    function runBatch(list) {
      var out = [];
      function go(k) {
        if (k >= list.length) return Promise.resolve(out);
        // فریم اول هر تکه یکی‌یکی (با تشخیص آدم اگه وقتشه)
        return run(list[k]).then(function (lm) {
          out.push(lm); k++;
          // تکه تا فریم تشخیص بعدی (که باید یکی‌یکی باشه)
          var m = 0; while (k + m < list.length && (n + m) % DET_EVERY !== 0) m++;
          if (m < 2 || !box || !vel) return go(k);
          return chunk(list.slice(k, k + m)).then(function (r) {
            for (var j = 0; j < r.length; j++) out.push(r[j]);
            stats.batched += r.length;
            if (r.length < m) stats.redo++;
            return go(k + r.length);
          });
        });
      }
      return go(0);
    }
    // تکه‌ی پشت‌سرهم با کادرهای پیش‌بینی‌شده؛ خروجی فقط فریم‌های قبول‌شده از اول تکه (بقیه دوباره با run)
    function chunk(cs) {
      var W = cs[0].width, H = cs[0].height, s = PW * PH, data = new Float32Array(cs.length * 3 * s), crops = [], feeds = {};
      var b0 = box, v0 = vel, t0 = kb;
      for (var j = 0; j < cs.length; j++) {
        var dx0 = v0[0] * (j + 1), dy0 = v0[1] * (j + 1);
        crops.push(crop(cs[j], W, H, [b0[0] + dx0, b0[1] + dy0, b0[2] + dx0, b0[3] + dy0]));
        pixels(px, PW, PH, true, data, j * 3 * s);
      }
      feeds[sPose.inputNames[0]] = new ort.Tensor('float32', data, [cs.length, 3, PH, PW]);
      return sPose.run(feeds).then(function (o) {
        var res = [];
        for (var j = 0; j < cs.length; j++) {
          var kp = decode(o, j, crops[j]), c = crops[j];
          if (!bodyOk(kp) || !inside(kp, c, [t0[0] + v0[0] * (j + 1), t0[1] + v0[1] * (j + 1)])) break;
          n++; track(kp); res.push(to33(kp, W, H));
        }
        return res;
      });
    }
    // پیش‌بینی درست بود اگه مرکز تنه‌ی پیدا‌شده نزدیک مرکز پیش‌بینی‌شده باشه (حداکثر ۸٪ اندازه‌ی برش)
    function inside(kp, c, p) {
      var x = 0, y = 0;
      [5, 6, 11, 12].forEach(function (i) { x += kp[i][0] / 4; y += kp[i][1] / 4; });
      return Math.abs(x - p[0]) <= c.w * 0.08 && Math.abs(y - p[1]) <= c.h * 0.08;
    }
    function to33(kp, W, H) {
      var lm = [], v = function (s) { return Math.round(Math.max(0, Math.min(1, s / VIS)) * 1000) / 1000; };
      for (var i = 0; i < 33; i++) lm.push(null);
      Object.keys(MAP).forEach(function (h) { var p = kp[h]; lm[MAP[h]] = [p[0] / W, p[1] / H, v(p[2]), 0]; });
      // نوک پا = وسط شست و انگشت کوچک (مثل foot_index در MediaPipe)
      [[31, 20, 22], [32, 21, 23]].forEach(function (a) { var b = kp[a[1]], c = kp[a[2]]; lm[a[0]] = [(b[0] + c[0]) / 2 / W, (b[1] + c[1]) / 2 / H, v(Math.min(b[2], c[2])), 0]; });
      // نقطه‌هایی که این مدل نداره (گوشه‌های چشم، دهان، انگشت‌های دست): همون جای بینی یا مچ دست، با دیده‌شدن صفر
      [1, 3, 4, 6, 9, 10].forEach(function (k) { lm[k] = [lm[0][0], lm[0][1], 0, 0]; });
      [17, 19, 21].forEach(function (k) { lm[k] = [lm[15][0], lm[15][1], 0, 0]; });
      [18, 20, 22].forEach(function (k) { lm[k] = [lm[16][0], lm[16][1], 0, 0]; });
      return lm;
    }
    return {
      name: 'rtmpose-m',
      // هر فیلم از اول: کادر قبلی به فیلم تازه ربطی نداره
      reset: function () { lost(); n = 0; stats = { batched: 0, redo: 0 }; },
      detect: run,
      detectBatch: runBatch,
      stats: function () { return stats; },
      close: function () { try { sDet.release(); sPose.release(); } catch (e) { /* */ } }
    };
  }

  root.CoachRtm = { create: create };
})(this);
