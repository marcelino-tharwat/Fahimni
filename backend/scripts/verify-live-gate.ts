#!/usr/bin/env node
/** Live API verification against local dev server (port 3000). */
const BASE = 'http://127.0.0.1:3000';
const EMAIL = 'chem.student04@fahimni.test';
const PASS = 'ChemDemo#2026';
const A1 = '1bd1585a-4edf-5ee8-880f-268b13dbde36';
const A2 = 'b2ec31ae-e88f-535e-97e9-1877b42f1140';
const Q1 = 'ecdab4d1-8fb9-4888-9aba-f6436d9447e0';

async function main() {
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const cookie = loginRes.headers.getSetCookie?.()?.map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error(`Login failed ${loginRes.status}`);

  const complete = await fetch(`${BASE}/api/content/student/lessons/${A1}/complete`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  const completeJson = await complete.json();
  console.log('complete status', complete.status);
  console.log('nextLessonId', completeJson?.data?.nextLessonId);
  console.log('requiredQuizId', completeJson?.data?.requiredQuizId);
  console.log('quizzes.required', completeJson?.data?.quizzes?.required?.id ?? null);

  const tree = await fetch(`${BASE}/api/content/student/tree`, { headers: { Cookie: cookie } });
  const treeJson = await tree.json();
  const a2 = treeJson?.find?.((s) => true)?.chapters?.flatMap((c) => c.lessons)?.find((l) => l.id === A2)
    ?? treeJson.flatMap?.((s) => s.chapters).flatMap((c) => c.lessons).find((l) => l.id === A2);
  console.log('A2 tree access', a2?.isUnlocked, a2?.lockReason);

  const direct = await fetch(`${BASE}/api/content/student/lessons/${A2}`, { headers: { Cookie: cookie } });
  console.log('A2 direct status', direct.status, (await direct.json())?.code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
