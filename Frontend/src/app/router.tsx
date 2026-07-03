import { createBrowserRouter, Outlet } from 'react-router-dom';

// Layouts
import { PublicLayout } from '@/shared/components/layout/PublicLayout';
import { StudentLayout } from '@/shared/components/layout/StudentLayout';
import { TeacherLayout } from '@/shared/components/layout/TeacherLayout';
import { SupportLayout } from '@/shared/components/layout/SupportLayout';
import { TeacherStageLayout } from '@/shared/components/layout/TeacherStageLayout';
import { LessonLayout } from '@/shared/components/layout/LessonLayout';
import { AdminLayout } from '@/shared/components/layout/AdminLayout';
import { AuthGuard } from '@/shared/components/guards/AuthGuard';
import { RoleGuard } from '@/shared/components/guards/RoleGuard';

// Public / landing pages
import { LandingPage } from '@/features/landing/pages/LandingPage';
import { NotFoundPage } from '@/features/landing/pages/NotFoundPage';

// Auth pages
import { AuthPage } from '@/features/auth/pages/AuthPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';

// Student pages
import { StudentDashboardPage } from '@/features/student/pages/StudentDashboardPage';
import { MyCoursesPage } from '@/features/student/pages/MyCoursesPage';

import { LessonPage } from '@/features/student/pages/LessonPage';
import { QuizPage } from '@/features/student/pages/QuizPage';
import { StudentQuizListPage } from '@/features/student/pages/StudentQuizListPage';
import { QuizResultsPage } from '@/features/student/pages/QuizResultsPage';
import { AiTutorPage } from '@/features/student/pages/AiTutor/AiTutorPage';
import { PaymentPage } from '@/features/student/pages/PaymentPage';
import { StudentProfilePage } from '@/features/student/pages/StudentProfilePage';

// Teacher pages
import { TeacherDashboardPage } from '@/features/teacher/pages/TeacherDashboardPage';
import { AiQuizGeneratorPage } from '@/features/teacher/pages/AiQuizGeneratorPage';
import { AiQuizReviewPage } from '@/features/teacher/pages/AiQuizReviewPage';
import { AiQuizPublishPage } from '@/features/teacher/pages/AiQuizPublishPage';
import { QuizListPage } from '@/features/teacher/pages/QuizListPage';
import { StudentEngagementPage } from '@/features/teacher/pages/StudentEngagementPage';
import { TeacherBrandingPage } from '@/features/teacher/pages/TeacherBrandingPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AllStagesPage } from '@/features/teacher/pages/AllStagesPage';
import { StageDetailPage } from '@/features/teacher/pages/StageDetailPage';
import { CreateStagePage } from '@/features/teacher/pages/CreateStagePage';
import { EssayGradingHubPage } from '@/features/teacher/pages/EssayGradingHubPage';
import { EssaySubmissionsPage } from '@/features/teacher/pages/EssaySubmissionsPage';
import { EssayGradingDetailPage } from '@/features/teacher/pages/EssayGradingDetailPage';
import { QuizResultsOverviewPage } from '@/features/teacher/pages/QuizResultsOverviewPage';
import { StudentQuestionBreakdownPage } from '@/features/teacher/pages/StudentQuestionBreakdownPage';

// Support pages
import { StudentLookupPage } from '@/features/support/pages/StudentLookupPage';

// Admin pages
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage';
import { TenantsPage } from '@/features/admin/pages/TenantsPage';
import { TenantDetailsPage } from '@/features/admin/pages/TenantDetailsPage';
import { PromoCodesPage as AdminPromoCodesPage } from '@/features/admin/pages/PromoCodesPage';

