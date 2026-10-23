/*
 * انتخاب‌گر زمان با برگه‌ی پایین صفحه / Time picker in a bottom sheet.
 * فیلد یک دکمه است که مقدار رو نشون می‌ده؛ با لمسش برگه‌ای با «لغو / تأیید» و چرخ‌های ساعت، دقیقه و ثانیه باز می‌شه.
 * دو حالت: مدت (h:mm:ss) و ساعت روز (HH:MM). مقدار نهایی در یک input مخفی نگه داشته می‌شه تا خوندن فرم‌ها دست نخوره.
 * هر چرخ یک اسکرول بومی با scroll-snap است تا روی موبایل مثل چرخ‌های iOS و اندروید نرم و با شتاب بچرخه.
 * تا وقتی کاربر «تأیید» نزده، مقدار خالیه (مقدار پیش‌فرض فقط نقطه‌ی شروع چرخ‌هاست).
 */
(function (root) {
  'use strict';
  var ITEM = 48, ROWS = 5, PAD = Math.floor(ROWS / 2) * ITEM;
  var CLOCK_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function split(sec) { sec = Math.max(0, Math.round(sec || 0)); return { h: Math.floor(sec / 3600), m: Math.floor(sec / 60) % 60, s: sec % 60 }; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function fmt(v) { return v.h + ':' + pad2(v.m) + ':' + pad2(v.s); }
  // «۱:۲۵:۰۷» یا «۲۵:۰۷» برای مدت، «۱۸:۰۰» برای ساعت روز
  function show(mode, v) { return mode === 'clock' ? pad2(v.h) + ':' + pad2(v.m) : (v.h ? fmt(v) : v.m + ':' + pad2(v.s)); }
  // مقدار input مخفی → {h,m,s}
  function parse(mode, str) {
    var p = String(str || '').split(':').map(Number);
    if (!str || p.some(isNaN)) return null;
    if (mode === 'clock') return { h: p[0] || 0, m: p[1] || 0, s: 0 };
    if (p.length === 2) p.unshift(0);
    return { h: p[0] || 0, m: p[1] || 0, s: p[2] || 0 };
  }

  // opts: { id, name, mode ('dur'|'clock'), sec, value, touched, maxH, title, aria, attrs, preview,
  //         labels: {h,m,s, item: {h,m,s} ('{n}h'), choose, done, cancel}, digits(fn) }
  function html(o) {
    var mode = o.mode === 'clock' ? 'clock' : 'dur', L = o.labels || {}, dg = o.digits || digitsFn;
    var start = mode === 'clock' ? parse('clock', o.value) || { h: 7, m: 0, s: 0 } : split(o.sec);
    var set = mode === 'clock' ? !!o.value : !!(o.touched && o.sec);
    var val = !set ? '' : mode === 'clock' ? show('clock', start) : fmt(start);
    var cfg = { mode: mode, maxH: mode === 'clock' ? 23 : (o.maxH || 35), title: o.title || o.aria || '', aria: o.aria || '', labels: L };
    var text = set ? dg(show(mode, start)) : (L.choose || '');
    return '<div class="tpick' + (set ? ' is-set' : '') + '" id="' + esc(o.id) + '-picker" data-start="' + esc(JSON.stringify(start)) + '" data-cfg="' + esc(JSON.stringify(cfg)) + '">' +
      '<button type="button" class="tp-trigger" id="' + esc(o.id) + '-btn" aria-haspopup="dialog" aria-label="' + esc(cfg.aria + ': ' + text) + '">' +
      '<span class="tp-val" dir="ltr">' + esc(text) + '</span>' + CLOCK_SVG + '</button>' +
      '<input type="hidden" id="' + esc(o.id) + '" name="' + esc(o.name) + '" value="' + esc(val) + '"' +
      (o.preview ? ' data-time-preview="' + esc(o.preview) + '"' : '') + (o.attrs || '') + '></div>';
  }

  var digitsFn = String;
  function setDigits(fn) { digitsFn = fn || String; }
  function cfgOf(pick) { try { return JSON.parse(pick.dataset.cfg); } catch (e) { return { mode: 'dur', maxH: 35, labels: {} }; } }
  function startOf(pick) { try { return JSON.parse(pick.dataset.start); } catch (e) { return { h: 0, m: 0, s: 0 }; } }
  function paintTrigger(pick) {
    var c = cfgOf(pick), inp = pick.querySelector('input[type=hidden]'), v = parse(c.mode, inp.value);
    var text = v && pick.classList.contains('is-set') ? digitsFn(show(c.mode, v)) : (c.labels.choose || '');
    pick.querySelector('.tp-val').textContent = text;
    pick.querySelector('.tp-trigger').setAttribute('aria-label', c.aria + ': ' + text);
  }
  function write(pick, val) {
    var inp = pick.querySelector('input[type=hidden]');
    pick.classList.toggle('is-set', !!val);
    var changed = inp.value !== val;
    inp.value = val;
    paintTrigger(pick);
    if (!changed) return;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ---------- برگه ----------
  var sheet = null, current = null, lastFocus = null;
  function idxOf(w) { return Math.max(0, Math.min(Number(w.dataset.max), Math.round(w.scrollTop / ITEM))); }
  // ظاهر چرخ: هرچی از ردیف وسط دورتر، کم‌رنگ‌تر، کوچیک‌تر و چرخیده‌تر
  function paint(w) {
    var center = w.scrollTop + PAD, items = w.children;
    for (var k = 1; k < items.length - 1; k++) {
      var it = items[k], d = (it.offsetTop + ITEM / 2 - (center + ITEM / 2)) / ITEM, ad = Math.abs(d);
      if (ad > 3.2) { if (it.style.opacity !== '0') it.style.opacity = '0'; continue; }
      it.style.opacity = String(Math.max(0.12, 1 - ad * 0.36));
      it.style.transform = 'rotateX(' + (-d * 20).toFixed(1) + 'deg) scale(' + (1 - ad * 0.07).toFixed(3) + ')';
      it.classList.toggle('is-center', ad < 0.5);
    }
  }
  function setWheel(w, i, smooth) {
    i = Math.max(0, Math.min(Number(w.dataset.max), i));
    w._target = i;
    if (smooth && 'scrollBehavior' in document.documentElement.style) w.scrollTo({ top: i * ITEM, behavior: 'smooth' });
    else w.scrollTop = i * ITEM;
    w.setAttribute('aria-valuenow', i);
    return i;
  }
  function wheels() { return Array.prototype.slice.call(sheet.querySelectorAll('.tp-wheel')); }
  function build() {
    sheet = document.createElement('div');
    sheet.className = 'tp-backdrop';
    sheet.hidden = true;
    sheet.innerHTML = '<div class="tp-sheet" role="dialog" aria-modal="true" aria-labelledby="tp-title">' +
      '<div class="tp-head"><button type="button" class="tp-act" data-tp-cancel="1"></button><h2 id="tp-title"></h2><button type="button" class="tp-act tp-done" data-tp-done="1"></button></div>' +
      '<div class="tp-cols" dir="ltr"></div></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet || e.target.closest('[data-tp-cancel]')) return close(false);
      if (e.target.closest('[data-tp-done]')) return close(true);
      var it = e.target.closest('.tp-item');
      if (it) setWheel(it.parentNode, Number(it.dataset.i), true);
    });
    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); return close(false); }
      if (e.key === 'Tab') {
        // فوکوس داخل برگه بمونه
        var f = Array.prototype.slice.call(sheet.querySelectorAll('button, .tp-wheel')), i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        return;
      }
      var w = e.target.closest && e.target.closest('.tp-wheel');
      if (!w) return;
      var i = w._target != null ? w._target : idxOf(w), max = Number(w.dataset.max), n = null;
      if (e.key === 'ArrowUp') n = i - 1;
      else if (e.key === 'ArrowDown') n = i + 1;
      else if (e.key === 'PageUp') n = i - 10;
      else if (e.key === 'PageDown') n = i + 10;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = max;
      if (n === null) return;
      e.preventDefault();
      setWheel(w, n, true);
    });
  }
  function column(unit, max, start, label, item) {
    var items = '';
    for (var i = 0; i <= max; i++) {
      var n = item ? String(i) : pad2(i);
      items += '<div class="tp-item" data-i="' + i + '" dir="auto">' + esc(item ? item.replace('{n}', digitsFn(n)) : digitsFn(n)) + '</div>';
    }
    return '<div class="tp-col"><div class="tp-band" aria-hidden="true"></div>' +
      '<div class="tp-wheel" data-unit="' + unit + '" data-max="' + max + '" data-start="' + start + '" tabindex="0" role="spinbutton" aria-label="' + esc(label) + '" ' +
      'aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + start + '"><div class="tp-pad"></div>' + items + '<div class="tp-pad"></div></div></div>';
  }
  function open(pick) {
    if (!sheet) build();
    var c = cfgOf(pick), L = c.labels || {}, it = L.item || {};
    var v = parse(c.mode, pick.querySelector('input[type=hidden]').value) || startOf(pick);
    var units = c.mode === 'clock' ? ['h', 'm'] : ['h', 'm', 's'], max = { h: c.maxH, m: 59, s: 59 };
    current = pick; lastFocus = document.activeElement;
    sheet.querySelector('#tp-title').textContent = c.title;
    sheet.querySelector('[data-tp-cancel]').textContent = L.cancel || 'Cancel';
    sheet.querySelector('[data-tp-done]').textContent = L.done || 'Done';
    sheet.querySelector('.tp-cols').innerHTML = units.map(function (u, i) {
      return (i ? '<span class="tp-sep" aria-hidden="true">:</span>' : '') + column(u, max[u], Math.min(max[u], v[u] || 0), L[u] || u, c.mode === 'clock' ? '' : it[u]);
    }).join('');
    sheet.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { sheet.classList.add('is-open'); });
    wheels().forEach(function (w) {
      setWheel(w, Number(w.dataset.start));
      paint(w);
      var raf = 0, timer = 0;
      w.addEventListener('scroll', function () {
        if (!raf) raf = requestAnimationFrame(function () { raf = 0; paint(w); });
        clearTimeout(timer);
        timer = setTimeout(function () { var i = idxOf(w); w._target = i; w.setAttribute('aria-valuenow', i); }, 140);
      }, { passive: true });
      // لمس یا چرخ ماوس: مقصد قبلی دیگه معتبر نیست
      ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) { w.addEventListener(ev, function () { w._target = null; }, { passive: true }); });
    });
    wheels()[0].focus({ preventScroll: true });
  }
  function close(ok) {
    if (!sheet || sheet.hidden) return;
    var pick = current;
    if (ok && pick) {
      var c = cfgOf(pick), v = { h: 0, m: 0, s: 0 };
      wheels().forEach(function (w) { v[w.dataset.unit] = w._target != null ? w._target : idxOf(w); });
      write(pick, c.mode === 'clock' ? pad2(v.h) + ':' + pad2(v.m) : (v.h || v.m || v.s) ? fmt(v) : '');
    }
    sheet.classList.remove('is-open');
    sheet.hidden = true;
    sheet.querySelector('.tp-cols').innerHTML = '';
    document.body.classList.remove('modal-open');
    current = null;
    var back = pick && pick.isConnected ? pick.querySelector('.tp-trigger') : lastFocus;
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.tp-trigger');
    if (b) { e.preventDefault(); open(b.parentNode); return; }
    // برچسب فیلد (label for=id) به دکمه وصل می‌شه
    var l = e.target.closest && e.target.closest('label[for]');
    var pick = l && document.getElementById(l.htmlFor + '-picker');
    if (pick) { e.preventDefault(); pick.querySelector('.tp-trigger').focus(); }
  });

  // سازگاری با فراخوانی‌های قبلی: چرخ‌ها حالا داخل برگه ساخته می‌شن
  function init() {}
  function refresh() {}
  // نقطه‌ی شروع چرخ‌ها (مثلاً زمان پیشنهادی برای مسافت انتخاب‌شده)، تا وقتی کاربر مقداری تأیید نکرده
  function preset(id, sec) {
    var pick = document.getElementById(id + '-picker');
    if (!pick || pick.classList.contains('is-set')) return;
    pick.dataset.start = JSON.stringify(split(sec));
  }
  // گذاشتن مقدار از بیرون (بازگردانی پیش‌نویس، دکمه‌های پیشنهادی)؛ رشته‌ی خالی یعنی پاک کردن
  function setValue(id, str, silent) {
    var pick = document.getElementById(id + '-picker');
    if (!pick) return;
    var c = cfgOf(pick), v = parse(c.mode, str);
    var val = !v ? '' : c.mode === 'clock' ? pad2(v.h) + ':' + pad2(v.m) : fmt(v);
    if (v) pick.dataset.start = JSON.stringify(v);
    if (silent) { pick.classList.toggle('is-set', !!val); pick.querySelector('input[type=hidden]').value = val; paintTrigger(pick); }
    else write(pick, val);
  }
  function isSet(id) { var p = document.getElementById(id + '-picker'); return !!p && p.classList.contains('is-set'); }

  root.CoachTimePicker = { html: html, init: init, preset: preset, refresh: refresh, set: setValue, isSet: isSet, setDigits: setDigits,
    open: function (id) { var p = document.getElementById(id + '-picker'); if (p) open(p); }, close: close, ITEM: ITEM };
})(this);
