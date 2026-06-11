export type QuizStatus = 'draft' | 'published' | 'archived';
export type QuestionType = 'mcq' | 'true_false' | 'essay';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: number | boolean;
  explanation?: string;
  modelAnswer?: string;
}

export interface Quiz {
  id: string;
  tenantId: string;
  chapterId: string;
  title: string;
  status: QuizStatus;
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
