import type { QuizContentScope } from "../../generated/prisma/client.js";
import type { AttemptState } from "./attempts.service.js";
import type { QuizDisplayStatus } from "./quiz-attempt-display.js";
import type { QuizSourceScope, QuizSourceRefDTO } from "./quiz-scope.js";

export interface StudentQuizVisibilityDTO {
  id: string;
  title: string;
  description: string | null;
  chapterId: string;
  status: "PUBLISHED";
  contentScope: QuizContentScope;
  // Student-safe source provenance. `chapters` is populated only for
  // MULTI_CHAPTER (filtered to what the student can access); `stage` only for
  // FULL_CURRICULUM. The raw sourceChapterIds array is never exposed here.
  sourceScope: QuizSourceScope;
  sourceChapters?: QuizSourceRefDTO[];
  sourceStage?: QuizSourceRefDTO;
  linkedLessonIds: string[];
  isRequiredForProgression: boolean;
  requiredForLessonId: string | null;
  questionCount: number;
  totalPoints: number;
  durationMinutes: number | null;
  passingScore: number | null;
  studentAttemptStatus: AttemptState;
  attemptId: string | null;
  displayStatus: QuizDisplayStatus;
  score?: number;
  retakeAllowed?: boolean;
}

export interface LessonQuizzesSectionDTO {
  /** Lesson-linked optional quizzes (SELECTED_LESSONS placement). */
  available: StudentQuizVisibilityDTO[];
  /** Progression gate quiz for this lesson, when configured and visible. */
  required: StudentQuizVisibilityDTO | null;
}
