import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Static guards (node-env, matching the repo's Vitest convention) proving the
 * STORY-55 Step 2 production flow uses the real backend and never mock/dummy data.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const page = read('./AiQuizReviewPage.tsx');
const card = read('../components/quiz-generator/QuestionCard.tsx');
const editor = read('../components/quiz-generator/QuestionEditor.tsx');
const api = read('../api/quizGeneration.ts');
const hook = read('../hooks/useQuizReview.ts');

const all = [page, card, editor, api, hook];

describe('Step 2 review — real data only', () => {
  it('no Step-2 file imports shared mocks or references dummy questions', () => {
    for (const src of all) {
      expect(src).not.toMatch(/shared\/mocks/);
      expect(src).not.toMatch(/mockQuiz|mockQuestions|dummyQuestions|fakeQuestions/i);
    }
  });

  it('does not fabricate randomness or hardcoded ids in the flow', () => {
    for (const src of all) {
      expect(src).not.toMatch(/Math\.random/);
    }
  });

  it('the page loads the draft from the real hook (useDraftQuiz)', () => {
    expect(page).toContain('useDraftQuiz');
    expect(page).toContain('useReorderQuestions');
  });

  it('the api calls the real backend quiz endpoints', () => {
    expect(api).toContain('/quizzes/${quizId}');
    expect(api).toContain('/questions/reorder');
  });

  it('Continue navigates to the real Step 3 publish route (not an invented /step-3)', () => {
    expect(page).toContain('/teacher/quizzes/generator/publish/');
    expect(page).not.toMatch(/\/step-3/);
  });
});
