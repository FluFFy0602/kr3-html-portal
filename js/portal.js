/* Страницы портала. Выбор страницы — по data-page на <body>. */
(function () {
  'use strict';

  var DB = window.DB, UI = window.UI;
  var $ = UI.$, $$ = UI.$$, esc = UI.esc;
  var pages = {};

  function me() { return UI.user(DB.me); }
  function activeUsers() { return DB.users.filter(function (u) { return u.active; }); }
  function posName(u) { return UI.nameOf(DB.positions, u.position); }
  function newsOf(n) { return n; }
  function link(href, text) { return '<a href="' + href + '">' + text + '</a>'; }

  function userRow(u, right, extraCls) {
    var map = userRow.vac || (userRow.vac = UI.onVacationMap());
    var noMark = (extraCls || '').indexOf('no-mark') >= 0;
    return '<a class="row ' + (extraCls || '') + '" href="#" data-user="' + u.id + '">' + UI.avatar(u) +
      '<div class="grow"><span class="name">' + esc(UI.fullName(u)) + '</span> ' + (noMark ? '' : UI.vacMark(u.id, map)) + '</div>' + right + '</a>';
  }

  function upcomingBirthdays() {
    var today = DB.today(), y = today.getFullYear();
    return activeUsers().filter(function (u) { return u.bm; }).map(function (u) {
      var d = new Date(y, u.bm - 1, u.bday);
      if (d < today) d = new Date(y + 1, u.bm - 1, u.bday);
      return { u: u, days: UI.diffDays(d, today) };
    }).sort(function (a, b) { return a.days - b.days; });
  }

  /* Обложка новости: фото, если есть, иначе фирменная заливка с названием категории */
  function newsCover(n, cls) {
    if (n.cover) {
      return '<div class="news-cover has-photo ' + cls + '"><img src="' + esc(UI.asset(n.cover)) + '" alt="" loading="lazy" decoding="async"></div>';
    }
    return '<div class="news-cover ' + cls + '">' + esc(UI.nameOf(DB.newsCategories, n.cat)) + '</div>';
  }

  function newsCard(n, small) {
    var cat = UI.nameOf(DB.newsCategories, n.cat);
    return '<a class="link-block" href="news-article.html?slug=' + n.slug + '"><article class="card card-hover news-card">' +
      newsCover(n, small ? 'small' : '') +
      '<div class="card-body"><span class="tag tag-primary">' + esc(cat) + '</span>' +
      '<h5>' + esc(n.title) + '</h5><span class="date">' + UI.fmt(n.published) + '</span>' +
      (small ? '' : '<p class="snippet">' + esc(snippet(n.content)) + '</p>') + '</div></article></a>';
  }
  function snippet(html) {
    var t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > 140 ? t.slice(0, 140) + '…' : t;
  }
  function publishedNews() {
    return DB.news.filter(function (n) { return n.status === 'published'; })
      .sort(function (a, b) { return a.published < b.published ? 1 : -1; });
  }

  /* ================= Дашборд ================= */
  pages.dashboard = function (root) {
    var uid = DB.me;
    var approvals = DB.requests.filter(function (r) { return r.status === 'approval' && r.approver === uid; }).length;
    var inWork = DB.requests.filter(function (r) { return r.status === 'in_progress' && r.assignee === uid; }).length;
    var days = DB.vacationSettings.who_is_out_days;

    var bds = upcomingBirthdays().slice(0, 5);
    var cur = UI.currentVacations().sort(function (a, b) { return a.to < b.to ? -1 : 1; });
    var soon = DB.vacations.filter(function (v) {
      var d = UI.daysFromToday(v.from);
      return v.status === 'approved' && d > 0 && d <= days;
    }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    var subsAll = DB.substitutions.filter(function (s) { return UI.daysFromToday(s.to) >= 0; });
    var subsNow = subsAll.filter(function (s) { return UI.daysFromToday(s.from) <= 0; });
    var subsNext = subsAll.filter(function (s) { return UI.daysFromToday(s.from) > 0; });

    function stat(href, icon, accent, label, val) {
      return '<a class="link-block" href="' + href + '"><div class="card stat"><div class="card-body">' +
        '<div class="stat-icon' + (accent ? ' accent' : '') + '">' + UI.icon(icon) + '</div>' +
        '<div><span class="stat-label">' + label + '</span><span class="stat-value">' + val + '</span></div></div></div></a>';
    }
    function head(title, href, full) {
      return '<div class="section-head"><h4>' + title + '</h4><a href="' + href + '"><span class="full">' + full + '</span><span class="short">Все ›</span></a></div>';
    }

    var html = '<h4 class="page-title">Дашборд</h4><div class="grid grid-stats">' +
      stat('employees.html', 'users', false, 'Сотрудников', activeUsers().length) +
      stat('requests.html?tab=approvals', 'audit', true, 'Ждут моего согласования', approvals) +
      stat('requests.html?tab=queue', 'tool', false, 'У меня в работе (исполнитель)', inWork) + '</div>';

    html += '<div class="grid grid-2 mt-32">';
    // дни рождения
    html += '<section>' + head('Ближайшие дни рождения', 'birthdays.html', 'Все дни рождения') + '<div class="card">' +
      bds.map(function (b) {
        var tag = b.days === 0 ? '<span class="tag tag-primary">сегодня</span>' : '<span class="tag">' + UI.daysLabel(b.days) + '</span>';
        return userRow(b.u, '<span class="when">' + UI.birthdayText(b.u) + '</span>' + tag, b.days === 0 ? 'is-today' : '');
      }).join('') + '</div></section>';

    // отпуска
    html += '<section>' + head('Отпуска', 'on-vacation.html', 'Все отпуска') + '<div class="card">';
    if (!cur.length && !soon.length) html += '<div class="empty">Сейчас никто не в отпуске</div>';
    if (cur.length) {
      html += '<div class="list-group">Сейчас в отпуске</div>' + cur.slice(0, 2).map(function (v) {
        return userRow(UI.user(v.user), '<span class="when">до ' + UI.fmt(v.to) + '</span><span class="tag tag-primary">в отпуске</span>', 'no-mark');
      }).join('');
      if (cur.length > 2) html += '<a class="list-more" href="on-vacation.html">Ещё ' + (cur.length - 2) + ' в отпуске</a>';
    }
    if (soon.length) {
      html += '<div class="list-group">Скоро в отпуске (' + days + ' ' + UI.plural(days, 'день', 'дня', 'дней') + ')</div>' + soon.slice(0, 2).map(function (v) {
        var d = UI.daysFromToday(v.from);
        return userRow(UI.user(v.user), '<span class="when">' + UI.fmtShort(v.from) + ' — ' + UI.fmt(v.to) + '</span><span class="tag">' + UI.daysLabel(d) + '</span>', 'no-mark');
      }).join('');
    }
    html += '</div></section>';

    // замещения
    function subRow(s, right) {
      var sub = UI.user(s.substitute), who = UI.user(s.user);
      return '<a class="row" href="#" data-user="' + sub.id + '">' + UI.avatar(sub) + '<div class="grow">' +
        '<span class="name">' + esc(sub.last + ' ' + sub.first) + '</span>' +
        '<span class="sub">замещает ' + esc(who.last + ' ' + who.first) + '</span>' +
        (s.order ? '<span class="sub">' + esc(s.order) + '</span>' : '') + '</div>' + right + '</a>';
    }
    html += '<section>' + head('Замещения', 'substitutions.html', 'Все замещения') + '<div class="card">';
    if (!subsNow.length && !subsNext.length) html += '<div class="empty">Замещений нет</div>';
    if (subsNow.length) html += '<div class="list-group">Действуют сейчас</div>' + subsNow.map(function (s) {
      return subRow(s, '<span class="when">до ' + UI.fmt(s.to) + '</span>');
    }).join('');
    if (subsNext.length) html += '<div class="list-group">Предстоящие</div>' + subsNext.map(function (s) {
      return subRow(s, '<span class="when">' + UI.fmtShort(s.from) + ' — ' + UI.fmt(s.to) + '</span>');
    }).join('');
    html += '</div></section></div>';

    html += '<div class="section-head mt-32"><h4>Последние новости</h4><a href="news.html"><span class="full">Все новости</span><span class="short">Все ›</span></a></div>' +
      '<div class="grid grid-cards">' + publishedNews().slice(0, 3).map(function (n) { return newsCard(n, true); }).join('') + '</div>';
    root.innerHTML = html;
  };

  /* ================= Сотрудники ================= */
  pages.employees = function (root) {
    var st = { q: '', city: 'all', units: [], unitQ: '' };

    root.innerHTML =
      '<div class="page-head"><h4>Сотрудники</h4><div class="toolbar" id="emp-tools"></div></div>' +
      '<div id="emp-seg" style="margin-bottom:16px"></div><div id="emp-list"></div>';

    function availableUnits() {
      return DB.orgUnits.filter(function (d) {
        return activeUsers().some(function (u) { return u.unit === d.id && (st.city === 'all' || u.city === st.city); });
      });
    }

    function tools() {
      var t = $('#emp-tools');
      var filtersBtn = '<span class="dd-host"><button type="button" class="btn' + (st.units.length ? ' btn-primary' : '') + '" id="emp-filters">' +
        UI.icon('filter') + 'Фильтры</button></span>';
      t.innerHTML =
        '<a class="btn" href="birthdays.html">' + UI.icon('gift') + 'Дни рождения</a>' +
        '<a class="btn" href="substitutions.html">' + UI.icon('swap') + 'Замещения</a>' + filtersBtn +
        '<button type="button" class="btn" id="emp-reset"' + ((st.q && !st.units.length) ? '' : ' hidden') + '>Сбросить фильтры</button>' +
        '<label class="input-wrap">' + UI.icon('search') + '<input type="search" id="emp-q" value="' + esc(st.q) + '" placeholder="Поиск по ФИО, email, вн. номеру, подразделению"></label>';
      $('#emp-q').addEventListener('input', function (e) { st.q = e.target.value; list(); resetBtn(); });
      $('#emp-reset').addEventListener('click', function () { st.q = ''; st.units = []; tools(); list(); });
      $('#emp-filters').addEventListener('click', function (e) {
        e.stopPropagation();
        UI.dropdown(e.currentTarget, unitPanel, { width: 360, align: 'left' });
      });
    }
    function resetBtn() { $('#emp-reset').hidden = !(st.q && !st.units.length); }

    function unitPanel(panel) {
      function paint() {
        var q = UI.norm(st.unitQ);
        var vis = availableUnits().filter(function (d) { return !q || UI.norm(d.name).indexOf(q) >= 0; });
        panel.innerHTML =
          '<div class="dd-head"><strong>Подразделение</strong>' + (st.units.length ? '<button type="button" class="btn btn-link" data-clear>Сбросить</button>' : '') + '</div>' +
          '<label class="input-wrap input-sm">' + UI.icon('search') + '<input type="search" data-uq value="' + esc(st.unitQ) + '" placeholder="Поиск подразделения"></label>' +
          '<div class="dd-list">' + (vis.length ? vis.map(function (d) {
            return '<label class="check"><input type="checkbox" value="' + d.id + '"' + (st.units.indexOf(d.id) >= 0 ? ' checked' : '') + '><span title="' + esc(d.name) + '">' + esc(d.name) + '</span></label>';
          }).join('') : '<div class="muted">' + (q ? 'Ничего не найдено' : 'Нет подразделений') + '</div>') + '</div>';
        var inp = $('[data-uq]', panel);
        inp.addEventListener('input', function () { st.unitQ = inp.value; var pos = inp.selectionStart; paint(); var n = $('[data-uq]', panel); n.focus(); n.setSelectionRange(pos, pos); });
        var clr = $('[data-clear]', panel);
        if (clr) clr.addEventListener('click', function () { st.units = []; paint(); sync(); });
        $$('.dd-list input', panel).forEach(function (c) {
          c.addEventListener('change', function () {
            st.units = $$('.dd-list input:checked', panel).map(function (i) { return i.value; })
              .concat(st.units.filter(function (id) { return !$('.dd-list input[value="' + id + '"]', panel); }));
            sync();
          });
        });
      }
      function sync() { $('#emp-filters').classList.toggle('btn-primary', st.units.length > 0); resetBtn(); list(); }
      paint();
    }

    function seg() {
      var opts = [['all', 'Все города']].concat(DB.cities.map(function (c) { return [c.id, c.name]; }));
      $('#emp-seg').innerHTML = '<nav class="segmented">' + opts.map(function (o) {
        return '<a href="#" data-city="' + o[0] + '"' + (o[0] === st.city ? ' class="is-active"' : '') + '>' + esc(o[1]) + '</a>';
      }).join('') + '</nav>';
      $$('[data-city]', $('#emp-seg')).forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); st.city = a.getAttribute('data-city'); st.units = []; seg(); tools(); list(); });
      });
    }

    function list() {
      var q = UI.norm(st.q), vac = UI.onVacationMap();
      var users = activeUsers().filter(function (u) {
        if (st.city !== 'all' && u.city !== st.city) return false;
        if (st.units.length && st.units.indexOf(u.unit) < 0) return false;
        if (!q) return true;
        var hay = UI.norm([UI.fullName(u), u.email, u.vn, UI.nameOf(DB.orgUnits, u.unit), posName(u)].join(' '));
        return hay.indexOf(q) >= 0;
      });
      if (!users.length) { $('#emp-list').innerHTML = '<div class="empty">Сотрудники не найдены</div>'; return; }

      var byCity = {};
      users.forEach(function (u) { (byCity[u.city] = byCity[u.city] || []).push(u); });
      var html = '';
      DB.cities.forEach(function (c) {
        var cu = byCity[c.id];
        if (!cu) return;
        html += '<section style="margin-bottom:32px">' + (st.city === 'all' ? '<div class="group-city">' + esc(c.name) + '</div>' : '');
        var byUnit = {};
        cu.forEach(function (u) { (byUnit[u.unit] = byUnit[u.unit] || []).push(u); });
        Object.keys(byUnit).sort(function (a, b) {
          return UI.nameOf(DB.orgUnits, a).localeCompare(UI.nameOf(DB.orgUnits, b), 'ru');
        }).forEach(function (uid) {
          var unit = UI.find(DB.orgUnits, uid);
          var rows = byUnit[uid].sort(function (a, b) {
            var ah = unit && unit.head === a.id ? 0 : 1, bh = unit && unit.head === b.id ? 0 : 1;
            return ah !== bh ? ah - bh : UI.fullName(a).localeCompare(UI.fullName(b), 'ru');
          });
          html += '<div class="group-unit">' + esc(unit ? unit.name : 'Без подразделения') + '</div><div class="table-box">' +
            '<div class="t-head"><span>Сотрудник</span><span class="col-email">' + UI.icon('mail') + 'Почта</span><span>' + UI.icon('hash') + 'Вн. номер</span></div>' +
            rows.map(function (u) {
              return '<a class="t-row" href="#" data-user="' + u.id + '"><div class="person">' + UI.avatar(u, 'avatar-sm') +
                '<div style="min-width:0"><span class="name">' + esc(UI.fullName(u)) + ' ' + UI.vacMark(u.id, vac) + '</span><span class="pos">' + esc(posName(u)) + '</span></div></div>' +
                '<span class="email" title="' + esc(u.email) + '">' + esc(u.email) + '</span>' +
                '<span class="num"' + (u.vn ? '' : ' style="color:#bbb"') + '>' + esc(u.vn || '—') + '</span></a>';
            }).join('') + '</div>';
        });
        html += '</section>';
      });
      $('#emp-list').innerHTML = html;
    }

    seg(); tools(); list();
  };

  /* ================= Дни рождения ================= */
  pages.birthdays = function (root) {
    root.innerHTML = '<p><a class="btn" href="employees.html">' + UI.icon('back') + 'Сотрудники</a></p>' +
      '<div class="page-head"><h4>Дни рождения</h4><div class="toolbar"><label class="input-wrap">' + UI.icon('search') +
      '<input type="search" id="bd-q" placeholder="Поиск по ФИО"></label></div></div><div id="bd-list"></div>';
    function render() {
      var q = UI.norm($('#bd-q').value), now = new Date(), cur = now.getMonth() + 1;
      var groups = {};
      activeUsers().filter(function (u) { return u.bm && (!q || UI.norm(UI.fullName(u)).indexOf(q) >= 0); })
        .forEach(function (u) { (groups[u.bm] = groups[u.bm] || []).push(u); });
      var months = Object.keys(groups).map(Number).sort(function (a, b) { return ((a - cur + 12) % 12) - ((b - cur + 12) % 12); });
      if (!months.length) { $('#bd-list').innerHTML = '<div class="empty">Никого не найдено</div>'; return; }
      var bdMap = {};
      upcomingBirthdays().forEach(function (b) { bdMap[b.u.id] = b.days; });
      $('#bd-list').innerHTML = months.map(function (m) {
        return '<div class="month-title">' + UI.MONTHS[m - 1] + (m === cur ? ' · текущий месяц' : '') + '</div><div class="card">' +
          groups[m].sort(function (a, b) { return a.bday - b.bday; }).map(function (u) {
            var d = bdMap[u.id];
            var tag = d === 0 ? '<span class="tag tag-primary">сегодня</span>' : (d <= 30 ? '<span class="tag">' + UI.daysLabel(d) + '</span>' : '');
            return userRow(u, '<span class="when">' + UI.birthdayText(u) + '</span>' + tag, d === 0 ? 'is-today' : '');
          }).join('') + '</div>';
      }).join('');
    }
    $('#bd-q').addEventListener('input', render);
    render();
  };

  /* ================= Кто в отпуске ================= */
  pages['on-vacation'] = function (root) {
    root.innerHTML = '<div class="page-head"><h4>Кто в отпуске</h4><div class="toolbar"><label class="input-wrap">' + UI.icon('search') +
      '<input type="search" id="ov-q" placeholder="Поиск по ФИО"></label></div></div><div id="ov-list"></div>';
    var days = DB.vacationSettings.who_is_out_days;
    function render() {
      var q = UI.norm($('#ov-q').value);
      function ok(v) { var u = UI.user(v.user); return !q || UI.norm(UI.fullName(u)).indexOf(q) >= 0; }
      var cur = UI.currentVacations().filter(ok).sort(function (a, b) { return a.to < b.to ? -1 : 1; });
      var soon = DB.vacations.filter(function (v) {
        var d = UI.daysFromToday(v.from); return v.status === 'approved' && d > 0 && d <= days && ok(v);
      }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
      var html = '<div class="card">';
      if (!cur.length && !soon.length) html += '<div class="empty">Никого не найдено</div>';
      if (cur.length) html += '<div class="list-group">Сейчас в отпуске · ' + cur.length + '</div>' + cur.map(function (v) {
        return userRow(UI.user(v.user), '<span class="when">до ' + UI.fmt(v.to) + '</span><span class="tag tag-primary">в отпуске</span>', 'no-mark');
      }).join('');
      if (soon.length) html += '<div class="list-group">Скоро в отпуске (' + days + ' ' + UI.plural(days, 'день', 'дня', 'дней') + ') · ' + soon.length + '</div>' + soon.map(function (v) {
        return userRow(UI.user(v.user), '<span class="when">' + UI.fmtShort(v.from) + ' — ' + UI.fmt(v.to) + '</span><span class="tag">' + UI.daysLabel(UI.daysFromToday(v.from)) + '</span>', 'no-mark');
      }).join('');
      $('#ov-list').innerHTML = html + '</div>';
    }
    $('#ov-q').addEventListener('input', render);
    render();
  };

  /* ================= Замещения ================= */
  pages.substitutions = function (root) {
    root.innerHTML = '<div class="page-head"><h4>Замещения</h4><div class="toolbar"><label class="input-wrap">' + UI.icon('search') +
      '<input type="search" id="sb-q" placeholder="Поиск по ФИО"></label></div></div><div id="sb-list"></div>';
    function render() {
      var q = UI.norm($('#sb-q').value);
      var list = DB.substitutions.filter(function (s) {
        if (UI.daysFromToday(s.to) < 0) return false;
        return !q || UI.norm(UI.fullName(UI.user(s.user)) + ' ' + UI.fullName(UI.user(s.substitute))).indexOf(q) >= 0;
      }).sort(function (a, b) { return a.from < b.from ? -1 : 1; });
      var html = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Отсутствует</th><th>Замещает</th><th>Период</th><th>Основание</th><th>Статус</th></tr></thead><tbody>';
      html += list.map(function (s) {
        var now = UI.daysFromToday(s.from) <= 0;
        return '<tr><td><a href="#" data-user="' + s.user + '">' + esc(UI.fullName(UI.user(s.user))) + '</a></td>' +
          '<td><a href="#" data-user="' + s.substitute + '">' + esc(UI.fullName(UI.user(s.substitute))) + '</a></td>' +
          '<td>' + UI.fmt(s.from) + ' — ' + UI.fmt(s.to) + '</td><td>' + esc(s.order || '—') + '</td>' +
          '<td>' + (now ? '<span class="tag tag-success">Действует</span>' : '<span class="tag">Предстоит</span>') + '</td></tr>';
      }).join('');
      if (!list.length) html += '<tr><td colspan="5"><div class="empty">Замещений нет</div></td></tr>';
      $('#sb-list').innerHTML = html + '</tbody></table></div>';
    }
    $('#sb-q').addEventListener('input', render);
    render();
  };

  /* ================= Оргструктура ================= */
  var UNIT_LABEL = { position: 'Должность', department: 'Департамент', division: 'Подразделение', office: 'Отдел', separate_unit: 'Обособленное подразделение', management: 'Управление', direction: 'Направление', section: 'Участок' };
  var UNIT_BG = { department: '#D7F0FF', separate_unit: '#BCE5FE', management: '#CAEBFF', division: '#E1F4FF', direction: '#E1F4FF', section: '#F4FBFF', office: '#FFFFFF' };

  pages.org = function (root) {
    var st = { q: '', city: 'all', zoom: 1 };
    root.innerHTML =
      '<div class="page-head"><h4>Организационная структура</h4><div class="toolbar org-tools">' +
      '<label class="input-wrap wide">' + UI.icon('search') + '<input type="search" id="org-q" placeholder="Поиск по подразделению или сотруднику"></label>' +
      '<span class="btn-group"><button type="button" class="btn" data-zoom="-1" aria-label="Уменьшить">−</button><span class="btn zoom-val" id="org-zoom">100%</span><button type="button" class="btn" data-zoom="1" aria-label="Увеличить">+</button></span>' +
      '<button type="button" class="btn" data-zoom="0" title="Сбросить масштаб">' + UI.icon('reset') + '</button></div></div>' +
      '<div id="org-seg" style="margin-bottom:16px"></div><div class="org-scroll"><div class="org-zoom" id="org-canvas"></div></div>';

    function unitOf(id) { return UI.find(DB.orgUnits, id); }
    function members(unitId) { return activeUsers().filter(function (u) { return u.unit === unitId; }); }

    function build(parent) {
      return DB.orgUnits.filter(function (u) { return (u.parent || null) === parent && u.show !== false; })
        .map(function (u) { return { unit: u, children: build(u.id) }; });
    }
    function filterTree(nodes, pred) {
      return nodes.map(function (n) {
        var kids = filterTree(n.children, pred);
        return pred(n) || kids.length ? { unit: n.unit, children: pred(n) ? n.children : kids, hit: pred(n) } : null;
      }).filter(Boolean);
    }
    function matches(n, q) {
      if (UI.norm(n.unit.name).indexOf(q) >= 0) return true;
      return members(n.unit.id).some(function (u) { return UI.norm(UI.fullName(u)).indexOf(q) >= 0; });
    }

    function card(n, q) {
      var u = n.unit, head = u.head ? UI.user(u.head) : null;
      var vac = UI.onVacationMap();
      var hl = q && matches(n, q) ? ' is-hl' : '';
      var mark = head ? UI.vacMark(head.id, vac) : '';
      if (u.type === 'position') {
        return '<div class="org-card org-pos' + hl + '" data-unit="' + u.id + '" data-head="' + (head ? head.id : '') + '">' +
          '<div class="org-pos-top">' + (head ? UI.avatar(head, 'avatar-sm accent') : '') +
          '<strong>' + esc(head ? UI.fullName(head) : u.name) + '</strong>' + mark + '</div>' +
          '<span class="org-pos-sub">' + esc(head ? posName(head) : UNIT_LABEL[u.type]) + '</span></div>';
      }
      return '<div class="org-card org-unit' + hl + '" data-unit="' + u.id + '" style="background:' + (hl ? '' : (UNIT_BG[u.type] || '#fff')) + '">' +
        '<strong class="org-unit-name">' + esc(u.name) + '</strong>' +
        (head ? '<div class="org-unit-head">' + UI.avatar(head, 'avatar-xxs') + '<span class="muted">' + esc(UI.fullName(head)) + '</span>' + mark + '</div>' : '') + '</div>';
    }
    function subtree(n, q) {
      return '<div class="org-subtree">' + card(n, q) + (n.children.length ? '<div class="org-vchildren">' +
        n.children.map(function (c) { return '<div class="org-vchild">' + subtree(c, q) + '</div>'; }).join('') + '</div>' : '') + '</div>';
    }
    function row(group, q) {
      return '<div class="org-children-row">' + group.map(function (c) { return '<div class="org-child-col">' + subtree(c, q) + '</div>'; }).join('') + '</div>';
    }
    function branch(n, q) {
      var pos = n.children.filter(function (c) { return c.unit.type === 'position'; });
      var oth = n.children.filter(function (c) { return c.unit.type !== 'position'; });
      var h = '<div class="org-root-branch">' + card(n, q);
      if (pos.length && oth.length) {
        h += '<div class="org-children-stack"><div class="org-trunk"></div>' + row(pos, q) + '<div class="org-trunk"></div></div>' + row(oth, q);
      } else if (pos.length || oth.length) {
        h += '<div class="org-trunk"></div>' + row(pos.length ? pos : oth, q);
      }
      return h + '</div>';
    }

    function seg() {
      var opts = [['all', 'Все города']].concat(DB.cities.map(function (c) { return [c.id, c.name]; }));
      $('#org-seg').innerHTML = '<nav class="segmented">' + opts.map(function (o) {
        return '<a href="#" data-city="' + o[0] + '"' + (o[0] === st.city ? ' class="is-active"' : '') + '>' + esc(o[1]) + '</a>';
      }).join('') + '</nav>';
      $$('[data-city]', $('#org-seg')).forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); st.city = a.getAttribute('data-city'); seg(); draw(); });
      });
    }

    function draw() {
      var q = UI.norm(st.q);
      var tree = build(null);
      if (st.city !== 'all') tree = filterTree(tree, function (n) { return n.unit.city === st.city; });
      if (q) tree = filterTree(tree, function (n) { return matches(n, q); });
      var canvas = $('#org-canvas');
      canvas.innerHTML = tree.length ? tree.map(function (n) { return branch(n, q); }).join('') : '<div class="empty">Ничего не найдено</div>';
      canvas.style.zoom = st.zoom;
      $('#org-zoom').textContent = Math.round(st.zoom * 100) + '%';
    }

    function unitModal(id) {
      var u = unitOf(id), head = u.head ? UI.user(u.head) : null;
      var list = members(id).sort(function (a, b) {
        var ah = a.id === u.head ? 0 : 1, bh = b.id === u.head ? 0 : 1;
        return ah !== bh ? ah - bh : UI.fullName(a).localeCompare(UI.fullName(b), 'ru');
      });
      var parent = u.parent ? unitOf(u.parent) : null;
      UI.modal({
        title: esc(u.name), width: 540, centered: true,
        html: '<div class="unit-meta"><span class="tag tag-navy">' + UNIT_LABEL[u.type] + '</span> <span class="tag">' + esc(UI.nameOf(DB.cities, u.city)) + '</span>' +
          (parent ? ' <span class="muted small">входит в: ' + esc(parent.name) + '</span>' : '') + '</div>' +
          (head ? '<div class="extra-title">Руководитель</div><a class="row row-flat" href="#" data-user="' + head.id + '">' + UI.avatar(head) +
            '<div class="grow"><span class="name">' + esc(UI.fullName(head)) + '</span><span class="sub">' + esc(posName(head)) + '</span></div></a>' : '') +
          '<div class="extra-title">Сотрудники (' + list.length + ')</div>' +
          (list.length ? list.map(function (m) {
            return '<a class="row row-flat" href="#" data-user="' + m.id + '">' + UI.avatar(m, 'avatar-sm') +
              '<div class="grow"><span class="name">' + esc(UI.fullName(m)) + '</span><span class="sub">' + esc(posName(m)) + '</span></div>' +
              (m.id === u.head ? '<span class="tag tag-primary">руководитель</span>' : '') + '</a>';
          }).join('') : '<div class="muted">В подразделении нет сотрудников</div>')
      });
    }

    root.addEventListener('click', function (e) {
      var z = e.target.closest('[data-zoom]');
      if (z) {
        var d = Number(z.getAttribute('data-zoom'));
        st.zoom = d === 0 ? 1 : Math.min(1.5, Math.max(0.4, +(st.zoom + d * 0.1).toFixed(2)));
        draw();
        return;
      }
      var c = e.target.closest('[data-unit]');
      if (!c) return;
      var headId = c.getAttribute('data-head');
      if (headId) UI.userCard(headId); else unitModal(c.getAttribute('data-unit'));
    });
    $('#org-q').addEventListener('input', function (e) { st.q = e.target.value; draw(); });
    seg(); draw();
  };

  /* ================= Новости ================= */
  pages.news = function (root) {
    var st = { q: '', cat: '', page: 1 }, SIZE = 6;
    root.innerHTML = '<div class="page-head"><h4>Новости</h4><div class="toolbar">' +
      '<select class="control select" id="nw-cat" aria-label="Категория"><option value="">Все категории</option>' +
      DB.newsCategories.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' +
      '<label class="input-wrap wide">' + UI.icon('search') + '<input type="search" id="nw-q" placeholder="Поиск по заголовку, тексту, категории"></label></div></div>' +
      '<div id="nw-list"></div>';
    function render() {
      var q = UI.norm(st.q);
      var list = publishedNews().filter(function (n) {
        if (st.cat && n.cat !== st.cat) return false;
        return !q || UI.norm(n.title + ' ' + snippet(n.content) + ' ' + UI.nameOf(DB.newsCategories, n.cat)).indexOf(q) >= 0;
      });
      var pageItems = list.slice((st.page - 1) * SIZE, st.page * SIZE);
      $('#nw-list').innerHTML = list.length
        ? '<div class="grid grid-cards">' + pageItems.map(function (n) { return newsCard(n); }).join('') + '</div>' + UI.pager(list.length, st.page, SIZE)
        : '<div class="empty">Нет новостей</div>';
    }
    $('#nw-cat').addEventListener('change', function (e) { st.cat = e.target.value; st.page = 1; render(); });
    $('#nw-q').addEventListener('input', function (e) { st.q = e.target.value; st.page = 1; render(); });
    root.addEventListener('click', function (e) {
      var p = e.target.closest('[data-pg]');
      if (p) { e.preventDefault(); st.page = +p.getAttribute('data-pg'); render(); window.scrollTo(0, 0); }
    });
    render();
  };

  pages['news-article'] = function (root) {
    var slug = UI.params().slug;
    var n = UI.find(DB.news.map(function (x) { return { id: x.slug, n: x }; }), slug);
    if (!n) { location.replace('404.html'); return; }
    n = n.n;
    var a = UI.user(n.author), cat = UI.nameOf(DB.newsCategories, n.cat);
    document.title = n.title + ' — Орбита';
    root.innerHTML = '<div class="article-wrap"><p><a class="btn" href="news.html">' + UI.icon('back') + 'Назад</a></p>' +
      '<article class="article">' + newsCover(n, 'article-cover') + '<div class="article-body">' +
      '<span class="tag tag-primary">' + esc(cat) + '</span><h3 style="margin-top:12px">' + esc(n.title) + '</h3>' +
      '<div class="article-meta"><span>' + UI.fmt(n.published) + '</span><a class="author" href="#" data-user="' + a.id + '">' + UI.avatar(a, 'avatar-sm') + esc(UI.fullName(a)) + '</a></div>' +
      '<div class="news-html">' + n.content + '</div></div></article></div>';
  };

  /* ================= Отпуска ================= */
  var VAC_STATUS = {
    draft: { t: 'Черновик', c: '' }, on_approval: { t: 'На согласовании', c: 'tag-warning' },
    approved: { t: 'Согласован', c: 'tag-info' }, rejected: { t: 'Отклонён', c: 'tag-danger' }, taken: { t: 'Использован', c: 'tag-success' }
  };

  function subordinates(uid) {
    var out = [], queue = [uid];
    while (queue.length) {
      var id = queue.shift();
      DB.users.forEach(function (u) { if (u.manager === id && u.active) { out.push(u); queue.push(u.id); } });
    }
    return out;
  }

  pages.vacations = function (root) {
    var uid = DB.me;
    var tab = UI.params().tab || 'my';
    var cal = { y: DB.today().getFullYear(), m: DB.today().getMonth() };
    var subs = subordinates(uid);
    var subIds = subs.map(function (u) { return u.id; });

    function pendingList() { return DB.vacations.filter(function (v) { return v.status === 'on_approval' && subIds.indexOf(v.user) >= 0; }); }

    function typeName(id) { return UI.nameOf(DB.vacationTypes, id); }

    function shell() {
      var pc = pendingList().length;
      root.innerHTML = '<div class="page-head"><h4>Отпуска</h4><button type="button" class="btn btn-primary" id="vac-new">' + UI.icon('plus') + 'Запланировать отпуск</button></div>' +
        '<nav class="tabs"><a href="#" data-tab="my"' + (tab === 'my' ? ' class="is-active"' : '') + '>Мои отпуска</a>' +
        '<a href="#" data-tab="inbox"' + (tab === 'inbox' ? ' class="is-active"' : '') + '>На согласование' + (pc ? ' <span class="tag tag-primary">' + pc + '</span>' : '') + '</a>' +
        '<a href="#" data-tab="calendar"' + (tab === 'calendar' ? ' class="is-active"' : '') + '>Календарь подчинённых</a></nav><div id="vac-body"></div>';
      $$('[data-tab]', root).forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); tab = a.getAttribute('data-tab'); shell(); body(); });
      });
      $('#vac-new').addEventListener('click', function () { editVacation(); });
    }

    function body() {
      if (tab === 'my') mine(); else if (tab === 'inbox') inbox(); else calendar();
    }

    function mine() {
      var list = DB.vacations.filter(function (v) { return v.user === uid; }).sort(function (a, b) { return a.from < b.from ? 1 : -1; });
      var yearStart = DB.today().getFullYear() + '-01-01';
      var used = list.filter(function (v) { return (v.status === 'taken' || v.status === 'approved') && v.from >= yearStart && UI.daysFromToday(v.to) < 0; })
        .reduce(function (s, v) { return s + UI.spanDays(v.from, v.to); }, 0);
      var planned = list.filter(function (v) { return v.status === 'approved' || v.status === 'on_approval'; })
        .reduce(function (s, v) { return s + UI.spanDays(v.from, v.to); }, 0);
      var total = DB.vacationSettings.year_days;
      var html = '<div class="grid grid-stats" style="margin-bottom:24px">' +
        '<div class="card"><div class="card-body"><span class="stat-label">Дней в году</span><span class="stat-value">' + total + '</span></div></div>' +
        '<div class="card"><div class="card-body"><span class="stat-label">Использовано</span><span class="stat-value">' + used + '</span></div></div>' +
        '<div class="card"><div class="card-body"><span class="stat-label">Запланировано</span><span class="stat-value" style="color:var(--primary)">' + planned + '</span></div></div></div>';
      html += '<div class="table-scroll"><table class="data-table"><thead><tr><th>Период</th><th>Тип</th><th>Дней</th><th>Замещает</th><th>Статус</th><th></th></tr></thead><tbody>' +
        list.map(function (v) {
          var sub = v.substitute ? UI.user(v.substitute) : null;
          var acts = '';
          if (v.status === 'draft') acts = '<button type="button" class="btn btn-link" data-act="send" data-id="' + v.id + '">Отправить</button> <button type="button" class="btn btn-link" data-act="edit" data-id="' + v.id + '">Изменить</button> <button type="button" class="btn btn-link link-danger" data-act="del" data-id="' + v.id + '">Удалить</button>';
          else if (v.status === 'on_approval') acts = '<button type="button" class="btn btn-link link-danger" data-act="recall" data-id="' + v.id + '">Отозвать</button>';
          return '<tr><td>' + UI.fmt(v.from) + ' — ' + UI.fmt(v.to) + '</td><td>' + esc(typeName(v.type)) + '</td><td>' + UI.spanDays(v.from, v.to) + '</td>' +
            '<td>' + (sub ? '<a href="#" data-user="' + sub.id + '">' + esc(UI.shortName(sub)) + '</a>' : '—') + '</td><td>' + UI.statusTag(VAC_STATUS, v.status) + '</td><td class="nowrap">' + acts + '</td></tr>';
        }).join('') + (list.length ? '' : '<tr><td colspan="6"><div class="empty">Отпусков пока нет</div></td></tr>') + '</tbody></table></div>';
      $('#vac-body').innerHTML = html;
      $$('[data-act]', $('#vac-body')).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = UI.find(DB.vacations, b.getAttribute('data-id')), act = b.getAttribute('data-act');
          if (act === 'edit') editVacation(v);
          if (act === 'send') { v.status = 'on_approval'; DB.save(); UI.toast('Отправлено на согласование'); shell(); body(); }
          if (act === 'recall') { v.status = 'draft'; DB.save(); UI.toast('Заявка возвращена в черновики', 'info'); shell(); body(); }
          if (act === 'del') UI.confirm('Удалить черновик отпуска ' + UI.fmt(v.from) + ' — ' + UI.fmt(v.to) + '?', function () {
            DB.vacations.splice(DB.vacations.indexOf(v), 1); DB.save(); UI.toast('Черновик удалён'); shell(); body();
          });
        });
      });
    }

    function editVacation(v) {
      var mates = DB.users.filter(function (u) { return u.active && u.id !== uid && u.unit === me().unit || (u.active && u.id !== uid && me().manager === u.manager); });
      var fields = [
        { name: 'type', label: 'Тип отпуска', type: 'select', options: DB.vacationTypes.map(function (t) { return { v: t.id, t: t.name }; }) },
        { name: 'from', label: 'Дата начала', type: 'date', required: true },
        { name: 'to', label: 'Дата окончания', type: 'date', required: true },
        { name: 'substitute', label: 'Замещающий', type: 'select', options: [{ v: '', t: 'Не требуется' }].concat(mates.map(function (u) { return { v: u.id, t: UI.fullName(u) }; })) },
        { name: 'draft', label: 'Сохранить как черновик', type: 'checkbox' }
      ];
      var m = UI.modal({
        title: v ? 'Изменить отпуск' : 'Запланировать отпуск', width: 480,
        html: UI.formHtml(fields, v ? { type: v.type, from: v.from, to: v.to, substitute: v.substitute, draft: v.status === 'draft' } : { type: 'annual' }),
        footer: [{ text: 'Отмена' }, { text: 'Сохранить', primary: true, onClick: function (api) {
          var d = UI.readForm(api.body, fields);
          if (!d) return false;
          if (d.to < d.from) { var box = $('[data-field="to"]', api.body); box.classList.add('has-error'); $('.field-err', box).textContent = 'Окончание раньше начала'; return false; }
          var status = d.draft ? 'draft' : 'on_approval';
          if (v) { v.type = d.type; v.from = d.from; v.to = d.to; v.substitute = d.substitute; v.status = status; }
          else DB.vacations.push({ id: 'v' + Date.now(), user: uid, from: d.from, to: d.to, type: d.type, status: status, substitute: d.substitute });
          DB.save(); UI.toast(d.draft ? 'Черновик сохранён' : 'Отпуск отправлен на согласование'); shell(); body();
        } }]
      });
      return m;
    }

    function inbox() {
      var list = pendingList();
      if (!list.length) { $('#vac-body').innerHTML = '<div class="card"><div class="empty">Нет отпусков на согласование</div></div>'; return; }
      $('#vac-body').innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Сотрудник</th><th>Период</th><th>Тип</th><th>Дней</th><th></th></tr></thead><tbody>' +
        list.map(function (v) {
          var u = UI.user(v.user);
          return '<tr><td><a href="#" data-user="' + u.id + '">' + esc(UI.fullName(u)) + '</a></td><td>' + UI.fmt(v.from) + ' — ' + UI.fmt(v.to) + '</td><td>' + esc(typeName(v.type)) + '</td><td>' + UI.spanDays(v.from, v.to) + '</td>' +
            '<td class="nowrap"><button type="button" class="btn btn-primary btn-sm" data-ok="' + v.id + '">Согласовать</button> <button type="button" class="btn btn-sm" data-no="' + v.id + '">Отклонить</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      $$('[data-ok]', $('#vac-body')).forEach(function (b) {
        b.addEventListener('click', function () {
          UI.find(DB.vacations, b.getAttribute('data-ok')).status = 'approved'; DB.save(); UI.toast('Отпуск согласован'); shell(); body();
        });
      });
      $$('[data-no]', $('#vac-body')).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = UI.find(DB.vacations, b.getAttribute('data-no'));
          var fields = [{ name: 'reason', label: 'Причина отклонения', type: 'textarea', required: true }];
          UI.modal({
            title: 'Отклонить отпуск', width: 440, html: UI.formHtml(fields),
            footer: [{ text: 'Отмена' }, { text: 'Отклонить', primary: true, onClick: function (api) {
              if (!UI.readForm(api.body, fields)) return false;
              v.status = 'rejected'; DB.save(); UI.toast('Отпуск отклонён', 'info'); shell(); body();
            } }]
          });
        });
      });
    }

    function calendar() {
      var first = new Date(cal.y, cal.m, 1), days = new Date(cal.y, cal.m + 1, 0).getDate();
      var todayIso = DB.iso(DB.today());
      var head = '<th class="cal-name">Сотрудник</th>';
      for (var d = 1; d <= days; d++) {
        var wd = new Date(cal.y, cal.m, d).getDay();
        head += '<th class="cal-day' + (wd === 0 || wd === 6 ? ' is-weekend' : '') + '">' + d + '</th>';
      }
      var rows = subs.map(function (u) {
        var cells = '';
        for (var d2 = 1; d2 <= days; d2++) {
          var iso = cal.y + '-' + UI.pad(cal.m + 1) + '-' + UI.pad(d2);
          var v = DB.vacations.filter(function (x) { return x.user === u.id && (x.status === 'approved' || x.status === 'on_approval') && x.from <= iso && iso <= x.to; })[0];
          var wd2 = new Date(cal.y, cal.m, d2).getDay();
          cells += '<td class="cal-cell' + (v ? (v.status === 'approved' ? ' is-vac' : ' is-pend') : '') + (iso === todayIso ? ' is-today' : '') + (wd2 === 0 || wd2 === 6 ? ' is-weekend' : '') + '"' +
            (v ? ' title="' + UI.fmt(v.from) + ' — ' + UI.fmt(v.to) + '"' : '') + '></td>';
        }
        return '<tr><td class="cal-name"><a href="#" data-user="' + u.id + '">' + esc(UI.shortName(u)) + '</a></td>' + cells + '</tr>';
      }).join('');
      $('#vac-body').innerHTML =
        '<div class="cal-nav"><button type="button" class="btn" data-m="-1">‹</button><strong>' + UI.MONTHS[cal.m] + ' ' + cal.y + '</strong><button type="button" class="btn" data-m="1">›</button>' +
        '<span class="legend"><i class="lg lg-vac"></i>Согласован <i class="lg lg-pend"></i>На согласовании</span></div>' +
        '<div class="table-scroll"><table class="cal-table"><thead><tr>' + head + '</tr></thead><tbody>' +
        (rows || '<tr><td colspan="' + (days + 1) + '"><div class="empty">Нет подчинённых</div></td></tr>') + '</tbody></table></div>';
      $$('[data-m]', $('#vac-body')).forEach(function (b) {
        b.addEventListener('click', function () {
          cal.m += Number(b.getAttribute('data-m'));
          if (cal.m < 0) { cal.m = 11; cal.y--; } else if (cal.m > 11) { cal.m = 0; cal.y++; }
          calendar();
        });
      });
    }

    shell(); body();
  };

  /* ================= Заявки ================= */
  var REQ_STATUS = {
    new: { t: 'Новая', c: '' }, approval: { t: 'На согласовании', c: 'tag-warning' }, in_progress: { t: 'В работе', c: 'tag-info' },
    done: { t: 'Выполнена', c: 'tag-success' }, returned: { t: 'Возвращена', c: 'tag-danger' }, rejected: { t: 'Отклонена', c: 'tag-danger' }
  };

  pages.requests = function (root) {
    var uid = DB.me;
    var st = { tab: UI.params().tab || 'my', status: '', q: '' };

    function counts() {
      return {
        approvals: DB.requests.filter(function (r) { return r.status === 'approval' && r.approver === uid; }).length,
        queue: DB.requests.filter(function (r) { return (r.status === 'new' || r.status === 'in_progress') && (r.assignee === uid || !r.assignee); }).length
      };
    }

    function shell() {
      var c = counts();
      root.innerHTML = '<div class="page-head"><h4>Заявки</h4><button type="button" class="btn btn-primary" id="rq-new">' + UI.icon('plus') + 'Новая заявка</button></div>' +
        '<nav class="tabs"><a href="#" data-tab="my"' + (st.tab === 'my' ? ' class="is-active"' : '') + '>Мои заявки</a>' +
        '<a href="#" data-tab="approvals"' + (st.tab === 'approvals' ? ' class="is-active"' : '') + '>На согласовании' + (c.approvals ? ' <span class="tag tag-primary">' + c.approvals + '</span>' : '') + '</a>' +
        '<a href="#" data-tab="queue"' + (st.tab === 'queue' ? ' class="is-active"' : '') + '>Очередь исполнителя' + (c.queue ? ' <span class="tag tag-primary">' + c.queue + '</span>' : '') + '</a></nav>' +
        '<div class="toolbar" style="margin-bottom:16px"><select class="control select" id="rq-status" aria-label="Статус"><option value="">Все статусы</option>' +
        Object.keys(REQ_STATUS).map(function (k) { return '<option value="' + k + '"' + (st.status === k ? ' selected' : '') + '>' + REQ_STATUS[k].t + '</option>'; }).join('') + '</select>' +
        '<label class="input-wrap wide">' + UI.icon('search') + '<input type="search" id="rq-q" value="' + esc(st.q) + '" placeholder="Поиск по теме, номеру, типу"></label></div><div id="rq-list"></div>';
      $$('[data-tab]', root).forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); st.tab = a.getAttribute('data-tab'); shell(); list(); });
      });
      $('#rq-new').addEventListener('click', catalog);
      $('#rq-status').addEventListener('change', function (e) { st.status = e.target.value; list(); });
      $('#rq-q').addEventListener('input', function (e) { st.q = e.target.value; list(); });
    }

    function list() {
      var q = UI.norm(st.q);
      var items = DB.requests.filter(function (r) {
        if (st.tab === 'my' && r.author !== uid) return false;
        if (st.tab === 'approvals' && !(r.approver === uid && r.status === 'approval')) return false;
        if (st.tab === 'queue' && !((r.assignee === uid || !r.assignee) && r.author !== uid && r.status !== 'approval')) return false;
        if (st.status && r.status !== st.status) return false;
        if (!q) return true;
        return UI.norm(r.subject + ' ' + r.id + ' ' + UI.nameOf(DB.requestTypes, r.type)).indexOf(q) >= 0;
      }).sort(function (a, b) { return b.id - a.id; });
      $('#rq-list').innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>№</th><th>Тип</th><th>Тема</th><th>Автор</th><th>Создана</th><th>Исполнитель</th><th>Статус</th></tr></thead><tbody>' +
        items.map(function (r) {
          var a = UI.user(r.author), as = r.assignee ? UI.user(r.assignee) : null;
          return '<tr class="is-click" data-req="' + r.id + '"><td><a href="#">#' + r.id + '</a></td><td>' + esc(UI.nameOf(DB.requestTypes, r.type)) + '</td><td>' + esc(r.subject) + '</td>' +
            '<td>' + esc(UI.shortName(a)) + '</td><td>' + UI.fmt(r.created) + '</td><td>' + (as ? esc(UI.shortName(as)) : '—') + '</td><td>' + UI.statusTag(REQ_STATUS, r.status) + '</td></tr>';
        }).join('') + (items.length ? '' : '<tr><td colspan="7"><div class="empty">Заявок нет</div></td></tr>') + '</tbody></table></div>';
      $$('[data-req]', $('#rq-list')).forEach(function (tr) {
        tr.addEventListener('click', function (e) { e.preventDefault(); detail(+tr.getAttribute('data-req')); });
      });
    }

    function catalog() {
      var cats = DB.requestCategories.filter(function (c) { return c.active; });
      UI.modal({
        title: 'Новая заявка', width: 640,
        html: cats.map(function (c) {
          var types = DB.requestTypes.filter(function (t) { return t.cat === c.id && t.active; });
          if (!types.length) return '';
          return '<div class="extra-title">' + esc(c.name) + '</div><div class="grid grid-services" style="gap:12px">' + types.map(function (t) {
            return '<a class="card card-hover card-body type-card" href="#" data-type="' + t.id + '"><strong>' + esc(t.name) + '</strong><span class="muted small">' + esc(t.desc) + '</span></a>';
          }).join('') + '</div>';
        }).join('')
      });
      $$('[data-type]').forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); var id = a.getAttribute('data-type'); document.querySelector('.modal-wrap .modal-close').click(); form(id); });
      });
    }

    function form(typeId) {
      var t = UI.find(DB.requestTypes, typeId);
      var fields = [{ name: 'subject', label: 'Тема', type: 'text', required: true }].concat(t.fields.map(function (f) {
        var sel = f[2].indexOf('select:') === 0;
        return { name: f[0], label: f[1], type: sel ? 'select' : f[2], options: sel ? f[2].slice(7).split(',') : null, required: f[2] !== 'textarea' };
      }));
      UI.modal({
        title: esc(t.name), width: 560, html: '<p class="muted">' + esc(t.desc) + '</p>' + UI.formHtml(fields),
        footer: [{ text: 'Отмена' }, { text: 'Отправить', primary: true, onClick: function (api) {
          var d = UI.readForm(api.body, fields);
          if (!d) return false;
          var id = Math.max.apply(null, DB.requests.map(function (r) { return r.id; })) + 1;
          DB.requests.push({ id: id, type: typeId, author: uid, subject: d.subject, created: DB.isoOff(0), assignee: '', status: 'approval', approver: me().manager || '', payload: d });
          DB.save(); UI.toast('Заявка #' + id + ' создана'); st.tab = 'my'; shell(); list();
        } }]
      });
    }

    function detail(id) {
      var r = UI.find(DB.requests.map(function (x) { return { id: x.id, r: x }; }), id).r;
      var a = UI.user(r.author), as = r.assignee ? UI.user(r.assignee) : null, ap = r.approver ? UI.user(r.approver) : null;
      var steps = [['Создана', UI.fmt(r.created) + ' · ' + UI.shortName(a), true]];
      steps.push(['Согласование' + (ap ? ': ' + UI.shortName(ap) : ''), r.status === 'approval' ? 'ожидает решения' : (r.status === 'rejected' ? 'отклонено' : 'пройдено'), r.status !== 'approval']);
      steps.push(['Исполнение' + (as ? ': ' + UI.shortName(as) : ''), r.status === 'done' ? 'выполнена' : (r.status === 'in_progress' ? 'в работе' : 'ожидает'), r.status === 'done']);
      var footer = [{ text: 'Закрыть' }];
      if (r.status === 'approval' && r.approver === uid) {
        footer.push({ text: 'Вернуть', onClick: function () { r.status = 'returned'; DB.save(); UI.toast('Заявка возвращена', 'info'); shell(); list(); } });
        footer.push({ text: 'Согласовать', primary: true, onClick: function () { r.status = 'in_progress'; if (!r.assignee) r.assignee = uid; DB.save(); UI.toast('Заявка согласована'); shell(); list(); } });
      } else if ((r.status === 'new' || r.status === 'in_progress') && (r.assignee === uid || !r.assignee) && r.author !== uid) {
        if (r.status === 'new') footer.push({ text: 'Взять в работу', primary: true, onClick: function () { r.status = 'in_progress'; r.assignee = uid; DB.save(); UI.toast('Заявка взята в работу'); shell(); list(); } });
        else footer.push({ text: 'Выполнено', primary: true, onClick: function () { r.status = 'done'; DB.save(); UI.toast('Заявка выполнена'); shell(); list(); } });
      }
      UI.modal({
        title: 'Заявка #' + r.id, width: 600,
        html: '<h5 style="margin-bottom:12px">' + esc(r.subject) + '</h5>' +
          '<dl class="desc desc-sm"><dt>Тип</dt><dd>' + esc(UI.nameOf(DB.requestTypes, r.type)) + '</dd><dt>Автор</dt><dd><a href="#" data-user="' + a.id + '">' + esc(UI.fullName(a)) + '</a></dd>' +
          '<dt>Создана</dt><dd>' + UI.fmt(r.created) + '</dd><dt>Статус</dt><dd>' + UI.statusTag(REQ_STATUS, r.status) + '</dd></dl>' +
          '<div class="extra-title">История</div><ol class="timeline">' + steps.map(function (s) {
            return '<li class="' + (s[2] ? 'is-done' : '') + '"><strong>' + esc(s[0]) + '</strong><span class="muted small">' + esc(s[1]) + '</span></li>';
          }).join('') + '</ol>',
        footer: footer
      });
    }

    shell(); list();
  };

  /* ================= Опросы ================= */
  pages.surveys = function (root) {
    function render() {
      root.innerHTML = '<h4 class="page-title">Опросы</h4><div class="grid grid-cards">' + DB.surveys.filter(function (s) { return !s.hidden; }).map(function (s) {
        var open = s.status === 'open' && !s.passed;
        return '<article class="card card-full"><div class="card-body">' +
          (s.passed ? '<span class="tag tag-success">Пройден</span>' : (s.status === 'open' ? '<span class="tag tag-primary">Новый</span>' : '<span class="tag">Завершён</span>')) +
          '<h5 style="margin:8px 0">' + esc(s.title) + '</h5><p class="muted">' + esc(s.desc) + '</p>' +
          '<p class="small muted">' + (s.status === 'open' ? 'Открыт до ' : 'Завершён ') + UI.fmt(s.until) + '</p>' +
          '<button type="button" class="btn' + (open ? ' btn-primary' : '') + '" data-sv="' + s.id + '">' + (open ? 'Пройти опрос' : 'Посмотреть итоги') + '</button></div></article>';
      }).join('') + '</div>';
      $$('[data-sv]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var s = UI.find(DB.surveys, b.getAttribute('data-sv'));
          if (s.status === 'open' && !s.passed) take(s); else results(s);
        });
      });
    }

    function take(s) {
      var fields = s.questions.map(function (q) {
        return { name: q.id, label: esc(q.text), type: q.kind === 'text' ? 'textarea' : (q.kind === 'multi' ? 'checkgroup' : 'radio'), options: q.options, required: q.kind !== 'text', rows: 3 };
      });
      UI.modal({
        title: esc(s.title), width: 560, html: UI.formHtml(fields),
        footer: [{ text: 'Отмена' }, { text: 'Отправить ответы', primary: true, onClick: function (api) {
          if (!UI.readForm(api.body, fields)) return false;
          s.passed = true; s.votes += 1; DB.save(); UI.toast('Спасибо! Ваш ответ учтён'); render();
        } }]
      });
    }

    function results(s) {
      var html = '<p class="muted">Всего ответов: ' + s.votes + '</p>';
      s.questions.filter(function (q) { return q.kind !== 'text'; }).forEach(function (q, qi) {
        var rest = 100;
        html += '<div class="extra-title">' + esc(q.text) + '</div>' + q.options.map(function (o, i) {
          var share = i === q.options.length - 1 ? rest : Math.max(5, Math.round(rest * (0.45 - i * 0.07 + qi * 0.03)));
          rest -= share;
          return '<div class="bar-row"><span class="bar-label">' + esc(o) + '</span><span class="bar"><i style="width:' + share + '%"></i></span><span class="bar-val">' + share + '%</span></div>';
        }).join('');
      });
      UI.modal({ title: 'Итоги: ' + esc(s.title), width: 560, html: html });
    }
    render();
  };

  /* ================= VPN ================= */
  pages.vpn = function (root) {
    function render() {
      var acc = DB.vpnAccounts.filter(function (a) { return a.user === DB.me && a.status === 'active'; })[0];
      var html = '<h4 class="page-title">VPN</h4>';
      if (acc) {
        html += '<div class="card" style="max-width:720px"><div class="card-body"><p><span class="tag tag-success">Доступ активен</span></p>' +
          '<dl class="desc desc-bordered" style="margin-bottom:24px"><dt>Учётная запись</dt><dd>' + esc(acc.login) + '</dd><dt>Сервер</dt><dd>vpn.orbita.example</dd>' +
          '<dt>Выдан</dt><dd>' + UI.fmt(acc.issued) + '</dd><dt>Действует до</dt><dd>' + UI.fmt(acc.until) + '</dd></dl>' +
          '<p class="muted">Скачайте профиль подключения и импортируйте его в клиент.</p><div class="toolbar">' +
          '<button type="button" class="btn btn-primary" id="vpn-dl">' + UI.icon('login') + 'Скачать профиль</button>' +
          '<a class="btn" href="knowledge.html">Инструкция по подключению</a>' +
          '<button type="button" class="btn" id="vpn-reissue">Перевыпустить</button></div></div></div>';
      } else {
        html += '<div class="card" style="max-width:720px"><div class="card-body"><p><span class="tag tag-warning">Доступ не выдан</span></p>' +
          '<p class="muted">VPN положен всем действующим сотрудникам. Запросите доступ — учётная запись создаётся автоматически.</p>' +
          '<button type="button" class="btn btn-primary" id="vpn-req">Запросить доступ</button></div></div>';
      }
      root.innerHTML = html;
      var dl = $('#vpn-dl');
      if (dl) dl.addEventListener('click', function () {
        var text = 'client\ndev tun\nproto udp\nremote vpn.orbita.example 1194\nauth-user-pass\n# профиль пользователя ' + acc.login + '\n';
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        a.download = acc.login + '.ovpn';
        document.body.appendChild(a); a.click(); a.remove();
        UI.toast('Профиль скачан');
      });
      var re = $('#vpn-reissue');
      if (re) re.addEventListener('click', function () {
        UI.confirm('Перевыпустить профиль? Старый перестанет работать.', function () { acc.issued = DB.isoOff(0); acc.until = DB.isoOff(365); DB.save(); UI.toast('Профиль перевыпущен'); render(); }, 'Перевыпустить');
      });
      var rq = $('#vpn-req');
      if (rq) rq.addEventListener('click', function () {
        DB.vpnAccounts.push({ id: 'vp' + Date.now(), user: DB.me, login: me().email.split('@')[0], issued: DB.isoOff(0), until: DB.isoOff(365), status: 'active' });
        DB.save(); UI.toast('VPN-доступ выдан'); render();
      });
    }
    render();
  };

  /* ================= База знаний ================= */
  pages.knowledge = function (root) {
    var st = { q: '', section: '' };
    root.innerHTML = '<div class="page-head"><h4>База знаний</h4><div class="toolbar"><label class="input-wrap wide">' + UI.icon('search') +
      '<input type="search" id="kb-q" placeholder="Поиск по базе знаний"></label></div></div><div id="kb-seg" style="margin-bottom:16px"></div><div id="kb-list"></div>';
    function seg() {
      var opts = [['', 'Все разделы']].concat(DB.kbSections.filter(function (s) { return s.active; }).map(function (s) { return [s.id, s.name]; }));
      $('#kb-seg').innerHTML = '<nav class="segmented">' + opts.map(function (o) {
        return '<a href="#" data-s="' + o[0] + '"' + (o[0] === st.section ? ' class="is-active"' : '') + '>' + esc(o[1]) + '</a>';
      }).join('') + '</nav>';
      $$('[data-s]', $('#kb-seg')).forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); st.section = a.getAttribute('data-s'); seg(); list(); }); });
    }
    function list() {
      var q = UI.norm(st.q), html = '';
      DB.kbSections.filter(function (s) { return s.active && (!st.section || st.section === s.id); }).forEach(function (s) {
        var items = DB.kbItems.filter(function (i) {
          return i.section === s.id && (!q || UI.norm(i.title + ' ' + i.sub + ' ' + i.body.replace(/<[^>]+>/g, ' ')).indexOf(q) >= 0);
        });
        if (!items.length) return;
        html += '<section class="kb-section"><h5>' + esc(s.name) + '</h5><div class="card">' + items.map(function (i) {
          return '<a class="kb-item" href="#" data-kb="' + i.id + '">' + UI.icon('book') + '<div class="grow"><span class="strong">' + esc(i.title) + '</span><span class="muted small" style="display:block">' + esc(i.sub) + '</span></div>' +
            '<span class="tag">' + esc(UI.nameOf(DB.kbTypes, i.type)) + '</span>' + UI.icon('chevron', 'muted') + '</a>';
        }).join('') + '</div></section>';
      });
      $('#kb-list').innerHTML = html || '<div class="empty">Ничего не найдено</div>';
      $$('[data-kb]', $('#kb-list')).forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var i = UI.find(DB.kbItems, a.getAttribute('data-kb'));
          UI.modal({ title: esc(i.title), width: 680, html: '<p class="muted">' + esc(i.sub) + '</p><div class="news-html">' + i.body + '</div>' });
        });
      });
    }
    $('#kb-q').addEventListener('input', function (e) { st.q = e.target.value; list(); });
    seg(); list();
  };

  /* ================= Сервисы ================= */
  pages.services = function (root) {
    root.innerHTML = '<h3>Сервисы</h3><p class="muted">Внешние сервисы компании. Вход выполняется автоматически через ваш текущий аккаунт.</p>' +
      '<div class="grid grid-services">' + DB.services.filter(function (s) { return s.active; }).map(function (s) {
        return '<a class="link-block" href="#" data-svc="' + s.id + '"><div class="card card-hover card-full"><div class="card-body service">' + UI.icon(s.icon) +
          '<div><h5>' + esc(s.name) + '</h5><p>' + esc(s.desc.split('\n')[0]) + '</p></div></div></div></a>';
      }).join('') + '</div>';
    $$('[data-svc]', root).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var s = UI.find(DB.services, a.getAttribute('data-svc')), shown = false;
        var host = s.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        var m = UI.modal({
          title: '<span class="modal-ico">' + UI.icon(s.icon) + '</span> ' + esc(s.name), width: 720,
          html: '<button type="button" class="btn btn-link" id="svc-toggle">Показать инструкцию</button><div class="svc-instr" id="svc-instr" hidden><div class="pre">' + esc(s.desc) + '</div></div>' +
            '<p class="muted small" style="margin:8px 0 0">Вы будете перенаправлены на ' + esc(host) + '.</p>',
          footer: [{ text: 'Отмена' }, { text: UI.icon('login') + 'Перейти к сервису', primary: true, onClick: function () { window.open(s.url, '_blank', 'noopener,noreferrer'); } }]
        });
        $('#svc-toggle', m.el).addEventListener('click', function () {
          shown = !shown; $('#svc-instr', m.el).hidden = !shown; this.textContent = shown ? 'Скрыть инструкцию' : 'Показать инструкцию';
        });
      });
    });
  };

  /* ================= Профиль ================= */
  pages.profile = function (root) {
    function render() {
      var u = me(), role = UI.find(DB.roles, u.role), mgr = u.manager ? UI.user(u.manager) : null;
      root.innerHTML = '<h4 class="page-title">Профиль</h4><div class="card" style="max-width:860px"><div class="card-body"><div class="profile">' +
        UI.avatar(u, 'avatar-lg') + '<div><h4>' + esc(UI.fullName(u)) + '</h4>' +
        '<p class="muted" style="margin:0 0 8px">' + esc(posName(u)) + '</p><span class="tag ' + (u.role === 'admin' ? 'tag-primary' : 'tag-navy') + '">' + esc(role.name) + '</span></div></div></div>' +
        '<dl class="desc" style="border-top:1px solid var(--border)"><dt>Почта</dt><dd>' + esc(u.email) + '</dd><dt>Телефон</dt><dd>' + esc(u.phone || '—') + '</dd>' +
        '<dt>Внутренний номер</dt><dd>' + esc(u.vn || '—') + '</dd><dt>Подразделение</dt><dd>' + esc(UI.nameOf(DB.orgUnits, u.unit)) + '</dd>' +
        '<dt>Город</dt><dd>' + esc(UI.nameOf(DB.cities, u.city)) + '</dd><dt>Руководитель</dt><dd>' + (mgr ? '<a href="#" data-user="' + mgr.id + '">' + esc(UI.fullName(mgr)) + '</a>' : '—') + '</dd>' +
        '<dt>День рождения</dt><dd>' + UI.birthdayText(u) + '</dd><dt>О себе</dt><dd class="pre">' + esc(u.info || '—') + '</dd></dl></div>' +
        '<div class="toolbar mt-24"><button type="button" class="btn btn-primary" id="pf-edit">Редактировать</button>' +
        '<a class="btn" href="vacations.html">' + UI.icon('calendar') + 'Мои отпуска</a><a class="btn" href="requests.html">' + UI.icon('file') + 'Мои заявки</a>' +
        '<button type="button" class="btn" id="pf-reset" title="Вернуть исходные демо-данные">Сбросить демо-данные</button>' +
        '<a class="btn" href="login.html">' + UI.icon('logout') + 'Выйти</a></div>';
      $('#pf-reset').addEventListener('click', function () {
        UI.confirm('Все изменения, сделанные на сайте (отпуска, заявки, справочники админки), будут потеряны.', function () { DB.reset(); }, 'Сбросить');
      });
      $('#pf-edit').addEventListener('click', function () {
        var fields = [
          { name: 'phone', label: 'Телефон', type: 'text', placeholder: '+7 (900) 000-00-00' },
          { name: 'vn', label: 'Внутренний номер', type: 'text' },
          { name: 'info', label: 'О себе', type: 'textarea', rows: 4 }
        ];
        UI.modal({
          title: 'Редактировать профиль', width: 480, html: UI.formHtml(fields, u),
          footer: [{ text: 'Отмена' }, { text: 'Сохранить', primary: true, onClick: function (api) {
            var d = UI.readForm(api.body, fields); if (!d) return false;
            u.phone = d.phone; u.vn = d.vn; u.info = d.info; DB.save(); UI.toast('Профиль обновлён'); render();
          } }]
        });
      });
    }
    render();
  };

  document.addEventListener('shell-ready', function () {
    var name = document.body.getAttribute('data-page');
    var root = UI.$('#page');
    if (name && root && pages[name]) pages[name](root);
  });
})();
