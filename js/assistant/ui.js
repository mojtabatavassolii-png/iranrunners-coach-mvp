/* دستیار گام (آزمایشی): رابط کاربری.
 * دکمه‌ی «؟» کنار زنگ اعلان، خط «سؤال داری؟» بالای آموزش، پنجره‌ی گفت‌وگو، بازخورد، ارسال برای تیم با رضایت،
 * گزارش مشکل، بخش «آزمایشی» در تنظیمات و صفحه‌ی مدیریت (خوندن فایل‌های رسیده).
 * فقط خواندنی: برنامه، پروفایل یا داده‌ی تمرین رو تغییر نمی‌ده. هیچ درخواست شبکه‌ای نداره.
 * داده‌ی خودش فقط در کلید «gaam-assistant». */
(function () {
  'use strict';
  var CFG = window.GAAM_ASSISTANT_CONFIG || {};
  var E = window.GaamAssistantEngine, KB = window.GaamAssistantKB;
  if (!CFG.enabled || !E || !KB) { window.GaamAssistant = null; return; }

  var STORE_KEY = 'gaam-assistant', MAX_ITEMS = 200;
  var api = null, idx = null, msgs = [], seq = 0, labTaps = 0, labT0 = 0;

  // متن‌های رابط (فقط فارسی؛ در دوره‌ی آزمایش برای زبان انگلیسی پنهانه)
  var S = {
    title: 'دستیار گام', beta: 'آزمایشی', btn: 'دستیار گام', tab: 'دستیار', close: 'بستن',
    hello: 'سلام! درباره‌ی دویدن، پیاده‌روی و برنامه‌ات بپرس. پاسخ‌ها کوتاه و عمومی‌ان و جای پزشک یا مربی نیستن.',
    placeholder: 'سؤالت رو بنویس…', send: 'بپرس',
    helpful: 'مفید بود؟', yes: 'بله', no: 'نه', thanks: 'ممنون از بازخوردت.',
    sendTeam: 'ارسال این سؤال برای تیم گام',
    consent: 'فقط متن همین سؤال، پاسخی که دیدی و تاریخ روی همین دستگاه ذخیره می‌شه؛ بدون اسم و داده‌ی تمرین. بعداً از «تنظیمات › آزمایشی» خودت برای تیم می‌فرستیش.',
    consentOk: 'موافقم', save: 'ذخیره', cancel: 'انصراف', saved: 'ذخیره شد. از «تنظیمات › آزمایشی» بفرستش.',
    report: 'گزارش مشکل', reportPh: 'مشکل رو کوتاه بنویس (بدون اطلاعات شخصی)',
    reportConsent: 'متن گزارش، نسخه‌ی اپ و صفحه‌ای که روش بودی ذخیره می‌شه.',
    typing: 'دستیار گام داره می‌نویسه…', learn: 'مطلب: ', src: 'منبع: ', chip: 'سؤال داری؟ از دستیار بپرس',
    // تنظیمات
    labTitle: 'آزمایشی', labSub: 'دستیار گام', on: 'روشن', off: 'خاموش', toggle: 'دستیار گام (آزمایشی)',
    toggleHint: 'یک دستیار ساده که از روی مطالب آموزش جواب می‌ده؛ بدون اینترنت و بدون هوش مصنوعی.',
    queued: 'سؤال‌های ذخیره‌شده برای تیم: {n}، گزارش‌ها: {r}',
    share: 'فرستادن برای تیم گام', clear: 'پاک کردن سؤال‌های ذخیره‌شده', cleared: 'پاک شد.',
    admin: 'صفحه‌ی مدیریت', adminOn: 'صفحه‌ی مدیریت دستیار فعال شد.',
    // مدیریت
    adminTitle: 'مدیریت دستیار', adminLoad: 'خوندن فایل‌های رسیده', adminLocal: 'داده‌ی همین دستگاه',
    adminFiles: '{n} فایل خونده شد.', adminBad: 'فایل معتبر نبود: {f}',
    unanswered: 'سؤال‌های بی‌پاسخ', frequent: 'پرتکرارترین سؤال‌ها', negative: 'بازخورد منفی', reports: 'گزارش‌های مشکل',
    perEntry: 'بازخورد هر مدخل', empty: 'چیزی نیست.', exportKb: 'خروجی برای تکمیل پایگاه دانش'
  };
  function f(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- ذخیره ----------
  function load() {
    var d = {};
    try { d = JSON.parse(api.store.get(STORE_KEY) || '{}') || {}; } catch (e) { d = {}; }
    d.fb = d.fb || []; d.queue = d.queue || []; d.reports = d.reports || [];
    return d;
  }
  function save(d) {
    ['fb', 'queue', 'reports'].forEach(function (k) { if (d[k].length > MAX_ITEMS) d[k] = d[k].slice(-MAX_ITEMS); });
    try { api.store.set(STORE_KEY, JSON.stringify(d)); } catch (e) { /* */ }
  }
  // پیش‌فرض روشن؛ فقط وقتی کاربر در تنظیمات خاموشش کرده باشه خاموشه
  function isOn() { return !!(api && load().on !== false); }
  function langOk() { return api && api.lang() === 'fa'; }
  function active() { return isOn() && langOk(); }

  // ---------- تب «دستیار» در نوار پایین (جای «آموزش» که حالا در پروفایله) ----------
  var Q_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="M14.6 9.6a2.6 2.6 0 1 0-3.6 2.4c.6.3 1 .8 1 1.5v.6"/><path d="M12 17.3h.01"/></svg>';
  var TAB_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.5L4 19.5l1.4-4.3A7.5 7.5 0 1 1 20 11.5z"/><path d="M9 10.5h6M9 13.5h4"/></svg>';
  function header() {
    var bar = document.querySelector('#tabbar .tabbar-inner');
    if (!bar) return;
    var b = document.getElementById('ga-btn');
    if (!b) {
      b = document.createElement('a');
      b.href = '#'; b.id = 'ga-btn'; b.className = 'ga-tab'; b.dataset.tab = 'assistant';
      b.setAttribute('role', 'button'); b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
      b.innerHTML = '<span class="tab-ico" aria-hidden="true">' + TAB_ICON + '</span><span class="tab-lbl">' + esc(S.tab) + '</span>';
      var prof = bar.querySelector('[data-tab="profile"]');
      bar.insertBefore(b, prof || null);
    }
    var vis = active();
    b.hidden = !vis;
    if (!vis) close(true);
  }
  function tabState(open) {
    var b = document.getElementById('ga-btn');
    if (!b) return;
    b.setAttribute('aria-expanded', String(open));
    b.classList.toggle('is-active', open);
  }

  // ---------- پنجره‌ی گفت‌وگو ----------
  function ctx() { try { return api.ctx() || {}; } catch (e) { return {}; } }
  function open(prefill) {
    if (document.getElementById('ga-sheet')) return;
    var el = document.createElement('div');
    el.id = 'ga-sheet'; el.className = 'ga-backdrop';
    el.innerHTML = '<div class="ga-panel" role="dialog" aria-modal="true" aria-labelledby="ga-title">' +
      '<div class="ga-head"><h2 id="ga-title">' + esc(S.title) + ' <span class="ga-beta">' + esc(S.beta) + '</span></h2>' +
      '<button type="button" class="ga-x" data-ga-close="1" aria-label="' + esc(S.close) + '">×</button></div>' +
      '<div class="ga-log" aria-live="polite"></div>' +
      '<form class="ga-form" autocomplete="off"><input type="text" class="ga-in" maxlength="200" enterkeyhint="send" aria-label="' + esc(S.placeholder) + '" placeholder="' + esc(S.placeholder) + '">' +
      '<button type="submit" class="btn btn-primary ga-send">' + esc(S.send) + '</button></form>' +
      '<p class="ga-foot"><button type="button" class="linklike" data-ga-report="1">' + esc(S.report) + '</button></p>' +
      '<div class="ga-report" hidden></div></div>';
    document.body.appendChild(el);
    document.body.classList.add('modal-open');
    tabState(true);
    if (!msgs.length) pushBot({ kind: 'hello', answer: S.hello }); else renderLog();
    var input = el.querySelector('.ga-in');
    if (prefill) input.value = prefill;
    input.focus();
  }
  function close(silent) {
    finishAnim();
    var el = document.getElementById('ga-sheet');
    if (!el) return;
    el.remove();
    document.body.classList.remove('modal-open');
    tabState(false);
    var b = document.getElementById('ga-btn');
    if (b && !silent && !b.hidden) b.focus();
  }

  // «Thomas, Erdman & Burke (2016), …» → «Thomas et al. (2016)»
  function cite(ref) {
    var m = /^([^,(]+?)(,[^(]*)?\s*(\(\d{4}\))/.exec(ref);
    if (!m) return ref;
    return m[1].trim() + (m[2] && !/et al/.test(m[1]) ? ' et al. ' : ' ') + m[3];
  }
  function linkHtml(l) {
    if (l.learn) {
      if (api.learnVisible && !api.learnVisible(l.learn)) return '';
      return '<a class="ga-link" href="#learn/' + esc(l.learn) + '" data-ga-nav="1">' + esc(S.learn + api.learnTitle(l.learn)) + '</a>';
    }
    if (l.guide) return '<a class="ga-link" href="#guide" data-guide="' + esc(l.guide) + '" data-ga-nav="1">' + esc(api.guideTitle(l.guide)) + '</a>';
    if (l.page) return '<a class="ga-link ga-page" href="' + esc(l.page) + '" data-ga-nav="1">' + esc(l.label) + '</a>';
    return '';
  }
  function botHtml(m) {
    var r = m.r, tone = r.safety === 'urgent' || r.kind === 'urgent' ? ' ga-urgent' : r.safety === 'caution' ? ' ga-caution' : '';
    // در حال نوشتن: سه نقطه
    if (m.anim === 'typing') return '<div class="ga-msg ga-bot ga-typing" data-mid="' + m.id + '" data-ga-skipanim="1" role="status" aria-label="' + esc(S.typing) + '"><span></span><span></span><span></span></div>';
    // نمایش کلمه‌به‌کلمه؛ متن کامل برای صفحه‌خوان از همون اول
    if (m.anim === 'reveal') return '<div class="ga-msg ga-bot' + tone + '" data-mid="' + m.id + '" data-ga-skipanim="1"><p><span class="ga-txt" aria-hidden="true">' + (anim && anim.m === m ? esc(anim.words.slice(0, anim.shown).join('')) : '') + '</span><span class="ga-caret" aria-hidden="true"></span><span class="sr-only">' + esc(fullText(r)) + '</span></p></div>';
    var h = '<div class="ga-msg ga-bot' + tone + (m.fresh ? ' ga-fresh' : '') + '" data-mid="' + m.id + '">';
    h += '<p>' + (r.greet ? esc(r.greet) + ' ' : '') + esc(r.answer) + '</p>';
    // گفت‌وگوی درد: گزینه‌ها فقط روی سؤال فعلی فعال‌ان
    if (r.kind === 'intake' && !m.done) {
      h += '<div class="ga-sug ga-opts">' + r.options.map(function (o) { return '<button type="button" class="ga-chip" data-ga-opt="' + esc(o.v) + '">' + esc(o.label) + '</button>'; }).join('') +
        '<button type="button" class="linklike ga-skip" data-ga-skip="1">' + esc(KB.intake.skip) + '</button></div>';
    }
    if (r.suggestions && r.suggestions.length) {
      h += '<div class="ga-sug">' + r.suggestions.map(function (s) { return '<button type="button" class="ga-chip" data-ga-pick="' + esc(s.id) + '">' + esc(s.q) + '</button>'; }).join('') + '</div>';
    }
    var links = (r.links || []).map(linkHtml).filter(Boolean);
    if (links.length) h += '<div class="ga-links">' + links.join('') + '</div>';
    // منبع مدخل‌های منبع‌دار (تغذیه): «نویسنده (سال)»
    var srcs = r.sources || (r.entry && r.entry.sources);
    if (srcs && srcs.length) h += '<p class="ga-src">' + esc(S.src + srcs.map(function (x) { return cite(x.ref); }).join('؛ ')) + '</p>';
    // قدم بعدی در خود اپ (فقط قابلیت‌های واقعی)
    if (r.next) {
      var nl = linkHtml(r.next.learn ? { learn: r.next.learn } : r.next.guide ? { guide: r.next.guide } : { page: r.next.page, label: r.next.label });
      h += '<p class="ga-next">' + esc(r.next.text) + (nl ? ' ' + nl : '') + '</p>';
    }
    var canTeam = r.kind === 'none' || r.kind === 'pending' || r.kind === 'suggest' || m.fb === 'n';
    if ((r.kind === 'answer' || r.kind === 'urgent') && !m.fb) {
      h += '<div class="ga-fb"><span>' + esc(S.helpful) + '</span><button type="button" class="ga-fbb" data-ga-fb="y">' + esc(S.yes) + '</button><button type="button" class="ga-fbb" data-ga-fb="n">' + esc(S.no) + '</button></div>';
    } else if (m.fb) h += '<p class="ga-small">' + esc(S.thanks) + '</p>';
    if (canTeam && m.q && !m.sent) {
      if (m.consent) {
        h += '<div class="ga-consent"><p class="ga-small">' + esc(S.consent) + '</p>' +
          '<label class="check-row"><input type="checkbox" data-ga-ack="1"> <span>' + esc(S.consentOk) + '</span></label>' +
          '<div class="actions"><button type="button" class="btn btn-primary btn-sm" data-ga-save="1" disabled>' + esc(S.save) + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-ga-nocons="1">' + esc(S.cancel) + '</button></div></div>';
      } else h += '<button type="button" class="linklike ga-team" data-ga-team="1">' + esc(S.sendTeam) + '</button>';
    }
    if (m.sent) h += '<p class="ga-small">' + esc(S.saved) + '</p>';
    return h + '</div>';
  }
  function renderLog() {
    var log = document.querySelector('#ga-sheet .ga-log');
    if (!log) return;
    log.innerHTML = msgs.map(function (m) {
      return m.who === 'me' ? '<div class="ga-msg ga-me' + (m.fresh ? ' ga-pop' : '') + '"><p>' + esc(m.text) + '</p></div>' : botHtml(m);
    }).join('');
    msgs.forEach(function (m) { if (m.who === 'me') m.fresh = false; });
    log.scrollTop = log.scrollHeight;
    // پاسخ بلند: از اول پاسخ نشون بده، نه از تهش
    var last = log.lastElementChild;
    if (last && last.classList.contains('ga-bot') && last.offsetHeight > log.clientHeight) log.scrollTop = last.offsetTop - log.offsetTop - 8;
  }
  function msgById(id) { return msgs.filter(function (m) { return String(m.id) === String(id); })[0]; }

  // ---------- حس گفت‌وگو: «در حال نوشتن…» و نمایش کلمه‌به‌کلمه‌ی پاسخ ----------
  // هشدار فوری و حالت «کاهش حرکت» سیستم بدون مکث و یک‌جا نشون داده می‌شن. با زدن روی پیام، کامل می‌شه.
  var anim = null; // { m, words, timer }
  function reduceMotion() { try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function fullText(r) { return (r.greet ? r.greet + ' ' : '') + (r.answer || ''); }
  function pushBot(r, q) {
    finishAnim();
    var m = { who: 'bot', id: ++seq, r: r };
    if (q) m.q = q;
    if (r.kind !== 'urgent' && r.kind !== 'crisis' && !reduceMotion() && fullText(r)) m.anim = 'typing';
    msgs.push(m);
    if (msgs.length > 60) msgs = msgs.slice(-60);
    renderLog();
    if (m.anim) startAnim(m);
  }
  function startAnim(m) {
    var words = fullText(m.r).split(/(\s+)/), n = Math.ceil(words.length / 2);
    var wait = Math.max(450, Math.min(1000, 300 + n * 6)), total = Math.max(250, Math.min(2200, n * 28)), step = 30;
    var per = Math.max(1, Math.ceil(words.length * step / total));
    anim = { m: m, words: words, shown: 0 };
    anim.timer = setTimeout(function () {
      if (!anim || anim.m !== m) return;
      m.anim = 'reveal'; renderLog();
      anim.timer = setInterval(function () {
        anim.shown = Math.min(words.length, anim.shown + per);
        var el = document.querySelector('#ga-sheet [data-mid="' + m.id + '"] .ga-txt');
        if (el) el.textContent = words.slice(0, anim.shown).join('');
        followLog();
        if (anim.shown >= words.length) finishAnim();
      }, step);
    }, wait);
  }
  function finishAnim() {
    if (!anim) return;
    clearTimeout(anim.timer); clearInterval(anim.timer);
    var m = anim.m; anim = null;
    if (m.anim) { m.anim = null; m.fresh = true; renderLog(); m.fresh = false; }
  }
  // تا وقتی پیام کوتاه‌تر از قابه، پایین گفت‌وگو بمونه؛ پیام بلند از اولش خونده بشه
  function followLog() {
    var log = document.querySelector('#ga-sheet .ga-log'), last = log && log.lastElementChild;
    if (!last) return;
    if (last.offsetHeight <= log.clientHeight) log.scrollTop = log.scrollHeight;
  }

  // سؤال فعلی گفت‌وگوی درد (اگه هست)
  function flowMsg() { var m = msgs[msgs.length - 1]; return m && m.who === 'bot' && m.r.kind === 'intake' && !m.done ? m : null; }
  function flowStep(fm, r) {
    fm.done = true;
    if (!r) return;
    pushBot(r);
  }
  function pickOpt(fm, v) {
    var o = fm.r.options.filter(function (x) { return x.v === v; })[0];
    if (!o) return;
    finishAnim();
    msgs.push({ who: 'me', text: o.label, fresh: true });
    flowStep(fm, E.intake(idx, fm.r.state, v, ctx()));
  }
  function askText(text) {
    text = String(text || '').trim().slice(0, 200);
    if (!text) return;
    finishAnim();
    msgs.push({ who: 'me', text: text, fresh: true });
    var fm = msgs.length > 1 ? (function (m) { return m && m.who === 'bot' && m.r.kind === 'intake' && !m.done ? m : null; })(msgs[msgs.length - 2]) : null;
    if (fm) {
      var fr = E.intakeText(idx, fm.r.state, text, ctx());
      fm.done = true;
      // جواب سؤال فهمیده نشد: سؤال تازه حسابش کن
      if (fr) { pushBot(fr); return; }
    }
    var r = E.ask(idx, text, ctx());
    if (r.kind === 'empty') return;
    // بدون رضایت فقط نوع پاسخ و شناسه‌ی مدخل (برای آمار بازخورد)؛ متن سؤال ذخیره نمی‌شه
    pushBot(r, text);
  }
  function pick(id) {
    var r = E.byId(idx, id, ctx());
    if (!r) return;
    pushBot(r);
  }
  function feedback(m, v) {
    m.fb = v;
    var d = load();
    d.fb.push({ t: today(), id: m.r.id || m.r.kind, kind: m.r.kind, v: v });
    save(d);
    renderLog();
  }
  function today() { var n = new Date(); return n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2); }
  function queueQuestion(m) {
    var d = load();
    d.queue.push({ t: today(), q: m.q, kind: m.r.kind, id: m.r.id || null, a: m.r.answer || '', fb: m.fb || null });
    save(d);
    m.sent = true; m.consent = false;
    renderLog();
  }

  // گزارش مشکل
  function showReport() {
    var box = document.querySelector('#ga-sheet .ga-report');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<label class="sr-only" for="ga-rep">' + esc(S.report) + '</label><textarea id="ga-rep" rows="3" maxlength="500" placeholder="' + esc(S.reportPh) + '"></textarea>' +
      '<p class="ga-small">' + esc(S.reportConsent) + '</p><div class="actions"><button type="button" class="btn btn-primary btn-sm" data-ga-repsave="1">' + esc(S.save) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-ga-repno="1">' + esc(S.cancel) + '</button></div>';
    box.querySelector('textarea').focus();
  }
  function saveReport() {
    var ta = document.getElementById('ga-rep');
    var text = ta ? ta.value.trim().slice(0, 500) : '';
    if (!text) return;
    var d = load();
    d.reports.push({ t: today(), text: text, ver: api.version || '', page: (api.lastPage || location.hash || '#home').split('/')[0] });
    save(d);
    var box = document.querySelector('#ga-sheet .ga-report');
    box.innerHTML = '<p class="ga-small">' + esc(S.saved) + '</p>';
  }

  // ---------- رویدادها ----------
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('#ga-btn') || t.closest('[data-ga-open]')) { e.preventDefault(); if (document.getElementById('ga-sheet')) close(); else open(); return; }
    var sheet = document.getElementById('ga-sheet');
    if (sheet && sheet.contains(t)) {
      if (t === sheet || t.closest('[data-ga-close]')) { close(); return; }
      if (t.closest('[data-ga-nav]')) { setTimeout(function () { close(true); }, 0); return; } // پیوند خودش صفحه رو عوض می‌کنه
      var mEl = t.closest('[data-mid]'), m = mEl ? msgById(mEl.dataset.mid) : null;
      if (t.closest('[data-ga-skipanim]')) { finishAnim(); return; }
      var b;
      if ((b = t.closest('[data-ga-pick]'))) { pick(b.dataset.gaPick); return; }
      if ((b = t.closest('[data-ga-opt]')) && m && m === flowMsg()) { pickOpt(m, b.dataset.gaOpt); return; }
      if (t.closest('[data-ga-skip]') && m && m === flowMsg()) { msgs.push({ who: 'me', text: KB.intake.skip, fresh: true }); flowStep(m, E.intakeSkip(idx, m.r.state, ctx())); return; }
      if ((b = t.closest('[data-ga-fb]')) && m) { feedback(m, b.dataset.gaFb); return; }
      if (t.closest('[data-ga-team]') && m) { m.consent = true; renderLog(); return; }
      if (t.closest('[data-ga-nocons]') && m) { m.consent = false; renderLog(); return; }
      if (t.closest('[data-ga-save]') && m) { queueQuestion(m); return; }
      if (t.closest('[data-ga-report]')) { showReport(); return; }
      if (t.closest('[data-ga-repsave]')) { saveReport(); return; }
      if (t.closest('[data-ga-repno]')) { var rb = sheet.querySelector('.ga-report'); rb.hidden = true; rb.innerHTML = ''; return; }
    }
    var admin = document.getElementById('ga-admin');
    if (admin && admin.contains(t) && (t === admin || t.closest('[data-ga-aclose]'))) { closeAdmin(); return; }
    if (t.closest('[data-ga-share]')) { shareQueue(); return; }
    if (t.closest('[data-ga-clear]')) { var d = load(); d.queue = []; d.reports = []; d.fb = []; save(d); api.showToast(S.cleared); api.rerender(); return; }
    if (t.closest('[data-ga-admin]')) { openAdmin(); return; }
    if (t.closest('#set-lab > summary')) {
      var now = Date.now();
      labTaps = now - labT0 < 4000 ? labTaps + 1 : 1; if (labTaps === 1) labT0 = now;
      if (labTaps >= 5) { labTaps = 0; var dd = load(); if (!dd.admin) { dd.admin = true; save(dd); api.showToast(S.adminOn); setTimeout(function () { api.rerender(); }, 0); } }
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('[data-ga-ack]')) {
      var box = t.closest('.ga-consent'), sv = box && box.querySelector('[data-ga-save]');
      if (sv) sv.disabled = !t.checked;
    }
    if (t.matches && t.matches('#ga-toggle')) {
      var d = load(); d.on = !!t.checked; save(d);
      api.rerender();
    }
    if (t.matches && t.matches('#ga-files')) readFiles(t.files);
  });
  document.addEventListener('submit', function (e) {
    if (!e.target.closest || !e.target.closest('#ga-sheet')) return;
    e.preventDefault();
    var input = e.target.querySelector('.ga-in');
    askText(input.value);
    input.value = '';
    input.focus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('ga-admin')) closeAdmin();
    else if (document.getElementById('ga-sheet')) close();
  });
  window.addEventListener('hashchange', function () { close(true); closeAdmin(); });

  // ---------- تنظیمات › آزمایشی ----------
  var LAB_ICON = '<path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.2 14h9.6"/>';
  function settingsSection(setSection) {
    if (!langOk()) return '';
    var d = load(), on = d.on !== false;
    var body = '<label class="check-row ga-toggle"><input type="checkbox" id="ga-toggle"' + (on ? ' checked' : '') + '> <span>' + esc(S.toggle) + '</span></label>' +
      '<small class="muted">' + esc(S.toggleHint) + '</small>';
    if (on) {
      body += '<p class="small">' + esc(f(S.queued, { n: api.num(d.queue.length), r: api.num(d.reports.length) })) + '</p>' +
        '<div class="actions">' +
        (d.queue.length || d.reports.length || d.fb.length ? '<button type="button" class="btn btn-primary" data-ga-share="1">' + esc(S.share) + '</button>' : '') +
        // صفحه‌ی مدیریت فقط برای صاحب پروژه: ۵ بار زدن پشت‌سرهم روی عنوان «آزمایشی» (بازبینی ۱۲، UX-07)
        (d.admin ? '<button type="button" class="btn btn-outline" data-ga-admin="1">' + esc(S.admin) + '</button>' : '') +
        (d.queue.length || d.reports.length || d.fb.length ? '<button type="button" class="btn btn-ghost" data-ga-clear="1">' + esc(S.clear) + '</button>' : '') +
        '</div>';
    }
    return setSection('lab', LAB_ICON, S.labTitle, esc(S.labSub + ': ' + (on ? S.on : S.off)), body);
  }

  // فایل فرستادنی: فقط سؤال‌هایی که کاربر با رضایت ذخیره کرده، گزارش‌ها و شمار بازخورد هر مدخل
  function exportData() {
    var d = load(), counts = {};
    d.fb.forEach(function (x) { var c = counts[x.id] = counts[x.id] || { y: 0, n: 0 }; c[x.v === 'y' ? 'y' : 'n']++; });
    return { app: 'gaam-assistant', v: 1, exported: today(), appVersion: api.version || '', questions: d.queue, reports: d.reports, feedback: counts };
  }
  function shareQueue() {
    var blob = new Blob([JSON.stringify(exportData(), null, 1)], { type: 'application/json' });
    api.saveFile('gaam-assistant-' + today() + '.json', blob);
  }

  // ---------- صفحه‌ی مدیریت ----------
  var adminData = [];
  function openAdmin() {
    if (document.getElementById('ga-admin')) return;
    adminData = [{ name: S.adminLocal, d: exportData() }];
    var el = document.createElement('div');
    el.id = 'ga-admin'; el.className = 'ga-backdrop';
    el.innerHTML = '<div class="ga-panel ga-admin-panel" role="dialog" aria-modal="true" aria-labelledby="ga-atitle">' +
      '<div class="ga-head"><h2 id="ga-atitle">' + esc(S.adminTitle) + '</h2><button type="button" class="ga-x" data-ga-aclose="1" aria-label="' + esc(S.close) + '">×</button></div>' +
      '<div class="ga-admin-body"><label class="btn btn-outline">' + esc(S.adminLoad) + '<input type="file" id="ga-files" accept="application/json,.json" multiple class="sr-only"></label>' +
      '<p class="ga-small ga-astatus" role="status"></p><div class="ga-astats"></div></div></div>';
    document.body.appendChild(el);
    document.body.classList.add('modal-open');
    renderAdmin();
    el.querySelector('.ga-x').focus();
  }
  function closeAdmin() {
    var el = document.getElementById('ga-admin');
    if (!el) return;
    el.remove();
    if (!document.getElementById('ga-sheet')) document.body.classList.remove('modal-open');
  }
  function readFiles(list) {
    var files = Array.prototype.slice.call(list || []), done = 0, bad = [];
    var st = document.querySelector('#ga-admin .ga-astatus');
    files.forEach(function (file) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          if (!d || d.app !== 'gaam-assistant') throw new Error('x');
          adminData.push({ name: file.name, d: d });
        } catch (e) { bad.push(file.name); }
        if (++done === files.length) {
          if (st) st.textContent = f(S.adminFiles, { n: api.num(files.length - bad.length) }) + (bad.length ? ' ' + f(S.adminBad, { f: bad.join('، ') }) : '');
          renderAdmin();
        }
      };
      r.readAsText(file);
    });
  }
  function adminStats() {
    var qs = [], reps = [], fb = {};
    adminData.forEach(function (x) {
      (x.d.questions || []).forEach(function (q) { if (q && q.q) qs.push(q); });
      (x.d.reports || []).forEach(function (q) { if (q && q.text) reps.push(q); });
      var c = x.d.feedback || {};
      Object.keys(c).forEach(function (k) { var o = fb[k] = fb[k] || { y: 0, n: 0 }; o.y += +c[k].y || 0; o.n += +c[k].n || 0; });
    });
    var groups = {};
    qs.forEach(function (q) { var k = E.normalize(q.q); (groups[k] = groups[k] || { q: q.q, n: 0, kinds: {} }).n++; groups[k].kinds[q.kind] = 1; });
    var frequent = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 15);
    var unanswered = qs.filter(function (q) { return q.kind !== 'answer' && q.kind !== 'urgent'; });
    var negative = qs.filter(function (q) { return q.fb === 'n'; });
    return { qs: qs, reps: reps, fb: fb, frequent: frequent, unanswered: unanswered, negative: negative };
  }
  function list(title, items, fmt) {
    return '<section class="ga-asec"><h3>' + esc(title) + ' <span class="muted">(' + api.num(items.length) + ')</span></h3>' +
      (items.length ? '<ul>' + items.map(function (x) { return '<li>' + fmt(x) + '</li>'; }).join('') + '</ul>' : '<p class="ga-small">' + esc(S.empty) + '</p>') + '</section>';
  }
  function renderAdmin() {
    var box = document.querySelector('#ga-admin .ga-astats');
    if (!box) return;
    var s = adminStats();
    var title = function (id) { var e = KB.entries.filter(function (x) { return x.id === id; })[0]; return e ? e.q : id; };
    box.innerHTML =
      list(S.unanswered, s.unanswered, function (q) { return esc(q.q) + ' <span class="muted">، ' + esc(q.kind) + (q.id ? '، ' + esc(q.id) : '') + '</span>'; }) +
      list(S.frequent, s.frequent, function (g) { return esc(g.q) + ' <b>×' + api.num(g.n) + '</b>'; }) +
      list(S.negative, s.negative, function (q) { return esc(q.q) + ' <span class="muted">→ ' + esc(title(q.id)) + '</span>'; }) +
      list(S.perEntry, Object.keys(s.fb).map(function (k) { return [k, s.fb[k]]; }), function (x) { return esc(title(x[0])) + ' <span class="muted">، ' + esc(S.yes) + ' ' + api.num(x[1].y) + '، ' + esc(S.no) + ' ' + api.num(x[1].n) + '</span>'; }) +
      list(S.reports, s.reps, function (r) { return esc(r.text) + ' <span class="muted">، ' + esc(r.page || '') + '، v' + esc(r.ver || '') + '</span>'; });
  }

  // ---------- اتصال به اپ ----------
  window.GaamAssistant = {
    attach: function (a) { api = a; idx = E.createIndex(KB); },
    header: header,
    learnChip: function () {
      if (!active()) return '';
      return '<button type="button" class="card ga-learn-chip" data-ga-open="1">' + Q_ICON + '<span>' + esc(S.chip) + '</span></button>';
    },
    settingsSection: function (setSection) { return api ? settingsSection(setSection) : ''; },
    // برای آزمون‌ها
    _ask: function (text) { return idx ? E.ask(idx, text, ctx()) : null; },
    _open: open
  };
})();
