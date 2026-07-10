/**
 * Controlled subject catalog.
 *
 * The `subject` column in `teacher_profiles` and `teacher_registration_requests`
 * stores the **Arabic displayName** from this catalog (e.g. "الرياضيات") rather
 * than a code. This keeps the existing display logic working without changes.
 *
 * Validation: every accepted subject string MUST appear in `SUBJECT_CATALOG`.
 * The `isValidSubject()` helper is used in Zod schemas across auth, teacher,
 * and admin modules.
 */

export interface SubjectCatalogEntry {
  /** Machine-readable code (used as the canonical key). */
  code: string;
  /** Arabic display label shown in the UI dropdowns. */
  displayName: string;
}

export const SUBJECT_CATALOG: SubjectCatalogEntry[] = [
  { code: "ARABIC", displayName: "اللغة العربية" },
  { code: "ENGLISH", displayName: "اللغة الإنجليزية" },
  { code: "MATH", displayName: "الرياضيات" },
  { code: "PHYSICS", displayName: "الفيزياء" },
  { code: "CHEMISTRY", displayName: "الكيمياء" },
  { code: "BIOLOGY", displayName: "الأحياء" },
  { code: "GEOLOGY", displayName: "الجيولوجيا" },
  { code: "HISTORY", displayName: "التاريخ" },
  { code: "GEOGRAPHY", displayName: "الجغرافيا" },
  { code: "PHILOSOPHY", displayName: "الفلسفة" },
  { code: "ISLAMIC_EDUCATION", displayName: "التربية الإسلامية" },
];

/** Set of valid Arabic displayName values for fast lookup. */
const VALID_DISPLAY_NAMES = new Set(
  SUBJECT_CATALOG.map((s) => s.displayName),
);

/**
 * Returns true when `value` matches one of the known subject display names.
 */
export function isValidSubject(value: string): boolean {
  return VALID_DISPLAY_NAMES.has(value);
}

/**
 * Returns the full list of active subjects (all entries in this catalog are
 * active — there is no per-entry `isActive` flag yet, but the shape is ready
 * for future extension).
 */
export function getActiveSubjects(): (SubjectCatalogEntry & { isActive: boolean })[] {
  return SUBJECT_CATALOG.map((s) => ({ ...s, isActive: true }));
}
