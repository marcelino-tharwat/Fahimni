import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../../config/database.js";
import { geminiClient } from "../../../shared/services/geminiClient.js";
import { aiService } from "../ai.service.js";
import { AiTutorService } from "./ai-tutor.service.js";

/**
 * STORY-63 — PostgreSQL integration test.
 *
 * Exercises the REAL access-scoped pgvector similarity search (STORY-43) and the
 * real Prisma client against the isolated TEST_DATABASE_URL. Only the Gemini
 * provider boundary is mocked (query embedding + answer generation) so the test
 * is deterministic and needs no external quota. The similarity search under test
 * is NOT mocked.
 */

const DIM = 3072;
const PW = "E2ePass@123";
let pwHash: string;
let mobileSeq = 0;

const owned = {
  userIds: [] as string[],
  stageIds: [] as string[],
  chapterIds: [] as string[],
  lessonIds: [] as string[],
  enrollmentIds: [] as string[],
};

function vec(...spikes: number[]): string {
  const arr = new Array<number>(DIM).fill(0);
  for (const i of spikes) arr[i] = 1;
  return `[${arr.join(",")}]`;
}

async function createUser(role: "OPERATION" | "STUDENT"): Promise<string> {
  const id = randomUUID();
  mobileSeq += 1;
  await prisma.user.create({
    data: {
      id,
      email: `tutor-e2e-${id.slice(0, 8)}@e2e.test`,
      fullName: `E2E ${role}`,
      mobile: `017${String(mobileSeq).padStart(8, "0")}`,
      password: pwHash,
      role,
      status: "ACTIVE",
    },
  });
  owned.userIds.push(id);
  return id;
}

async function createStage(teacherId: string): Promise<string> {
  const id = randomUUID();
  await prisma.stage.create({
    data: { id, name: `stage-${id.slice(0, 8)}`, sortOrder: 1, teacherId },
  });
  owned.stageIds.push(id);
  return id;
}

async function createChapter(stageId: string, name: string): Promise<string> {
  const id = randomUUID();
  await prisma.chapter.create({ data: { id, name, sortOrder: 1, stageId } });
  owned.chapterIds.push(id);
  return id;
}

async function createLesson(chapterId: string, title: string): Promise<string> {
  const id = randomUUID();
  await prisma.lesson.create({
    data: { id, title, durationMinutes: 10, sortOrder: 1, chapterId },
  });
  owned.lessonIds.push(id);
  return id;
}

async function enroll(studentId: string, chapterId: string): Promise<void> {
  const e = await prisma.enrollment.create({
    data: { studentId, chapterId, price: 0, paymentMethod: "CASH", status: "ACTIVE" },
  });
  owned.enrollmentIds.push(e.id);
}

async function insertChunk(
  lessonId: string,
  content: string,
  vectorStr: string,
): Promise<void> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO content_chunks (id, content, embedding, "lessonId", metadata, "createdAt", "updatedAt")
    VALUES (${id}, ${content}, ${vectorStr}::vector, ${lessonId}, ${"{}"}::jsonb, NOW(), NOW())
  `;
}

async function chunkCount(): Promise<number> {
  const r = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*)::bigint as n FROM content_chunks`;
  return Number(r[0]!.n);
}

// Fixtures
let teacher1: string;
let teacher2: string;
let student1: string;
let student2: string;
let chapter1Name: string;
let lesson1A: string; // accessible to student1
let lesson2A: string; // teacher2, accessible only to student2

beforeAll(async () => {
  pwHash = await bcrypt.hash(PW, 12);

  teacher1 = await createUser("OPERATION");
  teacher2 = await createUser("OPERATION");
  student1 = await createUser("STUDENT");
  student2 = await createUser("STUDENT");

  const stage1 = await createStage(teacher1);
  const stage2 = await createStage(teacher2);
  chapter1Name = "الفصل الأول - الجبر";
  const chapter1 = await createChapter(stage1, chapter1Name);
  const chapter2 = await createChapter(stage2, "الفصل الثاني - فيزياء");

  lesson1A = await createLesson(chapter1, "مقدمة في الدوال");
  lesson2A = await createLesson(chapter2, "قوانين نيوتن");

  // student1 → chapter1 only; student2 → chapter2 only.
  await enroll(student1, chapter1);
  await enroll(student2, chapter2);

  // lesson1A: two chunks (same lesson → dedup); chunk1 most relevant to query e0.
  await insertChunk(lesson1A, "الدالة الخطية هي علاقة من الدرجة الأولى.", vec(0));
  await insertChunk(lesson1A, "تمثل الدوال بيانياً على المستوى.", vec(0, 1));
  // lesson2A: highly relevant to the same query, but inaccessible to student1.
  await insertChunk(lesson2A, "القوة تساوي الكتلة في التسارع.", vec(0));
});

