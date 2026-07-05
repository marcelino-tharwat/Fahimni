/**
 * CSV export utilities for the students list (STORY-74).
 *
 * Pure functions except `downloadCsv`, which touches the DOM. No React, no
 * hooks. CSV escaping follows RFC 4180; the download prepends a UTF-8 BOM so
 * Excel opens Arabic content correctly.
 */

/** Characters that force a CSV cell to be quoted. */
const NEEDS_QUOTING = /[",\r\n]/;

/**
 * Escape a single CSV cell (RFC 4180): quote-wrap when the value contains a
 * comma, quote, newline, or CR; double internal quotes; null/undefined → ''.
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';

  const text = typeof value === 'string' ? value : String(value);
  if (!NEEDS_QUOTING.test(text)) return text;

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Build a CSV string from a header row + data rows. Uses CRLF line endings
 * (Excel-friendly); the header row is emitted first. No BOM (added at download).
 */
export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null>>,
): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return lines.join('\r\n');
}

/**
 * Trigger a browser download for a CSV string. Prepends the UTF-8 BOM as a
 * separate blob part so Excel detects the encoding. Uses a temporary anchor and
 * revokes the object URL afterwards.
 */
/** UTF-8 byte-order mark (U+FEFF) — makes Excel detect UTF-8. */
const UTF8_BOM = String.fromCharCode(0xfeff);

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([UTF8_BOM, csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Today's date as YYYY-MM-DD (local time, for the export filename). */
export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
