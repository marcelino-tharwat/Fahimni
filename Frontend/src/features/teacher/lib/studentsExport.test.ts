import { describe, it, expect } from 'vitest';
import { escapeCsvCell, buildCsv, todayIsoDate } from './studentsExport';

describe('escapeCsvCell', () => {
  it('returns a plain string unchanged', () => {
    expect(escapeCsvCell('يوسف')).toBe('يوسف');
    expect(escapeCsvCell('John')).toBe('John');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCsvCell('Doe, John')).toBe('"Doe, John"');
  });

  it('quotes and doubles internal quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes a value containing a newline or CR', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell('a\rb')).toBe('"a\rb"');
  });

  it('renders null and undefined as empty string', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('stringifies numbers and booleans', () => {
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(true)).toBe('true');
    expect(escapeCsvCell(false)).toBe('false');
  });
});

describe('buildCsv', () => {
  it('emits only the header row when there are no data rows', () => {
    expect(buildCsv(['a', 'b'], [])).toBe('a,b');
  });

  it('emits the header row first, then data rows', () => {
    const csv = buildCsv(['name', 'score'], [['يوسف', 88]]);
    expect(csv).toBe('name,score\r\nيوسف,88');
  });

  it('joins multiple rows with CRLF', () => {
    const csv = buildCsv(['h'], [['a'], ['b'], ['c']]);
    expect(csv).toBe('h\r\na\r\nb\r\nc');
    expect(csv.split('\r\n')).toHaveLength(4);
  });

  it('escapes cells that need it', () => {
    const csv = buildCsv(['name', 'note'], [['Doe, J', 'ok']]);
    expect(csv).toBe('name,note\r\n"Doe, J",ok');
  });

  it('renders null data cells as empty', () => {
    expect(buildCsv(['a', 'b'], [['x', null]])).toBe('a,b\r\nx,');
  });
});

describe('todayIsoDate', () => {
  it('returns a YYYY-MM-DD string', () => {
    const date = todayIsoDate();
    expect(date).toHaveLength(10);
    expect(date[4]).toBe('-');
    expect(date[7]).toBe('-');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
