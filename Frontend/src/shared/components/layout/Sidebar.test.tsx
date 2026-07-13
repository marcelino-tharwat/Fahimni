// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { Sidebar } from './Sidebar';

// Regression coverage for the responsive audit: the mobile drawer (used by
// every authenticated layout, including AdminPlansLayout/TeacherPlansLayout
// after they were switched from a broken bespoke hover-sidebar to this shared
// component) must actually open/close via the header's hamburger toggle.

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const dispatchMock = vi.fn();
let sidebarOpen = false;
vi.mock('@/shared/store/hooks', () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ ui: { sidebarOpen } }),
}));
vi.mock('@/shared/hooks/useDirection', () => ({ useDirection: () => 'rtl' }));

const items = [{ label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' }];

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar items={items} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sidebarOpen = false;
});

describe('Sidebar — mobile drawer', () => {
  it('1. renders both a static desktop copy and a mobile-drawer copy of every nav item', () => {
    renderSidebar();
    const links = screen.getAllByRole('link', { name: 'Dashboard' });
    expect(links.length).toBe(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/admin/dashboard');
    }
  });

  it('2. mobile drawer is translated off-screen when sidebarOpen is false', () => {
    sidebarOpen = false;
    renderSidebar();
    const links = screen.getAllByRole('link', { name: 'Dashboard' });
    const mobileDrawerLink = links[1]!;
    const mobileAside = mobileDrawerLink.closest('aside')!;
    expect(mobileAside.className).toMatch(/translate-x-full|-translate-x-full/);
    expect(mobileAside.className).not.toMatch(/translate-x-0/);
  });

  it('3. mobile drawer slides into view when sidebarOpen is true', () => {
    sidebarOpen = true;
    renderSidebar();
    const links = screen.getAllByRole('link', { name: 'Dashboard' });
    const mobileAside = links[1]!.closest('aside')!;
    expect(mobileAside.className).toMatch(/translate-x-0/);
    // A click-away overlay must be present so the drawer can be dismissed.
    expect(document.querySelector('[role="presentation"]')).toBeInTheDocument();
  });

  it('4. clicking a mobile nav link closes the drawer (dispatches setSidebarOpen(false))', () => {
    sidebarOpen = true;
    renderSidebar();
    const links = screen.getAllByRole('link', { name: 'Dashboard' });
    fireEvent.click(links[1]!);
    expect(dispatchMock).toHaveBeenCalled();
  });

  it('5. clicking the backdrop overlay closes the drawer', () => {
    sidebarOpen = true;
    renderSidebar();
    const overlay = document.querySelector('[role="presentation"]')!;
    fireEvent.click(overlay);
    expect(dispatchMock).toHaveBeenCalled();
  });
});
