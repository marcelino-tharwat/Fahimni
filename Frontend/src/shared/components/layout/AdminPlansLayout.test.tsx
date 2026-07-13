// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminPlansLayout } from './AdminPlansLayout';

// Regression coverage: this layout previously implemented its own hover-to-
// expand desktop sidebar with NO mobile drawer at all — below md: the <aside>
// was fully absent (`hidden md:flex`) and the header's hamburger button
// dispatched a Redux action nothing here listened to, so mobile users had no
// way to navigate at all. It now reuses the shared Sidebar component (same
// as every other authenticated layout), which does implement a working
// mobile drawer.

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/shared/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ ui: { sidebarOpen: false } }),
}));
vi.mock('@/shared/hooks/useDirection', () => ({ useDirection: () => 'rtl' }));
// AppHeader fetches the teacher profile via react-query; irrelevant here and
// this test renders no QueryClientProvider.
vi.mock('./AppHeader', () => ({ AppHeader: () => null }));

afterEach(() => cleanup());

function renderLayout() {
  return render(
    <MemoryRouter>
      <AdminPlansLayout />
    </MemoryRouter>,
  );
}

describe('AdminPlansLayout — uses the shared Sidebar (has a working mobile drawer)', () => {
  it('1. renders the plans nav link twice (desktop static + mobile drawer copies)', () => {
    renderLayout();
    const links = screen.getAllByRole('link', { name: 'nav.plans' });
    expect(links.length).toBe(2);
  });

  it('2. the mobile-drawer copy exists and is a sibling <aside> to the desktop one (both present in the DOM, unlike the old hidden-below-md bespoke aside)', () => {
    renderLayout();
    const asides = document.querySelectorAll('aside');
    expect(asides.length).toBe(2);
  });
});
