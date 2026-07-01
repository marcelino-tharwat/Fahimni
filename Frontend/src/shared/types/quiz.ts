export type QuestionType = 'mcq' | 'tf' | 'essay' | 'fill';

export interface QuizOption {
  id: 'a' | 'b' | 'c' | 'd';
  label: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  options?: QuizOption[];
  placeholder?: string;
  maxLength?: number;
}

export interface QuizMeta {
  title: string;
  chapterLabel?: string;
  totalQuestions: number;
  totalPoints: number;
  durationMinutes?: number;
  attemptLabel: string;
}

export type PageStatus = 'loading' | 'active' | 'error-403' | 'error-400' | 'error-access';

export interface Quiz {
  id: string;
  tenantId: string;
  chapterId: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  answers: Record<string, string | number | boolean>;
  score?: number;
  submittedAt: string;
}
