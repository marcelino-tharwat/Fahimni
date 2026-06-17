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
