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

  function lookup(code, key) {
    var v = dicts[code];
    var parts = key.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  function fill(s, params) {
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] !== undefined && params[k] !== null ? String(params[k]) : m; });
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
    return s.replace(/(\d)\.(\d)/g, '$1٫$2').replace(/\d/g, function (d) { return FA_DIGITS[d]; });
  }

  // تاریخ: شمسی در فارسی، میلادی در انگلیسی
  var fmtCache = {};
  function date(d, short) {
    var k = lang + (short ? 's' : 'l');
    if (!(k in fmtCache)) {
      try {
        fmtCache[k] = new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-persian' : 'en-GB',
          short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' });
        if (lang === 'fa' && short) fmtCache[k] = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
      } catch (e) { fmtCache[k] = null; }
    }
    var f = fmtCache[k];
    return f ? f.format(d) : num(d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate());
  }

  var api = { register: register, t: t, has: has, getLang: getLang, setLang: setLang, savedLang: savedLang, dir: dir, num: num, date: date, LANGS: LANGS };

  if (typeof module !== 'undefined' && module.exports) {
    register('fa', require('./i18n/fa.js'));
    register('en', require('./i18n/en.js'));
    module.exports = api;
  } else {
    root.CoachI18n = api;
  }
})(this);
