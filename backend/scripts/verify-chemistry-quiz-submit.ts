/**
 * One-off verification: Chemistry seed quiz submission accepts UUID question IDs.
 * Run: npx tsx scripts/verify-chemistry-quiz-submit.ts
 */
import "dotenv/config";
import { seedId } from "../src/seed/chemistry-ids.js";
import { buildQuestions } from "../src/seed/chemistry-seed.fixtures.js";

const BASE = process.env.API_BASE ?? "http://localhost:3000";
const EMAIL = "chem.student05@fahimni.test";
const PASSWORD = process.env.SEED_LOCAL_PASSWORD ?? "ChemDemo#2026";

const quizId = seedId("quiz-ch2");
const questions = buildQuestions(quizId, 1);

async function main(): Promise<void> {
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginJson = (await loginRes.json()) as { success?: boolean };
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  const access = setCookie
    .split(",")
    .map((c) => c.trim())
    .find((c) => c.startsWith("access_token="))
    ?.split(";")[0];
  if (!access) {
    throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginJson)}`);
  }

  const startRes = await fetch(`${BASE}/api/quizzes/${quizId}/attempt`, {
    method: "POST",
    headers: { Cookie: access },
  });
  const startJson = (await startRes.json()) as {
    success?: boolean;
    data?: { attemptId: string; questions: Array<{ id: string }> };
    message?: string;
    errors?: unknown;
  };
  if (!startRes.ok) {
    throw new Error(`Start attempt failed: ${startRes.status} ${JSON.stringify(startJson)}`);
  }

  const attemptId = startJson.data!.attemptId;
  const apiQuestionIds = startJson.data!.questions.map((q) => q.id);
  for (const id of apiQuestionIds) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new Error(`Non-UUID question id from API: ${id}`);
    }
  }

  const submitBody = {
    answers: [
      { questionId: questions[0]!.id, answer: "نترات الفضة" },
      { questionId: questions[1]!.id, answer: "true" },
      { questionId: questions[2]!.id, answer: "إجابة تجريبية للتحقق." },
    ],
  };

  const submitRes = await fetch(`${BASE}/api/attempts/${attemptId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: access },
    body: JSON.stringify(submitBody),
  });
  const submitJson = (await submitRes.json()) as {
    success?: boolean;
    message?: string;
    errors?: unknown;
    data?: { status: string; score: number; results: Array<{ questionId: string; result: string }> };
  };

  console.log(
    JSON.stringify(
      {
        quizId,
        attemptId,
        apiQuestionIds,
        submitStatus: submitRes.status,
        submitSuccess: submitJson.success,
        submitMessage: submitJson.message,
        submitErrors: submitJson.errors,
        resultStatus: submitJson.data?.status,
        mcqResult: submitJson.data?.results?.find((r) => r.questionId === questions[0]!.id)?.result,
        tfResult: submitJson.data?.results?.find((r) => r.questionId === questions[1]!.id)?.result,
        essayResult: submitJson.data?.results?.find((r) => r.questionId === questions[2]!.id)?.result,
      },
      null,
      2,
    ),
  );

  if (submitRes.status !== 200 || submitJson.message === "Validation error") {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
