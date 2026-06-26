# Teacher AI Academy — Sprint Backlog

**83 stories · 4 sprints · 216 points**

---

## Sprint 1: Foundation — Auth, Profiles, Infrastructure, Deployment

**Goal:** Users register, login, reset passwords, manage profiles. Full stack deploys to AWS with CI/CD.

**Points:** 56

---

**STORY-1**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Express.js backend scaffolding with PostgreSQL and Prisma

**Points:** 3

**Description:** As a developer, I want an Express.js project initialized with Prisma, PostgreSQL connection, and middleware foundation so that the team can build backend features on a standardized foundation.

**Acceptance criteria:**

- [ ] Express.js + TypeScript project initialized with Prisma, express-rate-limit, Sentry
- [ ] PostgreSQL connection configured via env variables (host, port, username, password, database)
- [ ] Base Prisma schema with id (UUID), createdAt, updatedAt fields
- [ ] Database connection verified on startup (Prisma validate)
- [ ] Health check endpoint (GET /health) returning DB connection status
- [ ] .env.example with all required variables documented

**Files to create/modify:** package.json, tsconfig.json, src/index.ts, src/app.ts, src/config/database.ts, src/config/app.ts, prisma/schema.prisma, prisma/seed.ts, src/middleware/error-handler.ts, src/routes/health.ts, .env.example

**Dependencies:** None

---

**STORY-2**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** React frontend scaffolding with routing, i18n, and theme

**Points:** 3

**Description:** As a developer, I want a React app initialized with Vite, React Router, i18next (AR/EN), axios instance, and Deep Purple/Cyan theme so that the team can build frontend features on a standardized foundation.

**Acceptance criteria:**

