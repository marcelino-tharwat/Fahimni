import { describe, it, expect } from 'vitest';
import { parseFilenameFromDisposition } from './materials';

describe('parseFilenameFromDisposition', () => {
  it('parses UTF-8 filename* from Content-Disposition', () => {
    const name = parseFilenameFromDisposition(
      "attachment; filename=\"notes.pdf\"; filename*=UTF-8''%D9%85%D9%84%D8%AE%D8%B5.pdf",
    );
    expect(name).toBe('ملخص.pdf');
  });

  it('falls back to basic filename', () => {
    expect(parseFilenameFromDisposition('attachment; filename="work.pdf"')).toBe('work.pdf');
  });

  it('returns null when header missing', () => {
    expect(parseFilenameFromDisposition(undefined)).toBeNull();
  });
});
