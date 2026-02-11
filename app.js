// Bootstraps the page without any inline JS (for CSP compatibility)
(function(){
  function boot(){
    if (!window.init) { return setTimeout(boot, 25); }
    window.init(window.__SYSTEM, window.__HELLO);
  }
  boot();
})();