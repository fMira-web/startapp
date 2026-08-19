import { useState } from 'react';
import { AlertCircle, Plus, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useMarketStore } from '../../store/useMarketStore';
import * as api from '../../lib/marketApi';
import { navigate } from '../../lib/router';
import { Alert, Button, Card, Input, Select, TextArea, moneyShort } from './ui';

/**
 * Форма проекта — одна на создание и на редактирование.
 *
 * Стоит на главной в свёрнутом виде («compact») и отдельной страницей
 * целиком («full»). Публиковать может только заказчик, поэтому гостю форма
 * показывается, но ведёт на регистрацию, а программисту — объясняет, почему
 * кнопки нет: роль выбрана при регистрации и не переключается.
 */

const EMPTY = {
  title: '',
  description: '',
  category: 'fullstack',
  tags: '',
  budgetMin: '',
  budgetMax: '',
  deadlineDays: '',
  level: '',
};

function toDraft(project) {
  if (!project) return { ...EMPTY };
  return {
    title: project.title ?? '',
    description: project.description ?? '',
    category: project.category ?? 'fullstack',
    tags: (project.tags ?? []).join(', '),
    budgetMin: project.budgetMin ? String(project.budgetMin) : '',
    budgetMax: project.budgetMax ? String(project.budgetMax) : '',
    deadlineDays: project.deadlineDays ? String(project.deadlineDays) : '',
    level: project.level ?? '',
  };
}

