// گزارش HTML شبیه‌ساز: خلاصه، ایرادها به ترتیب شدت (با دستور بازتولید)، فرضیه‌های ریزش، خط زمانی دو ساله‌ی هر شخصیت، بخش مرورگر.
// همه‌ی داده‌ها جعلی‌ان؛ گزارش در مخزن ذخیره نمی‌شه (کل مخزن روی GitHub Pages عمومیه).
'use strict';
var SEV = { critical: 'بحرانی', major: 'مهم', minor: 'جزئی', info: 'اطلاع' };
var ORDER = { critical: 0, major: 1, minor: 2, info: 3 };

// توضیح و پیشنهاد برای هر نوع ایراد (کد بدون پسوند)
var EXPLAIN = {
  'pain-hard': ['با درد ثبت‌شده جلسه‌ی سخت اومد. علت: جلسه‌ی سختی که کاربر به‌خاطر پریود از چند روز قبل به امروز جابه‌جا کرده، بعد از تطبیق درد روی جلسه‌ی امروز نوشته می‌شه و درد نادیده گرفته می‌شه.',
    'در effectiveSession ترتیب رو عوض کن: اول چرخه (جابه‌جایی و پیشنهادها)، بعد درد؛ درد همیشه حرف آخر رو بزنه.'],
  'vert-cap': ['ارتفاع هفته از سقف خود برنامه بیشتره (مثلاً ۲۵۰ با سقف ۲۱۰). استرایدهای سربالایی (۴۰ متر هر جلسه) بیرون از بودجه‌ی ارتفاع اضافه می‌شن. با سقف کمتری که نسخه‌ی ۱۲۱ برای هفته‌های سبک گذاشت، این فاصله دیده شد.',
    'استرایدهای سربالایی رو هم در بودجه‌ی هفته حساب کن و اگه جا نبود حذفشون کن.'],
  'cycle-ambiguous': ['یک ثبت جاافتاده همراه با تغییر طول چرخه؛ موتور نمی‌تونه از نامنظمی تشخیصش بده.', 'جای بحث نیست؛ فقط برای اطلاع.'],
  'level-apply': ['برای دونده‌ی برگشتی، وقفه‌ی قدیمی (مثلاً «۳ سال») در پروفایل می‌مونه و سطح همیشه از منطق برگشت میاد. تایم‌تست تازه و قبول پیشنهاد سطح اثری ندارن و پیشنهاد هر روز دوباره نشون داده می‌شه.',
    'با قبول سطح تازه (یا ثبت اولین تایم‌تست بعد از برگشت)، وقفه رو «همین الان می‌دوم» کن، یا در assessLevel وقتی رکورد تازه‌تر از تاریخ برگشت هست شاخه‌ی برگشت رو کنار بذار.'],
  'level-vs-hidden': ['نتیجه‌ی همون ایراد بالا: سطح برنامه دو سطح یا بیشتر پایین‌تر از آمادگی واقعی می‌مونه.', 'با رفع ایراد بالا حل می‌شه.'],
  'plan-ignores-missed': ['حجم هفتگی فقط از شماره‌ی هفته از شروع برنامه حساب می‌شه. وقتی کاربر هفته‌ها کمتر از نصف برنامه رو انجام می‌ده، برنامه همچنان بالا می‌ره.',
    'اگه ۲ تا ۳ هفته‌ی پشت‌سرهم زیر ۶۰٪ انجام شد، یک کارت «برنامه رو با حجم فعلیت تنظیم کنم؟» نشون بده (مثل applyFitnessLevel، با حجم انجام‌شده‌ی واقعی).'],
  'goal-ignores-missed': ['مسیر هدف (goalPath) هم فقط از هفته‌های گذشته حساب می‌شه. ماه‌ها تمرین‌نکردن قبل از مسابقه، تاریخ آمادگی رو عقب نمی‌بره.',
    'هفته‌های زیر ۵۰٪ رو در «هفته‌های باقی‌مونده» حساب کن، یا حداقل یک هشدار «آمادگی‌ت عقب افتاده» بده.'],
  'goal-vs-injury': ['صفحه‌ی سلامت می‌گه رسیدن به مسابقه با این آسیب «بعیده»، ولی مسیر هدف همون روزها «ok» نشون می‌ده. کاربر وسواسی دو عدد متناقض می‌بینه.',
    'در goalPath اگه injuryImpact وضعیت دیگه‌ای داره، همون وضعیت و تاریخ رو نشون بده.'],
  'walk-level-adherence': ['پیشنهاد سطح بالاتر پیاده‌روی فقط از شماره‌ی هفته‌ی برنامه میاد، نه از جلسه‌های انجام‌شده. کاربر بی‌انگیزه‌ای که نصف برنامه رو انجام داده دو سطح بالا می‌ره.',
    'در walkLevelSuggestion شرط بذار: حداقل ۷۰٪ دقیقه‌های دو هفته‌ی آخر انجام شده باشه.'],
  'cycle-false-irregular-v121': ['', ''],
  'cycle-false-irregular': ['(بعد از رفع نسخه‌ی ۱۲۰) هنوز وقتی طول چرخه‌ی خود کاربر بین ۲۲ تا ۳۰ روز تغییر می‌کنه و یک ثبت جا افتاده، فاصله‌ی دو برابر گاهی بیش از ۲۰٪ با «طول معمول» فرق داره و هشدار نامنظمی میاد. قبل از رفع: اگه کاربر یک بار شروع پریود رو ثبت نکنه، فاصله‌ی دو برابر (مثلاً ۵۷ روز) ثبت می‌شه و هشدار «خارج از محدوده» یا «نامنظم» (با توصیه‌ی مشورت با پزشک) تا ۶ چرخه می‌مونه، با اینکه چرخه منظمه.',
    'معیار رو به بازه‌ی چرخه‌های عادی خود کاربر (۱۲ فاصله‌ی اخیر، ±۳ روز) تغییر بده، نه فقط درصدی از میانه.'],
  'vert-growth': ['ارتفاع هفتگی بیشتر از ۱۰٪ بالا رفت. نسخه‌ی ۱۲۱ اجازه می‌ده ارتفاع تا «ارتفاع فعلی» که دونده موقع ثبت‌نام گفته برگرده؛ ولی بعد از ماه‌ها برنامه‌ی کمتر (مثلاً ۵۰۰ متر)، اون عدد قدیمیه و ارتفاع یک‌باره به ۱۲۳۰ می‌رسه. یک مورد دیگه بعد از تغییر هدف بود، چون تاریخچه‌ی برنامه ذخیره نمی‌شه و هفته‌های قبل با هدف تازه دوباره حساب می‌شن.',
    'ارتفاع فعلی دونده فقط در ۴ هفته‌ی اول مبنا باشه؛ بعد فقط ارتفاع واقعی برنامه‌ی هفته‌های قبل.'],
  'level-flipflop': ['سطح بدون حاشیه از یک تایم‌تست میاد. اختلاف طبیعی ۲ تا ۳٪ بین دو تست (هوا، خستگی) سطح رو بالا و چند هفته بعد پایین می‌بره، و هر بار برنامه از اول شروع می‌شه.',
    'برای پایین‌آوردن سطح دو تست پشت‌سرهم یا حاشیه‌ی حدود ۱ VDOT لازم باشه.'],
  'repeat-level': ['پیشنهاد تغییر سطح فقط دکمه‌ی «قبول» داره. کاربری که نمی‌خواد، همون پیشنهاد رو ماه‌ها هر روز می‌بینه.',
    'دکمه‌ی «فعلاً نه» که پیشنهاد رو تا تایم‌تست بعدی پنهان کنه.'],
  'repeat': ['یادآوری تایم‌تست برای کاربری که تست نمی‌ده هر روز تکرار می‌شه.', 'بعد از چند بار دیدن، کم‌رنگ‌تر یا هفتگی نشون بده.'],
  'vol-week': ['رشد حجم برنامه‌ی هفتگی بیشتر از ۱۵٪ نسبت به بیشترین حجم ۳ هفته‌ی قبل و بالاتر از حجم ۸ هفته‌ی اخیر. همه‌ی موارد بعد از مسابقه‌ان: شماره‌ی هفته‌ی برنامه در تیپر و مسابقه جلو می‌ره، پس برگشت بعد از مسابقه کمی بالاتر از حجم قبل از مسابقه تموم می‌شه (در حجم‌های کم حدود ۳ کیلومتر).',
    'هدف برگشت بعد از مسابقه، حجم قبل از تیپر باشه؛ رشد تازه از هفته‌ی بعدش.'],
  'vol-2week': ['رشد حجم دوهفته‌ای بیشتر از ۳۰٪.', ''],
  'vol-week-return': ['در هفته‌های برگشت بعد از مسابقه، حجم برنامه هفته‌ای ۲۰ تا ۳۰٪ بالا می‌ره تا به حجم قبل برسه؛ چون شماره‌ی هفته‌ی برنامه در تیپر و مسابقه جلو می‌ره، گاهی کمی (در حجم‌های کم حدود ۳ کیلومتر) بالاتر از حجم قبل از مسابقه تموم می‌شه.', 'هدف برگشت بعد از مسابقه، حجم قبل از تیپر باشه؛ رشد تازه از هفته‌ی بعدش.'],
  'vol-2week-return': ['همون برگشت بعد از مسابقه، در بازه‌ی دوهفته‌ای.', ''],
  'vol-week-side': ['هفته‌ی مسابقه‌ی فرعی ۱۰ کیلومتری: مسابقه روی روز استراحت میاد و کل مسافتش به هفته اضافه می‌شه (+۳۳٪)؛ ایزی روز بعد کامل می‌مونه. طبق قاعده‌ی فعلی موتوره (فقط جلسه‌ی سخت عوض می‌شه).',
    'اگه بخوای، روز بعد از مسابقه‌ی فرعی ایزی رو کوتاه‌تر کن (مثلاً ۶۰٪).'],
  'gap-return': ['بعد از ۲ تا ۳ هفته وقفه، برنامه‌ی هفته‌ی برگشت از حجم واقعی قبل از وقفه بیشتره (برنامه وقفه رو نمی‌بینه).', 'همون پیشنهاد «برنامه رو با حجم فعلیت تنظیم کنم؟»'],
  'race-km-round': ['مسافت مسابقه گرد می‌شه (۴۲ و ۲۱) ولی بخش شدید دقیق می‌مونه (۴۲٫۱۹۵). فقط نمایشی.', 'km مسابقه رو هم دقیق نگه دار یا هر دو رو یک‌جور گرد کن.'],
  'long-share': ['در حجم‌های کم، لانگ‌ران بیش از نصف حجم هفته‌ست (مثلاً ۱۵ از ۲۸٫۵).', 'جای بحثه؛ با ۳ جلسه در هفته رایجه.'],
  'perf-analytics': ['محاسبه‌ی پیشرفت ۵۶ روزه بعد از دو سال داده حدود ۵۰ تا ۱۲۰ میلی‌ثانیه طول می‌کشه (روز اول کمتر از ۱). روی گوشی چند برابر می‌شه.', 'dayRecords هر بار از اولین روز داده حساب می‌شه؛ برای بازه‌ی کوتاه از چند هفته قبل از شروع بازه شروع کن.']
};
function explain(code) {
  var k = Object.keys(EXPLAIN).sort(function (a, b) { return b.length - a.length; }).filter(function (x) { return code === x || code.indexOf(x + '-') === 0 || code.indexOf(x + ':') === 0; })[0];
  return EXPLAIN[k] || ['', ''];
}
var CHURN = {
  hardAfterBadDay: ['جلسه‌ی سخت بعد از روز بد', 'زودرنج‌ها با جلسه‌ی سخت فردای خستگی یا خواب بد ناامید می‌شن.', 'اگه چک‌این دیروز خستگی ۴+ یا خواب بد داشت، امروز هم پیشنهاد سبک‌کردن بده (الان فقط چک‌این همون روز اثر داره).'],
  staleGoal: ['هدف گذشته', 'بعد از مسابقه، هدف قبلی می‌مونه و برنامه بی‌هدف ادامه پیدا می‌کنه.', 'چند روز بعد از مسابقه کارت «هدف بعدی چیه؟» با چند پیشنهاد.'],
  goalSlip: ['عقب‌رفتن تخمین هدف', 'رقابت‌جوها وقتی تاریخ آمادگی عقب می‌ره دلسرد می‌شن.', 'دلیل عقب‌رفتن رو کنار عدد بگو.'],
  repeat: ['پیام تکراری', 'بی‌حوصله‌ها با پیام یکسان روزهای پشت‌سرهم اپ رو کنار می‌ذارن.', 'پیام‌های تکراری رو کم‌کم پنهان کن.'],
  inconsistent: ['عددهای ناسازگار', 'وسواسی‌ها با تغییر سطح یا عددهای متناقض اعتمادشون رو از دست می‌دن.', ''],
  hardReturn: ['برگشت سخت بعد از وقفه', 'بعد از وقفه‌ی طولانی، برنامه همون حجم قبل رو می‌خواد.', ''],
  missedTarget: ['نرسیدن به زمان هدف', '', '']
};

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function fa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }

