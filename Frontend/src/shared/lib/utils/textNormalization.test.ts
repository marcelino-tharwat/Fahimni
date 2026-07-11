import { describe, it, expect } from 'vitest';
import { isBlank, normalizeTextInput, normalizeOptionalTextInput } from './textNormalization';

describe('isBlank', () => {
  it('treats a tab-only string as blank', () => {
    expect(isBlank('\t')).toBe(true);
  });
  it('treats a spaces-only string as blank', () => {
    expect(isBlank('     ')).toBe(true);
  });
  it('treats a newline+tab-only string as blank', () => {
    expect(isBlank('\n\t')).toBe(true);
  });
  it('treats an empty string as blank', () => {
    expect(isBlank('')).toBe(true);
  });
  it('treats null/undefined as blank', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });
  it('treats real content as not blank', () => {
    expect(isBlank('Ahmed')).toBe(false);
    expect(isBlank('  Ahmed  ')).toBe(false);
  });
});

describe('normalizeTextInput', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalizeTextInput('   Ahmed   ')).toBe('Ahmed');
  });
  it('trims a leading newline and trailing tab', () => {
    expect(normalizeTextInput('\nMath\t')).toBe('Math');
  });
  it('collapses a tab-only string to empty', () => {
    expect(normalizeTextInput('\t')).toBe('');
  });
  it('preserves internal whitespace', () => {
    expect(normalizeTextInput('  New York  ')).toBe('New York');
  });
});

describe('normalizeOptionalTextInput', () => {
  it('collapses a whitespace-only value to undefined', () => {
    expect(normalizeOptionalTextInput('   ')).toBeUndefined();
    expect(normalizeOptionalTextInput('\n\t')).toBeUndefined();
  });
  it('collapses null/undefined to undefined', () => {
    expect(normalizeOptionalTextInput(null)).toBeUndefined();
    expect(normalizeOptionalTextInput(undefined)).toBeUndefined();
  });
  it('trims real content', () => {
    expect(normalizeOptionalTextInput('  Chemistry  ')).toBe('Chemistry');
  });
});
