import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { seedId } from "./ids.js";
import { getPasswordHash, daysAgo } from "./helpers.js";
import { SCALE, EMAIL_DOMAIN } from "./constants.js";

const SUBJECTS = [
  "الكيمياء", "الفيزياء", "الأحياء", "الرياضيات",
  "اللغة العربية", "اللغة الإنجليزية", "الجيولوجيا",
  "التربية الإسلامية", "التاريخ", "الجغرافيا",
  "الفلسفة", "العلوم",
] as const;

const TEACHER_BIOS = [
  "مدرّس متمكن في المادة وذو خبرة واسعة في تدريس المرحلة الثانوية.",
  "يهتم بطريقة العصف الذهني وربط المفاهيم بالحياة اليومية.",
  "خريج كلية التربية قسم المادّة وله عدة سنوات من الخبرة.",
  "يستخدم التقنيات الحديثة في التعليم ويحرص على تفاعل الطلاب.",
  "متخصص في إعداد الطلاب للامتحانات العامة بأساليب فعّالة.",
  "محبّ للتعليم ويهتم بتقديم المحتوى بطريقة مبسطة وممتعة.",
  "خبرة طويلة في تدريس المرحلة الثانوية وطلابه يحققون نتائج ممتازة.",
  "يهتم بالجوانب العملية والتطبيقية في المادة التعليمية.",
  "مدرّس حاصل على درجة عالية في تخصصه ويحب نقل المعرفة.",
  "يستخدم أساليب التعلم النشط والتعلم التعاوني مع الطلاب.",
];

const MALE_FIRST_NAMES = [
  "أحمد", "محمد", "علي", "حسن", "يوسف", "إبراهيم", "خالد", "عمر",
  "طارق", "مصطفى", "كريم", "ياسر", "سامي", "هاني", "جمال", "نادر",
  "رضا", "عمرو", "ماجد", "شريف", "وليد", "أمير", "فؤاد", "عادل",
  "حسام", "تامر", "بلال", "رامي", "معتز", "صفوت",
];

const FEMALE_FIRST_NAMES = [
  "فاطمة", "نورا", "سارة", "مريم", "هبة", "دينا", "رنا", "ياسمين",
  "سلمى", "هدى", "لمياء", "إيناس", "منى", "سمية", "هدية", "آية",
  "نجلاء", "حنان", "شيماء", "إنجاز", "رقية", "بشرى", "أماني", "فاطمة",
  "زينب", "خلود", "عبير", "ولاء", "نهى", "غادة",
];

const LAST_NAMES = [
  "محمد", "أحمد", "علي", "حسن", "إبراهيم", "عمر", "يوسف", "خالد",
  "السيد", "عبدالله", "مصطفى", "صالح", "حمدي", "فؤاد", "جابر",
  "الشريف", "عبدالعزيز", "سالم", "رشدي", "نور", "بدر", "عطية",
  "عيسى", "زكي", "رمضان", "طارق", "ماجد", "كريم", "هشام",
];

function deterministicEmail(prefix: string, index: number): string {
  return `${prefix}${index}@${EMAIL_DOMAIN}`;
}

function deterministicMobile(index: number): string {
  const prefixes = ["010", "011", "012", "015"];
  const prefix = prefixes[index % prefixes.length]!;
  const seq = String(10000000 + index).slice(-8);
  return prefix + seq;
}

function pickName(index: number, gender: "male" | "female"): string {
  if (gender === "male") {
    return MALE_FIRST_NAMES[index % MALE_FIRST_NAMES.length]!;
  }
  return FEMALE_FIRST_NAMES[index % FEMALE_FIRST_NAMES.length]!;
}

function pickLast(index: number): string {
  return LAST_NAMES[index % LAST_NAMES.length]!;
}

interface SeedUser {
  id: string;
  email: string;
  fullName: string;
  mobile: string;
  role: "ADMIN" | "OPERATION" | "STUDENT";
  status: "ACTIVE" | "INACTIVE" | "BANNED";
  teacherApprovalState: "NONE" | "APPROVED" | "PENDING_REVIEW" | "REJECTED";
  locale: string;
  emailVerified: boolean;
}

interface SeedTeacherUser extends SeedUser {
  role: "OPERATION";
  teacherApprovalState: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
  profileId: string;
  subject: string;
  bio: string;
}

interface SeedStudentUser extends SeedUser {
  role: "STUDENT";
  profileId: string;
  stageIndex: number;
}

const STATUS_OPTIONS: SeedUser["status"][] = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "INACTIVE"];

export interface UsersSeedResult {
  admins: SeedUser[];
  operations: SeedUser[];
  teachers: SeedTeacherUser[];
  students: SeedStudentUser[];
}

