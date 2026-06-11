# معمارية المشروع (Architecture)

## نظرة عامة

هذا المشروع عبارة عن REST API مبني بـ **Express** و **TypeScript** مع قاعدة بيانات **PostgreSQL** عبر **Prisma**. الهدف من هذه المرحلة تجهيز البنية الأساسية للأمان، إدارة المستخدمين، والتحقق من صحة البيانات قبل بناء باقي الموديولات.

---

## 1. Global Error Handler (معالج الأخطاء العام)

### المطلوب
معالجة كل الأخطاء في مكان واحد بدل تكرار `try/catch` في كل controller.

### التنفيذ
- الملف: `src/shared/middlewares/errorHandler.middleware.ts`
- يُربط في نهاية سلسلة الـ middleware داخل `src/app.ts`
- يتعامل مع:
  - **أخطاء Zod** (Validation): يرجع `400` مع تفاصيل الحقول
  - **أخطاء التطبيق** (مثل `Invalid credentials`): يرجع الـ status المحدد (401, 404, 409...)
  - **أخطاء غير متوقعة**: يرجع `500` مع تسجيل الخطأ في الـ logger

### تدفق الطلب

```
Request → Routes → Controller → Service → (خطأ) → errorHandler → Response
```

---

## 2. Rate Limiting Middleware (تحديد معدل الطلبات)

### المطلوب
حماية الـ API من إساءة الاستخدام (Brute Force / Spam).

### التنفيذ
- الملف: `src/shared/middlewares/rateLimiter.middleware.ts`
- يستخدم `express-rate-limit`
- الإعدادات الحالية:
  - **100 طلب** لكل IP
  - خلال **15 دقيقة**
- يُطبّق على كل الطلبات بعد الـ middleware الأساسية (helmet, cors, json parser)

---

## 3. User Model (نموذج المستخدم)

### المطلوب
تعريف مستخدم يحتوي على:

| الحقل | النوع | الوصف |
|-------|------|-------|
| `fullName` | String | الاسم الكامل |
| `email` | String | البريد الإلكتروني (فريد) |
| `password` | String | كلمة المرور (مشفّرة) |
| `mobile` | String | رقم الموبايل (فريد) |
| `role` | Enum | الدور: `ADMIN` / `STUDENT` / `OPERATION` |

### التنفيذ
- Schema: `prisma/schema.prisma`
- Enum `Role` بقيم: `ADMIN`, `STUDENT`, `OPERATION`
- القيمة الافتراضية للدور: `STUDENT`
- Types: `src/modules/users/user.types.ts`

---

## 4. Validation (التحقق من صحة البيانات)

### المطلوب
التحقق من بيانات المستخدم قبل الحفظ في قاعدة البيانات.

### التنفيذ
- الملف: `src/modules/users/user.validation.ts`
- يستخدم **Zod** للتحقق من:
  - `fullName`: من 2 إلى 100 حرف
  - `email`: بريد إلكتروني صالح
  - `password`: 8 أحرف على الأقل
  - `mobile`: رقم مصري بصيغة `01xxxxxxxxx`
  - `role`: أحد الأدوار الثلاثة
- Middleware عام: `src/shared/middlewares/validate.middleware.ts`
- يُستخدم في:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/users`

---

## 5. Seed Admin Account (إنشاء حساب الأدمن)

### المطلوب
إنشاء حساب مدير النظام تلقائياً عند تشغيل الـ seed.

### التنفيذ
- الملف: `prisma/seed.ts`
- يستخدم `upsert` حتى لا يتكرر الحساب
- بيانات الأدمن الافتراضية (قابلة للتغيير من `.env`):

| المتغير | القيمة الافتراضية |
|---------|-------------------|
| `ADMIN_EMAIL` | admin@example.com |
| `ADMIN_PASSWORD` | Admin@123456 |
| `ADMIN_FULL_NAME` | System Administrator |
| `ADMIN_MOBILE` | 01000000000 |

### تشغيل الـ Seed

```bash
npm run db:migrate
npm run db:seed
```

---

## 6. هيكل المجلدات

```
src/
├── app.ts                          # إعداد Express + middleware
├── server.ts                       # تشغيل السيرفر
├── config/
│   ├── database.ts                 # Prisma Client
│   └── env.ts                      # متغيرات البيئة
├── modules/
│   ├── auth/                       # تسجيل / دخول
│   └── users/                      # إدارة المستخدمين
└── shared/
    ├── middlewares/
    │   ├── errorHandler.middleware.ts
    │   ├── rateLimiter.middleware.ts
    │   ├── notFound.middleware.ts
    │   └── validate.middleware.ts
    └── utils/
prisma/
├── schema.prisma                   # User model + Role enum
└── seed.ts                         # Admin seed
```

---

## 7. API Endpoints الحالية

| Method | Path | الوصف |
|--------|------|-------|
| GET | `/health` | فحص حالة السيرفر |
| POST | `/api/auth/register` | تسجيل مستخدم جديد (دور STUDENT) |
| POST | `/api/auth/login` | تسجيل الدخول |
| GET | `/api/users` | قائمة المستخدمين |
| POST | `/api/users` | إنشاء مستخدم (مع تحديد الدور) |

---

## 8. خطوات التشغيل

1. انسخ `.env.example` إلى `.env` وعدّل `DATABASE_URL`
2. شغّل PostgreSQL (مثلاً عبر Docker):

```bash
docker compose up -d postgres
```

3. نفّذ المigrations وولّد Prisma Client:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

> **ملاحظة (Prisma v7):** إعداد الاتصال بقاعدة البيانات موجود في `prisma.config.ts`، وPrisma Client يُولَّد في `src/generated/prisma` مع استخدام `@prisma/adapter-pg` للاتصال بـ PostgreSQL.

4. شغّل السيرفر:

```bash
npm run dev
```

---

## 9. ملخص المتطلبات المنفّذة

| المتطلب | الحالة | الملف/المكان |
|---------|--------|--------------|
| Global Error Handler | ✅ | `errorHandler.middleware.ts` + `app.ts` |
| Rate Limiting | ✅ | `rateLimiter.middleware.ts` + `app.ts` |
| User Model (fullName, email, password, mobile, roles) | ✅ | `prisma/schema.prisma` |
| Validation | ✅ | `user.validation.ts` + `validate.middleware.ts` |
| Seed Admin | ✅ | `prisma/seed.ts` |
| توثيق المعمارية بالعربي | ✅ | هذا الملف |
