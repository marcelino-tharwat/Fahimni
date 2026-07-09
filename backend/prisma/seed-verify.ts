import "dotenv/config";
import { prisma } from "../src/config/database.js";

const DEMO_EMAIL_DOMAIN = "@fahimni.local";
const DEMO_ORDER_PREFIX = "DEMO_";
const DEMO_REF_PREFIX = "DEMO_";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  // 1. Admin exists
  const admin = await prisma.user.findUnique({ where: { email: "admin" + DEMO_EMAIL_DOMAIN } });
  check("Admin user exists", !!admin, admin?.email ?? "not found");
  check("Admin has ADMIN role", admin?.role === "ADMIN");
  check("Admin has ACTIVE status", admin?.status === "ACTIVE");

  // 2. Teachers exist (OPERATION role)
  const teachers = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN }, role: "OPERATION" },
  });
  check("At least 3 teachers", teachers.length >= 3, `${teachers.length} found`);

  // 3. Students exist
  const students = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN }, role: "STUDENT" },
  });
  check("At least 5 students", students.length >= 5, `${students.length} found`);
  const studentIds = students.map((s) => s.id);

  // 4. All seed accounts have ACTIVE status — EXCEPT teachers deliberately left
  //    INACTIVE by the lifecycle demo (PENDING_REVIEW / REJECTED are not active).
  const allSeed = await prisma.user.findMany({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } } });
  const shouldBeActive = allSeed.filter(
    (u) => u.teacherApprovalState !== "PENDING_REVIEW" && u.teacherApprovalState !== "REJECTED",
  );
  check(
    "All active-lifecycle seed accounts ACTIVE",
    shouldBeActive.every((u) => u.status === "ACTIVE"),
    `${shouldBeActive.length}/${allSeed.length} users`,
  );

  // 5. Student without any enrollment
  const enrolledStudentIds = (
    await prisma.enrollment.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true },
      distinct: ["studentId"],
    })
  ).map((e) => e.studentId);
  const noEnrollmentStudents = studentIds.filter((id) => !enrolledStudentIds.includes(id));
  check("At least 1 student without enrollment", noEnrollmentStudents.length >= 1, `${noEnrollmentStudents.length} found`);

  // 6. Student without active teacher (no ACTIVE enrollment)
  const activeEnrolledIds = (
    await prisma.enrollment.findMany({
      where: { studentId: { in: studentIds }, status: "ACTIVE" },
      select: { studentId: true },
      distinct: ["studentId"],
    })
  ).map((e) => e.studentId);
  const withoutActiveTeacher = studentIds.filter((id) => !activeEnrolledIds.includes(id));
  check("At least 1 student without active teacher", withoutActiveTeacher.length >= 1, `${withoutActiveTeacher.length} found`);

  // 7. Multi-teacher student exists
  const multiTeacherIds = (
    await prisma.$queryRaw<{ studentId: string; teacherCount: bigint }[]>`
      SELECT e."studentId", COUNT(DISTINCT s."teacherId") AS "teacherCount"
      FROM enrollments e
      JOIN chapters c ON c.id = e."chapterId"
      JOIN stages s ON s.id = c."stageId"
      WHERE e."studentId" = ANY(${studentIds}::text[])
      GROUP BY e."studentId"
      HAVING COUNT(DISTINCT s."teacherId") >= 2
    `
  );
  check("At least 1 multi-teacher student", multiTeacherIds.length >= 1, `${multiTeacherIds.length} found`);

  // 8. ACTIVE enrollment exists
  const activeEnrollments = await prisma.enrollment.count({ where: { studentId: { in: studentIds }, status: "ACTIVE" } });
  check("At least 1 ACTIVE enrollment", activeEnrollments >= 1, `${activeEnrollments} found`);

  // 9. PAYMENT_PENDING enrollment exists
  const pendingEnrollments = await prisma.enrollment.count({ where: { studentId: { in: studentIds }, status: "PAYMENT_PENDING" } });
  check("At least 1 PAYMENT_PENDING enrollment", pendingEnrollments >= 1, `${pendingEnrollments} found`);

  // 10. SUCCESS course payment exists
  const successPayments = await prisma.paymentTransaction.count({
    where: { status: "SUCCESS", paymobOrderId: { startsWith: DEMO_ORDER_PREFIX } },
  });
  check("At least 1 SUCCESS course payment", successPayments >= 1, `${successPayments} found`);

  // 11. PENDING/FAILED course payment exists
  const nonSuccessPayments = await prisma.paymentTransaction.count({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      paymobOrderId: { startsWith: DEMO_ORDER_PREFIX },
    },
  });
  check("At least 1 PENDING/FAILED course payment", nonSuccessPayments >= 1, `${nonSuccessPayments} found`);

  // 12. Teacher plans exist
  const planCount = await prisma.teacherPlan.count({ where: { isActive: true } });
  check("Teacher plans exist", planCount >= 3, `${planCount} active plans`);

  // 12a. FREE plan exists and is always active
  const freePlan = await prisma.teacherPlan.findUnique({ where: { code: "FREE" } });
  check("FREE plan exists", !!freePlan, freePlan?.code ?? "missing");
  check("FREE plan is always active", freePlan?.isActive === true);

  // 12b. Recommended plan exists (exactly one)
  const recommendedPlans = await prisma.teacherPlan.findMany({ where: { isRecommended: true } });
  check("Exactly one recommended plan", recommendedPlans.length === 1, `${recommendedPlans.length} found`);

  // 12c. Plans have non-empty features (Record<string, boolean>)
  const allPlans = await prisma.teacherPlan.findMany({ select: { code: true, features: true } });
  const plansWithFeatures = allPlans.filter((p) => typeof p.features === "object" && p.features !== null && Object.keys(p.features as Record<string, unknown>).length > 0);
  check("All plans have non-empty features", plansWithFeatures.length === allPlans.length, `${plansWithFeatures.length}/${allPlans.length}`);

  // 12d. Subscription exists for a non-FREE plan
  const nonFreeSub = await prisma.teacherSubscription.findFirst({
    where: { plan: { code: { not: "FREE" } }, status: "ACTIVE" },
    select: { id: true, planId: true },
  });
  check("Active subscription on non-FREE plan exists", !!nonFreeSub, nonFreeSub ? "found" : "missing");

  // 13. TeacherSubscriptionPayment exists (SUCCESS/PENDING/FAILED)
  const tspSuccess = await prisma.teacherSubscriptionPayment.count({
    where: { status: "SUCCESS", providerOrderId: { startsWith: DEMO_ORDER_PREFIX } },
  });
  const tspPending = await prisma.teacherSubscriptionPayment.count({
    where: { status: "PENDING", providerOrderId: { startsWith: DEMO_ORDER_PREFIX } },
  });
  const tspFailed = await prisma.teacherSubscriptionPayment.count({
    where: { status: "FAILED", providerOrderId: { startsWith: DEMO_ORDER_PREFIX } },
  });
  check("TeacherSubscriptionPayment SUCCESS exists", tspSuccess >= 1, `${tspSuccess} found`);
  check("TeacherSubscriptionPayment PENDING exists", tspPending >= 1, `${tspPending} found`);
  check("TeacherSubscriptionPayment FAILED exists", tspFailed >= 1, `${tspFailed} found`);

  // 14. No duplicate seed records
  const uniqueEmails = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN } },
    select: { email: true },
  });
  const emailSet = new Set(uniqueEmails.map((u) => u.email));
  check("No duplicate seed emails", uniqueEmails.length === emailSet.size);

  // 15. Stages/chapters/lessons exist
  const stages = await prisma.stage.count({ where: { teacherId: { in: teachers.map((t) => t.id) } } });
  check("Stages exist per teacher", stages >= 3, `${stages} stages`);
  const chapters = await prisma.chapter.count();
  check("Chapters exist", chapters >= 6, `${chapters} chapters`);
  const lessons = await prisma.lesson.count();
  check("Lessons exist", lessons >= 18, `${lessons} lessons`);

  // 16. Teacher profiles exist
  const profiles = await prisma.teacherProfile.count({ where: { userId: { in: teachers.map((t) => t.id) } } });
  check("Teacher profiles exist", profiles >= 3, `${profiles} profiles`);

  // 17. Quizzes exist
  const quizzes = await prisma.quiz.count({ where: { createdBy: { in: teachers.map((t) => t.id) } } });
  check("Quizzes exist", quizzes >= 6, `${quizzes} quizzes`);

  // 18. Quiz attempts exist
  const attempts = await prisma.quizAttempt.count({ where: { studentId: { in: studentIds } } });
  check("Quiz attempts exist", attempts >= 5, `${attempts} attempts`);

  // 19. Teacher subscription requests exist
  const subRequests = await prisma.teacherSubscriptionRequest.count({
    where: { teacherId: { in: teachers.map((t) => t.id) } },
  });
  check("Subscription requests exist", subRequests >= 3, `${subRequests} found`);

  // 20. Teacher registration requests exist
  const regRequests = await prisma.teacherRegistrationRequest.count({
    where: { publicReference: { startsWith: DEMO_REF_PREFIX } },
  });
  check("Registration requests exist", regRequests >= 3, `${regRequests} found`);

  // 20a. A linked PENDING teacher request exists (unified-registration flow) with a
  //      pending OPERATION user in teacherApprovalState = PENDING_REVIEW.
  const linkedPending = await prisma.teacherRegistrationRequest.findFirst({
    where: { status: "PENDING", userId: { not: null } },
    select: { userId: true },
  });
  check("Linked pending teacher request exists", !!linkedPending, linkedPending ? "found" : "missing");
  if (linkedPending?.userId) {
    const pendingUser = await prisma.user.findUnique({
      where: { id: linkedPending.userId },
      select: { role: true, teacherApprovalState: true, status: true },
    });
    check(
      "Linked pending teacher user is OPERATION + PENDING_REVIEW",
      pendingUser?.role === "OPERATION" &&
        pendingUser?.teacherApprovalState === "PENDING_REVIEW",
      `role=${pendingUser?.role} state=${pendingUser?.teacherApprovalState}`,
    );
  }

  // 20b. STUDENT users carry teacherApprovalState = NONE.
  const studentsWithTeacherState = await prisma.user.count({
    where: { role: "STUDENT", teacherApprovalState: { not: "NONE" } },
  });
  check("STUDENT users have teacherApprovalState = NONE", studentsWithTeacherState === 0, `${studentsWithTeacherState} deviating`);

  // 20c. Teacher lifecycle cases for the payment-gate flow.
  const rejectedTeacher = await prisma.user.findFirst({
    where: { role: "OPERATION", teacherApprovalState: "REJECTED" },
    select: { status: true },
  });
  check(
    "Rejected teacher exists and is INACTIVE (blocked)",
    rejectedTeacher?.status === "INACTIVE",
    rejectedTeacher ? `status=${rejectedTeacher.status}` : "missing",
  );

  const approvedTeachers = await prisma.user.findMany({
    where: { role: "OPERATION", teacherApprovalState: "APPROVED" },
    select: { id: true, status: true },
  });
  const now = new Date();
  let approvedUnpaid = false;
  let activePaid = false;
  for (const t of approvedTeachers) {
    if (t.status !== "ACTIVE") continue;
    const activeSub = await prisma.teacherSubscription.findFirst({
      where: { teacherId: t.id, status: "ACTIVE", currentPeriodEnd: { gt: now } },
      select: { id: true },
    });
    if (activeSub) activePaid = true;
    else approvedUnpaid = true;
  }
  check("Approved-free teacher exists (ACTIVE, APPROVED, no active sub → FREE plan)", approvedUnpaid);
  check("Active-paid teacher exists (APPROVED + ACTIVE + active subscription)", activePaid);

  // 20d. A linked request carries fake proofDocuments.
  const reqWithDocs = await prisma.teacherRegistrationRequest.findFirst({
    where: { userId: { not: null }, NOT: { proofDocuments: { equals: [] } } },
    select: { id: true },
  });
  check("Linked request with proofDocuments exists", !!reqWithDocs, reqWithDocs ? "found" : "missing");

  // 20e. Approved FREE teachers with a PENDING / FAILED payment but NO active paid
  //      subscription — proves an unconfirmed/failed payment does not upgrade and
  //      does not remove FREE access. Both must resolve to no active subscription.
  const pendingPaymentTeacher = await prisma.user.findUnique({
    where: { email: "teacher.pending.payment" + DEMO_EMAIL_DOMAIN },
    select: { id: true, teacherApprovalState: true, status: true },
  });
  if (pendingPaymentTeacher) {
    const pendingPay = await prisma.teacherSubscriptionPayment.count({
      where: { teacherId: pendingPaymentTeacher.id, status: "PENDING" },
    });
    const activeSub = await prisma.teacherSubscription.count({
      where: { teacherId: pendingPaymentTeacher.id, status: "ACTIVE", currentPeriodEnd: { gt: now } },
    });
    check(
      "Pending-payment teacher is APPROVED+ACTIVE, has PENDING payment, NO active sub (stays FREE)",
      pendingPaymentTeacher.teacherApprovalState === "APPROVED" &&
        pendingPaymentTeacher.status === "ACTIVE" &&
        pendingPay >= 1 &&
        activeSub === 0,
      `pendingPay=${pendingPay} activeSub=${activeSub}`,
    );
  } else {
    check("Pending-payment teacher exists", false, "missing");
  }

  const failedPaymentTeacher = await prisma.user.findUnique({
    where: { email: "teacher.failed.payment" + DEMO_EMAIL_DOMAIN },
    select: { id: true, teacherApprovalState: true, status: true },
  });
  if (failedPaymentTeacher) {
    const failedPay = await prisma.teacherSubscriptionPayment.count({
      where: { teacherId: failedPaymentTeacher.id, status: "FAILED" },
    });
    const activeSub = await prisma.teacherSubscription.count({
      where: { teacherId: failedPaymentTeacher.id, status: "ACTIVE", currentPeriodEnd: { gt: now } },
    });
    check(
      "Failed-payment teacher is APPROVED+ACTIVE, has FAILED payment, NO active sub (stays FREE)",
      failedPaymentTeacher.teacherApprovalState === "APPROVED" &&
        failedPaymentTeacher.status === "ACTIVE" &&
        failedPay >= 1 &&
        activeSub === 0,
      `failedPay=${failedPay} activeSub=${activeSub}`,
    );
  } else {
    check("Failed-payment teacher exists", false, "missing");
  }

  // 20f. A linked request carries a multi-document proof set with at least one PDF,
  //      one image, and one document missing a storage path (renders UNAVAILABLE).
  const multiDocReq = await prisma.teacherRegistrationRequest.findFirst({
    where: { publicReference: DEMO_REF_PREFIX + "REQ_006" },
    select: { proofDocuments: true },
  });
  const docs = Array.isArray(multiDocReq?.proofDocuments)
    ? (multiDocReq!.proofDocuments as unknown as { mimeType?: string; path?: string }[])
    : [];
  const hasPdf = docs.some((d) => d?.mimeType === "application/pdf");
  const hasImage = docs.some((d) => typeof d?.mimeType === "string" && d.mimeType.startsWith("image/"));
  const hasUnavailable = docs.some((d) => !d?.path);
  check(
    "Multi-doc request has PDF + image + unavailable document",
    docs.length >= 3 && hasPdf && hasImage && hasUnavailable,
    `count=${docs.length} pdf=${hasPdf} image=${hasImage} unavailable=${hasUnavailable}`,
  );

  // 21. AI usage events exist
  const aiEvents = await prisma.teacherAiUsageEvent.count({
    where: { teacherId: { in: teachers.map((t) => t.id) } },
  });
  check("AI usage events exist", aiEvents >= 5, `${aiEvents} events`);

  // 22. Promo codes exist
  const promos = await prisma.promoCode.count({ where: { code: { startsWith: "DEMO" } } });
  check("Promo codes exist", promos >= 3, `${promos} found`);

  // 23. Teacher subscriptions exist
  const subs = await prisma.teacherSubscription.count({
    where: { teacherId: { in: teachers.map((t) => t.id) } },
  });
  check("Teacher subscriptions exist", subs >= 3, `${subs} found`);

  // 24. Courses have prices (for payment test scenarios)
  const paidChapters = await prisma.chapter.count({ where: { price: { not: null } } });
  check("Paid chapters exist", paidChapters >= 3, `${paidChapters} with price`);

  // Summary
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("verify failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
