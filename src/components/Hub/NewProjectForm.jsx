import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Loader2, Rocket, Sparkles } from 'lucide-react';
import { useMeta } from '../../store/useQuoteStore';
import { useHubStore } from '../../store/useHubStore';
import { ROLES } from '../../data/hubData';
import { formatCurrency, formatAlternate } from '../../lib/format';
import { ICON, STROKE } from '../../lib/icons';

/**
 * Своя задача.
 *
 * Заказчик описывает, что нужно сделать, и смета собирается прямо под
 * его выбор: тип продукта, объём, срочность и набор ролей. Ни одна цифра
 * здесь не зашита — бюджет пересчитывается на каждое нажатие.
 */

/** Базовая стоимость типового продукта в сумах. */
export const PROJECT_TYPES = [
  {
    id: 'shop',
    label: 'Интернет-магазин',
    base: 42_000_000,
    weeks: 6,
    hint: 'Каталог, корзина, оплата, доставка, админка.',
    roles: ['fullstack', 'frontend', 'backend', 'design', 'qa'],
  },
  {
    id: 'landing',
    label: 'Сайт-визитка / лендинг',
    base: 12_000_000,
    weeks: 2,
    hint: 'Одна-две страницы, форма заявки, быстрая загрузка.',
    roles: ['frontend', 'design'],
  },
  {
    id: 'mobile',
    label: 'Мобильное приложение',
    base: 58_000_000,
    weeks: 8,
    hint: 'Android и iOS на одной кодовой базе, push-уведомления.',
    roles: ['fullstack', 'design', 'backend', 'qa'],
  },
  {
    id: 'crm',
    label: 'CRM / внутренняя система',
    base: 48_000_000,
    weeks: 7,
    hint: 'Роли и доступы, отчёты, выгрузки, интеграция с 1С.',
    roles: ['backend', 'frontend', 'design', 'qa', 'devops'],
  },
  {
    id: 'bot',
    label: 'Телеграм-бот / автоматизация',
    base: 9_000_000,
    weeks: 2,
    hint: 'Приём заявок, оплата, уведомления менеджеру.',
    roles: ['backend'],
  },
  {
    id: 'other',
    label: 'Другое',
    base: 25_000_000,
    weeks: 4,
    hint: 'Опишите задачу словами — исполнители предложат свою цену.',
    roles: ['fullstack'],
  },
];

const SCALES = [
  { id: 'mvp', label: 'MVP — проверить идею', factor: 0.65, weeksFactor: 0.7 },
  { id: 'standard', label: 'Полноценный запуск', factor: 1, weeksFactor: 1 },
  { id: 'large', label: 'Большой проект', factor: 1.6, weeksFactor: 1.45 },
];

const URGENCY = [
  { id: 'calm', label: 'Спокойно', factor: 0.95, note: 'срок можно сдвинуть' },
  { id: 'normal', label: 'Обычно', factor: 1, note: 'как договоримся' },
  { id: 'rush', label: 'Срочно', factor: 1.28, note: 'надбавка за сжатый срок' },
];

/** Смета: тип × объём × срочность + доплата за каждую роль сверх базовой. */
export function estimateBudget({ typeId, scaleId, urgencyId, roleIds }) {
  const type = PROJECT_TYPES.find((item) => item.id === typeId) ?? PROJECT_TYPES[0];
  const scale = SCALES.find((item) => item.id === scaleId) ?? SCALES[1];
  const urgency = URGENCY.find((item) => item.id === urgencyId) ?? URGENCY[1];

  const extraRoles = roleIds.filter((id) => !type.roles.includes(id));
  const missingRoles = type.roles.filter((id) => !roleIds.includes(id));

  const extra = extraRoles.reduce((sum, id) => {
    const role = ROLES.find((item) => item.id === id);
    return sum + (role ? type.base * role.share * 0.9 : 0);
  }, 0);

  const saved = missingRoles.reduce((sum, id) => {
    const role = ROLES.find((item) => item.id === id);
    return sum + (role ? type.base * role.share * 0.75 : 0);
  }, 0);

  const raw = (type.base + extra - saved) * scale.factor * urgency.factor;
  const budget = Math.max(3_000_000, Math.round(raw / 100_000) * 100_000);
  const weeks = Math.max(1, Math.round(type.weeks * scale.weeksFactor * (urgency.id === 'rush' ? 0.75 : 1)));

  return { budget, weeks, type, scale, urgency };
}

