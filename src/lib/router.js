/**
 * Маленький хеш-роутер.
 *
 * Внешнего роутера в проекте нет, а ссылки на конкретный проект и профиль
 * нужны настоящие — иначе «поделись карточкой» превращается в «найди её
 * сам». Хеш выбран потому, что фронтенд раздаётся как статика и переписывать
 * правила на хостинге под history API не хочется.
 *
 *   #/                      главная
 *   #/projects              доска проектов
 *   #/projects/new          форма создания
 *   #/projects/:id          карточка проекта
 *   #/developers            каталог исполнителей
 *   #/users/:id             публичный профиль
 *   #/me                    личный кабинет
 *   #/admin                 админ-панель
 *   #/offers                история предложений
 *   #/login  #/register     вход и регистрация
 *   #/proposal              коммерческое предложение (прежний раздел)
 */

export const DEFAULT_ROUTE = { name: 'home', params: {}, query: {} };

export function parseHash(hash = window.location.hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);

  const query = {};
  for (const [key, value] of new URLSearchParams(queryPart ?? '')) query[key] = value;

  if (!segments.length) return { ...DEFAULT_ROUTE, query };

  const [head, second] = segments;

  switch (head) {
    case 'projects':
      if (!second) return { name: 'projects', params: {}, query };
      if (second === 'new') return { name: 'project-new', params: {}, query };
      return { name: 'project', params: { id: second }, query };
    case 'developers':
      return { name: 'developers', params: {}, query };
    case 'users':
      return second ? { name: 'profile', params: { id: second }, query } : { name: 'developers', params: {}, query };
    case 'me':
      return { name: 'cabinet', params: {}, query };
    case 'admin':
      return { name: 'admin', params: {}, query };
    case 'offers':
      return { name: 'offers', params: {}, query };
    case 'login':
      return { name: 'login', params: {}, query };
    case 'register':
      return { name: 'register', params: {}, query };
    case 'proposal':
      return { name: 'proposal', params: {}, query };
    default:
      return { ...DEFAULT_ROUTE, query };
  }
}

export function toHref(path) {
  return path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
}

export function navigate(path) {
  const next = toHref(path);
  if (window.location.hash === next) {
    // Один и тот же хеш не рождает событие — сообщаем подписчикам вручную.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = next;
}

export function subscribe(listener) {
  const handler = () => listener(parseHash());
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
