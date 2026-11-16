/* Тема оформления (светлая / тёмная). Подключается в <head> обычным скриптом,
   чтобы атрибут data-theme появился до первой отрисовки и страница не мигала светлой темой.
   Выбор пользователя хранится в localStorage; пока выбора нет — следуем системной теме. */
(function () {
  'use strict';

  var KEY = 'orbita-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function system() { return media && media.matches ? 'dark' : 'light'; }
  function apply(theme) { root.setAttribute('data-theme', theme); }

  apply(saved() || system());

  window.Theme = {
    get: function () { return root.getAttribute('data-theme'); },
    set: function (theme) {
      try { localStorage.setItem(KEY, theme); } catch (e) { /* без хранилища тема живёт до перезагрузки */ }
      apply(theme);
    },
    toggle: function () { this.set(this.get() === 'dark' ? 'light' : 'dark'); }
  };

  // Пока пользователь не выбрал тему сам, переключаемся вслед за системой
  if (media && media.addEventListener) {
    media.addEventListener('change', function () {
      if (!saved()) {
        apply(system());
        document.dispatchEvent(new CustomEvent('themechange'));
      }
    });
  }
})();
