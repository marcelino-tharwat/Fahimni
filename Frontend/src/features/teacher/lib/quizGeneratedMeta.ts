/**
 * Session-scoped persistence for teacher-only generation metadata (difficulty +
 * source lesson/chapter). The backend does not persist these fields (no schema
 * column), so they only exist in the generation response. We stash them in
 * sessionStorage keyed by quizId so the Step 2 review page can show them even
 * across a refresh, and drop them once the tab session ends. Absent metadata is
 * expected (e.g. old drafts) and simply renders as "غير محدد".
 */
import type { QuestionMetadata } from './quizReview';

const KEY_PREFIX = 'fahimni:quizmeta:';

function keyFor(quizId: string): string {
  return `${KEY_PREFIX}${quizId}`;
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Persist a questionId → metadata map for a quiz draft. */
export function saveGeneratedMeta(
  quizId: string,
  metadata: Record<string, QuestionMetadata>,
): void {
  const storage = safeStorage();
  if (!storage || !quizId) return;
  try {
    storage.setItem(keyFor(quizId), JSON.stringify(metadata));
  } catch {
    // Quota / serialization failures are non-fatal — metadata is optional.
  }
}

/** Read a previously persisted metadata map (empty object when absent). */
export function loadGeneratedMeta(quizId: string): Record<string, QuestionMetadata> {
  const storage = safeStorage();
  if (!storage || !quizId) return {};
  try {
    const raw = storage.getItem(keyFor(quizId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, QuestionMetadata>)
      : {};
  } catch {
    return {};
  }
}
