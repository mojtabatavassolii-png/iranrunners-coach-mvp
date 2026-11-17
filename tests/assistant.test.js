// تست‌های دستیار گام (آزمایشی): node tests/assistant.test.js
'use strict';
var assert = require('assert');
var fs = require('fs');
var E = require('../js/assistant/engine.js');
var KB = require('../js/assistant/kb-fa.js');
var LEARN = require('../js/i18n/learn-fa.js');
var FA = require('../js/i18n/fa.js');
var EVAL = require('./assistant-eval.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; }
}
var idx = E.createIndex(KB);
var CTX = { easyPace: '۶:۴۰ تا ۷:۲۰ دقیقه در کیلومتر', level: 'سطح ۳: تفریحی', today: 'ایزی ران (۶ کیلومتر)' };

test('نرمال‌سازی: ی و ک عربی، فاصله‌ی مجازی، اعداد، «می کنه»', function () {
  assert.strictEqual(E.normalize('كفش ي'), 'کفش ی');
  assert.strictEqual(E.normalize('درد می‌کنه'), 'درد میکنه');
  assert.strictEqual(E.normalize('درد می کنه'), 'درد میکنه');
  assert.strictEqual(E.normalize('۱۰٪ و ٣'), '10 و 3');
  assert.strictEqual(E.normalize('آسیبِ'), 'اسیب');
});

test('بُن‌سازی سبک', function () {
  assert.strictEqual(E.stem('ساقم'), 'ساق');
  assert.strictEqual(E.stem('زانوم'), 'زانو');
  assert.strictEqual(E.stem('کیلومترمو'), 'کیلومتر');
  assert.strictEqual(E.stem('کفش'), 'کفش');
});

