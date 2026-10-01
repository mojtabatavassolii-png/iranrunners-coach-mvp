/*
 * رابط کاربری «مربی خودت باش» — بدون فریم‌ورک، داده‌ها فقط در localStorage.
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
  function emptyState() { return { profile: null, checkins: {}, done: {}, ackPain: {}, postRuns: {} }; }
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
  // متن ترجمه‌شده با اعداد بومی و امن برای HTML
  function tt(key, params) { return t(T(key, params)); }
  function faDate(key, short) { return I.date(C.parseDate(key), short); }
  function isRtl() { return I.dir() === 'rtl'; }

  function showToast(msg) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 3200);
    setTimeout(function () { el.remove(); }, 3700);
  }

  // ---------- متن‌های ثابت صفحه (هدر، منو، بنر، فوتر) و جهت ----------
  function applyStatic() {
    var root = document.documentElement;
    root.lang = I.getLang();
    root.dir = I.dir();
    document.title = T('app.name');
    var md = document.querySelector('meta[name=description]');
    if (md) md.setAttribute('content', T('app.metaDescription'));
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = T(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', T(el.dataset.i18nAria)); });
    var lt = document.getElementById('lang-toggle');
    lt.textContent = T('app.langSwitch');
    lt.setAttribute('aria-label', T('app.langSwitchAria'));
    lt.lang = I.getLang() === 'fa' ? 'en' : 'fa';
  }
  function switchLang(code) {
    I.setLang(code);
    applyStatic();
    route();
  }
  document.getElementById('lang-toggle').addEventListener('click', function () {
    switchLang(I.getLang() === 'fa' ? 'en' : 'fa');
  });

  // ---------- تطبیق جلسه با چک‌این ----------
  function prevCheckin(key) {
    return state.checkins[C.dateKey(C.addDays(C.parseDate(key), -1))] || null;
  }
  function effectiveSession(base) {
    var ci = state.checkins[base.date];
    return C.adaptSession(base, ci, prevCheckin(base.date), C.paceZones(state.profile));
  }
  function unackedPainToday() {
    var k = C.dateKey(today());
    var ci = state.checkins[k];
    return ci && ci.pain && !state.ackPain[k] ? k : null;
  }

  function needsMigration() { return state.profile && state.profile.schemaVersion !== SCHEMA_VERSION; }

  // ---------- مسیریابی ----------
  var VIEWS = { plan: renderPlan, checkin: renderCheckin, fitness: renderFitness, race: renderRace, guide: renderGuide, profile: renderProfile, onboarding: renderOnboarding };
  function route() {
    var loginMode = !isEntered();
    document.body.classList.toggle('login-mode', loginMode);
    if (loginMode) {
      document.getElementById('main-nav').hidden = true;
      document.getElementById('medical-banner').hidden = true;
      renderLogin();
      return;
    }
    var v = (location.hash || '#plan').slice(1);
    if (!state.profile || needsMigration()) v = 'onboarding';
    if (!VIEWS[v]) v = 'plan';
    var nav = document.getElementById('main-nav');
    nav.hidden = !state.profile || v === 'onboarding' || needsMigration();
    // هشدار پزشکی فقط در صفحه‌ی چک‌این
    document.getElementById('medical-banner').hidden = v !== 'checkin';
    document.getElementById('nav-race').hidden = !(state.profile && C.goalInfo(state.profile).type !== 'none');
    nav.querySelectorAll('a').forEach(function (a) {
      if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    VIEWS[v]();
    var pk = unackedPainToday();
    if (pk) openPainModal(pk);
  }
  // صفحه‌ی آموزش اسکرول رو خودش مدیریت می‌کنه (رفتن به بخش هدف)
  window.addEventListener('hashchange', function () { var toGuide = location.hash === '#guide'; route(); if (!toGuide) window.scrollTo(0, 0); });

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
      '<img class="login-logo" src="img/logo.png?v=14" alt="' + esc(T('app.name')) + '" width="168" height="168">' +
      '<h1 id="login-title">' + esc(T('login.welcome')) + '</h1>' +
      '<p class="login-sub">' + esc(T('login.subtitle')) + '</p>' +
      '<button type="button" class="btn login-btn" id="login-btn">' + esc(T('login.button')) + '</button>' +
      '<p class="login-note">' + esc(T('login.note')) + '</p>' +
      '</div>' +
      '<div class="login-lang" role="group" aria-label="' + esc(T('login.langLabel')) + '">' +
      '<span class="login-lang-label">' + esc(T('login.langLabel')) + '</span>' +
      '<button type="button" class="lang-opt" data-lang="fa" lang="fa" aria-pressed="' + (lang === 'fa') + '"><b>FA</b> فارسی</button>' +
      '<button type="button" class="lang-opt" data-lang="en" lang="en" aria-pressed="' + (lang === 'en') + '"><b>EN</b> English</button>' +
      '</div></section>';
    app.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { if (b.dataset.lang !== I.getLang()) switchLang(b.dataset.lang); });
    });
    document.getElementById('login-btn').addEventListener('click', function () {
      setEntered(true);
      var target = state.profile && !needsMigration() ? '#plan' : '#onboarding';
      if (location.hash === target) route(); else location.hash = target;
      window.scrollTo(0, 0);
    });
  }

  // =====================================================================
  // ۱. فرم اولیه
  // =====================================================================
  // فاصله‌های رایج برای رکورد؛ «other» = فاصله‌ی دلخواه
  var PB_DISTANCES = [['m1500', 1.5], ['m3000', 3], ['5', 5], ['10', 10], ['21', 21.0975], ['42', 42.195], ['other', null]];
  var VOL_REASONS = ['injury', 'illness', 'travel', 'other', 'none'];
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
    // پروفایل‌های قدیمی فقط یک عدد حجم دارن: هر دو فیلد با همون پر می‌شن
    var oldKm = p.currentWeeklyKm != null && (p.currentWeeklyKm > 0 || !migrating) && p.experience !== 'never' ? p.currentWeeklyKm : '';
    var volLast = p.lastWeekKm != null && p.experience !== 'never' ? p.lastWeekKm : oldKm;
    var volAvg = p.monthAvgKm != null && p.experience !== 'never' ? p.monthAvgKm : oldKm;

    function chip(name, value, label, checked, type) {
      return '<label class="chip"><input type="' + (type || 'checkbox') + '" name="' + name + '" value="' + value + '"' +
        (checked ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
    }

    app.innerHTML =
      '<section class="card onboarding">' +
      '<h1>' + esc(T(editing ? 'onb.titleEdit' : 'onb.titleNew')) + '</h1>' +
      (migrating ? '<div class="alert alert-adapt" role="status"><strong>' + esc(T('onb.migTitle')) + '</strong>' +
        '<p>' + esc(T('onb.migText')) + '</p></div>' : '') +
      '<p class="muted">' + esc(T(editing ? 'onb.introEdit' : 'onb.introNew')) + '</p>' +
      '<form id="onb" novalidate>' +

      '<fieldset><legend>' + esc(T('onb.s1')) + '</legend>' +
      '<p class="sub-legend">' + esc(T('onb.expQ')) + req + '</p><div class="chips">' +
      Object.keys(C.EXPERIENCE).map(function (k) { return chip('experience', k, C.EXPERIENCE[k].label, p.experience === k, 'radio'); }).join('') + '</div>' +
      '<p class="alert alert-good zero-note" id="zero-note" hidden>' + esc(T('onb.zeroNote')) + '</p>' +
      '<div id="runner-fields">' +
      '<div class="row2">' +
      '<div class="field"><label for="lastkm">' + esc(T('onb.lastWeek')) + req + '</label>' +
      '<input id="lastkm" name="lastWeekKm" type="number" inputmode="decimal" min="0" max="400" step="0.5" required value="' + esc(volLast) + '">' +
      '<small class="muted">' + esc(T('onb.lastWeekHint')) + '</small></div>' +
      '<div class="field"><label for="avgkm">' + esc(T('onb.monthAvg')) + req + '</label>' +
      '<input id="avgkm" name="monthAvgKm" type="number" inputmode="decimal" min="0" max="400" step="0.5" required value="' + esc(volAvg) + '">' +
      '<small class="muted">' + esc(T('onb.monthAvgHint')) + '</small></div></div>' +
      '<div id="reason-block" class="reason-block" hidden><p class="sub-legend">' + esc(T('onb.reasonQ')) + req + '</p>' +
      '<p class="small muted">' + esc(T('onb.reasonHint')) + '</p><div class="chips">' +
      VOL_REASONS.map(function (k) { return chip('volumeReason', k, T('onb.reasons.' + k), p.volumeReason === k, 'radio'); }).join('') + '</div></div>' +
      '<p class="sub-legend">' + esc(T('onb.structQ')) + req + '</p><div class="chips">' +
      chip('structured', 'yes', T('app.yes'), p.structured === true, 'radio') + chip('structured', 'no', T('app.no'), p.structured === false, 'radio') + '</div>' +
      '<p class="sub-legend">' + esc(T('onb.pbQ')) + '</p>' +
      '<p class="small pb-intro">' + esc(T('onb.pbIntro')) + '</p>' +
      '<p class="small muted">' + esc(T('onb.pbOptional')) + '</p>' +
      '<div class="row3">' +
      '<div class="field"><label for="pbsel">' + esc(T('onb.pbDist')) + '</label><select id="pbsel" name="pbSel"><option value="">' + esc(T('onb.pbNone')) + '</option>' +
      PB_DISTANCES.map(function (d) { return '<option value="' + d[0] + '"' + (pbKey === d[0] ? ' selected' : '') + '>' + esc(T('pbDist.' + d[0])) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field" id="pbother-field"' + (pbKey === 'other' ? '' : ' hidden') + '><label for="pbother">' + esc(T('onb.pbOtherKm')) + '</label>' +
      '<input id="pbother" name="pbOther" type="number" inputmode="decimal" min="1" max="100" step="0.1" value="' + esc(pbKey === 'other' ? pb.distanceKm : '') + '"></div>' +
      '<div class="field" id="pbtime-field"' + (pbKey ? '' : ' hidden') + '><label for="pbtime">' + esc(T('onb.pbTime')) + '</label>' +
      '<input id="pbtime" name="pbTime" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="3:25:00" data-time-preview="pbtime-read" value="' + esc(pb.timeSec ? C.formatDuration(pb.timeSec) : '') + '">' +
      '<small class="muted">' + esc(T('onb.pbTimeHint')) + '</small><small class="time-read" id="pbtime-read" aria-live="polite"></small></div>' +
      '</div></div>' +
      '<div id="level-preview" aria-live="polite"></div>' +
      '</fieldset>' +

      '<fieldset><legend>' + esc(T('onb.s2')) + '</legend><div class="row3">' +
      '<div class="field"><label for="age">' + esc(T('onb.age')) + '</label><input id="age" name="age" type="number" inputmode="numeric" min="12" max="90" required value="' + esc(p.age || '') + '"></div>' +
      '<div class="field"><label for="weight">' + esc(T('onb.weight')) + '</label><input id="weight" name="weightKg" type="number" inputmode="decimal" min="30" max="250" required value="' + esc(p.weightKg || '') + '"></div>' +
      '<div class="field"><label for="height">' + esc(T('onb.height')) + '</label><input id="height" name="heightCm" type="number" inputmode="numeric" min="120" max="230" required value="' + esc(p.heightCm || '') + '"></div>' +
      '</div></fieldset>' +

      '<fieldset><legend>' + esc(T('onb.s3')) + '</legend><div class="chips">' +
      C.DAY_NAMES.map(function (n, i) { return chip('days', i, n, days.indexOf(i) >= 0); }).join('') + '</div>' +
      '</fieldset>' +

      '<fieldset><legend>' + esc(T('onb.s4')) + '</legend><div class="chips">' +
      Object.keys(C.LOCATION_LABELS).map(function (k) { return chip('locations', k, C.LOCATION_LABELS[k], locs.indexOf(k) >= 0); }).join('') +
      '</div></fieldset>' +

      '<fieldset><legend>' + esc(T('onb.s5')) + '</legend>' +
      '<div class="field"><label for="injury">' + esc(T('onb.injuryLabel')) + '</label>' +
      '<textarea id="injury" name="injury" rows="2" maxlength="300" placeholder="' + esc(T('onb.injuryPh')) + '">' + esc(p.injury || '') + '</textarea></div>' +
      '</fieldset>' +

      '<fieldset><legend>' + esc(T('onb.s6')) + '</legend>' +
      '<div class="field"><label for="gtype">' + esc(T('onb.goalType')) + '</label><select id="gtype" name="goalType">' +
      // ترتیب صریح (کلیدهای عددی در Object.keys جلو می‌افتن)
      ['none', '5', '10', '21', '42', 'ultra'].map(function (k) { return '<option value="' + k + '"' + (goal.type === k ? ' selected' : '') + '>' + esc(C.GOAL_TYPES[k]) + '</option>'; }).join('') +
      '</select></div>' +
      '<div id="goal-fields" class="race-fields"' + (goal.type === 'none' ? ' hidden' : '') + '>' +
      '<div class="field"><label for="rdate">' + esc(T('onb.raceDate')) + '</label><input id="rdate" name="raceDate" type="date" min="' + todayKey + '" value="' + esc(goal.date || '') + '">' +
      '<small class="muted" id="rdate-fa"></small></div>' +
      '<div id="ultra-fields"' + (goal.type === 'ultra' ? '' : ' hidden') + '>' +
      '<div class="row2"><div class="field"><label for="ukm">' + esc(T('onb.ultraKm')) + req + '</label>' +
      '<input id="ukm" name="ultraKm" type="number" inputmode="decimal" min="10" max="400" step="0.1" value="' + esc(goal.km || '') + '"></div>' +
      '<div class="field"><label for="ugain">' + esc(T('onb.ultraGain')) + req + '</label>' +
      '<input id="ugain" name="ultraGain" type="number" inputmode="numeric" min="0" max="20000" step="10" value="' + esc(goal.type === 'ultra' ? goal.gain : '') + '"></div></div>' +
      '<div class="row3"><div class="field"><label for="uloss">' + esc(T('onb.ultraLoss')) + '</label>' +
      '<input id="uloss" name="ultraLoss" type="number" inputmode="numeric" min="0" max="20000" step="10" value="' + esc(goal.loss || '') + '"><small class="muted">' + esc(T('onb.ultraLossHint')) + '</small></div>' +
      '<div class="field"><label for="uterrain">' + esc(T('onb.terrain')) + '</label><select id="uterrain" name="ultraTerrain"><option value="">' + esc(T('onb.notSelected')) + '</option>' +
      Object.keys(C.TERRAIN_LABELS).map(function (k) { return '<option value="' + k + '"' + (goal.terrain === k ? ' selected' : '') + '>' + esc(C.TERRAIN_LABELS[k]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="ualt">' + esc(T('onb.altitude')) + '</label>' +
      '<input id="ualt" name="ultraAlt" type="number" inputmode="numeric" min="0" max="6000" step="10" value="' + esc(goal.altitude || '') + '"></div></div>' +
      '<p id="ultra-ratio" class="ultra-ratio" aria-live="polite"></p>' +
      '</div></div></fieldset>' +

      '<fieldset><legend>' + esc(T('onb.s7')) + '</legend>' + hrFields(p) + '</fieldset>' +

      '<div id="onb-errors" class="form-errors" role="alert" hidden></div>' +
      '<div class="actions">' +
      '<button type="submit" class="btn btn-primary">' + esc(T(editing ? 'onb.submitEdit' : 'onb.submitNew')) + '</button>' +
      (editing && !needsMigration() ? '<a class="btn btn-ghost" href="#profile">' + esc(T('app.cancel')) + '</a>' : '') +
      '</div></form></section>';

    var form = document.getElementById('onb');

    // خوندن رکورد از فرم؛ null = رکوردی وارد نشده، false = ناقص/نامعتبر
    function readPb() {
      var sel = form.pbSel.value;
      if (!sel) return null;
      var km = sel === 'other' ? Number(form.pbOther.value) : PB_DISTANCES.filter(function (d) { return d[0] === sel; })[0][1];
      var tt2 = C.parseTime(form.pbTime.value);
      if (!(km >= 1 && km <= 100) || !tt2) return false;
      // سرعت غیرممکن (سریع‌تر از رکورد جهانی) یا خیلی کند
      var v = km / (tt2 / 3600);
      if (v > 26 || v < 3) return false;
      return { distanceKm: km, timeSec: tt2 };
    }
    function isNever() { var e = form.querySelector('input[name=experience]:checked'); return !!e && e.value === 'never'; }
    // حجم: هفته‌ی اخیر و میانگین ماه؛ اگه افت شدید باشه، دلیلش لازمه
    function readVolume() {
      var l = form.lastWeekKm.value.trim(), a = form.monthAvgKm.value.trim();
      if (l === '' || a === '') return null;
      var last = Number(l), avg = Number(a);
      if (!(last >= 0 && last <= 400 && avg >= 0 && avg <= 400)) return null;
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
      var never = isNever();
      document.getElementById('runner-fields').hidden = never;
      document.getElementById('zero-note').hidden = !never;
      var vol = never ? null : readVolume();
      document.getElementById('reason-block').hidden = !(vol && vol.gap === 'drop');
      var sel = form.pbSel.value;
      document.getElementById('pbother-field').hidden = sel !== 'other';
      document.getElementById('pbtime-field').hidden = !sel;
      var box = document.getElementById('level-preview');
      var inp = readLevelInputs();
      if (!inp) {
        box.innerHTML = '<p class="small muted level-wait">' + esc(T('onb.levelWait')) + '</p>';
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
      var km = Number(form.ultraKm.value), gain = form.ultraGain.value === '' ? null : Number(form.ultraGain.value);
      if (gt === 'ultra' && km > 0 && gain !== null && gain >= 0) {
        var info = C.ULTRA_CLASS_INFO[C.ultraClass(gain / km)];
        out.innerHTML = tt('onb.ultraRatio', { r: Math.round(gain / km) }) + '<b>' + esc(info.short) + '</b>';
      } else out.textContent = '';
    }
    form.addEventListener('input', syncRace);
    function syncDate() {
      var v = document.getElementById('rdate').value;
      document.getElementById('rdate-fa').textContent = v ? T('onb.raceDateEq', { d: faDate(v) }) : '';
    }
    form.addEventListener('input', syncLevel);
    form.addEventListener('change', function () { syncRace(); syncLevel(); syncDate(); });
    syncRace(); syncLevel(); syncDate();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var errs = [];
      var age = Number(fd.get('age')), w = Number(fd.get('weightKg')), h = Number(fd.get('heightCm'));
      var selDays = fd.getAll('days').map(Number);
      var selLocs = fd.getAll('locations');
      var never = fd.get('experience') === 'never';
      var volP = { lastWeekKm: 0, monthAvgKm: 0, volumeReason: null, currentWeeklyKm: 0 };
      if (!fd.get('experience')) errs.push(T('onb.err.exp'));
      if (!never) {
        var lRaw = String(fd.get('lastWeekKm') || '').trim(), aRaw = String(fd.get('monthAvgKm') || '').trim();
        if (lRaw === '' || !(Number(lRaw) >= 0 && Number(lRaw) <= 400)) errs.push(T('onb.err.lastWeek'));
        if (aRaw === '' || !(Number(aRaw) >= 0 && Number(aRaw) <= 400)) errs.push(T('onb.err.monthAvg'));
        var vol = readVolume();
        if (vol && vol.gap === 'drop' && !vol.reason) errs.push(T('onb.err.reason'));
        if (vol) volP = volumeProfile(vol);
      }
      var curKm = volP.currentWeeklyKm;
      if (!never && !fd.get('structured')) errs.push(T('onb.err.struct'));
      var pbObj = never ? null : readPb();
      if (pbObj === false) errs.push(T('onb.err.pb'));
      var hrIn = readHr(form);
      if (hrIn.error) errs.push(hrIn.error);
      if (!(age >= 12 && age <= 90)) errs.push(T('onb.err.age'));
      if (!(w >= 30 && w <= 250)) errs.push(T('onb.err.weight'));
      if (!(h >= 120 && h <= 230)) errs.push(T('onb.err.height'));
      if (!selDays.length) errs.push(T('onb.err.days'));
      if (!selLocs.length) errs.push(T('onb.err.locs'));
      var gType = fd.get('goalType') || 'none', goalObj = { type: gType, date: null };
      if (gType !== 'none') {
        var rd = fd.get('raceDate');
        if (rd && C.daysBetween(today(), C.parseDate(rd)) < 1) errs.push(T('onb.err.raceDate'));
        goalObj.date = rd || null;
        if (gType === 'ultra') {
          var num = function (n) { var v = String(fd.get(n) || '').trim(); return v === '' ? null : Number(v); };
          var uk = num('ultraKm'), ug = num('ultraGain'), ul = num('ultraLoss'), ua = num('ultraAlt');
          if (!(uk >= 10 && uk <= 400)) errs.push(T('onb.err.ultraKm'));
          if (ug === null || !(ug >= 0 && ug <= 20000)) errs.push(T('onb.err.ultraGain'));
          if (ul !== null && !(ul >= 0 && ul <= 20000)) errs.push(T('onb.err.ultraLoss'));
          if (ua !== null && !(ua >= 0 && ua <= 6000)) errs.push(T('onb.err.ultraAlt'));
          goalObj.ultra = { km: uk, gain: ug, loss: ul, terrain: fd.get('ultraTerrain') || null, altitude: ua };
        }
      }
      var box = document.getElementById('onb-errors');
      if (errs.length) {
        box.hidden = false;
        box.innerHTML = '<ul>' + errs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      var next = {
        age: age, weightKg: w, heightCm: h,
        days: selDays.sort(), locations: selLocs,
        injury: String(fd.get('injury') || '').trim(),
        currentWeeklyKm: curKm, lastWeekKm: volP.lastWeekKm, monthAvgKm: volP.monthAvgKm, volumeReason: volP.volumeReason,
        experience: fd.get('experience'), structured: !never && fd.get('structured') === 'yes',
        schemaVersion: SCHEMA_VERSION,
        goal: goalObj, pb: pbObj,
        hrMax: hrIn.max, hrRest: hrIn.rest,
        // تاریخچه‌ی فیتنس و تنظیم دستی پیس ایزی با ویرایش پروفایل حفظ می‌شن
        fitnessTests: p.fitnessTests || [], easyAdjustSec: p.easyAdjustSec || 0,
        createdAt: p.createdAt || new Date().toISOString()
      };
      // تاریخ رکورد پایه: اگه تغییر نکرده، تاریخ قبلی؛ اگه جدیده، امروز
      if (pbObj) {
        var same = p.pb && p.pb.distanceKm === pbObj.distanceKm && p.pb.timeSec === pbObj.timeSec;
        pbObj.date = same && p.pb.date ? p.pb.date : C.dateKey(today());
      }
      // تغییر سطح یا حجم فعلی = نقطه‌ی شروع جدید؛ بقیه‌ی تغییرات پیشرفت برنامه رو حفظ می‌کنن
      var keep = editing && !migrating && p.startDate && p.currentWeeklyKm === curKm && p.monthAvgKm === next.monthAvgKm && p.lastWeekKm === next.lastWeekKm &&
        C.assessLevel(p).level === C.assessLevel(next).level;
      next.startDate = keep ? p.startDate : C.dateKey(today());
      state.profile = next;
      save();
      showToast(T(editing ? 'onb.toastEdit' : 'onb.toastNew'));
      viewWeekOffset = 0;
      if (location.hash === '#plan') route(); else location.hash = '#plan';
    });
  }

  // =====================================================================
  // ۲. داشبورد و برنامه‌ی هفتگی
  // =====================================================================
  function sessionBody(s, opts) {
    opts = opts || {};
    var html = '<div class="sess-target">' + t(s.target) + '</div>';
    if (s.original) {
      html += '<div class="sess-orig">' + esc(T('sess.original')) + ' <s>' + t(s.original.label + ' — ' + s.original.target) + '</s></div>';
    }
    if (s.steps && s.steps.length) {
      html += '<ol class="sess-steps">' + s.steps.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ol>';
    }
    if (s.how && s.type !== 'cancelled') html += '<p class="sess-how">' + t(s.how) + '</p>';
    if (s.talk && s.type !== 'cancelled') html += '<p class="talk-test">' + t(s.talk) + '</p>';
    if (s.cheer) html += '<p class="cheer">' + t(s.cheer) + '</p>';
    if (opts.hint && s.easyEffort && s.type !== 'walkrun') html += '<p class="day-hint">' + t(opts.hint.message) + '</p>';
    if (opts.key) html += postRunBlock(opts.key, s, opts.prefix || 'p');
    return html;
  }

  // ---------- بعد از جلسه‌ی ایزی: RPE و پیس ----------
  var postRunOpen = null;
  function postRunBlock(key, s, prefix) {
    if (!s.easyEffort) return '';
    var post = state.postRuns[key];
    if (state.done[key] && post) {
      var fb = C.easyRunFeedback(post, s.type);
      if (!fb) return '';
      var cls = fb.kind === 'ok' ? 'alert-good' : (fb.kind === 'warn' ? 'alert-adapt' : 'alert-note');
      return '<div class="alert ' + cls + ' postrun-fb" role="status"><p class="small muted">' + tt('post.summary', { rpe: post.rpe }) +
        (post.pace === 'ok' ? esc(T('post.paceOk')) : post.pace === 'fast' ? esc(T('post.paceFast')) : '') + '</p><p>' + t(fb.message) + '</p>' +
        (fb.kind === 'warn' ? easyActions() : '') + '</div>';
    }
    if (postRunOpen !== key) return '';
    var n = 'rpe-' + prefix;
    var h = '<form class="postrun" data-postrun-form="' + key + '" data-type="' + s.type + '" novalidate>' +
      '<p class="sub-legend">' + esc(T('post.q1')) + '</p><div class="scale scale10" role="radiogroup" aria-label="' + esc(T('post.rpeAria')) + '">';
    for (var i = 1; i <= 10; i++) h += '<label class="scale-opt"><input type="radio" name="rpe" id="' + n + '-' + i + '" value="' + i + '"><span>' + fa(i) + '</span></label>';
    h += '</div><div class="scale-ends"><span>' + esc(T('post.low')) + '</span><span>' + esc(T('post.high')) + '</span></div>';
    if (s.type !== 'runwalk' && s.type !== 'walkrun') {
      h += '<p class="sub-legend">' + esc(T('post.q2')) + '</p><div class="chips">' +
        '<label class="chip"><input type="radio" name="pace" value="ok"><span>' + esc(T('post.ok')) + '</span></label>' +
        '<label class="chip"><input type="radio" name="pace" value="fast"><span>' + esc(T('post.fast')) + '</span></label>' +
        '<label class="chip"><input type="radio" name="pace" value="unknown"><span>' + esc(T('post.unknown')) + '</span></label></div>';
    }
    return h + '<p class="form-errors" hidden></p><div class="actions"><button type="submit" class="btn btn-primary">' + esc(T('post.submit')) + '</button>' +
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

  function adaptationBox(ad, key) {
    if (!ad) return '';
    if (ad.kind === 'pain') {
      var ci = state.checkins[key];
      return '<div class="alert alert-pain" role="alert"><strong>' + esc(T('pain.cancelled')) + '</strong>' +
        '<p class="pain-msg">' + esc(C.PAIN_MESSAGE) + '</p>' +
        (ci && ci.painWhere ? '<p class="small">' + esc(T('pain.whereReported', { w: ci.painWhere })) + '</p>' : '') +
        '<p class="small">' + esc(T('pain.noRun')) + '</p></div>';
    }
    var cls = ad.kind === 'downgrade' ? 'alert-adapt' : 'alert-note';
    return '<div class="alert ' + cls + '" role="status">' +
      (ad.kind === 'downgrade' ? '<strong>' + esc(T('adaptBox.changed')) + '</strong>' : '') + '<p>' + t(ad.message) + '</p></div>';
  }

  function todayCard() {
    var now = today(), key = C.dateKey(now);
    var base = C.sessionFor(state.profile, now);
    var ci = state.checkins[key];
    var needsCheckin = ['rest', 'none'].indexOf(base.type) < 0;
    var html = '<section class="card today-card"><div class="today-head"><div>' +
      '<p class="eyebrow">' + esc(T('today.eyebrow', { day: base.dayName, date: faDate(key) })) + '</p>';

    // یادآوری درد دیروز
    var pc = prevCheckin(key);
    var yesterdayPain = pc && pc.pain;

    if (!needsCheckin) {
      html += '<h2>' + badge(base.type, base.label) + '</h2></div></div>' + sessionBody(base);
      if (yesterdayPain && !ci) html += painYesterdayBox();
      return html + '</section>';
    }
    if (!ci) {
      html += '<h2>' + badge(base.type, base.label) + ' <span class="pending">' + esc(T('today.waiting')) + '</span></h2></div></div>' +
        (yesterdayPain ? painYesterdayBox() : '') +
        '<div class="checkin-cta"><p>' + esc(T('today.cta')) + ' ' + helpLink('checkin', T('today.ctaHelp')) + '</p>' +
        '<a class="btn btn-primary" href="#checkin">' + esc(T('today.ctaBtn')) + '</a></div>' +
        '<details class="preview"><summary>' + esc(T('today.preview')) + '</summary>' + sessionBody(base) + '</details>';
      return html + '</section>';
    }
    var r = effectiveSession(base);
    var s = r.session;
    html += '<h2>' + badge(s.type, s.label) + '</h2></div>' +
      (s.type !== 'cancelled' ? doneButton(key, s) : '') + '</div>' +
      adaptationBox(r.adaptation, key) +
      (s.type !== 'cancelled' ? sessionBody(s, { key: key, prefix: 'today', hint: C.easyDayHint(ci, prevCheckin(key)) }) : '') +
      '<p class="small muted">' + tt('today.summary', { f: ci.fatigue, s: ci.sleep, p: T(ci.pain ? 'app.yes' : 'app.no') }) +
      (ci.pain ? '' : ' · <a href="#checkin">' + esc(T('today.edit')) + '</a>') + '</p>';
    return html + '</section>';
  }

  function painYesterdayBox() {
    return '<div class="alert alert-pain-soft" role="note"><strong>' + esc(T('pain.yesterdayStrong')) + '</strong> ' +
      esc(T('pain.yesterdayText')) + '</div>';
  }

  function doneButton(key, s) {
    var done = !!state.done[key];
    // جلسه‌ی ایزی: قبل از ثبت انجام، سؤال RPE و پیس پرسیده می‌شه
    if (!done && s && s.easyEffort) {
      return '<button type="button" class="btn btn-outline" data-postrun="' + key + '" aria-expanded="' + (postRunOpen === key) + '">' + esc(T('today.done')) + '</button>';
    }
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
    var isRunWalk = lv.level <= 1;
    // فلش‌ها بسته به جهت صفحه
    var prevGlyph = isRtl() ? '›' : '‹', nextGlyph = isRtl() ? '‹' : '›';

    var html = '';
    html += todayCard();
    html += '<section class="card level-strip">' + levelCard(lv, true) + '</section>';
    if (lv.level === 0) html += zeroCard(p, now);
    html += fitnessNotesCard(p, now);

    // سربرگ هفته
    var wkNum = week.weekIndex + 1;
    html += '<section class="card week-card"><div class="week-head">' +
      '<button type="button" class="btn btn-icon" data-week="-1" aria-label="' + esc(T('week.prev')) + '"' + (week.start <= p.startDate ? ' disabled' : '') + '>' + prevGlyph + '</button>' +
      '<div class="week-title"><h2>' + (week.weekIndex >= 0 ? tt('week.n', { n: wkNum }) : esc(T(week.phase.key === 'intro' ? 'week.intro' : 'week.before'))) + '</h2>' +
      '<p class="muted">' + esc(T('week.range', { a: faDate(week.start, true), b: faDate(week.days[6].date, true) })) +
      (viewWeekOffset !== 0 ? ' · <button type="button" class="linklike" data-week="0">' + esc(T('week.back')) + '</button>' : '') + '</p></div>' +
      '<button type="button" class="btn btn-icon" data-week="1" aria-label="' + esc(T('week.next')) + '">' + nextGlyph + '</button></div>';

    var runDays = week.days.filter(function (d) { return ['rest', 'none'].indexOf(d.type) < 0; }).length;
    var zero = lv.level === 0;
    html += '<div class="week-stats' + (zero ? ' week-stats-zero' : '') + '">' +
      (zero ? '<div class="stat"><span>' + esc(T('zero.stageLabel')) + '</span><b>' + tt('zero.stage', { n: (week.zeroStage || 0) + 1, total: week.zeroFinal + 1 }) + '</b></div>'
        : '<div class="stat"><span>' + esc(T('week.phase')) + ' ' + helpLink('week', T('week.phaseHelp')) + '</span><b>' + t(week.phase.label) + '</b>' +
      (week.periodLabel ? '<small class="period-tag">' + esc(week.periodLabel) + '</small>' : '') + '</div>') +
      '<div class="stat"><span>' + esc(T('week.sessions')) + '</span><b>' + tt('week.nSessions', { n: runDays }) + '</b></div>' +
      (isRunWalk ? '<div class="stat"><span>' + esc(T('week.totalTime')) + '</span><b>' + tt('week.nMin', { n: week.totalMin }) + '</b></div>'
        : '<div class="stat"><span>' + esc(T('week.volume')) + '</span><b>' + tt('week.nKm', { n: week.totalKm }) + '</b>' +
          (week.goal && week.goal.category === 'ultra' && week.vert ? '<small class="period-tag">' + tt('week.vert', { n: week.vert }) + '</small>' : '') + '</div>') +
      (zero ? '' : '<div class="stat stat-ratio"><span>' + esc(T('week.ratio')) + ' ' + helpLink('week', T('week.ratioHelp')) + '</span><b dir="ltr">' + fa(100 - week.hardPct) + ' / ' + fa(week.hardPct) + '</b>' +
      '<div class="ratio-bar" aria-hidden="true"><i style="width:' + (100 - week.hardPct) + '%"></i></div></div>') +
      '</div>';

    var keys = week.days.map(function (d) { return d.date; });
    if (keys.indexOf(selectedDay) < 0) {
      selectedDay = keys.indexOf(todayKey) >= 0 ? todayKey :
        (week.days.filter(function (d) { return ['rest', 'none'].indexOf(d.type) < 0; })[0] || week.days[0]).date;
    }
    var resolved = week.days.map(function (d) {
      return state.checkins[d.date] ? effectiveSession(d) : { session: d, adaptation: null };
    });
    html += '<div class="week-grid" role="tablist" aria-label="' + esc(T('week.daysAria')) + '">';
    resolved.forEach(function (r) {
      var s = r.session, d = s.date;
      var sel = d === selectedDay;
      var cls = 'day day-' + s.type + (d === todayKey ? ' is-today' : '') + (d < todayKey ? ' is-past' : '') + (sel ? ' is-selected' : '');
      var shortT = s.km ? fa(String(s.km)) + '<small>' + esc(T('app.kmUnit')) + '</small>' : (s.minutes ? fa(s.minutes) + '<small>' + esc(T('week.minUnit')) + '</small>' : '—');
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
    var rs = resolved[keys.indexOf(selectedDay)], ss = rs.session;
    html += '<div class="day-panel" id="day-panel" role="tabpanel" aria-labelledby="tab-' + selectedDay + '">' +
      '<div class="day-panel-head"><div><p class="eyebrow">' + esc(ss.dayName) + ' ' + esc(faDate(selectedDay)) +
      (selectedDay === todayKey ? esc(T('week.todaySuffix')) : '') + '</p><h3>' + badge(ss.type, ss.label) + '</h3></div>' +
      (selectedDay <= todayKey && ['rest', 'none', 'cancelled'].indexOf(ss.type) < 0 && (selectedDay < todayKey || state.checkins[todayKey]) ? doneButton(selectedDay, ss) : '') +
      '</div>' +
      (rs.adaptation ? adaptationBox(rs.adaptation, selectedDay) : '') +
      (ss.type !== 'cancelled' ? sessionBody(ss, selectedDay <= todayKey && selectedDay !== todayKey ? { key: selectedDay, prefix: 'panel' } : {}) : '') +
      '</div>';
    html += '</section>';
    app.innerHTML = html;
  }

  app.addEventListener('click', function (e) {
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
      if (state.done[k]) { delete state.done[k]; delete state.postRuns[k]; } else state.done[k] = true;
      save();
      route();
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
    var noPace = f.dataset.type === 'runwalk' || f.dataset.type === 'walkrun';
    if (!rpe || (!noPace && !pace)) {
      err.hidden = false;
      err.textContent = T(noPace ? 'post.errRpe' : 'post.errBoth');
      return;
    }
    var key = f.dataset.postrunForm;
    state.done[key] = true;
    state.postRuns[key] = { rpe: Number(rpe.value), pace: pace ? pace.value : null, easy: true, type: f.dataset.type, at: new Date().toISOString() };
    // سطح ۰: جلسه‌ی خیلی سخت → هفته «سخت» حساب می‌شه (مگه اینکه خود کاربر جواب داده باشه)
    if (f.dataset.type === 'walkrun' && Number(rpe.value) >= 8) {
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
    var items = [];
    var rem = C.fitnessReminder(p, now);
    if (rem) items.push('<li>' + t(rem.message) + ' <a href="#fitness">' + esc(T('fitNotes.register')) + '</a></li>');
    var trend = C.easyRpeTrend(state.postRuns, now);
    if (trend >= 2) items.push('<li><strong>' + esc(T('fitNotes.trendStrong')) + '</strong> ' + tt('fitNotes.trend', { n: trend }) + ' ' +
      t(C.EASY_RPE_WARNING) + easyActions() + '</li>');
    var sg = C.fitnessLevelSuggestion(p);
    if (sg) items.push('<li>' + esc(T('fitNotes.suggestA')) + ' <strong>' + tt('fitNotes.suggestLevel', { n: sg.to }) + '</strong> ' + tt('fitNotes.suggestB', { from: sg.from }) + ' ' +
      esc(T(sg.up ? 'fitNotes.up' : 'fitNotes.down')) +
      '<div class="actions"><button type="button" class="btn btn-outline" data-apply-level="1">' + tt('fitNotes.apply', { n: sg.to }) + '</button></div></li>');
    if (!items.length) return '';
    return '<section class="card fitness-notes"><h3>' + esc(T('fitNotes.title')) + '</h3><ul>' + items.join('') + '</ul></section>';
  }

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
        '<a class="btn btn-ghost" href="#plan">' + esc(T('checkin.back')) + '</a></section>';
      return;
    }

    ci = ci || {};
    app.innerHTML = '<section class="card checkin">' +
      '<h1>' + esc(T('checkin.heading')) + ' ' + helpLink('checkin', T('checkin.help')) + '</h1>' +
      '<p class="muted">' + esc(T('checkin.planned', { day: base.dayName, date: faDate(key) })) + ' ' + badge(base.type, base.label) + ' ' + t(base.target) + '</p>' +
      '<form id="ci-form" novalidate>' +
      '<fieldset><legend>' + esc(T('checkin.fatigueQ')) + '</legend>' + scale('fatigue', T('checkin.fatigueQ'), T('checkin.fLow'), T('checkin.fHigh'), ci.fatigue) + '</fieldset>' +
      '<fieldset><legend>' + esc(T('checkin.sleepQ')) + '</legend>' + scale('sleep', T('checkin.sleepQ'), T('checkin.sLow'), T('checkin.sHigh'), ci.sleep) + '</fieldset>' +
      '<fieldset><legend>' + esc(T('checkin.painQ')) + '</legend><div class="chips">' +
      '<label class="chip"><input type="radio" name="pain" value="no"' + (ci.pain === false ? ' checked' : '') + '><span>' + esc(T('app.no')) + '</span></label>' +
      '<label class="chip chip-danger"><input type="radio" name="pain" value="yes"><span>' + esc(T('app.yes')) + '</span></label></div>' +
      '<div class="field" id="pain-where" hidden><label for="pw">' + esc(T('checkin.where')) + '</label>' +
      '<input id="pw" name="painWhere" maxlength="120" placeholder="' + esc(T('checkin.wherePh')) + '"></div>' +
      '<small class="muted">' + esc(T('checkin.painNote')) + '</small>' +
      '</fieldset>' +
      '<div id="ci-errors" class="form-errors" role="alert" hidden></div>' +
      '<div class="actions"><button type="submit" class="btn btn-primary">' + esc(T('checkin.submit')) + '</button>' +
      '<a class="btn btn-ghost" href="#plan">' + esc(T('app.cancel')) + '</a></div>' +
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
      state.checkins[key] = { fatigue: fatigue, sleep: sleep, pain: pain === 'yes', painWhere: pain === 'yes' ? where : '', at: new Date().toISOString() };
      save();
      if (pain === 'yes') { openPainModal(key); return; }
      var r = effectiveSession(base);
      showToast(T(r.adaptation && r.adaptation.kind === 'downgrade' ? 'checkin.toastDown' : 'checkin.toastOk'));
      location.hash = '#plan';
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
      if (location.hash === '#plan') route(); else location.hash = '#plan';
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

  function renderRace() {
    var p = state.profile, g = C.goalInfo(p);
    if (g.type === 'none') {
      app.innerHTML = '<section class="card"><h1>' + esc(T('race.title')) + '</h1><p>' + esc(T('race.none')) + '</p>' +
        '<a class="btn btn-primary" href="#onboarding">' + esc(T('race.choose')) + '</a></section>';
      return;
    }
    var race = C.raceInfo(p);
    var now = today();
    var fit = C.currentFitness(p);
    var pb = fit ? fit.entry : null;
    var html = '<section class="card race-hero"><p class="eyebrow">' + esc(T('race.title')) + '</p><h1>' + t(C.goalLabel(g)) + '</h1>';
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
    html += '</section>';

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
          '<small>' + tt('race.avgPace', { p: C.formatDuration(pred / g.km) }) + '</small></div>' +
          '<div class="table-wrap"><table class="pred-table"><thead><tr><th>' + esc(T('race.thDist')) + '</th><th>' + esc(T('race.thTime')) + '</th><th>' + esc(T('race.thPace')) + '</th></tr></thead><tbody>' +
          Object.keys(C.RACE_DISTANCES).map(function (k) {
            var d = C.RACE_DISTANCES[k], tm = C.riegel(pb.timeSec, pb.distanceKm, d);
            return '<tr' + (k === g.type ? ' class="hl"' : '') + '><td>' + t(C.RACE_LABELS[k]) + '</td><td dir="ltr">' + fa(C.formatDuration(tm)) + '</td><td dir="ltr">' + fa(C.formatDuration(tm / d)) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else html += '<p>' + esc(T('race.predNeed')) + '</p>';
      html += '<a class="btn btn-outline" href="#fitness">' + esc(T('race.newTestOrPb')) + '</a></section>';
    }

    app.innerHTML = html;
  }

  // =====================================================================
  // آموزش: همه‌ی توضیح‌ها یک‌جا، بخش به بخش (محتوا از دیکشنری)
  // =====================================================================
  var GUIDE_ORDER = ['start', 'levels', 'week', 'sessions', 'intensity', 'fitness', 'checkin', 'goals', 'places', 'data'];
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
    var html = '<section class="card"><h1>' + esc(T('fit.title')) + ' ' + helpLink('fitness', T('fit.help')) + '</h1>';
    if (fit) {
      var e = fit.entry, weeks = Math.floor(C.daysBetween(C.parseDate(e.date), now) / 7);
      html += '<div class="fit-head"><div class="vdot-badge"><b>' + t(fit.vdot.toFixed(1)) + '</b><small>VDOT</small></div><div>' +
        '<p>' + tt('fit.entryLine', { label: T('fit.entry.' + (e.kind || 'record')), km: Math.round(e.distanceKm * 100) / 100 }) + ' <span dir="ltr">' + fa(C.formatDuration(e.timeSec)) + '</span></p>' +
        '<p class="small muted">' + esc(faDate(e.date)) + (weeks > 0 ? tt('fit.weeksAgo', { n: weeks }) : esc(T('fit.thisWeek'))) + '</p></div></div>';
    } else {
      html += '<p>' + esc(T('fit.none')) + '</p>';
    }
    if (rem && rem.kind === 'stale') html += '<div class="alert alert-adapt" role="status"><p>' + t(rem.message) + '</p></div>';

    if (z && z.easy) {
      var adj = z.easyAdjustSec, P = C.paceSet(p, C.assessLevel(p).level);
      var row = function (key, a, b) {
        var r = T('fit.rows.' + key);
        return '<tr' + (key === 'E' ? ' class="hl"' : '') + '><td>' + t(r[0]) + '</td><td dir="ltr">' + fa(C.formatDuration(a) + (b ? ' – ' + C.formatDuration(b) : '')) + '</td><td>' + t(r[1]) + '</td></tr>';
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
      html += '<p class="hr-line">' + esc(T('fit.hr')) + ' <b>' + tt('fit.hrRange', { a: hr.easy[0], b: hr.easy[1] }) + '</b> ' + esc(T('fit.hrUnit')) +
        (hr.maxEstimated ? ' <span class="small muted">' + tt('fit.hrEst', { n: hr.max }) + '</span>' : '') + '</p>';
    }
    html += '</section>';

    // فرم ثبت تایم‌تست/رکورد تازه
    var todayKey = C.dateKey(now);
    html += '<section class="card"><h2>' + esc(T('fit.formTitle')) + ' ' + helpLink('fitness', T('fit.formHelp')) + '</h2>' +
      '<form id="fit-form" novalidate><div class="row3">' +
      '<div class="field"><label for="fk">' + esc(T('fit.kind')) + '</label><select id="fk" name="kind">' + TEST_KINDS.map(function (k) { return '<option value="' + k[0] + '">' + esc(T('fit.kinds.' + k[0])) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" id="fkm-field" hidden><label for="fkm">' + esc(T('fit.km')) + '</label><input id="fkm" name="km" type="number" inputmode="decimal" min="1" max="100" step="0.1"></div>' +
      '<div class="field"><label for="ft">' + esc(T('fit.time')) + '</label><input id="ft" name="time" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="9:40" data-time-preview="ft-read">' +
      '<small class="muted">' + esc(T('fit.timeHint')) + '</small><small class="time-read" id="ft-read" aria-live="polite"></small></div>' +
      '<div class="field"><label for="fd">' + esc(T('fit.date')) + '</label><input id="fd" name="date" type="date" max="' + todayKey + '" value="' + todayKey + '"></div>' +
      '</div><p id="fit-err" class="form-errors" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primary">' + esc(T('fit.submit')) + '</button></form></section>';

    // تاریخچه
    var list = C.fitnessEntries(p).slice().reverse();
    if (list.length) {
      html += '<section class="card"><h2>' + esc(T('fit.history')) + '</h2><div class="table-wrap"><table class="pred-table"><thead><tr><th>' + esc(T('fit.thDate')) + '</th><th>' + esc(T('fit.thKind')) + '</th><th>' + esc(T('fit.thDist')) + '</th><th>' + esc(T('fit.thTime')) + '</th><th>VDOT</th><th></th></tr></thead><tbody>' +
        list.map(function (e, i) {
          var idx = (p.fitnessTests || []).indexOf((p.fitnessTests || []).filter(function (x) { return x.date === e.date && x.timeSec === e.timeSec && x.distanceKm === e.distanceKm; })[0]);
          return '<tr' + (i === 0 ? ' class="hl"' : '') + '><td>' + esc(faDate(e.date, true)) + '</td><td>' + esc(e.kind ? T('fit.entry.' + e.kind) : '—') + '</td><td>' + t(Math.round(e.distanceKm * 100) / 100) + ' ' + esc(T('app.kmUnit')) + '</td>' +
            '<td dir="ltr">' + fa(C.formatDuration(e.timeSec)) + '</td><td>' + t(C.vdotFromRace(e.distanceKm, e.timeSec).toFixed(1)) + '</td>' +
            '<td>' + (e.kind !== 'baseline' && idx >= 0 ? '<button type="button" class="linklike" data-del-test="' + idx + '">' + esc(T('fit.del')) + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }

    // ضربان قلب
    html += '<section class="card"><h2>' + esc(T('fit.hrTitle')) + '</h2>' + hrFields(p) +
      '<p id="hr-err" class="form-errors" role="alert" hidden></p><button type="button" class="btn btn-outline" id="hr-save">' + esc(T('fit.hrSave')) + '</button></section>';

    app.innerHTML = html;

    var form = document.getElementById('fit-form');
    form.kind.addEventListener('change', function () { document.getElementById('fkm-field').hidden = form.kind.value !== 'race'; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var kind = form.kind.value;
      var km = kind === 'race' ? Number(form.km.value) : TEST_KINDS.filter(function (k) { return k[0] === kind; })[0][1];
      var tm = C.parseTime(form.time.value), date = form.date.value;
      var err = document.getElementById('fit-err');
      var v = km && tm ? km / (tm / 3600) : 0;
      if (!(km >= 1 && km <= 100)) { err.hidden = false; err.textContent = T('fit.err.km'); return; }
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
      showToast(fa(T('fit.toast', { vdot: (before && before.vdot ? before.vdot.toFixed(1) + arrow : '') + after.vdot.toFixed(1), a: C.formatDuration(after.easy[0]), b: C.formatDuration(after.easy[1]) })));
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

  function renderProfile() {
    var p = state.profile;
    var bmi = C.bmi(p);
    var lv = C.assessLevel(p), hrz = C.hrZones(p), fit = C.currentFitness(p), g = C.goalInfo(p);
    var nCheck = Object.keys(state.checkins).length, nDone = Object.keys(state.done).length;
    var muted = function (key) { return '<span class="muted">' + esc(T(key)) + '</span>'; };
    function row(k, v) { return '<div class="kv"><dt>' + esc(T('profile.rows.' + k)) + '</dt><dd>' + v + '</dd></div>'; }
    app.innerHTML = '<section class="card"><h1>' + esc(T('profile.title')) + '</h1><dl class="kv-list">' +
      row('level', tt('profile.levelVal', { n: lv.level, name: lv.info.name }) +
        (lv.vdot ? ' <span class="muted small">(VDOT ' + t(lv.vdot.toFixed(1)) + ')</span>' : '')) +
      row('exp', esc(C.EXPERIENCE[p.experience] ? C.EXPERIENCE[p.experience].label : '—')) +
      row('structured', esc(T(p.structured ? 'profile.structYes' : 'profile.structNo'))) +
      row('hr', hrz ? tt('profile.hrVal', { a: hrz.easy[0], b: hrz.easy[1] }) : muted('profile.notEntered')) +
      row('fitness', fit ? 'VDOT ' + t(fit.vdot.toFixed(1)) + ' · <a href="#fitness">' + esc(T('profile.details')) + '</a>' : '<a href="#fitness">' + esc(T('profile.registerTest')) + '</a>') +
      row('km', p.monthAvgKm != null && p.experience !== 'never' ? tt('profile.kmVal2', { last: p.lastWeekKm, avg: p.monthAvgKm, start: lv.volume ? lv.volume.start : p.currentWeeklyKm })
        : tt('profile.kmVal', { n: p.currentWeeklyKm })) +
      row('body', tt('profile.bodyVal', { age: p.age, w: p.weightKg, h: p.heightCm }) + ' <span class="muted small">(BMI ' + t(bmi.toFixed(1)) + ')</span>') +
      row('days', esc(p.days.map(function (d) { return C.DAY_NAMES[d]; }).join(T('app.listSep')))) +
      row('locs', esc(p.locations.map(function (l) { return C.LOCATION_LABELS[l]; }).join(T('app.listSep')))) +
      row('injury', p.injury ? t(p.injury) : muted('profile.notRecorded')) +
      row('goal', g.type !== 'none' ? t(C.goalLabel(g)) + (g.date ? ' — ' + esc(faDate(g.date)) : ' <span class="muted small">' + esc(T('profile.noDate')) + '</span>') : muted('profile.noGoal')) +
      row('pb', p.pb ? tt('profile.pbVal', { km: p.pb.distanceKm }) + ' <span dir="ltr">' + fa(C.formatDuration(p.pb.timeSec)) + '</span>' : muted('profile.notRecorded')) +
      row('start', esc(faDate(p.startDate))) +
      row('stats', tt('profile.statsVal', { c: nCheck, d: nDone })) +
      '</dl><div class="actions">' +
      '<a class="btn btn-primary" href="#onboarding">' + esc(T('profile.edit')) + '</a>' +
      '<button type="button" class="btn btn-outline" id="restart">' + esc(T('profile.restart')) + '</button>' +
      '<button type="button" class="btn btn-ghost" id="logout">' + esc(T('login.logout')) + '</button>' +
      '<button type="button" class="btn btn-ghost danger-text" id="wipe">' + esc(T('profile.wipe')) + '</button>' +
      '</div><div id="confirm-box" class="alert alert-note confirm-box" role="alertdialog" aria-live="polite" hidden>' +
      '<p id="confirm-text"></p><div class="actions">' +
      '<button type="button" class="btn btn-primary" id="confirm-yes">' + esc(T('profile.confirmYes')) + '</button>' +
      '<button type="button" class="btn btn-ghost" id="confirm-no">' + esc(T('app.cancel')) + '</button></div></div></section>' +
      warningsCard(C.profileWarnings(p, today()));

    // تایید داخل صفحه (به‌جای confirm مرورگر)
    var pending = null;
    function ask(text, action) {
      pending = action;
      document.getElementById('confirm-text').textContent = text;
      document.getElementById('confirm-box').hidden = false;
      document.getElementById('confirm-yes').focus();
    }
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
        location.hash = '#plan';
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
        try { localStorage.removeItem(STORE_KEY); } catch (e) { /* */ }
        memoryFallback = null;
        location.hash = '#onboarding';
        route();
      });
    });
  }

  applyStatic();
  route();
})();
