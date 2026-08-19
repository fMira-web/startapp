/**
 * Дымовой прогон биржи: поднимает API в памяти и проходит основные
 * сценарии — роли, права, статусы, модерация, админка.
 *
 *   node _smoke.mjs
 */
process.env.NODE_ENV = 'development';
process.env.PORT = '4310';
process.env.JWT_SECRET = 'smoke-secret-smoke-secret-smoke-secret';
process.env.OWNER_EMAIL = 'mmirazizf930@gmail.com';
// dotenv не перезаписывает уже существующие ключи, поэтому пустые строки
// надёжнее, чем delete: иначе .env вернёт боевую базу и живой SMTP.
process.env.DATABASE_URL = '';
process.env.RESEND_API_KEY = '';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.MAIL_FROM = '';
// Провайдера в тесте нет, поэтому коды печатаются в консоль сервера и
// складываются в lastDevCodes. По HTTP они не отдаются — это отдельно
// проверяется ниже.
process.env.ALLOW_DEV_EMAIL_CODES = '1';

const BASE = `http://127.0.0.1:${process.env.PORT}`;

await import('./server.js');
const { lastDevCodes } = await import('./mailer.js');
await new Promise((resolve) => setTimeout(resolve, 1200));

let passed = 0;
let failed = 0;
const fail = [];

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    fail.push(name);
    console.log(`  FAIL ${name} ${extra}`);
  }
}

/** Простейшая банка кук: по одной на «браузер». */
function makeClient() {
  const jar = new Map();
  return async function call(path, { method = 'GET', body } = {}) {
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { status: response.status, body: payload ?? {} };
  };
}

async function signUp(call, input) {
  const registered = await call('/api/auth/register', { method: 'POST', body: input });
  // Код берётся ровно оттуда, откуда его взял бы человек: из доставки.
  // В ответе API его нет и быть не должно.
  const code = lastDevCodes.get(input.email.toLowerCase());
  if (!code) throw new Error(`нет кода подтверждения для ${input.email}: ${JSON.stringify(registered.body)}`);
  const verified = await call('/api/auth/verify-email', {
    method: 'POST',
    body: { email: input.email, code },
  });
  return { registered, verified, user: verified.body.user, code };
}

console.log('\n— инфраструктура —');
const anon = makeClient();
check('GET /health', (await anon('/health')).status === 200);
const meta = await anon('/api/market/meta');
check('GET /api/market/meta', meta.status === 200 && meta.body.spheres.length >= 5);
check('в справочнике есть уровни', meta.body.levels.some((l) => l.id === 'senior'));

console.log('\n— динамические предложения —');
const offers1 = await anon('/api/market/offers');
check('GET /api/market/offers', offers1.status === 200 && offers1.body.offers.length > 0);
check('окно ротации задано', Number.isFinite(offers1.body.cycle) && Boolean(offers1.body.endsAt));
check('ротация 2–3 дня', [2, 3].includes(offers1.body.rotationDays));
const offers2 = await anon('/api/market/offers');
check(
  'подборка стабильна внутри окна',
  JSON.stringify(offers1.body.offers.map((o) => o.slug)) ===
    JSON.stringify(offers2.body.offers.map((o) => o.slug))
);
check('история доступна', (await anon('/api/market/offers/history')).status === 200);

console.log('\n— регистрация и роли —');
const ownerClient = makeClient();
const owner = await signUp(ownerClient, {
  email: 'mmirazizf930@gmail.com',
  password: 'super-long-passphrase-2026',
  fullName: 'Владелец площадки',
  role: 'client',
});
check('владелец зарегистрирован', owner.verified.status === 200);
check('владелец — суперадмин', owner.user?.isAdmin === true && owner.user?.isOwner === true);
check('роль владельца — заказчик', owner.user?.role === 'client');

check(
  'код не возвращается в ответе регистрации',
  owner.registered.body.devCode === undefined && owner.registered.body.deliveryNote === undefined,
  JSON.stringify(owner.registered.body)
);
check(
  'код не возвращается при повторной отправке',
  (await ownerClient('/api/auth/resend-code', { method: 'POST', body: { email: 'mmirazizf930@gmail.com' } }))
    .body.devCode === undefined
);
check(
  'в ответе нет ни одного поля с кодом',
  !JSON.stringify(owner.registered.body).includes(owner.code)
);

