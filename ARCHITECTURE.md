# Биржа фриланса — архитектура

Документ описывает то, что уже лежит в проекте `proposal`: схему базы,
серверный API и ключевые компоненты интерфейса. Всё написано поверх
существующего стека — новых зависимостей не добавлено.

| Слой | Технологии |
|---|---|
| Фронтенд | React 19, Vite 6, Tailwind 4, Zustand 5, framer-motion, lucide-react |
| Бэкенд | Node 20+, Express 4, `pg` (сырой SQL), JWT в httpOnly-куке, scrypt |
| Хранилище | PostgreSQL; без `DATABASE_URL` — адаптер в памяти с тем же интерфейсом |
| Почта | Resend / SMTP / dev-режим (код печатается в консоль) |

---

## 1. Карта файлов

```
backend/
  db.js            учётные записи, коды подтверждения, роли и права        (дополнен)
  auth.js          регистрация, вход, роли, суперадмин, гарды доступа      (дополнен)
  market-db.js     схема и доступ к данным биржи                            ← новый
  market.js        REST биржи: проекты, отклики, статусы, чат, отзывы       ← новый
  offers.js        ротация предложений главной страницы и история           ← новый
  admin.js         админ-панель: пользователи, модерация, пул акций         ← новый
  server.js        сборка приложения и подъём схемы                        (дополнен)
  smoke.test.mjs   97 проверок API на живом сервере в памяти                ← новый
  hub.js, mailer.js                                                        (без изменений)

src/
  lib/router.js        хеш-роутер                                           ← новый
  lib/marketApi.js     клиент API биржи                                     ← новый
  lib/marketDicts.js   справочники для экранов до входа                     ← новый
  store/useMarketStore.js, store/useAdminStore.js                           ← новые
  store/useAuthStore.js  роль приходит с сервера, переключателя больше нет  (переписан)
  components/Market/*  главная, доска, карточка проекта, профили, кабинет   ← новые
  components/Admin/AdminPage.jsx                                            ← новый
  components/Auth/AuthScreen.jsx  доп. шаг регистрации программиста        (дополнен)
  App.jsx              маршрутизация биржи + прежний раздел на #/proposal  (дополнен)

check-frontend.mjs   разбор всех файлов src/ и сверка импортов с экспортами  ← новый
```

---

## 2. Схема базы данных

Идентификаторы генерируются в Node (`crypto.randomUUID`), поэтому расширения
`pgcrypto` / `uuid-ossp` не нужны. Схема применяется идемпотентно при старте:
`create table if not exists` + `alter table ... add column if not exists`.

### 2.1 Связи

```
users ─┬─< market_dev_profiles      (1:1, только для role='developer')
       ├─< market_client_profiles   (1:1, только для role='client')
       ├─< market_projects          (owner_id — автор)
       ├─< market_projects          (assignee_id — выбранный исполнитель)
       ├─< market_bids              (dev_id)
       ├─< market_messages          (author_id)
       └─< market_reviews           (author_id, target_id)

market_projects ─┬─< market_bids
                 ├─< market_messages
                 ├─< market_reviews
                 └─< market_events

market_offers ─< market_offer_runs   (какая акция в каком окне ротации висела)
market_admin_log                     (журнал действий администраторов)
```

### 2.2 `users` — аккаунт и роль

Таблица существовала; ролевая система добавлена отдельными колонками, чтобы
миграция прошла и на уже живой базе.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | text PK | UUID |
| `email` | text unique | логин |
| `password_hash` | text | scrypt: `scrypt$N$r$p$salt$hash` |
| `full_name`, `phone`, `avatar_url` | text | контактные данные |
| `email_verified` | boolean | подтверждена ли почта шестизначным кодом |
| **`role`** | text, default `'client'` | `client` \| `developer` — **назначается один раз** |
| **`is_admin`** | boolean, default `false` | права администратора |
| **`is_blocked`** | boolean, default `false` | блокировка администратором |
| **`blocked_reason`** | text | причина, показывается человеку при попытке входа |
| `created_at`, `last_login_at` | timestamptz | |

Индекс: `users_role_idx (role)`.

