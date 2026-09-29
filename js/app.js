/*
 * رابط کاربری «مربی خودت باش» — بدون فریم‌ورک، داده‌ها فقط در localStorage.
 */
(function () {
  'use strict';
  var C = window.CoachLogic;
  var STORE_KEY = 'iranrunners-coach-mvp-v1';
  // نسخه ۳: سطح ۱ تا ۱۰ از حجم، سابقه، رکورد و تجربه‌ی تمرین ساختاریافته محاسبه می‌شه
  var SCHEMA_VERSION = 3;
  var app = document.getElementById('app');
  var modalRoot = document.getElementById('modal-root');

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
    catch (e) { showToast('ذخیره در مرورگر ممکن نشد؛ داده‌ها فقط تا بستن صفحه می‌مونن.'); }
  }
  var state = load();

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
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function fa(x) {
    return String(x).replace(/(\d)\.(\d)/g, '$1٫$2').replace(/\d/g, function (d) { return FA_DIGITS[d]; });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(s) { return esc(fa(s)); }
  var faDateFmt, faShortFmt;
  try {
    faDateFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric' });
    faShortFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
  } catch (e) { faDateFmt = faShortFmt = null; }
  function faDate(key, short) {
    var d = C.parseDate(key);
    var f = short ? faShortFmt : faDateFmt;
    return f ? f.format(d) : fa(key);
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
  var VIEWS = { plan: renderPlan, checkin: renderCheckin, fitness: renderFitness, race: renderRace, profile: renderProfile, onboarding: renderOnboarding };
  function route() {
    var v = (location.hash || '#plan').slice(1);
    if (!state.profile || needsMigration()) v = 'onboarding';
    if (!VIEWS[v]) v = 'plan';
    var nav = document.getElementById('main-nav');
    nav.hidden = !state.profile || v === 'onboarding' || needsMigration();
    document.getElementById('nav-race').hidden = !(state.profile && C.goalInfo(state.profile).type !== 'none');
    nav.querySelectorAll('a').forEach(function (a) {
      if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    VIEWS[v]();
    var pk = unackedPainToday();
    if (pk) openPainModal(pk);
  }
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });

  // تأیید زنده‌ی زمان واردشده: «= ۹ دقیقه و ۴۰ ثانیه»
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.timePreview) return;
    var out = document.getElementById(el.dataset.timePreview);
    if (!out) return;
    var v = el.value.trim(), sec = C.parseTime(v);
    out.textContent = !v ? '' : (sec ? '= ' + fa(C.describeDuration(sec)) : 'قالب زمان رو نشناختم؛ مثلاً «9:40» یا «940»');
    out.classList.toggle('bad', !!v && !sec);
  });

  // =====================================================================
  // ۱. فرم اولیه
  // =====================================================================
  // فاصله‌های رایج برای رکورد؛ «other» = فاصله‌ی دلخواه
  var PB_DISTANCES = [['5', 5, '۵ کیلومتر'], ['10', 10, '۱۰ کیلومتر'], ['21', 21.0975, 'نیمه‌ماراتن'], ['42', 42.195, 'ماراتن'], ['other', null, 'فاصله‌ی دیگه']];
  function pbDistanceKey(km) {
    if (!km) return '';
    for (var i = 0; i < PB_DISTANCES.length - 1; i++) if (Math.abs(PB_DISTANCES[i][1] - km) < 0.01) return PB_DISTANCES[i][0];
    return 'other';
  }

  function levelCard(a, compact) {
    var L = a.info;
    var mar = L.marathon;
    var marText = mar[1] === Infinity ? 'کندتر از ' + C.formatDuration(mar[0]) :
      (mar[0] === 0 ? 'زیر ' + C.formatDuration(mar[1]) : C.formatDuration(mar[0]) + ' تا ' + C.formatDuration(mar[1]));
    var kmText = L.km[1] === Infinity ? L.km[0] + ' کیلومتر و بیشتر' : (L.km[0] === 0 ? 'زیر ' + L.km[1] : L.km[0] + ' تا ' + L.km[1]) + ' کیلومتر';
    return '<div class="level-card' + (compact ? ' compact' : '') + '">' +
      '<div class="level-num" aria-hidden="true"><b>' + fa(a.level) + '</b><small>از ۱۰</small></div>' +
      '<div class="level-body"><p class="eyebrow">سطح تو</p><h3>سطح ' + fa(a.level) + ': ' + esc(L.name) + '</h3>' +
      '<p class="small muted">' + esc(L.desc) + ' · حجم مرجع: ' + t(kmText) + ' · ماراتن مرجع: <span dir="ltr">' + fa(marText) + '</span></p>' +
      '<p class="small">' + (a.source === 'pb'
        ? 'تعیین‌شده از روی رکوردت (VDOT ' + t(a.vdot.toFixed(1)) + ')؛ سطح تقریبی از روی حجم: ' + fa(a.volLevel)
        : 'تعیین‌شده از روی حجم فعلی و سابقه‌ات؛ با وارد کردن رکورد، دقیق‌تر می‌شه.') + '</p>' +
      '<p class="small"><b>نوع تمرین‌ها:</b> ' + esc(C.TIER_INFO[L.tier]) + '</p>' +
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

    function chip(name, value, label, checked, type) {
      return '<label class="chip"><input type="' + (type || 'checkbox') + '" name="' + name + '" value="' + value + '"' +
        (checked ? ' checked' : '') + '><span>' + label + '</span></label>';
    }

    app.innerHTML =
      '<section class="card onboarding">' +
      '<h1>' + (editing ? 'ویرایش پروفایل' : 'بیا برنامه‌ی دویدنت رو بسازیم') + '</h1>' +
      (migrating ? '<div class="alert alert-adapt" role="status"><strong>سطح‌بندی جدید</strong>' +
        '<p>از این نسخه، سطحت (از ۱ تا ۱۰) به‌جای انتخاب مستقیم، از روی حجم فعلی، سابقه، رکورد و تجربه‌ی تمرینیت محاسبه می‌شه. لطفاً بخش اول رو کامل کن و ذخیره کن.</p></div>' : '') +
      '<p class="muted">' + (editing ? 'تغییرات، برنامه‌ی هفته‌های پیش رو رو دوباره می‌سازه. اگه سطح یا حجم فعلیت عوض بشه، برنامه از همین هفته با حجم جدید شروع می‌شه.' :
        'این فرم فقط یک‌بار پر می‌شه (بعداً از بخش پروفایل قابل ویرایشه). همه‌ی اطلاعات فقط روی همین مرورگر می‌مونه.') + '</p>' +
      '<form id="onb" novalidate>' +

      '<fieldset><legend>۱. وضعیت فعلی دویدنت</legend>' +
      '<p class="muted small">سطحت رو خودمون از روی این جواب‌ها محاسبه می‌کنیم (از ۱ تا ۱۰، بر اساس جدول VDOT جک دنیلز).</p>' +
      '<div class="field"><label for="curkm">همین الان، به طور میانگین چند کیلومتر در هفته می‌دوی؟ <span class="req">(ضروری)</span></label>' +
      '<input id="curkm" name="currentWeeklyKm" type="number" inputmode="decimal" min="0" max="400" step="0.5" required value="' +
      esc(p.currentWeeklyKm != null && (p.currentWeeklyKm > 0 || !migrating) ? p.currentWeeklyKm : '') + '">' +
      '<small class="muted">میانگین چند هفته‌ی اخیر. اگه اصلاً نمی‌دوی، ۰ بنویس. هفته‌ی اول برنامه دقیقاً از همین عدد شروع می‌شه.</small></div>' +
      '<p class="sub-legend">چه مدته منظم می‌دوی؟ <span class="req">(ضروری)</span></p><div class="chips">' +
      Object.keys(C.EXPERIENCE).map(function (k) { return chip('experience', k, C.EXPERIENCE[k].label, p.experience === k, 'radio'); }).join('') + '</div>' +
      '<p class="sub-legend">تا حالا تمرین ساختاریافته (اینتروال، تمپو) انجام دادی؟ <span class="req">(ضروری)</span></p><div class="chips">' +
      chip('structured', 'yes', 'بله', p.structured === true, 'radio') + chip('structured', 'no', 'نه', p.structured === false, 'radio') + '</div>' +
      '<p class="sub-legend">بهترین رکورد اخیرت (اختیاری، ولی سطح رو خیلی دقیق‌تر می‌کنه)</p>' +
      '<div class="row3">' +
      '<div class="field"><label for="pbsel">فاصله</label><select id="pbsel" name="pbSel"><option value="">رکورد ندارم</option>' +
      PB_DISTANCES.map(function (d) { return '<option value="' + d[0] + '"' + (pbKey === d[0] ? ' selected' : '') + '>' + d[2] + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field" id="pbother-field"' + (pbKey === 'other' ? '' : ' hidden') + '><label for="pbother">فاصله (کیلومتر)</label>' +
      '<input id="pbother" name="pbOther" type="number" inputmode="decimal" min="1" max="100" step="0.1" value="' + esc(pbKey === 'other' ? pb.distanceKm : '') + '"></div>' +
      '<div class="field" id="pbtime-field"' + (pbKey ? '' : ' hidden') + '><label for="pbtime">زمان (ساعت:دقیقه:ثانیه)</label>' +
      '<input id="pbtime" name="pbTime" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="3:25:00" data-time-preview="pbtime-read" value="' + esc(pb.timeSec ? C.formatDuration(pb.timeSec) : '') + '">' +
      '<small class="muted">مثلاً «3:25:00» یا فقط «32500»؛ برای ۵ کیلومتر «24:30» یا «2430».</small><small class="time-read" id="pbtime-read" aria-live="polite"></small></div>' +
      '</div>' +
      '<div id="level-preview" aria-live="polite"></div>' +
      '</fieldset>' +

      '<fieldset><legend>۲. مشخصات بدنی</legend><div class="row3">' +
      '<div class="field"><label for="age">سن (سال)</label><input id="age" name="age" type="number" inputmode="numeric" min="12" max="90" required value="' + esc(p.age || '') + '"></div>' +
      '<div class="field"><label for="weight">وزن (کیلوگرم)</label><input id="weight" name="weightKg" type="number" inputmode="decimal" min="30" max="250" required value="' + esc(p.weightKg || '') + '"></div>' +
      '<div class="field"><label for="height">قد (سانتی‌متر)</label><input id="height" name="heightCm" type="number" inputmode="numeric" min="120" max="230" required value="' + esc(p.heightCm || '') + '"></div>' +
      '</div></fieldset>' +

      '<fieldset><legend>۳. کدوم روزها وقت آزاد داری؟</legend><div class="chips">' +
      C.DAY_NAMES.map(function (n, i) { return chip('days', i, n, days.indexOf(i) >= 0); }).join('') + '</div>' +
      '<small class="muted">سیستم بهترین روزها رو برای جلسات انتخاب می‌کنه؛ لازم نیست همه‌ی روزهای آزاد تمرین باشن.</small>' +
      '</fieldset>' +

      '<fieldset><legend>۴. محل تمرین در دسترس</legend><div class="chips">' +
      Object.keys(C.LOCATION_LABELS).map(function (k) { return chip('locations', k, C.LOCATION_LABELS[k], locs.indexOf(k) >= 0); }).join('') +
      '</div></fieldset>' +

      '<fieldset><legend>۵. سابقه آسیب یا محدودیت جسمی</legend>' +
      '<div class="field"><label for="injury">اگه داری، کوتاه بنویس (اختیاری)</label>' +
      '<textarea id="injury" name="injury" rows="2" maxlength="300" placeholder="مثلاً: درد زانوی راست سال گذشته، آسم">' + esc(p.injury || '') + '</textarea></div>' +
      '</fieldset>' +

      '<fieldset><legend>۶. هدف مسابقه</legend>' +
      '<div class="field"><label for="gtype">نوع مسابقه‌ی هدف</label><select id="gtype" name="goalType">' +
      Object.keys(C.GOAL_TYPES).map(function (k) { return '<option value="' + k + '"' + (goal.type === k ? ' selected' : '') + '>' + C.GOAL_TYPES[k] + '</option>'; }).join('') +
      '</select><small class="muted">نوع تمرین‌های شدید بر اساس همین هدف تخصصی می‌شه. بدون هدف، تمرین‌ها بین انواع مختلف می‌چرخن.</small></div>' +
      '<div id="goal-fields" class="race-fields"' + (goal.type === 'none' ? ' hidden' : '') + '>' +
      '<div class="field"><label for="rdate">تاریخ مسابقه (اگه مسابقه‌ی مشخصی داری)</label><input id="rdate" name="raceDate" type="date" min="' + todayKey + '" value="' + esc(goal.date || '') + '">' +
      '<small class="muted" id="rdate-fa"></small><small class="muted">بدون تاریخ، تمرین‌ها با تمرکز این هدف چیده می‌شن ولی تیپر نداره.</small></div>' +
      '<div id="ultra-fields"' + (goal.type === 'ultra' ? '' : ' hidden') + '>' +
      '<p class="small muted">مسابقه‌های تریل و اولترا فاصله‌ی استاندارد ندارن؛ مشخصات مسیر خودت رو وارد کن.</p>' +
      '<div class="row2"><div class="field"><label for="ukm">مسافت مسابقه (کیلومتر) <span class="req">(ضروری)</span></label>' +
      '<input id="ukm" name="ultraKm" type="number" inputmode="decimal" min="10" max="400" step="0.1" value="' + esc(goal.km || '') + '"></div>' +
      '<div class="field"><label for="ugain">ارتفاع‌گیری تجمعی (متر صعود) <span class="req">(ضروری)</span></label>' +
      '<input id="ugain" name="ultraGain" type="number" inputmode="numeric" min="0" max="20000" step="10" value="' + esc(goal.type === 'ultra' ? goal.gain : '') + '"></div></div>' +
      '<div class="row3"><div class="field"><label for="uloss">ارتفاع نزول (متر، اختیاری)</label>' +
      '<input id="uloss" name="ultraLoss" type="number" inputmode="numeric" min="0" max="20000" step="10" value="' + esc(goal.loss || '') + '"><small class="muted">اگه مسیر نقطه‌به‌نقطه‌ست و با صعود فرق داره</small></div>' +
      '<div class="field"><label for="uterrain">نوع زمین غالب (اختیاری)</label><select id="uterrain" name="ultraTerrain"><option value="">انتخاب نشده</option>' +
      Object.keys(C.TERRAIN_LABELS).map(function (k) { return '<option value="' + k + '"' + (goal.terrain === k ? ' selected' : '') + '>' + C.TERRAIN_LABELS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="ualt">ارتفاع از سطح دریا (متر، اختیاری)</label>' +
      '<input id="ualt" name="ultraAlt" type="number" inputmode="numeric" min="0" max="6000" step="10" value="' + esc(goal.altitude || '') + '"><small class="muted">اگه مسابقه در ارتفاع بالا برگزار می‌شه</small></div></div>' +
      '<p id="ultra-ratio" class="ultra-ratio" aria-live="polite"></p>' +
      '</div></div></fieldset>' +

      '<fieldset><legend>۷. ضربان قلب (اختیاری)</legend>' + hrFields(p) + '</fieldset>' +

      '<div id="onb-errors" class="form-errors" role="alert" hidden></div>' +
      '<div class="actions">' +
      '<button type="submit" class="btn btn-primary">' + (editing ? 'ذخیره و به‌روزرسانی برنامه' : 'ساخت برنامه‌ی من') + '</button>' +
      (editing && !needsMigration() ? '<a class="btn btn-ghost" href="#profile">انصراف</a>' : '') +
      '</div></form></section>';

    var form = document.getElementById('onb');

    // خوندن رکورد از فرم؛ null = رکوردی وارد نشده، false = ناقص/نامعتبر
    function readPb() {
      var sel = form.pbSel.value;
      if (!sel) return null;
      var km = sel === 'other' ? Number(form.pbOther.value) : PB_DISTANCES.filter(function (d) { return d[0] === sel; })[0][1];
      var tt = C.parseTime(form.pbTime.value);
      if (!(km >= 1 && km <= 100) || !tt) return false;
      // سرعت غیرممکن (سریع‌تر از رکورد جهانی) یا خیلی کند
      var v = km / (tt / 3600);
      if (v > 26 || v < 3) return false;
      return { distanceKm: km, timeSec: tt };
    }
    function readLevelInputs() {
      var kmRaw = form.currentWeeklyKm.value.trim();
      var exp = form.querySelector('input[name=experience]:checked');
      var st = form.querySelector('input[name=structured]:checked');
      if (kmRaw === '' || !exp || !st) return null;
      var pbv = readPb();
      return { currentWeeklyKm: Number(kmRaw), experience: exp.value, structured: st.value === 'yes', pb: pbv || null, pbInvalid: pbv === false };
    }
    function syncLevel() {
      var sel = form.pbSel.value;
      document.getElementById('pbother-field').hidden = sel !== 'other';
      document.getElementById('pbtime-field').hidden = !sel;
      var box = document.getElementById('level-preview');
      var inp = readLevelInputs();
      if (!inp) {
        box.innerHTML = '<p class="small muted level-wait">بعد از جواب دادن به سؤال‌های ضروری بالا، سطحت همین‌جا نشون داده می‌شه.</p>';
        return;
      }
      box.innerHTML = levelCard(C.assessLevel(inp)) +
        (inp.pbInvalid ? '<p class="small form-hint">رکورد کامل یا معتبر نیست و فعلاً در محاسبه‌ی سطح استفاده نشده.</p>' : '');
    }
    function syncRace() {
      var gt = form.goalType.value;
      document.getElementById('goal-fields').hidden = gt === 'none';
      document.getElementById('ultra-fields').hidden = gt !== 'ultra';
      var out = document.getElementById('ultra-ratio');
      var km = Number(form.ultraKm.value), gain = form.ultraGain.value === '' ? null : Number(form.ultraGain.value);
      if (gt === 'ultra' && km > 0 && gain !== null && gain >= 0) {
        var cls = C.ultraClass(gain / km), info = C.ULTRA_CLASS_INFO[cls];
        out.innerHTML = 'شاخص فنی بودن مسیر: <b>' + fa(Math.round(gain / km)) + ' متر صعود در هر کیلومتر</b> → ' + esc(info.label) + '<br>تأکید برنامه: ' + esc(info.emphasis);
      } else out.textContent = '';
    }
    form.addEventListener('input', syncRace);
    function syncDate() {
      var v = document.getElementById('rdate').value;
      document.getElementById('rdate-fa').textContent = v ? 'معادل شمسی: ' + faDate(v) : '';
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
      var kmRaw = String(fd.get('currentWeeklyKm') || '').trim();
      var curKm = Number(kmRaw);
      if (kmRaw === '' || !(curKm >= 0 && curKm <= 400)) errs.push('بنویس الان به طور میانگین چند کیلومتر در هفته می‌دوی (عددی بین ۰ تا ۴۰۰).');
      if (!fd.get('experience')) errs.push('بگو چه مدته منظم می‌دوی.');
      if (!fd.get('structured')) errs.push('بگو تا حالا تمرین ساختاریافته (اینتروال، تمپو) انجام دادی یا نه.');
      var pbObj = readPb();
      if (pbObj === false) errs.push('رکورد: فاصله و زمان رو کامل و درست وارد کن (مثلاً «3:25:00» یا فقط «32500»)، یا «رکورد ندارم» رو انتخاب کن.');
      var hrIn = readHr(form);
      if (hrIn.error) errs.push(hrIn.error);
      if (!(age >= 12 && age <= 90)) errs.push('سن باید بین ۱۲ تا ۹۰ باشه.');
      if (!(w >= 30 && w <= 250)) errs.push('وزن باید بین ۳۰ تا ۲۵۰ کیلوگرم باشه.');
      if (!(h >= 120 && h <= 230)) errs.push('قد باید بین ۱۲۰ تا ۲۳۰ سانتی‌متر باشه.');
      if (!selDays.length) errs.push('حداقل یک روز آزاد انتخاب کن.');
      if (!selLocs.length) errs.push('حداقل یک محل تمرین انتخاب کن.');
      var gType = fd.get('goalType') || 'none', goalObj = { type: gType, date: null };
      if (gType !== 'none') {
        var rd = fd.get('raceDate');
        if (rd && C.daysBetween(today(), C.parseDate(rd)) < 1) errs.push('تاریخ مسابقه باید بعد از امروز باشه (یا خالیش بذار).');
        goalObj.date = rd || null;
        if (gType === 'ultra') {
          var num = function (n) { var v = String(fd.get(n) || '').trim(); return v === '' ? null : Number(v); };
          var uk = num('ultraKm'), ug = num('ultraGain'), ul = num('ultraLoss'), ua = num('ultraAlt');
          if (!(uk >= 10 && uk <= 400)) errs.push('مسافت مسابقه‌ی تریل رو وارد کن (۱۰ تا ۴۰۰ کیلومتر).');
          if (ug === null || !(ug >= 0 && ug <= 20000)) errs.push('ارتفاع‌گیری تجمعی مسابقه (متر صعود) رو وارد کن؛ اگه مسیر تخته، ۰ یا یه عدد کم بنویس.');
          if (ul !== null && !(ul >= 0 && ul <= 20000)) errs.push('ارتفاع نزول باید بین ۰ تا ۲۰۰۰۰ متر باشه.');
          if (ua !== null && !(ua >= 0 && ua <= 6000)) errs.push('ارتفاع از سطح دریا باید بین ۰ تا ۶۰۰۰ متر باشه.');
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
        currentWeeklyKm: curKm, experience: fd.get('experience'), structured: fd.get('structured') === 'yes',
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
      var keep = editing && !migrating && p.startDate && p.currentWeeklyKm === curKm &&
        C.assessLevel(p).level === C.assessLevel(next).level;
      next.startDate = keep ? p.startDate : C.dateKey(today());
      state.profile = next;
      save();
      showToast(editing ? 'برنامه به‌روز شد.' : 'برنامه‌ات ساخته شد!');
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
      html += '<div class="sess-orig">برنامه‌ی اصلی: <s>' + t(s.original.label + ' — ' + s.original.target) + '</s></div>';
    }
    if (s.steps && s.steps.length) {
      html += '<ol class="sess-steps">' + s.steps.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ol>';
    }
    if (s.how && s.type !== 'cancelled') html += '<p class="sess-how">' + t(s.how) + '</p>';
    if (s.talk && s.type !== 'cancelled') html += '<p class="talk-test">' + t(s.talk) + '</p>';
    if (opts.hint && s.easyEffort) html += '<p class="day-hint">' + t(opts.hint.message) + '</p>';
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
      return '<div class="alert ' + cls + ' postrun-fb" role="status"><p class="small muted">بعد از جلسه: سختی ' + fa(post.rpe) + ' از ۱۰' +
        (post.pace === 'ok' ? ' · پیس طبق برنامه' : post.pace === 'fast' ? ' · تندتر از بازه' : '') + '</p><p>' + t(fb.message) + '</p>' +
        (fb.kind === 'warn' ? easyActions() : '') + '</div>';
    }
    if (postRunOpen !== key) return '';
    var n = 'rpe-' + prefix;
    var h = '<form class="postrun" data-postrun-form="' + key + '" data-type="' + s.type + '" novalidate>' +
      '<p class="sub-legend">این دو چقدر برات آسون بود؟ از ۱ (خیلی سبک) تا ۱۰ (خیلی سخت).</p><div class="scale scale10" role="radiogroup" aria-label="سختی جلسه">';
    for (var i = 1; i <= 10; i++) h += '<label class="scale-opt"><input type="radio" name="rpe" id="' + n + '-' + i + '" value="' + i + '"><span>' + fa(i) + '</span></label>';
    h += '</div><div class="scale-ends"><span>۱ = خیلی سبک</span><span>۱۰ = خیلی سخت</span></div>';
    if (s.type !== 'runwalk') {
      h += '<p class="sub-legend">پیست چطور بود؟</p><div class="chips">' +
        '<label class="chip"><input type="radio" name="pace" value="ok"><span>داخل بازه‌ی ایزی یا کندتر</span></label>' +
        '<label class="chip"><input type="radio" name="pace" value="fast"><span>تندتر از بازه</span></label>' +
        '<label class="chip"><input type="radio" name="pace" value="unknown"><span>پیس رو نگاه نکردم</span></label></div>';
    }
    return h + '<p class="form-errors" hidden></p><div class="actions"><button type="submit" class="btn btn-primary">ثبت</button>' +
      '<button type="button" class="btn btn-ghost" data-postrun-cancel="1">انصراف</button></div></form>';
  }
  function easyActions() {
    var p = state.profile, adj = Number(p.easyAdjustSec) || 0;
    return '<div class="actions">' +
      (adj < C.EASY_ADJUST_MAX ? '<button type="button" class="btn btn-outline" data-slow-easy="1">پیس ایزی رو ۱۰ ثانیه کندتر کن</button>' : '') +
      '<a class="btn btn-ghost" href="#fitness">ثبت تایم‌تست تازه</a></div>';
  }

  function badge(type, label) {
    return '<span class="badge badge-' + type + '">' + esc(label) + '</span>';
  }

  function adaptationBox(ad, key) {
    if (!ad) return '';
    if (ad.kind === 'pain') {
      var ci = state.checkins[key];
      return '<div class="alert alert-pain" role="alert"><strong>جلسه‌ی امروز لغو شد.</strong>' +
        '<p class="pain-msg">' + esc(C.PAIN_MESSAGE) + '</p>' +
        (ci && ci.painWhere ? '<p class="small">محل درد گزارش‌شده: ' + t(ci.painWhere) + '</p>' : '') +
        '<p class="small">تا وقتی درد برطرف نشده و پزشک اجازه نداده، دویدن رو از سر نگیر.</p></div>';
    }
    var cls = ad.kind === 'downgrade' ? 'alert-adapt' : 'alert-note';
    return '<div class="alert ' + cls + '" role="status">' +
      (ad.kind === 'downgrade' ? '<strong>برنامه‌ی امروز تغییر کرد</strong>' : '') + '<p>' + t(ad.message) + '</p></div>';
  }

  function todayCard() {
    var now = today(), key = C.dateKey(now);
    var base = C.sessionFor(state.profile, now);
    var ci = state.checkins[key];
    var needsCheckin = ['rest', 'none'].indexOf(base.type) < 0;
    var html = '<section class="card today-card"><div class="today-head"><div>' +
      '<p class="eyebrow">جلسه‌ی امروز · ' + esc(base.dayName) + ' ' + esc(faDate(key)) + '</p>';

    // یادآوری درد دیروز
    var pc = prevCheckin(key);
    var yesterdayPain = pc && pc.pain;

    if (!needsCheckin) {
      html += '<h2>' + badge(base.type, base.label) + '</h2></div></div>' + sessionBody(base);
      if (yesterdayPain && !ci) html += painYesterdayBox();
      return html + '</section>';
    }
    if (!ci) {
      html += '<h2>' + badge(base.type, base.label) + ' <span class="pending">— منتظر چک‌این</span></h2></div></div>' +
        (yesterdayPain ? painYesterdayBox() : '') +
        '<div class="checkin-cta"><p>قبل از شروع، یه چک‌این ۳۰ ثانیه‌ای انجام بده تا جلسه‌ی امروز با وضعیت بدنت تطبیق داده بشه.</p>' +
        '<a class="btn btn-primary" href="#checkin">چک‌این قبل از تمرین</a></div>' +
        '<details class="preview"><summary>پیش‌نمایش جلسه‌ی برنامه‌ریزی‌شده</summary>' + sessionBody(base) + '</details>';
      return html + '</section>';
    }
    var r = effectiveSession(base);
    var s = r.session;
    html += '<h2>' + badge(s.type, s.label) + '</h2></div>' +
      (s.type !== 'cancelled' ? doneButton(key, s) : '') + '</div>' +
      adaptationBox(r.adaptation, key) +
      (s.type !== 'cancelled' ? sessionBody(s, { key: key, prefix: 'today', hint: C.easyDayHint(ci, prevCheckin(key)) }) : '') +
      '<p class="small muted">چک‌این امروز: خستگی ' + fa(ci.fatigue) + ' از ۵ · خواب ' + fa(ci.sleep) + ' از ۵ · درد: ' + (ci.pain ? 'بله' : 'نه') +
      (ci.pain ? '' : ' · <a href="#checkin">ویرایش چک‌این</a>') + '</p>';
    return html + '</section>';
  }

  function painYesterdayBox() {
    return '<div class="alert alert-pain-soft" role="note"><strong>دیروز درد گزارش کردی.</strong> ' +
      'اگه هنوز درد داری، امروز هم تمرین نکن و به پزشک مراجعه کن. توی چک‌این امروز دقیق جواب بده.</div>';
  }

  function doneButton(key, s) {
    var done = !!state.done[key];
    // جلسه‌ی ایزی: قبل از ثبت انجام، سؤال RPE و پیس پرسیده می‌شه
    if (!done && s && s.easyEffort) {
      return '<button type="button" class="btn btn-outline" data-postrun="' + key + '" aria-expanded="' + (postRunOpen === key) + '">انجامش دادم</button>';
    }
    return '<button type="button" class="btn ' + (done ? 'btn-done' : 'btn-outline') + '" data-done="' + key + '" aria-pressed="' + done + '">' +
      (done ? '✓ انجام شد' : 'انجامش دادم') + '</button>';
  }

  function renderPlan() {
    var p = state.profile;
    var now = today();
    var viewDate = C.addDays(now, viewWeekOffset * 7);
    var week = C.buildWeek(p, viewDate);
    var todayKey = C.dateKey(now);
    var warnings = C.profileWarnings(p, now);
    var lv = C.assessLevel(p);
    var isRunWalk = lv.level === 1;

    var html = '';
    html += todayCard();
    html += '<section class="card level-strip">' + levelCard(lv, true) + '</section>';
    html += fitnessNotesCard(p, now);

    if (warnings.length) {
      html += '<section class="card warnings"><h3>نکته‌های مهم برای تو</h3><ul>' +
        warnings.map(function (w) { return '<li>' + t(w) + '</li>'; }).join('') + '</ul></section>';
    }

    // سربرگ هفته
    var wkNum = week.weekIndex + 1;
    html += '<section class="card week-card"><div class="week-head">' +
      '<button type="button" class="btn btn-icon" data-week="-1" aria-label="هفته‌ی قبل"' + (week.start <= p.startDate ? ' disabled' : '') + '>›</button>' +
      '<div class="week-title"><h2>' + (week.weekIndex >= 0 ? 'هفته‌ی ' + fa(wkNum) + ' برنامه' : week.phase.key === 'intro' ? 'هفته‌ی شروع' : 'قبل از شروع') + '</h2>' +
      '<p class="muted">' + esc(faDate(week.start, true)) + ' تا ' + esc(faDate(week.days[6].date, true)) +
      (viewWeekOffset !== 0 ? ' · <button type="button" class="linklike" data-week="0">برگشت به این هفته</button>' : '') + '</p></div>' +
      '<button type="button" class="btn btn-icon" data-week="1" aria-label="هفته‌ی بعد">‹</button></div>';

    var runDays = week.days.filter(function (d) { return ['rest', 'none'].indexOf(d.type) < 0; }).length;
    html += '<div class="week-stats">' +
      '<div class="stat"><span>فاز</span><b>' + t(week.phase.label) + '</b>' +
      (week.periodLabel ? '<small class="period-tag">' + esc(week.periodLabel) + '</small>' : '') + '</div>' +
      '<div class="stat"><span>جلسات</span><b>' + fa(runDays) + ' جلسه</b></div>' +
      (isRunWalk ? '<div class="stat"><span>کل زمان</span><b>' + fa(week.totalMin) + ' دقیقه</b></div>'
        : '<div class="stat"><span>حجم کل</span><b>' + t(week.totalKm) + ' کیلومتر</b>' +
          (week.goal && week.goal.category === 'ultra' && week.vert ? '<small class="period-tag">ارتفاع‌گیری: +' + fa(week.vert) + ' متر</small>' : '') + '</div>') +
      '<div class="stat stat-ratio"><span>نسبت آسان / سخت</span><b>' + fa(100 - week.hardPct) + ' / ' + fa(week.hardPct) + '</b>' +
      '<div class="ratio-bar" aria-hidden="true"><i style="width:' + (100 - week.hardPct) + '%"></i></div></div>' +
      '</div>';

    var keys = week.days.map(function (d) { return d.date; });
    if (keys.indexOf(selectedDay) < 0) {
      selectedDay = keys.indexOf(todayKey) >= 0 ? todayKey :
        (week.days.filter(function (d) { return ['rest', 'none'].indexOf(d.type) < 0; })[0] || week.days[0]).date;
    }
    var resolved = week.days.map(function (d) {
      return state.checkins[d.date] ? effectiveSession(d) : { session: d, adaptation: null };
    });
    html += '<div class="week-grid" role="tablist" aria-label="روزهای هفته">';
    resolved.forEach(function (r) {
      var s = r.session, d = s.date;
      var sel = d === selectedDay;
      var cls = 'day day-' + s.type + (d === todayKey ? ' is-today' : '') + (d < todayKey ? ' is-past' : '') + (sel ? ' is-selected' : '');
      var shortT = s.km ? fa(String(s.km)) + '<small>km</small>' : (s.minutes ? fa(s.minutes) + '<small>دقیقه</small>' : '—');
      html += '<button type="button" role="tab" id="tab-' + d + '" aria-controls="day-panel" aria-selected="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" class="' + cls + '" data-day="' + d + '">' +
        '<span class="day-name"><span class="full">' + esc(s.dayName) + '</span><span class="short">' + esc(s.dayName.charAt(0)) + '</span></span>' +
        '<span class="day-date">' + esc(faDate(d, true)) + '</span>' +
        '<span class="type-dot" aria-hidden="true"></span>' + badge(s.type, s.label) +
        '<span class="day-target">' + shortT + '</span>' +
        (d === todayKey ? '<span class="today-tag">امروز</span>' : '') +
        (state.done[d] ? '<span class="done-mark" aria-label="انجام شد">✓</span>' : '') +
        '</button>';
    });
    html += '</div>';
    var rs = resolved[keys.indexOf(selectedDay)], ss = rs.session;
    html += '<div class="day-panel" id="day-panel" role="tabpanel" aria-labelledby="tab-' + selectedDay + '">' +
      '<div class="day-panel-head"><div><p class="eyebrow">' + esc(ss.dayName) + ' ' + esc(faDate(selectedDay)) +
      (selectedDay === todayKey ? ' · امروز' : '') + '</p><h3>' + badge(ss.type, ss.label) + '</h3></div>' +
      (selectedDay <= todayKey && ['rest', 'none', 'cancelled'].indexOf(ss.type) < 0 && (selectedDay < todayKey || state.checkins[todayKey]) ? doneButton(selectedDay, ss) : '') +
      '</div>' +
      (rs.adaptation ? adaptationBox(rs.adaptation, selectedDay) : '') +
      (ss.type !== 'cancelled' ? sessionBody(ss, selectedDay <= todayKey && selectedDay !== todayKey ? { key: selectedDay, prefix: 'panel' } : {}) : '') +
      (selectedDay > todayKey && ['rest', 'none'].indexOf(ss.type) < 0 ? '<p class="small muted">این جلسه ممکنه بعد از چک‌این همون روز با وضعیتت تطبیق داده بشه.</p>' : '') +
      '</div>';
    html += '<p class="legend small muted">روزهای سخت (تمپو، اینتروال، تکرار سرعتی، فارتلک، تپه، لانگ‌ران) با حداقل ۴۸ ساعت فاصله‌ان؛ جلسات کیفی اوایل هفته و لانگ‌ران آخر هفته. ' +
      (lv.level <= 2 ? 'در سطح ' + fa(lv.level) + ' همه‌ی جلسات آسونه (بدون تمپو و اینتروال).' : 'حداکثر ۲۰٪ حجم هفته پرشدته (قانون ۸۰/۲۰).') +
      ' هفته‌ی اول هم‌اندازه‌ی حجم فعلی توئه؛ از هفته‌ی دوم حداکثر ۱۰٪ بیشتر از هفته‌ی کامل قبلی، و هر هفته‌ی چهارم سبک‌تره.</p>';
    html += '</section>';

    // نکات محل تمرین
    var tips = (p.locations || []).map(function (l) { return C.LOCATION_TIPS[l]; }).filter(Boolean);
    if (tips.length) {
      html += '<section class="card tips"><h3>نکته‌های محل تمرین</h3><ul>' +
        tips.map(function (x) { return '<li>' + t(x) + '</li>'; }).join('') + '</ul></section>';
    }
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
      showToast('پیس ایزی ' + fa(state.profile.easyAdjustSec) + ' ثانیه کندتر از محاسبه‌ی VDOT تنظیم شد.');
      route();
      return;
    }
    if (e.target.closest('[data-apply-level]')) { applyFitnessLevel(); return; }
  });

  app.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-postrun-form]');
    if (!f) return;
    e.preventDefault();
    var rpe = f.querySelector('input[name=rpe]:checked');
    var pace = f.querySelector('input[name=pace]:checked');
    var err = f.querySelector('.form-errors');
    if (!rpe || (f.dataset.type !== 'runwalk' && !pace)) {
      err.hidden = false;
      err.textContent = f.dataset.type !== 'runwalk' ? 'سختی جلسه و وضعیت پیس رو انتخاب کن.' : 'سختی جلسه رو انتخاب کن.';
      return;
    }
    var key = f.dataset.postrunForm;
    state.done[key] = true;
    state.postRuns[key] = { rpe: Number(rpe.value), pace: pace ? pace.value : null, easy: true, type: f.dataset.type, at: new Date().toISOString() };
    postRunOpen = null;
    save();
    route();
  });

  // کارت «به‌روزرسانی فیتنس» روی داشبورد: یادآوری تایم‌تست، الگوی RPE بالا، پیشنهاد تغییر سطح
  function fitnessNotesCard(p, now) {
    var items = [];
    var rem = C.fitnessReminder(p, now);
    if (rem) items.push('<li>' + t(rem.message) + ' <a href="#fitness">ثبت تایم‌تست</a></li>');
    var trend = C.easyRpeTrend(state.postRuns, now);
    if (trend >= 2) items.push('<li><strong>الگوی تکراری:</strong> در دو هفته‌ی اخیر ' + fa(trend) + ' جلسه‌ی ایزی با پیس برنامه برات سخت (RPE بالای ۶) بوده. ' +
      t(C.EASY_RPE_WARNING) + easyActions() + '</li>');
    var sg = C.fitnessLevelSuggestion(p);
    if (sg) items.push('<li>بر اساس آخرین تایم‌تستت، فیتنست با <strong>سطح ' + fa(sg.to) + '</strong> جور درمیاد (برنامه‌ی فعلی: سطح ' + fa(sg.from) + '). ' +
      (sg.up ? 'اگه بخوای، برنامه از همین هفته با سطح جدید و از همین حجم فعلیت ادامه پیدا می‌کنه.' : 'اگه وقفه یا آسیب داشتی، بهتره برنامه با سطح پایین‌تر و از همین حجم ادامه پیدا کنه.') +
      '<div class="actions"><button type="button" class="btn btn-outline" data-apply-level="1">برنامه رو با سطح ' + fa(sg.to) + ' ادامه بده</button></div></li>');
    if (!items.length) return '';
    return '<section class="card fitness-notes"><h3>به‌روزرسانی فیتنس</h3><ul>' + items.join('') + '</ul></section>';
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
    p.currentWeeklyKm = km;
    p.startDate = C.dateKey(now);
    save();
    showToast('برنامه با سطح ' + fa(C.assessLevel(p).level) + ' (قبلاً ' + fa(before) + ') و حجم ' + t(km) + ' کیلومتر ادامه پیدا می‌کنه.');
    route();
  }

  // جابه‌جایی بین روزها با کلیدهای جهت (در راست‌چین، چپ = روز بعد)
  app.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('[role=tab][data-day]');
    if (!tab || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    var tabs = Array.prototype.slice.call(app.querySelectorAll('[role=tab][data-day]'));
    var i = tabs.indexOf(tab) + (e.key === 'ArrowLeft' ? 1 : -1);
    if (i < 0 || i >= tabs.length) return;
    e.preventDefault();
    tabs[i].click();
  });

  // =====================================================================
  // ۳. چک‌این روزانه
  // =====================================================================
  function scale(name, labelLow, labelHigh, value) {
    var h = '<div class="scale" role="radiogroup" aria-label="' + esc(name) + '">';
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
      app.innerHTML = '<section class="card"><h1>چک‌این امروز</h1>' +
        '<div class="alert alert-pain" role="alert"><strong>امروز درد گزارش کردی و جلسه لغو شده.</strong>' +
        '<p class="pain-msg">' + esc(C.PAIN_MESSAGE) + '</p>' +
        '<p class="small">چک‌این امروز قفل شده. فردا دوباره چک‌این کن؛ اگه درد ادامه داشت، تمرین نکن و به پزشک مراجعه کن.</p></div>' +
        '<a class="btn btn-ghost" href="#plan">برگشت به برنامه</a></section>';
      return;
    }

    ci = ci || {};
    app.innerHTML = '<section class="card checkin">' +
      '<h1>چک‌این قبل از تمرین</h1>' +
      '<p class="muted">' + esc(base.dayName) + ' ' + esc(faDate(key)) + ' · جلسه‌ی برنامه‌ریزی‌شده: ' + badge(base.type, base.label) + ' ' + t(base.target) + '</p>' +
      '<form id="ci-form" novalidate>' +
      '<fieldset><legend>الان چقدر خسته‌ای؟</legend>' + scale('fatigue', '۱ = سرحال', '۵ = خیلی خسته', ci.fatigue) + '</fieldset>' +
      '<fieldset><legend>کیفیت خواب دیشب</legend>' + scale('sleep', '۱ = خیلی بد', '۵ = عالی', ci.sleep) + '</fieldset>' +
      '<fieldset><legend>الان هیچ دردی احساس می‌کنی؟</legend><div class="chips">' +
      '<label class="chip"><input type="radio" name="pain" value="no"' + (ci.pain === false ? ' checked' : '') + '><span>نه</span></label>' +
      '<label class="chip chip-danger"><input type="radio" name="pain" value="yes"><span>بله</span></label></div>' +
      '<div class="field" id="pain-where" hidden><label for="pw">کجا؟</label>' +
      '<input id="pw" name="painWhere" maxlength="120" placeholder="مثلاً: زانوی چپ، ساق پا، کمر"></div>' +
      '<small class="muted">منظور درد واقعیه (تیز، موضعی، یا دردی که با دویدن بدتر می‌شه)، نه کوفتگی عمومی عضلات بعد از تمرین.</small>' +
      '</fieldset>' +
      '<div id="ci-errors" class="form-errors" role="alert" hidden></div>' +
      '<div class="actions"><button type="submit" class="btn btn-primary">ثبت چک‌این</button>' +
      '<a class="btn btn-ghost" href="#plan">انصراف</a></div>' +
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
      if (!fatigue) errs.push('سطح خستگی رو انتخاب کن.');
      if (!sleep) errs.push('کیفیت خواب رو انتخاب کن.');
      if (!pain) errs.push('به سؤال درد جواب بده.');
      var where = String(fd.get('painWhere') || '').trim();
      if (pain === 'yes' && !where) errs.push('بنویس کجا درد داری.');
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
      showToast(r.adaptation && r.adaptation.kind === 'downgrade' ? 'جلسه‌ی امروز به ایزی ران تبدیل شد.' : 'چک‌این ثبت شد.');
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
      '<h2 id="pm-title">جلسه‌ی امروز لغو شد</h2>' +
      '<p id="pm-desc" class="pain-msg">' + esc(C.PAIN_MESSAGE) + '</p>' +
      (ci.painWhere ? '<p class="small">محل درد: ' + t(ci.painWhere) + '</p>' : '') +
      '<ul class="small"><li>امروز ندو، حتی آروم.</li><li>اگه درد شدید، همراه با تورم، یا موقع راه رفتن هم هست، هرچه زودتر به پزشک مراجعه کن.</li>' +
      '<li>تا وقتی پزشک اجازه نداده، تمرین رو از سر نگیر.</li></ul>' +
      '<label class="ack"><input type="checkbox" id="pm-ack"> <span>خوندم و متوجه شدم که این مربی نمی‌تونه درد رو تشخیص بده و باید به پزشک مراجعه کنم.</span></label>' +
      '<button type="button" class="btn btn-danger" id="pm-ok" disabled>متوجه شدم</button>' +
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
  var CATEGORY_FOCUS = {
    speed: 'VO2max و سرعت: اینتروال کوتاه (۴۰۰ تا ۸۰۰ متر با پیس ۵ کیلومتر)، اینتروال متوسط (۱۰۰۰ تا ۱۶۰۰ متر)، فارتلک سرعتی (۱-۱ یا هرمی) و تپه‌ی کوتاه.',
    half: 'ترکیب VO2max و آستانه: اینتروال آستانه (۳ تا ۴ × ۸ تا ۱۰ دقیقه)، اینتروال بلند (۱۶۰۰ تا ۲۰۰۰ متر) و تمپوی پیوسته (۲۰ تا ۴۰ دقیقه).',
    marathon: 'آستانه و استقامت ویژه: تمپوی بلند (۳۰ تا ۵۰ دقیقه)، اینتروال پیس ماراتن (۳ تا ۵ کیلومتر)، لانگ‌ران با پایان پیس ماراتن و فارتلک درازمدت.',
    ultra: 'زمان روی پا، ارتفاع‌گیری و خستگی تجمعی: تپه‌ی بلند، تمرین فرود، لانگ‌ران با هدف ارتفاع‌گیری، و ران‌های پشت‌سرهم (از سطح ۵ با پایه‌ی کافی). شدت با RPE و زمان، نه پیس.',
    general: 'بدون هدف مشخص، تمرین‌ها بین اینتروال کوتاه، تمپو، فارتلک، تپه و آستانه می‌چرخن تا سیستم‌های انرژی مختلف تحریک بشن و تمرین یکنواخت نشه.'
  };

  function ultraSummary(g) {
    var info = C.ULTRA_CLASS_INFO[g.cls];
    return '<ul class="ultra-facts">' +
      '<li>شاخص فنی بودن مسیر: <b>' + fa(Math.round(g.ratio)) + ' متر صعود در هر کیلومتر</b> → ' + esc(info.label) + '</li>' +
      '<li>تأکید برنامه: ' + esc(info.emphasis) + '</li>' +
      (g.loss !== null ? '<li>نزول: ' + fa(g.loss) + ' متر' + (g.netDownhill ? ' (سرازیری غالب → تمرین فرود بیشتر)' : '') + '</li>' : '') +
      (g.terrain ? '<li>زمین غالب: ' + esc(C.TERRAIN_LABELS[g.terrain]) + '</li>' : '') +
      (g.altitude ? '<li>ارتفاع از سطح دریا: ' + fa(g.altitude) + ' متر</li>' : '') + '</ul>';
  }

  function renderRace() {
    var p = state.profile, g = C.goalInfo(p), lv = C.assessLevel(p);
    if (g.type === 'none') {
      app.innerHTML = '<section class="card"><h1>هدف مسابقه</h1><p>هنوز هدف مسابقه‌ای انتخاب نکردی. ' + esc(CATEGORY_FOCUS.general) + '</p>' +
        '<a class="btn btn-primary" href="#onboarding">انتخاب هدف مسابقه</a></section>';
      return;
    }
    var race = C.raceInfo(p);
    var now = today();
    var fit = C.currentFitness(p);
    var pb = fit ? fit.entry : null;
    var html = '<section class="card race-hero"><p class="eyebrow">هدف مسابقه</p><h1>' + t(C.goalLabel(g)) + '</h1>';
    if (race) {
      var daysLeft = C.daysBetween(now, race.date);
      html += '<p class="race-date">' + esc(faDate(g.date)) + '</p><div class="countdown">' + (daysLeft > 0 ? '<b>' + fa(daysLeft) + '</b><span>روز مونده</span>'
        : daysLeft === 0 ? '<b>امروز!</b><span>موفق باشی</span>' : '<b>✓</b><span>مسابقه برگزار شده</span>') + '</div>';
    } else {
      html += '<p class="race-date">بدون تاریخ مشخص: تمرین‌ها با تمرکز این هدف چیده می‌شن، بدون تیپر. <a href="#onboarding">افزودن تاریخ</a></p>';
    }
    html += '</section>';

    html += '<section class="card"><h2>تمرکز تمرین‌ها</h2><p>' + esc(CATEGORY_FOCUS[g.category]) + '</p>' +
      (g.category === 'ultra' ? ultraSummary(g) : '') +
      (lv.level <= 2 ? '<p class="small muted">در سطح ' + fa(lv.level) + ' هنوز جلسه‌ی شدید نداری؛ این تمرین‌ها از سطح ۳ به بعد و با پیشرفت تو فعال می‌شن.</p>' : '') +
      '<p class="small muted">جلسات کیفی اوایل هفته (یکشنبه و سه‌شنبه) و لانگ‌ران آخر هفته‌ست؛ بین دو جلسه‌ی سخت همیشه حداقل ۴۸ ساعت فاصله هست' +
      (g.category === 'ultra' ? '، به‌جز ران‌های پشت‌سرهم که عمداً دو روز متوالی‌ان.' : '.') + '</p></section>';

    // پیش‌بینی زمان
    if (g.category === 'ultra') {
      html += '<section class="card"><h2>تخمین زمان</h2>';
      if (pb) {
        var eq = g.km + g.gain / 100, tf = { technical: 1.15, trail: 1.08, gravel: 1.02, mixed: 1.08 }[g.terrain] || 1.08;
        var est = C.riegel(pb.timeSec, pb.distanceKm, eq) * tf;
        html += '<div class="prediction"><span>تخمین خیلی تقریبی برای ' + t(C.goalLabel(g)) + '</span><b dir="ltr">' + fa(C.formatDuration(est)) + '</b>' +
          '<small>معادل حدود ' + fa(Math.round(eq)) + ' کیلومتر مسیر تخت (هر ۱۰۰ متر صعود ≈ ۱ کیلومتر)، با ضریب زمین</small></div>';
      }
      html += '<p class="small muted">مسابقه‌های تریل استاندارد ندارن و زمان به مسیر، زمین، هوا و ارتفاع بستگی داره؛ فرمول‌های جاده‌ای (مثل Riegel) اینجا فقط یه نقطه‌ی شروع خیلی تقریبی‌ان. روز مسابقه با RPE پیش برو، نه ساعت.</p>' +
        '<a class="btn btn-outline" href="#fitness">ثبت تایم‌تست تازه</a></section>';
    } else {
      html += '<section class="card"><h2>پیش‌بینی زمان (فرمول Riegel)</h2><p class="formula" dir="ltr">T₂ = T₁ × (D₂ / D₁)<sup>1.06</sup></p>';
      if (pb) {
        var pred = C.riegel(pb.timeSec, pb.distanceKm, g.km);
        html += '<div class="prediction"><span>زمان پیش‌بینی‌شده برای ' + esc(C.RACE_LABELS[g.type]) + '</span>' +
          '<b dir="ltr">' + fa(C.formatDuration(pred)) + '</b>' +
          '<small>پیس متوسط: ' + fa(C.formatDuration(pred / g.km)) + ' دقیقه در کیلومتر</small></div>' +
          '<p class="muted small">بر اساس آخرین تایم‌تست/رکوردت: ' + t(Math.round(pb.distanceKm * 100) / 100) + ' کیلومتر در ' + fa(C.formatDuration(pb.timeSec)) + ' (' + esc(faDate(pb.date, true)) + ').</p>' +
          '<div class="table-wrap"><table class="pred-table"><thead><tr><th>فاصله</th><th>زمان پیش‌بینی</th><th>پیس (دقیقه/کیلومتر)</th></tr></thead><tbody>' +
          Object.keys(C.RACE_DISTANCES).map(function (k) {
            var d = C.RACE_DISTANCES[k], tt = C.riegel(pb.timeSec, pb.distanceKm, d);
            return '<tr' + (k === g.type ? ' class="hl"' : '') + '><td>' + esc(C.RACE_LABELS[k]) + '</td><td dir="ltr">' + fa(C.formatDuration(tt)) + '</td><td dir="ltr">' + fa(C.formatDuration(tt / d)) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<p class="small muted">فرمول Riegel برای دونده‌های تمرین‌کرده دقیق‌تره. هرچی فاصله‌ی مسابقه از فاصله‌ی رکورد دورتر باشه، پیش‌بینی خوش‌بینانه‌تر می‌شه.</p>';
      } else html += '<p>برای پیش‌بینی، یه تایم‌تست یا رکورد اخیر ثبت کن.</p>';
      html += '<a class="btn btn-outline" href="#fitness">ثبت تایم‌تست یا رکورد تازه</a></section>';
    }

    if (race) {
      var tw = C.taperWeeks(race.key);
      var taperStart = C.addDays(race.date, -tw * 7);
      html += '<section class="card"><h2>تیپر: کاهش حجم قبل از مسابقه</h2>' +
        '<p>برنامه‌ی هفتگیت از <b>' + esc(faDate(C.dateKey(taperStart))) + '</b> (' + fa(tw) + ' هفته قبل از مسابقه) خودکار وارد تیپر می‌شه:</p><ul>' +
        (tw === 2 ? '<li>دو هفته قبل: حجم حدود ' + (race.key === '21' ? '۷۵' : '۷۰') + '٪ و لانگ‌ران کوتاه‌تر.</li>' : '') +
        '<li>هفته‌ی آخر: حجم حدود ' + (tw === 2 ? '۵۰' : '۶۰') + '٪، بدون لانگ‌ران؛ تمرین‌های سخت کوتاه‌تر می‌شن.</li>' +
        '<li>۲-۳ روز آخر: فقط دویدن آسون کوتاه با چند سرعت کوتاه.</li><li>روز قبل مسابقه: استراحت کامل.</li>' +
        '<li>۳ روز بعد مسابقه: استراحت، و بقیه‌ی اون هفته فقط دویدن آسون سبک.</li></ul></section>';
    }
    app.innerHTML = html;
  }

  // =====================================================================
  // به‌روزرسانی فیتنس: تایم‌تست/رکورد تازه → VDOT و همه‌ی پیس‌ها بازمحاسبه
  // =====================================================================
  var TEST_KINDS = [['t2', 2, 'تایم‌تست ۲ کیلومتر'], ['t3', 3, 'تایم‌تست ۳ کیلومتر'], ['t5', 5, 'تایم‌تست ۵ کیلومتر'], ['race', null, 'مسابقه یا فاصله‌ی دیگه']];
  var ENTRY_LABELS = { test: 'تایم‌تست', race: 'مسابقه', baseline: 'رکورد پایه (موقع ساخت برنامه)' };

  function renderFitness() {
    var p = state.profile, now = today();
    var z = C.paceZones(p);
    var fit = C.currentFitness(p);
    var rem = C.fitnessReminder(p, now);
    var hr = C.hrZones(p);
    var html = '<section class="card"><p class="eyebrow">به‌روزرسانی فیتنس</p><h1>فیتنس و پیس‌های فعلی</h1>';
    if (fit) {
      var e = fit.entry, weeks = Math.floor(C.daysBetween(C.parseDate(e.date), now) / 7);
      html += '<div class="fit-head"><div class="vdot-badge"><b>' + t(fit.vdot.toFixed(1)) + '</b><small>VDOT</small></div><div>' +
        '<p>از <b>' + esc(ENTRY_LABELS[e.kind] || 'رکورد') + '</b>: ' + t(Math.round(e.distanceKm * 100) / 100) + ' کیلومتر در <span dir="ltr">' + fa(C.formatDuration(e.timeSec)) + '</span></p>' +
        '<p class="small muted">' + esc(faDate(e.date)) + (weeks > 0 ? ' · ' + fa(weeks) + ' هفته پیش' : ' · همین هفته') + '</p></div></div>';
    } else {
      html += '<p>هنوز رکورد یا تایم‌تستی ثبت نشده، پس پیس دقیقی نداریم و راهنمای شدت فعلاً تست حرف زدن' + (hr ? ' و ضربان قلبه.' : 'ه.') + '</p>';
    }
    if (rem && rem.kind === 'stale') html += '<div class="alert alert-adapt" role="status"><p>' + t(rem.message) + '</p></div>';

    if (z && z.easy) {
      var adj = z.easyAdjustSec;
      html += '<h2>پیس‌های تمرینی (از VDOT فعلی)</h2><div class="table-wrap"><table class="pred-table pace-table"><thead><tr><th>نوع</th><th>پیس (دقیقه/کیلومتر)</th><th>کاربرد</th></tr></thead><tbody>' +
        '<tr class="hl"><td>ایزی (E)</td><td dir="ltr">' + fa(C.formatDuration(z.easy[0]) + ' – ' + C.formatDuration(z.easy[1])) + '</td><td>ایزی ران و لانگ‌ران؛ یک بازه، نه یک عدد</td></tr>' +
        '<tr><td>ماراتن (M)</td><td dir="ltr">' + fa(C.formatDuration((z.marathon[0] + z.marathon[1]) / 2)) + '</td><td>بخش‌های پیس ماراتن</td></tr>' +
        '<tr><td>آستانه (T)</td><td dir="ltr">' + fa(C.formatDuration(z.tempo[0]) + ' – ' + C.formatDuration(z.tempo[1])) + '</td><td>تمپو و کروز اینتروال</td></tr>' +
        '<tr><td>اینتروال (I)</td><td dir="ltr">' + fa(C.formatDuration(z.interval[0]) + ' – ' + C.formatDuration(z.interval[1])) + '</td><td>تکرارهای ۸۰۰ تا ۱۲۰۰ متر</td></tr>' +
        '<tr><td>تکرار (R)</td><td dir="ltr">' + fa(C.formatDuration(z.reps[0]) + ' – ' + C.formatDuration(z.reps[1])) + '</td><td>تکرارهای ۲۰۰ و ۴۰۰ متر</td></tr>' +
        '</tbody></table></div>' +
        '<p class="small muted">مرکز بازه‌ی ایزی حدود ۷۰٪ VDOT هست. حد تندتر برای روزهای خوب، حد کندتر برای گرما، خستگی یا خواب بد. اگه تست حرف زدن رو رد کردی، حتی از حد کند هم آهسته‌تر بدو.</p>' +
        '<div class="adjust-row"><p class="small">' + (adj ? 'پیس ایزی الان <b>' + fa(adj) + ' ثانیه</b> کندتر از محاسبه‌ی VDOT تنظیم شده.' : 'پیس ایزی دقیقاً از VDOT محاسبه شده.') + '</p><div class="actions">' +
        (adj < C.EASY_ADJUST_MAX ? '<button type="button" class="btn btn-outline" id="fit-slow">۱۰ ثانیه کندتر</button>' : '') +
        (adj ? '<button type="button" class="btn btn-ghost" id="fit-reset">برگردون به محاسبه‌ی VDOT</button>' : '') + '</div></div>';
    }
    if (hr) {
      html += '<p class="hr-line">ضربان قلب ایزی: <b>' + fa(hr.easy[0]) + ' تا ' + fa(hr.easy[1]) + '</b> ضربه در دقیقه <span class="small muted">(' +
        (hr.method === 'karvonen' ? '۶۰ تا ۷۵٪ ذخیره‌ی ضربان، فرمول Karvonen' + (hr.maxEstimated ? '؛ حداکثر ضربان از سن تخمین زده شده: ' + fa(hr.max) : '') : '۶۵ تا ۷۸٪ حداکثر ضربان؛ با وارد کردن ضربان استراحت دقیق‌تر می‌شه') + ')</span></p>';
    }
    html += '</section>';

    // فرم ثبت تایم‌تست/رکورد تازه
    var todayKey = C.dateKey(now);
    html += '<section class="card"><h2>ثبت تایم‌تست یا رکورد تازه</h2>' +
      '<p class="small muted">پیشنهاد: هر ۴ تا ۶ هفته، یا بعد از وقفه/آسیب/تغییر فصل. با ثبت نتیجه، VDOT و همه‌ی پیس‌های تمرینی (از جمله ایزی) خودکار بازمحاسبه می‌شن.</p>' +
      '<details class="howto"><summary>تایم‌تست رو چطور اجرا کنم؟</summary><ol class="small">' +
      '<li>۱۵ دقیقه دویدن آسون + ۴ سرعت کوتاه برای گرم کردن.</li><li>روی مسیر صاف یا پیست، با حداکثر تلاشی که بتونی تا آخر یکنواخت نگهش داری.</li>' +
      '<li>روزی که سرحالی (نه بعد از تمرین سخت یا خواب بد) و هوا خیلی گرم نیست.</li><li>۱۰ دقیقه سرد کردن. اگه درد داشتی، تست رو متوقف کن.</li></ol></details>' +
      '<form id="fit-form" novalidate><div class="row3">' +
      '<div class="field"><label for="fk">نوع</label><select id="fk" name="kind">' + TEST_KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[2] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" id="fkm-field" hidden><label for="fkm">فاصله (کیلومتر)</label><input id="fkm" name="km" type="number" inputmode="decimal" min="1" max="100" step="0.1"></div>' +
      '<div class="field"><label for="ft">زمان</label><input id="ft" name="time" dir="ltr" inputmode="numeric" autocomplete="off" placeholder="9:40" data-time-preview="ft-read">' +
      '<small class="muted">مثلاً «9:40» یا فقط «940». برای بیش از یک ساعت: «1:25:30» یا «12530».</small><small class="time-read" id="ft-read" aria-live="polite"></small></div>' +
      '<div class="field"><label for="fd">تاریخ</label><input id="fd" name="date" type="date" max="' + todayKey + '" value="' + todayKey + '"></div>' +
      '</div><p id="fit-err" class="form-errors" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-primary">ثبت و بازمحاسبه‌ی پیس‌ها</button></form></section>';

    // تاریخچه
    var list = C.fitnessEntries(p).slice().reverse();
    if (list.length) {
      html += '<section class="card"><h2>تاریخچه‌ی فیتنس</h2><div class="table-wrap"><table class="pred-table"><thead><tr><th>تاریخ</th><th>نوع</th><th>فاصله</th><th>زمان</th><th>VDOT</th><th></th></tr></thead><tbody>' +
        list.map(function (e, i) {
          var idx = (p.fitnessTests || []).indexOf((p.fitnessTests || []).filter(function (x) { return x.date === e.date && x.timeSec === e.timeSec && x.distanceKm === e.distanceKm; })[0]);
          return '<tr' + (i === 0 ? ' class="hl"' : '') + '><td>' + esc(faDate(e.date, true)) + '</td><td>' + esc(ENTRY_LABELS[e.kind] || '—') + '</td><td>' + t(Math.round(e.distanceKm * 100) / 100) + ' km</td>' +
            '<td dir="ltr">' + fa(C.formatDuration(e.timeSec)) + '</td><td>' + t(C.vdotFromRace(e.distanceKm, e.timeSec).toFixed(1)) + '</td>' +
            '<td>' + (e.kind !== 'baseline' && idx >= 0 ? '<button type="button" class="linklike" data-del-test="' + idx + '">حذف</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="small muted">همیشه «آخرین» نتیجه ملاکه، نه بهترین؛ چون هدف پیس متناسب با فیتنس امروزته.</p></section>';
    }

    // ضربان قلب
    html += '<section class="card"><h2>ضربان قلب (اختیاری)</h2>' + hrFields(p) +
      '<p id="hr-err" class="form-errors" role="alert" hidden></p><button type="button" class="btn btn-outline" id="hr-save">ذخیره‌ی ضربان</button></section>';

    app.innerHTML = html;

    var form = document.getElementById('fit-form');
    form.kind.addEventListener('change', function () { document.getElementById('fkm-field').hidden = form.kind.value !== 'race'; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var kind = form.kind.value;
      var km = kind === 'race' ? Number(form.km.value) : TEST_KINDS.filter(function (k) { return k[0] === kind; })[0][1];
      var tt = C.parseTime(form.time.value), date = form.date.value;
      var err = document.getElementById('fit-err');
      var v = km && tt ? km / (tt / 3600) : 0;
      if (!(km >= 1 && km <= 100)) { err.hidden = false; err.textContent = 'فاصله رو بین ۱ تا ۱۰۰ کیلومتر وارد کن.'; return; }
      if (!tt) { err.hidden = false; err.textContent = 'زمان رو به شکل «9:40» یا فقط رقم «940» وارد کن.'; return; }
      if (v > 26 || v < 3) { err.hidden = false; err.textContent = 'این زمان برای ' + fa(km) + ' کیلومتر ممکن نیست (' + fa(C.describeDuration(tt)) + ')؛ دوباره نگاهش کن.'; return; }
      if (!date || date > todayKey) { err.hidden = false; err.textContent = 'تاریخ باید امروز یا قبل از امروز باشه.'; return; }
      var before = C.paceZones(p);
      p.fitnessTests = (p.fitnessTests || []).concat([{ date: date, distanceKm: km, timeSec: tt, kind: kind === 'race' ? 'race' : 'test' }]);
      // تایم‌تست تازه = پیس‌ها از نو؛ تنظیم دستی قبلی دیگه لازم نیست
      p.easyAdjustSec = 0;
      save();
      var after = C.paceZones(p);
      showToast('VDOT: ' + fa((before && before.vdot ? before.vdot.toFixed(1) + ' ← ' : '')) + fa(after.vdot.toFixed(1)) + ' · بازه‌ی ایزی جدید: ' + fa(C.formatDuration(after.easy[0]) + ' تا ' + C.formatDuration(after.easy[1])));
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
      showToast(C.hrZones(p) ? 'ضربان ذخیره شد؛ بازه‌ی ضربان ایزی به‌روز شد.' : 'ضربان پاک شد.');
      renderFitness();
    });
  }

  // فیلدهای ضربان (در فرم اولیه و صفحه‌ی فیتنس)
  function hrFields(p) {
    return '<p class="small muted">اگه ساعت یا کمربند ضربان داری، این‌ها رو وارد کن تا بازه‌ی ضربان ایزی (۶۰ تا ۷۵٪ ذخیره‌ی ضربان، فرمول Karvonen) هم کنار پیس نشون داده بشه. هر دو اختیاری‌ان.</p>' +
      '<div class="row2"><div class="field"><label for="hrmax">حداکثر ضربان قلب تقریبی</label><input id="hrmax" name="hrMax" type="number" inputmode="numeric" min="120" max="230" value="' + esc(p.hrMax || '') + '"></div>' +
      '<div class="field"><label for="hrrest">ضربان استراحت (صبح، قبل از بلند شدن)</label><input id="hrrest" name="hrRest" type="number" inputmode="numeric" min="30" max="100" value="' + esc(p.hrRest || '') + '"></div></div>';
  }
  function readHr(root) {
    var mx = root.querySelector('#hrmax').value.trim(), rs = root.querySelector('#hrrest').value.trim();
    var max = mx ? Number(mx) : null, rest = rs ? Number(rs) : null;
    if (max !== null && !(max >= 120 && max <= 230)) return { error: 'حداکثر ضربان باید بین ۱۲۰ تا ۲۳۰ باشه.' };
    if (rest !== null && !(rest >= 30 && rest <= 100)) return { error: 'ضربان استراحت باید بین ۳۰ تا ۱۰۰ باشه.' };
    if (max !== null && rest !== null && rest >= max - 20) return { error: 'ضربان استراحت باید خیلی کمتر از حداکثر ضربان باشه.' };
    return { max: max, rest: rest };
  }

  // =====================================================================
  // پروفایل
  // =====================================================================
  function renderProfile() {
    var p = state.profile;
    var bmi = C.bmi(p);
    var nCheck = Object.keys(state.checkins).length, nDone = Object.keys(state.done).length;
    function row(k, v) { return '<div class="kv"><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>'; }
    app.innerHTML = '<section class="card"><h1>پروفایل من</h1><dl class="kv-list">' +
      row('سطح', 'سطح ' + fa(C.assessLevel(p).level) + ' از ۱۰: ' + esc(C.assessLevel(p).info.name) +
        (C.assessLevel(p).vdot ? ' <span class="muted small">(VDOT ' + t(C.assessLevel(p).vdot.toFixed(1)) + ')</span>' : '')) +
      row('سابقه‌ی دویدن', esc(C.EXPERIENCE[p.experience] ? C.EXPERIENCE[p.experience].label : '—')) +
      row('تمرین ساختاریافته', p.structured ? 'انجام داده' : 'انجام نداده') +
      row('ضربان قلب', C.hrZones(p) ? 'ایزی: ' + fa(C.hrZones(p).easy[0]) + ' تا ' + fa(C.hrZones(p).easy[1]) + ' ضربه در دقیقه' : '<span class="muted">وارد نشده</span>') +
      row('فیتنس فعلی', C.currentFitness(p) ? 'VDOT ' + t(C.currentFitness(p).vdot.toFixed(1)) + ' · <a href="#fitness">جزئیات و به‌روزرسانی</a>' : '<a href="#fitness">ثبت تایم‌تست</a>') +
      row('حجم فعلی (نقطه‌ی شروع)', t(p.currentWeeklyKm + ' کیلومتر در هفته')) +
      row('سن / وزن / قد', t(p.age + ' سال · ' + p.weightKg + ' کیلوگرم · ' + p.heightCm + ' سانتی‌متر') + ' <span class="muted small">(BMI ' + t(bmi.toFixed(1)) + ')</span>') +
      row('روزهای آزاد', esc(p.days.map(function (d) { return C.DAY_NAMES[d]; }).join('، '))) +
      row('محل تمرین', esc(p.locations.map(function (l) { return C.LOCATION_LABELS[l]; }).join('، '))) +
      row('آسیب / محدودیت', p.injury ? t(p.injury) : '<span class="muted">ثبت نشده</span>') +
      row('هدف مسابقه', C.goalInfo(p).type !== 'none' ? t(C.goalLabel(C.goalInfo(p))) + (C.goalInfo(p).date ? ' — ' + esc(faDate(C.goalInfo(p).date)) : ' <span class="muted small">(بدون تاریخ)</span>') : '<span class="muted">بدون هدف مشخص</span>') +
      row('بهترین رکورد', p.pb ? t(p.pb.distanceKm + ' کیلومتر در ') + '<span dir="ltr">' + fa(C.formatDuration(p.pb.timeSec)) + '</span>' : '<span class="muted">ثبت نشده</span>') +
      row('شروع برنامه', esc(faDate(p.startDate))) +
      row('آمار', t(nCheck + ' چک‌این · ' + nDone + ' جلسه‌ی انجام‌شده')) +
      '</dl><div class="actions">' +
      '<a class="btn btn-primary" href="#onboarding">ویرایش پروفایل</a>' +
      '<button type="button" class="btn btn-outline" id="restart">شروع دوباره‌ی برنامه از این هفته</button>' +
      '<button type="button" class="btn btn-ghost danger-text" id="wipe">پاک کردن همه‌ی داده‌ها</button>' +
      '</div><div id="confirm-box" class="alert alert-note confirm-box" role="alertdialog" aria-live="polite" hidden>' +
      '<p id="confirm-text"></p><div class="actions">' +
      '<button type="button" class="btn btn-primary" id="confirm-yes">بله، انجام بده</button>' +
      '<button type="button" class="btn btn-ghost" id="confirm-no">انصراف</button></div></div></section>';

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
      ask('برنامه از هفته‌ی اول (با حجم پایه) دوباره شروع بشه؟ چک‌این‌ها حفظ می‌شن.', function () {
        state.profile.startDate = C.dateKey(today());
        save(); showToast('برنامه از امروز دوباره شروع شد.');
        location.hash = '#plan';
      });
    });
    document.getElementById('wipe').addEventListener('click', function () {
      ask('همه‌ی داده‌ها (پروفایل، چک‌این‌ها، سابقه) از این مرورگر پاک بشه؟ این کار برگشت‌پذیر نیست.', function () {
        state = emptyState();
        try { localStorage.removeItem(STORE_KEY); } catch (e) { /* */ }
        memoryFallback = null;
        location.hash = '#onboarding';
        route();
      });
    });
  }

  route();
})();
