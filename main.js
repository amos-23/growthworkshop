// Growth & Acquisition Workshop landing page behaviour.
// No analytics provider is bundled. track() forwards events to whichever of
// Google Tag Manager (dataLayer), GA4 (gtag), Plausible or Meta Pixel is
// installed on the page, and does nothing otherwise.

(function () {
  'use strict';

  var REGISTRATION_HOST = 'amos.selar.com';

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