### 2.3 `market_dev_profiles` — профиль программиста

Заполняется на дополнительном шаге регистрации.

| Поле | Тип | Назначение |
|---|---|---|
| `user_id` | text PK → users | 1:1 с аккаунтом |
| `sphere` | text | `frontend` \| `backend` \| `fullstack` \| `mobile` \| `devops` \| `design` \| `qa` \| `data` \| `gamedev` |
| `level` | text | `junior` \| `middle` \| `senior` \| `lead` |
| `stack` | text | «React, Node.js, PostgreSQL» — по этой строке работает поиск |
| `headline`, `bio`, `city` | text | витрина профиля |
| `rate_hour` | bigint | ставка за час |
| `currency` | text, default `'UZS'` | |
| `portfolio` | text (JSON) | `[{title, url, description}]` |
| `links` | text (JSON) | `{github, telegram, site}` |
| `available` | boolean | открыт ли к заказам |
| `rating` | numeric(3,2) | средняя оценка, пересчитывается при каждом отзыве |
| `reviews_count`, `projects_done` | integer | денормализованные счётчики |

Индекс: `market_dev_sphere_idx (sphere, level)`.

### 2.4 `market_client_profiles` — профиль заказчика

`user_id` PK → users, плюс `company`, `about`, `city`, `site`, `rating`,
`reviews_count`, `projects_posted`.

### 2.5 `market_projects` — заказы

| Поле | Тип | Назначение |
|---|---|---|
| `id` | text PK | |
| `owner_id` | text → users | **автор; только он и админ могут менять и удалять** |
| `title`, `description` | text | |
| `category` | text | одна из категорий (сферы + `other`) |
| `tags` | text (JSON) | массив строк в нижнем регистре |
| `budget_min`, `budget_max` | bigint | вилка бюджета |
| `currency` | text, default `'UZS'` | |
| `deadline_days` | integer | желаемый срок |
| `level` | text | желаемый уровень исполнителя |
| **`status`** | text, default `'open'` | `open` (В поиске) → `in_progress` (В работе) → `completed` (Завершён); плюс `cancelled` |
| **`moderation`** | text, default `'published'` | `published` \| `hidden` \| `pending` |
| `moderation_note` | text | комментарий модератора, виден автору |
| `assignee_id` | text → users | выбранный исполнитель |
| `agreed_amount` | bigint | сумма принятого отклика |
| `bids_count`, `views` | integer | счётчики для карточки |
| `created_at`, `updated_at`, `started_at`, `completed_at` | timestamptz | |

Индексы: `(status, created_at desc)`, `(owner_id, created_at desc)`,
`(category)`, `(assignee_id)`.

### 2.6 Остальные таблицы

| Таблица | Ключевые поля | Смысл |
|---|---|---|
| `market_bids` | `project_id`, `dev_id`, `amount`, `days`, `message`, `status` (`pending`/`accepted`/`declined`), **unique (project_id, dev_id)** | один отклик на проект от одного исполнителя; повторная отправка обновляет прежний |
| `market_messages` | `project_id`, `author_id`, `body` | переписка по проекту |
| `market_reviews` | `project_id`, `author_id`, `target_id`, `rating` 1–5, `comment`, **unique (project_id, author_id)** | по одному отзыву с каждой стороны сделки |
| `market_events` | `project_id`, `kind`, `message`, `actor_id` | лента «что происходило» в карточке |
| `market_offers` | `slug` unique, `title`, `subtitle`, `body`, `cta_label`, `cta_href`, `accent`, `weight`, `active` | пул предложений главной |
| `market_offer_runs` | `offer_id`, `cycle`, `slot`, `starts_at`, `ends_at`, **unique (cycle, offer_id)** | какая акция в каком окне показывалась — это и есть история |
| `market_admin_log` | `actor_id`, `actor_email`, `action`, `target`, `details` | журнал административных действий |

---

## 3. Ролевая модель

### 3.1 Выбор роли и её фиксация

Роль — обязательное поле `POST /api/auth/register`. Сервер отклоняет запрос
без неё (`400 bad_role`). Дальше роль не меняется:

* отдельного маршрута смены роли нет; `POST /api/auth/role` существует и
  всегда отвечает `403 role_locked` — чтобы намерение было видно в коде, а
  клиент получал понятный ответ вместо 404;
* `PATCH /api/market/me/profile` отклоняет тело с полями `role` или `isAdmin`
  (`403`), даже если их прислали случайно;
* повторная регистрация той же почты с другой ролью возвращает **уже
  закреплённую** роль и флаг `roleLocked: true` — интерфейс показывает
  объяснение, а не молча меняет сторону;
* в шапке и кабинете роль выводится значком с замком, а не переключателем.

Единственный способ переназначить роль — `POST /api/admin/users/:id/role`,
доступный только суперадминистратору.

### 3.2 Дополнительный шаг для программиста

При выборе «Я программист» регистрация становится трёхшаговой:

1. **Аккаунт** — имя, почта, пароль, телефон.
2. **Специализация** — сфера (карточки), уровень (Junior/Middle/Senior/Lead),
   основной стек, короткое описание, город, ставка за час.
3. **Подтверждение почты** — шестизначный код.

Шаг 2 валидируется и на клиенте, и на сервере: `bad_sphere`, `bad_level`,
`bad_stack`. Профиль создаётся сразу при регистрации, а на подтверждении
почты есть страховка — если профиля почему-то нет, он создаётся там.

### 3.3 Суперадминистратор

Аккаунт с почтой `OWNER_EMAIL` (по умолчанию `mmirazizf930@gmail.com`):

* получает `is_admin = true` в момент регистрации;
* восстанавливает права при каждом старте сервера (`ensureSuperAdmin()`) —
  даже если флаг сняли руками в базе;
* защищён от блокировки, удаления и разжалования на уровне API.

Иерархия прав:

| Действие | Администратор | Суперадминистратор |
|---|---|---|
| Список пользователей, поиск | да | да |
| Блокировка / разблокировка | да (кроме админов) | да |
| Удаление аккаунта | да (кроме админов) | да |
| Выдача и отзыв прав администратора | **нет** | да |
| Смена роли аккаунта | **нет** | да |
| Модерация и удаление проектов | да | да |
| Пул предложений главной | да | да |

### 3.4 Гарды на сервере

```js
requireAuth   // есть валидная сессия
requireUser   // + свежая запись из базы; 403 account_blocked для заблокированных
requireAdmin  // + is_admin
requireOwner  // + почта совпадает с OWNER_EMAIL
requireRole('client' | 'developer')
attachUser    // мягкий: кладёт пользователя, если он есть, и пропускает гостя
```

`requireUser` перечитывает пользователя из базы на каждом запросе, а не верит
подписи в куке. Иначе разжалованный администратор оставался бы админом до
конца сессии — в тестах это отдельная проверка.

---

## 4. REST API

Общее: JSON, сессия — httpOnly-кука `proposal_session`, все запросы с
`credentials: 'include'`. Ошибка всегда одной формы:

```json
{ "code": "forbidden", "message": "Редактировать проект может только его автор или администратор.", "field": null }
```

### 4.1 Авторизация

| Метод | Путь | Доступ | Тело / параметры |
|---|---|---|---|
| POST | `/api/auth/register` | все | `{ email, password, fullName?, phone?, role, devProfile? }` |
| POST | `/api/auth/verify-email` | все | `{ email, code }` → ставит сессию |
| POST | `/api/auth/resend-code` | все | `{ email }` |
| POST | `/api/auth/login` | все | `{ email, password }` |
| POST | `/api/auth/logout` | все | — |
| GET | `/api/auth/me` | сессия | — |
| POST | `/api/auth/role` | сессия | всегда `403 role_locked` |

Пример регистрации программиста:

```http
POST /api/auth/register
{
  "email": "aziz@toshkent.uz",
  "password": "long-passphrase-2026",
  "fullName": "Азиз Тураев",
  "role": "developer",
  "devProfile": {
    "sphere": "fullstack",
    "level": "senior",
    "stack": "React, Node.js, PostgreSQL",
    "city": "Ташкент",
    "rateHour": 140000
  }
}
→ 201 { "status": "verification_sent", "email": "...", "role": "developer", "resendAfterSeconds": 60 }
```