const devClient = makeClient();
const dev = await signUp(devClient, {
  email: 'dev@toshkent.uz',
  password: 'another-long-passphrase-2026',
  fullName: 'Азиз Тураев',
  role: 'developer',
  devProfile: { sphere: 'fullstack', level: 'senior', stack: 'React, Node.js, PostgreSQL', city: 'Ташкент', rateHour: 140000 },
});
check('программист зарегистрирован', dev.verified.status === 200);
check('роль программиста зафиксирована', dev.user?.role === 'developer');
check('программист не админ', dev.user?.isAdmin === false);

const badDev = makeClient();
const noSphere = await badDev('/api/auth/register', {
  method: 'POST',
  body: { email: 'nosphere@toshkent.uz', password: 'yet-another-long-pass-2026', role: 'developer' },
});
check('программист без сферы отклонён', noSphere.status === 400 && noSphere.body.code === 'bad_sphere');

const noRole = await badDev('/api/auth/register', {
  method: 'POST',
  body: { email: 'norole@toshkent.uz', password: 'yet-another-long-pass-2026' },
});
check('регистрация без роли отклонена', noRole.status === 400 && noRole.body.code === 'bad_role');

const otherClient = makeClient();
const other = await signUp(otherClient, {
  email: 'client2@toshkent.uz',
  password: 'third-long-passphrase-2026',
  fullName: 'Диёра Юсупова',
  role: 'client',
});
check('второй заказчик зарегистрирован', other.verified.status === 200);

const roleSwap = await devClient('/api/auth/role', { method: 'POST', body: { role: 'client' } });
check('смена роли запрещена', roleSwap.status === 403 && roleSwap.body.code === 'role_locked');

console.log('\n— профиль программиста —');
const devMe = await devClient('/api/market/me');
check('кабинет программиста', devMe.status === 200 && devMe.body.profile.sphere === 'fullstack');
check('уровень сохранён', devMe.body.profile.level === 'senior');
check('стек сохранён', String(devMe.body.profile.stack).includes('React'));
const devPatch = await devClient('/api/market/me/profile', {
  method: 'PATCH',
  body: { headline: 'Fullstack · React + Node', bio: 'Собираю продукты под ключ.', portfolio: [{ title: 'Кейс', url: 'https://example.uz' }] },
});
check('профиль обновляется', devPatch.status === 200 && devPatch.body.user.headline?.includes('Fullstack'));
const roleViaProfile = await devClient('/api/market/me/profile', { method: 'PATCH', body: { role: 'client' } });
check('роль через профиль не меняется', roleViaProfile.status === 403);

console.log('\n— проекты —');
const created = await ownerClient('/api/market/projects', {
  method: 'POST',
  body: {
    title: 'Интернет-магазин с оплатой Payme',
    description: 'Нужен интернет-магазин на 300 товаров с интеграцией Payme и Click, админкой и выгрузкой в 1С.',
    category: 'fullstack',
    tags: ['react', 'payme', 'postgresql'],
    budgetMin: 20000000,
    budgetMax: 45000000,
    deadlineDays: 45,
    level: 'senior',
  },
});
check('заказчик публикует проект', created.status === 201);
const projectId = created.body.project?.id;
check('теги нормализованы', JSON.stringify(created.body.project?.tags) === JSON.stringify(['react', 'payme', 'postgresql']));

const devCreate = await devClient('/api/market/projects', {
  method: 'POST',
  body: { title: 'Проект от программиста', description: 'Это описание длиннее двадцати символов.', budgetMax: 1000000 },
});
check('программист не может публиковать проекты', devCreate.status === 403 && devCreate.body.code === 'wrong_role');

const shortTitle = await ownerClient('/api/market/projects', {
  method: 'POST',
  body: { title: 'Мало', description: 'Это описание длиннее двадцати символов точно.', budgetMax: 100 },
});
check('короткое название отклонено', shortTitle.status === 400 && shortTitle.body.code === 'bad_title');