afterAll(async () => {
  await prisma.$executeRaw`DELETE FROM content_chunks WHERE "lessonId" = ANY(${owned.lessonIds}::text[])`;
  await prisma.enrollment.deleteMany({ where: { id: { in: owned.enrollmentIds } } });
  await prisma.lesson.deleteMany({ where: { id: { in: owned.lessonIds } } });
  await prisma.chapter.deleteMany({ where: { id: { in: owned.chapterIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: owned.stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: owned.userIds } } });
  vi.restoreAllMocks();
  await prisma.$disconnect();
});

function tutorWith(answerRefs: string[]) {
  const gemini = {
    generateContent: vi.fn().mockResolvedValue(
      JSON.stringify({ answer: "إجابة مبنية على المحتوى.", citationRefs: answerRefs }),
    ),
  };
  const service = new AiTutorService({ rag: aiService, gemini });
  return { service, gemini };
}

describe("AiTutorService (PostgreSQL integration)", () => {
  it("returns a citation for the student's accessible lesson with trusted metadata", async () => {
    vi.spyOn(geminiClient, "embedContent").mockResolvedValue(
      new Array<number>(DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
    );
    const { service, gemini } = tutorWith(["SOURCE_1", "SOURCE_2"]);

    const res = await service.ask("اشرح الدالة الخطية", student1);

    expect(gemini.generateContent).toHaveBeenCalledTimes(1);
    // Two chunks from the same lesson → exactly one citation.
    expect(res.citations).toHaveLength(1);
    expect(res.citations[0]!.lessonId).toBe(lesson1A);
    expect(res.citations[0]!.lessonTitle).toBe("مقدمة في الدوال");
    expect(res.citations[0]!.chapterName).toBe(chapter1Name);
    // Highest score wins after dedup; cosine sim of identical direction ≈ 1.
    expect(res.citations[0]!.relevanceScore).toBeGreaterThan(0.9);
  });

  it("never returns another teacher's content the student is not enrolled in", async () => {
    vi.spyOn(geminiClient, "embedContent").mockResolvedValue(
      new Array<number>(DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
    );
    // The model tries to cite up to five sources; only accessible ones can map.
    const { service } = tutorWith(["SOURCE_1", "SOURCE_2", "SOURCE_3", "SOURCE_4", "SOURCE_5"]);

    const res = await service.ask("ما القوة في الفيزياء؟", student1);

    const lessonIds = res.citations.map((c) => c.lessonId);
    expect(lessonIds).not.toContain(lesson2A);
    expect(lessonIds.every((id) => id === lesson1A)).toBe(true);
    expect(res.citations.length).toBeLessThanOrEqual(5);
  });

  it("scopes the search per student (student2 sees teacher2 content, not teacher1)", async () => {
    vi.spyOn(geminiClient, "embedContent").mockResolvedValue(
      new Array<number>(DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
    );
    const { service } = tutorWith(["SOURCE_1"]);

    const res = await service.ask("اشرح قوانين نيوتن", student2);

    expect(res.citations).toHaveLength(1);
    expect(res.citations[0]!.lessonId).toBe(lesson2A);
  });

  it("returns the not-found result (no Gemini) when the student has no enrollments", async () => {
    const embedSpy = vi.spyOn(geminiClient, "embedContent");
    const { service, gemini } = tutorWith(["SOURCE_1"]);

    // teacher2 has no enrollments → no accessible content.
    const res = await service.ask("أي سؤال", teacher2);

    expect(res.citations).toEqual([]);
    expect(res.answer).toBe("لم أجد إجابة في المحتوى المتاح");
    expect(gemini.generateContent).not.toHaveBeenCalled();
    expect(embedSpy).not.toHaveBeenCalled();
  });

  it("orders raw search results by descending relevance and caps at K=5", async () => {
    vi.spyOn(geminiClient, "embedContent").mockResolvedValue(
      new Array<number>(DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
    );
    const rows = await aiService.similaritySearchInLessons("q", [lesson1A], 5);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(rows.length).toBe(2);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.score).toBeGreaterThanOrEqual(rows[i]!.score);
    }
  });

  it("does not mutate any rows", async () => {
    vi.spyOn(geminiClient, "embedContent").mockResolvedValue(
      new Array<number>(DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
    );
    const before = await chunkCount();
    const { service } = tutorWith(["SOURCE_1"]);
    await service.ask("اشرح الدالة", student1);
    const after = await chunkCount();
    expect(after).toBe(before);
  });
});
