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
  // Halpe26 → شماره‌ی نقطه در MediaPipe
  var MAP = { 0: 0, 3: 7, 4: 8, 5: 11, 6: 12, 7: 13, 8: 14, 9: 15, 10: 16, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28, 24: 29, 25: 30 };
  // اطمینان SimCC مثل «دیده‌شدن» MediaPipe کالیبره نیست: ۰٫۵ و بیشتر = کاملاً دیده‌شده (همون فرض آزمایش)
  var VIS = 0.5;
  function abs(p) { return new URL(p, document.baseURI).href; }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function create() {
    return import(abs(ORT + 'ort.wasm.min.mjs')).then(function (m) {
      var ort = m.InferenceSession ? m : m.default;
      ort.env.wasm.wasmPaths = abs(ORT);
      // چندنخی به crossOriginIsolated نیاز داره (سرآیندهایی که GitHub Pages نمی‌ده)
      ort.env.wasm.numThreads = 1;
      var o = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
      return Promise.all([ort.InferenceSession.create(abs(DET), o), ort.InferenceSession.create(abs(POSE), o)]).then(function (s) { return engine(ort, s[0], s[1]); });
    });
  }

  function engine(ort, sDet, sPose) {
    var dc = canvas(DS, DS), pc = canvas(PW, PH), dx = dc.getContext('2d', { willReadFrequently: true }), px = pc.getContext('2d', { willReadFrequently: true });
    var box = null, n = 0;
    // تصویر بوم → تنسور CHW به ترتیب BGR (مثل OpenCV در آزمایش)؛ norm: با میانگین و انحراف معیار
    function tensor(ctx, w, h, norm) {
      var d = ctx.getImageData(0, 0, w, h).data, s = w * h, out = new Float32Array(3 * s);
      for (var i = 0; i < s; i++) {
        var r = d[4 * i], g = d[4 * i + 1], b = d[4 * i + 2];
        if (norm) { out[i] = (b - MEAN[0]) / STD[0]; out[s + i] = (g - MEAN[1]) / STD[1]; out[2 * s + i] = (r - MEAN[2]) / STD[2]; }
        else { out[i] = b; out[s + i] = g; out[2 * s + i] = r; }
      }
      return new ort.Tensor('float32', out, [1, 3, h, w]);
    }
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
    function pose(src, W, H, b) {
      var cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, w = (b[2] - b[0]) * 1.25, h = (b[3] - b[1]) * 1.25, ar = PW / PH;
      if (w > h * ar) h = w / ar; else w = h * ar;
      var k = PW / w, feeds = {};
      px.setTransform(1, 0, 0, 1, 0, 0); px.fillStyle = '#000'; px.fillRect(0, 0, PW, PH);
      px.setTransform(k, 0, 0, k, -(cx - w / 2) * k, -(cy - h / 2) * k); px.drawImage(src, 0, 0, W, H);
      px.setTransform(1, 0, 0, 1, 0, 0);
      feeds[sPose.inputNames[0]] = tensor(px, PW, PH, true);
      return sPose.run(feeds).then(function (o) {
        var sx = o[sPose.outputNames[0]], sy = o[sPose.outputNames[1]], K = sx.dims[1], WX = sx.dims[2], WY = sy.dims[2], kp = [];
        for (var j = 0; j < K; j++) {
          var bx = 0, mx = -Infinity, by = 0, my = -Infinity, q;
          for (q = 0; q < WX; q++) { var vx = sx.data[j * WX + q]; if (vx > mx) { mx = vx; bx = q; } }
          for (q = 0; q < WY; q++) { var vy = sy.data[j * WY + q]; if (vy > my) { my = vy; by = q; } }
          kp.push([bx / 2 / PW * w + cx - w / 2, by / 2 / PH * h + cy - h / 2, (mx + my) / 2]);
        }
        return kp;
      });
    }
    // یک فریم (بوم با اندازه‌ی W×H) → ۳۳ نقطه‌ی نرمال‌شده یا null
    function run(src) {
      var W = src.width, H = src.height;
      var need = !box || n % DET_EVERY === 0;
      n++;
      return (need ? detect(src, W, H).then(function (b) { if (b) box = b; }) : Promise.resolve()).then(function () {
        if (!box) return null;
        return pose(src, W, H, box).then(function (kp) {
          var body = 0; for (var i = 0; i < 17; i++) body += kp[i][2];
          if (body / 17 < 0.3) { box = null; return null; }
          // کادر فریم بعد از همین نقاط (RTMPose خودش ×۱٫۲۵ حاشیه می‌گیره)
          var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          kp.forEach(function (p) { if (p[2] > 0.2) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } });
          if (x1 > x0 && y1 > y0) box = [x0, y0, x1, y1];
          return to33(kp, W, H);
        });
      });
    }
    function to33(kp, W, H) {
      var lm = [], v = function (s) { return Math.round(Math.max(0, Math.min(1, s / VIS)) * 1000) / 1000; };
      for (var i = 0; i < 33; i++) lm.push(null);
      Object.keys(MAP).forEach(function (h) { var p = kp[h]; lm[MAP[h]] = [p[0] / W, p[1] / H, v(p[2]), 0]; });
      // نوک پا = وسط شست و انگشت کوچک (مثل foot_index در MediaPipe)
      [[31, 20, 22], [32, 21, 23]].forEach(function (a) { var b = kp[a[1]], c = kp[a[2]]; lm[a[0]] = [(b[0] + c[0]) / 2 / W, (b[1] + c[1]) / 2 / H, v(Math.min(b[2], c[2])), 0]; });
      // نقطه‌هایی که این مدل نداره (چشم، دهان، انگشت‌های دست): همون جای بینی یا مچ دست، با دیده‌شدن صفر
      [1, 2, 3, 4, 5, 6, 9, 10].forEach(function (k) { lm[k] = [lm[0][0], lm[0][1], 0, 0]; });
      [17, 19, 21].forEach(function (k) { lm[k] = [lm[15][0], lm[15][1], 0, 0]; });
      [18, 20, 22].forEach(function (k) { lm[k] = [lm[16][0], lm[16][1], 0, 0]; });
      return lm;
    }
    return {
      name: 'rtmpose-m',
      // هر فیلم از اول: کادر قبلی به فیلم تازه ربطی نداره
      reset: function () { box = null; n = 0; },
      detect: run,
      close: function () { try { sDet.release(); sPose.release(); } catch (e) { /* */ } }
    };
  }

  root.CoachRtm = { create: create };
})(this);
