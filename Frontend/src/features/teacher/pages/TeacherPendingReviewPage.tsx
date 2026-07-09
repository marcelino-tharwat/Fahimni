import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';

/**
 * Shown to a teacher whose registration is awaiting admin review. This phase
 * establishes the placeholder; the payment gate / approved-unpaid redirect is a
 * later phase. Public route — a pending teacher has no session (login is blocked
 * while INACTIVE).
 */
export function TeacherPendingReviewPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center" dir="rtl">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Clock size={32} className="text-amber-600" />
      </div>
      <h1 className="font-cairo text-2xl font-bold text-navy-900">
        {t('auth:teacherPendingTitle', 'طلبك قيد المراجعة')}
      </h1>
      <p className="font-cairo text-body text-gray-600">
        {t('auth:teacherPendingMessage', 'تم إرسال طلبك للمراجعة من الإدارة')}
      </p>
      <p className="font-cairo text-small text-gray-500">
        {t('auth:teacherPendingHint', 'سيتم إعلامك عند اعتماد الحساب لتتمكن من إكمال الاشتراك وتفعيل حسابك.')}
      </p>
      <Link to="/auth" className="rounded-btn bg-cyan-gradient px-6 py-2 font-cairo text-small font-bold text-white shadow-glow transition-opacity hover:opacity-90">
        {t('auth:backToLogin', 'العودة لتسجيل الدخول')}
      </Link>
    </div>
  );
}
