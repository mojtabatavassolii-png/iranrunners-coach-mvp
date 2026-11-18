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
  ['قبل مسابقه چی بخورم', 'race-food'],
  ['میتونم بجای دو دوچرخه برم؟', 'xtrain'],
  ['تو ماراتن ژل بخورم یا نه', 'gels'],
  ['بهترین گوشی برای عکاسی چیه', 'ood'],
  ['دستور پخت قورمه سبزی', 'ood'],
  ['بهترین ساعت روز برای دویدن صبحه یا عصر؟', 'dontknow']
];

// مجموعه‌ی ۲ (نسخه‌ی ۱۴۵): سلام و احوال‌پرسی، معرفی گام، مدخل‌های تغذیه (منتظر تأیید)، سلام همراه سؤال، بی‌جواب
var QUESTIONS2 = [
  ['سلام', 'small:hello'],
  ['سلام خوبی؟', 'small:how'],
  ['درود صبح بخیر', 'small:hello'],
  ['مرسی دمت گرم', 'small:thanks'],
  ['خدافظ', 'small:bye'],
  ['تو کی هستی؟ رباتی؟', 'small:who'],
  ['سلام پیس ایزیم چنده', 'easy-pace'],
  ['گام چیه اصلا؟', 'about-gaam'],
  ['چرا باید از این اپ استفاده کنم', 'why-gaam'],
  ['اطلاعاتم کجا ذخیره میشه', 'privacy'],
  ['روزی چقد پروتئین بخورم', 'protein'],
  ['قهوه قبل مسابقه بخورم خوبه؟', 'caffeine'],
  ['بعد لانگ ران چی بخورم', 'recovery-food'],
  ['آزمایش فریتین بدم؟', 'iron'],
  ['ناشتا بدوم یا صبحانه بخورم', 'food-before'],
  ['سلام زانوم خیلی درد داره و ورم کرده', 'urgent'],
  ['خوبی؟ امروز بعد دویدن سرگیجه داشتم', 'urgent'],
  ['قیمت بلیت هواپیما به استانبول', 'ood'],
  ['بهترین آهنگ برای دویدن چیه', 'dontknow'],
  ['شنا کنم یا بدوم', 'xtrain']
];

// مجموعه‌ی ۳: کراس‌تریننگ و تمرین قدرتی (تأییدشده در نسخه‌ی ۱۴۶)
var QUESTIONS3 = [
  ['میتونم یه روز به جای دویدن دوچرخه برم؟', 'xtrain'],
  ['الپتیکال خوبه برای دونده', 'xtrain'],
  ['دویدن تو استخر فایده داره', 'pool-running'],
  ['دونده باید باشگاه بره؟', 'strength'],
  ['وزنه زدن سرعتمو بیشتر میکنه؟', 'strength'],
  ['چه حرکاتی برای پا بزنم که دویدنم بهتر شه', 'strength-how'],
  ['چند ست اسکوات بزنم', 'strength-how'],
  ['قبل لانگ ران پا بزنم یا نه', 'strength-timing|long-run'],
  ['طناب زدن برای دونده خوبه؟', 'plyometrics'],
  ['آسیب دیدم نمیتونم بدوم چه ورزشی کنم', 'xtrain-injury'],
  ['یوگا برای دونده خوبه؟', 'dontknow'],
  ['زانوم درد میکنه، دوچرخه برم؟', 'pain-general|xtrain-injury']
];

