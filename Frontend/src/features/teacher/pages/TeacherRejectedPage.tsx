import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XCircle, LogOut, Copy, Check, Edit3 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
    rejectionReason: string | null;
    rejectionMode: 'EDIT_ALLOWED' | 'FINAL_REJECTION' | null;
    canEditAndResubmit: boolean;
  } | null;
  message: string;
}

export function TeacherRejectedPage() {
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

  const resubmitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/teachers/registration-request/resubmit', {});
      return res.data;
    },
    onSuccess: () => {
      navigate('/teacher/pending-review');
    },
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

  const req = data?.request;
  const isFinal = req?.rejectionMode === 'FINAL_REJECTION';
  const canEdit = req?.canEditAndResubmit === true;

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

      {req?.publicReference && (
        <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="font-cairo text-small text-gray-500">
            {t('auth:trackingReference', 'رقم التتبع')}
          </p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="font-mono text-lg font-bold text-navy-900" dir="ltr">
              {req.publicReference}
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

      {req?.rejectionReason && (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 text-right">
          <p className="font-cairo text-small font-bold text-red-700">
            {t('auth:rejectionReason', 'سبب الرفض')}
          </p>
          <p className="mt-1 font-cairo text-sm text-red-600">
            {req.rejectionReason}
          </p>
        </div>
      )}

      {isFinal ? (
        <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="font-cairo text-sm font-bold text-gray-700">
            {t('auth:finalRejectionMessage', 'تم رفض الطلب رفضًا نهائيًا. يمكنك التواصل مع الإدارة.')}
          </p>
        </div>
      ) : canEdit ? (
        <div className="w-full space-y-3">
          <p className="font-cairo text-sm text-gray-600">
            {t('auth:editAllowedMessage', 'يمكنك تعديل بيانات الطلب وإعادة إرساله للمراجعة.')}
          </p>
          <button
            type="button"
            onClick={() => resubmitMutation.mutate()}
            disabled={resubmitMutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-cairo text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            <Edit3 size={16} />
            {resubmitMutation.isPending
              ? t('auth:resubmitting', 'جارٍ إعادة الإرسال...')
              : t('auth:editAndResubmit', 'تعديل الطلب وإعادة الإرسال')}
          </button>
        </div>
      ) : null}

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
