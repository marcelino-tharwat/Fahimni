// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GenerateConfirmModal } from './GenerateConfirmModal';
import { useContentTree } from '@/features/teacher/hooks/useContentTree';

// Regression tests for the promo-codes-paid-chapters-only fix: free chapters
// must stay visible in the chapter picker (for context) but be disabled and
// labeled, since a promo code granting free access to an already-free
// chapter is meaningless.

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, f?: string) => f ?? k }) }));
vi.mock('@/features/teacher/hooks/useContentTree');

const TREE = [
  {
    id: 'stage-1',
    name: 'Stage One',
    chapters: [
      { id: 'chapter-free', name: 'Intro Chapter', price: null },
      { id: 'chapter-paid', name: 'Advanced Chapter', price: 200 },
      { id: 'chapter-zero', name: 'Zero Price Chapter', price: 0 },
    ],
  },
];

function primeTree(data = TREE) {
  vi.mocked(useContentTree).mockReturnValue({ data, isLoading: false } as never);
}

function renderModal(overrides: Partial<Parameters<typeof GenerateConfirmModal>[0]> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <GenerateConfirmModal isOpen onConfirm={onConfirm} onClose={onClose} {...overrides} />,
  );
  return { onConfirm, onClose };
}

function openStageAndReturnChapterSelect() {
  fireEvent.change(screen.getByText('promoCodes.stageLabel').nextElementSibling!.querySelector('select')!, {
    target: { value: 'stage-1' },
  });
  return document.querySelectorAll('select')[1] as HTMLSelectElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  primeTree();
});
afterEach(() => cleanup());

describe('GenerateConfirmModal — free chapters are disabled, not hidden', () => {
  it('1. renders free chapters as disabled options labeled with the Free text', () => {
    renderModal();
    const chapterSelect = openStageAndReturnChapterSelect();
    const freeOption = Array.from(chapterSelect.options).find((o) => o.value === 'chapter-free')!;
    expect(freeOption).toBeDefined();
    expect(freeOption.disabled).toBe(true);
    expect(freeOption.textContent).toContain('promoCodes.chapterFreeLabel');

    const zeroPriceOption = Array.from(chapterSelect.options).find((o) => o.value === 'chapter-zero')!;
    expect(zeroPriceOption.disabled).toBe(true);
  });

  it('2. paid chapters remain selectable (not disabled)', () => {
    renderModal();
    const chapterSelect = openStageAndReturnChapterSelect();
    const paidOption = Array.from(chapterSelect.options).find((o) => o.value === 'chapter-paid')!;
    expect(paidOption.disabled).toBe(false);
    expect(paidOption.textContent).toBe('Advanced Chapter');

    fireEvent.change(chapterSelect, { target: { value: 'chapter-paid' } });
    expect(chapterSelect.value).toBe('chapter-paid');
  });

  it('3. submitting is blocked when a free chapter is selected, even if forced into state', () => {
    const { onConfirm } = renderModal();
    const chapterSelect = openStageAndReturnChapterSelect();
    // Native <option disabled> already prevents a real user from selecting it;
    // this simulates a value getting set directly to prove the confirm handler
    // itself also guards against submitting a free chapter.
    fireEvent.change(chapterSelect, { target: { value: 'chapter-free' } });

    fireEvent.click(screen.getByText('promoCodes.confirmButton'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('4. confirming a selected paid chapter calls onConfirm with its id', () => {
    const { onConfirm } = renderModal();
    const chapterSelect = openStageAndReturnChapterSelect();
    fireEvent.change(chapterSelect, { target: { value: 'chapter-paid' } });

    fireEvent.click(screen.getByText('promoCodes.confirmButton'));
    expect(onConfirm).toHaveBeenCalledWith('chapter-paid');
  });

  it('5. never auto-selects a free chapter even when it is the only chapter in the stage', () => {
    primeTree([
      { id: 'stage-only-free', name: 'Only Free Stage', chapters: [{ id: 'only-free', name: 'Only Free', price: null }] },
    ]);
    renderModal();
    const chapterSelect = openStageAndReturnChapterSelect();
    expect(chapterSelect.value).toBe('');
  });
});
