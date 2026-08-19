import { useState } from 'react';
import {
  Briefcase,
  FileText,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useMarketStore } from '../../store/useMarketStore';
import { navigate, toHref } from '../../lib/router';
import { Avatar, Button, RoleBadge } from './ui';

/**
 * Шапка биржи.
 *
 * Заметная деталь: переключателя роли здесь нет и быть не может. Роль
 * выбирается один раз при регистрации, поэтому в шапке она показана
 * значком — как факт об аккаунте, а не как настройка.
 */

const NAV = [
  { to: '/projects', label: 'Проекты', icon: LayoutGrid },
  { to: '/developers', label: 'Исполнители', icon: Users },
  { to: '/offers', label: 'Акции', icon: FileText },
];

function NavLinks({ current, onNavigate }) {
  return NAV.map((item) => {
    const active = current.startsWith(item.to.slice(1));
    const Icon = item.icon;
    return (
      <a
        key={item.to}
        href={toHref(item.to)}
        onClick={onNavigate}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium transition-colors duration-150 ${
          active ? 'bg-brand-tint text-brand' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
        }`}
      >
        <Icon size={15} strokeWidth={1.7} aria-hidden="true" />
        {item.label}
      </a>
    );
  });
}

export default function MarketHeader() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const route = useMarketStore((state) => state.route);
  const [open, setOpen] = useState(false);

  const current = route?.name ?? 'home';
  const isClient = user?.role === 'client';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-3 px-5 sm:px-8">
        <a href={toHref('/')} className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand text-white"
          >
            <Briefcase size={16} strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
              Toshkent Freelance
            </span>
            <span className="block truncate text-xs text-ink-muted">Биржа заказов и исполнителей</span>
          </span>
        </a>

        <nav aria-label="Основная навигация" className="hidden items-center gap-1 md:flex">
          <NavLinks current={current} />
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {isClient && (
            <Button size="sm" onClick={() => navigate('/projects/new')} className="hidden sm:inline-flex">
              <Plus size={15} strokeWidth={2} aria-hidden="true" />
              Разместить задачу
            </Button>
          )}

          {user?.isAdmin && (
            <a
              href={toHref('/admin')}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold transition-colors duration-150 ${
                current === 'admin' ? 'bg-brand text-white' : 'bg-brand-tint text-brand hover:bg-brand hover:text-white'
              }`}
            >
              <Shield size={15} strokeWidth={1.8} aria-hidden="true" />
              <span className="hidden sm:inline">Админ</span>
            </a>
          )}

          {user ? (
            <>
              <a
                href={toHref('/me')}
                className="hidden items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-colors duration-150 hover:border-brand/40 lg:inline-flex"
              >
                <Avatar user={user} size={28} />
                <span className="max-w-[10rem] truncate text-[0.8125rem] font-medium text-ink">
                  {user.fullName || user.email}
                </span>
              </a>
              <span className="hidden xl:inline">
                <RoleBadge role={user.role} isAdmin={user.isAdmin} />
              </span>
              <button
                type="button"
                onClick={signOut}
                aria-label="Выйти"
                className="flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-control text-ink-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
              >
                <LogOut size={16} strokeWidth={1.7} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <Button tone="secondary" size="sm" onClick={() => navigate('/login')}>
                Войти
              </Button>
              <Button size="sm" onClick={() => navigate('/register')} className="hidden sm:inline-flex">
                Регистрация
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={open}
            className="flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-control text-ink-soft transition-colors duration-150 hover:bg-surface-sunken md:hidden"
          >
            {open ? <X size={18} strokeWidth={1.8} /> : <Menu size={18} strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          aria-label="Мобильная навигация"
          className="flex flex-col gap-1 border-t border-line bg-surface px-5 py-3 md:hidden"
        >
          <NavLinks current={current} onNavigate={() => setOpen(false)} />
          {isClient && (
            <a
              href={toHref('/projects/new')}
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold text-brand"
            >
              <Plus size={15} strokeWidth={2} aria-hidden="true" />
              Разместить задачу
            </a>
          )}
          {user && (
            <a
              href={toHref('/me')}
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium text-ink-soft"
            >
              Личный кабинет
            </a>
          )}
        </nav>
      )}
    </header>
  );
}
