// شبیه‌سازی دو ساله‌ی یک شخصیت جعلی روی همون موتور اپ (js/logic.js).
// هر روز: رویدادهای زندگی، چرخه، چک‌این، جلسه‌ی واقعی همون روز (C.effectiveSession، همون کدی که اپ اجرا می‌کنه)،
// تصمیم کاربر (انجام، جا انداختن، بیشتر دویدن)، درد، آمادگی پنهان، و بررسی‌های خودکار.
// چند کار کوچک کاربر (ثبت درد، قبول سطح تازه، عوض‌کردن هدف) در app.js داخل کلیک‌ها نوشته شده؛ اینجا همون خط‌ها کپی شده‌ن
// (با ذکر محل در app.js) تا وضعیت ذخیره‌شده دقیقاً مثل اپ باشه.
'use strict';
var clock = require('./lib/clock.js');
clock.install();
var C = require('../../js/logic.js');
var makeRng = require('./lib/rng.js');

var OFF = ['rest', 'none', 'cancelled'];
var TEMPER = {
  //               چک‌این  انجام  ثبت عدد واقعی  تایم‌تست  قبول سطح  نادیده‌گرفتن هشدار درد سبک
  disciplined: { ci: 0.85, doP: 0.92, actual: 0.6, test: 0.4, accept: 0.6, ignorePain: 0.05, over: 1.0 },
  erratic:     { ci: 0.4, doP: 0.68, actual: 0.3, test: 0.15, accept: 0.3, ignorePain: 0.15, over: 1.0 },
  obsessive:   { ci: 0.98, doP: 0.97, actual: 1.0, test: 0.8, accept: 0.8, ignorePain: 0.05, over: 1.0 },
  sensitive:   { ci: 0.7, doP: 0.82, actual: 0.4, test: 0.25, accept: 0.4, ignorePain: 0.02, over: 1.0 },
  bored:       { ci: 0.35, doP: 0.72, actual: 0.2, test: 0.05, accept: 0.5, ignorePain: 0.1, over: 1.0 },
  competitive: { ci: 0.6, doP: 0.95, actual: 0.9, test: 0.6, accept: 0.9, ignorePain: 0.3, over: 1.15 }
};
var SEV_ORDER = { critical: 0, major: 1, minor: 2, info: 3 };

function clone(x) { return JSON.parse(JSON.stringify(x)); }
function r1(x) { return Math.round(x * 10) / 10; }
function isNum(x) { return typeof x === 'number' && isFinite(x); }
function sessKm(s, zones) {
  if (!s || OFF.indexOf(s.type) >= 0) return 0;
  if (s.km > 0) return s.km;
  return 0;
}

// متن‌های نمایشی: جای‌خالی پرنشده، undefined/NaN، کلید ترجمه‌ی خام
var SKIP_KEYS = { date: 1, type: 1, key: 1, id: 1, category: 1, phase: 1, kind: 1, tier: 1, status: 1, movedFrom: 1, moved: 1, readyDate: 1,
  start: 1, area: 1, dayShort: 1, mode: 1, source: 1, b2b: 1, unit: 1, choice: 1, result: 1, fullDate: 1, race: 1, until: 1, src: 1, feel: 1, terrain: 1, rtr: 1 };
function scanText(obj, path, out, depth) {
  depth = depth || 0;
  if (obj == null || depth > 6) return;
  if (typeof obj === 'string') {
    if (/\{[a-zA-Z_]+\}/.test(obj)) out.push({ path: path, text: obj, why: 'placeholder' });
    else if (/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/.test(obj)) out.push({ path: path, text: obj, why: 'bad-value' });
    else if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){1,4}$/.test(obj)) out.push({ path: path, text: obj, why: 'raw-key' });
    return;
  }
  if (Array.isArray(obj)) { obj.forEach(function (v, i) { scanText(v, path + '[' + i + ']', out, depth + 1); }); return; }
  if (typeof obj === 'object') {
    Object.keys(obj).forEach(function (k) {
      if (SKIP_KEYS[k] || k === 'original') return;
      scanText(obj[k], path + '.' + k, out, depth + 1);
    });
  }
}

function prepare(persona) {
  var p = clone(persona.profile), d0 = C.parseDate(p.startDate);
  var fixGoal = function (g) { g = clone(g); if (g.dateIn != null) { g.date = C.dateKey(C.addDays(d0, g.dateIn)); delete g.dateIn; } return g; };
  p.goal = fixGoal(p.goal);
  p.uid = 'sim-' + persona.id;
  p.createdAt = new clock.RealDate(d0.getTime()).toISOString();
  var ev = (persona.events || []).map(function (e) { e = clone(e); if (e.goal) { e.goal = Object.assign({}, e.goal); if (e.goal.dateIn != null) { e.goal.date = C.dateKey(C.addDays(d0, e.day + e.goal.dateIn)); delete e.goal.dateIn; } } return e; });
  return { profile: p, events: ev };
}

