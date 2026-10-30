// منبع آیکون‌های اپ نیتیو از نشان گام (public/assets/favicon.svg) با Playwright؛ بعد: npx @capacitor/assets generate
// اجرای: node scripts/make-icons.js
'use strict';
var fs = require('fs');
var path = require('path');
var { chromium } = require('playwright');

var svg = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'assets', 'favicon.svg'), 'utf8');
var mark = svg.replace(/<rect[^>]*\/>/, '');            // فقط نشان، بدون زمینه
var BG = '#121214';
function page(size, inner, bg) {
  return '<html><body style="margin:0;background:' + (bg || 'transparent') + '"><div style="width:' + size + 'px;height:' + size +
    'px;display:flex;align-items:center;justify-content:center">' + inner + '</div></body></html>';
}
var jobs = [
  // آیکون کامل (iOS و اندروید قدیمی): زمینه‌ی تیره‌ی کامل، سیستم خودش گوشه‌ها رو گرد می‌کنه
  ['icon-only.png', 1024, mark.replace('<svg ', '<svg width="1024" height="1024" '), BG],
  // آیکون تطبیقی اندروید: نشان کوچک‌تر در ناحیه‌ی امن (۶۶٪ وسط)
  ['icon-foreground.png', 1024, mark.replace('<svg ', '<svg width="700" height="700" '), null],
  ['icon-background.png', 1024, '', BG],
  ['splash.png', 2732, mark.replace('<svg ', '<svg width="600" height="600" '), BG],
  ['splash-dark.png', 2732, mark.replace('<svg ', '<svg width="600" height="600" '), BG]
];
(async function () {
  var b = await chromium.launch();
  for (var j of jobs) {
    var p = await b.newPage({ viewport: { width: j[1], height: j[1] } });
    await p.setContent(page(j[1], j[2], j[3]));
    await p.screenshot({ path: path.join(__dirname, '..', 'assets', j[0]), omitBackground: !j[3] });
    await p.close();
  }
  await b.close();
  console.log('assets: ' + jobs.map(function (j) { return j[0]; }).join(', '));
})();
