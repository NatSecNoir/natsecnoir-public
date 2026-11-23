// Light / dark toggle for the public site. Dark is the default (owner directive 2026-11-22, reversing
// 2026-09-27): base.njk sets data-theme before paint; a click flips it and the choice is stored.
// OS preference is never followed.
// The button (#theme with #theme-label and .icon-sun/.icon-moon) is added to nav.main in U3;
// this script no-ops on any page rendered before the button exists.
(function () {
  var btn = document.getElementById('theme');
  if (!btn) return;
  var label = document.getElementById('theme-label');
  var sun = btn.querySelector('.icon-sun');
  var moon = btn.querySelector('.icon-moon');
  function effectiveTheme() {
    var set = document.documentElement.getAttribute('data-theme');
    return (set === 'dark' || set === 'light') ? set : 'dark';
  }
  function syncTheme() {
    var dark = effectiveTheme() === 'dark';
    if (sun) sun.hidden = !dark;
    if (moon) moon.hidden = dark;
    if (label) label.textContent = dark ? 'Light' : 'Dark';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  btn.addEventListener('click', function () {
    var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncTheme();
  });
  syncTheme();
})();

// Sticky nav shadow: add .scrolled to nav.main once the page scrolls past the masthead.
(function () {
  var nav = document.querySelector('nav.main');
  if (!nav) return;
  function onScroll() {
    if (window.scrollY > 8) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
