export const SCALE = {
  ADMINS: 5,
  OPERATIONS: 10,
  TEACHERS: 30,
  STUDENTS: 500,
  STAGES: 3,
  CHAPTERS_PER_STAGE: 10,
  LESSONS_PER_CHAPTER: 5,
  QUIZZES_PER_CHAPTER: 2,
  QUESTIONS_PER_QUIZ: 5,
  ENROLLMENTS_PER_STUDENT: 5,
} as const;

export const BATCH_SIZE = 100;

export const PROGRESS_DISTRIBUTION = [0, 0, 10, 25, 60, 80, 100] as const;
export const PROGRESS_WEIGHTS = [5, 5, 15, 15, 20, 20, 20] as const;

export const RATING_DISTRIBUTION = [3, 4, 5] as const;
export const RATING_WEIGHTS = [10, 30, 60] as const;

export const SHARED_PASSWORD = process.env.SEED_SHARED_PASSWORD ?? "Pass@1234";

export const EMAIL_DOMAIN = "fahimni.com";
export const SEED_NAMESPACE = "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d";