function Chip({ active, children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`min-h-10 cursor-pointer rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors duration-150 ${
        active
          ? 'border-brand bg-brand text-white'
          : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export default function NewProjectForm({ onPublished = null }) {
  const meta = useMeta();
  const createCustomProject = useHubStore((state) => state.createCustomProject);
  const loading = useHubStore((state) => state.loading);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [typeId, setTypeId] = useState('shop');
  const [scaleId, setScaleId] = useState('standard');
  const [urgencyId, setUrgencyId] = useState('normal');
  const [roleIds, setRoleIds] = useState(['fullstack', 'frontend', 'backend', 'design', 'qa']);
  const [manualBudget, setManualBudget] = useState(null);
  const [touched, setTouched] = useState(false);

  // «И вся остальная информация»: то, что исполнителю нужно знать, чтобы
  // назвать честную цену, а не переспрашивать в переписке.
  const [extraOpen, setExtraOpen] = useState(false);
  const [haveNow, setHaveNow] = useState('');
  const [links, setLinks] = useState('');
  const [deadline, setDeadline] = useState('');
  const [contact, setContact] = useState('');

  const estimate = useMemo(
    () => estimateBudget({ typeId, scaleId, urgencyId, roleIds }),
    [typeId, scaleId, urgencyId, roleIds]
  );

  const budget = manualBudget ?? estimate.budget;
  const sliderMin = 3_000_000;
  const sliderMax = Math.max(120_000_000, estimate.budget * 2);

  const toggleRole = (id) =>
    setRoleIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  const applyType = (id) => {
    const type = PROJECT_TYPES.find((item) => item.id === id);
    setTypeId(id);
    if (type) setRoleIds(type.roles);
    setManualBudget(null);
  };

  const valid = title.trim().length >= 3 && summary.trim().length >= 10 && budget > 0;

  return (
    <form
      className="overflow-hidden rounded-card border border-line bg-surface"
      onSubmit={async (event) => {
        event.preventDefault();
        setTouched(true);
        if (!valid) return;
        const brief = {
          haveNow: haveNow.trim() || null,
          links: links.trim() || null,
          deadline: deadline || null,
          contact: contact.trim() || null,
        };
        // Дополнения дописываем в описание — их видят исполнители в отклике.
        const extras = [
          brief.haveNow && `Что уже есть: ${brief.haveNow}`,
          brief.links && `Материалы: ${brief.links}`,
          brief.deadline && `Желаемый срок: до ${brief.deadline}`,
          brief.contact && `Связь: ${brief.contact}`,
        ].filter(Boolean);

        const project = await createCustomProject({
          title: title.trim(),
          summary: [summary.trim(), ...extras].join('\n\n'),
          brief,
          budget,
          weeks: estimate.weeks,
          typeId,
          scaleId,
          urgencyId,
          roleIds,
        });
        if (project && onPublished) onPublished(project);
      }}
    >
      <div className="border-b border-line px-6 py-6 sm:px-8">
        <p className="label-caps">Своя задача</p>
        <h2 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.025em] text-ink sm:text-[1.75rem]">
          Опишите, что нужно сделать
        </h2>
        <p className="measure mt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
          Смета пересчитывается на каждый ваш выбор. Опубликуете — исполнители пришлют свои цены,
          и вы выберете подходящую.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-10 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Название проекта</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: интернет-магазин детской одежды"
              className="min-h-11 rounded-control border border-line bg-canvas px-3.5 text-sm text-ink placeholder:text-ink-muted/70"
            />
            {touched && title.trim().length < 3 && (
              <span className="text-xs text-danger">Введите название — хотя бы три символа.</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-caps">Задача целиком</span>
            <textarea
              rows={5}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Что за бизнес, кто покупатели, что должно уметь: каталог, оплата Payme, доставка по регионам, вход через SMS. Чем подробнее — тем точнее цены в откликах."
              className="rounded-control border border-line bg-canvas px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted/70"
            />
            {touched && summary.trim().length < 10 && (
              <span className="text-xs text-danger">Опишите задачу подробнее.</span>
            )}
          </label>

          <div>
            <p className="label-caps">Что делаем</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {PROJECT_TYPES.map((type) => (
                <Chip
                  key={type.id}
                  active={typeId === type.id}
                  onClick={() => applyType(type.id)}
                  title={type.hint}
                >
                  {type.label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">{estimate.type.hint}</p>
          </div>

          <div>
            <p className="label-caps">Объём</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {SCALES.map((scale) => (
                <Chip
                  key={scale.id}
                  active={scaleId === scale.id}
                  onClick={() => {
                    setScaleId(scale.id);
                    setManualBudget(null);
                  }}
                >
                  {scale.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="label-caps">Срочность</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {URGENCY.map((item) => (
                <Chip
                  key={item.id}
                  active={urgencyId === item.id}
                  onClick={() => {
                    setUrgencyId(item.id);
                    setManualBudget(null);
                  }}
                  title={item.note}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Необязательные детали спрятаны, чтобы форма не пугала длиной. */}
          <div className="rounded-card border border-line bg-canvas">
            <button
              type="button"
              onClick={() => setExtraOpen((open) => !open)}
              aria-expanded={extraOpen}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span>
                <span className="block text-[0.9375rem] font-medium text-ink">
                  Детали задачи
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Что уже есть, ссылки, срок, как с вами связаться — по желанию
                </span>
              </span>
              <ChevronDown
                size={ICON.sm}
                strokeWidth={STROKE.regular}
                aria-hidden="true"
                className={`shrink-0 text-ink-muted transition-transform duration-200 ${
                  extraOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {extraOpen && (
              <div className="flex flex-col gap-4 border-t border-line px-4 py-4">
                <label className="flex flex-col gap-1.5">
                  <span className="label-caps">Что уже готово</span>
                  <textarea
                    rows={2}
                    value={haveNow}
                    onChange={(event) => setHaveNow(event.target.value)}
                    placeholder="Есть логотип и тексты, домен куплен, база товаров в Excel."
                    className="rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted/70"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="label-caps">Ссылки и примеры</span>
                  <input
                    value={links}
                    onChange={(event) => setLinks(event.target.value)}
                    placeholder="Сайт-образец, Figma, техзадание в Google Docs"
                    className="min-h-11 rounded-control border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted/70"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="label-caps">Нужно к дате</span>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(event) => setDeadline(event.target.value)}
                      className="tnum min-h-11 rounded-control border border-line bg-surface px-3.5 text-sm text-ink"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="label-caps">Как связаться</span>
                    <input
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      placeholder="Telegram @username или +998…"
                      className="min-h-11 rounded-control border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-muted/70"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="label-caps">Кто нужен в команде</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <Chip
                  key={role.id}
                  active={roleIds.includes(role.id)}
                  onClick={() => {
                    toggleRole(role.id);
                    setManualBudget(null);
                  }}
                  title={role.description}
                >
                  {role.short}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <aside className="mt-8 lg:mt-0">
          <div className="rounded-card border border-line bg-canvas p-5 lg:sticky lg:top-24">
            <p className="label-caps">Предварительная смета</p>

            <motion.p
              key={budget}
              initial={{ opacity: 0.4, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="tnum mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink"
            >
              {formatCurrency(budget, meta)}
            </motion.p>
            <p className="tnum mt-1 text-sm text-ink-muted">{formatAlternate(budget, meta)}</p>

            <p className="mt-3 text-[0.8125rem] text-ink-muted">
              Ориентировочный срок — {estimate.weeks} нед.
            </p>

            <label className="mt-5 flex flex-col gap-2">
              <span className="label-caps">Свой бюджет</span>
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={500_000}
                value={Math.min(sliderMax, Math.max(sliderMin, budget))}
                onChange={(event) => setManualBudget(Number(event.target.value))}
                style={{
                  '--range-fill': `${Math.round(
                    ((Math.min(sliderMax, Math.max(sliderMin, budget)) - sliderMin) /
                      (sliderMax - sliderMin)) *
                      100
                  )}%`,
                }}
                className="range-brand w-full cursor-pointer"
              />
              <input
                type="number"
                min={0}
                step={500_000}
                value={budget}
                onChange={(event) => setManualBudget(Number(event.target.value))}
                className="tnum min-h-11 rounded-control border border-line bg-surface px-3.5 text-sm text-ink"
              />
            </label>

            {manualBudget !== null && manualBudget !== estimate.budget && (
              <button
                type="button"
                onClick={() => setManualBudget(null)}
                className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-brand hover:underline"
              >
                <Sparkles size={ICON.xs} strokeWidth={STROKE.regular} aria-hidden="true" />
                Вернуть расчётную цену
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-5 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-brand px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-hover disabled:opacity-45"
            >
              {loading ? (
                <Loader2 size={ICON.sm} strokeWidth={STROKE.regular} className="animate-spin" />
              ) : (
                <Rocket size={ICON.sm} strokeWidth={STROKE.regular} aria-hidden="true" />
              )}
              Опубликовать задачу
            </button>

            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Деньги переводятся исполнителю только после того, как вы примете работу.
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
