import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Mail } from 'lucide-react';
import { Button, Card, Input } from '@/shared/components/ui';
import { authApi } from '@/features/auth/api/auth';

function makeForgotSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().min(1, t('auth:validation.required')).email(t('auth:validation.email')),
  });
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    resolver: zodResolver(makeForgotSchema(t)),
    defaultValues: { email: '' },
  });

  const onSubmit = async (v: { email: string }) => {
    setApiError(null);
    try {
      await authApi.forgotPassword(v.email);
      setSubmitted(true);
    } catch (e) {
      setApiError((e as { message?: string }).message ?? t('auth:validation.required'));
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <Card padding="lg" className="flex flex-col gap-4">
          <h1 className="font-cairo text-2xl font-bold text-text-primary">
            {t('auth:forgotPasswordTitle')}
          </h1>
          <p className="font-cairo text-sm text-text-secondary">
            {t('auth:sendResetLink')}
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1 font-cairo text-sm text-accent hover:underline"
          >
            <ArrowRight size={16} className="rtl:rotate-180" />
            {t('actions.back')}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <Card padding="lg" className="flex flex-col gap-4">
        <h1 className="font-cairo text-2xl font-bold text-text-primary">
          {t('auth:forgotPasswordTitle')}
        </h1>
        <p className="font-cairo text-sm text-text-secondary">{t('auth:forgotPasswordDesc')}</p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Input
            icon={<Mail size={18} />}
            type="email"
            label={t('auth:email')}
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          {apiError && <p className="text-center text-sm text-danger">{apiError}</p>}

          <Button type="submit" loading={isSubmitting} size="lg">
            {t('auth:sendResetLink')}
          </Button>
        </form>

        <Link
          to="/auth"
          className="inline-flex items-center gap-1 font-cairo text-sm text-accent hover:underline"
        >
          <ArrowRight size={16} className="rtl:rotate-180" />
          {t('actions.back')}
        </Link>
      </Card>
    </div>
  );
}