export async function seedUsers(prisma: PrismaClient): Promise<UsersSeedResult> {
  const password = await getPasswordHash();

  // ── Admins ──
  const admins: SeedUser[] = [];
  for (let i = 0; i < SCALE.ADMINS; i++) {
    const firstName = pickName(i, "male");
    const lastName = pickLast(i);
    admins.push({
      id: seedId(`admin-${i}`),
      email: i === 0 ? `admin@${EMAIL_DOMAIN}` : `admin${i}@${EMAIL_DOMAIN}`,
      fullName: i === 0 ? "Admin" : `${firstName} ${lastName}`,
      mobile: deterministicMobile(i),
      role: "ADMIN",
      status: "ACTIVE",
      teacherApprovalState: "APPROVED",
      locale: "ar",
      emailVerified: true,
    });
  }

  // ── Operations ──
  const operations: SeedUser[] = [];
  for (let i = 0; i < SCALE.OPERATIONS; i++) {
    const gender = i % 2 === 0 ? "male" as const : "female" as const;
    const firstName = pickName(i + 100, gender);
    const lastName = pickLast(i + 100);
    operations.push({
      id: seedId(`operation-${i}`),
      email: `operation${i}@${EMAIL_DOMAIN}`,
      fullName: `${firstName} ${lastName}`,
      mobile: deterministicMobile(1000 + i),
      role: "OPERATION",
      status: "ACTIVE",
      teacherApprovalState: "NONE",
      locale: "ar",
      emailVerified: true,
    });
  }

  // ── Teachers ──
  const teachers: SeedTeacherUser[] = [];
  for (let i = 0; i < SCALE.TEACHERS; i++) {
    const gender = i % 3 === 0 ? "female" as const : "male" as const;
    const firstName = pickName(i, gender);
    const lastName = pickLast(i + 10);
    const subject = SUBJECTS[i % SUBJECTS.length]!;
    const bio = TEACHER_BIOS[i % TEACHER_BIOS.length]!;
    const approvalState = i < SCALE.TEACHERS - 3
      ? "APPROVED" as const
      : i < SCALE.TEACHERS - 1
        ? "PENDING_REVIEW" as const
        : "REJECTED" as const;

    teachers.push({
      id: seedId(`teacher-${i}`),
      email: deterministicEmail("teacher", i),
      fullName: `${firstName} ${lastName}`,
      mobile: deterministicMobile(2000 + i),
      role: "OPERATION",
      status: approvalState === "REJECTED" ? "INACTIVE" : "ACTIVE",
      teacherApprovalState: approvalState,
      locale: "ar",
      emailVerified: true,
      profileId: seedId(`teacher-profile-${i}`),
      subject,
      bio,
    });
  }

  // ── Students ──
  const students: SeedStudentUser[] = [];
  for (let i = 0; i < SCALE.STUDENTS; i++) {
    const gender = i % 3 === 0 ? "female" as const : "male" as const;
    const firstName = pickName(i + 20, gender);
    const lastName = pickLast(i + 30);
    const stageIndex = i % 3;
    students.push({
      id: seedId(`student-${i}`),
      email: deterministicEmail("student", i),
      fullName: `${firstName} ${lastName}`,
      mobile: deterministicMobile(3000 + i),
      role: "STUDENT",
      status: pickStatus(i),
      teacherApprovalState: "NONE",
      locale: "ar",
      emailVerified: true,
      profileId: seedId(`student-profile-${i}`),
      stageIndex,
    });
  }

  // ── Batch insert users ──
  const allUsers = [...admins, ...operations, ...teachers.map(t => ({
    id: t.id, email: t.email, fullName: t.fullName, mobile: t.mobile,
    role: t.role as "OPERATION", status: t.status,
    teacherApprovalState: t.teacherApprovalState,
    locale: t.locale, emailVerified: t.emailVerified,
  })), ...students.map(s => ({
    id: s.id, email: s.email, fullName: s.fullName, mobile: s.mobile,
    role: s.role as "STUDENT", status: s.status,
    teacherApprovalState: s.teacherApprovalState,
    locale: s.locale, emailVerified: s.emailVerified,
  }))];

  await prisma.user.createMany({
    data: allUsers.map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      mobile: u.mobile,
      password,
      role: u.role,
      status: u.status,
      teacherApprovalState: u.teacherApprovalState,
      locale: u.locale,
      emailVerified: u.emailVerified,
    })),
    skipDuplicates: true,
  });

  // ── Teacher profiles (only for users that actually exist in DB) ──
  const createdTeacherIds = teachers.map(t => t.id);
  const existingTeachers = await prisma.user.findMany({
    where: { id: { in: createdTeacherIds } },
    select: { id: true },
  });
  const existingTeacherIdSet = new Set(existingTeachers.map(u => u.id));

  const validTeachers = teachers.filter(t => existingTeacherIdSet.has(t.id));

  for (const t of validTeachers) {
    await prisma.teacherProfile.upsert({
      where: { userId: t.id },
      create: {
        id: t.profileId,
        userId: t.id,
        subject: t.subject,
        bio: t.bio,
      },
      update: {
        subject: t.subject,
        bio: t.bio,
      },
    });
  }

  // ── Student profiles (only for users that actually exist in DB) ──
  const stages = await prisma.stage.findMany({ orderBy: { sortOrder: "asc" } });
  if (stages.length >= 3) {
    const createdStudentIds = students.map(s => s.id);
    const existingStudents = await prisma.user.findMany({
      where: { id: { in: createdStudentIds } },
      select: { id: true },
    });
    const existingStudentIdSet = new Set(existingStudents.map(u => u.id));

    const validStudents = students.filter(s => existingStudentIdSet.has(s.id));

    for (const s of validStudents) {
      await prisma.studentProfile.upsert({
        where: { userId: s.id },
        create: {
          id: s.profileId,
          userId: s.id,
          stageId: stages[s.stageIndex]!.id,
        },
        update: {
          stageId: stages[s.stageIndex]!.id,
        },
      });
    }
  }

  return { admins, operations, teachers, students };
}

function pickStatus(index: number): "ACTIVE" | "INACTIVE" {
  return STATUS_OPTIONS[index % STATUS_OPTIONS.length]!;
}
