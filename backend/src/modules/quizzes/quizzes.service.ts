import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import {
  quizPublicFields,
  questionPublicFields,
  studentQuestionPublicFields,
} from "./quizzes.types.js";
import type {
  QuizResponseDTO,
  QuizDetailResponseDTO,
  QuestionResponseDTO,
} from "./quizzes.types.js";
import type {
  CreateQuizInput,
  UpdateQuizInput,
  AddQuestionInput,
  UpdateQuestionInput,
  ReorderInput,
  AssignQuizInput,
} from "./quizzes.validation.js";
import type { Prisma } from "../../generated/prisma/client.js";

function toQuestionResponseDTO(
  row: Record<string, unknown>,
): QuestionResponseDTO {
  return {
    id: row.id as string,
    quizId: row.quizId as string,
    type: row.type as QuestionResponseDTO["type"],
    content: row.text as string,
    options: row.options as Record<string, string>,
    correctAnswer: (row.correctAnswer as string | null) ?? null,
    explanation: (row.explanation as string | null) ?? null,
    sortOrder: row.sortOrder as number,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

export class QuizService {
  private async assertQuizOwned(
    quizId: string,
    teacherId: string,
  ) {
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, createdBy: teacherId },
    });

    if (!quiz) {
      throw new AppError("Quiz not found", 404);
    }

    return quiz;
  }

  private assertQuizDraft(status: string) {
    if (status !== "DRAFT") {
      throw new AppError("Cannot modify a published quiz", 403);
    }
  }

  public async create(
    input: CreateQuizInput,
    teacherId: string,
  ): Promise<QuizResponseDTO> {
    const quiz = await prisma.quiz.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        chapterId: input.chapterId ?? null,
        durationMinutes: input.durationMinutes ?? null,
        createdBy: teacherId,
      },
      select: { ...quizPublicFields, _count: { select: { questions: true } } },
    });

    const { _count: count, ...quizFields } =
      quiz as unknown as { _count: { questions: number } } & Record<string, unknown>;

    await auditLogService.record({
      action: "QUIZ_CREATED",
      resourceType: "QUIZ",
      resourceId: quizFields.id as string,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { title: quizFields.title, chapterId: quizFields.chapterId },
    });

    return {
      ...quizFields,
      questionCount: count.questions,
    } as unknown as QuizResponseDTO;
  }

  public async list(
    teacherId: string,
    status?: string,
  ): Promise<QuizResponseDTO[]> {
    const quizzes = await prisma.quiz.findMany({
      where: {
        createdBy: teacherId,
        ...(status ? { status: status as "DRAFT" | "PUBLISHED" } : {}),
      },
      select: { ...quizPublicFields, _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
    });

    return quizzes.map((q) => {
      const { _count: count, ...rest } =
        q as unknown as { _count: { questions: number } } & Record<string, unknown>;
      return { ...rest, questionCount: count.questions } as unknown as QuizResponseDTO;
    });
  }

  public async getById(
    id: string,
    teacherId: string,
  ): Promise<QuizDetailResponseDTO> {
    const row = await prisma.quiz.findFirst({
      where: { id, createdBy: teacherId },
      select: {
        ...quizPublicFields,
        _count: { select: { questions: true } },
        questions: {
          orderBy: { sortOrder: "asc" },
          select: questionPublicFields,
        },
      },
    });

    if (!row) {
      throw new AppError("Quiz not found", 404);
    }

    const { _count: count, questions, ...rest } =
      row as unknown as { _count: { questions: number }; questions: unknown[] } & Record<string, unknown>;

    return {
      ...rest,
      questionCount: count.questions,
      questions: (questions as Record<string, unknown>[]).map(toQuestionResponseDTO),
    } as unknown as QuizDetailResponseDTO;
  }

  public async update(
    id: string,
    teacherId: string,
    input: UpdateQuizInput,
  ): Promise<QuizResponseDTO> {
    const existing = await this.assertQuizOwned(id, teacherId);
    // Snapshot enforcement: questions are immutable once quiz is published
    this.assertQuizDraft(existing.status);

    const data: Prisma.QuizUpdateInput = {};
    if (input.title !== undefined) {
      data.title = input.title;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }
    if (input.durationMinutes !== undefined) {
      data.durationMinutes = input.durationMinutes;
    }

    const quiz = await prisma.quiz.update({
      where: { id },
      data,
      select: { ...quizPublicFields, _count: { select: { questions: true } } },
    });

    const { _count: count, ...quizFields } =
      quiz as unknown as { _count: { questions: number } } & Record<string, unknown>;

    await auditLogService.record({
      action: "QUIZ_UPDATED",
      resourceType: "QUIZ",
      resourceId: quizFields.id as string,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { title: quizFields.title },
    });

    return {
      ...quizFields,
      questionCount: count.questions,
    } as unknown as QuizResponseDTO;
  }

  public async delete(id: string, teacherId: string): Promise<void> {
    const existing = await this.assertQuizOwned(id, teacherId);
    // Snapshot enforcement: questions are immutable once quiz is published
    this.assertQuizDraft(existing.status);

    await prisma.quiz.delete({ where: { id } });

    await auditLogService.record({
      action: "QUIZ_DELETED",
      resourceType: "QUIZ",
      resourceId: id,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { title: existing.title },
    });
  }

  public async addQuestion(
    quizId: string,
    teacherId: string,
    input: AddQuestionInput,
  ): Promise<QuestionResponseDTO> {
    const quiz = await this.assertQuizOwned(quizId, teacherId);
    // Snapshot enforcement: questions are immutable once quiz is published
    this.assertQuizDraft(quiz.status);

    const maxQuestion = await prisma.question.aggregate({
      where: { quizId },
      _max: { sortOrder: true },
    });

    const question = await prisma.question.create({
      data: {
        quizId,
        type: input.type,
        text: input.content,
        options: input.options as Prisma.InputJsonValue,
        correctAnswer: input.correctAnswer ?? null,
        explanation: input.explanation ?? null,
        sortOrder: input.sortOrder ?? (maxQuestion._max.sortOrder ?? 0) + 1,
      },
      select: questionPublicFields,
    });

    await auditLogService.record({
      action: "QUIZ_UPDATED",
      resourceType: "QUESTION",
      resourceId: question.id,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { quizId, type: question.type },
    });

    return toQuestionResponseDTO(question as unknown as Record<string, unknown>);
  }

  public async updateQuestion(
    questionId: string,
    quizId: string,
    teacherId: string,
    input: UpdateQuestionInput,
  ): Promise<QuestionResponseDTO> {
    const quiz = await this.assertQuizOwned(quizId, teacherId);
    // Snapshot enforcement: questions are immutable once quiz is published
    this.assertQuizDraft(quiz.status);

    const existing = await prisma.question.findFirst({
      where: { id: questionId, quizId },
    });

    if (!existing) {
      throw new AppError("Question not found", 404);
    }

    const data: Prisma.QuestionUpdateInput = {};
    if (input.type !== undefined) {
      data.type = input.type;
    }
    if (input.content !== undefined) {
      data.text = input.content;
    }
    if (input.options !== undefined) {
      data.options = input.options as Prisma.InputJsonValue;
    }
    if (input.correctAnswer !== undefined) {
      data.correctAnswer = input.correctAnswer;
    }
    if (input.explanation !== undefined) {
      data.explanation = input.explanation;
    }
    if (input.sortOrder !== undefined) {
      data.sortOrder = input.sortOrder;
    }

    const question = await prisma.question.update({
      where: { id: questionId },
      data,
      select: questionPublicFields,
    });

    return toQuestionResponseDTO(question as unknown as Record<string, unknown>);
  }

  public async deleteQuestion(
    questionId: string,
    quizId: string,
    teacherId: string,
  ): Promise<void> {
    const quiz = await this.assertQuizOwned(quizId, teacherId);
    // Snapshot enforcement: questions are immutable once quiz is published
    this.assertQuizDraft(quiz.status);

    const existing = await prisma.question.findFirst({
      where: { id: questionId, quizId },
    });

    if (!existing) {
      throw new AppError("Question not found", 404);
    }

    await prisma.question.delete({ where: { id: questionId } });

    await auditLogService.record({
      action: "QUIZ_UPDATED",
      resourceType: "QUESTION",
      resourceId: questionId,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { quizId, action: "deleted" },
    });
  }

  public async reorderQuestions(
    quizId: string,
    teacherId: string,
    ids: ReorderInput,
  ): Promise<QuestionResponseDTO[]> {
    const quiz = await this.assertQuizOwned(quizId, teacherId);
    // Snapshot enforcement: questions are immutable once quiz is published
    this.assertQuizDraft(quiz.status);

    const allQuestions = await prisma.question.findMany({
      where: { quizId },
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    });

    if (ids.length !== allQuestions.length) {
      throw new AppError(
        `All question IDs must be provided. Expected ${allQuestions.length}, got ${ids.length}.`,
        400,
      );
    }

    const validIds = new Set(allQuestions.map((q) => q.id));
    for (const id of ids) {
      if (!validIds.has(id)) {
        throw new AppError(`Invalid question ID: ${id}`, 400);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Two-phase update: the @@unique([quizId, sortOrder]) constraint is checked
      // immediately, so assigning final positions directly can transiently
      // collide with an existing row's sortOrder. First move every question to a
      // unique negative placeholder, then set the final 1-based positions.
      for (let i = 0; i < ids.length; i++) {
        await tx.question.update({
          where: { id: ids[i]! },
          data: { sortOrder: -(i + 1) },
        });
      }
      for (let i = 0; i < ids.length; i++) {
        await tx.question.update({
          where: { id: ids[i]! },
          data: { sortOrder: i + 1 },
        });
      }

      return tx.question.findMany({
        where: { quizId },
        select: questionPublicFields,
        orderBy: { sortOrder: "asc" },
      });
    });

    return updated.map((q) =>
      toQuestionResponseDTO(q as unknown as Record<string, unknown>),
    );
  }

  public async publishQuiz(
    quizId: string,
    teacherId: string,
  ): Promise<QuizResponseDTO> {
    const existing = await this.assertQuizOwned(quizId, teacherId);

    // Duplicate publish / invalid transition → 409 (idempotency-safe).
    if (existing.status !== "DRAFT") {
      throw new AppError("Quiz is already published", 409);
    }

    // STORY-47: a quiz must be assigned to a chapter before it can be published.
    if (!existing.chapterId) {
      throw new AppError(
        "Quiz must be assigned to a chapter before publishing",
        400,
      );
    }

    const questions = await prisma.question.findMany({
      where: { quizId },
      select: { points: true },
    });

    if (questions.length === 0) {
      throw new AppError(
        "Quiz must have at least 1 question to be published",
        400,
      );
    }

    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    // Atomic publish: only transitions a still-DRAFT quiz; concurrent publishes
    // see 0 rows updated and get a 409.
    const updated = await prisma.quiz.updateMany({
      where: { id: quizId, status: "DRAFT" },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        questionCount: questions.length,
        totalPoints,
      },
    });

    if (updated.count === 0) {
      throw new AppError("Quiz is already published", 409);
    }

    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: { ...quizPublicFields, _count: { select: { questions: true } } },
    });

    const { _count: count, ...quizFields } =
      quiz as unknown as { _count: { questions: number } } & Record<string, unknown>;

    await auditLogService.record({
      action: "QUIZ_PUBLISHED",
      resourceType: "QUIZ",
      resourceId: quizId,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { title: existing.title, questionCount: questions.length },
    });

    return {
      ...quizFields,
      questionCount: count.questions,
    } as unknown as QuizResponseDTO;
  }

  public async assignQuiz(
    quizId: string,
    teacherId: string,
    chapterId: string,
  ): Promise<QuizResponseDTO> {
    const existing = await this.assertQuizOwned(quizId, teacherId);

    // Reassigning a published quiz would break question/chapter immutability.
    if (existing.status !== "DRAFT") {
      throw new AppError("Cannot reassign a published quiz", 409);
    }

    // Chapter must exist, be active, and belong to the same teacher
    // (Chapter -> Stage -> teacherId). Prevents cross-teacher assignment.
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        deletedAt: null,
        stage: { teacherId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!chapter) {
      throw new AppError("Chapter not found", 404);
    }

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        chapter: { connect: { id: chapterId } },
      },
      select: { ...quizPublicFields, _count: { select: { questions: true } } },
    });

    const { _count: count, ...quizFields } =
      quiz as unknown as { _count: { questions: number } } & Record<string, unknown>;

    await auditLogService.record({
      action: "QUIZ_ASSIGNED",
      resourceType: "QUIZ",
      resourceId: quizId,
      actorId: teacherId,
      actorType: "TEACHER",
      scopeTeacherId: teacherId,
      details: { title: existing.title, chapterId },
    });

    return {
      ...quizFields,
      questionCount: count.questions,
    } as unknown as QuizResponseDTO;
  }

  public async getChapterQuizzes(
    chapterId: string,
  ): Promise<QuizDetailResponseDTO[]> {
    const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) {
      throw new AppError("Chapter not found", 404);
    }

    const quizzes = await prisma.quiz.findMany({
      where: { chapterId, status: "PUBLISHED" },
      select: {
        ...quizPublicFields,
        _count: { select: { questions: true } },
        questions: {
          select: studentQuestionPublicFields,
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return quizzes.map((q) => {
      const { _count: count, questions, ...rest } =
        q as unknown as { _count: { questions: number }; questions: unknown[] } & Record<string, unknown>;
      return {
        ...rest,
        questionCount: count.questions,
        // Student-facing: never expose correctAnswer (omit the field entirely).
        questions: (questions as Record<string, unknown>[]).map((row) => ({
          id: row.id as string,
          quizId: row.quizId as string,
          type: row.type,
          content: row.text as string,
          options: row.options as Record<string, string>,
          sortOrder: row.sortOrder as number,
          createdAt: row.createdAt as Date,
          updatedAt: row.updatedAt as Date,
        })),
      } as unknown as QuizDetailResponseDTO;
    });
  }
}
