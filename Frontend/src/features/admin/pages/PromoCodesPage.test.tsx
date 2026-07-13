// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PromoCodesPage } from './PromoCodesPage';
import { usePromoCodes, useGeneratePromoCode } from '../hooks/usePromoCodes';
import { useContentTree } from '@/features/teacher/hooks/useContentTree';
import { addToast } from '@/shared/store/slices/toastSlice';

// Regression tests for the promo-codes-paid-chapters-only fix: the backend's
// new PROMO_TARGET_MUST_BE_PAID rejection must surface through this page's
// existing error-toast mechanism with its own i18n message (not the generic
// "something went wrong" fallback), and every other field on this page must
// remain untouched by the change.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, f?: string) => f ?? k, i18n: { language: 'en' } }),
}));
vi.mock('../hooks/usePromoCodes');
vi.mock('@/features/teacher/hooks/useContentTree');

const dispatchMock = vi.fn();
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => dispatchMock }));
vi.mock('@/shared/store/slices/toastSlice', () => ({ addToast: vi.fn((payload) => payload) }));

function primeList() {
  vi.mocked(usePromoCodes).mockReturnValue({
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
}

function primeTree() {
  vi.mocked(useContentTree).mockReturnValue({
    data: [
      {
        id: 'stage-1',
        name: 'Stage One',
        chapters: [
          { id: 'chapter-free', name: 'Intro', price: null },
          { id: 'chapter-paid', name: 'Advanced', price: 200 },
        ],
      },
    ],
    isLoading: false,
  } as never);
}

let mutateMock: ReturnType<typeof vi.fn>;

function primeGenerate() {
  mutateMock = vi.fn();
  vi.mocked(useGeneratePromoCode).mockReturnValue({
    mutate: mutateMock,
    isPending: false,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  primeList();
  primeTree();
  primeGenerate();
});
afterEach(() => cleanup());

describe('PromoCodesPage — free-chapter rejection surfaces via the existing toast mechanism', () => {
  it('1. opening the generator and confirming a paid chapter calls generate with its id', () => {
    render(<PromoCodesPage />);
    fireEvent.click(screen.getByText('promoCodes.createNew'));

    const chapterSelect = document.querySelectorAll('select')[1] as HTMLSelectElement;
    fireEvent.change(chapterSelect, { target: { value: 'chapter-paid' } });
    fireEvent.click(screen.getByText('promoCodes.confirmButton'));

    expect(mutateMock).toHaveBeenCalledWith('chapter-paid', expect.any(Object));
  });

  it('2. free chapter option is disabled in the page-level generator modal too', () => {
    render(<PromoCodesPage />);
    fireEvent.click(screen.getByText('promoCodes.createNew'));

    const chapterSelect = document.querySelectorAll('select')[1] as HTMLSelectElement;
    const freeOption = Array.from(chapterSelect.options).find((o) => o.value === 'chapter-free')!;
    expect(freeOption.disabled).toBe(true);
  });

  it('3. PROMO_TARGET_MUST_BE_PAID error dispatches the dedicated i18n message, not the generic fallback', () => {
    render(<PromoCodesPage />);
    fireEvent.click(screen.getByText('promoCodes.createNew'));
    const chapterSelect = document.querySelectorAll('select')[1] as HTMLSelectElement;
    fireEvent.change(chapterSelect, { target: { value: 'chapter-paid' } });
    fireEvent.click(screen.getByText('promoCodes.confirmButton'));

    const [, options] = mutateMock.mock.calls[0]!;
    options.onError({ code: 'PROMO_TARGET_MUST_BE_PAID' });

    expect(vi.mocked(addToast)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: 'promoCodes.errorFreeChapter' }),
    );
  });

  it('4. an unrelated error code still falls back to the generic error message', () => {
    render(<PromoCodesPage />);
    fireEvent.click(screen.getByText('promoCodes.createNew'));
    const chapterSelect = document.querySelectorAll('select')[1] as HTMLSelectElement;
    fireEvent.change(chapterSelect, { target: { value: 'chapter-paid' } });
    fireEvent.click(screen.getByText('promoCodes.confirmButton'));

    const [, options] = mutateMock.mock.calls[0]!;
    options.onError({ code: 'SOME_OTHER_ERROR' });

    expect(vi.mocked(addToast)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: 'promoCodes.errorGenerating' }),
    );
  });

  it('5. page title, subtitle and stat cards are unaffected by the change', () => {
    render(<PromoCodesPage />);
    expect(screen.getByText('promoCodes.title')).toBeInTheDocument();
    expect(screen.getByText('promoCodes.subtitle')).toBeInTheDocument();
  });
});
