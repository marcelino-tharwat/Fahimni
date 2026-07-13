/**
 * Content tree types — the flattened shape consumed by the tree UI.
 *
 * The backend `GET /api/content/tree` returns a *nested* structure
 * (backend/src/modules/content/content.controller.ts):
 *   [{ stage: {...}, chapters: [{ chapter: {...}, lessons: [...] }] }]
 *
 * `teacherContentApi.getContentTree()` maps that into the flat shape below,
 * so consumers read `stage.chapters[].lessons[]` directly.
 *
 * Note the count fields differ from the Chapter DTO: here it is
 * `lessonCount` (no 's').
 */
export interface ContentTreeLesson {
  id: string;
  title: string;
  sortOrder: number;
}

export interface ContentTreeChapter {
  id: string;
  name: string;
  sortOrder: number;
  lessonCount: number;
  imageUrl?: string | null;
  term: 'FIRST_TERM' | 'SECOND_TERM';
  isVisible: boolean;
  /** null or <= 0 means the chapter is free. */
  price: number | null;
  lessons: ContentTreeLesson[];
}

export interface ContentTreeStage {
  id: string;
  name: string;
  displayName?: string;
  sortOrder: number;
  chapterCount: number;
  chapters: ContentTreeChapter[];
}
