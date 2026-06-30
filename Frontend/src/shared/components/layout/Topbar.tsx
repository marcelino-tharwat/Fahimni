import { useEffect, useRef, useState } from 'react';
import { Menu, ChevronDown, Globe, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { logoutUser } from '@/features/auth/store/authSlice';
import { toggleSidebar } from '@/shared/store/slices/uiSlice';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { useTeacherProfile } from '@/features/teacher/hooks/useTeacherProfile';
import { Avatar } from '@/shared/components/ui';

interface TopbarProps {
  /** Show the mobile hamburger that toggles the sidebar. Off for layouts without a sidebar. */
  showMenu?: boolean;
}

/** Route → i18n key for the current-page title. Matched exactly, then by prefix
 *  (so param routes like /admin/tenants/:id resolve to their section title). */
const pageTitleByPath: Record<string, string> = {
  '/teacher/dashboard': 'nav.dashboard',
  '/teacher/content': 'nav.contentManagement',
  '/teacher/quizzes/generator': 'nav.quizGenerator',
  '/teacher/students': 'nav.students',
  '/teacher/profile': 'nav.profile',

  '/teacher/branding': 'nav.branding',
  '/student/dashboard': 'nav.dashboard',
  '/student/courses': 'nav.courses',
  '/student/ai-tutor': 'nav.aiTutor',
  '/student/profile': 'nav.profile',
  '/admin/tenants': 'nav.tenants',
  '/admin/promo-codes': 'nav.promoCodes',
  '/support/students': 'nav.studentLookup',
};

export function Topbar({ showMenu = true }: TopbarProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const user = useAppSelector((state) => state.auth.user);

  // Teacher profile photo is the same React Query cache the Settings page writes
  // to, so uploading a new photo there updates this avatar immediately. Gated by
  // role — the /teachers/profile endpoint is teacher-only.
  const { data: teacherProfile } = useTeacherProfile({ enabled: user?.role === 'OPERATION' });
  const avatarUrl = teacherProfile?.photoUrl ?? undefined;

  const titleKey =
    pageTitleByPath[pathname] ??
    Object.entries(pageTitleByPath).find(([path]) => pathname.startsWith(`${path}/`))?.[1];

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
    setMenuOpen(false);
  };
  // Label shows the TARGET language (what clicking switches TO).
  const languageLabel = i18n.language === 'ar' ? 'English' : 'العربية';

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4">
      {/* Leading edge: mobile hamburger + current page title. */}
      <div className="flex items-center gap-3">
        {showMenu && (
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            aria-label={t('nav.dashboard')}
            className="rounded-btn p-2 text-navy-600 transition-colors hover:bg-gray-100 md:hidden"
          >
            <Menu size={22} />
          </button>
        )}
        {titleKey && (
          <h1 className="hidden font-cairo text-lg font-bold text-navy-900 md:block">
            {t(titleKey)}
          </h1>
        )}
      </div>

      {/* Trailing edge: user. */}
      <div className="flex items-center gap-2">
        {/* User profile + dropdown. */}
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-btn p-1 transition-colors hover:bg-gray-100"
            >
              <Avatar name={user.fullName} src={avatarUrl} size="sm" />
              <span className="hidden flex-col text-start leading-tight sm:flex">
                <span className="font-cairo text-sm font-medium text-navy-900">{user.fullName}</span>
                <span className="font-cairo text-xs text-gray-500">
                  {t(`roles.${user.role}`)}
                </span>
              </span>
              <ChevronDown size={16} className="text-gray-500" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute end-0 mt-2 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                {/* Language switch */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={toggleLanguage}
                  className="flex w-full items-center gap-3 px-4 py-2 font-cairo text-sm text-navy-900 transition-colors hover:bg-gray-50"
                >
                  <Globe size={18} className="text-navy-600" />
                  <span>{languageLabel}</span>
                </button>

                <div className="my-1 border-t border-gray-200" />

                {/* Log out */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    dispatch(logoutUser());
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 font-cairo text-sm text-danger-500 transition-colors hover:bg-gray-50"
                >
                  <LogOut size={18} />
                  <span>{t('actions.logout')}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
