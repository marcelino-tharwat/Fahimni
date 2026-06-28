import { createBrowserRouter, Outlet } from 'react-router-dom';

// Layouts
import { PublicLayout } from '@/shared/components/layout/PublicLayout';
import { StudentLayout } from '@/shared/components/layout/StudentLayout';
import { TeacherLayout } from '@/shared/components/layout/TeacherLayout';
import { SupportLayout } from '@/shared/components/layout/SupportLayout';
import { TeacherStageLayout } from '@/shared/components/layout/TeacherStageLayout';
import { AdminLayout } from '@/shared/components/layout/AdminLayout';

// Guards
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
import { AllContentPage } from '@/features/student/pages/AllContentPage';
import { LessonPage } from '@/features/student/pages/LessonPage';
import { QuizPage } from '@/features/student/pages/QuizPage';
import { StudentQuizListPage } from '@/features/student/pages/StudentQuizListPage';
import { QuizResultsPage } from '@/features/student/pages/QuizResultsPage';
import { AiTutorPage } from '@/features/student/pages/AiTutorPage';
import { PaymentPage } from '@/features/student/pages/PaymentPage';
import { StudentProfilePage } from '@/features/student/pages/StudentProfilePage';

// Teacher pages
import { TeacherDashboardPage } from '@/features/teacher/pages/TeacherDashboardPage';
import { AiQuizGeneratorPage } from '@/features/teacher/pages/AiQuizGeneratorPage';
import { AiQuizReviewPage } from '@/features/teacher/pages/AiQuizReviewPage';
import { AiQuizPublishPage } from '@/features/teacher/pages/AiQuizPublishPage';
import { StudentEngagementPage } from '@/features/teacher/pages/StudentEngagementPage';
import { TeacherBrandingPage } from '@/features/teacher/pages/TeacherBrandingPage';
import { TeacherSettingsPage } from '@/features/teacher/pages/TeacherSettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AllStagesPage } from '@/features/teacher/pages/AllStagesPage';
import { StageDetailPage } from '@/features/teacher/pages/StageDetailPage';
import { CreateStagePage } from '@/features/teacher/pages/CreateStagePage';

// Support pages
import { PromoCodesPage } from '@/features/support/pages/PromoCodesPage';
import { StudentLookupPage } from '@/features/support/pages/StudentLookupPage';

// Admin pages
import { TenantsPage } from '@/features/admin/pages/TenantsPage';
import { TenantDetailsPage } from '@/features/admin/pages/TenantDetailsPage';

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
              { path: '/student/content', element: <AllContentPage /> },
              { path: '/student/lessons/:lessonId', element: <LessonPage /> },
              { path: '/student/quizzes/:quizId/results', element: <QuizResultsPage /> },
              { path: '/student/ai-tutor', element: <AiTutorPage /> },
              { path: '/student/pay/:chapterId', element: <PaymentPage /> },
              { path: '/student/profile', element: <StudentProfilePage /> },
              { path: '/student/quizzes', element: <StudentQuizListPage /> },
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
              { path: '/teacher/quizzes/generator', element: <AiQuizGeneratorPage /> },
              { path: '/teacher/quizzes/generator/review/:quizId', element: <AiQuizReviewPage /> },
              { path: '/teacher/quizzes/generator/publish/:quizId', element: <AiQuizPublishPage /> },
              { path: '/teacher/students', element: <StudentEngagementPage /> },
              { path: '/teacher/branding', element: <TeacherBrandingPage /> },
              { path: '/teacher/profile', element: <ProfilePage /> },
              { path: '/teacher/settings', element: <TeacherSettingsPage /> },
            ],
          },
          {
            element: <TeacherStageLayout />,
            children: [
              { path: '/teacher/content', element: <AllStagesPage /> },
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
              { path: '/support/promo-codes', element: <PromoCodesPage /> },
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
              { path: '/admin/tenants', element: <TenantsPage /> },
              { path: '/admin/tenants/:tenantId', element: <TenantDetailsPage /> },
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
