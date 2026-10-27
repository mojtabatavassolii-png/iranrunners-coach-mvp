/*
 * رابط کاربری «گام» — بدون فریم‌ورک، داده‌ها فقط در localStorage.
 * همه‌ی متن‌ها از دیکشنری ترجمه خونده می‌شن (js/i18n/fa.js و en.js)؛ T('کلید', {پارامتر}).
 */
(function () {
  'use strict';
  var C = window.CoachLogic;
  var I = window.CoachI18n;
  var T = I.t;
  var STORE_KEY = 'iranrunners-coach-mvp-v1';
  var SESSION_KEY = 'iranrunners-coach-session';
  // نسخه ۳: سطح ۱ تا ۱۰ از حجم، سابقه، رکورد و تجربه‌ی تمرین ساختاریافته محاسبه می‌شه
  var SCHEMA_VERSION = 3;
  var app = document.getElementById('app');
  var modalRoot = document.getElementById('modal-root');

  // زبان ذخیره‌شده (پیش‌فرض فارسی)
  I.setLang(I.savedLang() || 'fa', false);

  // ---------- وضعیت و ذخیره‌سازی ----------
  var memoryFallback = null;
  function emptyState() { return { profile: null, checkins: {}, done: {}, ackPain: {}, postRuns: {}, cycleChoices: {}, doneLog: {} }; }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        return Object.assign(emptyState(), s);
      }
    } catch (e) { /* localStorage در دسترس نیست */ }
    return memoryFallback || emptyState();
  }
  function save() {
    memoryFallback = state;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { showToast(T('app.saveFailed')); }
  }
  var state = load();

  // ---------- تنظیمات نمایش (جدا از پروفایل): تقویم، شروع هفته، نمای برنامه ----------
  // 'auto' = بر اساس زبان: فارسی → شمسی و شنبه؛ انگلیسی → میلادی و دوشنبه
  var SETTINGS_KEY = 'iranrunners-coach-settings';
  var WS_MAP = { sat: 6, sun: 0, mon: 1 };
  function loadSettings() {
    var d = { calendar: 'auto', weekStart: 'auto', planView: 'week', cycleMarkers: true, progressRange: '3m', units: 'km', theme: 'auto' };
    try { return Object.assign(d, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { return d; }
  }
  var settings = loadSettings();
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* */ } }
  // ظاهر: auto = مثل گوشی، light یا dark = انتخاب کاربر (رنگ‌ها همه از css/theme.css)
  var darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function isLightTheme() { return settings.theme === 'light' || (settings.theme !== 'dark' && !!darkQuery && !darkQuery.matches); }
  function applyTheme() {
    var root = document.documentElement;
    if (settings.theme === 'light' || settings.theme === 'dark') root.setAttribute('data-theme', settings.theme); else root.removeAttribute('data-theme');
    var m = document.querySelector('meta[name=theme-color]');
    // تا معرفی روی صفحه‌ست، نوار مرورگر هم‌رنگ زمینه‌ی تیره‌ی معرفی می‌مونه (splash.js بعدش برمی‌گردونه)
    if (m) m.setAttribute('content', root.classList.contains('pre-intro') ? '#121214' : (getComputedStyle(root).getPropertyValue('--bg').trim() || '#121214'));
  }
  applyTheme();
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', function () { applyTheme(); if (settings.theme === 'auto' && typeof route === 'function' && document.querySelector('.chart')) route(); });
  function applyCalendarSettings() {
    var isFa = I.getLang() === 'fa';
    I.setCalendar(settings.calendar === 'auto' ? (isFa ? 'jalali' : 'gregorian') : settings.calendar);
    I.setUnits(settings.units);
    C.setWeekStart(settings.weekStart === 'auto' ? (isFa ? WS_MAP.sat : WS_MAP.mon) : WS_MAP[settings.weekStart]);
  }

  // ورود: یک‌بار در هر نشست مرورگر
  var enteredMemory = false;
  function isEntered() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1' || enteredMemory; } catch (e) { return enteredMemory; }
  }
  function setEntered(v) {
    enteredMemory = v;
    try { if (v) sessionStorage.setItem(SESSION_KEY, '1'); else sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* */ }
  }

  // امکان تست با تاریخ دلخواه: ?today=2026-12-10
  function today() {
    var m = /[?&]today=(\d{4}-\d{2}-\d{2})/.exec(location.search);
    if (m) return C.parseDate(m[1]);
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  var viewWeekOffset = 0;
  var monthOffset = 0;
  var selectedDay = null;

  // ---------- ابزار نمایش ----------
  // اعداد: رقم فارسی فقط در زبان فارسی
  function fa(x) { return I.num(x); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(s) { return esc(fa(s)); }
  // ---------- واحد مسافت (کیلومتر/مایل): ذخیره همیشه به کیلومتر، نمایش و ورودی به واحد انتخابی ----------
  function isMi() { return I.getUnits() === 'mi'; }
  function uShort() { return T('units.short.' + I.getUnits()); }
  function dKm(km) { return I.dist(km); }
  // بازه‌ی مجاز ورودی‌ها به واحد کاربر
  var LIM = { vol: [[0, 400], [0, 250]], ultra: [[10, 400], [6, 250]], dist: [[1, 100], [0.6, 62]], race: [[1, 250], [0.6, 155]] };
  function lim(k) { return LIM[k][isMi() ? 1 : 0]; }
  function limAttrs(k, step) { var l = lim(k); return ' min="' + l[0] + '" max="' + l[1] + '" step="' + (isMi() ? '0.1' : step) + '"'; }
  // مقدار اولیه‌ی فیلد: عدد به واحد کاربر + کیلومتر اصلی (تا اگه کاربر دست نزد، عدد دقیق حفظ بشه)
  function kmField(km) { return km === '' || km == null ? ' value=""' : ' value="' + esc(dKm(km)) + '" data-km="' + esc(km) + '"'; }
  function rawIn(el) { var v = String(el.value).trim(); return v === '' ? null : Number(v); }
  function kmIn(el) {
    var v = rawIn(el);
    if (v === null || !isFinite(v)) return v;
    if (el.dataset.km && Number(dKm(el.dataset.km)) === v) return Number(el.dataset.km);
    return isMi() ? Math.round(I.toKm(v) * 100) / 100 : v;
  }
  function inLim(k, v) { var l = lim(k); return v !== null && v >= l[0] && v <= l[1]; }
  function limParams(k) { var l = lim(k); return { min: l[0], max: l[1] }; }
  // اسم مسافت: مسافت‌های استاندارد مسابقه با اسم خودشون («۱۰ کیلومتر»، «نیمه‌ماراتن»)، بقیه به واحد کاربر
  function distName(km) {
    var k = pbDistanceKey(km);
    return ['5', '10', '21', '42'].indexOf(k) >= 0 ? T('pbDist.' + k) : dKm(Math.round(km * 100) / 100) + ' ' + T('units.' + I.getUnits());
  }
  function paceFmt(secPerKm) { return C.formatDuration(I.pace(Math.round(secPerKm))); }
  // متن ترجمه‌شده با اعداد بومی و امن برای HTML
  function tt(key, params) { return t(T(key, params)); }
  // انتخاب‌گر زمان (برگه‌ی پایین صفحه) با برچسب‌های زبان فعلی
  function tpo(o) {
    return window.CoachTimePicker.html(Object.assign({ digits: fa, labels: { h: T('tpick.h'), m: T('tpick.m'), s: T('tpick.s'),
      item: { h: T('tpick.ih'), m: T('tpick.im'), s: T('tpick.is') }, choose: T('tpick.choose'), done: T('tpick.done'), cancel: T('app.cancel') } }, o));
  }
  function faDate(key, short) { return I.date(C.parseDate(key), short); }
  function isRtl() { return I.dir() === 'rtl'; }
  function chevron(dir) {
    return '<svg class="chev" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="' +
      (dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function showToast(msg) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 3200);
    setTimeout(function () { el.remove(); }, 3700);
  }

  // =====================================================================
  // صندوق پیام: هر پیام مهم یک‌بار (با کلید یکتا) ذخیره می‌شه، زنگوله‌ی هدر تعداد خونده‌نشده‌ها رو نشون می‌ده
  // و یک پیام کوچیک لحظه‌ای بالای صفحه می‌آد. متن‌ها موقع نمایش از دیکشنری ساخته می‌شن (با عوض شدن زبان درست می‌مونن).
  // =====================================================================
  var INBOX_MAX = 40;
  var STATUS_ICON = {
    success: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    warning: '<path d="M12 7.5v6"/><path d="M12 16.5v.5"/>',
    error: '<path d="M7 7l10 10M17 7L7 17"/>',
    info: '<path d="M12 11v6"/><path d="M12 7.5v.5"/>'
  };
  function statusIcon(k) {
    return '<span class="nf-ico s-' + k + '" aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' + STATUS_ICON[k] + '</svg></span>';
  }
  function inbox() { return state.inbox || (state.inbox = []); }
  // o: { key, k (success|warning|error|info), m (کلید پیام در msg.*), p (پارامترها), href, today (رفتن به روز جاری), flash }
  function notify(o) {
    var list = inbox();
    if (list.some(function (x) { return x.key === o.key; })) return false;
    list.unshift({ key: o.key, k: o.k, m: o.m, p: o.p || {}, href: o.href || '', today: !!o.today, day: C.dateKey(today()), at: new Date().toISOString(), read: false });
    if (list.length > INBOX_MAX) list.length = INBOX_MAX;
    save();
    updateBell();
    if (o.flash !== false) flashMessage(o.k, T('msg.' + o.m + '.t', o.p || {}));
    return true;
  }
  // آواتار هدر (مثل استراوا): لینک به صفحه‌ی شخصی، با عکس یا حرف اول نام
  function updateHeader() {
    var a = document.getElementById('hdr-me');
    if (!a) return;
    var show = isEntered() && !!state.profile && !needsMigration() && (location.hash || '#home') !== '#onboarding';
    a.hidden = !show;
    if (!show) return;
    a.querySelector('[data-avatar-slot]').innerHTML = avatarHtml(36);
    a.setAttribute('aria-label', T('app.profileLink'));
    if ((location.hash || '#home') === '#profile') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    updateBell();
  }
  function unreadCount() { return inbox().filter(function (x) { return !x.read; }).length; }
  function updateBell() {
    var b = document.getElementById('bell');
    if (!b) return;
    var show = isEntered() && !!state.profile && !needsMigration() && (location.hash || '#home') !== '#onboarding';
    b.hidden = !show;
    var n = unreadCount(), badge = b.querySelector('.bell-n');
    badge.textContent = fa(n > 9 ? '9+' : n);
    badge.hidden = !n;
    b.setAttribute('aria-label', n ? T('inbox.ariaN', { n: fa(n) }) : T('inbox.aria'));
    b.setAttribute('aria-expanded', String(!!document.getElementById('inbox')));
  }
  // پیام کوچیک لحظه‌ای بالای صفحه
  function flashMessage(k, text) {
    var old = document.querySelector('.nf-flash');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'nf-flash';
    el.setAttribute('role', k === 'error' || k === 'warning' ? 'alert' : 'status');
    el.innerHTML = statusIcon(k) + '<span>' + t(text) + '</span>';
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 3400);
    setTimeout(function () { el.remove(); }, 3900);
  }
  function msgTime(x) {
    if (x.day === C.dateKey(today())) {
      var d = new Date(x.at);
      return fa((d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes());
    }
    return faDate(x.day, true);
  }
  function renderInbox() {
    var list = inbox(), todayKey = C.dateKey(today()), html = '', grp = '';
    if (!list.length) html = '<p class="nf-empty">' + esc(T('inbox.empty')) + '</p>';
    list.forEach(function (x, i) {
      var g = x.day === todayKey ? 'today' : 'earlier';
      if (g !== grp) { grp = g; html += '<p class="nf-grp">' + esc(T('inbox.' + g)) + '</p>'; }
      var act = T('msg.' + x.m + '.a', x.p);
      html += '<div class="nf-msg' + (x.read ? '' : ' unread') + '"><span class="nf-dot" aria-hidden="true"></span>' + statusIcon(x.k) +
        '<div class="nf-txt"><b>' + tt('msg.' + x.m + '.t', x.p) + '</b><p>' + tt('msg.' + x.m + '.b', x.p) + '</p>' +
        (x.href && act ? '<button type="button" class="nf-act" data-nf-go="' + i + '">' + esc(act) + ' ' + (isRtl() ? '←' : '→') + '</button>' : '') +
        '</div><time>' + esc(msgTime(x)) + '</time>' + (x.read ? '' : '<span class="sr-only">' + esc(T('inbox.unread')) + '</span>') + '</div>';
    });
    return '<div class="nf-top"><h2 id="inbox-title">' + esc(T('inbox.title')) + '</h2><div class="nf-tools">' +
      (unreadCount() ? '<button type="button" data-nf-readall="1">' + esc(T('inbox.readAll')) + '</button>' : '') +
      (list.some(function (x) { return x.read; }) ? '<button type="button" data-nf-clear="1">' + esc(T('inbox.clear')) + '</button>' : '') +
      '</div></div><div class="nf-list">' + html + '</div>';
  }
  function openInbox() {
    if (document.getElementById('inbox')) return;
    var hdr = document.querySelector('.site-header'), top = hdr ? Math.max(0, hdr.getBoundingClientRect().bottom) : 0;
    var el = document.createElement('div');
    el.id = 'inbox';
    el.className = 'nf-backdrop';
    el.style.top = top + 'px';
    el.innerHTML = '<div class="nf-sheet" role="dialog" aria-modal="true" aria-labelledby="inbox-title">' + renderInbox() + '</div>';
    document.body.appendChild(el);
    document.body.classList.add('modal-open');
    updateBell();
    var f = el.querySelector('button') || el.querySelector('.nf-sheet');
    if (f) { if (!f.matches('button')) f.tabIndex = -1; f.focus(); }
  }
  // بستن: پیام‌هایی که دیده شدن خونده‌شده حساب می‌شن
  function closeInbox(keepFocus) {
    var el = document.getElementById('inbox');
    if (!el) return;
    el.remove();
    document.body.classList.remove('modal-open');
    if (unreadCount()) { inbox().forEach(function (x) { x.read = true; }); save(); }
    updateBell();
    if (!keepFocus) { var b = document.getElementById('bell'); if (b && !b.hidden) b.focus(); }
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('#bell')) { if (document.getElementById('inbox')) closeInbox(); else openInbox(); return; }
    var box = document.getElementById('inbox');
    if (!box || !box.contains(e.target)) return;
    if (e.target === box) { closeInbox(); return; }
    var go = e.target.closest('[data-nf-go]');
    if (go) {
      var x = inbox()[Number(go.dataset.nfGo)];
      if (!x) return;
      x.read = true; save();
      closeInbox(true);
      if (x.today) { selectedDay = C.dateKey(today()); viewWeekOffset = 0; monthOffset = 0; }
      if (location.hash === x.href) route(); else location.hash = x.href;
      return;
    }
    if (e.target.closest('[data-nf-readall]')) { inbox().forEach(function (y) { y.read = true; }); save(); box.querySelector('.nf-sheet').innerHTML = renderInbox(); updateBell(); return; }
    if (e.target.closest('[data-nf-clear]')) { state.inbox = inbox().filter(function (y) { return !y.read; }); save(); box.querySelector('.nf-sheet').innerHTML = renderInbox(); updateBell(); }
  });
  document.addEventListener('keydown', function (e) {
    var box = document.getElementById('inbox');
    if (!box) return;
    if (e.key === 'Escape') { e.preventDefault(); closeInbox(); return; }
    if (e.key === 'Tab') {
      var f = Array.prototype.slice.call(box.querySelectorAll('button'));
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  // پیام‌های زمان‌دار (بعد از هر بار نمایش صفحه بررسی می‌شن؛ هر کدوم فقط یک‌بار)
  function checkInbox() {
    var p = state.profile;
    if (!p || needsMigration() || !isEntered()) return;
    var now = today(), todayKey = C.dateKey(now);
    var first = !inbox().length && !(state.inboxSeen);
    if (first) {
      state.inboxSeen = true;
      notify({ key: 'welcome', k: 'info', m: 'welcome', href: '#guide', flash: false });
    }
    // برنامه‌ی هفته‌ی تازه (از هفته‌ی دوم به بعد)
    var wi = C.weekIndexFor(p, now);
    if (wi != null && wi >= 1) {
      var wk = C.buildWeek(p, now), ses = wk.days.filter(function (d) { return ['rest', 'none'].indexOf(d.type) < 0; }).length;
      notify({ key: 'week-' + C.dateKey(C.weekStart(now)), k: 'info', m: 'week', p: { n: wi + 1, s: ses }, href: '#plan', today: true, flash: !first });
    }
    // یادآوری تمرین امروز (بعد از ساعت یادآوری، اگه جلسه هست و هنوز انجام نشده)
    var r = reminderCfg(), real = new Date(), hm = r.time.split(':').map(Number);
    if (r.on && todayKey === C.dateKey(real) && real.getHours() * 60 + real.getMinutes() >= hm[0] * 60 + hm[1] && !state.done[todayKey]) {
      var base = C.sessionFor(p, now);
      if (['rest', 'none'].indexOf(base.type) < 0) notify({ key: 'remind-' + todayKey, k: 'info', m: 'remind', p: { s: base.label, n: base.minutes || base.km || '' }, href: '#plan', today: true });
    }
    // پیشنهاد سطح بعدی پیاده‌روی
    if (C.isWalk(p)) {
      var sg = C.walkLevelSuggestion(p, now);
      if (sg) notify({ key: 'wlevel-' + sg.to + '-' + p.startDate, k: 'success', m: 'wlevel', p: { from: sg.from, to: sg.to }, href: '#home' });
    } else {
      // وقت تست فیتنس (هفته‌ای یک‌بار تا ثبت تست)
      var rem = C.fitnessReminder(p, now);
      if (rem) notify({ key: 'fit-' + C.dateKey(C.weekStart(now)), k: 'info', m: 'fit', href: '#fitness' });
    }
  }

  // ---------- متن‌های ثابت صفحه (هدر، منو، بنر، فوتر) و جهت ----------
  function applyStatic() {
    applyCalendarSettings();
    var root = document.documentElement;
    root.lang = I.getLang();
    root.dir = I.dir();
    document.title = T('app.name');
    var md = document.querySelector('meta[name=description]');
    if (md) md.setAttribute('content', T('app.metaDescription'));
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = T(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', T(el.dataset.i18nAria)); });
  }
  function switchLang(code) {
    I.setLang(code);
    applyStatic();
    route();
  }

  // ---------- تطبیق جلسه با چک‌این ----------
  function prevCheckin(key) {
    return state.checkins[C.dateKey(C.addDays(C.parseDate(key), -1))] || null;
  }
  function effectiveSession(base) {
    var ci = state.checkins[base.date];
    return withCycle(C.adaptSession(base, ci, prevCheckin(base.date), C.paceZones(state.profile), { profile: state.profile, checkins: state.checkins }));
  }
  // آمار «انجام‌شده» از داده‌ی واقعی: جلسه‌هایی که کاربر «انجام دادم» زده، با حجمی که همون لحظه ثبت شده
  // (بعد از تطبیق با چک‌این و روزهای پریود)؛ در کنار برنامه‌ی همون بازه
  function doneStats(list) {
    var o = { n: 0, km: 0, min: 0, d: 0, dkm: 0, dmin: 0 };
    var off = function (t) { return ['rest', 'none', 'cancelled'].indexOf(t) >= 0; };
    list.forEach(function (r) {
      var s = r.session, k = s.date;
      if (!off(s.type)) { o.n++; o.km += s.km || 0; o.min += s.minutes || 0; }
      // انجام‌شده: هر روزی که «انجام دادم» خورده، با همون جلسه‌ای که موقع ثبت ذخیره شده (حتی اگه برنامه بعداً جابه‌جا شده باشه)
      if (!state.done[k]) return;
      var log = C.doneSession((state.doneLog || {})[k] || s);
      if (off(log.type)) return;
      o.d++; o.dkm += log.km || 0; o.dmin += Math.round(log.realMin || log.minutes || 0);
    });
    o.km = Math.round(o.km * 10) / 10; o.dkm = Math.round(o.dkm * 10) / 10;
    return o;
  }
  // جلسه‌ی جایگزین با همون روز و برچسب نوع
  function dressAlt(alt, s) {
    alt = JSON.parse(JSON.stringify(alt));
    alt.date = s.date; alt.dayName = s.dayName; alt.dayShort = s.dayShort;
    alt.label = C.TYPE_INFO[alt.type].label; alt.hard = false; alt.original = s;
    return alt;
  }
  // چرخه‌ی قاعدگی:
  //  روزهای پریود: اگه کاربر حالت تمرین رو انتخاب کرده (پیش‌فرض یا فقط برای همین دوره)، برنامه خودکار تنظیم می‌شه
  //  بقیه‌ی روزها (و کاربرهای بدون انتخاب): فقط پیشنهاد؛ جلسه فقط با انتخاب خود کاربر (adapt / rest) عوض می‌شه
  function withCycle(r) {
    var s = r.session;
    if (!s || s.type === 'cancelled' || !s.date) return r;
    var info = C.cycleInfo(state.profile, C.parseDate(s.date));
    if (!info) return r;
    r.cycle = { info: info };
    var pp = C.periodPlan(state.profile, C.parseDate(s.date));
    if (pp) {
      var ps = C.periodSession(s, pp, C.paceZones(state.profile));
      r.cycle.period = pp; r.cycle.label = s.label;
      var cut = ps && ps.periodCut;
      r.cycle.cut = cut || null;
      r.cycle.result = ps ? ps.type === 'rest' ? 'rest' : !cut ? 'easy' : cut.unit === 'min' ? 'shorterMin' : cut.intensity ? 'easy' : 'shorter'
        : s.type === 'race' ? 'race' : pp.mode === 'normal' && s.hard ? 'normal' : null;
      if (ps) r.session = dressAlt(ps, s);
      return r;
    }
    var sug = C.cycleSuggestion(s, info, C.paceZones(state.profile));
    if (!sug) { if (info.phase === 'follicular' && s.hard && s.type !== 'race') r.cycle.note = 'follicular'; return r; }
    var ch = (state.cycleChoices || {})[s.date];
    r.cycle.sug = sug; r.cycle.choice = ch; r.cycle.label = s.label;
    var alt = ch === 'adapt' ? sug.alt : (ch === 'rest' ? sug.rest : null);
    if (alt) r.session = dressAlt(alt, s);
    return r;
  }
  function cycleBox(r, key, todayKey) {
    var c = r && r.cycle;
    if (!c || key < todayKey) return '';
    if (c.note === 'follicular') return '<p class="cycle-note small">' + esc(T('cycle.follicularNote')) + '</p>';
    if (c.period) {
      var pd = c.period;
      return '<div class="alert cycle-box" role="status"><p>' + t(T('cycle.periodBox', { day: pd.info.day, mode: T('cycle.modeShort.' + pd.mode), src: T('cycle.src.' + (pd.overridden ? 'override' : 'def')) })) +
        (c.result ? ' ' + t(T('cycle.periodResult.' + c.result, { label: c.label, from: c.cut && c.cut.from, to: c.cut && c.cut.to })) : '') + '</p>' +
        '<a class="linklike" href="#profile" data-focus-period="1">' + esc(T('cycle.periodChange')) + '</a></div>';
    }
    if (!c.sug) return '';
    var when = key === todayKey ? T('cycle.when.today') : T('cycle.when.date', { d: faDate(key) });
    if (c.choice) {
      return '<div class="alert cycle-box" role="status"><p>' + esc(T('cycle.chosen.' + c.choice)) + '</p>' +
        '<button type="button" class="linklike" data-cycle-undo="' + key + '">' + esc(T('cycle.undo')) + '</button></div>';
    }
    var msg = c.sug.phase === 'period' ? T('cycle.promptPeriod', { when: when, day: c.sug.day, label: c.label }) + (c.sug.heavy ? ' ' + T('cycle.promptHeavy') : '')
      : T('cycle.promptLuteal', { when: when, label: c.label });
    return '<div class="alert cycle-box" role="group"><p>' + t(msg) + '</p><p class="small muted">' + esc(T('cycle.decide')) + '</p><div class="actions">' +
      '<button type="button" class="btn btn-primary" data-cycle-choice="adapt" data-date="' + key + '">' + esc(T('cycle.btnAdapt')) + '</button>' +
      (c.sug.rest ? '<button type="button" class="btn btn-outline" data-cycle-choice="rest" data-date="' + key + '">' + esc(T('cycle.btnRest')) + '</button>' : '') +
      '<button type="button" class="btn btn-ghost" data-cycle-choice="keep" data-date="' + key + '">' + esc(T('cycle.btnKeep')) + '</button></div></div>';
  }
  // نشانگر ملایم فاز روی خونه‌های تقویم (قابل خاموش شدن)
  function cycleMarkClass(dateKey) {
    if (settings.cycleMarkers === false) return '';
    var info = C.cycleInfo(state.profile, C.parseDate(dateKey));
    return info ? ' cy cy-' + info.phase + (info.heavy ? ' cy-heavy' : '') : '';
  }
  function cycleLegend(keys) {
    if (settings.cycleMarkers === false || !C.cycleInfo(state.profile, today())) return '';
    var seen = [];
    keys.forEach(function (k) { var i = C.cycleInfo(state.profile, C.parseDate(k)); if (i && i.phase !== 'luteal' && seen.indexOf(i.phase) < 0) seen.push(i.phase); });
    if (!seen.length) return '';
    return '<div class="cycle-legend">' + C.CYCLE_PHASES.filter(function (ph) { return seen.indexOf(ph) >= 0; }).map(function (ph) {
      return '<span class="cy cy-' + ph + '"><i aria-hidden="true"></i>' + esc(T('cycle.phase.' + ph)) + '</span>';
    }).join('') + '</div>';
  }
  // کارت داشبورد: فاز امروز و تخمین پریود بعدی (یادآوری چند روز قبل)
  function cycleCard(now, extra) {
    var np = C.nextPeriod(state.profile, now);
    if (!np) return '';
    var info = C.cycleInfo(state.profile, now);
    var soon = !np.inPeriod && np.daysTo <= 5;
    var pp = np.inPeriod ? C.periodPlan(state.profile, now) : null;
    var line = pp ? T('cycle.inPeriodMode', { day: np.day, mode: T('cycle.modeShort.' + pp.mode) }) : np.inPeriod ? T('cycle.inPeriod', { day: np.day })
      : T(soon ? 'cycle.nextSoon' : 'cycle.next', { date: faDate(C.dateKey(np.next)), n: np.daysTo });
    return '<section class="card cycle-card' + (soon || np.inPeriod ? ' cycle-soon' : '') + '"><h3>' + esc(T('cycle.cardTitle')) + '</h3>' +
      '<p class="small muted">' + tt('cycle.today', { day: info.day, phase: T('cycle.phase.' + info.phase) }) + '</p>' +
      '<p>' + t(line) + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-ghost" data-period-started="1">' + esc(T('cycle.started')) + '</button></div>' +
      '<p class="small muted">' + esc(T('cycle.estimate')) + '</p>' + (extra || '') + learnMore(['cycle']) + '</section>';
  }
  function unackedPainToday() {
    var k = C.dateKey(today());
    var ci = state.checkins[k];
    return ci && ci.pain && !state.ackPain[k] ? k : null;
  }

  function needsMigration() { return state.profile && state.profile.schemaVersion !== SCHEMA_VERSION; }

  // ---------- مسیریابی ----------
  var VIEWS = { home: renderHome, plan: renderPlan, checkin: renderCheckin, fitness: renderFitness, race: renderRace, settings: renderSettings, plans: renderPlans, walkgoals: renderWalkGoals, progress: renderProgressPage, gait: renderGaitPage, learn: renderLearn, guide: renderGuide, profile: renderProfile, onboarding: renderOnboarding };
  function route() {
    var loginMode = !isEntered();
    document.body.classList.toggle('login-mode', loginMode);
    var tabbar = document.getElementById('tabbar');
    if (loginMode) {
      tabbar.hidden = true;
      document.body.classList.remove('has-tabbar');
      document.getElementById('medical-banner').hidden = true;
      renderLogin();
      lastView = null;
      closeInbox(true);
      updateHeader();
      return;
    }
    var v = (location.hash || '#home').slice(1), sub = null;
    // مقاله‌ی آموزش: #learn/<شناسه>
    if (v.indexOf('learn/') === 0) { sub = v.slice(6); v = 'learn'; }
    // آدرس‌های قدیمی تب‌های پروفایل (#profile/progress و #profile/gait) حالا صفحه‌های جدای «پیشرفت» و «بیومکانیک»‌ان
    else if (v === 'profile/progress' || v === 'profile/gait') { v = v.slice(8); try { history.replaceState(history.state, '', '#' + v); } catch (e) { /* */ } }
    else if (v.indexOf('profile/') === 0) v = 'profile';
    // بدون پروفایل فقط فرم اولیه؛ به‌جز راهنما و مقاله‌ها که از لینک‌های «؟» و «بیشتر بدان» داخل خود فرم باز می‌شن
    var noProfile = !state.profile || needsMigration();
    if (noProfile && v !== 'guide' && v !== 'learn') v = 'onboarding';
    if (!VIEWS[v]) v = 'home';
    // صفحه‌های فقط دویدن برای کاربر پیاده‌روی
    if (!noProfile && C.isWalk(state.profile) && ['plans', 'race', 'fitness', 'gait'].indexOf(v) >= 0) v = 'home';
    // نوار پایین: همه‌جا به‌جز ورود و فرم اولیه؛ صفحه‌های فرعی زیر تب مادرشون فعال می‌شن
    var tab = TAB_OF[v] || null;
    tabbar.hidden = v === 'onboarding' || noProfile;
    document.body.classList.toggle('has-tabbar', !tabbar.hidden);
    tabbar.querySelectorAll('a').forEach(function (a) {
      var on = a.dataset.tab === tab;
      a.classList.toggle('is-active', on);
      if (on && a.dataset.tab === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    // هشدار پزشکی فقط در صفحه‌ی چک‌این
    document.getElementById('medical-banner').hidden = v !== 'checkin';
    // پیش‌نویس «استفاده به‌عنوان الگو» فقط تا وقتی صفحه‌ی مسابقه‌ها بازه
    if (v !== 'race') raceDraft = null;
    // پخش‌کننده‌ها و ویدیوهای تحلیل دویدن کامل آزاد می‌شن؛ تب بیومکانیک دوباره می‌سازدشون
    destroyGaitPlayers();
    // برگه‌ی انتخاب زمان با عوض شدن صفحه بسته می‌شه
    window.CoachTimePicker.close(false);
    window.CoachTimePicker.setDigits(fa);
    VIEWS[v](sub);
    if (SUB_PAGES[v]) {
      app.insertAdjacentHTML('afterbegin', backBar(v));
      // هشدار پزشکی صفحه‌ی چک‌این زیر نوار برگشت
      if (v === 'checkin') {
        var mb = document.getElementById('medical-banner');
        mb.hidden = true;
        app.querySelector('.back-bar').insertAdjacentHTML('afterend', mb.outerHTML.replace(' id="medical-banner"', '').replace(' hidden', ''));
      }
    }
    animateView(v, tab);
    // رفتن مستقیم به یک بخش فرم (مثلاً «ویرایش داده‌های چرخه» از پروفایل)
    if (pendingFocus) {
      var pf = pendingFocus;
      pendingFocus = null;
      setTimeout(function () { var el = document.getElementById(pf); if (el) el.scrollIntoView({ block: 'start' }); }, 0);
    }
    var pk = unackedPainToday();
    if (pk) openPainModal(pk);
    closeInbox(true);
    checkInbox();
    updateHeader();
  }
  var pendingFocus = null;
  // «مشاهده جزئیات» از خانه: برنامه روی امروز، در هفته‌ی جاری
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-goto-today]')) { selectedDay = C.dateKey(today()); viewWeekOffset = 0; monthOffset = 0; }
  }, true);
  document.addEventListener('click', function (e) {
    var f = e.target.closest && e.target.closest('[data-onb-focus]');
    if (f) pendingFocus = f.dataset.onbFocus === 'cycle' ? 'cycle-fieldset' : f.dataset.onbFocus === 'goal' ? 'gtype' : null;
    if (e.target.closest && e.target.closest('[data-focus-period]')) pendingFocus = 'period-card';
  }, true);
  // صفحه‌های فرعی: نوار برگشت بالای صفحه (برگشت واقعی تاریخچه، وگرنه تب مادر)
  var SUB_PAGES = { checkin: '#home', race: '#profile', plans: '#race', walkgoals: '#profile', progress: '#profile', gait: '#profile', fitness: '#progress', guide: '#learn', settings: '#profile' };
  function backBar(v) {
    var s = navState(), from = s && s.depth > 0 ? s.from : null;
    return '<nav class="back-bar"><a class="learn-back" href="' + SUB_PAGES[v] + '"' + (from ? ' data-nav-back="1"' : '') + '>' +
      chevron(isRtl() ? 'right' : 'left') + esc(T('app.back')) + '</a></nav>';
  }
  // تب مادر هر صفحه
  var TABS = ['home', 'plan', 'learn', 'profile'];
  var TAB_OF = { home: 'home', checkin: 'home', race: 'profile', plans: 'profile', walkgoals: 'profile', progress: 'profile', gait: 'profile', plan: 'plan', fitness: 'profile',
    learn: 'learn', guide: 'learn', profile: 'profile', settings: 'profile' };
  // جابه‌جایی نرم بین صفحه‌ها: بین تب‌ها لغزش افقی هم‌جهت با ترتیب تب‌ها (در RTL برعکس)، بقیه محو شدن ملایم
  var lastView = null, lastTab = null;
  function animateView(v, tab) {
    if (v === lastView) return;
    var cls = 'view-in';
    if (lastTab && tab && lastTab !== tab) {
      var fwd = TABS.indexOf(tab) > TABS.indexOf(lastTab);
      cls = (fwd !== isRtl()) ? 'view-in-end' : 'view-in-start';
    }
    lastView = v; lastTab = tab;
    app.classList.remove('view-in', 'view-in-end', 'view-in-start');
    void app.offsetWidth;
    app.classList.add(cls);
  }
  app.addEventListener('animationend', function () { app.classList.remove('view-in', 'view-in-end', 'view-in-start'); });

  // ---------- تاریخچه‌ی ناوبری ----------
  // هر ورودی تاریخچه (history.state) عمق، صفحه‌ی مبدأ، موقعیت اسکرول و وضعیت نما (روز انتخاب‌شده، هفته/ماه، بخش‌های باز) رو نگه می‌داره؛
  // با برگشت (دکمه‌ی مرورگر یا دکمه‌ی داخل برنامه) همون صفحه، همون روز و همون اسکرول برمی‌گرده.
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* */ }
  var navDepth = 0;
  function navState() { var s = history.state; return s && typeof s === 'object' && s.depth != null ? s : null; }
  function setNav(s) { try { history.replaceState(s, ''); } catch (e) { /* */ } }
  // پیش‌نویس فرم اولیه (مرحله، مقدار فیلدها و چرخ‌های زمان)، تا برگشت از راهنما یا مقاله چیزی رو پاک نکنه
  var onbApi = null;
  function onbDraft() {
    var f = document.getElementById('onb');
    if (!f || !onbApi) return null;
    var fields = Array.prototype.map.call(f.elements, function (el) {
      if (!el.name && !el.id) return null;
      return { id: el.id || null, name: el.name || null, val: el.value, type: el.type, on: el.checked };
    }).filter(Boolean);
    var picks = Array.prototype.map.call(f.querySelectorAll('.tpick'), function (pk) {
      var inp = pk.querySelector('input[type=hidden]');
      return { id: pk.id.replace(/-picker$/, ''), val: inp ? inp.value : '', set: pk.classList.contains('is-set') };
    });
    return { step: onbApi.cur(), max: onbApi.max(), fields: fields, picks: picks };
  }
  function applyOnbDraft(d) {
    var f = document.getElementById('onb');
    if (!f || !d || !onbApi) return;
    d.fields.forEach(function (x) {
      var el = x.id ? document.getElementById(x.id) : null;
      if (!el && x.name && (x.type === 'radio' || x.type === 'checkbox')) el = f.querySelector('input[name="' + x.name + '"][value="' + String(x.val).replace(/"/g, '\\"') + '"]');
      if (!el && x.name) el = f.elements[x.name];
      if (!el || el.type === 'hidden' || el.type === 'file' || el.length) return;
      if (x.type === 'radio' || x.type === 'checkbox') el.checked = x.on; else el.value = x.val;
    });
    // فیلدهای وابسته (بخش‌های پنهان/نمایان، پیش‌نمایش سطح) با همون رویدادهای فرم همگام می‌شن
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
    (d.picks || []).forEach(function (pk) {
      var sec = C.parseTime(pk.val);
      if (!sec) return;
      if (pk.set) window.CoachTimePicker.set(pk.id, pk.val, true);
      else window.CoachTimePicker.preset(pk.id, sec);
    });
    onbApi.setMax(d.max || 1);
    onbApi.go(d.step || 1, true);
  }
  function snapshot() {
    var s = navState();
    if (!s) return;
    var dr = onbDraft();
    if (dr) s.onb = dr; else delete s.onb;
    s.y = Math.round(window.scrollY || 0);
    s.ui = { day: selectedDay, wk: viewWeekOffset, mo: monthOffset,
      open: Array.prototype.map.call(app.querySelectorAll('details[open][id]'), function (d) { return d.id; }) };
    setNav(s);
  }
  function restore(s) {
    if (s.ui) { selectedDay = s.ui.day; viewWeekOffset = s.ui.wk || 0; monthOffset = s.ui.mo || 0; }
    route();
    if (s.onb && location.hash === '#onboarding') applyOnbDraft(s.onb);
    if (s.ui && s.ui.open) s.ui.open.forEach(function (id) { var d = document.getElementById(id); if (d) d.open = true; });
    var y = s.y || 0;
    window.scrollTo(0, y);
    // اگه چیدمان بعد از رندر کمی جابه‌جا شد، یک بار دیگه
    requestAnimationFrame(function () { if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); });
  }
  // ذخیره‌ی موقعیت پیش از ترک صفحه (کلیک روی هر لینک داخلی) و حین اسکرول
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a) snapshot();
  }, true);
  // بعد از توقف اسکرول (debounce؛ Safari تعداد replaceState رو محدود می‌کنه)
  var snapTimer = null;
  window.addEventListener('scroll', function () {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(snapshot, 250);
  }, { passive: true });
  window.addEventListener('hashchange', function (e) {
    var s = navState();
    if (s) { navDepth = s.depth; restore(s); return; } // برگشت یا جلو به ورودی‌ای که قبلاً دیده شده
    navDepth += 1;
    var from = e.oldURL && e.oldURL.indexOf('#') >= 0 ? e.oldURL.slice(e.oldURL.indexOf('#')) : '#home';
    setNav({ depth: navDepth, from: from });
    // صفحه‌ی راهنما اسکرول رو خودش مدیریت می‌کنه (رفتن به بخش هدف)
    var toGuide = location.hash === '#guide';
    route();
    if (!toGuide) window.scrollTo(0, 0);
  });

  // لینک «؟» کنار هر بخش → صفحه‌ی آموزش، با باز شدن همون قسمت
  var guideTarget = null;
  function helpLink(section, label) {
    var l = esc(label || T('app.help'));
    return '<a class="help-link" href="#guide" data-guide="' + section + '" aria-label="' + l + '" title="' + l + '">' + esc(T('app.helpMark')) + '</a>';
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-guide]');
    if (!g) return;
    guideTarget = g.dataset.guide;
    if (location.hash === '#guide') { e.preventDefault(); route(); }
  });

  // تأیید زنده‌ی زمان واردشده: «= ۹ دقیقه و ۴۰ ثانیه»
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.timePreview) return;
    var out = document.getElementById(el.dataset.timePreview);
    if (!out) return;
    var v = el.value.trim(), sec = C.parseTime(v);
    out.textContent = !v ? '' : (sec ? '= ' + fa(C.describeDuration(sec)) : T('app.timeBad'));
    out.classList.toggle('bad', !!v && !sec);
  });

  // =====================================================================
  // ۰. صفحه‌ی ورود
  // =====================================================================
  function renderLogin() {
    var lang = I.getLang();
    app.innerHTML = '<section class="login" aria-labelledby="login-title">' +
      '<div class="login-top">' +
      '<img class="login-logo logo-on-dark" src="public/assets/gaam-logo-transparent.svg?v=81" alt="' + esc(T('app.name')) + '" width="217" height="100">' +
      '<img class="login-logo logo-on-light" src="public/assets/gaam-logo-transparent-light.svg?v=81" alt="' + esc(T('app.name')) + '" width="217" height="100">' +
      '<h1 id="login-title">' + esc(T('login.welcome')) + '</h1>' +
      '<p class="login-sub">' + esc(T('login.subtitle')) + '</p>' +
      '<button type="button" class="btn login-btn" id="login-btn">' + esc(T('login.button')) + '</button>' +
      restoreBlock() +
      '</div>' +
      '<div class="login-lang" role="group" aria-label="' + esc(T('login.langLabel')) + '">' +
      '<button type="button" class="lang-flag" data-lang="fa" lang="fa" aria-pressed="' + (lang === 'fa') + '" aria-label="فارسی" title="فارسی"><img src="public/assets/flag-ir.svg?v=81" alt="" width="28" height="28"></button>' +
      '<button type="button" class="lang-flag" data-lang="en" lang="en" aria-pressed="' + (lang === 'en') + '" aria-label="English" title="English"><img src="public/assets/flag-gb.svg?v=81" alt="" width="28" height="28"></button>' +
      '</div></section>';
    app.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { if (b.dataset.lang !== I.getLang()) switchLang(b.dataset.lang); });
    });
    document.getElementById('login-btn').addEventListener('click', function () {
      setEntered(true);
      var target = state.profile && !needsMigration() ? '#home' : '#onboarding';
      if (location.hash === target) route(); else location.hash = target;
      window.scrollTo(0, 0);
    });
  }

  // ---------- خروج و ساخت پروفایل تازه (برای امتحان دوباره‌ی فرم اولیه) ----------
  // پروفایل فعلی و عکسش روی همین دستگاه کنار گذاشته می‌شن و از صفحه‌ی ورود برمی‌گردن.
  // اگه قبلاً پروفایلی کنار گذاشته شده باشه، همون حفظ می‌شه و پروفایل فعلی (آزمایشی) پاک می‌شه.
  var STASH_KEY = 'iranrunners-coach-stash', STASH_AVATAR_KEY = 'iranrunners-coach-stash-avatar';
  function getStash() { try { var r = localStorage.getItem(STASH_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function stashName(st) {
    var p = st && st.profile;
    return p ? [p.name, p.lastName].map(function (x) { return (x || '').trim(); }).filter(Boolean).join(' ') || T('profile.noName') : '';
  }
  function signOutBlock() {
    var has = !!getStash();
    return '<div class="signout" id="signout"><p class="group-label signout-label" role="heading" aria-level="2">' + esc(T('signout.title')) + '</p>' +
      '<p class="small muted">' + esc(T(has ? 'signout.hintStashed' : 'signout.hint')) + '</p>' +
      '<button type="button" class="btn btn-outline btn-block signout-btn" data-signout="1">' + esc(T('signout.btn')) + '</button>' +
      '<div class="alert alert-adapt signout-confirm" role="alertdialog" aria-live="polite" hidden><p>' + esc(T(has ? 'signout.confirmStashed' : 'signout.confirm')) + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-signout-yes="1">' + esc(T('signout.yes')) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-signout-no="1">' + esc(T('app.cancel')) + '</button></div></div></div>';
  }
  function restoreBlock() {
    var st = getStash();
    if (!st || !st.profile) return '';
    return '<div class="login-restore"><button type="button" class="btn btn-outline btn-block" data-restore="1">' + esc(T('signout.restore', { n: stashName(st) })) + '</button>' +
      '<p class="login-note">' + esc(T(state.profile ? 'signout.restoreHintTest' : 'signout.restoreHint')) + '</p></div>';
  }
  function signOut() {
    try {
      if (!getStash() && state.profile) {
        localStorage.setItem(STASH_KEY, JSON.stringify(state));
        var av = localStorage.getItem(AVATAR_KEY);
        if (av) localStorage.setItem(STASH_AVATAR_KEY, av);
      }
      localStorage.removeItem(STORE_KEY); localStorage.removeItem(AVATAR_KEY);
    } catch (e) { showToast(T('app.saveFailed')); return; }
    state = emptyState(); memoryFallback = null;
    setEntered(false);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    route();
    window.scrollTo(0, 0);
    showToast(T('signout.done'));
  }
  function restoreStash() {
    var st = getStash();
    if (!st) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(st));
      var av = localStorage.getItem(STASH_AVATAR_KEY);
      if (av) localStorage.setItem(AVATAR_KEY, av); else localStorage.removeItem(AVATAR_KEY);
      localStorage.removeItem(STASH_KEY); localStorage.removeItem(STASH_AVATAR_KEY);
    } catch (e) { showToast(T('app.saveFailed')); return; }
    state = Object.assign(emptyState(), st); memoryFallback = state;
    setEntered(true);
    if (location.hash === '#home') route(); else location.hash = '#home';
    window.scrollTo(0, 0);
    showToast(T('signout.restored', { n: stashName(st) }));
  }
  document.addEventListener('click', function (e) {
    var t0 = e.target.closest && e.target.closest('[data-signout], [data-signout-yes], [data-signout-no], [data-restore]');
    if (!t0) return;
    if (t0.dataset.restore) { restoreStash(); return; }
    var box = t0.closest('.signout'), c = box && box.querySelector('.signout-confirm');
    if (t0.dataset.signout && c) { c.hidden = false; c.querySelector('[data-signout-yes]').focus(); return; }
    if (t0.dataset.signoutNo && c) { c.hidden = true; box.querySelector('[data-signout]').focus(); return; }
    if (t0.dataset.signoutYes) signOut();
  });

  // =====================================================================
  // ۱. فرم اولیه
  // =====================================================================
  // فاصله‌های رایج برای رکورد؛ «other» = فاصله‌ی دلخواه
  var PB_DISTANCES = [['m1500', 1.5], ['m3000', 3], ['5', 5], ['10', 10], ['21', 21.0975], ['42', 42.195], ['other', null]];
  var VOL_REASONS = ['injury', 'illness', 'travel', 'other', 'none'];
  var ONB_STEPS = 5;
  function pbDistanceKey(km) {
    if (!km) return '';
    for (var i = 0; i < PB_DISTANCES.length - 1; i++) if (Math.abs(PB_DISTANCES[i][1] - km) < 0.01) return PB_DISTANCES[i][0];
    return 'other';
  }

  // کارت سطح: فقط عدد، اسم و منبع؛ توضیح کامل در بخش آموزش
  function levelCard(a, compact) {
    var L = a.info;
    return '<div class="level-card' + (compact ? ' compact' : '') + '">' +
      '<div class="level-num" aria-hidden="true"><b>' + fa(a.level) + '</b><small>' + esc(T('level.of10')) + '</small></div>' +
      '<div class="level-body"><h3>' + tt('level.title', { n: a.level, name: L.name }) + ' ' + helpLink('levels', T('level.help')) + '</h3>' +
      '<p class="small muted">' + (a.source === 'pb' ? tt('level.fromPb', { v: a.vdot.toFixed(1) }) : esc(T(a.source === 'never' ? 'level.fromZero' : 'level.fromVolume'))) + '</p>' +
      a.notes.map(function (n) { return '<p class="small level-note">' + t(n) + '</p>'; }).join('') +
      '</div></div>';
  }

  var START_MAX_DAYS = 90;
  function renderOnboarding() {
    var p = state.profile || {};
    var editing = !!state.profile;
    var migrating = editing && p.schemaVersion !== SCHEMA_VERSION;
    var goal = C.goalInfo(p);
    var pb = p.pb || {};
    var days = p.days || [];
    var locs = p.locations || [];
    var todayKey = C.dateKey(today());
    var pbKey = pbDistanceKey(pb.distanceKm);
    var req = ' <span class="req">' + esc(T('onb.required')) + '</span>';
    var cyc = p.cycle || {};
    // پروفایل‌های قدیمی فقط یک عدد حجم دارن: هر دو فیلد با همون پر می‌شن
    var oldKm = p.currentWeeklyKm != null && (p.currentWeeklyKm > 0 || !migrating) && p.experience !== 'never' ? p.currentWeeklyKm : '';
    var volLast = p.lastWeekKm != null && p.experience !== 'never' ? p.lastWeekKm : oldKm;
    var volAvg = p.monthAvgKm != null && p.experience !== 'never' ? p.monthAvgKm : oldKm;

    function chip(name, value, label, checked, type) {
      return '<label class="chip"><input type="' + (type || 'checkbox') + '" name="' + name + '" value="' + value + '"' +
        (checked ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
    }

    // هر مرحله یک موضوع؛ همه‌ی فیلدها در یک فرم می‌مونن تا رفت‌وبرگشت بین مرحله‌ها چیزی رو پاک نکنه
    function step(n, body) {
      return '<section class="onb-step" data-step="' + n + '"' + (n === 1 ? '' : ' hidden') + ' aria-labelledby="onb-step-title-' + n + '">' +
        '<header class="onb-step-head"><p class="onb-step-count">' + tt('onb.stepOf', { n: n, total: ONB_STEPS }) + '</p>' +
        '<h2 id="onb-step-title-' + n + '" tabindex="-1">' + esc(T('onb.steps.' + n + '.t')) + '</h2>' +
        '<p class="muted">' + esc(T('onb.steps.' + n + '.sub')) + '</p></header>' + body + '</section>';
    }
    var dots = '<ol class="onb-dots" aria-label="' + esc(T('onb.progressAria')) + '">' +
      [1, 2, 3, 4, 5].map(function (n) {
        return '<li><button type="button" class="onb-dot" data-goto-step="' + n + '" aria-label="' + esc(T('onb.stepOf', { n: n, total: ONB_STEPS }) + ' · ' + T('onb.steps.' + n + '.t')) + '"><span></span></button></li>';
      }).join('') + '</ol>';

    app.innerHTML =
      '<section class="card onboarding onb-wizard">' +
      '<div class="onb-top">' +
      '<p class="onb-kicker" id="onb-kicker">' + esc(T(editing ? 'onb.titleEdit' : (p.activity === 'walk' ? 'onb.titleNewWalk' : 'onb.titleNew'))) + '</p>' + dots + '</div>' +
      (migrating ? '<div class="alert alert-adapt" role="status"><strong>' + esc(T('onb.migTitle')) + '</strong>' +
        '<p>' + esc(T('onb.migText')) + '</p></div>' : '') +
      '<form id="onb" novalidate><div class="onb-stage">' +

      // ۱. نوع ورزش و اطلاعات هویتی
      step(1,
        '<p class="sub-legend" id="act-q">' + esc(T('onb.activityQ')) + '</p><div class="act-choice" role="radiogroup" aria-labelledby="act-q">' +
        ['run', 'walk'].map(function (k) {
          return '<label class="act-opt"><input type="radio" name="activity" value="' + k + '"' + ((p.activity || 'run') === k ? ' checked' : '') + '>' +
            '<span><b>' + esc(T('onb.activity.' + k)) + '</b><small>' + esc(T('onb.activity.' + k + 'Sub')) + '</small></span></label>';
        }).join('') + '</div>' +
        '<div class="onb-photo"><span class="onb-photo-pic" data-avatar-slot="72">' + avatarHtml(72) + '</span><div class="onb-photo-txt">' +
        '<p class="sub-legend">' + esc(T('onb.photo')) + '</p><div class="onb-photo-acts">' +
        '<label class="btn btn-ink btn-sm" for="avatar-file">' + esc(T(getAvatar() ? 'profile.photoChange' : 'profile.photoPick')) + '</label>' +
        '<input type="file" id="avatar-file" accept="image/*" class="sr-only">' +
        '<button type="button" class="linklike small" data-avatar-remove="1"' + (getAvatar() ? '' : ' hidden') + '>' + esc(T('profile.photoRemove')) + '</button></div>' +
        '</div></div>' +
        '<div class="row2">' +
        '<div class="field"><label for="fname">' + esc(T('onb.firstName')) + '</label><input id="fname" name="firstName" type="text" maxlength="40" autocomplete="given-name" value="' + esc(p.name || '') + '" placeholder="' + esc(T('onb.firstNamePh')) + '"></div>' +
        '<div class="field"><label for="lname">' + esc(T('onb.lastName')) + '</label><input id="lname" name="lastName" type="text" maxlength="40" autocomplete="family-name" value="' + esc(p.lastName || '') + '" placeholder="' + esc(T('onb.lastNamePh')) + '"></div>' +
        '</div>' +
        '<p class="sub-legend">' + esc(T('cycle.sexQ')) + '</p><div class="chips">' +
        ['female', 'male', 'na'].map(function (k) { return chip('sex', k, T('cycle.sex.' + k), p.sex === k, 'radio'); }).join('') + '</div>' +
        '<small class="muted">' + esc(T('cycle.sexHint')) + '</small>') +

      // ۲. مشخصات بدنی (+ چرخه برای زنان)
      step(2,
        '<div class="row3">' +
        '<div class="field"><label for="age">' + esc(T('onb.age')) + req + '</label><input id="age" name="age" type="number" inputmode="numeric" min="12" max="90" required value="' + esc(p.age || '') + '"></div>' +
        '<div class="field"><label for="height">' + esc(T('onb.height')) + req + '</label><input id="height" name="heightCm" type="number" inputmode="numeric" min="120" max="230" required value="' + esc(p.heightCm || '') + '"></div>' +
        '<div class="field"><label for="weight">' + esc(T('onb.weight')) + req + '</label><input id="weight" name="weightKg" type="number" inputmode="decimal" min="30" max="250" required value="' + esc(p.weightKg || '') + '"></div>' +
        '</div>' +
        '<fieldset id="cycle-fieldset" class="onb-sub" hidden><legend>' + esc(T('cycle.title')) + '</legend>' +
        '<p class="small">' + esc(T('cycle.intro')) + '</p>' +
        '<label class="check-row"><input type="checkbox" id="cyon" name="cycleOn"' + (cyc.enabled ? ' checked' : '') + '> <span>' + esc(T('cycle.enable')) + '</span></label>' +
        '<div id="cycle-fields" hidden><div class="row3">' +
        '<div class="field"><label for="cystart">' + esc(T('cycle.lastStart')) + '</label><input id="cystart" name="cycleStart" type="date" max="' + todayKey + '" value="' + esc(cyc.lastStart || '') + '">' +
        '<small class="muted" id="cystart-fa"></small></div>' +
        '<div class="field"><label for="cylen">' + esc(T('cycle.cycleLen')) + '</label><input id="cylen" name="cycleLen" type="number" inputmode="numeric" min="21" max="45" value="' + esc(cyc.cycleLen || 28) + '">' +
        '<small class="muted">' + esc(T('cycle.cycleLenHint')) + '</small></div>' +
        '<div class="field"><label for="cyplen">' + esc(T('cycle.periodLen')) + '</label><input id="cyplen" name="periodLen" type="number" inputmode="numeric" min="2" max="10" value="' + esc(cyc.periodLen || 5) + '"></div>' +
        '</div>' +
        // تمرین در روزهای پریود: پیش‌فرض برای هر ماه (برای یک دوره‌ی خاص از پروفایل قابل تغییره)
        '<p class="sub-legend" id="pmode-q">' + esc(T('cycle.periodQ')) + req + '</p><div class="chips chips-stack" role="radiogroup" aria-labelledby="pmode-q">' +
        C.PERIOD_MODES.map(function (k) { return chip('periodMode', k, T('cycle.mode.' + k), cyc.periodMode === k, 'radio'); }).join('') + '</div>' +
        '<small class="muted">' + esc(T('cycle.periodQHint')) + '</small>' +
        '</div>' +
        '</fieldset>') +

      // ۳. وضعیت فعلی دویدن
      step(3,
        '<div id="walk-fields3" hidden>' +
        '<p class="sub-legend">' + esc(T('onb.walkExpQ')) + req + '</p><div class="chips">' +
        ['never', 'lt3m', '3to12m', 'gt1y'].map(function (k) { return chip('walkExp', k, T('onb.walkExp.' + k), p.walkExp === k, 'radio'); }).join('') + '</div>' +
        '<div class="field" id="walkmin-field"><label for="walkmin">' + esc(T('onb.walkMin')) + req + '</label>' +
        '<input id="walkmin" name="walkMin" type="number" inputmode="numeric" min="0" max="2000" step="5" value="' + esc(p.walkMin != null ? p.walkMin : '') + '">' +
        '<small class="muted">' + esc(T('onb.walkMinHint')) + '</small></div>' +
        '<div id="walk30-block"><p class="sub-legend">' + esc(T('onb.walk30Q')) + req + '</p><div class="chips">' +
        chip('walk30', 'yes', T('app.yes'), p.walk30 === 'yes', 'radio') + chip('walk30', 'no', T('app.no'), p.walk30 === 'no', 'radio') + '</div></div>' +
        '</div>' +
        '<div id="run-fields3">' +
        '<p class="sub-legend">' + esc(T('onb.expQ')) + req + '</p><div class="chips">' +
        Object.keys(C.EXPERIENCE).map(function (k) { return chip('experience', k, C.EXPERIENCE[k].label, p.experience === k, 'radio'); }).join('') + '</div>' +
        '<p class="alert alert-good zero-note" id="zero-note" hidden>' + esc(T('onb.zeroNote')) + '</p>' +
        '<div id="runner-fields">' +
        '<div class="row2">' +
        '<div class="field"><label for="lastkm">' + esc(T('onb.lastWeek')) + req + '</label>' +
        '<input id="lastkm" name="lastWeekKm" type="number" inputmode="decimal"' + limAttrs('vol', '0.5') + ' required' + kmField(volLast) + '>' +
        '<small class="muted">' + esc(T('onb.lastWeekHint')) + '</small></div>' +
        '<div class="field"><label for="avgkm">' + esc(T('onb.monthAvg')) + req + '</label>' +
        '<input id="avgkm" name="monthAvgKm" type="number" inputmode="decimal"' + limAttrs('vol', '0.5') + ' required' + kmField(volAvg) + '>' +
        '<small class="muted">' + esc(T('onb.monthAvgHint')) + '</small></div></div>' +
        '<div id="reason-block" class="reason-block" hidden><p class="sub-legend">' + esc(T('onb.reasonQ')) + req + '</p>' +
        '<p class="small muted">' + esc(T('onb.reasonHint')) + '</p><div class="chips">' +
        VOL_REASONS.map(function (k) { return chip('volumeReason', k, T('onb.reasons.' + k), p.volumeReason === k, 'radio'); }).join('') + '</div></div>' +
        '<p class="sub-legend">' + esc(T('onb.structQ')) + req + '</p><div class="chips">' +
        chip('structured', 'yes', T('app.yes'), p.structured === true, 'radio') + chip('structured', 'no', T('app.no'), p.structured === false, 'radio') + '</div>' +
        '</div></div>' +
        '<div class="field onb-injury"><label for="injury">' + esc(T('onb.injuryQ')) + '</label>' +
        '<textarea id="injury" name="injury" rows="2" maxlength="300" placeholder="' + esc(T('onb.injuryPh')) + '">' + esc(p.injury || '') + '</textarea>' +
        '<small class="muted">' + esc(T('onb.injuryLabel')) + '</small></div>') +

      // ۴. بهترین رکورد اخیر
      step(4,
        '<p class="alert alert-good" id="pb-never" hidden>' + esc(T('onb.pbNever')) + '</p>' +
        '<p class="alert alert-good" id="pb-walk" hidden>' + esc(T('onb.pbWalk')) + '</p>' +
        '<div id="pb-fields">' +
        '<p class="small pb-intro">' + esc(T('onb.pbIntro')) + '</p>' +
        '<p class="small muted">' + esc(T('onb.pbOptional')) + '</p>' +
        '<div class="row2">' +
        '<div class="field"><label for="pbsel">' + esc(T('onb.pbDist')) + '</label><select id="pbsel" name="pbSel"><option value="">' + esc(T('onb.pbNone')) + '</option>' +
        PB_DISTANCES.map(function (d) { return '<option value="' + d[0] + '"' + (pbKey === d[0] ? ' selected' : '') + '>' + esc(T('pbDist.' + d[0])) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field" id="pbother-field"' + (pbKey === 'other' ? '' : ' hidden') + '><label for="pbother">' + esc(T('onb.pbOtherKm')) + '</label>' +
        '<input id="pbother" name="pbOther" type="number" inputmode="decimal"' + limAttrs('dist', '0.1') + kmField(pbKey === 'other' ? pb.distanceKm : '') + '></div>' +
        '<div class="field field-tpick" id="pbtime-field"' + (pbKey ? '' : ' hidden') + '><span class="field-label" id="pbtime-lbl">' + esc(T('onb.pbTime')) + '</span>' +
        // انتخاب‌گر چرخشی؛ مقدار در input مخفی pbTime (h:mm:ss) — بدون دست زدن کاربر خالیه
        tpo({ id: 'pbtime', name: 'pbTime', sec: pb.timeSec || pbGuess(pb.distanceKm || 5), touched: !!pb.timeSec, preview: 'pbtime-read',
          aria: T('onb.pbTime'), }) +
        '<small class="muted">' + esc(T('onb.pbTimeHint')) + '</small><small class="time-read" id="pbtime-read" aria-live="polite">' +
        (pb.timeSec ? '= ' + fa(C.describeDuration(pb.timeSec)) : '') + '</small></div>' +
        '</div></div>' +
        '<div id="level-preview" aria-live="polite"></div>') +

      // ۵. هدف و بقیه‌ی اطلاعات تخصصی
      step(5,
        // تاریخ شروع برنامه: پیش‌فرض امروز (یا همون تاریخ قبلی در ویرایش)
        '<div class="field"><label for="sdate">' + esc(T('onb.startDate')) + '</label><input id="sdate" name="startDate" type="date" min="' + (editing && p.startDate && p.startDate < todayKey ? p.startDate : todayKey) + '" max="' + C.dateKey(C.addDays(today(), START_MAX_DAYS)) + '" value="' + esc(p.startDate || todayKey) + '">' +
        '<small class="muted" id="sdate-fa"></small><small class="muted">' + esc(T('onb.startDateHint')) + '</small></div>' +
        '<div id="walk-goal5" hidden><p class="sub-legend">' + esc(T('wgoal.onbQ')) + '</p><div class="chips chips-stack">' +
        ['none'].concat(C.WALK_GOALS).map(function (k) { return chip('walkGoal', k, k === 'none' ? T('wgoal.later') : walkGoalTitle(k), ((p.walkGoal && p.walkGoal.kind) || 'none') === k, 'radio'); }).join('') + '</div>' +
        '<small class="muted">' + esc(T('wgoal.onbHint')) + '</small></div>' +
        '<div id="run-goal5"><div class="field"><label for="gtype">' + esc(T('onb.goalType')) + '</label><select id="gtype" name="goalType">' +
        // ترتیب صریح (کلیدهای عددی در Object.keys جلو می‌افتن)
        ['none', '5', '10', '21', '42', 'ultra'].map(function (k) { return '<option value="' + k + '"' + (goal.type === k ? ' selected' : '') + '>' + esc(C.GOAL_TYPES[k]) + '</option>'; }).join('') +
        '</select></div>' +
        '<div id="goal-fields" class="race-fields"' + (goal.type === 'none' ? ' hidden' : '') + '>' +
        '<div class="field"><label for="rdate">' + esc(T('onb.raceDate')) + '</label><input id="rdate" name="raceDate" type="date" min="' + todayKey + '" value="' + esc(goal.date || '') + '">' +
        '<small class="muted" id="rdate-fa"></small></div>' +
        '<div id="ultra-fields"' + (goal.type === 'ultra' ? '' : ' hidden') + '>' +
        '<div class="row2"><div class="field"><label for="ukm">' + esc(T('onb.ultraKm')) + req + '</label>' +
        '<input id="ukm" name="ultraKm" type="number" inputmode="decimal"' + limAttrs('ultra', '0.1') + kmField(goal.km || '') + '></div>' +
        '<div class="field"><label for="ugain">' + esc(T('onb.ultraGain')) + req + '</label>' +
        '<input id="ugain" name="ultraGain" type="number" inputmode="numeric" min="0" max="20000" step="10" value="' + esc(goal.type === 'ultra' ? goal.gain : '') + '"></div></div>' +
        '<div class="row3"><div class="field"><label for="uloss">' + esc(T('onb.ultraLoss')) + '</label>' +
        '<input id="uloss" name="ultraLoss" type="number" inputmode="numeric" min="0" max="20000" step="10" value="' + esc(goal.loss || '') + '"><small class="muted">' + esc(T('onb.ultraLossHint')) + '</small></div>' +
        '<div class="field"><label for="uterrain">' + esc(T('onb.terrain')) + '</label><select id="uterrain" name="ultraTerrain"><option value="">' + esc(T('onb.notSelected')) + '</option>' +
        Object.keys(C.TERRAIN_LABELS).map(function (k) { return '<option value="' + k + '"' + (goal.terrain === k ? ' selected' : '') + '>' + esc(C.TERRAIN_LABELS[k]) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="ualt">' + esc(T('onb.altitude')) + '</label>' +
        '<input id="ualt" name="ultraAlt" type="number" inputmode="numeric" min="0" max="6000" step="10" value="' + esc(goal.altitude || '') + '"></div></div>' +
        '<p id="ultra-ratio" class="ultra-ratio" aria-live="polite"></p>' +
        '</div></div></div>' +
        '<fieldset class="onb-sub"><legend>' + esc(T('onb.daysQ')) + req + '</legend><div class="chips">' +
        C.WEEK_ORDER.map(function (i) { return chip('days', i, C.DAY_NAMES[i], days.indexOf(i) >= 0); }).join('') + '</div></fieldset>' +
        '<fieldset class="onb-sub"><legend>' + esc(T('onb.locsQ')) + req + '</legend><div class="chips">' +
        Object.keys(C.LOCATION_LABELS).map(function (k) { return chip('locations', k, C.LOCATION_LABELS[k], locs.indexOf(k) >= 0); }).join('') + '</div></fieldset>' +
        '<fieldset class="onb-sub"><legend>' + esc(T('onb.hrQ')) + '</legend>' + hrFields(p) + '</fieldset>') +

      '</div>' +
      '<div id="onb-errors" class="form-errors" role="alert" hidden></div>' +
      '<div class="onb-nav">' +
      '<button type="button" class="btn btn-ghost onb-back" id="onb-back">' + chevron(isRtl() ? 'right' : 'left') + '<span>' + esc(T('onb.back')) + '</span></button>' +
      (editing && !needsMigration() ? '<a class="btn btn-ghost onb-cancel" id="onb-cancel" href="#profile">' + esc(T('app.cancel')) + '</a>' : '') +
      '<button type="submit" class="btn btn-primary onb-next" id="onb-next"><span id="onb-next-lbl">' + esc(T('onb.next')) + '</span>' + chevron(isRtl() ? 'left' : 'right') + '</button>' +
      '</div></form></section>';

    var form = document.getElementById('onb');
    window.CoachTimePicker.init(form);

    // زمان شروع چرخ‌ها برای یک مسافت (حدود ۶ دقیقه در کیلومتر، گرد به دقیقه)
    function pbGuess(km) { return Math.round(km * 360 / 60) * 60; }
    // خوندن رکورد از فرم؛ null = رکوردی وارد نشده، false = ناقص/نامعتبر
    function readPb() {
      var sel = form.pbSel.value;
      if (!sel) return null;
      if (sel === 'other' && !inLim('dist', rawIn(form.pbOther))) return false;
      var km = sel === 'other' ? kmIn(form.pbOther) : PB_DISTANCES.filter(function (d) { return d[0] === sel; })[0][1];
      var tt2 = C.parseTime(form.pbTime.value);
      if (!(km > 0) || !tt2) return false;
      // سرعت غیرممکن (سریع‌تر از رکورد جهانی) یا خیلی کند
      var v = km / (tt2 / 3600);
      if (v > 26 || v < 3) return false;
      return { distanceKm: km, timeSec: tt2 };
    }
    function isNever() { var e = form.querySelector('input[name=experience]:checked'); return !!e && e.value === 'never'; }
    function isWalkForm() { var e = form.querySelector('input[name=activity]:checked'); return !!e && e.value === 'walk'; }
    // پیاده‌روی: سابقه، دقیقه‌ی هفتگی، توان ۳۰ دقیقه‌ی پیوسته (بی‌سابقه = «نه»)
    function readWalk() {
      var ex = form.querySelector('input[name=walkExp]:checked'), w3 = form.querySelector('input[name=walk30]:checked');
      var raw = String(form.walkMin.value || '').trim(), m = raw === '' ? null : Number(raw);
      var never = !!ex && ex.value === 'never';
      return { exp: ex ? ex.value : null, min: never ? 0 : m, w30: never ? 'no' : (w3 ? w3.value : null), never: never,
        ok: !!ex && (never || (m !== null && m >= 0 && m <= 2000 && !!w3)) };
    }
    // حجم: هفته‌ی اخیر و میانگین ماه؛ اگه افت شدید باشه، دلیلش لازمه
    function readVolume() {
      if (!inLim('vol', rawIn(form.lastWeekKm)) || !inLim('vol', rawIn(form.monthAvgKm))) return null;
      var last = kmIn(form.lastWeekKm), avg = kmIn(form.monthAvgKm);
      var gap = C.volumeGap(last, avg);
      var rs = form.querySelector('input[name=volumeReason]:checked');
      return { last: last, avg: avg, gap: gap, reason: gap === 'drop' ? (rs ? rs.value : null) : null };
    }
    function volumeProfile(v) {
      var vp = { lastWeekKm: v.last, monthAvgKm: v.avg, volumeReason: v.reason };
      vp.currentWeeklyKm = C.volumeInfo(vp).start;
      return vp;
    }
    function readLevelInputs() {
      if (isWalkForm()) {
        var wk = readWalk(), ag = Number(form.age.value);
        return wk.ok ? { activity: 'walk', walkExp: wk.exp, walkMin: wk.min, walk30: wk.w30, age: ag > 0 ? ag : 30 } : null;
      }
      if (isNever()) return { currentWeeklyKm: 0, experience: 'never', structured: false, pb: null };
      var v = readVolume();
      var exp = form.querySelector('input[name=experience]:checked');
      var st = form.querySelector('input[name=structured]:checked');
      if (!v || (v.gap === 'drop' && !v.reason) || !exp || !st) return null;
      var pbv = readPb();
      var out = volumeProfile(v);
      out.experience = exp.value; out.structured = st.value === 'yes'; out.pb = pbv || null; out.pbInvalid = pbv === false;
      return out;
    }
    function syncLevel() {
      var walk = isWalkForm(), never = !walk && isNever();
      document.getElementById('run-fields3').hidden = walk;
      document.getElementById('walk-fields3').hidden = !walk;
      document.getElementById('run-goal5').hidden = walk;
      document.getElementById('walk-goal5').hidden = !walk;
      var wk = readWalk();
      document.getElementById('walkmin-field').hidden = wk.never;
      document.getElementById('walk30-block').hidden = wk.never;
      if (!editing) document.getElementById('onb-kicker').textContent = T(walk ? 'onb.titleNewWalk' : 'onb.titleNew');
      // عنوان مرحله‌های ۳ و ۴ با نوع ورزش
      [3, 4].forEach(function (n) {
        document.getElementById('onb-step-title-' + n).textContent = T('onb.steps.' + n + (walk ? '.tw' : '.t'));
        document.getElementById('onb-step-title-' + n).nextElementSibling.textContent = T('onb.steps.' + n + (walk ? '.subw' : '.sub'));
      });
      document.getElementById('runner-fields').hidden = never;
      document.getElementById('zero-note').hidden = !never;
      document.getElementById('pb-never').hidden = !never;
      document.getElementById('pb-walk').hidden = !walk;
      document.getElementById('pb-fields').hidden = never || walk;
      var vol = never ? null : readVolume();
      document.getElementById('reason-block').hidden = !(vol && vol.gap === 'drop');
      var sel = form.pbSel.value;
      document.getElementById('pbother-field').hidden = sel !== 'other';
      document.getElementById('pbtime-field').hidden = !sel;
      // تا وقتی کاربر چرخ‌ها رو دست نزده، نقطه‌ی شروع چرخ‌ها = زمان معمول برای این مسافت
      if (sel) {
        var gkm = sel === 'other' ? kmIn(form.pbOther) : PB_DISTANCES.filter(function (d) { return d[0] === sel; })[0][1];
        if (gkm > 0) window.CoachTimePicker.preset('pbtime', pbGuess(gkm));
      }
      var box = document.getElementById('level-preview');
      var inp = readLevelInputs();
      if (!inp) {
        box.innerHTML = '<p class="small muted level-wait">' + esc(T('onb.levelWait')) + '</p>';
        return;
      }
      if (walk) {
        var wl = C.assessLevel(inp);
        box.innerHTML = levelCard(wl) + '<p class="small start-preview">' + tt('onb.walkStartPreview', { n: C.walkWeeklyMin(inp, 0, wl).start }) + '</p>';
        return;
      }
      box.innerHTML = levelCard(C.assessLevel(inp)) +
        (!never ? '<p class="small start-preview">' + tt('onb.startPreview', { n: Math.max(5, inp.currentWeeklyKm) }) + '</p>' : '') +
        (inp.pbInvalid ? '<p class="small form-hint">' + esc(T('onb.pbInvalid')) + '</p>' : '');
    }
    function syncRace() {
      var gt = form.goalType.value;
      document.getElementById('goal-fields').hidden = gt === 'none';
      document.getElementById('ultra-fields').hidden = gt !== 'ultra';
      var out = document.getElementById('ultra-ratio');
      var km = kmIn(form.ultraKm), gain = form.ultraGain.value === '' ? null : Number(form.ultraGain.value);
      if (gt === 'ultra' && km > 0 && gain !== null && gain >= 0) {
        var info = C.ULTRA_CLASS_INFO[C.ultraClass(gain / km)];
        out.innerHTML = tt('onb.ultraRatio', { r: Math.round(gain / km) }) + '<b>' + esc(info.short) + '</b>';
      } else out.textContent = '';
    }
    form.addEventListener('input', syncRace);
    function syncDate() {
      var sv = document.getElementById('sdate').value;
      document.getElementById('sdate-fa').textContent = sv && I.getCalendar() === 'jalali' ? T('onb.raceDateEq', { d: faDate(sv) }) : '';
      var v = document.getElementById('rdate').value;
      // تاریخ ورودی مرورگر میلادیه؛ در تقویم شمسی معادلش نشون داده می‌شه
      document.getElementById('rdate-fa').textContent = v && I.getCalendar() === 'jalali' ? T('onb.raceDateEq', { d: faDate(v) }) : '';
    }
    function syncCycle() {
      var sx = form.querySelector('input[name=sex]:checked');
      var fem = !!sx && sx.value === 'female';
      document.getElementById('cycle-fieldset').hidden = !fem;
      document.getElementById('cycle-fields').hidden = !(fem && form.cycleOn.checked);
      var v = form.cycleStart.value;
      document.getElementById('cystart-fa').textContent = v && I.getCalendar() === 'jalali' ? T('onb.raceDateEq', { d: faDate(v) }) : '';
    }
    form.addEventListener('input', syncLevel);
    form.addEventListener('change', function () { syncRace(); syncLevel(); syncDate(); syncCycle(); });
    syncRace(); syncLevel(); syncDate(); syncCycle();

    // ---------- مرحله‌ها: نشانگر پیشرفت، رفت‌وبرگشت و انیمیشن ----------
    var cur = 1, maxSeen = editing ? ONB_STEPS : 1, busy = false;
    function stepEl(n) { return form.querySelector('.onb-step[data-step="' + n + '"]'); }
    function paintNav() {
      app.querySelectorAll('.onb-dot').forEach(function (d) {
        var n = Number(d.dataset.gotoStep);
        d.classList.toggle('is-done', n < cur);
        d.classList.toggle('is-current', n === cur);
        d.parentNode.classList.toggle('is-done', n < cur);
        d.disabled = n > maxSeen;
        if (n === cur) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
      document.getElementById('onb-back').classList.toggle('is-off', cur === 1);
      document.getElementById('onb-back').disabled = cur === 1;
      var last = cur === ONB_STEPS;
      document.getElementById('onb-next-lbl').textContent = T(last ? (editing ? 'onb.submitEdit' : 'onb.submitNew') : 'onb.next');
      document.getElementById('onb-next').classList.toggle('is-final', last);
    }
    function hideErrors() { var b = document.getElementById('onb-errors'); b.hidden = true; b.innerHTML = ''; }
    function showErrors(list) {
      var box = document.getElementById('onb-errors');
      box.hidden = false;
      box.innerHTML = '<ul>' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
      box.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
    }
    function reducedMotion() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function onShown(n) { if (n === 4) window.CoachTimePicker.refresh(stepEl(4)); }
    function goStep(n, instant) {
      if (busy || n === cur || n < 1 || n > ONB_STEPS) return;
      var from = stepEl(cur), to = stepEl(n), fwd = n > cur;
      hideErrors();
      cur = n; maxSeen = Math.max(maxSeen, n);
      paintNav();
      var show = function () {
        from.hidden = true; from.className = 'onb-step';
        to.hidden = false; to.className = 'onb-step';
        onShown(n);
        if (!instant && !reducedMotion()) { void to.offsetWidth; to.classList.add(fwd ? 'onb-in-fwd' : 'onb-in-back'); }
        // بالای کارت دیده بشه و فوکوس روی عنوان مرحله‌ی تازه (برای صفحه‌خوان)
        var card = app.querySelector('.onb-wizard'), top = card.getBoundingClientRect().top + window.scrollY - 12;
        if (window.scrollY > top) window.scrollTo({ top: top, behavior: instant || reducedMotion() ? 'auto' : 'smooth' });
        if (!instant) document.getElementById('onb-step-title-' + n).focus({ preventScroll: true });
        busy = false;
      };
      if (instant || reducedMotion()) { show(); return; }
      busy = true;
      from.classList.add(fwd ? 'onb-out-fwd' : 'onb-out-back');
      setTimeout(show, 160);
    }
    onbApi = { go: goStep, cur: function () { return cur; }, max: function () { return maxSeen; },
      setMax: function (v) { maxSeen = Math.max(maxSeen, v); paintNav(); } };
    app.querySelectorAll('.onb-dot').forEach(function (d) {
      d.addEventListener('click', function () { goStep(Number(d.dataset.gotoStep)); });
    });
    document.getElementById('onb-back').addEventListener('click', function () { goStep(cur - 1); });
    // «ویرایش داده‌های چرخه» از تنظیمات: مستقیم به مرحله‌ی مشخصات بدنی
    if (pendingFocus === 'cycle-fieldset') goStep(2, true);
    // «تغییر هدف اصلی» از صفحه‌ی مسابقه‌ها: مستقیم به مرحله‌ی هدف
    if (pendingFocus === 'gtype') goStep(Number(document.getElementById('gtype').closest('.onb-step').dataset.step), true);
    paintNav();

    // همه‌ی ورودی‌ها رو بخون؛ هر خطا با شماره‌ی مرحله‌اش
    function collect() {
      var fd = new FormData(form);
      var errs = [];
      var E = function (st, msg) { errs.push({ step: st, msg: msg }); };
      var age = Number(fd.get('age')), w = Number(fd.get('weightKg')), h = Number(fd.get('heightCm'));
      var selDays = fd.getAll('days').map(Number);
      var selLocs = fd.getAll('locations');
      var never = fd.get('experience') === 'never';
      var volP = { lastWeekKm: 0, monthAvgKm: 0, volumeReason: null, currentWeeklyKm: 0 };
      // ۲. مشخصات بدنی
      if (!(age >= 12 && age <= 90)) E(2, T('onb.err.age'));
      if (!(h >= 120 && h <= 230)) E(2, T('onb.err.height'));
      if (!(w >= 30 && w <= 250)) E(2, T('onb.err.weight'));
      // چرخه‌ی قاعدگی: فقط اگه «زن» انتخاب شده و کاربر خودش فعالش کرده
      var sex = fd.get('sex') || null, cycleObj = Object.assign({}, p.cycle || {}, { enabled: false });
      if (sex === 'female' && fd.get('cycleOn')) {
        var cs = String(fd.get('cycleStart') || ''), cl = Number(fd.get('cycleLen')), cp = Number(fd.get('periodLen'));
        var ago = cs ? C.daysBetween(C.parseDate(cs), today()) : -1;
        if (!cs || ago < 0 || ago > 120) E(2, T('cycle.err.lastStart'));
        if (!(cl >= 21 && cl <= 45)) E(2, T('cycle.err.cycleLen'));
        if (!(cp >= 2 && cp <= 10)) E(2, T('cycle.err.periodLen'));
        var pm = fd.get('periodMode');
        if (C.PERIOD_MODES.indexOf(pm) < 0) E(2, T('cycle.err.periodMode'));
        // تغییرهای دستی دوره‌ها با ویرایش پروفایل حفظ می‌شن
        cycleObj = { enabled: true, lastStart: cs, cycleLen: cl, periodLen: cp, periodMode: pm, periodOverrides: (p.cycle && p.cycle.periodOverrides) || {} };
      }
      var walkAct = fd.get('activity') === 'walk', walkIn = walkAct ? readWalk() : null;
      if (walkAct) {
        // پیاده‌روی: سابقه، دقیقه‌ی هفتگی و توان ۳۰ دقیقه
        if (!walkIn.exp) E(3, T('onb.err.walkExp'));
        else if (!walkIn.never && !(walkIn.min !== null && walkIn.min >= 0 && walkIn.min <= 2000)) E(3, T('onb.err.walkMin'));
        else if (!walkIn.never && !walkIn.w30) E(3, T('onb.err.walk30'));
        never = true;
      } else
      // ۳. وضعیت فعلی دویدن
      if (!fd.get('experience')) E(3, T('onb.err.exp'));
      if (!never) {
        if (!inLim('vol', rawIn(form.lastWeekKm))) E(3, fa(T('onb.err.lastWeek', limParams('vol'))));
        if (!inLim('vol', rawIn(form.monthAvgKm))) E(3, fa(T('onb.err.monthAvg', limParams('vol'))));
        var vol = readVolume();
        if (vol && vol.gap === 'drop' && !vol.reason) E(3, T('onb.err.reason'));
        if (vol) volP = volumeProfile(vol);
        if (!fd.get('structured')) E(3, T('onb.err.struct'));
      }
      var curKm = volP.currentWeeklyKm;
      // ۴. رکورد
      var pbObj = never ? null : readPb();
      if (pbObj === false) E(4, T('onb.err.pb'));
      // ۵. تاریخ شروع، هدف، روزها، محل، ضربان
      var sd = String(fd.get('startDate') || '').trim(), maxStart = C.dateKey(C.addDays(today(), START_MAX_DAYS));
      if (!sd) E(5, T('onb.err.startDate'));
      else if (sd < todayKey && !(editing && sd === p.startDate)) E(5, T('onb.err.startPast'));
      else if (sd > maxStart) E(5, fa(T('onb.err.startFar', { n: START_MAX_DAYS })));
      var gType = walkAct ? 'none' : (fd.get('goalType') || 'none'), goalObj = { type: gType, date: null };
      if (gType !== 'none') {
        var rd = fd.get('raceDate');
        if (rd && C.daysBetween(today(), C.parseDate(rd)) < 1) E(5, T('onb.err.raceDate'));
        else if (rd && sd && rd <= sd) E(5, T('onb.err.raceBeforeStart'));
        goalObj.date = rd || null;
        if (gType === 'ultra') {
          var num = function (n) { var v = String(fd.get(n) || '').trim(); return v === '' ? null : Number(v); };
          var uk = kmIn(form.ultraKm), ug = num('ultraGain'), ul = num('ultraLoss'), ua = num('ultraAlt');
          if (!inLim('ultra', rawIn(form.ultraKm))) E(5, fa(T('onb.err.ultraKm', limParams('ultra'))));
          if (ug === null || !(ug >= 0 && ug <= 20000)) E(5, T('onb.err.ultraGain'));
          if (ul !== null && !(ul >= 0 && ul <= 20000)) E(5, T('onb.err.ultraLoss'));
          if (ua !== null && !(ua >= 0 && ua <= 6000)) E(5, T('onb.err.ultraAlt'));
          goalObj.ultra = { km: uk, gain: ug, loss: ul, terrain: fd.get('ultraTerrain') || null, altitude: ua };
        }
      }
      if (!selDays.length) E(5, T('onb.err.days'));
      if (!selLocs.length) E(5, T('onb.err.locs'));
      var hrIn = readHr(form);
      if (hrIn.error) E(5, hrIn.error);
      var next = {
        name: String(fd.get('firstName') || '').trim().slice(0, 40), lastName: String(fd.get('lastName') || '').trim().slice(0, 40),
        age: age, weightKg: w, heightCm: h,
        days: selDays.sort(), locations: selLocs,
        injury: String(fd.get('injury') || '').trim(),
        currentWeeklyKm: curKm, lastWeekKm: volP.lastWeekKm, monthAvgKm: volP.monthAvgKm, volumeReason: volP.volumeReason,
        experience: walkAct ? (p.experience || null) : fd.get('experience'), structured: !never && fd.get('structured') === 'yes',
        activity: walkAct ? 'walk' : 'run',
        walkGoal: walkAct ? (function () {
          var k = fd.get('walkGoal');
          if (!k || k === 'none') return null;
          // جزئیات قبلی همون هدف (قدم، رویداد) حفظ می‌شن؛ از صفحه‌ی اهداف قابل تغییرن
          return p.walkGoal && p.walkGoal.kind === k ? p.walkGoal : (k === 'steps' ? { kind: k, steps: 8000 } : k === 'event' ? { kind: k, km: 10 } : { kind: k });
        }()) : (p.walkGoal || null),
        walkExp: walkAct ? walkIn.exp : (p.walkExp || null), walkMin: walkAct ? walkIn.min : (p.walkMin != null ? p.walkMin : null), walk30: walkAct ? walkIn.w30 : (p.walk30 || null),
        schemaVersion: SCHEMA_VERSION,
        goal: p.goal && p.goal.type === goalObj.type && p.goal.targetSec ? Object.assign(goalObj, { targetSec: p.goal.targetSec }) : goalObj, pb: pbObj,
        hrMax: hrIn.max, hrRest: hrIn.rest,
        sex: sex, cycle: cycleObj,
        // تاریخچه‌ی فیتنس و تنظیم دستی پیس ایزی با ویرایش پروفایل حفظ می‌شن
        fitnessTests: p.fitnessTests || [], easyAdjustSec: p.easyAdjustSec || 0, races: p.races || [],
        createdAt: p.createdAt || new Date().toISOString()
      };
      return { errs: errs, next: next, pbObj: pbObj, curKm: curKm, startDate: sd };
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var r = collect();
      // مرحله‌های میانی: فقط خطاهای همین مرحله جلوی رفتن به بعدی رو می‌گیرن
      if (cur < ONB_STEPS) {
        var mine = r.errs.filter(function (x) { return x.step === cur; });
        if (mine.length) { showErrors(mine.map(function (x) { return x.msg; })); return; }
        goStep(cur + 1);
        return;
      }
      if (r.errs.length) {
        // اولین مرحله‌ای که خطا داره
        var first = r.errs[0].step;
        r.errs.forEach(function (x) { if (x.step < first) first = x.step; });
        var list = r.errs.filter(function (x) { return x.step === first; }).map(function (x) { return x.msg; });
        if (first !== cur) { goStep(first, true); }
        showErrors(list);
        return;
      }
      var next = r.next, pbObj = r.pbObj, curKm = r.curKm;
      // تاریخ رکورد پایه: اگه تغییر نکرده، تاریخ قبلی؛ اگه جدیده، امروز
      if (pbObj) {
        var same = p.pb && p.pb.distanceKm === pbObj.distanceKm && p.pb.timeSec === pbObj.timeSec;
        pbObj.date = same && p.pb.date ? p.pb.date : C.dateKey(today());
      }
      // تغییر سطح یا حجم فعلی = نقطه‌ی شروع جدید؛ بقیه‌ی تغییرات پیشرفت برنامه رو حفظ می‌کنن
      var keep = editing && !migrating && p.startDate && (p.activity || 'run') === next.activity && p.walkMin === next.walkMin && p.currentWeeklyKm === curKm && p.monthAvgKm === next.monthAvgKm && p.lastWeekKm === next.lastWeekKm &&
        C.assessLevel(p).level === C.assessLevel(next).level;
      // تاریخ شروعی که کاربر انتخاب کرده؛ اگه دست نزده: همون قبلی (یا امروز، وقتی سطح/حجم عوض شده و تاریخ قبلی گذشته)
      var chosen = r.startDate, todayK = C.dateKey(today());
      next.startDate = !editing || chosen !== p.startDate ? chosen : (keep || p.startDate > todayK ? p.startDate : todayK);
      state.profile = next;
      if (!editing) state.checklist = { since: todayK };
      save();
      showToast(T(editing ? 'onb.toastEdit' : 'onb.toastNew'));
      viewWeekOffset = 0;
      if (location.hash === '#home') route(); else location.hash = '#home';
    });
  }

  // =====================================================================
  // ۲. داشبورد و برنامه‌ی هفتگی
  // =====================================================================
  // ناحیه‌ی تمرینی هر نوع جلسه (رنگ‌ها: --zone-1 تا --zone-5 در css/theme.css)
  var ZONE_OF = { rest: 1, none: 1, easy: 2, runwalk: 2, walkrun: 2, long: 2, walkEasy: 2, walkLong: 2, tempo: 3, walkBrisk: 3,
    fartlek: 4, hills: 4, walkPower: 4, interval: 5, reps: 5 };
  function sessionBody(s, opts) {
    opts = opts || {};
    var html = '<div class="sess-target">' + t(s.target) + '</div>';
    if (s.original) {
      html += '<div class="sess-orig">' + esc(T('sess.original')) + ' <s>' + t(s.original.label + ' — ' + s.original.target) + '</s></div>';
    }
    // گرم کردن اختصاصی همین جلسه، تمرین اصلی، سرد کردن؛ هر کدوم بخش جدا
    var phases = s.warmup && s.warmup.lines && s.warmup.lines.length;
    if (phases) {
      html += '<div class="sess-phase sess-warmup"><h4>' + esc(T('sess.warmup')) +
        (s.warmup.min ? ' <small>' + tt('sess.about', { n: s.warmup.min }) + '</small>' : '') + '</h4><ul>' +
        s.warmup.lines.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul></div>';
    }
    if (s.steps && s.steps.length) {
      html += (phases ? '<div class="sess-phase sess-mainset z-' + (ZONE_OF[s.type] || 2) + '"><h4>' + esc(T('sess.main')) + '</h4>' : '') +
        '<ol class="sess-steps">' + s.steps.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ol>' + (phases ? '</div>' : '');
    }
    if (s.cooldown && s.cooldown.lines && s.cooldown.lines.length) {
      html += '<div class="sess-phase sess-cooldown"><h4>' + esc(T('sess.cooldown')) + '</h4><ul>' +
        s.cooldown.lines.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul></div>';
    }
    if (s.makeup) html += '<div class="makeup-box"><strong>' + esc(T('adapt.makeupBox.title')) + '</strong><p>' + t(s.makeup.text) + '</p></div>';
    if (s.how && s.type !== 'cancelled') html += '<p class="sess-how">' + t(s.how) + '</p>';
    if (s.talk && s.type !== 'cancelled') html += '<p class="talk-test">' + t(s.talk) + '</p>';
    if (s.cheer) html += '<p class="cheer">' + t(s.cheer) + '</p>';
    if (s.type !== 'cancelled') html += learnMore(SESSION_LEARN[s.type]);
    if (opts.hint && s.easyEffort && s.type !== 'walkrun') html += '<p class="day-hint">' + t(opts.hint.message) + '</p>';
    if (opts.key) html += postRunBlock(opts.key, s, opts.prefix || 'p');
    return html;
  }

  // ---------- بعد از جلسه: مسافت و زمان واقعی (اختیاری) + برای ایزی ران، RPE و پیس ----------
  var postRunOpen = null;
  // زمان شروع چرخ‌ها: مدت برنامه یا مسافت × وسط بازه‌ی ایزی
  function guessSec(s) {
    if (s.minutes) return s.minutes * 60;
    var z = C.paceZones(state.profile), pace = z && z.easy ? (z.easy[0] + z.easy[1]) / 2 : 360;
    return Math.round((s.km || 5) * pace / 60) * 60;
  }
  // خط «ثبت‌شده» برای جلسه‌ی انجام‌شده (فقط وقتی کاربر عدد واقعی وارد کرده)
  function actualLine(key) {
    var log = (state.doneLog || {})[key], a = log && log.actual;
    if (!a) return '';
    var parts = [];
    if (a.start) parts.push(tt('post.actStartVal', { t: a.start }));
    if (a.km > 0) parts.push(tt('post.actKmVal', { km: Math.round(a.km * 100) / 100 }) + (log.km && Math.abs(log.km - a.km) >= 0.05 ? ' <span class="muted">' + tt('post.actPlan', { km: log.km }) + '</span>' : ''));
    if (a.sec > 0) parts.push('<span dir="ltr">' + fa(C.formatDuration(a.sec)) + '</span>');
    var pace = C.actualPace(log);
    if (pace) parts.push(tt('post.actPace', { p: paceFmt(pace) }));
    return '<p class="actual-line"><b>' + esc(T('post.actRecorded')) + '</b> ' + parts.join(T('progress.sep')) + '</p>';
  }
  function postRunBlock(key, s, prefix) {
    var post = state.postRuns[key], done = !!state.done[key], out = '';
    if (done && postRunOpen !== key) {
      out += actualLine(key) + '<button type="button" class="linklike small" data-postrun="' + key + '">' + esc(T((state.doneLog || {})[key] && state.doneLog[key].actual ? 'post.actEdit' : 'post.actAdd')) + '</button>';
      if (s.easyEffort && post) {
        var fb = C.easyRunFeedback(post, s.type);
        if (fb) {
          var cls = fb.kind === 'ok' ? 'alert-good' : (fb.kind === 'warn' ? 'alert-adapt' : 'alert-note');
          out += '<div class="alert ' + cls + ' postrun-fb" role="status"><p class="small muted">' + tt('post.summary', { rpe: post.rpe }) +
            (post.pace === 'ok' ? esc(T('post.paceOk')) : post.pace === 'fast' ? esc(T('post.paceFast')) : '') + '</p><p>' + t(fb.message) + '</p>' +
            (fb.kind === 'warn' ? easyActions() : '') + '</div>';
        }
      }
      return out;
    }
    if (postRunOpen !== key) return '';
    var a = ((state.doneLog || {})[key] || {}).actual || {};
    var n = 'rpe-' + prefix, timeBased = !s.km && s.minutes;
    var walk = C.WALK_TYPES.indexOf(s.type) >= 0;
    var h = '<form class="postrun" data-postrun-form="' + key + '" data-type="' + s.type + '" data-easy="' + (s.easyEffort ? 1 : 0) + '" data-walk="' + (walk ? 1 : 0) + '" novalidate>' +
      '<fieldset class="actual-fs"><legend>' + esc(T('post.actTitle')) + '</legend><p class="small muted">' + esc(T('post.actHint')) + '</p>' +
      '<div class="field"><label for="act-km-' + prefix + '">' + esc(T(walk ? 'post.walkKm' : 'post.actKm')) + '</label>' +
      '<input id="act-km-' + prefix + '" name="actKm" type="number" inputmode="decimal" min="0" step="0.01" placeholder="' + esc(s.km ? fa(dKm(s.km)) : '') + '"' +
      ' value="' + (a.km > 0 ? esc(dKm(Math.round(a.km * 100) / 100)) : '') + '"></div>' +
      '<div class="field field-tpick"><span class="field-label">' + esc(T('post.actTime')) + '</span>' +
      tpo({ id: 'act-time-' + prefix, name: 'actTime', sec: a.sec || guessSec(s), touched: a.sec > 0, preview: 'act-time-read-' + prefix,
        aria: T('post.actTime'), }) +
      '<small class="muted">' + esc(T('post.actTimeHint')) + '</small><small class="time-read" id="act-time-read-' + prefix + '" aria-live="polite">' +
      (a.sec > 0 ? '= ' + fa(C.describeDuration(a.sec)) : '') + '</small></div>' +
      '<div class="field"><label for="act-start-' + prefix + '">' + esc(T('post.actStart')) + '</label>' +
      tpo({ id: 'act-start-' + prefix, name: 'actStart', mode: 'clock', value: a.start || '', aria: T('post.actStart') }) + '</div>' +
      (walk ? '<div class="field"><label for="act-steps-' + prefix + '">' + esc(T('post.walkSteps')) + '</label>' +
        '<input id="act-steps-' + prefix + '" name="actSteps" type="number" inputmode="numeric" min="0" max="100000" step="1" value="' + (a.steps > 0 ? a.steps : '') + '"></div>' : '') +
      '</fieldset>';
    if (walk) {
      h += '<p class="sub-legend">' + esc(T('post.walkRpeQ')) + '</p><div class="scale scale10" role="radiogroup" aria-label="' + esc(T('post.rpeAria')) + '">';
      for (var wi = 1; wi <= 10; wi++) h += '<label class="scale-opt"><input type="radio" name="rpe" id="' + n + '-' + wi + '" value="' + wi + '"' + (post && post.rpe === wi ? ' checked' : '') + '><span>' + fa(wi) + '</span></label>';
      h += '</div><div class="scale-ends"><span>' + esc(T('post.low')) + '</span><span>' + esc(T('post.high')) + '</span></div>';
    }
    if (s.easyEffort) {
      h += '<p class="sub-legend">' + esc(T('post.q1')) + '</p><div class="scale scale10" role="radiogroup" aria-label="' + esc(T('post.rpeAria')) + '">';
      for (var i = 1; i <= 10; i++) h += '<label class="scale-opt"><input type="radio" name="rpe" id="' + n + '-' + i + '" value="' + i + '"' + (post && post.rpe === i ? ' checked' : '') + '><span>' + fa(i) + '</span></label>';
      h += '</div><div class="scale-ends"><span>' + esc(T('post.low')) + '</span><span>' + esc(T('post.high')) + '</span></div>' + learnMore(['rpe']);
      if (s.type !== 'runwalk' && s.type !== 'walkrun') {
        h += '<p class="sub-legend">' + esc(T('post.q2')) + '</p><div class="chips">' + ['ok', 'fast', 'unknown'].map(function (v) {
          return '<label class="chip"><input type="radio" name="pace" value="' + v + '"' + (post && post.pace === v ? ' checked' : '') + '><span>' + esc(T('post.' + v)) + '</span></label>';
        }).join('') + '</div>';
      }
    }
    return h + '<p class="form-errors" hidden></p><div class="actions"><button type="submit" class="btn btn-primary">' + esc(T(done ? 'post.submit' : 'post.saveDone')) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-postrun-cancel="1">' + esc(T('app.cancel')) + '</button></div></form>';
  }
  function easyActions() {
    var p = state.profile, adj = Number(p.easyAdjustSec) || 0;
    return '<div class="actions">' +
      (adj < C.EASY_ADJUST_MAX ? '<button type="button" class="btn btn-outline" data-slow-easy="1">' + tt('post.slower10') + '</button>' : '') +
      '<a class="btn btn-ghost" href="#fitness">' + esc(T('post.newTest')) + '</a></div>';
  }

  function badge(type, label) {
    return '<span class="badge badge-' + type + '">' + t(label) + '</span>';
  }

  function adaptationBox(ad, key, compact) {
    if (!ad) return '';
    if (ad.kind === 'pain') {
      var ci = state.checkins[key];
      return '<div class="alert alert-pain" role="alert"><strong>' + esc(T('pain.cancelled')) + '</strong>' +
        '<p class="pain-msg">' + esc(C.PAIN_MESSAGE) + '</p>' +
        (ci && ci.painWhere ? '<p class="small">' + esc(T('pain.whereReported', { w: ci.painWhere })) + '</p>' : '') +
        '<p class="small">' + esc(T('pain.noRun')) + '</p></div>';
    }
    var cls = ad.kind === 'downgrade' ? 'alert-adapt' : 'alert-note';
    if (!ad.tier || !ad.action) return '<div class="alert ' + cls + '" role="status"><p>' + t(ad.message) + '</p></div>';
    // تطبیق درجه‌بندی‌شده: چرا → تصمیم → اثر روی هفته و هدف → خلاصه‌ی هفته
    var sum = C.weekAdaptSummary(state.profile, state.checkins, state.done, C.parseDate(key));
    if (compact) {
      // کارت خانه: تصمیم جلوی چشم، دلیل و اثرش روی هفته با یک لمس
      return '<div class="alert ' + cls + ' adapt-box adapt-' + ad.tier + '" role="status">' +
        '<p class="adapt-head"><span class="adapt-tier">' + esc(T('adapt.tier.' + ad.tier)) + '</span> <strong>' + esc(T(ad.kind === 'downgrade' ? 'adapt.changed' : 'adapt.kept')) + '</strong></p>' +
        '<p>' + t(ad.action) + '</p>' +
        '<details class="adapt-more"><summary>' + esc(T('home.whyMore')) + '</summary>' +
        '<p><b>' + esc(T('adapt.whyL')) + '</b> ' + t(ad.why) + '</p>' +
        (ad.impact ? '<p><b>' + esc(T('adapt.impactL')) + '</b> ' + t(ad.impact) + '</p>' : '') +
        (ad.kind === 'downgrade' ? '<p class="adapt-sum">' + t(sum.text) + '</p>' : '') + '</details></div>';
    }
    return '<div class="alert ' + cls + ' adapt-box adapt-' + ad.tier + '" role="status">' +
      '<p class="adapt-head"><span class="adapt-tier">' + esc(T('adapt.tier.' + ad.tier)) + '</span> <strong>' + esc(T(ad.kind === 'downgrade' ? 'adapt.changed' : 'adapt.kept')) + '</strong></p>' +
      '<p><b>' + esc(T('adapt.whyL')) + '</b> ' + t(ad.why) + '</p>' +
      '<p><b>' + esc(T('adapt.actL')) + '</b> ' + t(ad.action) + '</p>' +
      (ad.impact ? '<p><b>' + esc(T('adapt.impactL')) + '</b> ' + t(ad.impact) + '</p>' : '') +
      (ad.kind === 'downgrade' ? '<p class="adapt-sum">' + t(sum.text) + '</p>' : '') + '</div>';
  }

  function painYesterdayBox() {
    return '<div class="alert alert-pain-soft" role="note"><strong>' + esc(T('pain.yesterdayStrong')) + '</strong> ' +
      esc(T('pain.yesterdayText')) + '</div>';
  }

  // «انجام شد» + خلاصه‌ی همون جلسه (بعد از تطبیق) تا نمودارهای پیشرفت با تغییر بعدی برنامه عوض نشن
  function markDone(k) {
    state.done[k] = true;
    state.doneLog = state.doneLog || {};
    state.doneLog[k] = C.sessionSnapshot(loggable(effectiveSession(C.sessionFor(state.profile, C.parseDate(k))).session));
  }
  // جلسه‌ای که با چک‌این یا پریود به استراحت/لغو تبدیل شده هنوز قابل ثبته (مثلاً کاربر قبل از چک‌این دویده)؛ جلسه‌ی برنامه ثبت می‌شه
  function loggable(ss) {
    if (ss.type !== 'rest' && ss.type !== 'cancelled') return ss;
    var b = C.sessionFor(state.profile, C.parseDate(ss.date));
    return ['rest', 'none', 'cancelled'].indexOf(b.type) < 0 ? b : ss;
  }
  function doneButton(key, s) {
    var done = !!state.done[key];
    return '<button type="button" class="btn ' + (done ? 'btn-done' : 'btn-outline') + '" data-done="' + key + '" aria-pressed="' + done + '">' +
      esc(T(done ? 'today.doneDone' : 'today.done')) + '</button>';
  }

  function renderPlan() {
    var p = state.profile;
    var now = today();
    var viewDate = C.addDays(now, viewWeekOffset * 7);
    var week = C.buildWeek(p, viewDate);
    var todayKey = C.dateKey(now);
    var lv = C.assessLevel(p);
    var isRunWalk = lv.level <= 1 || !!lv.walk;
    // فلش‌ها: آیکون SVG (کاراکترهای ‹ › در متن راست‌به‌چپ توسط بعضی مرورگرها مثل Safari آینه می‌شن).
    // «قبلی» همیشه به سمت شروع خط اشاره می‌کنه: راست در فارسی، چپ در انگلیسی.
    var prevGlyph = chevron(isRtl() ? 'right' : 'left'), nextGlyph = chevron(isRtl() ? 'left' : 'right');

    // سربرگ صفحه: عنوان + هفتگی/ماهانه (تمرین امروز، چرخه و نکته‌های فیتنس در صفحه‌ی امروز هستن)
    var html = '<header class="page-head"><h1>' + esc(T('tabs.plan')) + '</h1>' +
      '<div class="view-tabs" role="tablist" aria-label="' + esc(T('plan.viewAria')) + '">' +
      ['week', 'month'].map(function (m) {
        return '<button type="button" role="tab" data-view-mode="' + m + '" aria-selected="' + (settings.planView === m) + '">' + esc(T('plan.' + m)) + '</button>';
      }).join('') + '</div></header>';
    if (lv.level === 0) html += zeroCard(p, now);
    if (settings.planView === 'month') {
      html += monthCard(p, now, todayKey, isRunWalk, prevGlyph, nextGlyph);
      app.innerHTML = html;
      return;
    }

    // سربرگ هفته
    var wkNum = week.weekIndex + 1;
    html += '<section class="card week-card"><div class="week-head">' +
      '<button type="button" class="btn btn-icon" data-week="-1" aria-label="' + esc(T('week.prev')) + '"' + (week.start <= p.startDate ? ' disabled' : '') + '>' + prevGlyph + '</button>' +
      '<div class="week-title"><h2>' + (week.weekIndex >= 0 ? tt('week.n', { n: wkNum }) : esc(T(week.phase.key === 'intro' ? 'week.intro' : 'week.before'))) + '</h2>' +
      '<p class="muted">' + esc(T('week.range', { a: faDate(week.start, true), b: faDate(week.days[6].date, true) })) +
      (viewWeekOffset !== 0 ? ' · <button type="button" class="linklike" data-week="0">' + esc(T('week.back')) + '</button>' : '') + '</p></div>' +
      '<button type="button" class="btn btn-icon" data-week="1" aria-label="' + esc(T('week.next')) + '">' + nextGlyph + '</button></div>';

    // آمار هفته از جلسه‌های واقعی (بعد از تطبیق با چک‌این و روزهای پریود)؛ اگه با برنامه‌ی اصلی فرق داشت، اون هم نشون داده می‌شه
    var resolved = week.days.map(function (d) { return effectiveSession(d); });
    var ws = doneStats(resolved);
    var runDays = ws.n, effKm = ws.km, effMin = ws.min;
    var kmChanged = Math.abs(effKm - week.totalKm) > 0.05, minChanged = effMin !== week.totalMin;
    var zero = lv.level === 0;
    html += '<div class="week-stats' + (zero ? ' week-stats-zero' : '') + '">' +
      (zero ? '<div class="stat"><span>' + esc(T('zero.stageLabel')) + '</span><b>' + tt('zero.stage', { n: (week.zeroStage || 0) + 1, total: week.zeroFinal + 1 }) + '</b></div>'
        : '<div class="stat"><span>' + esc(T('week.phase')) + ' ' + helpLink('week', T('week.phaseHelp')) + '</span><b>' + t(week.phase.label) + '</b>' +
      (week.periodLabel ? '<small class="period-tag">' + esc(week.periodLabel) + '</small>' : '') + '</div>') +
      '<div class="stat"><span>' + esc(T('week.sessions')) + '</span><b>' + tt('week.nSessions', { n: runDays }) + '</b>' +
        (runDays ? '<small class="done-tag">' + tt('week.doneSessions', { n: ws.d, total: runDays }) + '</small>' : '') + '</div>' +
      (isRunWalk ? '<div class="stat"><span>' + esc(T('week.totalTime')) + '</span><b>' + tt('week.nMin', { n: effMin }) + '</b>' +
          (ws.d ? '<small class="done-tag">' + tt('week.doneMin', { n: ws.dmin }) + '</small>' : '') +
          (minChanged ? '<small class="period-tag">' + tt('week.plannedMin', { n: week.totalMin }) + '</small>' : '') + '</div>'
        : '<div class="stat"><span>' + esc(T('week.volume')) + '</span><b>' + tt('week.nKm', { n: effKm }) + '</b>' +
          (ws.d ? '<small class="done-tag">' + tt('week.doneKm', { n: ws.dkm }) + '</small>' : '') +
          (kmChanged ? '<small class="period-tag">' + tt('week.plannedKm', { n: week.totalKm }) + '</small>' : '') +
          (week.goal && week.goal.category === 'ultra' && week.vert ? '<small class="period-tag">' + tt('week.vert', { n: week.vert }) + '</small>' : '') + '</div>') +
      (zero || week.walk ? '' : '<div class="stat stat-ratio"><span>' + esc(T('week.ratio')) + ' ' + helpLink('week', T('week.ratioHelp')) + '</span><b dir="ltr">' + fa(100 - week.hardPct) + ' / ' + fa(week.hardPct) + '</b>' +
      '<div class="ratio-bar" aria-hidden="true"><i style="width:' + (100 - week.hardPct) + '%"></i></div></div>') +
      '</div>' + learnMore(zero || week.walk ? ['tenpct'] : ['eighty', 'tenpct']);

    var keys = week.days.map(function (d) { return d.date; });
    if (keys.indexOf(selectedDay) < 0) {
      selectedDay = keys.indexOf(todayKey) >= 0 ? todayKey :
        (week.days.filter(function (d) { return ['rest', 'none'].indexOf(d.type) < 0; })[0] || week.days[0]).date;
    }
    html += '<div class="week-grid" role="tablist" aria-label="' + esc(T('week.daysAria')) + '">';
    resolved.forEach(function (r) {
      var s = r.session, d = s.date;
      var sel = d === selectedDay;
      var cls = 'day day-' + s.type + (d === todayKey ? ' is-today' : '') + (d < todayKey ? ' is-past' : '') + (sel ? ' is-selected' : '') + cycleMarkClass(d);
      var shortT = s.km ? fa(String(dKm(s.km))) + '<small>' + esc(uShort()) + '</small>' : (s.minutes ? fa(s.minutes) + '<small>' + esc(T('week.minUnit')) + '</small>' : '—');
      html += '<button type="button" role="tab" id="tab-' + d + '" aria-controls="day-panel" aria-selected="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" class="' + cls + '" data-day="' + d + '">' +
        '<span class="day-name"><span class="full">' + esc(s.dayName) + '</span><span class="short">' + esc(s.dayShort || s.dayName.charAt(0)) + '</span></span>' +
        '<span class="day-date">' + esc(faDate(d, true)) + '</span>' +
        '<span class="type-dot" aria-hidden="true"></span>' + badge(s.type, s.label) +
        '<span class="day-target">' + shortT + '</span>' +
        (d === todayKey ? '<span class="today-tag">' + esc(T('week.today')) + '</span>' : '') +
        (state.done[d] ? '<span class="done-mark" aria-label="' + esc(T('week.doneMark')) + '">✓</span>' : '') +
        '</button>';
    });
    html += '</div>';
    html += cycleLegend(keys);
    html += dayPanel(resolved[keys.indexOf(selectedDay)], todayKey, 'tab-' + selectedDay);
    html += '</section>';
    app.innerHTML = html;
  }

  // جزئیات کامل یک روز (مشترک بین نمای هفتگی و ماهانه)
  function dayPanel(rs, todayKey, labelledBy) {
    var ss = rs.session, d = ss.date, ls = loggable(ss), canLog = d < todayKey || (d === todayKey && state.checkins[todayKey]);
    return '<div class="day-panel" id="day-panel" role="tabpanel"' + (labelledBy ? ' aria-labelledby="' + labelledBy + '"' : '') + '>' +
      '<div class="day-panel-head"><div><p class="eyebrow">' + esc(ss.dayName) + ' ' + esc(faDate(d)) +
      (d === todayKey ? esc(T('week.todaySuffix')) : '') + '</p><h3>' + badge(ss.type, ss.label) + '</h3></div>' +
      (d <= todayKey && ['rest', 'none', 'cancelled'].indexOf(ls.type) < 0 && (d < todayKey || state.checkins[todayKey]) ? doneButton(d, ls) : '') +
      '</div>' +
      (d === todayKey && !state.checkins[todayKey] && ['rest', 'none'].indexOf(ss.type) < 0 ?
        '<div class="checkin-cta"><p>' + esc(T('today.cta')) + '</p><a class="btn btn-primary" href="#checkin">' + esc(T('home.startCheckin')) + '</a></div>' : '') +
      (rs.adaptation ? adaptationBox(rs.adaptation, d) : '') + cycleBox(rs, d, todayKey) +
      (ss.type !== 'cancelled' ? sessionBody(ss, canLog && ls === ss ? { key: d, prefix: 'panel' } : {}) : '') +
      (canLog && ls !== ss ? postRunBlock(d, ls, 'panel') : '') +
      '</div>';
  }

  // ---------- نمای ماهانه: ماه تقویمی (شمسی با jalaali-js یا میلادی)، با همون جلسه‌های تطبیق‌یافته ----------
  function monthBounds(now) {
    if (I.getCalendar() === 'jalali') {
      var j = window.jalaali.toJalaali(now), m = j.jm - 1 + monthOffset;
      var jy = j.jy + Math.floor(m / 12), jm = ((m % 12) + 12) % 12 + 1;
      var g = window.jalaali.toGregorian(jy, jm, 1);
      return { first: new Date(g.gy, g.gm - 1, g.gd), len: window.jalaali.jalaaliMonthLength(jy, jm) };
    }
    var f = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return { first: f, len: new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate() };
  }
  function dayOfMonth(d) { return I.getCalendar() === 'jalali' ? window.jalaali.toJalaali(d).jd : d.getDate(); }

  function monthCard(p, now, todayKey, timeBased, prevGlyph, nextGlyph) {
    var mb = monthBounds(now), weeks = {};
    // هر هفته یک‌بار ساخته می‌شه؛ چک‌این هر روز (خستگی، خواب، درد) روی جلسه اعمال می‌شه
    function resolve(date) {
      var k = C.dateKey(C.weekStart(date));
      if (!weeks[k]) weeks[k] = C.buildWeek(p, date);
      var s = weeks[k].days[C.dayIndex(date)];
      return effectiveSession(s);
    }
    var days = [];
    for (var i = 0; i < mb.len; i++) days.push(resolve(C.addDays(mb.first, i)));
    var keys = days.map(function (r) { return r.session.date; });
    if (keys.indexOf(selectedDay) < 0) {
      var firstRun = days.filter(function (r) { return ['rest', 'none'].indexOf(r.session.type) < 0; })[0];
      selectedDay = keys.indexOf(todayKey) >= 0 ? todayKey : (firstRun || days[0]).session.date;
    }
    var ms = doneStats(days);

    var html = '<section class="card week-card month-card"><div class="week-head">' +
      '<button type="button" class="btn btn-icon" data-month="-1" aria-label="' + esc(T('month.prev')) + '">' + prevGlyph + '</button>' +
      '<div class="week-title"><h2>' + t(I.monthTitle(C.addDays(mb.first, 14))) + '</h2>' +
      '<p class="muted">' + tt(timeBased ? 'month.statsMin' : 'month.stats', { n: ms.n, km: ms.km, min: ms.min, d: ms.d, dkm: ms.dkm, dmin: ms.dmin }) +
      (monthOffset !== 0 ? ' · <button type="button" class="linklike" data-month="0">' + esc(T('month.back')) + '</button>' : '') + '</p></div>' +
      '<button type="button" class="btn btn-icon" data-month="1" aria-label="' + esc(T('month.next')) + '">' + nextGlyph + '</button></div>';

    html += '<div class="month-grid" role="grid" aria-label="' + esc(T('month.gridAria')) + '">' +
      C.WEEK_ORDER.map(function (i) { return '<span class="mhead" role="columnheader">' + esc(C.DAY_SHORT[i]) + '</span>'; }).join('');
    var lead = C.dayIndex(mb.first);
    for (var b = 0; b < lead; b++) html += '<span class="mday mday-empty" aria-hidden="true"></span>';
    days.forEach(function (r) {
      var s = r.session, d = s.date, date = C.parseDate(d);
      var rest = ['rest', 'none'].indexOf(s.type) >= 0;
      var amount = s.km ? fa(dKm(s.km)) : (s.minutes ? fa(s.minutes) + "'" : '');
      html += '<button type="button" class="mday day-' + s.type + (rest ? ' mday-rest' : '') + (d === todayKey ? ' is-today' : '') + (d < todayKey ? ' is-past' : '') +
        (d === selectedDay ? ' is-selected' : '') + cycleMarkClass(d) + '" data-mday="' + d + '" aria-pressed="' + (d === selectedDay) + '" aria-label="' + esc(faDate(d) + ' · ' + s.label) + '">' +
        '<span class="mday-num">' + fa(dayOfMonth(date)) + '</span>' +
        (rest ? '' : '<span class="mday-dot" aria-hidden="true"></span><span class="mday-amt">' + amount + '</span>') +
        (state.done[d] ? '<span class="mday-done" aria-hidden="true">✓</span>' : '') + '</button>';
    });
    var tail = (7 - (lead + days.length) % 7) % 7;
    for (var c = 0; c < tail; c++) html += '<span class="mday mday-empty" aria-hidden="true"></span>';
    html += '</div>';

    // راهنمای رنگ‌ها فقط برای نوع‌هایی که این ماه هست
    var seen = [];
    days.forEach(function (r) { var ty = r.session.type; if (ty !== 'none' && ty !== 'rest' && seen.indexOf(ty) < 0) seen.push(ty); });
    if (seen.length) {
      html += '<div class="month-legend">' + seen.map(function (ty) {
        return '<span class="day-' + ty + '"><i aria-hidden="true"></i>' + esc(C.TYPE_INFO[ty].label) + '</span>';
      }).join('') + '</div>';
    }
    html += cycleLegend(keys);
    html += dayPanel(days[keys.indexOf(selectedDay)], todayKey, null);
    return html + '</section>';
  }

  app.addEventListener('click', function (e) {
    var vm = e.target.closest('[data-view-mode]');
    if (vm) { settings.planView = vm.dataset.viewMode; saveSettings(); selectedDay = null; renderPlan(); return; }
    var mo = e.target.closest('[data-month]');
    if (mo) {
      var mv = Number(mo.dataset.month);
      monthOffset = mv === 0 ? 0 : monthOffset + mv;
      selectedDay = null;
      renderPlan();
      return;
    }
    var md = e.target.closest('[data-mday]');
    if (md) {
      selectedDay = md.dataset.mday;
      renderPlan();
      var panel = document.getElementById('day-panel');
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    var wk = e.target.closest('[data-week]');
    if (wk) {
      var v = Number(wk.dataset.week);
      viewWeekOffset = v === 0 ? 0 : viewWeekOffset + v;
      selectedDay = null;
      renderPlan();
      return;
    }
    var day = e.target.closest('[data-day]');
    if (day) {
      selectedDay = day.dataset.day;
      renderPlan();
      var tab = document.getElementById('tab-' + selectedDay);
      if (tab) tab.focus();
      return;
    }
    var dn = e.target.closest('[data-done]');
    if (dn) {
      var k = dn.dataset.done;
      if (state.done[k]) { delete state.done[k]; delete state.postRuns[k]; if (state.doneLog) delete state.doneLog[k]; postRunOpen = null; }
      // «انجامش دادم»: همون لحظه ثبت می‌شه، بعد فرم مسافت و زمان واقعی (و برای ایزی، سختی و پیس) باز می‌شه
      else {
        var firstRun = !state.firstRunCelebrated && !Object.keys(state.done).length;
        markDone(k); postRunOpen = k;
        if (firstRun) state.firstRunCelebrated = true;
      }
      save();
      route();
      if (firstRun) openCelebration(k);
      var pf = postRunOpen === k && app.querySelector('[data-postrun-form="' + k + '"]');
      if (pf) pf.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    var pr = e.target.closest('[data-postrun]');
    if (pr) { postRunOpen = postRunOpen === pr.dataset.postrun ? null : pr.dataset.postrun; route(); return; }
    if (e.target.closest('[data-postrun-cancel]')) { postRunOpen = null; route(); return; }
    if (e.target.closest('[data-slow-easy]')) {
      state.profile.easyAdjustSec = Math.min(C.EASY_ADJUST_MAX, (Number(state.profile.easyAdjustSec) || 0) + 10);
      save();
      showToast(fa(T('toast.slowed', { n: state.profile.easyAdjustSec })));
      route();
      return;
    }
    if (e.target.closest('[data-apply-level]')) { applyFitnessLevel(); return; }
    var zf = e.target.closest('[data-zero-feel]');
    if (zf) {
      var zwk = C.buildWeek(state.profile, today());
      state.profile.zeroWeeks = state.profile.zeroWeeks || {};
      state.profile.zeroWeeks[zwk.start] = { feel: zf.dataset.zeroFeel, src: 'user' };
      save(); showToast(T('zero.toastSaved')); route();
      return;
    }
    var cc = e.target.closest('[data-cycle-choice]');
    if (cc) {
      state.cycleChoices = state.cycleChoices || {};
      state.cycleChoices[cc.dataset.date] = cc.dataset.cycleChoice;
      save(); route();
      return;
    }
    // تنظیم یک دوره‌ی پریود (فقط همون دوره) یا پیش‌فرض
    var pm = e.target.closest('[data-period-mode]');
    if (pm) {
      var cy = state.profile.cycle, ov = cy.periodOverrides = cy.periodOverrides || {};
      if (pm.dataset.periodKey) delete ov[pm.dataset.periodKey];
      if (pm.dataset.periodMode !== 'default') ov[pm.dataset.periodStart] = pm.dataset.periodMode;
      // تنظیم دوره‌های تموم‌شده دیگه لازم نیست
      Object.keys(ov).forEach(function (k) { if (C.daysBetween(C.parseDate(k), today()) > 60) delete ov[k]; });
      save();
      showToast(T(pm.dataset.periodMode === 'default' ? 'cycle.pcReset' : 'cycle.pcSaved', { d: faDate(pm.dataset.periodStart, true) }));
      pendingFocus = 'period-card'; route();
      return;
    }
    var pdf = e.target.closest('[data-period-default]');
    if (pdf) {
      state.profile.cycle.periodMode = pdf.dataset.periodDefault;
      save(); showToast(T('cycle.pcDefaultSaved'));
      pendingFocus = 'period-card'; route();
      return;
    }
    var cu = e.target.closest('[data-cycle-undo]');
    if (cu) { delete (state.cycleChoices || {})[cu.dataset.cycleUndo]; save(); route(); return; }
    if (e.target.closest('[data-period-started]')) {
      state.profile.cycle.lastStart = C.dateKey(today());
      save(); showToast(T('cycle.startedToast')); route();
      return;
    }
    if (e.target.closest('[data-zero-graduate]')) {
      // سطح ۱: کمتر از سه ماه سابقه، حجم تقریبی ۳ جلسه × ۱۵ دقیقه
      var zp = state.profile;
      zp.experience = 'lt3m'; zp.currentWeeklyKm = zp.lastWeekKm = zp.monthAvgKm = 8; zp.volumeReason = null; zp.structured = false; zp.startDate = C.dateKey(today());
      save(); showToast(T('zero.toastGraduated')); viewWeekOffset = 0; route();
      return;
    }
  });

  app.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-postrun-form]');
    if (!f) return;
    e.preventDefault();
    var rpe = f.querySelector('input[name=rpe]:checked');
    var pace = f.querySelector('input[name=pace]:checked');
    var err = f.querySelector('.form-errors');
    var easy = f.dataset.easy === '1';
    var noPace = f.dataset.type === 'runwalk' || f.dataset.type === 'walkrun';
    var walk = f.dataset.walk === '1';
    var stepsRaw = walk && f.actSteps ? String(f.actSteps.value || '').trim() : '', steps = stepsRaw === '' ? null : Number(stepsRaw);
    var errs = [];
    // مسافت و زمان واقعی: هر دو اختیاری؛ خالی = ثبت نمی‌شه
    var kmRaw = rawIn(f.actKm), km = kmRaw === null ? null : (isMi() ? Math.round(I.toKm(kmRaw) * 100) / 100 : kmRaw);
    var sec = C.parseTime(f.actTime.value) || null;
    var start = String(f.actStart.value || '').trim() || null;
    if (start && !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) errs.push(T('post.errStart'));
    // امروز: ساعت شروع نمی‌تونه بعد از الان باشه
    else if (start && f.dataset.postrunForm === C.dateKey(new Date())) {
      var now = new Date(), hm = start.split(':').map(Number);
      if (hm[0] * 60 + hm[1] > now.getHours() * 60 + now.getMinutes()) errs.push(T('post.errStartFuture'));
    }
    var kmMin = walk ? 0.2 : 0.5;
    if (km !== null && !(km >= kmMin && km <= 100)) errs.push(fa(T('post.errKm', { min: dKm(kmMin), max: Math.round(dKm(100)) })));
    if (sec !== null && !(sec >= 60 && sec <= 86400)) errs.push(T('post.errTime'));
    // پیس ممکن: دویدن ۲ تا ۲۰ دقیقه در کیلومتر، پیاده‌روی ۵ تا ۳۰
    if (km && sec && !errs.length && (walk ? (sec / km < 300 || sec / km > 1800) : (sec / km < 120 || sec / km > 1200))) errs.push(fa(T('post.errPace', { p: paceFmt(sec / km) })));
    if (steps !== null && !(steps >= 0 && steps <= 100000 && Math.floor(steps) === steps)) errs.push(T('post.errSteps'));
    if (easy && (!rpe || (!noPace && !pace))) errs.push(T(noPace ? 'post.errRpe' : 'post.errBoth'));
    if (errs.length) {
      err.hidden = false;
      err.textContent = errs.join(' ');
      return;
    }
    var key = f.dataset.postrunForm;
    if (!state.done[key]) markDone(key);
    var log = state.doneLog[key];
    if (km || sec || start || steps) { log.actual = {}; if (km) log.actual.km = km; if (sec) log.actual.sec = sec; if (start) log.actual.start = start; if (steps) log.actual.steps = steps; } else delete log.actual;
    if (walk) { if (rpe) state.postRuns[key] = { rpe: Number(rpe.value), walk: true, type: f.dataset.type, at: new Date().toISOString() }; else delete state.postRuns[key]; }
    if (easy) state.postRuns[key] = { rpe: Number(rpe.value), pace: pace ? pace.value : null, easy: true, type: f.dataset.type, at: new Date().toISOString() };
    // سطح ۰: جلسه‌ی خیلی سخت → هفته «سخت» حساب می‌شه (مگه اینکه خود کاربر جواب داده باشه)
    if (easy && f.dataset.type === 'walkrun' && Number(rpe.value) >= 8) {
      var zw = state.profile.zeroWeeks = state.profile.zeroWeeks || {}, wk = C.dateKey(C.weekStart(C.parseDate(key)));
      if (!zw[wk] || zw[wk].src !== 'user') zw[wk] = { feel: 'hard', src: 'rpe' };
    }
    postRunOpen = null;
    save();
    route();
  });

  // سطح ۰: پیشرفت تا ۱۵ دقیقه دویدن پیوسته + سؤال هفتگی (پیشرفت هفته‌ی بعد رو تعیین می‌کنه)
  function zeroCard(p, now) {
    var wk = C.buildWeek(p, now);
    var stage = wk.zeroStage || 0, fin = wk.zeroFinal;
    if (stage >= fin) {
      return '<section class="card zero-card zero-ready"><h3>' + esc(T('zero.readyTitle')) + '</h3><p>' + esc(T('zero.readyText')) + '</p>' +
        '<button type="button" class="btn btn-primary" data-zero-graduate="1">' + tt('zero.readyBtn') + '</button></section>';
    }
    var html = '<section class="card zero-card"><h3>' + esc(T('zero.cardTitle')) + '</h3>' +
      '<p class="zero-stage"><b>' + tt('zero.stage', { n: stage + 1, total: fin + 1 }) + '</b> · ' + tt('zero.weeksLeft', { n: fin - stage }) + '</p>' +
      '<div class="zero-bar" aria-hidden="true"><i style="width:' + Math.round((stage + 1) / (fin + 1) * 100) + '%"></i></div>';
    if (wk.weekIndex >= 0) {
      var f = (p.zeroWeeks || {})[wk.start];
      html += '<p class="sub-legend">' + esc(T('zero.q')) + ' <span class="small muted">' + esc(T('zero.qHint')) + '</span></p><div class="chips">' +
        ['easy', 'ok', 'hard'].map(function (k) {
          return '<button type="button" class="chip-btn" data-zero-feel="' + k + '" aria-pressed="' + !!(f && f.feel === k) + '">' + esc(T('zero.' + k)) + '</button>';
        }).join('') + '</div>' +
        (f ? '<p class="small muted">' + esc(T(f.src === 'rpe' ? 'zero.autoHard' : 'zero.answer.' + f.feel)) + '</p>' : '');
    }
    return html + '</section>';
  }

  // کارت «به‌روزرسانی فیتنس» روی داشبورد: یادآوری تایم‌تست، الگوی RPE بالا، پیشنهاد تغییر سطح
  function fitnessNotesCard(p, now) {
    // همه‌ی موردها (تست فیتنس، روند RPE دویدن آسون، VDOT) مخصوص دویدنه
    if (C.isWalk(p)) return '';
    var items = [];
    var rem = C.fitnessReminder(p, now);
    if (rem) items.push('<li>' + t(rem.message) + ' <a href="#fitness">' + esc(T('fitNotes.register')) + '</a></li>');
    var trend = C.easyRpeTrend(state.postRuns, now);
    if (trend >= 2) items.push('<li><strong>' + esc(T('fitNotes.trendStrong')) + '</strong> ' + tt('fitNotes.trend', { n: trend }) + ' ' +
      t(C.EASY_RPE_WARNING) + easyActions() + '</li>');
    var vs = C.vdotStepSuggestion(p, state.postRuns, now);
    if (vs) items.push('<li>' + tt('fitNotes.step', { n: vs.weeks, a: vs.from.toFixed(1), b: vs.to.toFixed(1) }) +
      '<div class="actions"><button type="button" class="btn btn-outline" data-vdot-step="1">' + esc(T('fitNotes.stepApply')) + '</button>' +
      ' <a href="#fitness">' + esc(T('fitNotes.stepTest')) + '</a></div></li>');
    var sg = C.fitnessLevelSuggestion(p);
    if (sg) items.push('<li>' + esc(T('fitNotes.suggestA')) + ' <strong>' + tt('fitNotes.suggestLevel', { n: sg.to }) + '</strong> ' + tt('fitNotes.suggestB', { from: sg.from }) + ' ' +
      esc(T(sg.up ? 'fitNotes.up' : 'fitNotes.down')) +
      '<div class="actions"><button type="button" class="btn btn-outline" data-apply-level="1">' + tt('fitNotes.apply', { n: sg.to }) + '</button></div></li>');
    if (!items.length) return '';
    return '<section class="card fitness-notes"><h3>' + esc(T('fitNotes.title')) + '</h3><ul>' + items.join('') + '</ul></section>';
  }

  document.addEventListener('click', function (e) {
    if (!(e.target.closest && e.target.closest('[data-vdot-step]'))) return;
    var p = state.profile, vs = C.vdotStepSuggestion(p, state.postRuns, today());
    if (!vs) return;
    p.fitnessTests = (p.fitnessTests || []).concat([vs.entry]);
    save(); showToast(fa(T('fitNotes.stepDone', { v: vs.to.toFixed(1) }))); route();
  });
  // تغییر سطح بر اساس آخرین تایم‌تست؛ حجم از حجم فعلی برنامه ادامه پیدا می‌کنه (نه از عدد قدیمی)
  function applyFitnessLevel() {
    var p = state.profile, now = today();
    var fit = C.currentFitness(p);
    if (!fit) return;
    var wk = C.buildWeek(p, now);
    var km = C.weeklyVolume(p, Math.max(0, wk.weekIndex), true).km;
    var before = C.assessLevel(p).level;
    p.pb = { distanceKm: fit.entry.distanceKm, timeSec: fit.entry.timeSec, date: fit.entry.date };
    p.currentWeeklyKm = p.lastWeekKm = p.monthAvgKm = km;
    p.volumeReason = null;
    p.startDate = C.dateKey(now);
    save();
    showToast(fa(T('toast.levelApplied', { to: C.assessLevel(p).level, from: before, km: km })));
    route();
  }

  // جابه‌جایی بین روزها با کلیدهای جهت (در راست‌چین، چپ = روز بعد؛ در چپ‌چین، راست = روز بعد)
  app.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('[role=tab][data-day]');
    if (!tab || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    var tabs = Array.prototype.slice.call(app.querySelectorAll('[role=tab][data-day]'));
    var forward = isRtl() ? 'ArrowLeft' : 'ArrowRight';
    var i = tabs.indexOf(tab) + (e.key === forward ? 1 : -1);
    if (i < 0 || i >= tabs.length) return;
    e.preventDefault();
    tabs[i].click();
  });

  // =====================================================================
  // ۳. چک‌این روزانه
  // =====================================================================
  function scale(name, aria, labelLow, labelHigh, value) {
    var h = '<div class="scale" role="radiogroup" aria-label="' + esc(aria) + '">';
    for (var i = 1; i <= 5; i++) {
      h += '<label class="scale-opt"><input type="radio" name="' + name + '" value="' + i + '"' + (value === i ? ' checked' : '') + ' required><span>' + fa(i) + '</span></label>';
    }
    return h + '</div><div class="scale-ends"><span>' + esc(labelLow) + '</span><span>' + esc(labelHigh) + '</span></div>';
  }

  function renderCheckin() {
    var now = today(), key = C.dateKey(now);
    var ci = state.checkins[key];
    var base = C.sessionFor(state.profile, now);

    if (ci && ci.pain) {
      app.innerHTML = '<section class="card"><h1>' + esc(T('checkin.title')) + '</h1>' +
        '<div class="alert alert-pain" role="alert"><strong>' + esc(T('checkin.painLocked')) + '</strong>' +
        '<p class="pain-msg">' + esc(C.PAIN_MESSAGE) + '</p>' +
        '<p class="small">' + esc(T('checkin.lockedText')) + '</p></div>' +
        '<a class="btn btn-ghost" href="#home">' + esc(T('checkin.back')) + '</a></section>';
      return;
    }

    ci = ci || {};
    app.innerHTML = '<section class="card checkin">' +
      '<h1>' + esc(T('checkin.heading')) + ' ' + helpLink('checkin', T('checkin.help')) + '</h1>' +
      '<p class="muted">' + esc(T('checkin.planned', { day: base.dayName, date: faDate(key) })) + ' ' + badge(base.type, base.label) + ' ' + t(base.target) + '</p>' +
      '<form id="ci-form" novalidate>' +
      '<fieldset><legend>' + esc(T('checkin.fatigueQ')) + '</legend>' + scale('fatigue', T('checkin.fatigueQ'), T('checkin.fLow'), T('checkin.fHigh'), ci.fatigue) + '</fieldset>' +
      '<fieldset><legend>' + esc(T('checkin.sleepQ')) + '</legend>' + scale('sleep', T('checkin.sleepQ'), T('checkin.sLow'), T('checkin.sHigh'), ci.sleep) +
      '<div class="field field-inline"><label for="ci-hours">' + esc(T('checkin.hoursQ')) + '</label>' +
      '<input id="ci-hours" name="hours" type="text" inputmode="decimal" maxlength="4" dir="ltr" autocomplete="off" value="' + (ci.hours ? esc(fa(ci.hours)) : '') + '" placeholder="' + esc(T('checkin.hoursPh')) + '"></div></fieldset>' +
      '<fieldset><legend>' + esc(T('checkin.painQ')) + '</legend><div class="chips">' +
      '<label class="chip"><input type="radio" name="pain" value="no"' + (ci.pain === false ? ' checked' : '') + '><span>' + esc(T('app.no')) + '</span></label>' +
      '<label class="chip chip-danger"><input type="radio" name="pain" value="yes"><span>' + esc(T('app.yes')) + '</span></label></div>' +
      '<div class="field" id="pain-where" hidden><label for="pw">' + esc(T('checkin.where')) + '</label>' +
      '<input id="pw" name="painWhere" maxlength="120" placeholder="' + esc(T('checkin.wherePh')) + '"></div>' +
      '<small class="muted">' + esc(T('checkin.painNote')) + '</small>' +
      '</fieldset>' +
      '<div id="ci-errors" class="form-errors" role="alert" hidden></div>' +
      '<div class="actions"><button type="submit" class="btn btn-primary">' + esc(T('checkin.submit')) + '</button>' +
      '<a class="btn btn-ghost" href="#home">' + esc(T('app.cancel')) + '</a></div>' +
      '</form></section>';

    var form = document.getElementById('ci-form');
    form.addEventListener('change', function () {
      var pv = form.querySelector('input[name=pain]:checked');
      document.getElementById('pain-where').hidden = !(pv && pv.value === 'yes');
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var errs = [];
      var fatigue = Number(fd.get('fatigue')), sleep = Number(fd.get('sleep')), pain = fd.get('pain');
      if (!fatigue) errs.push(T('checkin.err.fatigue'));
      if (!sleep) errs.push(T('checkin.err.sleep'));
      if (!pain) errs.push(T('checkin.err.pain'));
      var where = String(fd.get('painWhere') || '').trim();
      if (pain === 'yes' && !where) errs.push(T('checkin.err.where'));
      var box = document.getElementById('ci-errors');
      if (errs.length) {
        box.hidden = false;
        box.innerHTML = '<ul>' + errs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
        return;
      }
      var hours = parseFloat(String(fd.get('hours') || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace('٫', '.'));
      state.checkins[key] = { fatigue: fatigue, sleep: sleep, pain: pain === 'yes', painWhere: pain === 'yes' ? where : '', at: new Date().toISOString() };
      if (hours > 0 && hours <= 14) state.checkins[key].hours = Math.round(hours * 2) / 2;
      save();
      if (pain === 'yes') {
        notify({ key: 'pain-' + key, k: 'error', m: 'pain', href: '#plan', today: true, flash: false });
        openPainModal(key); return;
      }
      var r = effectiveSession(base);
      if (r.adaptation && r.adaptation.kind === 'downgrade') notify({ key: 'adapt-' + key, k: 'warning', m: 'adapt', p: { s: r.session.label }, href: '#plan', today: true, flash: false });
      showToast(T(r.adaptation && r.adaptation.kind === 'downgrade' ? 'checkin.toastDown' : 'checkin.toastOk'));
      location.hash = '#home';
    });
  }

  // پیام درد: بدون دکمه‌ی بستن، Esc و کلیک بیرون کار نمی‌کنه؛ فقط با تیک تایید بسته می‌شه
  function openPainModal(key) {
    if (document.getElementById('pain-modal')) return;
    var ci = state.checkins[key] || {};
    modalRoot.innerHTML =
      '<div class="modal-backdrop" id="pain-modal">' +
      '<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="pm-title" aria-describedby="pm-desc">' +
      '<div class="modal-icon" aria-hidden="true">!</div>' +
      '<h2 id="pm-title">' + esc(T('pain.modalTitle')) + '</h2>' +
      '<p id="pm-desc" class="pain-msg">' + esc(C.PAIN_MESSAGE) + '</p>' +
      (ci.painWhere ? '<p class="small">' + esc(T('pain.where', { w: ci.painWhere })) + '</p>' : '') +
      '<ul class="small"><li>' + esc(T('pain.li1')) + '</li><li>' + esc(T('pain.li2')) + '</li>' +
      '<li>' + esc(T('pain.li3')) + '</li></ul>' +
      '<label class="ack"><input type="checkbox" id="pm-ack"> <span>' + esc(T('pain.ack')) + '</span></label>' +
      '<button type="button" class="btn btn-danger" id="pm-ok" disabled>' + esc(T('pain.ok')) + '</button>' +
      '</div></div>';
    document.body.classList.add('modal-open');
    var ack = document.getElementById('pm-ack'), ok = document.getElementById('pm-ok');
    ack.addEventListener('change', function () { ok.disabled = !ack.checked; });
    ok.addEventListener('click', function () {
      if (!ack.checked) return;
      state.ackPain[key] = new Date().toISOString();
      save();
      modalRoot.innerHTML = '';
      document.body.classList.remove('modal-open');
      if (location.hash === '#home') route(); else location.hash = '#home';
    });
    ack.focus();
  }
  document.addEventListener('keydown', function (e) {
    var m = document.getElementById('pain-modal');
    if (!m) return;
    if (e.key === 'Escape') { e.preventDefault(); return; }
    if (e.key === 'Tab') { // نگه داشتن فوکوس داخل پنجره
      var f = [document.getElementById('pm-ack'), document.getElementById('pm-ok')].filter(function (x) { return !x.disabled; });
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  // =====================================================================
  // ۴. هدف مسابقه
  // =====================================================================
  function ultraSummary(g) {
    var info = C.ULTRA_CLASS_INFO[g.cls];
    return '<ul class="ultra-facts">' +
      '<li>' + tt('race.ratio', { r: Math.round(g.ratio) }) + '<b>' + esc(info.short) + '</b></li>' +
      '<li>' + esc(T('race.focus', { t: info.emphasis })) + '</li>' +
      (g.loss !== null ? '<li>' + tt('race.loss', { n: g.loss }) + '</li>' : '') +
      (g.terrain ? '<li>' + esc(T('race.terrain', { t: C.TERRAIN_LABELS[g.terrain] })) + '</li>' : '') +
      (g.altitude ? '<li>' + tt('race.altitude', { n: g.altitude }) + '</li>' : '') + '</ul>';
  }

  // هدف اصلی: [کارت شمارش معکوس و تیپر، کارت‌های مسیر اولترا و پیش‌بینی زمان]
  function mainRaceHtml(p, g) {
    if (g.type === 'none') {
      return ['<section class="card race-hero"><p class="eyebrow">' + esc(T('race.mainLabel')) + '</p><h2>' + esc(T('race.none')) + '</h2>' +
        '<p class="small muted">' + esc(T('race.noneHint')) + '</p><a class="btn btn-primary" href="#onboarding" data-onb-focus="goal">' + esc(T('race.choose')) + '</a></section>', ''];
    }
    var race = C.raceInfo(p);
    var now = today();
    var fit = C.currentFitness(p);
    var pb = fit ? fit.entry : null;
    var html = '<section class="card race-hero"><span class="drop-hint" aria-hidden="true">' + esc(T('race.dropHint')) + '</span><p class="eyebrow">' + esc(T('race.mainLabel')) + '</p><h2 class="race-main-name">' + t(C.goalLabel(g)) + '</h2>';
    if (race) {
      var daysLeft = C.daysBetween(now, race.date);
      html += '<p class="race-date">' + esc(faDate(g.date)) + '</p><div class="countdown">' + (daysLeft > 0 ? '<b>' + fa(daysLeft) + '</b><span>' + esc(T('race.daysLeft', { n: daysLeft })) + '</span>'
        : daysLeft === 0 ? '<b>' + esc(T('race.todayBang')) + '</b><span>' + esc(T('race.goodLuck')) + '</span>' : '<b>✓</b><span>' + esc(T('race.done')) + '</span>') + '</div>';
    } else {
      html += '<p class="race-date">' + esc(T('race.noDate')) + ' · <a href="#onboarding">' + esc(T('race.addDate')) + '</a></p>';
    }
    if (race && race.date > now) {
      var taperStart = C.addDays(race.date, -C.taperWeeks(race.key) * 7);
      html += '<p class="race-date">' + esc(T('race.taperStart', { d: faDate(C.dateKey(taperStart)) })) + ' ' + helpLink('goals', T('race.taperHelp')) + '</p>';
    }
    if (race && race.date <= now && g.category !== 'ultra') html += resultBlock('main', race.km, C.dateKey(race.date));
    html += mainTargetHtml(p, g) + '<a class="linklike small race-change" href="#onboarding" data-onb-focus="goal">' + esc(T('race.changeMain')) + '</a></section>';
    var hero = html;
    html = '';

    if (g.category === 'ultra') html += '<section class="card"><h2>' + esc(T('race.route')) + ' ' + helpLink('goals', T('race.routeHelp')) + '</h2>' + ultraSummary(g) + '</section>';

    // پیش‌بینی زمان
    if (g.category === 'ultra') {
      html += '<section class="card"><h2>' + esc(T('race.estTitle')) + ' ' + helpLink('goals', T('race.estHelp')) + '</h2>';
      if (pb) {
        var eq = g.km + g.gain / 100, tf = { technical: 1.15, trail: 1.08, gravel: 1.02, mixed: 1.08 }[g.terrain] || 1.08;
        var est = C.riegel(pb.timeSec, pb.distanceKm, eq) * tf;
        html += '<div class="prediction"><span>' + esc(T('race.estRough')) + '</span><b dir="ltr">' + fa(C.formatDuration(est)) + '</b></div>';
      } else html += '<p>' + esc(T('race.estNeed')) + '</p>';
      html += '<a class="btn btn-outline" href="#fitness">' + esc(T('race.newTest')) + '</a></section>';
    } else {
      html += '<section class="card"><h2>' + esc(T('race.predTitle')) + ' ' + helpLink('goals', T('race.predHelp')) + '</h2>';
      if (pb) {
        var pred = C.riegel(pb.timeSec, pb.distanceKm, g.km);
        html += '<div class="prediction"><span>' + tt('race.predFor', { race: C.RACE_LABELS[g.type] }) + '</span>' +
          '<b dir="ltr">' + fa(C.formatDuration(pred)) + '</b>' +
          '<small>' + tt('race.avgPace', { p: paceFmt(pred / g.km) }) + '</small></div>' +
          '<div class="table-wrap"><table class="pred-table"><thead><tr><th>' + esc(T('race.thDist')) + '</th><th>' + esc(T('race.thTime')) + '</th><th>' + esc(T('race.thPace')) + '</th></tr></thead><tbody>' +
          Object.keys(C.RACE_DISTANCES).map(function (k) {
            var d = C.RACE_DISTANCES[k], tm = C.riegel(pb.timeSec, pb.distanceKm, d);
            return '<tr' + (k === g.type ? ' class="hl"' : '') + '><td>' + t(C.RACE_LABELS[k]) + '</td><td dir="ltr">' + fa(C.formatDuration(tm)) + '</td><td dir="ltr">' + fa(paceFmt(tm / d)) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else html += '<p>' + esc(T('race.predNeed')) + '</p>';
      html += '<a class="btn btn-outline" href="#fitness">' + esc(T('race.newTestOrPb')) + '</a></section>';
    }
    return [hero, html];
  }


  // نتیجه‌ی ثبت‌شده‌ی یک مسابقه = رکورد «مسابقه» با همون تاریخ و مسافت در تاریخچه‌ی فیتنس
  function raceResult(km, dateKey) {
    return (state.profile.fitnessTests || []).filter(function (x) { return x.kind === 'race' && x.date === dateKey && Math.abs(x.distanceKm - km) < 0.15; })[0] || null;
  }
  // ثبت نتیجه (فقط بعد از روز مسابقه): رکورد تازه → VDOT و پیس‌ها خودکار به‌روز می‌شن
  function resultBlock(id, km, dateKey) {
    var r = raceResult(km, dateKey);
    if (r) return '<p class="race-result"><b>' + esc(T('race.resultLabel')) + '</b> <span dir="ltr">' + fa(C.formatDuration(r.timeSec)) + '</span>' + T('progress.sep') +
      'VDOT ' + fa(C.vdotFromRace(r.distanceKm, r.timeSec).toFixed(1)) + '</p>';
    if (raceResultOpen !== id) return '<button type="button" class="btn btn-outline race-result-btn" data-race-result="' + esc(id) + '">' + esc(T('race.resultAdd')) + '</button>';
    var f = C.currentFitness(state.profile), guess = f ? C.raceTimeFromVdot(f.vdot, km) : km * 360;
    return '<form class="race-result-form" data-race-result-form="' + esc(id) + '" data-km="' + km + '" data-date="' + esc(dateKey) + '" novalidate>' +
      '<div class="field field-tpick"><span class="field-label">' + esc(T('race.resultTime')) + '</span>' +
      tpo({ id: 'rr-' + id, name: 'rtime', sec: Math.round(guess / 5) * 5, touched: false, preview: 'rr-read-' + id,
        aria: T('race.resultTime'), }) +
      '<small class="time-read" id="rr-read-' + esc(id) + '" aria-live="polite"></small></div>' +
      '<p class="form-errors" hidden></p><div class="actions"><button type="submit" class="btn btn-primary">' + esc(T('race.resultSave')) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-race-result-cancel="1">' + esc(T('app.cancel')) + '</button></div></form>';
  }
  var raceResultOpen = null;
  var RACE_KM = [['5', 5], ['10', 10], ['21', 21.1], ['42', 42.2]];
  function renderRace() {
    var p = state.profile, g = C.goalInfo(p), now = today(), nowKey = C.dateKey(now), main = C.raceInfo(p);
    var mainParts = mainRaceHtml(p, g);
    var html = '<header class="page-head"><h1>' + esc(T('race.pageTitle')) + '</h1></header>' + mainParts[0] + linkCard('#plans', T('plans.title'), T('plans.linkSub'));
    // مسابقه‌های دیگه
    var list = goalList(p);
    html += '<section class="card races-card" id="races-card"><h2>' + esc(T('race.others')) + '</h2><p class="small muted">' + esc(T('race.othersHint')) + '</p>';
    if (!list.length) html += '<p class="muted races-empty">' + esc(T('race.othersEmpty')) + '</p>';
    else html += '<ul class="race-list">' + list.map(function (r) {
      var dated = !!r.key, days = dated ? Math.round(C.daysBetween(now, r.date)) : null, w = C.sideRaceWindow(r.km), past = dated && r.key <= nowKey;
      var near = dated && main && main.date > r.date && C.daysBetween(r.date, main.date) <= C.taperWeeks(main.key) * 7 + 7;
      var std = RACE_KM.filter(function (x) { return Math.abs(x[1] - r.km) < 0.15; })[0];
      var src = (p.races || []).filter(function (x) { return x.id === r.id; })[0] || {};
      var canMain = !past && (std || src.goal);
      var label = r.name || C.raceDistLabel(r.km);
      return '<li class="race-item' + (past ? ' is-past' : '') + (canMain ? ' has-grip' : '') + '" data-race-id="' + esc(r.id) + '">' +
        (canMain ? '<button type="button" class="race-grip" data-race-grip="' + esc(r.id) + '" aria-label="' + esc(T('race.dragAria', { g: label })) + '">' + GRIP_SVG + '</button>' : '') +
        '<div class="race-item-body"><div class="race-item-head"><b>' + t(r.name || C.raceDistLabel(r.km)) + '</b>' +
        (r.name ? '<span class="muted small">' + t(C.raceDistLabel(r.km)) + '</span>' : '') + '</div>' +
        ((src.targetSec || (src.goal && src.goal.targetSec)) && !past ? '<p class="small race-target-line">' + tt('race.targetLine', { t: C.formatDuration(src.targetSec || src.goal.targetSec) }) + '</p>' : '') +
        (dated ? '<p class="small race-item-date">' + esc(faDate(r.key)) + T('progress.sep') + (past ? esc(T('race.past')) : days === 0 ? esc(T('race.todayBang')) : tt('race.inDays', { n: days })) + '</p>' +
          (!past ? '<p class="small muted">' + tt('race.window', { pre: w.pre, post: w.post }) + '</p>' : '')
          : '<p class="small muted">' + esc(T('race.noDateSec')) + '</p>') +
        (near && !past ? '<p class="small race-near">' + esc(T('race.nearMain')) + '</p>' : '') +
        (past ? resultBlock(r.id, r.km, r.key) : '') +
        '<div class="race-item-actions">' + (canMain ? '<button type="button" class="linklike small" data-race-main="' + esc(r.id) + '">' + esc(T('race.makeMain')) + '</button>' : '') +
        '<button type="button" class="linklike small race-del" data-race-del="' + esc(r.id) + '">' + esc(T('race.remove')) + '</button></div></div></li>';
    }).join('') + '</ul>';
    // افزودن مسابقه
    if ((p.races || []).length < C.MAX_RACES) {
      var dr = raceDraft || {}, paceOk = C.assessLevel(p).level >= C.PACE_LEVEL;
      html += '<details class="race-add" id="race-add"' + (raceAddOpen ? ' open' : '') + '><summary>' + esc(T('race.add')) + '</summary><form id="race-add-form" novalidate>' +
        (raceDraft ? '<p class="small race-draft">' + esc(T('race.fromPlan')) + '</p>' : '') +
        '<div class="field"><label for="ra-name">' + esc(T('race.name')) + '</label><input id="ra-name" name="name" type="text" maxlength="40" placeholder="' + esc(T('race.namePh')) + '"></div>' +
        '<p class="sub-legend">' + esc(T('race.dist')) + '</p><div class="chips">' +
        RACE_KM.map(function (x, i) { return '<label class="chip"><input type="radio" name="dist" value="' + x[1] + '"' + ((dr.key ? dr.key === x[0] : i === 1) ? ' checked' : '') + '><span>' + t(C.RACE_LABELS[x[0]]) + '</span></label>'; }).join('') +
        '<label class="chip"><input type="radio" name="dist" value="other"><span>' + esc(T('race.distOther')) + '</span></label></div>' +
        '<div class="field" id="ra-km-field" hidden><label for="ra-km">' + esc(T('race.km', { u: T('units.' + I.getUnits()) })) + '</label><input id="ra-km" name="km" type="number" inputmode="decimal"' + limAttrs('race', '0.1') + '></div>' +
        '<div class="field"><label for="ra-date">' + esc(T('race.date')) + '</label><input id="ra-date" name="date" type="date" min="' + nowKey + '"' + (dr.date ? ' value="' + dr.date + '"' : '') + '></div>' +
        (paceOk ? '<div class="field" id="ra-target-field"><label for="ra-target">' + esc(T('race.target')) + '</label>' +
          tpo({ id: 'ra-target', name: 'target', sec: dr.targetSec || 3000, touched: !!dr.targetSec, aria: T('race.target') }) +
          '<small class="muted">' + esc(T('race.targetHint')) + '</small></div>' : '') +
        '<p class="form-errors" hidden></p><button type="submit" class="btn btn-primary">' + esc(T('race.addSave')) + '</button></form></details>';
    }
    html += '</section>' + mainParts[1];
    app.innerHTML = html;
    var rf = app.querySelector('.race-result-form');
    if (rf) window.CoachTimePicker.init(rf);
    var af = document.getElementById('race-add-form');
    if (af) af.addEventListener('change', function () {
      var other = af.querySelector('input[name=dist]:checked').value === 'other', tf = document.getElementById('ra-target-field');
      document.getElementById('ra-km-field').hidden = !other;
      // زمان هدف فقط برای مسافت‌های استاندارد (پیس مسابقه‌ی همون مسافت)
      if (tf) tf.hidden = other;
    });
  }
  var raceAddOpen = false, raceDraft = null;
  function goalList(p) {
    var main = C.raceInfo(p), mk = main ? C.dateKey(main.date) : null;
    return (p.races || []).filter(function (r) { return r && Number(r.km) > 0 && (!r.date || r.date !== mk); })
      .map(function (r) { return { id: r.id, name: r.name || '', km: Number(r.km), key: r.date || null, date: r.date ? C.parseDate(r.date) : null, result: r.result || null }; })
      .sort(function (a, b) { return a.key === b.key ? 0 : !a.key ? 1 : !b.key ? -1 : a.key < b.key ? -1 : 1; });
  }
  // زمان هدف: ورودی «۲۵:۰۰» یا «۱:۴۵:۰۰»؛ سرعت باید ممکن باشه
  function targetIn(str, km) {
    var sec = C.parseTime(str), v = sec ? km / (sec / 3600) : 0;
    if (!sec) return { error: T('race.targetErr') };
    if (v > 26 || v < 4) return { error: fa(T('fit.err.impossible', { km: km, d: C.describeDuration(sec) })) };
    return { sec: sec };
  }
  // زمان هدف مسابقه‌ی اصلی (سطح ۳ به بالا، مسافت‌های استاندارد)
  function mainTargetHtml(p, g) {
    if (g.category === 'ultra' || C.assessLevel(p).level < C.PACE_LEVEL) return '';
    var race = C.raceInfo(p);
    if (race && race.date <= today()) return '';
    var cur = g.targetSec;
    return '<details class="race-target"' + (targetOpen ? ' open' : '') + '><summary>' + (cur
      ? tt('race.targetLine', { t: C.formatDuration(cur) }) + ' · ' + tt('race.targetPace', { p: C.formatDuration(Math.round(I.pace(cur / g.km))) })
      : esc(T('race.targetSet'))) + '</summary>' +
      '<form data-race-target-form="1" novalidate><p class="small muted">' + esc(T('race.targetHow')) + '</p>' +
      '<div class="field"><label for="rt-time">' + esc(T('race.target')) + '</label>' + tpo({ id: 'rt-time', name: 'target', sec: cur || (g.km ? Math.round(g.km * 330) : 3000), touched: !!cur, aria: T('race.target') }) + '</div>' +
      '<p class="form-errors" hidden></p><div class="actions"><button type="submit" class="btn btn-primary">' + esc(T('race.targetSave')) + '</button>' +
      (cur ? '<button type="button" class="linklike small" data-race-target-clear="1">' + esc(T('race.targetClear')) + '</button>' : '') + '</div></form></details>';
  }
  var targetOpen = false;
  app.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-race-target-form]');
    if (!f) return;
    e.preventDefault();
    var p = state.profile, g = C.goalInfo(p), r = targetIn(f.target.value, g.km), err = f.querySelector('.form-errors');
    if (r.error) { err.hidden = false; err.textContent = r.error; return; }
    p.goal = Object.assign({}, p.goal, { targetSec: r.sec });
    targetOpen = false;
    save(); showToast(T('race.targetSaved')); renderRace();
  });
  app.addEventListener('click', function (e) {
    if (!e.target.closest('[data-race-target-clear]')) return;
    var p = state.profile;
    p.goal = Object.assign({}, p.goal); delete p.goal.targetSec;
    targetOpen = false;
    save(); showToast(T('race.targetCleared')); renderRace();
  });
  app.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('race-target')) targetOpen = e.target.open; }, true);

  // =====================================================================
  // برنامه‌های پیشنهادی: الگوی ۵ و ۱۰ کیلومتر، نیمه‌ماراتن و ماراتن برای سطح و حجم فعلی (C.planSuggestion)
  // فقط پیشنهاده؛ «استفاده به‌عنوان الگو» فقط فرم افزودن مسابقه رو پیش‌پر می‌کنه
  // =====================================================================
  var PLAN_KEYS = ['5', '10', '21', '42'], planTargets = {};
  function weeksText(w, hi) {
    if (hi <= 52) return T('plans.weeks', { a: w, b: hi });
    return T('plans.months', { a: Math.round(w / 4.35), b: Math.round(hi / 4.35) });
  }
  function paceU(sec) { return fa(C.formatDuration(Math.round(I.pace(sec)))); }
  function renderPlans() {
    var p = state.profile, a = C.assessLevel(p), pace = a.level >= C.PACE_LEVEL;
    var html = '<header class="page-head"><h1>' + esc(T('plans.title')) + '</h1></header><p class="page-intro">' + esc(T('plans.intro')) + '</p>' +
      '<section class="card plan-me"><p><b>' + tt('profile.levelNum', { n: a.level }) + '</b> · ' + esc(a.info.name) + ' · ' + tt('plans.volNow', { n: C.planSuggestion(p, '5').startKm }) + '</p>' +
      '<p class="small muted">' + esc(T(pace ? 'plans.modePace' : 'plans.modeVolume')) + '</p>' +
      (C.ageFactor(p.age) > 1 ? '<p class="small muted">' + esc(T('plans.ageNote')) + '</p>' : '') + '</section>';
    html += PLAN_KEYS.map(function (k) { return planCard(p, k); }).join('');
    html += '<p class="small muted plan-foot">' + esc(T('plans.foot')) + '</p>' + learnMore(['tenpct', 'vdot']);
    app.innerHTML = html;
  }
  function planCard(p, k) {
    var s = C.planSuggestion(p, k, planTargets[k] || 0), focus = planFocus === k;
    if (focus) planFocus = null;
    var row = function (label, val) { return '<div><dt>' + esc(label) + '</dt><dd>' + val + '</dd></div>'; };
    var html = '<section class="card plan-card' + (focus ? ' is-focus' : '') + '" id="plan-' + k + '"><div class="plan-head"><h2>' + t(C.RACE_LABELS[k]) + '</h2>' +
      '<span class="pill pill-level">' + esc(T(s.pace ? 'plans.goalPace' : 'plans.goalFinish')) + '</span></div>' +
      '<div class="plan-weeks"><b>' + t(weeksText(s.weeks, s.weeksHi)) + '</b><span>' + esc(T(s.pace ? 'plans.cycle' : 'plans.untilReady')) + '</span></div><dl class="plan-rows">' +
      (s.zeroWeeks ? row(T('plans.zero'), tt('plans.zeroVal', { n: s.zeroWeeks })) : '') +
      row(T('plans.volume'), s.peakKm > s.startKm ? tt('plans.volVal', { a: s.startKm, b: s.peakKm }) : tt('plans.volKeep', { n: s.peakKm })) +
      row(T('plans.long'), tt('plans.longVal', { n: s.longKm })) +
      row(T('plans.sessions'), tt('plans.sesVal', { n: s.sessions })) + '</dl>';
    if (s.pace) html += planPaceHtml(s, k);
    var useWeeks = s.weeks, date = C.dateKey(C.addDays(today(), useWeeks * 7));
    html += '<button type="button" class="btn btn-outline btn-block" data-plan-use="' + k + '" data-plan-date="' + date + '">' + esc(T('plans.use')) + '</button>' +
      '<p class="small muted center">' + tt('plans.useHint', { d: faDate(date) }) + '</p></section>';
    return html;
  }
  function planPaceHtml(s, k) {
    var html = '<div class="plan-pace"><p class="plan-now">' + esc(T('plans.now')) + ' <b dir="ltr">' + fa(C.formatDuration(Math.round(s.predSec))) + '</b>' +
      (s.vdotKnown ? '' : ' <span class="small muted">' + esc(T('plans.nowEst')) + '</span>') + '</p>' +
      '<div class="field plan-target"><label for="pt-' + k + '">' + esc(T('plans.target')) + '</label>' + tpo({ id: 'pt-' + k, name: 'target', sec: s.targetSec || s.presets[1].sec, touched: !!s.targetSec, aria: T('plans.target'), attrs: ' data-plan-target="' + k + '"' }) + '</div>' +
      '<div class="chips plan-presets" role="group" aria-label="' + esc(T('plans.presetsAria')) + '">' + s.presets.map(function (x) {
        return '<button type="button" class="chip-btn" data-plan-preset="' + k + '" data-sec="' + x.sec + '" aria-pressed="' + (s.targetSec === x.sec) + '"><b dir="ltr">' + fa(C.formatDuration(x.sec)) + '</b><small>' + tt('plans.presetWeeks', { n: x.weeks }) + '</small></button>';
      }).join('') + '</div>';
    if (planErr[k]) html += '<p class="form-errors">' + esc(planErr[k]) + '</p>';
    if (s.targetSec) {
      if (s.already) html += '<p class="alert alert-good small">' + esc(T('plans.already')) + '</p>';
      else {
        html += '<dl class="plan-rows">' +
          '<div><dt>' + esc(T('plans.targetPace')) + '</dt><dd dir="ltr">' + paceU(s.targetPace) + ' ' + esc(T('units.pace.' + I.getUnits())) + '</dd></div>' +
          '<div><dt>VDOT</dt><dd><span dir="ltr">' + fa(s.vdot.toFixed(1)) + ' → ' + fa(s.targetVdot.toFixed(1)) + '</span> · ' + tt('plans.steps', { n: s.steps, w: s.stepWeeks }) + '</dd></div></dl>' +
          '<p class="small muted">' + tt('plans.howPace', { e: paceU(s.paces.E), t: paceU(s.paces.T), w: s.stepWeeks }) + '</p>';
        if (s.ambitious) html += '<div class="alert alert-adapt small"><p>' + tt('plans.ambitious', { n: s.paceWeeks }) + '</p>' +
          '<button type="button" class="linklike small" data-plan-preset="' + k + '" data-sec="' + s.mid.sec + '">' + tt('plans.midUse', { t: C.formatDuration(s.mid.sec), n: s.mid.weeks }) + '</button></div>';
      }
    }
    return html + '</div>';
  }
  var planErr = {}, planBusy = false;
  function setPlanTarget(k, sec, err) {
    planErr[k] = err || null;
    if (!err) { if (sec) planTargets[k] = sec; else delete planTargets[k]; }
    var y = window.scrollY, card = document.getElementById('plan-' + k);
    // جایگزینی کارت فیلد فعال رو برمی‌داره و «change» دوباره صدا زده می‌شه؛ یک بار کافیه
    if (!card || planBusy) return;
    planBusy = true;
    try { card.outerHTML = planCard(state.profile, k); } finally { planBusy = false; }
    window.scrollTo(0, y);
  }
  app.addEventListener('change', function (e) {
    var k = e.target.dataset && e.target.dataset.planTarget;
    if (!k) return;
    var v = e.target.value.trim();
    if (!v) return setPlanTarget(k, 0);
    var r = targetIn(v, C.RACE_DISTANCES[k]);
    setPlanTarget(k, r.sec, r.error);
  });
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-plan-preset]');
    if (b) { setPlanTarget(b.dataset.planPreset, Number(b.dataset.sec)); var inp = document.getElementById('pt-' + b.dataset.planPreset); if (inp) inp.focus(); return; }
    var u = e.target.closest('[data-plan-use]');
    if (!u) return;
    var k = u.dataset.planUse;
    raceDraft = { key: k, date: u.dataset.planDate, targetSec: planTargets[k] || null };
    raceAddOpen = true;
    location.hash = '#race';
    setTimeout(function () { var d = document.getElementById('race-add'); if (d) d.scrollIntoView({ block: 'start' }); }, 50);
  });
  function newRaceId() { return 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  app.addEventListener('submit', function (e) {
    var af = e.target.closest('#race-add-form'), rf = e.target.closest('[data-race-result-form]');
    if (!af && !rf) return;
    e.preventDefault();
    var p = state.profile, err = (af || rf).querySelector('.form-errors'), nowKey = C.dateKey(today());
    var fail = function (m) { err.hidden = false; err.textContent = m; };
    if (af) {
      var dv = af.querySelector('input[name=dist]:checked').value, km = dv === 'other' ? kmIn(af.km) : Number(dv), date = af.date.value;
      var main = C.raceInfo(p);
      if (dv === 'other' && !inLim('race', rawIn(af.km))) return fail(fa(T('race.err.km', Object.assign(limParams('race'), { u: T('units.' + I.getUnits()) }))));
      if (date && date < nowKey) return fail(T('race.err.date'));
      if (date && main && C.dateKey(main.date) === date) return fail(T('race.err.sameMain'));
      if (date && (p.races || []).some(function (r) { return r.date === date; })) return fail(T('race.err.dup'));
      var tgt = af.target && af.target.value.trim() ? targetIn(af.target.value, km) : null;
      if (tgt && tgt.error) return fail(tgt.error);
      var stdK = RACE_KM.filter(function (x) { return x[1] === km; })[0];
      raceAddOpen = false; raceDraft = null;
      // بدون هدف اصلی: هدف تازه (مسافت استاندارد) هدف اصلی می‌شه و برنامه بر اساسش چیده می‌شه
      if (C.goalInfo(p).type === 'none' && stdK) {
        p.goal = { type: stdK[0], date: date || null };
        if (tgt) p.goal.targetSec = tgt.sec;
        save(); showToast(T('race.toastAddedMain')); renderRace();
        return;
      }
      var nr = { id: newRaceId(), name: af.name.value.trim().slice(0, 40), km: km, date: date || null };
      if (tgt && dv !== 'other') nr.targetSec = tgt.sec;
      p.races = (p.races || []).concat([nr]);
      save(); showToast(T(date ? 'race.toastAdded' : 'race.toastAddedSec')); renderRace();
      return;
    }
    var tm = C.parseTime(rf.rtime.value), rkm = Number(rf.dataset.km), rdate = rf.dataset.date, v = tm ? rkm / (tm / 3600) : 0;
    if (!tm) return fail(T('race.resultErr'));
    if (v > 26 || v < 2) return fail(fa(T('fit.err.impossible', { km: rkm, d: C.describeDuration(tm) })));
    p.fitnessTests = (p.fitnessTests || []).concat([{ date: rdate, distanceKm: rkm, timeSec: tm, kind: 'race' }]);
    // رکورد تازه = پیس‌ها از نو (مثل ثبت تایم‌تست)
    p.easyAdjustSec = 0;
    raceResultOpen = null;
    save(); showToast(fa(T('race.resultSaved', { v: C.currentFitness(p).vdot.toFixed(1) })));
    notify({ key: 'vdot-' + rdate + '-' + tm, k: 'success', m: 'vdot', p: { v: C.currentFitness(p).vdot.toFixed(1) }, href: '#fitness', flash: false });
    renderRace();
  });
  app.addEventListener('click', function (e) {
    var t0 = e.target.closest && e.target.closest('[data-race-result], [data-race-result-cancel], [data-race-main], [data-race-del], .race-add > summary');
    if (!t0 || location.hash !== '#race') return;
    var p = state.profile;
    if (t0.matches('.race-add > summary')) { raceAddOpen = !t0.parentElement.open; return; }
    if (t0.dataset.raceResult) { raceResultOpen = t0.dataset.raceResult; renderRace(); return; }
    if (t0.dataset.raceResultCancel) { raceResultOpen = null; renderRace(); return; }
    if (t0.dataset.raceDel) {
      p.races = (p.races || []).filter(function (r) { return r.id !== t0.dataset.raceDel; });
      save(); showToast(T('race.toastRemoved')); renderRace(); return;
    }
    if (t0.dataset.raceMain) makeMainGoal(t0.dataset.raceMain);
  });
  // هدف فرعی ← هدف اصلی؛ هدف اصلی قبلی (آینده یا بدون تاریخ) فرعی می‌شه و جزئیاتش (مسیر اولترا، زمان هدف) می‌مونه
  function makeMainGoal(id) {
    var p = state.profile, r = (p.races || []).filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var std = RACE_KM.filter(function (x) { return Math.abs(x[1] - r.km) < 0.15; })[0];
    if (!r.goal && !std) return;
    var before = { goal: JSON.parse(JSON.stringify(p.goal || null)), races: JSON.parse(JSON.stringify(p.races || [])) };
    var rest = p.races.filter(function (x) { return x.id !== r.id; });
    var old = p.goal, og = C.goalInfo(p);
    if (og.type !== 'none' && (!og.date || og.date >= C.dateKey(today()))) rest.push({ id: newRaceId(), name: '', km: og.km, date: og.date || null, goal: old });
    p.goal = r.goal ? r.goal : { type: std[0], date: r.date || null };
    if (r.targetSec && !r.goal) p.goal.targetSec = r.targetSec;
    p.races = rest;
    save(); renderRace();
    var hero = app.querySelector('.race-hero');
    if (hero) { hero.classList.remove('swapped'); void hero.offsetWidth; hero.classList.add('swapped'); }
    undoToast(T('race.swapped', { g: C.goalLabel(C.goalInfo(p)) }), function () {
      p.goal = before.goal; p.races = before.races;
      save(); if (location.hash === '#race') renderRace(); showToast(T('race.undone'));
    });
  }
  // پیام با دکمه‌ی «برگردان» (۶ ثانیه)
  function undoToast(msg, onUndo) {
    var old = document.querySelector('.toast-undo');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast toast-undo';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span></span><button type="button">' + esc(T('race.undo')) + '</button>';
    el.firstChild.textContent = msg;
    document.body.appendChild(el);
    var done = false, close = function () { if (done) return; done = true; el.classList.add('out'); setTimeout(function () { el.remove(); }, 400); };
    el.querySelector('button').addEventListener('click', function () { if (done) return; onUndo(); close(); });
    setTimeout(close, 6000);
  }
  var GRIP_SVG = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><g fill="currentColor"><circle cx="6" cy="4" r="1.6"/><circle cx="12" cy="4" r="1.6"/><circle cx="6" cy="9" r="1.6"/><circle cx="12" cy="9" r="1.6"/><circle cx="6" cy="14" r="1.6"/><circle cx="12" cy="14" r="1.6"/></g></svg>';
  // کشیدن هدف فرعی روی کارت هدف اصلی (Pointer Events: انگشت، ماوس و قلم یکسان)؛ فقط از دستگیره، تا اسکرول صفحه دست نخوره
  var goalDrag = null;
  app.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('[data-race-grip]');
    if (!g || e.button > 0) return;
    e.preventDefault();
    var li = g.closest('.race-item');
    try { g.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    goalDrag = { id: g.dataset.raceGrip, li: li, x0: e.clientX, y0: e.clientY, sy0: window.scrollY, x: e.clientX, y: e.clientY, over: false };
    li.classList.add('is-lifted');
    document.body.classList.add('goal-dragging');
    requestAnimationFrame(goalDragFrame);
  });
  // جای کارت = جابه‌جایی انگشت + اسکرول صفحه از شروع کشیدن (تا با اسکرول خودکار زیر انگشت بمونه)
  function goalDragUpdate() {
    var d = goalDrag, dy = d.y - d.y0 + (window.scrollY - d.sy0), dx = (d.x - d.x0) * 0.2;
    d.li.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    var hero = app.querySelector('.race-hero');
    if (!hero) return;
    var m = hero.getBoundingClientRect();
    d.over = d.y >= m.top - 10 && d.y <= m.bottom + 10;
    hero.classList.toggle('is-over', d.over);
  }
  // نزدیک لبه‌ی بالا یا پایین، صفحه خودش اسکرول می‌شه (کارت هدف اصلی بلنده و روی گوشی با فهرست هم‌زمان دیده نمی‌شه)
  function goalDragFrame() {
    if (!goalDrag) return;
    var edge = 110, y = goalDrag.y;
    if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 6));
    else if (y > window.innerHeight - edge) window.scrollBy(0, Math.ceil((y - window.innerHeight + edge) / 6));
    goalDragUpdate();
    requestAnimationFrame(goalDragFrame);
  }
  app.addEventListener('pointermove', function (e) {
    if (!goalDrag) return;
    goalDrag.x = e.clientX; goalDrag.y = e.clientY;
    goalDragUpdate();
  });
  function endGoalDrag() {
    if (!goalDrag) return;
    var d = goalDrag, hero = app.querySelector('.race-hero');
    goalDrag = null;
    document.body.classList.remove('goal-dragging');
    if (hero) hero.classList.remove('is-over');
    if (d.over) { d.li.style.transform = ''; makeMainGoal(d.id); return; }
    d.li.classList.add('snap'); d.li.style.transform = '';
    setTimeout(function () { d.li.classList.remove('snap', 'is-lifted'); }, 230);
  }
  app.addEventListener('pointerup', endGoalDrag);
  app.addEventListener('pointercancel', endGoalDrag);

  // =====================================================================
  // تحلیل فرم دویدن: MediaPipe Pose داخل گوشی (js/pose.js) → قواعد اختصاصی (js/gait.js) → گزارش
  // ویدیو فقط در حافظه‌ی همین صفحه می‌مونه؛ فقط عددها و دو تصویر کوچک ذخیره می‌شن.
  // =====================================================================
  var gaitFiles = { side: null, back: null }, gaitBusy = null, gaitError = null, GAIT_KEEP = 5;
  // شرایط دویدنِ هر فیلم (الزامی، جدا برای هر خونه)؛ با عوض شدن فیلم پاک می‌شه
  var gaitConds = { side: null, back: null };
  // یافته‌های هر نما (گزارش‌های قبل از v3 فیلد view نداشتن)
  var GAIT_BACK_IDS = ['pelvic', 'valgus', 'crossover', 'armCross', 'sides', 'trunkLat', 'armSym'];
  function gaitView(f) { return f.view || (GAIT_BACK_IDS.indexOf(f.id) >= 0 ? 'back' : 'side'); }
  // هر نما چه چیزهایی رو نمی‌تونه مطمئن بسنجه (به‌جای عدد، همین‌جا گفته می‌شه)
  var GAIT_NOT_FROM = { side: ['pelvic', 'valgus', 'crossover'], back: ['overstride', 'kneeIc', 'strike', 'elbow', 'head'] };
  // گزارش‌های نسخه‌ی قبل (بدون v): پرونیشن حذف، پارامترهای توصیفی بدون وضعیت، و الگوهای آسیب با قاعده‌ی تازه
  var GAIT_INFO = ['head', 'trunk', 'elbow', 'strike', 'vo', 'timing', 'sides', 'armCross', 'peakKnee', 'gct'];
  function gaitNormalize(r) {
    if (r.v >= 2 || !r.findings) return r;
    var F = r.findings.filter(function (f) { return f.id !== 'pronation'; }).map(function (f) {
      var g = Object.assign({}, f);
      if (GAIT_INFO.indexOf(g.id) >= 0) g.status = 'info';
      else if (g.id === 'cadence') g.status = g.status === 'good' ? 'info' : 'warn';
      return g;
    });
    var G = window.CoachGait, R = G ? G.risks(F) : [];
    return Object.assign({}, r, { findings: F, risks: R, axes: { risk: R.length ? R[0].level : null } });
  }
  function gaitConditions(r) { return r.conditions || { side: r.side ? r.condition || null : null, back: r.back ? r.condition || null : null }; }
  function gaitValue(f) {
    var I0 = 'gait.items.' + f.id + '.v', n = f.value;
    switch (f.id) {
      case 'head': return T(I0, { n: n, g: f.gaze, look: T('gait.look.' + f.look) });
      case 'overstride': return T(I0, { n: n, s: f.shank });
      case 'strike': return T(I0, { s: T('gait.strikeName.' + f.strike), n: n });
      case 'pelvic': case 'valgus': return T(I0, { l: f.left == null ? '—' : f.left, r: f.right == null ? '—' : f.right });
      case 'armCross': return T(I0, { n: Math.round(n * 100) });
      default: return T(I0, { n: n });
    }
  }
  // متن هر مورد: «در این ویدیو دیده می‌شه که…» + چرا ممکنه مهم باشه؛ بدون دستور و بدون تشخیص
  function gaitText(f) {
    var k = 'gait.items.' + f.id + '.';
    if (f.status === 'na') return { seen: T('gait.naText') };
    var seen;
    switch (f.id) {
      case 'cadence': seen = T(k + (f.status === 'warn' ? 'low' : 'seen'), { n: f.value, c: T('gait.cond.' + (f.cond || 'easy')), f: f.floor || 160 }); break;
      case 'kneeIc': seen = T(k + (f.status === 'good' ? 'good' : f.form === 'bent' ? 'bent' : 'straight')); break;
      case 'trunk': seen = T(k + (f.lean === 'forward' ? 'forward' : f.lean === 'back' ? 'back' : 'ok')); break;
      case 'strike': seen = T(k + 'seen', { s: T('gait.strikeName.' + f.strike) }); break;
      case 'head': seen = T(k + 'seen', { n: f.value, look: T('gait.look.' + f.look) }); break;
      case 'armCross': seen = T(k + 'seen', { n: Math.round(f.value * 100) }); break;
      case 'overstride': case 'pelvic': case 'valgus': case 'crossover': seen = T(k + (f.status === 'bad' && f.id === 'crossover' ? 'warn' : f.status)); break;
      default: seen = T(k + 'seen', { n: f.value });
    }
    return { seen: seen, why: T(k + 'why') };
  }
  function gaitItem(f) {
    var x = gaitText(f), na = f.status === 'na';
    return '<article class="gait-item gi-' + f.status + '"><div class="gi-head"><b>' + esc(T('gait.items.' + f.id + '.t')) + '</b>' +
      '<span class="gi-chip">' + esc(T('gait.status.' + f.status)) + '</span></div>' +
      (na ? '' : '<p class="gi-val">' + esc(fa(gaitValue(f))) + ' <span class="small muted">' + esc(T('gait.ref') + fa(T('gait.items.' + f.id + '.ref'))) + '</span></p>') +
      '<p class="gi-text">' + esc(fa(x.seen)) + '</p>' +
      (x.why ? '<p class="gi-why small"><b>' + esc(T('gait.whyLabel')) + '</b>' + esc(fa(x.why)) + '</p>' : '') +
      (f.conf && !na ? '<p class="gi-conf small muted">' + esc(T('gait.conf.label') + T('gait.conf.' + f.conf)) + '</p>' : '') + '</article>';
  }
  function gaitRisk(r) {
    return '<article class="gait-risk gr-' + r.level + '"><div class="gi-head"><b>' + esc(T('gait.injuries.' + r.id + '.t')) + '</b>' +
      '<span class="gi-chip">' + esc(T('gait.level.' + r.level)) + '</span></div>' +
      (r.level !== 'low' ? '<p class="small"><b>' + esc(T('gait.factorsLabel')) + '</b>' + esc(r.factors.map(function (k) { return T('gait.factorName.' + k); }).join(T('progress.sep'))) + '</p>' +
        '<p class="gi-text">' + esc(T('gait.injuries.' + r.id + '.why')) + '</p><p class="small muted">' + esc(T('gait.seeExpert')) + '</p>' : '<p class="small">' + esc(T('gait.noFactors')) + '</p>') +
      (r.checked < r.of ? '<p class="small muted">' + esc(fa(T('gait.partial', { a: r.checked, b: r.of }))) + '</p>' : '') + '</article>';
  }
  var GAIT_AXIS = { performance: ['cadence', 'overstride', 'gct', 'vo', 'trunk', 'armCross', 'timing'],
    form: ['pelvic', 'kneeIc', 'peakKnee', 'valgus', 'crossover', 'strike', 'head', 'elbow', 'sides', 'trunkLat', 'armSym'] };
  // حجم دویدن ۷ روز اخیر و میانگین هفتگی ۴ هفته‌ی قبلش (از جلسه‌های «انجام دادم»)؛ فقط با حداقل ۳ هفته سابقه
  function gaitLoad() {
    var keys = Object.keys(state.done || {}).filter(function (k) { return state.done[k]; }).sort();
    if (!keys.length) return null;
    var now = today(), first = C.parseDate(keys[0]);
    if ((now - first) / 864e5 < 21) return null;
    var km = function (from, to) {
      var s = 0;
      for (var d = from; d <= to; d++) {
        var k = C.dateKey(C.addDays(now, -d));
        if (!state.done[k]) continue;
        var log = C.doneSession((state.doneLog || {})[k] || {});
        if (['rest', 'none', 'cancelled'].indexOf(log.type) < 0) s += (log.actual && log.actual.km) || log.km || 0;
      }
      return s;
    };
    var acute = km(0, 6), chronic = km(7, 34) / 4;
    return chronic > 0 ? { acute: Math.round(acute * 10) / 10, chronic: Math.round(chronic * 10) / 10 } : null;
  }
  // ---------- نسخه‌ی تخصصی: عددهای خام، اطمینان، بازه‌ی مرجع و منبع ----------
  function gaitExpertHtml(r) {
    var X = 'gait.expert.', s = r.side, b = r.back, rows = [];
    var cf = function (m, k) { return m && m.conf && m.conf[k] ? T('gait.conf.' + m.conf[k]) : T(X + 'noData'); };
    var num = function (v, u) { return v == null ? T(X + 'noData') : fa(String(v)) + (u ? ' ' + u : ''); };
    var row = function (id, view, val, conf) {
      var P = T(X + 'p.' + id);
      rows.push('<tr><td><b>' + esc(P.n) + '</b><br><span class="muted" lang="en" dir="ltr">' + esc(P.en) + '</span></td><td>' + esc(T(X + 'views.' + view)) + '</td><td>' + esc(val) +
        '</td><td>' + esc(conf) + '</td><td>' + esc(fa(P.ref)) + '</td><td dir="auto">' + esc(P.src) + '</td><td>' + esc(T(X + 'ev.' + P.ev)) + '</td></tr>');
    };
    if (s) {
      var u = function (id) { return T(X + 'p.' + id + '.u'); };
      row('cadence', 'side', num(s.cadence, u('cadence')), cf(s, 'cadence'));
      row('gct', 'side', s.gctNear == null ? T(X + 'noData') : fa(s.gctNear + (s.gctFar != null ? ' / ' + s.gctFar : '')) + ' ' + u('gct'), cf(s, 'gct'));
      row('vo', 'side', num(s.vo, u('vo')), cf(s, 'vo'));
      row('overstride', 'side', num(s.overstride, u('overstride')), cf(s, 'overstride'));
      row('shank', 'side', num(s.shank, u('shank')), cf(s, 'overstride'));
      row('kneeIc', 'side', num(s.kneeIc, u('kneeIc')), cf(s, 'kneeIc'));
      row('peakKnee', 'side', num(s.peakKnee, u('peakKnee')), cf(s, 'peakKnee'));
      row('strike', 'side', s.fsa == null ? T(X + 'noData') : fa(s.fsa) + u('strike') + ' (' + T('gait.strikeName.' + s.strike) + ')', cf(s, 'strike'));
      row('trunk', 'side', num(s.trunk, u('trunk')), cf(s, 'trunk'));
      row('head', 'side', s.neck == null ? T(X + 'noData') : fa(s.neck + '° / ' + s.gaze + '°'), cf(s, 'head'));
      row('elbow', 'side', num(s.elbow, u('elbow')), cf(s, 'elbow'));
      row('timing', 'side', fa((s.stepSym == null ? '—' : s.stepSym) + ' / ' + (s.gctSym == null ? '—' : s.gctSym)) + ' %', cf(s, 'timing'));
    }
    if (b) {
      var lr = function (l, rr) { return fa(T(X + 'left') + ' ' + (l == null ? '—' : l) + '° · ' + T(X + 'right') + ' ' + (rr == null ? '—' : rr) + '°'); };
      row('pelvic', 'back', lr(b.pelvicL, b.pelvicR), cf(b, 'pelvic'));
      row('valgus', 'back', lr(b.valgusL, b.valgusR), cf(b, 'valgus'));
      row('crossover', 'back', num(b.crossover, '%'), cf(b, 'crossover'));
      if (b.cadence != null || (b.conf && b.conf.cadence)) row('cadence', 'back', num(b.cadence, T(X + 'p.cadence.u')), cf(b, 'cadence'));
      if (b.trunkLat != null) row('trunkLat', 'back', num(b.trunkLat, '°'), cf(b, 'trunkLat'));
      if (b.armSym != null) row('armSym', 'back', num(b.armSym, '%'), cf(b, 'armSym'));
      row('armCross', 'back', b.armCross == null ? T(X + 'noData') : fa(Math.round(b.armCross * 100)) + ' %', cf(b, 'armCross'));
      row('sides', 'back', fa((b.gctSym == null ? '—' : b.gctSym) + '% · ' + (b.pelvicSym == null ? '—' : b.pelvicSym) + '° · ' + (b.valgusSym == null ? '—' : b.valgusSym) + '°'), cf(b, 'sides'));
    }
    var cd = gaitConditions(r);
    var meta = [[T(X + 'date'), faDate(r.date)],
      [T(X + 'condition'), ['side', 'back'].filter(function (v) { return cd[v]; }).map(function (v) { return T(X + 'views.' + v) + ': ' + T('gait.cond.' + cd[v]); }).join(' · ') || T(X + 'noData')],
      [T(X + 'height'), state.profile && state.profile.heightCm ? fa(state.profile.heightCm + ' ' + T(X + 'cm')) : T(X + 'noData')]];
    [['side', r.qSide], ['back', r.qBack]].forEach(function (q) {
      if (!q[1]) return;
      var v = q[1];
      meta.push([T(X + 'video') + ' (' + T(X + 'views.' + q[0]) + ')', fa([T(X + 'fps') + ': ' + (v.fps || '—'), T(X + 'frames') + ': ' + v.frames,
        T(X + 'valid') + ': ' + Math.round((v.valid || 0) * 100) + '%', T(X + 'steps') + ': ' + (v.steps == null ? '—' : v.steps)].join(' · ') +
        (q[0] === 'side' && r.near ? ' · ' + T(X + 'near') + ': ' + T(X + (r.near === 'l' ? 'left' : 'right')) : ''))]);
    });
    return '<section class="card gait-expert" id="gait-expert"><details><summary><b>' + esc(T(X + 'title')) + '</b></summary>' +
      '<p class="small muted">' + esc(T(X + 'sub')) + '</p>' +
      '<button type="button" class="btn btn-outline gait-print" data-gait-print="1">' + esc(T(X + 'print')) + '</button>' +
      '<h3>' + esc(T('gait.report')) + ' · ' + esc(T(X + 'meta')) + '</h3><dl class="gx-meta">' +
      meta.map(function (m) { return '<dt>' + esc(m[0]) + '</dt><dd>' + esc(m[1]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="gx-table"><table><thead><tr>' + ['param', 'view', 'value', 'conf', 'ref', 'src', 'ev'].map(function (c) { return '<th>' + esc(T(X + 'cols.' + c)) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
      '<h3>' + esc(T(X + 'limitsTitle')) + '</h3><ul class="small">' + T(X + 'limits').map(function (x) { return '<li>' + esc(fa(x)) + '</li>'; }).join('') + '</ul>' +
      '<h3>' + esc(T(X + 'refsTitle')) + '</h3><p class="small muted">' + esc(T(X + 'refNote')) + '</p><ol class="small gx-refs" dir="ltr" lang="en">' +
      T(X + 'refs').map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
      '<p class="small">' + esc(T('gait.disclaimer')) + '</p></details></section>';
  }
  function gaitReportHtml(r, live) {
    r = gaitNormalize(r);
    var F = r.findings || [], R = r.risks || [], ax = r.axes || {};
    var J = F.filter(function (f) { return ['good', 'warn', 'bad'].indexOf(f.status) >= 0; });
    var pri = J.filter(function (f) { return f.status !== 'good'; }).slice(0, 3);
    var sect = function (key) { return F.filter(function (x) { return GAIT_AXIS[key].indexOf(x.id) >= 0; }); };
    var inRange = function (key) {
      var j = sect(key).filter(function (f) { return ['good', 'warn', 'bad'].indexOf(f.status) >= 0; });
      return j.length ? fa(T('gait.inRangeShort', { a: j.filter(function (f) { return f.status === 'good'; }).length, b: j.length })) : '—';
    };
    var img = function (src, cap) { return src ? '<figure class="gait-key"><img src="' + src + '" alt="' + esc(cap) + '"><figcaption>' + esc(cap) + '</figcaption></figure>' : ''; };
    var card = function (k, val, sub, cls, note) { return '<div class="gait-axis ' + (cls || '') + '"><span>' + esc(T('gait.axesCard.' + k)) + '</span><b>' + esc(val) + '</b>' + (note ? '<em>' + esc(note) + '</em>' : '') + '<small>' + esc(T('gait.axes.' + sub)) + '</small></div>'; };
    var html = '<section class="card gait-report" id="gait-report"><h2>' + esc(T('gait.report')) + '</h2><p class="small muted">' + esc(faDate(r.date)) + '</p>';
    // سه محور: سهم موارد در محدوده‌ی معمول (فقط پارامترهای دارای بازه‌ی مرجع) و الگوهای مرتبط با آسیب
    if (F.length) html += '<div class="gait-axes">' +
      card('performance', inRange('performance'), 'perfSub', '', T('gait.inRangeNote')) + card('form', inRange('form'), 'formSub', '', T('gait.inRangeNote')) +
      card('risk', ax.risk ? T('gait.levelShort.' + ax.risk) : '—', 'riskSub', ax.risk ? 'risk-' + ax.risk : '') + '</div>';
    if (pri.length) html += '<h3>' + esc(T('gait.priorities')) + '</h3><ol class="gait-pri">' + pri.map(function (f) {
      return '<li><b>' + esc(T('gait.items.' + f.id + '.t')) + '</b> <span class="muted small">' + esc(T('gait.' + gaitView(f) + 'Title')) + ' · ' + esc(T('gait.status.' + f.status)) + '</span></li>';
    }).join('') + '</ol>';
    else if (J.length) html += '<p>' + esc(T('gait.noIssues')) + '</p>';
    // فیلم‌هایی که تحلیل نشدن (گزارش‌های قدیمی: sideReason / backReason)
    var fails = (r.failed || []).slice();
    if (r.sideReason) fails.push({ src: 'side', reason: r.sideReason });
    if (r.backReason) fails.push({ src: 'back', reason: r.backReason });
    fails.forEach(function (x) { html += '<p class="alert alert-adapt">' + esc(T('gait.' + x.src)) + ': ' + esc(T('gait.reason.' + x.reason)) + '</p>'; });
    html += '<p class="small gait-edu">' + esc(T('gait.disclaimer')) + '</p></section>';
    // دو بخش جدا: تحلیل نمای کنار و تحلیل نمای پشت؛ هر کدوم ویدیوی خودش (در همین نشست) یا تصویر کلیدی، و زیرش
    // فقط یافته‌هایی که از همون نما اندازه‌گیری شدن
    var conds = gaitConditions(r);
    ['side', 'back'].forEach(function (view) {
      var items = F.filter(function (f) { return gaitView(f) === view; });
      var res = view === 'side' ? r.side : r.back;
      if (!res && !items.length) return;
      var slot = live && live.inputs ? Object.keys(live.inputs).filter(function (k) { var L = live.inputs[k]; return L.res && L.res.view === view; })[0] : null;
      var c = conds[view];
      html += '<section class="card gait-view" id="gait-view-' + view + '"><div class="gv-head"><h2>' + esc(T('gait.view.' + view)) + '</h2>' +
        (c ? '<span class="gv-tag">' + esc(T('gait.cond.' + c)) + '</span>' : '') + '</div>';
      if (slot) {
        html += '<figure class="gait-player"><div class="gp-stage" id="gp-' + slot + '"></div>' +
          '<p class="gp-err small" id="gp-err-' + slot + '" hidden></p>' +
          '<div class="gp-ctrl"><label class="gp-ov"><input type="checkbox" data-gp-ov="' + slot + '" checked> ' + esc(T('gait.anim.overlay')) + '</label>' +
          '<button type="button" class="btn btn-outline" data-gp="' + slot + '" data-act="rate">' + esc(fa(T('gait.anim.speed', { r: 1 }))) + '</button>' +
          '<span class="gp-steps"><button type="button" class="btn btn-ghost gp-step" data-gp="' + slot + '" data-act="prev" aria-label="' + esc(T('gait.anim.prev')) + '">' + chevron(isRtl() ? 'right' : 'left') + '</button>' +
          '<button type="button" class="btn btn-ghost gp-step" data-gp="' + slot + '" data-act="next" aria-label="' + esc(T('gait.anim.next')) + '">' + chevron(isRtl() ? 'left' : 'right') + '</button></span>' +
          '<button type="button" class="btn btn-outline" data-gp="' + slot + '" data-act="save">' + esc(T('gait.anim.save')) + '</button></div>' +
          '<figcaption class="small muted">' + esc(T('gait.anim.hint')) + '</figcaption></figure>';
      } else if (view === 'side' ? r.imgSide : r.imgBack) {
        html += img(view === 'side' ? r.imgSide : r.imgBack, T(view === 'side' ? 'gait.keySide' : 'gait.keyBack')) + '<p class="small muted">' + esc(T('gait.anim.sessionOnly')) + '</p>';
      }
      // موارد دارای بازه‌ی مرجع و غیرقابل‌اطمینان باز؛ موارد فقط توصیفی در یک بخش بازشونده (صفحه کوتاه‌تر، یافته‌های مهم جلوتر)
      var shown = items.filter(function (f) { return f.status !== 'info'; }), more = items.filter(function (f) { return f.status === 'info'; });
      if (items.length) html += '<h3>' + esc(T('gait.view.measured')) + '</h3>' + (shown.length ? '<div class="gait-items">' + shown.map(gaitItem).join('') + '</div>' : '') +
        (more.length ? '<details class="gv-more"' + (shown.length ? '' : ' open') + '><summary>' + esc(fa(T('gait.view.more', { n: more.length }))) + '</summary><div class="gait-items">' + more.map(gaitItem).join('') + '</div></details>' : '');
      html += '<p class="small muted gv-not">' + esc(T('gait.view.notFrom', { list: GAIT_NOT_FROM[view].map(function (k) { return T('gait.items.' + k + '.t'); }).join(T('progress.sep')), other: T('gait.view.' + (view === 'side' ? 'back' : 'side')) })) + '</p></section>';
    });
    if (R.length || r.load) {
      var ld = r.load ? '<p class="small gait-load">' + esc(fa(T(r.load.high ? 'gait.load.high' : 'gait.load.ok', { a: r.load.acute, c: r.load.chronic, r: r.load.ratio }))) + '</p>' : '';
      html += '<section class="card"><h2>' + esc(T('gait.axes.risk')) + '</h2><p class="small muted">' + esc(T('gait.riskIntro')) + '</p>' + ld + '<div class="gait-items">' + R.map(gaitRisk).join('') + '</div></section>';
    }
    html += '<section class="card"><p class="small">' + esc(T('gait.disclaimer')) + '</p><details class="gait-methods"><summary>' + esc(T('gait.methodsTitle')) + '</summary><p class="small muted">' + esc(fa(T('gait.methods'))) + '</p></details></section>';
    if (r.side || r.back) html += gaitExpertHtml(r);
    return html;
  }
  function gaitSlot(kind) {
    var f = gaitFiles[kind];
    return '<div class="gait-slot' + (f ? ' has-file' : '') + '"><div><b>' + esc(T('gait.' + kind)) + '</b><span class="small muted">' + esc(T('gait.' + kind + 'Hint')) + '</span>' +
      (f ? '<span class="small gait-file">' + esc(f.name) + '</span>' : '') + '</div>' +
      '<label class="btn btn-outline gait-pick">' + esc(T(f ? 'gait.change' : 'gait.pick')) + '<input type="file" accept="video/*" class="sr-only" data-gait-file="' + kind + '"></label>' +
      // شرایط دویدن همین فیلم (الزامی وقتی فیلم انتخاب شده)
      (f ? '<div class="gait-cond"><p class="sub-legend" id="gc-' + kind + '">' + esc(T('gait.cond.label')) + ' <span class="req">*</span></p><div class="chips" role="radiogroup" aria-labelledby="gc-' + kind + '">' +
        ['easy', 'tempo', 'interval', 'race'].map(function (k) { return '<label class="chip"><input type="radio" name="gaitCond-' + kind + '" data-gait-cond="' + kind + '" value="' + k + '"' + (gaitConds[kind] === k ? ' checked' : '') + ' required><span>' + esc(T('gait.cond.' + k)) + '</span></label>'; }).join('') + '</div></div>' : '') + '</div>';
  }
  // تحلیل فقط وقتی هر فیلم انتخاب‌شده برچسب شرایط دویدن داره
  function gaitReady() {
    var ks = ['side', 'back'].filter(function (k) { return gaitFiles[k]; });
    return ks.length > 0 && ks.every(function (k) { return gaitConds[k]; });
  }
  function gaitRunNote() {
    if (!gaitFiles.side && !gaitFiles.back) return T('gait.needSide');
    return gaitReady() ? T('gait.firstLoad') : T('gait.cond.need');
  }
  function renderGait() {
    destroyGaitPlayers();
    var reports = state.gaitReports || [];
    var el = pfPanel();
    if (!el) return;
    var html = '<p class="page-intro">' + esc(T('gait.intro')) + '</p>';
    if (gaitBusy) {
      html += '<section class="card gait-busy" aria-live="polite"><p id="gait-stage">' + esc(fa(gaitBusy.text)) + '</p>' +
        '<div class="gait-bar"><i id="gait-bar" style="width:' + Math.round(gaitBusy.p * 100) + '%"></i></div><p class="small muted">' + esc(T('gait.busyHint')) + '</p></section>';
      el.innerHTML = html;
      return;
    }
    html += '<section class="card"><details class="gait-how"' + (reports.length ? '' : ' open') + '><summary>' + esc(T('gait.howTitle')) + '</summary><ul>' +
      T('gait.how').map(function (x) { return '<li>' + esc(fa(x)) + '</li>'; }).join('') + '</ul></details>' +
      '<p class="small gait-one">' + esc(T('gait.oneEnough')) + '</p>' + gaitSlot('side') + gaitSlot('back') +
      ((gaitFiles.side || gaitFiles.back) ? '<p class="small muted">' + esc(T('gait.cond.hint')) + '</p>' : '') +
      (gaitError ? '<p class="form-errors">' + esc(gaitError) + '</p>' : '') +
      '<button type="button" class="btn btn-primary btn-block" data-gait-run="1"' + (gaitReady() ? '' : ' disabled') + '>' + esc(T('gait.analyze')) + '</button>' +
      '<p class="small muted" id="gait-run-note">' + esc(gaitRunNote()) + '</p></section>';
    if (reports.length) {
      html += gaitReportHtml(reports[0], gaitLive && gaitLive.id === reports[0].id ? gaitLive : null);
      if (reports.length > 1) html += '<section class="card"><h2>' + esc(T('gait.history')) + '</h2><ul class="gait-hist">' + reports.slice(1).map(function (r) {
        return '<li><span>' + esc(faDate(r.date)) + '</span><b>' + esc(fa(r.v >= 2 ? T('gait.histRow', { s: r.score == null ? '—' : r.score }) : T('gait.histRowOld'))) + '</b>' +
          '<button type="button" class="linklike small" data-gait-del="' + esc(r.id) + '">' + esc(T('gait.remove')) + '</button></li>';
      }).join('') + '</ul></section>';
    }
    el.innerHTML = html;
    initGaitPlayers();
  }
  // پخش‌کننده‌ها: فقط وقتی صفحه‌ی تحلیل بازه، از روی فایل‌های همین نشست ساخته می‌شن و با ترک صفحه کامل از بین می‌رن
  // (ویدیو، حلقه‌ی رسم و بوم)، تا حافظه‌ی گوشی برای بقیه‌ی صفحه‌ها آزاد بمونه.
  var gaitLive = null, gaitPlayers = {}, gaitGen = 0;
  function destroyGaitPlayers() {
    gaitGen++;
    Object.keys(gaitPlayers).forEach(function (k) { var x = gaitPlayers[k]; if (x.pl) x.pl.destroy(); });
    gaitPlayers = {};
  }
  function initGaitPlayers() {
    destroyGaitPlayers();
    if (!gaitLive) return;
    var rep = (state.gaitReports || [])[0];
    if (!rep || rep.id !== gaitLive.id) return;
    var labels = { strike: T('gait.anim.strike'), pelvis: T('gait.anim.pelvis') };
    Object.keys(gaitLive.inputs).forEach(function (k) {
      var L = gaitLive.inputs[k], stage = document.getElementById('gp-' + k);
      if (!L || !stage || !L.res) return;
      var res = L.res, st = {};
      // رنگ قرمز فقط برای یافته‌های بیرون از محدوده‌ی همین نما
      (rep.findings || []).forEach(function (f) { if (gaitView(f) === res.view) st[f.id] = f.status; });
      var bad = function (id) { return st[id] === 'warn' || st[id] === 'bad'; };
      var o = { labels: labels, digits: fa, bad: [], startAt: res.keyT,
        onError: function (code) { var e = document.getElementById('gp-err-' + k); if (e) { e.textContent = T('gait.anim.err.' + code); e.hidden = false; } } };
      if (res.view === 'side') {
        var n = res.near === 'l' ? 0 : 1, hip = 23 + n, knee = 25 + n, ank = 27 + n, sh = 11 + n, el = 13 + n, wr = 15 + n;
        if (bad('kneeIc') || bad('overstride')) o.bad.push(knee, ank);
        o.angles = [{ k: [hip, knee, ank], label: T('gait.anim.knee'), flex: true, bad: bad('kneeIc') }, { k: [sh, el, wr], label: T('gait.anim.elbow') }];
        o.strikes = (res.ic || []).map(function (i) { return L.data.frames[i] && L.data.frames[i].t; }).filter(function (t) { return t != null; });
      } else {
        o.back = true; o.pelvisBad = bad('pelvic');
        if (bad('pelvic')) o.bad.push(23, 24);
        if (bad('valgus')) o.bad.push(25, 26);
      }
      gaitPlayers[k] = { pl: window.CoachPose.player(stage, L.file, L.data, o) };
    });
  }
  function gaitShown() { var el = pfPanel(); return !!el && el.dataset.tab === 'gait'; }
  function releaseGaitLive() {
    destroyGaitPlayers();
    gaitLive = null;
  }
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-gp]');
    if (!b) return;
    var pl = gaitPlayers[b.dataset.gp] && gaitPlayers[b.dataset.gp].pl, act = b.dataset.act;
    if (!pl) return;
    if (act === 'rate') { var r = pl.rate() === 1 ? 0.5 : pl.rate() === 0.5 ? 0.25 : 1; pl.setRate(r); b.textContent = fa(T('gait.anim.speed', { r: r })); }
    else if (act === 'prev' || act === 'next') pl.step(act === 'next' ? 1 : -1);
    else if (act === 'save') {
      var label = b.textContent; b.disabled = true; b.textContent = T('gait.anim.saving');
      pl.record().then(function (blob) {
        var ext = /mp4/.test(blob.type) ? 'mp4' : 'webm', name = 'running-form-' + b.dataset.gp + '.' + ext;
        var file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : null;
        // گوشی: منوی اشتراک (ذخیره در گالری)؛ وگرنه دانلود
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file] }).catch(function () {});
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      }).catch(function () { showToast(T('gait.anim.noRecord')); }).then(function () { b.disabled = false; b.textContent = label; });
    }
  });
  function gaitProgress(text, p) {
    gaitBusy = { text: text, p: p };
    var st = document.getElementById('gait-stage'), bar = document.getElementById('gait-bar');
    if (st && bar) { st.textContent = fa(text); bar.style.width = Math.round(p * 100) + '%'; } else if (gaitShown()) renderGait();
  }
  function runGait() {
    var slots = ['side', 'back'].filter(function (k) { return gaitFiles[k]; });
    if (gaitBusy || !slots.length || !gaitReady()) return;
    gaitError = null;
    releaseGaitLive();
    var files = { side: gaitFiles.side, back: gaitFiles.back }, data = {}, failed = false, result = null;
    var pct = function (x) { return Math.round(x * 100); };
    gaitProgress(T('gait.stage.load'), 0.02);
    // فیلم‌ها یکی‌یکی؛ هر کدوم که هست (یکی کافیه)
    var chain = window.CoachPose.load().catch(function () { failed = true; throw new Error('load'); });
    slots.forEach(function (k, i) {
      chain = chain.then(function () {
        var span = 0.88 / slots.length, base = 0.05 + i * span;
        return window.CoachPose.processVideo(files[k], function (x) { gaitProgress(T('gait.stage.' + k, { p: pct(x) }), base + x * span); });
      }).then(function (d) { data[k] = d; });
    });
    chain.then(function () {
      gaitProgress(T('gait.stage.report'), 0.95);
      var r = window.CoachGait.analyze({ side: data.side, back: data.back, heightCm: state.profile.heightCm, conditions: { side: gaitConds.side, back: gaitConds.back }, load: gaitLoad() });
      result = r;
      // v: ۲ = گزارش با سطح اطمینان، شرایط دویدن و قاعده‌ی تازه‌ی الگوهای آسیب
      // v: ۳ = هر یافته مال یک نما، شرایط دویدن جدا برای هر فیلم
      var rep = { id: 'g' + Date.now().toString(36), v: 3, date: C.dateKey(today()), at: new Date().toISOString(), score: r.score,
        findings: r.findings, risks: r.risks, axes: r.axes, side: r.side ? r.side.metrics : null, back: r.back ? r.back.metrics : null,
        failed: r.failed, condition: r.condition, conditions: r.conditions, load: r.load, near: r.side ? r.side.near : null,
        qSide: r.side ? r.side.quality : null, qBack: r.back ? r.back.quality : null };
      // تصویر فریم کلیدی از ویدیوی خود هر زاویه (هر خونه‌ای که کاربر گذاشته)
      var shots = [];
      if (r.side) {
        var ds = data[r.side.src], nk = r.side.near === 'l' ? 25 : 26, fr = ds.frames[r.side.keyFrame];
        shots.push(window.CoachPose.keyImage(ds.video, fr ? fr.t : r.side.keyT, fr && fr.lm, { focus: [nk - 2, nk, nk + 2], label: fa(T('gait.kneeLabel', { n: Math.round(r.side.metrics.kneeIc) })), labelAt: nk })
          .then(function (u) { rep.imgSide = u; }));
      }
      if (r.back) {
        var db = data[r.back.src], fb = db.frames[r.back.keyFrame];
        shots.push(window.CoachPose.keyImage(db.video, fb ? fb.t : r.back.keyT, fb && fb.lm, { focus: [23, 24, 25, 26] }).then(function (u) { rep.imgBack = u; }));
      }
      return Promise.all(shots).catch(function () { /* بدون تصویر هم گزارش کامله */ }).then(function () { return rep; });
    }).then(function (rep) {
      // فقط آخرین گزارش‌ها؛ تصویرها فقط برای آخرین گزارش نگه داشته می‌شن (حجم حافظه)
      state.gaitReports = [rep].concat((state.gaitReports || []).map(function (x) { var y = Object.assign({}, x); delete y.imgSide; delete y.imgBack; return y; })).slice(0, GAIT_KEEP);
      save();
      gaitFiles = { side: null, back: null }; gaitConds = { side: null, back: null };
      // برای پخش انیمیشنی فقط فایل‌ها و نقاط نگه داشته می‌شن (نه ویدیوی باز)؛ پخش‌کننده فقط وقتی این صفحه بازه ساخته می‌شه
      var live = { id: rep.id, inputs: {} };
      slots.forEach(function (k) {
        if (!data[k]) return;
        var res = [result.side, result.back].filter(function (x) { return x && x.src === k; })[0] || null;
        var fail = (result.failed || []).filter(function (x) { return x.src === k; })[0];
        live.inputs[k] = { file: files[k], data: { frames: data[k].frames, duration: data[k].duration, w: data[k].w, h: data[k].h }, res: res, reason: fail ? fail.reason : null };
      });
      gaitLive = live;
      showToast(T('gait.saved'));
    }).catch(function (e) {
      // کد کوتاه مرحله‌ی خطا (open / meta / seek / detect / short) برای پیدا کردن علت روی گوشی‌های مختلف
      gaitError = T(failed ? 'gait.err.load' : 'gait.err.video') + (e && e.code ? ' [' + e.code + ']' : '');
      if (window.console) console.warn('gait', e);
    }).then(function () {
      // همه‌چیز آزاد: ویدیوهای پردازش و خود تحلیلگر (گرافیک و حافظه)
      Object.keys(data).forEach(function (k) { if (data[k] && data[k].video) { window.CoachPose.release(data[k].video); data[k].video = null; } });
      window.CoachPose.unload();
      gaitBusy = null;
      if (gaitShown()) renderGait();
    });
  }
  app.addEventListener('change', function (e) {
    var ck = e.target.dataset && e.target.dataset.gaitCond;
    if (ck) {
      gaitConds[ck] = e.target.value;
      var run = app.querySelector('[data-gait-run]'), note = document.getElementById('gait-run-note');
      if (run) run.disabled = !gaitReady();
      if (note) note.textContent = gaitRunNote();
      return;
    }
    var ov = e.target.dataset && e.target.dataset.gpOv;
    if (ov) { var P0 = gaitPlayers[ov]; if (P0 && P0.pl) P0.pl.setOverlay(e.target.checked); return; }
    var k = e.target.dataset && e.target.dataset.gaitFile;
    if (!k) return;
    gaitFiles[k] = e.target.files && e.target.files[0] || null;
    gaitConds[k] = null;
    gaitError = null;
    renderGait();
  });
  app.addEventListener('click', function (e) {
    if (e.target.closest('[data-gait-run]')) { runGait(); return; }
    if (e.target.closest('[data-gait-print]')) {
      // فقط نسخه‌ی تخصصی چاپ می‌شه (با رنگ‌های روشن؛ css/theme.css)
      var ex = document.getElementById('gait-expert'), dt = ex && ex.querySelector('details');
      if (dt) dt.open = true;
      document.body.classList.add('print-gait');
      var done = function () { document.body.classList.remove('print-gait'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(done, 1000);
      return;
    }
    var d = e.target.closest('[data-gait-del]');
    if (d) { state.gaitReports = (state.gaitReports || []).filter(function (r) { return r.id !== d.dataset.gaitDel; }); save(); renderGait(); }
  });

  // =====================================================================
  // خانه / امروز: کارت‌های جمع‌وجور به ترتیب اولویت
  // =====================================================================
  function greetKey() {
    var h = new Date().getHours();
    return h < 12 ? 'home.greet.morning' : h < 17 ? 'home.greet.day' : 'home.greet.evening';
  }
  // سه چک‌این آخر در ۴ روز گذشته (همون منطق تطبیق)
  function recentCheckins(key) {
    var d = C.parseDate(key), out = [];
    for (var i = 1; i <= 4 && out.length < 3; i++) { var c = state.checkins[C.dateKey(C.addDays(d, -i))]; if (c) out.push(c); }
    return out;
  }
  function renderHome() {
    var p = state.profile, now = today(), key = C.dateKey(now);
    var base = C.sessionFor(p, now), ci = state.checkins[key];
    var r = ci ? effectiveSession(base) : withCycle({ session: base, adaptation: null });
    var html = '<header class="home-head"><p class="eyebrow">' + esc(T('home.date', { day: base.dayName, date: faDate(key) })) + '</p>' +
      '<h1>' + esc(T(greetKey())) + '</h1></header>' +
      '<div data-install-slot="home">' + installBanner() + '</div>' +
      homeToday(base, r.session, ci, key) + homeChecklist(now) + (walker() ? homeSteps(key) + walkLevelCard(now) + walkRunBridge() + homeWalkTiles() : homeGoalTiles()) + homeReadiness(ci, key, now) + homeSmart(r, key) + fitnessNotesCard(p, now) +
      homeCycle(r, key, now) + homeProgress(now) + (walker() ? homeWalkPath(now) : homePath(now) + linkCard('#plans', T('plans.title'), T('plans.linkSub')));
    app.innerHTML = '<div class="home">' + html + '</div>';
  }
  // کارت اصلی بالای خانه: «تمرین امروز» و زیرش «چک‌این امروز»
  function homeToday(base, s, ci, key) {
    var runDay = ['rest', 'none'].indexOf(base.type) < 0, done = !!state.done[key], cancelled = s.type === 'cancelled';
    var main = cancelled ? T('home.cancelled') : (s.steps && s.steps[0]) || '';
    var wu = !cancelled && s.warmup && s.warmup.min ? T('home.withWarmup', { n: s.warmup.min }) : '';
    var btn = runDay || cancelled
      ? '<a class="btn btn-outline btn-block" href="#plan" data-goto-today="1">' + esc(T(runDay && !cancelled ? 'home.sessionDetails' : 'home.details')) + '</a>'
      : '<a class="btn btn-outline btn-block" href="#plan" data-goto-today="1">' + esc(T('home.weekPlan')) + '</a>';
    var session = '<div class="ht-sec">' +
      '<div class="hcard-top"><span class="hcard-label">' + esc(T('home.todayTitle')) + '</span>' +
      (done ? '<span class="pill pill-done">✓ ' + esc(T('home.done')) + '</span>' : (s.original ? '<span class="pill pill-adapt">' + esc(T('home.adjusted')) + '</span>' : '')) + '</div>' +
      '<div class="today-main">' + badge(s.type, s.label) + (s.km ? '<b class="today-target">' + t(s.target) + '</b>' : (s.minutes ? '<b class="today-target">' + tt('home.minutes', { n: s.minutes }) + '</b>' : '')) + '</div>' +
      (main ? '<p class="today-sum">' + t(main) + (wu ? ' <span class="muted">' + t(wu) + '</span>' : '') + '</p>' : '') +
      (base.type === 'none' && state.profile.startDate > key ? '<p class="today-sum">' + esc(T('home.startsOn', { d: faDate(state.profile.startDate) })) + '</p>' : '') +
      btn + '</div>';
    return '<section class="card hcard hcard-today hc-' + s.type + '">' + session + homeCheckinSec(base, ci, key, runDay, done) + '</section>';
  }
  function homeCheckinSec(base, ci, key, runDay, done) {
    var head = function (pill) {
      return '<div class="hcard-top"><span class="hcard-label">' + esc(T('home.ci.title')) + '</span>' + (pill || '') + '</div>';
    };
    var body;
    if (ci) {
      var rd = ci.pain ? null : C.readiness(ci, recentCheckins(key));
      var st = ci.pain ? 'pain' : !rd.tier ? 'fresh' : rd.tier === 'mild' ? 'ok' : rd.tier === 'moderate' ? 'tired' : 'recover';
      body = head('<span class="pill pill-done">✓ ' + esc(T('home.ci.done')) + '</span>') +
        '<div class="ready-row ready-' + st + '"><span class="ready-dot" aria-hidden="true"></span><b class="ready-line">' + esc(T('home.ready.' + st)) + '</b></div>' +
        (ci.pain ? '' : '<a class="linklike small ht-link" href="#checkin">' + esc(T('home.ci.edit')) + '</a>');
    } else if (runDay && !done) {
      body = head() + '<p class="small muted ht-note">' + esc(T('home.ci.todo')) + '</p>' +
        (prevCheckin(key) && prevCheckin(key).pain ? painYesterdayBox() : '') +
        '<a class="btn btn-primary btn-big btn-block" href="#checkin">' + esc(T('home.startCheckin')) + '</a>';
    } else {
      body = head() + '<p class="small muted ht-note">' + esc(T(done ? 'home.ci.afterRun' : 'home.ci.rest')) + '</p>' +
        '<a class="linklike small ht-link" href="#checkin">' + esc(T('home.ci.optional')) + '</a>';
    }
    return '<div class="ht-sec ht-checkin">' + body + '</div>';
  }
  // وضعیت آمادگی: بدترِ دو نشانه (TSB از بار تمرینی، و چک‌این امروز با تاریخچه)
  var READY = { fresh: 0, ok: 1, tired: 2, recover: 3, pain: 4 };
  function homeReadiness(ci, key, now) {
    var a = C.analytics(state, now, 56);
    var pm = a && a.pmc.length >= 14 && a.runsDone >= 3 ? a.pmc[a.pmc.length - 1] : null;
    var st = null, why = [];
    if (pm) {
      var rel = pm.ctl ? pm.tsb / pm.ctl : 0;
      st = rel > 0.05 ? 'fresh' : rel > -0.1 ? 'ok' : rel > -0.3 ? 'tired' : 'recover';
    }
    if (ci) {
      var rd = ci.pain ? null : C.readiness(ci, recentCheckins(key));
      var cs = ci.pain ? 'pain' : !rd.tier ? 'fresh' : rd.tier === 'mild' ? 'ok' : rd.tier === 'moderate' ? 'tired' : 'recover';
      if (!st || READY[cs] > READY[st]) { st = cs; why.push(T('home.ready.fromCheckin')); }
    }
    if (!st) {
      return '<section class="card hcard"><div class="hcard-top"><span class="hcard-label">' + esc(T('home.ready.title')) + '</span></div>' +
        '<p class="muted">' + esc(T('home.ready.noData')) + '</p></section>';
    }
    var sign = function (n) { n = Math.round(n); return '‎' + (n > 0 ? '+' : n < 0 ? '−' : '') + fa(Math.abs(n)); };
    return '<section class="card hcard hcard-ready ready-' + st + '"><div class="hcard-top"><span class="hcard-label">' + esc(T('home.ready.title')) + '</span>' +
      '<a class="hcard-link" href="#progress">' + esc(T('home.more')) + '</a></div>' +
      '<div class="ready-row"><span class="ready-dot" aria-hidden="true"></span><div><b class="ready-line">' + esc(T('home.ready.' + st)) + '</b>' +
      (why.length ? '<span class="small muted">' + esc(why.join(' ')) + '</span>' : '') + '</div></div>' +
      (pm ? '<div class="mini-stats">' +
        '<div><span>' + esc(T('progress.pmc.tsb')) + '</span><b>' + sign(pm.tsb) + '</b></div>' +
        '<div><span>' + esc(T('progress.pmc.ctl')) + '</span><b>' + fa(Math.round(pm.ctl)) + '</b></div>' +
        '<div><span>' + esc(T('progress.pmc.atl')) + '</span><b>' + fa(Math.round(pm.atl)) + '</b></div></div>' : '') +
      '</section>';
  }
  // پیام هوشمند: تطبیق امروز (با دلیلش)، درد، یا افزودنی اختیاری
  function homeSmart(r, key) {
    var s = r.session, inner = '';
    if (r.adaptation) inner = adaptationBox(r.adaptation, key, true);
    else if (s.makeup) inner = '<div class="makeup-box"><strong>' + esc(T('adapt.makeupBox.title')) + '</strong><p>' + t(s.makeup.text) + '</p></div>';
    if (!inner) return '';
    return '<section class="card hcard hcard-smart"><div class="hcard-top"><span class="hcard-label">' + esc(T('home.smartTitle')) + '</span></div>' + inner + '</section>';
  }
  // چرخه: فقط وقتی فعاله و مرتبطه (روزهای پریود، نزدیک پریود بعدی، یا پیشنهاد برای جلسه‌ی امروز)
  function homeCycle(r, key, now) {
    var np = C.nextPeriod(state.profile, now);
    if (!np) return '';
    var box = cycleBox(r, key, key);
    if (!(np.inPeriod || np.daysTo <= 5 || box)) return '';
    return cycleCard(now, box);
  }
  function homeProgress(now) {
    var a = C.analytics(state, now, 28), body;
    var W = a ? a.weeks : [];
    var cur = W[W.length - 1], prev = W.length > 1 ? W[W.length - 2] : null;
    var everDone = Object.keys(state.done).length > 0;
    if (!everDone) body = '<p class="muted">' + esc(T('home.prog.none')) + '</p>';
    else {
      // رکورد/تایم‌تست تازه با VDOT بهتر از قبلی
      var E = C.fitnessEntries(state.profile), hl = '';
      if (E.length >= 2) {
        var l = E[E.length - 1], pv = E[E.length - 2];
        var vl = C.vdotFromRace(l.distanceKm, l.timeSec), vp = C.vdotFromRace(pv.distanceKm, pv.timeSec);
        if (C.daysBetween(C.parseDate(l.date), now) <= 21 && vl > vp + 0.05) hl = tt('home.prog.vdot', { a: vp.toFixed(1), b: vl.toFixed(1) });
      }
      // اول هفته (هنوز جلسه‌ای نیست): آمار هفته‌ی قبل
      var lastWeek = (!cur || !cur.runs) && prev;
      var w = lastWeek ? prev : cur;
      body = (lastWeek ? '<p class="small muted prog-note">' + esc(T('home.prog.lastWeek')) + '</p>' : '') +
        '<div class="prog-hero"><b>' + tt('home.prog.km', { n: w ? Math.round(w.km * 10) / 10 : 0 }) + '</b>' +
        '<span class="muted">' + tt('home.prog.runs', { n: w ? w.runs : 0 }) + (!lastWeek && prev ? T('progress.sep') + tt('home.prog.prev', { n: Math.round(prev.km * 10) / 10 }) : '') + '</span></div>' +
        (hl ? '<p class="prog-hl">' + hl + '</p>' : '');
    }
    return '<section class="card hcard"><div class="hcard-top"><span class="hcard-label">' + esc(T('home.prog.title')) + '</span>' +
      '<a class="hcard-link" href="#progress">' + esc(T('home.more')) + '</a></div>' + body + '</section>';
  }
  // ---------- مسیر تو: سطح فعلی → هدف اصلی، با تخمین زمان باقی‌مونده (C.goalPath) ----------
  function pathBar(gp) {
    var pct = Math.round(Math.max(0.03, Math.min(1, gp.frac)) * 100);
    return '<div class="path-line" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(T('path.aria')) + '">' +
      '<i style="width:' + pct + '%"></i><b style="inset-inline-start:' + pct + '%"></b></div>';
  }
  function pathEta(gp) {
    if (gp.status === 'ready') return T('path.ready');
    return gp.goal.date ? T('path.eta', { a: gp.weeks, b: gp.weeksHi }) : T('path.etaMonth', { m: I.monthTitle(C.parseDate(gp.readyDate)) });
  }
  function homePath(now) {
    var p = state.profile, gp = C.goalPath(p, now);
    if (gp.none) return linkCard('#plans', T('path.none'), T('path.noneSub'));
    if (gp.past) return '';
    var lines = [gp.notStarted ? T('path.notStarted', { d: faDate(p.startDate) }) : T('path.week', { a: gp.elapsed + 1, b: gp.total })];
    if (gp.daysLeft != null) lines.push(gp.daysLeft === 0 ? T('home.race.today') : T('path.race', { n: gp.daysLeft, d: faDate(gp.goal.date) }));
    lines.push(pathEta(gp));
    var tight = gp.status === 'tight';
    return '<a class="card hcard path-card" href="' + (tight ? '#plans' : '#race') + '"><div class="hcard-top"><span class="hcard-label">' + esc(T('path.title')) + '</span>' +
      '<span class="hcard-link">' + esc(T(tight ? 'path.seePlans' : 'path.more')) + '</span></div>' +
      '<div class="path-ends"><span class="path-now"><span class="path-hex" aria-hidden="true">' + fa(gp.level) + '</span><span><small>' + esc(T('path.now')) + '</small><b>' + tt('path.level', { n: gp.level }) + '</b></span></span>' +
      '<span class="path-goal"><small>' + esc(T('path.goal')) + '</small><b>' + t(C.goalLabel(gp.goal)) + '</b>' +
      (gp.goal.targetSec ? '<small dir="ltr">' + fa(C.formatDuration(gp.goal.targetSec)) + '</small>' : '') + '</span></div>' +
      pathBar(gp) + '<div class="path-meta">' + lines.map(function (l) { return '<span>' + t(l) + '</span>'; }).join('') + '</div>' +
      (gp.status ? '<span class="path-pill">' + esc(T('path.st.' + gp.status)) + '</span>' : '') + '</a>';
  }

  // ---------- کاشی‌های تیره‌ی هدف: هر مسافت → برنامه‌ی پیشنهادی همون مسافت ----------
  function walker() { return C.isWalk(state.profile); }
  function homeGoalTiles() {
    var p = state.profile, g = C.goalInfo(p);
    return '<p class="group-label" role="heading" aria-level="2">' + esc(T(g.type === 'none' ? 'goalTiles.title' : 'goalTiles.titleNext')) + '</p><div class="goal-tiles">' + PLAN_KEYS.map(function (k) {
      var s = C.planSuggestion(p, k), km = C.RACE_DISTANCES[k], main = g.type === k;
      return '<a class="goal-tile' + (main ? ' is-main' : '') + '" href="#plans" data-plan-focus="' + k + '">' +
        (main ? '<span class="gt-badge">' + esc(T('goalTiles.main')) + '</span>' : '') +
        '<span class="gt-km">' + fa(dKm(Math.round(km * 10) / 10)) + '</span>' +
        '<span class="gt-name">' + esc(T('goalTiles.names.' + k)) + '</span>' +
        '<span class="gt-eta">' + t(T('goalTiles.eta', { w: weeksText(s.weeks, s.weeksHi) })) + '</span></a>';
    }).join('') + '</div>';
  }
  var planFocus = null;
  document.addEventListener('click', function (e) {
    var f = e.target.closest && e.target.closest('[data-plan-focus]');
    if (f) { planFocus = f.dataset.planFocus; pendingFocus = 'plan-' + planFocus; }
  }, true);

  // ---------- پیاده‌روی: اهداف، قدم روزانه، مسیر، پیشنهاد سطح بعد، پل به دویدن، یادآوری ----------
  function walkGoalTitle(k) { return T('wgoal.' + k + '.t'); }
  function homeWalkTiles() {
    var wg = C.walkGoalInfo(state.profile);
    return '<p class="group-label" role="heading" aria-level="2">' + esc(T(wg.kind === 'none' ? 'goalTiles.title' : 'goalTiles.titleNext')) + '</p><div class="goal-tiles walk-tiles">' +
      C.WALK_GOALS.map(function (k) {
        return '<a class="goal-tile' + (wg.kind === k ? ' is-main' : '') + '" href="#walkgoals" data-wgoal-focus="' + k + '">' +
          (wg.kind === k ? '<span class="gt-badge">' + esc(T('goalTiles.main')) + '</span>' : '') +
          '<span class="gt-km gt-icon" aria-hidden="true">' + esc(T('wgoal.' + k + '.big')) + '</span>' +
          '<span class="gt-name">' + esc(walkGoalTitle(k)) + '</span><span class="gt-eta">' + esc(T('wgoal.' + k + '.short')) + '</span></a>';
      }).join('') + '</div>';
  }
  var wgoalFocus = null;
  document.addEventListener('click', function (e) {
    var f = e.target.closest && e.target.closest('[data-wgoal-focus]');
    if (f) { wgoalFocus = f.dataset.wgoalFocus; pendingFocus = 'wgoal-' + wgoalFocus; }
  }, true);
  function walkEta(gp) {
    if (gp.status === 'ready') return T('path.ready');
    return gp.weeks != null ? (gp.goal.date ? T('path.eta', { a: gp.weeks, b: gp.weeksHi }) : T('path.etaMonth', { m: I.monthTitle(C.parseDate(gp.readyDate)) })) : '';
  }
  function homeWalkPath(now) {
    var p = state.profile, gp = C.walkPath(p, now);
    if (gp.none) return linkCard('#walkgoals', T('wpath.none'), T('wpath.noneSub'));
    if (gp.past) return '';
    var lines = [gp.notStarted ? T('path.notStarted', { d: faDate(p.startDate) }) : T('wpath.weekMin', { n: fa(gp.weekMin) })];
    if (gp.goal.kind === 'steps') {
      var a = C.analytics(state, now, 7), got = a ? a.steps.filter(function (d) { return d.steps; }) : [];
      var avg = got.length ? Math.round(got.reduce(function (x, d) { return x + d.steps; }, 0) / got.length) : 0;
      gp.frac = Math.min(1, avg / gp.goal.steps);
      lines.push(T('wpath.stepsAvg', { n: fa(avg.toLocaleString('en-US')), t: fa(gp.goal.steps.toLocaleString('en-US')) }));
    } else if (gp.goal.kind === 'faster') {
      gp.frac = Math.min(1, (gp.level - 1) / 9);
      lines.push(T('wpath.faster'));
    } else {
      if (gp.daysLeft != null) lines.push(T('wpath.event', { n: gp.daysLeft, d: faDate(gp.goal.date) }));
      lines.push(walkEta(gp));
    }
    var tight = gp.status === 'tight';
    return '<a class="card hcard path-card" href="#walkgoals"><div class="hcard-top"><span class="hcard-label">' + esc(T('path.title')) + '</span>' +
      '<span class="hcard-link">' + esc(T('path.more')) + '</span></div>' +
      '<div class="path-ends"><span class="path-now"><span class="path-hex" aria-hidden="true">' + fa(gp.level) + '</span><span><small>' + esc(T('path.now')) + '</small><b>' + tt('path.level', { n: gp.level }) + '</b></span></span>' +
      '<span class="path-goal"><small>' + esc(T('path.goal')) + '</small><b>' + esc(walkGoalTitle(gp.goal.kind)) + '</b></span></div>' +
      pathBar({ frac: gp.frac || 0 }) + '<div class="path-meta">' + lines.filter(Boolean).map(function (l) { return '<span>' + t(l) + '</span>'; }).join('') + '</div>' +
      (gp.status ? '<span class="path-pill">' + esc(T(tight ? 'wpath.tight' : 'path.st.' + gp.status)) + '</span>' : '') + '</a>';
  }
  function walkGoalCard(p, now) {
    var gp = C.walkPath(p, now), wg = gp.goal, head = '<span class="eyebrow">' + esc(T('race.mainLabel')) + '</span>';
    if (wg.kind === 'none') return '<a class="card pf-goalcard" href="#walkgoals">' + head + '<b class="pf-goal-name">' + esc(T('profile.noGoal')) + '</b><span class="pf-goal-cta">' + esc(T('profile.goalSet')) + '</span></a>';
    var meta = wg.kind === 'steps' ? T('wgoal.stepsLine', { n: fa(wg.steps.toLocaleString('en-US')) }) : wg.kind === 'event' ? T('wgoal.eventLine', { km: fa(wg.km) }) + (wg.date ? T('progress.sep') + faDate(wg.date) : '') : '';
    return '<a class="card pf-goalcard" href="#walkgoals">' + head + '<b class="pf-goal-name">' + esc(walkGoalTitle(wg.kind)) + '</b>' +
      (meta ? '<span class="pf-goal-count">' + t(meta) + '</span>' : '') +
      (gp.need && !gp.past ? pathBar(gp) + '<span class="pf-goal-meta">' + t(walkEta(gp)) + '</span>' : '') +
      '<span class="pf-goal-cta">' + esc(T('wgoal.manage')) + '</span></a>';
  }
  function renderWalkGoals() {
    var p = state.profile, wg = C.walkGoalInfo(p), now = today(), focus = wgoalFocus;
    wgoalFocus = null;
    var html = '<header class="page-head"><h1>' + esc(T('wgoal.pageTitle')) + '</h1></header><p class="page-intro">' + esc(T('wgoal.intro')) + '</p>';
    html += C.WALK_GOALS.map(function (k) {
      var on = wg.kind === k, est = C.walkPath(Object.assign({}, p, { walkGoal: { kind: k, km: 10 } }), now);
      var extra = '';
      if (k === 'steps') extra = '<div class="field"><label for="wg-steps">' + esc(T('wgoal.stepsQ')) + '</label><select id="wg-steps" data-wg-field="steps">' +
        [6000, 7000, 8000, 10000, 12000].map(function (n) { return '<option value="' + n + '"' + ((on ? wg.steps : 8000) === n ? ' selected' : '') + '>' + fa(n.toLocaleString('en-US')) + '</option>'; }).join('') + '</select></div>';
      if (k === 'event') extra = '<div class="row2"><div class="field"><label for="wg-km">' + esc(T('wgoal.eventKmQ')) + '</label><select id="wg-km" data-wg-field="km">' +
        C.WALK_EVENT_KM.map(function (n) { return '<option value="' + n + '"' + ((on ? wg.km : 10) === n ? ' selected' : '') + '>' + t(T('s.km', { n: n })) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="wg-date">' + esc(T('wgoal.dateQ')) + '</label><input id="wg-date" type="date" data-wg-field="date" min="' + C.dateKey(C.addDays(now, 7)) + '" value="' + esc(on && wg.date ? wg.date : '') + '"></div></div>';
      return '<section class="card plan-card wgoal-card' + (on ? ' is-on' : '') + (focus === k ? ' is-focus' : '') + '" id="wgoal-' + k + '"><div class="plan-head"><h2>' + esc(walkGoalTitle(k)) + '</h2>' +
        (on ? '<span class="pill pill-level">' + esc(T('goalTiles.main')) + '</span>' : '') + '</div>' +
        '<p class="small">' + esc(T('wgoal.' + k + '.desc')) + '</p>' +
        (est.weeks ? '<p class="small muted">' + tt('wgoal.eta', { a: est.weeks, b: est.weeksHi }) + '</p>' : est.weeks === 0 && est.need ? '<p class="small muted">' + esc(T('path.ready')) + '</p>' : '') +
        extra + '<p class="form-errors" hidden></p>' +
        '<button type="button" class="btn ' + (on ? 'btn-outline' : 'btn-primary') + ' btn-block" data-wgoal-set="' + k + '">' + esc(T(on ? 'wgoal.update' : 'wgoal.choose')) + '</button>' +
        (on ? '<button type="button" class="linklike small wgoal-clear" data-wgoal-clear="1">' + esc(T('wgoal.clear')) + '</button>' : '') + '</section>';
    }).join('');
    app.innerHTML = html;
  }
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-wgoal-set]'), c = e.target.closest('[data-wgoal-clear]');
    if (!b && !c) return;
    var p = state.profile;
    if (c) { delete p.walkGoal; save(); showToast(T('wgoal.cleared')); renderWalkGoals(); return; }
    var k = b.dataset.wgoalSet, card = b.closest('section'), g = { kind: k };
    var fv = function (n) { var el = card.querySelector('[data-wg-field="' + n + '"]'); return el ? el.value : ''; };
    if (k === 'steps') g.steps = Number(fv('steps')) || 8000;
    if (k === 'event') {
      g.km = Number(fv('km')) || 10;
      var d = fv('date');
      if (d && d < C.dateKey(C.addDays(today(), 7))) { var er = card.querySelector('.form-errors'); er.hidden = false; er.textContent = T('wgoal.errDate'); return; }
      g.date = d || null;
    }
    p.walkGoal = g;
    save(); showToast(T('wgoal.saved', { g: walkGoalTitle(k) }));
    if (location.hash === '#walkgoals') renderWalkGoals(); else route();
  });
  // قدم‌های امروز (کل روز، از گوشی یا ساعت هوشمند)
  function homeSteps(key) {
    var v = (state.steps || {})[key] || '', wg = C.walkGoalInfo(state.profile), target = wg.kind === 'steps' ? wg.steps : null;
    var pct = v && target ? Math.min(100, Math.round(v / target * 100)) : null;
    return '<section class="card hcard steps-card"><div class="hcard-top"><span class="hcard-label">' + esc(T('stepsCard.title')) + '</span>' +
      (target ? '<span class="ob-count">' + tt('stepsCard.target', { n: fa(target.toLocaleString('en-US')) }) + '</span>' : '') + '</div>' +
      (target ? '<div class="ob-bar" aria-hidden="true"><i style="width:' + (pct || 0) + '%"></i></div>' : '') +
      '<form class="steps-form" data-steps-form="' + key + '" novalidate><label class="sr-only" for="steps-today">' + esc(T('stepsCard.label')) + '</label>' +
      '<input id="steps-today" name="steps" type="number" inputmode="numeric" min="0" max="100000" step="1" placeholder="' + esc(T('stepsCard.ph')) + '" value="' + esc(v) + '">' +
      '<button type="submit" class="btn btn-outline">' + esc(T('stepsCard.save')) + '</button></form>' +
      '<p class="small muted">' + esc(T(pct === 100 ? 'stepsCard.hit' : 'stepsCard.hint')) + '</p></section>';
  }
  app.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-steps-form]');
    if (!f) return;
    e.preventDefault();
    var raw = String(f.steps.value || '').trim(), n = raw === '' ? 0 : Number(raw);
    if (!(n >= 0 && n <= 100000 && Math.floor(n) === n)) { showToast(T('post.errSteps')); return; }
    state.steps = state.steps || {};
    if (n) state.steps[f.dataset.stepsForm] = n; else delete state.steps[f.dataset.stepsForm];
    save(); showToast(T('stepsCard.saved')); route();
  });
  // پیشنهاد سطح بعدی پیاده‌روی
  function walkLevelCard(now) {
    var sg = C.walkLevelSuggestion(state.profile, now);
    if (!sg) return '';
    return '<section class="card fitness-notes"><h3>' + esc(T('wlevel.title')) + '</h3><p>' + tt('wlevel.text', { from: sg.from, to: sg.to, n: sg.min }) + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-outline" data-wlevel-up="1">' + tt('fitNotes.apply', { n: sg.to }) + '</button></div></section>';
  }
  app.addEventListener('click', function (e) {
    if (!e.target.closest('[data-wlevel-up]')) return;
    var p = state.profile, sg = C.walkLevelSuggestion(p, today());
    if (!sg) return;
    Object.assign(p, sg.next);
    p.startDate = C.dateKey(today());
    save(); showToast(fa(T('wlevel.done', { n: C.assessLevel(p).level }))); route();
  });
  // پل به دویدن: از سطح ۵ پیاده‌روی (قابل بستن)
  function walkRunBridge() {
    var p = state.profile;
    if (C.assessLevel(p).level < 5 || p.runBridgeDismissed) return '';
    return '<section class="card run-bridge"><h3>' + esc(T('bridge.title')) + '</h3><p>' + esc(T('bridge.text')) + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-bridge-go="1">' + esc(T('bridge.go')) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-bridge-no="1">' + esc(T('bridge.no')) + '</button></div>' +
      '<div class="alert alert-adapt bridge-confirm" hidden><p>' + esc(T('bridge.confirm')) + '</p><div class="actions"><button type="button" class="btn btn-primary" data-bridge-yes="1">' + esc(T('bridge.yes')) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-bridge-cancel="1">' + esc(T('app.cancel')) + '</button></div></div></section>';
  }
  app.addEventListener('click', function (e) {
    var t0 = e.target.closest('[data-bridge-go], [data-bridge-no], [data-bridge-yes], [data-bridge-cancel]');
    if (!t0) return;
    var p = state.profile, box = t0.closest('.run-bridge');
    if (t0.dataset.bridgeNo) { p.runBridgeDismissed = true; save(); route(); return; }
    if (t0.dataset.bridgeGo) { box.querySelector('.bridge-confirm').hidden = false; return; }
    if (t0.dataset.bridgeCancel) { box.querySelector('.bridge-confirm').hidden = true; return; }
    // سطح ۰ دویدن (پیاده‌روی و دویدن تدریجی)؛ داده‌های پیاده‌روی برای برگشت می‌مونن
    p.activity = 'run'; p.experience = 'never'; p.structured = false; p.currentWeeklyKm = p.lastWeekKm = p.monthAvgKm = 0; p.pb = null;
    p.goal = p.goal || { type: 'none' };
    p.startDate = C.dateKey(today()); p.zeroWeeks = {};
    save(); showToast(T('bridge.done')); route();
  });
  // یادآوری: درون‌اپ (پیش‌فرض روشن برای پیاده‌روی) + فایل تقویم + اعلان مرورگر وقتی اپ بازه
  function reminderCfg() {
    var r = state.reminder || {};
    return { on: r.on !== false, time: /^\d\d:\d\d$/.test(r.time || '') ? r.time : '18:00', notify: !!r.notify };
  }
  function remindSub() { var r = reminderCfg(); return r.on ? T('remind.subOn', { t: fa(r.time) }) : T('remind.subOff'); }

  // فایل تقویم: هر جلسه‌ی ۱۲ هفته‌ی آینده یک رویداد با یادآور در ساعت انتخابی (داده از گوشی بیرون نمی‌ره)
  function icsFile() {
    var p = state.profile, r = reminderCfg(), now = today(), hm = r.time.replace(':', '') + '00', lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//gaam//fa', 'CALSCALE:GREGORIAN'];
    var esc2 = function (x) { return String(x).replace(/[\\,;]/g, function (c) { return '\\' + c; }).replace(/\n/g, ' '); };
    for (var i = 0; i < 84; i++) {
      var d = C.addDays(now, i), s = C.sessionFor(p, d);
      if (['rest', 'none'].indexOf(s.type) >= 0) continue;
      var k = C.dateKey(d).replace(/-/g, '');
      lines.push('BEGIN:VEVENT', 'UID:coach-' + k + '@coach-mvp', 'DTSTAMP:' + k + 'T000000Z', 'DTSTART:' + k + 'T' + hm,
        'DURATION:PT' + (s.minutes || 45) + 'M', 'SUMMARY:' + esc2(s.label + (s.minutes ? ' · ' + T('s.min', { n: s.minutes }) : '')),
        'DESCRIPTION:' + esc2((s.steps || []).join(' / ')), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc2(s.label), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // خط‌های بلندتر از ۷۵ بایت طبق RFC 5545 تا می‌خورن (متن فارسی چندبایتیه)
    var fold = function (ln) {
      var out = [], cur = '', n = 0;
      Array.from(ln).forEach(function (ch) {
        var b = unescape(encodeURIComponent(ch)).length;
        if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
        cur += ch; n += b;
      });
      out.push(cur);
      return out.join('\r\n ');
    };
    return lines.map(fold).join('\r\n');
  }
  function remindSection() {
    var r = reminderCfg();
    return '<label class="check-row"><input type="checkbox" id="rm-on"' + (r.on ? ' checked' : '') + '> <span>' + esc(T('remind.inApp')) + '</span></label>' +
      '<div class="field"><label for="rm-time">' + esc(T('remind.time')) + '</label>' + tpo({ id: 'rm-time', name: 'rmTime', mode: 'clock', value: r.time, aria: T('remind.time') }) + '</div>' +
      '<p class="small muted">' + esc(T('remind.calHint')) + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-outline" data-ics="1">' + esc(T('remind.cal')) + '</button>' +
      ('Notification' in window ? '<button type="button" class="btn btn-ghost" data-notify="1">' + esc(T(r.notify && Notification.permission === 'granted' ? 'remind.notifyOn' : 'remind.notify')) + '</button>' : '') + '</div>' +
      '';
  }
  app.addEventListener('change', function (e) {
    if (e.target.id !== 'rm-on' && e.target.id !== 'rm-time') return;
    var r = state.reminder = state.reminder || {};
    if (e.target.id === 'rm-on') r.on = e.target.checked;
    if (e.target.id === 'rm-time' && /^\d\d:\d\d$/.test(e.target.value)) r.time = e.target.value;
    save(); showToast(T('settings.saved')); scheduleNotify();
  });
  app.addEventListener('click', function (e) {
    if (e.target.closest('[data-ics]')) {
      var blob = new Blob([icsFile()], { type: 'text/calendar' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'walking-plan.ics'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      showToast(T('remind.calDone'));
      return;
    }
    if (e.target.closest('[data-notify]') && 'Notification' in window) {
      Notification.requestPermission().then(function (perm) {
        state.reminder = state.reminder || {}; state.reminder.notify = perm === 'granted';
        save(); showToast(T(perm === 'granted' ? 'remind.notifyOk' : 'remind.notifyNo')); scheduleNotify(); route();
      });
    }
  });
  // اعلان در ساعت یادآوری، فقط وقتی اپ بازه (بدون سرور)
  var notifyTimer = null;
  function scheduleNotify() {
    clearTimeout(notifyTimer);
    if (!state.profile || !('Notification' in window) || Notification.permission !== 'granted') return;
    var r = reminderCfg();
    if (!r.on || !r.notify) return;
    var now = new Date(), at = new Date(now), hm = r.time.split(':').map(Number);
    at.setHours(hm[0], hm[1], 0, 0);
    if (at <= now) return;
    notifyTimer = setTimeout(function () {
      var k = C.dateKey(new Date()), s = C.sessionFor(state.profile, new Date());
      if (state.done[k] || ['rest', 'none'].indexOf(s.type) >= 0) return;
      try { new Notification(T('remind.bannerT'), { body: fa(T('remind.banner', { s: s.label, n: s.minutes || '' })), icon: 'public/assets/icon-192.png' }); } catch (er) { /* */ }
    }, Math.min(at - now, 2147483000));
  }
  setTimeout(scheduleNotify, 1500);

  // ---------- چک‌لیست شروع (فقط کاربرهای تازه؛ بعد از کامل شدن، همون روز یک پیام و بعد محو) ----------
  function checklistSteps(p) {
    var g = C.goalInfo(p);
    return [
      { done: true, title: T('start.plan') },
      C.isWalk(p) ? { done: C.walkGoalInfo(p).kind !== 'none', title: C.walkGoalInfo(p).kind !== 'none' ? T('start.goalDone', { g: T('wgoal.' + C.walkGoalInfo(p).kind + '.t') }) : T('start.goal'), sub: C.walkGoalInfo(p).kind !== 'none' ? '' : T('start.goalSubWalk'), href: '#walkgoals' } : { done: g.type !== 'none', title: g.type !== 'none' ? T('start.goalDone', { g: C.goalLabel(g) }) : T('start.goal'), sub: g.type !== 'none' ? (g.date ? faDate(g.date) : '') : T('start.goalSub'), href: '#plans' },
      { done: Object.keys(state.checkins).length > 0, title: T('start.checkin'), sub: T('start.checkinSub'), href: '#checkin' },
      { done: Object.keys(state.done).length > 0, title: T('start.run'), sub: T('start.runSub'), href: '#plan', attr: ' data-goto-today="1"' },
      { done: !!(p.name || '').trim(), title: T('start.name'), sub: T('start.nameSub'), href: '#settings', attr: ' data-set-open="person"' }
    ].filter(Boolean);
  }
  function homeChecklist(now) {
    var c = state.checklist;
    if (!c || c.dismissed) return '';
    var steps = checklistSteps(state.profile), n = steps.filter(function (x) { return x.done; }).length, key = C.dateKey(now);
    var close = '<button type="button" class="ob-close" data-ob-close="1" aria-label="' + esc(T('start.close')) + '"><span aria-hidden="true">×</span></button>';
    var head = '<div class="hcard-top"><span class="hcard-label">' + esc(T('start.title')) + '</span><span class="ob-count">' + tt('start.count', { a: n, b: steps.length }) + '</span>' + close + '</div>' +
      '<div class="ob-bar" aria-hidden="true"><i style="width:' + Math.round(n / steps.length * 100) + '%"></i></div>';
    if (n === steps.length) {
      if (!c.completedAt) { c.completedAt = key; save(); }
      if (c.completedAt !== key) return '';
      return '<section class="card hcard ob-check ob-complete" aria-live="polite">' + head +
        '<div class="ob-done"><span class="ob-tick" aria-hidden="true">✓</span><span><b>' + esc(T('start.allDone')) + '</b><small>' + esc(T('start.allDoneSub')) + '</small></span></div></section>';
    }
    var next = steps.filter(function (x) { return !x.done; })[0];
    return '<section class="card hcard ob-check" aria-label="' + esc(T('start.title')) + '">' + head + '<ul class="ob-list">' + steps.map(function (x) {
      var cls = (x.done ? 'is-done' : '') + (x === next ? ' ob-next' : ''), inner = '<span class="ob-tick" aria-hidden="true">' + (x.done ? '✓' : '') + '</span>' +
        '<span class="ob-txt"><b>' + t(x.title) + '</b>' + (x.sub ? '<small>' + t(x.sub) + '</small>' : '') + '</span>';
      var sr = '<span class="sr-only">' + esc(T(x.done ? 'start.srDone' : 'start.srTodo')) + '</span>';
      return '<li class="' + cls.trim() + '">' + (x.done || !x.href ? '<div class="ob-row">' + inner + sr + '</div>'
        : '<a class="ob-row" href="' + x.href + '"' + (x.attr || '') + '>' + inner + sr + chevron(isRtl() ? 'left' : 'right') + '</a>') + '</li>';
    }).join('') + '</ul></section>';
  }
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ob-close]');
    if (!b || !state.checklist) return;
    state.checklist.dismissed = true;
    save();
    var card = b.closest('.ob-check');
    card.classList.add('ob-leaving');
    var gone = function () { if (card.parentNode) card.remove(); };
    card.addEventListener('animationend', gone);
    setTimeout(gone, 400);
  });

  // ---------- پیام تشویقی اولین تمرین ثبت‌شده (فقط یک بار) ----------
  function openCelebration(k) {
    var p = state.profile, s = C.sessionFor(p, C.parseDate(k)), next = null;
    for (var i = 1; i <= 14 && !next; i++) {
      var d = C.addDays(C.parseDate(k), i), ns = C.sessionFor(p, d);
      if (['rest', 'none'].indexOf(ns.type) < 0) next = { d: d, s: ns };
    }
    var dots = '';
    for (var j = 0; j < 22; j++) dots += '<i style="inset-inline-start:' + (4 + (j * 37) % 92) + '%;animation-delay:' + (j % 7) * 0.08 + 's;background:' + ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--info)', 'var(--zone-5)'][j % 5] + '"></i>';
    modalRoot.innerHTML = '<div class="modal-backdrop" id="cele-modal"><div class="modal cele" role="dialog" aria-modal="true" aria-labelledby="cele-title" aria-describedby="cele-text">' +
      '<div class="cele-dots" aria-hidden="true">' + dots + '</div><div class="cele-ico" aria-hidden="true">✓</div>' +
      '<h2 id="cele-title">' + esc(T('cele.title')) + '</h2>' +
      '<p id="cele-text">' + tt('cele.text', { s: s.label + (s.km ? ' ' + T('s.km', { n: s.km }) : '') }) + '</p>' +
      (next ? '<div class="cele-next"><small>' + esc(T('cele.next')) + '</small><b>' + t(next.s.dayName + T('progress.sep') + next.s.label + (next.s.km ? ' ' + T('s.km', { n: next.s.km }) : '')) + '</b></div>' : '') +
      '<button type="button" class="btn btn-primary btn-block" data-cele-close="1">' + esc(T('cele.cont')) + '</button></div></div>';
    document.body.classList.add('modal-open');
    var btn = modalRoot.querySelector('[data-cele-close]');
    btn.focus();
    var close = function () {
      modalRoot.innerHTML = '';
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey);
      var f = app.querySelector('[data-postrun-form] input, [data-postrun-form] button');
      if (f) f.focus();
    };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    btn.addEventListener('click', close);
    modalRoot.querySelector('#cele-modal').addEventListener('click', function (e) { if (e.target.id === 'cele-modal') close(); });
  }

  // =====================================================================
  // پیشرفت من: نمودارها از داده‌ی واقعی (C.analytics)؛ رسم با js/charts.js
  // =====================================================================
  // رنگ سری‌ها (پالت دسته‌ای اعتبارسنجی‌شده: آبی، نارنجی، فیروزه‌ای) و رنگ‌های وضعیت برای پایبندی
  // رنگ نمودارها، همه از css/theme.css:
  // ستون‌ها خنثی و ستونِ هفته/روز جاری primary؛ میانگین متحرک text؛ خط مرجع (هدف) خط‌چین text-secondary
  var BAR = 'var(--text-secondary)', HI = 'var(--primary)', MA = 'var(--text)', REF = 'var(--text-secondary)';
  var SERIES = [BAR, MA, REF];
  // پیس‌ها با رنگ ناحیه‌ی تمرینی؛ چک‌این و بار تمرین با رنگ‌های وضعیت
  var ZONE = { e: 'var(--zone-2)', t: 'var(--zone-4)', i: 'var(--zone-5)' };
  var CK = { fatigue: 'var(--warning)', sleep: 'var(--info)' };
  var PMC = ['var(--primary)', 'var(--text-secondary)', 'var(--info)'];
  var STATUS = { completed: 'var(--success)', adapted: 'var(--warning)', pain: 'var(--error)', missed: 'var(--text-secondary)' };
  // اندیس ستون جاری: هفته‌ی ناتمام یا آخرین هفته‌ی غیرآینده
  function curIdx(X) { var k = -1; X.forEach(function (w, i) { if (!w.future) k = i; }); return k; }
  var RANGES = { '4w': 28, '3m': 91, all: null };
  var chartSpecs = {};
  function kmTxt(x) { return fa(dKm(Math.round(x * 10) / 10)); }
  function paceTxt(sec) { return fa(C.formatDuration(Math.round(sec))); }
  function secDiff(n) { return Math.round(Math.abs(n)); }
  // عدد علامت‌دار؛ LRM تا منفی در متن راست‌به‌چپ جابه‌جا نشه
  function signed(n) { n = Math.round(n); return '\u200e' + (n > 0 ? '+' : n < 0 ? '−' : '') + fa(Math.abs(n)); }
  function statTile(label, value, sub) {
    return '<div class="pstat"><span class="pstat-l">' + esc(label) + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
  }
  function legendItem(color, label, kind) {
    return '<span class="lg-item"><i class="ch-key ch-key-' + (kind || 'line') + '" style="background:' + color + '"></i>' + esc(label) + '</span>';
  }
  function dataTable(head, rows) {
    return '<details class="ch-table"><summary>' + esc(T('progress.table')) + '</summary><div class="table-wrap"><table class="pred-table"><thead><tr>' +
      head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></details>';
  }
  function chartBox(id, spec) { chartSpecs[id] = spec; return '<div class="chart" id="ch-' + id + '"></div>'; }
  function progCard(id, title, desc, body, extra) {
    return '<section class="card pcard" id="p-' + id + '"><h2>' + esc(title) + '</h2><p class="small muted">' + esc(desc) + '</p>' + body + (extra || '') + '</section>';
  }
  function weekLabel(k) { return faDate(k, true); }
  // قبل از جمع شدن داده: محور زمان تا حداقل طول بازه با هفته‌ها/روزهای پیش رو (خالی) ادامه پیدا می‌کنه تا نمودار کم‌کم پر بشه
  function padWeeks(W, n) {
    var out = W.slice(), last = out.length ? C.parseDate(out[out.length - 1].start) : null;
    if (!last) { last = C.weekStart(today()); out.push({ start: C.dateKey(last), km: 0, vert: 0, runs: 0, partial: true, maKm: null, maVert: null }); }
    while (out.length < n) { last = C.addDays(last, 7); out.push({ start: C.dateKey(last), km: 0, vert: 0, runs: 0, future: true, maKm: null, maVert: null }); }
    return out;
  }
  function padDays(D, n) {
    var out = D.slice(), last = out.length ? C.parseDate(out[out.length - 1].date) : C.addDays(today(), -1);
    while (out.length < n) { last = C.addDays(last, 1); out.push({ date: C.dateKey(last), future: true }); }
    return out;
  }
  // محور y بدون عدد، وقتی هنوز هیچ مقداری نیست
  var BLANK_Y = { min: 0, max: 1, ticks: [0, 0.5, 1], fmt: function () { return ''; } };

  function renderProgress() {
    var SEP = T('progress.sep');
    var rk = RANGES.hasOwnProperty(settings.progressRange) ? settings.progressRange : '3m';
    var a = C.analytics(state, today(), RANGES[rk]);
    var rtl = isRtl();
    chartSpecs = {};
    var html = '<div class="pf-tool"><div class="seg prange" role="group" aria-label="' + esc(T('progress.rangeAria')) + '">' +
      ['4w', '3m', 'all'].map(function (k) {
        return '<button type="button" data-prange="' + k + '" aria-pressed="' + (k === rk) + '">' + esc(T('progress.r' + (k === '4w' ? '4w' : k === '3m' ? '3m' : 'All'))) + '</button>';
      }).join('') + '</div></div><p class="page-intro">' + esc(T('progress.intro')) + '</p>' +
      (a.walk ? '' : function () {
        var f = C.currentFitness(state.profile);
        return '<nav class="card list-group">' + listRows([['#fitness', 'watch', T('profile.linkFitness'), f ? 'VDOT ' + f.vdot.toFixed(1) + T('progress.sep') + T('profile.fitnessSub') : T('profile.registerTest')]]) + '</nav>';
      }());

    var W = a.weeks, wkWithRuns = W.filter(function (w) { return w.runs > 0; }).length;
    var pc = progCtx(a, rk === '4w' ? 4 : 13);

    html += a.walk ? progWalkVolCard(pc) : progVolCard(pc);

    html += progPmcCard(pc);

    // ---- ۳. بهبود پیس ----
    // پیس‌ها به ثانیه در واحد کاربر (کیلومتر یا مایل)
    var S = pc.S, changed = pc.changed;
    if (!a.walk) (function () {
      var body;
      if (a.entriesCount < 2 || !changed) {
        // شروع کار: پیس هر هفته از آخرین رکورد/تایم‌تست (خط صاف)، هفته‌های پیش رو خالی
        var X = padWeeks(W, pc.minW).map(function (w, i) {
          var s = a.samples[i];
          return s && s.vdot ? { date: s.date, vdot: s.vdot, e: I.pace(s.e), t: I.pace(s.t), i: I.pace(s.i) } : { date: w.start };
        });
        var vs = [];
        X.forEach(function (s) { if (s.vdot) vs.push(s.e, s.t, s.i); });
        body = '<div class="ch-legend">' + legendItem(ZONE.e, T('progress.pace.e')) + legendItem(ZONE.t, T('progress.pace.t')) + legendItem(ZONE.i, T('progress.pace.i')) + '</div>' +
          chartBox('pace', {
            rtl: rtl, n: X.length, aria: T('progress.pace.title'),
            y: vs.length ? { min: Math.min.apply(null, vs) - 5, max: Math.max.apply(null, vs) + 5, invert: true, fmt: paceTxt, label: T('progress.pace.unit') } : Object.assign({ label: T('progress.pace.unit') }, BLANK_Y),
            lines: [['e', 2], ['t', 0], ['i', 1]].map(function (k) { return { values: X.map(function (s) { return s.vdot ? s[k[0]] : null; }), color: ZONE[k[0]], dots: 'last' }; }),
            xLabels: function (i) { return faDate(X[i].date, true); }, xPx: 52,
            emptyLabel: vs.length ? null : T('progress.pace.empty'),
            tip: function (i) {
              var s = X[i];
              if (!s.vdot) return null;
              return { title: faDate(s.date), rows: [
                { color: ZONE.e, label: T('progress.pace.e'), value: paceTxt(s.e) },
                { color: ZONE.t, label: T('progress.pace.t'), value: paceTxt(s.t) },
                { color: ZONE.i, label: T('progress.pace.i'), value: paceTxt(s.i) }] };
            }
          });
      } else {
        var f = S[0], l = S[S.length - 1];
        var diff = function (k) {
          var dlt = l[k] - f[k];
          return Math.abs(dlt) < 1 ? T('progress.pace.diffSame') : T(dlt < 0 ? 'progress.pace.diffFaster' : 'progress.pace.diffSlower', { n: fa(secDiff(dlt)) });
        };
        var marked = S.map(function (s, i) { return i === 0 || s.entry !== S[i - 1].entry; });
        var vals = [];
        S.forEach(function (s) { vals.push(s.e, s.t, s.i); });
        body = '<div class="pstats">' + statTile(T('progress.pace.vdot'), '<span dir="ltr">' + fa(f.vdot.toFixed(1)) + ' → ' + fa(l.vdot.toFixed(1)) + '</span>') +
          ['e', 't', 'i'].map(function (k) { return statTile(T('progress.pace.' + k), '<span dir="ltr">' + paceTxt(l[k]) + '</span>', esc(diff(k))); }).join('') + '</div>' +
          '<div class="ch-legend">' + legendItem(ZONE.e, T('progress.pace.e')) + legendItem(ZONE.t, T('progress.pace.t')) + legendItem(ZONE.i, T('progress.pace.i')) +
          '<span class="lg-item lg-note">' + esc(T('progress.pace.faster')) + '</span></div>' +
          chartBox('pace', {
            rtl: rtl, n: S.length, aria: T('progress.pace.title'),
            y: { min: Math.min.apply(null, vals) - 5, max: Math.max.apply(null, vals) + 5, invert: true, fmt: paceTxt, label: T('progress.pace.unit') },
            lines: [{ values: S.map(function (s) { return s.e; }), color: ZONE.e, step: true, dots: 'marked', marked: marked },
              { values: S.map(function (s) { return s.t; }), color: ZONE.t, step: true, dots: 'marked', marked: marked },
              { values: S.map(function (s) { return s.i; }), color: ZONE.i, step: true, dots: 'marked', marked: marked }],
            xLabels: function (i) { return faDate(S[i].date, true); }, xPx: 52,
            tip: function (i) {
              var s = S[i];
              return { title: faDate(s.date) + (marked[i] && i > 0 ? SEP + T('progress.pace.newTest') : ''), rows: [
                { color: ZONE.e, label: T('progress.pace.e'), value: paceTxt(s.e) },
                { color: ZONE.t, label: T('progress.pace.t'), value: paceTxt(s.t) },
                { color: ZONE.i, label: T('progress.pace.i'), value: paceTxt(s.i) },
                { color: 'transparent', label: 'VDOT', value: fa(s.vdot.toFixed(1)) }] };
            }
          }) +
          dataTable([T('progress.date'), 'VDOT', T('progress.pace.e'), T('progress.pace.t'), T('progress.pace.i')], S.filter(function (s, i) { return marked[i]; }).map(function (s) {
            return [esc(faDate(s.entry, true)), fa(s.vdot.toFixed(1)), paceTxt(s.e), paceTxt(s.t), paceTxt(s.i)];
          }));
      }
      html += progCard('pace', T('progress.pace.title'), T('progress.pace.desc'), body, learnMore(['vdot']));
    })();
    html += a.walk ? progStepsCard(pc) : progTodCard();

    // ---- ۴. چک‌این‌ها (روزانه در کل بازه؛ روزهای بدون چک‌این خالی) ----
    (function () {
      var CK = a.checkins, body;
      if (CK.length < 5) {
        // چند چک‌این اول: محور روزانه (حداقل ۴ هفته)، روزهای پیش رو خالی
        var by0 = {}, D0 = [];
        CK.forEach(function (c) { by0[c.date] = c; });
        for (var d0 = C.parseDate(a.from); C.dateKey(d0) <= a.today; d0 = C.addDays(d0, 1)) D0.push({ date: C.dateKey(d0) });
        D0 = padDays(D0, 28);
        var pain0 = [];
        D0.forEach(function (x, i) { if (by0[x.date] && by0[x.date].pain) pain0.push(i); });
        body = '<div class="ch-legend">' + legendItem(CK.fatigue, T('progress.checkins.fatigue')) + legendItem(CK.sleep, T('progress.checkins.sleep')) +
          legendItem(STATUS.pain, T('progress.checkins.pain'), 'dot') + '</div>' +
          chartBox('ck', {
            rtl: rtl, n: D0.length, aria: T('progress.checkins.title'), height: 170,
            y: { min: 1, max: 5, ticks: [1, 2, 3, 4, 5], fmt: fa },
            lines: [{ values: D0.map(function (x) { return by0[x.date] ? by0[x.date].fatigue : null; }), color: CK.fatigue, dots: 'all' },
              { values: D0.map(function (x) { return by0[x.date] ? by0[x.date].sleep : null; }), color: CK.sleep, dots: 'all' }],
            markers: { idx: pain0, color: STATUS.pain, label: T('progress.checkins.pain') },
            xLabels: function (i) { return faDate(D0[i].date, true); }, xPx: 52,
            emptyLabel: CK.length ? null : T('progress.checkins.empty'),
            tip: function (i) {
              var c = by0[D0[i].date];
              if (!c) return null;
              var rows = [{ color: CK.fatigue, label: T('progress.checkins.fatigue'), value: fa(c.fatigue ? T('progress.checkins.of5', { n: c.fatigue }) : '—') },
                { color: CK.sleep, label: T('progress.checkins.sleep'), value: fa(c.sleep ? T('progress.checkins.of5', { n: c.sleep }) : '—') }];
              if (c.pain) rows.push({ color: STATUS.pain, kind: 'dot', label: '', value: T('progress.checkins.painYes') });
              return { title: faDate(c.date), rows: rows };
            }
          });
      } else {
        var days = [], byDate = {};
        CK.forEach(function (c) { byDate[c.date] = c; });
        for (var d = C.parseDate(a.from); C.dateKey(d) <= a.today; d = C.addDays(d, 1)) days.push(C.dateKey(d));
        // بازه‌ی بلند: میانگین هفتگی (الگوهای چندهفته‌ای واضح‌تر)، بازه‌ی کوتاه: روزانه
        var weekly = days.length > 35;
        if (weekly) {
          var wk = {}, order = [];
          CK.forEach(function (c) {
            var k = C.dateKey(C.weekStart(C.parseDate(c.date)));
            if (!wk[k]) { wk[k] = { date: k, f: [], s: [], pain: 0 }; order.push(k); }
            if (c.fatigue) wk[k].f.push(c.fatigue);
            if (c.sleep) wk[k].s.push(c.sleep);
            if (c.pain) wk[k].pain++;
          });
          var mean = function (x) { return x.length ? x.reduce(function (p, q) { return p + q; }, 0) / x.length : null; };
          days = W.map(function (w) { return w.start; });
          byDate = {};
          days.forEach(function (k) { var x = wk[k]; if (x) byDate[k] = { date: k, fatigue: mean(x.f), sleep: mean(x.s), pain: x.pain, n: x.f.length }; });
        }
        var painIdx = [];
        days.forEach(function (k, i) { if (byDate[k] && byDate[k].pain) painIdx.push(i); });
        var avg = function (key) { var v = CK.map(function (c) { return c[key]; }).filter(function (x) { return x; }); return v.length ? v.reduce(function (x, y) { return x + y; }, 0) / v.length : 0; };
        body = '<div class="pstats">' + statTile(T('progress.checkins.avgF'), tt('progress.checkins.of5', { n: avg('fatigue').toFixed(1) })) +
          statTile(T('progress.checkins.avgS'), tt('progress.checkins.of5', { n: avg('sleep').toFixed(1) })) +
          statTile(T('progress.checkins.painDays'), fa(CK.filter(function (c) { return c.pain; }).length)) + '</div>' +
          '<div class="ch-legend">' + legendItem(CK.fatigue, T('progress.checkins.fatigue')) + legendItem(CK.sleep, T('progress.checkins.sleep')) +
          legendItem(STATUS.pain, T('progress.checkins.pain'), 'dot') + (weekly ? '<span class="lg-item lg-note">' + esc(T('progress.checkins.weeklyAvg')) + '</span>' : '') + '</div>' +
          chartBox('ck', {
            rtl: rtl, n: days.length, aria: T('progress.checkins.title'), height: 170,
            y: { min: 1, max: 5, ticks: [1, 2, 3, 4, 5], fmt: fa },
            lines: [{ values: days.map(function (k) { return byDate[k] ? byDate[k].fatigue : null; }), color: CK.fatigue, dots: days.length <= 35 ? 'all' : 'none' },
              { values: days.map(function (k) { return byDate[k] ? byDate[k].sleep : null; }), color: CK.sleep, dots: days.length <= 35 ? 'all' : 'none' }],
            markers: { idx: painIdx, color: STATUS.pain, label: T('progress.checkins.pain') },
            xLabels: function (i) { return faDate(days[i], true); }, xPx: 52,
            tip: function (i) {
              var c = byDate[days[i]], title = weekly ? T('progress.weekOf', { d: weekLabel(days[i]) }) + SEP + T('progress.checkins.weeklyAvg') : faDate(days[i]);
              if (!c) return { title: title, rows: [{ color: 'transparent', label: '', value: '—' }] };
              var v = function (x) { return x ? T('progress.checkins.of5', { n: weekly ? x.toFixed(1) : x }) : '—'; };
              var rows = [{ color: CK.fatigue, label: T('progress.checkins.fatigue'), value: v(c.fatigue) },
                { color: CK.sleep, label: T('progress.checkins.sleep'), value: v(c.sleep) }];
              if (c.pain) rows.push({ color: STATUS.pain, kind: 'dot', label: '', value: weekly ? T('progress.checkins.painN', { n: c.pain }) : T('progress.checkins.painYes') });
              return { title: title, rows: rows.map(function (r) { r.value = fa(r.value); return r; }) };
            }
          }) +
          dataTable([T('progress.date'), T('progress.checkins.fatigue'), T('progress.checkins.sleep'), T('progress.checkins.pain')], CK.slice().reverse().map(function (c) {
            return [esc(faDate(c.date, true)), c.fatigue ? fa(c.fatigue) : '—', c.sleep ? fa(c.sleep) : '—', c.pain ? '● ' + esc(T('progress.checkins.painYes')) : '—'];
          }));
      }
      html += progCard('ck', T('progress.checkins.title'), T('progress.checkins.desc'), body);
    })();

    if (!a.walk) html += progPredCard(pc);

    // ---- ۶. صعود هفتگی (هدف تریل/اولترا) ----
    if (a.goal.ultra) (function () {
      var body;
      if (wkWithRuns < 2) {
        var X = padWeeks(W, pc.minW);
        body = '<div class="ch-legend">' + legendItem(SERIES[0], T('progress.vert.bars'), 'bar') + '</div>' +
          chartBox('vert', {
            rtl: rtl, n: X.length, aria: T('progress.vert.title'),
            y: { min: 0, max: Math.max.apply(null, X.map(function (w) { return w.vert; }).concat([100])), fmt: fa, label: T('progress.vert.unit') },
            bars: { values: X.map(function (w) { return w.future ? null : w.vert; }), color: BAR, hi: curIdx(X), hiColor: HI, faded: X.map(function (w) { return w.partial; }) },
            xLabels: function (i) { return weekLabel(X[i].start); }, xPx: 52,
            emptyLabel: wkWithRuns ? null : T('progress.vert.empty'),
            tip: function (i) {
              var w = X[i];
              if (w.future) return null;
              return { title: tt('progress.weekOf', { d: weekLabel(w.start) }), rows: [
                { color: SERIES[0], kind: 'bar', label: T('progress.vert.bars'), value: T('progress.vert.val', { n: fa(Math.round(w.vert)) }) }] };
            }
          });
      } else {
        var cur = W[W.length - 1], full = W.filter(function (w) { return !w.partial; }), ma = full.length ? full[full.length - 1].maVert : null;
        body = '<div class="pstats">' + statTile(T('progress.vert.thisWeek'), tt('progress.vert.val', { n: Math.round(cur.vert) })) +
          (ma != null ? statTile(T('progress.vert.avg4'), tt('progress.vert.val', { n: Math.round(ma) })) : '') + '</div>' +
          '<div class="ch-legend">' + legendItem(SERIES[0], T('progress.vert.bars'), 'bar') + legendItem(SERIES[1], T('progress.vert.ma')) + '</div>' +
          chartBox('vert', {
            rtl: rtl, n: W.length, aria: T('progress.vert.title'),
            y: { min: 0, max: Math.max.apply(null, W.map(function (w) { return w.vert; }).concat([100])), fmt: fa, label: T('progress.vert.unit') },
            bars: { values: W.map(function (w) { return w.vert; }), color: BAR, hi: W.length - 1, hiColor: HI, faded: W.map(function (w) { return w.partial; }) },
            lines: [{ values: W.map(function (w) { return w.maVert; }), color: SERIES[1], dots: 'last' }],
            xLabels: function (i) { return weekLabel(W[i].start); }, xPx: 52,
            tip: function (i) {
              var w = W[i];
              return { title: tt('progress.weekOf', { d: weekLabel(w.start) }) + (w.partial ? SEP + T('progress.partialTag') : ''), rows: [
                { color: SERIES[0], kind: 'bar', label: T('progress.vert.bars'), value: T('progress.vert.val', { n: fa(Math.round(w.vert)) }) },
                { color: SERIES[1], label: T('progress.vert.ma'), value: w.maVert != null ? T('progress.vert.val', { n: fa(Math.round(w.maVert)) }) : '—' }] };
            }
          }) +
          dataTable([T('progress.week'), T('progress.vert.bars'), T('progress.vert.ma')], W.map(function (w) {
            return [esc(weekLabel(w.start)), fa(Math.round(w.vert)), w.maVert != null ? fa(Math.round(w.maVert)) : '—'];
          }));
      }
      html += progCard('vert', T('progress.vert.title'), T('progress.vert.desc'), body, learnMore(['types']));
    })();

    html += progAdhCard(pc);

    var el = pfPanel();
    if (!el) return;
    el.innerHTML = html;
    drawCharts();
  }
  // ---------- کارت‌های نمودار مشترک (صفحه‌ی پیشرفت و پایین پروفایل) ----------
  function progCtx(a, minW) {
    var W = a.weeks;
    // پیس‌ها به ثانیه در واحد کاربر (کیلومتر یا مایل)
    var S = a.samples.filter(function (s) { return s.vdot; }).map(function (s) {
      return Object.assign({}, s, { e: I.pace(s.e), t: I.pace(s.t), i: I.pace(s.i) });
    });
    return { a: a, W: W, minW: minW || 13, wkWithRuns: W.filter(function (w) { return w.runs > 0; }).length, rtl: isRtl(), SEP: T('progress.sep'),
      S: S, changed: S.length > 1 && S.some(function (s) { return s.entry !== S[0].entry; }) };
  }
  // پیاده‌روی: دقیقه‌ی هفتگی و میانگین ۴ هفته
  function progWalkVolCard(c) {
    var W = c.W, rtl = c.rtl, SEP = c.SEP, X = padWeeks(W, c.minW), has = W.some(function (w) { return w.min > 0; });
    var mins = function (v) { return T('progress.volW.val', { n: fa(Math.round(v)) }); };
    var full = W.filter(function (w) { return !w.partial; }), cur = W[W.length - 1], ma = full.length ? full[full.length - 1].maMin : null;
    var body = (has ? '<div class="pstats">' + statTile(T('progress.vol.thisWeek'), esc(mins(cur ? cur.min : 0))) +
      (ma != null ? statTile(T('progress.vol.avg4'), esc(mins(ma))) : '') + statTile(T('progress.volW.who'), esc(mins(150))) + '</div>' : '') +
      '<div class="ch-legend">' + legendItem(SERIES[0], T('progress.volW.bars'), 'bar') + (has ? legendItem(SERIES[1], T('progress.vol.ma')) + legendItem(SERIES[2], T('progress.volW.who')) : '') + '</div>' +
      chartBox('vol', {
        rtl: rtl, n: X.length, aria: T('progress.volW.title'),
        y: { min: 0, max: Math.max.apply(null, X.map(function (w) { return w.min || 0; }).concat([160])), fmt: fa, label: T('progress.volW.unit') },
        bars: { values: X.map(function (w) { return w.future ? null : w.min || 0; }), color: BAR, hi: curIdx(X), hiColor: HI, faded: X.map(function (w) { return w.partial; }) },
        lines: has ? [{ values: X.map(function (w) { return w.maMin == null ? null : w.maMin; }), color: SERIES[1], dots: 'last' },
          { values: X.map(function () { return 150; }), color: REF, dash: true }] : [],
        xLabels: function (i) { return weekLabel(X[i].start); }, xPx: 52,
        emptyLabel: has ? null : T('progress.volW.empty'),
        tip: function (i) {
          var w = X[i];
          if (w.future) return null;
          return { title: tt('progress.weekOf', { d: weekLabel(w.start) }) + (w.partial ? SEP + T('progress.partialTag') : ''), rows: [
            { color: SERIES[0], kind: 'bar', label: T('progress.volW.bars'), value: mins(w.min || 0) },
            { color: SERIES[1], label: T('progress.vol.ma'), value: w.maMin != null ? mins(w.maMin) : '—' }] };
        }
      });
    return progCard('vol', T('progress.volW.title'), T('progress.volW.desc'), body);
  }
  // پیاده‌روی: قدم روزانه (ثبت روزانه یا قدم جلسه) و خط هدف قدم
  function progStepsCard(c) {
    var D = c.a.steps.slice(-Math.min(c.a.steps.length, Math.max(28, c.minW * 7))), rtl = c.rtl;
    var wg = C.walkGoalInfo(state.profile), target = wg.kind === 'steps' ? wg.steps : null;
    var vals = D.map(function (d) { return d.steps || null; }), got = vals.filter(Boolean);
    var avg = got.length ? Math.round(got.reduce(function (x, y) { return x + y; }, 0) / got.length) : null;
    var stepsTxt = function (n) { return T('progress.steps.val', { n: fa(n.toLocaleString('en-US')) }); };
    var body = (avg ? '<div class="pstats">' + statTile(T('progress.steps.avg'), esc(stepsTxt(avg))) +
      (target ? statTile(T('progress.steps.target'), esc(stepsTxt(target)), esc(tt('progress.steps.hit', { n: got.filter(function (v) { return v >= target; }).length, d: got.length }))) : '') + '</div>' : '') +
      '<div class="ch-legend">' + legendItem(SERIES[0], T('progress.steps.bars'), 'bar') + (target ? legendItem(SERIES[2], T('progress.steps.target')) : '') + '</div>' +
      chartBox('steps', {
        rtl: rtl, n: D.length, aria: T('progress.steps.title'),
        y: { min: 0, max: Math.max.apply(null, got.concat([target || 0, 10000])), fmt: function (v) { return fa(Math.round(v / 1000)); }, label: T('progress.steps.unit') },
        bars: { values: vals, color: BAR, hi: vals.length - 1, hiColor: HI },
        lines: target ? [{ values: D.map(function () { return target; }), color: REF, dash: true }] : [],
        xLabels: function (i) { return faDate(D[i].date, true); }, xPx: 52,
        emptyLabel: got.length ? null : T('progress.steps.empty'),
        tip: function (i) { return D[i].steps ? { title: faDate(D[i].date), rows: [{ color: SERIES[0], kind: 'bar', label: T('progress.steps.bars'), value: stepsTxt(D[i].steps) }] } : null; }
      });
    return progCard('steps', T('progress.steps.title'), T('progress.steps.desc'), body);
  }
  // ۱. حجم هفتگی
  function progVolCard(c) {
    var a = c.a, W = c.W, wkWithRuns = c.wkWithRuns, rtl = c.rtl, SEP = c.SEP, S = c.S, changed = c.changed;
    var body;
    if (wkWithRuns < 2) {
      var X = padWeeks(W, c.minW);
      body = '<div class="ch-legend">' + legendItem(SERIES[0], T('progress.vol.bars'), 'bar') + '</div>' +
        chartBox('vol', {
          rtl: rtl, n: X.length, aria: T('progress.vol.title'),
          y: { min: 0, max: Math.max.apply(null, X.map(function (w) { return dKm(w.km); }).concat([isMi() ? 3 : 5])), fmt: fa, label: T('progress.vol.unit') },
          bars: { values: X.map(function (w) { return w.future ? null : dKm(w.km); }), color: BAR, hi: curIdx(X), hiColor: HI, faded: X.map(function (w) { return w.partial; }) },
          xLabels: function (i) { return weekLabel(X[i].start); }, xPx: 52,
          emptyLabel: wkWithRuns ? null : T('progress.vol.empty'),
          tip: function (i) {
            var w = X[i];
            if (w.future) return null;
            return { title: tt('progress.weekOf', { d: weekLabel(w.start) }) + (w.partial ? SEP + T('progress.partialTag') : ''), rows: [
              { color: SERIES[0], kind: 'bar', label: T('progress.vol.bars'), value: T('progress.vol.val', { n: kmTxt(w.km) }) }] };
          }
        });
    } else {
      var cur = W[W.length - 1], full = W.filter(function (w) { return !w.partial; });
      var ma = full.length ? full[full.length - 1].maKm : null, maPrev = full.length > 4 ? full[full.length - 5].maKm : null;
      var trend = ma != null && maPrev ? (ma > maPrev * 1.05 ? 'up' : ma < maPrev * 0.95 ? 'down' : 'flat') : null;
      body = '<div class="pstats">' + statTile(T('progress.vol.thisWeek'), tt('progress.vol.val', { n: kmTxt(cur.km) })) +
        (ma != null ? statTile(T('progress.vol.avg4'), tt('progress.vol.val', { n: kmTxt(ma) })) : '') +
        (trend ? statTile(T('progress.vol.trend'), (trend === 'up' ? '↗ ' : trend === 'down' ? '↘ ' : '→ ') + esc(T('progress.vol.' + trend))) : '') + '</div>' +
        '<div class="ch-legend">' + legendItem(SERIES[0], T('progress.vol.bars'), 'bar') + legendItem(SERIES[1], T('progress.vol.ma')) + '</div>' +
        chartBox('vol', {
          rtl: rtl, n: W.length, aria: T('progress.vol.title'),
          y: { min: 0, max: Math.max.apply(null, W.map(function (w) { return dKm(w.km); }).concat([isMi() ? 3 : 5])), fmt: fa, label: T('progress.vol.unit') },
          bars: { values: W.map(function (w) { return dKm(w.km); }), color: BAR, hi: W.length - 1, hiColor: HI, faded: W.map(function (w) { return w.partial; }) },
          lines: [{ values: W.map(function (w) { return w.maKm == null ? null : dKm(w.maKm); }), color: SERIES[1], dots: 'last' }],
          xLabels: function (i) { return weekLabel(W[i].start); }, xPx: 52,
          tip: function (i) {
            var w = W[i];
            return { title: tt('progress.weekOf', { d: weekLabel(w.start) }) + (w.partial ? SEP + T('progress.partialTag') : ''), rows: [
              { color: SERIES[0], kind: 'bar', label: T('progress.vol.bars'), value: T('progress.vol.val', { n: kmTxt(w.km) }) },
              { color: SERIES[1], label: T('progress.vol.ma'), value: w.maKm != null ? T('progress.vol.val', { n: kmTxt(w.maKm) }) : '—' }] };
          }
        }) +
        dataTable([T('progress.week'), T('progress.vol.bars'), T('progress.vol.ma')], W.map(function (w) {
          return [esc(weekLabel(w.start)) + (w.partial ? ' <small class="muted">(' + esc(T('progress.partialTag')) + ')</small>' : ''), kmTxt(w.km), w.maKm != null ? kmTxt(w.maKm) : '—'];
        }));
    }
    return progCard('vol', T('progress.vol.title'), T('progress.vol.desc'), body, learnMore(['tenpct']));
  }
  // ۲. فیتنس و خستگی (CTL / ATL / TSB)
  function progPmcCard(c) {
    var a = c.a, W = c.W, wkWithRuns = c.wkWithRuns, rtl = c.rtl, SEP = c.SEP, S = c.S, changed = c.changed;
    var D = a.pmc, body;
    if (D.length < 14 || a.runsDone < 3) {
      // شروع کار: مدل از روز اول حساب می‌شه، ولی تا اولین دویدن ثبت‌شده خطی کشیده نمی‌شه
      var none = !a.runsDone, X = padDays(D, c.minW * 7), v0 = [];
      if (!none) D.forEach(function (d) { v0.push(d.ctl, d.atl, d.tsb); });
      var sg = function (v) { return v < 0 ? '−' + fa(-v) : fa(v); };
      body = '<div class="ch-legend">' + legendItem(PMC[0], T('progress.pmc.ctl')) + legendItem(PMC[1], T('progress.pmc.atl')) + legendItem(PMC[2], T('progress.pmc.tsb')) + '</div>' +
        chartBox('pmc', {
          rtl: rtl, n: X.length, aria: T('progress.pmc.title'), zero: true,
          y: v0.length ? { min: Math.min(0, Math.min.apply(null, v0)), max: Math.max.apply(null, v0.concat([10])), fmt: sg, label: T('progress.pmc.unit') } : { min: 0, max: 40, fmt: sg, label: T('progress.pmc.unit') },
          lines: ['ctl', 'atl', 'tsb'].map(function (k, j) { return { values: X.map(function (d) { return none || d.future ? null : d[k]; }), color: PMC[j], dots: 'last' }; }),
          xLabels: function (i) { return faDate(X[i].date, true); }, xPx: 52,
          emptyLabel: none ? T('progress.pmc.empty') : null,
          tip: function (i) {
            var d = X[i];
            if (none || d.future) return null;
            return { title: faDate(d.date) + (d.load ? SEP + T('progress.pmc.load') + ' ' + fa(d.load) : ''), rows: [
              { color: PMC[0], label: T('progress.pmc.ctl'), value: fa(Math.round(d.ctl)) },
              { color: PMC[1], label: T('progress.pmc.atl'), value: fa(Math.round(d.atl)) },
              { color: PMC[2], label: T('progress.pmc.tsb'), value: signed(d.tsb) }] };
          }
        });
    } else {
      var last = D[D.length - 1], tsb = last.tsb;
      var rel = last.ctl ? tsb / last.ctl : 0;
      var st = rel > 0.05 ? 'fresh' : rel > -0.1 ? 'neutral' : rel > -0.3 ? 'tired' : 'veryTired';
      var vals = [];
      D.forEach(function (d) { vals.push(d.ctl, d.atl, d.tsb); });
      var r1 = function (x) { return fa(Math.round(x)); };
      body = '<div class="pstats">' + statTile(T('progress.pmc.ctl'), r1(last.ctl)) + statTile(T('progress.pmc.atl'), r1(last.atl)) +
        statTile(T('progress.pmc.tsb'), signed(tsb), esc(T('progress.pmc.' + st))) + '</div>' +
        '<ul class="pmc-keys">' +
        [['ctl', 0], ['atl', 1], ['tsb', 2]].map(function (k) {
          return '<li><i class="ch-key ch-key-line" style="background:' + PMC[k[1]] + '"></i><b>' + esc(T('progress.pmc.' + k[0])) + ':</b> ' + esc(T('progress.pmc.' + k[0] + 'Desc')) + '</li>';
        }).join('') + '</ul>' +
        chartBox('pmc', {
          rtl: rtl, n: D.length, aria: T('progress.pmc.title'), zero: true,
          y: { min: Math.min(0, Math.min.apply(null, vals)), max: Math.max.apply(null, vals), fmt: function (v) { return v < 0 ? '−' + fa(-v) : fa(v); }, label: T('progress.pmc.unit') },
          lines: [{ values: D.map(function (d) { return d.ctl; }), color: PMC[0], dots: 'last' },
            { values: D.map(function (d) { return d.atl; }), color: PMC[1], dots: 'last' },
            { values: D.map(function (d) { return d.tsb; }), color: PMC[2], dots: 'last' }],
          xLabels: function (i) { return faDate(D[i].date, true); }, xPx: 52,
          tip: function (i) {
            var d = D[i];
            return { title: faDate(d.date) + (d.load ? SEP + T('progress.pmc.load') + ' ' + fa(d.load) : ''), rows: [
              { color: PMC[0], label: T('progress.pmc.ctl'), value: fa(Math.round(d.ctl)) },
              { color: PMC[1], label: T('progress.pmc.atl'), value: fa(Math.round(d.atl)) },
              { color: PMC[2], label: T('progress.pmc.tsb'), value: signed(d.tsb) }] };
          }
        }) +
        dataTable([T('progress.date'), T('progress.pmc.load'), 'CTL', 'ATL', 'TSB'], D.filter(function (d, i) { return i % 7 === (D.length - 1) % 7; }).map(function (d) {
          return [esc(faDate(d.date, true)), fa(d.load), fa(Math.round(d.ctl)), fa(Math.round(d.atl)), signed(d.tsb)];
        }));
    }
    return progCard('pmc', T('progress.pmc.title'), T('progress.pmc.desc'), body, learnMore(['rpe', 'eighty']));
  }
  // ۵. پیش‌بینی زمان مسابقه (فقط هدف جاده‌ای با مسافت مشخص)
  function progPredCard(c) {
    var a = c.a, W = c.W, wkWithRuns = c.wkWithRuns, rtl = c.rtl, SEP = c.SEP, S = c.S, changed = c.changed;
    if (!(a.goal.km && !a.goal.ultra)) return '';
    var race = C.RACE_LABELS[a.goal.type], body;
    var P = S.filter(function (s) { return s.riegel; });
    if (a.entriesCount < 2 || !changed || P.length < 2) {
      var X = padWeeks(W, c.minW).map(function (w, i) { var s = a.samples[i]; return s && s.riegel ? s : { date: w.start }; });
      var vs = [];
      X.forEach(function (s) { if (s.riegel) vs.push(s.riegel, s.vdotTime); });
      var tf = function (v) { return fa(C.formatDuration(Math.round(v))); };
      body = '<div class="ch-legend">' + legendItem(SERIES[0], T('progress.pred.riegel')) + legendItem(HI, T('progress.pred.vdot')) + '</div>' +
        chartBox('pred', {
          rtl: rtl, n: X.length, aria: T('progress.pred.title', { race: race }), axisWidth: 58,
          y: vs.length ? { min: Math.min.apply(null, vs) - 10, max: Math.max.apply(null, vs) + 10, invert: true, fmt: tf } : BLANK_Y,
          lines: [{ values: X.map(function (s) { return s.riegel || null; }), color: SERIES[0], dots: 'last' },
            { values: X.map(function (s) { return s.riegel ? s.vdotTime : null; }), color: HI, dots: 'last' }],
          xLabels: function (i) { return faDate(X[i].date, true); }, xPx: 52,
          emptyLabel: vs.length ? null : T('progress.pred.empty'),
          tip: function (i) {
            var s = X[i];
            if (!s.riegel) return null;
            return { title: faDate(s.date), rows: [
              { color: SERIES[0], label: T('progress.pred.riegel'), value: tf(s.riegel) },
              { color: HI, label: T('progress.pred.vdot'), value: tf(s.vdotTime) }] };
          }
        });
    } else {
      var f = P[0], l = P[P.length - 1], dlt = l.riegel - f.riegel;
      var vals = [];
      P.forEach(function (s) { vals.push(s.riegel, s.vdotTime); });
      var dTxt = Math.abs(dlt) < 1 ? T('progress.pred.same') : T(dlt < 0 ? 'progress.pred.better' : 'progress.pred.worse', { t: C.formatDuration(Math.round(Math.abs(dlt))) });
      var marked = P.map(function (s, i) { return i === 0 || s.entry !== P[i - 1].entry; });
      body = '<div class="pstats">' + statTile(T('progress.pred.now'), '<span dir="ltr">' + fa(C.formatDuration(Math.round(l.riegel))) + '</span>') +
        statTile(T('progress.pred.delta'), fa(dTxt)) + '</div>' +
        '<div class="ch-legend">' + legendItem(SERIES[0], T('progress.pred.riegel')) + legendItem(HI, T('progress.pred.vdot')) +
        '<span class="lg-item lg-note">' + esc(T('progress.pace.faster')) + '</span></div>' +
        chartBox('pred', {
          rtl: rtl, n: P.length, aria: T('progress.pred.title', { race: race }),
          y: { min: Math.min.apply(null, vals) - 10, max: Math.max.apply(null, vals) + 10, invert: true, fmt: function (v) { return fa(C.formatDuration(Math.round(v))); } },
          axisWidth: 58,
          lines: [{ values: P.map(function (s) { return s.riegel; }), color: SERIES[0], step: true, dots: 'marked', marked: marked },
            { values: P.map(function (s) { return s.vdotTime; }), color: HI, step: true, dots: 'marked', marked: marked }],
          xLabels: function (i) { return faDate(P[i].date, true); }, xPx: 52,
          tip: function (i) {
            var s = P[i];
            return { title: faDate(s.date), rows: [
              { color: SERIES[0], label: T('progress.pred.riegel'), value: fa(C.formatDuration(Math.round(s.riegel))) },
              { color: HI, label: T('progress.pred.vdot'), value: fa(C.formatDuration(Math.round(s.vdotTime))) }] };
          }
        }) +
        dataTable([T('progress.date'), T('progress.pred.riegel'), T('progress.pred.vdot')], P.filter(function (s, i) { return marked[i]; }).map(function (s) {
          return [esc(faDate(s.entry, true)), fa(C.formatDuration(Math.round(s.riegel))), fa(C.formatDuration(Math.round(s.vdotTime)))];
        }));
    }
    return progCard('pred', T('progress.pred.title', { race: race }), T('progress.pred.desc'), body, learnMore(['vdot']));
  }
  // ۷. پایبندی به برنامه
  function progAdhCard(c) {
    var a = c.a, W = c.W, wkWithRuns = c.wkWithRuns, rtl = c.rtl, SEP = c.SEP, S = c.S, changed = c.changed;
    var A = a.adherence, body;
    if (!A.planned) {
      body = '<div class="adh-hero"><b dir="ltr">—</b><span>' + esc(T('progress.adh.empty')) + '</span></div><div class="adh-bar is-empty" aria-hidden="true"></div>';
    } else {
      var keys = ['completed', 'adapted', 'pain', 'missed'];
      var pct = function (n) { return Math.round(n / A.planned * 100); };
      var doneN = A.completed + A.adapted;
      body = '<div class="adh-hero"><b dir="ltr">' + tt('progress.adh.pct', { n: pct(doneN) }) + '</b><span>' + esc(T('progress.adh.rate')) + SEP + tt('progress.adh.of', { n: doneN, total: A.planned }) + '</span></div>' +
        '<div class="adh-bar" role="img" aria-label="' + esc(keys.map(function (k) { return T('progress.adh.' + k) + ' ' + pct(A[k]) + '%'; }).join('، ')) + '">' +
        keys.filter(function (k) { return A[k]; }).map(function (k) {
          return '<i title="' + esc(T('progress.adh.' + k)) + '" style="flex:' + A[k] + ';background:' + STATUS[k] + '"></i>';
        }).join('') + '</div>' +
        '<ul class="adh-legend">' + keys.map(function (k) {
          return '<li><i class="ch-key ch-key-bar" style="background:' + STATUS[k] + '"></i><span>' + esc(T('progress.adh.' + k)) + '</span><b>' + tt('progress.adh.count', { n: A[k], p: pct(A[k]) }) + '</b></li>';
        }).join('') + '</ul>';
    }
    return progCard('adh', T('progress.adh.title'), T('progress.adh.desc'), body);
  }
  // صبح یا عصر؟ ایزی ران و لانگ‌ران‌هایی که ساعت شروعشون ثبت شده، بر اساس بازه‌ی روز (از کل تاریخچه)
  function progTodCard() {
    var r = C.timeOfDayStats(state), body;
    var nm = function (k) { return T('progress.tod.slot.' + k); };
    var paces = r.slots.filter(function (b) { return b.pace; }).map(function (b) { return b.pace; }), fastest = Math.min.apply(null, paces.concat([Infinity]));
    // ردیف هر بازه‌ی روز؛ قبل از داده‌ی کافی هم نشون داده می‌شن و کم‌کم پر می‌شن
    var rows = '<div class="tod-rows">' + r.slots.map(function (b) {
      return '<div class="tod-row' + (r.enough && !r.same && b.key === r.best ? ' is-best' : '') + (b.runs ? '' : ' is-empty') + '">' +
        '<div class="tod-name"><b>' + esc(nm(b.key)) + '</b><small>' + esc(T('progress.tod.range.' + b.key)) + '</small></div>' +
        '<div class="tod-vals"><span>' + tt('progress.tod.runs', { n: b.runs }) + '</span>' +
        '<span>' + (b.pace ? tt('progress.tod.pace', { p: paceFmt(b.pace) }) : '—') + '</span>' +
        '<span>' + (b.rpe ? tt('progress.tod.rpe', { n: b.rpe.toFixed(1) }) : '—') + '</span></div>' +
        (b.pace ? '<div class="tod-bar" aria-hidden="true"><i style="width:' + Math.round(fastest / b.pace * 100) + '%"></i></div>' : '') + '</div>';
    }).join('') + '</div>';
    if (!r.enough) {
      body = '<p class="small muted tod-sofar">' + esc(fa(T('progress.tod.empty', { n: r.minRuns }))) + '</p>' + rows;
    } else {
      var best = r.slots.filter(function (b) { return b.key === r.best; })[0], next = r.slots.filter(function (b) { return b.key === r.next; })[0];
      var ns = function (k) { return T('progress.tod.slotS.' + k); };
      var verdict = r.same ? T('progress.tod.same', { a: ns(r.best), b: ns(r.next) }) : T('progress.tod.better', { best: ns(r.best), next: ns(r.next) });
      var why = [];
      if (!r.same && r.paceDiff != null && r.paceDiff > 0) why.push(T('progress.tod.paceDiff', { n: I.pace(r.paceDiff) }));
      if (!r.same && r.rpeDiff != null && Math.abs(r.rpeDiff) >= 0.1) why.push(T('progress.tod.rpeDiff', { a: best.rpe.toFixed(1), b: next.rpe.toFixed(1) }));
      body = '<p class="tod-verdict"><b>' + t(verdict) + '</b>' + (why.length ? ' ' + t(why.join(T('progress.sep'))) : '') + '</p>' + rows +
        '<p class="small muted">' + esc(T('progress.tod.note')) + '</p>';
    }
    return progCard('tod', T('progress.tod.title'), T('progress.tod.desc'), body);
  }
  // رسم بعد از قرار گرفتن در صفحه (عرض واقعی کادر) و دوباره با تغییر اندازه
  function drawCharts() {
    Object.keys(chartSpecs).forEach(function (id) {
      var el = document.getElementById('ch-' + id), sp = chartSpecs[id];
      if (!el) return;
      var w = el.clientWidth || 600, n = sp.n;
      sp.xTicks = window.CoachCharts.pickTicks(n, w, sp.xPx || 50, sp.xLabels);
      window.CoachCharts.render(el, sp);
    });
  }
  var resizeTimer = null, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (document.querySelector('.pcard .chart')) drawCharts(); }, 150);
  });
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-prange]');
    if (!b) return;
    settings.progressRange = b.dataset.prange;
    saveSettings();
    renderProgress();
  });

  // =====================================================================
  // آموزش: مقاله‌های کوتاه علمی (محتوا از js/i18n/learn-*.js)، هر مقاله در #learn/<شناسه>
  // =====================================================================
  var LEARN_ORDER = ['vdot', 'rpe', 'eighty', 'types', 'fartleks', 'tenpct', 'warmup', 'cycle'];
  // مقاله‌های مرتبط با هر نوع جلسه (لینک «بیشتر بدان» زیر جلسه)
  var SESSION_LEARN = {
    easy: ['eighty', 'rpe'], long: ['eighty', 'rpe'], runwalk: ['tenpct', 'rpe'], walkrun: ['tenpct', 'rpe'],
    tempo: ['types', 'vdot', 'warmup'], interval: ['types', 'vdot', 'warmup'], reps: ['types', 'vdot', 'warmup'],
    fartlek: ['fartleks', 'types', 'warmup'], hills: ['types', 'warmup'], race: ['vdot', 'warmup']
  };
  function learnTitle(id) { return T('learn.articles.' + id + '.title'); }
  function learnMore(ids) {
    if (!ids || !ids.length) return '';
    return '<p class="learn-more"><span>' + esc(T('learn.more')) + '</span> ' + ids.map(function (id) {
      return '<a href="#learn/' + id + '">' + esc(learnTitle(id)) + '</a>';
    }).join('<span class="sep" aria-hidden="true"> · </span>') + '</p>';
  }
  // زمان مطالعه از تعداد کلمه‌ها (حدود ۲۰۰ کلمه در دقیقه)
  function readMinutes(html) {
    var words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(function (w) { return w; }).length;
    return Math.max(1, Math.ceil(words / 200));
  }
  // دکمه‌ی برگشت مقاله: اگه از جای دیگه‌ای از برنامه اومده، همون‌جا (history.back با اسکرول و روز قبلی)؛ وگرنه فهرست مقاله‌ها
  function fromKey(h) { return h.slice(1).split('/')[0]; }
  function learnBack() {
    var s = navState(), from = s && s.depth > 0 ? s.from : null;
    var key = !from ? 'list' : from.indexOf('#learn/') === 0 ? 'article' : from === '#learn' ? 'list'
      : ['home', 'plan', 'progress', 'fitness', 'checkin', 'race', 'guide', 'profile'].indexOf(fromKey(from)) >= 0 ? fromKey(from) : 'other';
    if (from === '#' || from === '') key = 'home';
    return '<a class="learn-back" href="#learn"' + (from ? ' data-nav-back="1"' : '') + '>' + chevron(isRtl() ? 'right' : 'left') +
      esc(T('learn.backTo.' + key)) + '</a>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-nav-back]');
    if (!b) return;
    var s = navState();
    if (s && s.depth > 0) { e.preventDefault(); history.back(); }
  });
  function renderLearn(id) {
    if (id && LEARN_ORDER.indexOf(id) < 0) id = null;
    var html;
    if (!id) {
      html = '<header class="page-head"><h1>' + esc(T('learn.title')) + '</h1></header><p class="page-intro">' + T('learn.intro') + '</p>' +
        '<ul class="learn-list" aria-label="' + esc(T('learn.listAria')) + '">' + LEARN_ORDER.map(function (k, i) {
          var a = T('learn.articles.' + k);
          return '<li><a class="card learn-item" href="#learn/' + k + '"><span class="learn-num" aria-hidden="true">' + fa(i + 1) + '</span>' +
            '<span class="learn-text"><b>' + esc(a.title) + '</b><span class="small muted">' + esc(a.summary) + '</span>' +
            '<span class="learn-time">' + tt('learn.readMin', { n: readMinutes(a.body) }) + '</span></span></a></li>';
        }).join('') + '</ul>' + linkCard('#guide', T('app.nav.guide'), T('learn.guideSub'));
    } else {
      var a = T('learn.articles.' + id);
      var others = LEARN_ORDER.filter(function (k) { return k !== id; });
      html = '<article class="card learn-article"><p>' + learnBack() + '</p>' +
        '<h1>' + esc(a.title) + '</h1><p class="small muted">' + tt('learn.readMin', { n: readMinutes(a.body) }) + '</p>' +
        '<p class="lead">' + esc(a.summary) + '</p><div class="learn-body">' + a.body + '</div></article>' +
        '<nav class="card learn-others" aria-label="' + esc(T('learn.others')) + '"><h2>' + esc(T('learn.others')) + '</h2><ul>' +
        others.map(function (k) { return '<li><a href="#learn/' + k + '">' + esc(learnTitle(k)) + '</a></li>'; }).join('') + '</ul></nav>';
    }
    app.innerHTML = html;
  }

  // =====================================================================
  // راهنما: همه‌ی توضیح‌ها یک‌جا، بخش به بخش (محتوا از دیکشنری)
  // =====================================================================
  var GUIDE_ORDER = ['start', 'levels', 'week', 'sessions', 'intensity', 'fitness', 'checkin', 'goals', 'cycle', 'places', 'data'];
  function guideSections() {
    var levelRows = C.LEVELS.map(function (L) {
      return '<tr><td>' + fa(L.n) + '</td><td>' + esc(L.name) + '</td><td dir="ltr">' + fa(L.km[1] === Infinity ? L.km[0] + '+' : L.km[1] === 0 ? '0' : L.km[0] + '–' + L.km[1]) + '</td><td>' + esc(L.tier) + '</td></tr>';
    }).join('');
    var tiers = ['0', 'A', 'B', 'C', 'D', 'E'].map(function (k) {
      var ns = C.LEVELS.filter(function (L) { return L.tier === k; }).map(function (L) { return fa(L.n); });
      return '<li><b>' + esc(T('guide.levelOf', { ns: ns.join(T('guide.levelJoin')) })) + '</b> ' + esc(C.TIER_INFO[k]) + '</li>';
    }).join('');
    var ultraRows = ['flat', 'rolling', 'hilly', 'mountain'].map(function (k) {
      var u = C.ULTRA_CLASS_INFO[k];
      return '<li><b>' + esc(u.label) + ':</b> ' + esc(u.emphasis) + '</li>';
    }).join('');
    var tips = Object.keys(C.LOCATION_TIPS).map(function (k) { return '<li>' + esc(C.LOCATION_TIPS[k]) + '</li>'; }).join('');
    var focus = T('guide.focus');
    // جای‌گذاری‌ها: محتوای دیکشنری HTML معتبره؛ ورودی‌های پویا escape شدن
    var params = {
      levelRows: levelRows, tiers: tiers, ultraRows: ultraRows, tips: tips, pain: esc(C.PAIN_MESSAGE),
      speed: esc(focus.speed), half: esc(focus.half), marathon: esc(focus.marathon), ultra: esc(focus.ultra), general: esc(focus.general)
    };
    return GUIDE_ORDER.map(function (id) {
      return [id, T('guide.sections.' + id + '.title'), T('guide.sections.' + id + '.body', params)];
    });
  }

  function renderGuide() {
    var secs = guideSections();
    var html = '<section class="card"><h1>' + esc(T('guide.title')) + '</h1><nav class="guide-toc" aria-label="' + esc(T('guide.tocAria')) + '"><ol>' +
      secs.map(function (s) { return '<li><a href="#guide" data-guide="' + s[0] + '">' + esc(s[1]) + '</a></li>'; }).join('') +
      '</ol></nav></section>' +
      secs.map(function (s) {
        return '<details class="card guide-sec" id="g-' + s[0] + '"><summary><h2>' + esc(s[1]) + '</h2></summary><div class="guide-body">' + s[2] + '</div></details>';
      }).join('');
    app.innerHTML = html;
    var target = guideTarget;
    guideTarget = null;
    var el = target && document.getElementById('g-' + target);
    if (el) {
      el.open = true;
      el.scrollIntoView({ block: 'start' });
    } else window.scrollTo(0, 0);
  }

  // =====================================================================
  // به‌روزرسانی فیتنس: تایم‌تست/رکورد تازه → VDOT و همه‌ی پیس‌ها بازمحاسبه
  // =====================================================================
  var TEST_KINDS = [['t2', 2], ['t3', 3], ['t5', 5], ['race', null]];

  function renderFitness() {
    var p = state.profile, now = today();
    var z = C.paceZones(p);
    var fit = C.currentFitness(p);
    var rem = C.fitnessReminder(p, now);
    var hr = C.hrZones(p);
    var html = '<section class="card"><h1>' + esc(T('fit.title')) + ' ' + helpLink('fitness', T('fit.help')) + '</h1>' + learnMore(['vdot']);
    if (fit) {
      var e = fit.entry, weeks = Math.floor(C.daysBetween(C.parseDate(e.date), now) / 7);
      html += '<div class="fit-head"><div class="vdot-badge"><b>' + t(fit.vdot.toFixed(1)) + '</b><small>VDOT</small></div><div>' +
        '<p>' + tt('fit.entryLine', { label: T('fit.entry.' + (e.kind || 'record')), d: distName(e.distanceKm) }) + ' <span dir="ltr">' + fa(C.formatDuration(e.timeSec)) + '</span></p>' +
        '<p class="small muted">' + esc(faDate(e.date)) + (weeks > 0 ? tt('fit.weeksAgo', { n: weeks }) : esc(T('fit.thisWeek'))) + '</p></div></div>';
    } else {
      html += '<p>' + esc(T('fit.none')) + '</p>';
    }
    if (rem && rem.kind === 'stale') html += '<div class="alert alert-adapt" role="status"><p>' + t(rem.message) + '</p></div>';

    if (z && z.easy) {
      var adj = z.easyAdjustSec, P = C.paceSet(p, C.assessLevel(p).level);
      var row = function (key, a, b) {
        var r = T('fit.rows.' + key);
        var zn = { E: 2, M: 3, HM: 3, T: 4, K10: 4, K5: 5, I: 5, R: 5 }[key];
        return '<tr' + (key === 'E' ? ' class="hl"' : '') + '><td><span class="zdot z-' + zn + '" aria-hidden="true"></span>' + t(r[0]) + '</td><td dir="ltr">' + fa(paceFmt(a) + (b ? ' – ' + paceFmt(b) : '')) + '</td><td>' + t(r[1]) + '</td></tr>';
      };
      html += '<div class="table-wrap"><table class="pred-table pace-table"><thead><tr><th>' + esc(T('fit.thPace')) + '</th><th>' + esc(T('fit.thMinKm')) + '</th><th>' + esc(T('fit.thFor')) + '</th></tr></thead><tbody>' +
        row('E', z.easy[0], z.easy[1]) +
        row('M', (z.marathon[0] + z.marathon[1]) / 2, null) +
        row('HM', P.pHM, null) +
        row('T', z.tempo[0], z.tempo[1]) +
        row('K10', P.p10, null) +
        row('K5', P.p5, null) +
        row('I', z.interval[0], z.interval[1]) +
        row('R', z.reps[0], z.reps[1]) +
        '</tbody></table></div>' +
        '<div class="adjust-row"><p class="small">' + (adj ? tt('fit.adjusted', { n: adj }) : esc(T('fit.fromVdot'))) + '</p><div class="actions">' +
        (adj < C.EASY_ADJUST_MAX ? '<button type="button" class="btn btn-outline" id="fit-slow">' + tt('fit.slower') + '</button>' : '') +
        (adj ? '<button type="button" class="btn btn-ghost" id="fit-reset">' + esc(T('fit.reset')) + '</button>' : '') + '</div></div>';
    }
    if (hr) {
      html += '<p class="hr-line"><span class="zdot z-2" aria-hidden="true"></span>' + esc(T('fit.hr')) + ' <b>' + tt('fit.hrRange', { a: hr.easy[0], b: hr.easy[1] }) + '</b> ' + esc(T('fit.hrUnit')) +
        (hr.maxEstimated ? ' <span class="small muted">' + tt('fit.hrEst', { n: hr.max }) + '</span>' : '') + '</p>';
    }
    html += '</section>';

    // فرم ثبت تایم‌تست/رکورد تازه
    var todayKey = C.dateKey(now);
    // نقطه‌ی شروع چرخ‌ها: پیش‌بینی از VDOT فعلی، وگرنه حدود ۶ دقیقه در هر کیلومتر
    function fitGuess(km) {
      var f = C.currentFitness(p), sec = f ? C.raceTimeFromVdot(f.vdot, km) : km * 360;
      return Math.round(sec / 5) * 5;
    }
    html += '<section class="card"><h2>' + esc(T('fit.formTitle')) + ' ' + helpLink('fitness', T('fit.formHelp')) + '</h2>' +
      '<form id="fit-form" novalidate><div class="row3">' +
      '<div class="field"><label for="fk">' + esc(T('fit.kind')) + '</label><select id="fk" name="kind">' + TEST_KINDS.map(function (k) { return '<option value="' + k[0] + '">' + esc(T('fit.kinds.' + k[0])) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" id="fkm-field" hidden><label for="fkm">' + esc(T('fit.km')) + '</label><input id="fkm" name="km" type="number" inputmode="decimal"' + limAttrs('dist', '0.1') + '></div>' +
      '<div class="field field-tpick"><span class="field-label" id="ft-lbl">' + esc(T('fit.time')) + '</span>' +
      tpo({ id: 'ft', name: 'time', sec: fitGuess(2), touched: false, preview: 'ft-read',
        aria: T('fit.time'), }) +
      '<small class="muted">' + esc(T('fit.timeHint')) + '</small><small class="time-read" id="ft-read" aria-live="polite"></small></div>' +
      '<div class="field"><label for="fd">' + esc(T('fit.date')) + '</label><input id="fd" name="date" type="date" max="' + todayKey + '" value="' + todayKey + '"></div>' +
      '</div><p id="fit-err" class="form-errors" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primary">' + esc(T('fit.submit')) + '</button></form></section>';

    // تاریخچه
    var list = C.fitnessEntries(p).slice().reverse();
    if (list.length) {
      html += '<section class="card"><h2>' + esc(T('fit.history')) + '</h2><div class="table-wrap"><table class="pred-table fit-hist"><thead><tr><th>' + esc(T('fit.thDate')) + '</th><th>' + esc(T('fit.thKind')) + '</th><th>' + esc(T('fit.thDist')) + '</th><th>' + esc(T('fit.thTime')) + '</th><th>VDOT</th><th></th></tr></thead><tbody>' +
        list.map(function (e, i) {
          var idx = (p.fitnessTests || []).indexOf((p.fitnessTests || []).filter(function (x) { return x.date === e.date && x.timeSec === e.timeSec && x.distanceKm === e.distanceKm; })[0]);
          return '<tr' + (i === 0 ? ' class="hl"' : '') + '><td>' + esc(faDate(e.date, true)) + '</td><td>' + esc(e.kind ? T('fit.entry.' + e.kind) : '—') + '</td><td>' + t(distName(e.distanceKm)) + '</td>' +
            '<td dir="ltr">' + fa(C.formatDuration(e.timeSec)) + '</td><td>' + t(C.vdotFromRace(e.distanceKm, e.timeSec).toFixed(1)) + '</td>' +
            '<td>' + (e.kind !== 'baseline' && idx >= 0 ? '<button type="button" class="linklike" data-del-test="' + idx + '">' + esc(T('fit.del')) + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }

    // ضربان قلب
    html += '<section class="card"><h2>' + esc(T('fit.hrTitle')) + '</h2>' + hrFields(p) +
      '<p id="hr-err" class="form-errors" role="alert" hidden></p><button type="button" class="btn btn-outline" id="hr-save">' + esc(T('fit.hrSave')) + '</button></section>';

    app.innerHTML = html;

    var form = document.getElementById('fit-form');
    window.CoachTimePicker.init(form);
    // تا کاربر چرخ‌ها رو نچرخونده، روی زمان حدودی همون فاصله بمونن
    function presetFit() {
      var kind = form.kind.value, km = kind === 'race' ? kmIn(form.km) : TEST_KINDS.filter(function (k) { return k[0] === kind; })[0][1];
      if (km >= 1 && km <= 100) window.CoachTimePicker.preset('ft', fitGuess(km));
    }
    form.kind.addEventListener('change', function () { document.getElementById('fkm-field').hidden = form.kind.value !== 'race'; presetFit(); });
    form.km.addEventListener('change', presetFit);
    form.time.addEventListener('change', function () { document.getElementById('fit-err').hidden = true; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var kind = form.kind.value;
      var km = kind === 'race' ? kmIn(form.km) : TEST_KINDS.filter(function (k) { return k[0] === kind; })[0][1];
      var tm = C.parseTime(form.time.value), date = form.date.value;
      var err = document.getElementById('fit-err');
      var v = km && tm ? km / (tm / 3600) : 0;
      if (kind === 'race' && !inLim('dist', rawIn(form.km))) { err.hidden = false; err.textContent = fa(T('fit.err.km', limParams('dist'))); return; }
      if (!tm) { err.hidden = false; err.textContent = T('fit.err.time'); return; }
      if (v > 26 || v < 3) { err.hidden = false; err.textContent = fa(T('fit.err.impossible', { km: km, d: C.describeDuration(tm) })); return; }
      if (!date || date > todayKey) { err.hidden = false; err.textContent = T('fit.err.date'); return; }
      var before = C.paceZones(p);
      p.fitnessTests = (p.fitnessTests || []).concat([{ date: date, distanceKm: km, timeSec: tm, kind: kind === 'race' ? 'race' : 'test' }]);
      // تایم‌تست تازه = پیس‌ها از نو؛ تنظیم دستی قبلی دیگه لازم نیست
      p.easyAdjustSec = 0;
      save();
      var after = C.paceZones(p);
      var arrow = isRtl() ? ' ← ' : ' → ';
      notify({ key: 'vdot-' + date + '-' + tm, k: 'success', m: 'vdot', p: { v: after.vdot.toFixed(1) }, href: '#fitness', flash: false });
      showToast(fa(T('fit.toast', { vdot: (before && before.vdot ? before.vdot.toFixed(1) + arrow : '') + after.vdot.toFixed(1), a: paceFmt(after.easy[0]), b: paceFmt(after.easy[1]) })));
      renderFitness();
    });
    var slow = document.getElementById('fit-slow'), reset = document.getElementById('fit-reset');
    if (slow) slow.addEventListener('click', function () { p.easyAdjustSec = Math.min(C.EASY_ADJUST_MAX, (Number(p.easyAdjustSec) || 0) + 10); save(); renderFitness(); });
    if (reset) reset.addEventListener('click', function () { p.easyAdjustSec = 0; save(); renderFitness(); });
    app.querySelectorAll('[data-del-test]').forEach(function (b) {
      b.addEventListener('click', function () {
        p.fitnessTests.splice(Number(b.dataset.delTest), 1);
        save(); renderFitness();
      });
    });
    document.getElementById('hr-save').addEventListener('click', function () {
      var r = readHr(app), err = document.getElementById('hr-err');
      if (r.error) { err.hidden = false; err.textContent = r.error; return; }
      p.hrMax = r.max; p.hrRest = r.rest; save();
      showToast(T(C.hrZones(p) ? 'fit.hrSaved' : 'fit.hrCleared'));
      renderFitness();
    });
  }

  // فیلدهای ضربان (در فرم اولیه و صفحه‌ی فیتنس)
  function hrFields(p) {
    return '<p class="small muted">' + esc(T('hr.intro')) + ' ' + helpLink('intensity', T('hr.help')) + '</p>' +
      '<div class="row2"><div class="field"><label for="hrmax">' + esc(T('hr.max')) + '</label><input id="hrmax" name="hrMax" type="number" inputmode="numeric" min="120" max="230" value="' + esc(p.hrMax || '') + '"></div>' +
      '<div class="field"><label for="hrrest">' + esc(T('hr.rest')) + '</label><input id="hrrest" name="hrRest" type="number" inputmode="numeric" min="30" max="100" value="' + esc(p.hrRest || '') + '"></div></div>';
  }
  function readHr(root) {
    var mx = root.querySelector('#hrmax').value.trim(), rs = root.querySelector('#hrrest').value.trim();
    var max = mx ? Number(mx) : null, rest = rs ? Number(rs) : null;
    if (max !== null && !(max >= 120 && max <= 230)) return { error: T('hr.err.max') };
    if (rest !== null && !(rest >= 30 && rest <= 100)) return { error: T('hr.err.rest') };
    if (max !== null && rest !== null && rest >= max - 20) return { error: T('hr.err.gap') };
    return { max: max, rest: rest };
  }

  // =====================================================================
  // پروفایل
  // =====================================================================
  // نکته‌های ایمنی مخصوص این پروفایل (آسیب، سن، BMI، …)
  function warningsCard(list) {
    if (!list.length) return '';
    return '<section class="card warnings"><h2>' + esc(T('profile.warningsTitle')) + '</h2><ul>' +
      list.map(function (w) { return '<li>' + t(w) + '</li>'; }).join('') + '</ul></section>';
  }

  // نوع تقویم و روز شروع هفته؛ مستقل از زبان، ذخیره در localStorage
  function cycleSettings() {
    var p = state.profile;
    if (!p || p.sex !== 'female') return '';
    var c = p.cycle || {};
    return '<label class="check-row"><input type="checkbox" id="set-cycle"' + (c.enabled ? ' checked' : '') + (c.lastStart ? '' : ' disabled') + '> <span>' + esc(T('cycle.settingsEnabled')) + '</span></label>' +
      '<label class="check-row"><input type="checkbox" id="set-cymark"' + (settings.cycleMarkers !== false ? ' checked' : '') + (c.enabled ? '' : ' disabled') + '> <span>' + esc(T('cycle.settingsMarkers')) + '</span></label>' +
      (c.lastStart ? '' : '<p class="small muted">' + esc(T('cycle.settingsNeedData')) + '</p>');
  }
  app.addEventListener('change', function (e) {
    var el = e.target;
    if (el.id === 'set-cycle') {
      state.profile.cycle = Object.assign({}, state.profile.cycle, { enabled: el.checked });
      save(); showToast(T('settings.saved')); route();
      return;
    }
    if (el.id === 'set-cymark') {
      settings.cycleMarkers = el.checked;
      saveSettings(); showToast(T('settings.saved')); route();
      return;
    }
    if (el.id !== 'set-cal' && el.id !== 'set-ws') return;
    settings[el.name] = el.value;
    saveSettings();
    applyStatic();
    showToast(T('settings.saved'));
    route();
  });

  app.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-setlang]');
    if (b && b.dataset.setlang !== I.getLang()) switchLang(b.dataset.setlang);
    var ub = e.target.closest && e.target.closest('[data-setunits]');
    if (ub && ub.dataset.setunits !== settings.units) {
      settings.units = ub.dataset.setunits; saveSettings(); I.setUnits(settings.units);
      showToast(T('settings.saved')); route();
    }
    var tb = e.target.closest && e.target.closest('[data-settheme]');
    if (tb && tb.dataset.settheme !== settings.theme) {
      settings.theme = tb.dataset.settheme; saveSettings(); applyTheme();
      openSettings.theme = true; route();
    }
  });
  // ---------- عکس پروفایل: فقط در همین مرورگر (localStorage)، کوچک‌شده به ۳۰۰×۳۰۰ ----------
  var AVATAR_KEY = 'iranrunners-coach-avatar', AVATAR_PX = 300, AVATAR_MAX_BYTES = 120 * 1024;
  function getAvatar() { try { return localStorage.getItem(AVATAR_KEY); } catch (e) { return null; } }
  function avatarHtml(size) {
    var src = getAvatar(), p = state.profile, name = (p && p.name || '').trim();
    if (src) return '<img class="avatar-img" src="' + esc(src) + '" alt="" width="' + size + '" height="' + size + '">';
    if (name) return '<span class="avatar-initial" aria-hidden="true">' + esc(Array.from(name)[0].toUpperCase()) + '</span>';
    // آیکون دونده
    return '<svg class="avatar-runner" viewBox="0 0 24 24" width="' + Math.round(size * 0.5) + '" height="' + Math.round(size * 0.5) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="14.5" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5"/><path d="M6.5 12.5 9 9l4-.5 2.5 3.5 3 1"/><path d="M11 15l2-6.5"/></svg>';
  }
  // برش مربعی از وسط و کوچک کردن؛ JPEG با کیفیت کم‌شونده تا زیر سقف حجم بره
  function shrinkImage(file, done, fail) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var side = Math.min(img.naturalWidth, img.naturalHeight), out = Math.min(AVATAR_PX, side);
      var c = document.createElement('canvas');
      c.width = c.height = out;
      var g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
      var q = 0.85, data = c.toDataURL('image/jpeg', q);
      while (data.length > AVATAR_MAX_BYTES * 1.37 && q > 0.4) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
      done(data);
    };
    img.onerror = function () { URL.revokeObjectURL(url); fail(); };
    img.src = url;
  }
  app.addEventListener('change', function (e) {
    if (e.target.id !== 'avatar-file') return;
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { showToast(T('profile.photoBad')); return; }
    shrinkImage(f, function (data) {
      try { localStorage.setItem(AVATAR_KEY, data); showToast(T('profile.photoSaved')); }
      catch (err) { showToast(T('profile.photoFull')); }
      refreshAvatars();
    }, function () { showToast(T('profile.photoBad')); });
  });
  app.addEventListener('click', function (e) {
    if (!(e.target.closest && e.target.closest('[data-avatar-remove]'))) return;
    try { localStorage.removeItem(AVATAR_KEY); } catch (err) { /* */ }
    refreshAvatars();
  });
  // همه‌ی جاهایی که عکس نشون داده می‌شه (هدر، فرم ویرایش، پروفایل)
  function refreshAvatars() {
    document.querySelectorAll('[data-avatar-slot]').forEach(function (el) { el.innerHTML = avatarHtml(Number(el.dataset.avatarSlot)); });
    var has = !!getAvatar(), rm = document.querySelector('[data-avatar-remove]'), pick = document.querySelector('label[for="avatar-file"]');
    if (rm) rm.hidden = !has;
    if (pick) pick.textContent = T(has ? 'profile.photoChange' : 'profile.photoPick');
    var f = document.getElementById('avatar-file');
    if (f) f.value = '';
    updateHeader();
  }

  // کارت لینک یک‌خطی به یک صفحه‌ی فرعی
  function linkCard(href, title, sub) {
    return '<a class="card link-card" href="' + href + '"><span><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
      chevron(isRtl() ? 'left' : 'right') + '</a>';
  }

  // ---------- پروفایل: فقط عکس، نام، سطح، هدف و ورود به تنظیمات ----------
  function renderProfile() {
    var p = state.profile, lv = C.assessLevel(p), g = C.goalInfo(p), race = C.raceInfo(p), now = today();
    // نام کامل (نام خانوادگی از مرحله‌ی ۱ فرم)
    var name = [p.name, p.lastName].map(function (x) { return (x || '').trim(); }).filter(Boolean).join(' ');
    var joined = p.createdAt && !isNaN(new Date(p.createdAt)) ? I.monthTitle(new Date(p.createdAt)) : null;
    var fit = C.currentFitness(p), lastGait = (state.gaitReports || [])[0];
    app.innerHTML = '<section class="pf-head">' +
      '<span class="pf-avatar" data-avatar-slot="96">' + avatarHtml(96) + '</span>' +
      '<h1 class="pf-name">' + esc(name || T('profile.noName')) + '</h1>' +
      (joined ? '<p class="pf-joined">' + esc(T('profile.joined', { d: joined })) + '</p>' : '') +
      (name ? '' : '<p class="small muted">' + esc(T('profile.noNameHint')).replace('{link}', '<a href="#onboarding">' + esc(T('profile.noNameLink')) + '</a>') + '</p>') +
      '<a class="btn btn-ink pf-edit" href="#onboarding">' + esc(T('profile.edit')) + '</a></section>' +
      (walker() ? walkGoalCard(p, now) : profileGoalCard(p, g, race, now)) +
      '<a class="card pf-level" href="' + (walker() ? '#plan' : '#plans') + '"><span class="pf-level-badge" aria-hidden="true"><b>' + fa(lv.level) + '</b><small>' + esc(T('level.of10')) + '</small></span>' +
      '<span class="pf-level-text"><b>' + tt('level.title', { n: lv.level, name: lv.info.name }) + '</b><small>' + esc(T(walker() ? 'profile.levelLinkWalk' : 'profile.levelLink')) + '</small></span>' + chevron(isRtl() ? 'left' : 'right') + '</a>' +
      periodCard(p, now, race) +
      listGroup(T('profile.groups.mine'), walker() ? [['#progress', 'chart', T('profile.tabs.progress'), T('profile.rowProgressWalk')],
        ['#walkgoals', 'flag', T('wgoal.pageTitle'), C.walkGoalInfo(p).kind !== 'none' ? T('wgoal.' + C.walkGoalInfo(p).kind + '.t') : T('profile.goalSetShort')],
        ['#settings', 'bell', T('remind.title'), remindSub(), 'remind']] : [
        ['#progress', 'chart', T('profile.tabs.progress'), T('profile.rowProgress')],
        ['#race', 'flag', T('race.pageTitle'), g.type !== 'none' ? C.goalLabel(g) + (race && race.date >= now ? T('progress.sep') + T('profile.goalIn', { n: Math.round(C.daysBetween(now, race.date)) }) : '') : T('profile.goalSetShort')],
        ['#plans', 'plans', T('plans.title'), T('plans.linkSub')],
        ['#fitness', 'watch', T('profile.linkFitness'), fit ? 'VDOT ' + fit.vdot.toFixed(1) : T('profile.registerTest')],
        ['#gait', 'gait', T('profile.tabs.gait'), lastGait && lastGait.v >= 2 && lastGait.score != null ? T('profile.rowGaitLast', { d: faDate(lastGait.date), s: lastGait.score }) : T('profile.rowGait')]
      ]) +
      listGroup(T('profile.groups.prefs'), [
        ['#settings', 'lang', T('settingsPage.lang'), (I.getLang() === 'fa' ? 'فارسی' : 'English') + T('progress.sep') + T('units.' + I.getUnits()), 'lang'],
        ['#settings', 'cal', T('settingsPage.cal'), T('settings.' + I.getCalendar()), 'cal'],
        ['#settings', 'health', T('settingsPage.health'), T(p.sex === 'female' ? ((p.cycle || {}).enabled ? 'settingsPage.cycleOn' : 'settingsPage.cycleOff') : 'settingsPage.cycleNA'), 'health'],
        ['#settings', 'person', T('settingsPage.person'), T('settingsPage.personSub', { age: p.age, n: lv.level }), 'person'],
        ['#settings', 'install', T('install.title'), T('install.short.' + installMode()), 'install'],
        ['#settings', 'data', T('settingsPage.data'), T('profile.statsVal', { c: Object.keys(state.checkins).length, d: Object.keys(state.done).length }), 'data']
      ]) + '<section class="card">' + signOutBlock() + '</section>' +
      '';
  }
  // کارت هدف اصلی (گرادیان کارت به primary-soft): شمارش معکوس، زمان هدف، بقیه‌ی مسابقه‌ها
  function profileGoalCard(p, g, race, now) {
    var head = '<span class="eyebrow">' + esc(T('race.mainLabel')) + '</span>';
    if (g.type === 'none') {
      return '<a class="card pf-goalcard" href="#race">' + head + '<b class="pf-goal-name">' + esc(T('profile.noGoal')) + '</b>' +
        '<span class="pf-goal-cta">' + esc(T('profile.goalSet')) + '</span></a>';
    }
    var days = race ? Math.round(C.daysBetween(now, race.date)) : null, gp = C.goalPath(p, now);
    var nOther = goalList(p).filter(function (r) { return !r.date || r.date >= now; }).length;
    var bits = [];
    if (g.targetSec) bits.push(T('race.targetLine', { t: C.formatDuration(g.targetSec) }));
    if (nOther) bits.push(T('profile.goalOthers', { n: nOther }));
    return '<a class="card pf-goalcard" href="#race">' + head + '<b class="pf-goal-name">' + t(C.goalLabel(g)) + '</b>' +
      (race && days >= 0 ? '<span class="pf-goal-count"><b>' + fa(days) + '</b> ' + esc(T('race.daysLeft', { n: days })) + T('progress.sep') + esc(faDate(g.date)) + '</span>'
        : '<span class="pf-goal-count">' + esc(T(g.date ? 'race.done' : 'race.noDate')) + '</span>') +
      (bits.length ? '<span class="pf-goal-meta">' + t(bits.join(T('progress.sep'))) + '</span>' : '') +
      (gp && !gp.past ? pathBar(gp) + '<span class="pf-goal-meta">' + t(pathEta(gp)) + '</span>' : '') +
      '<span class="pf-goal-cta">' + esc(T('profile.goalManage')) + '</span></a>';
  }
  // فهرست ردیفی (سبک Runna): عنوان گروه، ردیف‌ها با آیکون و فلش، در یک کارت
  function listGroup(label, rows) {
    return '<p class="group-label" role="heading" aria-level="2">' + esc(label) + '</p><nav class="card list-group" aria-label="' + esc(label) + '">' + listRows(rows) + '</nav>';
  }
  function listRows(rows) {
    return rows.map(function (r) {
      return '<a class="list-row" href="' + r[0] + '"' + (r[4] ? ' data-set-open="' + r[4] + '"' : '') + '>' +
        '<span class="lr-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + SET_ICONS[r[1]] + '</svg></span>' +
        '<span class="lr-text"><b>' + esc(r[2]) + '</b>' + (r[3] ? '<small>' + t(r[3]) + '</small>' : '') + '</span>' + chevron(isRtl() ? 'left' : 'right') + '</a>';
    }).join('');
  }
  // ردیف تنظیمات در پروفایل: همون بخش در صفحه‌ی تنظیمات باز و دیده می‌شه
  document.addEventListener('click', function (e) {
    var r = e.target.closest && e.target.closest('[data-set-open]');
    if (!r) return;
    openSettings = {};
    openSettings[r.dataset.setOpen] = true;
    pendingFocus = 'set-' + r.dataset.setOpen;
  }, true);
  // ---------- «پیشرفت» و «بیومکانیک»: صفحه‌های جدا زیر پروفایل (ردیف‌های «بخش‌های من») ----------
  // محتوا داخل #pf-panel ساخته می‌شه (renderProgress و renderGait)، با همون استایل پروفایل
  function pfPanel() { return document.getElementById('pf-panel'); }
  function subPage(kind, title) {
    chartSpecs = {};
    app.innerHTML = '<header class="page-head"><h1>' + esc(title) + '</h1></header><div class="pf-panel" id="pf-panel" data-tab="' + kind + '"></div>';
  }
  function renderProgressPage() { subPage('progress', T('profile.tabs.progress')); renderProgress(); }
  function renderGaitPage() { subPage('gait', T('profile.tabs.gait')); renderGait(); }
  // تمرین در روزهای پریود: پیش‌فرض + تغییر دستی فقط برای یک دوره‌ی مشخص (مثلاً نزدیک مسابقه)
  function periodCard(p, now, race) {
    if (!C.cycleInfo(p, now)) return '';
    var c = p.cycle, def = C.PERIOD_MODES.indexOf(c.periodMode) >= 0 ? c.periodMode : null;
    var html = '<section class="card period-card" id="period-card" aria-labelledby="period-card-h"><h2 id="period-card-h">' + esc(T('cycle.pcTitle')) + '</h2>';
    var foot = '<p class="small muted">' + esc(T('cycle.pcEstimate')) + '</p></section>';
    if (!def) {
      return html + '<p>' + esc(T('cycle.pcDefaultNone')) + '</p><div class="period-opts period-opts-3">' +
        C.PERIOD_MODES.map(function (m) { return '<button type="button" data-period-default="' + m + '">' + esc(T('cycle.mode.' + m)) + '</button>'; }).join('') + '</div>' + foot;
    }
    html += '<p class="period-def">' + esc(T('cycle.pcDefault', { mode: T('cycle.modeShort.' + def) })) +
      ' <a href="#onboarding" data-onb-focus="cycle">' + esc(T('cycle.pcEditDefault')) + '</a></p>' +
      '<p class="small muted">' + esc(T('cycle.pcIntro')) + '</p>';
    html += C.periodsAhead(p, now, 1).map(function (e) {
      var badges = '';
      if (e.current) badges += '<span class="pill pill-level">' + esc(T('cycle.pcNow')) + '</span>';
      if (race) {
        var toRace = C.daysBetween(C.parseDate(e.end), race.date);
        if (C.daysBetween(C.parseDate(e.start), race.date) >= 0 && toRace <= 0) badges += '<span class="pill pill-race">' + esc(T('cycle.pcRaceIn')) + '</span>';
        else if (toRace > 0 && toRace <= 10) badges += '<span class="pill pill-race">' + tt('cycle.pcRaceAfter', { n: toRace }) + '</span>';
      }
      var cur = e.overridden ? e.mode : 'default';
      var opts = [['default', T('cycle.pcUseDefault'), T('cycle.modeShort.' + def)]].concat(C.PERIOD_MODES.map(function (m) { return [m, T('cycle.modeShort.' + m), '']; }));
      var range = T('cycle.pcRange', { a: faDate(e.start, true), b: faDate(e.end, true) });
      return '<div class="period-row' + (e.overridden ? ' is-custom' : '') + '"><div class="period-when"><b>' + t(range) + '</b>' + badges + '</div>' +
        '<div class="period-opts" role="group" aria-label="' + esc(T('cycle.pcAria', { d: faDate(e.start, true) })) + '">' + opts.map(function (o) {
          return '<button type="button" data-period-start="' + e.start + '" data-period-key="' + esc(e.overrideKey || '') + '" data-period-mode="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' +
            esc(o[1]) + (o[2] ? '<small>' + esc(o[2]) + '</small>' : '') + '</button>';
        }).join('') + '</div></div>';
    }).join('');
    return html + foot;
  }

  // ---------- تنظیمات: دسته‌های جمع‌وبازشونده ----------
  var SET_ICONS = {
    lang: '<path d="M4 5h8M8 3v2M5.5 5c.8 3.5 3.3 6.2 6.5 7.5M11 5c-.8 4-3.4 7.2-7 8.5"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    bell: '<path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9z"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/>',
    health: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    person: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
    install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v8M8.8 11.8 12 15l3.2-3.2"/>',
    data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h12l-2.5 4 2.5 4h-12"/>',
    plans: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>',
    chart: '<path d="M4 20h16"/><path d="M7 16v-4M12 16V8M17 16v-7"/><path d="m5 10 5-4 4 3 5-5"/>',
    gait: '<circle cx="14.5" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5"/><path d="M6.5 12.5 9 9l4-.5 2.5 3.5 3 1"/><path d="M11 15l2-6.5"/>',
    watch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5M18.5 6.5 20 5"/>',
    theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>'
  };
  var THEME_ICON = {
    auto: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 6.5a5.5 5.5 0 0 0 0 11z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
  };
  var openSettings = {};
  function setSection(id, icon, title, sub, body) {
    return '<details class="card set-sec" id="set-' + id + '"' + (openSettings[id] ? ' open' : '') + '><summary>' +
      '<span class="set-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + SET_ICONS[icon] + '</svg></span>' +
      '<span class="set-head"><b>' + esc(title) + '</b><small>' + sub + '</small></span><span class="set-chev" aria-hidden="true"></span></summary>' +
      '<div class="set-body">' + body + '</div></details>';
  }
  app.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.classList && d.classList.contains('set-sec')) openSettings[d.id.slice(4)] = d.open;
  }, true);
  function renderSettings() {
    var p = state.profile, bmi = C.bmi(p);
    var lv = C.assessLevel(p), hrz = C.hrZones(p), fit = C.currentFitness(p), g = C.goalInfo(p), c = p.cycle || {};
    var nCheck = Object.keys(state.checkins).length, nDone = Object.keys(state.done).length;
    var muted = function (key) { return '<span class="muted">' + esc(T(key)) + '</span>'; };
    function row(k, v) { return '<div class="kv"><dt>' + esc(T('profile.rows.' + k)) + '</dt><dd>' + v + '</dd></div>'; }
    function sel(id, name, cur, opts) {
      return '<select id="' + id + '" name="' + name + '">' + opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    }
    var lang = I.getLang(), D = C.DAY_NAMES;
    var html = '<header class="page-head"><h1>' + esc(T('settingsPage.title')) + '</h1></header>' +
      '<p class="group-label" role="heading" aria-level="2">' + esc(T('profile.groups.prefs')) + '</p><div class="set-list">' +
      // ظاهر: خودکار (مثل گوشی)، روشن، تیره
      setSection('theme', 'theme', T('theme.title'), esc(T('theme.' + settings.theme) + (settings.theme === 'auto' ? T('progress.sep') + T(isLightTheme() ? 'theme.nowLight' : 'theme.nowDark') : '')),
        '<div class="seg theme-seg" role="group" aria-label="' + esc(T('theme.title')) + '">' + ['auto', 'light', 'dark'].map(function (k) {
          return '<button type="button" data-settheme="' + k + '" aria-pressed="' + (settings.theme === k) + '">' + THEME_ICON[k] + esc(T('theme.' + k)) + '</button>';
        }).join('') + '</div><small class="muted">' + esc(T('theme.hint')) + '</small>') +
      // ۱. زبان و نمایش
      setSection('lang', 'lang', T('settingsPage.lang'), esc((lang === 'fa' ? 'فارسی' : 'English') + T('progress.sep') + T('units.' + I.getUnits())),
        '<div class="field"><span class="field-label">' + esc(T('settings.language')) + '</span><div class="seg lang-seg" role="group" aria-label="' + esc(T('settings.language')) + '">' +
        '<button type="button" data-setlang="fa" lang="fa" aria-pressed="' + (lang === 'fa') + '">فارسی</button>' +
        '<button type="button" data-setlang="en" lang="en" aria-pressed="' + (lang === 'en') + '">English</button></div></div>' +
        '<div class="field"><span class="field-label" id="units-lbl">' + esc(T('settings.units')) + '</span><div class="seg" role="group" aria-labelledby="units-lbl">' +
        ['km', 'mi'].map(function (u) { return '<button type="button" data-setunits="' + u + '" aria-pressed="' + (I.getUnits() === u) + '">' + esc(T('units.opt.' + u)) + '</button>'; }).join('') +
        '</div><small class="muted">' + esc(T('settings.unitsNote')) + '</small></div>') +
      // یادآوری جلسه‌ها
      setSection('remind', 'bell', T('remind.title'), esc(remindSub()), remindSection()) +
      // نصب اپلیکیشن
      setSection('install', 'install', T('install.title'), esc(T('install.short.' + installMode())), installSectionBody()) +
      // ۲. تقویم
      setSection('cal', 'cal', T('settingsPage.cal'), tt('settings.current', { cal: T('settings.' + I.getCalendar()), day: C.DAY_NAMES[C.WEEK_ORDER[0]] }),
        '<div class="row2"><div class="field"><label for="set-cal">' + esc(T('settings.calendar')) + '</label>' +
        sel('set-cal', 'calendar', settings.calendar, [['auto', T('settings.auto')], ['jalali', T('settings.jalali')], ['gregorian', T('settings.gregorian')]]) + '</div>' +
        '<div class="field"><label for="set-ws">' + esc(T('settings.weekStart')) + '</label>' +
        sel('set-ws', 'weekStart', settings.weekStart, [['auto', T('settings.auto')], ['sat', D[0]], ['sun', D[1]], ['mon', D[2]]]) + '</div></div>' +
        '<p class="small muted">' + esc(T('settings.note')) + '</p>') +
      // ۳. سلامت و چرخه
      setSection('health', 'health', T('settingsPage.health'),
        esc(p.sex === 'female' ? T(c.enabled ? 'settingsPage.cycleOn' : 'settingsPage.cycleOff') : T('settingsPage.cycleNA')),
        (p.sex === 'female' ? cycleSettings() +
          (c.lastStart ? '<p class="small muted">' + tt('cycle.profileOn', { len: c.cycleLen, p: c.periodLen }) + T('progress.sep') + esc(T('profile.cycleLast', { d: faDate(c.lastStart) })) + '</p>' : '') +
          '<a class="btn btn-outline" href="#onboarding" data-onb-focus="cycle">' + esc(T('profile.cycleEdit')) + '</a>'
          : '<p class="small muted">' + esc(T('settingsPage.cycleHint')) + '</p><a class="btn btn-outline" href="#onboarding" data-onb-focus="cycle">' + esc(T('profile.editOnb')) + '</a>')) +
      '</div><p class="group-label" role="heading" aria-level="2">' + esc(T('settingsPage.account')) + '</p><div class="set-list">' +
      // ۴. اطلاعات شخصی
      setSection('person', 'person', T('settingsPage.person'), tt('settingsPage.personSub', { age: p.age, n: lv.level }),
        '<div class="field"><label for="set-name">' + esc(T('onb.firstName')) + '</label>' +
        '<input id="set-name" type="text" maxlength="40" autocomplete="given-name" value="' + esc(p.name || '') + '" placeholder="' + esc(T('onb.firstNamePh')) + '"></div>' +
        '<div class="field"><label for="set-lname">' + esc(T('onb.lastName')) + '</label>' +
        '<input id="set-lname" type="text" maxlength="40" autocomplete="family-name" value="' + esc(p.lastName || '') + '" placeholder="' + esc(T('onb.lastNamePh')) + '"></div>' +
        '<a class="btn btn-primary" href="#onboarding">' + esc(T('profile.editOnb')) + '</a>' +
        '<p class="small muted">' + esc(T('profile.editHint')) + '</p>' +
        '<dl class="kv-list">' +
      row('level', tt('profile.levelVal', { n: lv.level, name: lv.info.name }) +
        (lv.vdot ? ' <span class="muted small">(VDOT ' + t(lv.vdot.toFixed(1)) + ')</span>' : '')) +
      row('exp', esc(C.EXPERIENCE[p.experience] ? C.EXPERIENCE[p.experience].label : '—')) +
      row('structured', esc(T(p.structured ? 'profile.structYes' : 'profile.structNo'))) +
      row('hr', hrz ? tt('profile.hrVal', { a: hrz.easy[0], b: hrz.easy[1] }) : muted('profile.notEntered')) +
      row('fitness', fit ? 'VDOT ' + t(fit.vdot.toFixed(1)) + ' · <a href="#fitness">' + esc(T('profile.details')) + '</a>' : '<a href="#fitness">' + esc(T('profile.registerTest')) + '</a>') +
      row('km', p.monthAvgKm != null && p.experience !== 'never' ? tt('profile.kmVal2', { last: p.lastWeekKm, avg: p.monthAvgKm, start: lv.volume ? lv.volume.start : p.currentWeeklyKm })
        : tt('profile.kmVal', { n: p.currentWeeklyKm })) +
      row('body', tt('profile.bodyVal', { age: p.age, w: p.weightKg, h: p.heightCm }) + ' <span class="muted small">(BMI ' + t(bmi.toFixed(1)) + ')</span>') +
      row('days', esc(C.WEEK_ORDER.filter(function (d) { return p.days.indexOf(d) >= 0; }).map(function (d) { return C.DAY_NAMES[d]; }).join(T('app.listSep')))) +
      row('locs', esc(p.locations.map(function (l) { return C.LOCATION_LABELS[l]; }).join(T('app.listSep')))) +
      (p.sex ? row('sex', esc(T('cycle.sex.' + p.sex))) : '') +
      (p.sex === 'female' ? row('cycle', p.cycle && p.cycle.enabled ? tt('cycle.profileOn', { len: p.cycle.cycleLen, p: p.cycle.periodLen }) : muted('cycle.profileOff')) : '') +
      row('injury', p.injury ? t(p.injury) : muted('profile.notRecorded')) +
      row('goal', g.type !== 'none' ? t(C.goalLabel(g)) + (g.date ? ' — ' + esc(faDate(g.date)) : ' <span class="muted small">' + esc(T('profile.noDate')) + '</span>') : muted('profile.noGoal')) +
      row('pb', p.pb ? tt('profile.pbVal', { d: distName(p.pb.distanceKm) }) + ' <span dir="ltr">' + fa(C.formatDuration(p.pb.timeSec)) + '</span>' : muted('profile.notRecorded')) +
      row('start', esc(faDate(p.startDate))) +
      row('stats', tt('profile.statsVal', { c: nCheck, d: nDone })) +
        '</dl>' + '<div class="level-strip">' + levelCard(lv, true) + '</div>' + warningsCard(C.profileWarnings(p, today()))) +
      // ۵. داده‌ها
      setSection('data', 'data', T('settingsPage.data'), tt('profile.statsVal', { c: nCheck, d: nDone }),
        '<div class="actions">' +
        '<button type="button" class="btn btn-outline" id="restart">' + esc(T('profile.restart')) + '</button>' +
        '<button type="button" class="btn btn-ghost" id="logout">' + esc(T('login.logout')) + '</button></div>' +
        '<div class="danger-zone"><b>' + esc(T('settingsPage.dangerTitle')) + '</b><p class="small">' + esc(T('settingsPage.dangerText')) + '</p>' +
        '<button type="button" class="btn btn-danger-outline" id="wipe">' + esc(T('profile.wipe')) + '</button></div>' +
        '<div id="confirm-box" class="alert confirm-box confirm-danger" role="alertdialog" aria-live="polite" hidden>' +
        '<p id="confirm-text"></p>' +
        '<label class="check-row" id="confirm-ack-row" hidden><input type="checkbox" id="confirm-ack"> <span>' + esc(T('settingsPage.wipeAck')) + '</span></label>' +
        '<div class="actions"><button type="button" class="btn btn-primary" id="confirm-yes">' + esc(T('profile.confirmYes')) + '</button>' +
        '<button type="button" class="btn btn-ghost" id="confirm-no">' + esc(T('app.cancel')) + '</button></div></div>') + '</div>';
    app.innerHTML = html;

    // تایید داخل صفحه؛ برای پاک کردن داده‌ها تیک «غیرقابل بازگشت» هم لازمه
    var pending = null;
    function ask(text, action, needAck) {
      pending = action;
      document.getElementById('confirm-text').textContent = text;
      document.getElementById('confirm-ack-row').hidden = !needAck;
      document.getElementById('confirm-ack').checked = false;
      document.getElementById('confirm-yes').disabled = !!needAck;
      document.getElementById('confirm-box').hidden = false;
      document.getElementById(needAck ? 'confirm-ack' : 'confirm-yes').focus();
    }
    document.getElementById('confirm-ack').addEventListener('change', function (e) { document.getElementById('confirm-yes').disabled = !e.target.checked; });
    document.getElementById('confirm-no').addEventListener('click', function () {
      pending = null;
      document.getElementById('confirm-box').hidden = true;
    });
    document.getElementById('confirm-yes').addEventListener('click', function () {
      var a = pending; pending = null;
      if (a) a();
    });
    document.getElementById('restart').addEventListener('click', function () {
      ask(T('profile.restartQ'), function () {
        state.profile.startDate = C.dateKey(today());
        save(); showToast(T('profile.restartToast'));
        location.hash = '#home';
      });
    });
    document.getElementById('logout').addEventListener('click', function () {
      setEntered(false);
      route();
      window.scrollTo(0, 0);
    });
    document.getElementById('wipe').addEventListener('click', function () {
      ask(T('profile.wipeQ'), function () {
        state = emptyState();
        try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(AVATAR_KEY); } catch (e) { /* */ }
        memoryFallback = null;
        location.hash = '#onboarding';
        route();
      }, true);
    });
  }
  // نام و نام خانوادگی (اختیاری)
  app.addEventListener('change', function (e) {
    var f = { 'set-name': 'name', 'set-lname': 'lastName' }[e.target.id];
    if (!f) return;
    state.profile[f] = e.target.value.trim().slice(0, 40);
    save(); showToast(T('settings.saved'));
  });

  // =====================================================================
  // نصب اپلیکیشن (PWA): اندروید/کروم با پنجره‌ی نصب مستقیم، آیفون با راهنمای «افزودن به صفحه‌ی اصلی»
  // =====================================================================
  var installEvt = null, INSTALL_DISMISS_KEY = 'iranrunners-coach-install-dismissed';
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function isIos() {
    var ua = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  // 'installed' | 'prompt' (نصب مستقیم) | 'ios' (راهنما) | 'other' (از منوی مرورگر)
  function installMode() {
    if (isStandalone()) return 'installed';
    if (installEvt) return 'prompt';
    if (isIos()) return 'ios';
    return 'other';
  }
  function installDismissed() { try { return !!localStorage.getItem(INSTALL_DISMISS_KEY); } catch (e) { return false; } }
  var DL_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v8M8.8 11.8 12 15l3.2-3.2"/></svg>';
  // بنر صفحه‌ی امروز: فقط وقتی نصب ممکنه (اندروید یا آیفون) و کاربر نبسته
  function installBanner() {
    var m = installMode();
    if ((m !== 'prompt' && m !== 'ios') || installDismissed()) return '';
    return '<section class="card hcard install-card" role="region" aria-label="' + esc(T('install.title')) + '">' +
      '<button type="button" class="install-x" data-install-dismiss="1" aria-label="' + esc(T('install.dismiss')) + '">×</button>' +
      '<div class="install-row"><img src="public/assets/icon-192.png" alt="" width="52" height="52"><div><b>' + esc(T('install.bannerTitle')) + '</b>' +
      '<p class="small muted">' + esc(T('install.bannerText')) + '</p></div></div>' +
      '<button type="button" class="btn btn-primary btn-block" data-install="1">' + DL_ICON + esc(T(m === 'ios' ? 'install.how' : 'install.btn')) + '</button></section>';
  }
  // بخش تنظیمات: همیشه، با وضعیت فعلی
  function installSectionBody() {
    var m = installMode();
    return '<p>' + esc(T('install.status.' + m)) + '</p>' +
      (m === 'prompt' || m === 'ios' ? '<button type="button" class="btn btn-primary" data-install="1">' + DL_ICON + esc(T(m === 'ios' ? 'install.how' : 'install.btn')) + '</button>' : '') +
      (m === 'other' ? '<p class="small muted">' + esc(T('install.otherHelp')) + '</p>' : '') +
      '<p class="small muted">' + esc(T('install.offline')) + '</p>';
  }
  function refreshInstallUi() {
    var b = document.querySelector('[data-install-slot="home"]');
    if (b) b.innerHTML = installBanner();
    var s = document.querySelector('#set-install .set-body');
    if (s) {
      s.innerHTML = installSectionBody();
      var sm = document.querySelector('#set-install .set-head small');
      if (sm) sm.textContent = T('install.short.' + installMode());
    }
  }
  function openIosGuide() {
    var share = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
    var plus = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>';
    modalRoot.innerHTML = '<div class="modal-backdrop" id="ios-guide"><div class="modal install-modal" role="dialog" aria-modal="true" aria-labelledby="ig-title">' +
      '<img src="public/assets/icon-192.png" alt="" width="64" height="64" class="install-modal-icon">' +
      '<h2 id="ig-title">' + esc(T('install.iosTitle')) + '</h2>' +
      '<ol class="install-steps">' +
      '<li><span class="step-ico">' + share + '</span><span>' + T('install.iosStep1') + '</span></li>' +
      '<li><span class="step-ico">' + plus + '</span><span>' + T('install.iosStep2') + '</span></li>' +
      '<li><span class="step-ico step-txt">' + esc(T('install.iosAdd')) + '</span><span>' + T('install.iosStep3') + '</span></li></ol>' +
      '<p class="small muted">' + esc(T('install.iosNote')) + '</p>' +
      '<button type="button" class="btn btn-primary btn-block" data-install-close="1">' + esc(T('install.close')) + '</button></div></div>';
    document.body.classList.add('modal-open');
    modalRoot.querySelector('[data-install-close]').focus();
  }
  function closeIosGuide() {
    if (!document.getElementById('ios-guide')) return;
    modalRoot.innerHTML = '';
    document.body.classList.remove('modal-open');
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest && t.closest('[data-install]')) {
      if (installEvt) {
        var ev = installEvt;
        ev.prompt();
        ev.userChoice.then(function (r) { installEvt = null; if (r && r.outcome === 'accepted') showToast(T('install.done')); refreshInstallUi(); });
      } else if (isIos()) openIosGuide();
      return;
    }
    if (t.closest && t.closest('[data-install-dismiss]')) {
      try { localStorage.setItem(INSTALL_DISMISS_KEY, new Date().toISOString()); } catch (err) { /* */ }
      refreshInstallUi();
      return;
    }
    if (t.closest && t.closest('[data-install-close]')) { closeIosGuide(); return; }
    if (t.id === 'ios-guide') closeIosGuide();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeIosGuide(); });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; refreshInstallUi(); });
  window.addEventListener('appinstalled', function () { installEvt = null; showToast(T('install.done')); refreshInstallUi(); });

  // سرویس‌ورکر: فقط روی HTTPS یا localhost
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    // نسخه‌ی تازه: سرویس‌ورکر جدید خودش فعال می‌شه (skipWaiting + clients.claim) و صفحه یک بار دوباره بار می‌شه.
    // بار اول نصب (صفحه هنوز کنترل‌کننده نداشته) نیازی به بارگذاری دوباره نیست.
    var swHadController = !!navigator.serviceWorker.controller, swReloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!swHadController || swReloading) { swHadController = true; return; }
      try {
        // جلوگیری از حلقه: حداکثر یک بار در هر ۱۰ ثانیه
        var last = +sessionStorage.getItem('gaam-sw-reload') || 0;
        if (Date.now() - last < 10000) return;
        sessionStorage.setItem('gaam-sw-reload', String(Date.now()));
        // اگه معرفی هنوز در حال اجراست، بعد از بارگذاری دوباره از اول پخش بشه
        if (document.getElementById('splash')) sessionStorage.removeItem('gaam-intro');
      } catch (e) { /* */ }
      swReloading = true;
      location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        // PWA نصب‌شده (مخصوصاً iOS) معمولاً بدون بارگذاری دوباره از پس‌زمینه برمی‌گرده: اون موقع دنبال نسخه‌ی تازه بگرد
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () { /* */ }); });
      }).catch(function () { /* بدون کش آفلاین ادامه می‌ده */ });
    });
  }

  applyStatic();
  // بارگذاری دوباره‌ی صفحه: وضعیت ذخیره‌شده‌ی همین ورودی تاریخچه برمی‌گرده
  var initNav = navState();
  if (initNav) { navDepth = initNav.depth; restore(initNav); } else { setNav({ depth: 0, from: null }); route(); }
})();
