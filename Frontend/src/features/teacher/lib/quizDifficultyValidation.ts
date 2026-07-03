import type { TFunction } from 'i18next';
import type {
  DifficultyLevel,
  QuizGeneratorFormState,
} from '@/features/teacher/types/quizGeneration';

export type DifficultyDistribution = {
  easy: number;
  medium: number;
  hard: number;
};

export function getMixedDifficultyTotal(distribution: DifficultyDistribution): number {
  return distribution.easy + distribution.medium + distribution.hard;
}

export function isMixedDistributionValid(distribution: DifficultyDistribution): boolean {
  for (const value of Object.values(distribution)) {
    if (!Number.isFinite(value) || Number.isNaN(value) || value < 0 || value > 100) {
      return false;
    }
  }
  return getMixedDifficultyTotal(distribution) === 100;
}

export function validateQuizGeneratorDifficulty(
  form: Pick<QuizGeneratorFormState, 'difficultyMode' | 'difficulty' | 'mixedDifficulty'>,
  t: TFunction,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (form.difficultyMode === 'uniform') {
    if (!form.difficulty) {
      errors.difficulty = t('teacher:quizGenerator.validationDifficulty');
    }
    return errors;
  }

  if (!isMixedDistributionValid(form.mixedDifficulty)) {
    const total = getMixedDifficultyTotal(form.mixedDifficulty);
    const hasInvalidValue = Object.values(form.mixedDifficulty).some(
      (value) => !Number.isFinite(value) || Number.isNaN(value) || value < 0 || value > 100,
    );
    errors.mixedDifficulty = hasInvalidValue
      ? t('teacher:quizGenerator.validationDifficultyDistributionInvalid')
      : t('teacher:quizGenerator.difficultyMixedTotalError', { total });
  }

  return errors;
}

export function mapFormDifficultyMode(
  mode: QuizGeneratorFormState['difficultyMode'],
): 'SINGLE' | 'MIXED' {
  return mode === 'uniform' ? 'SINGLE' : 'MIXED';
}

export function clearDifficultyOnModeChange(
  mode: QuizGeneratorFormState['difficultyMode'],
  currentDifficulty: DifficultyLevel,
): DifficultyLevel {
  return mode === 'mixed' ? '' : currentDifficulty;
}
