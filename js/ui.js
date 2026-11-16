/* Общие помощники: форматирование, модальные окна, тосты, формы, оболочка
   (сайдбар + шапка) и карточка сотрудника. Классические скрипты без модулей —
   чтобы сайт открывался двойным кликом (file://). */
(function () {
  'use strict';

  var DB = window.DB;
  var UI = {};
  window.UI = UI;

  /* Корень сайта (абсолютный URL) — вычисляется от адреса этого скрипта, поэтому
     пути к картинкам одинаково работают из корня, из admin/, через file:// и на GitHub Pages. */
  var ROOT = ((document.currentScript && document.currentScript.src) || '').replace(/js\/ui\.js(?:[?#].*)?$/, '');
  UI.root = ROOT;
  UI.asset = function (path) { return ROOT + path; };

  /* ---------- Утилиты ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  UI.$ = $; UI.$$ = $$;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  UI.esc = esc;

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  UI.find = find;
  UI.user = function (id) { return find(DB.users, id); };
  UI.nameOf = function (list, id, fallback) { var x = find(list, id); return x ? x.name : (fallback || '—'); };

  UI.fullName = function (u) { return [u.last, u.first, u.patr].filter(Boolean).join(' '); };
  UI.shortName = function (u) {
    return [u.last, u.first ? u.first.charAt(0) + '.' : '', u.patr ? u.patr.charAt(0) + '.' : ''].filter(Boolean).join(' ');
  };
  UI.initials = function (u) { return ((u.last || '').charAt(0) + (u.first || '').charAt(0)).toUpperCase(); };

  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  UI.MONTHS = MONTHS;
  UI.birthdayText = function (u) { return u.bday + ' ' + MONTHS_GEN[u.bm - 1]; };

  function parse(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  UI.parse = parse;
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  UI.fmt = function (iso) { if (!iso) return '—'; var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; };
  UI.fmtShort = function (iso) { var p = iso.split('-'); return p[2] + '.' + p[1]; };
  UI.diffDays = function (a, b) { return Math.round((a.getTime() - b.getTime()) / 86400000); };
  UI.daysFromToday = function (iso) { return UI.diffDays(parse(iso), DB.today()); };
  UI.spanDays = function (from, to) { return UI.diffDays(parse(to), parse(from)) + 1; };
  UI.pad = pad;

  UI.plural = function (n, one, few, many) {
    var m = Math.abs(n) % 100, d = m % 10;
    if (m > 10 && m < 20) return many;
    if (d > 1 && d < 5) return few;
    if (d === 1) return one;
    return many;
  };

  UI.daysLabel = function (n) {
    if (n === 0) return 'сегодня';
    if (n === 1) return 'завтра';
    if (n === 2 || n === 3 || n === 4) return 'через ' + n + ' дня';
    return 'через ' + n + ' дн.';
  };

  /* ---------- Иконки ---------- */
  UI.icon = function (name, cls) { return '<i class="ico ico-' + name + (cls ? ' ' + cls : '') + '"></i>'; };

  /* Аватар: фото, если оно есть, иначе инициалы. alt пустой — имя всегда выводится рядом. */
  UI.avatar = function (u, cls) {
    if (u.photo) {
      return '<span class="avatar has-photo ' + (cls || '') + '"><img src="' + esc(UI.asset(u.photo)) + '" alt="" loading="lazy" decoding="async"></span>';
    }
    return '<span class="avatar ' + (cls || '') + '">' + esc(UI.initials(u)) + '</span>';
  };

  /* ---------- Отпуска: кто сейчас вне офиса ---------- */
  UI.currentVacations = function () {
    return DB.vacations.filter(function (v) {
      return v.status === 'approved' && UI.daysFromToday(v.from) <= 0 && UI.daysFromToday(v.to) >= 0;
    });
  };
  UI.onVacationMap = function () {
    var map = {};
    UI.currentVacations().forEach(function (v) { map[v.user] = v.to; });
    return map;
  };
  UI.vacMark = function (userId, map) {
    var to = (map || UI.onVacationMap())[userId];
    return to ? '<span class="vac-mark" title="Сейчас в отпуске">в отпуске до ' + UI.fmtShort(to) + '</span>' : '';
  };

  /* ---------- Тосты ---------- */
  var toastBox;
  UI.toast = function (text, kind) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'toast-box';
      document.body.appendChild(toastBox);
    }
    var t = document.createElement('div');
    t.className = 'toast toast-' + (kind || 'success');
    t.textContent = text;
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  };

  /* ---------- Модальные окна ---------- */
  var modals = [];

  function syncBody() { document.body.classList.toggle('has-modal', modals.length > 0); }

  /* opts: title, html | node, width, centered, footer: [{text, primary, danger, close, onClick}],
     onClose, cls. Возвращает {el, body, close}. */
  UI.modal = function (opts) {
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap' + (opts.centered ? ' is-centered' : '');
    wrap.style.zIndex = String(1000 + modals.length * 10);
    var footer = opts.footer && opts.footer.length;
    wrap.innerHTML =
      '<div class="modal-mask"></div>' +
      '<div class="modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true" style="width:' + (opts.width || 520) + 'px">' +
        '<button type="button" class="modal-close" aria-label="Закрыть">&times;</button>' +
        (opts.title ? '<div class="modal-head"><div class="modal-title">' + opts.title + '</div></div>' : '') +
        '<div class="modal-body"></div>' +
        (footer ? '<div class="modal-foot"></div>' : '') +
      '</div>';
    var body = $('.modal-body', wrap);
    if (opts.node) body.appendChild(opts.node); else body.innerHTML = opts.html || '';

    var api = { el: wrap, body: body };
    api.close = function () {
      var i = modals.indexOf(api);
      if (i < 0) return;
      modals.splice(i, 1);
      wrap.classList.add('is-closing');
      setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 120);
      syncBody();
      if (opts.onClose) opts.onClose();
    };

    if (footer) {
      var foot = $('.modal-foot', wrap);
      opts.footer.forEach(function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn' + (b.primary ? ' btn-primary' : '') + (b.danger ? ' btn-danger' : '');
        btn.innerHTML = b.text;
        btn.addEventListener('click', function () {
          var keep = b.onClick ? b.onClick(api) === false : false;
          if (!keep && b.close !== false) api.close();
        });
        foot.appendChild(btn);
      });
    }

    $('.modal-close', wrap).addEventListener('click', api.close);
    $('.modal-mask', wrap).addEventListener('click', api.close);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) api.close(); });

    document.body.appendChild(wrap);
    modals.push(api);
    syncBody();
    var first = $('input:not([type=hidden]), textarea, select', body);
    if (first && opts.focus !== false) setTimeout(function () { first.focus(); }, 30);
    return api;
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modals.length) modals[modals.length - 1].close();
  });

  UI.confirm = function (text, onOk, okText) {
    UI.modal({
      title: 'Подтверждение', width: 420, centered: true,
      html: '<p style="margin:0">' + text + '</p>',
      footer: [
        { text: 'Отмена' },
        { text: okText || 'Удалить', primary: true, onClick: function () { onOk(); } }
      ]
    });
  };

  /* ---------- Формы ---------- */
  /* fields: [{name,label,type,options,required,placeholder,help,rows}]
     type: text|email|number|date|textarea|select|checkbox|checkgroup|radio */
  function optList(f) {
    return (f.options || []).map(function (o) { return typeof o === 'object' ? o : { v: o, t: o }; });
  }

  UI.formHtml = function (fields, values) {
    values = values || {};
    return '<form class="form" novalidate>' + fields.map(function (f) {
      var v = values[f.name];
      var req = f.required ? '<em class="req">*</em>' : '';
      var inner;
      if (f.type === 'textarea') {
        inner = '<textarea class="control" name="' + f.name + '" rows="' + (f.rows || 4) + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(v) + '</textarea>';
      } else if (f.type === 'select') {
        inner = '<select class="control select" name="' + f.name + '">' + optList(f).map(function (o) {
          return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(v == null ? '' : v) ? ' selected' : '') + '>' + esc(o.t) + '</option>';
        }).join('') + '</select>';
      } else if (f.type === 'checkbox') {
        return '<label class="check field"><input type="checkbox" name="' + f.name + '"' + (v ? ' checked' : '') + '><span>' + f.label + '</span></label>';
      } else if (f.type === 'checkgroup' || f.type === 'radio') {
        var kind = f.type === 'radio' ? 'radio' : 'checkbox';
        var sel = Array.isArray(v) ? v : (v ? [v] : []);
        inner = '<div class="choices">' + optList(f).map(function (o) {
          return '<label class="check"><input type="' + kind + '" name="' + f.name + '" value="' + esc(o.v) + '"' + (sel.indexOf(o.v) >= 0 ? ' checked' : '') + '><span>' + esc(o.t) + '</span></label>';
        }).join('') + '</div>';
      } else {
        inner = '<input class="control" type="' + (f.type || 'text') + '" name="' + f.name + '" value="' + esc(v) + '" placeholder="' + esc(f.placeholder || '') + '">';
      }
      return '<div class="field" data-field="' + f.name + '"><span class="field-label">' + f.label + req + '</span>' + inner +
        (f.help ? '<span class="field-help">' + f.help + '</span>' : '') + '<span class="field-err"></span></div>';
    }).join('') + '</form>';
  };

  /* Возвращает значения или null, если есть ошибки (они подсвечиваются). */
  UI.readForm = function (root, fields) {
    var out = {}, ok = true;
    fields.forEach(function (f) {
      var box = $('[data-field="' + f.name + '"]', root);
      var err = box && $('.field-err', box);
      if (err) err.textContent = '';
      if (box) box.classList.remove('has-error');
      var val;
      if (f.type === 'checkbox') {
        val = $('[name="' + f.name + '"]', root).checked;
      } else if (f.type === 'checkgroup') {
        val = $$('[name="' + f.name + '"]:checked', root).map(function (i) { return i.value; });
      } else if (f.type === 'radio') {
        var r = $('[name="' + f.name + '"]:checked', root);
        val = r ? r.value : '';
      } else {
        val = $('[name="' + f.name + '"]', root).value.trim();
        if (f.type === 'number' && val !== '') val = Number(val);
      }
      var empty = val === '' || (Array.isArray(val) && !val.length);
      if (f.required && empty) {
        ok = false;
        if (box) { box.classList.add('has-error'); err.textContent = 'Обязательное поле'; }
      } else if (f.type === 'email' && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) {
        ok = false;
        if (box) { box.classList.add('has-error'); err.textContent = 'Введите корректный адрес'; }
      }
      out[f.name] = val;
    });
    return ok ? out : null;
  };

  /* ---------- Выпадающая панель (фильтры, уведомления) ---------- */
  var openDd = null;
  function closeDd() {
    if (openDd) { openDd.panel.remove(); openDd.btn.classList.remove('is-open'); openDd = null; }
  }
  UI.closeDropdown = closeDd;

  /* render(panel) наполняет панель; align: 'left' | 'right' */
  UI.dropdown = function (btn, render, opts) {
    opts = opts || {};
    if (openDd && openDd.btn === btn) { closeDd(); return; }
    closeDd();
    var panel = document.createElement('div');
    panel.className = 'dd-panel';
    if (opts.width) panel.style.width = opts.width + 'px';
    var host = btn.parentNode;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(panel);
    panel.classList.add(opts.align === 'right' ? 'is-right' : 'is-left');
    if (opts.up) panel.classList.add('is-up');
    btn.classList.add('is-open');
    openDd = { btn: btn, panel: panel };
    render(panel);
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
  };
  document.addEventListener('click', function (e) {
    if (openDd && !openDd.btn.contains(e.target)) closeDd();
  });

  /* ---------- Карточка сотрудника ---------- */
  function vacationBlock(u) {
    var today = DB.today();
    var list = DB.vacations.filter(function (v) {
      return v.user === u.id && (v.status === 'approved') && UI.daysFromToday(v.to) >= 0;
    }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    var subs = DB.substitutions.filter(function (s) { return UI.daysFromToday(s.to) >= 0; });
    var replacing = subs.filter(function (s) { return s.substitute === u.id; });
    var replacedBy = subs.filter(function (s) { return s.user === u.id; });

    var html = '<div class="card-extra"><div class="extra-title">Отпуска</div>';
    if (!list.length) {
      html += '<div class="muted">Нет запланированных отпусков</div>';
    } else {
      html += list.map(function (v) {
        var cur = UI.daysFromToday(v.from) <= 0 && UI.daysFromToday(v.to) >= 0;
        return '<div class="extra-line"><span>' + UI.fmt(v.from) + ' – ' + UI.fmt(v.to) + '</span>' +
          (cur ? '<span class="tag tag-primary">Сейчас в отпуске до ' + UI.fmtShort(v.to) + '</span>' : '') + '</div>';
      }).join('');
    }
    html += '</div>';
    function subBlock(title, items, who) {
      if (!items.length) return '';
      return '<div class="card-extra"><div class="extra-title">' + title + '</div>' + items.map(function (s) {
        var p = UI.user(s[who]);
        return '<div class="extra-line extra-col"><span>' + esc(UI.fullName(p)) + '</span>' +
          '<span class="muted small">' + UI.fmt(s.from) + ' – ' + UI.fmt(s.to) + '</span>' +
          (s.order ? '<span class="muted small">' + esc(s.order) + '</span>' : '') + '</div>';
      }).join('') + '</div>';
    }
    html += subBlock('Замещает', replacing, 'user');
    html += subBlock('Его замещает', replacedBy, 'substitute');
    return html;
  }

  UI.userCard = function (id) {
    var u = UI.user(id);
    if (!u) return;
    var role = find(DB.roles, u.role);
    var mgr = u.manager ? UI.user(u.manager) : null;
    var rows = [
      ['Email', '<a href="mailto:' + esc(u.email) + '">' + esc(u.email) + '</a>'],
      ['Внутренний номер', esc(u.vn || '—')],
      ['Должность', esc(UI.nameOf(DB.positions, u.position))],
      ['Подразделение', esc(UI.nameOf(DB.orgUnits, u.unit))],
      ['Руководитель', mgr ? '<a href="#" data-user="' + mgr.id + '">' + esc(UI.fullName(mgr)) + '</a>' : '—'],
      ['Город', esc(UI.nameOf(DB.cities, u.city))]
    ];
    if (u.info) rows.push(['О себе', '<span class="pre">' + esc(u.info) + '</span>']);
    if (u.bm) rows.push(['День рождения', UI.birthdayText(u)]);

    UI.modal({
      width: 520, centered: true, cls: 'user-modal',
      html:
        '<div class="user-head">' +
          UI.avatar(u, 'avatar-xl') +
          '<h4>' + esc(UI.fullName(u)) + '</h4>' +
          '<span class="tag ' + (u.role === 'admin' ? 'tag-primary' : 'tag-navy') + '">' + esc(role ? role.name : '') + '</span>' +
        '</div>' +
        '<dl class="desc desc-sm">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
        vacationBlock(u)
    });
  };

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-user]') : null;
    if (!t) return;
    e.preventDefault();
    UI.userCard(t.getAttribute('data-user'));
  });

  /* ---------- Оболочка (сайдбар, шапка) ---------- */
  var PORTAL_MENU = [
    ['index.html', 'dashboard', 'Дашборд', 'dashboard'],
    ['news.html', 'bell', 'Новости', 'news'],
    ['surveys.html', 'survey', 'Опросы', 'surveys'],
    ['employees.html', 'users', 'Сотрудники', 'employees'],
    ['org.html', 'org', 'Оргструктура', 'org'],
    ['vacations.html', 'calendar', 'Отпуска', 'vacations'],
    ['requests.html', 'file', 'Заявки', 'requests'],
    ['vpn.html', 'shield', 'VPN', 'vpn'],
    ['knowledge.html', 'book', 'База знаний', 'knowledge']
  ];

  var ADMIN_MENU = [
    { group: 'Пользователи', icon: 'users', items: [
      ['users.html', 'Сотрудники', 'users'], ['roles.html', 'Роли', 'roles'], ['permissions.html', 'Разрешения', 'permissions'],
      ['org-units.html', 'Оргструктура', 'org-units'], ['positions.html', 'Должности', 'positions'], ['cities.html', 'Города', 'cities'] ] },
    { group: 'Новости', icon: 'bell', items: [
      ['news.html', 'Статьи', 'news'], ['news-categories.html', 'Категории новостей', 'news-categories'] ] },
    { group: 'Опросы', icon: 'survey', items: [['surveys.html', 'Опросы', 'surveys']] },
    { group: 'Отпуска', icon: 'calendar', items: [
      ['vacations.html', 'Очередь и журнал', 'vacations'], ['vacations-calendar.html', 'Календарь', 'vacations-calendar'], ['vacation-settings.html', 'Настройки', 'vacation-settings'] ] },
    { group: 'Заявки', icon: 'file', items: [
      ['request-types.html', 'Типы заявок', 'request-types'], ['request-categories.html', 'Категории заявок', 'request-categories'] ] },
    { group: 'База знаний', icon: 'book', items: [
      ['knowledge-items.html', 'Материалы', 'knowledge-items'], ['knowledge-sections.html', 'Разделы', 'knowledge-sections'], ['knowledge-types.html', 'Типы знаний', 'knowledge-types'] ] },
    { link: ['letters.html', 'Сроковые письма', 'letters', 'mail'] },
    { link: ['substitutions.html', 'Замещения', 'substitutions', 'swap'] },
    { link: ['services.html', 'Сервисы', 'services', 'apps'] },
    { link: ['vpn.html', 'VPN', 'vpn', 'shield'] },
    { link: ['audit.html', 'Журнал аудита', 'audit', 'audit'] }
  ];

  UI.menus = { portal: PORTAL_MENU, admin: ADMIN_MENU };

  function unreadCount() { return DB.notifications.filter(function (n) { return !n.read; }).length; }

  /* Логотип: знак из images/logo.svg + название текстом (alt пустой — название и так рядом) */
  var BRAND = 'Орбита';
  function brand(base) {
    return '<span class="brand"><img src="' + base + 'images/logo.svg" alt="" width="44" height="30">' + BRAND + '</span>';
  }

  /* Подвал: логотип (на светлом фоне — тёмный вариант знака, на тёмной теме — белый) и правовая информация */
  function footer() {
    return '<footer class="site-footer">' +
      '<div class="footer-brand">' +
        '<span class="footer-logo">' +
          '<img class="logo-on-light" src="' + ROOT + 'images/logo-navy.svg" alt="" width="44" height="30">' +
          '<img class="logo-on-dark" src="' + ROOT + 'images/logo.svg" alt="" width="44" height="30">' +
        '</span>' +
        '<div><b>' + BRAND + '</b> — корпоративный портал сотрудников ООО «' + BRAND + '».' +
        '<span>Новости, коллеги, отпуска, заявки и база знаний — в одном месте.</span>' +
        '<span class="footer-copy">© ' + new Date().getFullYear() + ' ООО «' + BRAND + '». Все права защищены.</span></div>' +
      '</div>' +
      '<div class="footer-legal">' +
        '<span>Информация на портале предназначена только для сотрудников компании.</span>' +
        '<button type="button" class="footer-link" data-hotkeys>Горячие клавиши</button>' +
      '</div>' +
      '</footer>';
  }

  /* Кнопки фич (обработчики — в js/features.js): быстрый поиск и переключатель темы */
  UI.modKey = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  function searchButton() {
    return '<button type="button" class="sider-search" data-palette>' + UI.icon('search') +
      '<span>Поиск</span><kbd>' + UI.modKey + ' K</kbd></button>';
  }
  UI.themeToggleInner = function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return UI.icon(dark ? 'sun' : 'moon') + (dark ? 'Светлая тема' : 'Тёмная тема');
  };
  function themeRow() {
    return '<button type="button" class="rail-row" data-theme-toggle>' + UI.themeToggleInner() + '</button>';
  }

  function railUser(base, portalDir) {
    var me = UI.user(DB.me);
    return '<div class="rail-user">' +
      '<a class="rail-user-link" href="' + portalDir + 'profile.html">' + UI.avatar(me, 'avatar-xs') +
      '<span class="name">' + esc(UI.shortName(me)) + '</span></a>' +
      '<button type="button" class="bell-btn' + (unreadCount() ? ' dot' : '') + '" data-bell title="Уведомления">' + UI.icon('bell') + '</button></div>';
  }

  function portalShell(base, active) {
    var menu = PORTAL_MENU.map(function (m) {
      var dot = (m[3] === 'news' || m[3] === 'requests') && unreadCount() ? ' dot' : '';
      return '<a href="' + m[0] + '"' + (m[3] === active ? ' class="is-active"' : '') + '><span class="' + dot.trim() + '">' + UI.icon(m[1]) + '</span>' + m[2] + '</a>';
    }).join('');
    var me = UI.user(DB.me);
    var isAdmin = me.role === 'admin';
    return '' +
      '<input type="checkbox" id="nav-toggle" class="nav-toggle" aria-hidden="true" tabindex="-1">' +
      '<header class="mobile-header">' +
        '<div class="side"><label for="nav-toggle" class="burger" aria-label="Меню">' + UI.icon('menu') + '</label></div>' +
        '<a class="logo" href="index.html">' + brand('') + '</a>' +
        '<div class="side">' +
          (active === 'dashboard' ? '<button type="button" class="online-mini" data-online>' + onlineUsers().length + '</button>' : '') +
          '<button type="button" class="hdr-btn" data-palette aria-label="Поиск">' + UI.icon('search') + '</button>' +
          '<button type="button" class="bell bell-btn' + (unreadCount() ? ' dot' : '') + '" data-bell aria-label="Уведомления">' + UI.icon('bell') + '</button>' +
        '</div>' +
      '</header>' +
      '<label class="nav-overlay" for="nav-toggle"></label>' +
      '<aside class="sider">' +
        '<a class="sider-logo" href="index.html">' + brand('') + '</a>' +
        searchButton() +
        '<nav class="menu">' + menu + '</nav>' +
        '<div class="rail">' +
          '<a class="rail-row" href="services.html">' + UI.icon('apps') + 'Сервисы</a>' +
          (isAdmin ? '<a class="rail-row" href="admin/users.html">' + UI.icon('settings') + 'Администрирование</a>' : '') +
          themeRow() +
          railUser(base, '') +
        '</div>' +
      '</aside>';
  }

  function adminShell(active) {
    var menu = ADMIN_MENU.map(function (g) {
      if (g.link) {
        var l = g.link;
        return '<a class="menu-link' + (l[2] === active ? ' is-active' : '') + '" href="' + l[0] + '">' + UI.icon(l[3]) + l[1] + '</a>';
      }
      var open = g.items.some(function (i) { return i[2] === active; });
      return '<details class="menu-group"' + (open ? ' open' : '') + '><summary>' + UI.icon(g.icon) + g.group + '<i class="ico ico-chevron arrow"></i></summary>' +
        g.items.map(function (i) {
          return '<a class="menu-sub' + (i[2] === active ? ' is-active' : '') + '" href="' + i[0] + '">' + i[1] + '</a>';
        }).join('') + '</details>';
    }).join('');
    return '' +
      '<input type="checkbox" id="nav-toggle" class="nav-toggle" aria-hidden="true" tabindex="-1">' +
      '<label class="nav-overlay" for="nav-toggle"></label>' +
      '<aside class="sider admin-sider">' +
        '<div class="sider-logo admin-logo">' + brand('../') + '<div class="admin-title">Администрирование</div></div>' +
        searchButton() +
        '<nav class="menu admin-menu">' + menu + '</nav>' +
        '<div class="rail">' +
          '<a class="rail-row" href="../services.html">' + UI.icon('apps') + 'Сервисы</a>' +
          '<a class="rail-row" href="../index.html">' + UI.icon('home') + 'Портал</a>' +
          themeRow() +
          railUser('../', '../') +
        '</div>' +
      '</aside>';
  }

  function onlineUsers() {
    var ids = ['u13', 'u2', 'u3', 'u4', 'u6', 'u8', 'u10', 'u12', 'u14', 'u15', 'u17', 'u18', 'u20', 'u22'];
    return ids.map(UI.user).filter(Boolean);
  }

  function notificationsPanel(panel, btn) {
    function paint() {
      panel.innerHTML =
        '<div class="dd-head"><strong>Уведомления</strong>' +
        '<button type="button" class="btn btn-link" data-read-all>Прочитать все</button></div>' +
        (DB.notifications.length ? DB.notifications.map(function (n) {
          return '<a class="notice' + (n.read ? '' : ' is-unread') + '" href="' + n.href + '" data-nid="' + n.id + '">' +
            '<span class="notice-text">' + esc(n.text) + '</span><span class="muted small">' + esc(n.at) + '</span></a>';
        }).join('') : '<div class="empty">Нет уведомлений</div>');
      $('[data-read-all]', panel).addEventListener('click', function () {
        DB.notifications.forEach(function (n) { n.read = true; });
        DB.save();
        $$('[data-bell]').forEach(function (b) { b.classList.remove('dot'); });
        paint();
      });
      $$('[data-nid]', panel).forEach(function (a) {
        a.addEventListener('click', function () {
          var n = find(DB.notifications, a.getAttribute('data-nid'));
          if (n) { n.read = true; DB.save(); }
        });
      });
    }
    paint();
  }

  UI.mount = function () {
    var area = document.body.getAttribute('data-area') || 'portal';
    var active = document.body.getAttribute('data-nav') || '';
    var page = $('#page');
    if (!page) return;
    if (area === 'plain') return;

    var shell = document.createElement('div');
    shell.className = 'shell ' + (area === 'admin' ? 'shell-admin' : 'shell-portal');
    var main = document.createElement('div');
    main.className = 'main';

    if (area === 'admin') {
      shell.innerHTML = adminShell(active);
      var head = document.createElement('header');
      head.className = 'admin-header';
      head.innerHTML = '<label for="nav-toggle" class="burger burger-dark" aria-label="Меню">' + UI.icon('menu') + '</label><span class="spacer"></span>' +
        '<button type="button" class="bell-btn bell-dark only-mobile" data-palette aria-label="Поиск">' + UI.icon('search') + '</button>' +
        '<button type="button" class="bell-btn bell-dark' + (unreadCount() ? ' dot' : '') + ' only-mobile" data-bell>' + UI.icon('bell') + '</button>' +
        '<a class="btn btn-link" href="../login.html">' + UI.icon('logout') + '<span class="hide-mobile">Выйти</span></a>';
      main.appendChild(head);
    } else {
      shell.innerHTML = portalShell('', active);
    }

    page.parentNode.insertBefore(shell, page);
    main.appendChild(page);
    main.insertAdjacentHTML('beforeend', footer());
    shell.appendChild(main);

    if (area === 'portal' && active === 'dashboard') {
      var on = document.createElement('button');
      on.type = 'button';
      on.className = 'online';
      on.setAttribute('data-online', '');
      on.innerHTML = '<span><b>' + onlineUsers().length + '</b> онлайн</span>';
      main.insertBefore(on, page);
    }
  };

  document.addEventListener('click', function (e) {
    var bell = e.target.closest && e.target.closest('[data-bell]');
    if (bell) {
      e.preventDefault();
      var host = bell.parentNode;
      UI.dropdown(bell, function (panel) { notificationsPanel(panel, bell); }, { width: 340, align: 'left', up: bell.closest('.rail-user') !== null });
      return;
    }
    var on = e.target.closest && e.target.closest('[data-online]');
    if (on) {
      var list = onlineUsers();
      UI.modal({
        title: 'Сейчас онлайн · ' + list.length, width: 420, centered: true,
        html: '<div class="list-plain">' + list.map(function (u) {
          return '<a class="row" href="#" data-user="' + u.id + '">' + UI.avatar(u, 'avatar-sm') +
            '<div class="grow"><span class="name">' + esc(UI.fullName(u)) + '</span><span class="sub">' + esc(UI.nameOf(DB.positions, u.position)) + '</span></div></a>';
        }).join('') + '</div>'
      });
    }
  });

  /* ---------- Таблица-пагинация ---------- */
  UI.pager = function (total, page, size) {
    var pages = Math.max(1, Math.ceil(total / size));
    if (pages <= 1) return '';
    var out = '<nav class="pager" aria-label="Страницы">' +
      (page > 1 ? '<a href="#" data-pg="' + (page - 1) + '">‹</a>' : '<span class="is-disabled">‹</span>');
    for (var i = 1; i <= pages; i++) {
      out += i === page ? '<span class="is-active">' + i + '</span>' : '<a href="#" data-pg="' + i + '">' + i + '</a>';
    }
    out += (page < pages ? '<a href="#" data-pg="' + (page + 1) + '">›</a>' : '<span class="is-disabled">›</span>') + '</nav>';
    return out;
  };

  /* Поиск без учёта регистра и «ё» */
  UI.norm = function (s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); };

  UI.params = function () {
    var out = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (p) {
      if (!p) return;
      var kv = p.split('=');
      out[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
    });
    return out;
  };

  UI.statusTag = function (map, key) {
    var s = map[key] || { t: key, c: '' };
    return '<span class="tag ' + s.c + '">' + esc(s.t) + '</span>';
  };

  document.addEventListener('DOMContentLoaded', function () {
    UI.mount();
    document.dispatchEvent(new CustomEvent('shell-ready'));
  });
})();