Ответ `/api/auth/me`:

```json
{ "user": { "id": "…", "email": "…", "fullName": "…", "role": "developer",
            "isAdmin": false, "isOwner": false, "isBlocked": false,
            "emailVerified": true, "createdAt": "…" } }
```

### 4.2 Справочники и главная страница

| Метод | Путь | Доступ | Ответ |
|---|---|---|---|
| GET | `/api/market/meta` | все | сферы, уровни, категории, статусы, `rotationDays`, `platformFeeRate` |
| GET | `/api/market/tags` | все | `[{ tag, count }]` — облако для фильтров |
| GET | `/api/market/offers` | все | текущая подборка + `cycle`, `startsAt`, `endsAt`, `nextRotationAt` |
| GET | `/api/market/offers/history?limit` | все | `windows: [{ cycle, startsAt, endsAt, offers[] }]` |

### 4.3 Проекты

| Метод | Путь | Доступ | Примечание |
|---|---|---|---|
| GET | `/api/market/projects` | все | фильтры ниже |
| POST | `/api/market/projects` | **только заказчик** | `403 wrong_role` для программиста |
| GET | `/api/market/projects/:id` | все | отклики видит автор, админ и сам откликнувшийся |
| PATCH | `/api/market/projects/:id` | **автор или админ** | иначе `403` |
| DELETE | `/api/market/projects/:id` | **автор или админ** | проект «в работе» удаляет только админ |
| POST | `/api/market/projects/:id/status` | автор или админ | `{ status }` |

Параметры выдачи: `search`, `category`, `status`, `level`, `tags` (через
запятую, требуется вхождение всех), `budgetMin`, `budgetMax`, `ownerId`,
`sort` (`fresh` \| `budget` \| `bids`), `limit`, `offset`. Фильтрация целиком
на сервере, поэтому счётчик `total` честный.

Разрешённые переходы статусов (администратор не ограничен):

```
open        → in_progress | cancelled
in_progress → completed | cancelled | open
completed   → (терминальный)
cancelled   → open
```

`in_progress` требует назначенного исполнителя (`400 no_assignee`).
Возврат в `open` снимает исполнителя и согласованную сумму.

### 4.4 Отклики, переписка, отзывы

| Метод | Путь | Доступ |
|---|---|---|
| POST | `/api/market/projects/:id/bids` | только программист, проект `open`, не свой проект |
| DELETE | `/api/market/projects/:id/bids/:bidId` | автор отклика или админ; принятый отклик отозвать нельзя |
| POST | `/api/market/projects/:id/bids/:bidId/accept` | автор проекта или админ |
| GET/POST | `/api/market/projects/:id/messages` | заказчик, назначенный исполнитель, откликнувшиеся, админ |
| POST | `/api/market/projects/:id/reviews` | участники сделки, только при `status = completed` |
| GET | `/api/market/users/:id/reviews` | все |

Принятие отклика одним запросом: статус отклика → `accepted`, остальные →
`declined`, проект → `in_progress` с `assignee_id` и `agreed_amount`, в ответ
приходит расчёт выплаты:

```json
{ "payout": { "amount": 38000000, "platformFee": 3040000, "developerGets": 34960000 } }
```

### 4.5 Профили

| Метод | Путь | Доступ |
|---|---|---|
| GET | `/api/market/developers` | все — `sphere`, `level`, `search`, `available` |
| GET | `/api/market/users/:id` | все — профиль, работы, портфолио, отзывы |
| GET | `/api/market/me` | сессия — профиль, свои проекты, свои отклики |
| PATCH | `/api/market/me/profile` | сессия — набор полей определяет роль **из базы** |

### 4.6 Админ-панель

Все маршруты требуют `requireUser + requireAdmin`.

