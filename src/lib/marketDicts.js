/**
 * Справочники биржи для экранов, которые работают до входа.
 *
 * Полный список приезжает с `/api/market/meta`, но форма регистрации должна
 * рисоваться мгновенно и без запроса, поэтому здесь лежит его копия.
 * Источник правды остаётся на сервере (`backend/market-db.js`): если значение
 * разъедется, регистрация вернёт понятную ошибку `bad_sphere` / `bad_level`,
 * а не тихо сохранит мусор.
 */

export const SPHERES = [
  { id: 'frontend', label: 'Frontend', hint: 'Интерфейсы, вёрстка, SPA' },
  { id: 'backend', label: 'Backend', hint: 'API, базы данных, интеграции' },
  { id: 'fullstack', label: 'Fullstack', hint: 'Обе стороны продукта' },
  { id: 'mobile', label: 'Mobile', hint: 'iOS, Android, Flutter' },
  { id: 'devops', label: 'DevOps', hint: 'CI/CD, инфраструктура, мониторинг' },
  { id: 'design', label: 'UI/UX дизайн', hint: 'Макеты, прототипы, дизайн-системы' },
  { id: 'qa', label: 'QA / тестирование', hint: 'Ручное и автотестирование' },
  { id: 'data', label: 'Data / ML', hint: 'Аналитика, модели, пайплайны' },
  { id: 'gamedev', label: 'Gamedev', hint: 'Unity, Unreal, мобильные игры' },
];

export const LEVELS = [
  { id: 'junior', label: 'Junior', hint: 'до 1,5 лет опыта' },
  { id: 'middle', label: 'Middle', hint: '1,5–4 года' },
  { id: 'senior', label: 'Senior', hint: '4+ года, ведёт задачи целиком' },
  { id: 'lead', label: 'Lead / Architect', hint: 'ведёт команду и архитектуру' },
];

/** Подсказка по стеку под каждую сферу — чтобы поле не пугало пустотой. */
export const STACK_PLACEHOLDER = {
  frontend: 'React, TypeScript, Tailwind',
  backend: 'Node.js, PostgreSQL, Redis',
  fullstack: 'React, Node.js, PostgreSQL',
  mobile: 'Flutter, Dart, Firebase',
  devops: 'Docker, GitHub Actions, Nginx',
  design: 'Figma, дизайн-система, прототипы',
  qa: 'Playwright, Postman, тест-кейсы',
  data: 'Python, pandas, scikit-learn',
  gamedev: 'Unity, C#, Blender',
};
