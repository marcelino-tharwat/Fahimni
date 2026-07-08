import { describe, it, expect, vi } from "vitest";
import { getGeneratorSources } from "./quiz-generator-sources.service.js";

const TEACHER = "teacher-1";
const STAGE = "55555555-5555-4555-8555-555555555555";
const CHAP_A = "11111111-1111-4111-8111-111111111111";
const CHAP_B = "aaaaaaaa-1111-4111-8111-111111111111";
const L_A1 = "22222222-2222-4222-8222-222222222222";
const L_A2 = "33333333-3333-4333-8333-333333333333";
const L_B1 = "44444444-4444-4444-8444-444444444444";

function db(stages: unknown[], indexedLessonIds: string[]) {
  return {
    stage: { findMany: vi.fn().mockResolvedValue(stages) },
    $queryRaw: vi.fn().mockResolvedValue(indexedLessonIds.map((id) => ({ lessonId: id }))),
  } as never;
}

describe("getGeneratorSources", () => {
  it("marks lessons/chapters/stages eligible by indexed content", async () => {
    const stages = [
      {
        id: STAGE,
        name: "الصف الأول",
        chapters: [
          { id: CHAP_A, name: "الفصل أ", lessons: [{ id: L_A1, title: "د١" }, { id: L_A2, title: "د٢" }] },
          { id: CHAP_B, name: "الفصل ب", lessons: [{ id: L_B1, title: "د٣" }] },
        ],
      },
    ];
    // L_A1 indexed; L_A2 & L_B1 not → chapter B has no content.
    const result = await getGeneratorSources(TEACHER, undefined, db(stages, [L_A1]));

    expect(result.canGenerateFullCurriculum).toBe(true);
    expect(result.totalChapters).toBe(2);
    expect(result.eligibleChapters).toBe(1);
    expect(result.totalLessons).toBe(3);
    expect(result.eligibleLessons).toBe(1);
    expect(result.warnings.length).toBeGreaterThan(0);

    const stage = result.stages[0]!;
    expect(stage.canGenerateFullCurriculum).toBe(true);
    const chapA = stage.chapters.find((c) => c.id === CHAP_A)!;
    const chapB = stage.chapters.find((c) => c.id === CHAP_B)!;
    expect(chapA.hasUsableContent).toBe(true);
    expect(chapB.hasUsableContent).toBe(false);
    expect(chapA.lessons.find((l) => l.id === L_A1)!.hasUsableContent).toBe(true);
    expect(chapA.lessons.find((l) => l.id === L_A2)!.hasUsableContent).toBe(false);
  });

  it("reports canGenerateFullCurriculum=false when nothing is indexed", async () => {
    const stages = [
      {
        id: STAGE,
        name: "الصف الأول",
        chapters: [{ id: CHAP_A, name: "الفصل أ", lessons: [{ id: L_A1, title: "د١" }] }],
      },
    ];
    const result = await getGeneratorSources(TEACHER, undefined, db(stages, []));
    expect(result.canGenerateFullCurriculum).toBe(false);
    expect(result.eligibleLessons).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("scopes the stage query to the teacher", async () => {
    const d = db([], []);
    await getGeneratorSources(TEACHER, undefined, d);
    const where = (d.stage.findMany as ReturnType<typeof vi.fn>).mock.calls[0]![0].where;
    expect(where.teacherId).toBe(TEACHER);
    expect(where.deletedAt).toBeNull();
  });
});
