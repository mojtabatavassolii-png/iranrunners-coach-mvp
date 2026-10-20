/*
 * استخراج نقاط کلیدی بدن از ویدیو با MediaPipe Pose، کاملاً داخل مرورگر.
 * کتابخانه (js/vendor/mediapipe) و مدل (models/) از خود اپ بارگذاری می‌شن و فقط وقتی کاربر تحلیل رو شروع کنه؛
 * ویدیو هیچ‌وقت از دستگاه خارج نمی‌شه (CSP در index.html هم هر اتصال بیرونی رو می‌بنده).
 * خروجی: { w, h, duration, frames: [{ t, lm: [[x, y, visibility] × ۳۳] | null }] } برای js/gait.js
 */
(function (root) {
  'use strict';
  var BASE = 'js/vendor/mediapipe/', MODEL = 'models/pose_landmarker_full.task';
  var MAX_SEC = 12, STEP = 1 / 30;
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
  function recreateCpu() {
    landmarker = null; loading = null;
    return import(abs(BASE + 'vision_bundle.mjs')).then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(abs(BASE + 'wasm')).then(function (fs) {
        return mp.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: abs(MODEL), delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1,
          minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      });
    }).then(function (l) { landmarker = l; return l; });
  }
  // هر فریم (۳۰ در ثانیه، حداکثر ۱۲ ثانیه): جابه‌جایی روی ویدیو، کشیدن روی بوم و تشخیص بدن
  function processVideo(file, onProgress) {
    var lmk, v, cv, g, retried = false;
    return load().then(function (l) { lmk = l; return openVideo(file); }).then(function (video) {
      v = video;
      var dur = Math.min(v.duration || 0, MAX_SEC);
      if (!(dur > 0.5)) throw fail('short');
      // اندازه‌ی کار: ضلع بزرگ حداکثر ۹۶۰px (دقت کافی، سرعت بیشتر)
      var sc = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight));
      cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * sc); cv.height = Math.round(v.videoHeight * sc);
      g = cv.getContext('2d');
      var n = Math.floor(dur / STEP), frames = [], i = 0;
      function detect() {
        clock += 34; // زمان‌های ارسالی به MediaPipe باید همیشه صعودی باشن (بین دو ویدیو هم)
        try { return Promise.resolve(lmk.detectForVideo(cv, clock)); } catch (e) {
          // پردازنده‌ی گرافیکی بعضی گوشی‌ها: یک بار دیگه با CPU
          if (retried) return Promise.reject(fail('detect', e));
          retried = true;
          return recreateCpu().then(function (l) { lmk = l; clock += 34; return lmk.detectForVideo(cv, clock); }).catch(function (e2) { throw fail('detect', e2); });
        }
      }
      function next() {
        if (i >= n) return { w: v.videoWidth, h: v.videoHeight, duration: dur, frames: frames, video: v };
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
        g.lineWidth = 3; g.strokeStyle = 'rgba(0, 200, 160, 0.9)'; g.lineCap = 'round';
        LINKS.forEach(function (l) { var a = pt(l[0]), b = pt(l[1]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
        (opts.focus || []).forEach(function (k) {
          var p = pt(k); g.fillStyle = '#ff6b57'; g.beginPath(); g.arc(p[0], p[1], 6, 0, Math.PI * 2); g.fill();
          g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
        });
        if (opts.label && opts.labelAt != null) {
          var q = pt(opts.labelAt);
          g.font = '600 15px Vazirmatn, sans-serif';
          var w = g.measureText(opts.label).width + 12;
          var x = Math.min(W - w - 4, q[0] + 10), y = Math.max(4, q[1] - 30);
          g.fillStyle = 'rgba(15, 42, 42, 0.85)'; g.fillRect(x, y, w, 24);
          g.fillStyle = '#fff'; g.fillText(opts.label, x + 6, y + 17);
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

  root.CoachPose = { load: load, processVideo: processVideo, keyImage: keyImage, release: release, MAX_SEC: MAX_SEC };
})(this);
