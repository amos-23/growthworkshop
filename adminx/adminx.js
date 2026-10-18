// Backoffice UI: resolves the data source (API > this browser > demo),
// then renders KPIs, the daily visits chart and the breakdown tables.
(function () {
  'use strict';

  var cfg = window.GAW_ADMIN_CONFIG || {};
  var G = window.GAWStats;

  var state = { days: 14, mode: 'demo', note: '' };

  function $(id) { return document.getElementById(id); }

  function fmt(n) { return Number(n).toLocaleString('en-GB'); }
  function pct(x, digits) { return (x * 100).toFixed(digits === undefined ? 1 : digits) + '%'; }

  function readLocal(key) {
    try {
      var rows = JSON.parse(window.localStorage.getItem(key) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      return [];
    }
  }

  function localData() {
    return { visits: readLocal('gaw_visits'), events: readLocal('gaw_events') };
  }

  function apiData(url) {
    return fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.mode = 'api';
        state.note = 'Live data from ' + url;
        return { visits: data.visits || [], events: data.events || [] };
      });
  }

  function resolveData() {
    var local = localData();

    if (cfg.analyticsEndpoint) {
      return apiData(cfg.analyticsEndpoint).catch(function (err) {
        if (local.visits.length) {
          state.mode = 'local';
          state.note = 'Analytics API unreachable (' + err.message + '); showing visits recorded in this browser.';
          return local;
        }
        state.mode = 'demo';
        state.note = 'Analytics API unreachable (' + err.message + '); showing demo data.';
        return G.demoData(Date.now());
      });
    }

    if (local.visits.length) {
      state.mode = 'local';
      state.note = 'Visits recorded in this browser on this origin. Counts from other visitors need a server-side endpoint in adminx/config.js.';
      return Promise.resolve(local);
    }

    state.mode = 'demo';
    state.note = 'Demo data: no visits recorded in this browser yet. Open the site in this browser to record real visits, or configure an endpoint in adminx/config.js.';
    return Promise.resolve(G.demoData(Date.now()));
  }

  function setBadge() {
    var badge = $('mode-badge');
    var labels = { demo: 'Demo data', local: 'This browser', api: 'Live API' };
    badge.textContent = labels[state.mode] || state.mode;
    badge.className = 'badge badge--' + state.mode;
  }

  function renderKpis(k) {
    $('k-visits').textContent = fmt(k.visits);
    $('k-visits-sub').textContent = 'pageviews in the last ' + state.days + ' days';
    $('k-visitors').textContent = fmt(k.visitors);
    $('k-visitors-sub').textContent = 'distinct visitors';
    $('k-cta').textContent = fmt(k.ctaClicks);
    $('k-cta-sub').textContent = 'Get Your Ticket / ticket buttons';
    $('k-reg').textContent = fmt(k.regClicks);
    $('k-reg-sub').textContent = 'clicks through to amos.selar.com';
    $('k-conv').textContent = pct(k.conversion);
    $('k-conv-sub').textContent = k.regClicks + ' of ' + k.visits + ' visits';
  }

  function renderChart(series) {
    var wrap = $('chart');
    wrap.textContent = '';

    var peak = 0;
    series.forEach(function (row) { if (row.count > peak) peak = row.count; });
    var max = peak || 1;
    var step = Math.ceil(series.length / 10);

    series.forEach(function (row, i) {
      var col = document.createElement('div');
      col.className = 'chart__col';

      var val = document.createElement('span');
      val.className = 'chart__val';
      val.textContent = row.count ? fmt(row.count) : '';
      col.appendChild(val);

      var bar = document.createElement('div');
      bar.className = 'chart__bar' + (row.count ? '' : ' chart__bar--zero');
      bar.style.height = row.count ? Math.max(3, Math.round((row.count / max) * 100)) + '%' : '2%';
      bar.title = row.label + ': ' + row.count + (row.count === 1 ? ' visit' : ' visits');
      col.appendChild(bar);

      var lab = document.createElement('span');
      lab.className = 'chart__label';
      lab.textContent = i % step === 0 ? row.label : '';
      col.appendChild(lab);

      wrap.appendChild(col);
    });

    $('chart-meta').textContent = 'Last ' + state.days + ' days · peak ' + fmt(peak) + '/day';
  }

  function cell(text, cls) {
    var td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    return td;
  }

  function emptyRow(cols, message) {
    var tr = document.createElement('tr');
    var td = cell(message, 'empty');
    td.colSpan = cols;
    tr.appendChild(td);
    return tr;
  }

  function shareCell(share) {
    var td = document.createElement('td');
    td.className = 'num share';

    var num = document.createElement('span');
    num.className = 'share__num';
    num.textContent = pct(share, 0);
    td.appendChild(num);

    var track = document.createElement('span');
    track.className = 'share__track';
    var fill = document.createElement('span');
    fill.className = 'share__fill';
    fill.style.width = Math.round(share * 100) + '%';
    track.appendChild(fill);
    td.appendChild(track);

    return td;
  }

  function renderSources(rows) {
    var body = $('src-rows');
    body.textContent = '';
    if (!rows.length) {
      body.appendChild(emptyRow(4, 'No visits in this window.'));
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(row.source));
      tr.appendChild(cell(row.medium, 'muted'));
      tr.appendChild(cell(fmt(row.visits), 'num'));
      tr.appendChild(shareCell(row.share));
      body.appendChild(tr);
    });
  }

  function renderEvents(rows) {
    var body = $('evt-rows');
    body.textContent = '';
    if (!rows.length) {
      body.appendChild(emptyRow(3, 'No events in this window.'));
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(row.name));
      tr.appendChild(cell(fmt(row.count), 'num'));
      tr.appendChild(shareCell(row.share));
      body.appendChild(tr);
    });
  }

  function render(data) {
    var now = Date.now();
    var days = state.days;

    setBadge();
    renderKpis(G.kpis(data.visits, data.events, days, now));
    renderChart(G.seriesDaily(data.visits, days, now));
    renderSources(G.sources(data.visits, days, now));
    renderEvents(G.eventCounts(data.events, days, now));
    $('data-note').textContent = state.note;
  }

  function load() {
    return resolveData().then(render).catch(function (err) {
      $('data-note').textContent = 'Could not load data: ' + err.message;
    });
  }

  document.addEventListener('click', function (ev) {
    var target = ev.target;
    if (!target || !target.closest) return;

    var rangeBtn = target.closest('[data-days]');
    if (rangeBtn) {
      state.days = parseInt(rangeBtn.getAttribute('data-days'), 10) || 14;
      document.querySelectorAll('[data-days]').forEach(function (b) {
        if (b.classList) b.classList.toggle('is-active', b === rangeBtn);
      });
      load();
      return;
    }

    if (target.closest('#refresh')) load();
  });

  load();
})();
