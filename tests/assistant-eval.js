// آزمون دستیار گام: ۳۰ سؤال محاوره‌ای (با غلط املایی)، نوشته‌شده برای این آزمایش.
// اجرا: node tests/assistant-eval.js   (--verbose برای جزئیات هر سؤال)
// برچسب: شناسه‌ی مدخل درست | 'urgent' (هشدار ایمنی) | 'ood' (خارج از حوزه) | 'dontknow' (نباید جواب بده)
// pending:<id> یعنی مدخل منتظر تأیید باید پیدا بشه و «پاسخ تأییدشده ندارم» بگه.
'use strict';
var E = require('../js/assistant/engine.js');
var KB = require('../js/assistant/kb-fa.js');
var idx = E.createIndex(KB);

var CTX = { easyPace: '۶:۴۰ تا ۷:۲۰ در هر کیلومتر', level: '۳ (دونده‌ی تفریحی)', today: 'ایزی ران ۶ کیلومتر', walk: false, cycle: false };

var QUESTIONS = [
  ['پیس ایزی رانم چنده؟', 'easy-pace'],
  ['ایزیرانو با چ سرعتی بدوم', 'easy-pace'],
  ['سطحم چرا ۳ شده', 'my-level'],
  ['وی دات یعنی چی', 'vdot'],
  ['فرق تمپو با اینتروال چیه', 'tempo-interval'],
  ['فارتلک مونا چجوریه', 'fartlek'],
  ['لانگ رانم چقد باید باشه', 'long-run'],
  ['امروز تمرینم چیه', 'today-session'],
  ['هفته ای چند درصد کیلومترمو زیاد کنم', 'ten-percent'],
  ['قبل دویدن کشش انجام بدم؟', 'stretching'],
  ['چطوری گرم کنم قبل اینتروال', 'warmup'],
  ['سه ماه ندویدم چطوری برگردم', 'returning'],
  ['ساقم بعد دویدن درد میکنه', 'pain-general'],
  ['زانوم ورم کرده و تو استراحتم درد داره', 'urgent'],
  ['موقع دویدن قفسه سینم درد گرفت', 'urgent'],
  ['دیشب پام اونقدر درد داشت که نمیتونستم راه برم', 'urgent'],
  ['تیپر یعنی چی', 'taper'],
  ['دو ماه دیگه ماراتن دارم ولی هفته ای ۲۰ کیلومتر میدوم، زوده؟', 'early-race'],
  ['بعد ماراتن کی دوباره بدوم', 'post-race'],
  ['مسابقه فرعی با اصلی چه فرقی داره', 'goals'],
  ['روزی ده هزار قدم لازمه؟', 'walk-steps'],
  ['پیاده روی تند یعنی چقدر سریع', 'walk-intensity'],
  ['چه کفشی واسه دویدن خوبه', 'shoes'],
  ['کی میتونم از پیاده روی برم سراغ دویدن', 'walk-to-run'],
  ['قبل مسابقه چی بخورم', 'pending:race-food|food-before'],
  ['میتونم بجای دو دوچرخه برم؟', 'pending:xtrain'],
  ['تو ماراتن ژل بخورم یا نه', 'pending:gels'],
  ['بهترین گوشی برای عکاسی چیه', 'ood'],
  ['دستور پخت قورمه سبزی', 'ood'],
  ['بهترین ساعت روز برای دویدن صبحه یا عصر؟', 'dontknow']
];

function judge(exp, r) {
  var dk = r.kind === 'none' || r.kind === 'suggest';
  if (exp === 'urgent') return r.kind === 'urgent' ? 'correct' : 'wrong';
  if (exp === 'ood') return r.kind === 'ood' ? 'correct' : (dk ? 'dontknow' : 'wrong');
  if (exp === 'dontknow') return dk || r.kind === 'ood' ? 'correct' : 'wrong';
  if (exp.indexOf('pending:') === 0) {
    var ids = exp.slice(8).split('|');
    return r.kind === 'pending' && ids.indexOf(r.id) >= 0 ? 'correct' : (dk ? 'dontknow' : 'wrong');
  }
  return r.kind === 'answer' && r.id === exp ? 'correct' : (dk ? 'dontknow' : 'wrong');
}

function run(verbose) {
  var c = { correct: 0, dontknow: 0, wrong: 0 }, rows = [];
  QUESTIONS.forEach(function (q) {
    var r = E.ask(idx, q[0], CTX), v = judge(q[1], r);
    c[v]++;
    rows.push({ q: q[0], exp: q[1], kind: r.kind, id: r.id || (r.suggestions || []).map(function (s) { return s.id; }).join(',') || '', score: r.score, verdict: v });
  });
  return { counts: c, rows: rows, n: QUESTIONS.length };
}

if (require.main === module) {
  var res = run();
  var pct = function (k) { return Math.round(100 * res.counts[k] / res.n) + '%'; };
  res.rows.forEach(function (r) {
    if (process.argv.indexOf('--verbose') >= 0 || r.verdict !== 'correct')
      console.log((r.verdict === 'correct' ? '✓' : r.verdict === 'wrong' ? '✗' : '?') + ' ' + r.q + '  →  ' + r.kind + ' ' + r.id + ' (' + r.score + ')  [انتظار: ' + r.exp + ']');
  });
  console.log('درست: ' + res.counts.correct + ' (' + pct('correct') + ')  نمی‌دونم: ' + res.counts.dontknow + ' (' + pct('dontknow') + ')  نادرست: ' + res.counts.wrong + ' (' + pct('wrong') + ')');
  // آستانه‌ی محتاط: هیچ پاسخ نادرستی قبول نیست و همه‌ی نشونه‌های جدی باید هشدار بگیرن
  if (res.counts.wrong > 0) process.exitCode = 1;
}
module.exports = { run: run, QUESTIONS: QUESTIONS };
