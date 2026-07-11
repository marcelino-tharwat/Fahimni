// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import i18n from '@/shared/lib/i18n';
import { translateApiError, translateFieldErrors, translateFieldError } from './translateError';

const originalLanguage = i18n.language;
afterAll(async () => {
  await i18n.changeLanguage(originalLanguage);
});

describe('translateApiError / translateFieldErrors — real i18n, both languages', () => {
  describe('when the UI language is Arabic', () => {
    beforeEach(async () => {
      await i18n.changeLanguage('ar');
    });

    it('1. a REQUIRED field error renders in Arabic', () => {
      const message = translateFieldError(i18n.t, { field: 'fullName', code: 'REQUIRED', message: 'Full name is required' });
      expect(message).toBe('هذا الحقل مطلوب');
    });

    it('translates a known business error code (DUPLICATE_EMAIL) into Arabic', () => {
      const message = translateApiError(i18n.t, { statusCode: 409, code: 'DUPLICATE_EMAIL', message: 'Email already registered' });
      expect(message).toBe('البريد الإلكتروني مسجل بالفعل');
    });

    it('6. an unknown backend error code falls back to the safe Arabic generic message', () => {
      const message = translateApiError(i18n.t, { statusCode: 400, code: 'SOME_UNKNOWN_CODE', message: 'some raw backend text' });
      expect(message).toBe('حدث خطأ، برجاء المحاولة مرة أخرى');
    });

    it('7. no raw English "Required" (or any Latin-script backend message) ever leaks into the Arabic UI', () => {
      const required = translateFieldError(i18n.t, { field: 'email', code: 'REQUIRED', message: 'Required' });
      const unknown = translateApiError(i18n.t, { statusCode: 400, code: 'UNRECOGNIZED', message: 'Something went wrong in English' });
      expect(required).not.toMatch(/[a-zA-Z]/);
      expect(unknown).not.toMatch(/[a-zA-Z]/);
      expect(required).not.toBe('Required');
      expect(unknown).not.toContain('Something went wrong');
    });
  });

  describe('when the UI language is English', () => {
    beforeEach(async () => {
      await i18n.changeLanguage('en');
    });

    it('2. a REQUIRED field error renders in English', () => {
      const message = translateFieldError(i18n.t, { field: 'fullName', code: 'REQUIRED', message: 'الاسم مطلوب' });
      expect(message).toBe('This field is required');
    });

    it('5. translates a known validation code (EMAIL_INVALID) into English, ignoring the raw backend message', () => {
      const message = translateApiError(i18n.t, { statusCode: 400, code: 'EMAIL_INVALID', message: 'البريد الإلكتروني غير صالح' });
      expect(message).toBe('Invalid email address');
    });

    it('6. an unknown backend error code falls back to the safe English generic message', () => {
      const message = translateApiError(i18n.t, { statusCode: 500, code: 'UNMAPPED_CODE', message: 'حدث خطأ غير متوقع' });
      expect(message).toBe('Something went wrong. Please try again.');
    });

    it('8. no raw Arabic validation text ever leaks into the English UI', () => {
      const required = translateFieldError(i18n.t, { field: 'email', code: 'REQUIRED', message: 'هذا الحقل مطلوب' });
      const unknown = translateApiError(i18n.t, { statusCode: 400, code: 'UNRECOGNIZED', message: 'رمز غير معروف من الخادم' });
      const arabicRange = /[؀-ۿ]/;
      expect(required).not.toMatch(arabicRange);
      expect(unknown).not.toMatch(arabicRange);
    });
  });

  describe('translateFieldErrors — maps a full errors[] array by field', () => {
    it('produces one translated message per field, in the current language', async () => {
      await i18n.changeLanguage('ar');
      const result = translateFieldErrors(i18n.t, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation error',
        errors: [
          { field: 'email', code: 'EMAIL_INVALID', message: 'Invalid email address' },
          { field: 'mobile', code: 'MOBILE_INVALID', message: 'Invalid mobile number' },
        ],
      });
      expect(result).toEqual({
        email: 'البريد الإلكتروني غير صالح',
        mobile: 'رقم الهاتف غير صالح',
      });
    });

    it('returns an empty object when there are no field errors', () => {
      const result = translateFieldErrors(i18n.t, { statusCode: 500, message: 'boom' });
      expect(result).toEqual({});
    });
  });
});
