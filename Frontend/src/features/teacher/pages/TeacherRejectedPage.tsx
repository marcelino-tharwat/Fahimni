import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XCircle } from 'lucide-react';

/**
 * Shown to a teacher whose registration request was rejected by the admin. Public
 * route — a rejected teacher is INACTIVE and cannot log in, so this is reached via
 * the guard or a direct link; internal admin notes are intentionally not exposed.
 */
export function TeacherRejectedPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center" dir="rtl">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <XCircle size={32} className="text-red-600" />
      </div>
      <h1 className="font-cairo text-2xl font-bold text-navy-900">
        {t('auth:teacherRejectedTitle', 'تم رفض طلبك')}
      </h1>
      <p className="font-cairo text-body text-gray-600">
        {t('auth:teacherRejectedMessage', 'نأسف، لم يتم قبول طلب انضمامك كمدرس.')}
      </p>
      <p className="font-cairo text-small text-gray-500">
        {t('auth:teacherRejectedHint', 'للاستفسار يمكنك التواصل مع الدعم.')}
      </p>
      <Link to="/auth" className="rounded-btn bg-cyan-gradient px-6 py-2 font-cairo text-small font-bold text-white shadow-glow transition-opacity hover:opacity-90">
        {t('auth:backToLogin', 'العودة لتسجيل الدخول')}
      </Link>
    </div>
  );
}