// خط زمانی دو ساله: میله‌ی انجام‌شده، خط برنامه، روزهای درد، رویدادها، نقطه‌های احتمال ریزش (هفته‌ی اول سمت راست)
function timeline(r) {
  var W = r.weeks, n = W.length;
  if (!n) return '';
  // برنامه‌ی زمانی (پیاده‌روی، دو-پیاده): نمودار با دقیقه
  var walk = r.persona.traits.walk || W.filter(function (w) { return w.plannedKm > 0; }).length < n / 2;
  var val = function (w, k) { return walk ? w[k === 'p' ? 'plannedMin' : 'doneMin'] : w[k === 'p' ? 'plannedKm' : 'doneKm']; };
  var max = Math.max(1, Math.max.apply(null, W.map(function (w) { return Math.max(val(w, 'p'), val(w, 'd')); })));
  var step = max > 200 ? 100 : max > 80 ? 40 : max > 40 ? 20 : max > 20 ? 10 : 5;
  max = Math.ceil(max / step) * step;
  var X0 = 44, X1 = 1000, Y0 = 18, Y1 = 178, bw = (X1 - X0) / n;
  var x = function (i) { return X1 - (i + 0.5) * bw; }, y = function (v) { return Y1 - (v / max) * (Y1 - Y0); };
  var g = '';
  for (var t = 0; t <= max; t += step) g += '<line x1="' + X0 + '" x2="' + X1 + '" y1="' + y(t) + '" y2="' + y(t) + '" class="grid"/><text x="' + (X0 - 6) + '" y="' + (y(t) + 4) + '" class="ax" text-anchor="end">' + fa(t) + '</text>';
  for (var m = 0; m < n; m += 13) g += '<text x="' + x(m) + '" y="' + (Y1 + 16) + '" class="ax" text-anchor="middle">' + fa('هفته ' + (m + 1)) + '</text>';
  var bars = W.map(function (w, i) { var v = val(w, 'd'); return v > 0 ? '<rect x="' + (x(i) - bw * 0.38) + '" y="' + y(v) + '" width="' + (bw * 0.76) + '" height="' + (Y1 - y(v)) + '" class="done"><title>' + esc(w.start + ' · انجام ' + v + ' · برنامه ' + val(w, 'p')) + '</title></rect>' : ''; }).join('');
  var line = '<polyline class="plan" points="' + W.map(function (w, i) { return x(i).toFixed(1) + ',' + y(val(w, 'p')).toFixed(1); }).join(' ') + '"/>';
  var pain = W.map(function (w, i) { return w.painDays ? '<rect x="' + (x(i) - bw / 2) + '" y="' + (Y1 + 22) + '" width="' + bw + '" height="6" class="pain" opacity="' + Math.min(1, 0.3 + w.painDays / 7) + '"><title>' + esc(w.start + ' · ' + w.painDays + ' روز درد') + '</title></rect>' : ''; }).join('');
  var wkOf = function (day) { return Math.min(n - 1, Math.floor(day / 7)); };
  var evs = r.events.filter(function (e) { return ['goal', 'injury', 'race', 'level', 'busy', 'unmotivated', 'sick', 'test'].indexOf(e.kind) >= 0; }).map(function (e) {
    var cls = e.kind === 'injury' ? 'ev-inj' : e.kind === 'race' ? 'ev-race' : e.kind === 'test' ? 'ev-test' : 'ev';
    var yy = e.kind === 'test' ? Y0 - 10 : Y0 - 4;
    return '<circle cx="' + x(wkOf(e.day)) + '" cy="' + yy + '" r="' + (e.kind === 'test' ? 2 : 3.2) + '" class="' + cls + '"><title>' + esc('روز ' + e.day + ': ' + e.text) + '</title></circle>';
  }).join('');
  var ch = r.churn.map(function (c) { return '<path d="M' + x(wkOf(c.day)) + ' ' + (Y1 + 34) + ' l5 9 h-10 z" class="churn"><title>' + esc('احتمال ریزش، روز ' + c.day + ': ' + (CHURN[c.why] || [c.why])[0]) + '</title></path>'; }).join('');
  return '<div class="tl"><svg viewBox="0 0 1010 228" role="img" aria-label="' + esc('خط زمانی دو ساله‌ی ' + r.persona.id + ': حجم برنامه و انجام‌شده در هر هفته') + '">' + g + bars + line + pain + evs + ch + '</svg></div>' +
    '<p class="legend"><span><span class="k k-done"></span>انجام‌شده</span><span><span class="k k-plan"></span>برنامه (' + (walk ? 'دقیقه' : 'کیلومتر') + ' در هفته)</span><span><span class="k k-pain"></span>درد</span><span><span class="k k-ev"></span>رویداد</span><span><span class="k k-race"></span>مسابقه</span><span><span class="k k-inj"></span>آسیب</span><span><span class="k k-churn"></span>احتمال ریزش</span></p>';
}

