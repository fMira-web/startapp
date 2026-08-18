/**
 * Справочник «Центра проектов».
 *
 * Ставки исполнителей — реальный уровень узбекского рынка 2026:
 * медианная зарплата разработчика ~10,1 млн сум в месяц, средняя по IT
 * 17,41 млн сум. При ~168 рабочих часах это 60–105 тыс сум/час; сильные
 * специалисты на фрилансе берут 130–200 тыс сум/час.
 */

/** Комиссия площадки со сделки. */
export const PLATFORM_FEE_RATE = 0.08;

/** Гарантийный резерв, который держится до приёмки работы. */
export const ESCROW_HOLD_RATE = 0.1;

export const ROLES = [
  {
    id: 'fullstack',
    name: 'Fullstack-разработчик',
    short: 'Fullstack',
    share: 0.34,
    description: 'Ведёт проект целиком: база, API, интерфейс, запуск.',
  },
  {
    id: 'frontend',
    name: 'Frontend-разработчик',
    short: 'Frontend',
    share: 0.2,
    description: 'Вёрстка, каталог, корзина, адаптив и скорость загрузки.',
  },
  {
    id: 'backend',
    name: 'Backend-разработчик',
    short: 'Backend',
    share: 0.22,
    description: 'Заказы, оплата, интеграции Payme/Click, админ-панель.',
  },
  {
    id: 'design',
    name: 'UI/UX-дизайнер',
    short: 'Дизайн',
    share: 0.12,
    description: 'Макеты в Figma, дизайн-система, мобильные экраны.',
  },
  {
    id: 'qa',
    name: 'QA-инженер',
    short: 'QA',
    share: 0.07,
    description: 'Тест-кейсы, проверка оплаты и доставки, регресс перед релизом.',
  },
  {
    id: 'devops',
    name: 'DevOps',
    short: 'DevOps',
    share: 0.05,
    description: 'Сервер, домен .uz, SSL, деплой и мониторинг.',
  },
];

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((role) => [role.id, role]));

