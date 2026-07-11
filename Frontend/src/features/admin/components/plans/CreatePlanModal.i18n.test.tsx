// @vitest-environment jsdom
// Real i18n (no react-i18next mock) — proves the admin plans form renders the
// API error message in whatever language the UI is currently in, translated
// by the backend's stable error `code` rather than the raw backend message.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/shared/lib/i18n';
import { CreatePlanModal } from './CreatePlanModal';
import { adminPlansApi } from '@/features/admin/api/adminPlans';

vi.mock('@/features/admin/api/adminPlans', () => ({
  adminPlansApi: { create: vi.fn() },
}));

const mApi = adminPlansApi as unknown as { create: ReturnType<typeof vi.fn> };

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CreatePlanModal isOpen onClose={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('CreatePlanModal — admin form validation errors render in the current UI language', () => {
  it('3. Arabic UI: a duplicate-plan-code API error renders in Arabic', async () => {
    await i18n.changeLanguage('ar');
    mApi.create.mockRejectedValue({
      statusCode: 409,
      code: 'PLAN_CODE_DUPLICATE',
      message: "Plan with code 'BASIC' already exists",
    });
    renderModal();

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: 'BASIC' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Basic Plan' } });
    fireEvent.change(inputs[2]!, { target: { value: 'Basic' } });
    fireEvent.click(screen.getByText('إنشاء'));

    const errorText = await screen.findByText(/توجد خطة بنفس هذا الكود بالفعل/);
    expect(errorText).toBeInTheDocument();
    // The raw English backend message must never leak into the Arabic UI.
    expect(screen.queryByText(/already exists/)).not.toBeInTheDocument();
  });

  it('4. English UI: the same API error renders in English', async () => {
    await i18n.changeLanguage('en');
    mApi.create.mockRejectedValue({
      statusCode: 409,
      code: 'PLAN_CODE_DUPLICATE',
      message: 'كود الخطة مستخدم بالفعل',
    });
    renderModal();

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: 'BASIC' } });
    fireEvent.change(inputs[1]!, { target: { value: 'Basic Plan' } });
    fireEvent.change(inputs[2]!, { target: { value: 'Basic' } });
    fireEvent.click(screen.getByText('Create'));

    const errorText = await screen.findByText(/A plan with this code already exists/);
    expect(errorText).toBeInTheDocument();
    // The raw Arabic backend message must never leak into the English UI.
    expect(screen.queryByText(/مستخدم بالفعل/)).not.toBeInTheDocument();
  });
});
