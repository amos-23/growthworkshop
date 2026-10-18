// Pure data helpers for the /adminx backoffice.
// No DOM access: the browser gets window.GAWStats, Node gets module.exports,
// which lets the numbers be checked without a browser.

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAWStats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DAY = 86400000;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function dayKey(ts) {
    var d = new Date(ts);
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function labelFor(ts) {
    var d = new Date(ts);
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function inWindow(t, days, now) {
    var from = startOfDay(now) - (days - 1) * DAY;
    return t >= from && t <= now;
  }

  function seriesDaily(visits, days, now) {
    var counts = {};
    visits.forEach(function (v) {
      if (inWindow(v.t, days, now)) {
        var k = dayKey(v.t);
        counts[k] = (counts[k] || 0) + 1;
      }
    });
    var out = [];
    var start = startOfDay(now) - (days - 1) * DAY;
    for (var i = 0; i < days; i++) {
      var ts = start + i * DAY;
      var key = dayKey(ts);
      out.push({ day: key, label: labelFor(ts), count: counts[key] || 0 });
    }
    return out;
  }

  function sources(visits, days, now) {
    var counts = {};
    var total = 0;
    visits.forEach(function (v) {
      if (!inWindow(v.t, days, now)) return;
      var key = (v.source || 'direct') + '|' + (v.medium || 'none');
      if (!counts[key]) counts[key] = { source: v.source || 'direct', medium: v.medium || 'none', visits: 0 };
      counts[key].visits += 1;
      total += 1;
    });
    var rows = Object.keys(counts).map(function (k) {
      var row = counts[k];
      row.share = total ? row.visits / total : 0;
      return row;
    });
    rows.sort(function (a, b) {
      return b.visits - a.visits || (a.source < b.source ? -1 : 1);
    });
    return rows;
  }

  function eventCounts(events, days, now) {
    var counts = {};
    var total = 0;
    events.forEach(function (e) {
      if (!inWindow(e.t, days, now)) return;
      var name = e.name || 'unknown';
      counts[name] = (counts[name] || 0) + 1;
      total += 1;
    });
    var rows = Object.keys(counts).map(function (name) {
      return { name: name, count: counts[name], share: total ? counts[name] / total : 0 };
    });
    rows.sort(function (a, b) {
      return b.count - a.count || (a.name < b.name ? -1 : 1);
    });
    return rows;
  }

  function kpis(visits, events, days, now) {
    var seen = {};
    var visitCount = 0;
    visits.forEach(function (v) {
      if (!inWindow(v.t, days, now)) return;
      visitCount += 1;
      seen[v.vid || v.sid || 'unknown'] = 1;
    });
    var cta = 0;
    var reg = 0;
    events.forEach(function (e) {
      if (!inWindow(e.t, days, now)) return;
      if (e.name === 'registration_click') reg += 1;
      else if (e.name && e.name.indexOf('_cta_click') !== -1) cta += 1;
    });
    return {
      visits: visitCount,
      visitors: Object.keys(seen).length,
      ctaClicks: cta,
      regClicks: reg,
      conversion: visitCount ? reg / visitCount : 0
    };
  }

  // Deterministic sample data so the dashboard is never an empty shell.
  function lcg(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function pickWeighted(pool, r) {
    var total = 0;
    var i;
    for (i = 0; i < pool.length; i++) total += pool[i].w;
    var target = r * total;
    for (i = 0; i < pool.length; i++) {
      target -= pool[i].w;
      if (target <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function demoData(now) {
    var rand = lcg(20261107);
    var pool = [
      { source: 'google', medium: 'organic', w: 30 },
      { source: 'direct', medium: 'none', w: 24 },
      { source: 'x.com', medium: 'social', w: 16 },
      { source: 'linkedin.com', medium: 'social', w: 12 },
      { source: 'whatsapp.com', medium: 'social', w: 10 },
      { source: 'newsletter', medium: 'email', w: 8 }
    ];
    var visits = [];
    var events = [];

    for (var d = 29; d >= 0; d--) {
      var dayStart = startOfDay(now - d * DAY);
      var dow = new Date(dayStart).getDay();
      var weekend = dow === 0 || dow === 6;
      var ramp = 1 + (29 - d) * 0.035;
      var n = Math.round((5 + rand() * 7) * ramp * (weekend ? 0.65 : 1));

      for (var i = 0; i < n; i++) {
        var t = dayStart + Math.floor(rand() * DAY);
        if (t > now) t = now - Math.floor(rand() * 3600000);
        var src = pickWeighted(pool, rand());
        var vid = 'demo-v-' + Math.floor(rand() * 14);
        var sid = 'demo-s-' + d + '-' + Math.floor(i / 4);
        var at = function (offset) { return Math.min(t + offset, now); };

        visits.push({ t: t, source: src.source, medium: src.medium, campaign: '', path: '/', vid: vid, sid: sid, w: 1280 });
        events.push({ t: at(0), name: 'landing_page_view', props: { page: 'growth_acquisition_workshop' }, vid: vid, sid: sid });

        if (rand() < 0.2) {
          events.push({ t: at(4000), name: 'primary_cta_click', props: { location: 'hero' }, vid: vid, sid: sid });
        }
        if (rand() < 0.12) {
          var growth = rand() >= 0.7;
          events.push({
            t: at(6000),
            name: growth ? 'growth_intensive_cta_click' : 'standard_access_cta_click',
            props: { location: 'tickets', ticket: growth ? 'growth_intensive' : 'standard' },
            vid: vid,
            sid: sid
          });
        }
        if (rand() < 0.25) {
          events.push({ t: at(5000), name: 'explore_tickets_click', props: { location: 'hero' }, vid: vid, sid: sid });
        }
        if (rand() < 0.06) {
          events.push({ t: at(9000), name: 'registration_click', props: { location: 'tickets', ticket: 'standard' }, vid: vid, sid: sid });
        }
      }
    }

    visits.sort(function (a, b) { return a.t - b.t; });
    events.sort(function (a, b) { return a.t - b.t; });
    return { visits: visits, events: events };
  }

  return {
    dayKey: dayKey,
    labelFor: labelFor,
    inWindow: inWindow,
    seriesDaily: seriesDaily,
    sources: sources,
    eventCounts: eventCounts,
    kpis: kpis,
    demoData: demoData
  };
});
