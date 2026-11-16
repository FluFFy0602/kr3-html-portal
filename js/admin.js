/* Администрирование. Выбор страницы — по data-page="a-<раздел>" на <body>. */
(function () {
  'use strict';

  var DB = window.DB, UI = window.UI;
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;
  var adm = {};

  function opts(list, label) {
    return list.map(function (x) { return { v: x.id, t: label ? label(x) : x.name }; });
  }
  function userOpts(empty) {
    var o = DB.users.filter(function (u) { return u.active; }).map(function (u) { return { v: u.id, t: UI.fullName(u) }; });
    return empty ? [{ v: '', t: empty }].concat(o) : o;
  }
  function yesNo(v) { return v ? '<span class="tag tag-success">Да</span>' : '<span class="tag">Нет</span>'; }
  function activeTag(v) { return v ? '<span class="tag tag-success">Активен</span>' : '<span class="tag">Скрыт</span>'; }
  function uname(id) { var u = id ? UI.user(id) : null; return u ? esc(UI.shortName(u)) : '—'; }
  function title(root, text, right) {
    return '<div class="page-head"><h4>' + text + '</h4>' + (right || '') + '</div>';
  }

  /* ---------- Универсальная страница-справочник ---------- */
  /* cfg: title, items(), cols: [[заголовок, fn(item)]], fields, defaults, filters, search(item),
          addText, make(data) → новый элемент, apply(item, data), canDelete(item), nameOf(item), extra(item) → html кнопок */
  function crud(root, cfg) {
    var st = { q: '', f: {} };

    function draw() {
      var q = UI.norm(st.q);
      var items = cfg.items().filter(function (it) {
        for (var i = 0; i < (cfg.filters || []).length; i++) {
          var f = cfg.filters[i], val = st.f[f.key];
          if (val && !f.test(it, val)) return false;
        }
        return !q || !cfg.search || UI.norm(cfg.search(it)).indexOf(q) >= 0;
      });
      $('#cr-body').innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr>' +
        cfg.cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '<th>Действия</th></tr></thead><tbody>' +
        items.map(function (it, idx) {
          var del = !cfg.canDelete || cfg.canDelete(it);
          return '<tr>' + cfg.cols.map(function (c) { return '<td>' + c[1](it) + '</td>'; }).join('') +
            '<td class="nowrap">' + (cfg.extra ? cfg.extra(it) : '') +
            '<button type="button" class="btn btn-link" data-edit="' + idx + '">Изменить</button> ' +
            (cfg.noDelete ? '' : '<button type="button" class="btn btn-link link-danger" data-del="' + idx + '"' + (del ? '' : ' disabled title="Нельзя удалить"') + '>Удалить</button>') + '</td></tr>';
        }).join('') + (items.length ? '' : '<tr><td colspan="' + (cfg.cols.length + 1) + '"><div class="empty">Ничего не найдено</div></td></tr>') +
        '</tbody></table></div><p class="muted small" style="margin-top:8px">Записей: ' + items.length + '</p>';
      $$('[data-edit]', root).forEach(function (b) { b.addEventListener('click', function () { edit(items[+b.getAttribute('data-edit')]); }); });
      $$('[data-del]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var it = items[+b.getAttribute('data-del')];
          UI.confirm('Удалить «' + esc(cfg.nameOf ? cfg.nameOf(it) : (it.name || it.title || it.id)) + '»?', function () {
            var list = cfg.items(), i = list.indexOf(it);
            if (cfg.remove) cfg.remove(it); else cfg.store().splice(cfg.store().indexOf(it), 1);
            DB.save(); UI.toast('Удалено'); draw();
          });
        });
      });
      if (cfg.onDraw) cfg.onDraw(root, draw);
    }

    function edit(it) {
      var isNew = !it;
      var m = UI.modal({
        title: isNew ? (cfg.addText || 'Добавить') : 'Изменить', width: cfg.width || 520,
        html: UI.formHtml(cfg.fields(it), isNew ? (cfg.defaults || {}) : (cfg.values ? cfg.values(it) : it)),
        footer: [{ text: 'Отмена' }, { text: 'Сохранить', primary: true, onClick: function (api) {
          var d = UI.readForm(api.body, cfg.fields(it));
          if (!d) return false;
          if (cfg.validate) { var err = cfg.validate(d, it); if (err) { UI.toast(err, 'error'); return false; } }
          if (isNew) cfg.store().push(cfg.make(d)); else cfg.apply(it, d);
          DB.save(); UI.toast(isNew ? 'Добавлено' : 'Сохранено'); draw();
        } }]
      });
      return m;
    }

    root.innerHTML = title(root, cfg.title,
      '<div class="toolbar">' + (cfg.filters || []).map(function (f) {
        return '<select class="control select" data-f="' + f.key + '" aria-label="' + esc(f.label) + '"><option value="">' + esc(f.label) + '</option>' +
          f.options.map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.t) + '</option>'; }).join('') + '</select>';
      }).join('') + (cfg.search ? '<label class="input-wrap">' + UI.icon('search') + '<input type="search" id="cr-q" placeholder="Поиск"></label>' : '') +
      (cfg.noAdd ? '' : '<button type="button" class="btn btn-primary" id="cr-add">' + UI.icon('plus') + (cfg.addText || 'Добавить') + '</button>') + '</div>') +
      '<div id="cr-body"></div>';
    $$('[data-f]', root).forEach(function (s) { s.addEventListener('change', function () { st.f[s.getAttribute('data-f')] = s.value; draw(); }); });
    var q = $('#cr-q'); if (q) q.addEventListener('input', function () { st.q = q.value; draw(); });
    var add = $('#cr-add'); if (add) add.addEventListener('click', function () { edit(null); });
    draw();
  }

  function idGen(prefix) { return prefix + Date.now().toString(36); }
  function simple(root, name, key, extraField) {
    crud(root, {
      title: name, addText: 'Добавить', items: function () { return DB[key]; }, store: function () { return DB[key]; },
      cols: [['Название', function (x) { return '<span class="strong">' + esc(x.name) + '</span>'; }], ['Статус', function (x) { return activeTag(x.active); }]],
      search: function (x) { return x.name; },
      filters: [{ key: 'a', label: 'Любой статус', options: [{ v: 'on', t: 'Активные' }, { v: 'off', t: 'Скрытые' }], test: function (x, v) { return v === 'on' ? x.active : !x.active; } }],
      fields: function () { return [{ name: 'name', label: 'Название', type: 'text', required: true }, { name: 'active', label: 'Активен', type: 'checkbox' }]; },
      defaults: { active: true },
      make: function (d) { return { id: idGen(key.slice(0, 2)), name: d.name, active: d.active }; },
      apply: function (it, d) { it.name = d.name; it.active = d.active; }
    });
  }

  /* ================= Сотрудники ================= */
  adm.users = function (root) {
    var st = { q: '', role: '', status: '', emp: 'working' };
    root.innerHTML = title(root, 'Сотрудники', '<div class="toolbar">' +
      '<select class="control select" id="au-role"><option value="">Все роли</option>' + opts(DB.roles).map(function (o) { return '<option value="' + o.v + '">' + esc(o.t) + '</option>'; }).join('') + '</select>' +
      '<select class="control select" id="au-emp"><option value="working">Работают</option><option value="fired">Уволенные</option><option value="all">Все</option></select>' +
      '<label class="input-wrap wide">' + UI.icon('search') + '<input type="search" id="au-q" placeholder="Поиск по ФИО или email"></label>' +
      '<button type="button" class="btn" id="au-reset">Сбросить</button></div>') + '<div id="au-body"></div>';

    function list() {
      var q = UI.norm(st.q);
      var items = DB.users.filter(function (u) {
        if (st.emp === 'working' && !u.active) return false;
        if (st.emp === 'fired' && u.active) return false;
        if (st.role && u.role !== st.role) return false;
        return !q || UI.norm(UI.fullName(u) + ' ' + u.email).indexOf(q) >= 0;
      });
      $('#au-body').innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Сотрудник</th><th>Email</th><th>Роль</th><th>Статус</th><th>Действия</th></tr></thead><tbody>' +
        items.map(function (u) {
          var r = UI.find(DB.roles, u.role);
          return '<tr><td><div class="person">' + UI.avatar(u, 'avatar-sm') + '<div><span class="strong">' + esc(UI.fullName(u)) + '</span><span class="muted small" style="display:block">' + esc(UI.nameOf(DB.positions, u.position)) + '</span></div></div></td>' +
            '<td>' + esc(u.email) + '</td><td><span class="tag ' + (u.role === 'admin' ? 'tag-primary' : 'tag-navy') + '">' + esc(r ? r.name : u.role) + '</span></td>' +
            '<td>' + (u.active ? '<span class="tag tag-success">Работает</span>' : '<span class="tag tag-danger">Уволен ' + UI.fmt(u.fired) + '</span>') + '</td>' +
            '<td><button type="button" class="btn btn-link" data-view="' + u.id + '">Открыть</button></td></tr>';
        }).join('') + (items.length ? '' : '<tr><td colspan="5"><div class="empty">Сотрудники не найдены</div></td></tr>') + '</tbody></table></div><p class="muted small" style="margin-top:8px">Найдено: ' + items.length + '</p>';
      $$('[data-view]', $('#au-body')).forEach(function (b) { b.addEventListener('click', function () { view(b.getAttribute('data-view')); }); });
    }

    function view(id) {
      var u = UI.user(id), r = UI.find(DB.roles, u.role), mgr = u.manager ? UI.user(u.manager) : null;
      function rows(list) { return '<dl class="desc desc-sm">' + list.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl>'; }
      var m = UI.modal({
        width: 640, centered: true,
        html: '<div class="user-head"><span class="avatar avatar-xl">' + esc(UI.initials(u)) + '</span><h4>' + esc(UI.fullName(u)) + '</h4>' +
          '<span class="tag ' + (u.role === 'admin' ? 'tag-primary' : 'tag-navy') + '">' + esc(r.name) + '</span></div>' +
          rows([['Email', esc(u.email)], ['Телефон', esc(u.phone || '—')], ['Внутренний №', esc(u.vn || '—')],
            ['Подразделение', esc(UI.nameOf(DB.orgUnits, u.unit))], ['Должность', esc(UI.nameOf(DB.positions, u.position))], ['Город', esc(UI.nameOf(DB.cities, u.city))],
            ['Руководитель', mgr ? esc(UI.fullName(mgr)) : '—'], ['Дата рождения', u.bm ? UI.birthdayText(u) : '—'], ['Дата найма', UI.fmt(u.hired)],
            ['Роль', esc(r.name)], ['Статус', u.active ? 'Работает' : 'Уволен ' + UI.fmt(u.fired)], ['Последний вход', UI.fmt(u.lastLogin)], ['Создан', UI.fmt(u.created)],
            ['О себе', '<span class="pre">' + esc(u.info || '—') + '</span>']]),
        footer: [{ text: 'Закрыть' }, { text: UI.icon('edit') + 'Редактировать', primary: true, onClick: function () { setTimeout(function () { editUser(u); }, 140); } }]
      });
    }

    function editUser(u) {
      var fields = [
        { name: 'role', label: 'Роль', type: 'select', options: opts(DB.roles) },
        { name: 'unit', label: 'Подразделение', type: 'select', options: opts(DB.orgUnits) },
        { name: 'position', label: 'Должность', type: 'select', options: opts(DB.positions) },
        { name: 'city', label: 'Город', type: 'select', options: opts(DB.cities) },
        { name: 'manager', label: 'Руководитель', type: 'select', options: userOpts('— нет —') },
        { name: 'vn', label: 'Внутренний номер', type: 'text' },
        { name: 'phone', label: 'Телефон', type: 'text' },
        { name: 'hired', label: 'Дата найма', type: 'date' },
        { name: 'active', label: 'Работает в компании', type: 'checkbox' }
      ];
      UI.modal({
        title: 'Редактировать: ' + esc(UI.shortName(u)), width: 520, html: UI.formHtml(fields, u),
        footer: [{ text: 'Отмена' }, { text: 'Сохранить', primary: true, onClick: function (api) {
          var d = UI.readForm(api.body, fields); if (!d) return false;
          if (d.manager === u.id) { UI.toast('Сотрудник не может быть своим руководителем', 'error'); return false; }
          for (var k in d) u[k] = d[k];
          u.fired = u.active ? null : (u.fired || DB.isoOff(0));
          DB.save(); UI.toast('Сохранено'); list();
        } }]
      });
    }

    $('#au-role').addEventListener('change', function (e) { st.role = e.target.value; list(); });
    $('#au-emp').addEventListener('change', function (e) { st.emp = e.target.value; list(); });
    $('#au-q').addEventListener('input', function (e) { st.q = e.target.value; list(); });
    $('#au-reset').addEventListener('click', function () {
      st = { q: '', role: '', status: '', emp: 'working' };
      $('#au-role').value = ''; $('#au-emp').value = 'working'; $('#au-q').value = ''; list();
    });
    list();
  };

  /* ================= Роли и разрешения ================= */
  adm.roles = function (root) {
    crud(root, {
      title: 'Роли', addText: 'Добавить роль', items: function () { return DB.roles; }, store: function () { return DB.roles; },
      cols: [['Название', function (r) { return '<span class="role-dot" style="background:' + esc(r.color) + '"></span><span class="strong">' + esc(r.name) + '</span>'; }],
        ['Код', function (r) { return '<code>' + esc(r.id) + '</code>'; }], ['Разрешений', function (r) { return r.perms; }],
        ['Сотрудников', function (r) { return DB.users.filter(function (u) { return u.role === r.id; }).length; }],
        ['Тип', function (r) { return r.system ? '<span class="tag">Системная</span>' : '<span class="tag tag-info">Своя</span>'; }]],
      search: function (r) { return r.name + ' ' + r.id; },
      canDelete: function (r) { return !r.system && !DB.users.some(function (u) { return u.role === r.id; }); },
      fields: function (r) { return [{ name: 'id', label: 'Код', type: 'text', required: true, help: r ? 'Код нельзя изменить' : 'Латиницей, например auditor' }, { name: 'name', label: 'Название', type: 'text', required: true }, { name: 'color', label: 'Цвет', type: 'text', placeholder: '#1677ff' }]; },
      defaults: { color: '#1677ff' },
      validate: function (d, it) { if (!it && UI.find(DB.roles, d.id)) return 'Роль с таким кодом уже есть'; },
      make: function (d) { return { id: d.id, name: d.name, color: d.color || '#8c8c8c', perms: 0, system: false }; },
      apply: function (it, d) { it.name = d.name; it.color = d.color || it.color; }
    });
    // код у существующей роли не редактируется
    var orig = UI.modal;
  };

  adm.permissions = function (root) {
    DB.rolePerms = DB.rolePerms || {};
    DB.roles.forEach(function (r) {
      if (!DB.rolePerms[r.id]) {
        DB.rolePerms[r.id] = {};
        var n = 0;
        DB.permissionGroups.forEach(function (g, gi) {
          g.items.forEach(function (it, ii) {
            var on = r.id === 'admin' || (r.id === 'hr' && gi >= 4) || (r.id === 'manager' && gi === 4 && ii < 2) || (gi === 6 && ii === 0) || (gi === 4 && ii === 0) || (gi === 5 && ii === 0);
            DB.rolePerms[r.id][gi + ':' + ii] = on; if (on) n++;
          });
        });
      }
    });
    function draw() {
      root.innerHTML = title(root, 'Разрешения', '<span class="muted">Отметьте, что разрешено каждой роли</span>') +
        '<div class="table-scroll"><table class="data-table perm-table"><thead><tr><th>Разрешение</th>' + DB.roles.map(function (r) { return '<th class="ta-center">' + esc(r.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        DB.permissionGroups.map(function (g, gi) {
          return '<tr class="group-row"><td colspan="' + (DB.roles.length + 1) + '">' + esc(g.name) + '</td></tr>' + g.items.map(function (it, ii) {
            return '<tr><td>' + esc(it) + '</td>' + DB.roles.map(function (r) {
              return '<td class="ta-center"><input type="checkbox" data-r="' + r.id + '" data-k="' + gi + ':' + ii + '"' + (DB.rolePerms[r.id][gi + ':' + ii] ? ' checked' : '') + (r.id === 'admin' ? ' disabled' : '') + '></td>';
            }).join('') + '</tr>';
          }).join('');
        }).join('') + '</tbody></table></div>';
      $$('input[data-r]', root).forEach(function (c) {
        c.addEventListener('change', function () {
          var r = c.getAttribute('data-r');
          DB.rolePerms[r][c.getAttribute('data-k')] = c.checked;
          var role = UI.find(DB.roles, r);
          role.perms = Object.keys(DB.rolePerms[r]).filter(function (k) { return DB.rolePerms[r][k]; }).length;
          DB.save(); UI.toast('Разрешение обновлено');
        });
      });
    }
    draw();
  };

  /* ================= Оргструктура, должности, города ================= */
  var TYPES = [['position', 'Должность'], ['department', 'Департамент'], ['division', 'Подразделение'], ['office', 'Отдел'], ['separate_unit', 'Обособленное подразделение'], ['management', 'Управление'], ['direction', 'Направление'], ['section', 'Участок']];
  function typeName(t) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i][0] === t) return TYPES[i][1]; return t; }

  adm['org-units'] = function (root) {
    function depth(u) { var d = 0; while (u.parent) { u = UI.find(DB.orgUnits, u.parent); d++; if (!u) break; } return d; }
    function ordered() {
      var out = [];
      (function walk(pid, lvl) {
        DB.orgUnits.filter(function (u) { return (u.parent || null) === pid; }).forEach(function (u) { u._lvl = lvl; out.push(u); walk(u.id, lvl + 1); });
      })(null, 0);
      return out;
    }
    crud(root, {
      title: 'Оргструктура', addText: 'Добавить подразделение', width: 560,
      items: ordered, store: function () { return DB.orgUnits; },
      cols: [['Название', function (u) { return '<span style="padding-left:' + (u._lvl * 20) + 'px" class="strong">' + (u._lvl ? '└ ' : '') + esc(u.name) + '</span>'; }],
        ['Тип', function (u) { return esc(typeName(u.type)); }], ['Город', function (u) { return esc(UI.nameOf(DB.cities, u.city)); }],
        ['Руководитель', function (u) { return uname(u.head); }], ['Сотрудников', function (u) { return DB.users.filter(function (x) { return x.unit === u.id && x.active; }).length; }],
        ['На схеме', function (u) { return yesNo(u.show !== false); }]],
      search: function (u) { return u.name + ' ' + (u.head ? UI.fullName(UI.user(u.head)) : ''); },
      filters: [{ key: 'city', label: 'Все города', options: opts(DB.cities), test: function (u, v) { return u.city === v; } },
        { key: 'type', label: 'Все типы', options: TYPES.map(function (t) { return { v: t[0], t: t[1] }; }), test: function (u, v) { return u.type === v; } }],
      canDelete: function (u) { return !DB.orgUnits.some(function (x) { return x.parent === u.id; }) && !DB.users.some(function (x) { return x.unit === u.id; }); },
      fields: function () { return [
        { name: 'name', label: 'Название', type: 'text', required: true },
        { name: 'type', label: 'Тип', type: 'select', options: TYPES.map(function (t) { return { v: t[0], t: t[1] }; }) },
        { name: 'parent', label: 'Вышестоящее', type: 'select', options: [{ v: '', t: '— корневое —' }].concat(opts(DB.orgUnits)) },
        { name: 'city', label: 'Город', type: 'select', options: opts(DB.cities) },
        { name: 'head', label: 'Руководитель', type: 'select', options: userOpts('— не назначен —') },
        { name: 'show', label: 'Показывать на схеме', type: 'checkbox' }]; },
      defaults: { type: 'office', city: 'msk', show: true },
      values: function (u) { return { name: u.name, type: u.type, parent: u.parent || '', city: u.city, head: u.head || '', show: u.show !== false }; },
      validate: function (d, it) { if (it && d.parent === it.id) return 'Подразделение не может входить в само себя'; },
      make: function (d) { return { id: idGen('ou'), name: d.name, type: d.type, parent: d.parent || null, city: d.city, head: d.head || null, show: d.show }; },
      apply: function (u, d) { u.name = d.name; u.type = d.type; u.parent = d.parent || null; u.city = d.city; u.head = d.head || null; u.show = d.show; }
    });
  };
  adm.positions = function (root) { simple(root, 'Должности', 'positions'); };
  adm.cities = function (root) { simple(root, 'Города', 'cities'); };

  /* ================= Новости ================= */
  var NEWS_ST = { published: { t: 'Опубликована', c: 'tag-success' }, draft: { t: 'Черновик', c: '' } };
  adm.news = function (root) {
    crud(root, {
      title: 'Статьи', addText: 'Новая статья', width: 680,
      items: function () { return DB.news.slice().sort(function (a, b) { return (b.published || '9') > (a.published || '9') ? 1 : -1; }); }, store: function () { return DB.news; },
      cols: [['Заголовок', function (n) { return '<span class="strong">' + esc(n.title) + '</span>'; }], ['Категория', function (n) { return '<span class="tag tag-primary">' + esc(UI.nameOf(DB.newsCategories, n.cat)) + '</span>'; }],
        ['Автор', function (n) { return uname(n.author); }], ['Дата', function (n) { return UI.fmt(n.published); }], ['Статус', function (n) { return UI.statusTag(NEWS_ST, n.status); }]],
      search: function (n) { return n.title + ' ' + n.content; },
      filters: [{ key: 'st', label: 'Любой статус', options: [{ v: 'published', t: 'Опубликованные' }, { v: 'draft', t: 'Черновики' }], test: function (n, v) { return n.status === v; } },
        { key: 'cat', label: 'Все категории', options: opts(DB.newsCategories), test: function (n, v) { return n.cat === v; } }],
      extra: function (n) { return n.status === 'published' ? '<a class="btn btn-link" href="../news-article.html?slug=' + n.slug + '">Открыть</a> ' : ''; },
      fields: function () { return [
        { name: 'title', label: 'Заголовок', type: 'text', required: true },
        { name: 'cat', label: 'Категория', type: 'select', options: opts(DB.newsCategories) },
        { name: 'status', label: 'Статус', type: 'select', options: [{ v: 'draft', t: 'Черновик' }, { v: 'published', t: 'Опубликована' }] },
        { name: 'content', label: 'Текст (HTML)', type: 'textarea', rows: 8, required: true, help: 'Допустимы теги p, h4, ul, ol, li, blockquote, a' }]; },
      defaults: { cat: 'life', status: 'draft' },
      make: function (d) {
        var slug = d.title.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-|-$/g, '') || idGen('n');
        return { id: idGen('n'), slug: slug, cat: d.cat, author: DB.me, title: d.title, content: d.content, status: d.status, published: d.status === 'published' ? DB.isoOff(0) : null };
      },
      apply: function (n, d) { n.title = d.title; n.cat = d.cat; n.content = d.content; if (d.status === 'published' && !n.published) n.published = DB.isoOff(0); n.status = d.status; }
    });
  };
  adm['news-categories'] = function (root) { simple(root, 'Категории новостей', 'newsCategories'); };

  /* ================= Опросы ================= */
  var SV_ST = { open: { t: 'Открыт', c: 'tag-success' }, closed: { t: 'Завершён', c: '' }, draft: { t: 'Черновик', c: 'tag-warning' } };
  adm.surveys = function (root) {
    crud(root, {
      title: 'Опросы', addText: 'Новый опрос',
      items: function () { return DB.surveys; }, store: function () { return DB.surveys; },
      cols: [['Название', function (s) { return '<span class="strong">' + esc(s.title) + '</span>'; }], ['Статус', function (s) { return UI.statusTag(SV_ST, s.status); }],
        ['До', function (s) { return UI.fmt(s.until); }], ['Вопросов', function (s) { return s.questions.length; }], ['Ответов', function (s) { return s.votes; }], ['Скрыт', function (s) { return yesNo(s.hidden); }]],
      search: function (s) { return s.title; },
      filters: [{ key: 'st', label: 'Любой статус', options: Object.keys(SV_ST).map(function (k) { return { v: k, t: SV_ST[k].t }; }), test: function (s, v) { return s.status === v; } }],
      fields: function () { return [
        { name: 'title', label: 'Название', type: 'text', required: true }, { name: 'desc', label: 'Описание', type: 'textarea', rows: 3 },
        { name: 'until', label: 'Открыт до', type: 'date', required: true },
        { name: 'status', label: 'Статус', type: 'select', options: Object.keys(SV_ST).map(function (k) { return { v: k, t: SV_ST[k].t }; }) },
        { name: 'hidden', label: 'Скрыть от сотрудников', type: 'checkbox' }]; },
      defaults: { status: 'draft', until: DB.isoOff(30) },
      make: function (d) { return { id: idGen('sv'), title: d.title, desc: d.desc, until: d.until, status: d.status, passed: false, hidden: d.hidden, votes: 0, questions: [{ id: 'q1', text: 'Ваше мнение', kind: 'text', options: [] }] }; },
      apply: function (s, d) { s.title = d.title; s.desc = d.desc; s.until = d.until; s.status = d.status; s.hidden = d.hidden; },
      extra: function (s) { return '<button type="button" class="btn btn-link" data-stats="' + s.id + '">Статистика</button> '; },
      onDraw: function (r) {
        $$('[data-stats]', r).forEach(function (b) {
          b.addEventListener('click', function () {
            var s = UI.find(DB.surveys, b.getAttribute('data-stats'));
            UI.modal({ title: 'Статистика: ' + esc(s.title), width: 520, html: '<dl class="desc desc-sm"><dt>Ответов</dt><dd>' + s.votes + '</dd><dt>Вопросов</dt><dd>' + s.questions.length + '</dd><dt>Статус</dt><dd>' + UI.statusTag(SV_ST, s.status) + '</dd></dl>' });
          });
        });
      }
    });
  };

  /* ================= Отпуска (HR) ================= */
  var VAC_ST = { draft: { t: 'Черновик', c: '' }, on_approval: { t: 'На согласовании', c: 'tag-warning' }, approved: { t: 'Согласован', c: 'tag-info' }, rejected: { t: 'Отклонён', c: 'tag-danger' }, taken: { t: 'Использован', c: 'tag-success' } };

  adm.vacations = function (root) {
    var st = { tab: 'queue', q: '', status: '' };
    function shell() {
      var pending = DB.vacations.filter(function (v) { return v.status === 'on_approval'; }).length;
      root.innerHTML = title(root, 'Отпуска: очередь и журнал') +
        '<nav class="tabs"><a href="#" data-tab="queue"' + (st.tab === 'queue' ? ' class="is-active"' : '') + '>Очередь HR' + (pending ? ' <span class="tag tag-primary">' + pending + '</span>' : '') + '</a>' +
        '<a href="#" data-tab="log"' + (st.tab === 'log' ? ' class="is-active"' : '') + '>Журнал</a></nav>' +
        '<div class="toolbar" style="margin-bottom:16px">' + (st.tab === 'log' ? '<select class="control select" id="hv-st"><option value="">Любой статус</option>' + Object.keys(VAC_ST).map(function (k) { return '<option value="' + k + '"' + (st.status === k ? ' selected' : '') + '>' + VAC_ST[k].t + '</option>'; }).join('') + '</select>' : '') +
        '<label class="input-wrap wide">' + UI.icon('search') + '<input type="search" id="hv-q" value="' + esc(st.q) + '" placeholder="Поиск по ФИО"></label></div><div id="hv-body"></div>';
      $$('[data-tab]', root).forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); st.tab = a.getAttribute('data-tab'); st.status = ''; shell(); body(); }); });
      $('#hv-q').addEventListener('input', function (e) { st.q = e.target.value; body(); });
      var s = $('#hv-st'); if (s) s.addEventListener('change', function () { st.status = s.value; body(); });
    }
    function body() {
      var q = UI.norm(st.q);
      var items = DB.vacations.filter(function (v) {
        if (st.tab === 'queue' && v.status !== 'on_approval') return false;
        if (st.status && v.status !== st.status) return false;
        return !q || UI.norm(UI.fullName(UI.user(v.user))).indexOf(q) >= 0;
      }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
      $('#hv-body').innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Сотрудник</th><th>Подразделение</th><th>Период</th><th>Дней</th><th>Тип</th><th>Статус</th><th></th></tr></thead><tbody>' +
        items.map(function (v) {
          var u = UI.user(v.user);
          return '<tr><td><a href="#" data-user="' + u.id + '">' + esc(UI.fullName(u)) + '</a></td><td>' + esc(UI.nameOf(DB.orgUnits, u.unit)) + '</td><td>' + UI.fmt(v.from) + ' — ' + UI.fmt(v.to) + '</td><td>' + UI.spanDays(v.from, v.to) + '</td>' +
            '<td>' + esc(UI.nameOf(DB.vacationTypes, v.type)) + '</td><td>' + UI.statusTag(VAC_ST, v.status) + '</td><td class="nowrap">' +
            (v.status === 'on_approval' ? '<button type="button" class="btn btn-primary btn-sm" data-ok="' + v.id + '">Подтвердить</button> <button type="button" class="btn btn-sm" data-no="' + v.id + '">Отклонить</button>' : '') + '</td></tr>';
        }).join('') + (items.length ? '' : '<tr><td colspan="7"><div class="empty">Записей нет</div></td></tr>') + '</tbody></table></div>';
      $$('[data-ok]', root).forEach(function (b) { b.addEventListener('click', function () { UI.find(DB.vacations, b.getAttribute('data-ok')).status = 'approved'; DB.save(); UI.toast('Отпуск подтверждён'); shell(); body(); }); });
      $$('[data-no]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = UI.find(DB.vacations, b.getAttribute('data-no')), f = [{ name: 'reason', label: 'Причина', type: 'textarea', required: true }];
          UI.modal({ title: 'Отклонить отпуск', width: 440, html: UI.formHtml(f), footer: [{ text: 'Отмена' }, { text: 'Отклонить', primary: true, onClick: function (api) {
            if (!UI.readForm(api.body, f)) return false; v.status = 'rejected'; DB.save(); UI.toast('Отпуск отклонён', 'info'); shell(); body();
          } }] });
        });
      });
    }
    shell(); body();
  };

  adm['vacations-calendar'] = function (root) {
    var cal = { y: DB.today().getFullYear(), m: DB.today().getMonth(), unit: '' };
    function draw() {
      var days = new Date(cal.y, cal.m + 1, 0).getDate(), todayIso = DB.iso(DB.today());
      var users = DB.users.filter(function (u) { return u.active && (!cal.unit || u.unit === cal.unit); });
      var head = '<th class="cal-name">Сотрудник</th>';
      for (var d = 1; d <= days; d++) { var wd = new Date(cal.y, cal.m, d).getDay(); head += '<th class="cal-day' + (wd === 0 || wd === 6 ? ' is-weekend' : '') + '">' + d + '</th>'; }
      var rows = users.map(function (u) {
        var cells = '';
        for (var d2 = 1; d2 <= days; d2++) {
          var iso = cal.y + '-' + UI.pad(cal.m + 1) + '-' + UI.pad(d2);
          var v = DB.vacations.filter(function (x) { return x.user === u.id && (x.status === 'approved' || x.status === 'on_approval') && x.from <= iso && iso <= x.to; })[0];
          var wd2 = new Date(cal.y, cal.m, d2).getDay();
          cells += '<td class="cal-cell' + (v ? (v.status === 'approved' ? ' is-vac' : ' is-pend') : '') + (iso === todayIso ? ' is-today' : '') + (wd2 === 0 || wd2 === 6 ? ' is-weekend' : '') + '"></td>';
        }
        return '<tr><td class="cal-name"><a href="#" data-user="' + u.id + '">' + esc(UI.shortName(u)) + '</a></td>' + cells + '</tr>';
      }).join('');
      root.innerHTML = title(root, 'Календарь отпусков (HR)', '<div class="toolbar"><select class="control select" id="cv-unit"><option value="">Все подразделения</option>' +
        opts(DB.orgUnits).map(function (o) { return '<option value="' + o.v + '"' + (cal.unit === o.v ? ' selected' : '') + '>' + esc(o.t) + '</option>'; }).join('') + '</select></div>') +
        '<div class="cal-nav"><button type="button" class="btn" data-m="-1">‹</button><strong>' + UI.MONTHS[cal.m] + ' ' + cal.y + '</strong><button type="button" class="btn" data-m="1">›</button>' +
        '<span class="legend"><i class="lg lg-vac"></i>Согласован <i class="lg lg-pend"></i>На согласовании</span></div>' +
        '<div class="table-scroll"><table class="cal-table"><thead><tr>' + head + '</tr></thead><tbody>' + (rows || '<tr><td><div class="empty">Нет сотрудников</div></td></tr>') + '</tbody></table></div>';
      $('#cv-unit').addEventListener('change', function (e) { cal.unit = e.target.value; draw(); });
      $$('[data-m]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          cal.m += Number(b.getAttribute('data-m'));
          if (cal.m < 0) { cal.m = 11; cal.y--; } else if (cal.m > 11) { cal.m = 0; cal.y++; }
          draw();
        });
      });
    }
    draw();
  };

  adm['vacation-settings'] = function (root) {
    var s = DB.vacationSettings;
    var fields = [
      { name: 'who_is_out_days', label: 'Горизонт блока «Скоро в отпуске», дней', type: 'number', required: true },
      { name: 'min_part_days', label: 'Минимальная длина основной части отпуска, дней', type: 'number', required: true },
      { name: 'year_days', label: 'Дней отпуска в году', type: 'number', required: true },
      { name: 'plan_deadline', label: 'Срок подачи графика (дд.мм)', type: 'text', required: true }
    ];
    root.innerHTML = title(root, 'Настройки отпусков') + '<div class="card" style="max-width:560px"><div class="card-body">' + UI.formHtml(fields, s) +
      '<button type="button" class="btn btn-primary" id="vs-save">Сохранить</button></div></div>';
    $('#vs-save').addEventListener('click', function () {
      var d = UI.readForm(root, fields); if (!d) return;
      for (var k in d) s[k] = d[k];
      DB.save(); UI.toast('Настройки сохранены');
    });
  };

  /* ================= Замещения ================= */
  adm.substitutions = function (root) {
    crud(root, {
      title: 'Замещения', addText: 'Добавить замещение',
      items: function () { return DB.substitutions; }, store: function () { return DB.substitutions; },
      cols: [['Отсутствует', function (s) { return uname(s.user); }], ['Замещает', function (s) { return uname(s.substitute); }], ['Период', function (s) { return UI.fmt(s.from) + ' — ' + UI.fmt(s.to); }], ['Основание', function (s) { return esc(s.order || '—'); }],
        ['Статус', function (s) { var d = UI.daysFromToday(s.to); return d < 0 ? '<span class="tag">Завершено</span>' : (UI.daysFromToday(s.from) <= 0 ? '<span class="tag tag-success">Действует</span>' : '<span class="tag tag-info">Предстоит</span>'); }]],
      search: function (s) { return UI.fullName(UI.user(s.user)) + ' ' + UI.fullName(UI.user(s.substitute)); },
      nameOf: function (s) { return UI.shortName(UI.user(s.user)) + ' → ' + UI.shortName(UI.user(s.substitute)); },
      fields: function () { return [{ name: 'user', label: 'Отсутствующий', type: 'select', options: userOpts() }, { name: 'substitute', label: 'Замещающий', type: 'select', options: userOpts() },
        { name: 'from', label: 'С', type: 'date', required: true }, { name: 'to', label: 'По', type: 'date', required: true }, { name: 'order', label: 'Основание (приказ)', type: 'text' }]; },
      defaults: { from: DB.isoOff(0), to: DB.isoOff(14) },
      validate: function (d) { if (d.user === d.substitute) return 'Нельзя замещать самого себя'; if (d.to < d.from) return 'Окончание раньше начала'; },
      make: function (d) { return { id: idGen('s'), user: d.user, substitute: d.substitute, from: d.from, to: d.to, order: d.order }; },
      apply: function (s, d) { for (var k in d) s[k] = d[k]; }
    });
  };

  /* ================= Заявки ================= */
  adm['request-categories'] = function (root) { simple(root, 'Категории заявок', 'requestCategories'); };
  adm['request-types'] = function (root) {
    crud(root, {
      title: 'Типы заявок', addText: 'Новый тип', width: 560,
      items: function () { return DB.requestTypes; }, store: function () { return DB.requestTypes; },
      cols: [['Название', function (t) { return '<span class="strong">' + esc(t.name) + '</span>'; }], ['Категория', function (t) { return esc(UI.nameOf(DB.requestCategories, t.cat)); }],
        ['Исполнитель по умолчанию', function (t) { return uname(t.assignee); }], ['Полей', function (t) { return t.fields.length; }], ['Статус', function (t) { return activeTag(t.active); }]],
      search: function (t) { return t.name + ' ' + t.desc; },
      filters: [{ key: 'cat', label: 'Все категории', options: opts(DB.requestCategories), test: function (t, v) { return t.cat === v; } }],
      fields: function () { return [{ name: 'name', label: 'Название', type: 'text', required: true }, { name: 'cat', label: 'Категория', type: 'select', options: opts(DB.requestCategories) },
        { name: 'assignee', label: 'Исполнитель по умолчанию', type: 'select', options: userOpts('— не назначен —') }, { name: 'desc', label: 'Описание', type: 'textarea', rows: 3 }, { name: 'active', label: 'Доступен сотрудникам', type: 'checkbox' }]; },
      defaults: { cat: 'it', active: true },
      make: function (d) { return { id: idGen('rt'), name: d.name, cat: d.cat, assignee: d.assignee, desc: d.desc, fields: [['text', 'Описание', 'textarea']], active: d.active }; },
      apply: function (t, d) { for (var k in d) t[k] = d[k]; }
    });
  };

  /* ================= База знаний ================= */
  adm['knowledge-sections'] = function (root) { simple(root, 'Разделы базы знаний', 'kbSections'); };
  adm['knowledge-types'] = function (root) { simple(root, 'Типы знаний', 'kbTypes'); };
  adm['knowledge-items'] = function (root) {
    crud(root, {
      title: 'Материалы', addText: 'Новый материал', width: 640,
      items: function () { return DB.kbItems; }, store: function () { return DB.kbItems; },
      cols: [['Заголовок', function (i) { return '<span class="strong">' + esc(i.title) + '</span>'; }], ['Раздел', function (i) { return esc(UI.nameOf(DB.kbSections, i.section)); }], ['Тип', function (i) { return '<span class="tag">' + esc(UI.nameOf(DB.kbTypes, i.type)) + '</span>'; }]],
      search: function (i) { return i.title + ' ' + i.sub; },
      nameOf: function (i) { return i.title; },
      filters: [{ key: 's', label: 'Все разделы', options: opts(DB.kbSections), test: function (i, v) { return i.section === v; } }, { key: 't', label: 'Все типы', options: opts(DB.kbTypes), test: function (i, v) { return i.type === v; } }],
      fields: function () { return [{ name: 'title', label: 'Заголовок', type: 'text', required: true }, { name: 'sub', label: 'Подзаголовок', type: 'text' }, { name: 'section', label: 'Раздел', type: 'select', options: opts(DB.kbSections) },
        { name: 'type', label: 'Тип', type: 'select', options: opts(DB.kbTypes) }, { name: 'body', label: 'Текст (HTML)', type: 'textarea', rows: 8, required: true }]; },
      defaults: { section: 'ks1', type: 'kt1' },
      make: function (d) { return { id: idGen('k'), section: d.section, type: d.type, title: d.title, sub: d.sub, body: d.body }; },
      apply: function (i, d) { for (var k in d) i[k] = d[k]; }
    });
  };

  /* ================= Письма, сервисы, VPN, аудит ================= */
  var LT_ST = { new: { t: 'Новое', c: '' }, in_work: { t: 'В работе', c: 'tag-info' }, overdue: { t: 'Просрочено', c: 'tag-danger' }, done: { t: 'Исполнено', c: 'tag-success' } };
  adm.letters = function (root) {
    crud(root, {
      title: 'Сроковые письма', addText: 'Зарегистрировать письмо', width: 560,
      items: function () { return DB.letters; }, store: function () { return DB.letters; },
      cols: [['№', function (l) { return '<span class="strong">' + esc(l.num) + '</span>'; }], ['Тема', function (l) { return esc(l.subject); }], ['От', function (l) { return esc(l.from); }],
        ['Срок', function (l) { var d = UI.daysFromToday(l.due); return UI.fmt(l.due) + (l.status !== 'done' && d >= 0 && d <= 5 ? ' <span class="tag tag-warning">' + UI.daysLabel(d) + '</span>' : ''); }],
        ['Ответственный', function (l) { return uname(l.owner); }], ['Статус', function (l) { return UI.statusTag(LT_ST, l.status); }]],
      search: function (l) { return l.num + ' ' + l.subject + ' ' + l.from; },
      nameOf: function (l) { return l.num; },
      filters: [{ key: 'st', label: 'Любой статус', options: Object.keys(LT_ST).map(function (k) { return { v: k, t: LT_ST[k].t }; }), test: function (l, v) { return l.status === v; } }],
      fields: function () { return [{ name: 'num', label: 'Номер', type: 'text', required: true }, { name: 'subject', label: 'Тема', type: 'text', required: true }, { name: 'from', label: 'От кого', type: 'text', required: true },
        { name: 'due', label: 'Срок ответа', type: 'date', required: true }, { name: 'owner', label: 'Ответственный', type: 'select', options: userOpts() },
        { name: 'status', label: 'Статус', type: 'select', options: Object.keys(LT_ST).map(function (k) { return { v: k, t: LT_ST[k].t }; }) }]; },
      defaults: { due: DB.isoOff(14), status: 'new', owner: 'u8' },
      make: function (d) { d.id = idGen('l'); return d; },
      apply: function (l, d) { for (var k in d) l[k] = d[k]; }
    });
  };

  adm.services = function (root) {
    crud(root, {
      title: 'Сервисы', addText: 'Добавить сервис', width: 560,
      items: function () { return DB.services; }, store: function () { return DB.services; },
      cols: [['Название', function (s) { return UI.icon(s.icon, 'svc-ico') + '<span class="strong">' + esc(s.name) + '</span>'; }], ['Адрес', function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.url.replace(/^https?:\/\//, '')) + '</a>'; }], ['Статус', function (s) { return activeTag(s.active); }]],
      search: function (s) { return s.name + ' ' + s.url; },
      fields: function () { return [{ name: 'name', label: 'Название', type: 'text', required: true }, { name: 'url', label: 'Адрес', type: 'text', required: true, placeholder: 'https://' },
        { name: 'icon', label: 'Иконка', type: 'select', options: ['file', 'mail', 'book', 'users', 'shield', 'calendar', 'apps', 'tool'] }, { name: 'desc', label: 'Описание и инструкция', type: 'textarea', rows: 5 }, { name: 'active', label: 'Показывать в портале', type: 'checkbox' }]; },
      defaults: { icon: 'apps', active: true },
      validate: function (d) { if (!/^https?:\/\//.test(d.url)) return 'Адрес должен начинаться с http:// или https://'; },
      make: function (d) { d.id = idGen('sv'); return d; },
      apply: function (s, d) { for (var k in d) s[k] = d[k]; }
    });
  };

  adm.vpn = function (root) {
    var VP = { active: { t: 'Активен', c: 'tag-success' }, revoked: { t: 'Отозван', c: 'tag-danger' } };
    crud(root, {
      title: 'VPN-доступы', addText: 'Выдать доступ', width: 480,
      items: function () { return DB.vpnAccounts; }, store: function () { return DB.vpnAccounts; },
      cols: [['Сотрудник', function (a) { return uname(a.user); }], ['Логин', function (a) { return '<code>' + esc(a.login) + '</code>'; }], ['Выдан', function (a) { return UI.fmt(a.issued); }], ['Действует до', function (a) { return UI.fmt(a.until); }], ['Статус', function (a) { return UI.statusTag(VP, a.status); }]],
      search: function (a) { return a.login + ' ' + UI.fullName(UI.user(a.user)); },
      nameOf: function (a) { return a.login; },
      filters: [{ key: 'st', label: 'Любой статус', options: [{ v: 'active', t: 'Активные' }, { v: 'revoked', t: 'Отозванные' }], test: function (a, v) { return a.status === v; } }],
      extra: function (a) { return a.status === 'active' ? '<button type="button" class="btn btn-link link-danger" data-revoke="' + a.id + '">Отозвать</button> ' : ''; },
      onDraw: function (r, redraw) {
        $$('[data-revoke]', r).forEach(function (b) {
          b.addEventListener('click', function () { var a = UI.find(DB.vpnAccounts, b.getAttribute('data-revoke')); UI.confirm('Отозвать VPN-доступ ' + esc(a.login) + '?', function () { a.status = 'revoked'; DB.save(); UI.toast('Доступ отозван', 'info'); redraw(); }, 'Отозвать'); });
        });
      },
      fields: function () { return [{ name: 'user', label: 'Сотрудник', type: 'select', options: userOpts() }, { name: 'until', label: 'Действует до', type: 'date', required: true }]; },
      defaults: { until: DB.isoOff(365) },
      values: function (a) { return { user: a.user, until: a.until }; },
      make: function (d) { var u = UI.user(d.user); return { id: idGen('vp'), user: d.user, login: u.email.split('@')[0], issued: DB.isoOff(0), until: d.until, status: 'active' }; },
      apply: function (a, d) { a.user = d.user; a.until = d.until; }
    });
  };

  adm.audit = function (root) {
    var st = { q: '', user: '' };
    root.innerHTML = title(root, 'Журнал аудита', '<div class="toolbar"><select class="control select" id="ad-user"><option value="">Все пользователи</option>' +
      userOpts().map(function (o) { return '<option value="' + o.v + '">' + esc(o.t) + '</option>'; }).join('') + '</select>' +
      '<label class="input-wrap wide">' + UI.icon('search') + '<input type="search" id="ad-q" placeholder="Поиск по действию и объекту"></label></div>') + '<div id="ad-body"></div>';
    function draw() {
      var q = UI.norm(st.q);
      var items = DB.audit.filter(function (a) { return (!st.user || a.user === st.user) && (!q || UI.norm(a.action + ' ' + a.entity).indexOf(q) >= 0); });
      $('#ad-body').innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Объект</th><th>IP</th></tr></thead><tbody>' +
        items.map(function (a) {
          var p = a.at.split(' ');
          return '<tr><td class="nowrap">' + UI.fmt(p[0]) + ' ' + p[1] + '</td><td>' + uname(a.user) + '</td><td>' + esc(a.action) + '</td><td>' + esc(a.entity) + '</td><td><code>' + esc(a.ip) + '</code></td></tr>';
        }).join('') + (items.length ? '' : '<tr><td colspan="5"><div class="empty">Записей нет</div></td></tr>') + '</tbody></table></div>';
    }
    $('#ad-user').addEventListener('change', function (e) { st.user = e.target.value; draw(); });
    $('#ad-q').addEventListener('input', function (e) { st.q = e.target.value; draw(); });
    draw();
  };

  document.addEventListener('shell-ready', function () {
    var name = (document.body.getAttribute('data-page') || '').replace(/^a-/, '');
    var root = UI.$('#page');
    if (document.body.getAttribute('data-area') === 'admin' && root && adm[name]) adm[name](root);
  });
})();
