import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import commonAr from './ar/common.json';
import authAr from './ar/auth.json';
import studentAr from './ar/student.json';
import teacherAr from './ar/teacher.json';
import landingAr from './ar/landing.json';
import quizAr from './ar/quiz.json';
import profileAr from './ar/profile.json';

import commonEn from './en/common.json';
import authEn from './en/auth.json';
import studentEn from './en/student.json';
import teacherEn from './en/teacher.json';
import landingEn from './en/landing.json';
import quizEn from './en/quiz.json';
import profileEn from './en/profile.json';

export const defaultNS = 'common';

export const resources = {
  ar: {
    common: commonAr,
    auth: authAr,
    student: studentAr,
    teacher: teacherAr,
    landing: landingAr,
    quiz: quizAr,
    profile: profileAr,
  },
  en: {
    common: commonEn,
    auth: authEn,
    student: studentEn,
    teacher: teacherEn,
    landing: landingEn,
    quiz: quizEn,
    profile: profileEn,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS,
    ns: ['common', 'auth', 'student', 'teacher', 'landing', 'quiz', 'profile'],
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

/**
 * i18next is the single source of truth for language/direction. Keep the
 * <html lang/dir> attributes in lockstep with it — on the initial load (after
 * the detector runs), on reload, and on every switch — so the document
 * direction can never drift out of sync with the rendered language.
 */
function syncHtmlLangDir(lng: string): void {
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
}

i18n.on('languageChanged', syncHtmlLangDir);
syncHtmlLangDir(i18n.language);

export default i18n;
