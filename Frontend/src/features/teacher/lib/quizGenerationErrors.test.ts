import { describe, it, expect, vi } from 'vitest';
import { resolveQuizGenerationError } from './quizGenerationErrors';
import type { ApiError } from '@/shared/lib/api/client';

const t = vi.fn((key: string) => key);

describe('resolveQuizGenerationError', () => {
  it('maps reason to i18n keys when language is en', () => {
    const error: ApiError = {
      statusCode: 422,
      message: 'انتهت مهلة إنشاء الاختبار قبل اكتماله.',
      reason: 'GENERATION_TIMEOUT',
      details: 'انتهت مهلة استدعاء خدمة الذكاء الاصطناعي.',
      suggestion: 'حاول مرة أخرى بعدد أسئلة أقل أو بأنواع أسئلة أبسط.',
    };

    resolveQuizGenerationError(error, t, 'en');
    expect(t).toHaveBeenCalledWith('teacher:quizGenerator.generationErrorTimeoutTitle');
    expect(t).toHaveBeenCalledWith('teacher:quizGenerator.generationErrorTimeoutDetails');
    expect(t).toHaveBeenCalledWith('teacher:quizGenerator.generationErrorTimeoutSuggestion');
  });

  it('uses API Arabic fields when language is ar', () => {
    const error: ApiError = {
      statusCode: 422,
      message: 'انتهت مهلة إنشاء الاختبار قبل اكتماله.',
      reason: 'GENERATION_TIMEOUT',
      details: 'انتهت مهلة استدعاء خدمة الذكاء الاصطناعي.',
      suggestion: 'حاول مرة أخرى بعدد أسئلة أقل أو بأنواع أسئلة أبسط.',
    };

    const display = resolveQuizGenerationError(error, t, 'ar');
    expect(display.title).toBe(error.message);
    expect(display.details).toBe(error.details);
    expect(display.suggestion).toBe(error.suggestion);
  });

  it('hides raw Prisma messages from teachers', () => {
    const error: ApiError = {
      statusCode: 500,
      message: 'Invalid `tx.quiz.create()` invocation\nThe column `content_scope` does not exist',
      reason: 'DATABASE_SCHEMA_OUT_OF_DATE',
      details: 'schema update needed',
      suggestion: 'contact admin',
    };

    const display = resolveQuizGenerationError(error, t, 'ar');
    expect(display.title).toBe('teacher:quizGenerator.generationErrorSchemaTitle');
    expect(display.title).not.toContain('Invalid `');
  });
});
