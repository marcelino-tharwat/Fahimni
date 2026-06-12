import { z } from 'zod';
import type { TFunction } from 'i18next';

export function createStudentProfileSchema(t: TFunction) {
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(3, t('profile.validation.nameMin'))
      .max(100, t('profile.validation.nameMax')),
    email: z
      .string()
      .trim()
      .email(t('profile.validation.emailInvalid'))
      .toLowerCase(),
  });
}

export function createChangePasswordSchema(t: TFunction) {
  return z
    .object({
      currentPassword: z
        .string()
        .min(1, t('profile.validation.passwordRequired')),
      newPassword: z
        .string()
        .min(6, t('profile.validation.passwordMin'))
        .max(128, t('profile.validation.passwordMax')),
      confirmPassword: z
        .string()
        .min(1, t('profile.validation.confirmPasswordRequired')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('profile.validation.passwordsDoNotMatch'),
      path: ['confirmPassword'],
    });
}

export function zodToFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}
