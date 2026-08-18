/**
 * Публичные профили исполнителей: CV, видео-визитка, портфолио, отзывы.
 *
 * Карточка на доске — это витрина. Прежде чем доверить человеку бюджет,
 * заказчик хочет увидеть опыт, реальные работы и что о нём говорят другие.
 * Всё это лежит здесь и открывается по клику на карточку.
 */

/** Демо-ролики: публичные образцы Google, стабильные и без ключей. */
const CLIP = {
  a: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  b: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  c: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  d: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  e: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
};

export const DEVELOPER_PROFILES = {
  'dev-aziz': {
    about:
      'Семь лет собираю интернет-магазины и маркетплейсы под ключ. Беру проект целиком: от схемы базы до запуска на домене .uz и передачи админки владельцу. Работаю по неделям — каждую пятницу присылаю демо, чтобы не было сюрпризов в конце.',
    videoIntro: { url: CLIP.a, title: 'Видео-визитка: как я веду проект' },
    responseHours: 2,
    successRate: 97,
    repeatClients: 14,
    languages: ['Узбекский — родной', 'Русский — свободно', 'Английский — B2'],
    skills: ['React', 'Node.js', 'PostgreSQL', 'Payme API', 'Click API', 'Docker', 'REST'],
    experience: [
      {
        company: 'Фриланс · собственная практика',
        role: 'Fullstack-разработчик',
        period: '2022 — сейчас',
        detail: '23 магазина и CRM для узбекских брендов. Средний чек проекта — 45 млн сум.',
      },
      {
        company: 'Uzinfocom',
        role: 'Backend-разработчик',
        period: '2020 — 2022',
        detail: 'Гос-сервисы на Node.js, нагрузка до 40 тыс. запросов в минуту.',
      },
      {
        company: 'Startup Garage',
        role: 'Junior-разработчик',
        period: '2019 — 2020',
        detail: 'Первые коммерческие проекты, вёрстка и интеграции платежей.',
      },
    ],
    education: [
      { place: 'ТУИТ им. Мухаммада аль-Хоразмий', degree: 'Информационные системы, бакалавр', year: '2019' },
      { place: 'Meta Front-End Professional', degree: 'Сертификат', year: '2021' },
    ],
    portfolio: [
      {
        title: 'Anor Market — маркетплейс продуктов',
        kind: 'video',
        url: CLIP.b,
        description: 'Каталог 4 000 SKU, оплата Payme, доставка по Ташкенту. 3 недели.',
      },
      {
        title: 'Osh Bozor — доставка еды',
        kind: 'case',
        description: 'Заказы в реальном времени, курьерское приложение, интеграция с 1С.',
      },
      {
        title: 'Zamin Textile — B2B-портал',
        kind: 'case',
        description: 'Личный кабинет оптовика, прайсы под клиента, экспорт в Excel.',
      },
    ],
    reviews: [
      { author: 'Дилшод Р.', rating: 5, text: 'Сдал раньше срока, оплату Payme настроил сам. Возьму снова.', date: '2026-06-14' },
      { author: 'Мадина А.', rating: 5, text: 'Каждую неделю показывал прогресс. Ни одного срыва.', date: '2026-04-02' },
      { author: 'Sardor Group', rating: 4, text: 'Отличный результат, но пару правок по дизайну пришлось ждать.', date: '2026-01-19' },
    ],
  },

  'dev-diyora': {
    about:
      'Фронтенд, который не тормозит на дешёвом телефоне. Собираю интерфейсы на React и Next.js, вылизываю мобильную версию и Lighthouse. Люблю, когда макет из Figma совпадает с браузером пиксель в пиксель.',
    videoIntro: { url: CLIP.c, title: 'Видео-визитка: мой подход к интерфейсам' },
    responseHours: 1,
    successRate: 98,
    repeatClients: 9,
    languages: ['Узбекский — родной', 'Русский — свободно', 'Английский — C1'],
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind', 'Framer Motion', 'Доступность'],
    experience: [
      {
        company: 'Фриланс',
        role: 'Frontend-разработчик',
        period: '2023 — сейчас',
        detail: '18 проектов, средний Lighthouse Performance — 94.',
      },
      {
        company: 'Click Uzbekistan',
        role: 'Frontend-разработчик',
        period: '2021 — 2023',
        detail: 'Личный кабинет мерчанта, дизайн-система на 60+ компонентов.',
      },
    ],
    education: [
      { place: 'Inha University in Tashkent', degree: 'Computer Science, бакалавр', year: '2021' },
    ],
    portfolio: [
      {
        title: 'Кабинет мерчанта Click',
        kind: 'video',
        url: CLIP.d,
        description: 'Дашборд по платежам, графики, экспорт. 120 тыс. пользователей.',
      },
      {
        title: 'Korzinka Online — редизайн каталога',
        kind: 'case',
        description: 'Скорость первой отрисовки упала с 4,1 с до 1,3 с.',
      },
    ],
    reviews: [
      { author: 'Отабек К.', rating: 5, text: 'Мобильная версия идеальна. Правки делает в тот же день.', date: '2026-07-01' },
      { author: 'Nodira S.', rating: 5, text: 'Взяла сложный макет и сдала без единого расхождения.', date: '2026-03-11' },
    ],
  },

  'dev-sanjar': {
    about:
      'Бэкенд и интеграции. Специализация — платёжные шлюзы Узбекистана и обмен с 1С. Пишу так, чтобы через год другой разработчик открыл код и всё понял: тесты, миграции, документация к API.',
    videoIntro: { url: CLIP.e, title: 'Видео-визитка: архитектура и интеграции' },
    responseHours: 3,
    successRate: 96,
    repeatClients: 11,
    languages: ['Узбекский — родной', 'Русский — свободно', 'Английский — B2'],
    skills: ['NestJS', 'PostgreSQL', 'Prisma', 'Click API', '1С обмен', 'Redis', 'CI/CD'],
    experience: [
      {
        company: 'Фриланс',
        role: 'Backend-разработчик',
        period: '2021 — сейчас',
        detail: '31 проект, из них 12 — с платежами Payme/Click/Uzum.',
      },
      {
        company: 'Artel Electronics',
        role: 'Backend-разработчик',
        period: '2019 — 2021',
        detail: 'Складской учёт и обмен с 1С для 40 сервисных центров.',
      },
    ],
    education: [
      { place: 'СамГУ', degree: 'Прикладная математика, бакалавр', year: '2019' },
    ],
    portfolio: [
      {
        title: 'Платёжный шлюз для сети аптек',
        kind: 'video',
        url: CLIP.a,
        description: 'Click + Payme + рассрочка, 9 тыс. транзакций в день.',
      },
      {
        title: 'Обмен с 1С для оптовика',
        kind: 'case',
        description: 'Остатки и цены синхронизируются каждые 10 минут без ручного экспорта.',
      },
    ],
    reviews: [
      { author: 'Farrux T.', rating: 5, text: 'Интеграцию Click сделал за два дня. Документацию оставил подробную.', date: '2026-05-22' },
      { author: 'Аптека Shifo', rating: 5, text: 'Ни одного упавшего платежа за полгода.', date: '2026-02-08' },
    ],
  },

  'dev-malika': {
    about:
      'Дизайн, который продаёт. Начинаю с того, как человек ищет товар, и только потом рисую экраны. Отдаю Figma с готовой дизайн-системой — разработчику не приходится догадываться про отступы и состояния.',
    videoIntro: { url: CLIP.b, title: 'Видео-визитка: от исследования до макета' },
    responseHours: 2,
    successRate: 99,
    repeatClients: 21,
    languages: ['Узбекский — родной', 'Русский — свободно', 'Английский — B1'],
    skills: ['Figma', 'Дизайн-системы', 'Прототипы', 'Мобильный UI', 'UX-исследования'],
    experience: [
      {
        company: 'Фриланс',
        role: 'UI/UX-дизайнер',
        period: '2020 — сейчас',
        detail: '44 проекта: маркетплейсы, банки, доставка.',
      },
      {
        company: 'Uzum Market',
        role: 'Product Designer',
        period: '2022 — 2024',
        detail: 'Экран оформления заказа: конверсия выросла на 12%.',
      },
    ],
    education: [
      { place: 'НУУз', degree: 'Дизайн, бакалавр', year: '2020' },
      { place: 'Google UX Design Certificate', degree: 'Сертификат', year: '2022' },
    ],
    portfolio: [
      {
        title: 'Оформление заказа Uzum Market',
        kind: 'video',
        url: CLIP.c,
        description: 'Три шага вместо семи, конверсия +12%.',
      },
      {
        title: 'Мобильный банк Hamkor',
        kind: 'case',
        description: 'Дизайн-система на 140 компонентов, тёмная тема.',
      },
    ],
    reviews: [
      { author: 'Jasur E.', rating: 5, text: 'Макеты идеальны — верстал без единого вопроса.', date: '2026-06-30' },
      { author: 'Lola M.', rating: 5, text: 'Показала три варианта и объяснила, почему второй лучше. Так и вышло.', date: '2026-04-17' },
    ],
  },

  'dev-jasur': {
    about:
      'Быстро поднимаю магазины на Laravel + Vue. Если нужен работающий сайт с оплатой через три недели, а не «идеальная архитектура через полгода» — это ко мне.',
    videoIntro: { url: CLIP.d, title: 'Видео-визитка: запуск за три недели' },
    responseHours: 4,
    successRate: 93,
    repeatClients: 6,
    languages: ['Узбекский — родной', 'Русский — свободно'],
    skills: ['Laravel', 'Vue', 'MySQL', 'Uzum Checkout', 'Telegram Bot API'],
    experience: [
      {
        company: 'Фриланс',
        role: 'Fullstack-разработчик',
        period: '2022 — сейчас',
        detail: '19 проектов, средний срок запуска — 24 дня.',
      },
      {
        company: 'IT Park Namangan',
        role: 'Web-разработчик',
        period: '2021 — 2022',
        detail: 'Сайты и боты для местного бизнеса.',
      },
    ],
    education: [{ place: 'НамГУ', degree: 'Информатика, бакалавр', year: '2021' }],
    portfolio: [
      {
        title: 'Магазин мебели Namangan Mebel',
        kind: 'video',
        url: CLIP.e,
        description: 'Каталог, калькулятор размеров, заявка в Telegram.',
      },
    ],
    reviews: [
      { author: 'Shuhrat B.', rating: 5, text: 'Сдал за 21 день, как и обещал.', date: '2026-05-05' },
      { author: 'Gulnora X.', rating: 4, text: 'Всё работает, дизайн простоват — но я на нём и не настаивала.', date: '2026-02-27' },
    ],
  },

  'dev-nilufar': {
    about:
      'Нахожу то, что ломается у реальных людей, а не в идеальном сценарии. Проверяю оплату, доставку и возвраты на живых устройствах и оставляю заказчику понятный отчёт со скриншотами.',
    videoIntro: { url: CLIP.a, title: 'Видео-визитка: как я тестирую оплату' },
    responseHours: 1,
    successRate: 99,
    repeatClients: 17,
    languages: ['Узбекский — родной', 'Русский — свободно', 'Английский — B2'],
    skills: ['Playwright', 'Postman', 'Тест-кейсы', 'Регресс', 'Мобильное тестирование'],
    experience: [
      {
        company: 'Фриланс',
        role: 'QA-инженер',
        period: '2021 — сейчас',
        detail: '52 проекта, в среднем 60 найденных дефектов на релиз.',
      },
      {
        company: 'EPAM Uzbekistan',
        role: 'QA Engineer',
        period: '2019 — 2021',
        detail: 'Автотесты на Playwright для финтех-продукта.',
      },
    ],
    education: [{ place: 'ТУИТ', degree: 'Программная инженерия, бакалавр', year: '2019' }],
    portfolio: [
      {
        title: 'Регресс перед релизом маркетплейса',
        kind: 'video',
        url: CLIP.b,
        description: '180 автотестов, прогон за 9 минут вместо двух дней вручную.',
      },
    ],
    reviews: [
      { author: 'Aziz T.', rating: 5, text: 'Поймала баг с оплатой, который мы не видели месяц.', date: '2026-07-09' },
      { author: 'Sanjar K.', rating: 5, text: 'Отчёты понятные, без «не работает».', date: '2026-03-30' },
    ],
  },

  'dev-otabek': {
    about:
      'Ставлю сервер так, чтобы про него можно было забыть. Домен .uz, SSL, автодеплой, бэкапы и мониторинг с уведомлением в Telegram, если что-то упало.',
    videoIntro: { url: CLIP.c, title: 'Видео-визитка: инфраструктура без сюрпризов' },
    responseHours: 2,
    successRate: 98,
    repeatClients: 12,
    languages: ['Узбекский — родной', 'Русский — свободно', 'Английский — B2'],
    skills: ['Docker', 'GitHub Actions', 'Nginx', 'Мониторинг', 'Бэкапы', 'Linux'],
    experience: [
      {
        company: 'Фриланс',
        role: 'DevOps-инженер',
        period: '2022 — сейчас',
        detail: '23 проекта, аптайм по всем — выше 99,9%.',
      },
      {
        company: 'Uzcard Processing',
        role: 'Системный инженер',
        period: '2018 — 2022',
        detail: 'Процессинг платежей, отказоустойчивый кластер.',
      },
    ],
    education: [{ place: 'ТУИТ', degree: 'Компьютерные сети, магистр', year: '2018' }],
    portfolio: [
      {
        title: 'Перенос маркетплейса на кластер',
        kind: 'video',
        url: CLIP.d,
        description: 'Ноль простоя при переезде, деплой сократился с 40 до 4 минут.',
      },
    ],
    reviews: [
      { author: 'Sardor N.', rating: 5, text: 'Настроил всё за вечер и объяснил, как это поддерживать.', date: '2026-06-02' },
    ],
  },

  'dev-shohruh': {
    about:
      'Мобильные приложения на Flutter: одна кодовая база — и Android, и iOS. Делаю приложения-компаньоны к сайтам: каталог, заказ, push-уведомления.',
    videoIntro: { url: CLIP.e, title: 'Видео-визитка: мобильное приложение за месяц' },
    responseHours: 5,
    successRate: 91,
    repeatClients: 4,
    languages: ['Узбекский — родной', 'Русский — свободно'],
    skills: ['Flutter', 'Dart', 'Firebase', 'REST', 'Push-уведомления'],
    experience: [
      {
        company: 'Фриланс',
        role: 'Mobile-разработчик',
        period: '2023 — сейчас',
        detail: '15 приложений в Google Play и App Store.',
      },
    ],
    education: [{ place: 'БухГУ', degree: 'Информационные технологии, бакалавр', year: '2022' }],
    portfolio: [
      {
        title: 'Приложение доставки Bukhara Food',
        kind: 'video',
        url: CLIP.a,
        description: 'Заказ в два тапа, карта курьера, 20 тыс. установок.',
      },
    ],
    reviews: [
      { author: 'Kamron A.', rating: 5, text: 'Приложение опубликовал сам, я только скриншоты прислал.', date: '2026-04-25' },
      { author: 'Diyor R.', rating: 4, text: 'Хороший результат, пару правок делал дольше обещанного.', date: '2026-01-30' },
    ],
  },

  'dev-kamola': {
    about:
      'Vue и Nuxt, доступные интерфейсы. Проверяю каждый экран с клавиатуры и скринридером — сайт должен работать у всех, включая людей со слабым зрением.',
    videoIntro: { url: CLIP.b, title: 'Видео-визитка: доступность на практике' },
    responseHours: 2,
    successRate: 95,
    repeatClients: 8,
    languages: ['Узбекский — родной', 'Русский — свободно', 'Английский — B2'],
    skills: ['Vue 3', 'Nuxt', 'SCSS', 'WCAG', 'Pinia'],
    experience: [
      {
        company: 'Фриланс',
        role: 'Frontend-разработчик',
        period: '2022 — сейчас',
        detail: '28 проектов, все проходят проверку WCAG AA.',
      },
      {
        company: 'Beeline Uzbekistan',
        role: 'Frontend-разработчик',
        period: '2020 — 2022',
        detail: 'Личный кабинет абонента, 1,2 млн пользователей.',
      },
    ],
    education: [{ place: 'ТУИТ', degree: 'Программная инженерия, бакалавр', year: '2020' }],
    portfolio: [
      {
        title: 'Личный кабинет абонента',
        kind: 'video',
        url: CLIP.c,
        description: 'Полная навигация с клавиатуры, тёмная тема, офлайн-режим.',
      },
    ],
    reviews: [
      { author: 'Ravshan I.', rating: 5, text: 'Единственная, кто спросил про доступность до начала работы.', date: '2026-05-14' },
    ],
  },

  'dev-bekzod': {
    about:
      'Python и Django для проектов, где много данных и отчётов. Настраиваю рассылки Eskiz SMS, фоновые задачи и выгрузки, которые бухгалтерия открывает без вопросов.',
    videoIntro: { url: CLIP.d, title: 'Видео-визитка: данные, отчёты, автоматизация' },
    responseHours: 3,
    successRate: 96,
    repeatClients: 7,
    languages: ['Узбекский — родной', 'Русский — свободно', 'Английский — B1'],
    skills: ['Python', 'Django', 'DRF', 'Celery', 'Eskiz SMS', 'PostgreSQL'],
    experience: [
      {
        company: 'Фриланс',
        role: 'Backend-разработчик',
        period: '2022 — сейчас',
        detail: '22 проекта: CRM, складской учёт, отчётность.',
      },
      {
        company: 'Agrobank',
        role: 'Python-разработчик',
        period: '2020 — 2022',
        detail: 'Внутренняя отчётность, интеграции с ЦБ.',
      },
    ],
    education: [{ place: 'ФерГУ', degree: 'Прикладная математика, бакалавр', year: '2020' }],
    portfolio: [
      {
        title: 'CRM для сети магазинов',
        kind: 'video',
        url: CLIP.e,
        description: 'Отчёты по 60 точкам, SMS-рассылки, выгрузка в Excel.',
      },
    ],
    reviews: [
      { author: 'Umid Q.', rating: 5, text: 'Отчёты собираются сами, бухгалтер счастлив.', date: '2026-06-21' },
    ],
  },
};

/** Профиль по id — с безопасным пустым значением, если данных ещё нет. */
export function profileFor(devId) {
  return (
    DEVELOPER_PROFILES[devId] ?? {
      about: 'Исполнитель пока не заполнил профиль.',
      videoIntro: null,
      responseHours: null,
      successRate: null,
      repeatClients: null,
      languages: [],
      skills: [],
      experience: [],
      education: [],
      portfolio: [],
      reviews: [],
    }
  );
}

export default DEVELOPER_PROFILES;
