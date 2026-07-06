// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeacherPlansUsageMeters } from './TeacherPlansUsageMeters';
import type { UsageSummary } from '@/features/teacher/types/teacherPlans';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => cleanup());

const fullUsage: UsageSummary = {
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-07-31T23:59:59.999Z',
  aiQuizGenerations: { used: 3, limit: 10, remaining: 7 },
  aiEssayGradings: { used: 8, limit: 50, remaining: 42 },
  aiContentGenerations: { used: 0, limit: 5, remaining: 5 },
  students: { used: 25, limit: 200 },
  storageMb: { used: 120, limit: 1024 },
};

const unlimitedUsage: UsageSummary = {
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-07-31T23:59:59.999Z',
  aiQuizGenerations: { used: 50, limit: -1, remaining: -1 },
  aiEssayGradings: { used: 100, limit: -1, remaining: -1 },
  aiContentGenerations: { used: 10, limit: -1, remaining: -1 },
  students: { used: 500, limit: -1 },
  storageMb: { used: 10000, limit: 51200 },
};

const emptyUsage: UsageSummary = {
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-07-31T23:59:59.999Z',
  aiQuizGenerations: { used: 0, limit: 5, remaining: 5 },
  aiEssayGradings: { used: 0, limit: 10, remaining: 10 },
  aiContentGenerations: { used: 0, limit: 0, remaining: 0 },
  students: { used: 0, limit: 50 },
  storageMb: { used: 0, limit: 500 },
};

describe('TeacherPlansUsageMeters', () => {
  it('renders all 5 usage meters when usage data is provided', () => {
    render(<TeacherPlansUsageMeters usage={fullUsage} />);
    expect(screen.getByText('plans.usage.aiQuizGenerations')).toBeInTheDocument();
    expect(screen.getByText('plans.usage.aiEssayGradings')).toBeInTheDocument();
    expect(screen.getByText('plans.usage.aiContentGenerations')).toBeInTheDocument();
    expect(screen.getByText('plans.usage.students')).toBeInTheDocument();
    expect(screen.getByText('plans.usage.storage')).toBeInTheDocument();
  });

  it('displays used/limit numbers for limited resources', () => {
    render(<TeacherPlansUsageMeters usage={fullUsage} />);
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    expect(screen.getByText('8 / 50')).toBeInTheDocument();
    expect(screen.getByText('25 / 200')).toBeInTheDocument();
    expect(screen.getByText('120 / 1024')).toBeInTheDocument();
  });

  it('shows unlimited text for -1 limit', () => {
    render(<TeacherPlansUsageMeters usage={unlimitedUsage} />);
    expect(screen.getByText('plans.usage.aiQuizGenerations')).toBeInTheDocument();
    expect(screen.queryByText('50 / -1')).not.toBeInTheDocument();
  });

  it('renders progress bars for limited resources', () => {
    const { container } = render(<TeacherPlansUsageMeters usage={fullUsage} />);
    const bars = container.querySelectorAll('.h-full.rounded-full');
    expect(bars.length).toBeGreaterThanOrEqual(5);
  });

  it('renders null when usage is null', () => {
    const { container } = render(<TeacherPlansUsageMeters usage={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('handles empty usage (all zeros)', () => {
    render(<TeacherPlansUsageMeters usage={emptyUsage} />);
    expect(screen.getByText('0 / 5')).toBeInTheDocument();
    expect(screen.getByText('0 / 10')).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<TeacherPlansUsageMeters usage={null} isLoading={true} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(5);
  });
});
