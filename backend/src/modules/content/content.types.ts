export interface StageNode {
  id: string;
  name: string;
  displayName?: string;
  sortOrder: number;
  chapterCount: number;
}

export interface ChapterNode {
  id: string;
  name: string;
  sortOrder: number;
  lessonCount: number;
  imageUrl: string | null;
  term: "FIRST_TERM" | "SECOND_TERM";
  isVisible: boolean;
  /** null or <= 0 means the chapter is free (matches enrollment/payment services' convention). */
  price: number | null;
}

export interface LessonNode {
  id: string;
  title: string;
  sortOrder: number;
}

export type LessonLockReason =
  | "ENROLLMENT_REQUIRED"
  | "PREVIOUS_LESSON_NOT_COMPLETED"
  | "REQUIRED_QUIZ_NOT_COMPLETED"
  | "REQUIRED_QUIZ_NOT_PASSED"
  | "REQUIRED_QUIZ_AWAITING_GRADING"
  | "ATTEMPT_LIMIT_REACHED"
  | "LESSON_UNAVAILABLE";

export type LessonAccessStatus = "UNLOCKED" | "LOCKED";
export type LessonProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface StudentLessonNode extends LessonNode {
  accessStatus: LessonAccessStatus;
  isUnlocked: boolean;
  lockReason: LessonLockReason | null;
  progressStatus: LessonProgressStatus;
  requiredQuizId: string | null;
  nextLessonId: string | null;
}

export interface ContentTreeResponse {
  stage: StageNode;
  chapters: {
    chapter: ChapterNode;
    lessons: LessonNode[];
  }[];
}

export type EnrollmentStatus = "free" | "purchased" | "locked";

export interface StudentTeacherNode {
  id: string;
  fullName: string;
  subject: string | null;
}

export interface StudentChapterNode {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  price: number | null;
  imageUrl: string | null;
  term: "FIRST_TERM" | "SECOND_TERM";
  lessonCount: number;
  enrollmentStatus: EnrollmentStatus;
  teacher: StudentTeacherNode;
}

export interface StudentContentTreeResponse {
  stage: StageNode;
  chapters: {
    chapter: StudentChapterNode;
    lessons: StudentLessonNode[];
  }[];
}

export interface MyCourseResponse {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  price: number | null;
  imageUrl: string | null;
  term: "FIRST_TERM" | "SECOND_TERM";
  stageId: string;
  stageName: string;
  lessonCount: number;
  completionProgress: number;
}
