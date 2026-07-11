import { useState, useRef, useCallback } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LogOut, GraduationCap, LayoutDashboard, Building2, Ticket,
  Users, ClipboardCheck, CreditCard, Wallet, TrendingUp, Receipt,
  ScrollText, Banknote,
} from 'lucide-react';
import { AppHeader } from './AppHeader';
import { useDirection } from '@/shared/hooks/useDirection';
import { useAppDispatch } from '@/shared/store/hooks';
import { logoutUser } from '@/features/auth/store/authSlice';
import { cn } from '@/shared/lib/utils/cn';

const COLLAPSED_WIDTH = 64;

export function AdminPlansLayout() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const direction = useDirection();
  const [expanded, setExpanded] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  const items = [
    { label: t('nav.dashboard'), icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: t('nav.users'), icon: Users, path: '/admin/users' },
    { label: t('nav.teachers'), icon: GraduationCap, path: '/admin/teachers' },
    { label: t('nav.students'), icon: Users, path: '/admin/students' },
    { label: t('nav.teacherRequests'), icon: ClipboardCheck, path: '/admin/teacher-requests' },
    { label: t('nav.tenants'), icon: Building2, path: '/admin/tenants' },
    { label: t('nav.promoCodes'), icon: Ticket, path: '/admin/promo-codes' },
    { label: t('nav.plans'), icon: CreditCard, path: '/admin/plans' },
    { label: t('nav.subscriptions'), icon: Wallet, path: '/admin/subscriptions' },
    { label: t('nav.teacherWithdrawals'), icon: Banknote, path: '/admin/teacher-withdrawals' },
    { label: t('nav.revenue'), icon: TrendingUp, path: '/admin/revenue' },
    { label: t('nav.payments'), icon: Receipt, path: '/admin/payments' },
    { label: t('nav.auditLogs'), icon: ScrollText, path: '/admin/audit-logs' },
  ];

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setExpanded(false);
      const first = asideRef.current?.querySelector<HTMLAnchorElement | HTMLButtonElement>('a, button');
      first?.focus();
    }
  }, []);

  const shadowStyle = direction === 'rtl'
    ? { boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }
    : { boxShadow: '4px 0 24px rgba(0,0,0,0.12)' };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        ref={asideRef}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => {
          if (asideRef.current && !asideRef.current.contains(document.activeElement)) {
            setExpanded(false);
          }
        }}
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={(e) => {
          if (!asideRef.current?.contains(e.relatedTarget as Node)) {
            setExpanded(false);
          }
        }}
        onKeyDown={handleKeyDown}
        style={expanded ? shadowStyle : undefined}
        className={cn(
          'fixed inset-y-0 start-0 z-40 hidden flex-col bg-navy-900 transition-all duration-200 ease-in-out md:flex',
          expanded ? 'w-[260px]' : 'w-[64px]',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-white/10',
            expanded ? 'px-4' : 'justify-center',
          )}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-cairo text-xl font-bold text-cyan-500 transition-opacity hover:opacity-80"
          >
            <GraduationCap size={24} className="shrink-0 text-cyan-500" />
            {expanded && <span>{t('appName')}</span>}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 scrollbar-hide">
          {items.map(({ label, icon: Icon, path }) => (
            <NavLink
              key={path}
              to={path}
              tabIndex={0}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-btn py-2 font-cairo text-sm font-medium transition-colors',
                  expanded ? 'gap-3 px-3' : 'justify-center gap-0 px-0',
                  isActive
                    ? 'bg-cyan-500 text-white'
                    : 'text-navy-100 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <Icon size={20} className="shrink-0" />
              {expanded && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => dispatch(logoutUser())}
            className={cn(
              'flex w-full items-center rounded-btn py-2 font-cairo text-sm font-medium transition-colors text-navy-100 hover:bg-white/10 hover:text-white',
              expanded ? 'gap-3 px-3' : 'justify-center gap-0 px-0',
            )}
          >
            <LogOut size={20} className="shrink-0" />
            {expanded && <span className="whitespace-nowrap">{t('actions.logout')}</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden" style={{ paddingInlineStart: `${COLLAPSED_WIDTH}px` }}>
        <header className="shrink-0">
          <AppHeader />
        </header>
        <main className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