console.log('\n— поиск и фильтры —');
check('поиск по слову', (await anon('/api/market/projects?search=payme')).body.total === 1);
check('поиск мимо', (await anon('/api/market/projects?search=блокчейн')).body.total === 0);
check('фильтр по категории', (await anon('/api/market/projects?category=fullstack')).body.total === 1);
check('фильтр по чужой категории', (await anon('/api/market/projects?category=devops')).body.total === 0);
check('фильтр по тегу', (await anon('/api/market/projects?tags=payme')).body.total === 1);
check('фильтр по двум тегам', (await anon('/api/market/projects?tags=payme,react')).body.total === 1);
check('фильтр по несуществующему тегу', (await anon('/api/market/projects?tags=cobol')).body.total === 0);
check('бюджет: попадание', (await anon('/api/market/projects?budgetMin=30000000')).body.total === 1);
check('бюджет: мимо', (await anon('/api/market/projects?budgetMin=90000000')).body.total === 0);
check('бюджет: верхняя граница', (await anon('/api/market/projects?budgetMax=10000000')).body.total === 0);
check('фильтр по статусу', (await anon('/api/market/projects?status=open')).body.total === 1);
check('облако тегов', (await anon('/api/market/tags')).body.tags.length >= 3);

console.log('\n— права на проект —');
const foreignPatch = await otherClient(`/api/market/projects/${projectId}`, {
  method: 'PATCH',
  body: { title: 'Пробую переписать чужой проект' },
});
check('чужой заказчик не редактирует', foreignPatch.status === 403);
const devPatchProject = await devClient(`/api/market/projects/${projectId}`, {
  method: 'PATCH',
  body: { title: 'Программист правит проект' },
});
check('программист не редактирует', devPatchProject.status === 403);
const foreignDelete = await otherClient(`/api/market/projects/${projectId}`, { method: 'DELETE' });
check('чужой заказчик не удаляет', foreignDelete.status === 403);
const ownPatch = await ownerClient(`/api/market/projects/${projectId}`, {
  method: 'PATCH',
  body: { title: 'Интернет-магазин с оплатой Payme и Click', budgetMax: 50000000 },
});
check('автор редактирует свой проект', ownPatch.status === 200 && ownPatch.body.project.budgetMax === 50000000);

console.log('\n— отклики —');
const bid = await devClient(`/api/market/projects/${projectId}/bids`, {
  method: 'POST',
  body: { amount: 38000000, days: 40, message: 'Возьму целиком, Payme подключал шесть раз.' },
});
check('программист откликается', bid.status === 201);
const bidId = bid.body.bid?.id;
const clientBid = await otherClient(`/api/market/projects/${projectId}/bids`, {
  method: 'POST',
  body: { amount: 1000, days: 1 },
});
check('заказчик не может откликаться', clientBid.status === 403 && clientBid.body.code === 'wrong_role');

const asOwner = await ownerClient(`/api/market/projects/${projectId}`);
check('автор видит отклики', asOwner.body.bids.length === 1);
const asStranger = await anon(`/api/market/projects/${projectId}`);
check('гость откликов не видит', asStranger.body.bids.length === 0 && asStranger.body.bidsHidden === 1);
const asOtherClient = await otherClient(`/api/market/projects/${projectId}`);
check('чужой заказчик откликов не видит', asOtherClient.body.bids.length === 0);
const asDev = await devClient(`/api/market/projects/${projectId}`);
check('автор отклика видит свой отклик', asDev.body.bids.length === 1);

console.log('\n— статусы заказа —');
const wrongAccept = await otherClient(`/api/market/projects/${projectId}/bids/${bidId}/accept`, { method: 'POST' });
check('чужой не выбирает исполнителя', wrongAccept.status === 403);
const accepted = await ownerClient(`/api/market/projects/${projectId}/bids/${bidId}/accept`, { method: 'POST' });
check('заказчик принимает отклик', accepted.status === 200 && accepted.body.project.status === 'in_progress');
check('исполнитель назначен', accepted.body.project.assigneeId === dev.user.id);
check('комиссия посчитана', accepted.body.payout.platformFee === Math.round(38000000 * 0.08));

