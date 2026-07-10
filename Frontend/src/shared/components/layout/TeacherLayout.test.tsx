// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TeacherLayout } from './TeacherLayout';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ar' },
  }),
}));

vi.mock('@/shared/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: () => false,
}));

vi.mock('@/features/teacher/components/TeacherPlanBadge', () => ({
  TeacherPlanBadge: () => null,
}));

// AppHeader fetches the teacher profile via react-query; irrelevant to the
// sidebar-link assertions here, and this test renders no QueryClientProvider.
vi.mock('./AppHeader', () => ({
  AppHeader: () => null,
}));

afterEach(() => cleanup());

function renderLayout() {
  return render(
    <MemoryRouter>
      <TeacherLayout />
    </MemoryRouter>,
  );
}

describe('TeacherLayout — sidebar', () => {
  it('6. renders a wallet/balance link pointing to /teacher/wallet', () => {
    renderLayout();
    // Sidebar renders both a desktop and a mobile-drawer copy of the nav.
    const links = screen.getAllByRole('link', { name: 'nav.wallet' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/teacher/wallet');
    }
  });

  it('keeps the existing profile link alongside the new wallet link', () => {
    renderLayout();
    const links = screen.getAllByRole('link', { name: 'nav.profile' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/teacher/profile');
    }
  });
});
