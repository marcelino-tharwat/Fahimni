export type EssayGradingStatus = 'PENDING' | 'PARTIALLY_GRADED' | 'GRADED';

export interface EssayGradingListMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface EssayGradingHubItem {
  quizId: string;
  quizTitle: string;
  chapterTitle: string;
  essayQuestionCount: number;
  studentSubmissionCount: number;
  pendingCount: number;
  partiallyGradedCount: number;
  gradedCount: number;
}

export interface EssayGradingHubResponse {
  data: EssayGradingHubItem[];
  meta: EssayGradingListMeta;
}

export interface EssaySubmissionRow {
  attemptId: string;
  studentId: string;
  studentName: string;
  essayQuestionCount: number;
  gradedEssayQuestionCount: number;
  status: EssayGradingStatus;
  earnedEssayScore: number | null;
  maximumEssayScore: number;
  submittedAt: string | null;
}

export interface EssaySubmissionsResponse {
  data: {
    quiz: { id: string; title: string; chapterTitle: string };
    summary: {
      totalStudents: number;
      pendingCount: number;
      partiallyGradedCount: number;
      gradedCount: number;
    };
    submissions: EssaySubmissionRow[];
  };
  meta: EssayGradingListMeta;
}

export type EssayReviewStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_REVIEW'
  | 'AI_SUGGESTED'
  | 'APPROVED';

export interface EssayAnswerDetail {
  questionId: string;
  order: number;
  questionText: string;
  studentAnswer: string;
  maximumPoints: number;
  awardedPoints: number | null;
  feedback: string | null;
  gradingStatus: EssayGradingStatus;
  // Additive AI-review metadata (advisory; teacher approval is authoritative).
  reviewStatus?: EssayReviewStatus;
  aiSuggestedScore?: number | null;
  aiSuggestedFeedback?: string | null;
  aiSuggestedAt?: string | null;
}

export interface EssaySuggestionEntry {
  questionId: string;
  status: 'AI_SUGGESTED' | 'AI_UNAVAILABLE' | 'ALREADY_GRADED';
  suggestedScore: number | null;
  feedback: string | null;
}

export interface EssaySuggestionsResponse {
  attemptId: string;
  aiAvailable: boolean;
  suggestions: EssaySuggestionEntry[];
}

export interface EssayGradingDetail {
  quiz: { id: string; title: string; chapterTitle: string };
  student: { id: string; displayName: string };
  attempt: {
    id: string;
    status: string;
    gradingStatus: EssayGradingStatus;
    submittedAt: string | null;
    earnedScore: number | null;
    maximumScore: number;
  };
  essayAnswers: EssayAnswerDetail[];
}

export interface GradeEssayInput {
  questionId: string;
  awardedPoints: number;
  feedback?: string;
}

export interface GradeEssaysPayload {
  grades: GradeEssayInput[];
}
