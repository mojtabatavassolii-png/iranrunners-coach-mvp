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

test('ساختار پایگاه دانش: ۹۶ مدخل، هیچ مدخل منتظر تأیید، مدخل‌های منبع‌دار تأییدشده، پیوندها معتبر', function () {
  assert.strictEqual(KB.entries.length, 96);
  var ids = {};
  KB.entries.forEach(function (e) {
    assert.ok(!ids[e.id], 'شناسه‌ی تکراری ' + e.id); ids[e.id] = 1;
    assert.ok(e.q && e.topic && Array.isArray(e.phrases) && Array.isArray(e.keywords), e.id);
    assert.ok(['none', 'caution', 'urgent'].indexOf(e.safety) >= 0, e.id);
    if (e.sources) assert.ok((e.status === 'pending' ? e.draft : e.approved) && e.sources.length && e.sources.every(function (x) { return x.ref && ['secondary', 'abstract', 'memory'].indexOf(x.verified) >= 0; }), 'منبع ' + e.id);
    if (e.status === 'pending') { assert.strictEqual(e.answer, '', e.id); return; }
    assert.strictEqual(e.status, 'ok', e.id);
    assert.ok(e.answer && e.source, 'پاسخ و منبع ' + e.id);
    [].concat(e.links || [], e.linksWalk || []).forEach(function (l) {
      if (l.learn) assert.ok(LEARN.articles[l.learn], 'مطلب ' + l.learn);
      if (l.guide) assert.ok(FA.guide.sections[l.guide], 'راهنما ' + l.guide);
      if (l.page) assert.ok(/^#[a-z]+$/.test(l.page) && l.label, 'صفحه ' + l.page);
    });
  });
  assert.strictEqual(KB.entries.filter(function (e) { return e.status === 'pending'; }).length, 0);
  assert.strictEqual(KB.entries.filter(function (e) { return e.topic === 'تغذیه‌ی ورزشی' && e.status === 'ok' && e.sources; }).length, 9);
});

test('هر مدخل با عنوان خودش پیدا می‌شه (بدون جواب نادرست)', function () {
  KB.entries.forEach(function (e) {
    var r = E.ask(idx, e.q, { cycle: true });
    if (r.kind === 'urgent') return; // عنوان‌هایی که خودشون نشونه‌ی جدی دارن
    // گزارش درد: اول گفت‌وگوی معاینه
    if (r.kind === 'intake') { assert.ok(['pain-general', 'shin-pain', 'knee-front', 'knee-outer', 'achilles', 'heel-pain'].indexOf(e.id) >= 0, e.id + ' → intake'); return; }
    var hit = r.id === e.id || (r.suggestions || []).some(function (s) { return s.id === e.id; }) || (e.safety !== 'none' && r.id === KB.painEntry);
    assert.ok(hit, e.id + ' → ' + r.kind + ' ' + (r.id || ''));
  });
});

test('نشونه‌ی جدی همیشه قبل از جست‌وجو: هشدار ثابت و پیوند ثبت درد', function () {
  ['ساقم درد میکنه و ورم کرده', 'زانوم تو استراحت هم درد داره', 'حین دویدن درد قفسه سینه داشتم', 'دیگه نمیتونم راه برم', 'درد شدید پاشنه', 'آشیلم تق صدا داد', 'نمیتونم رو پنجه وایسم', 'فکر کنم گرمازدگی گرفتم', 'تو گرما دویدم الان گیجم', 'باردارم بعد دویدن خونریزی کردم', 'بچه تکون نمیخوره'].forEach(function (q) {
    var r = E.ask(idx, q, CTX);
    assert.strictEqual(r.kind, 'urgent', q);
    assert.ok(/متوقف کن/.test(r.answer) && /پزشک/.test(r.answer), q);
    assert.strictEqual(r.links[0].page, '#health');
  });
});

test('سؤال درد هیچ‌وقت به «پاسخ تأییدشده ندارم» نمی‌رسه', function () {
  var kb2 = JSON.parse(JSON.stringify(KB));
  kb2.entries.forEach(function (e) { if (e.safety !== 'none' && e.id !== KB.painEntry && e.id !== 'red-flags') e.status = 'pending'; });
  var i2 = E.createIndex(kb2);
  ['ساقم درد میکنه', 'آشیلم درد داره', 'کف پام صبحا درد میکنه', 'جلوی زانوم موقع پله درد میکنه'].forEach(function (q) {
    var r = E.ask(i2, q, {});
    assert.ok(r.kind === 'answer' || r.kind === 'urgent' || r.kind === 'intake', q + ' → ' + r.kind);
    // پایان گفت‌وگوی درد هم هیچ‌وقت «منتظر تأیید» نیست
    if (r.kind === 'intake') assert.strictEqual(E.intakeSkip(i2, r.state, {}).kind, 'answer', q);
  });
});

test('هشدار ایمنی بی‌دلیل نیست: «کفشم پاره شد» و «ساعتم صدا داد»', function () {
  assert.notStrictEqual(E.ask(idx, 'کفشم پاره شد', {}).kind, 'urgent');
  assert.notStrictEqual(E.ask(idx, 'ساعتم صدا داد', {}).kind, 'urgent');
  assert.notStrictEqual(E.ask(idx, 'تو گرما چطور بدوم', {}).kind, 'urgent');
  assert.notStrictEqual(E.ask(idx, 'انقباض عضله ساق دارم', {}).kind, 'urgent');
  assert.notStrictEqual(E.ask(idx, 'تو بارداری میتونم بدوم', {}).kind, 'urgent');
});

test('درد معمولی: فقط پاسخ محتاطانه، بدون تشخیص', function () {
  var r = E.ask(idx, 'ساق پام بعد دویدن درد میکنه', CTX);
  assert.strictEqual(r.kind, 'intake');
  r = E.intakeSkip(idx, r.state, CTX);
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

test('«به درد می‌خوره» درد نیست', function () {
  assert.notStrictEqual(E.ask(idx, 'دویدن در آب به درد می‌خوره؟', {}).id, 'pain-general');
  assert.strictEqual(E.ask(idx, 'زانوم درد میکنه', {}).kind, 'intake');
});

test('پیاده‌رو: نسخه‌ی پیاده‌روی پاسخ، «پیاده‌روی» به‌جای «دویدن»، سؤال هشدار مخصوص راه رفتن', function () {
  var W = { walk: true };
  var r = E.ask(idx, 'با پیاده روی لاغر میشم', W);
  assert.strictEqual(r.id, 'weight-loss'); assert.ok(/پیاده‌روی/.test(r.answer) && !/دویدن کمک/.test(r.answer));
  r = E.ask(idx, 'تو گرما پیاده روی کنم', W);
  assert.strictEqual(r.id, 'heat'); assert.ok(r.answer.indexOf('ثانیه در کیلومتر') < 0);
  // دونده همون متن دویدن رو می‌بینه
  assert.ok(/^دویدن کمک/.test(E.ask(idx, 'با دویدن لاغر میشم', {}).answer));
  // مدخل‌های خود پیاده‌روی سر جاشون
  assert.strictEqual(E.ask(idx, 'پیاده روی تند یعنی چی', W).id, 'walk-intensity');
  // گفت‌وگوی درد برای پیاده‌رو
  r = E.ask(idx, 'بعد پیاده روی ساقم درد میکنه', W);
  r = E.intake(idx, E.intake(idx, r.state, 'gradual', W).state, 'lt3', W);
  assert.ok(/شکل راه رفتنت/.test(r.answer), r.answer);
  r = E.intake(idx, r.state, 'no', W);
  assert.ok(/پیاده‌روی ورزشی رو متوقف کن/.test(r.answer));
  // هشدار فوری برای پیاده‌رو از «فعالیت» می‌گه، برای دونده همون متن قبلی (بازبینی ۱۲، UX-02)
  assert.strictEqual(E.ask(idx, 'زانوم ورم کرده و درد داره', W).answer, KB.texts.urgentWalk);
  assert.strictEqual(E.ask(idx, 'زانوم ورم کرده و درد داره', {}).answer, KB.texts.urgent);
  // هر نسخه‌ی پیاده‌روی، جمله‌ی «دویدن رو متوقف کن» نداره
  KB.entries.forEach(function (e) { if (e.answerWalk) assert.ok(!/(دویدن|بدو) رو (متوقف|قطع)/.test(e.answerWalk), e.id); });
});

test('گفت‌وگوی درد: اول کجا، چطور و چند وقته؛ بعد نشونه‌های هشدار؛ بعد پاسخ', function () {
  // پرسش اطلاعاتی گفت‌وگو نمی‌خواد
  assert.strictEqual(E.ask(idx, 'شین اسپلینت چیه', {}).id, 'shin-pain');
  assert.strictEqual(E.ask(idx, 'موقع دویدن پهلوم درد میگیره', {}).id, 'side-stitch');
  var r = E.ask(idx, 'درد دارم', {});
  assert.strictEqual(r.kind, 'intake'); assert.strictEqual(r.state.step, 'region');
  assert.ok(r.options.length >= 5);
  r = E.intake(idx, r.state, 'shin', {}); assert.strictEqual(r.state.step, 'onset');
  r = E.intake(idx, r.state, 'gradual', {}); assert.strictEqual(r.state.step, 'duration');
  r = E.intake(idx, r.state, 'gt14', {}); assert.strictEqual(r.state.step, 'flags');
  r = E.intake(idx, r.state, 'no', {});
  assert.strictEqual(r.kind, 'answer'); assert.strictEqual(r.id, 'shin-pain');
  assert.ok(/^خلاصه/.test(r.answer) && r.answer.indexOf(KB.intake.long) >= 0);
  assert.ok(r.links.some(function (l) { return l.page === '#checkin'; }));
  // چیزی که کاربر گفته دوباره پرسیده نمی‌شه
  r = E.ask(idx, 'آشیلم یه هفته ست درد داره', {});
  assert.deepStrictEqual([r.state.region, r.state.duration, r.state.step], ['achilles', 'lt14', 'onset']);
  r = E.ask(idx, 'زانوم درد میکنه', {}); assert.strictEqual(r.state.step, 'knee');
  r = E.intakeText(idx, r.state, 'بیرونش', {}); assert.strictEqual(r.state.region, 'knee-outer');
  r = E.intakeText(idx, r.state, 'از وقتی حجمو زیاد کردم', {}); assert.strictEqual(r.state.onset, 'load');
  r = E.intakeText(idx, r.state, 'سه هفته', {}); assert.strictEqual(r.state.duration, 'gt14');
  r = E.intakeText(idx, r.state, 'نه', {}); assert.strictEqual(r.id, 'knee-outer'); assert.ok(r.answer.indexOf(KB.intake.load) >= 0);
  // نشونه‌ی جدی در هر قدم: هشدار
  r = E.ask(idx, 'درد دارم', {});
  assert.strictEqual(E.intake(idx, E.intake(idx, r.state, 'heel', {}).state, 'sudden', {}).kind, 'urgent');
  var f = E.intake(idx, E.intake(idx, E.intake(idx, E.intake(idx, r.state, 'heel', {}).state, 'gradual', {}).state, 'lt3', {}).state, 'yes', {});
  assert.strictEqual(f.kind, 'urgent');
  assert.strictEqual(E.intakeText(idx, r.state, 'پام ورم کرده', {}).kind, 'urgent');
  assert.strictEqual(E.ask(idx, 'پام پیچ خورد درد میکنه', {}).kind, 'urgent');
  // جواب نامفهوم: null تا رابط سؤال تازه حسابش کنه
  assert.strictEqual(E.intakeText(idx, E.intake(idx, r.state, 'heel', {}).state, 'پیس ایزیم چنده', {}), null);
  // رد شدن: پاسخ با نشونه‌های هشدار
  var sk = E.intakeSkip(idx, r.state, {});
  assert.strictEqual(sk.id, 'pain-general'); assert.ok(sk.answer.indexOf(KB.intake.flagsNote) >= 0);
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
  // همه‌ی مدخل‌ها تأیید شدن؛ رفتار «منتظر تأیید» با یک مدخل ساختگی بررسی می‌شه
  var kb2 = JSON.parse(JSON.stringify(KB));
  kb2.entries.push({ id: 'tmp-pending', topic: 'آزمایشی', q: 'سؤال آزمایشی زومبا', phrases: ['زومبا'], keywords: ['زومبا'], answer: '', pendingText: KB.texts.pending, links: [], safety: 'none', status: 'pending' });
  var r = E.ask(E.createIndex(kb2), 'زومبا خوبه؟', CTX);
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

test('سلام و احوال‌پرسی: با اسم کوچک و جلسه‌ی امروز؛ ایمنی مقدم‌تر', function () {
  var r = E.ask(idx, 'سلام', { name: 'سارا', today: 'ایزی ران (۶ کیلومتر)' });
  assert.strictEqual(r.kind, 'small');
  assert.ok(/سارا/.test(r.answer) && /ایزی ران/.test(r.answer));
  assert.ok(r.suggestions.length >= 1);
  assert.strictEqual(E.ask(idx, 'مرسی', {}).small, 'thanks');
  assert.strictEqual(E.ask(idx, 'سلام خوبی', {}).small, 'how');
  assert.strictEqual(E.ask(idx, 'سلام، زانوم ورم کرده', {}).kind, 'urgent');
  // «فعلا» وسط سؤال، سؤال رو خراب نمی‌کنه
  assert.strictEqual(E.ask(idx, 'فعلا تیپر یعنی چی', {}).id, 'taper');
});

test('سلام همراه سؤال: سلام جدا از متن پاسخ (اسم در سؤال ذخیره‌شده نمی‌ره)', function () {
  var r = E.ask(idx, 'سلام پیس ایزیم چنده', { name: 'سارا', easyPace: CTX.easyPace });
  assert.strictEqual(r.id, 'easy-pace');
  assert.ok(/سارا/.test(r.greet));
  assert.ok(r.answer.indexOf('سارا') < 0);
});

test('بی‌جواب و خارج از حوزه: پیشنهاد به‌جای دست خالی', function () {
  var n = E.ask(idx, 'بهترین آهنگ برای دویدن چیه', {});
  assert.ok(n.kind === 'none' || n.kind === 'suggest');
  assert.ok(n.suggestions.length >= 1);
  var o = E.ask(idx, 'قیمت بلیت هواپیما', {});
  assert.strictEqual(o.kind, 'ood');
  assert.ok(o.suggestions.length >= 1);
  assert.strictEqual(E.ask(idx, 'سلام', { walk: true }).suggestions[0].id, 'daily-start');
});

test('قدم بعدی فقط به صفحه‌های واقعی اپ', function () {
  KB.entries.forEach(function (e) {
    [e.next, e.nextWalk].filter(Boolean).forEach(function (x) {
      assert.ok(x.text && (x.page ? /^#[a-z]+$/.test(x.page) && x.label : x.learn || x.guide), e.id);
    });
  });
  assert.ok(E.ask(idx, 'پیس ایزیم چنده', CTX).next);
});

test('مدخل‌های منتظر تأیید جواب نمی‌دن؛ تغذیه‌ی تأییدشده جواب می‌ده', function () {
  KB.entries.filter(function (e) { return e.status === 'pending'; }).forEach(function (e) { assert.strictEqual(E.byId(idx, e.id, {}).kind, 'pending', e.id); });
  var r = E.ask(idx, 'قبل مسابقه چی بخورم', {});
  assert.strictEqual(r.kind, 'answer');
  assert.strictEqual(r.id, 'race-food');
  assert.strictEqual(E.ask(idx, 'کمبود آهن دارم؟', {}).safety, 'caution');
});

test('آزمون مجموعه‌ی ۲: صفر نادرست، حداقل ۸۰٪ درست', function () {
  var res = EVAL.run(2);
  assert.strictEqual(res.counts.wrong, 0, JSON.stringify(res.rows.filter(function (r) { return r.verdict === 'wrong'; })));
  assert.ok(res.counts.correct / res.n >= 0.8);
});

console.log(passed + ' تست دستیار گذشت');
