import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import {
  teacherRequestTrackApi,
  type TrackRequestResult,
} from '@/features/teacher-request/api/teacherRequestTrack';

/**
 * Public page where a teacher checks their registration request status using the
 * tracking reference plus their email or mobile. The backend returns only safe
 * status fields; a mismatch or unknown reference returns the same not-found error
 * (no status enumeration by reference alone).
 */
export function TeacherRequestTrackPage() {
  const { t } = useTranslation('teacherRequest');
  const [reference, setReference] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackRequestResult | null>(null);

  const isEmail = contact.includes('@');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await teacherRequestTrackApi.track({
        reference: reference.trim(),
        ...(isEmail ? { email: contact.trim() } : { mobile: contact.trim() }),
      });
      setResult(res);
    } catch (err: unknown) {
      const e2 = err as { message?: string };
      setError(e2.message ?? t('track.notFound', 'لم يتم العثور على طلب مطابق'));
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<
    TrackRequestResult['status'],
    { icon: typeof Clock; className: string; label: string }
  > = {
    PENDING: {
      icon: Clock,
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      label: t('track.statusPending', 'قيد المراجعة'),
    },
    APPROVED: {
      icon: CheckCircle2,
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: t('track.statusApproved', 'تم القبول'),
    },
    REJECTED: {
      icon: XCircle,
      className: 'bg-red-50 text-red-700 border-red-200',
      label: t('track.statusRejected', 'تم الرفض'),
    },
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10" dir="rtl">
      <div className="text-center">
        <h1 className="font-cairo text-2xl font-bold text-navy-900">
          {t('track.title', 'متابعة حالة الطلب')}
        </h1>
        <p className="mt-2 font-cairo text-small text-gray-600">
          {t('track.subtitle', 'أدخل رقم المتابعة وبريدك الإلكتروني أو رقم هاتفك')}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="track-form">
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t('track.referencePlaceholder', 'رقم المتابعة (مثال: TR-2026-123456)')}
          data-testid="track-reference"
          className="rounded-lg border border-gray-300 px-4 py-2.5 font-cairo text-body focus:border-cyan-500 focus:outline-none"
          required
        />
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={t('track.contactPlaceholder', 'البريد الإلكتروني أو رقم الهاتف')}
          data-testid="track-contact"
          className="rounded-lg border border-gray-300 px-4 py-2.5 font-cairo text-body focus:border-cyan-500 focus:outline-none"
          required
        />
        <button
          type="submit"
          disabled={loading || !reference.trim() || !contact.trim()}
          data-testid="track-submit"
          className="flex items-center justify-center gap-2 rounded-btn bg-cyan-gradient px-6 py-2.5 font-cairo text-small font-bold text-white shadow-glow transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Search size={16} />
          {loading ? t('track.searching', 'جاري البحث...') : t('track.submit', 'بحث')}
        </button>
      </form>

      {error && (
        <div
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-small text-red-700"
          data-testid="track-error"
        >
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {result && (
        <div
          className={`flex flex-col items-center gap-3 rounded-lg border px-4 py-5 text-center ${statusConfig[result.status].className}`}
          data-testid="track-result"
        >
          {(() => {
            const Icon = statusConfig[result.status].icon;
            return <Icon size={32} />;
          })()}
          <span className="font-cairo text-lg font-bold" data-testid="track-status">
            {statusConfig[result.status].label}
          </span>
          <span className="font-cairo text-xs text-gray-500">
            {t('track.reference', 'رقم المتابعة')}: {result.reference}
          </span>
        </div>
      )}

      <Link to="/auth" className="text-center font-cairo text-small font-semibold text-cyan-600 hover:underline">
        {t('track.backToLogin', 'العودة لتسجيل الدخول')}
      </Link>
    </div>
  );
}
