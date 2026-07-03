import type { QuizContentScope } from "../../generated/prisma/client.js";
import type { AttemptState } from "./attempts.service.js";
import type { QuizDisplayStatus } from "./quiz-attempt-display.js";

export interface StudentQuizVisibilityDTO {
  id: string;
  title: string;
  description: string | null;
  chapterId: string;
  status: "PUBLISHED";
  contentScope: QuizContentScope;
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
