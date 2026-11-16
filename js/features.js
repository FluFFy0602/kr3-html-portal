/* Фичи интерфейса портала:
   1) тёмная тема — кнопка в сайдбаре и клавиша T; новая тема «раскрывается» кругом от кнопки
      (сама тема — js/theme.js и css/theme-dark.css);
   2) быстрый поиск — Ctrl/⌘+K или «/»: разделы, админка, сотрудники, новости, база знаний, команды;
   3) горячие клавиши — «G», затем буква раздела; справка по «?»;
   4) анимации: появление страницы, блоки выезжают при прокрутке, числа в статистике «набегают»
      (всё отключается при prefers-reduced-motion);
   5) кнопка «Наверх» с кольцом прогресса прокрутки, полоса прогресса чтения и время чтения статьи.
   Подключается с defer после data.js и ui.js. */
(function () {
  'use strict';

  var UI = window.UI, DB = window.DB, Theme = window.Theme;
  if (!UI || !DB) return;

  var root = document.documentElement;
  var esc = UI.esc, $ = UI.$, $$ = UI.$$;
  var ROOT = UI.root;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ================= 4. Анимации появления ================= */
  // Класс ставится сразу, до отрисовки: карточки начинают анимацию из прозрачного состояния
  root.classList.add('is-entering');
  setTimeout(function () { root.classList.remove('is-entering'); }, 1400);

  // Порядковый номер элемента задаёт задержку — карточки появляются «волной»
  function staggerItems() {
    $$('#page .grid, #page .card, #page .table-box').forEach(function (box) {
      Array.prototype.slice.call(box.children, 0, 12).forEach(function (el, i) {
        el.style.setProperty('--i', i);
      });
    });
  }

  /* ================= 1. Тёмная тема ================= */
  function syncThemeButtons() {
    $$('[data-theme-toggle]').forEach(function (b) { b.innerHTML = UI.themeToggleInner(); });
  }

  function applyToggle() {
    Theme.toggle();
    syncThemeButtons();
  }

  // Точка, из которой раскрывается новая тема: центр кнопки-переключателя, если она на экране
  function revealPoint(el) {
    var w = window.innerWidth, h = window.innerHeight, x = w / 2, y = h / 2;
    var b = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (b && b.width && b.right > 0 && b.left < w && b.bottom > 0 && b.top < h) {
      x = b.left + b.width / 2;
      y = b.top + b.height / 2;
    }
    return { x: x, y: y, r: Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) };
  }

  // Пока идёт переключение, повторные нажатия игнорируем: иначе браузер обрывает анимацию рывком
  var switching = false;
  function toggleTheme(origin) {
    if (!Theme || switching) return;
    if (reduceMotion) { applyToggle(); return; }
    switching = true;

    // View Transitions API: новая тема раскрывается кругом (анимация — в css/features.css)
    if (document.startViewTransition) {
      var p = revealPoint(origin || $('.sider [data-theme-toggle]'));
      root.style.setProperty('--reveal-x', p.x + 'px');
      root.style.setProperty('--reveal-y', p.y + 'px');
      root.style.setProperty('--reveal-r', Math.ceil(p.r) + 'px');
      root.classList.add('theme-reveal');
      var done = function () { root.classList.remove('theme-reveal'); switching = false; };
      document.startViewTransition(applyToggle).finished.then(done, done);
      return;
    }

    // Запасной вариант: на время переключения у всех элементов плавно перетекают цвета
    root.classList.add('theme-switching');
    applyToggle();
    setTimeout(function () { root.classList.remove('theme-switching'); switching = false; }, 700);
  }
  document.addEventListener('themechange', syncThemeButtons);

  /* ================= 2. Быстрый поиск ================= */
  var EXTRA_SECTIONS = [
    ['birthdays.html', 'gift', 'Дни рождения'],
    ['on-vacation.html', 'calendar', 'Кто в отпуске'],
    ['substitutions.html', 'swap', 'Замещения'],
    ['services.html', 'apps', 'Сервисы'],
    ['profile.html', 'user', 'Профиль']
  ];

  function isAdmin() {
    var me = UI.user(DB.me);
    return !!me && me.role === 'admin';
  }

  function sectionItems() {
    return UI.menus.portal.concat(EXTRA_SECTIONS).map(function (m) {
      return { title: m[2], icon: m[1], href: ROOT + m[0] };
    });
  }

  function adminItems() {
    var out = [];
    UI.menus.admin.forEach(function (g) {
      if (g.link) {
        out.push({ title: g.link[1], sub: 'Администрирование', icon: g.link[3], href: ROOT + 'admin/' + g.link[0] });
        return;
      }
      g.items.forEach(function (i) {
        out.push({ title: i[1], sub: 'Администрирование · ' + g.group, icon: g.icon, href: ROOT + 'admin/' + i[0] });
      });
    });
    return out;
  }

  function buildIndex() {
    var dark = Theme && Theme.get() === 'dark';
    var groups = [{ name: 'Разделы', always: true, items: sectionItems() }];
    if (isAdmin()) groups.push({ name: 'Администрирование', items: adminItems() });

    groups.push({ name: 'Сотрудники', items: DB.users.filter(function (u) { return u.active; }).map(function (u) {
      return {
        title: UI.fullName(u), avatar: u, keys: u.email + ' ' + u.vn,
        sub: UI.nameOf(DB.positions, u.position) + ' · ' + UI.nameOf(DB.orgUnits, u.unit),
        run: function () { UI.userCard(u.id); }
      };
    }) });

    groups.push({ name: 'Новости', items: DB.news.filter(function (n) { return n.status === 'published'; }).map(function (n) {
      return {
        title: n.title, icon: 'bell',
        sub: UI.nameOf(DB.newsCategories, n.cat) + ' · ' + UI.fmt(n.published),
        href: ROOT + 'news-article.html?slug=' + encodeURIComponent(n.slug)
      };
    }) });

    groups.push({ name: 'База знаний', items: DB.kbItems.map(function (i) {
      return {
        title: i.title, sub: i.sub, icon: 'book',
        run: function () {
          UI.modal({ title: esc(i.title), width: 680, html: '<p class="muted">' + esc(i.sub) + '</p><div class="news-html">' + i.body + '</div>' });
        }
      };
    }) });

    groups.push({ name: 'Команды', always: true, items: [
      { title: dark ? 'Включить светлую тему' : 'Включить тёмную тему', icon: dark ? 'sun' : 'moon', hint: 'T',
        keys: 'тема оформление ночной режим theme dark light', run: toggleTheme },
      { title: 'Горячие клавиши', icon: 'keyboard', hint: '?', keys: 'клавиатура shortcuts', run: showHotkeys },
      { title: 'Выйти', icon: 'logout', keys: 'logout выход', href: ROOT + 'login.html' }
    ] });
    return groups;
  }

  function words(q) { return UI.norm(q).split(/\s+/).filter(Boolean); }

  // -1 — не подходит; чем больше, тем выше в списке (совпадение с началом названия — лучше всего)
  function score(item, ws) {
    var hay = UI.norm(item.title + ' ' + (item.sub || '') + ' ' + (item.keys || ''));
    for (var i = 0; i < ws.length; i++) if (hay.indexOf(ws[i]) < 0) return -1;
    var pos = UI.norm(item.title).indexOf(ws[0]);
    return pos === 0 ? 2 : pos > 0 ? 1 : 0;
  }

  function search(groups, q) {
    var ws = words(q);
    return groups.map(function (g) {
      var items = !ws.length ? (g.always ? g.items : []) : g.items
        .map(function (it) { return { it: it, s: score(it, ws) }; })
        .filter(function (x) { return x.s >= 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 6)
        .map(function (x) { return x.it; });
      return { name: g.name, items: items };
    }).filter(function (g) { return g.items.length; });
  }

  // Подсветка найденных фрагментов. UI.norm не меняет длину строки, поэтому индексы совпадают
  function highlight(text, ws) {
    var norm = UI.norm(text), ranges = [];
    ws.forEach(function (w) { var i = norm.indexOf(w); if (i >= 0) ranges.push([i, i + w.length]); });
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var out = '', pos = 0;
    ranges.forEach(function (r) {
      if (r[0] < pos) return;
      out += esc(text.slice(pos, r[0])) + '<mark>' + esc(text.slice(r[0], r[1])) + '</mark>';
      pos = r[1];
    });
    return out + esc(text.slice(pos));
  }

  var palette = null;

  function openPalette() {
    if (palette) { $('input', palette.el).focus(); return; }
    var groups = buildIndex(), flat = [], active = 0;

    palette = UI.modal({
      cls: 'palette-modal', width: 620,
      html:
        '<label class="pal-search">' + UI.icon('search') +
          '<input type="text" placeholder="Разделы, сотрудники, новости, статьи…" autocomplete="off" spellcheck="false" aria-label="Поиск по порталу">' +
          '<kbd>Esc</kbd></label>' +
        '<div class="pal-list" role="listbox" aria-label="Результаты поиска"></div>' +
        '<div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> выбрать</span><span><kbd>Enter</kbd> открыть</span>' +
          '<span class="pal-foot-tip">Подсказка: <kbd>G</kbd> + буква — быстрый переход</span></div>',
      onClose: function () { palette = null; }
    });

    var input = $('input', palette.el), list = $('.pal-list', palette.el);

    function setActive(i) {
      if (!flat.length) return;
      active = (i + flat.length) % flat.length;
      $$('.pal-item', list).forEach(function (el) {
        el.classList.toggle('is-active', Number(el.getAttribute('data-idx')) === active);
      });
      var el = $('.pal-item.is-active', list);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    function render() {
      var ws = words(input.value);
      flat = [];
      var html = search(groups, input.value).map(function (g) {
        return '<div class="pal-group">' + esc(g.name) + '</div>' + g.items.map(function (it) {
          var idx = flat.push(it) - 1;
          return '<div class="pal-item" role="option" data-idx="' + idx + '">' +
            '<span class="pal-ico">' + (it.avatar ? UI.avatar(it.avatar, 'avatar-sm') : UI.icon(it.icon || 'file')) + '</span>' +
            '<span class="grow"><span class="pal-title">' + highlight(it.title, ws) + '</span>' +
              (it.sub ? '<span class="pal-sub">' + esc(it.sub) + '</span>' : '') + '</span>' +
            (it.hint ? '<kbd>' + esc(it.hint) + '</kbd>' : '') +
            '<span class="pal-enter">' + UI.icon('enter') + '</span></div>';
        }).join('');
      }).join('');
      list.innerHTML = html || '<div class="pal-empty">По запросу «' + esc(input.value) + '» ничего не нашлось</div>';
      setActive(0);
    }

    function run(i) {
      var it = flat[i];
      if (!it) return;
      palette.close();
      if (it.href) location.href = it.href;
      else if (it.run) it.run();
    }

    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    });
    list.addEventListener('mousemove', function (e) {
      var el = e.target.closest('.pal-item');
      if (el && Number(el.getAttribute('data-idx')) !== active) setActive(Number(el.getAttribute('data-idx')));
    });
    list.addEventListener('click', function (e) {
      var el = e.target.closest('.pal-item');
      if (el) run(Number(el.getAttribute('data-idx')));
    });
    render();
  }

  /* ================= 3. Горячие клавиши ================= */
  // Коды физических клавиш (KeyD и т. п.) — работают и в русской раскладке
  var GO = [
    ['KeyD', 'D', 'index.html', 'Дашборд'],
    ['KeyN', 'N', 'news.html', 'Новости'],
    ['KeyE', 'E', 'employees.html', 'Сотрудники'],
    ['KeyO', 'O', 'org.html', 'Оргструктура'],
    ['KeyV', 'V', 'vacations.html', 'Отпуска'],
    ['KeyR', 'R', 'requests.html', 'Заявки'],
    ['KeyK', 'K', 'knowledge.html', 'База знаний'],
    ['KeyB', 'B', 'birthdays.html', 'Дни рождения'],
    ['KeyS', 'S', 'services.html', 'Сервисы'],
    ['KeyP', 'P', 'profile.html', 'Профиль'],
    ['KeyA', 'A', 'admin/users.html', 'Администрирование', true]
  ];

  function goTargets() { return GO.filter(function (g) { return !g[4] || isAdmin(); }); }

  function keys(list) {
    return '<span class="hk-keys">' + list.map(function (k) { return '<kbd>' + esc(k) + '</kbd>'; }).join('') + '</span>';
  }

  function showHotkeys() {
    var common = [
      [[UI.modKey, 'K'], 'Быстрый поиск'],
      [['/'], 'Быстрый поиск'],
      [['T'], 'Сменить тему'],
      [['?'], 'Эта справка'],
      [['Esc'], 'Закрыть окно']
    ];
    UI.modal({
      title: 'Горячие клавиши', width: 480, centered: true,
      html:
        '<div class="hk-title">Общие</div><div class="hk-list">' +
          common.map(function (r) { return keys(r[0]) + '<span>' + r[1] + '</span>'; }).join('') + '</div>' +
        '<div class="hk-title">Переход: нажмите G, затем букву</div><div class="hk-list">' +
          goTargets().map(function (g) { return keys(['G', g[1]]) + '<span>' + g[3] + '</span>'; }).join('') + '</div>'
    });
  }

  function isTyping(t) {
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  var gPressed = 0;
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.code === 'KeyK') {
      e.preventDefault();
      openPalette();
      return;
    }
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (document.body.classList.contains('has-modal')) return;

    if (gPressed && Date.now() - gPressed < 1500) {
      gPressed = 0;
      var target = goTargets().filter(function (g) { return g[0] === e.code; })[0];
      if (target) { e.preventDefault(); location.href = ROOT + target[2]; }
      return;
    }
    if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) { e.preventDefault(); showHotkeys(); }
    else if (e.code === 'Slash') { e.preventDefault(); openPalette(); }
    else if (e.code === 'KeyG' && !e.shiftKey) { gPressed = Date.now(); }
    else if (e.code === 'KeyT' && !e.shiftKey) { toggleTheme(); }
  });

  /* Кнопки в оболочке (рисует js/ui.js) */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('[data-palette]')) {
      e.preventDefault();
      var nav = document.getElementById('nav-toggle');
      if (nav) nav.checked = false;   // закрываем мобильное меню, если поиск открыт из него
      openPalette();
    } else if (e.target.closest('[data-theme-toggle]')) {
      e.preventDefault();
      toggleTheme(e.target.closest('[data-theme-toggle]'));
    } else if (e.target.closest('[data-hotkeys]')) {
      e.preventDefault();
      showHotkeys();
    }
  });

  /* ================= 4. Анимации при прокрутке и счётчики ================= */
  // Блоки ниже первого экрана выезжают, когда до них доходит прокрутка; карточки в ряду — с небольшим сдвигом
  function setupReveal() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        el.classList.add('is-revealed');
        // После появления снимаем классы, чтобы не мешать hover-эффектам карточек
        setTimeout(function () { el.classList.remove('reveal', 'is-revealed'); el.style.removeProperty('--d'); }, 1000);
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.1 });

    var fold = window.innerHeight;
    $$('#page .grid > *, #page .card:not(.grid .card), #page .table-box, #page .table-scroll, #page .org-scroll, .site-footer').forEach(function (el) {
      if (el.getBoundingClientRect().top < fold) return;      // первый экран анимируется при загрузке
      if (el.parentElement.closest('.reveal')) return;        // родитель уже выезжает целиком
      if (el.parentElement.classList.contains('grid')) {
        el.style.setProperty('--d', (Array.prototype.indexOf.call(el.parentElement.children, el) % 4) * 80 + 'ms');
      }
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  // Числа в карточках статистики «набегают» от нуля с замедлением к концу
  function countUp() {
    if (reduceMotion) return;
    $$('#page .stat-value').forEach(function (el) {
      var text = el.textContent.trim();
      if (!/^\d+$/.test(text)) return;
      var target = Number(text), start = null, DURATION = 1000;
      el.textContent = '0';
      function step(ts) {
        if (start === null) start = ts;
        var t = Math.min(1, (ts - start) / DURATION);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    });
  }

  /* ================= 5. «Наверх», прогресс чтения, время чтения ================= */
  function readingTime() {
    var meta = $('.article-meta'), body = $('.news-html');
    if (!meta || !body) return;
    var words = (body.textContent || '').trim().split(/\s+/).length;
    var minutes = Math.max(1, Math.round(words / 180));
    meta.insertAdjacentHTML('beforeend', '<span class="read-time">' + UI.icon('clock') + minutes + ' мин чтения</span>');
  }

  function setupScroll() {
    // Кнопка «Наверх»: двойная стрелка и кольцо, которое заполняется по мере прокрутки страницы
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'to-top';
    btn.title = 'Наверх';
    btn.setAttribute('aria-label', 'Наверх');
    btn.innerHTML =
      '<svg class="to-top-ring" viewBox="0 0 48 48" aria-hidden="true">' +
        '<circle class="to-top-track" cx="24" cy="24" r="22"/>' +
        '<circle class="to-top-fill" cx="24" cy="24" r="22" pathLength="100"/>' +
      '</svg>' + UI.icon('chevrons-up');
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    document.body.appendChild(btn);
    var ring = $('.to-top-fill', btn);

    // Полоса прогресса чтения сверху: в статье — до конца текста статьи, на остальных страницах — до конца страницы
    var bar = document.createElement('div');
    bar.className = 'read-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var article = $('.article');

    function clamp(v) { return Math.max(0, Math.min(1, v)); }

    var queued = false;
    function update() {
      queued = false;
      var y = window.pageYOffset || root.scrollTop;
      var pageMax = root.scrollHeight - window.innerHeight;
      var page = pageMax > 0 ? clamp(y / pageMax) : 0;

      btn.classList.toggle('is-visible', y > 400);
      ring.style.strokeDashoffset = String(100 - page * 100);

      var readMax = article ? article.getBoundingClientRect().bottom + y + 24 - window.innerHeight : pageMax;
      bar.style.transform = 'scaleX(' + (readMax > 0 ? clamp(y / readMax) : 1) + ')';
      bar.classList.toggle('is-hidden', pageMax < 80);   // страница почти не прокручивается — полоса не нужна
    }
    window.addEventListener('scroll', function () {
      if (!queued) { queued = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* Запуск после того, как ui.js построил оболочку, а portal.js / admin.js — содержимое страницы */
  document.addEventListener('DOMContentLoaded', function () {
    staggerItems();
    readingTime();
    setupScroll();
    setupReveal();
    countUp();
    syncThemeButtons();
  });
})();