/** Ставки в сумах за час. */
export const SEED_DEVELOPERS = [
  {
    id: 'dev-aziz',
    fullName: 'Азиз Тураев',
    role: 'fullstack',
    headline: 'Fullstack · React + Node.js',
    stack: 'React, Node.js, PostgreSQL, Payme API',
    city: 'Ташкент',
    rateHour: 140_000,
    rating: 4.9,
    projectsDone: 37,
    level: 'Senior',
    available: true,
  },
  {
    id: 'dev-diyora',
    fullName: 'Диёра Юсупова',
    role: 'frontend',
    headline: 'Frontend · React, Next.js',
    stack: 'React, Next.js, Tailwind, TypeScript',
    city: 'Ташкент',
    rateHour: 110_000,
    rating: 4.8,
    projectsDone: 26,
    level: 'Middle+',
    available: true,
  },
  {
    id: 'dev-sanjar',
    fullName: 'Санжар Каримов',
    role: 'backend',
    headline: 'Backend · NestJS, PostgreSQL',
    stack: 'Node.js, NestJS, PostgreSQL, Click API, 1С обмен',
    city: 'Самарканд',
    rateHour: 125_000,
    rating: 4.9,
    projectsDone: 31,
    level: 'Senior',
    available: true,
  },
  {
    id: 'dev-malika',
    fullName: 'Малика Абдуллаева',
    role: 'design',
    headline: 'UI/UX · Figma, дизайн-системы',
    stack: 'Figma, дизайн-система, прототипы, мобильный UI',
    city: 'Ташкент',
    rateHour: 95_000,
    rating: 5.0,
    projectsDone: 44,
    level: 'Senior',
    available: true,
  },
  {
    id: 'dev-jasur',
    fullName: 'Жасур Эргашев',
    role: 'fullstack',
    headline: 'Fullstack · Laravel + Vue',
    stack: 'Laravel, Vue, MySQL, Uzum Checkout',
    city: 'Наманган',
    rateHour: 100_000,
    rating: 4.7,
    projectsDone: 19,
    level: 'Middle',
    available: true,
  },
  {
    id: 'dev-nilufar',
    fullName: 'Нилуфар Хакимова',
    role: 'qa',
    headline: 'QA · ручное и автотесты',
    stack: 'Playwright, Postman, тест-кейсы, регресс',
    city: 'Ташкент',
    rateHour: 70_000,
    rating: 4.8,
    projectsDone: 52,
    level: 'Middle+',
    available: true,
  },
  {
    id: 'dev-otabek',
    fullName: 'Отабек Рустамов',
    role: 'devops',
    headline: 'DevOps · Docker, CI/CD',
    stack: 'Docker, GitHub Actions, Nginx, VPS в Ташкенте',
    city: 'Ташкент',
    rateHour: 155_000,
    rating: 4.9,
    projectsDone: 23,
    level: 'Senior',
    available: true,
  },
  {
    id: 'dev-shohruh',
    fullName: 'Шохрух Насриддинов',
    role: 'fullstack',
    headline: 'Fullstack · Flutter + Firebase',
    stack: 'Flutter, Dart, Firebase, REST',
    city: 'Бухара',
    rateHour: 120_000,
    rating: 4.6,
    projectsDone: 15,
    level: 'Middle',
    available: true,
  },
  {
    id: 'dev-kamola',
    fullName: 'Камола Исмоилова',
    role: 'frontend',
    headline: 'Frontend · Vue, Nuxt',
    stack: 'Vue 3, Nuxt, SCSS, доступность',
    city: 'Ташкент',
    rateHour: 85_000,
    rating: 4.7,
    projectsDone: 28,
    level: 'Middle',
    available: true,
  },
  {
    id: 'dev-bekzod',
    fullName: 'Бекзод Юлдашев',
    role: 'backend',
    headline: 'Backend · Python, Django',
    stack: 'Python, Django, DRF, Celery, Eskiz SMS',
    city: 'Фергана',
    rateHour: 105_000,
    rating: 4.8,
    projectsDone: 22,
    level: 'Middle+',
    available: true,
  },
];

export const PROJECT_STATUS = {
  open: { label: 'Открыт для откликов', tone: 'brand' },
  assigned: { label: 'Исполнитель назначен', tone: 'brand' },
  in_progress: { label: 'В работе', tone: 'brand' },
  submitted: { label: 'Сдан на проверку', tone: 'warn' },
  completed: { label: 'Завершён и оплачен', tone: 'signal' },
  archived: { label: 'В архиве', tone: 'warn' },
};

export const DEAL_STATUS = {
  escrow: { label: 'Деньги зарезервированы', tone: 'brand' },
  in_progress: { label: 'Исполнитель работает', tone: 'brand' },
  submitted: { label: 'Работа отправлена заказчику', tone: 'warn' },
  released: { label: 'Оплата переведена исполнителю', tone: 'signal' },
};

/**
 * Раскладка бюджета по ролям. Сначала снимается комиссия площадки,
 * остаток распределяется по долям ролей.
 */
export function splitBudget(budget) {
  const fee = Math.round(budget * PLATFORM_FEE_RATE);
  const pool = budget - fee;
  const roles = ROLES.map((role) => ({
    ...role,
    amount: Math.round(pool * role.share),
  }));
  const distributed = roles.reduce((sum, role) => sum + role.amount, 0);
  // Копейки округления добавляем самой крупной роли, чтобы сумма сходилась.
  if (roles.length && distributed !== pool) roles[0].amount += pool - distributed;
  return { fee, pool, roles };
}

/** Сколько примерно часов покрывает сумма по ставке исполнителя. */
export function hoursFor(amount, rateHour) {
  if (!rateHour) return 0;
  return Math.round(amount / rateHour);
}
