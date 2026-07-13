import { AppError } from "../../shared/utils/AppError.js";
import {
  DIFFICULTIES,
  type Difficulty,
  type DifficultyDistribution,
} from "./dto/generate-quiz.dto.js";

export type QuizDifficultyMode = "SINGLE" | "MIXED";

export interface ResolvedSingleDifficulty {
  difficultyMode: "SINGLE";
  difficulty: Difficulty;
  questionCounts: Record<Difficulty, number>;
}

export interface ResolvedMixedDifficulty {
  difficultyMode: "MIXED";
  difficultyDistribution: DifficultyDistribution;
  questionCounts: Record<Difficulty, number>;
}

export type ResolvedQuizDifficulty = ResolvedSingleDifficulty | ResolvedMixedDifficulty;

const LEVEL_ORDER: Difficulty[] = [...DIFFICULTIES];

function isFinitePercent(value: number): boolean {
  return Number.isFinite(value) && !Number.isNaN(value);
}

/** Validate mixed percentages sum to exactly 100 with supported levels only. */
export function validateDifficultyDistribution(
  distribution: DifficultyDistribution,
): void {
  for (const level of LEVEL_ORDER) {
    const value = distribution[level];
    if (!isFinitePercent(value)) {
      throw new AppError(
        "Invalid difficulty percentage",
        422,
        "QUIZ_DIFFICULTY_DISTRIBUTION_INVALID",
      );
    }
    if (value < 0 || value > 100) {
      throw new AppError(
        "Difficulty percentages must be between 0 and 100",
        422,
        "QUIZ_DIFFICULTY_DISTRIBUTION_INVALID",
      );
    }
  }

  const total = LEVEL_ORDER.reduce((sum, level) => sum + distribution[level], 0);
  if (total !== 100) {
    throw new AppError(
      "Difficulty percentages must total 100",
      422,
      "QUIZ_DIFFICULTY_TOTAL_INVALID",
    );
  }
}

/**
 * Largest-remainder allocation: exact integer counts summing to questionCount.
 * Tie-break by enum order (easy → medium → hard).
 */
export function allocateQuestionCounts(
  distribution: DifficultyDistribution,
  questionCount: number,
): Record<Difficulty, number> {
  const rows = LEVEL_ORDER.map((level) => {
    const exact = (distribution[level] / 100) * questionCount;
    const floor = Math.floor(exact);
    return { level, floor, remainder: exact - floor };
  });

  const counts = Object.fromEntries(
    LEVEL_ORDER.map((level) => [level, 0]),
  ) as Record<Difficulty, number>;

  let allocated = 0;
  for (const row of rows) {
    counts[row.level] = row.floor;
    allocated += row.floor;
  }

  let remaining = questionCount - allocated;
  const byRemainder = [...rows].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
  });

  let idx = 0;
  while (remaining > 0) {
    const row = byRemainder[idx % byRemainder.length]!;
    counts[row.level] += 1;
    remaining -= 1;
    idx += 1;
  }

  return counts;
}

/**
 * The single difficulty level persisted on `Quiz.difficulty`. SINGLE mode
 * carries the teacher's own chosen level; MIXED mode has no single choice, so
 * the plurality level (most questions allocated) is used, tie-broken by enum
 * order (easy → medium → hard) — same tie-break convention as
 * `allocateQuestionCounts`.
 */
export function pickQuizLevelDifficulty(resolved: ResolvedQuizDifficulty): Difficulty {
  if (resolved.difficultyMode === "SINGLE") {
    return resolved.difficulty;
  }

  let best: Difficulty = LEVEL_ORDER[0]!;
  let bestCount = -1;
  for (const level of LEVEL_ORDER) {
    const count = resolved.questionCounts[level];
    if (count > bestCount) {
      best = level;
      bestCount = count;
    }
  }
  return best;
}

export function resolveQuizDifficulty(
  input: {
    difficultyMode: QuizDifficultyMode;
    difficulty?: Difficulty;
    difficultyDistribution?: DifficultyDistribution;
    questionCount: number;
  },
): ResolvedQuizDifficulty {
  if (input.difficultyMode === "SINGLE") {
    if (!input.difficulty) {
      throw new AppError(
        "Difficulty is required in single mode",
        422,
        "QUIZ_DIFFICULTY_REQUIRED",
      );
    }
    if (input.difficultyDistribution) {
      throw new AppError(
        "difficultyDistribution is not allowed in single mode",
        422,
        "QUIZ_DIFFICULTY_MODE_INVALID",
      );
    }

    const questionCounts = Object.fromEntries(
      LEVEL_ORDER.map((level) => [level, 0]),
    ) as Record<Difficulty, number>;
    questionCounts[input.difficulty] = input.questionCount;

    return {
      difficultyMode: "SINGLE",
      difficulty: input.difficulty,
      questionCounts,
    };
  }

  if (!input.difficultyDistribution) {
    throw new AppError(
      "Difficulty distribution is required in mixed mode",
      422,
      "QUIZ_DIFFICULTY_DISTRIBUTION_REQUIRED",
    );
  }
  if (input.difficulty) {
    throw new AppError(
      "difficulty is not allowed in mixed mode",
      422,
      "QUIZ_DIFFICULTY_MODE_INVALID",
    );
  }

  validateDifficultyDistribution(input.difficultyDistribution);
  const questionCounts = allocateQuestionCounts(
    input.difficultyDistribution,
    input.questionCount,
  );

  return {
    difficultyMode: "MIXED",
    difficultyDistribution: input.difficultyDistribution,
    questionCounts,
  };
}