// مجموعه‌ی ۴: آسیب‌های رایج (تأییدشده در نسخه‌ی ۱۴۷). درد مبهم باید پاسخ عمومی درد بگیره؛ نشونه‌ی جدی، هشدار
var QUESTIONS4 = [
  ['شین اسپلینت چیه', 'shin-pain|pain-general'],
  ['جلوی ساق پام بعد دویدن درد میکنه', 'shin-pain|pain-general'],
  ['دور کشکک زانوم موقع پایین اومدن از پله درد میکنه', 'knee-front|pain-general'],
  ['زانوی دونده چیه', 'knee-front'],
  ['بیرون زانوم تو سرازیری درد میگیره', 'knee-outer|pain-general'],
  ['آشیلم صبحا خشکه و درد داره', 'achilles|pain-general'],
  ['خار پاشنه دارم میتونم بدوم؟', 'heel-pain'],
  ['صبح که از خواب پا میشم کف پام درد میکنه', 'heel-pain|pain-general'],
  ['استرس فرکچر چیه', 'bone-stress'],
  ['یه نقطه روی استخوان ساقم خیلی درد داره', 'urgent'],
  ['چرا دونده ها زیاد آسیب میبینن', 'injury-risk|ten-percent'],
  ['زانوم درد میکنه', 'pain-general|knee-front'],
  ['یوگا برای دونده خوبه؟', 'dontknow'],
  ['آشیلم یهو تق صدا داد و نمیتونم رو پنجه وایسم', 'urgent']
];

// مجموعه‌ی ۵: خواب، ریکاوری و گرما (تأییدشده در نسخه‌ی ۱۴۸)
var QUESTIONS5 = [
  ['شبی چند ساعت بخوابم', 'sleep'],
  ['دیشب ۵ ساعت خوابیدم امروز بدوم؟', 'sleep'],
  ['چرا باید روز استراحت داشته باشم', 'rest-days'],
  ['میتونم هر روز بدوم؟', 'rest-days|week-rules'],
  ['همیشه خسته ام و رکوردم بدتر شده', 'overtraining'],
  ['بیش تمرینی چیه', 'overtraining'],
  ['بعد لانگ ران ماساژ برم؟', 'recovery-methods'],
  ['حمام یخ بعد تمرین خوبه', 'recovery-methods'],
  ['تابستون تو گرما چطور بدوم', 'heat'],
  ['هوا خیلی گرمه پیسم کند شده', 'heat|rpe'],
  ['علائم گرمازدگی چیه', 'urgent|heat-illness'],
  ['تو گرما دویدم الان گیجم و سرم درد میکنه', 'urgent|pain-general'],
  ['قرص خواب بخورم؟', 'dontknow|ood']
];

// مجموعه‌ی ۶: بارداری و بعد از زایمان (تأییدشده در نسخه‌ی ۱۴۹)
var QUESTIONS6 = [
  ['حامله ام میتونم بدوم؟', 'pregnancy-running'],
  ['ورزش در بارداری خطر داره؟', 'pregnancy-running|pregnancy-warning'],
  ['ماه پنجم بارداریم چقدر بدوم', 'pregnancy-running'],
  ['تو بارداری کی باید ورزش رو قطع کنم', 'pregnancy-warning|pregnancy-running'],
  ['دویدم و الان لکه بینی دارم، باردارم', 'urgent'],
  ['حامله ام بعد دویدن درد زیر شکم دارم', 'urgent'],
  ['دو ماهه زایمان کردم کی بدوم', 'postpartum-running'],
  ['بعد سزارین دویدن رو شروع کنم؟', 'postpartum-running'],
  ['موقع دویدن نشت ادرار دارم', 'postpartum-running'],
  ['انقباض عضله ساق دارم', 'dontknow|pain-general|ood|strength']
];

// مجموعه‌ی ۷: کوفتگی، گرفتگی و درد پهلو (تأییدشده در نسخه‌ی ۱۵۱)
var QUESTIONS7 = [
  ['دو روز بعد تمرین پاهام کوفته ست چرا', 'doms'],
  ['کوفتگی عضلات بخاطر اسید لاکتیکه؟', 'doms'],
  ['از کجا بفهمم کوفتگیه یا آسیب دیدم', 'soreness-vs-injury'],
  ['این درد عضله طبیعیه یا آسیبه', 'soreness-vs-injury|pain-general'],
  ['با کوفتگی میتونم بدوم', 'run-while-sore'],
  ['ساق پام حین دویدن گرفت', 'cramp|pain-general'],
  ['گرفتگی عضله بخاطر کم آبیه؟', 'cramp|pain-general'],
  ['موقع دویدن پهلوم درد میگیره', 'side-stitch|pain-general'],
  ['سیخونک پهلو چیه', 'side-stitch'],
  ['ساعتم صدا داد', 'dontknow|ood'],
  ['کوفتگی دارم و یه نقطه روی استخوان پام خیلی درد داره', 'urgent']
];

