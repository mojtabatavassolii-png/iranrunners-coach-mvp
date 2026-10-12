/*
 * انتخاب‌گر چرخشی زمان (ساعت : دقیقه : ثانیه) / Wheel time picker.
 * هر ستون یک اسکرول بومی با scroll-snap است تا روی موبایل مثل چرخ‌های iOS و اندروید نرم و با شتاب بچرخه.
 * مقدار نهایی در یک input مخفی به شکل «h:mm:ss» نگه داشته می‌شه تا اعتبارسنجی و پیش‌نمایش فرم دست نخوره.
 * تا وقتی کاربر خودش چرخ‌ها رو تکون نداده، مقدار خالیه (مقدار پیش‌فرض فقط نقطه‌ی شروعه).
 */
(function (root) {
  'use strict';
  var ITEM = 44, ROWS = 5, PAD = Math.floor(ROWS / 2) * ITEM;
  var UNITS = [['h', 35], ['m', 59], ['s', 59]];

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function split(sec) { sec = Math.max(0, Math.round(sec || 0)); return { h: Math.floor(sec / 3600), m: Math.floor(sec / 60) % 60, s: sec % 60 }; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  // opts: { id, name, sec, touched, labels: {h,m,s}, aria, digits(fn), preview }
  function html(o) {
    var v = split(o.sec), dg = o.digits || String;
    var cols = UNITS.map(function (u, ci) {
      var key = u[0], max = u[1], items = '';
      for (var i = 0; i <= max; i++) items += '<div class="tp-item" data-i="' + i + '">' + esc(dg(key === 'h' ? String(i) : pad2(i))) + '</div>';
      return (ci ? '<span class="tp-sep" aria-hidden="true">:</span>' : '') +
        '<div class="tp-col"><div class="tp-wheel" data-unit="' + key + '" data-max="' + max + '" data-start="' + v[key] + '" tabindex="0" role="spinbutton" ' +
        'aria-label="' + esc(o.labels[key]) + '" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + v[key] + '">' +
        '<div class="tp-pad"></div>' + items + '<div class="tp-pad"></div></div>' +
        '<span class="tp-lbl" aria-hidden="true">' + esc(o.labels[key]) + '</span></div>';
    }).join('');
    return '<div class="tpick' + (o.touched ? ' is-set' : '') + '" id="' + esc(o.id) + '-picker" dir="ltr" role="group" aria-label="' + esc(o.aria || '') + '">' +
      '<div class="tp-band" aria-hidden="true"></div>' + cols +
      '<input type="hidden" id="' + esc(o.id) + '" name="' + esc(o.name) + '" value="' + (o.touched && o.sec ? fmt(split(o.sec)) : '') + '"' +
      (o.preview ? ' data-time-preview="' + esc(o.preview) + '"' : '') + '></div>';
  }
  function fmt(v) { return v.h + ':' + pad2(v.m) + ':' + pad2(v.s); }

  function wheels(pick) { return Array.prototype.slice.call(pick.querySelectorAll('.tp-wheel')); }
  function idxOf(w) { return Math.max(0, Math.min(Number(w.dataset.max), Math.round(w.scrollTop / ITEM))); }
  // ظاهر چرخ: هرچی از ردیف وسط دورتر، کم‌رنگ‌تر، کوچیک‌تر و چرخیده‌تر
  function paint(w) {
    var center = w.scrollTop + PAD, items = w.children;
    for (var k = 1; k < items.length - 1; k++) {
      var it = items[k], d = (it.offsetTop + ITEM / 2 - (center + ITEM / 2)) / ITEM, ad = Math.abs(d);
      if (ad > 3.2) { if (it.style.opacity !== '0') { it.style.opacity = '0'; } continue; }
      it.style.opacity = String(Math.max(0.12, 1 - ad * 0.32));
      it.style.transform = 'rotateX(' + (-d * 20).toFixed(1) + 'deg) scale(' + (1 - ad * 0.06).toFixed(3) + ')';
      it.classList.toggle('is-center', ad < 0.5);
    }
  }
  function commit(pick, w, byUser) {
    // فرم بسته شده (مثلاً بعد از ذخیره): رویدادی نفرست
    if (!pick.isConnected) return;
    var i = idxOf(w);
    w._idx = i;
    w.setAttribute('aria-valuenow', i);
    if (!byUser || pick._silent) return;
    pick.classList.add('is-set');
    var v = {}, input = pick.querySelector('input[type=hidden]');
    wheels(pick).forEach(function (x) { v[x.dataset.unit] = idxOf(x); });
    var val = (v.h || v.m || v.s) ? fmt(v) : '';
    if (input.value === val) return;
    input.value = val;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function setWheel(w, i, smooth) {
    i = Math.max(0, Math.min(Number(w.dataset.max), i));
    w._idx = i;
    if (smooth && 'scrollBehavior' in document.documentElement.style) w.scrollTo({ top: i * ITEM, behavior: 'smooth' });
    else w.scrollTop = i * ITEM;
    return i;
  }

  function init(rootEl) {
    Array.prototype.forEach.call((rootEl || document).querySelectorAll('.tpick:not([data-ready])'), function (pick) {
      pick.dataset.ready = '1';
      pick._silent = true;
      wheels(pick).forEach(function (w) {
        setWheel(w, Number(w.dataset.start));
        paint(w);
        var raf = 0, timer = 0, user = false;
        // کاربر (لمس، چرخ ماوس، کیبورد، کلیک) در برابر تنظیم برنامه‌ای
        ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function (ev) {
          w.addEventListener(ev, function () { user = true; pick._silent = false; }, { passive: true });
        });
        w.addEventListener('scroll', function () {
          if (!raf) raf = requestAnimationFrame(function () { raf = 0; paint(w); });
          clearTimeout(timer);
          timer = setTimeout(function () { w._target = null; commit(pick, w, user); }, 160);
        }, { passive: true });
        if ('onscrollend' in w) w.addEventListener('scrollend', function () { clearTimeout(timer); w._target = null; commit(pick, w, user); });
        w.addEventListener('click', function (e) {
          var it = e.target.closest('.tp-item');
          if (!it) return;
          user = true; pick._silent = false;
          w._target = setWheel(w, Number(it.dataset.i), true);
        });
        w.addEventListener('keydown', function (e) {
          // پشت‌سرهم زدن فلش وسط اسکرول نرم: از مقصد قبلی ادامه بده، نه از جای فعلی
          var i = w._target != null ? w._target : idxOf(w), max = Number(w.dataset.max), n = null;
          if (e.key === 'ArrowUp') n = i - 1;
          else if (e.key === 'ArrowDown') n = i + 1;
          else if (e.key === 'PageUp') n = i - 10;
          else if (e.key === 'PageDown') n = i + 10;
          else if (e.key === 'Home') n = 0;
          else if (e.key === 'End') n = max;
          if (n === null) return;
          e.preventDefault();
          w._target = setWheel(w, n, true);
        });
      });
      // بعد از چیدمان اولیه، تغییرها فقط با دست کاربر ثبت می‌شن
      requestAnimationFrame(function () { pick._silent = false; wheels(pick).forEach(paint); });
    });
  }
  // تنظیم چرخ‌ها بدون ثبت مقدار (مثلاً زمان پیشنهادی برای مسافت انتخاب‌شده، تا وقتی کاربر دست نزده)
  function preset(id, sec) {
    var pick = document.getElementById(id + '-picker');
    if (!pick || pick.classList.contains('is-set')) return;
    var v = split(sec);
    pick._silent = true;
    wheels(pick).forEach(function (w) { setWheel(w, v[w.dataset.unit]); paint(w); });
    requestAnimationFrame(function () { pick._silent = false; });
  }
  // وقتی چرخ‌ها داخل یک بخش پنهان (display:none) ساخته شدن، اسکرولشون اعمال نمی‌شه؛ بعد از نمایش دوباره تنظیم کن
  function refresh(rootEl) {
    Array.prototype.forEach.call((rootEl || document).querySelectorAll('.tpick[data-ready]'), function (pick) {
      pick._silent = true;
      wheels(pick).forEach(function (w) { if (w._idx != null && idxOf(w) !== w._idx) w.scrollTop = w._idx * ITEM; paint(w); });
      requestAnimationFrame(function () { pick._silent = false; });
    });
  }
  function isSet(id) { var p = document.getElementById(id + '-picker'); return !!p && p.classList.contains('is-set'); }

  root.CoachTimePicker = { html: html, init: init, preset: preset, refresh: refresh, isSet: isSet, ITEM: ITEM };
})(this);