// الگوها: هر ایراد مهم در کدوم ویژگی‌ها بیشتر دیده می‌شه (نسبت به کل)، و ریزش بر اساس اخلاق
var AX_FA = { sex: { f: 'زن', m: 'مرد' }, age: { young: 'جوان (۱۸ تا ۳۴)', mid: 'میانسال (۳۵ تا ۴۹)', senior: '۵۰+' }, activity: { run: 'دویدن', walk: 'پیاده‌روی' },
  level: { zero: 'تازه‌کار کامل', low: 'سطح پایین', mid: 'سطح متوسط', high: 'سطح بالا' }, history: { new: 'تازه‌کار', regular: 'سابقه‌ی منظم', returning: 'برگشتی' },
  goal: { health: 'سلامتی', 5: '۵ کیلومتر', 10: '۱۰ کیلومتر', 21: 'نیمه‌ماراتن', 42: 'ماراتن', ultra: 'اولترا' },
  temperament: { disciplined: 'منظم', erratic: 'بی‌نظم', obsessive: 'وسواسی', sensitive: 'زودرنج', bored: 'بی‌حوصله', competitive: 'رقابت‌جو' },
  injury: { low: 'حساسیت کم به آسیب', high: 'حساسیت بالا به آسیب' },
  event: { none: 'بدون رویداد', travel: 'سفر', sick: 'بیماری', busy: 'شلوغی کاری', unmotivated: 'بی‌انگیزگی', goalChange: 'تغییر هدف', injury: 'آسیب', irregularCycle: 'چرخه‌ی نامنظم' },
  mind: { detail: 'جزءنگر', holistic: 'کل‌نگر' } };
