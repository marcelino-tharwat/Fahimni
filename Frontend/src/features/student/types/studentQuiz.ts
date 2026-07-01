export type QuizStatus = 'new' | 'passed' | 'failed' | 'pending';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuizItem {
  id: string;
  title: string;
  questionCount: number;
  points: number;
  durationMinutes: number;
  difficulty: Difficulty;
  status: QuizStatus;
  score?: number;
  retakeAllowed?: boolean;
  attemptId?: string | null;
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