const lateBid = await devClient(`/api/market/projects/${projectId}/bids`, { method: 'POST', body: { amount: 1, days: 1 } });
check('на занятый проект не откликнуться', lateBid.status === 400 && lateBid.body.code === 'project_closed');

const badTransition = await ownerClient(`/api/market/projects/${projectId}/status`, { method: 'POST', body: { status: 'nonsense' } });
check('неизвестный статус отклонён', badTransition.status === 400);

console.log('\n— переписка —');
const devMessage = await devClient(`/api/market/projects/${projectId}/messages`, {
  method: 'POST',
  body: { body: 'Начинаю с каталога, к пятнице покажу первый экран.' },
});
check('исполнитель пишет в проект', devMessage.status === 201);
const outsiderMessage = await otherClient(`/api/market/projects/${projectId}/messages`, {
  method: 'POST',
  body: { body: 'А можно я тоже?' },
});
check('посторонний в переписку не пишет', outsiderMessage.status === 403);
const thread = await ownerClient(`/api/market/projects/${projectId}/messages`);
check('заказчик читает переписку', thread.status === 200 && thread.body.messages.length === 1);

console.log('\n— завершение и отзывы —');
const earlyReview = await ownerClient(`/api/market/projects/${projectId}/reviews`, { method: 'POST', body: { rating: 5 } });
check('отзыв до завершения отклонён', earlyReview.status === 400 && earlyReview.body.code === 'not_completed');

const completed = await ownerClient(`/api/market/projects/${projectId}/status`, { method: 'POST', body: { status: 'completed' } });
check('проект завершён', completed.status === 200 && completed.body.project.status === 'completed');

const review = await ownerClient(`/api/market/projects/${projectId}/reviews`, {
  method: 'POST',
  body: { rating: 5, comment: 'Сдал раньше срока, на связи каждый день.' },
});
check('заказчик оставил отзыв', review.status === 200 || review.status === 201);
check('рейтинг пересчитан', review.body.rating === 5 && review.body.reviewsCount === 1);

const devReview = await devClient(`/api/market/projects/${projectId}/reviews`, { method: 'POST', body: { rating: 4 } });
check('исполнитель оценил заказчика', devReview.status === 201 || devReview.status === 200);

const devProfilePage = await anon(`/api/market/users/${dev.user.id}`);
check('публичный профиль исполнителя', devProfilePage.status === 200 && devProfilePage.body.user.rating === 5);
check('в профиле есть портфолио', devProfilePage.body.profile.portfolio.length === 1);
check('в профиле есть отзывы', devProfilePage.body.reviews.length === 1);
check('счётчик завершённых работ', devProfilePage.body.user.projectsDone === 1);

const catalogue = await anon('/api/market/developers?sphere=fullstack');
check('каталог исполнителей', catalogue.status === 200 && catalogue.body.developers.length === 1);
check('фильтр каталога по уровню', (await anon('/api/market/developers?level=junior')).body.developers.length === 0);

console.log('\n— админ-панель —');
const notAdmin = await otherClient('/api/admin/overview');
check('обычный аккаунт в админку не входит', notAdmin.status === 403);
const overview = await ownerClient('/api/admin/overview');
check('суперадмин видит сводку', overview.status === 200 && overview.body.users.total === 3);
check('в сводке видны роли', overview.body.users.developers === 1 && overview.body.users.clients === 2);

const usersList = await ownerClient('/api/admin/users?search=dev@');
check('поиск по пользователям', usersList.status === 200 && usersList.body.users.length === 1);
check('в списке видна специализация', usersList.body.users[0].sphere === 'fullstack');

