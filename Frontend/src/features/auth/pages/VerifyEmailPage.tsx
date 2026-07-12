import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '@/features/auth/api/auth';
import { translateApiError } from '@/shared/lib/api/translateError';

type VerifyState = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!token) {
      setState('error');
      setErrorMessage(t('validation:verificationTokenExpired'));
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => setState('success'))
      .catch((err) => {
        setState('error');
        setErrorMessage(translateApiError(t, err));
      });
  }, [token, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-modal md:p-8">
        <div className="flex flex-col items-center gap-5 text-center">
          {state === 'loading' && (
            <>
              <Loader2 size={40} className="animate-spin text-cyan-600" />
              <p className="font-cairo text-body text-gray-600">
                {t('auth:verifyEmailInProgress', 'Verifying your email...')}
              </p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h1 className="font-cairo text-2xl font-bold text-navy-900">
                {t('auth:verifyEmailSuccessTitle', 'Email verified')}
              </h1>
              <p className="font-cairo text-body text-gray-600">
                {t('auth:verifyEmailSuccessMessage', 'Your email has been verified. You can now log in.')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="flex w-full items-center justify-center gap-2 rounded-btn bg-cyan-gradient py-3 font-cairo text-body font-bold text-white transition hover:shadow-glow"
              >
                {t('auth:goToLogin', 'Go to login')}
              </button>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <XCircle size={32} className="text-red-600" />
              </div>
              <h1 className="font-cairo text-2xl font-bold text-navy-900">
                {t('auth:verifyEmailErrorTitle', 'Verification failed')}
              </h1>
              <p className="font-cairo text-body text-gray-600">{errorMessage}</p>
              <button
                type="button"
                onClick={() => navigate('/verify-email-pending')}
                className="flex w-full items-center justify-center gap-2 rounded-btn bg-cyan-gradient py-3 font-cairo text-body font-bold text-white transition hover:shadow-glow"
              >
                {t('auth:resendVerificationCta', 'Resend verification email')}
              </button>
            </>
          )}

          <Link to="/" className="font-cairo text-small text-cyan-600 hover:underline">
            {t('nav.home', 'الصفحة الرئيسية')}
          </Link>
        </div>
      </div>
    </div>
  );
}
