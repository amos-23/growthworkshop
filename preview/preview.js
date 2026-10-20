// Mobile sticky ticket button: shown once the hero has scrolled away, hidden
// while the ticket cards or the final call to action are on screen.
(function () {
  'use strict';
  var bar = document.getElementById('sticky-cta');
  var hero = document.getElementById('top');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;

  var heroVisible = true;
  var coverVisible = 0;
  function update() { bar.hidden = heroVisible || coverVisible > 0; }

  new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; update(); }).observe(hero);

  var cover = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { coverVisible += en.isIntersecting ? 1 : -1; });
    coverVisible = Math.max(0, coverVisible);
    update();
  });
  document.querySelectorAll('#tickets, .final').forEach(function (el) { cover.observe(el); });
})();
