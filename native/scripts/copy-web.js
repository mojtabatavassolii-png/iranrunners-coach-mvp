// اپ وب ریشه‌ی مخزن رو در native/www کپی می‌کنه (همون فایل‌هایی که اپ لازم داره؛ نه تست، ابزار یا سرویس‌ورکر).
// اجرای: npm run web (یا npm run sync که بعدش cap sync هم می‌زنه)
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..');
var OUT = path.join(__dirname, '..', 'www');
var ITEMS = ['index.html', 'privacy.html', 'manifest.json', 'css', 'js', 'public', 'models'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
ITEMS.forEach(function (item) {
  var from = path.join(ROOT, item);
  if (!fs.existsSync(from)) throw new Error('missing ' + item);
  fs.cpSync(from, path.join(OUT, item), { recursive: true });
});
console.log('www: ' + ITEMS.join(', '));
