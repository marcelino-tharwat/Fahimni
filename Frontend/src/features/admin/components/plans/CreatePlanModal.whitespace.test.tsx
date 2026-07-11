// @vitest-environment jsdom
// Real i18n (no react-i18next mock) so the validation-message-language
// requirement is exercised end-to-end.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('ar');
});
afterEach(() => cleanup());

describe('CreatePlanModal — whitespace/tab-only input rejected', () => {
  it('2. a spaces-only plan name shows the required-field error and does not submit', () => {
    renderModal();
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: 'BASIC' } }); // code
    fireEvent.change(inputs[1]!, { target: { value: '     ' } }); // name — spaces only
    fireEvent.change(inputs[2]!, { target: { value: 'Basic' } }); // displayName
    fireEvent.click(screen.getByText('إنشاء'));

    expect(screen.getByText('هذا الحقل مطلوب')).toBeInTheDocument();
    expect(mApi.create).not.toHaveBeenCalled();
  });

  it('5. a valid submission trims code/name/displayName before sending to the API', async () => {
    mApi.create.mockResolvedValue({ id: 'plan-1' });
    renderModal();

    const inputs = screen.getAllByRole('textbox');
    // Field order matches the grid: code, name, displayName, description.
    fireEvent.change(inputs[0]!, { target: { value: '  basic  ' } });
    fireEvent.change(inputs[1]!, { target: { value: '  Basic Plan  ' } });
    fireEvent.change(inputs[2]!, { target: { value: '\tBasic\n' } });

    fireEvent.click(screen.getByText('إنشاء'));

    await waitFor(() => expect(mApi.create).toHaveBeenCalled());
    const payload = mApi.create.mock.calls[0]![0];
    expect(payload.code).toBe('BASIC'); // input onChange also uppercases
    expect(payload.name).toBe('Basic Plan');
    expect(payload.displayName).toBe('Basic');
  });
});