| Метод | Путь | Кто |
|---|---|---|
| GET | `/api/admin/overview` | админ — сводка и последние действия |
| GET | `/api/admin/log?limit` | админ |
| GET | `/api/admin/users?search&role&limit&offset` | админ |
| POST | `/api/admin/users/:id/block` | админ — `{ blocked, reason }` |
| DELETE | `/api/admin/users/:id` | админ |
| POST | `/api/admin/users/:id/admin` | **суперадмин** — `{ isAdmin }` |
| POST | `/api/admin/users/:id/role` | **суперадмин** — `{ role }` |
| GET | `/api/admin/projects` | админ — включая скрытые |
| POST | `/api/admin/projects/:id/moderation` | админ — `{ moderation, note }` |
| DELETE | `/api/admin/projects/:id` | админ |
| GET/POST | `/api/admin/offers` | админ |
| PATCH/DELETE | `/api/admin/offers/:id` | админ |

---

## 5. Динамические предложения главной

Требование — «обновляется каждые 2–3 дня или выбирает случайно из пула» —
решено детерминированной ротацией без cron и фоновых задач.

```js
cycle = floor((now − EPOCH) / (OFFER_ROTATION_DAYS × 24ч))
random = mulberry32(cycle × 2654435761)
подборка = взвешенный выбор SLOTS предложений из активного пула
```

Три следствия:

1. **Нет планировщика.** Подборка вычисляется на лету при запросе.
2. **Все процессы согласованы.** В одном окне любой инстанс приложения
   покажет одно и то же — зерно зависит только от номера окна.
3. **История получается сама.** Первый запрос в новом окне записывает выбор
   в `market_offer_runs`; всё, что старше текущего окна, и есть раздел
   «Прошедшие акции». Ничего не удаляется: если акцию потом убрали из пула,
   запись в истории остаётся с пометкой.

Вес (`weight`, 1–10) влияет на вероятность попадания в подборку, но один
оффер не может занять два слота сразу.

---

## 6. Ключевые компоненты интерфейса

Дизайн собран на существующих токенах `src/styles/global.css` — новых цветов
не появилось. Все страницы строятся из `src/components/Market/ui.jsx`:
`StatusBadge`, `RoleBadge`, `Avatar`, `Rating`, `Stars`, `Button`, `Card`,
`Input`, `TextArea`, `Select`, `Chip`, `TagPill`, `Alert`, `Empty`,
`Spinner`, `SectionHeading` плюс форматирование денег и дат.

### 6.1 Маршруты

`src/lib/router.js` — хеш-роутер: адрес карточки проекта можно скинуть в чат.

```
#/                    главная: оффер-баннеры, форма задачи, свежие проекты
#/projects            доска с поиском и фильтрами
#/projects/new        полная форма создания
#/projects/:id        карточка: отклики, переписка, статусы, отзывы
#/developers          каталог исполнителей
#/users/:id           публичный профиль
#/me                  личный кабинет
#/admin               админ-панель
#/offers              история акций
#/login  #/register   вход и регистрация
#/proposal            прежний раздел с коммерческим предложением
```

### 6.2 Статус заказа — один компонент на весь проект

```jsx
const STATUS_STYLE = {
  open:        { label: 'В поиске',  className: 'bg-brand-tint text-brand ring-brand/20' },
  in_progress: { label: 'В работе',  className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  completed:   { label: 'Завершён',  className: 'bg-signal-tint text-signal ring-signal/20' },
  cancelled:   { label: 'Отменён',   className: 'bg-surface-sunken text-ink-muted ring-line-strong' },
};

export function StatusBadge({ status }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.cancelled;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style.className}`}>
      {style.label}
    </span>
  );
}
```

### 6.3 Форма создания проекта на видном месте

`ProjectForm` — одна форма на создание, редактирование и быстрый ввод. На
главной она стоит в первом экране в свёрнутом виде и раскрывается по клику;
на `#/projects/new` — сразу полная; в карточке проекта — та же форма в режиме
редактирования. Гостю и программисту вместо полей показывается объяснение.

```jsx
<ProjectForm variant="compact" />            // главная
<ProjectForm variant="full" />               // #/projects/new
<ProjectForm project={project} onDone={…} /> // редактирование в карточке
```

Реакция на роль встроена в компонент:

```jsx
if (!user) return <КарточкаПриглашения />;          // ведёт на регистрацию заказчика
if (user.role !== 'client') return <ПояснениеРоли />; // роль фиксирована, кнопки нет
```

