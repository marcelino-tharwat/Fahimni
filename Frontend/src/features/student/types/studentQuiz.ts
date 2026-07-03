export type QuizStatus = 'new' | 'passed' | 'failed' | 'pending';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuizAttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'GRADED' | 'NOT_STARTED';

/** Mirrors backend StudentQuizVisibilityDTO (lesson/chapter quiz surfaces). */
export interface StudentQuizVisibility {
  id: string;
  title: string;
  description: string | null;
  chapterId: string;
  contentScope: 'CHAPTER' | 'SELECTED_LESSONS';
  linkedLessonIds: string[];
  isRequiredForProgression: boolean;
  requiredForLessonId: string | null;
  questionCount: number;
  totalPoints: number;
  durationMinutes: number | null;
  displayStatus: QuizStatus;
  attemptId: string | null;
  studentAttemptStatus: QuizAttemptStatus;
  score?: number;
  retakeAllowed?: boolean;
}

export interface LessonQuizzesSection {
  available: StudentQuizVisibility[];
  required: StudentQuizVisibility | null;
}

export interface QuizItem {
  id: string;
  title: string;
  questionCount: number;
  points: number;
  durationMinutes: number | null;
  difficulty: Difficulty;
  status: QuizStatus;
  score?: number;
  retakeAllowed?: boolean;
  attemptId?: string | null;
  attemptStatus?: QuizAttemptStatus | null;
}

export interface ChapterGroup {
  id: string;
  title: string;
  stage: string;
  quizzes: QuizItem[];
  defaultOpen: boolean;
}

export interface StudentQuizzesData {
  totalCount: number;
  completedCount: number;
  newCount: number;
  chapters: ChapterGroup[];
}