function lifts(results, ids) {
  var n = results.length, k = ids.length, out = [];
  Object.keys(AX_FA).forEach(function (ax) {
    Object.keys(AX_FA[ax]).forEach(function (v) {
      var all = results.filter(function (r) { return r.persona.axes && r.persona.axes[ax] === v; }).length;
      var hit = results.filter(function (r) { return ids.indexOf(r.persona.id) >= 0 && r.persona.axes && r.persona.axes[ax] === v; }).length;
      if (k >= 4 && hit >= 3 && all && hit / k >= 0.5 && (hit / k) / (all / n) >= 1.5) out.push({ label: AX_FA[ax][v], hit: hit, of: k, lift: (hit / k) / (all / n) });
    });
  });
  return out.sort(function (a, b) { return b.lift - a.lift; }).slice(0, 4);
}
function patterns(results, G, meta) {
  var h = '<section><h2>الگوها</h2><p class="lead">برای هر ایراد مهم: ویژگی‌هایی که دست‌کم نصف شخصیت‌های گرفتار داشتن و دست‌کم ۱٫۵ برابر بیشتر از کل جمعیت بودن.' +
    (meta.coverage ? ' پوشش جفتی: ' + fa(meta.coverage.covered) + ' از ' + fa(meta.coverage.pairs) + ' جفت ویژگی ممکن.' : '') + '</p>';
  var rows = G.filter(function (g) { return g.sev !== 'minor'; }).map(function (g) {
    var ids = g.items.map(function (f) { return f.persona; }), L = lifts(results, ids);
    return '<tr><td>' + esc(g.items[0].msg) + '</td><td class="num">' + fa(ids.length) + '</td><td>' + (L.length ? L.map(function (x) { return esc(x.label) + ' (' + fa(x.hit) + ' از ' + fa(x.of) + ')'; }).join('، ') : '<span class="muted">' + (ids.length < 4 ? 'نمونه کمه' : 'پراکنده') + '</span>') + '</td></tr>';
  });
  h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ایراد</th><th>شخصیت</th><th>بیشتر در</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  var T = {};
  results.forEach(function (r) { var t = r.persona.axes && r.persona.axes.temperament; if (!t) return; T[t] = T[t] || { n: 0, pts: 0, who: 0, why: {} }; T[t].n++; T[t].pts += r.churn.length; if (r.churn.length) T[t].who++; r.churn.forEach(function (c) { T[t].why[c.why] = (T[t].why[c.why] || 0) + 1; }); });
  h += '<h3>احتمال ریزش بر اساس اخلاق</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>اخلاق</th><th>شخصیت</th><th>با دست‌کم یک نقطه‌ی ریزش</th><th>دلیل اصلی</th></tr></thead><tbody>' +
    Object.keys(T).sort(function (a, b) { return T[b].who / T[b].n - T[a].who / T[a].n; }).map(function (t) {
      var top = Object.keys(T[t].why).sort(function (a, b) { return T[t].why[b] - T[t].why[a]; })[0];
      return '<tr><td>' + esc(AX_FA.temperament[t]) + '</td><td class="num">' + fa(T[t].n) + '</td><td class="num">' + fa(T[t].who) + ' (' + fa(Math.round(T[t].who / T[t].n * 100)) + '٪)</td><td>' + esc(top ? (CHURN[top] || [top])[0] : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div></section>';
  return h;
}

function page(results, meta) {
  var all = [];
  results.forEach(function (r) { r.findings.forEach(function (f) { all.push(f); }); });
  var groups = {};
  all.forEach(function (f) {
    var base = f.code.replace(/^(repeat):.*/, '$1');
    var g = groups[base] || (groups[base] = { code: base, sev: f.sev, items: [] });
    if (ORDER[f.sev] < ORDER[g.sev]) g.sev = f.sev;
    g.items.push(f);
  });
  // ترتیب داخل هر شدت: اثر روی کاربر (اول باگ‌های قطعی، بعد طراحی)
  var RANK = ['level-apply', 'cycle-false-irregular', 'walk-level-adherence', 'goal-vs-injury', 'vert-growth', 'plan-ignores-missed', 'goal-ignores-missed', 'level-flipflop'];
  var rk = function (c) { var i = RANK.indexOf(c); return i < 0 ? 99 : i; };
  var G = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return ORDER[a.sev] - ORDER[b.sev] || rk(a.code) - rk(b.code) || b.items.length - a.items.length; });
  var cnt = { critical: 0, major: 0, minor: 0 };
  G.forEach(function (g) { cnt[g.sev] = (cnt[g.sev] || 0) + 1; });
  var browserIssues = results.reduce(function (s, r) { return s + (r.browser ? r.browser.issues.length : 0); }, 0);
  var browserPages = results.reduce(function (s, r) { return s + (r.browser ? r.browser.pages : 0); }, 0);

  var h = '<header class="top"><p class="eyebrow">شبیه‌ساز کاربران مجازی · فقط داده‌ی جعلی</p><h1>شبیه‌ساز گام</h1>' +
    '<p class="meta">' + fa(meta.personas) + ' شخصیت · ' + fa(meta.until) + ' روز (دو سال) · روی همون موتور اپ (js/logic.js) · اجرا ' + fa((meta.ms / 1000).toFixed(1)) + ' ثانیه · ' + esc(meta.generated.slice(0, 10)) + '</p>' +
    '<div class="tally"><div class="t t-critical"><b>' + fa(cnt.critical || 0) + '</b><span>نوع ایراد بحرانی</span></div><div class="t t-major"><b>' + fa(cnt.major || 0) + '</b><span>نوع ایراد مهم</span></div><div class="t t-minor"><b>' + fa(cnt.minor || 0) + '</b><span>نوع ایراد جزئی</span></div>' +
    '<div class="t"><b>' + (meta.browser ? fa(browserIssues) : '—') + '</b><span>ایراد در مرورگر' + (meta.browser ? ' از ' + fa(browserPages) + ' صفحه' : '') + '</span></div></div></header>';

  h += '<section><h2>ایرادها</h2><p class="lead">هر ردیف یک نوع ایراده، با شخصیت‌هایی که پیداش کردن. «بحرانی» یعنی خطر مستقیم برای کاربر (مثلاً جلسه‌ی سخت با درد ثبت‌شده)' + (cnt.critical ? '' : '؛ هیچ مورد بحرانی پیدا نشد') + '. هر ایراد با دستور کنارش دقیقاً تکرار می‌شه.</p>';
  G.forEach(function (g) {
    var ex = explain(g.code), f0 = g.items[0];
    h += '<article class="f f-' + g.sev + '"><div class="fh"><span class="pill p-' + g.sev + '">' + SEV[g.sev] + '</span><h3>' + esc(f0.msg) + '</h3><code class="code" dir="ltr">' + esc(g.code) + '</code></div>' +
      (ex[0] ? '<p>' + esc(ex[0]) + '</p>' : '') + (ex[1] ? '<p class="fix"><b>پیشنهاد:</b> ' + esc(ex[1]) + '</p>' : '') +
      '<details><summary>' + fa(g.items.length) + ' شخصیت · ' + fa(g.items.reduce(function (s, f) { return s + f.count; }, 0)) + ' بار</summary><ul class="occ">' +
      g.items.map(function (f) {
        return '<li><b>' + f.persona + '</b> روز ' + fa(f.day) + ' (' + f.date + ')' + (f.count > 1 ? ' · ' + fa(f.count) + ' بار' : '') +
          '<div class="cmd" dir="ltr"><code>node tests/sim/run.js --persona ' + f.persona + ' --until ' + (f.day + 1) + '</code></div>' +
          '<pre dir="ltr">' + esc(JSON.stringify(f.examples[0].data)) + '</pre></li>';
      }).join('') + '</ul></details></article>';
  });
  h += '</section>';

  var churnRows = [];
  results.forEach(function (r) { r.churn.forEach(function (c) { churnRows.push({ p: r.persona, c: c }); }); });
  var tot = {};
  results.forEach(function (r) { Object.keys(r.churnTotal || {}).forEach(function (k) { tot[k] = (tot[k] || 0) + r.churnTotal[k]; }); });
  h += '<section><h2>فرضیه‌های ریزش</h2><p class="lead">حدس، نه داده‌ی واقعی. هر شخصیت یک شاخص نارضایتی داره که با اتفاق‌ها بالا می‌ره و روزانه کم‌کم کم می‌شه؛ از ۱۰ که گذشت، «احتمال ریزش» ثبت می‌شه.</p>';
  if (churnRows.length) h += '<ul class="churn-list">' + churnRows.map(function (x) { var c = CHURN[x.c.why] || [x.c.why, '', '']; return '<li><b>' + x.p.id + '</b> روز ' + fa(x.c.day) + ': ' + esc(c[0]) + (c[1] ? '. ' + esc(c[1]) : '') + (c[2] ? '<p class="fix"><b>پیشنهاد:</b> ' + esc(c[2]) + '</p>' : '') + '</li>'; }).join('') + '</ul>';
  h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>عامل</th><th>جمع امتیاز در همه</th><th>پیشنهاد</th></tr></thead><tbody>' +
    Object.keys(tot).sort(function (a, b) { return tot[b] - tot[a]; }).map(function (k) { var c = CHURN[k] || [k, '', '']; return '<tr><td>' + esc(c[0]) + '</td><td class="num">' + fa(Math.round(tot[k])) + '</td><td>' + esc(c[2]) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';

  if (results.length > 20 && results[0].persona.axes) h += patterns(results, G, meta);
  var many = results.length > 20;
  h += '<section><h2>شخصیت‌ها، دو سال</h2>' + (many ? '<p class="lead">برای هر شخصیت روی ردیفش بزن تا خط زمانی و جزئیات باز بشه.</p>' : '');
  results.forEach(function (r) {
    var e = r.end, sev = r.findings.reduce(function (o, f) { o[f.sev] = (o[f.sev] || 0) + 1; return o; }, {});
    var tag = { disciplined: 'منظم', erratic: 'بی‌نظم', obsessive: 'وسواسی', sensitive: 'زودرنج', bored: 'بی‌حوصله', competitive: 'رقابت‌جو' }[r.persona.traits.temperament];
    var head = '<div class="ph"><h3><span class="pid">' + r.persona.id + '</span>' + esc(r.persona.title) + '</h3><p class="muted">آزمون: ' + esc(r.persona.focus) + ' · ' + tag + ' · ' + (r.persona.traits.mind === 'detail' ? 'جزءنگر' : 'کل‌نگر') +
      (many ? ' · ' + fa(sev.critical || 0) + ' بحرانی، ' + fa(sev.major || 0) + ' مهم، ' + fa(r.churn.length) + ' احتمال ریزش' : '') + '</p></div>';
    h += (many ? '<details class="persona"><summary>' + head + '</summary>' : '<article class="persona">' + head) +
      timeline(r) +
      '<dl class="facts"><div><dt>سطح آخر</dt><dd>' + fa(e.level) + '</dd></div><div><dt>آمادگی پنهان / تخمین اپ (VDOT)</dt><dd>' + fa(e.vdotHidden) + ' / ' + (e.fitness ? fa(e.fitness) : '—') + '</dd></div>' +
      '<div><dt>جلسه‌ی انجام‌شده</dt><dd>' + fa(e.done) + '</dd></div><div><dt>چک‌این</dt><dd>' + fa(e.checkins) + '</dd></div><div><dt>تایم‌تست و مسابقه</dt><dd>' + fa(e.tests) + '</dd></div><div><dt>روز با درد ثبت‌شده / آسیب</dt><dd>' + fa(e.pains) + ' / ' + fa(e.injuries) + '</dd></div>' +
      '<div><dt>ایراد</dt><dd>' + fa(sev.major || 0) + ' مهم · ' + fa(sev.minor || 0) + ' جزئی</dd></div>' +
      (r.browser ? '<div><dt>مرورگر (صفحه / ایراد)</dt><dd>' + fa(r.browser.pages) + ' / ' + fa(r.browser.issues.length) + '</dd></div>' : '') + '</dl>' +
      '<details><summary>رویدادها (' + fa(r.events.length) + ')</summary><ol class="evlist">' + r.events.map(function (x) { return '<li><span class="num">روز ' + fa(x.day) + '</span> ' + esc(x.text) + '</li>'; }).join('') + '</ol></details>' + (many ? '</details>' : '</article>');
  });
  h += '</section>';

  if (meta.browser) {
    h += '<section><h2>اپ واقعی در مرورگر</h2><p class="lead">هر ۳۰ روز، خود اپ با داده‌ی همون شخصیت و تاریخ همون روز باز شد (Chromium بی‌سر، عرض گوشی): صفحه‌های امروز، برنامه و پیشرفت. خطای صفحه، خطای کنسول و متن خراب بررسی شد. زمان‌ها روی سرور اندازه‌گیری شدن، نه گوشی.</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>شخصیت</th><th>صفحه</th><th>ایراد</th><th>امروز (ماه اول ← آخر)</th><th>برنامه</th><th>پیشرفت</th></tr></thead><tbody>' +
      results.map(function (r) {
        var b = r.browser, sp = function (v) { var s = b.speed.filter(function (x) { return x.view === v; })[0]; return s ? fa(s.first) + ' ← ' + fa(s.last) + ' ms' : '—'; };
        return '<tr><td>' + r.persona.id + '</td><td class="num">' + fa(b.pages) + '</td><td class="num">' + fa(b.issues.length) + '</td><td class="num">' + sp('home') + '</td><td class="num">' + sp('plan') + '</td><td class="num">' + sp('progress') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var bi = [];
    results.forEach(function (r) { r.browser.issues.forEach(function (i) { bi.push(Object.assign({ p: r.persona.id }, i)); }); });
    if (bi.length) h += '<ul class="occ">' + bi.slice(0, 40).map(function (i) { return '<li><b>' + i.p + '</b> روز ' + fa(i.day) + ' · ' + i.view + ' · ' + i.why + '<pre>' + esc(i.text) + '</pre></li>'; }).join('') + '</ul>';
    h += '</section>';
  }

  h += '<section><h2>چیزهایی که شبیه‌ساز نمی‌سنجه</h2><ul class="limits"><li>احساس، انگیزه و دلیل واقعی ترک. رفتار شخصیت‌ها حدس منه.</li>' +
    '<li>فیزیولوژی واقعی: آمادگی پنهان و احتمال درد مدل ساده‌ان. جایی که اپ و شبیه‌ساز فرض مشترک دارن، ایراد اون فرض دیده نمی‌شه.</li>' +
    '<li>ظاهر، خوانایی و لحن متن. فقط ایراد فنی متن (جای‌خالی، کلید خام، تکرار) سنجیده می‌شه.</li>' +
    '<li>اعلان، GPS، Health Connect و سرعت روی گوشی واقعی. بیومکانیک اصلاً اجرا نشد.</li></ul></section>';
  return h;
}

var CSS = [
  '/* لایه: یک ستون خواندنی؛ خلاصه بالا، جزئیات پایین. خنثی مایل به سبز-آبی؛ آبی = برنامه، نارنجی = انجام‌شده */',
  ':root{--bg:#f5f7f6;--surface:#ffffff;--fg:#1b2422;--muted:#5b6865;--line:#dce2e0;--plan:#1f5fa8;--done:#cf8130;--crit:#b3261e;--major:#ad5216;--minor:#5f6d22;--pain:#c2416b;--inj:#7d2bb8;',
  '--font:"Vazirmatn",Tahoma,sans-serif;--mono:ui-monospace,"SFMono-Regular",Menlo,monospace}',
  '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121816;--surface:#1a2220;--fg:#e6ecea;--muted:#9aa8a4;--line:#2c3734;--plan:#6aa6ef;--done:#e6a35c;--crit:#f2867e;--major:#f0a35e;--minor:#b9c56a;--pain:#ee7aa0;--inj:#c18af0;color-scheme:dark}}',
  ':root[data-theme="dark"]{--bg:#121816;--surface:#1a2220;--fg:#e6ecea;--muted:#9aa8a4;--line:#2c3734;--plan:#6aa6ef;--done:#e6a35c;--crit:#f2867e;--major:#f0a35e;--minor:#b9c56a;--pain:#ee7aa0;--inj:#c18af0;color-scheme:dark}',
  'body{background:var(--bg);color:var(--fg);font-family:var(--font);font-size:15px;line-height:1.75;margin:0}',
  'main{max-width:1040px;margin:0 auto;padding-block:24px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:40px}',
  'h1{font-size:2rem;font-weight:800;margin:0;line-height:1.3}h2{font-size:1.3rem;font-weight:800;margin:0;text-wrap:balance}h3{font-size:1rem;font-weight:700;margin:0;text-wrap:balance}',
  '.eyebrow{color:var(--muted);font-size:.8rem;margin:0}.meta{margin:4px 0 0}.meta,.lead,.muted{color:var(--muted)}.lead{max-width:68ch;margin:0}',
  '.tally{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:14px}',
  '.t{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 14px;display:flex;flex-direction:column}.t b{font-size:1.7rem;font-weight:800;font-variant-numeric:tabular-nums}.t span{color:var(--muted);font-size:.85rem}',
  '.t-critical b{color:var(--crit)}.t-major b{color:var(--major)}.t-minor b{color:var(--minor)}',
  'section{display:grid;gap:12px;min-width:0}',
  '.f{background:var(--surface);border:1px solid var(--line);border-inline-start:4px solid var(--minor);border-radius:8px;padding:14px 16px;min-width:0}.f-major{border-inline-start-color:var(--major)}.f-critical{border-inline-start-color:var(--crit)}',
  '.f p{margin:8px 0 0;max-width:75ch}.fh{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
  '.pill{font-size:.75rem;font-weight:700;padding:1px 9px;border-radius:99px;border:1px solid currentColor}.p-major{color:var(--major)}.p-minor{color:var(--minor)}.p-critical{color:var(--crit)}',
  '.code{font-family:var(--mono);font-size:.75rem;color:var(--muted);margin-inline-start:auto}',
  'details{margin-top:8px}summary{cursor:pointer;color:var(--plan);font-size:.9rem}summary:focus-visible{outline:2px solid var(--plan);outline-offset:2px}',
  '.occ{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:10px}.occ li{min-width:0}',
  '.cmd code,pre{font-family:var(--mono);font-size:.78rem}.cmd{margin:4px 0;text-align:left}.cmd code{background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:2px 8px;display:inline-block;max-width:100%;overflow-x:auto;white-space:nowrap}',
  'pre{background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;margin:4px 0 0;white-space:pre-wrap;word-break:break-word}',
  '.persona{border-top:1px solid var(--line);padding-top:18px;display:grid;gap:8px;min-width:0}.ph p{margin:2px 0 0;font-size:.88rem}',
  'details.persona{padding-top:10px;margin:0}details.persona>summary{list-style:none;color:inherit;font-size:inherit}details.persona>summary::-webkit-details-marker{display:none}details.persona>summary h3::before{content:"+ ";color:var(--plan)}details.persona[open]>summary h3::before{content:"− "}details.persona>*+*{margin-top:8px}',
  '.pid{font-family:var(--mono);font-size:.85rem;color:var(--plan);margin-inline-end:8px}',
  '.tl{overflow-x:auto}.tl svg{width:100%;min-width:620px;height:auto;display:block}',
  '.grid{stroke:var(--line);stroke-width:1}.ax{fill:var(--muted);font-size:11px;font-family:var(--font)}',
  '.done{fill:var(--done);opacity:.85}.plan{fill:none;stroke:var(--plan);stroke-width:2;stroke-linejoin:round}',
  '.pain{fill:var(--pain)}.ev{fill:var(--muted)}.ev-race{fill:var(--plan)}.ev-inj{fill:var(--inj)}.ev-test{fill:var(--muted);opacity:.6}.churn{fill:var(--crit)}',
  '.legend{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;font-size:.8rem;color:var(--muted);margin:0}',
  '.k{display:inline-block;width:12px;height:10px;margin-inline-end:4px;vertical-align:middle;border-radius:2px}.k-done{background:var(--done)}.k-plan{height:2px;background:var(--plan)}.k-pain{background:var(--pain)}.k-ev,.k-race,.k-inj{border-radius:50%;width:8px;height:8px}.k-ev{background:var(--muted)}.k-race{background:var(--plan)}.k-inj{background:var(--inj)}.k-churn{background:var(--crit);clip-path:polygon(50% 0,100% 100%,0 100%)}',
  '.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px 16px;margin:4px 0 0}.facts div{min-width:0}dt{font-size:.75rem;color:var(--muted)}dd{margin:0;font-weight:700;font-variant-numeric:tabular-nums}',
  '.evlist{margin:6px 0 0;padding:0;list-style:none;display:grid;gap:2px;font-size:.88rem}.num{font-variant-numeric:tabular-nums;color:var(--muted)}',
  '.tbl-wrap{overflow-x:auto}.tbl{border-collapse:collapse;width:100%;font-size:.9rem}.tbl th,.tbl td{text-align:start;padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}.tbl th{color:var(--muted);font-weight:600;font-size:.8rem}',
  '.churn-list{margin:0;padding-inline-start:18px;display:grid;gap:6px}.churn-list .fix{margin:2px 0 0;color:var(--muted)}',
  '.limits{margin:0;padding-inline-start:18px;max-width:75ch}'
].join('\n');

var HEAD = '<title>شبیه‌ساز گام</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap">\n';
function body(results, meta) { return '<main dir="rtl" lang="fa">' + page(results, meta) + '</main>\n'; }
module.exports = {
  // برای انتشار به‌صورت صفحه (اسکلت سند رو خود ناشر اضافه می‌کنه)
  fragment: function (results, meta) { return HEAD + '<style>' + CSS + '</style>\n' + body(results, meta); },
  // فایل مستقل (مثلاً فایل دانلودی اکشن)
  html: function (results, meta) {
    return '<!doctype html>\n<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      HEAD + '<style>' + CSS + '</style></head><body>' + body(results, meta) + '</body></html>\n';
  }
};
