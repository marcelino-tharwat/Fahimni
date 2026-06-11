import { Menu, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logout } from '@/features/auth/store/authSlice';
import { toggleSidebar } from '@/shared/store/slices/uiSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { Avatar, Button } from '@/shared/components/ui';
import { LanguageSwitcher } from '@/shared/components/common/LanguageSwitcher';

interface TopbarProps {
  /** Show the mobile hamburger that toggles the sidebar. Off for layouts without a sidebar. */
  showMenu?: boolean;
}

export function Topbar({ showMenu = true }: TopbarProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        {showMenu && (
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            aria-label={t('nav.dashboard')}
            className="rounded-button p-2 text-text-primary transition-colors hover:bg-gray-100 md:hidden"
          >
            <Menu size={22} />
          </button>
        )}
        <span className="font-cairo text-lg font-bold text-primary">{t('appName')}</span>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        {user && <Avatar name={user.name} src={user.avatarUrl} size="sm" />}
        <Button variant="ghost" size="sm" onClick={() => dispatch(logout())} aria-label={t('actions.logout')}>
          <LogOut size={18} />
          <span className="hidden sm:inline">{t('actions.logout')}</span>
        </Button>
      </div>
    </header>
  );
}
