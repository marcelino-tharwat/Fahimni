// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TeacherPlansLayout } from './TeacherPlansLayout';

// Regression coverage: same bug/fix as AdminPlansLayout — this layout gates
// /teacher/plans (a payment/checkout page), so a mobile user previously
// having no way to open the nav was especially costly. Now reuses the shared
// Sidebar component with a working mobile drawer.

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/shared/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ ui: { sidebarOpen: false } }),
}));
vi.mock('@/shared/hooks/useDirection', () => ({ useDirection: () => 'rtl' }));
vi.mock('./AppHeader', () => ({ AppHeader: () => null }));

afterEach(() => cleanup());

function renderLayout() {
  return render(
    <MemoryRouter>
      <TeacherPlansLayout />
    </MemoryRouter>,
  );
}

describe('TeacherPlansLayout — uses the shared Sidebar (has a working mobile drawer)', () => {
  it('1. renders the plans nav link twice (desktop static + mobile drawer copies)', () => {
    renderLayout();
    const links = screen.getAllByRole('link', { name: 'nav.plans' });
    expect(links.length).toBe(2);
  });

  it('2. both the desktop and mobile-drawer <aside> elements are present in the DOM', () => {
    renderLayout();
    const asides = document.querySelectorAll('aside');
    expect(asides.length).toBe(2);
  });
});
