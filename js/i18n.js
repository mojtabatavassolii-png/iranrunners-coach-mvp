/*
 * ترجمه‌ی مرکزی «مربی خودت باش» / Central translation layer.
 * همه‌ی متن‌های ثابت از js/i18n/fa.js و js/i18n/en.js خونده می‌شن.
 * t('path.to.key', { n: 5 }) → رشته با جای‌گذاری {n}؛ اگه کلید در زبان فعلی نبود، از فارسی.
 */
(function (root) {
  'use strict';
  var LANG_KEY = 'iranrunners-coach-lang';
  var LANGS = ['fa', 'en'];
  var dicts = {};
  var lang = 'fa';

  function register(code, dict) { dicts[code] = dict; }
  // افزودن یک بخش جدا (مثل مقاله‌های آموزش) به دیکشنری یک زبان
  function extend(code, key, part) { (dicts[code] = dicts[code] || {})[key] = part; }

  function lookup(code, key) {
    var v = dicts[code];
    var parts = key.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  // واحد مسافت: 'km' یا 'mi'. همه‌ی محاسبه‌ها به کیلومتره؛ تبدیل فقط موقع نمایش و ورودی.
  var KM_PER_MI = 1.609344;
  var units = 'km';
  function setUnits(u) { if (u === 'km' || u === 'mi') units = u; }
  function getUnits() { return units; }
  function round1(x) { return Math.round(x * 10) / 10; }
  // کیلومتر → عدد در واحد فعلی (مایل با یک رقم اعشار)
  function dist(km) {
    var n = Number(km);
    if (units === 'km' || !isFinite(n)) return n;
    return round1(n / KM_PER_MI);
  }
  // عدد در واحد فعلی (ورودی کاربر) → کیلومتر
  function toKm(x) { var n = Number(x); return units === 'km' ? n : n * KM_PER_MI; }
  // ثانیه در کیلومتر → ثانیه در واحد فعلی
  function pace(secPerKm) { return units === 'km' ? secPerKm : Math.round(secPerKm * KM_PER_MI); }

  // {x} جای‌گذاری ساده؛ {x:d} مسافت به کیلومتر که به واحد فعلی تبدیل می‌شه؛ {u} و {pu} برچسب واحد و پیس
  function fill(s, params) {
    if (s.indexOf('{') < 0) return s;
    return s.replace(/\{(\w+)(?::(d))?\}/g, function (m, k, typ) {
      if (k === 'u' && !(params && 'u' in params)) return t('units.' + units);
      if (k === 'uw' && !(params && 'uw' in params)) return t('units.word.' + units);
      if (k === 'pu' && !(params && 'pu' in params)) return t('units.pace.' + units);
      if (!params || params[k] === undefined || params[k] === null) return m;
      if (typ === 'd' && params[k] !== '' && isFinite(Number(params[k]))) return String(dist(params[k]));
      return String(params[k]);
    });
  }

  // مقدار خام (رشته، آرایه یا شیء)؛ برای جمع انگلیسی: { one: '...', other: '...' } با params.n
  function t(key, params) {
    var v = lookup(lang, key);
    if (v === undefined) v = lookup('fa', key);
    if (v === undefined) return key;
    if (v && typeof v === 'object' && !Array.isArray(v) && ('other' in v)) v = params && Number(params.n) === 1 && 'one' in v ? v.one : v.other;
    return typeof v === 'string' ? fill(v, params) : v;
  }
  function has(key) { return lookup(lang, key) !== undefined || lookup('fa', key) !== undefined; }

  function getLang() { return lang; }
  function setLang(code, persist) {
    if (LANGS.indexOf(code) < 0) return;
    lang = code;
    if (persist !== false) { try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* */ } }
  }
  function savedLang() {
    try { var v = localStorage.getItem(LANG_KEY); return LANGS.indexOf(v) >= 0 ? v : null; } catch (e) { return null; }
  }
  function dir() { return lang === 'fa' ? 'rtl' : 'ltr'; }

  // اعداد: رقم فارسی و ممیز «٫» فقط در زبان فارسی
  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function num(x) {
    var s = String(x);
    if (lang !== 'fa') return s;
    return s.replace(/(\d)\.(\d)/g, '$1٫$2').replace(/(\d),(\d)/g, '$1٬$2').replace(/\d/g, function (d) { return FA_DIGITS[d]; });
  }

  // تقویم نمایش: 'jalali' (شمسی) یا 'gregorian' (میلادی)، مستقل از زبان (پیش‌فرض رو app.js بر اساس زبان تعیین می‌کنه)
  var calendar = 'jalali';
  function setCalendar(c) { if (c === 'jalali' || c === 'gregorian') calendar = c; }
  function getCalendar() { return calendar; }
  var fmtCache = {};
  function fmt(kind) {
    var k = lang + calendar + kind;
    if (!(k in fmtCache)) {
      var loc = (lang === 'fa' ? 'fa-IR' : 'en-GB') + (calendar === 'jalali' ? '-u-ca-persian' : '-u-ca-gregory');
      var opt = kind === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' }
        : kind === 'month' ? { month: 'long', year: 'numeric' }
        : kind === 'mname' ? { month: 'long' } : kind === 'year' ? { year: 'numeric' }
        : { day: 'numeric', month: lang === 'fa' ? 'long' : 'short' };
      try { fmtCache[k] = new Intl.DateTimeFormat(loc, opt); } catch (e) { fmtCache[k] = null; }
    }
    return fmtCache[k];
  }
  // قالب‌بندی تاریخ با Intl (ICU)؛ ساختن ماه شمسی با jalaali-js در app.js
  function date(d, short) {
    var f = fmt(short ? 'short' : 'long');
    return f ? f.format(d) : num(d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate());
  }
  // عنوان ماه؛ در فارسی «مهر ۱۴۰۵» (ترتیب پیش‌فرض ICU برای شمسی «۱۴۰۵ مهر» است)
  function monthTitle(d) {
    if (lang === 'fa' && fmt('mname') && fmt('year')) return fmt('mname').format(d) + ' ' + fmt('year').format(d);
    var f = fmt('month');
    return f ? f.format(d) : num(d.getFullYear() + '-' + (d.getMonth() + 1));
  }

  var api = { register: register, extend: extend, t: t, has: has, getLang: getLang, setLang: setLang, savedLang: savedLang, dir: dir, num: num, date: date,
    monthTitle: monthTitle, setCalendar: setCalendar, getCalendar: getCalendar, LANGS: LANGS,
    setUnits: setUnits, getUnits: getUnits, dist: dist, toKm: toKm, pace: pace, KM_PER_MI: KM_PER_MI };

  if (typeof module !== 'undefined' && module.exports) {
    register('fa', require('./i18n/fa.js'));
    register('en', require('./i18n/en.js'));
    extend('fa', 'learn', require('./i18n/learn-fa.js'));
    extend('en', 'learn', require('./i18n/learn-en.js'));
    module.exports = api;
  } else {
    root.CoachI18n = api;
  }
})(this);
