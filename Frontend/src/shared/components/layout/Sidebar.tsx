import { NavLink, Link } from 'react-router-dom';
import { LogOut, GraduationCap, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setSidebarOpen } from '@/shared/store/slices/uiSlice';
import { logoutUser } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { useDirection } from '@/shared/hooks/useDirection';
import { cn } from '@/shared/lib/utils/cn';

export interface SidebarItem {
  label: string;
  icon: LucideIcon;
  path: string;
  end?: boolean;
}

interface SidebarProps {
  items: SidebarItem[];
}

const navItemBase =
  'flex items-center gap-3 rounded-btn px-3 py-2 font-cairo text-sm font-medium transition-colors';

function SidebarContent({ items, onNavigate }: { items: SidebarItem[]; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const handleLogout = () => {
    onNavigate?.();
    dispatch(logoutUser());
  };

  return (
    <div className="flex h-full flex-col">
      {/* Brand logo, top of the navy column. */}
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-4">
        <Link
          to="/"
          onClick={onNavigate}
          className="inline-flex items-center gap-2 font-cairo text-xl font-bold text-cyan-500 transition-opacity hover:opacity-80"
        >
          <GraduationCap size={24} />
          {t('appName')}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map(({ label, icon: Icon, path, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                navItemBase,
                isActive
                  ? 'bg-cyan-500 text-white'
                  : 'text-navy-100 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Log Out, visually separated at the bottom of the sidebar. */}
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className={cn(navItemBase, 'w-full text-navy-100 hover:bg-white/10 hover:text-white')}
        >
          <LogOut size={20} />
          <span>{t('actions.logout')}</span>
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ items }: SidebarProps) {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const direction = useDirection();
  const close = () => dispatch(setSidebarOpen(false));

  return (
    <>
      {/* Desktop: static side panel on the leading (start) edge. */}
      <aside className="hidden w-[260px] shrink-0 bg-navy-900 md:block">
        <SidebarContent items={items} />
      </aside>

      {/* Mobile: overlay + drawer that slides from the start edge
          (right in RTL, left in LTR). */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={close}
          role="presentation"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 w-[260px] bg-navy-900 shadow-lg transition-transform duration-300 md:hidden',
          sidebarOpen
            ? 'translate-x-0'
            : direction === 'rtl'
              ? 'translate-x-full'
              : '-translate-x-full',
        )}
      >
        <SidebarContent items={items} onNavigate={close} />
      </aside>
    </>
  );
}