- [ ] Vite + React + TypeScript project initialized with strict mode
- [ ] React Router v6 configured with route constants file
- [ ] axios instance with base URL, JWT interceptor (attach token), and error interceptor
- [ ] i18next configured for Arabic (default) and English with lazy-loaded translation files
- [ ] RTL direction set for Arabic, LTR for English via styled-components or CSS variables
- [ ] Cairo font (Google Fonts) imported and applied globally with fallback stack
- [ ] CSS custom properties defined: --color-primary (#1A103D), --color-accent (#00C9DB), --radius-button (12px), --radius-card (14px), --radius-input (10px), --input-height (48px)
- [ ] Base layout components: AppShell (Header + main slot + Footer skeleton)

**Files to create/modify:** package.json, vite.config.ts, tsconfig.json, index.html, src/main.tsx, src/App.tsx, src/i18n/i18n.ts, src/i18n/ar/common.json, src/i18n/en/common.json, src/theme/variables.css, src/theme/ThemeProvider.tsx, src/router/routes.ts, src/router/Router.tsx, src/api/axios.ts, src/components/layout/AppShell.tsx, src/components/layout/Header.tsx

**Dependencies:** None

---

**STORY-3**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** User Prisma schema and seed

**Points:** 2

**Description:** As a developer, I want the User model defined in the Prisma schema with a corresponding migration so that authentication and profile features have a data model to work with.

**Acceptance criteria:**

- [ ] User model with fields: id (UUID), phone (unique, not null), email (unique, nullable), passwordHash (not null), fullName (not null), role (enum: teacher/student), isActive (boolean, default true), lastLoginAt (timestamp, nullable), createdAt, updatedAt
- [ ] Prisma migration creates the users table with proper indexes (phone, email, role)
- [ ] User model uses Prisma client for all queries
- [ ] Repository abstraction via Prisma service wrapper
- [ ] Seed script for dev/test users (one teacher, one student)

**Files to create/modify:** prisma/schema.prisma (User model), prisma/migrations/001_create_users, src/modules/users/users.service.ts, src/modules/users/users.repository.ts, prisma/seed.ts

**Dependencies:** STORY-1

---

**STORY-4**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Registration API endpoint

**Points:** 3

**Description:** As a visitor, I want to register as a teacher or student using my phone number, name, email, and password so that I can create an account and access the platform.

**Acceptance criteria:**

- [ ] POST /auth/register accepts: fullName, phone, email (optional), password, role
- [ ] Phone uniqueness validated (409 if exists)
- [ ] Password hashed with bcrypt (salt rounds 12)
- [ ] Role defaults to 'student' if not provided
- [ ] User role set at registration (teacher/student)
- [ ] Response returns user object (without passwordHash) and JWT access token
- [ ] JWT configured with 30-day expiry (refresh not needed for MVP)
- [ ] Input validation with class-validator (phone regex for Egyptian format, password min 8 chars, email format)
- [ ] User registered in 'active' state
- [ ] Registration also triggers creation of empty profile record (TeacherProfile or StudentProfile)

**Files to create/modify:** src/modules/auth/auth.module.ts, src/modules/auth/auth.controller.ts, src/modules/auth/auth.service.ts, src/modules/auth/dto/register.dto.ts, src/modules/auth/strategies/jwt.strategy.ts, src/modules/auth/guards/jwt-auth.guard.ts, src/modules/auth/auth.constants.ts

**Dependencies:** STORY-3

---

**STORY-5**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Login API endpoint

**Points:** 2

**Description:** As a registered user, I want to log in with my phone number and password so that I can access my dashboard.

**Acceptance criteria:**

- [ ] POST /auth/login accepts: phone, password
- [ ] Validates credentials against stored hash
- [ ] Returns JWT access token with 30-day expiry
- [ ] Updates lastLoginAt timestamp on successful login
- [ ] Returns 401 with localized error message for invalid credentials
- [ ] login response includes user object and redirect path (/dashboard/teacher or /dashboard/student)
- [ ] JWT payload includes: userId, role

**Files to create/modify:** src/modules/auth/dto/login.dto.ts, src/modules/auth/auth.controller.ts (add endpoint), src/modules/auth/auth.service.ts (add method)

**Dependencies:** STORY-3

---

**STORY-6**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Password reset API (phone OTP)

**Points:** 3

**Description:** As a user, I want to reset my password via an OTP sent to my phone so that I can regain access if I forget my password.

**Acceptance criteria:**

- [ ] POST /auth/forgot-password accepts: phone
- [ ] 6-digit OTP generated and stored (hashed) with 5-minute expiry
- [ ] OTP sent to phone (console-logged for MVP; SMS integration in v2)
- [ ] POST /auth/reset-password accepts: phone, otp, newPassword
- [ ] OTP verified against stored hash and expiry check
- [ ] Password updated with new hash on successful OTP verification
- [ ] OTP marked as used after successful reset (prevent replay)
- [ ] Rate limit: max 3 OTP requests per phone per hour
- [ ] Returns success message (no user data for security)

**Files to create/modify:** src/modules/auth/dto/forgot-password.dto.ts, src/modules/auth/dto/reset-password.dto.ts, src/modules/auth/auth.controller.ts (add endpoints), src/modules/auth/auth.service.ts (add methods), src/modules/otp/otp.module.ts, src/modules/otp/otp.service.ts, src/modules/otp/entities/otp.entity.ts

**Dependencies:** STORY-3

---

**STORY-7**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Teacher profile CRUD API

**Points:** 2

**Description:** As a teacher, I want to create and update my profile (subject, bio, photo, brand colors, logo) so that my academy page reflects my personal brand.

**Acceptance criteria:**

- [ ] TeacherProfile entity with: userId (1-1), subject (string), bio (text), photoUrl (string, nullable), brandPrimaryColor (string, default #1A103D), brandAccentColor (string, default #00C9DB), logoUrl (string, nullable), createdAt, updatedAt
- [ ] GET /teachers/profile returns the authenticated teacher's profile
- [ ] PUT /teachers/profile updates profile fields (partial update)
- [ ] PUT /teachers/profile/photo uploads photo to S3 and updates photoUrl
- [ ] PUT /teachers/profile/logo uploads logo to S3 and updates logoUrl
- [ ] Profile auto-created on user registration (empty, teacher fills in later)
- [ ] Only users with role=teacher can access these endpoints

**Files to create/modify:** src/modules/teachers/entities/teacher-profile.entity.ts, src/modules/teachers/teachers.module.ts, src/modules/teachers/teachers.controller.ts, src/modules/teachers/teachers.service.ts, src/modules/teachers/dto/update-profile.dto.ts, src/modules/auth/auth.service.ts (auto-create profile on register)

**Dependencies:** STORY-4, STORY-5

---

**STORY-8**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Student profile CRUD API

**Points:** 2

**Description:** As a student, I want to view and update my profile (name, email, password) and see my enrollment history so that I can manage my account.

**Acceptance criteria:**

- [ ] StudentProfile entity with: userId (1-1), enrollmentHistory (JSON, nullable — array of {chapterId, month, year, status}), createdAt, updatedAt
- [ ] GET /students/profile returns the authenticated student's profile with enrollment history
- [ ] PUT /students/profile updates name and email (partial update)
- [ ] PUT /students/profile/password updates password (requires current password for verification)
- [ ] Only users with role=student can access these endpoints

**Files to create/modify:** src/modules/students/entities/student-profile.entity.ts, src/modules/students/students.module.ts, src/modules/students/students.controller.ts, src/modules/students/students.service.ts, src/modules/students/dto/update-profile.dto.ts, src/modules/students/dto/change-password.dto.ts

**Dependencies:** STORY-4, STORY-5

---

**STORY-9**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Auth middleware and route guards

**Points:** 3

**Description:** As a developer, I want JWT authentication middleware that extracts user context from the token and role-based guards that protect routes so that only authorized users can access specific endpoints.

**Acceptance criteria:**

- [ ] Auth middleware extracts user info (userId, role) from JWT and sets on req.user
- [ ] requireAuth middleware rejects requests without valid JWT (401)
- [ ] requireRole(role) middleware restricts endpoints to specific roles (teacher/student)
- [ ] Public routes (register, login, forgot-password, health) exempted from auth
- [ ] Missing/invalid JWT returns 401 with localized error
- [ ] Auth middleware logs userId and role for all authenticated requests
- [ ] Centralized error handling in middleware chain

**Files to create/modify:** src/middleware/auth.middleware.ts, src/middleware/role.middleware.ts, src/middleware/error-handler.ts, src/app.ts

**Dependencies:** STORY-5

---

**STORY-10**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Global rate limiter and error handling

**Points:** 2

**Description:** As a developer, I want rate limiting (100 req/min per IP) and global exception filters with Sentry error tracking so that the API is protected and production-ready.

**Acceptance criteria:**

- [ ] express-rate-limit configured at 100 requests per 60 seconds per IP
- [ ] Rate limit exceeded returns 429 with Retry-After header
- [ ] Global exception filter returns consistent error shape: { statusCode, message, timestamp, path }
- [ ] Sentry configured with DSN from env (free tier, errors only)
- [ ] Unhandled exceptions automatically reported to Sentry
- [ ] Validation errors return 400 with field-level error messages
- [ ] Error messages respect Accept-Language header (AR/EN)

**Files to create/modify:** src/middleware/rate-limiter.ts, src/middleware/error-handler.ts, src/middleware/sentry.ts, src/app.ts

**Dependencies:** STORY-1

---

**STORY-11**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Teacher-branded landing page

**Points:** 3

**Description:** As a prospective student, I want to see the teacher's academy landing page with their photo, name, subject, and a CTA button so that I can learn about the academy and register.

**Acceptance criteria:**

- [ ] Landing page displays teacher photo, full name, subject, and bio
- [ ] Headline: "تعلم [subject] مع [teacher name]" / "Learn [subject] with [teacher name]"
- [ ] CTA button: "سجل الآن وابدأ التعلم" / "Register Now & Start Learning" — links to /register
- [ ] Student count display: "انضم إلى [N] طالب" / "Join [N] students"
- [ ] Page uses teacher's brand colors (primary + accent from profile)
- [ ] Responsive layout: centered card on desktop, full-width on mobile
- [ ] Phone number and WhatsApp link displayed in footer
- [ ] If no teacher profile exists yet, show default branding (platform defaults)
- [ ] Language toggle works on landing page

**Files to create/modify:** src/pages/Landing/Landing.tsx, src/pages/Landing/Landing.module.css, src/pages/Landing/components/TeacherHero.tsx, src/pages/Landing/components/StatsBanner.tsx, src/pages/Landing/components/Footer.tsx, src/api/landing.ts, src/router/routes.ts (add / route)

**Dependencies:** STORY-2, STORY-7

---

**STORY-12**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Registration page (phone-based signup)

**Points:** 3

**Description:** As a visitor, I want to register with my full name, phone, email, and password, selecting my role (student/teacher), so that I can create an account.

**Acceptance criteria:**

- [ ] Form fields: Full Name, Phone (Egyptian format with +20 prefix), Email (optional), Password (min 8 chars), Confirm Password, Role (radio: Student/Teacher)
- [ ] Client-side validation: required fields, phone format, password match, email format
- [ ] Server-side errors displayed inline (field-level) with Arabic/English messages
- [ ] On success, JWT stored in localStorage and user redirected to their dashboard
- [ ] Loading state on submit button (spinner, button disabled)
- [ ] "Already have an account? Log in" link at bottom
- [ ] Phone input has country code prefix (+20) pre-filled and non-editable
- [ ] Error state: server error shows toast notification

**Files to create/modify:** src/pages/Register/Register.tsx, src/pages/Register/Register.module.css, src/pages/Register/components/RoleSelector.tsx, src/pages/Register/components/RegisterForm.tsx, src/api/auth.ts (register method), src/i18n/ar/auth.json, src/i18n/en/auth.json

**Dependencies:** STORY-2, STORY-4

---

**STORY-13**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Login page

**Points:** 2

**Description:** As a registered user, I want to log in with my phone number and password so that I can access my dashboard.

**Acceptance criteria:**

- [ ] Form fields: Phone (Egyptian format), Password
- [ ] Client-side validation: required fields, phone format
- [ ] On success, JWT stored in localStorage, user redirected to dashboard (teacher or student)
- [ ] "Forgot password?" link below form navigates to /forgot-password
- [ ] "Don't have an account? Register" link at bottom
- [ ] Error state: invalid credentials shows error "رقم الهاتف أو كلمة المرور غير صحيحة" / "Invalid phone number or password"
- [ ] Loading state on submit button
- [ ] Phone input has country code prefix (+20) pre-filled

**Files to create/modify:** src/pages/Login/Login.tsx, src/pages/Login/Login.module.css, src/pages/Login/components/LoginForm.tsx, src/api/auth.ts (login method), src/i18n/ar/auth.json, src/i18n/en/auth.json

**Dependencies:** STORY-2, STORY-5

---

**STORY-14**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Password reset flow UI (phone OTP)

**Points:** 3

**Description:** As a user, I want to reset my forgotten password by entering my phone number, receiving an OTP, and setting a new password so that I can regain access to my account.

**Acceptance criteria:**

- [ ] 3-step flow: (1) Enter Phone → (2) Enter OTP → (3) New Password
- [ ] Step 1: Phone input with validation → "Send OTP" button with loading state
- [ ] Step 2: 6-digit OTP input (individual digit boxes, auto-advance) → 60-second resend timer
- [ ] Step 3: New Password + Confirm Password fields with validation
- [ ] Stepper/progress indicator shows current step
- [ ] OTP errors shown inline ("الرمز غير صحيح" / "Invalid code")
- [ ] On success: redirect to login page with success toast
- [ ] Expired OTP shows "انتهت صلاحية الرمز، يرجى طلب رمز جديد" / "Code expired, please request a new one"
- [ ] Rate limit error message shown if exceeded

**Files to create/modify:** src/pages/ForgotPassword/ForgotPassword.tsx, src/pages/ForgotPassword/ForgotPassword.module.css, src/pages/ForgotPassword/components/PhoneStep.tsx, src/pages/ForgotPassword/components/OtpStep.tsx, src/pages/ForgotPassword/components/ResetStep.tsx, src/pages/ForgotPassword/components/StepIndicator.tsx, src/api/auth.ts (forgotPassword, resetPassword methods)

**Dependencies:** STORY-2, STORY-6

---

**STORY-15**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Teacher profile page

**Points:** 2

**Description:** As a teacher, I want to view and edit my profile (name, subject, bio, photo, brand colors, logo) so that my academy page reflects my personal brand.

**Acceptance criteria:**

- [ ] View mode shows: photo, name, subject, bio, brand colors preview (swatches), logo
- [ ] Edit mode (toggle via "Edit" button) opens inline editable fields
- [ ] Photo upload: click to upload, preview before save
- [ ] Logo upload: click to upload, preview before save
- [ ] Brand color pickers (primary + accent) with hex input
- [ ] Subject text input
- [ ] Bio textarea with character count (max 500)
- [ ] Save/Cancel buttons in edit mode
- [ ] Loading state during save
- [ ] Success toast on save
- [ ] Phone and email displayed (read-only, set during registration)

**Files to create/modify:** src/pages/TeacherProfile/TeacherProfile.tsx, src/pages/TeacherProfile/TeacherProfile.module.css, src/pages/TeacherProfile/components/ProfileView.tsx, src/pages/TeacherProfile/components/ProfileEdit.tsx, src/pages/TeacherProfile/components/ColorPicker.tsx, src/pages/TeacherProfile/components/PhotoUpload.tsx, src/api/teacher.ts, src/router/routes.ts (add /dashboard/teacher/profile)

**Dependencies:** STORY-2, STORY-7

---

**STORY-16**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Student profile page

**Points:** 3

**Description:** As a student, I want to view and edit my name, email, and password, and see my enrollment history so that I can manage my account.

**Acceptance criteria:**

- [ ] View mode shows: name, email, phone (read-only), enrollment history table
- [ ] Enrollment history table: Chapter Name, Month, Year, Status (Active/Inactive) — empty state "لم تشترك في أي كورس بعد" / "Not enrolled in any courses yet"
- [ ] Edit mode for name and email (inline)
- [ ] Change Password section: current password, new password, confirm
- [ ] Save/Cancel in edit mode
- [ ] Loading state on save
- [ ] Success/error toasts
- [ ] Phone displayed as read-only

**Files to create/modify:** src/pages/StudentProfile/StudentProfile.tsx, src/pages/StudentProfile/StudentProfile.module.css, src/pages/StudentProfile/components/ProfileView.tsx, src/pages/StudentProfile/components/ProfileEdit.tsx, src/pages/StudentProfile/components/EnrollmentHistory.tsx, src/pages/StudentProfile/components/ChangePassword.tsx, src/api/student.ts, src/router/routes.ts (add /dashboard/student/profile)

**Dependencies:** STORY-2, STORY-8

---

**STORY-17**

**Sprint:** 1

**Epic:** Identity & Access

**Title:** Navigation shell with auth routing and language toggle

**Points:** 3

**Description:** As a user, I want a consistent navigation shell with header (language toggle, logout), and route guards so that I can navigate the app and only access pages appropriate for my role.

**Acceptance criteria:**

- [ ] Header: logo (left in LTR, right in RTL), language toggle (AR/EN flag icon), logout button
- [ ] Language toggle switches app direction (RTL ↔ LTR) and persists choice in localStorage
- [ ] AuthGuard redirects unauthenticated users to /login
- [ ] RoleGuard restricts teacher routes (/dashboard/teacher/_) and student routes (/dashboard/student/_)
- [ ] After login, user redirected based on role: /dashboard/teacher or /dashboard/student
- [ ] Logout clears JWT, redirects to /login
- [ ] Header hidden on login/register/password-reset pages (auth pages use minimal layout)
- [ ] Toast notification system wired up (success, error, info variants)
- [ ] Skeleton loading component prepared for reuse

**Files to create/modify:** src/components/layout/AppShell.tsx (update), src/components/layout/Header.tsx (update), src/components/layout/AuthLayout.tsx, src/components/layout/DashboardLayout.tsx, src/components/common/LanguageToggle.tsx, src/components/common/Toast.tsx, src/components/common/Skeleton.tsx, src/router/guards/AuthGuard.tsx, src/router/guards/RoleGuard.tsx, src/hooks/useAuth.ts, src/context/AuthContext.tsx, src/api/auth.ts (logout), src/i18n/i18n.ts (direction switch)

**Dependencies:** STORY-2, STORY-5

---

**STORY-18**

**Sprint:** 1

**Epic:** Infrastructure

**Title:** RDS PostgreSQL database provisioning

**Points:** 2

**Description:** As a DevOps engineer, I want an RDS PostgreSQL instance provisioned on AWS so that the application has a managed database with automated backups.

**Acceptance criteria:**

- [ ] RDS PostgreSQL instance created (db.t3.micro for MVP)
- [ ] Automated backups enabled (daily, 7-day retention)
- [ ] Security group configured to allow inbound PostgreSQL from Elastic Beanstalk security group only
- [ ] Database name, master username, and master password stored in AWS Systems Manager Parameter Store
- [ ] SSL connection enforced
- [ ] pgvector extension available (PostgreSQL 15+)
- [ ] Connection details documented in team wiki

**Files to create/modify:** infrastructure/rds/main.tf, infrastructure/rds/variables.tf, infrastructure/rds/outputs.tf, infrastructure/rds/terraform.tfvars.example, docs/infrastructure.md

**Dependencies:** None

---

**STORY-19**

**Sprint:** 1

**Epic:** Infrastructure

**Title:** S3 bucket and IAM roles for file uploads

**Points:** 2

**Description:** As a DevOps engineer, I want an S3 bucket configured with proper IAM roles and CORS so that the application can upload and serve PDFs and profile images securely.

**Acceptance criteria:**

- [ ] S3 bucket created with environment-specific name (lms-[env]-assets)
- [ ] Bucket configured for private access (no public ACLs)
- [ ] IAM role created with policy allowing: s3:PutObject, s3:GetObject, s3:DeleteObject on the bucket
- [ ] CORS policy allowing PUT/GET from the app domain
- [ ] Server-side encryption (AES-256) enabled by default
- [ ] Pre-signed URL expiration set to 3600 seconds (1 hour)
- [ ] IAM role attachable to Elastic Beanstalk instance profile

**Files to create/modify:** infrastructure/s3/main.tf, infrastructure/s3/variables.tf, infrastructure/s3/outputs.tf, infrastructure/s3/cors-policy.json, infrastructure/s3/bucket-policy.json, infrastructure/iam/main.tf

**Dependencies:** None

---

**STORY-20**

**Sprint:** 1

**Epic:** Infrastructure

**Title:** Elastic Beanstalk environment deployment

**Points:** 5

**Description:** As a DevOps engineer, I want the application deployed to AWS Elastic Beanstalk with a load balancer and SSL so that the app is live and accessible via HTTPS.

**Acceptance criteria:**

- [ ] Elastic Beanstalk application created (Node.js 18 platform)
- [ ] Environment configured with load balancer (ALB, HTTP → HTTPS redirect)
- [ ] SSL certificate provisioned via AWS Certificate Manager
- [ ] Custom domain (or EB-generated URL) accessible via HTTPS
- [ ] Environment properties set: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, S3_BUCKET, S3_REGION, JWT_SECRET, SENTRY_DSN (from Parameter Store)
- [ ] Health check endpoint (/health) configured on ALB
- [ ] Auto-scaling: min 1, max 2 instances (t3.micro or t3.small)
- [ ] Deployment package created from Express.js build output
- [ ] Log streaming to CloudWatch enabled
- [ ] .ebignore configured (exclude node_modules, src, etc.)

**Files to create/modify:** .ebignore, .elasticbeanstalk/config.yml, infrastructure/elastic-beanstalk/Dockerrun.aws.json (or Procfile), infrastructure/elastic-beanstalk/nginx/nginx.conf, infrastructure/elastic-beanstalk/cloudwatch.config, infrastructure/elastic-beanstalk/env.config, scripts/deploy.sh

**Dependencies:** STORY-18, STORY-19

---

**STORY-21**

**Sprint:** 1

**Epic:** Infrastructure

**Title:** GitHub Actions CI/CD pipeline

**Points:** 3

**Description:** As a DevOps engineer, I want a CI/CD pipeline that runs linting, tests, and deploys to Elastic Beanstalk on push to main so that the team can ship changes reliably.

**Acceptance criteria:**

- [ ] GitHub Actions workflow triggers on push to main
- [ ] Job 1 (CI): Run npm ci, npm run lint, npm run test, npm run build
- [ ] Job 2 (CD): Deploy to Elastic Beanstalk using AWS credentials from GitHub Secrets
- [ ] Database migrations run as post-deploy script
- [ ] Deployment status reported back as commit status check
- [ ] Rollback on failure (previous version restored)
- [ ] Deploy timeout: 15 minutes
- [ ] Slack/email notification on failure (if webhook configured)

**Files to create/modify:** .github/workflows/deploy.yml, scripts/run-migrations.sh, scripts/post-deploy.sh

**Dependencies:** STORY-20

---

## Sprint 2: Content Management & Student Content Viewing

**Goal:** Teachers create, organize, and manage their full content tree (stages → chapters → lessons with YouTube + PDFs). Students browse the academy content with locked/unlocked states.

**Points:** 55

---

**STORY-22**

**Sprint:** 2

**Epic:** Content Management

**Title:** Stage entity and CRUD API

**Points:** 3

**Description:** As a teacher, I want to create, read, update, and delete educational stages so that I can organize my content into top-level categories.

**Acceptance criteria:**

- [ ] Stage entity with: id (UUID), name (string), description (text, nullable), sortOrder (integer), teacherId (FK → teachers), createdAt, updatedAt
- [ ] POST /stages — create stage (name required, description optional, auto-positions at end)
- [ ] GET /stages — list all stages for tenant, ordered by sortOrder
- [ ] GET /stages/:id — get single stage with chapter count
- [ ] PUT /stages/:id — update name/description
- [ ] DELETE /stages/:id — soft-delete (validates no chapters exist, returns 409 if children present)
- [ ] All endpoints scoped to authenticated teacher via auth middleware
- [ ] Input validation: name max 200 chars, description max 2000 chars
- [ ] Migration creates stages table with indexes on teacherId and sortOrder

**Files to create/modify:** src/modules/content/entities/stage.entity.ts, src/modules/content/content.module.ts, src/modules/content/controllers/stages.controller.ts, src/modules/content/services/stages.service.ts, src/modules/content/dto/create-stage.dto.ts, src/modules/content/dto/update-stage.dto.ts, src/database/migrations/002-create-stages.ts

**Dependencies:** STORY-1, STORY-9

---

**STORY-23**

**Sprint:** 2

**Epic:** Content Management

**Title:** Chapter entity and CRUD API

**Points:** 3

**Description:** As a teacher, I want to create, read, update, and delete chapters within a stage so that I can organize content into modules.

**Acceptance criteria:**

- [ ] Chapter entity with: id (UUID), name, description (nullable), stageId (FK → stages), sortOrder (integer), price (decimal, nullable), createdAt, updatedAt
- [ ] POST /stages/:stageId/chapters — create chapter in stage
- [ ] GET /stages/:stageId/chapters — list chapters for stage, ordered by sortOrder
- [ ] GET /chapters/:id — single chapter with lesson count
- [ ] PUT /chapters/:id — update chapter
- [ ] DELETE /chapters/:id — soft-delete (validates no lessons exist)
- [ ] All endpoints scoped to authenticated teacher via auth middleware
- [ ] price field nullable — null means "free" (no payment required)
- [ ] Input validation: price min 0 (if provided)
- [ ] Migration creates chapters table with FK to stages, indexes on (stageId, sortOrder)

**Files to create/modify:** src/modules/content/entities/chapter.entity.ts, src/modules/content/controllers/chapters.controller.ts, src/modules/content/services/chapters.service.ts, src/modules/content/dto/create-chapter.dto.ts, src/modules/content/dto/update-chapter.dto.ts, src/database/migrations/003-create-chapters.ts

**Dependencies:** STORY-22

---

**STORY-24**

**Sprint:** 2

**Epic:** Content Management

**Title:** Lesson entity and CRUD API

**Points:** 5

**Description:** As a teacher, I want to create, read, update, and delete lessons within a chapter with title, description, duration, YouTube URL, and PDF attachments so that I can deliver multimedia content to students.

**Acceptance criteria:**

- [ ] Lesson entity with: id (UUID), title, description (nullable), durationMinutes (integer), youtubeUrl (string, nullable), chapterId (FK → chapters), sortOrder (integer), pdfUrls (jsonb, nullable — array of S3 keys), createdAt, updatedAt
- [ ] POST /chapters/:chapterId/lessons — create lesson
- [ ] GET /chapters/:chapterId/lessons — list lessons for chapter
- [ ] GET /lessons/:id — single lesson with full details
- [ ] PUT /lessons/:id — update lesson fields
- [ ] DELETE /lessons/:id — hard delete (no cascade needed, lessons are leaf nodes)
- [ ] youtubeUrl validated for YouTube domain format (youtube.com, youtu.be)
- [ ] durationMinutes accepts positive integer (max 300)
- [ ] pdfUrls stored as JSON array of S3 keys (not pre-signed URLs; pre-signed on retrieval)
- [ ] Max 10 PDFs per lesson validated at API level
- [ ] Migration creates lessons table with FK to chapters, indexes on (chapterId, sortOrder)

**Files to create/modify:** src/modules/content/entities/lesson.entity.ts, src/modules/content/controllers/lessons.controller.ts, src/modules/content/services/lessons.service.ts, src/modules/content/dto/create-lesson.dto.ts, src/modules/content/dto/update-lesson.dto.ts, src/database/migrations/004-create-lessons.ts

**Dependencies:** STORY-23

---

**STORY-25**

**Sprint:** 2

**Epic:** Content Management

**Title:** S3 pre-signed URL service for PDF uploads

**Points:** 3

**Description:** As a teacher, I want to upload PDF files to S3 and get pre-signed URLs for secure access so that lesson materials are stored and served securely.

**Acceptance criteria:**

- [ ] POST /files/upload/pdf — accepts multipart file, uploads to S3, returns S3 key
- [ ] File validation: PDF only (application/pdf), max 50MB per file
- [ ] S3 key format: teachers/{teacherId}/lessons/{lessonId}/{uuid}-{filename}.pdf
- [ ] S3Service with methods: uploadFile (buffer, key, contentType), getPreSignedUrl (key, expiry=3600s), deleteFile (key)
- [ ] GET /files/pre-signed-url?key=... — returns temporary pre-signed URL (60-min expiry)
- [ ] Batch upload endpoint: POST /files/upload/pdf/batch — accepts up to 10 files
- [ ] File size validation before upload
- [ ] Virus scanning placeholder (MVP: accept and log; AV integration in v2)

**Files to create/modify:** src/modules/files/files.module.ts, src/modules/files/files.controller.ts, src/modules/files/files.service.ts, src/modules/files/services/s3.service.ts, src/modules/files/dto/upload.dto.ts, src/config/s3.config.ts

**Dependencies:** STORY-19, STORY-24

---

**STORY-26**

**Sprint:** 2

**Epic:** Content Management

**Title:** Content tree aggregation endpoint

**Points:** 3

**Description:** As a teacher, I want a single API endpoint that returns my full content hierarchy (stages → chapters → lessons) so that the frontend can render the content tree in one request.

**Acceptance criteria:**

- [ ] GET /content/tree returns nested structure: [{ stage: { id, name, ... }, chapters: [{ chapter: { id, name, price, ... }, lessons: [{ id, title, durationMinutes, ... }] }] }]
- [ ] Each level includes item counts (lessonCount per chapter, chapterCount per stage)
- [ ] Ordered by sortOrder at each level
- [ ] Response limited to 2000 items total (safety limit)
- [ ] Response time < 500ms for 100+ items
- [ ] Endpoint scoped to authenticated teacher

**Files to create/modify:** src/modules/content/controllers/content.controller.ts, src/modules/content/services/content.service.ts, src/modules/content/dto/content-tree.dto.ts

**Dependencies:** STORY-24

---

**STORY-27**

**Sprint:** 2

**Epic:** Content Management

**Title:** Stage and chapter reorder API

**Points:** 2

**Description:** As a teacher, I want to reorder stages, chapters, and lessons by updating their position so that my content appears in the desired sequence.

**Acceptance criteria:**

- [ ] PATCH /stages/reorder — accepts array of { id, sortOrder }
- [ ] PATCH /chapters/reorder — accepts array of { id, sortOrder }
- [ ] PATCH /lessons/reorder — accepts array of { id, sortOrder }
- [ ] All items must belong to the same parent scope (teacherId for stages, stageId for chapters, chapterId for lessons)
- [ ] Validation: all provided IDs must exist in the DB for the tenant
- [ ] Positions updated in a single transaction (all-or-nothing)
- [ ] Returns updated items with new positions

**Files to create/modify:** src/modules/content/dto/reorder.dto.ts, src/modules/content/controllers/stages.controller.ts (add endpoint), src/modules/content/controllers/chapters.controller.ts (add endpoint), src/modules/content/controllers/lessons.controller.ts (add endpoint), src/modules/content/services/stages.service.ts (add method), src/modules/content/services/chapters.service.ts (add method), src/modules/content/services/lessons.service.ts (add method)

**Dependencies:** STORY-24

---

**STORY-28**

**Sprint:** 2

**Epic:** Content Management

**Title:** Cascade delete API with validation

**Points:** 2

**Description:** As a teacher, I want to delete a stage (with its chapters and lessons) or a chapter (with its lessons) after confirming, so that I can remove entire content branches cleanly.

**Acceptance criteria:**

- [ ] DELETE /stages/:id?force=true — deletes stage + all chapters + all lessons (hard delete)
- [ ] DELETE /chapters/:id?force=true — deletes chapter + all lessons
- [ ] DELETE /lessons/:id — deletes single lesson (no force flag needed)
- [ ] Without ?force=true, DELETE returns 409 with child count and message: "This stage contains [N] chapters and [M] lessons. Use ?force=true to confirm deletion."
- [ ] Cascade also deletes associated PDFs from S3
- [ ] All operations in a single transaction
- [ ] Audit log entry created for deletion

**Files to create/modify:** src/modules/content/services/stages.service.ts (add delete logic), src/modules/content/services/chapters.service.ts (add delete logic), src/modules/content/services/lessons.service.ts (refine delete), src/modules/content/controllers/stages.controller.ts (update delete endpoint), src/modules/content/controllers/chapters.controller.ts (update delete endpoint)

**Dependencies:** STORY-24

---

**STORY-29**

**Sprint:** 2

**Epic:** Content Management

**Title:** Teacher dashboard stats API

**Points:** 2

**Description:** As a teacher, I want an API endpoint that returns my dashboard statistics so that I can see content counts and quick actions at a glance.

**Acceptance criteria:**

- [ ] GET /dashboard/teacher/stats returns: totalStages, totalChapters, totalLessons, totalStudents, totalQuizzes, recentActivity (last 10 actions)
- [ ] Student count counts distinct enrolled students
- [ ] All counts scoped to authenticated teacher
- [ ] Response time < 200ms
- [ ] Empty state returns zeros (not null)

**Files to create/modify:** src/modules/dashboard/dashboard.module.ts, src/modules/dashboard/dashboard.controller.ts, src/modules/dashboard/dashboard.service.ts, src/modules/dashboard/dto/dashboard-stats.dto.ts

**Dependencies:** STORY-24

---

**STORY-30**

**Sprint:** 2

**Epic:** Student Learning Experience

**Title:** Student content listing API with enrollment status

**Points:** 3

**Description:** As a student, I want an API that returns all content with my enrollment/lock status so that I can browse available chapters and see what I can access.

**Acceptance criteria:**

- [ ] GET /content/student/tree returns same hierarchy as teacher tree plus enrollmentStatus per chapter: "free", "purchased", "locked"
- [ ] free: chapter price is null/0
- [ ] purchased: student has active enrollment for this chapter
- [ ] locked: chapter has a price and student is not enrolled
- [ ] Each chapter shows price if applicable
- [ ] GET /content/student/my-courses returns only chapters with active enrollment
- [ ] Each course/chapter includes lesson count and completion progress

**Files to create/modify:** src/modules/content/services/student-content.service.ts, src/modules/content/controllers/student-content.controller.ts, src/modules/content/dto/student-content.dto.ts

**Dependencies:** STORY-26

---

**STORY-31**

**Sprint:** 2

**Epic:** Content Management

**Title:** Teacher sidebar navigation layout

**Points:** 2

**Description:** As a teacher, I want a persistent sidebar navigation with links to Dashboard, Content Manager, Quiz Generator, Students, and Settings so that I can navigate between sections.

**Acceptance criteria:**

- [ ] Sidebar appears on all teacher pages (width: 240px desktop, collapsible on mobile)
- [ ] Nav items: Dashboard (icon: grid), Content Manager (icon: folder-tree), Quiz Generator (icon: quiz), Students (icon: people), Settings (icon: gear)
- [ ] Active route highlighted with accent color
- [ ] Teacher name and photo displayed at top of sidebar
- [ ] Collapse/expand button (hamburger icon) on mobile
- [ ] Sidebar hidden on auth pages
- [ ] Smooth transition animation for collapse/expand
- [ ] Responsive: sidebar overlays content on mobile, fixed on desktop

**Files to create/modify:** src/components/layout/TeacherLayout.tsx, src/components/layout/TeacherSidebar.tsx, src/components/layout/TeacherSidebar.module.css, src/router/routes.ts (teacher route group), src/i18n/ar/teacher.json, src/i18n/en/teacher.json

**Dependencies:** STORY-17

---

**STORY-32**

**Sprint:** 2

**Epic:** Content Management

**Title:** Teacher Dashboard page with stats cards

**Points:** 3

**Description:** As a teacher, I want to see a dashboard with stats cards and a content overview so that I can quickly understand my academy's status.

**Acceptance criteria:**

- [ ] Stats cards row: total stages, total chapters, total lessons, total students, total quizzes
- [ ] Each card shows: icon, count number, label, accent color border
- [ ] Quick action buttons below stats: "New Stage", "New Chapter", "New Lesson"
- [ ] Recent activity list (last 10 actions with timestamps)
- [ ] Loading state: skeleton cards
- [ ] Empty state: "مرحباً! ابدأ بإنشاء مرحلة جديدة" / "Welcome! Start by creating a new stage" + CTA button
- [ ] Error state: retry button with error message
- [ ] Cards responsive: 3 columns desktop, 2 tablet, 1 mobile

**Files to create/modify:** src/pages/TeacherDashboard/TeacherDashboard.tsx, src/pages/TeacherDashboard/TeacherDashboard.module.css, src/pages/TeacherDashboard/components/StatsCard.tsx, src/pages/TeacherDashboard/components/StatsGrid.tsx, src/pages/TeacherDashboard/components/RecentActivity.tsx, src/pages/TeacherDashboard/components/QuickActions.tsx, src/api/teacher.ts (add getDashboardStats)

**Dependencies:** STORY-29, STORY-31

---

**STORY-33**

**Sprint:** 2

**Epic:** Content Management

**Title:** Content Manager — tree panel

**Points:** 3

**Description:** As a teacher, I want to see my full content hierarchy as an expandable tree in the left panel so that I can navigate and select items to edit.

**Acceptance criteria:**

- [ ] Tree displays: Stage (expandable → shows chapters) → Chapter (expandable → shows lessons) → Lesson (leaf node)
- [ ] Each node shows: icon, name, and context menu (⋯) with Edit, Add Child, Delete
- [ ] Clicking a node selects it and opens it in the right editor panel
- [ ] Selected node highlighted with accent color background
- [ ] Tree loads from GET /content/tree on mount
- [ ] Loading state: skeleton tree lines
- [ ] Empty state: "لم يتم إضافة أي محتوى بعد" / "No content added yet" + "Add Stage" button
- [ ] Expand/collapse animation on folder nodes

**Files to create/modify:** src/pages/ContentManager/ContentManager.tsx, src/pages/ContentManager/ContentManager.module.css, src/pages/ContentManager/components/TreePanel.tsx, src/pages/ContentManager/components/TreeNode.tsx, src/pages/ContentManager/components/TreeNode.module.css, src/pages/ContentManager/components/TreeContextMenu.tsx, src/api/content.ts (getContentTree)

**Dependencies:** STORY-26, STORY-31

---

**STORY-34**

**Sprint:** 2

**Epic:** Content Management

**Title:** Content Manager — stage and chapter editor forms

**Points:** 2

**Description:** As a teacher, I want to create and edit stages and chapters using forms in the right panel so that I can manage my content structure.

**Acceptance criteria:**

- [ ] Right panel shows editor based on selected tree node type (stage or chapter)
- [ ] Stage form: name (required), description (textarea, optional)
- [ ] Chapter form: name (required), description (textarea, optional), price (number input, optional — "Free" if empty)
- [ ] Save button with loading state
- [ ] Cancel button resets form to current values
- [ ] Validation errors displayed inline
- [ ] Success toast on save
- [ ] Form auto-populates when selecting existing item
- [ ] Unsaved changes prompt on navigation away

**Files to create/modify:** src/pages/ContentManager/components/StageEditor.tsx, src/pages/ContentManager/components/ChapterEditor.tsx, src/pages/ContentManager/components/EditorPanel.tsx, src/api/content.ts (createStage, updateStage, createChapter, updateChapter)

**Dependencies:** STORY-22, STORY-23, STORY-33

---

**STORY-35**

**Sprint:** 2

**Epic:** Content Management

**Title:** Content Manager — lesson editor form

**Points:** 3

**Description:** As a teacher, I want to create and edit lessons with title, description, duration, YouTube URL, and PDF attachments so that I can deliver multimedia content.

**Acceptance criteria:**

- [ ] Lesson form: title (required), description (textarea, optional), duration (number, minutes), YouTube URL (optional, validated)
- [ ] PDF upload area: drag-drop zone + file picker, shows uploaded PDFs with file name and size
- [ ] Upload progress bar per file
- [ ] Remove PDF button (calls S3 delete)
- [ ] Max 10 PDFs enforced with error message
- [ ] Max 50MB per file enforced with error message
- [ ] YouTube URL preview (thumbnail embed after entering URL)
- [ ] Save/Cancel with same behavior as stage/chapter editors
- [ ] Loading state during save (multiple PDF uploads)

**Files to create/modify:** src/pages/ContentManager/components/LessonEditor.tsx, src/pages/ContentManager/components/LessonEditor.module.css, src/pages/ContentManager/components/YouTubePreview.tsx, src/api/content.ts (createLesson, updateLesson, uploadPdf, deletePdf)

**Dependencies:** STORY-24, STORY-25, STORY-33

---

**STORY-36**

**Sprint:** 2

**Epic:** Content Management

**Title:** PDF upload component with drag-and-drop

**Points:** 3

**Description:** As a teacher, I want a reusable PDF upload component with drag-and-drop, progress tracking, and file validation so that I can attach PDFs to lessons.

**Acceptance criteria:**

- [ ] Drag-and-drop zone with dashed border, "Drop PDF files here" / "انزل ملفات PDF هنا" text
- [ ] File picker via click (accept=".pdf")
- [ ] File validation before upload: PDF type, max 50MB
- [ ] Upload progress bar per file (percentage + filename)
- [ ] Uploaded file list: file icon, name, size (formatted KB/MB), remove button
- [ ] Error state per file: "الملف كبير جداً" / "File too large", "يُرجى رفع ملفات PDF فقط" / "PDF files only"
- [ ] Max 10 files per lesson enforced
- [ ] Accessible: keyboard navigation, ARIA labels on drop zone
- [ ] Supports both single and batch upload (up to 10 files)

**Files to create/modify:** src/components/common/PdfUpload/PdfUpload.tsx, src/components/common/PdfUpload/PdfUpload.module.css, src/components/common/PdfUpload/FileItem.tsx, src/components/common/PdfUpload/UploadProgress.tsx, src/api/files.ts

**Dependencies:** STORY-25

---

**STORY-37**

**Sprint:** 2

**Epic:** Content Management

**Title:** Content reorder UI with drag handles

**Points:** 2

**Description:** As a teacher, I want to reorder stages, chapters, and lessons by dragging them to new positions so that I can arrange content intuitively.

**Acceptance criteria:**

- [ ] Each tree node shows a drag handle (⠿ icon) on the left
- [ ] Drag and drop within the same parent level (stages among stages, chapters within same stage, lessons within same chapter)
- [ ] Visual feedback during drag: lifted item shadow, drop indicator line
- [ ] Drop animation: item slides to new position
- [ ] Save Order button appears after any drag (or auto-save on drop)
- [ ] Optimistic UI update (reorder immediately, sync in background)
- [ ] Error state: revert to previous order on API failure + error toast

**Files to create/modify:** src/components/common/DragHandle.tsx, src/pages/ContentManager/components/TreePanel.tsx (add drag-and-drop), src/pages/ContentManager/components/TreeNode.tsx (add drag handle), src/api/content.ts (reorderStages, reorderChapters, reorderLessons)

**Dependencies:** STORY-27, STORY-33

---

**STORY-38**

**Sprint:** 2

**Epic:** Content Management

**Title:** Delete confirmation modals

**Points:** 1

**Description:** As a teacher, I want a confirmation modal before deleting content items so that I can avoid accidental deletions.

**Acceptance criteria:**

- [ ] Modal appears when Delete is clicked on any tree node
- [ ] Delete stage modal: "سيتم حذف [name] وجميع الدروس والفصول المرتبطة" / "[name] and all associated chapters and lessons will be deleted"
- [ ] Delete chapter modal: "سيتم حذف [name] وجميع الدروس المرتبطة" / "[name] and all associated lessons will be deleted"
- [ ] Delete lesson modal: "سيتم حذف [name]" / "[name] will be deleted"
- [ ] "Confirm" button with danger styling (red), "Cancel" button
- [ ] Loading state on confirm during deletion
- [ ] Success toast after deletion, tree refreshed
- [ ] Error toast if deletion fails

**Files to create/modify:** src/components/common/ConfirmDialog/ConfirmDialog.tsx, src/components/common/ConfirmDialog/ConfirmDialog.module.css, src/pages/ContentManager/components/DeleteConfirmModal.tsx

**Dependencies:** STORY-28, STORY-33

---

**STORY-39**

**Sprint:** 2

**Epic:** Student Learning Experience

**Title:** Student Dashboard — My Courses tab

**Points:** 3

**Description:** As a student, I want to see a "My Courses" tab showing the chapters I'm enrolled in with progress indicators so that I can continue learning where I left off.

**Acceptance criteria:**

- [ ] Tab bar: "كورساتي" / "My Courses" (active by default) | "كل المحتوى" / "All Content"
- [ ] My Courses shows enrolled chapters as cards: chapter name, stage name, lesson progress (X/Y lessons), progress bar
- [ ] Clicking a chapter navigates to its lesson list
- [ ] Empty state: "لم تشترك في أي كورس بعد" / "Not enrolled in any courses yet" + "تصفح الكورسات" / "Browse Courses" button (switches to All Content tab)
- [ ] Loading state: skeleton cards (3 cards)
- [ ] Error state: retry button
- [ ] Chapter card hover effect with shadow elevation

**Files to create/modify:** src/pages/StudentDashboard/StudentDashboard.tsx, src/pages/StudentDashboard/StudentDashboard.module.css, src/pages/StudentDashboard/components/TabBar.tsx, src/pages/StudentDashboard/components/CourseCard.tsx, src/pages/StudentDashboard/components/CourseCard.module.css, src/api/student.ts (getMyCourses), src/i18n/ar/student.json, src/i18n/en/student.json

**Dependencies:** STORY-30, STORY-17

---

**STORY-40**

**Sprint:** 2

**Epic:** Student Learning Experience

**Title:** Student Dashboard — All Content tab

**Points:** 3

**Description:** As a student, I want to see the full content tree with lock/unlock status and prices so that I can discover and enroll in new chapters.

**Acceptance criteria:**

- [ ] All Content shows full stage → chapter → lesson hierarchy
- [ ] Each chapter shows: name, description, price badge ("Free" / "جنيه [X]" / "EGP [X]"), enrollment badge ("مشترك" / "Enrolled" / "مقفل" / "Locked")
- [ ] Locked chapters have a slight opacity overlay
- [ ] Clicking a locked chapter shows "اشترك الآن" / "Subscribe Now" CTA
- [ ] Clicking an enrolled/free chapter opens Lesson View page
- [ ] Stage headers are expandable/collapsible
- [ ] Loading state: skeleton tree
- [ ] Empty state: "لم يتم إضافة أي محتوى بعد" / "No content added yet"

**Files to create/modify:** src/pages/StudentDashboard/components/AllContentTab.tsx, src/pages/StudentDashboard/components/AllContentTab.module.css, src/pages/StudentDashboard/components/ChapterCard.tsx, src/pages/StudentDashboard/StudentDashboard.tsx (integrate tab), src/api/student.ts (getAllContent)

**Dependencies:** STORY-30, STORY-39

---

**STORY-41**

**Sprint:** 2

**Epic:** Student Learning Experience

**Title:** Lesson View page with YouTube embed and PDF download

**Points:** 3

**Description:** As a student, I want to view a lesson with an embedded YouTube video, lesson info, and downloadable PDFs so that I can learn from the teacher's materials.

**Acceptance criteria:**

- [ ] Page layout: YouTube video embed at top (16:9 ratio), lesson info below (title, description, duration, stage/chapter breadcrumb)
- [ ] PDF download list: each PDF shown as card with file icon, name, download button (download from pre-signed URL)
- [ ] Previous/Next lesson navigation buttons at bottom
- [ ] YouTube video auto-resizes responsively
- [ ] Loading state: video skeleton + text skeleton
- [ ] Error state: YouTube video fails → show fallback message "الفيديو غير متاح حالياً" / "Video currently unavailable"
- [ ] 404 state: lesson not found
- [ ] Lesson view tracked (increment view count, used for student progress)
- [ ] PDF download opens in new tab

**Files to create/modify:** src/pages/LessonView/LessonView.tsx, src/pages/LessonView/LessonView.module.css, src/pages/LessonView/components/VideoPlayer.tsx, src/pages/LessonView/components/LessonInfo.tsx, src/pages/LessonView/components/PdfList.tsx, src/pages/LessonView/components/LessonNav.tsx, src/components/common/YouTubeEmbed.tsx, src/api/student.ts (getLesson, getPreSignedUrl), src/router/routes.ts (add /lessons/:id)

**Dependencies:** STORY-30, STORY-40

---

## Sprint 3: AI Quiz Generation & Enrollment/Payments

**Goal:** Teachers generate AI-powered quizzes from their content (3-step wizard), publish to chapters. Students take quizzes with auto-grading. Students enroll via Paymob payment or promo codes. Support agents generate promo codes.

**Points:** 57

---

**STORY-42**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Gemini AI client shared service

**Points:** 2

**Description:** As a developer, I want a shared Gemini client service that wraps the Google Gemini API with config, retry logic, and error handling so that both quiz generation and AI tutor can use it.

**Acceptance criteria:**

- [ ] GeminiClient with methods: generateContent(prompt, config), embedContent(text)
- [ ] API key loaded from env (GEMINI_API_KEY)
- [ ] Retry logic: 3 retries with exponential backoff on 429/5xx
- [ ] Rate limit awareness: respects API quota (track usage, queue if needed)
- [ ] Response parsing: extract text from Gemini response, handle safety blocks
- [ ] Model configurable via env (default: gemini-2.0-flash for generation, text-embedding-004 for embeddings)
- [ ] Error handling: network errors, auth errors, content blocked → throw typed errors
- [ ] Timeout: 30s for content generation, 10s for embedding
- [ ] Arabic language setting passed to Gemini (language instruction in system prompt)

**Files to create/modify:** src/modules/ai/gemini/gemini-client.ts, src/modules/ai/gemini/gemini.module.ts, src/modules/ai/gemini/gemini-config.ts, src/modules/ai/ai.module.ts, src/config/ai.config.ts

**Dependencies:** STORY-1

---

**STORY-43**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** RAG pipeline — chunking, embedding, and pgvector

**Points:** 5

**Description:** As a developer, I want a RAG pipeline that chunks PDF text, generates embeddings via Gemini, and stores them in pgvector so that both quiz generation and AI tutor can retrieve relevant content.

**Acceptance criteria:**

- [ ] ChunkingService: splits text by paragraphs (double newline), min 100 chars per chunk
- [ ] EmbeddingService: calls Gemini embedContent for each chunk, stores in pgvector
- [ ] pgvector extension enabled in target database (migration)
- [ ] DocumentChunk entity: id (UUID), content (text), embedding (vector(768)), lessonId (FK), metadata (JSON)
- [ ] Migration creates document_chunks table with IVFFlat index on embedding column
- [ ] IndexChunksService: orchestrates chunk → embed → store for a lesson's PDF
- [ ] POST /ai/index/lesson/:lessonId — trigger indexing for a lesson (re-indexes if exists)
- [ ] SimilaritySearchService: cosine similarity search, returns top K chunks (default K=5)
- [ ] Auto-indexing: when a lesson is created/updated with PDFs, auto-trigger indexing (synchronous for MVP)
- [ ] GET /ai/status/:lessonId — returns indexing status (pending/indexing/ready/failed)

**Files to create/modify:** src/modules/ai/rag/chunking.service.ts, src/modules/ai/rag/embedding.service.ts, src/modules/ai/rag/index-chunks.service.ts, src/modules/ai/rag/similarity-search.service.ts, src/modules/ai/entities/document-chunk.entity.ts, src/modules/ai/rag/rag.module.ts, src/modules/ai/ai.module.ts, src/database/migrations/005-create-document-chunks.ts, src/database/migrations/006-enable-pgvector.ts

**Dependencies:** STORY-42, STORY-24, STORY-25

---

**STORY-44**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Quiz and Question entities with migration

**Points:** 3

**Description:** As a developer, I want Quiz and Question entities with a migration so that the quiz generation and management features have a data model.

**Acceptance criteria:**

- [ ] Quiz entity: id (UUID), title, description (nullable), chapterId (FK, nullable), status (draft/published), questionCount, totalPoints, createdAt, updatedAt
- [ ] Question entity: id (UUID), quizId (FK → quizzes), type (enum: MCQ/TRUE_FALSE/ESSAY), content (text), options (jsonb), correctAnswer (text, nullable for essay), sortOrder (integer), points (integer, default 1)
- [ ] QuizAttempt entity: id (UUID), quizId (FK), studentId (FK → users), answers (jsonb), score (float, nullable), totalPoints (integer), status (in_progress/completed/graded), startedAt, completedAt, createdAt
- [ ] Quiz → Question: one-to-many with cascade
- [ ] Quiz → Chapter: optional many-to-one
- [ ] Migration creates quizzes, questions, quiz_attempts tables with proper FKs and indexes
- [ ] correctAnswer nullable for essay questions (teacher manually grades later)

**Files to create/modify:** src/modules/quizzes/entities/quiz.entity.ts, src/modules/quizzes/entities/question.entity.ts, src/modules/quizzes/entities/quiz-attempt.entity.ts, src/modules/quizzes/quizzes.module.ts, src/database/migrations/007-create-quizzes.ts

**Dependencies:** STORY-24 (chapter FK)

---

**STORY-45**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** AI quiz generation endpoint

**Points:** 5

**Description:** As a teacher, I want to generate a quiz draft from my content by specifying question count, types, difficulty, and topics so that I can quickly create assessments.

**Acceptance criteria:**

- [ ] POST /quizzes/generate accepts: chapterId (or lessonIds), questionCount, types (array: MCQ/TF/ESSAY), difficulty (easy/medium/hard), topicFocus (string, optional)
- [ ] Service flow: (1) query RAG for relevant chunks → (2) build prompt with chunk content + parameters → (3) call Gemini → (4) parse response into question objects → (5) create Quiz with questions in draft status
- [ ] Prompt instructs Gemini to generate questions ONLY from provided content (no external knowledge)
- [ ] Response parsing: extract structured questions from Gemini markdown/JSON response
- [ ] Generation timeout: 25s total (Gemini call has 20s timeout)
- [ ] Returns created quiz with all questions (IDs assigned)
- [ ] If generation fails, returns 422 with error details and suggestion to retry with simpler parameters
- [ ] Generated quiz saved as draft (not visible to students yet)

**Files to create/modify:** src/modules/quizzes/services/quiz-generation.service.ts, src/modules/quizzes/controllers/quizzes.controller.ts, src/modules/quizzes/dto/generate-quiz.dto.ts, src/modules/ai/gemini/prompts/quiz-generation.prompt.ts

**Dependencies:** STORY-43, STORY-44, STORY-42

---

**STORY-46**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Quiz CRUD API — edit, delete, reorder, manual add

**Points:** 2

**Description:** As a teacher, I want to edit generated questions, delete questions, reorder them, and manually add new questions so that I can refine the quiz before publishing.

**Acceptance criteria:**

- [ ] GET /quizzes — list all quizzes for tenant (filterable by status: draft/published)
- [ ] GET /quizzes/:id — get quiz with all questions
- [ ] PUT /quizzes/:id — update quiz title/description
- [ ] DELETE /quizzes/:id — delete quiz + cascade questions (only if status=draft)
- [ ] POST /quizzes/:id/questions — manually add a question
- [ ] PUT /quizzes/:id/questions/:questionId — update a question
- [ ] DELETE /quizzes/:id/questions/:questionId — delete a question
- [ ] PATCH /quizzes/:id/questions/reorder — reorder questions
- [ ] All endpoints scoped to authenticated teacher via auth middleware
- [ ] Published quizzes cannot be edited (returns 403)

**Files to create/modify:** src/modules/quizzes/controllers/questions.controller.ts, src/modules/quizzes/services/questions.service.ts, src/modules/quizzes/dto/create-question.dto.ts, src/modules/quizzes/dto/update-question.dto.ts, src/modules/quizzes/services/quizzes.service.ts, src/modules/quizzes/controllers/quizzes.controller.ts

**Dependencies:** STORY-44

---

**STORY-47**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Quiz publish and assign to chapter

**Points:** 2

**Description:** As a teacher, I want to publish a quiz and assign it to a chapter so that enrolled students can see and take it.

**Acceptance criteria:**

- [ ] PATCH /quizzes/:id/publish — changes status from draft → published
- [ ] POST /quizzes/:id/assign — assigns quiz to a chapter (accepts chapterId)
- [ ] Validation: quiz must have at least 1 question to publish
- [ ] Validation: quiz must be in draft status
- [ ] Assignment scoped: a chapter can have multiple quizzes
- [ ] GET /chapters/:chapterId/quizzes — returns published quizzes for a chapter
- [ ] Published quiz snapshot: questions are copied/immutable once published
- [ ] Publishing records publishedAt timestamp

**Files to create/modify:** src/modules/quizzes/services/quiz-publish.service.ts, src/modules/quizzes/controllers/quizzes.controller.ts, src/modules/quizzes/dto/assign-quiz.dto.ts

**Dependencies:** STORY-44, STORY-46

---

**STORY-48**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Quiz submission endpoint

**Points:** 3

**Description:** As a student, I want to submit my quiz answers so that the system can auto-grade my MCQ and True/False questions.

**Acceptance criteria:**

- [ ] GET /quizzes/assigned — returns list of published quizzes for chapters the student is enrolled in
- [ ] POST /quizzes/:id/attempt — start a quiz attempt (creates attempt record, status=in_progress)
- [ ] POST /attempts/:attemptId/submit — submit answers (accepts array of { questionId, answer })
- [ ] Validation: all questions must be answered (no partial submission)
- [ ] Validation: student must be enrolled in the quiz's chapter
- [ ] Validation: quiz must be published
- [ ] On submit, auto-grade MCQ/TF immediately
- [ ] Essay questions skipped in auto-grade (marked as "pending" in response)
- [ ] Returns graded result: score, totalPoints, percentage, per-question correct/incorrect/pending
- [ ] Checks for duplicate submission (one attempt per quiz per student; no retakes in MVP)
- [ ] POST /attempts/:attemptId/grade-essays — teacher endpoint to manually grade essays

**Files to create/modify:** src/modules/quizzes/services/quiz-attempt.service.ts, src/modules/quizzes/services/auto-grade.service.ts, src/modules/quizzes/controllers/attempts.controller.ts, src/modules/quizzes/dto/submit-attempt.dto.ts, src/modules/quizzes/dto/grade-essay.dto.ts

**Dependencies:** STORY-44, STORY-47

---

**STORY-49**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Auto-grading service for MCQ and True/False

**Points:** 3

**Description:** As a student, I want to receive my score immediately after submitting MCQ and True/False questions so that I know my result right away.

**Acceptance criteria:**

- [ ] AutoGradeService: compares submitted answer to correctAnswer for MCQ/TF
- [ ] For MCQ: exact match on option key (a/b/c/d)
- [ ] For TF: boolean match
- [ ] Score computed as sum of points for correct answers
- [ ] Percentage computed as (score / totalPoints) × 100
- [ ] Per-question result includes: isCorrect, correctAnswer, submittedAnswer, points, feedback
- [ ] Essay questions: status=pending_teacher, points=0 (not counted in percentage)
- [ ] Attempt status set to "graded" when all non-essay questions are scored
- [ ] Attempt status set to "partial" if essay questions remain
- [ ] Results stored in attempt record for retrieval

**Files to create/modify:** src/modules/quizzes/services/auto-grade.service.ts (refine), src/modules/quizzes/dto/quiz-result.dto.ts

**Dependencies:** STORY-48

---

**STORY-50**

**Sprint:** 3

**Epic:** Enrollment & Payments

**Title:** Enrollment entity and CRUD API

**Points:** 3

**Description:** As a student, I want to enroll in chapters so that I can access the locked content and take quizzes.

**Acceptance criteria:**

- [ ] Enrollment entity: id (UUID), studentId (FK → users), chapterId (FK → chapters), status (active/inactive/cancelled), enrolledMonth (integer, 1-12), enrolledYear (integer), price (decimal), paymentMethod (enum: paymob/promo_code), promoCodeId (FK → promo_codes, nullable), startedAt, expiresAt (nullable)
- [ ] Migration creates enrollments table with FKs and composite unique on (studentId, chapterId)
- [ ] POST /enrollments — create enrollment (after payment or promo redemption)
- [ ] GET /enrollments/my — list student's active enrollments with chapter details
- [ ] GET /students/:studentId/enrollments — teacher view of student's enrollments
- [ ] PATCH /enrollments/:id/deactivate — teacher can deactivate enrollment
- [ ] All endpoints scoped: students see own, teachers see their students
- [ ] Enrollment creates initial history entry in student profile

**Files to create/modify:** src/modules/enrollments/entities/enrollment.entity.ts, src/modules/enrollments/enrollments.module.ts, src/modules/enrollments/enrollments.controller.ts, src/modules/enrollments/enrollments.service.ts, src/modules/enrollments/dto/create-enrollment.dto.ts, src/database/migrations/008-create-enrollments.ts

**Dependencies:** STORY-23, STORY-3

---

**STORY-51**

**Sprint:** 3

**Epic:** Enrollment & Payments

**Title:** Paymob payment integration — checkout URL and webhook

**Points:** 5

**Description:** As a student, I want to pay for a chapter using my card via Paymob so that my enrollment is activated immediately after successful payment.

**Acceptance criteria:**

- [ ] POST /payments/checkout — accepts chapterId, returns Paymob iframe URL
- [ ] Paymob flow: (1) Create order via Paymob API → (2) Get payment key → (3) Generate iframe URL
- [ ] Order amount = chapter price, currency = EGP
- [ ] Billing data: student name, email, phone (from profile)
- [ ] POST /payments/webhook — Paymob transaction callback endpoint
- [ ] Webhook HMAC signature verified (Paymob hmac secret from env)
- [ ] On successful payment: create enrollment record
- [ ] On failed payment: log error, return failure to Paymob
- [ ] Payment error messages in Arabic/English based on locale (NFR-1)
- [ ] GET /payments/status/:orderId — check payment status
- [ ] Payment transaction logged: id, studentId, chapterId, amount, status, paymobTransactionId, errorMessage, createdAt
- [ ] Idempotency: duplicate webhook calls don't create duplicate enrollments

**Files to create/modify:** src/modules/payments/payments.module.ts, src/modules/payments/payments.controller.ts, src/modules/payments/payments.service.ts, src/modules/payments/paymob/paymob.client.ts, src/modules/payments/paymob/paymob.config.ts, src/modules/payments/entities/payment-transaction.entity.ts, src/modules/payments/dto/checkout.dto.ts, src/database/migrations/009-create-payment-transactions.ts, src/modules/enrollments/enrollments.service.ts

**Dependencies:** STORY-50, STORY-23

---

**STORY-52**

**Sprint:** 3

**Epic:** Enrollment & Payments

**Title:** PromoCode entity and CRUD API

**Points:** 2

**Description:** As a support agent, I want to create and manage single-use promo codes so that students can enroll without payment.

**Acceptance criteria:**

- [ ] PromoCode entity: id (UUID), code (string, 8-char alphanumeric, unique), isUsed (boolean, default false), usedByStudentId (FK → users, nullable), usedAt (timestamp, nullable), createdBy, createdAt, expiresAt (nullable, default 1 year)
- [ ] Migration creates promo_codes table with unique index on code
- [ ] POST /promo-codes — generate a new promo code (random 8-char alphanumeric)
- [ ] GET /promo-codes — list all promo codes with usage status (paginated)
- [ ] Code generated via crypto.randomBytes (non-guessable)
- [ ] Code format: uppercase alphanumeric, no ambiguous chars (0/O, 1/I/L)
- [ ] POST /promo-codes/:code/validate — check if code is valid
- [ ] POST /promo-codes/:code/redeem — redeem code for current student
- [ ] Redeem validation: code must exist, not used, not expired
- [ ] Redeem creates enrollment with paymentMethod=promo_code

**Files to create/modify:** src/modules/promo-codes/entities/promo-code.entity.ts, src/modules/promo-codes/promo-codes.module.ts, src/modules/promo-codes/promo-codes.controller.ts, src/modules/promo-codes/promo-codes.service.ts, src/modules/promo-codes/dto/generate-code.dto.ts, src/database/migrations/010-create-promo-codes.ts

**Dependencies:** STORY-50

---

**STORY-53**

**Sprint:** 3

**Epic:** Enrollment & Payments

**Title:** Promo code validation and redemption endpoint

**Points:** 1

**Description:** As a student, I want to enter a promo code on the payment page so that I can enroll without paying.

**Acceptance criteria:**

- [ ] POST /promo-codes/redeem — accepts { code, chapterId }, validates and redeems
- [ ] Validation: code exists, not expired, not already used
- [ ] Validation: not already enrolled in this chapter
- [ ] On success: creates enrollment, marks code as used
- [ ] On failure: returns 400 with error message in Arabic/English
- [ ] Error: "الكود غير صالح" / "Invalid code", "تم استخدام هذا الكود من قبل" / "Code already used", "أنت مشترك بالفعل في هذا الفصل" / "Already enrolled in this chapter"

**Files to create/modify:** src/modules/promo-codes/dto/redeem.dto.ts, src/modules/promo-codes/promo-codes.controller.ts (add redeem endpoint), src/modules/promo-codes/promo-codes.service.ts (add redeem method)

**Dependencies:** STORY-52

---

**STORY-54**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Quiz Generator — Step 1: prompt parameters form

**Points:** 3

**Description:** As a teacher, I want to configure quiz parameters (question count, types, difficulty, topics) so that I can generate a quiz tailored to my content.

**Acceptance criteria:**

- [ ] Form fields: chapter/lesson selector, question count (1-50, default 10), question types (checkboxes: MCQ, True/False, Essay), difficulty (radio: Easy/Medium/Hard), topic focus (text input, optional)
- [ ] Chapter selector populated from content tree API
- [ ] "Generate Quiz" button with loading state (spinner + "جارٍ الإنشاء..." / "Generating...")
- [ ] Estimated time display: "قد يستغرق ذلك حتى 20 ثانية" / "This may take up to 20 seconds"
- [ ] Validation: at least one question type selected, question count ≥ 1
- [ ] On generation start: show progress state
- [ ] On generation complete: navigate to Step 2 with generated quiz ID
- [ ] On generation error: show error with retry button and simpler params suggestion
- [ ] Form state preserved if navigation back from Step 2

**Files to create/modify:** src/pages/QuizGenerator/QuizGenerator.tsx, src/pages/QuizGenerator/QuizGenerator.module.css, src/pages/QuizGenerator/components/StepIndicator.tsx, src/pages/QuizGenerator/steps/Step1Params.tsx, src/pages/QuizGenerator/steps/Step1Params.module.css, src/api/quizzes.ts (generateQuiz), src/i18n/ar/quiz.json, src/i18n/en/quiz.json, src/router/routes.ts

**Dependencies:** STORY-45, STORY-31

---

**STORY-55**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Quiz Generator — Step 2: review and edit questions

**Points:** 3

**Description:** As a teacher, I want to review generated questions, edit them, delete unwanted ones, reorder, and add manual questions so that I can refine the quiz before publishing.

**Acceptance criteria:**

- [ ] Question list: each question shows its type badge, content, options, correct answer, and edit/delete/reorder controls
- [ ] Edit question: inline edit mode or modal
- [ ] Delete question: confirmation dialog
- [ ] Reorder: drag handles
- [ ] "Add Question" button opens question editor for manual creation
- [ ] Question count badge at top
- [ ] "Back to Step 1" button preserves parameters
- [ ] "Continue to Step 3" button enabled when ≥ 1 question exists
- [ ] MCQ options shown as A/B/C/D radio buttons in preview

**Files to create/modify:** src/pages/QuizGenerator/steps/Step2Review.tsx, src/pages/QuizGenerator/steps/Step2Review.module.css, src/pages/QuizGenerator/components/QuestionCard.tsx, src/pages/QuizGenerator/components/QuestionEditor.tsx, src/pages/QuizGenerator/components/QuestionEditor.module.css, src/api/quizzes.ts

**Dependencies:** STORY-46, STORY-54

---

**STORY-56**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Quiz Generator — Step 3: publish with chapter assignment

**Points:** 2

**Description:** As a teacher, I want to publish my quiz and assign it to a chapter so that enrolled students can see and take it.

**Acceptance criteria:**

- [ ] Chapter selector: dropdown of all chapters
- [ ] Quiz summary card: question count by type, total points, difficulty
- [ ] "Publish" button with loading state
- [ ] After publish: success toast + navigate to quiz list view
- [ ] Quiz list view: table with columns (Title, Chapter, Questions, Status, Published Date, Actions)
- [ ] Actions: View, Unpublish, Delete
- [ ] Filters: All / Draft / Published
- [ ] Empty state: "لم يتم إنشاء أي اختبارات بعد" / "No quizzes created yet" + "Create Quiz" button

**Files to create/modify:** src/pages/QuizGenerator/steps/Step3Publish.tsx, src/pages/QuizGenerator/steps/Step3Publish.module.css, src/pages/QuizGenerator/components/QuizList.tsx, src/pages/QuizGenerator/components/QuizList.module.css, src/api/quizzes.ts

**Dependencies:** STORY-47, STORY-54

---

**STORY-57**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Quiz taking page

**Points:** 3

**Description:** As a student, I want to take a published quiz with MCQ radio buttons, True/False toggle, and Essay text areas so that I can answer all question types.

**Acceptance criteria:**

- [ ] Page header: quiz title, chapter name, question count, total points
- [ ] Questions rendered sequentially:
  - MCQ: radio button group with options A/B/C/D
  - True/False: toggle switch
  - Essay: textarea with character count (max 2000)
- [ ] Each question numbered and shows its point value
- [ ] Progress indicator: "Question X of Y"
- [ ] Submit button at bottom with confirmation dialog
- [ ] Validation: all questions must be answered before submit
- [ ] Unanswered questions highlighted with error indicator
- [ ] Loading state during submission
- [ ] After submission: navigate to results page
- [ ] 403 if student not enrolled in quiz's chapter
- [ ] 400 if quiz already attempted

**Files to create/modify:** src/pages/QuizTaking/QuizTaking.tsx, src/pages/QuizTaking/QuizTaking.module.css, src/pages/QuizTaking/components/McqQuestion.tsx, src/pages/QuizTaking/components/TfQuestion.tsx, src/pages/QuizTaking/components/EssayQuestion.tsx, src/pages/QuizTaking/components/ProgressBar.tsx, src/pages/QuizTaking/components/SubmitConfirm.tsx, src/api/quizzes.ts, src/router/routes.ts

**Dependencies:** STORY-48, STORY-30

---

**STORY-58**

**Sprint:** 3

**Epic:** AI Quiz Generation

**Title:** Quiz results page

**Points:** 2

**Description:** As a student, I want to see my quiz results with score, correct/wrong answers highlighted, and essay questions marked pending so that I can review my performance.

**Acceptance criteria:**

- [ ] Score card: score/totalPoints, percentage, pass/fail indicator (≥50% green, <50% red)
- [ ] Per-question review:
  - Correct: green border + checkmark, shows correct answer
  - Wrong: red border + X mark, shows correct answer vs submitted
  - Essay: yellow border + "بانتظار التصحيح" / "Awaiting grading" badge
- [ ] MCQ: radio options with correct/wrong highlighted
- [ ] TF: toggle with correct/wrong state
- [ ] Essay: shows submitted text + "awaiting grading" badge
- [ ] "Back to Dashboard" button
- [ ] Loading state: skeleton score card + question skeletons

**Files to create/modify:** src/pages/QuizResults/QuizResults.tsx, src/pages/QuizResults/QuizResults.module.css, src/pages/QuizResults/components/ScoreCard.tsx, src/pages/QuizResults/components/QuestionReview.tsx, src/pages/QuizResults/components/QuestionReview.module.css, src/api/quizzes.ts

**Dependencies:** STORY-49, STORY-57

---

**STORY-59**

**Sprint:** 3

**Epic:** Enrollment & Payments

**Title:** Payment page — Paymob iframe and promo code entry

**Points:** 3

**Description:** As a student, I want to choose between paying via Paymob or entering a promo code so that I can enroll in a chapter.

**Acceptance criteria:**

- [ ] Two enrollment path cards presented equally:
  - Card 1: "الدفع عبر بايموب" / "Pay via Paymob" — shows price, "اشترك الآن" / "Subscribe Now" button
  - Card 2: "كود خصم" / "Promo Code" — text input + "تأكيد" / "Redeem" button
- [ ] Paymob flow: click button → loading state → Paymob iframe opens in modal/overlay
- [ ] Iframe shows Paymob hosted checkout with price in EGP
- [ ] Payment success: iframe closes → success screen → "اذهب إلى الكورس" / "Go to Course" button
- [ ] Payment failure: iframe closes → error message with retry button
- [ ] Promo code flow: enter code → validate → success → enrollment active
- [ ] Promo code error: inline error message
- [ ] Loading state during payment URL generation
- [ ] Already enrolled state: "أنت مشترك بالفعل" / "Already enrolled" + "Go to Course"
- [ ] Chapter info displayed (name, stage, price, description)

**Files to create/modify:** src/pages/Payment/Payment.tsx, src/pages/Payment/Payment.module.css, src/pages/Payment/components/PaymobCard.tsx, src/pages/Payment/components/PromoCodeCard.tsx, src/pages/Payment/components/PaymentSuccess.tsx, src/pages/Payment/components/PaymentFailure.tsx, src/api/payments.ts, src/api/promo-codes.ts, src/router/routes.ts

**Dependencies:** STORY-51, STORY-53

---

**STORY-60**

**Sprint:** 3

**Epic:** Enrollment & Payments

**Title:** Promo code generator page (support agent)

**Points:** 2

**Description:** As a support agent, I want to generate and copy promo codes so that I can provide them to students who need free enrollment.

**Acceptance criteria:**

- [ ] "إنشاء كود" / "Generate Code" button → generates single code
- [ ] Generated code displayed with "نسخ" / "Copy" button (copies to clipboard)
- [ ] Copy success toast: "تم النسخ" / "Copied!"
- [ ] Usage log table: Code, Status (Used/Unused), Used By, Used At, Created At
- [ ] Table paginated (20 per page)
- [ ] Filters: All / Used / Unused
- [ ] Empty state: "لم يتم إنشاء أي أكواد بعد" / "No codes generated yet"
- [ ] Loading state during generation
- [ ] Access restricted to admin/support role

**Files to create/modify:** src/pages/PromoCodeManager/PromoCodeManager.tsx, src/pages/PromoCodeManager/PromoCodeManager.module.css, src/pages/PromoCodeManager/components/CodeGenerator.tsx, src/pages/PromoCodeManager/components/CodeLogTable.tsx, src/api/promo-codes.ts, src/router/routes.ts

**Dependencies:** STORY-52

---

**STORY-61**

**Sprint:** 3

**Epic:** Student Learning Experience

**Title:** Student quiz list page

**Points:** 2

**Description:** As a student, I want to see a list of quizzes assigned to my enrolled chapters so that I can take them and track my results.

**Acceptance criteria:**

- [ ] Page shows chapters the student is enrolled in, each with its quizzes
- [ ] Per quiz: title, question count, difficulty badge, status badge (New / Completed X%)
- [ ] New quizzes: "ابدأ الاختبار" / "Start Quiz" button
- [ ] Completed quizzes: "عرض النتيجة" / "View Result" button
- [ ] Empty state: "لا توجد اختبارات متاحة" / "No quizzes available"
- [ ] Loading state: skeleton cards
- [ ] Accessible from student sidebar or dashboard

**Files to create/modify:** src/pages/StudentQuizzes/StudentQuizzes.tsx, src/pages/StudentQuizzes/StudentQuizzes.module.css, src/pages/StudentQuizzes/components/QuizCard.tsx, src/api/student.ts, src/router/routes.ts

**Dependencies:** STORY-48, STORY-30

---

**STORY-62**

**Sprint:** 3

**Epic:** Enrollment & Payments

**Title:** Student enrollment flow wiring

**Points:** 1

**Description:** As a student, I want to click "Subscribe" on a locked chapter and be taken to the payment page so that I can complete enrollment.

**Acceptance criteria:**

- [ ] "اشترك الآن" / "Subscribe Now" button on locked chapters in "All Content" tab
- [ ] Button navigates to /payment/:chapterId with chapter details pre-loaded
- [ ] After successful payment/redeem, student is redirected back to the chapter's lesson list
- [ ] "My Courses" tab refreshes to show newly enrolled chapter
- [ ] "All Content" tab updates lock status to "Enrolled"
- [ ] Loading state during redirect/refresh
- [ ] Error handling: if payment fails, stay on payment page with error message

**Files to create/modify:** src/pages/StudentDashboard/components/AllContentTab.tsx, src/pages/Payment/Payment.tsx, src/hooks/useEnrollment.ts

**Dependencies:** STORY-59, STORY-40

---

## Sprint 4: AI Tutor, Support, Teacher Engagement & Production Polish

**Goal:** Students ask content-grounded questions to the AI Tutor with lesson citations. WhatsApp support flows end-to-end. Teachers view detailed student engagement and grade essays. The entire app ships with production-grade states, responsive design, and accessibility.

**Points:** 48

---

**STORY-63**

**Sprint:** 4

**Epic:** Student Learning Experience

**Title:** AI Tutor service — RAG-based Q&A with Gemini

**Points:** 3

**Description:** As a developer, I want an AiTutorService that takes a student's question, retrieves relevant content chunks via RAG, and generates an answer with lesson citations so that students get contextually accurate responses.

**Acceptance criteria:**

- [ ] AiTutorService.ask(question, studentId) → { answer, citations }
- [ ] Flow: (1) embed question → (2) similarity search on teacher's chunks (top K=5) → (3) build prompt → (4) call Gemini → (5) parse answer + extract citation references
- [ ] Prompt instructs Gemini: answer ONLY from provided context, cite specific lesson names, if not in context say "لم أجد إجابة في المحتوى المتاح" / "I couldn't find an answer"
- [ ] Citations returned as array of { lessonId, lessonTitle, chapterName, relevanceScore }
- [ ] Session-scoped (no conversation memory between queries)
- [ ] Arabic language quality enforced in system prompt
- [ ] Error handling: RAG returns no chunks → return "not found" response (not error)
- [ ] Timeout: 25s total (15s for search, 10s for generation)

**Files to create/modify:** src/modules/ai/tutor/ai-tutor.service.ts, src/modules/ai/tutor/tutor.module.ts, src/modules/ai/gemini/prompts/tutor-prompt.ts, src/modules/ai/rag/similarity-search.service.ts

**Dependencies:** STORY-42, STORY-43

---

**STORY-64**

**Sprint:** 4

**Epic:** Student Learning Experience

**Title:** AI Tutor API endpoint

**Points:** 2

**Description:** As a student, I want to send a text question and receive an AI answer grounded in my teacher's content so that I can get help understanding the material.

**Acceptance criteria:**

- [ ] POST /tutor/ask accepts: { question }
- [ ] Returns: { answer (string), citations (array of { lessonId, lessonTitle, chapterName }) }
- [ ] 401 if student not enrolled in any chapter
- [ ] 429 if daily query limit exceeded
- [ ] Question length validation: 10-500 characters
- [ ] Response time < 20s
- [ ] Logged: studentId, question, answer preview, timestamp
- [ ] Streaming optional for MVP (return full response; streaming in v2)

**Files to create/modify:** src/modules/ai/tutor/tutor.controller.ts, src/modules/ai/tutor/dto/ask-question.dto.ts, src/modules/ai/ai.module.ts

**Dependencies:** STORY-63

---

**STORY-65**

**Sprint:** 4

**Epic:** Student Learning Experience

**Title:** Per-student daily AI Tutor query cap

**Points:** 2

**Description:** As a teacher, I want to limit how many AI Tutor questions each student can ask per day so that I control API costs.

**Acceptance criteria:**

- [ ] dailyQueryCount column on StudentProfile or separate AIUsage entity
- [ ] Default daily cap: 20 queries per student (configurable)
- [ ] QueryGuard: increments count on each POST /tutor/ask, rejects if exceeded
- [ ] Count resets daily (server date, not rolling window)
- [ ] 429 response with message: "لقد تجاوزت الحد اليومي للأسئلة. يرجى المحاولة غداً." / "You've exceeded your daily question limit."
- [ ] Response includes: { limit, remaining, resetsAt }
- [ ] Teacher can view/update cap in settings
- [ ] GET /tutor/usage-today returns { used, limit, remaining }

**Files to create/modify:** src/modules/ai/tutor/guards/query-limit.guard.ts, src/modules/ai/entities/ai-usage.entity.ts, src/modules/ai/tutor/dto/usage.dto.ts, src/database/migrations/011-create-ai-usage.ts, src/modules/teachers/teachers.controller.ts, src/modules/teachers/services/teacher-settings.service.ts

**Dependencies:** STORY-64

---

**STORY-66**

**Sprint:** 4

**Epic:** Content Management

**Title:** Teacher student engagement stats API

**Points:** 3

**Description:** As a teacher, I want an API that returns a list of my enrolled students with their status, last activity, and overall engagement so that I can monitor student participation.

**Acceptance criteria:**

- [ ] GET /dashboard/teacher/students returns array of { studentId, studentName, studentPhone, status, enrolledChapterCount, totalLessonsWatched, averageQuizScore, lastActivityAt, enrollmentMonths }
- [ ] Status computed: active if enrolled within last 30 days, inactive otherwise
- [ ] Quiz scores averaged across all graded attempts
- [ ] "Last activity" = max of (last login, last quiz attempt, last lesson view)
- [ ] Sortable by: name, lastActivity, averageQuizScore
- [ ] Searchable by student name (LIKE query)
- [ ] Paginated (20 per page)
- [ ] Response time < 1s for 100+ enrolled students

**Files to create/modify:** src/modules/dashboard/services/student-engagement.service.ts, src/modules/dashboard/dashboard.controller.ts, src/modules/dashboard/dto/student-engagement.dto.ts

**Dependencies:** STORY-29, STORY-50

---

**STORY-67**

**Sprint:** 4

**Epic:** Content Management

**Title:** Teacher per-lesson breakdown API

**Points:** 2

**Description:** As a teacher, I want to see a per-lesson breakdown for each student showing whether they watched the video and downloaded PDFs so that I can track detailed engagement.

**Acceptance criteria:**

- [ ] GET /dashboard/teacher/students/:studentId/lessons returns array of { lessonId, lessonTitle, chapterName, videoWatched (boolean/percentage), pdfDownloaded (boolean), lastViewedAt }
- [ ] Video watched: tracked via view tracking on lesson page load
- [ ] PDF downloaded: tracked when pre-signed URL is accessed
- [ ] Response includes student name and total lessons count
- [ ] Filterable by chapterId
- [ ] Empty state: student has no enrolled chapters with content

**Files to create/modify:** src/modules/dashboard/services/lesson-engagement.service.ts, src/modules/dashboard/dashboard.controller.ts, src/modules/dashboard/dto/lesson-breakdown.dto.ts

**Dependencies:** STORY-66

---

**STORY-68**

**Sprint:** 4

**Epic:** AI Quiz Generation

**Title:** Teacher essay grading and quiz results API

**Points:** 2

**Description:** As a teacher, I want to grade essay questions and view all quiz results for my students so that I can complete the assessment cycle.

**Acceptance criteria:**

- [ ] GET /quizzes/:quizId/results — returns all student attempts with scores, per-question breakdowns
- [ ] GET /quizzes/:quizId/results/ungraded — returns only attempts with ungraded essays
- [ ] PATCH /attempts/:attemptId/grade-essays — grade essays (accepts array of { questionId, points, feedback })
- [ ] Validation: points cannot exceed question's max points
- [ ] After grading, attempt score recalculated to include essay points
- [ ] Results sortable by score and student name
- [ ] CSV export: GET /quizzes/:quizId/results/export

**Files to create/modify:** src/modules/quizzes/services/quiz-results.service.ts, src/modules/quizzes/controllers/results.controller.ts, src/modules/quizzes/dto/grade-essay.dto.ts

**Dependencies:** STORY-48, STORY-44

---

**STORY-69**

**Sprint:** 4

**Epic:** Student Learning Experience

**Title:** AI Tutor chat UI

**Points:** 5

**Description:** As a student, I want to chat with the AI Tutor in a messaging-style interface so that I can ask questions and get answers naturally.

**Acceptance criteria:**

- [ ] Chat bubble layout: student messages right-aligned, AI messages left-aligned
- [ ] Input field at bottom: textarea (auto-resize, max 500 chars), send button (↑ icon), disabled while loading
- [ ] Typing indicator: "AI يكتب..." / "AI is typing..." animated dots
- [ ] Message history: shows all Q&A pairs for current session (in-memory)
- [ ] Scroll to bottom on new message
- [ ] Welcome message: "اسألني أي سؤال عن محتوى كورساتك!" / "Ask me anything about your course content!"
- [ ] Error message bubble: red border, retry button
- [ ] Loading: send button shows spinner, textarea disabled
- [ ] Keyboard: Enter to send (Shift+Enter for newline)
- [ ] Citation chips appear inline in AI messages as clickable pills

**Files to create/modify:** src/pages/AiTutor/AiTutor.tsx, src/pages/AiTutor/AiTutor.module.css, src/pages/AiTutor/components/ChatMessage.tsx, src/pages/AiTutor/components/ChatMessage.module.css, src/pages/AiTutor/components/ChatInput.tsx, src/pages/AiTutor/components/TypingIndicator.tsx, src/pages/AiTutor/components/WelcomeMessage.tsx, src/api/tutor.ts, src/router/routes.ts

**Dependencies:** STORY-64

---

**STORY-70**

**Sprint:** 4

**Epic:** Student Learning Experience

**Title:** Citation chips component

**Points:** 2

**Description:** As a student, I want to see clickable citation chips in AI Tutor responses so that I can directly open the referenced lesson to verify or learn more.

**Acceptance criteria:**

- [ ] Citation chips appear as small pills after AI answer text: "📖 [Lesson Name]"
- [ ] Each chip is a clickable link to /lessons/:lessonId
- [ ] Chips styled with cyan border, small font, rounded
- [ ] Max 3 citations shown (truncate with "+N more")
- [ ] Hover tooltip shows full lesson title and chapter name
- [ ] Click opens lesson view page
- [ ] If no citations, show answer without chips

**Files to create/modify:** src/pages/AiTutor/components/CitationChip.tsx, src/pages/AiTutor/components/CitationChip.module.css, src/pages/AiTutor/components/ChatMessage.tsx

**Dependencies:** STORY-69

---

**STORY-71**

**Sprint:** 4

**Epic:** Student Learning Experience

**Title:** Daily query counter in chat header

**Points:** 1

**Description:** As a student, I want to see how many AI Tutor questions I have left today so that I can manage my usage.

**Acceptance criteria:**

- [ ] Chat header displays: "الاستعلامات المتبقية: X من Y" / "Remaining queries: X of Y"
- [ ] Counter updates after each question (decrements in real-time)
- [ ] When 0 remaining: input disabled with message "لقد استنفدت حدك اليومي" / "You've reached your daily limit"
- [ ] Counter loads from GET /tutor/usage-today on mount
- [ ] Warning state: ≤3 remaining shows orange color

**Files to create/modify:** src/pages/AiTutor/components/QueryCounter.tsx, src/pages/AiTutor/components/QueryCounter.module.css, src/pages/AiTutor/AiTutor.tsx, src/api/tutor.ts

**Dependencies:** STORY-65, STORY-69

---

**STORY-72**

**Sprint:** 4

**Epic:** Student Learning Experience

**Title:** WhatsApp support button

**Points:** 2

**Description:** As a student, I want to click a persistent support button that opens WhatsApp pre-filled with my name and email so that I can easily contact the teacher.

**Acceptance criteria:**

- [ ] Floating support button (WhatsApp icon) visible on all student pages (bottom-right)
- [ ] Click opens WhatsApp with pre-filled message: "مرحباً، أنا [name] (البريد: [email])، أحتاج مساعدة في المنصة" / "Hello, I'm [name] (Email: [email]), I need help"
- [ ] WhatsApp number configurable by teacher (default: teacher's phone)
- [ ] Button hidden on auth pages (login, register, forgot-password)
- [ ] Position: fixed bottom-right, green icon with white phone
- [ ] Tooltip on hover: "تواصل مع الدعم" / "Contact Support"
- [ ] Student info pulled from auth context

**Files to create/modify:** src/components/common/SupportButton/SupportButton.tsx, src/components/common/SupportButton/SupportButton.module.css, src/components/layout/AppShell.tsx, src/api/teacher.ts

**Dependencies:** STORY-17, STORY-73

---

**STORY-73**

**Sprint:** 4

**Epic:** Content Management

**Title:** Teacher support settings page

**Points:** 1

**Description:** As a teacher, I want to configure my WhatsApp number for student support so that students can contact me directly.

**Acceptance criteria:**

- [ ] Settings page section: "إعدادات الدعم" / "Support Settings"
- [ ] Field: WhatsApp number (with country code)
- [ ] Default value: teacher's own phone number from profile
- [ ] Save button with loading state
- [ ] Success toast on save
- [ ] Validation: valid phone number format
- [ ] Preview: "سيظهر زر واتساب للطلاب وسيتم إرسال رقم [phone]" / "A WhatsApp button will appear for students"

**Files to create/modify:** src/pages/TeacherSettings/TeacherSettings.tsx, src/pages/TeacherSettings/TeacherSettings.module.css, src/pages/TeacherSettings/components/SupportSettings.tsx, src/api/teacher.ts, src/router/routes.ts

**Dependencies:** STORY-31

---

**STORY-74**

**Sprint:** 4

**Epic:** Content Management

**Title:** Teacher student engagement table UI

**Points:** 3

**Description:** As a teacher, I want to see a table of all enrolled students with their engagement status so that I can monitor participation.

**Acceptance criteria:**

- [ ] Table columns: Student Name, Phone, Status (Active/Inactive badge), Enrolled Chapters, Lessons Watched, Avg Quiz Score, Last Activity
- [ ] Status badges: Active (green), Inactive (gray)
- [ ] Search input: filters by student name (client-side with debounce)
- [ ] Sortable columns: click header to sort
- [ ] Pagination: 20 per page
- [ ] Row click: expands to show per-lesson breakdown
- [ ] Empty state: "لم يسجل أي طالب بعد" / "No students enrolled yet"
- [ ] Loading state: skeleton table
- [ ] Error state: retry button

**Files to create/modify:** src/pages/StudentEngagement/StudentEngagement.tsx, src/pages/StudentEngagement/StudentEngagement.module.css, src/pages/StudentEngagement/components/StudentTable.tsx, src/pages/StudentEngagement/components/StudentRow.tsx, src/pages/StudentEngagement/components/StatusBadge.tsx, src/pages/StudentEngagement/components/SortHeader.tsx, src/pages/StudentEngagement/components/Pagination.tsx, src/api/teacher.ts, src/router/routes.ts

**Dependencies:** STORY-66, STORY-31

---

**STORY-75**

**Sprint:** 4

**Epic:** Content Management

**Title:** Teacher per-lesson breakdown UI (expandable rows)

**Points:** 2

**Description:** As a teacher, I want to expand a student's row to see their per-lesson engagement so that I can identify which lessons need attention.

**Acceptance criteria:**

- [ ] Clicking a student row expands an inline detail panel below the row
- [ ] Detail panel: per-lesson table (Lesson Name, Chapter, Video Watched, PDF Downloaded, Last Viewed)
- [ ] Filter dropdown: filter by chapter
- [ ] Expand/collapse animation (slide down/up)
- [ ] Loading state within expanded panel
- [ ] Empty state: "لم يتم عرض أي دروس بعد" / "No lessons viewed yet"
- [ ] Only one row expanded at a time (accordion)

**Files to create/modify:** src/pages/StudentEngagement/components/ExpandedRow.tsx, src/pages/StudentEngagement/components/LessonBreakdown.tsx, src/pages/StudentEngagement/components/LessonBreakdown.module.css, src/pages/StudentEngagement/components/StudentRow.tsx, src/api/teacher.ts

**Dependencies:** STORY-67, STORY-74

---

**STORY-76**

**Sprint:** 4

**Epic:** AI Quiz Generation

**Title:** Teacher essay grading UI

**Points:** 2

**Description:** As a teacher, I want to grade student essay answers with points and feedback so that students receive complete quiz results.

**Acceptance criteria:**

- [ ] Page lists all quizzes with ungraded essay count badges
- [ ] Click a quiz → list of students with ungraded essays
- [ ] Click a student → show their essay answers with the question prompt
- [ ] Each essay: student's answer, points input, feedback textarea
- [ ] "Save Grade" button per essay
- [ ] "Grade All" to submit all at once
- [ ] After grading: essay moves to graded, score recalculated
- [ ] Success toast per save
- [ ] Empty state: "جميع المقالات مصححة" / "All essays graded"

**Files to create/modify:** src/pages/EssayGrading/EssayGrading.tsx, src/pages/EssayGrading/EssayGrading.module.css, src/pages/EssayGrading/components/QuizList.tsx, src/pages/EssayGrading/components/StudentList.tsx, src/pages/EssayGrading/components/EssayForm.tsx, src/api/quizzes.ts, src/router/routes.ts

**Dependencies:** STORY-68, STORY-31

---

**STORY-77**

**Sprint:** 4

**Epic:** AI Quiz Generation

**Title:** Teacher quiz results overview page

**Points:** 2

**Description:** As a teacher, I want to see a quiz results overview with student scores and a CSV export so that I can analyze class performance.

**Acceptance criteria:**

- [ ] For each published quiz: table with Student Name, Score/Total, Percentage, Grade badge
- [ ] Summary stats: average score, highest, lowest, pass rate
- [ ] ≥50% green, <50% red
- [ ] "Export CSV" button downloads results
- [ ] CSV columns: Student Name, Phone, Score, Total, Percentage, Per-Question
- [ ] Click a student row → expanded per-question breakdown
- [ ] Filter by pass/fail/all
- [ ] Empty state: "لم يقم أي طالب بحل هذا الاختبار بعد" / "No students have taken this quiz yet"

**Files to create/modify:** src/pages/QuizResults/TeacherQuizResults.tsx, src/pages/QuizResults/TeacherQuizResults.module.css, src/pages/QuizResults/components/SummaryStats.tsx, src/pages/QuizResults/components/ResultsTable.tsx, src/pages/QuizResults/components/ResultsTable.module.css, src/api/quizzes.ts, src/router/routes.ts

**Dependencies:** STORY-68, STORY-31

---

**STORY-78**

**Sprint:** 4

**Epic:** Student Learning Experience

**Title:** Complete student quiz flow navigation polish

**Points:** 1

**Description:** As a student, I want a seamless flow from my dashboard to quizzes to results so that I can navigate the complete quiz experience without confusion.

**Acceptance criteria:**

- [ ] Student sidebar includes "الاختبارات" / "Quizzes" nav item
- [ ] After taking a quiz, "View Result" button appears on quiz card
- [ ] Empty states: "لا توجد اختبارات متاحة حالياً" / "No quizzes available"
- [ ] Chapter page shows quiz count badge
- [ ] Breadcrumbs: Dashboard → Chapter → Quiz
- [ ] Back navigation from results page returns to quiz list
- [ ] Consistent header styling across all quiz pages

**Files to create/modify:** src/pages/StudentDashboard/StudentDashboard.tsx, src/components/layout/StudentSidebar.tsx, src/router/routes.ts, src/i18n/ar/student.json, src/i18n/en/student.json

**Dependencies:** STORY-61, STORY-17

---

**STORY-79**

**Sprint:** 4

**Epic:** Cross-Cutting

**Title:** Responsive design pass

**Points:** 3

**Description:** As a user, I want all pages to render correctly on my device — mobile-first for students, desktop-first for teachers — so that I have a great experience regardless of screen size.

**Acceptance criteria:**

- [ ] Student pages tested at 320px, 375px, 768px, 1024px
- [ ] Teacher pages tested at 768px, 1024px, 1440px, 1920px
- [ ] All tables horizontally scrollable on mobile with sticky first column
- [ ] Sidebar collapses to hamburger menu on mobile for teacher pages
- [ ] Content tree panel stacks vertically on mobile
- [ ] Quiz Gen wizard renders as single-column on mobile
- [ ] Payment page cards stack on mobile
- [ ] Chat UI full-screen on mobile
- [ ] All modals render as bottom sheets on mobile (<640px)
- [ ] Font sizes: base 16px desktop, 14px mobile
- [ ] Touch targets ≥44×44px on mobile
- [ ] No horizontal scrollbars at any breakpoint

**Files to create/modify:** src/theme/responsive.css, all page .module.css files (mobile breakpoints), src/components/layout/TeacherSidebar.module.css, src/components/common/Modal/Modal.module.css

**Dependencies:** All Sprint 1-3 frontend stories

---

**STORY-80**

**Sprint:** 4

**Epic:** Cross-Cutting

**Title:** Error state audit

**Points:** 2

**Description:** As a user, I want to see clear, localized error messages with retry actions when API calls fail so that I know what went wrong and how to recover.

**Acceptance criteria:**

- [ ] Every page with API calls has error state UI
- [ ] Error states: friendly message in Arabic/English, retry button where appropriate
- [ ] Network error: "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت." / "Could not connect to server."
- [ ] 500 error: "حدث خطأ في الخادم. يرجى المحاولة لاحقاً." / "A server error occurred."
- [ ] 403/401: redirect to login with message
- [ ] 429: "لقد تجاوزت الحد المسموح به. يرجى الانتظار." / "Rate limit exceeded."
- [ ] Error boundaries on each major page
- [ ] Toast notification for non-blocking errors
- [ ] All error messages use i18n system

**Files to create/modify:** src/components/common/ErrorState/ErrorState.tsx, src/components/common/ErrorBoundary/ErrorBoundary.tsx, src/components/common/ErrorBoundary/ErrorBoundary.module.css, src/components/common/ErrorState/ErrorState.module.css, src/hooks/useApiError.ts, src/i18n/ar/errors.json, src/i18n/en/errors.json, all page components (wrap with ErrorBoundary)

**Dependencies:** All Sprint 1-3 frontend stories

---

**STORY-81**

**Sprint:** 4

**Epic:** Cross-Cutting

**Title:** Loading state audit

**Points:** 2

**Description:** As a user, I want to see appropriate skeleton loaders while content is loading so that the app feels fast and responsive.

**Acceptance criteria:**

- [ ] Every data-fetching page has skeleton loading states
- [ ] Skeleton types: card, table (rows), tree (lines), text (paragraph lines)
- [ ] Skeleton animation: shimmer/pulse effect
- [ ] Skeletons match layout of actual content
- [ ] Initial page load shows app-level skeleton
- [ ] Skeleton transition: smooth fade to content
- [ ] Minimum loading display: 300ms (prevent flash)
- [ ] Spinner: used for actions (submit, delete), not page loads
- [ ] Button loading state: spinner icon replaces text, button disabled

**Files to create/modify:** src/components/common/Skeleton/Skeleton.tsx, src/components/common/Skeleton/Skeleton.module.css, src/components/common/Skeleton/SkeletonCard.tsx, src/components/common/Skeleton/SkeletonTable.tsx, src/components/common/Skeleton/SkeletonTree.tsx, src/components/common/Spinner/Spinner.tsx, all page components

**Dependencies:** All Sprint 1-3 frontend stories

---

**STORY-82**

**Sprint:** 4

**Epic:** Cross-Cutting

**Title:** Empty state audit

**Points:** 1

**Description:** As a user, I want to see helpful empty state messages with suggested actions when there is no data so that I know what to do next.

**Acceptance criteria:**

- [ ] Every list/table page has an empty state component
- [ ] Empty state: illustration/icon, message, CTA button where applicable
- [ ] Teacher dashboard: "مرحباً! ابدأ بإنشاء محتوى" / "Welcome! Start creating content"
- [ ] Content tree: "لم يتم إضافة أي محتوى بعد" / "No content added yet"
- [ ] My Courses: "لم تشترك في أي كورس بعد" / "Not enrolled yet"
- [ ] Quiz list (teacher): "لم يتم إنشاء أي اختبارات بعد" / "No quizzes created yet"
- [ ] Quiz list (student): "لا توجد اختبارات متاحة" / "No quizzes available"
- [ ] Student engagement: "لم يسجل أي طالب بعد" / "No students enrolled yet"
- [ ] Essay grading: "جميع المقالات مصححة" / "All essays graded"
- [ ] Promo codes: "لم يتم إنشاء أي أكواد بعد" / "No codes generated yet"

**Files to create/modify:** src/components/common/EmptyState/EmptyState.tsx, src/components/common/EmptyState/EmptyState.module.css, all list/table pages

**Dependencies:** All Sprint 1-3 frontend stories

---

**STORY-83**

**Sprint:** 4

**Epic:** Cross-Cutting

**Title:** Performance optimization and accessibility pass

**Points:** 3

**Description:** As a user, I want the app to load quickly and be navigable by keyboard so that I have a smooth, inclusive experience.

**Acceptance criteria:**

- [ ] Code splitting: React.lazy + Suspense for all page components
- [ ] Bundle analysis: main chunk < 300KB (gzipped)
- [ ] Image optimization: lazy loading, WebP format
- [ ] Lighthouse mobile: Performance >70, Accessibility >90
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard: all pages navigable via Tab, Enter, Escape
- [ ] Focus management: focus trap in modals, focus returned after close
- [ ] Skip-to-content link at top of page
- [ ] Color contrast: WCAG AA (4.5:1 normal, 3:1 large)
- [ ] Reduced motion: prefers-reduced-motion respected
- [ ] Font loading: Cairo preloaded, fallback during load
- [ ] RTL/LTR: dir attribute, logical CSS properties

**Files to create/modify:** src/App.tsx (React.lazy + Suspense), vite.config.ts (build split), index.html (skip link, lang), all components (ARIA, keyboard), src/hooks/useReducedMotion.ts, src/theme/accessibility.css

**Dependencies:** All Sprint 1-4 frontend stories
