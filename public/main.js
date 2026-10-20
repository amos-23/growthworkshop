// Growth & Acquisition Workshop landing page behaviour.
// track() records each event with the site's own /api/track endpoint (shown
// on the /admin dashboard) and also forwards it to Google Tag Manager
// (dataLayer), GA4 (gtag), Plausible or Meta Pixel if any is installed.

(function () {
  'use strict';

  var REGISTRATION_HOST = 'amos.selar.com';
  var TRACK_URL = '/api/track';

  // A random per-tab session id, used only to count unique visitors.
  function sessionId() {
    try {
      var id = sessionStorage.getItem('gaw_sid');
      if (!id) {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem('gaw_sid', id);
      }
      return id;
    } catch (err) {
      return undefined;
    }
  }

  var params = new URLSearchParams(window.location.search);
  var context = {
    sid: sessionId(),
    ref: document.referrer || undefined,
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined
  };

  function sendFirstParty(name, props) {
    if (navigator.webdriver || !/^https?:$/.test(window.location.protocol)) return;
    var payload = JSON.stringify(Object.assign({ event: name }, context, props));
    // sendBeacon survives the page unloading as the visitor leaves for registration.
    if (navigator.sendBeacon && navigator.sendBeacon(TRACK_URL, new Blob([payload], { type: 'application/json' }))) return;
    if (window.fetch) {
      fetch(TRACK_URL, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function () {});
    }
  }

  function track(name, props) {
    props = props || {};
    try {
      sendFirstParty(name, props);
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
  }

  window.gawTrack = track;

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
