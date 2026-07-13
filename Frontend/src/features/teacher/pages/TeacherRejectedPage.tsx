import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XCircle, LogOut, Copy, Check, Edit3, Save, User, Mail, Phone, BookOpen, FileText, AlertTriangle, Briefcase } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/shared/lib/api/client';
import { useAppDispatch } from '@/shared/store/hooks';
import { logoutUser } from '@/features/auth/store/authSlice';
import { Spinner } from '@/shared/components/ui';
import { SUBJECT_CATALOG } from '@/features/subjects/types';

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
    fullName: string | null;
    email: string | null;
    mobile: string | null;
    subject: string | null;
    bio: string | null;
  } | null;
  message: string;
}

export function TeacherRejectedPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBio, setEditBio] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['teacher', 'review-status'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ReviewStatusData }>('/teachers/review-status');
      return res.data.data;
    },
    staleTime: 30_000,
  });

  const resubmitMutation = useMutation({
    mutationFn: async (body: { fullName?: string; email?: string; mobile?: string; subject?: string; bio?: string }) => {
      const res = await apiClient.post('/teachers/registration-request/resubmit', body);
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

  const handleStartEdit = () => {
    const req = data?.request;
    setEditFullName(req?.fullName ?? '');
    setEditEmail(req?.email ?? '');
    setEditMobile(req?.mobile ?? '');
    setEditSubject(req?.subject ?? '');
    setEditBio(req?.bio ?? '');
    setEditing(true);
  };

  const handleSubmitEdit = () => {
    const body: { fullName?: string; email?: string; mobile?: string; subject?: string; bio?: string } = {};
    if (editFullName.trim()) body.fullName = editFullName.trim();
    if (editEmail.trim()) body.email = editEmail.trim();
    if (editMobile.trim()) body.mobile = editMobile.trim();
    if (editSubject.trim()) body.subject = editSubject.trim();
    if (editBio.trim()) body.bio = editBio.trim();
    resubmitMutation.mutate(body);
  };

if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <Spinner size="lg" />
      </div>
    );
  }

  const req = data?.request;
  const isFinal = req?.rejectionMode === 'FINAL_REJECTION';
  const canEdit = req?.canEditAndResubmit === true;

  const inputClass = "w-full rounded-input border border-gray-300 bg-white p-3 font-cairo text-sm outline-none transition-colors hover:border-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 placeholder:text-gray-400";
  const labelClass = "mb-1.5 block font-cairo text-sm font-bold text-gray-700";

return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-modal md:p-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <XCircle size={32} className="text-red-600" />
      </div>
      <h1 className="font-cairo text-2xl font-bold text-navy-900">
        {t('auth:teacherRejectedTitle', 'تم رفض طلبك')}
      </h1>
      <p className="font-cairo text-body text-gray-600">
        {t('auth:teacherRejectedMessage', 'نأسف، لم يتم قبول طلب انضمامك كمدرس.')}
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
        <div className="w-full rounded-lg border border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0 text-red-600" />
            <p className="font-cairo text-small font-bold text-red-700">
              {t('auth:rejectionReason', 'سبب الرفض')}
            </p>
          </div>
          <p className="mt-2 font-cairo text-sm text-red-600">
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
      ) : canEdit && !editing ? (
        <div className="w-full space-y-3">
          <p className="font-cairo text-sm text-gray-600">
            {t('auth:editAllowedMessage', 'يمكنك تعديل بيانات الطلب وإعادة إرساله للمراجعة.')}
          </p>
          <button
            type="button"
            onClick={handleStartEdit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-btn bg-amber-500 px-6 py-3 font-cairo text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600"
          >
            <Edit3 size={16} />
            {t('auth:editAndResubmit', 'تعديل الطلب وإعادة الإرسال')}
          </button>
        </div>
      ) : canEdit && editing ? (
        <div className="w-full space-y-6 text-end">
          <h2 className="font-cairo text-lg font-bold text-navy-900">
            {t('auth:editRequestTitle', 'تعديل بيانات الطلب')}
          </h2>

          {/* Personal Information */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="flex items-center gap-2 font-cairo text-sm font-bold text-navy-900">
              <User size={16} className="text-cyan-600" />
              {t('auth:personalInfo', 'البيانات الشخصية')}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>
                  {t('auth:fullName', 'الاسم الكامل')}
                </label>
                <div className="relative">
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className={`${inputClass} pe-11`}
                    placeholder={t('auth:fullNamePlaceholder', 'الاسم الكامل')}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  {t('auth:email', 'البريد الإلكتروني')}
                </label>
                <div className="relative">
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className={`${inputClass} pe-11`}
                    placeholder={t('auth:emailPlaceholder', 'البريد الإلكتروني')}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  {t('auth:mobile', 'رقم الجوال')}
                </label>
                <div className="relative">
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Phone size={18} />
                  </span>
                  <input
                    type="text"
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    className={`${inputClass} pe-11`}
                    placeholder={t('auth:mobilePlaceholder', 'رقم الجوال')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="flex items-center gap-2 font-cairo text-sm font-bold text-navy-900">
              <Briefcase size={16} className="text-cyan-600" />
              {t('auth:professionalInfo', 'البيانات المهنية')}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>
                  {t('auth:subject', 'التخصص')}
                </label>
                <div className="relative">
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                    <BookOpen size={18} />
                  </span>
                  <select
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className={`${inputClass} pe-11 appearance-none`}
                  >
                    <option value="">{t('auth:selectSubject', 'اختر التخصص')}</option>
                    {SUBJECT_CATALOG.map((s) => (
                      <option key={s.code} value={s.displayName}>
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  {t('auth:bio', 'نبذة (اختياري)')}
                </label>
                <div className="relative">
                  <span className="absolute end-3 top-3 text-gray-400 pointer-events-none z-10">
                    <FileText size={18} />
                  </span>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    className={`${inputClass} pe-11 resize-none`}
                    placeholder={t('auth:bioPlaceholder', 'نبذة عنك')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={resubmitMutation.isPending}
              className="inline-flex rounded-btn border border-gray-300 bg-white px-6 py-3 font-cairo text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {t('actions.cancel', 'إلغاء')}
            </button>
            <button
              type="button"
              onClick={handleSubmitEdit}
              disabled={resubmitMutation.isPending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-btn bg-amber-500 px-6 py-3 font-cairo text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              <Save size={16} />
              {resubmitMutation.isPending
                ? t('auth:resubmitting', 'جارٍ إعادة الإرسال...')
                : t('auth:sendEdits', 'إرسال التعديلات')}
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-btn border border-gray-200 bg-white px-6 py-2 font-cairo text-small font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
      >
        <LogOut size={16} />
        {t('actions.logout', 'تسجيل الخروج')}
      </button>

          <Link to="/" className="font-cairo text-small text-cyan-600 hover:underline">
            {t('nav.home', 'الصفحة الرئيسية')}
          </Link>
        </div>
      </div>
    </div>
  );
}
