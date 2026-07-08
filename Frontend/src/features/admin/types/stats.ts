export interface AdminUserStats {
  totalTeachers: number;
  activeTeachers: number;
  totalStudents: number;
  activeStudents: number;
  studentsWithoutTeacher: number;
  studentsWithoutAnyEnrollment: number;
}

export interface AdminContentStats {
  totalStages: number;
  totalChapters: number;
  totalLessons: number;
  totalMaterials: number;
  totalQuizzes: number;
  publishedQuizzes: number;
  draftQuizzes: number;
}

export interface AdminLearningStats {
  totalEnrollments: number;
  activeEnrollments: number;
  pendingEnrollments: number;
  quizAttempts: number;
  averageQuizScore: number;
}

export interface AdminFinanceStats {
  confirmedCourseRevenue: number;
  confirmedTeacherSubscriptionRevenue: number;
  totalConfirmedRevenue: number;
  monthlyConfirmedRevenue: number;
  estimatedSubscriptionRevenue: number;
  currency: string;
  reliabilityWarnings: string[];
}

export interface AdminOperationsStats {
  pendingTeacherRequests: number;
  activeTeacherSubscriptions: number;
  pendingTeacherSubscriptionRequests: number;
  pendingTeacherSubscriptionPayments: number;
  failedTeacherSubscriptionPayments: number;
}

export interface AdminAiStats {
  quizGenerations: number;
  essayGrading: number;
  totalAiEvents: number;
}

export interface TopTeacherByRevenue {
  teacherId: string;
  fullName: string;
  revenue: number;
}

export interface TopTeacherByStudents {
  teacherId: string;
  fullName: string;
  studentCount: number;
}

export interface AdminStats {
  users: AdminUserStats;
  content: AdminContentStats;
  learning: AdminLearningStats;
  finance: AdminFinanceStats;
  operations: AdminOperationsStats;
  ai: AdminAiStats;
  topTeachers: {
    byRevenue: TopTeacherByRevenue[];
    byStudents: TopTeacherByStudents[];
  };
}
