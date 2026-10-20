// Workshop admin dashboard: fetches /api/stats and renders KPIs, a daily
// trend chart and breakdown lists. All labels are inserted with textContent.

(function () {
  'use strict';

  var EVENT_START = Date.parse('2026-11-07T12:00:00+01:00');
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SERIES = [
    { key: 'visitors', label: 'Visitors', color: 'var(--series-1)' },
    { key: 'registrationClicks', label: 'Registration clicks', color: 'var(--series-2)' }
  ];
  var LOCATION_NAMES = {
    header: 'Header button',
    hero: 'Hero "Get Your Ticket"',
    learn: '"What you\'ll learn" section',
    tickets: 'Ticket cards',
    final: 'Final call to action',
    footer: 'Footer link',
    unknown: 'Unknown'
  };
  var TICKET_NAMES = { standard: 'Standard Access', growth_intensive: 'Growth Intensive', unspecified: 'General button' };

  var numberFmt = new Intl.NumberFormat('en-GB');
  var pctFmt = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 });
  var dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var longDayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  var timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  var range = '30';
  var latest = null;
  var tooltip = document.getElementById('tooltip');
  var content = document.getElementById('content');
  var statusEl = document.getElementById('status');

  try { range = localStorage.getItem('gaw_admin_range') || range; } catch (e) { /* storage unavailable */ }

  // ---------- Countdown in the header ----------
  (function () {
    var el = document.getElementById('countdown');
    var days = Math.ceil((EVENT_START - Date.now()) / 86400000);
    if (days > 1) el.textContent = days + ' days until the workshop · Sat 7 Nov 2026, 12 PM WAT';
    else if (days === 1) el.textContent = 'Workshop is tomorrow · 12 PM WAT';
    else if (Date.now() < EVENT_START) el.textContent = 'Workshop is today · 12 PM WAT';
    else el.textContent = 'Workshop held on Sat 7 Nov 2026';
  })();

  // ---------- Data ----------
  function load() {
    content.classList.add('is-loading');
    statusEl.textContent = 'Updating…';
    fetch('/api/stats?range=' + encodeURIComponent(range), { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        latest = data;
        render(data);
        statusEl.textContent = 'Updated ' + timeFmt.format(new Date(data.generatedAt)) + ' · refreshes every minute';
      })
      .catch(function (err) {
        statusEl.textContent = 'Could not load stats (' + err.message + '). Retrying shortly.';
      })
      .then(function () { content.classList.remove('is-loading'); });
  }

  function render(data) {
    document.getElementById('storage-warning').hidden = data.storage.persistent;

    var t = data.totals;
    setKpi('visitors', numberFmt.format(t.visitors));
    setKpi('registrationClicks', numberFmt.format(t.registrationClicks));
    setKpi('clickThroughRate', t.visitors ? pctFmt.format(t.clickThroughRate) : '–');
    setKpi('standardClicks', numberFmt.format(t.standardClicks));
    setKpi('growthIntensiveClicks', numberFmt.format(t.growthIntensiveClicks));
    setKpi('primaryCtaClicks', numberFmt.format(t.primaryCtaClicks));
    setHint('pageViews', numberFmt.format(t.pageViews) + ' page views');
    setHint('registrationVisitors', numberFmt.format(t.registrationVisitors) + (t.registrationVisitors === 1 ? ' visitor' : ' visitors') + ' clicked through');
    setHint('exploreTicketsClicks', numberFmt.format(t.exploreTicketsClicks) + ' “Explore ticket options” clicks');

    renderLegend();
    renderTrend(data.daily);
    renderTable(data.daily);
    renderList('registrationByLocation', data.registrationByLocation, LOCATION_NAMES);
    renderList('registrationByTicket', data.registrationByTicket, TICKET_NAMES);
    renderList('referrers', data.referrers);
    renderList('utmSources', data.utmSources);
    renderList('devices', data.devices, { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet', unknown: 'Unknown' });
  }

  function setKpi(key, text) { document.querySelector('[data-kpi="' + key + '"]').textContent = text; }
  function setHint(key, text) { document.querySelector('[data-hint="' + key + '"]').textContent = text; }

  // ---------- Legend ----------
  function renderLegend() {
    var legend = document.getElementById('trend-legend');
    if (legend.childNodes.length) return;
    SERIES.forEach(function (s) {
      var item = document.createElement('span');
      item.className = 'legend__item';
      var key = document.createElement('span');
      key.className = 'legend__key';
      key.style.background = s.color;
      item.appendChild(key);
      item.appendChild(document.createTextNode(s.label));
      legend.appendChild(item);
    });
  }

  // ---------- Trend chart ----------
  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function niceMax(v) {
    if (v <= 4) return 4;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * mag >= v) return steps[i] * mag;
    return 10 * mag;
  }

  function renderTrend(daily) {
    var host = document.getElementById('trend-chart');
    host.textContent = '';

    var hasData = daily.some(function (d) { return d.visitors || d.registrationClicks; });
    if (!daily.length || !hasData) {
      var empty = document.createElement('div');
      empty.className = 'chart__empty';
      empty.textContent = 'No visits recorded in this period yet. Data appears here as soon as people visit the site.';
      host.appendChild(empty);
      return;
    }

    var width = host.clientWidth || 600;
    var height = host.clientHeight || 280;
    var m = { top: 12, right: 16, bottom: 26, left: 36 };
    var w = width - m.left - m.right;
    var h = height - m.top - m.bottom;
    var maxVal = niceMax(Math.max.apply(null, daily.map(function (d) { return Math.max(d.visitors, d.registrationClicks); })));
    var n = daily.length;
    var x = function (i) { return m.left + (n === 1 ? w / 2 : (i / (n - 1)) * w); };
    var y = function (v) { return m.top + h - (v / maxVal) * h; };

    var svg = svgEl('svg', { viewBox: '0 0 ' + width + ' ' + height, role: 'img', 'aria-label': 'Daily visitors and registration clicks. Use the table view for exact values.' });

    // Grid and y-axis labels
    for (var g = 0; g <= 4; g++) {
      var val = (maxVal / 4) * g;
      var gy = y(val);
      svg.appendChild(svgEl('line', { x1: m.left, x2: m.left + w, y1: gy, y2: gy, class: g === 0 ? 'baseline' : 'grid' }));
      var lbl = svgEl('text', { x: m.left - 8, y: gy + 4, 'text-anchor': 'end', class: 'axis-label' });
      lbl.textContent = numberFmt.format(Math.round(val * 10) / 10);
      svg.appendChild(lbl);
    }

    // X-axis labels: first, last and evenly spaced in between
    var tickCount = Math.min(n, Math.max(2, Math.floor(w / 80)));
    var used = {};
    for (var tI = 0; tI < tickCount; tI++) {
      var idx = tickCount === 1 ? 0 : Math.round((tI / (tickCount - 1)) * (n - 1));
      if (used[idx]) continue;
      used[idx] = true;
      var anchor = idx === 0 ? 'start' : idx === n - 1 ? 'end' : 'middle';
      var xl = svgEl('text', { x: x(idx), y: height - 6, 'text-anchor': n === 1 ? 'middle' : anchor, class: 'axis-label' });
      xl.textContent = dayFmt.format(new Date(daily[idx].day + 'T00:00:00Z'));
      svg.appendChild(xl);
    }

    // Series lines (single points get a dot so they stay visible)
    SERIES.forEach(function (s) {
      var d = daily.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[s.key]).toFixed(1); }).join(' ');
      var line = svgEl('path', { d: d, class: 'series' });
      line.style.stroke = s.color;
      svg.appendChild(line);
      if (n === 1) {
        var only = svgEl('circle', { cx: x(0), cy: y(daily[0][s.key]), r: 4, class: 'dot' });
        only.style.fill = s.color;
        svg.appendChild(only);
      }
    });

    // Direct labels at the end of each line, nudged apart if they collide
    var last = daily[n - 1];
    var ends = SERIES.map(function (s) { return { s: s, y: y(last[s.key]) }; }).sort(function (a, b) { return a.y - b.y; });
    if (ends.length === 2 && ends[1].y - ends[0].y < 14) { ends[0].y -= 7; ends[1].y += 7; }

    // Crosshair layer
    var cross = svgEl('line', { y1: m.top, y2: m.top + h, class: 'crosshair', visibility: 'hidden' });
    svg.appendChild(cross);
    var dots = SERIES.map(function (s) {
      var c = svgEl('circle', { r: 4, class: 'dot', visibility: 'hidden' });
      c.style.fill = s.color;
      svg.appendChild(c);
      return c;
    });

    var hit = svgEl('rect', { x: m.left - 8, y: m.top, width: w + 16, height: h, fill: 'transparent', tabindex: '0', 'aria-label': 'Chart: use left and right arrow keys to read each day' });
    svg.appendChild(hit);
    host.appendChild(svg);

    var active = -1;
    function show(i, clientX, clientY) {
      active = Math.max(0, Math.min(n - 1, i));
      var p = daily[active];
      var px = x(active);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
      SERIES.forEach(function (s, k) {
        dots[k].setAttribute('cx', px); dots[k].setAttribute('cy', y(p[s.key])); dots[k].setAttribute('visibility', 'visible');
      });
      tooltip.textContent = '';
      var title = document.createElement('div');
      title.className = 'tooltip__title';
      title.textContent = longDayFmt.format(new Date(p.day + 'T00:00:00Z'));
      tooltip.appendChild(title);
      SERIES.forEach(function (s) {
        var row = document.createElement('div');
        row.className = 'tooltip__row';
        var key = document.createElement('span');
        key.className = 'tooltip__key';
        key.style.background = s.color;
        var value = document.createElement('strong');
        value.textContent = numberFmt.format(p[s.key]);
        var name = document.createElement('span');
        name.textContent = s.label;
        row.appendChild(key); row.appendChild(value); row.appendChild(name);
        tooltip.appendChild(row);
      });
      tooltip.hidden = false;
      var rect = host.getBoundingClientRect();
      var scale = rect.width / width;
      var tx = clientX != null ? clientX : rect.left + px * scale;
      var ty = clientY != null ? clientY : rect.top + m.top;
      var tw = tooltip.offsetWidth;
      var left = tx + 14 + tw > window.innerWidth - 8 ? tx - tw - 14 : tx + 14;
      tooltip.style.left = Math.max(8, left) + 'px';
      tooltip.style.top = Math.max(8, ty - 10) + 'px';
    }
    function hide() {
      active = -1;
      tooltip.hidden = true;
      cross.setAttribute('visibility', 'hidden');
      dots.forEach(function (d) { d.setAttribute('visibility', 'hidden'); });
    }
    function indexFromEvent(evt) {
      var rect = host.getBoundingClientRect();
      var sx = (evt.clientX - rect.left) * (width / rect.width);
      return n === 1 ? 0 : Math.round(((sx - m.left) / w) * (n - 1));
    }
    hit.addEventListener('pointermove', function (evt) { show(indexFromEvent(evt), evt.clientX, evt.clientY); });
    hit.addEventListener('pointerdown', function (evt) { show(indexFromEvent(evt), evt.clientX, evt.clientY); });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('blur', hide);
    hit.addEventListener('focus', function () { show(n - 1); });
    hit.addEventListener('keydown', function (evt) {
      if (evt.key === 'ArrowLeft') { evt.preventDefault(); show((active < 0 ? n : active) - 1); }
      if (evt.key === 'ArrowRight') { evt.preventDefault(); show((active < 0 ? -1 : active) + 1); }
      if (evt.key === 'Escape') hide();
    });
  }

  // ---------- Table view ----------
  function renderTable(daily) {
    var tbody = document.querySelector('#trend-table tbody');
    tbody.textContent = '';
    daily.slice().reverse().forEach(function (d) {
      var tr = document.createElement('tr');
      [longDayFmt.format(new Date(d.day + 'T00:00:00Z')), numberFmt.format(d.visitors), numberFmt.format(d.views), numberFmt.format(d.registrationClicks)].forEach(function (v, i) {
        var cell = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cell.scope = 'row';
        cell.textContent = v;
        tr.appendChild(cell);
      });
      tbody.appendChild(tr);
    });
  }

  document.getElementById('toggle-table').addEventListener('click', function () {
    var wrap = document.getElementById('trend-table-wrap');
    wrap.hidden = !wrap.hidden;
    this.setAttribute('aria-expanded', String(!wrap.hidden));
    this.textContent = wrap.hidden ? 'Show table' : 'Hide table';
  });

  // ---------- Bar lists ----------
  function renderList(key, items, names) {
    var host = document.querySelector('[data-list="' + key + '"]');
    host.textContent = '';
    if (!items || !items.length) {
      var empty = document.createElement('p');
      empty.className = 'barlist__empty';
      empty.textContent = 'Nothing recorded in this period.';
      host.appendChild(empty);
      return;
    }
    var total = items.reduce(function (sum, it) { return sum + it.count; }, 0);
    var max = items[0].count;
    items.slice(0, 8).forEach(function (it) {
      var row = document.createElement('div');
      row.className = 'bar-row';
      var name = document.createElement('span');
      name.className = 'bar-row__name';
      name.textContent = (names && names[it.name]) || it.name;
      name.title = name.textContent;
      var value = document.createElement('span');
      value.className = 'bar-row__value';
      value.textContent = numberFmt.format(it.count);
      var share = document.createElement('small');
      share.textContent = pctFmt.format(it.count / total);
      value.appendChild(share);
      var track = document.createElement('div');
      track.className = 'bar-row__track';
      var fill = document.createElement('div');
      fill.className = 'bar-row__fill';
      fill.style.width = (it.count / max) * 100 + '%';
      track.appendChild(fill);
      row.appendChild(name); row.appendChild(value); row.appendChild(track);
      host.appendChild(row);
    });
  }

  // ---------- Range filter ----------
  var buttons = document.querySelectorAll('#range button');
  function syncButtons() {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-range') === range)); });
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      range = b.getAttribute('data-range');
      try { localStorage.setItem('gaw_admin_range', range); } catch (e) { /* storage unavailable */ }
      syncButtons();
      load();
    });
  });
  syncButtons();

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (latest) renderTrend(latest.daily); }, 150);
  });

  load();
  setInterval(function () { if (!document.hidden) load(); }, 60000);
})();
