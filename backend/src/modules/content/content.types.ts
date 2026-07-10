export interface StageNode {
  id: string;
  name: string;
  sortOrder: number;
  chapterCount: number;
}

export interface ChapterNode {
  id: string;
  name: string;
  sortOrder: number;
  lessonCount: number;
  imageUrl: string | null;
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
  stageId: string;
  stageName: string;
  lessonCount: number;
  completionProgress: number;
}
