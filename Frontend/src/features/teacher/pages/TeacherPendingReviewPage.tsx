import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, Copy, Check, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
 * Shown to a teacher whose registration is awaiting admin review. Fetches
 * review status from the backend to display the tracking reference and
 * current state. Accessible only for authenticated pending teachers.
 */
export function TeacherPendingReviewPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['teacher', 'review-status'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ReviewStatusData }>('/api/teachers/review-status');
      return res.data.data;
    },
    staleTime: 30_000,
  });

  const handleCopyRef = async () => {
    if (data?.request?.publicReference) {
      await navigator.clipboard.writeText(data.request.publicReference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Clock size={32} className="text-amber-600" />
      </div>
      <h1 className="font-cairo text-2xl font-bold text-navy-900">
        {t('auth:teacherPendingTitle', 'طلبك قيد المراجعة')}
      </h1>
      <p className="font-cairo text-body text-gray-600">
        {data?.message ?? t('auth:teacherPendingMessage', 'تم إرسال طلبك للمراجعة من الإدارة')}
      </p>

      {data?.request?.publicReference && (
        <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-cairo text-small text-gray-500">
            {t('auth:trackingReference', 'رقم التتبع')}
          </p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="font-mono text-lg font-bold text-navy-900" dir="ltr">
              {data.request.publicReference}
            </span>
            <button
              type="button"
              onClick={handleCopyRef}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-amber-100 hover:text-amber-600"
              title={t('auth:copyReference', 'نسخ')}
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      )}

      <p className="font-cairo text-small text-gray-500">
        {t('auth:teacherPendingHint', 'سيتم إعلامك عند اعتماد الحساب لتتمكن من إكمال الاشتراك وتفعيل حسابك.')}
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