function simulate(persona, opts) {
  opts = opts || {};
  var DAYS = opts.until || 730, snapEvery = opts.snapEvery || 30;
  var rnd = makeRng(persona.seed), T = TEMPER[persona.traits.temperament];
  var prep = prepare(persona), p = prep.profile, d0 = C.parseDate(p.startDate);
  var state = { profile: p, checkins: {}, done: {}, ackPain: {}, postRuns: {}, cycleChoices: {}, doneLog: {}, pains: {} };
  var walk = !!persona.traits.walk;

  // ---------- ثبت ایرادها ----------
  var findings = {}, findList = [];
  function F(sev, code, day, msg, data) {
    var f = findings[code];
    if (f) { f.count++; if (f.examples.length < 4 && f.examples[f.examples.length - 1].day !== day) f.examples.push({ day: day, date: C.dateKey(C.addDays(d0, day)), msg: msg, data: data }); return; }
    f = findings[code] = { persona: persona.id, sev: sev, code: code, day: day, date: C.dateKey(C.addDays(d0, day)), msg: msg, data: data, count: 1,
      examples: [{ day: day, date: C.dateKey(C.addDays(d0, day)), msg: msg, data: data }] };
    findList.push(f);
  }

  // ---------- وضعیت پنهان ----------
  var H = {
    vdot: persona.hidden.vdot, v0: persona.hidden.vdot, room: persona.hidden.room, vStop: persona.hidden.vdot, offDays: 0,
    atl: 0, ctl: 0, pain: 0, painArea: null, painDays: 0, highPainDays: 0, injuredUntil: null,
    cycleLast: p.cycle && p.cycle.lastStart ? C.parseDate(p.cycle.lastStart) : null, cycleNext: null, realStarts: p.cycle && p.cycle.lastStart ? [p.cycle.lastStart] : [],
    testPlanned: false, churn: 0, churnWhy: {}, churnTotal: {}, lastChurnDay: -999, offStreak: 0, offStart: null, unmot: 0
  };
  var seedKm = Number(p.monthAvgKm) || Number(p.currentWeeklyKm) || 0;
  H.ctl = H.atl = seedKm * 6 * 4 / 7;   // بار روزانه‌ی تقریبی (دقیقه × سختی)
  var cyc = persona.hidden.cycle;
  function nextCycle(from) {
    var g = Math.round(rnd.normal(cyc.mean, cyc.sd));
    return C.addDays(from, Math.max(21, Math.min(60, g)));
  }
  if (cyc && H.cycleLast) H.cycleNext = nextCycle(H.cycleLast);

  var days = [], weeks = [], events = [], churnPts = [], snaps = [], msgStreak = {}, msgMax = {};
  var curWeek = null, lastGoalChange = null, lastTestDay = null, levelLog = [], prevReady = null;
  var perf = {};

  function measure(name, fn, n) {
    var t0 = clock.perf(); for (var i = 0; i < (n || 1); i++) fn(); return (clock.perf() - t0) / (n || 1);
  }
  function addChurn(day, pts, why) {
    if (!pts) return;
    H.churn += pts; H.churnWhy[why] = (H.churnWhy[why] || 0) + pts; H.churnTotal[why] = (H.churnTotal[why] || 0) + pts;
  }
  function easyPaceSec() { return C.raceTimeFromVdot(H.vdot, 10) / 10 * 1.28; }
  function racePred(km) { return C.raceTimeFromVdot(H.vdot, km); }

  for (var day = 0; day < DAYS; day++) {
    var d = C.addDays(d0, day), k = C.dateKey(d);
    clock.set(d, 7);
    var ev = prep.events.filter(function (e) { return day >= e.day && day < e.day + (e.days || 1); });
    var travel = persona.traits.travelEvery && (day % persona.traits.travelEvery) >= persona.traits.travelEvery - 6 && day > 10;
    var sick = ev.some(function (e) { return e.type === 'sick'; });
    var busy = ev.filter(function (e) { return e.type === 'busy'; })[0];
    var unmot = ev.filter(function (e) { return e.type === 'unmotivated'; })[0];
    var todayEvents = [];
    if (travel) todayEvents.push('travel');
    if (sick) todayEvents.push('sick');
    if (busy) todayEvents.push('busy');
    if (unmot) todayEvents.push('unmotivated');

    // ---- رویدادهای یک‌باره ----
    prep.events.filter(function (e) { return e.day === day; }).forEach(function (e) {
      if (e.type === 'goal') {
        // صفحه‌ی مسابقه: بدون هدف اصلی، هدف تازه هدف اصلی می‌شه (app.js addRace)؛ با هدف قبلی گذشته، کاربر هدف رو عوض می‌کنه
        var old = C.goalInfo(p);
        p.goal = clone(e.goal);
        lastGoalChange = { day: day, type: e.goal.type, from: old.type };
        events.push({ day: day, kind: 'goal', text: 'هدف تازه: ' + C.goalLabel(C.goalInfo(p)) + ' (' + p.goal.date + ')' });
      } else if (e.type === 'swapMain') {
        // app.js makeMainGoal: هدف اصلی قبلی (آینده) فرعی می‌شه
        var og = C.goalInfo(p), oldG = p.goal;
        p.races = (p.races || []).concat([{ id: 'r' + day, name: '', km: og.km, date: og.date || null, goal: oldG }]);
        p.goal = clone(e.goal);
        lastGoalChange = { day: day, type: e.goal.type, from: og.type };
        events.push({ day: day, kind: 'goal', text: 'هدف اصلی شد ' + C.goalLabel(C.goalInfo(p)) + '؛ ' + C.goalLabel(og) + ' فرعی شد' });
      } else if (e.type === 'injury') {
        // app.js ثبت آسیب تأییدشده (صفحه‌ی سلامت)
        var until = C.dateKey(C.addDays(d, e.weeks * 7));
        p.injuries = (p.injuries || []).concat([{ id: 'i' + day, area: e.area, label: '', start: k, stopUntil: until, returnDate: null, setbacks: [] }]);
        H.injuredUntil = C.addDays(d, e.weeks * 7); H.pain = 0;
        events.push({ day: day, kind: 'injury', text: 'آسیب تأییدشده (' + e.area + ')، ' + e.weeks + ' هفته توقف' });
      } else if (e.type === 'busy' || e.type === 'unmotivated' || e.type === 'sick') {
        events.push({ day: day, kind: e.type, text: { busy: 'شلوغی کاری', unmotivated: 'بی‌انگیزگی', sick: 'بیماری' }[e.type] + ' (' + e.days + ' روز)' });
      }
    });
    if (travel && (day % persona.traits.travelEvery) === persona.traits.travelEvery - 6) events.push({ day: day, kind: 'travel', text: 'سفر ۶ روزه' });

    // ---- چرخه‌ی واقعی و ثبت شروع پریود ----
    if (cyc && H.cycleNext && C.dateKey(H.cycleNext) === k) {
      var absent = (cyc.absent || []).some(function (w) { return day >= w[0] && day < w[1]; });
      if (!absent) {
        H.realStarts.push(k);
        if (rnd.chance(cyc.logProb)) C.logPeriodStart(p, k);
        H.cycleLast = d;
      }
      H.cycleNext = nextCycle(d);
    }

    // ---- شروع هفته: برنامه‌ی هفته، تصمیم تایم‌تست، پیشنهاد سطح ----
    var ws = C.weekStart(d);
    if (C.dateKey(ws) === k || !curWeek) {
      if (curWeek) closeWeek(curWeek, day);
      var bw = C.buildWeek(p, d);
      curWeek = { start: C.dateKey(ws), day: day, weekIndex: bw.weekIndex, level: bw.level, plannedKm: bw.totalKm || 0, plannedMin: bw.totalMin || 0,
        doneKm: 0, doneMin: 0, runs: 0, planned: bw.days.filter(function (x) { return x.date >= k && OFF.indexOf(x.type) < 0; }).length,
        phase: bw.phase && bw.phase.key, painDays: 0, events: [], goal: C.goalInfo(p).type, deload: bw.phase && bw.phase.key === 'deload', longKm: 0, vert: bw.vert || 0 };
      weekChecks(bw, day);
      // سطح ۰: جواب سؤال هفتگی «این هفته چطور بود؟» (app.js data-zero-feel)
      if (!walk && bw.level === 0 && bw.weekIndex >= 0 && rnd.chance(T.ci * 0.8)) {
        var zf = rnd() < 0.25 ? 'easy' : rnd() < 0.12 ? 'hard' : 'ok';
        p.zeroWeeks = p.zeroWeeks || {}; p.zeroWeeks[bw.start] = { feel: zf, src: 'user' };
      }
      // برنامه جلوتر از تمرین: کارت «ادامه از حجم فعلی» در صفحه‌ی برنامه (app.js rebaseCard)
      var rb = walk ? null : C.rebaseSuggestion(p, state, d);
      if (rb) {
        H.rebaseShown = day;
        if (rnd.chance(T.ci)) {
          if (rnd.chance(T.accept)) {
            var rr = C.applyRebase(p, state, d);
            levelLog.push({ day: day, why: 'rebase', from: rr.from, to: rr.to });
            events.push({ day: day, kind: 'level', text: 'برنامه با حجم واقعی تنظیم شد: ' + rb.doneAvg + ' از ' + rb.planAvg + ' کیلومتر ← ' + rr.km + ' (سطح ' + rr.from + ' ← ' + rr.to + ')' });
            bw = C.buildWeek(p, d); curWeek.plannedKm = bw.totalKm || 0; curWeek.weekIndex = bw.weekIndex; curWeek.level = bw.level;
          } else state.rebaseSkip = C.dateKey(C.weekStart(d));
        }
      }
      if (!walk && !H.injuredUntil) {
        var rem = C.fitnessReminder(p, d);
        var due = rem && rem.kind !== 'none' || (rem && rem.kind === 'none' && day > 14);
        if (persona.traits.temperament === 'obsessive' && lastTestDay != null && day - lastTestDay >= 42) due = true;
        if (due && rnd.chance(T.test) && !unmot && !sick) H.testPlanned = true;
        var vs = C.vdotStepSuggestion(p, state.postRuns, d);
        if (vs && (persona.traits.temperament === 'competitive' || persona.traits.temperament === 'obsessive') && rnd.chance(0.7)) {
          p.fitnessTests = (p.fitnessTests || []).concat([vs.entry]);    // app.js data-vdot-step
          events.push({ day: day, kind: 'level', text: 'پله‌ی پیس قبول شد: VDOT ' + vs.from.toFixed(1) + ' ← ' + vs.to.toFixed(1) });
        }
      }
      if (walk) {
        var wl = C.walkLevelSuggestion(p, d, state);
        if (wl && !unmot && rnd.chance(0.5)) {
          var before = C.assessLevel(p).level, l4 = weeks.slice(-2);
          var pm = l4.reduce(function (s0, w) { return s0 + w.plannedMin; }, 0), dm = l4.reduce(function (s0, w) { return s0 + w.doneMin; }, 0);
          if (l4.length === 2 && pm > 0 && dm < pm * 0.7) F('major', 'walk-level-adherence', day, 'پیشنهاد سطح بالاتر پیاده‌روی با وجود انجام کم (دو هفته‌ی آخر زیر ۷۰٪)', { from: wl.from, to: wl.to, doneMin2w: dm, plannedMin2w: pm, pct: Math.round(dm / pm * 100) });
          Object.assign(p, wl.next); p.startDate = k;                      // app.js data-wlevel-up
          events.push({ day: day, kind: 'level', text: 'سطح پیاده‌روی ' + before + ' ← ' + C.assessLevel(p).level });
        }
        if (C.assessLevel(p).level >= 5 && !p.runBridgeDismissed) { p.runBridgeDismissed = true; events.push({ day: day, kind: 'level', text: 'پیشنهاد پل به دویدن دیده شد و بسته شد' }); }
      }
    }

    // ---- جلسه‌ی برنامه و چک‌این ----
    var base = C.sessionFor(p, d);
    if (base.date !== k) F('critical', 'date-mismatch', day, 'جلسه‌ی روز تاریخ دیگه‌ای داره', { want: k, got: base.date });
    var ratio = H.ctl > 1 ? H.atl / H.ctl : 1;
    var fatigue = Math.round(Math.max(1, Math.min(5, 2 + (ratio - 1) * 3 + (sick ? 2.5 : 0) + (busy ? 0.6 : 0) + rnd.normal(0, 0.7))));
    var sleep = Math.round(Math.max(1, Math.min(5, 4 - (busy ? 1.3 : 0) - (sick ? 1 : 0) + rnd.normal(0, 0.8))));
    var ciProb = T.ci * (unmot ? 0.25 : 1) * (travel ? 0.5 : 1);
    var painNow = H.pain > 0;
    var checked = rnd.chance(ciProb) || (painNow && rnd.chance(0.5));
    if (checked) {
      // app.js ثبت چک‌این
      state.checkins[k] = { fatigue: fatigue, sleep: sleep, pain: painNow, painWhere: painNow ? H.painArea : '', at: clock.iso() };
      if (painNow) logPain(k, d);
      else delete state.pains[k];
    } else if (painNow && (H.painDays === 1 || H.pain >= 5) && rnd.chance(0.5)) logPain(k, d);

    // سطح ۰ تموم شد: کارت «آماده‌ای» روی خانه؛ کاربری که اپ رو باز کرده ممکنه دکمه رو بزنه (app.js data-zero-graduate)
    if (!walk && checked && C.assessLevel(p).level === 0) {
      var zwk = C.buildWeek(p, d);
      if ((zwk.zeroStage || 0) >= zwk.zeroFinal) {
        H.zeroReady = H.zeroReady == null ? day : H.zeroReady;
        if (rnd.chance(0.35)) {
          p.experience = 'lt3m'; p.currentWeeklyKm = p.lastWeekKm = p.monthAvgKm = 8; p.volumeReason = null; p.structured = false; p.startDate = k;
          levelLog.push({ day: day, why: 'level', from: 0, to: 1 });
          events.push({ day: day, kind: 'level', text: 'سطح ۰ تموم شد (آماده از روز ' + H.zeroReady + ') ← سطح ' + C.assessLevel(p).level });
          base = C.sessionFor(p, d);
        }
      }
    }
    var r = C.effectiveSession(state, base);
    // پیشنهاد چرخه: انتخاب کاربر
    if (r.cycle && r.cycle.sug && r.cycle.choice == null) {
      var tp = persona.traits.temperament, ch = null;
      if (tp === 'sensitive' && rnd.chance(0.6)) ch = rnd.chance(0.5) ? 'rest' : 'adapt';
      else if (tp === 'obsessive' && rnd.chance(0.5)) ch = r.cycle.moveTo ? 'move' : 'adapt';
      else if (tp === 'disciplined' && rnd.chance(0.3)) ch = 'adapt';
      if (ch) { state.cycleChoices[k] = ch; r = C.effectiveSession(state, base); }
    }
    var s = r.session;
    dayChecks(day, d, k, base, r);

    // ---- پیام‌های تکراری (پیام مربی و یادآوری) ----
    var msgs = [];
    if (r.adaptation && r.adaptation.message) msgs.push(r.adaptation.message);
    if (!walk) { var fr = C.fitnessReminder(p, d); if (fr) msgs.push(fr.message); }
    var sgL = walk ? null : C.fitnessLevelSuggestion(p);
    if (sgL) msgs.push('level:' + sgL.from + '>' + sgL.to);
    Object.keys(msgStreak).forEach(function (m) { if (msgs.indexOf(m) < 0) delete msgStreak[m]; });
    msgs.forEach(function (m) {
      msgStreak[m] = (msgStreak[m] || 0) + 1;
      msgMax[m] = Math.max(msgMax[m] || 0, msgStreak[m]);
      if (persona.traits.temperament === 'bored' && msgStreak[m] > 10 && (state.checkins[k] || rnd.chance(0.3))) addChurn(day, 0.4, 'repeat');
    });

    // ---- زودرنج: جلسه‌ی سخت بعد از روز بد ----
    var prevCi = C.prevCheckin(state, k);
    if (s.hard && prevCi && (prevCi.fatigue >= 4 || prevCi.sleep <= 2)) {
      if (persona.traits.temperament === 'sensitive') addChurn(day, 3, 'hardAfterBadDay');
      else addChurn(day, 0.5, 'hardAfterBadDay');
    }

    // ---- تصمیم کاربر ----
    var doable = OFF.indexOf(s.type) < 0;
    var injuredOff = H.injuredUntil && d < H.injuredUntil;
    var offAdvice = OFF.indexOf(s.type) >= 0 && OFF.indexOf(base.type) < 0;   // اپ امروز رو استراحت کرده
    var runToday = false, ignored = false;
    if (!sick && !travel && !injuredOff) {
      var pDo = T.doP * (busy ? (busy.doProb || 0.4) / 0.9 : 1) * (unmot ? (unmot.doProb != null ? unmot.doProb : 0.2) : 1);
      if (doable) runToday = rnd.chance(Math.min(0.99, pDo));
      else if (offAdvice && H.pain > 0 && H.pain <= 3 && rnd.chance(T.ignorePain)) { runToday = true; ignored = true; }
    }
    if (runToday && H.pain >= 6) runToday = false;    // درد زیاد: کسی نمی‌دوه
    var actualSess = null;
    if (runToday) {
      var plan = doable ? s : C.sessionFor(p, d);
      if (OFF.indexOf(plan.type) >= 0) plan = { type: 'easy', km: 5, minutes: 35, date: k, label: 'ایزی', hard: false };
      var over = T.over * (plan.hard ? 1 : rnd.range(0.95, 1.1)) * (busy ? 0.8 : 1);
      var isTest = H.testPlanned && !plan.hard && plan.type !== 'race' && plan.type !== 'walkrun' && !walk;
      // markDone (app.js): همون جلسه‌ی بعد از تطبیق، با loggable
      state.done[k] = true;
      var logged = OFF.indexOf(s.type) < 0 ? s : plan;
      var snap = C.sessionSnapshot(logged);
      var mins = plan.minutes || (plan.km ? plan.km * easyPaceSec() / 60 : 30);
      var actKm = plan.km ? r1(plan.km * over) : null;
      if (rnd.chance(T.actual) && !walk) {
        snap.actual = {};
        if (actKm) snap.actual.km = actKm;
        snap.actual.sec = Math.round(mins * 60 * over / (T.over > 1 ? 1.04 : 1));
      }
      state.doneLog[k] = snap;
      if (!plan.hard && !walk && OFF.indexOf(plan.type) < 0 && rnd.chance(T.actual)) {
        var rpe = Math.max(1, Math.min(10, Math.round(3 + (ratio - 1) * 4 + (H.pain > 0 ? 1 : 0) + rnd.normal(0, 0.8))));
        if (plan.type === 'walkrun' && H.vdot < 26 && rnd.chance(0.15)) rpe = 8;
        state.postRuns[k] = { rpe: rpe, pace: null, easy: true, type: plan.type, at: clock.iso() };
        // سطح ۰: جلسه‌ی خیلی سخت → هفته «سخت» (app.js postrun)
        if (plan.type === 'walkrun' && rpe >= 8) {
          var zw = p.zeroWeeks = p.zeroWeeks || {}, wkk = C.dateKey(C.weekStart(d));
          if (!zw[wkk] || zw[wkk].src !== 'user') zw[wkk] = { feel: 'hard', src: 'rpe' };
        }
      }
      if (isTest) {
        var tkm = C.assessLevel(p).level <= 1 ? 2 : 5;
        var tsec = Math.round(racePred(tkm) * (1 + rnd.normal(0.01, 0.015)) * (fatigue >= 4 ? 1.03 : 1));
        p.fitnessTests = (p.fitnessTests || []).concat([{ date: k, distanceKm: tkm, timeSec: tsec, kind: 'test' }]);   // app.js fitness
        H.testPlanned = false; lastTestDay = day;
        events.push({ day: day, kind: 'test', text: 'تایم‌تست ' + tkm + ' کیلومتر: ' + C.formatDuration(tsec) + ' (آمادگی پنهان VDOT ' + H.vdot.toFixed(1) + ')' });
        testFollow(day, d, k, tkm, tsec);
      }
      if (plan.type === 'race') raceDay(day, d, k, plan);
      actualSess = { type: plan.type, km: actKm || plan.km, minutes: mins * over, hard: plan.hard };
      if (curWeek) {
        curWeek.runs++; curWeek.doneKm += actKm || plan.km || 0; curWeek.doneMin += mins * over;
        if (plan.type === 'long') curWeek.longKm = Math.max(curWeek.longKm, actKm || plan.km || 0);
      }
      if (ignored) events.push({ day: day, kind: 'ignore', text: 'با وجود درد سبک دوید' });
      if (H.offStreak >= 14) gapReturn(day, d);
      H.offStreak = 0; H.offStart = null;
    } else {
      if (H.offStreak === 0) H.offStart = day;
      if (OFF.indexOf(base.type) < 0 || H.offStreak > 0) H.offStreak++;
    }

    // ---- بار تمرین، درد و آمادگی پنهان ----
    var load = actualSess ? actualSess.minutes * (actualSess.hard ? 7 : actualSess.type === 'long' ? 5 : 4) : 0;
    H.atl += (load - H.atl) * (1 - Math.exp(-1 / 7));
    H.ctl += (load - H.ctl) * (1 - Math.exp(-1 / 42));
    var acwr = H.ctl > 1 ? H.atl / H.ctl : 1;
    if (H.pain > 0) {
      H.painDays++;
      if (actualSess) H.pain += rnd.chance(actualSess.hard ? 0.5 : 0.3) ? 1 : (rnd.chance(0.25) ? -1 : 0);
      else H.pain -= rnd.chance(0.4) ? 1 : 0;
      H.pain = Math.max(0, Math.min(9, H.pain));
      H.highPainDays = H.pain >= 7 ? H.highPainDays + 1 : 0;
      if (H.highPainDays >= 3) {
        // دکتر: آسیب تأییدشده با ۳ تا ۵ هفته توقف
        var wk2 = rnd.int(3, 5), until2 = C.dateKey(C.addDays(d, wk2 * 7));
        p.injuries = (p.injuries || []).concat([{ id: 'i' + day, area: H.painArea, label: '', start: k, stopUntil: until2, returnDate: null, setbacks: [] }]);
        H.injuredUntil = C.addDays(d, wk2 * 7); H.pain = 0; H.highPainDays = 0;
        events.push({ day: day, kind: 'injury', text: 'درد بدتر شد ← آسیب تأییدشده (' + H.painArea + ')، ' + wk2 + ' هفته' });
      }
      if (H.pain === 0) { H.painDays = 0; events.push({ day: day, kind: 'painfree', text: 'درد خوب شد' }); }
    } else if (actualSess && !(H.injuredUntil && d < H.injuredUntil)) {
      var haz = 0.0022 * (0.3 + persona.traits.injuryRisk * 1.7) * (1 + (day >= 28 ? Math.max(0, Math.min(2, acwr) - 1.2) * 8 : 0)) * (actualSess.hard ? 1.6 : 1) * (T.over > 1 ? 1.3 : 1);
      if (rnd.chance(haz)) {
        H.pain = rnd.int(2, 5); H.painDays = 1; H.painArea = rnd.pick(['knee', 'shin', 'achilles', 'calf', 'foot', 'hip']);
        events.push({ day: day, kind: 'pain', text: 'درد ' + H.painArea + ' (سطح ' + H.pain + ')' + (day >= 28 && acwr > 1.3 ? '، بعد از جهش بار (ACWR ' + acwr.toFixed(2) + ')' : '') });
      }
    }
    if (curWeek && H.pain > 0) curWeek.painDays++;
    if (H.injuredUntil && d >= H.injuredUntil) H.injuredUntil = null;

    // ---- شاخص نارضایتی ----
    H.churn *= 0.97;
    if (H.churn >= 10 && day - H.lastChurnDay >= 30) {
      var top = Object.keys(H.churnWhy).sort(function (a, b) { return H.churnWhy[b] - H.churnWhy[a]; })[0];
      churnPts.push({ day: day, date: k, why: top, score: r1(H.churn), parts: clone(H.churnWhy) });
      H.lastChurnDay = day; H.churn = 5; H.churnWhy = {};
    }

    days.push({ day: day, date: k, base: base.type, type: s.type, km: sessKm(s), hard: !!s.hard, ran: runToday, ev: todayEvents, pain: H.pain, vdot: r1(H.vdot), ci: !!checked, churn: r1(H.churn) });
    if (day % snapEvery === 0 || day === DAYS - 1) snaps.push({ day: day, date: k, state: JSON.stringify(state) });
    if (day === 1) {
      perf.week1 = measure('w', function () { C.buildWeek(p, d); }, 30);
      perf.an1 = measure('a', function () { C.analytics(state, d, 56); }, 5);
    }
  }
  if (curWeek) closeWeek(curWeek, DAYS);
  var dl = C.addDays(d0, DAYS - 1);
  perf.weekN = measure('w', function () { C.buildWeek(p, dl); }, 30);
  perf.anN = measure('a', function () { C.analytics(state, dl, 56); }, 5);
  perf.anAll = measure('a', function () { C.analytics(state, dl); }, 2);
  perf.bytes = JSON.stringify(state).length;
  if (perf.anN > Math.max(40, perf.an1 * 8)) F('minor', 'perf-analytics', DAYS - 1, 'محاسبه‌ی پیشرفت بعد از دو سال خیلی کندتر شده', { ms1: r1(perf.an1), msN: r1(perf.anN) });
  if (perf.bytes > 2.5e6) F('major', 'storage', DAYS - 1, 'حجم داده نزدیک سقف حافظه‌ی مرورگر', { bytes: perf.bytes });
  Object.keys(msgMax).forEach(function (m) {
    if (msgMax[m] < 21) return;
    var lvl = m.indexOf('level:') === 0;
    F('minor', lvl ? 'repeat-level' : 'repeat:' + m.slice(0, 40), DAYS - 1,
      lvl ? 'پیشنهاد تغییر سطح ماه‌ها هر روز تکرار می‌شه (کاربر قبول نکرده و دکمه‌ی «نه» نیست)' : 'یک پیام ' + msgMax[m] + ' روز پشت‌سرهم تکرار شد',
      { message: lvl ? m.slice(6) : m, days: msgMax[m] });
  });
  // ---------- بررسی‌های روزانه ----------
  function dayChecks(day, d, k, base, r) {
    var s = r.session;
    ['km', 'minutes', 'hardKm'].forEach(function (f) {
      if (s[f] != null && !(isNum(s[f]) && s[f] >= 0)) F('critical', 'num-' + f, day, 'عدد نامعتبر در جلسه (' + f + ')', { value: String(s[f]), type: s.type });
    });
    if (s.hardKm > 0 && s.km > 0 && s.hardKm > s.km + 0.05) F(s.hardKm - s.km < 0.3 ? 'minor' : 'major', s.hardKm - s.km < 0.3 ? 'race-km-round' : 'hardkm', day, s.hardKm - s.km < 0.3 ? 'مسافت مسابقه گرد شده ولی بخش شدید دقیق مونده' : 'مسافت شدید از کل جلسه بیشتره', { km: s.km, hardKm: s.hardKm, type: s.type });
    var bad = [];
    scanText(s, 'session', bad);
    if (r.adaptation) scanText(r.adaptation, 'adaptation', bad);
    if (r.cycle) scanText({ label: r.cycle.label }, 'cycle', bad);
    bad.forEach(function (b) { F('major', 'text:' + b.why + ':' + b.path.replace(/\[\d+\]/g, '[]'), day, 'متن خراب (' + b.why + ')', { path: b.path, text: String(b.text).slice(0, 160), type: s.type }); });
    // درد: تا «بدون درد» ثبت نشده، جلسه‌ی سخت نیست و از جلسه‌ی برنامه بیشتر نیست
    var ep = C.painEpisode(state.pains, state.checkins, d);
    if (ep && ep.tier && ep.tier !== 'none') {
      if (s.hard && !(s.type === 'race' && ep.tier === 'mild')) F('critical', 'pain-hard', day, 'با درد ثبت‌شده (' + ep.tier + ') جلسه‌ی سخت اومده', { type: s.type, base: base.type, tier: ep.tier });
      if (s.km > 0 && base.km > 0 && s.km > base.km + 0.05) F('critical', 'pain-more', day, 'با درد، جلسه از برنامه‌ی اصلی بیشتر شده', { km: s.km, base: base.km, tier: ep.tier });
      if (ep.tier === 'severe' && OFF.indexOf(s.type) < 0) F('critical', 'pain-severe-run', day, 'درد شدید ولی جلسه‌ی دویدن داده شده', { type: s.type });
    }
    // آسیب: در دوره‌ی توقف، دویدن نیست
    var ip = p.injuries && p.injuries.length ? C.injuryPhase(p, d) : null;
    if (ip && ip.phase === 'off' && OFF.indexOf(s.type) < 0 && ['walk', 'cross', 'xtrain', 'strength', 'mobility'].indexOf(s.type) < 0 && C.TYPE_INFO[s.type] && s.km > 0)
      F('critical', 'injury-run', day, 'در دوره‌ی توقف آسیب، جلسه‌ی دویدن داده شده', { type: s.type, km: s.km });
    if (ip && (ip.phase === 'return') && s.hard) F('critical', 'injury-hard', day, 'در مرحله‌ی بازگشت از آسیب، جلسه‌ی سخت', { type: s.type });
    // چرخه
    if (p.cycle && p.cycle.enabled) {
      var ci2 = C.cycleInfo(p, d);
      if (!ci2 || ['period', 'follicular', 'ovulation', 'luteal', 'lateLuteal'].indexOf(ci2.phase) < 0) F('major', 'cycle-phase', day, 'فاز چرخه نامعتبر', { info: ci2 });
      if (day % 7 === 0) {
        var cst = C.cycleStats(p, d), lg = cst.gaps || [];
        if (cst.since > 90 && cst.flags.indexOf('absent') < 0) F('major', 'cycle-absent-flag', day, 'بیش از ۹۰ روز بدون پریود ثبت‌شده، ولی هشدار نیومده', { since: cst.since });
        if (lg.length >= 3 && Math.max.apply(null, lg) - Math.min.apply(null, lg) > 9 && cst.flags.indexOf('variable') < 0) F('major', 'cycle-variable-flag', day, 'فاصله‌ها نامنظم ولی هشدار نامنظمی نیومده', { gaps: lg });
        // هشدار نامنظمی برای چرخه‌ای که در واقع منظمه (فقط چون کاربر یک شروع رو ثبت نکرده)
        var rs = H.realStarts.filter(function (x) { return x <= k; }).slice(-7), rg = [];
        for (var gi2 = 1; gi2 < rs.length; gi2++) rg.push(C.daysBetween(C.parseDate(rs[gi2 - 1]), C.parseDate(rs[gi2])));
        var realOk = !lg.some(function (g) { return g > 90; }) && rg.length >= 2 && rg.every(function (g) { return g >= 21 && g <= 45; }) && Math.max.apply(null, rg) - Math.min.apply(null, rg) <= 9 && !(cyc.absent || []).some(function (w) { return day >= w[0] && day < w[1] + 60; });
        // «absent» (بیش از ۹۰ روز بدون ثبت) عمداً هشدار می‌ده: موتور ثبت‌نکردن رو از بی‌پریودی واقعی تشخیص نمی‌ده
        var falseFl = cst.flags.filter(function (fl) { return fl === 'variable' || fl === 'outOfRange'; });
        // مبهم: فاصله‌ی بلند تقریباً دو یا سه برابره ولی بیش از ۲۰٪ با طول معمول فرق داره (چرخه‌ی واقعی هم عوض شده)
        var okL = lg.filter(function (g) { return g >= 21 && g <= 45; }), L0s = okL.length >= 2 ? okL.slice().sort(function (x, y) { return x - y; })[Math.floor(okL.length / 2)] : 28;
        var ambiguous = lg.some(function (g) { var n = Math.round(g / L0s); return g > 45 && n >= 2 && n <= 3 && Math.abs(g / n - L0s) > Math.max(5, L0s * 0.2); });
        if (realOk && falseFl.length && ambiguous) F('minor', 'cycle-ambiguous', day, 'یک ثبت جاافتاده همراه با تغییر طول چرخه؛ موتور نمی‌تونه از نامنظمی تشخیصش بده', { loggedGaps: lg, realGaps: rg, flags: cst.flags });
        else if (realOk && falseFl.length) F('major', 'cycle-false-irregular', day, 'چرخه‌ی واقعی منظمه ولی به‌خاطر یک ثبت جاافتاده هشدار «' + falseFl.join('، ') + '» اومده', { loggedGaps: lg, realGaps: rg, flags: cst.flags });
        if (cst.flags.length) H.cycleFlags = H.cycleFlags || {}, cst.flags.forEach(function (fl) { if (!H.cycleFlags[fl]) { H.cycleFlags[fl] = day; events.push({ day: day, kind: 'cycle', text: 'هشدار چرخه: ' + fl }); } });
      }
      var np = C.nextPeriod(p, d);
      if (np && np.daysTo < 0) F('major', 'cycle-next', day, 'پیش‌بینی پریود بعدی در گذشته', { np: np });
    }
    // پیس‌ها
    if (!walk && day % 7 === 0) {
      var z = C.paceZones(p);
      ['vdot', 'easyCenter'].forEach(function (zk) {
        var v = z && z[zk];
        if (v != null && !(isNum(v) && v > 0)) F('critical', 'pace-' + zk, day, 'پیس نامعتبر', { zone: zk, value: String(v) });
      });
      if (z && !isNum(z.easyAdjustSec)) F('critical', 'pace-adjust', day, 'تنظیم پیس ایزی نامعتبر', { value: String(z.easyAdjustSec) });
      if (z && isNum(z.easyCenter) && (z.easyCenter < 180 || z.easyCenter > 720)) F('major', 'pace-range', day, 'پیس ایزی خارج از بازه‌ی منطقی (۳ تا ۱۲ دقیقه)', { easy: z.easyCenter });
    }
    // هدف و مسابقه
    var gi = C.goalInfo(p);
    if (!walk && gi.date && day % 7 === 0) {
      var gp = C.goalPath(p, d, state);
      scanText(gp, 'goalPath', bad = []);
      bad.forEach(function (b) { F('major', 'text:goalPath:' + b.path, day, 'متن خراب در مسیر هدف', b); });
      var imp = p.injuries && p.injuries.length ? C.injuryImpact(p, d) : null;
      if (imp && imp.status && imp.status !== 'ok' && gp && gp.status === 'ok' && gi.date > k)
        F('major', 'goal-vs-injury', day, 'صفحه‌ی سلامت می‌گه رسیدن به مسابقه «' + imp.status + '»، ولی مسیر هدف می‌گه «ok»', { injury: imp.status, fullDate: imp.fullDate, race: gi.date, goalReady: gp.readyDate });
      var l6 = weeks.slice(-6).filter(function (w) { return w.weekIndex >= 0; });
      if (l6.length === 6 && gp && (gp.status === 'ok' || gp.status === 'ready') && !(H.rebaseShown != null && day - H.rebaseShown <= 42) && !gp.past && gi.date > k && C.daysBetween(d, C.parseDate(gi.date)) <= 42 &&
          l6.reduce(function (s0, w) { return s0 + w.doneKm; }, 0) < 0.5 * l6.reduce(function (s0, w) { return s0 + w.plannedKm; }, 0))
        F('major', 'goal-ignores-missed', day, 'شش هفته‌ی آخر زیر ۵۰٪ برنامه انجام شده و مسابقه نزدیکه، ولی مسیر هدف تغییری نکرده (فقط از شماره‌ی هفته حساب می‌شه)', { status: gp.status, ready: gp.readyDate, race: gi.date, planned: l6.map(function (w) { return w.plannedKm; }), done: l6.map(function (w) { return w.doneKm; }) });
      if (gp && gp.readyDate && gi.date > k) {
        if (gp.readyDate > gi.date && gp.status === 'ok') F('major', 'goal-status', day, 'تخمین آماده‌شدن بعد از مسابقه‌ست ولی وضعیت «ok»', { ready: gp.readyDate, race: gi.date });
        if (prevReady && prevReady.goal === gi.date && gp.readyDate > prevReady.ready && C.daysBetween(C.parseDate(prevReady.ready), C.parseDate(gp.readyDate)) > 7) {
          var wkRatio = curWeek && curWeek.plannedKm ? curWeek.doneKm / curWeek.plannedKm : 1;
          if (persona.traits.temperament === 'competitive') addChurn(day, 2, 'goalSlip');
          if (persona.traits.temperament === 'obsessive' && wkRatio > 0.8) addChurn(day, 2, 'inconsistent');
        }
        prevReady = { goal: gi.date, ready: gp.readyDate };
      }
      if (gi.date < k) {
        var since = C.daysBetween(C.parseDate(gi.date), d);
        if (since >= 21) addChurn(day, 1.2, 'staleGoal');
        if (since >= 14 && since < 21) {
          var bw2 = C.buildWeek(p, d);
          if (bw2.days.some(function (x) { return x.type === 'race'; })) F('major', 'race-after', day, 'دو هفته بعد از مسابقه هنوز روز مسابقه در برنامه‌ست', { race: gi.date });
          if (bw2.phase && bw2.phase.key === 'taper') F('major', 'taper-after', day, 'بعد از مسابقه هنوز فاز تیپر', { race: gi.date });
        }
      }
    }
    if (lastGoalChange && day - lastGoalChange.day === 7) {
      var bw3 = C.buildWeek(p, d), g3 = bw3.goal && (bw3.goal.type || bw3.goal);
      if (g3 && g3 !== lastGoalChange.type && bw3.goal.type !== lastGoalChange.type) F('major', 'goal-apply', day, 'یک هفته بعد از تغییر هدف، برنامه هنوز هدف قبلی رو داره', { want: lastGoalChange.type, got: g3 });
    }
  }

  // ---------- بررسی‌های هفتگی ----------
  function weekChecks(bw, day) {
    if (bw.days.length !== 7) F('critical', 'week-len', day, 'هفته ۷ روز نداره', { n: bw.days.length });
    for (var i = 1; i < bw.days.length; i++) if (C.daysBetween(C.parseDate(bw.days[i - 1].date), C.parseDate(bw.days[i].date)) !== 1) { F('critical', 'week-dates', day, 'تاریخ‌های هفته پشت‌سرهم نیستن', { days: bw.days.map(function (x) { return x.date; }) }); break; }
    if (walk) return;
    var L = C.LEVELS[bw.level], longD = bw.days.filter(function (x) { return x.type === 'long'; })[0];
    if (longD && L && L.longCap) {
      var cap = C.goalInfo(p).category === 'ultra' ? 45 : L.longCap;
      if (longD.km > cap + 0.5) F('major', 'long-cap', day, 'لانگ‌ران از سقف سطح بیشتره', { km: longD.km, cap: cap, level: bw.level });
      if (bw.totalKm >= 20 && longD.km > bw.totalKm * 0.5 + 0.5) F('minor', 'long-share', day, 'لانگ‌ران بیش از نصف حجم هفته', { long: longD.km, week: bw.totalKm });
    }
    // رشد حجم: نسبت به بیشترین حجم ۳ هفته‌ی کامل قبل (هفته‌ی سبک با «بیشترین» خنثی می‌شه).
    // اطراف مسابقه‌ی اصلی (تیپر، مسابقه، ریکاوری، برگشت) مبنا حجم قبل از تیپره؛ هفته‌ی شروعِ ناقص مبنا نیست.
    var RACEY = ['taper', 'race', 'recovery'];
    var full = weeks.filter(function (w) { return w.weekIndex >= 0 && w.start < bw.start; });
    var last3 = full.slice(-3), ph = bw.phase && bw.phase.key;
    var aroundRace = ph === 'return' || last3.some(function (w) { return RACEY.indexOf(w.phase) >= 0; });
    var baseW = aroundRace ? full.slice(-10).filter(function (w) { return RACEY.indexOf(w.phase) < 0 && w.phase !== 'return'; }).slice(-3) : last3;
    var base2 = aroundRace ? baseW : full.slice(-4, -1);
    var sideWk = bw.days.some(function (x) { return x.type === 'race'; }) && C.goalInfo(p).date !== bw.days.filter(function (x) { return x.type === 'race'; })[0].date;
    if (bw.weekIndex >= 0 && baseW.length && bw.totalKm > 0 && ph !== 'race') {
      var m1 = Math.max.apply(null, baseW.map(function (w) { return w.plannedKm; })), m2 = base2.length ? Math.max.apply(null, base2.map(function (w) { return w.plannedKm; })) : m1;
      var why = sideWk ? { why: 'side' } : levelLog.filter(function (x) { return day - x.day < 7; })[0] || (lastGoalChange && day - lastGoalChange.day < 7 ? { why: 'goal' } : null);
      var lab = { side: 'هفته‌ی مسابقه‌ی فرعی', goal: 'تغییر هدف', level: 'تغییر سطح', rebase: 'تنظیم با حجم واقعی' };
      var sv = why && why.why === 'side' ? 'minor' : 'major';
      if (m1 > 0 && bw.totalKm > m1 * 1.15 + 1) F(sv, 'vol-week' + (why ? '-' + why.why : ''), day, 'رشد حجم هفتگی بیشتر از ۱۵٪' + (why ? ' (' + lab[why.why] + ')' : ''), { from: m1, to: bw.totalKm, pct: Math.round((bw.totalKm / m1 - 1) * 100), phase: ph });
      else if (!aroundRace && m2 > 0 && bw.totalKm > m2 * 1.3 + 1) F(sv, 'vol-2week' + (why ? '-' + why.why : ''), day, 'رشد حجم دوهفته‌ای بیشتر از ۳۰٪', { from: m2, to: bw.totalKm, pct: Math.round((bw.totalKm / m2 - 1) * 100), phase: ph });
    }
    // ارتفاع (اولترا و تریل): سقف هفته و رشد حداکثر ۱۰٪ (قاعده‌ی خود موتور VERT_GROWTH)
    if (bw.vert > 0) {
      if (bw.vertCap > 0 && bw.vert > bw.vertCap * 1.02 + 20) F('major', 'vert-cap', day, 'ارتفاع هفته از سقف خود برنامه بیشتره', { vert: bw.vert, cap: bw.vertCap });
      var pv = full.slice(-3).map(function (w) { return w.vert || 0; }), mv = pv.length ? Math.max.apply(null, pv) : 0;
      var uv = (C.goalInfo(p).ultra || (p.goal && p.goal.ultra) || {}).weeklyVert || 0;
      if (mv > 0 && !aroundRace && bw.vert > Math.max(mv * 1.1 + 60, uv * 1.1 + 20)) F('major', 'vert-growth', day, 'رشد ارتفاع هفتگی بیشتر از ۱۰٪ (سقف ۱۰٪ روی «سقف» اعمال می‌شه، نه روی ارتفاع واقعی هفته‌ی قبل)', { from: mv, to: bw.vert, cap: bw.vertCap, userWeekly: uv });
    }
  }
  function closeWeek(w, day) {
    w.doneKm = r1(w.doneKm); w.doneMin = Math.round(w.doneMin);
    weeks.push(w);
    // برنامه بدون توجه به انجام‌نشده‌ها جلو می‌ره؟ (۶ هفته‌ی پشت‌سرهم زیر ۶۰٪، ولی حجم برنامه بالا رفته)
    var last6 = weeks.slice(-6);
    if (last6.length === 6 && !walk && !(H.rebaseShown != null && day - H.rebaseShown <= 42) && last6.every(function (x) { return x.plannedKm > 5 && x.doneKm < x.plannedKm * 0.6; }) && last6[5].plannedKm > last6[0].plannedKm * 1.1)
      F('major', 'plan-ignores-missed', day, 'شش هفته زیر ۶۰٪ برنامه، ولی حجم برنامه همچنان بالا رفته', { planned: last6.map(function (x) { return x.plannedKm; }), done: last6.map(function (x) { return x.doneKm; }) });
    // آمادگی پنهان
    if (w.runs === 0) { H.offDays += 7; H.vdot = Math.max(H.v0 - 6, H.vStop * C.detrainFactor(Math.min(H.offDays, 70), false)); }
    else {
      if (H.offDays > 0) { H.offDays = 0; }
      var stim = Math.min(1.5, w.doneMin / 150);
      H.vdot = Math.min(H.v0 + H.room, H.vdot + 0.16 * stim * Math.max(0, 1 - (H.vdot - H.v0) / H.room));
      H.vStop = H.vdot;
    }
  }
  // برگشت بعد از وقفه: هفته‌ی اول برگشت با قبل از وقفه مقایسه می‌شه
  function gapReturn(day, d) {
    var gapDays = H.offStreak, startW = Math.max(0, weeks.length - Math.ceil(gapDays / 7) - 4), before = weeks.slice(startW, startW + 4);
    var doneBefore = before.length ? before.reduce(function (a, w) { return a + w.doneKm; }, 0) / before.length : 0;
    var plannedNow = curWeek ? curWeek.plannedKm : 0;
    events.push({ day: day, kind: 'return', text: 'برگشت بعد از ' + gapDays + ' روز؛ برنامه‌ی این هفته ' + plannedNow + ' کیلومتر، میانگین قبل از وقفه ' + r1(doneBefore) });
    if (!walk && plannedNow > 8 && plannedNow > Math.max(doneBefore, 1) * 1.1)
      F(gapDays >= 28 ? 'major' : 'minor', 'gap-return-' + (gapDays >= 28 ? 'long' : 'short'), day,
        'بعد از ' + gapDays + ' روز وقفه، حجم هفته‌ی برگشت بیشتر از قبل از وقفه‌ست', { gapDays: gapDays, plannedKm: plannedNow, doneBefore: r1(doneBefore), vdotHidden: r1(H.vdot) });
    if (gapDays >= 28) addChurn(day, persona.traits.temperament === 'sensitive' ? 3 : 1, 'hardReturn');
  }
  // بعد از تایم‌تست: پیس‌ها از روز بعد از همین تست میان، پیشنهاد سطح
  function testFollow(day, d, k, km, sec) {
    var fit = C.currentFitness(p);
    if (!fit || fit.entry.date !== k) F('major', 'pace-after-test', day, 'بعد از تایم‌تست، آمادگی فعلی از تست تازه نیست', { test: k, used: fit && fit.entry && fit.entry.date, kind: fit && fit.entry && fit.entry.kind });
    var sg = C.fitnessLevelSuggestion(p);
    if (sg) {
      var hiddenLvl = C.levelFromVdot(H.vdot);
      var acc = sg.up ? T.accept : T.accept * 0.5;
      events.push({ day: day, kind: 'level', text: 'پیشنهاد سطح ' + sg.from + ' ← ' + sg.to + (rnd() < acc ? ' (قبول)' : ' (رد)') });
      if (events[events.length - 1].text.indexOf('قبول') >= 0) {
        C.applyFitnessLevel(p, d);   // همون تابعی که دکمه‌ی «قبول سطح» در اپ صدا می‌زنه
        var lv = C.assessLevel(p).level;
        if (lv !== sg.to) F('major', 'level-apply', day, 'بعد از قبول پیشنهاد سطح، سطح برنامه با پیشنهاد فرق داره', { suggested: sg.to, got: lv });
        levelLog.push({ day: day, why: 'level', from: sg.from, to: lv });
        if (Math.abs(lv - hiddenLvl) >= 2) F('minor', 'level-vs-hidden', day, 'سطح تازه با آمادگی پنهان دو سطح یا بیشتر فاصله داره', { level: lv, hidden: hiddenLvl });
      }
      var flips = levelLog.filter(function (x) { return day - x.day < 60; });
      if (flips.length >= 2 && (flips[0].to - flips[0].from) * (flips[flips.length - 1].to - flips[flips.length - 1].from) < 0) {
        F('major', 'level-flipflop', day, 'سطح در کمتر از ۶۰ روز یک بار بالا و یک بار پایین رفت', { log: flips });
        if (persona.traits.temperament === 'obsessive') addChurn(day, 3, 'inconsistent');
      }
    }
  }
  // روز مسابقه‌ی اصلی: نتیجه ثبت می‌شه (app.js فرم نتیجه‌ی مسابقه)
  function raceDay(day, d, k, plan) {
    var gi = C.goalInfo(p), main = gi.date === k;
    var side = main ? null : C.otherRaces(p).filter(function (x) { return x.key === k; })[0];
    var km = main ? gi.km : side ? side.km : plan.km;
    var std = !(main && gi.category === 'ultra') && km <= 42.2;
    var sec = Math.round(racePred(km) * (1 + rnd.normal(0, 0.02)) * (std ? 1 : 1.6));
    if (std) p.fitnessTests = (p.fitnessTests || []).concat([{ date: k, distanceKm: km, timeSec: sec, kind: 'race' }]);
    events.push({ day: day, kind: 'race', text: (main ? 'مسابقه‌ی اصلی ' + C.goalLabel(gi) : 'مسابقه‌ی فرعی ' + km + ' کیلومتر') + ': ' + C.formatDuration(sec) });
    if (main && gi.targetSec && sec > gi.targetSec * 1.05) addChurn(day, persona.traits.temperament === 'competitive' ? 4 : 1, 'missedTarget');
  }
  // ثبت درد (app.js readPain + savePain)
  function logPain(k, d) {
    if (!state.healthConsent) state.healthConsent = { at: clock.iso() };
    var when = H.pain >= 6 ? ['during', 'after', 'rest'] : H.pain >= 4 ? ['during', 'after'] : ['after'];
    var entry = { area: H.painArea, where: '', level: H.pain, when: when, flags: H.pain >= 8 ? ['limp'] : [], at: clock.iso() };
    state.pains[k] = entry;
    var ip = C.injuryPhase(p, d);
    if (ip && (ip.phase === 'return' || ip.phase === 'ramp') && C.painTier(entry) !== 'none') {
      var sb = ip.inj.setbacks = ip.inj.setbacks || [], wsk = C.dateKey(C.weekStart(d));
      if (!sb.some(function (x) { return C.dateKey(C.weekStart(C.parseDate(x))) === wsk; })) sb.push(k);
    }
  }

  findList.sort(function (a, b) { return SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || a.day - b.day; });
  return {
    persona: { id: persona.id, title: persona.title, focus: persona.focus, traits: persona.traits, seed: persona.seed, startDate: prep.profile.startDate },
    days: days, weeks: weeks, events: events, findings: findList, churn: churnPts, churnTotal: Object.keys(H.churnTotal).reduce(function (o, k) { o[k] = r1(H.churnTotal[k]); return o; }, {}), snaps: snaps, perf: perf,
    end: { level: C.assessLevel(p).level, vdotHidden: r1(H.vdot), fitness: (function () { var f = C.currentFitness(p); return f ? r1(f.vdot) : null; })(),
      tests: (p.fitnessTests || []).length, injuries: (p.injuries || []).length, pains: Object.keys(state.pains).length,
      done: Object.keys(state.done).length, checkins: Object.keys(state.checkins).length, starts: H.realStarts.length,
      cycleStats: p.cycle && p.cycle.enabled ? C.cycleStats(p, C.addDays(d0, DAYS - 1)) : null }
  };
}

module.exports = { simulate: simulate, TEMPER: TEMPER };
