import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import commonAr from './ar/common.json';
import authAr from './ar/auth.json';
import studentAr from './ar/student.json';
import teacherAr from './ar/teacher.json';
import landingAr from './ar/landing.json';

import commonEn from './en/common.json';
import authEn from './en/auth.json';
import studentEn from './en/student.json';
import teacherEn from './en/teacher.json';
import landingEn from './en/landing.json';

export const defaultNS = 'common';

export const resources = {
  ar: {
    common: commonAr,
    auth: authAr,
    student: studentAr,
    teacher: teacherAr,
    landing: landingAr,
  },
  en: {
    common: commonEn,
    auth: authEn,
    student: studentEn,
    teacher: teacherEn,
    landing: landingEn,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS,
    ns: ['common', 'auth', 'student', 'teacher', 'landing'],
    supportedLngs: ['ar', 'en'],
    // index.html sets <html lang="ar">, so on first visit the htmlTag detector
    // yields Arabic — keeping 'ar' as the effective default language.
    detection: {
      order: ['localStorage', 'htmlTag', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