export default function ProjectForm({ variant = 'full', project = null, onDone }) {
  const user = useAuthStore((state) => state.user);
  const meta = useMarketStore((state) => state.meta);
  const loadFeed = useMarketStore((state) => state.loadFeed);
  const loadHighlights = useMarketStore((state) => state.loadHighlights);

  const [draft, setDraft] = useState(() => toDraft(project));
  const [expanded, setExpanded] = useState(variant === 'full');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  const editing = Boolean(project);
  const categories = meta?.categories ?? [];
  const levels = meta?.levels ?? [];

  const set = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: null }));
  };

  /* --- гость и программист видят объяснение, а не форму ---------------- */

  if (!user) {
    return (
      <Card className="p-6">
        <p className="label-caps inline-flex items-center gap-1.5">
          <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" />
          Новая задача
        </p>
        <h3 className="mt-2 text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
          Опишите задачу — исполнители сами предложат цену
        </h3>
        <p className="measure mt-2 text-sm leading-relaxed text-ink-muted">
          Публиковать задачи могут аккаунты с ролью «Заказчик». Роль выбирается при регистрации
          и потом не меняется, поэтому выберите её сразу.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => navigate('/register')}>Зарегистрироваться как заказчик</Button>
          <Button tone="secondary" onClick={() => navigate('/login')}>
            У меня уже есть аккаунт
          </Button>
        </div>
      </Card>
    );
  }

  if (user.role !== 'client') {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} strokeWidth={1.7} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
          <div>
            <h3 className="text-[0.9375rem] font-semibold text-ink">
              Вы вошли как программист
            </h3>
            <p className="measure mt-1.5 text-sm leading-relaxed text-ink-muted">
              Задачи публикуют заказчики. Роль аккаунта зафиксирована при регистрации и не
              переключается — если нужен второй профиль, заведите отдельный аккаунт или напишите
              администратору площадки.
            </p>
            <Button tone="secondary" size="sm" className="mt-4" onClick={() => navigate('/projects')}>
              Смотреть открытые задачи
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  /* --- валидация и отправка -------------------------------------------- */

  const validate = () => {
    const problems = {};
    if (draft.title.trim().length < 6) problems.title = 'Название — минимум 6 символов.';
    if (draft.description.trim().length < 20) problems.description = 'Опишите задачу подробнее.';
    const max = Number(draft.budgetMax);
    const min = Number(draft.budgetMin || 0);
    if (!Number.isFinite(max) || max <= 0) problems.budgetMax = 'Укажите верхнюю границу бюджета.';
    else if (min > max) problems.budgetMin = 'Нижняя граница больше верхней.';
    setErrors(problems);
    return Object.keys(problems).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setPending(true);
    setFormError(null);
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
      tags: draft.tags,
      budgetMin: Number(draft.budgetMin || 0),
      budgetMax: Number(draft.budgetMax),
      deadlineDays: draft.deadlineDays ? Number(draft.deadlineDays) : null,
      level: draft.level || null,
    };

    try {
      const saved = editing
        ? await api.updateProject(project.id, payload)
        : await api.createProject(payload);
      setPending(false);
      setDraft({ ...EMPTY });
      await Promise.all([loadFeed(), loadHighlights()]);
      if (onDone) onDone(saved);
      else navigate(`/projects/${saved.id}`);
    } catch (error) {
      setPending(false);
      setFormError(error?.message ?? 'Не удалось сохранить проект.');
      if (error?.field) setErrors((current) => ({ ...current, [error.field]: error.message }));
    }
  };

  /* --- свёрнутый вид на главной ---------------------------------------- */

  if (!expanded) {
    return (
      <Card className="p-6" id="new-project">
        <p className="label-caps inline-flex items-center gap-1.5">
          <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" />
          Новая задача
        </p>
        <h3 className="mt-2 text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
          Опишите задачу — исполнители сами предложат цену и срок
        </h3>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            id="quick-title"
            placeholder="Например: интернет-магазин с оплатой Payme"
            value={draft.title}
            onChange={set('title')}
            className="flex-1"
            aria-label="Название задачи"
          />
          <Button
            onClick={() => setExpanded(true)}
            className="shrink-0"
          >
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            Продолжить
          </Button>
        </div>
        <p className="mt-2.5 text-xs text-ink-muted">
          Публикация бесплатна. Комиссия площадки удерживается только с суммы сделки.
        </p>
      </Card>
    );
  }

  /* --- полная форма ----------------------------------------------------- */

  const previewMin = Number(draft.budgetMin || 0);
  const previewMax = Number(draft.budgetMax || 0);

  return (
    <Card className="p-6" id="new-project">
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <div>
          <p className="label-caps">{editing ? 'Редактирование' : 'Новая задача'}</p>
          <h3 className="mt-2 text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
            {editing ? 'Обновите условия проекта' : 'Расскажите, что нужно сделать'}
          </h3>
        </div>

        <Alert tone="error">{formError}</Alert>

        <Input
          id="project-title"
          label="Название задачи"
          placeholder="Интернет-магазин с оплатой Payme и Click"
          value={draft.title}
          onChange={set('title')}
          error={errors.title}
          maxLength={160}
        />

        <TextArea
          id="project-description"
          label="Описание"
          rows={7}
          placeholder="Что за продукт, какие экраны, какие интеграции, что уже есть, что критично по срокам."
          value={draft.description}
          onChange={set('description')}
          error={errors.description}
          hint="Чем конкретнее описание, тем точнее отклики. Минимум 20 символов."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="project-category"
            label="Категория"
            value={draft.category}
            onChange={set('category')}
            options={categories}
          />
          <Select
            id="project-level"
            label="Желаемый уровень исполнителя"
            value={draft.level}
            onChange={set('level')}
            options={levels}
            placeholder="Не важно"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            id="project-budget-min"
            label="Бюджет от, сум"
            inputMode="numeric"
            placeholder="20000000"
            value={draft.budgetMin}
            onChange={set('budgetMin')}
            error={errors.budgetMin}
            className="tnum"
          />
          <Input
            id="project-budget-max"
            label="Бюджет до, сум"
            inputMode="numeric"
            placeholder="45000000"
            value={draft.budgetMax}
            onChange={set('budgetMax')}
            error={errors.budgetMax}
            className="tnum"
          />
          <Input
            id="project-deadline"
            label="Срок, дней"
            inputMode="numeric"
            placeholder="45"
            value={draft.deadlineDays}
            onChange={set('deadlineDays')}
            className="tnum"
          />
        </div>

        {previewMax > 0 && (
          <p className="tnum text-sm text-ink-muted">
            Исполнители увидят:{' '}
            <span className="font-semibold text-ink">
              {previewMin && previewMin !== previewMax
                ? `${moneyShort(previewMin)} — ${moneyShort(previewMax)}`
                : moneyShort(previewMax)}
            </span>
          </p>
        )}

        <Input
          id="project-tags"
          label="Теги"
          placeholder="react, payme, postgresql"
          value={draft.tags}
          onChange={set('tags')}
          hint="Через запятую, до 12 штук. По тегам работает фильтр на доске."
        />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" pending={pending}>
            {editing ? 'Сохранить изменения' : 'Опубликовать задачу'}
          </Button>
          {variant === 'compact' && !editing && (
            <Button tone="ghost" onClick={() => setExpanded(false)}>
              Свернуть
            </Button>
          )}
          {editing && onDone && (
            <Button tone="ghost" onClick={() => onDone(null)}>
              Отмена
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
