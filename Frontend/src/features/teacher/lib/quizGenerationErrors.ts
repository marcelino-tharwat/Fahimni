import type { TFunction } from 'i18next';
import type { ApiError } from '@/shared/lib/api/client';

export interface QuizGenerationErrorDisplay {
  title: string;
  details?: string;
  suggestion?: string;
}

const REASON_I18N_KEY: Record<string, string> = {
  GENERATION_TIMEOUT: 'generationErrorTimeout',
  CONTENT_NOT_INDEXED: 'generationErrorNotIndexed',
  INVALID_AI_OUTPUT: 'generationErrorInvalidOutput',
  SAFETY_BLOCKED: 'generationErrorSafety',
  PERSISTENCE_FAILED: 'generationErrorPersistence',
  DATABASE_SCHEMA_OUT_OF_DATE: 'generationErrorSchema',
  DATABASE_ERROR: 'generationErrorGeneric',
  GENERATION_FAILED: 'generationErrorGeneric',
};

function isUnsafeTechnicalMessage(message: string): boolean {
  return (
    message.includes('Invalid `') ||
    message.includes('invocation in') ||
    message.includes('PrismaClient') ||
    message.includes('P2022') ||
    message.includes('content_scope')
  );
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string'
  );
}

/** Resolve teacher-visible copy for quiz generation failures. */
export function resolveQuizGenerationError(
  error: unknown,
  t: TFunction,
  language: string,
): QuizGenerationErrorDisplay {
  if (!isApiError(error)) {
    return {
      title: t('teacher:quizGenerator.generationFailed'),
      suggestion: t('teacher:quizGenerator.generationFailedHint'),
    };
  }

  if (isUnsafeTechnicalMessage(error.message)) {
    const reason = error.reason ?? 'GENERATION_FAILED';
    const i18nKey = REASON_I18N_KEY[reason] ?? 'generationErrorGeneric';
    if (language.startsWith('en')) {
      return {
        title: t(`teacher:quizGenerator.${i18nKey}Title`),
        details: t(`teacher:quizGenerator.${i18nKey}Details`),
        suggestion: t(`teacher:quizGenerator.${i18nKey}Suggestion`),
      };
    }
    return {
      title: t(`teacher:quizGenerator.${i18nKey}Title`),
      details: error.details ?? t(`teacher:quizGenerator.${i18nKey}Details`),
      suggestion: error.suggestion ?? t(`teacher:quizGenerator.${i18nKey}Suggestion`),
    };
  }

  const reason = error.reason;
  const i18nKey = reason ? REASON_I18N_KEY[reason] : undefined;

  if (language.startsWith('en') && i18nKey) {
    return {
      title: t(`teacher:quizGenerator.${i18nKey}Title`),
      details: t(`teacher:quizGenerator.${i18nKey}Details`),
      suggestion: t(`teacher:quizGenerator.${i18nKey}Suggestion`),
    };
  }

  return {
    title: error.message || t('teacher:quizGenerator.generationFailed'),
    details: error.details,
    suggestion: error.suggestion || t('teacher:quizGenerator.generationFailedHint'),
  };
}
