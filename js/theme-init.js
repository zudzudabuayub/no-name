// Ставит тему до отрисовки, чтобы не было «мигания».
(function () {
  try {
    var t = localStorage.getItem('moi-sait:theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    var dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', dark ? '#0e1015' : '#f4f5f9');
  } catch (e) { /* ignore */ }
})();
