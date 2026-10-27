/*
 * استخراج نقاط کلیدی بدن از ویدیو با MediaPipe Pose، کاملاً داخل مرورگر.
 * کتابخانه (js/vendor/mediapipe) و مدل (models/) از خود اپ بارگذاری می‌شن و فقط وقتی کاربر تحلیل رو شروع کنه؛
 * ویدیو هیچ‌وقت از دستگاه خارج نمی‌شه (CSP در index.html هم هر اتصال بیرونی رو می‌بنده).
 * خروجی: { w, h, duration, frames: [{ t, lm: [[x, y, visibility] × ۳۳] | null }] } برای js/gait.js
 */
(function (root) {
  'use strict';
  var BASE = 'js/vendor/mediapipe/', MODEL = 'models/pose_landmarker_full.task';
  // نمونه‌برداری با نرخ فریم خود فیلم، حداکثر ۶۰ در ثانیه (اگه نرخ فیلم معلوم نشد، ۳۰)
  var MAX_SEC = 12, MAX_FPS = 60, DEF_FPS = 30;
  var landmarker = null, loading = null, clock = 0;

  function abs(p) { return new URL(p, document.baseURI).href; }
  function load() {
    if (landmarker) return Promise.resolve(landmarker);
    if (loading) return loading;
    loading = import(abs(BASE + 'vision_bundle.mjs')).then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(abs(BASE + 'wasm')).then(function (fs) {
        var opts = function (delegate) {
          return { baseOptions: { modelAssetPath: abs(MODEL), delegate: delegate }, runningMode: 'VIDEO', numPoses: 1,
            minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 };
        };
        // GPU اگه باشه؛ وگرنه CPU
        return mp.PoseLandmarker.createFromOptions(fs, opts('GPU')).catch(function () { return mp.PoseLandmarker.createFromOptions(fs, opts('CPU')); });
      });
    }).then(function (lm) { landmarker = lm; return lm; }, function (e) { loading = null; throw e; });
    return loading;
  }

  // آزاد کردن کامل تحلیلگر (گرافیک WebGL و حافظه‌ی WebAssembly)؛ بار بعد از کش دوباره ساخته می‌شه.
  // روی آیفون نگه داشتنش بعد از تحلیل، حافظه‌ی صفحه رو پر می‌کرد و بقیه‌ی صفحه‌ها کشیده نمی‌شدن.
  function unload() {
    var l = landmarker;
    landmarker = null; loading = null;
    if (l) { try { l.close(); } catch (e) { /* */ } }
  }
  function once(el, ev, ms) {
    return new Promise(function (res, rej) {
      var to = setTimeout(function () { done(); rej(new Error('timeout: ' + ev)); }, ms || 8000);
      function h() { done(); res(); }
      function done() { clearTimeout(to); el.removeEventListener(ev, h); }
      el.addEventListener(ev, h);
    });
  }
  // سافاری آیفون ویدیویی رو که در صفحه نیست یا یک بار پخش نشده بارگذاری نمی‌کنه و جابه‌جایی (seek) روش مطمئن نیست؛
  // پس ویدیو (پنهان) به صفحه اضافه می‌شه، بی‌صدا یک لحظه پخش و متوقف می‌شه، و هر فریم اول روی بوم کشیده می‌شه.
  function fail(code, e) { var err = new Error(code + (e && e.message ? ': ' + e.message : '')); err.code = code; return err; }
  function openVideo(file) {
    var v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    ['playsinline', 'webkit-playsinline', 'muted'].forEach(function (a) { v.setAttribute(a, ''); });
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
    document.body.appendChild(v);
    v.src = URL.createObjectURL(file);
    v.load();
    return once(v, 'loadedmetadata', 30000).catch(function (e) { throw fail('open', e); }).then(function () {
      if (v.readyState >= 2) return;
      // پخش بی‌صدا برای اینکه سافاری داده‌ی فریم‌ها رو بارگذاری کنه
      var pl = v.play();
      return Promise.race([pl && pl.then ? pl.catch(function () {}) : Promise.resolve(), once(v, 'loadeddata', 15000).catch(function () {})])
        .then(function () { v.pause(); });
    }).then(function () {
      // بعضی فایل‌ها (مثلاً ضبط مرورگر) مدت ندارن تا وقتی یک بار تا انتها رفته بشه
      if (isFinite(v.duration) && v.duration > 0) return;
      v.currentTime = 1e7;
      return once(v, 'seeked', 20000).then(function () { v.currentTime = 0; return once(v, 'seeked', 20000); });
    }).then(function () {
      if (!(v.duration > 0) || !v.videoWidth) throw fail('meta');
      return v;
    });
  }
  function seek(v, t) {
    if (Math.abs(v.currentTime - t) < 1e-4 && v.readyState >= 2) return Promise.resolve();
    v.currentTime = t;
    return once(v, 'seeked', 15000).then(function () {
      // صبر تا فریم تازه واقعاً آماده‌ی کشیدن بشه (اگه مرورگر پشتیبانی کنه)
      if (v.readyState >= 2 || !v.requestVideoFrameCallback) return;
      return new Promise(function (res) { var done = false; v.requestVideoFrameCallback(function () { if (!done) { done = true; res(); } }); setTimeout(function () { if (!done) { done = true; res(); } }, 400); });
    }).catch(function (e) { throw fail('seek', e); });
  }
  // نرخ فریم فیلم: چند فریم پخش بی‌صدا و فاصله‌ی زمان رسانه‌ای فریم‌ها (requestVideoFrameCallback).
  // فریم‌های جاافتاده موقع پخش با presentedFrames جبران می‌شن. بدون پشتیبانی مرورگر: null
  function measureFps(v) {
    if (!v.requestVideoFrameCallback) return Promise.resolve(null);
    return new Promise(function (res) {
      var last = null, per = [], done = false;
      function finish() {
        if (done) return; done = true;
        try { v.pause(); } catch (e) { /* */ }
        var d = per.sort(function (a, b) { return a - b; })[Math.floor(per.length / 2)];
        var fps = d > 0 ? 1 / d : null;
        res(fps && fps >= 10 && fps <= 260 ? Math.round(fps) : null);
      }
      function cb(now, md) {
        if (done) return;
        if (last && md.presentedFrames > last.f && md.mediaTime > last.t) per.push((md.mediaTime - last.t) / (md.presentedFrames - last.f));
        last = { t: md.mediaTime, f: md.presentedFrames };
        if (per.length >= 12) finish(); else v.requestVideoFrameCallback(cb);
      }
      v.requestVideoFrameCallback(cb);
      setTimeout(finish, 1500);
      var pl = v.play();
      if (pl && pl.catch) pl.catch(finish);
    });
  }
  // گام نمونه‌برداری از نرخ فریم اندازه‌گیری‌شده. اندازه‌گیری با پخش ویدیوی پنهان انجام می‌شه و Safari آیفون
  // همه‌ی فریم‌های ویدیوی نامرئی رو نمی‌کشه، پس عدد کمتر از واقعی درمیاد (مثلاً ۱۵ به‌جای ۳۰). عدد زیر ۲۴ قابل‌اعتماد
  // نیست و نادیده گرفته می‌شه: نمونه‌برداری هیچ‌وقت کمتر از ۳۰ در ثانیه (رفتار پیش از نسخه‌ی ۷۸) نمی‌شه.
  function sampleStep(measured) {
    var ok = measured != null && measured >= 24 && measured <= 260;
    return { step: 1 / (ok ? Math.min(measured, MAX_FPS) : DEF_FPS), fps: ok ? measured : null };
  }
  function recreateCpu() {
    landmarker = null; loading = null;
    return import(abs(BASE + 'vision_bundle.mjs')).then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(abs(BASE + 'wasm')).then(function (fs) {
        return mp.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: abs(MODEL), delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1,
          minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      });
    }).then(function (l) { landmarker = l; return l; });
  }
  // هر فریم (با نرخ فیلم تا ۶۰ در ثانیه، حداکثر ۱۲ ثانیه): جابه‌جایی روی ویدیو، کشیدن روی بوم و تشخیص بدن
  function processVideo(file, onProgress) {
    var lmk, v, cv, g, retried = false, srcFps = null, STEP = 1 / DEF_FPS;
    return load().then(function (l) { lmk = l; return openVideo(file); }).then(function (video) {
      v = video;
      return measureFps(v).then(function (f) { var s = sampleStep(f); srcFps = s.fps; STEP = s.step; });
    }).then(function () {
      var dur = Math.min(v.duration || 0, MAX_SEC);
      if (!(dur > 0.5)) throw fail('short');
      // اندازه‌ی کار: ضلع بزرگ حداکثر ۹۶۰px (دقت کافی، سرعت بیشتر)
      var sc = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight));
      cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * sc); cv.height = Math.round(v.videoHeight * sc);
      g = cv.getContext('2d');
      var n = Math.floor(dur / STEP), frames = [], i = 0;
      function detect() {
        // زمان‌های ارسالی به MediaPipe باید همیشه صعودی باشن (بین دو ویدیو هم)؛ گام زمانی = فاصله‌ی واقعی فریم‌ها
        clock += Math.max(1, Math.round(STEP * 1000));
        try { return Promise.resolve(lmk.detectForVideo(cv, clock)); } catch (e) {
          // پردازنده‌ی گرافیکی بعضی گوشی‌ها: یک بار دیگه با CPU
          if (retried) return Promise.reject(fail('detect', e));
          retried = true;
          return recreateCpu().then(function (l) { lmk = l; clock += 34; return lmk.detectForVideo(cv, clock); }).catch(function (e2) { throw fail('detect', e2); });
        }
      }
      function next() {
        if (i >= n) return { w: v.videoWidth, h: v.videoHeight, duration: dur, frames: frames, video: v, fps: srcFps };
        var t = i * STEP + 0.001;
        return seek(v, t).then(function () {
          g.drawImage(v, 0, 0, cv.width, cv.height);
          return detect();
        }).then(function (r) {
          var p = r && r.landmarks && r.landmarks[0];
          frames.push({ t: t, lm: p ? p.map(function (q) { return [q.x, q.y, q.visibility == null ? 1 : q.visibility]; }) : null });
          i++;
          if (onProgress && i % 3 === 0) onProgress(i / n);
          return next();
        });
      }
      return next();
    }).catch(function (e) { if (v) release(v); throw e.code ? e : fail('video', e); });
  }

  // تصویر فریم نمونه با اسکلت و زاویه‌ی مورد نظر (برای گزارش)
  // رنگ‌های بوم از متغیرهای css/theme.css (بوم var() نمی‌فهمه، پس مقدارشون خونده می‌شه)؛ a = شفافیت اختیاری
  function tok(name, a) {
    var v = (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(v);
    if (!m || a == null) return v;
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + a + ')';
  }
  var LINKS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
    [24, 26], [26, 28], [28, 30], [30, 32], [28, 32], [7, 11], [8, 12], [0, 7], [0, 8]];
  function keyImage(video, t, lm, opts) {
    opts = opts || {};
    return seek(video, t).then(function () {
      var W = Math.min(480, video.videoWidth), H = Math.round(video.videoHeight * W / video.videoWidth);
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d');
      g.drawImage(video, 0, 0, W, H);
      if (lm) {
        var pt = function (k) { return [lm[k][0] * W, lm[k][1] * H]; };
        g.lineWidth = 3; g.strokeStyle = tok('--primary', 0.9); g.lineCap = 'round';
        LINKS.forEach(function (l) { var a = pt(l[0]), b = pt(l[1]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
        (opts.focus || []).forEach(function (k) {
          var p = pt(k); g.fillStyle = tok('--error'); g.beginPath(); g.arc(p[0], p[1], 6, 0, Math.PI * 2); g.fill();
          g.lineWidth = 2; g.strokeStyle = tok('--text'); g.stroke();
        });
        if (opts.label && opts.labelAt != null) {
          var q = pt(opts.labelAt);
          g.direction = /[\u0600-\u06FF]/.test(opts.label) ? 'rtl' : 'ltr'; g.textAlign = 'left';
          g.font = '600 15px Vazirmatn, sans-serif';
          var w = g.measureText(opts.label).width + 12;
          var x = Math.min(W - w - 4, q[0] + 10), y = Math.max(4, q[1] - 30);
          g.fillStyle = tok('--bg', 0.85); g.fillRect(x, y, w, 24);
          g.fillStyle = tok('--text'); g.fillText(opts.label, x + 6, y + 17);
        }
      }
      return c.toDataURL('image/jpeg', 0.72);
    });
  }
  function release(video) {
    if (!video) return;
    if (video.src) { URL.revokeObjectURL(video.src); video.removeAttribute('src'); video.load(); }
    if (video.parentNode) video.parentNode.removeChild(video);
  }

  // ---------- پخش انیمیشنی: اسکلت روی فریم‌های خود ویدیو، هم‌زمان با دویدن ----------
  var LEFT = { 11: 1, 13: 1, 15: 1, 23: 1, 25: 1, 27: 1, 29: 1, 31: 1, 7: 1 }, RIGHT = { 12: 1, 14: 1, 16: 1, 24: 1, 26: 1, 28: 1, 30: 1, 32: 1, 8: 1 };
  // چپ = info، راست = zone-4، وسط = text، مشکل = error (موقع رسم خونده می‌شن)
  function COLS() { return { l: tok('--info'), r: tok('--zone-4'), c: tok('--text'), bad: tok('--error') }; }
  // صاف کردن ملایم برای نمایش (لرزش نقاط کمتر)، فقط بین فریم‌های پشت‌سرهم
  function smoothFrames(F) {
    return F.map(function (f, i) {
      if (!f || !f.lm) return null;
      return f.lm.map(function (p, k) {
        var sx = 0, sy = 0, c = 0;
        for (var j = i - 1; j <= i + 1; j++) { var q = F[j] && F[j].lm; if (q) { sx += q[k][0]; sy += q[k][1]; c++; } }
        return [sx / c, sy / c, p[2]];
      });
    });
  }
  // نقاط در زمان t با درون‌یابی بین دو فریم؛ dt = فاصله‌ی نمونه‌برداری همون فیلم (۳۰ یا ۶۰ در ثانیه)
  function lmAt(S, t, dt) {
    var x = Math.max(0, (t - 0.001) / dt), i = Math.floor(x), f = x - i, a = S[i], b = S[i + 1];
    if (a && b) return a.map(function (p, k) { return [p[0] + (b[k][0] - p[0]) * f, p[1] + (b[k][1] - p[1]) * f, p[2]]; });
    return a || b || S[i - 1] || null;
  }
  function angleAt(lm, a, b, c, W, H) {
    var v1x = (lm[a][0] - lm[b][0]) * W, v1y = (lm[a][1] - lm[b][1]) * H, v2x = (lm[c][0] - lm[b][0]) * W, v2y = (lm[c][1] - lm[b][1]) * H;
    var d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    return d ? Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180 / Math.PI : null;
  }
  function tag(g, text, x, y, W, color) {
    // جهت متن بوم از صفحه (راست‌به‌چپ) ارث می‌بره و متن از جعبه‌ش جدا می‌افته؛ همیشه چپ‌به‌راست با تراز چپ
    // جهت متن بر اساس خود برچسب (فارسی راست‌به‌چپ تا علامت درجه درست بیفته)؛ تراز «left» مطلقه
    g.direction = /[\u0600-\u06FF]/.test(text) ? 'rtl' : 'ltr'; g.textAlign = 'left';
    g.font = '700 ' + Math.round(Math.max(13, W / 34)) + 'px Vazirmatn, sans-serif';
    var w = g.measureText(text).width + 12, h = Math.round(Math.max(20, W / 22));
    x = Math.max(4, Math.min(W - w - 4, x)); y = Math.max(4, y);
    g.fillStyle = tok('--bg', 0.82); g.fillRect(x, y, w, h);
    g.fillStyle = color || tok('--text'); g.fillText(text, x + 6, y + h * 0.72);
  }
  function drawOverlay(g, lm, W, H, o) {
    var pt = function (k) { return [lm[k][0] * W, lm[k][1] * H]; }, lw = Math.max(2.5, W / 160), r = Math.max(4, W / 110), COL = COLS(), TXT = tok('--text');
    g.lineCap = 'round';
    LINKS.forEach(function (l) {
      var a = pt(l[0]), b = pt(l[1]), side = LEFT[l[0]] && LEFT[l[1]] ? 'l' : RIGHT[l[0]] && RIGHT[l[1]] ? 'r' : 'c';
      g.strokeStyle = tok('--bg', 0.45); g.lineWidth = lw + 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.strokeStyle = COL[side]; g.lineWidth = lw; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    });
    for (var k = 11; k <= 32; k++) {
      if (k > 16 && k < 23) continue; // انگشت‌های دست
      var p = pt(k), bad = o.bad && o.bad.indexOf(k) >= 0;
      g.beginPath(); g.arc(p[0], p[1], bad ? r * 1.6 : r, 0, Math.PI * 2);
      g.fillStyle = bad ? COL.bad : TXT; g.fill();
      g.lineWidth = 2; g.strokeStyle = bad ? TXT : (LEFT[k] ? COL.l : COL.r); g.stroke();
    }
    // زاویه‌های زنده (مثلاً خم زانو و آرنج سمت نزدیک)
    (o.angles || []).forEach(function (a) {
      var v = angleAt(lm, a.k[0], a.k[1], a.k[2], W, H);
      if (v == null) return;
      var val = a.flex ? 180 - v : v, q = pt(a.k[1]);
      tag(g, a.label + ' ' + o.digits(Math.round(val)) + '°', q[0] + r * 2, q[1] - r * 4, W, a.bad ? COL.bad : TXT);
    });
    // از پشت: خط لگن و خط افق برای دیدن افت لگن
    if (o.back) {
      var l = pt(23), rr = pt(24), cx = (l[0] + rr[0]) / 2, cy = (l[1] + rr[1]) / 2, hw = Math.abs(rr[0] - l[0]) * 0.9;
      g.setLineDash([6, 5]); g.strokeStyle = tok('--text', 0.8); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx - hw, cy); g.lineTo(cx + hw, cy); g.stroke(); g.setLineDash([]);
      var tilt = Math.atan2(rr[1] - l[1], Math.abs(rr[0] - l[0]) || 1) * 180 / Math.PI;
      tag(g, o.labels.pelvis + ' ' + o.digits(Math.abs(Math.round(tilt))) + '°', cx + hw + 6, cy - 12, W, o.pelvisBad ? COL.bad : TXT);
    }
  }
  // پخش‌کننده: خود ویدیو با کنترل‌های استاندارد مرورگر (<video controls playsinline>) و یک لایه‌ی بوم شفاف
  // روی اون فقط برای اسکلت (pointer-events: none، پس کنترل‌ها همیشه قابل لمس‌ان). لایه‌ی اسکلت روشن و خاموش می‌شه
  // (نسخه‌ی اصلی / نسخه‌ی با اسکلت). stage: جای پخش‌کننده در صفحه؛ file: فایل خود کاربر (فقط در همین نشست)
  // o: { angles, bad, back, pelvisBad, strikes (زمان‌های فرود)، labels، digits، startAt، onError(code) }
  function player(stage, file, data, o) {
    o = o || {};
    o.digits = o.digits || String;
    var S = smoothFrames(data.frames), F = data.frames;
    var dt = F.length > 1 ? (F[F.length - 1].t - F[0].t) / (F.length - 1) : 1 / 30;
    var video = document.createElement('video'), canvas = document.createElement('canvas'), g = canvas.getContext('2d');
    video.controls = true; video.muted = true; video.defaultMuted = true; video.playsInline = true; video.preload = 'auto';
    ['playsinline', 'webkit-playsinline', 'muted'].forEach(function (a) { video.setAttribute(a, ''); });
    canvas.className = 'gp-overlay'; canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(video); stage.appendChild(canvas);
    var url = URL.createObjectURL(file), dead = false, overlay = o.overlay !== false, W = 0, H = 0, vfc = 0, raf = 0, rec = null;
    // تصویر اول تا پخش (Safari آیفون تا قبل از پخش فریمی بار نمی‌کنه)
    if (o.poster) video.poster = o.poster;
    video.src = url;
    function size() {
      if (!video.videoWidth) return;
      W = Math.min(720, video.videoWidth); H = Math.round(video.videoHeight * W / video.videoWidth);
      canvas.width = W; canvas.height = H;
    }
    // t: زمان رسانه‌ای فریمی که الان روی صفحه‌ست. حین پخش، currentTime از فریم کشیده‌شده جلوتره (تا چند فریم)؛
    // برای همین در requestVideoFrameCallback از metadata.mediaTime همون فریم استفاده می‌شه
    var lastT = null;
    function paint(ctx, withVideo, t) {
      if (!W) return;
      if (withVideo) { if (video.readyState >= 2) ctx.drawImage(video, 0, 0, W, H); } else ctx.clearRect(0, 0, W, H);
      if (!overlay && !withVideo) return;
      if (t == null) t = video.currentTime;
      lastT = t;
      var lm = lmAt(S, t, dt);
      if (lm) drawOverlay(ctx, lm, W, H, o);
      if (o.strikes && o.strikes.some(function (s) { return Math.abs(s - t) < 0.05; })) tag(ctx, o.labels.strike, 8, 8, W, tok('--warning'));
    }
    function draw(t) { if (!dead) paint(g, false, t); }
    var hasVfc = !!video.requestVideoFrameCallback;
    // هم‌گام با فریم‌های خود ویدیو (اگه مرورگر پشتیبانی کنه)، وگرنه با هر فریم صفحه حین پخش
    // حین پخش دو راه رسم: فراخوان فریم ویدیو (دقیق، با زمان همون فریم) و یک حلقه‌ی requestAnimationFrame که همیشه
    // روشنه و فقط وقتی فراخوان فریم اخیراً نیومده رسم می‌کنه (بعضی مرورگرها، مثلاً روی آیفون، این فراخوان رو برای
    // ویدیوی با کنترل‌های خود مرورگر صدا نمی‌زنن؛ بدون این حلقه اسکلت فقط چند بار در ثانیه جابه‌جا می‌شد)
    var lastVfc = 0, nVfc = 0, nRaf = 0;
    function onFrame(now, md) {
      if (dead) return;
      lastVfc = performance.now(); nVfc++;
      var t = md && md.mediaTime != null ? md.mediaTime : null;
      draw(t); if (rec) paint(rec.g, true, t);
      vfc = video.requestVideoFrameCallback(onFrame);
    }
    function loop() {
      if (dead || video.paused || video.ended) { raf = 0; return; }
      if (performance.now() - lastVfc > 120) { nRaf++; draw(); if (rec) paint(rec.g, true); }
      raf = requestAnimationFrame(loop);
    }
    if (hasVfc) vfc = video.requestVideoFrameCallback(onFrame);
    video.addEventListener('playing', function () { if (!raf) raf = requestAnimationFrame(loop); });
    video.addEventListener('play', function () { if (!raf) raf = requestAnimationFrame(loop); });
    // در حالت توقف currentTime همون فریم روی صفحه‌ست
    ['seeked', 'pause', 'loadeddata'].forEach(function (ev) { video.addEventListener(ev, function () { draw(); }); });
    video.addEventListener('loadedmetadata', function () {
      size();
      var first = o.startAt != null ? o.startAt : 0.001;
      try { video.currentTime = Math.min(first, (video.duration || first + 1) - 0.05); } catch (e) { /* */ }
    });
    // فایلی که این مرورگر نمی‌تونه پخش کنه (مثلاً HEVC روی مرورگری که پشتیبانی نمی‌کنه)
    video.addEventListener('error', function () {
      var c = video.error ? video.error.code : 0;
      if (o.onError) o.onError(c === 4 ? 'format' : 'load');
    });
    function step(n) {
      video.pause();
      video.currentTime = Math.max(0.001, Math.min((video.duration || 1) - dt, video.currentTime + n * dt));
    }
    function setOverlay(on) { overlay = !!on; draw(); }
    // ساخت فایل ویدیو (فریم ویدیو + اسکلت) از یک بار پخش کامل، با همون سرعت انتخاب‌شده
    function pickMime() {
      if (!window.MediaRecorder) return null;
      var c = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      for (var i = 0; i < c.length; i++) if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(c[i])) return c[i];
      return null;
    }
    function record() {
      var mime = pickMime(), off = document.createElement('canvas');
      if (!mime || !off.captureStream || !W) return Promise.reject(new Error('noRecorder'));
      off.width = W; off.height = H;
      return new Promise(function (resolve, reject) {
        var chunks = [], stream = off.captureStream(30), mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4e6 });
        mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        mr.onstop = function () { stream.getTracks().forEach(function (tr) { tr.stop(); }); rec = null; resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
        mr.onerror = function (e) { rec = null; reject(e.error || new Error('record')); };
        var end = function () { video.removeEventListener('ended', end); if (mr.state !== 'inactive') mr.stop(); };
        video.pause(); video.loop = false;
        video.currentTime = 0.001;
        video.addEventListener('seeked', function go() {
          video.removeEventListener('seeked', go);
          rec = { g: off.getContext('2d') }; paint(rec.g, true);
          mr.start(250); video.addEventListener('ended', end);
          video.play().catch(function (e) { end(); reject(e); });
        });
      });
    }
    function destroy() {
      if (dead) return;
      dead = true;
      if (vfc && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(vfc);
      cancelAnimationFrame(raf);
      try { video.pause(); } catch (e) { /* */ }
      video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
      canvas.width = canvas.height = 1;
      if (video.parentNode) video.parentNode.removeChild(video);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    // برای عیب‌یابی (?debug=gait): اندازه‌ها، زمان‌ها و چند نقطه‌ی اول
    function debug() {
      var vr = video.getBoundingClientRect(), cr = canvas.getBoundingClientRect(), f0 = F.filter(function (f) { return f && f.lm; })[0];
      return { natural: [video.videoWidth, video.videoHeight], analysed: [data.w, data.h], display: [Math.round(vr.width), Math.round(vr.height)],
        canvasCss: [Math.round(cr.width), Math.round(cr.height)], canvasOffset: [Math.round(cr.left - vr.left), Math.round(cr.top - vr.top)], canvasPx: [W, H],
        fps: data.fps || null, dt: Math.round(dt * 10000) / 10000, frames: F.length, duration: Math.round((video.duration || 0) * 100) / 100,
        analysedDuration: Math.round((data.duration || 0) * 100) / 100, t: Math.round(video.currentTime * 1000) / 1000, overlayT: lastT == null ? null : Math.round(lastT * 1000) / 1000,
        vfc: hasVfc, vfcDraws: nVfc, rafDraws: nRaf, firstHip: f0 ? [f0.t, f0.lm[23][0], f0.lm[23][1]].map(function (x) { return Math.round(x * 1000) / 1000; }) : null };
    }
    return { video: video, debug: debug, step: step, setRate: function (r) { video.playbackRate = r; }, rate: function () { return video.playbackRate; },
      setOverlay: setOverlay, overlay: function () { return overlay; }, record: record, draw: draw, destroy: destroy };
  }

  root.CoachPose = { sampleStep: sampleStep, load: load, unload: unload, processVideo: processVideo, openVideo: openVideo, keyImage: keyImage, release: release, player: player, MAX_SEC: MAX_SEC };
})(this);