// مجموعه‌ی ۸: ارتفاع و سرما (پیش از تنظیم نوشته شد)
var QUESTIONS8 = [
  ['رفتم شمشک دویدم نفسم کم میومد', 'altitude'],
  ['تو ارتفاع پیسم باید چقدر کند بشه', 'altitude'],
  ['تمرین در ارتفاع چه فایده ای داره', 'altitude'],
  ['میخوام برم دماوند چیکار کنم مریض نشم', 'altitude-sickness'],
  ['علائم ارتفاع زدگی', 'altitude-sickness'],
  ['تو کوه سرم درد گرفت و حالت تهوع دارم', 'urgent|altitude-sickness'],
  ['بالای کوه تعادلم بهم خورده و گیجم', 'urgent'],
  ['زمستون بیرون بدوم یا نه', 'cold'],
  ['تو سرما دویدم سرفه میکنم', 'cold'],
  ['رو برف و یخ چطور بدوم', 'cold'],
  ['دستام تو سرما بی حس و سفید شده', 'urgent'],
  ['بعد دویدن لرزم بند نمیاد', 'urgent'],
  ['سرد تر شدن پیس رو کند میکنه؟', 'cold|dontknow'],
  ['ارتفاع قدم چقدر باشه', 'dontknow|stride|cadence']
];

// مجموعه‌ی ۹: کاهش وزن
var QUESTIONS9 = [
  ['با دویدن لاغر میشم', 'weight-loss'],
  ['برای لاغری بدوم یا پیاده روی', 'weight-loss'],
  ['چقدر در هفته بدوم که وزن کم کنم', 'weight-loss'],
  ['دویدن برای چربی سوزی خوبه؟', 'weight-loss|fasted-run'],
  ['هر کیلومتر دویدن چند کالری میسوزونه', 'run-calories'],
  ['تند بدوم کالری بیشتری میسوزونم', 'run-calories'],
  ['دو ماهه میدوم ولی وزنم کم نشده', 'weight-stuck'],
  ['بعد دویدن خیلی گرسنه میشم', 'weight-stuck'],
  ['ناشتا بدوم بهتره', 'fasted-run|food-before'],
  ['صبح قبل صبحانه بدوم چربی بیشتری میسوزه', 'fasted-run'],
  ['رژیم گرفتم و زیاد تمرین میکنم پریودم قطع شده', 'red-s'],
  ['وزن من چقدر باید باشه', 'dontknow|ood|weight-loss'],
  ['قرص لاغری بخورم', 'dontknow|ood|weight-loss']
];