test('ساختار پایگاه دانش: ۴۲ مدخل، ۶ منتظر تأیید، پیوندها معتبر', function () {
  assert.strictEqual(KB.entries.length, 42);
  var ids = {};
  KB.entries.forEach(function (e) {
    assert.ok(!ids[e.id], 'شناسه‌ی تکراری ' + e.id); ids[e.id] = 1;
    assert.ok(e.q && e.topic && Array.isArray(e.phrases) && Array.isArray(e.keywords), e.id);
    assert.ok(['none', 'caution', 'urgent'].indexOf(e.safety) >= 0, e.id);
    if (e.status === 'pending') { assert.strictEqual(e.answer, '', e.id); return; }
    assert.strictEqual(e.status, 'ok', e.id);
    assert.ok(e.answer && e.source, 'پاسخ و منبع ' + e.id);
    [].concat(e.links || [], e.linksWalk || []).forEach(function (l) {
      if (l.learn) assert.ok(LEARN.articles[l.learn], 'مطلب ' + l.learn);
      if (l.guide) assert.ok(FA.guide.sections[l.guide], 'راهنما ' + l.guide);
      if (l.page) assert.ok(/^#[a-z]+$/.test(l.page) && l.label, 'صفحه ' + l.page);
    });
  });
  assert.strictEqual(KB.entries.filter(function (e) { return e.status === 'pending'; }).length, 6);
});

test('هر مدخل با عنوان خودش پیدا می‌شه (بدون جواب نادرست)', function () {
  KB.entries.forEach(function (e) {
    var r = E.ask(idx, e.q, { cycle: true });
    if (r.kind === 'urgent') return; // عنوان‌هایی که خودشون نشونه‌ی جدی دارن
    var hit = r.id === e.id || (r.suggestions || []).some(function (s) { return s.id === e.id; }) || (e.safety !== 'none' && r.id === KB.painEntry);
    assert.ok(hit, e.id + ' → ' + r.kind + ' ' + (r.id || ''));
  });
});

test('نشونه‌ی جدی همیشه قبل از جست‌وجو: هشدار ثابت و پیوند ثبت درد', function () {
  ['ساقم درد میکنه و ورم کرده', 'زانوم تو استراحت هم درد داره', 'حین دویدن درد قفسه سینه داشتم', 'دیگه نمیتونم راه برم', 'درد شدید پاشنه'].forEach(function (q) {
    var r = E.ask(idx, q, CTX);
    assert.strictEqual(r.kind, 'urgent', q);
    assert.ok(/متوقف کن/.test(r.answer) && /پزشک/.test(r.answer), q);
    assert.strictEqual(r.links[0].page, '#health');
  });
});

test('درد معمولی: فقط پاسخ محتاطانه، بدون تشخیص', function () {
  var r = E.ask(idx, 'ساق پام بعد دویدن درد میکنه', CTX);
  assert.strictEqual(r.kind, 'answer');
  assert.strictEqual(r.safety, 'caution');
  assert.ok(/تشخیص/.test(r.answer) && /پزشک/.test(r.answer));
});

test('شخصی‌سازی فقط خواندنی: پیس ایزی و جایگزین عمومی', function () {
  var r = E.ask(idx, 'پیس ایزیم چنده', CTX);
  assert.strictEqual(r.id, 'easy-pace');
  assert.ok(r.answer.indexOf(CTX.easyPace) >= 0);
  var g = E.ask(idx, 'پیس ایزیم چنده', {});
  assert.strictEqual(g.id, 'easy-pace');
  assert.ok(g.answer.indexOf('{') < 0 && /تست حرف زدن/.test(g.answer));
});

test('پیاده‌روی: متن و پیوند مخصوص پیاده‌روی', function () {
  var r = E.ask(idx, 'روزانه باید چیکار کنم', { walk: true });
  assert.strictEqual(r.id, 'daily-start');
  assert.ok(/پیاده‌روی/.test(r.answer));
  assert.strictEqual(r.links[0].guide, 'walkStart');
});

test('چرخه‌ی قاعدگی فقط وقتی این بخش برای کاربر فعاله', function () {
  assert.strictEqual(E.ask(idx, 'پریود که هستم تمرین کنم؟', { cycle: true }).id, 'cycle');
  assert.notStrictEqual(E.ask(idx, 'پریود که هستم تمرین کنم؟', { cycle: false }).id, 'cycle');
});

test('مدخل منتظر تأیید جواب نمی‌ده', function () {
  var r = E.ask(idx, 'قبل مسابقه چی بخورم', CTX);
  assert.strictEqual(r.kind, 'pending');
  assert.strictEqual(r.answer, KB.texts.pending);
});

test('خارج از حوزه و پیشنهاد', function () {
  assert.strictEqual(E.ask(idx, 'بهترین گوشی برای عکاسی', CTX).kind, 'ood');
  assert.strictEqual(E.ask(idx, '   ', CTX).kind, 'empty');
  var r = E.byId(idx, 'taper', CTX);
  assert.strictEqual(r.kind, 'answer');
});

test('بدون درخواست شبکه و بدون تغییر داده‌ی تمرین', function () {
  ['js/assistant/engine.js', 'js/assistant/kb-fa.js', 'js/assistant/ui.js', 'js/assistant/config.js'].forEach(function (f) {
    var s = fs.readFileSync(f, 'utf8');
    assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.share|import\(/.test(s), f);
  });
  var ui = fs.readFileSync('js/assistant/ui.js', 'utf8');
  assert.ok(!/iranrunners-coach/.test(ui), 'ui.js کلید ذخیره‌ی اپ رو نمی‌خونه');
});

test('آزمون ۳۰ سؤالی: صفر نادرست، همه‌ی نشونه‌های جدی درست، حداقل ۸۰٪ درست', function () {
  var res = EVAL.run();
  assert.strictEqual(res.n, 30);
  assert.strictEqual(res.counts.wrong, 0, JSON.stringify(res.rows.filter(function (r) { return r.verdict === 'wrong'; })));
  res.rows.filter(function (r) { return r.exp === 'urgent'; }).forEach(function (r) { assert.strictEqual(r.verdict, 'correct', r.q); });
  assert.ok(res.counts.correct / res.n >= 0.8);
});

console.log(passed + ' تست دستیار گذشت');
