import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, AlertTriangle, FileText, FileImage, File, CheckCircle, XCircle, ExternalLink, Info, File as FileIcon,
} from 'lucide-react';
import type { DocumentPreviewType } from '@/features/admin/types/teacherRequests';
import { Card, Badge, Spinner, Modal, EmptyState } from '@/shared/components/ui';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import { translateApiError } from '@/shared/lib/api/translateError';
import {
  useAdminTeacherRequestDetail, useApproveTeacherRequest, useRejectTeacherRequest,
} from '@/features/admin/hooks/useAdminTeacherRequests';
import { adminTeacherRequestsApi } from '@/features/admin/api/adminTeacherRequests';
import { statusVariant } from './AdminTeacherRequestsPage';
import type { AccountProvisioning } from '@/features/admin/types/teacherRequests';

import { cn } from '@/shared/lib/utils/cn';

type RejectionMode = 'EDIT_ALLOWED' | 'FINAL_REJECTION';

const provisioningTone: Record<AccountProvisioning, 'success' | 'warning' | 'danger'> = {
  CREATED_PENDING_PASSWORD_RESET: 'success',
  EXISTING_USER_LINKED: 'success',
  SKIPPED: 'warning',
  CONFLICT: 'danger',
};

function ProfileField({
  label,
  value,
  placeholder,
  className,
}: {
  label: string;
  value: string | null | undefined;
  placeholder?: string;
  className?: string;
}) {
  const hasValue = value && value.trim().length > 0;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="font-cairo text-xs font-medium text-text-secondary">{label}</span>
      <span className={cn('font-cairo text-sm', hasValue ? 'text-text-primary' : 'text-text-muted italic')}>
        {hasValue ? value : (placeholder ?? '—')}
      </span>
    </div>
  );
}

