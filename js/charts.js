/*
 * نمودارهای سبک SVG برای بخش «پیشرفت من» / Lightweight SVG charts for the Progress view.
 * یک محور y، ستون (حداکثر ۲۴px با سر گرد ۴px)، خط ۲px، نقطه‌ی ۸px با حلقه‌ی ۲px، گرید مویی.
 * محور زمان در فارسی (RTL) از راست به چپ و در انگلیسی از چپ به راست.
 * راهنمای شناور با نشانگر (موس، لمس) و صفحه‌کلید (فلش‌ها)؛ برچسب‌ها با textContent.
 */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var specs = {};
  var uid = 0;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // گام‌های «تمیز» محور (۱، ۲، ۵ × ۱۰ⁿ)
  function niceTicks(min, max, count) {
    if (max === min) { max = min + 1; }
    var span = max - min, raw = span / Math.max(1, count), mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).filter(function (s) { return s >= raw; })[0] || 10 * mag;
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, out = [];
    for (var v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function geometry(spec, width) {
    var axisW = spec.axisWidth || 46, other = 14, top = spec.y.label ? 30 : 14, xH = 24, stripH = spec.markers ? 22 : 0;
    var H = spec.height || 200, W = Math.max(240, width);
    var plotW = W - axisW - other, band = plotW / Math.max(1, spec.n);
    var left = spec.rtl ? other : axisW;
    return { W: W, H: top + H + stripH + xH, top: top, plotH: H, plotW: plotW, left: left, band: band, axisW: axisW, other: other, stripH: stripH,
      cx: function (i) { return spec.rtl ? left + plotW - (i + 0.5) * band : left + (i + 0.5) * band; },
      idxAt: function (px) { var r = (px - left) / band; var i = Math.floor(spec.rtl ? (spec.n - r) : r); return Math.max(0, Math.min(spec.n - 1, i)); } };
  }
  function yScale(spec, g) {
    var y = spec.y, ticks = y.ticks || niceTicks(y.min, y.max, y.count || 4);
    var lo = y.ticks ? y.min : ticks[0], hi = y.ticks ? y.max : ticks[ticks.length - 1];
    return { ticks: ticks, lo: lo, hi: hi, f: function (v) {
      var r = (v - lo) / (hi - lo || 1);
      return g.top + (y.invert ? r : 1 - r) * g.plotH;
    } };
  }
  // ستون با سر گرد (۴px) و پایه‌ی صاف
  function barPath(x, w, y0, y1) {
    var h = Math.abs(y0 - y1), r = Math.min(4, w / 2, h);
    var top = Math.min(y0, y1);
    if (h < 0.5) return '';
    return 'M' + x + ' ' + y0 + 'V' + (top + r) + 'Q' + x + ' ' + top + ' ' + (x + r) + ' ' + top + 'H' + (x + w - r) +
      'Q' + (x + w) + ' ' + top + ' ' + (x + w) + ' ' + (top + r) + 'V' + y0 + 'Z';
  }
  function linePath(values, g, ys, step) {
    var d = '', pen = false, prev = null;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (v == null || isNaN(v)) { pen = false; prev = null; continue; }
      var x = g.cx(i), y = ys.f(v);
      if (!pen) { d += 'M' + x.toFixed(1) + ' ' + y.toFixed(1); pen = true; }
      else if (step && prev) d += 'H' + x.toFixed(1) + 'V' + y.toFixed(1);
      else d += 'L' + x.toFixed(1) + ' ' + y.toFixed(1);
      prev = { x: x, y: y };
    }
    return d;
  }

  function render(el, spec) {
    var id = el.dataset.chartId || ('c' + (++uid));
    el.dataset.chartId = id;
    specs[id] = spec;
    var g = geometry(spec, el.clientWidth || 600), ys = yScale(spec, g);
    var s = '<svg class="chart-svg" xmlns="' + NS + '" width="' + g.W + '" height="' + g.H + '" viewBox="0 0 ' + g.W + ' ' + g.H + '" direction="ltr" ' +
      'role="img" tabindex="0" aria-label="' + esc(spec.aria || '') + '">';
    // گرید و برچسب‌های محور y
    var axisX = spec.rtl ? g.W - g.axisW + 8 : g.axisW - 8, anchor = spec.rtl ? 'start' : 'end';
    ys.ticks.forEach(function (tv) {
      var y = ys.f(tv).toFixed(1);
      var isZero = spec.zero && Math.abs(tv) < 1e-9;
      s += '<line class="' + (isZero ? 'ch-zero' : 'ch-grid') + '" x1="' + g.left + '" x2="' + (g.left + g.plotW) + '" y1="' + y + '" y2="' + y + '"/>';
      s += '<text class="ch-tick" x="' + axisX + '" y="' + y + '" dy="0.35em" text-anchor="' + anchor + '">' + esc(spec.y.fmt ? spec.y.fmt(tv) : tv) + '</text>';
    });
    if (spec.y.label) {
      s += '<text class="ch-unit" x="' + axisX + '" y="12" text-anchor="' + anchor + '">' + esc(spec.y.label) + '</text>';
    }
    // خط پایه
    var baseY = (spec.y.invert ? g.top : g.top + g.plotH).toFixed(1);
    s += '<line class="ch-base" x1="' + g.left + '" x2="' + (g.left + g.plotW) + '" y1="' + baseY + '" y2="' + baseY + '"/>';
    // برچسب‌های محور زمان
    var xY = g.top + g.plotH + g.stripH + 17;
    (spec.xTicks || []).forEach(function (t) {
      s += '<text class="ch-tick" x="' + g.cx(t.i).toFixed(1) + '" y="' + xY + '" text-anchor="middle">' + esc(t.label) + '</text>';
    });
    // ستون‌ها
    if (spec.bars) {
      var bw = Math.min(24, Math.max(3, g.band - 2)), y0 = ys.f(Math.max(ys.lo, 0));
      spec.bars.values.forEach(function (v, i) {
        if (v == null || v <= 0) return;
        var x = g.cx(i) - bw / 2;
        s += '<path class="ch-bar' + (spec.bars.faded && spec.bars.faded[i] ? ' is-faded' : '') + '" data-i="' + i + '" fill="' + spec.bars.color + '" d="' + barPath(x, bw, y0, ys.f(v)) + '"/>';
      });
    }
    // خطوط
    (spec.lines || []).forEach(function (ln) {
      var d = linePath(ln.values, g, ys, ln.step);
      if (d) s += '<path class="ch-line" fill="none" stroke="' + ln.color + '" d="' + d + '"/>';
      var dots = ln.dots || 'none';
      ln.values.forEach(function (v, i) {
        if (v == null) return;
        var show = dots === 'all' || (dots === 'last' && i === lastIdx(ln.values)) || (dots === 'marked' && ln.marked && ln.marked[i]);
        if (show) s += '<circle class="ch-dot" cx="' + g.cx(i).toFixed(1) + '" cy="' + ys.f(v).toFixed(1) + '" r="4" fill="' + ln.color + '"/>';
      });
    });
    // نوار رویدادها (مثلاً روزهای درد) زیر نمودار
    if (spec.markers) {
      var my = g.top + g.plotH + g.stripH / 2 + 3;
      spec.markers.idx.forEach(function (i) {
        s += '<circle class="ch-dot" cx="' + g.cx(i).toFixed(1) + '" cy="' + my + '" r="4.5" fill="' + spec.markers.color + '"/>';
      });
      if (spec.markers.label) {
        s += '<text class="ch-tick" x="' + axisX + '" y="' + my + '" dy="0.35em" text-anchor="' + anchor + '">' + esc(spec.markers.label) + '</text>';
      }
    }
    // لایه‌ی تعامل
    s += '<line class="ch-cross" x1="0" x2="0" y1="' + g.top + '" y2="' + (g.top + g.plotH + g.stripH) + '" visibility="hidden"/>';
    s += '<rect class="ch-hit" x="' + g.left + '" y="' + g.top + '" width="' + g.plotW + '" height="' + (g.plotH + g.stripH) + '" fill="transparent"/>';
    s += '</svg><div class="ch-tip" role="status" hidden></div>';
    el.innerHTML = s;
    el._g = g;
  }
  function lastIdx(a) { for (var i = a.length - 1; i >= 0; i--) if (a[i] != null) return i; return -1; }

  function showTip(el, i, px) {
    var spec = specs[el.dataset.chartId], g = el._g;
    if (!spec || !g || !spec.tip) return;
    el._i = i;
    var tip = el.querySelector('.ch-tip'), cross = el.querySelector('.ch-cross');
    var info = spec.tip(i);
    if (!info) { hideTip(el); return; }
    var x = g.cx(i);
    cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
    el.querySelectorAll('.ch-bar').forEach(function (b) { b.classList.toggle('is-hover', Number(b.dataset.i) === i); });
    tip.textContent = '';
    var h = document.createElement('div'); h.className = 'ch-tip-title'; h.textContent = info.title; tip.appendChild(h);
    info.rows.forEach(function (r) {
      var row = document.createElement('div'); row.className = 'ch-tip-row';
      var key = document.createElement('i'); key.className = 'ch-key ch-key-' + (r.kind || 'line'); key.style.background = r.color;
      var val = document.createElement('b'); val.textContent = r.value;
      var lab = document.createElement('span'); lab.textContent = r.label;
      row.appendChild(key); row.appendChild(val); row.appendChild(lab); tip.appendChild(row);
    });
    tip.hidden = false;
    // جای راهنما: کنار نشانگر، داخل کادر
    var tw = tip.offsetWidth, W = el.clientWidth, left = x + 12;
    if (left + tw > W) left = x - 12 - tw;
    if (left < 0) left = Math.max(0, Math.min(W - tw, x - tw / 2));
    tip.style.left = left + 'px';
    tip.style.top = Math.max(0, g.top) + 'px';
  }
  function hideTip(el) {
    var tip = el.querySelector('.ch-tip'), cross = el.querySelector('.ch-cross');
    if (tip) tip.hidden = true;
    if (cross) cross.setAttribute('visibility', 'hidden');
    el.querySelectorAll('.ch-bar.is-hover').forEach(function (b) { b.classList.remove('is-hover'); });
    el._i = null;
  }
  function chartOf(target) { return target && target.closest ? target.closest('[data-chart-id]') : null; }
  document.addEventListener('pointermove', function (e) {
    var el = chartOf(e.target);
    if (!el || !el._g) return;
    var svg = el.querySelector('svg'), r = svg.getBoundingClientRect();
    var px = e.clientX - r.left;
    var g = el._g;
    if (px < g.left || px > g.left + g.plotW) { hideTip(el); return; }
    showTip(el, g.idxAt(px), px);
  });
  document.addEventListener('pointerout', function (e) {
    var el = chartOf(e.target);
    if (el && !el.contains(e.relatedTarget)) hideTip(el);
  });
  document.addEventListener('focusin', function (e) {
    if (e.target.classList && e.target.classList.contains('chart-svg')) {
      var el = chartOf(e.target), spec = specs[el.dataset.chartId];
      if (spec) showTip(el, spec.n - 1);
    }
  });
  document.addEventListener('focusout', function (e) {
    if (e.target.classList && e.target.classList.contains('chart-svg')) hideTip(chartOf(e.target));
  });
  // فلش‌ها: جابه‌جایی روی محور زمان؛ در RTL فلش چپ = زمان بعدی
  document.addEventListener('keydown', function (e) {
    if (!(e.target.classList && e.target.classList.contains('chart-svg'))) return;
    var el = chartOf(e.target), spec = specs[el.dataset.chartId];
    if (!spec) return;
    var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); showTip(el, e.key === 'Home' ? 0 : spec.n - 1); return; }
    if (!dir) return;
    e.preventDefault();
    if (spec.rtl) dir = -dir;
    var i = el._i == null ? spec.n - 1 : el._i;
    showTip(el, Math.max(0, Math.min(spec.n - 1, i + dir)));
  });

  // تیک‌های محور زمان با فاصله‌ی کافی (بدون هم‌پوشانی)
  function pickTicks(n, width, labelPx, label) {
    var band = (width - 60) / Math.max(1, n), every = Math.max(1, Math.ceil((labelPx + 10) / band)), out = [];
    for (var i = n - 1; i >= 0; i -= every) out.push({ i: i, label: label(i) });
    return out;
  }

  root.CoachCharts = { render: render, niceTicks: niceTicks, pickTicks: pickTicks, rerender: function (el) { var s = specs[el.dataset.chartId]; if (s) render(el, s); } };
})(this);
