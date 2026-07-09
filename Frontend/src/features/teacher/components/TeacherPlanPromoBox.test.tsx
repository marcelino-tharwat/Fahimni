// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TeacherPlanPromoBox } from './TeacherPlanPromoBox';
import { teacherPlansApi } from '@/features/teacher/api/teacherPlans';
import type { TeacherPlan } from '@/features/teacher/types/teacherPlans';

vi.mock('@/features/teacher/api/teacherPlans', () => ({
  teacherPlansApi: { previewPromo: vi.fn(), checkout: vi.fn() },
}));

const mApi = teacherPlansApi as unknown as {
  previewPromo: ReturnType<typeof vi.fn>;
  checkout: ReturnType<typeof vi.fn>;
};

const PLANS: TeacherPlan[] = [
  { id: 'pro-1', code: 'PRO', displayName: 'Pro', description: null, monthlyPrice: 200, yearlyPrice: 2000, currency: 'EGP', isRecommended: false, features: {}, limits: {} } as never,
];

function renderBox() {
  return render(<TeacherPlanPromoBox plans={PLANS} />);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('TeacherPlanPromoBox', () => {
  it('7 & 8. applying a valid promo shows original / discount / final', async () => {
    mApi.previewPromo.mockResolvedValue({ originalAmount: 200, discount: 40, amountAfter: 160, currency: 'EGP', promoCode: 'PCT20' });
    renderBox();
    fireEvent.change(screen.getByTestId('promo-plan-select'), { target: { value: 'pro-1' } });
    fireEvent.change(screen.getByTestId('promo-code-input'), { target: { value: 'PCT20' } });
    fireEvent.click(screen.getByTestId('promo-apply-btn'));

    await waitFor(() => expect(screen.getByTestId('promo-preview')).toBeInTheDocument());
    expect(screen.getByTestId('promo-original')).toHaveTextContent('200');
    expect(screen.getByTestId('promo-discount')).toHaveTextContent('40');
    expect(screen.getByTestId('promo-final')).toHaveTextContent('160');
    expect(mApi.previewPromo).toHaveBeenCalledWith({ planId: 'pro-1', billingInterval: 'MONTHLY', promoCode: 'PCT20' });
  });

  it('9 & 10. an invalid / cross-scope promo shows an error and no preview', async () => {
    mApi.previewPromo.mockRejectedValue({ message: 'رمز الخصم غير صالح لهذه العملية', code: 'PROMO_SCOPE_MISMATCH' });
    renderBox();
    fireEvent.change(screen.getByTestId('promo-plan-select'), { target: { value: 'pro-1' } });
    fireEvent.change(screen.getByTestId('promo-code-input'), { target: { value: 'CRS20' } });
    fireEvent.click(screen.getByTestId('promo-apply-btn'));

    expect(await screen.findByTestId('promo-error')).toHaveTextContent('رمز الخصم غير صالح لهذه العملية');
    expect(screen.queryByTestId('promo-preview')).not.toBeInTheDocument();
  });
});
