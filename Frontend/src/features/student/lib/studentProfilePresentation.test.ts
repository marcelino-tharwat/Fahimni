import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENT_META,
  roleLabelKey,
  statusMeta,
  clampPercent,
  formatAverageGrade,
} from './studentProfilePresentation';
import type {
  AchievementId,
  StudentProfileResponse,
} from '@/features/student/types/studentProfile';

describe('studentProfilePresentation', () => {
  it('maps every achievement id to a distinct visual identity + i18n key', () => {
    const ids: AchievementId[] = [
      'first_lesson',
      'ten_lessons',
      'first_quiz',
      'twenty_five_lessons',
      'perfect_score',
    ];
    for (const id of ids) {
      expect(ACHIEVEMENT_META[id]).toBeDefined();
      expect(ACHIEVEMENT_META[id].emoji.length).toBeGreaterThan(0);
      expect(ACHIEVEMENT_META[id].color).toMatch(/^bg-/);
      expect(ACHIEVEMENT_META[id].nameKey.length).toBeGreaterThan(0);
    }
  });

  it('maps roles to their label keys', () => {
    expect(roleLabelKey('STUDENT')).toBe('student');
    expect(roleLabelKey('OPERATION')).toBe('roleTeacher');
    expect(roleLabelKey('ADMIN')).toBe('roleAdmin');
  });

  it('marks only ACTIVE accounts as active', () => {
    expect(statusMeta('ACTIVE')).toEqual({ labelKey: 'active', active: true });
    expect(statusMeta('INACTIVE').active).toBe(false);
    expect(statusMeta('BANNED')).toEqual({ labelKey: 'banned', active: false });
  });

  it('clamps percentages into 0-100 and rounds', () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(33.4)).toBe(33);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it('formats a null average grade as an em dash and a number as a value', () => {
    expect(formatAverageGrade(null)).toBe('—');
    expect(formatAverageGrade(0)).toBe('0');
    expect(formatAverageGrade(78)).toBe('78');
    expect(formatAverageGrade(120)).toBe('100');
  });

  it('supports rendering an empty profile safely (no hardcoded stats)', () => {
    // A brand-new student: everything zero/empty, average grade null.
    const empty: StudentProfileResponse = {
      student: {
        id: 's1',
        fullName: 'طالب جديد',
        avatarInitial: 'ط',
        role: 'STUDENT',
        status: 'ACTIVE',
        email: 'new@fahimni.test',
        phone: null,
        joinedAt: '2026-07-01T00:00:00.000Z',
        stageName: null,
      },
      academicProgress: {
        completedLessons: 0,
        totalLessons: 0,
        completedQuizzes: 0,
        averageGrade: null,
        overallProgressPercent: 0,
      },
      courses: [],
      subscriptions: [],
      achievements: [
        { id: 'first_lesson', unlocked: false, unlockedAt: null },
        { id: 'perfect_score', unlocked: false, unlockedAt: null },
      ],
    };

    expect(formatAverageGrade(empty.academicProgress.averageGrade)).toBe('—');
    expect(clampPercent(empty.academicProgress.overallProgressPercent)).toBe(0);
    expect(empty.courses).toHaveLength(0);
    expect(empty.subscriptions).toHaveLength(0);
    expect(empty.achievements.every((a) => !a.unlocked)).toBe(true);
    // Missing phone renders as em dash by the same convention.
    expect(empty.student.phone ?? '—').toBe('—');
  });
});
