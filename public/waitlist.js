// Waitlist sign-up: posts the form to /api/waitlist and swaps in a thank-you message.
(function () {
  'use strict';

  var form = document.getElementById('waitlist-form');
  if (!form) return;
  var status = document.getElementById('wl-status');
  var button = document.getElementById('wl-submit');
  var done = document.getElementById('wl-done');
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function say(text) { status.textContent = text; }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      whatsapp: form.whatsapp.value.trim(),
      website: form.website.value
    };

    if (!data.name) { say('Please enter your name.'); form.name.focus(); return; }
    if (!EMAIL.test(data.email)) { say('Please enter a valid email address.'); form.email.focus(); return; }

    say('');
    button.disabled = true;
    button.firstChild.nodeValue = 'Sending… ';

    var params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (params.get(k)) data[k] = params.get(k); });
    if (document.referrer) data.ref = document.referrer;

    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      form.hidden = true;
      done.hidden = false;
      done.querySelector('h2').focus && done.querySelector('h2').setAttribute('tabindex', '-1');
      done.querySelector('h2').focus();
      if (window.gawTrack) window.gawTrack('waitlist_signup', { location: 'waitlist' });
    }).catch(function () {
      say("Something went wrong. Please try again in a moment.");
      button.disabled = false;
      button.firstChild.nodeValue = 'Notify me ';
    });
  });
})();