### 6.4 Кнопки рисуются по правам, присланным сервером

`GET /api/market/projects/:id` возвращает блок `permissions`, и интерфейс
опирается на него, а не на собственные догадки:

```jsx
permissions: {
  canEdit:     project.owner_id === viewer.id || viewer.is_admin,
  canDelete:   то же самое,
  canBid:      viewer.role === 'developer' && project.status === 'open',
  canModerate: viewer.is_admin,
}
```

```jsx
{permissions.canEdit && <Button onClick={() => setEditing(true)}>Редактировать</Button>}
{permissions.canDelete && <Button tone="danger" …>Удалить</Button>}
```

Даже если разметку подменить в браузере, действие упрётся в ту же проверку
на сервере — в дымовом прогоне это отдельные тесты (чужой заказчик и
программист получают `403` на `PATCH` и `DELETE`).

### 6.5 Оффер-баннеры с обратным отсчётом

`OfferBanners` показывает подборку и честно пишет, когда она сменится,
считая до `nextRotationAt`, который приехал с сервера:

```jsx
<p className="mt-1.5 text-sm text-ink-muted">
  Подборка обновляется раз в {offers.rotationDays} {plural(offers.rotationDays, ['день','дня','дней'])}
  {countdown ? ` · следующая смена через ${countdown}` : ''}
</p>
```

### 6.6 Фильтры доски

`ProjectsPage` держит поиск, категорию, статус, уровень, вилку бюджета и
теги. Поиск дебаунсится на 350 мс, всё остальное уходит на сервер сразу:

```js
setFilter(key, value) {
  set({ filters: { ...get().filters, [key]: value } });
  get().loadFeed();          // фильтрация целиком серверная
}
```

### 6.7 Админ-панель

`AdminPage` разделена по задачам, а не по таблицам: **Сводка** (счётчики и
журнал действий), **Пользователи** (поиск, роль, блокировка, удаление, для
суперадмина — выдача прав и смена роли), **Проекты** (снять с публикации с
причиной, вернуть, удалить), **Предложения** (пул ротации, что в эфире
сейчас, добавление и выключение). Опасные действия требуют второго клика:
кнопка сначала превращается в «Точно удалить?».

---

## 7. Запуск и проверка

```bash
# фронтенд
npm install
npm run dev            # http://localhost:5173

# бэкенд
cd backend && npm install && npm run dev   # http://localhost:4000
```

Без `DATABASE_URL` бэкенд поднимается на хранилище в памяти, без почтового
провайдера код подтверждения печатается в консоль и показывается в интерфейсе.
В продакшене сервер откажется стартовать на памяти.

### Назначение суперадминистратора

```
OWNER_EMAIL=mmirazizf930@gmail.com
```

Зарегистрируйте аккаунт с этой почтой — права выдадутся автоматически и будут
восстанавливаться при каждом старте. Другой почте права выдаются из панели:
**Админ → Пользователи → Сделать админом** (доступно только владельцу).

### Прочие переменные

| Переменная | По умолчанию | Смысл |
|---|---|---|
| `OFFER_ROTATION_DAYS` | `3` | 2 или 3 дня на окно ротации |
| `OFFER_SLOTS` | `3` | сколько карточек в подборке (1–6) |
| `PLATFORM_FEE_RATE` | `0.08` | комиссия площадки с суммы сделки |

### Проверки

```bash
npm run smoke    # 97 проверок API: роли, права, статусы, модерация, админка
npm run check    # разбор всех файлов src/ и сверка импортов с экспортами
npm run build    # продакшен-сборка фронтенда
```

Дымовой прогон поднимает сервер в памяти на порту 4310 и проходит путь
целиком: регистрация обеих ролей → публикация задачи → фильтры → отклик →
выбор исполнителя → переписка → завершение → отзывы → блокировка → модерация
→ пул акций. Отдельно проверяется то, что должно **не** работать: программист
не публикует проекты, заказчик не откликается, чужой аккаунт не редактирует
проект, гость не видит откликов, роль не меняется, суперадмина нельзя
заблокировать.
