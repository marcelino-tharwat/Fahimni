import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const controls = read('./AllocationControls.tsx');
const page = read('../../pages/AiQuizGeneratorPage.tsx');
const lib = read('../../lib/quizAllocation.ts');

describe('Allocation UX guards — progressive disclosure', () => {
  it('offers the three allocation modes', () => {
    expect(controls).toContain('modeAuto');
    expect(controls).toContain('modeByChapter');
    expect(controls).toContain('modeByLesson');
  });

  it('only renders per-chapter inputs in BY_CHAPTER mode', () => {
    expect(controls).toContain("allocationMode === 'BY_CHAPTER'");
    expect(controls).toContain('onChapterCountChange');
  });

  it('only renders per-lesson inputs in BY_LESSON mode', () => {
    expect(controls).toContain("allocationMode === 'BY_LESSON'");
    expect(controls).toContain('onLessonCountChange');
  });

  it('collapses per-chapter lesson distribution for multi-chapter BY_LESSON', () => {
    expect(controls).toContain("sourceScope === 'MULTI_CHAPTER'");
    expect(controls).toContain('aria-expanded');
  });

  it('shows a live total and an auto-distribute action', () => {
    expect(controls).toContain('allocation.total');
    expect(controls).toContain('onAutoDistribute');
    expect(controls).toContain('autoDistribute');
  });

  it('surfaces weak-content warnings per lesson', () => {
    expect(controls).toContain('hasUsableContent');
    expect(controls).toContain('lessonNoContent');
  });

  it('shows the full-curriculum summary block', () => {
    expect(controls).toContain('fullCurriculumSummary');
    expect(controls).toContain("sourceScope === 'FULL_CURRICULUM'");
  });
});

describe('Allocation UX guards — page wiring', () => {
  it('renders AllocationControls only after a source is chosen', () => {
    expect(page).toContain('<AllocationControls');
    expect(page).toContain('hasSource');
  });

  it('disables generate when allocation is invalid or full curriculum is blocked', () => {
    expect(page).toContain('allocationInvalid');
    expect(page).toContain('fullCurriculumBlocked');
    expect(page).toContain('disabled={quotaExhausted || allocationInvalid || fullCurriculumBlocked}');
  });

  it('runs allocation validation on submit and passes chapterLessons to the payload', () => {
    expect(page).toContain('validateAllocation(form, chapterLessonsMap, t)');
    expect(page).toContain('buildGenerateQuizPayload(form, { chapterLessons: chapterLessonsMap })');
  });

  it('resets allocation state when the source scope changes', () => {
    expect(page).toContain("setField('allocationMode', 'AUTO')");
    expect(page).toContain("setField('chapterQuestionCounts', {})");
    expect(page).toContain("setField('lessonQuestionCounts', {})");
  });
});

describe('Allocation library guards', () => {
  it('mirrors the backend bucket cap', () => {
    expect(lib).toContain('MAX_ALLOCATION_BUCKETS = 12');
  });

  it('keeps full curriculum AUTO-only', () => {
    expect(lib).toContain("return ['AUTO']");
  });
});
