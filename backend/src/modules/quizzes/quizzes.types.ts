export interface SubmitAnswerInput {
  questionId: string;
  submittedAnswer: string | null;
}

export interface SubmitAttemptInput {
  quizId: string;
  studentId: string;
  answers: SubmitAnswerInput[];
}

export interface QuestionResult {
  questionId: string;
  type: 'mcq' | 'true_false' | 'essay';
  submittedAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean | null;
  points: number;
}

export interface AttemptResult {
  attemptId: string;
  quizId: string;
  status: 'graded' | 'partial';
  score: number;
  totalPoints: number;
  percentage: number;
  results: QuestionResult[];
}
