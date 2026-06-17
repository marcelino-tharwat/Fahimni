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
}

export interface LessonNode {
  id: string;
  title: string;
  sortOrder: number;
}

export interface ContentTreeResponse {
  stage: StageNode;
  chapters: {
    chapter: ChapterNode;
    lessons: LessonNode[];
  }[];
}

export type EnrollmentStatus = "free" | "purchased" | "locked";

export interface StudentChapterNode {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  price: number | null;
  lessonCount: number;
  enrollmentStatus: EnrollmentStatus;
}

export interface StudentContentTreeResponse {
  stage: StageNode;
  chapters: {
    chapter: StudentChapterNode;
    lessons: LessonNode[];
  }[];
}

export interface MyCourseResponse {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  price: number | null;
  stageId: string;
  stageName: string;
  lessonCount: number;
  completionProgress: number;
}
