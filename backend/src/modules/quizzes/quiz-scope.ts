import type { Prisma } from "../../generated/prisma/client.js";
import { prisma as defaultPrisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../config/logger.js";
import { ContentNotIndexedError } from "./quiz-generation.errors.js";

export type QuizContentScope = "CHAPTER" | "SELECTED_LESSONS";

export interface QuizScopeInput {
  chapterId: string;
  contentScope: QuizContentScope;
  lessonIds?: string[];
}

export interface ResolvedQuizScope {
  chapterId: string;
  contentScope: QuizContentScope;
  lessonIds: string[];
  sourceTitles: string[];
  /**
   * Teacher-only display metadata for the resolved source. `chapterTitle` is
   * only unambiguous for single-chapter sources (null for multi-chapter /
   * full-curriculum). `lessons` carries id+title so the generation layer can
   * attach a source lesson to questions when exactly one lesson was used.
   */
  chapterTitle: string | null;
  lessons: Array<{ id: string; title: string }>;
  /**
   * Every owned chapter the source spans, ordered by sortOrder (single → one id;
   * multi → all selected; full → every chapter of the stage). Drives the
   * persisted Quiz.sourceChapterIds so multi-chapter provenance is not lost to
   * the single chapterId placement column.
   */
  chapterIds: string[];
  /** The owning stage for full-curriculum sources; null otherwise. */
  stageId: string | null;
}

type PrismaLike = Pick<typeof defaultPrisma, "chapter" | "lesson">;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeLessonIds(ids: string[] | undefined): string[] {
  if (!ids?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!UUID_RE.test(id)) {
      throw new AppError("Invalid lesson ID", 400, "QUIZ_SCOPE_INVALID");
    }
    if (seen.has(id)) {
      throw new AppError("Duplicate lesson IDs are not allowed", 400, "QUIZ_SCOPE_INVALID");
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Single source of truth for quiz content scope validation and lesson resolution.
 * Used by AI generation and any future manual scope writes.
 */
export async function resolveAndValidateQuizContentScope(
  input: QuizScopeInput,
  teacherId: string,
  db: PrismaLike = defaultPrisma,
  options: { requireUsableContent?: boolean } = {},
): Promise<ResolvedQuizScope> {
  const requireUsableContent = options.requireUsableContent ?? true;
  logger.info("quiz_scope_validation_started", {
    teacherId,
    chapterId: input.chapterId,
    contentScope: input.contentScope,
    selectedLessonCount: input.lessonIds?.length ?? 0,
  });

  if (!UUID_RE.test(input.chapterId)) {
    throw new AppError("Invalid chapter ID", 400, "QUIZ_SCOPE_INVALID");
  }

  const lessonIds = normalizeLessonIds(input.lessonIds);

  if (input.contentScope === "CHAPTER") {
    if (lessonIds.length > 0) {
      throw new AppError(
        "lessonIds must be empty when contentScope is CHAPTER",
        400,
        "QUIZ_SCOPE_INVALID",
      );
    }
  } else if (input.contentScope === "SELECTED_LESSONS") {
    if (lessonIds.length === 0) {
      throw new AppError(
        "At least one lesson must be selected",
        400,
        "LESSON_SELECTION_REQUIRED",
      );
    }
  } else {
    throw new AppError("Invalid content scope", 400, "QUIZ_SCOPE_INVALID");
  }

  const chapter = await db.chapter.findFirst({
    where: {
      id: input.chapterId,
      deletedAt: null,
      stage: { teacherId, deletedAt: null },
    },
    select: { id: true, name: true },
  });

  if (!chapter) {
    throw new AppError("Chapter not found", 404, "CHAPTER_NOT_FOUND");
  }

  if (input.contentScope === "CHAPTER") {
    const lessons = await db.lesson.findMany({
      where: { chapterId: chapter.id, deletedAt: null },
      select: { id: true, title: true },
      orderBy: { sortOrder: "asc" },
    });

    if (lessons.length === 0) {
      if (requireUsableContent) {
        throw new ContentNotIndexedError(
          "لا يحتوي الفصل المحدد على دروس قابلة للاستخدام.",
        );
      }
      return {
        chapterId: chapter.id,
        contentScope: "CHAPTER",
        lessonIds: [],
        sourceTitles: [chapter.name],
        chapterTitle: chapter.name,
        lessons: [],
        chapterIds: [chapter.id],
        stageId: null,
      };
    }

    const resolved: ResolvedQuizScope = {
      chapterId: chapter.id,
      contentScope: "CHAPTER",
      lessonIds: lessons.map((l) => l.id),
      sourceTitles: [chapter.name, ...lessons.map((l) => l.title)],
      chapterTitle: chapter.name,
      lessons: lessons.map((l) => ({ id: l.id, title: l.title })),
      chapterIds: [chapter.id],
      stageId: null,
    };

    logger.info("quiz_generation_sources_resolved", {
      teacherId,
      chapterId: chapter.id,
      contentScope: "CHAPTER",
      resolvedLessonCount: resolved.lessonIds.length,
    });

    return resolved;
  }

  const lessons = await db.lesson.findMany({
    where: {
      id: { in: lessonIds },
      deletedAt: null,
      chapterId: chapter.id,
      chapter: { deletedAt: null, stage: { teacherId, deletedAt: null } },
    },
    select: { id: true, title: true },
    orderBy: { sortOrder: "asc" },
  });

  if (lessons.length !== lessonIds.length) {
    const found = new Set(lessons.map((l) => l.id));
    const missing = lessonIds.filter((id) => !found.has(id));
    const crossChapter = await db.lesson.findFirst({
      where: {
        id: { in: missing },
        deletedAt: null,
        chapterId: { not: chapter.id },
        chapter: { stage: { teacherId } },
      },
      select: { id: true },
    });

    if (crossChapter) {
      throw new AppError(
        "One or more lessons do not belong to the selected chapter",
        400,
        "LESSON_NOT_IN_CHAPTER",
      );
    }

    throw new AppError("One or more lessons not found", 404, "LESSON_NOT_FOUND");
  }

  const resolved: ResolvedQuizScope = {
    chapterId: chapter.id,
    contentScope: "SELECTED_LESSONS",
    lessonIds: lessons.map((l) => l.id),
    sourceTitles: lessons.map((l) => l.title),
    chapterTitle: chapter.name,
    lessons: lessons.map((l) => ({ id: l.id, title: l.title })),
    chapterIds: [chapter.id],
    stageId: null,
  };

  logger.info("quiz_generation_sources_resolved", {
    teacherId,
    chapterId: chapter.id,
    contentScope: "SELECTED_LESSONS",
    selectedLessonCount: lessonIds.length,
    resolvedLessonCount: resolved.lessonIds.length,
  });

  return resolved;
}

function normalizeUuidList(ids: string[], label: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!UUID_RE.test(id)) {
      throw new AppError(`Invalid ${label} ID`, 400, "QUIZ_SCOPE_INVALID");
    }
    if (seen.has(id)) {
      throw new AppError(`Duplicate ${label} IDs are not allowed`, 400, "QUIZ_SCOPE_INVALID");
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Resolve + authorize MULTI_CHAPTER generation content. Every chapter must be
 * owned by the teacher (proven via chapter.stage.teacherId). Lessons across all
 * chapters are gathered. The returned `chapterId` is the first chapter as a safe
 * default placement — generation source is independent of lesson placement.
 */
export async function resolveMultiChapterScope(
  chapterIds: string[],
  teacherId: string,
  db: PrismaLike = defaultPrisma,
  options: { requireUsableContent?: boolean } = {},
): Promise<ResolvedQuizScope> {
  const requireUsableContent = options.requireUsableContent ?? true;
  const ids = normalizeUuidList(chapterIds ?? [], "chapter");
  if (ids.length < 2) {
    throw new AppError("At least two chapters are required", 400, "QUIZ_SCOPE_INVALID");
  }

  const chapters = await db.chapter.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      stage: { teacherId, deletedAt: null },
    },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  if (chapters.length !== ids.length) {
    // A chapter the teacher does not own (or a deleted one) is simply "not found".
    throw new AppError("One or more chapters not found", 404, "CHAPTER_NOT_FOUND");
  }

  const chapterIdList = chapters.map((c) => c.id);
  const lessons = await db.lesson.findMany({
    where: { chapterId: { in: chapterIdList }, deletedAt: null },
    select: { id: true, title: true },
    orderBy: [{ chapterId: "asc" }, { sortOrder: "asc" }],
  });

  if (lessons.length === 0) {
    if (requireUsableContent) {
      throw new ContentNotIndexedError(
        "لا تحتوي الفصول المحددة على دروس قابلة للاستخدام.",
      );
    }
    return {
      chapterId: chapters[0]!.id,
      contentScope: "CHAPTER",
      lessonIds: [],
      sourceTitles: chapters.map((c) => c.name),
      chapterTitle: null,
      lessons: [],
      chapterIds: chapters.map((c) => c.id),
      stageId: null,
    };
  }

  logger.info("quiz_generation_sources_resolved", {
    teacherId,
    sourceScope: "MULTI_CHAPTER",
    chapterCount: chapters.length,
    resolvedLessonCount: lessons.length,
  });

  return {
    chapterId: chapters[0]!.id,
    contentScope: "CHAPTER",
    lessonIds: lessons.map((l) => l.id),
    sourceTitles: [...chapters.map((c) => c.name), ...lessons.map((l) => l.title)],
    // Multiple chapters → no single unambiguous chapter title.
    chapterTitle: null,
    lessons: lessons.map((l) => ({ id: l.id, title: l.title })),
    chapterIds: chapters.map((c) => c.id),
    stageId: null,
  };
}

/**
 * Resolve + authorize FULL_CURRICULUM generation content. The stage must be
 * owned by the teacher; all of its chapters + lessons are gathered.
 */
export async function resolveFullCurriculumScope(
  stageId: string,
  teacherId: string,
  db: Pick<typeof defaultPrisma, "stage" | "chapter" | "lesson"> = defaultPrisma,
  options: { requireUsableContent?: boolean } = {},
): Promise<ResolvedQuizScope> {
  const requireUsableContent = options.requireUsableContent ?? true;
  if (!UUID_RE.test(stageId)) {
    throw new AppError("Invalid stage ID", 400, "QUIZ_SCOPE_INVALID");
  }

  const stage = await db.stage.findFirst({
    where: { id: stageId, deletedAt: null, teacherId },
    select: { id: true, name: true },
  });
  if (!stage) {
    throw new AppError("Stage not found", 404, "STAGE_NOT_FOUND");
  }

  const chapters = await db.chapter.findMany({
    where: { stageId: stage.id, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
  if (chapters.length === 0) {
    throw new ContentNotIndexedError("لا يحتوي هذا الصف على فصول قابلة للاستخدام.");
  }

  const chapterIdList = chapters.map((c) => c.id);
  const lessons = await db.lesson.findMany({
    where: { chapterId: { in: chapterIdList }, deletedAt: null },
    select: { id: true, title: true },
    orderBy: [{ chapterId: "asc" }, { sortOrder: "asc" }],
  });

  if (lessons.length === 0) {
    if (requireUsableContent) {
      throw new ContentNotIndexedError(
        "لا تحتوي فصول هذا الصف على دروس قابلة للاستخدام.",
      );
    }
    return {
      chapterId: chapters[0]!.id,
      contentScope: "CHAPTER",
      lessonIds: [],
      sourceTitles: [stage.name, ...chapters.map((c) => c.name)],
      chapterTitle: null,
      lessons: [],
      chapterIds: chapters.map((c) => c.id),
      stageId: stage.id,
    };
  }

  logger.info("quiz_generation_sources_resolved", {
    teacherId,
    sourceScope: "FULL_CURRICULUM",
    stageId: stage.id,
    chapterCount: chapters.length,
    resolvedLessonCount: lessons.length,
  });

  return {
    chapterId: chapters[0]!.id,
    contentScope: "CHAPTER",
    lessonIds: lessons.map((l) => l.id),
    sourceTitles: [stage.name, ...chapters.map((c) => c.name)],
    // Whole-stage source spans many chapters → no single chapter title.
    chapterTitle: null,
    lessons: lessons.map((l) => ({ id: l.id, title: l.title })),
    chapterIds: chapters.map((c) => c.id),
    stageId: stage.id,
  };
}

/** Persist quiz ↔ lesson relations for SELECTED_LESSONS scope. */
export async function persistQuizLessonRelations(
  tx: Prisma.TransactionClient,
  quizId: string,
  contentScope: QuizContentScope,
  lessonIds: string[],
): Promise<void> {
  await tx.quizLesson.deleteMany({ where: { quizId } });

  if (contentScope === "SELECTED_LESSONS" && lessonIds.length > 0) {
    await tx.quizLesson.createMany({
      data: lessonIds.map((lessonId) => ({ quizId, lessonId })),
      skipDuplicates: true,
    });
  }
}

export interface QuizScopeLessonDTO {
  id: string;
  title: string;
}

/** Load scope summary for quiz read responses. */
export async function loadQuizScopeSummary(
  quizId: string,
  contentScope: QuizContentScope,
  chapterId: string | null,
  db: PrismaLike & Pick<typeof defaultPrisma, "quizLesson" | "chapter"> = defaultPrisma,
): Promise<{
  contentScope: QuizContentScope;
  chapter: { id: string; title: string } | null;
  lessons: QuizScopeLessonDTO[];
}> {
  let chapter: { id: string; title: string } | null = null;
  if (chapterId) {
    const row = await db.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, name: true },
    });
    if (row) {
      chapter = { id: row.id, title: row.name };
    }
  }

  if (contentScope !== "SELECTED_LESSONS") {
    return { contentScope, chapter, lessons: [] };
  }

  const relations = await db.quizLesson.findMany({
    where: { quizId },
    select: { lesson: { select: { id: true, title: true } } },
    orderBy: { lessonId: "asc" },
  });

  return {
    contentScope,
    chapter,
    lessons: relations.map((r) => ({
      id: r.lesson.id,
      title: r.lesson.title,
    })),
  };
}

// ── Source scope (single/multi/full) read projections ──────────────────────
// Distinct from the intra-chapter content scope above. These resolve the
// persisted Quiz.sourceScope / sourceChapterIds / sourceStageId into display
// shapes, scoped to who is asking (teacher owns everything; student only sees
// what they can already access).

export type QuizSourceScope = "SINGLE_CHAPTER" | "MULTI_CHAPTER" | "FULL_CURRICULUM";

export interface QuizSourceRefDTO {
  id: string;
  title: string;
}

/** Raw persisted source-scope columns a read projection needs. */
export interface QuizSourceScopeRow {
  id: string;
  sourceScope: QuizSourceScope;
  sourceChapterIds: string[];
  sourceStageId: string | null;
}

/** Teacher-facing: full provenance resolved against the teacher's own content. */
export interface TeacherQuizSourceScopeDTO {
  sourceScope: QuizSourceScope;
  sourceChapterIds: string[];
  sourceStageId: string | null;
  sourceChapters: QuizSourceRefDTO[];
  sourceStage: QuizSourceRefDTO | null;
}

/**
 * Student-facing: only what the student may already see. Raw id arrays are never
 * exposed — MULTI_CHAPTER resolves to `chapters` filtered to accessible content,
 * FULL_CURRICULUM to a single `stage`, SINGLE_CHAPTER adds nothing extra.
 */
export interface StudentQuizSourceScopeDTO {
  sourceScope: QuizSourceScope;
  chapters?: QuizSourceRefDTO[];
  stage?: QuizSourceRefDTO;
}

type SourceScopeDb = Pick<typeof defaultPrisma, "chapter" | "stage">;

/**
 * Batch-resolve teacher source scopes. One chapter query + one stage query for
 * the whole page (no N+1). Only the teacher's own, non-deleted content is
 * resolvable; ids that don't resolve are silently dropped from the display
 * arrays (the raw ids are still returned for completeness).
 */
export async function resolveTeacherQuizSourceScopes(
  rows: QuizSourceScopeRow[],
  teacherId: string,
  db: SourceScopeDb = defaultPrisma,
): Promise<Map<string, TeacherQuizSourceScopeDTO>> {
  const chapterIds = new Set<string>();
  const stageIds = new Set<string>();
  for (const row of rows) {
    if (row.sourceScope === "MULTI_CHAPTER") {
      row.sourceChapterIds.forEach((id) => chapterIds.add(id));
    }
    if (row.sourceScope === "FULL_CURRICULUM" && row.sourceStageId) {
      stageIds.add(row.sourceStageId);
    }
  }

  const [chapters, stages] = await Promise.all([
    chapterIds.size > 0
      ? db.chapter.findMany({
          where: {
            id: { in: [...chapterIds] },
            deletedAt: null,
            stage: { teacherId, deletedAt: null },
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    stageIds.size > 0
      ? db.stage.findMany({
          where: { id: { in: [...stageIds] }, deletedAt: null, teacherId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const chapterTitleById = new Map(chapters.map((c) => [c.id, c.name]));
  const stageTitleById = new Map(stages.map((s) => [s.id, s.name]));

  const out = new Map<string, TeacherQuizSourceScopeDTO>();
  for (const row of rows) {
    const sourceChapters =
      row.sourceScope === "MULTI_CHAPTER"
        ? row.sourceChapterIds
            .filter((id) => chapterTitleById.has(id))
            .map((id) => ({ id, title: chapterTitleById.get(id)! }))
        : [];
    const sourceStage =
      row.sourceScope === "FULL_CURRICULUM" &&
      row.sourceStageId &&
      stageTitleById.has(row.sourceStageId)
        ? { id: row.sourceStageId, title: stageTitleById.get(row.sourceStageId)! }
        : null;

    out.set(row.id, {
      sourceScope: row.sourceScope,
      sourceChapterIds: row.sourceChapterIds,
      sourceStageId: row.sourceStageId,
      sourceChapters,
      sourceStage,
    });
  }
  return out;
}

/**
 * Batch-resolve student source scopes. Multi-chapter provenance is filtered to
 * the chapters the student may already access (enrolled or free, same policy as
 * lesson/quiz visibility); raw id arrays are never surfaced. Full-curriculum
 * exposes the stage name when it resolves. Single-chapter adds nothing.
 */
export async function resolveStudentQuizSourceScopes(
  rows: QuizSourceScopeRow[],
  studentId: string,
  db: SourceScopeDb = defaultPrisma,
  loadAccessibleChapters?: (
    studentId: string,
  ) => Promise<Array<{ id: string; name: string }>>,
): Promise<Map<string, StudentQuizSourceScopeDTO>> {
  const hasMulti = rows.some((r) => r.sourceScope === "MULTI_CHAPTER");
  const stageIds = new Set(
    rows
      .filter((r) => r.sourceScope === "FULL_CURRICULUM" && r.sourceStageId)
      .map((r) => r.sourceStageId as string),
  );

  // Default loader lazy-imports the progression policy to avoid a static import
  // cycle (progression → quizzes → progression); tests inject a fake.
  const loadChapters =
    loadAccessibleChapters ??
    ((sid: string) =>
      import("../progression/student-chapter-access.js").then((m) =>
        m.listStudentAccessibleChapters(sid),
      ));

  const [accessibleChapters, stages] = await Promise.all([
    hasMulti ? loadChapters(studentId) : Promise.resolve([]),
    stageIds.size > 0
      ? db.stage.findMany({
          where: { id: { in: [...stageIds] }, deletedAt: null },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const accessibleTitleById = new Map(
    accessibleChapters.map((c) => [c.id, c.name]),
  );
  const stageTitleById = new Map(stages.map((s) => [s.id, s.name]));

  const out = new Map<string, StudentQuizSourceScopeDTO>();
  for (const row of rows) {
    if (row.sourceScope === "MULTI_CHAPTER") {
      const chapters = row.sourceChapterIds
        .filter((id) => accessibleTitleById.has(id))
        .map((id) => ({ id, title: accessibleTitleById.get(id)! }));
      out.set(row.id, { sourceScope: row.sourceScope, chapters });
    } else if (
      row.sourceScope === "FULL_CURRICULUM" &&
      row.sourceStageId &&
      stageTitleById.has(row.sourceStageId)
    ) {
      out.set(row.id, {
        sourceScope: row.sourceScope,
        stage: {
          id: row.sourceStageId,
          title: stageTitleById.get(row.sourceStageId)!,
        },
      });
    } else {
      out.set(row.id, { sourceScope: row.sourceScope });
    }
  }
  return out;
}