var INTAKE_OK = ['intake', 'pain-general', 'shin-pain', 'knee-front', 'knee-outer', 'achilles', 'heel-pain'];
function judge(exp, r) {
  // «الف|ب» با گزینه‌ی منتظر تأیید: هر کدوم درست باشه کافیه
  if (/\|/.test(exp) && /pending:/.test(exp) && !/^pending:[^|]*$/.test(exp)) {
    var opts = exp.split('|').map(function (o, k, all) { return o.indexOf('pending:') === 0 || k === 0 || all[k - 1].indexOf('pending:') !== 0 ? o : o; });
    if (opts.some(function (o) { return judge(o, r) === 'correct'; })) return 'correct';
    var dk0 = r.kind === 'none' || r.kind === 'suggest';
    return dk0 ? 'dontknow' : 'wrong';
  }
  if (exp.indexOf('small:') === 0) return r.kind === 'small' && r.small === exp.slice(6) ? 'correct' : (r.kind === 'none' || r.kind === 'suggest' ? 'dontknow' : 'wrong');
  var dk = r.kind === 'none' || r.kind === 'suggest';
  if (/\|/.test(exp) && /^(urgent|dontknow|ood)\|/.test(exp)) {
    return exp.split('|').some(function (o) { return judge(o, r) === 'correct'; }) ? 'correct' : ((r.kind === 'none' || r.kind === 'suggest') ? 'dontknow' : 'wrong');
  }
  if (exp === 'urgent') return r.kind === 'urgent' ? 'correct' : 'wrong';
  if (exp === 'ood') return r.kind === 'ood' ? 'correct' : (dk ? 'dontknow' : 'wrong');
  if (exp === 'dontknow') return dk || r.kind === 'ood' ? 'correct' : 'wrong';
  if (exp.indexOf('pending:') === 0) {
    var ids = exp.slice(8).split('|');
    return r.kind === 'pending' && ids.indexOf(r.id) >= 0 ? 'correct' : (dk ? 'dontknow' : 'wrong');
  }
  // گفت‌وگوی درد شروع شد: درسته وقتی پاسخ مورد انتظار یکی از مدخل‌های درد باشه
  if (r.kind === 'intake') return exp.split('|').some(function (x) { return INTAKE_OK.indexOf(x) >= 0; }) ? 'correct' : 'wrong';
  return r.kind === 'answer' && exp.split('|').indexOf(r.id) >= 0 ? 'correct' : (dk ? 'dontknow' : 'wrong');
}

function run(set) {
  var list = set === 9 ? QUESTIONS9 : set === 8 ? QUESTIONS8 : set === 7 ? QUESTIONS7 : set === 6 ? QUESTIONS6 : set === 5 ? QUESTIONS5 : set === 4 ? QUESTIONS4 : set === 3 ? QUESTIONS3 : set === 2 ? QUESTIONS2 : QUESTIONS;
  var c = { correct: 0, dontknow: 0, wrong: 0 }, rows = [];
  list.forEach(function (q) {
    var r = E.ask(idx, q[0], CTX), v = judge(q[1], r);
    c[v]++;
    rows.push({ q: q[0], exp: q[1], kind: r.kind, id: r.id || (r.suggestions || []).map(function (s) { return s.id; }).join(',') || '', score: r.score, verdict: v });
  });
  return { counts: c, rows: rows, n: list.length };
}

if (require.main === module) [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (set) {
  var res = run(set);
  console.log('— مجموعه‌ی ' + set + ' (' + res.n + ' سؤال)');
  var pct = function (k) { return Math.round(100 * res.counts[k] / res.n) + '%'; };
  res.rows.forEach(function (r) {
    if (process.argv.indexOf('--verbose') >= 0 || r.verdict !== 'correct')
      console.log((r.verdict === 'correct' ? '✓' : r.verdict === 'wrong' ? '✗' : '?') + ' ' + r.q + '  →  ' + r.kind + ' ' + r.id + ' (' + r.score + ')  [انتظار: ' + r.exp + ']');
  });
  console.log('درست: ' + res.counts.correct + ' (' + pct('correct') + ')  نمی‌دونم: ' + res.counts.dontknow + ' (' + pct('dontknow') + ')  نادرست: ' + res.counts.wrong + ' (' + pct('wrong') + ')');
  // آستانه‌ی محتاط: هیچ پاسخ نادرستی قبول نیست و همه‌ی نشونه‌های جدی باید هشدار بگیرن
  if (res.counts.wrong > 0) process.exitCode = 1;
});
module.exports = { run: run, QUESTIONS: QUESTIONS, QUESTIONS2: QUESTIONS2, QUESTIONS3: QUESTIONS3, QUESTIONS4: QUESTIONS4, QUESTIONS5: QUESTIONS5, QUESTIONS6: QUESTIONS6, QUESTIONS7: QUESTIONS7, QUESTIONS8: QUESTIONS8, QUESTIONS9: QUESTIONS9 };
