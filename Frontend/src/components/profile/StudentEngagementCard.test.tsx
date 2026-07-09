// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StudentEngagementCard } from './StudentEngagementCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => cleanup());

describe('StudentEngagementCard', () => {
  it('shows the real enrolled total passed in', () => {
    render(<StudentEngagementCard isLoading={false} totalEnrolled={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('hides the trend badge when no trend is provided (no fabricated %)', () => {
    render(<StudentEngagementCard isLoading={false} totalEnrolled={0} />);
    // The trend badge renders a "٪" suffix; it must not appear without data.
    expect(screen.queryByText(/٪/)).not.toBeInTheDocument();
  });

  it('hides the grade distribution when none is provided', () => {
    render(<StudentEngagementCard isLoading={false} totalEnrolled={3} grades={[]} />);
    expect(screen.queryByText('studentEngagement.grades.first')).not.toBeInTheDocument();
  });

  it('renders the trend and grades when they ARE provided', () => {
    render(
      <StudentEngagementCard
        isLoading={false}
        totalEnrolled={10}
        trend={5}
        grades={[{ labelKey: 'studentEngagement.grades.first', count: 4, percentage: 40, barColor: 'bg-cyan-500' }]}
      />,
    );
    expect(screen.getByText(/٪/)).toBeInTheDocument();
    // label appears in both the bar row and the legend.
    expect(screen.getAllByText('studentEngagement.grades.first').length).toBeGreaterThan(0);
  });
});