const grant = await ownerClient(`/api/admin/users/${dev.user.id}/admin`, { method: 'POST', body: { isAdmin: true } });
check('суперадмин выдал права', grant.status === 200 && grant.body.user.isAdmin === true);
const devAdminView = await devClient('/api/admin/overview');
check('новый админ видит панель', devAdminView.status === 200);
const devGrantsAdmin = await devClient(`/api/admin/users/${other.user.id}/admin`, { method: 'POST', body: { isAdmin: true } });
check('обычный админ права не раздаёт', devGrantsAdmin.status === 403 && devGrantsAdmin.body.code === 'owner_only');
const revoke = await ownerClient(`/api/admin/users/${dev.user.id}/admin`, { method: 'POST', body: { isAdmin: false } });
check('суперадмин забрал права', revoke.status === 200 && revoke.body.user.isAdmin === false);
check('разжалованный сразу теряет доступ', (await devClient('/api/admin/overview')).status === 403);

const selfBlock = await ownerClient(`/api/admin/users/${owner.user.id}/block`, { method: 'POST', body: { blocked: true } });
check('себя заблокировать нельзя', selfBlock.status === 400);

const blocked = await ownerClient(`/api/admin/users/${other.user.id}/block`, {
  method: 'POST',
  body: { blocked: true, reason: 'Спам в откликах' },
});
check('админ блокирует пользователя', blocked.status === 200 && blocked.body.user.isBlocked === true);
const blockedMe = await otherClient('/api/auth/me');
check('заблокированный получает 403', blockedMe.status === 403 && blockedMe.body.code === 'account_blocked');
const blockedLogin = await makeClient()('/api/auth/login', {
  method: 'POST',
  body: { email: 'client2@toshkent.uz', password: 'third-long-passphrase-2026' },
});
check('заблокированный не входит', blockedLogin.status === 403 && blockedLogin.body.code === 'account_blocked');
await ownerClient(`/api/admin/users/${other.user.id}/block`, { method: 'POST', body: { blocked: false } });
check('разблокировка работает', (await otherClient('/api/auth/me')).status === 200);

console.log('\n— модерация —');
const hidden = await ownerClient(`/api/admin/projects/${projectId}/moderation`, {
  method: 'POST',
  body: { moderation: 'hidden', note: 'Дубль объявления' },
});
check('проект скрыт модератором', hidden.status === 200 && hidden.body.project.moderation === 'hidden');
check('скрытый проект пропал из выдачи', (await anon('/api/market/projects')).body.total === 0);
check('скрытый проект недоступен гостю', (await anon(`/api/market/projects/${projectId}`)).status === 404);
check('автор всё ещё видит свой проект', (await ownerClient(`/api/market/projects/${projectId}`)).status === 200);
check('в админ-списке скрытые видны', (await ownerClient('/api/admin/projects')).body.total === 1);
await ownerClient(`/api/admin/projects/${projectId}/moderation`, { method: 'POST', body: { moderation: 'published' } });
check('проект возвращён в выдачу', (await anon('/api/market/projects')).body.total === 1);

console.log('\n— пул предложений —');
const adminOffers = await ownerClient('/api/admin/offers');
check('пул предложений виден', adminOffers.status === 200 && adminOffers.body.pool.length >= 8);
const newOffer = await ownerClient('/api/admin/offers', {
  method: 'POST',
  body: { title: 'Осенний набор Frontend', slug: 'autumn-frontend', body: 'Подборка задач по React.', weight: 5 },
});
check('новое предложение создано', newOffer.status === 201);
const offerId = newOffer.body.offer?.id;
const patched = await ownerClient(`/api/admin/offers/${offerId}`, { method: 'PATCH', body: { active: false } });
check('предложение выключается', patched.status === 200 && patched.body.offer.active === false);
check('предложение удаляется', (await ownerClient(`/api/admin/offers/${offerId}`, { method: 'DELETE' })).status === 200);
const log = await ownerClient('/api/admin/log');
check('журнал действий пишется', log.status === 200 && log.body.log.length >= 5);

const deleted = await ownerClient(`/api/market/projects/${projectId}`, { method: 'DELETE' });
check('автор удаляет свой проект', deleted.status === 200);
check('после удаления доска пуста', (await anon('/api/market/projects')).body.total === 0);

console.log(`\n————— пройдено: ${passed}, провалено: ${failed} —————`);
if (failed) console.log('провалы:\n  - ' + fail.join('\n  - '));
process.exit(failed ? 1 : 0);
