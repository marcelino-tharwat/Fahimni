/**
 * Shared text-normalization helpers so whitespace-only input (tabs, spaces,
 * newlines) is never treated as real content. Only leading/trailing
 * whitespace is stripped — internal spacing (and textarea line breaks) is
 * left as the user typed it.
 */

/** True when a string is empty or contains only whitespace (spaces/tabs/newlines). */
export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

/** Trims a required text field. Callers should reject the result if `isBlank`. */
export function normalizeTextInput(value: string): string {
  return value.trim();
}

/** Trims an optional text field, collapsing a blank result to `undefined`. */
export function normalizeOptionalTextInput(
  value: string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
