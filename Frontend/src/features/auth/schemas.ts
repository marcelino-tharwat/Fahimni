import { z } from 'zod';
import type { TFunction } from 'i18next';

export function makeLoginSchema(t: TFunction) {
  return z.object({
    email: z
      .string()
      .min(1, t('auth:validation.required'))
      .email(t('auth:validation.email')),
    password: z
      .string()
      .min(1, t('auth:validation.required'))
      .min(6, t('auth:validation.passwordMin'))
      .max(100, t('auth:validation.passwordMax')),
    remember: z.boolean().optional(),
  });
}

const mobileRegex = /^01[0-9]{9}$/;

export function makeRegisterSchema(t: TFunction) {
  return z.object({
    fullName: z
      .string()
      .min(1, t('auth:validation.required'))
      .min(2, t('auth:validation.fullNameMin')),
    email: z
      .string()
      .min(1, t('auth:validation.required'))
      .email(t('auth:validation.email')),
    mobile: z
      .string()
      .min(1, t('auth:validation.required'))
      .regex(mobileRegex, t('auth:validation.mobile')),
    password: z
      .string()
      .min(1, t('auth:validation.required'))
      .min(6, t('auth:validation.passwordMin'))
      .max(100, t('auth:validation.passwordMax')),
  });
}

export function makeOtpSchema(t: TFunction) {
  return z.object({
    otp: z.string().length(6, t('auth:forgotPasswordFlow.otpRequired')),
  });
}

export function makeNewPasswordSchema(t: TFunction) {
  return z.object({
    password: z
      .string()
      .min(1, t('auth:validation.required'))
      .min(8, t('auth:validation.passwordMin'))
      .max(100, t('auth:validation.passwordMax')),
    confirmPassword: z.string().min(1, t('auth:validation.required')),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('auth:forgotPasswordFlow.passwordsMustMatch'),
    path: ['confirmPassword'],
  });
}

export type LoginValues = z.infer<ReturnType<typeof makeLoginSchema>>;
export type RegisterValues = z.infer<ReturnType<typeof makeRegisterSchema>>;
export type OtpValues = z.infer<ReturnType<typeof makeOtpSchema>>;
export type NewPasswordValues = z.infer<ReturnType<typeof makeNewPasswordSchema>>;
