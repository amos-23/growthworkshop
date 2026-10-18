// Growth & Acquisition Workshop landing page behaviour.
// No analytics provider is bundled. track() forwards events to whichever of
// Google Tag Manager (dataLayer), GA4 (gtag), Plausible or Meta Pixel is
// installed on the page, and does nothing otherwise.
//
// Every visit and event is also appended to this origin's localStorage so the
// /adminx backoffice can show visits, traffic sources and CTA activity without
// a backend. Nothing leaves the browser.

(function () {
  'use strict';

  var REGISTRATION_HOST = 'amos.selar.com';

  var VISITS_KEY = 'gaw_visits';
  var EVENTS_KEY = 'gaw_events';
  var VISITOR_KEY = 'gaw_vid';
  var SESSION_KEY = 'gaw_sid';
  var MAX_ROWS = 2000;

  var SEARCH_HOSTS = ['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'brave'];
  var SOCIAL_HOSTS = ['twitter', 'x.com', 'facebook', 'instagram', 'linkedin', 't.co', 'wa.me', 'whatsapp', 't.me', 'youtube', 'tiktok', 'reddit', 'threads'];

  function readRows(key) {
    try {
      var rows = JSON.parse(window.localStorage.getItem(key) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      return [];
    }
  }

  function writeRows(key, rows) {
    try {
      window.localStorage.setItem(key, JSON.stringify(rows.slice(-MAX_ROWS)));
    } catch (err) {
      // Storage full or blocked: analytics must never break the page.
    }
  }

  function randomId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function visitorId() {
    try {
      var id = window.localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = randomId();
        window.localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (err) {
      return 'unknown';
    }
  }

  function sessionId() {
    try {
      var id = window.sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = randomId();
        window.sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (err) {
      return 'unknown';
    }
  }

  function hostMatches(host, list) {
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (host === h || host.indexOf(h + '.') === 0 || host.indexOf('.' + h) !== -1) return true;
    }
    return false;
  }

  // Where this visit came from: UTM parameters win, then the referrer,
  // then "direct".
  function pageSource() {
    var ref = document.referrer || '';
    var refHost = '';
    if (ref) {
      try {
        refHost = new URL(ref).hostname.replace(/^www\./, '');
      } catch (err) {
        refHost = '';
      }
    }
    var self = window.location.hostname.replace(/^www\./, '');

    var params = null;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (err) {
      params = null;
    }
    var utmSource = params && params.get('utm_source');
    if (utmSource) {
      return {
        source: utmSource,
        medium: params.get('utm_medium') || 'utm',
        campaign: params.get('utm_campaign') || ''
      };
    }
    if (!refHost || refHost === self) return { source: 'direct', medium: 'none', campaign: '' };

    var medium = 'referral';
    if (hostMatches(refHost, SEARCH_HOSTS)) medium = 'organic';
    else if (hostMatches(refHost, SOCIAL_HOSTS)) medium = 'social';
    return { source: refHost, medium: medium, campaign: '' };
  }

  function recordVisit() {
    var s = pageSource();
    var visits = readRows(VISITS_KEY);
    visits.push({
      t: Date.now(),
      source: s.source,
      medium: s.medium,
      campaign: s.campaign,
      path: window.location.pathname,
      vid: visitorId(),
      sid: sessionId(),
      w: window.innerWidth || 0
    });
    writeRows(VISITS_KEY, visits);
  }

  function saveEvent(name, props) {
    var events = readRows(EVENTS_KEY);
    events.push({ t: Date.now(), name: name, props: props, vid: visitorId(), sid: sessionId() });
    writeRows(EVENTS_KEY, events);
  }

  function track(name, props) {
    props = props || {};
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: name }, props));
      if (typeof window.gtag === 'function') window.gtag('event', name, props);
      if (typeof window.plausible === 'function') window.plausible(name, { props: props });
      if (typeof window.fbq === 'function' && name === 'registration_click') {
        window.fbq('track', 'InitiateCheckout', { content_name: props.ticket || 'unspecified' });
      }
    } catch (err) {
      // Analytics must never break the page or block registration.
    }
    saveEvent(name, props);
  }

  window.gawTrack = track;

  recordVisit();
  track('landing_page_view', { page: 'growth_acquisition_workshop' });

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[data-track]');
    if (!link) return;

    var kind = link.getAttribute('data-track');
    var location = link.getAttribute('data-location') || 'unknown';
    var ticket = link.getAttribute('data-ticket');

    if (kind === 'cta') {
      track('primary_cta_click', { location: location });
    } else if (kind === 'ticket') {
      track(ticket === 'growth_intensive' ? 'growth_intensive_cta_click' : 'standard_access_cta_click', {
        location: location,
        ticket: ticket
      });
    } else if (kind === 'explore') {
      track('explore_tickets_click', { location: location });
    }

    if (link.hostname === REGISTRATION_HOST) {
      track('registration_click', { location: location, ticket: ticket || 'unspecified' });
    }
  });

  // Scroll reveal. Content is visible by default when JS or IntersectionObserver is unavailable.
  var revealEls = document.querySelectorAll('.reveal');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  revealEls.forEach(function (el) { observer.observe(el); });
})();
