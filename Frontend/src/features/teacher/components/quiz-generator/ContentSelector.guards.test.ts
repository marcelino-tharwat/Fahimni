import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const selector = read('./ContentSelector.tsx');
const page = read('../../pages/AiQuizGeneratorPage.tsx');
const api = read('../../api/quizGeneration.ts');

const types = read('../../types/quizGeneration.ts');

describe('Quiz generator scope UI guards', () => {
  it('ContentSelector exposes CHAPTER and SELECTED_LESSONS scope choices', () => {
    expect(selector).toContain('contentScope');
    expect(selector).toContain('scopeChapter');
    expect(selector).toContain('scopeSelectedLessons');
    expect(selector).toContain("contentScope === 'SELECTED_LESSONS'");
  });

  it('lesson picker is hidden for CHAPTER scope', () => {
    expect(selector).toContain("showLessonPicker = contentScope === 'SELECTED_LESSONS'");
    expect(selector).toContain('{showLessonPicker &&');
  });

  it('AiQuizGeneratorPage clears lessons on chapter change', () => {
    expect(page).toContain("setField('lessonIds', [])");
    expect(page).toContain('onContentScopeChange');
    expect(page).toContain("contentScope: 'CHAPTER'");
  });

  it('API sends canonical payload without stripping chapterId', () => {
    expect(api).not.toContain('delete body.chapterId');
    expect(api).toContain("'/quizzes/generate'");
    expect(api).toContain('payload');
    expect(types).toContain('contentScope');
    expect(types).toContain('SELECTED_LESSONS');
  });

  it('no fake chapters or lessons in generator flow', () => {
    for (const src of [selector, page, api]) {
      expect(src).not.toMatch(/fakeChapter|fakeLesson|mockChapter|mockLesson|dummy/i);
    }
  });
});
