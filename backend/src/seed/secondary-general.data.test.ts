import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCOUNTS,
  FIXTURES,
  FORBIDDEN_STAGE_KEYWORDS,
  TEACHER1_CHAPTERS,
  TEACHER1_STAGES,
  TEACHER2_CHAPTERS,
  TEACHER2_STAGE,
  fullId,
} from "./secondary-general.data.js";
import { assertLocalDatabase, SeedGuardError } from "./local-guard.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const allText = [
  ...TEACHER1_STAGES,
  TEACHER2_STAGE,
  ...TEACHER1_CHAPTERS,
  ...TEACHER2_CHAPTERS,
  ...[...TEACHER1_CHAPTERS, ...TEACHER2_CHAPTERS].flatMap((c) => c.lessons),
]
  .map((x) => `${"name" in x ? x.name : (x as { title: string }).title} ${x.description}`)
  .join(" ");

describe("secondary-general dataset", () => {
  it("defines exactly 3 General Secondary stages for Teacher 1", () => {
    expect(TEACHER1_STAGES).toHaveLength(3);
    expect(TEACHER1_STAGES.map((s) => s.name)).toEqual([
      "الصف الأول الثانوي",
      "الصف الثاني الثانوي",
      "الصف الثالث الثانوي",
    ]);
  });

  it("contains no non-secondary (preparatory/primary) educational stages", () => {
    for (const kw of FORBIDDEN_STAGE_KEYWORDS) {
      expect(allText).not.toContain(kw);
    }
  });

  it("has 12 Teacher 1 chapters (3-4 per stage) and a separate Teacher 2 chapter", () => {
    expect(TEACHER1_CHAPTERS).toHaveLength(12);
    expect(TEACHER2_CHAPTERS).toHaveLength(1);
  });

  it("gives every lesson a non-empty description and source text", () => {
    const lessons = [...TEACHER1_CHAPTERS, ...TEACHER2_CHAPTERS].flatMap((c) => c.lessons);
    expect(lessons.length).toBeGreaterThanOrEqual(30);
    for (const l of lessons) {
      expect(l.description.trim().length).toBeGreaterThan(0);
      expect(l.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("provides multi-paragraph rich text for the successful chapter lessons", () => {
    const success = TEACHER1_CHAPTERS.find((c) => c.id === FIXTURES.chapterId)!;
    expect(success.lessons).toHaveLength(3);
    for (const l of success.lessons) {
      expect(l.text.split("\n\n").length).toBeGreaterThanOrEqual(3);
      expect(l.text.length).toBeGreaterThan(400);
    }
  });

  it("exposes well-formed UUID fixtures", () => {
    for (const id of [
      FIXTURES.stageId,
      FIXTURES.chapterId,
      FIXTURES.lessonId1,
      FIXTURES.lessonId2,
      FIXTURES.unindexedChapterId,
      FIXTURES.otherTeacherChapterId,
      FIXTURES.otherTeacherLessonId,
      ACCOUNTS.teacher1.id,
      ACCOUNTS.student.id,
      ACCOUNTS.teacher2.id,
    ]) {
      expect(id).toMatch(UUID_RE);
    }
  });

  it("aligns the success fixture lessons with the success chapter", () => {
    const success = TEACHER1_CHAPTERS.find((c) => c.id === FIXTURES.chapterId)!;
    const lessonIds = success.lessons.map((l) => l.id);
    expect(lessonIds).toContain(FIXTURES.lessonId1);
    expect(lessonIds).toContain(FIXTURES.lessonId2);
    expect(FIXTURES.indexLessonIds).toEqual(lessonIds);
  });

  it("keeps the unindexed chapter distinct and owned within Teacher 1 content", () => {
    expect(FIXTURES.unindexedChapterId).not.toBe(FIXTURES.chapterId);
    const unindexed = TEACHER1_CHAPTERS.find((c) => c.id === FIXTURES.unindexedChapterId);
    expect(unindexed).toBeDefined();
    expect(unindexed!.lessons.length).toBeGreaterThan(0);
  });

  it("places the ownership fixture in Teacher 2 content only", () => {
    const t2 = TEACHER2_CHAPTERS[0]!;
    expect(t2.id).toBe(FIXTURES.otherTeacherChapterId);
    expect(t2.lessons.map((l) => l.id)).toContain(FIXTURES.otherTeacherLessonId);
    // The ownership chapter must not be any Teacher 1 chapter.
    expect(TEACHER1_CHAPTERS.map((c) => c.id)).not.toContain(t2.id);
  });

  it("uses local-only test emails", () => {
    for (const a of [ACCOUNTS.teacher1, ACCOUNTS.student, ACCOUNTS.teacher2]) {
      expect(a.email).toMatch(/@local\.test$/);
    }
  });

  it("fullId produces the project deterministic UUID shape", () => {
    expect(fullId("f4500100", 2)).toBe("f4500100-0001-4001-8001-000000000002");
  });
});

describe("local-guard", () => {
  it("allows a localhost database", () => {
    expect(
      assertLocalDatabase({
        nodeEnv: "development",
        databaseUrl: "postgresql://u:p@localhost:15432/db",
      }),
    ).toBe("localhost");
  });

  it("aborts when NODE_ENV=production", () => {
    expect(() =>
      assertLocalDatabase({
        nodeEnv: "production",
        databaseUrl: "postgresql://u:p@localhost:5432/db",
      }),
    ).toThrow(SeedGuardError);
  });

  it("aborts on a remote/non-local host", () => {
    expect(() =>
      assertLocalDatabase({
        nodeEnv: "development",
        databaseUrl: "postgresql://u:p@db.prod.example.com:5432/db",
      }),
    ).toThrow(SeedGuardError);
  });

  it("aborts when an explicit production flag is set", () => {
    expect(() =>
      assertLocalDatabase({
        nodeEnv: "development",
        databaseUrl: "postgresql://u:p@localhost:5432/db",
        productionFlag: "true",
      }),
    ).toThrow(SeedGuardError);
  });
});

describe("tracked Postman template", () => {
  const template = JSON.parse(
    readFileSync(
      join(process.cwd(), "postman", "Fahimni_Local.postman_environment.template.json"),
      "utf8",
    ),
  ) as { values: Array<{ key: string; value: string }> };

  const byKey = new Map(template.values.map((v) => [v.key, v.value]));

  it("ships every required variable key", () => {
    for (const key of [
      "baseUrl",
      "teacherEmail",
      "teacherPassword",
      "teacherUserId",
      "studentEmail",
      "studentPassword",
      "otherTeacherEmail",
      "stageId",
      "chapterId",
      "lessonId1",
      "lessonId2",
      "otherTeacherChapterId",
      "otherTeacherLessonId",
      "unindexedChapterId",
      "teacherToken",
      "createdQuizId",
    ]) {
      expect(byKey.has(key)).toBe(true);
    }
  });

  it("contains no credentials, IDs, or tokens", () => {
    for (const key of [
      "teacherPassword",
      "studentPassword",
      "otherTeacherPassword",
      "teacherEmail",
      "teacherUserId",
      "stageId",
      "chapterId",
      "teacherToken",
      "createdQuizId",
    ]) {
      expect(byKey.get(key)).toBe("");
    }
  });

  it("never embeds the known local password", () => {
    const raw = JSON.stringify(template);
    expect(raw).not.toContain("Story45Local@123");
  });
});
