export interface Subject {
  code: string;
  displayName: string;
  isActive: boolean;
}

/** Canonical subject catalog — must stay in sync with backend/src/modules/subjects/subjects.ts */
export const SUBJECT_CATALOG: Subject[] = [
  { code: "ARABIC", displayName: "اللغة العربية", isActive: true },
  { code: "ENGLISH", displayName: "اللغة الإنجليزية", isActive: true },
  { code: "MATH", displayName: "الرياضيات", isActive: true },
  { code: "PHYSICS", displayName: "الفيزياء", isActive: true },
  { code: "CHEMISTRY", displayName: "الكيمياء", isActive: true },
  { code: "BIOLOGY", displayName: "الأحياء", isActive: true },
  { code: "GEOLOGY", displayName: "الجيولوجيا", isActive: true },
  { code: "HISTORY", displayName: "التاريخ", isActive: true },
  { code: "GEOGRAPHY", displayName: "الجغرافيا", isActive: true },
  { code: "PHILOSOPHY", displayName: "الفلسفة", isActive: true },
  { code: "ISLAMIC_EDUCATION", displayName: "التربية الإسلامية", isActive: true },
];
