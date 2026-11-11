// ساعت جعلی: new Date() و Date.now() بدون ورودی، تاریخ روز شبیه‌سازی رو برمی‌گردونن.
// موتور (logic.js) دو جا «امروز» رو از ساعت سیستم می‌خونه؛ اینطوری اون‌ها هم روز شبیه‌سازی رو می‌بینن.
'use strict';
var RealDate = Date, now = RealDate.now();
function FakeDate() {
  var a = Array.prototype.slice.call(arguments);
  if (!(this instanceof FakeDate)) return new RealDate(now).toString();
  return a.length ? new (Function.prototype.bind.apply(RealDate, [null].concat(a)))() : new RealDate(now);
}
FakeDate.prototype = RealDate.prototype;
FakeDate.now = function () { return now; };
FakeDate.parse = RealDate.parse; FakeDate.UTC = RealDate.UTC;
module.exports = {
  install: function () { global.Date = FakeDate; },
  set: function (d, hour) { var x = new RealDate(d.getFullYear(), d.getMonth(), d.getDate(), hour == null ? 7 : hour, 0, 0); now = x.getTime(); },
  iso: function () { return new RealDate(now).toISOString(); },
  RealDate: RealDate,
  perf: function () { return Number(process.hrtime.bigint()) / 1e6; }
};
