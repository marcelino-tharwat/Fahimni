import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XCircle, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';
import { useAppDispatch } from '@/shared/store/hooks';
import { logoutUser } from '@/features/auth/store/authSlice';
import { Spinner } from '@/shared/components/ui';

interface ReviewStatusData {
  teacherApprovalState: string;
  accessState: string;
  canAccessTeacherFeatures: boolean;
  request: {
    publicReference: string | null;
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
  } | null;
  message: string;
}

/**
 * Shown to a teacher whose registration request was rejected by the admin.
 * Fetches review status from the backend. Accessible only for authenticated
 * rejected teachers. Internal admin notes are never exposed.
 */
export function TeacherRejectedPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['teacher', 'review-status'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ReviewStatusData }>('/api/teachers/review-status');
      return res.data.data;
    },
    staleTime: 30_000,
  });

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/auth');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" dir="rtl">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center" dir="rtl">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <XCircle size={32} className="text-red-600" />
      </div>
      <h1 className="font-cairo text-2xl font-bold text-navy-900">
        {t('auth:teacherRejectedTitle', 'تم رفض طلبك')}
      </h1>
      <p className="font-cairo text-body text-gray-600">
        {data?.message ?? t('auth:teacherRejectedMessage', 'نأسف، لم يتم قبول طلب انضمامك كمدرس.')}
      </p>

      {data?.request?.publicReference && (
        <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="font-cairo text-small text-gray-500">
            {t('auth:trackingReference', 'رقم التتبع')}
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-navy-900" dir="ltr">
            {data.request.publicReference}
          </p>
        </div>
      )}

      <p className="font-cairo text-small text-gray-500">
        {t('auth:teacherRejectedHint', 'للاستفسار يمكنك التواصل مع الدعم.')}
      </p>

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-2 font-cairo text-small font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
      >
        <LogOut size={16} />
        {t('auth:logout', 'تسجيل الخروج')}
      </button>

      <Link to="/" className="font-cairo text-small text-cyan-600 hover:underline">
        {t('nav.home', 'الصفحة الرئيسية')}
      </Link>
    </div>
  );
}
