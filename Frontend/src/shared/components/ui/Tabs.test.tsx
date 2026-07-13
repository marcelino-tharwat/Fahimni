// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Tabs } from './Tabs';

// Regression coverage: this shared primitive previously had no overflow
// affordance at all (`flex gap-2`) — any consumer with more than a handful
// of tabs (e.g. AdminDashboardPage's 5-tab bar) would force horizontal page
// overflow on mobile with no way to reach the hidden tabs.

const tabs = [
  { key: 'a', label: 'Tab A' },
  { key: 'b', label: 'Tab B' },
  { key: 'c', label: 'Tab C' },
];

afterEach(() => cleanup());

describe('Tabs — horizontal overflow safety', () => {
  it('1. the tablist wraps overflow in a scrollable, non-wrapping row', () => {
    render(<Tabs tabs={tabs} activeTab="a" onTabChange={vi.fn()} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist.className).toMatch(/overflow-x-auto/);
    expect(tablist.className).toMatch(/flex-nowrap/);
  });

  it('2. every tab stays a fixed, non-shrinking width so scrolling (not squeezing) is the overflow strategy', () => {
    render(<Tabs tabs={tabs} activeTab="a" onTabChange={vi.fn()} />);
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toMatch(/shrink-0/);
    }
  });
});
