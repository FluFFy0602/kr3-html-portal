/* Демо-данные портала. Даты считаются от сегодняшнего дня, чтобы «сегодня»,
   «через N дней» и «сейчас в отпуске» всегда выглядели живыми.
   Правки из админки и со страниц портала хранятся в localStorage (ключ orbita-db-v2).
   Фото сотрудников — images/avatars/<id>.jpg, обложки новостей — images/news/<id>.jpg. */
(function () {
  'use strict';

  var DAY = 86400000;
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function off(n) { return new Date(today().getTime() + n * DAY); }
  function iso(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function isoOff(n) { return iso(off(n)); }

  // v2: у сотрудников появилось фото, у новостей — обложка
  var STORE_KEY = 'orbita-db-v2';

  var cities = [
    { id: 'msk', name: 'Москва', active: true },
    { id: 'spb', name: 'Санкт-Петербург', active: true },
    { id: 'kzn', name: 'Казань', active: true }
  ];

  var positions = [
    { id: 'gd', name: 'Генеральный директор', active: true },
    { id: 'cio', name: 'Директор по информационным технологиям', active: true },
    { id: 'cfo', name: 'Финансовый директор', active: true },
    { id: 'chro', name: 'Директор по персоналу', active: true },
    { id: 'head', name: 'Руководитель отдела', active: true },
    { id: 'dev', name: 'Разработчик', active: true },
    { id: 'lead', name: 'Ведущий разработчик', active: true },
    { id: 'sysadm', name: 'Системный администратор', active: true },
    { id: 'acc', name: 'Бухгалтер', active: true },
    { id: 'hr', name: 'HR-менеджер', active: true },
    { id: 'trainer', name: 'Специалист по обучению', active: true },
    { id: 'sales', name: 'Менеджер по продажам', active: true },
    { id: 'treasury', name: 'Специалист казначейства', active: true },
    { id: 'secspec', name: 'Специалист по безопасности', active: true }
  ];

  // type: position | department | office | separate_unit | management | division
  var orgUnits = [
    { id: 'gd',    name: 'Генеральный директор',                 type: 'position',      parent: null, city: 'msk', head: 'u1',  show: true },
    { id: 'it',    name: 'Департамент информационных технологий', type: 'department',    parent: 'gd',  city: 'msk', head: 'u2',  show: true },
    { id: 'dev',   name: 'Отдел разработки',                     type: 'office',        parent: 'it',  city: 'msk', head: 'u5',  show: true },
    { id: 'sec',   name: 'Отдел информационной безопасности',    type: 'office',        parent: 'it',  city: 'msk', head: 'u3',  show: true },
    { id: 'adm',   name: 'Служба администрирования',             type: 'division',      parent: 'it',  city: 'msk', head: 'u4',  show: true },
    { id: 'fin',   name: 'Финансовый департамент',               type: 'department',    parent: 'gd',  city: 'msk', head: 'u8',  show: true },
    { id: 'buh',   name: 'Бухгалтерия',                          type: 'office',        parent: 'fin', city: 'msk', head: 'u9',  show: true },
    { id: 'kaz',   name: 'Казначейство',                         type: 'office',        parent: 'fin', city: 'msk', head: 'u11', show: true },
    { id: 'hrd',   name: 'Департамент по персоналу',             type: 'department',    parent: 'gd',  city: 'spb', head: 'u13', show: true },
    { id: 'kadry', name: 'Отдел кадров',                         type: 'office',        parent: 'hrd', city: 'spb', head: 'u14', show: true },
    { id: 'learn', name: 'Отдел обучения',                       type: 'office',        parent: 'hrd', city: 'spb', head: 'u15', show: true },
    { id: 'kzn',   name: 'Казанский филиал',                     type: 'separate_unit', parent: 'gd',  city: 'kzn', head: 'u17', show: true },
    { id: 'sales', name: 'Отдел продаж',                         type: 'office',        parent: 'kzn', city: 'kzn', head: 'u18', show: true }
  ];

  // bd — смещение дня рождения от сегодня в днях (год не важен)
  function U(id, last, first, patr, email, vn, pos, unit, city, mgr, bd, role, extra) {
    var b = off(bd);
    var u = {
      id: id, last: last, first: first, patr: patr, email: email, phone: '', vn: vn,
      photo: 'images/avatars/' + id + '.jpg',
      position: pos, unit: unit, city: city, manager: mgr,
      bm: b.getMonth() + 1, bday: b.getDate(),
      role: role, info: '', active: true, hired: '2019-03-01', fired: null,
      lastLogin: isoOff(-1), created: '2024-01-15'
    };
    for (var k in extra) u[k] = extra[k];
    return u;
  }

  var users = [
    U('u1',  'Громов',   'Александр', 'Владимирович', 'a.gromov@orbita.example',   '1000', 'gd',      'gd',    'msk', null,  71, 'manager'),
    U('u2',  'Васильев', 'Сергей',    'Петрович',     's.vasiliev@orbita.example', '1001', 'cio',     'it',    'msk', 'u1',  36, 'manager'),
    U('u3',  'Козлов',   'Никита',    'Андреевич',    'n.kozlov@orbita.example',   '1014', 'head',    'sec',   'msk', 'u2', 140, 'manager', { info: 'Отвечаю за безопасность инфраструктуры и доступов.' }),
    U('u4',  'Попов',    'Глеб',      'Максимович',   'g.popov@orbita.example',    '1023', 'sysadm',  'adm',   'msk', 'u2',  24, 'employee'),
    U('u5',  'Волков',   'Олег',      'Николаевич',   'o.volkov@orbita.example',   '1031', 'lead',    'dev',   'msk', 'u2', 200, 'manager', { info: 'Backend, Python, PostgreSQL.' }),
    U('u6',  'Белова',   'Ксения',    'Дмитриевна',   'k.belova@orbita.example',   '1032', 'dev',     'dev',   'msk', 'u5',  90, 'employee'),
    U('u7',  'Зайцев',   'Артём',     'Ильич',        'a.zaytsev@orbita.example',  '1033', 'dev',     'dev',   'msk', 'u5', 160, 'employee'),
    U('u8',  'Новикова', 'Елена',     'Викторовна',   'e.novikova@orbita.example', '2002', 'cfo',     'fin',   'msk', 'u1',  12, 'manager'),
    U('u9',  'Морозова', 'Татьяна',   'Игоревна',     't.morozova@orbita.example', '2015', 'head',    'buh',   'msk', 'u8',  50, 'manager'),
    U('u10', 'Фёдорова', 'Алина',     'Романовна',    'a.fedorova@orbita.example', '',     'acc',     'buh',   'msk', 'u9', 105, 'employee'),
    U('u11', 'Лебедев',  'Сергей',    'Аркадьевич',   's.lebedev@orbita.example',  '2021', 'head',    'kaz',   'msk', 'u8',  75, 'manager'),
    U('u12', 'Соколов',  'Пётр',      'Леонидович',   'p.sokolov@orbita.example',  '2022', 'treasury','kaz',   'msk', 'u11',120, 'employee'),
    U('u13', 'Иванова',  'Анна',      'Сергеевна',    'a.ivanova@orbita.example',  '3001', 'chro',    'hrd',   'spb', 'u1',   0, 'admin', { info: 'Руковожу департаментом по персоналу.' }),
    U('u14', 'Смирнова', 'Мария',     'Андреевна',    'm.smirnova@orbita.example', '3007', 'hr',      'kadry', 'spb', 'u13',  4, 'hr'),
    U('u15', 'Кузнецов', 'Игорь',     'Павлович',     'i.kuznetsov@orbita.example','3012', 'trainer', 'learn', 'spb', 'u13',  8, 'employee'),
    U('u16', 'Тихонова', 'Вера',      'Сергеевна',    'v.tikhonova@orbita.example','3009', 'hr',      'kadry', 'spb', 'u14',180, 'hr'),
    U('u17', 'Гаврилов', 'Руслан',    'Маратович',    'r.gavrilov@orbita.example', '4001', 'head',    'kzn',   'kzn', 'u1',  95, 'manager'),
    U('u18', 'Орлова',   'Диана',     'Ринатовна',    'd.orlova@orbita.example',   '4005', 'head',    'sales', 'kzn', 'u17', 30, 'manager'),
    U('u19', 'Хасанов',  'Тимур',     'Ильдарович',   't.khasanov@orbita.example', '4006', 'sales',   'sales', 'kzn', 'u18',150, 'employee'),
    U('u20', 'Петров',   'Дмитрий',   'Олегович',     'd.petrov@orbita.example',   '1034', 'dev',     'dev',   'msk', 'u5',   2, 'employee'),
    U('u21', 'Макаров',  'Илья',      'Сергеевич',    'i.makarov@orbita.example',  '1024', 'sysadm',  'adm',   'msk', 'u4',  60, 'employee'),
    U('u22', 'Егорова',  'Полина',    'Андреевна',    'p.egorova@orbita.example',  '2016', 'acc',     'buh',   'msk', 'u9',  18, 'employee'),
    U('u23', 'Николаев', 'Фёдор',     'Игоревич',     'f.nikolaev@orbita.example', '1015', 'secspec', 'sec',   'msk', 'u3', 210, 'employee', { active: false, fired: isoOff(-40) })
  ];

  var roles = [
    { id: 'admin',    name: 'Администратор', color: '#F2551B', perms: 34, system: true },
    { id: 'hr',       name: 'HR',            color: '#1677ff', perms: 18, system: true },
    { id: 'manager',  name: 'Руководитель',  color: '#0A1A34', perms: 12, system: true },
    { id: 'employee', name: 'Сотрудник',     color: '#8c8c8c', perms: 7,  system: true }
  ];

  var permissionGroups = [
    { name: 'Пользователи', items: ['Просмотр полной карточки', 'Создание', 'Изменение', 'Удаление'] },
    { name: 'Роли',         items: ['Просмотр', 'Создание', 'Изменение', 'Удаление'] },
    { name: 'Новости',      items: ['Создание', 'Изменение', 'Удаление', 'Публикация'] },
    { name: 'Опросы',       items: ['Просмотр', 'Создание', 'Публикация', 'Статистика'] },
    { name: 'Отпуска',      items: ['Свои', 'Согласование подчинённых', 'Согласование HR', 'Настройки'] },
    { name: 'Заявки',       items: ['Свои', 'Согласование', 'Очередь исполнителя', 'Типы заявок'] },
    { name: 'База знаний',  items: ['Просмотр', 'Создание', 'Редактирование', 'Администрирование'] }
  ];

  var newsCategories = [
    { id: 'life', name: 'Корпоративная жизнь', active: true },
    { id: 'it',   name: 'ИТ и безопасность',   active: true },
    { id: 'hr',   name: 'HR',                  active: true },
    { id: 'ot',   name: 'Охрана труда',        active: true }
  ];

  var news = [
    { id: 'n1', slug: 'itogi-korporativa', cat: 'life', author: 'u13', published: isoOff(-1), status: 'published', cover: 'images/news/n1.jpg',
      title: 'Итоги осеннего корпоратива: фото и благодарности',
      content: '<p>Спасибо всем, кто пришёл! Делимся фотографиями с мероприятия, а также рассказываем, какие идеи для следующего года предложили коллеги.</p><h4>Что понравилось больше всего</h4><ul><li>Квест по офису с командами из разных городов</li><li>Живая музыка и дружеский турнир по настольному теннису</li><li>Праздничный ужин в тёплой компании</li></ul><blockquote>Было здорово наконец увидеть коллег из Казани и Петербурга вживую.</blockquote><p>Идеи на следующий год можно оставить в <a href="surveys.html">опросе</a>.</p>' },
    { id: 'n2', slug: 'obnovlenie-vpn', cat: 'it', author: 'u3', published: isoOff(-4), status: 'published', cover: 'images/news/n2.jpg',
      title: 'Обновление VPN-клиента: что нужно сделать до 1 ноября',
      content: '<p>С 1 ноября старые версии VPN-клиента перестанут подключаться к корпоративной сети: мы переходим на новый протокол шифрования. Чтобы не остаться без удалённого доступа, обновите клиент заранее.</p><h4>Как обновить</h4><ol><li>Откройте раздел <a href="vpn.html">VPN</a> и скачайте актуальный дистрибутив.</li><li>Закройте текущий клиент и запустите установщик.</li><li>Войдите под своей учётной записью — профиль подтянется автоматически.</li></ol><blockquote>Если подключиться не получилось, создайте заявку в разделе «Заявки».</blockquote><hr><p>Спасибо, что помогаете нам делать инфраструктуру безопаснее!</p>' },
    { id: 'n3', slug: 'grafik-otpuskov-2027', cat: 'hr', author: 'u14', published: isoOff(-7), status: 'published', cover: 'images/news/n3.jpg',
      title: 'График отпусков на 2027 год: приём заявок открыт',
      content: '<p>До 15 ноября необходимо внести желаемые периоды отпуска в разделе <a href="vacations.html">«Отпуска»</a> и согласовать их с руководителем.</p><p>Напоминаем: хотя бы одна часть отпуска должна быть не короче 14 календарных дней.</p>' },
    { id: 'n4', slug: 'instruktazh-pozhar', cat: 'ot', author: 'u3', published: isoOff(-10), status: 'published', cover: 'images/news/n4.jpg',
      title: 'Плановый инструктаж по пожарной безопасности',
      content: '<p>Инструктаж пройдёт в переговорной «Волга» в среду в 11:00. Присутствие обязательно для всех сотрудников офиса.</p>' },
    { id: 'n5', slug: 'sportivnaya-sektsiya', cat: 'life', author: 'u15', published: isoOff(-13), status: 'published', cover: 'images/news/n5.jpg',
      title: 'Открыта запись в корпоративную спортивную секцию',
      content: '<p>Волейбол по вторникам и четвергам, плавание по субботам. Запишитесь у координатора до конца месяца.</p>' },
    { id: 'n6', slug: 'fishing-pamyatka', cat: 'it', author: 'u3', published: isoOff(-18), status: 'published', cover: 'images/news/n6.jpg',
      title: 'Как распознать фишинговое письмо: короткая памятка',
      content: '<p>Пять признаков подозрительного письма и что делать, если вы уже перешли по ссылке.</p><ol><li>Неожиданное вложение или ссылка.</li><li>Срочность и угрозы.</li><li>Адрес отправителя не совпадает с названием.</li><li>Просьба ввести пароль.</li><li>Ошибки в тексте.</li></ol>' },
    { id: 'n7', slug: 'novyy-ofis-kazan', cat: 'life', author: 'u17', published: isoOff(-24), status: 'published', cover: 'images/news/n7.jpg',
      title: 'Казанский филиал переезжает в новый офис',
      content: '<p>С 10 ноября казанская команда будет работать по новому адресу. Подробности — в рассылке.</p>' },
    { id: 'n8', slug: 'chernovik-novosti', cat: 'hr', author: 'u14', published: null, status: 'draft', cover: 'images/news/n8.jpg',
      title: 'Чек-лист для новых сотрудников (черновик)',
      content: '<p>Черновик новости для будущих публикаций.</p>' }
  ];

  var vacationTypes = [
    { id: 'annual',  name: 'Ежегодный оплачиваемый' },
    { id: 'unpaid',  name: 'За свой счёт' },
    { id: 'study',   name: 'Учебный' },
    { id: 'dayoff',  name: 'Отгул' }
  ];

  // status: draft | on_approval | approved | rejected | taken
  var vacations = [
    { id: 'v1',  user: 'u5',  from: isoOff(-5),  to: isoOff(5),   type: 'annual', status: 'approved', substitute: 'u20' },
    { id: 'v2',  user: 'u9',  from: isoOff(-3),  to: isoOff(9),   type: 'annual', status: 'approved', substitute: 'u10' },
    { id: 'v3',  user: 'u21', from: isoOff(-2),  to: isoOff(2),   type: 'annual', status: 'approved', substitute: 'u4' },
    { id: 'v4',  user: 'u22', from: isoOff(-1),  to: isoOff(6),   type: 'annual', status: 'approved', substitute: 'u10' },
    { id: 'v5',  user: 'u11', from: isoOff(6),   to: isoOff(19),  type: 'annual', status: 'approved', substitute: 'u12' },
    { id: 'v6',  user: 'u6',  from: isoOff(10),  to: isoOff(23),  type: 'annual', status: 'approved', substitute: 'u7' },
    { id: 'v7',  user: 'u13', from: isoOff(-300), to: isoOff(-287), type: 'annual', status: 'taken', substitute: 'u14' },
    { id: 'v8',  user: 'u13', from: isoOff(-120), to: isoOff(-114), type: 'annual', status: 'taken', substitute: 'u14' },
    { id: 'v9',  user: 'u13', from: isoOff(60),  to: isoOff(73),  type: 'annual', status: 'on_approval', substitute: 'u14' },
    { id: 'v10', user: 'u13', from: isoOff(150), to: isoOff(154), type: 'unpaid', status: 'draft', substitute: '' },
    { id: 'v11', user: 'u14', from: isoOff(4),   to: isoOff(11),  type: 'annual', status: 'on_approval', substitute: 'u16' },
    { id: 'v12', user: 'u15', from: isoOff(80),  to: isoOff(93),  type: 'annual', status: 'on_approval', substitute: 'u16' },
    { id: 'v13', user: 'u7',  from: isoOff(33),  to: isoOff(40),  type: 'study',  status: 'on_approval', substitute: 'u6' }
  ];

  var substitutions = [
    { id: 's1', user: 'u5',  substitute: 'u20', from: isoOff(-5), to: isoOff(5),  order: 'Приказ № 412 от ' + isoOff(-8).split('-').reverse().join('.') },
    { id: 's2', user: 'u11', substitute: 'u12', from: isoOff(6),  to: isoOff(19), order: '' },
    { id: 's3', user: 'u9',  substitute: 'u10', from: isoOff(-3), to: isoOff(9),  order: 'Приказ № 415' }
  ];

  var requestCategories = [
    { id: 'it',  name: 'ИТ и доступы', active: true },
    { id: 'hr',  name: 'Кадровые',     active: true },
    { id: 'adm', name: 'Хозяйственные', active: true }
  ];

  var requestTypes = [
    { id: 'rt1', name: 'Доступ к системе',    cat: 'it',  assignee: 'u4',  desc: 'Запрос прав в информационных системах.', fields: [['system', 'Система', 'text'], ['reason', 'Обоснование', 'textarea']], active: true },
    { id: 'rt2', name: 'Оборудование',        cat: 'it',  assignee: 'u21', desc: 'Выдача и замена рабочего оборудования.', fields: [['item', 'Что требуется', 'text'], ['reason', 'Обоснование', 'textarea']], active: true },
    { id: 'rt3', name: 'Справка с места работы', cat: 'hr', assignee: 'u14', desc: '2-НДФЛ, справка о доходах, с места работы.', fields: [['kind', 'Вид справки', 'select:2-НДФЛ,С места работы,О доходах'], ['copies', 'Количество экземпляров', 'text']], active: true },
    { id: 'rt4', name: 'Командировка',        cat: 'hr',  assignee: 'u14', desc: 'Оформление служебной командировки.', fields: [['dest', 'Город', 'text'], ['dates', 'Даты', 'text'], ['goal', 'Цель', 'textarea']], active: true },
    { id: 'rt5', name: 'Пропуск в офис',      cat: 'adm', assignee: 'u21', desc: 'Гостевой или временный пропуск.', fields: [['guest', 'ФИО гостя', 'text'], ['date', 'Дата визита', 'text']], active: true }
  ];

  // status: new | approval | in_progress | done | returned | rejected
  var requests = [
    { id: 1842, type: 'rt1', author: 'u13', subject: 'Доступ к бухгалтерской базе', created: isoOff(-1),  assignee: 'u4',  status: 'in_progress', approver: 'u13' },
    { id: 1831, type: 'rt2', author: 'u13', subject: 'Замена монитора',             created: isoOff(-6),  assignee: '',    status: 'approval',    approver: 'u1' },
    { id: 1790, type: 'rt3', author: 'u13', subject: 'Справка 2-НДФЛ за 2025 год',  created: isoOff(-14), assignee: 'u14', status: 'done',        approver: '' },
    { id: 1755, type: 'rt4', author: 'u13', subject: 'Командировка в Казань, 12–14 ноября', created: isoOff(-20), assignee: 'u14', status: 'returned', approver: 'u1' },
    { id: 1850, type: 'rt1', author: 'u6',  subject: 'Доступ к репозиторию infra',  created: isoOff(0),   assignee: 'u4',  status: 'approval',    approver: 'u13' },
    { id: 1849, type: 'rt5', author: 'u19', subject: 'Пропуск для гостя на 5 ноября', created: isoOff(-2), assignee: '',   status: 'approval',    approver: 'u13' },
    { id: 1847, type: 'rt2', author: 'u10', subject: 'Мышь и клавиатура',           created: isoOff(-3),  assignee: 'u13', status: 'in_progress', approver: '' },
    { id: 1845, type: 'rt3', author: 'u22', subject: 'Справка с места работы',      created: isoOff(-3),  assignee: 'u13', status: 'in_progress', approver: '' },
    { id: 1843, type: 'rt1', author: 'u12', subject: 'Доступ к казначейской системе', created: isoOff(-4), assignee: 'u13', status: 'in_progress', approver: '' },
    { id: 1838, type: 'rt2', author: 'u7',  subject: 'Второй монитор',              created: isoOff(-5),  assignee: 'u13', status: 'in_progress', approver: '' },
    { id: 1836, type: 'rt5', author: 'u3',  subject: 'Пропуск подрядчику',          created: isoOff(-5),  assignee: 'u13', status: 'new',         approver: '' }
  ];

  var surveys = [
    { id: 'sv1', title: 'Удовлетворённость условиями работы', desc: 'Анонимный опрос из 3 вопросов, займёт около 2 минут. Результаты помогут нам улучшить офис и процессы.',
      until: isoOff(18), status: 'open', passed: false, hidden: false, votes: 112,
      questions: [
        { id: 'q1', text: 'Как вы оцениваете рабочее место?', kind: 'single', options: ['Отлично', 'Хорошо', 'Нормально', 'Плохо'] },
        { id: 'q2', text: 'Что стоит улучшить в первую очередь?', kind: 'multi', options: ['Освещение', 'Мебель', 'Переговорные', 'Кухня', 'Тишина'] },
        { id: 'q3', text: 'Ваши пожелания', kind: 'text', options: [] }
      ] },
    { id: 'sv2', title: 'Выбор формата новогоднего вечера', desc: 'Проголосуйте за понравившийся формат.',
      until: isoOff(13), status: 'open', passed: false, hidden: false, votes: 86,
      questions: [
        { id: 'q1', text: 'Какой формат вам больше по душе?', kind: 'single', options: ['Ресторан', 'Загородный выезд', 'Квест'] }
      ] },
    { id: 'sv3', title: 'Оценка нового офисного ПО', desc: 'Спасибо за участие! Итоги опубликованы в разделе «Новости».',
      until: isoOff(-28), status: 'closed', passed: true, hidden: false, votes: 140,
      questions: [
        { id: 'q1', text: 'Насколько вам удобно новое ПО?', kind: 'single', options: ['Очень удобно', 'Скорее удобно', 'Скорее неудобно'] }
      ] }
  ];

  var kbSections = [
    { id: 'ks1', name: 'ИТ и доступы', active: true },
    { id: 'ks2', name: 'Кадровые вопросы', active: true },
    { id: 'ks3', name: 'Регламенты', active: true }
  ];
  var kbTypes = [
    { id: 'kt1', name: 'Инструкция', active: true },
    { id: 'kt2', name: 'Регламент', active: true },
    { id: 'kt3', name: 'FAQ', active: true }
  ];
  var kbItems = [
    { id: 'k1', section: 'ks1', type: 'kt1', title: 'Подключение к корпоративному VPN', sub: 'Инструкция для Windows, macOS и Linux', body: '<ol><li>Скачайте клиент в разделе «VPN».</li><li>Импортируйте профиль подключения.</li><li>Войдите через Единый Вход.</li></ol><p>Если подключение не устанавливается, создайте заявку на доступ.</p>' },
    { id: 'k2', section: 'ks1', type: 'kt1', title: 'Настройка корпоративной почты на телефоне', sub: 'iOS и Android', body: '<p>Откройте «Почта» → «Добавить учётную запись» → Exchange, укажите адрес вида <b>имя@orbita.example</b>.</p>' },
    { id: 'k3', section: 'ks1', type: 'kt3', title: 'Сброс пароля от учётной записи', sub: 'Единый Вход', body: '<p>Пароль меняется на странице Единого Входа. Ссылка «Забыли пароль?» отправит инструкцию на личную почту.</p>' },
    { id: 'k4', section: 'ks2', type: 'kt1', title: 'Как оформить отпуск', sub: 'Планирование, согласование, замещение', body: '<p>Откройте раздел «Отпуска» → «Запланировать отпуск», выберите даты и замещающего. Заявка уйдёт руководителю, затем в HR.</p>' },
    { id: 'k5', section: 'ks2', type: 'kt3', title: 'Как заказать справку', sub: '2-НДФЛ, с места работы', body: '<p>Создайте заявку типа «Справка с места работы». Срок исполнения — 3 рабочих дня.</p>' },
    { id: 'k6', section: 'ks3', type: 'kt2', title: 'Правила внутреннего трудового распорядка', sub: 'Редакция от 01.09.2026', body: '<p>Рабочее время — с 9:00 до 18:00, перерыв на обед — 1 час. Полный текст регламента доступен в HR.</p>' }
  ];

  var services = [
    { id: 'sv1', name: 'Трекер задач', icon: 'file', url: 'https://tracker.orbita.example', desc: 'Постановка и контроль задач, спринты, доски проектов.\n\n1. Войдите через Единый Вход.\n2. Выберите проект.\n3. Создайте задачу.', active: true },
    { id: 'sv2', name: 'Почта', icon: 'mail', url: 'https://mail.orbita.example', desc: 'Корпоративная почта и общий календарь.', active: true },
    { id: 'sv3', name: 'Wiki', icon: 'book', url: 'https://wiki.orbita.example', desc: 'Документация, регламенты и инструкции команд.', active: true },
    { id: 'sv4', name: 'Видеоконференции', icon: 'users', url: 'https://meet.orbita.example', desc: 'Встречи, вебинары и запись эфиров.', active: true },
    { id: 'sv5', name: 'Единый Вход', icon: 'shield', url: 'https://sso.orbita.example', desc: 'Управление учётной записью, паролем и двухфакторной защитой.', active: true },
    { id: 'sv6', name: 'Бронирование переговорных', icon: 'calendar', url: 'https://rooms.orbita.example', desc: 'Расписание переговорных комнат во всех офисах.', active: true }
  ];

  var vpnAccounts = [
    { id: 'vp1', user: 'u13', login: 'a.ivanova', issued: isoOff(-230), until: isoOff(135), status: 'active' },
    { id: 'vp2', user: 'u5',  login: 'o.volkov',  issued: isoOff(-100), until: isoOff(265), status: 'active' },
    { id: 'vp3', user: 'u6',  login: 'k.belova',  issued: isoOff(-30),  until: isoOff(335), status: 'active' },
    { id: 'vp4', user: 'u23', login: 'f.nikolaev', issued: isoOff(-400), until: isoOff(-35), status: 'revoked' }
  ];

  var letters = [
    { id: 'l1', num: 'ВХ-0457', subject: 'Запрос документов по договору № 17', from: 'ООО «Вектор»', due: isoOff(3), owner: 'u8', status: 'in_work' },
    { id: 'l2', num: 'ВХ-0461', subject: 'Уведомление о проверке', from: 'ФНС России', due: isoOff(10), owner: 'u9', status: 'new' },
    { id: 'l3', num: 'ВХ-0430', subject: 'Ответ на претензию', from: 'АО «Север»', due: isoOff(-4), owner: 'u8', status: 'overdue' },
    { id: 'l4', num: 'ВХ-0412', subject: 'Согласование условий поставки', from: 'ИП Громов', due: isoOff(-20), owner: 'u12', status: 'done' }
  ];

  var audit = [
    { id: 'a1', at: isoOff(0) + ' 10:42', user: 'u13', action: 'Вход в систему', entity: 'Сессия', ip: '10.10.4.21' },
    { id: 'a2', at: isoOff(0) + ' 10:15', user: 'u14', action: 'Согласование отпуска', entity: 'Отпуск v11', ip: '10.10.4.37' },
    { id: 'a3', at: isoOff(-1) + ' 17:03', user: 'u3',  action: 'Публикация новости', entity: 'Обновление VPN-клиента', ip: '10.20.1.8' },
    { id: 'a4', at: isoOff(-1) + ' 12:30', user: 'u13', action: 'Изменение роли', entity: 'Сотрудник Макаров И. С.', ip: '10.10.4.21' },
    { id: 'a5', at: isoOff(-2) + ' 09:11', user: 'u4',  action: 'Выдача VPN-доступа', entity: 'k.belova', ip: '10.20.1.15' },
    { id: 'a6', at: isoOff(-3) + ' 16:48', user: 'u13', action: 'Создание категории новостей', entity: 'Охрана труда', ip: '10.10.4.21' },
    { id: 'a7', at: isoOff(-5) + ' 11:20', user: 'u2',  action: 'Увольнение сотрудника', entity: 'Николаев Ф. И.', ip: '10.20.1.3' }
  ];

  var notifications = [
    { id: 'nt1', text: 'Новая заявка на согласование: «Доступ к репозиторию infra»', href: 'requests.html', at: 'сегодня, 09:40', read: false },
    { id: 'nt2', text: 'Опубликована новость «Итоги осеннего корпоратива»', href: 'news-article.html?slug=itogi-korporativa', at: 'вчера, 18:02', read: false },
    { id: 'nt3', text: 'Ваша заявка «Справка 2-НДФЛ» выполнена', href: 'requests.html', at: '14.10, 12:15', read: true }
  ];

  var vacationSettings = { who_is_out_days: 14, min_part_days: 14, year_days: 28, plan_deadline: '15.11' };

  var seed = {
    me: 'u13',
    cities: cities, positions: positions, orgUnits: orgUnits, users: users,
    roles: roles, permissionGroups: permissionGroups,
    newsCategories: newsCategories, news: news,
    vacationTypes: vacationTypes, vacations: vacations, substitutions: substitutions,
    requestCategories: requestCategories, requestTypes: requestTypes, requests: requests,
    surveys: surveys, kbSections: kbSections, kbTypes: kbTypes, kbItems: kbItems,
    services: services, vpnAccounts: vpnAccounts, letters: letters, audit: audit,
    notifications: notifications, vacationSettings: vacationSettings
  };

  var db = seed;
  try {
    var saved = localStorage.getItem(STORE_KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      // Даты в сидах «живые», поэтому из хранилища берём только то, что правил человек
      db = parsed && parsed.me ? parsed : seed;
    }
  } catch (e) { db = seed; }

  db.save = function () {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { /* без хранилища работаем в памяти */ }
  };
  db.reset = function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  };
  db.iso = iso;
  db.isoOff = isoOff;
  db.today = today;

  window.DB = db;
})();
