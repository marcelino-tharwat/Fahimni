import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Loader2 } from 'lucide-react';
import { authApi } from '@/features/auth/api/auth';
import { translateApiError } from '@/shared/lib/api/translateError';
import type { ApiError } from '@/shared/lib/api/client';

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailPendingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || inFlightRef.current || cooldown > 0) return;
    inFlightRef.current = true;
    setLoading(true);
    setMessage(null);
    try {
      await authApi.resendVerification(email);
      setMessage({ type: 'success', text: t('auth:resendVerificationSuccess', 'Verification email sent') });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setMessage({ type: 'error', text: translateApiError(t, err) });
      // A 429 here means an email was already sent very recently (e.g. the one
      // registration itself just triggered) — start the same cooldown so the
      // button doesn't invite repeated 429s within that window.
      if ((err as ApiError)?.code === 'RATE_LIMITED') {
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-modal md:p-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-100">
            <Mail size={32} className="text-cyan-600" />
          </div>
          <h1 className="font-cairo text-2xl font-bold text-navy-900">
            {t('auth:verifyEmailPendingTitle', 'Verify your email')}
          </h1>
          <p className="font-cairo text-body text-gray-600">
            {email
              ? t('auth:verifyEmailPendingMessage', 'We sent a verification link to {{email}}. Click it to activate your account.', { email })
              : t('auth:verifyEmailPendingMessageGeneric', 'We sent a verification link to your email. Click it to activate your account.')}
          </p>
          <p className="font-cairo text-small text-gray-500">
            {t('auth:verifyEmailPendingHint', "Didn't get it? Check your spam folder, or request a new link below.")}
          </p>

          {message && (
            <p
              className={`w-full rounded-md px-3 py-2 font-cairo text-small ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={!email || loading || cooldown > 0}
            className="flex w-full items-center justify-center gap-2 rounded-btn bg-cyan-gradient py-3 font-cairo text-body font-bold text-white transition hover:shadow-glow disabled:opacity-60"
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            {cooldown > 0
              ? t('auth:resendVerificationCooldown', 'You can request another email in {{seconds}}s', { seconds: cooldown })
              : t('auth:resendVerificationCta', 'Resend verification email')}
          </button>

          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="font-cairo text-small font-semibold text-cyan-600 hover:underline"
          >
            {t('auth:backToLogin', 'Back to login')}
          </button>

          <Link to="/" className="font-cairo text-small text-cyan-600 hover:underline">
            {t('nav.home', 'الصفحة الرئيسية')}
          </Link>
        </div>
      </div>
    </div>
  );
}