const docIcon: Record<DocumentPreviewType, typeof FileText> = {
  PDF: FileText,
  IMAGE: FileImage,
  OTHER: File,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminTeacherRequestDetailPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { requestId = '' } = useParams<{ requestId: string }>();
  const { data, isLoading, isError, refetch } = useAdminTeacherRequestDetail(requestId);

  const approve = useApproveTeacherRequest(requestId);
  const reject = useRejectTeacherRequest(requestId);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectionMode, setRejectionMode] = useState<RejectionMode>('EDIT_ALLOWED');
  const [provisioning, setProvisioning] = useState<AccountProvisioning | null>(null);
  const [docState, setDocState] = useState<Record<number, 'loading' | 'unavailable'>>({});

  const rejectTextareaRef = useRef<HTMLTextAreaElement>(null);

  const backLink = (
    <Link
      to="/admin/teacher-requests"
      className="inline-flex items-center gap-1.5 font-cairo text-sm font-medium text-accent hover:underline transition-transform hover:-translate-x-0.5"
    >
      <ChevronLeft size={16} className="transition-transform hover:-translate-x-0.5" />
      {t('adminTeacherRequests.detail.back', 'عودة إلى الطلبات')}
    </Link>
  );

  const openDocument = async (index: number) => {
    setDocState((s) => ({ ...s, [index]: 'loading' }));
    try {
      const { url } = await adminTeacherRequestsApi.getDocumentSignedUrl(requestId, index);
      window.open(url, '_blank', 'noopener,noreferrer');
      setDocState((s) => { const next = { ...s }; delete next[index]; return next; });
    } catch {
      setDocState((s) => ({ ...s, [index]: 'unavailable' }));
    }
  };

  const handleApprove = () => {
    approve.mutate(
      { createAccount, ...(approveNotes.trim() ? { adminNotes: approveNotes.trim() } : {}) },
      {
        onSuccess: (res) => {
          setApproveOpen(false);
          setProvisioning(res.accountProvisioning);
          dispatch(addToast({ type: 'success', message: t('adminTeacherRequests.detail.approvedToast', 'تم قبول الطلب') }));
          refetch();
        },
        onError: (e: ApiError) => {
          dispatch(addToast({ type: 'error', message: translateApiError(t, e) }));
        },
      },
    );
  };

  const handleReject = () => {
    if (!rejectNotes.trim() || !rejectionMode) return;
    reject.mutate(
      { adminNotes: rejectNotes.trim(), rejectionMode },
      {
        onSuccess: () => {
          setRejectOpen(false);
          dispatch(addToast({ type: 'success', message: t('adminTeacherRequests.detail.rejectedToast', 'تم رفض الطلب') }));
          refetch();
        },
        onError: (e: ApiError) => {
          dispatch(addToast({ type: 'error', message: translateApiError(t, e) }));
        },
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6 pb-8 px-4">
      <div className="flex items-center pt-2">{backLink}</div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label={t('common:status.loading', 'جاري التحميل...')}>
          <Spinner />
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertTriangle size={48} className="text-danger" />
          <p className="font-cairo text-text-secondary">{t('adminTeacherRequests.detail.error', 'تعذّر تحميل الطلب')}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary hover:bg-gray-100 transition-colors"
          >
            {t('adminTeacherRequests.retry', 'إعادة المحاولة')}
          </button>
        </div>
      ) : (
        <>
          {/* Header Card */}
          <Card className="flex flex-col gap-5 p-6 shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h1 className="font-cairo text-xl font-bold text-text-primary">{data.request.fullName}</h1>
                  <Badge variant={statusVariant[data.request.status]} className="text-sm px-3 py-1">
                    {t(`adminTeacherRequests.status.${data.request.status}`, data.request.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-100">
                    {data.request.publicReference}
                  </span>
                  <span className="font-cairo text-text-secondary">{data.request.email}</span>
                  <span className="text-text-muted">·</span>
                  <span className="font-cairo text-text-secondary">{data.request.mobile}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-gray-100">
              <ProfileField
                label={t('adminTeacherRequests.detail.specialization', 'التخصص')}
                value={data.request.specialization}
                placeholder={t('adminTeacherRequests.detail.notProvided', 'غير مُقدَّم')}
              />
              <ProfileField
                label={t('adminTeacherRequests.detail.experience', 'الخبرة')}
                value={data.request.experience}
                placeholder={t('adminTeacherRequests.detail.notProvided', 'غير مُقدَّم')}
              />
              {data.request.bio && (
                <ProfileField
                  label={t('adminTeacherRequests.detail.bio', 'نبذة')}
                  value={data.request.bio}
                  placeholder={t('adminTeacherRequests.detail.notProvided', 'غير مُقدَّم')}
                  className="lg:col-span-3"
                />
              )}
            </div>
          </Card>

          {/* Provisioning result banner (after approval this session) */}
          {provisioning && (
            <Card className={`flex items-start gap-3 border-s-4 ${
              provisioning === 'CONFLICT' ? 'border-danger bg-danger/5' :
              provisioning === 'SKIPPED' ? 'border-warning bg-warning/5' :
              'border-success bg-success/5'
            }`}>
              <Info size={16} className="mt-0.5 shrink-0 text-text-secondary" />
              <div className="flex flex-col gap-0.5">
                <span className="font-cairo text-sm font-semibold text-text-primary">
                  {t('adminTeacherRequests.detail.approvedTitle', 'تم قبول الطلب')}
                </span>
                <Badge variant={provisioningTone[provisioning]}>
                  {t(`adminTeacherRequests.provisioning.${provisioning}`, provisioning)}
                </Badge>
              </div>
            </Card>
          )}

          {/* Documents Section */}
          <Card className="flex flex-col gap-4 p-6 shadow-sm border border-gray-100">
            <h2 className="font-cairo text-base font-bold text-text-primary">{t('adminTeacherRequests.detail.documents', 'المستندات')}</h2>
            {data.documents.length === 0 ? (
              <EmptyState
                icon={FileIcon}
                title={t('adminTeacherRequests.detail.noDocuments', 'لا توجد مستندات مرفقة')}
                description={t('adminTeacherRequests.detail.noDocumentsDesc', 'لم يرفق المتقدّم أي مستندات مع طلبه.')}
                className="py-8"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {data.documents.map((doc) => {
                  const st = docState[doc.index];
                  const unavailable = doc.status === 'UNAVAILABLE' || st === 'unavailable';
                  const DocIcon = docIcon[doc.previewType];
                  return (
                    <div
                      key={doc.index}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50"
                      data-testid={`document-${doc.index}`}
                    >
                      <div className="flex items-center gap-3">
                        <DocIcon size={16} className="text-text-muted" data-testid={`document-icon-${doc.previewType}`} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-cairo text-sm text-text-primary truncate">{doc.fileName}</span>
                          <span className="font-cairo text-xs text-text-muted">
                            {t(`adminTeacherRequests.detail.previewType.${doc.previewType}`, doc.previewType)}
                            {doc.size != null ? ` · ${formatBytes(doc.size)}` : ''}
                          </span>
                        </div>
                      </div>
                      {unavailable ? (
                        <span className="font-cairo text-xs text-text-muted">{t('adminTeacherRequests.detail.documentUnavailable', 'المستند غير متاح للعرض حاليًا')}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDocument(doc.index)}
                          disabled={st === 'loading'}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-cairo text-xs font-medium text-accent hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-all"
                        >
                          {st === 'loading' ? t('adminTeacherRequests.detail.opening', 'جارٍ الفتح...') : t('adminTeacherRequests.detail.openDocument', 'فتح المستند')}
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Admin notes (existing) */}
          {data.request.adminNotes && (
            <Card className="flex flex-col gap-1.5 p-5 shadow-sm border border-gray-100">
              <h2 className="font-cairo text-sm font-bold text-text-primary">{t('adminTeacherRequests.detail.adminNotes', 'ملاحظات المشرف')}</h2>
              <p className="font-cairo text-sm text-text-secondary">{data.request.adminNotes}</p>
            </Card>
          )}

          {/* Actions — only for PENDING */}
          {data.request.status === 'PENDING' && (
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRejectOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-danger px-6 py-2.5 font-cairo text-sm font-bold text-danger transition-all hover:bg-danger/5 hover:border-danger/80 focus:outline-none focus:ring-2 focus:ring-danger/20"
              >
                <XCircle size={16} />
                {t('adminTeacherRequests.detail.reject', 'رفض الطلب')}
              </button>
              <button
                type="button"
                onClick={() => setApproveOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-success px-6 py-2.5 font-cairo text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-success/30"
              >
                <CheckCircle size={16} />
                {t('adminTeacherRequests.detail.approve', 'قبول الطلب')}
              </button>
            </div>
          )}

          {/* Approve modal */}
          <Modal isOpen={approveOpen} onClose={() => setApproveOpen(false)} title={t('adminTeacherRequests.detail.approveTitle', 'قبول طلب المدرس')}>
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2 font-cairo text-sm text-text-primary">
                <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} className="h-4 w-4" />
                {t('adminTeacherRequests.detail.createAccount', 'إنشاء حساب مدرس عند القبول')}
              </label>
              <p className="font-cairo text-xs text-text-muted">
                {t('adminTeacherRequests.detail.createAccountNote', 'سيتم إنشاء حساب المدرس ويُفعّل الدخول عبر إعادة تعيين كلمة المرور — لا يتم عرض أي كلمة مرور.')}
              </p>
              <textarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder={t('adminTeacherRequests.detail.notesOptional', 'ملاحظات (اختياري)')}
                className="min-h-20 w-full rounded-btn border border-border bg-surface p-2 font-cairo text-sm outline-none focus:border-accent"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setApproveOpen(false)} className="rounded-btn border border-border bg-surface px-4 py-2 font-cairo text-sm font-medium text-text-primary hover:bg-gray-100">
                  {t('adminTeacherRequests.detail.cancel', 'إلغاء')}
                </button>
                <button type="button" onClick={handleApprove} disabled={approve.isPending} className="rounded-btn bg-success px-4 py-2 font-cairo text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
                  {approve.isPending ? t('adminTeacherRequests.detail.processing', 'جارٍ التنفيذ...') : t('adminTeacherRequests.detail.confirmApprove', 'تأكيد القبول')}
                </button>
              </div>
            </div>
          </Modal>

          {/* Reject modal */}
          <Modal isOpen={rejectOpen} onClose={() => setRejectOpen(false)} title={t('adminTeacherRequests.detail.rejectTitle', 'رفض طلب المدرس')} initialFocusRef={rejectTextareaRef}>
            <div className="flex flex-col gap-3">
              {/* Rejection mode selector */}
              <div className="flex flex-col gap-2">
                <label className="font-cairo text-sm font-semibold text-text-primary">
                  {t('adminTeacherRequests.detail.rejectionMode', 'نوع الرفض')}
                </label>
                <label className="flex items-center gap-2 rounded-btn border border-border bg-surface p-3 font-cairo text-sm text-text-primary hover:bg-gray-50 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                  <input
                    type="radio"
                    name="rejectionMode"
                    value="EDIT_ALLOWED"
                    checked={rejectionMode === 'EDIT_ALLOWED'}
                    onChange={() => setRejectionMode('EDIT_ALLOWED')}
                    className="h-4 w-4 text-accent"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{t('adminTeacherRequests.detail.editAllowed', 'السماح بالتعديل وإعادة الإرسال')}</span>
                    <span className="text-xs text-text-muted">{t('adminTeacherRequests.detail.editAllowedHint', 'يمكن للمدرس تعديل البيانات وإعادة الإرسال')}</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 rounded-btn border border-border bg-surface p-3 font-cairo text-sm text-text-primary hover:bg-gray-50 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                  <input
                    type="radio"
                    name="rejectionMode"
                    value="FINAL_REJECTION"
                    checked={rejectionMode === 'FINAL_REJECTION'}
                    onChange={() => setRejectionMode('FINAL_REJECTION')}
                    className="h-4 w-4 text-accent"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{t('adminTeacherRequests.detail.finalRejection', 'رفض نهائي')}</span>
                    <span className="text-xs text-text-muted">{t('adminTeacherRequests.detail.finalRejectionHint', 'لا يمكن للمدرس إعادة التقديم')}</span>
                  </div>
                </label>
              </div>

              <label className="font-cairo text-sm font-semibold text-text-primary">
                {t('adminTeacherRequests.detail.rejectNotesLabel', 'سبب الرفض (مطلوب)')}
              </label>
              <textarea
                ref={rejectTextareaRef}
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                aria-label={t('adminTeacherRequests.detail.rejectNotesLabel', 'سبب الرفض (مطلوب)')}
                className="min-h-24 w-full rounded-btn border border-border bg-surface p-2 font-cairo text-sm outline-none focus:border-accent"
              />
              {!rejectNotes.trim() && (
                <p className="font-cairo text-xs text-danger">{t('adminTeacherRequests.detail.rejectNotesRequired', 'يجب إدخال سبب الرفض')}</p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRejectOpen(false)} className="rounded-btn border border-border bg-surface px-4 py-2 font-cairo text-sm font-medium text-text-primary hover:bg-gray-100">
                  {t('adminTeacherRequests.detail.cancel', 'إلغاء')}
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={reject.isPending || !rejectNotes.trim()}
                  className="rounded-btn bg-danger px-4 py-2 font-cairo text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {reject.isPending ? t('adminTeacherRequests.detail.processing', 'جارٍ التنفيذ...') : t('adminTeacherRequests.detail.confirmReject', 'تأكيد الرفض')}
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}