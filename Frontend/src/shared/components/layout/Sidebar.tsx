import { NavLink } from 'react-router-dom';
import { type LucideIcon } from 'lucide-react';
import { setSidebarOpen } from '@/shared/store/slices/uiSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { cn } from '@/shared/lib/utils/cn';

export interface SidebarItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

interface SidebarProps {
  items: SidebarItem[];
}

function NavItems({ items, onNavigate }: { items: SidebarItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map(({ label, icon: Icon, path }) => (
        <NavLink
          key={path}
          to={path}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-button px-3 py-2 font-cairo text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary',
            )
          }
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar({ items }: SidebarProps) {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const direction = useAppSelector((state) => state.ui.direction);
  const close = () => dispatch(setSidebarOpen(false));

  return (
    <>
      {/* Desktop: static side panel on the leading (start) edge. */}
      <aside className="hidden w-[260px] shrink-0 border-e border-border bg-surface md:block">
        <NavItems items={items} />
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
          'fixed inset-y-0 start-0 z-50 w-[260px] border-e border-border bg-surface shadow-lg transition-transform duration-300 md:hidden',
          sidebarOpen
            ? 'translate-x-0'
            : direction === 'rtl'
              ? 'translate-x-full'
              : '-translate-x-full',
        )}
      >
        <NavItems items={items} onNavigate={close} />
      </aside>
    </>
  );
}