const router = createBrowserRouter([
  // Public routes
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/auth', element: <AuthPage /> },
      { path: '/forgot-password', element: <ResetPasswordPage /> },
      { path: '/t/:tenantSlug', element: <LandingPage /> },
      { path: '/t/:tenantSlug/auth', element: <AuthPage /> },
    ],
  },
  // Authenticated routes
  {
    element: <AuthGuard />,
    children: [
      // Student
      {
        element: <RoleGuard allowedRoles={['student']} />,
        children: [
          {
            element: <StudentLayout />,
            children: [
              { path: '/student/dashboard', element: <StudentDashboardPage /> },
              { path: '/student/courses', element: <MyCoursesPage /> },
              { path: '/student/quizzes/:quizId/results/:attemptId', element: <QuizResultsPage /> },
              { path: '/student/ai-tutor', element: <AiTutorPage /> },
              { path: '/student/ai-tutor/:conversationId', element: <AiTutorPage /> },
              { path: '/student/pay/:chapterId', element: <PaymentPage /> },
              { path: '/student/profile', element: <StudentProfilePage /> },
              { path: '/student/quizzes', element: <StudentQuizListPage /> },
            ],
          },
          // Lesson page — no sidebar, has a minimal topbar-only layout
          {
            element: <LessonLayout />,
            children: [
              { path: '/student/lessons/:lessonId', element: <LessonPage /> },
            ],
          },
          // Quiz taking page — no sidebar, no bottom tab bar (distraction-free)
          {
            element: <Outlet />,
            children: [
              { path: '/student/quizzes/:quizId', element: <QuizPage /> },
            ],
          },
        ],
      },
      // Teacher
      {
        element: <RoleGuard allowedRoles={['teacher']} />,
        children: [
          {
            element: <TeacherLayout />,
            children: [
              { path: '/teacher/dashboard', element: <TeacherDashboardPage /> },
              { path: '/teacher/content', element: <AllStagesPage /> },
              { path: '/teacher/quizzes', element: <QuizListPage /> },
              { path: '/teacher/quizzes/:quizId/results', element: <QuizResultsOverviewPage /> },
              { path: '/teacher/quizzes/:quizId/results/:studentId', element: <StudentQuestionBreakdownPage /> },
              { path: '/teacher/essay-grading', element: <EssayGradingHubPage /> },
              { path: '/teacher/essay-grading/:quizId', element: <EssaySubmissionsPage /> },
              { path: '/teacher/essay-grading/:quizId/:attemptId', element: <EssayGradingDetailPage /> },
              { path: '/teacher/quizzes/generator', element: <AiQuizGeneratorPage /> },
              { path: '/teacher/quizzes/generator/review/:quizId', element: <AiQuizReviewPage /> },
              { path: '/teacher/quizzes/generator/publish/:quizId', element: <AiQuizPublishPage /> },
              { path: '/teacher/students', element: <StudentEngagementPage /> },
              { path: '/teacher/branding', element: <TeacherBrandingPage /> },
              { path: '/teacher/promo-codes', element: <AdminPromoCodesPage /> },
              { path: '/teacher/profile', element: <ProfilePage /> },
            ],
          },
          {
            element: <TeacherStageLayout />,
            children: [
              { path: '/teacher/content/new', element: <CreateStagePage /> },
              { path: '/teacher/content/:stageId', element: <StageDetailPage /> },
            ],
          },
        ],
      },
      // Support
      {
        element: <RoleGuard allowedRoles={['support_agent']} />,
        children: [
          {
            element: <SupportLayout />,
            children: [
              { path: '/support/students', element: <StudentLookupPage /> },
            ],
          },
        ],
      },
      // Admin
      {
        element: <RoleGuard allowedRoles={['super_admin']} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { path: '/admin/dashboard', element: <AdminDashboardPage /> },
              { path: '/admin/tenants', element: <TenantsPage /> },
              { path: '/admin/tenants/:tenantId', element: <TenantDetailsPage /> },
              { path: '/admin/promo-codes', element: <AdminPromoCodesPage /> },
            ],
          },
        ],
      },
    ],
  },
  // 404
  {
    path: '*',
    element: <PublicLayout />,
    children: [{ path: '*', element: <NotFoundPage /> }],
  },
]);

export { router };
