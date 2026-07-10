import { prisma as defaultPrisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../config/logger.js";
import { ContentNotIndexedError } from "./quiz-generation.errors.js";
import {
  MAX_ALLOCATION_BUCKETS,
  type AllocationMode,
  type SourceScope,
} from "./dto/generate-quiz.dto.js";
import type { GenerateQuizInput } from "./dto/generate-quiz.dto.js";
import {
  resolveAndValidateQuizContentScope,
  resolveMultiChapterScope,
  resolveFullCurriculumScope,
  type QuizContentScope,
} from "./quiz-scope.js";

type PrismaLike = Pick<typeof defaultPrisma, "chapter" | "lesson" | "stage">;

/**
 * One independent generation bucket. A bucket becomes a single grounded
 * generation pass scoped to `lessonIds`, producing exactly `questionCount`
 * questions. For BY_LESSON buckets `lessonId`/`lessonTitle` identify the single
 * source lesson; for BY_CHAPTER buckets they are null and `lessonIds` spans the
 * whole chapter.
 */
export interface AllocationBucket {
  chapterId: string;
  chapterTitle: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  lessonIds: string[];
  questionCount: number;
}

/**
 * A fully-resolved, authorized allocation plan. Aggregate fields (chapterId,
 * contentScope, lessons, …) preserve the exact shape the legacy single-pass
 * path consumes; `buckets` drives the new per-chapter / per-lesson multi-pass
 * generation. AUTO plans always contain exactly one bucket.
 */
export interface AllocationPlan {
  sourceScope: SourceScope;
  allocationMode: AllocationMode;
  totalQuestionCount: number;
  buckets: AllocationBucket[];
  // Aggregate scope (placement + persistence + AUTO single-pass).
  chapterId: string;
  chapterTitle: string | null;
  contentScope: QuizContentScope;
  sourceTitles: string[];
  lessonIds: string[];
  lessons: Array<{ id: string; title: string }>;
  // Persisted source provenance (final Quiz.sourceChapterIds / sourceStageId
  // semantics per scope): MULTI_CHAPTER → the deduped, sortOrder-ordered owned
  // chapters that fed generation; FULL_CURRICULUM → sourceStageId set, chapters
  // empty; SINGLE_CHAPTER → both empty/null (the existing chapterId is enough).
  sourceChapterIds: string[];
  sourceStageId: string | null;
}

interface OwnedChapter {
  id: string;
  name: string;
  lessons: Array<{ id: string; title: string }>;
}

/** Load teacher-owned chapters with their (non-deleted) lessons, ordered. */
async function fetchOwnedChaptersWithLessons(
  chapterIds: string[],
  teacherId: string,
  db: PrismaLike,
): Promise<OwnedChapter[]> {
  const chapters = await db.chapter.findMany({
    where: {
      id: { in: chapterIds },
      teacherId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      lessons: {
        where: { deletedAt: null },
        select: { id: true, title: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
  return chapters;
}

function assertBucketBudget(buckets: AllocationBucket[]): void {
  if (buckets.length > MAX_ALLOCATION_BUCKETS) {
    throw new AppError(
      `Too many allocation buckets (${buckets.length}); the maximum is ${MAX_ALLOCATION_BUCKETS}. Use per-chapter allocation or select fewer lessons.`,
      400,
      "QUIZ_ALLOCATION_TOO_MANY_BUCKETS",
    );
  }
}

/**
 * Normalize + authorize a generation request into an {@link AllocationPlan}.
 * Ownership is proven for every referenced chapter/lesson via the shared scope
 * resolvers (lesson → chapter → teacherId). Cross-field shape and the
 * per-bucket sum are already validated by the DTO; this layer adds ownership,
 * chapter/lesson membership, and structural guards that require the database.
 */
export async function buildAllocationPlan(
  input: GenerateQuizInput,
  teacherId: string,
  db: PrismaLike = defaultPrisma,
): Promise<AllocationPlan> {
  const sourceScope: SourceScope = input.sourceScope ?? "SINGLE_CHAPTER";
  const allocationMode: AllocationMode = input.allocationMode ?? "AUTO";

  if (allocationMode === "AUTO") {
    return buildAutoPlan(input, sourceScope, teacherId, db);
  }
  if (allocationMode === "BY_CHAPTER") {
    return buildByChapterPlan(input, teacherId, db);
  }
  return buildByLessonPlan(input, sourceScope, teacherId, db);
}

/** AUTO: reuse the legacy resolvers verbatim; wrap the result in one bucket. */
async function buildAutoPlan(
  input: GenerateQuizInput,
  sourceScope: SourceScope,
  teacherId: string,
  db: PrismaLike,
): Promise<AllocationPlan> {
  let scope;
  if (sourceScope === "MULTI_CHAPTER") {
    scope = await resolveMultiChapterScope(input.chapterIds ?? [], teacherId, db);
  } else if (sourceScope === "FULL_CURRICULUM") {
    scope = await resolveFullCurriculumScope(input.stageId ?? "", teacherId, db);
  } else {
    scope = await resolveAndValidateQuizContentScope(
      {
        chapterId: input.chapterId ?? "",
        contentScope: input.contentScope,
        lessonIds: input.lessonIds,
      },
      teacherId,
      db,
    );
  }

  const singleLesson = scope.lessons.length === 1 ? scope.lessons[0]! : null;

  return {
    sourceScope,
    allocationMode: "AUTO",
    totalQuestionCount: input.questionCount,
    buckets: [
      {
        chapterId: scope.chapterId,
        chapterTitle: scope.chapterTitle,
        lessonId: singleLesson?.id ?? null,
        lessonTitle: singleLesson?.title ?? null,
        lessonIds: scope.lessonIds,
        questionCount: input.questionCount,
      },
    ],
    chapterId: scope.chapterId,
    chapterTitle: scope.chapterTitle,
    contentScope: scope.contentScope,
    sourceTitles: scope.sourceTitles,
    lessonIds: scope.lessonIds,
    lessons: scope.lessons,
    ...deriveSourceProvenance(sourceScope, scope.chapterIds, scope.stageId),
  };
}

/**
 * Map a resolved scope onto the persisted provenance columns. MULTI_CHAPTER
 * keeps the ordered owned chapter ids; FULL_CURRICULUM keeps the stage id (and
 * an empty chapter list — the whole stage is implied); SINGLE_CHAPTER keeps
 * neither (the single chapterId placement column already captures it).
 */
function deriveSourceProvenance(
  sourceScope: SourceScope,
  chapterIds: string[],
  stageId: string | null,
): { sourceChapterIds: string[]; sourceStageId: string | null } {
  if (sourceScope === "MULTI_CHAPTER") {
    return { sourceChapterIds: chapterIds, sourceStageId: null };
  }
  if (sourceScope === "FULL_CURRICULUM") {
    return { sourceChapterIds: [], sourceStageId: stageId };
  }
  return { sourceChapterIds: [], sourceStageId: null };
}

/** MULTI_CHAPTER + BY_CHAPTER: one bucket per selected chapter. */
async function buildByChapterPlan(
  input: GenerateQuizInput,
  teacherId: string,
  db: PrismaLike,
): Promise<AllocationPlan> {
  const allocations = input.chapterAllocations ?? [];
  const requestedIds = allocations.map((a) => a.chapterId);
  const declaredIds = input.chapterIds ?? [];

  // chapterAllocations must describe exactly the declared chapters.
  const declaredSet = new Set(declaredIds);
  const allocatedSet = new Set(requestedIds);
  if (
    declaredIds.length !== requestedIds.length ||
    [...declaredSet].some((id) => !allocatedSet.has(id))
  ) {
    throw new AppError(
      "chapterAllocations must cover exactly the selected chapters",
      400,
      "QUIZ_ALLOCATION_MISMATCH",
    );
  }

  const chapters = await fetchOwnedChaptersWithLessons(requestedIds, teacherId, db);
  if (chapters.length !== requestedIds.length) {
    throw new AppError("One or more chapters not found", 404, "CHAPTER_NOT_FOUND");
  }

  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const buckets: AllocationBucket[] = [];
  const allLessons: Array<{ id: string; title: string }> = [];

  for (const alloc of allocations) {
    const chapter = chapterById.get(alloc.chapterId)!;
    if (chapter.lessons.length === 0) {
      throw new ContentNotIndexedError(
        `لا يحتوي الفصل «${chapter.name}» على دروس قابلة للاستخدام.`,
      );
    }
    buckets.push({
      chapterId: chapter.id,
      chapterTitle: chapter.name,
      lessonId: null,
      lessonTitle: null,
      lessonIds: chapter.lessons.map((l) => l.id),
      questionCount: alloc.questionCount!,
    });
    allLessons.push(...chapter.lessons);
  }

  assertBucketBudget(buckets);

  const firstChapter = chapters[0]!;
  logger.info("quiz_allocation_resolved", {
    teacherId,
    sourceScope: "MULTI_CHAPTER",
    allocationMode: "BY_CHAPTER",
    bucketCount: buckets.length,
    totalQuestionCount: input.questionCount,
  });

  return {
    sourceScope: "MULTI_CHAPTER",
    allocationMode: "BY_CHAPTER",
    totalQuestionCount: input.questionCount,
    buckets,
    chapterId: firstChapter.id,
    chapterTitle: null,
    contentScope: "CHAPTER",
    sourceTitles: chapters.map((c) => c.name),
    lessonIds: allLessons.map((l) => l.id),
    lessons: allLessons,
    sourceChapterIds: chapters.map((c) => c.id),
    sourceStageId: null,
  };
}

/** BY_LESSON: one bucket per selected lesson (single- or multi-chapter). */
async function buildByLessonPlan(
  input: GenerateQuizInput,
  sourceScope: SourceScope,
  teacherId: string,
  db: PrismaLike,
): Promise<AllocationPlan> {
  if (sourceScope === "SINGLE_CHAPTER") {
    const rows = input.lessonAllocations ?? [];
    // Reuse the tested single-chapter resolver for ownership + membership +
    // cross-chapter detection; it returns the lessons ordered with titles.
    const scope = await resolveAndValidateQuizContentScope(
      {
        chapterId: input.chapterId ?? "",
        contentScope: "SELECTED_LESSONS",
        lessonIds: rows.map((r) => r.lessonId),
      },
      teacherId,
      db,
    );

    const titleById = new Map(scope.lessons.map((l) => [l.id, l.title]));
    const buckets: AllocationBucket[] = rows.map((row) => ({
      chapterId: scope.chapterId,
      chapterTitle: scope.chapterTitle,
      lessonId: row.lessonId,
      lessonTitle: titleById.get(row.lessonId) ?? null,
      lessonIds: [row.lessonId],
      questionCount: row.questionCount,
    }));

    assertBucketBudget(buckets);

    logger.info("quiz_allocation_resolved", {
      teacherId,
      sourceScope: "SINGLE_CHAPTER",
      allocationMode: "BY_LESSON",
      bucketCount: buckets.length,
      totalQuestionCount: input.questionCount,
    });

    return {
      sourceScope: "SINGLE_CHAPTER",
      allocationMode: "BY_LESSON",
      totalQuestionCount: input.questionCount,
      buckets,
      chapterId: scope.chapterId,
      chapterTitle: scope.chapterTitle,
      contentScope: "SELECTED_LESSONS",
      sourceTitles: scope.sourceTitles,
      lessonIds: scope.lessonIds,
      lessons: scope.lessons,
      sourceChapterIds: [],
      sourceStageId: null,
    };
  }

  // MULTI_CHAPTER + BY_LESSON: chapterAllocations each carry lessonAllocations.
  const chapterAllocations = input.chapterAllocations ?? [];
  const chapterIds = chapterAllocations.map((a) => a.chapterId);
  const chapters = await fetchOwnedChaptersWithLessons(chapterIds, teacherId, db);
  if (chapters.length !== chapterIds.length) {
    throw new AppError("One or more chapters not found", 404, "CHAPTER_NOT_FOUND");
  }

  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const buckets: AllocationBucket[] = [];
  const allLessons: Array<{ id: string; title: string }> = [];

  for (const alloc of chapterAllocations) {
    const chapter = chapterById.get(alloc.chapterId)!;
    const lessonById = new Map(chapter.lessons.map((l) => [l.id, l]));
    for (const row of alloc.lessonAllocations ?? []) {
      const lesson = lessonById.get(row.lessonId);
      if (!lesson) {
        throw new AppError(
          "One or more lessons do not belong to the selected chapter",
          400,
          "LESSON_NOT_IN_CHAPTER",
        );
      }
      buckets.push({
        chapterId: chapter.id,
        chapterTitle: chapter.name,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonIds: [lesson.id],
        questionCount: row.questionCount,
      });
      allLessons.push({ id: lesson.id, title: lesson.title });
    }
  }

  assertBucketBudget(buckets);

  const firstChapter = chapters[0]!;
  logger.info("quiz_allocation_resolved", {
    teacherId,
    sourceScope: "MULTI_CHAPTER",
    allocationMode: "BY_LESSON",
    bucketCount: buckets.length,
    totalQuestionCount: input.questionCount,
  });

  return {
    sourceScope: "MULTI_CHAPTER",
    allocationMode: "BY_LESSON",
    totalQuestionCount: input.questionCount,
    buckets,
    chapterId: firstChapter.id,
    // Multiple chapters → no single unambiguous chapter title; placement stays
    // CHAPTER so no QuizLesson rows are written (matches legacy multi-chapter).
    chapterTitle: null,
    contentScope: "CHAPTER",
    sourceTitles: chapters.map((c) => c.name),
    lessonIds: allLessons.map((l) => l.id),
    lessons: allLessons,
    sourceChapterIds: chapters.map((c) => c.id),
    sourceStageId: null,
  };
}
