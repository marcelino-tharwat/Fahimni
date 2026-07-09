// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { TeacherRequestTrackPage } from './TeacherRequestTrackPage';
import { teacherRequestTrackApi } from '@/features/teacher-request/api/teacherRequestTrack';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));
vi.mock('@/features/teacher-request/api/teacherRequestTrack', () => ({
  teacherRequestTrackApi: { track: vi.fn() },
}));

const mApi = teacherRequestTrackApi as unknown as { track: ReturnType<typeof vi.fn> };

function renderPage() {
  return render(<MemoryRouter><TeacherRequestTrackPage /></MemoryRouter>);
}
function fill(reference: string, contact: string) {
  fireEvent.change(screen.getByTestId('track-reference'), { target: { value: reference } });
  fireEvent.change(screen.getByTestId('track-contact'), { target: { value: contact } });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('TeacherRequestTrackPage', () => {
  it('submits reference + email and shows the returned status', async () => {
    mApi.track.mockResolvedValue({ reference: 'TR-2026-100001', status: 'PENDING', submittedAt: '2026-07-01T00:00:00Z', reviewedAt: null });
    renderPage();
    fill('TR-2026-100001', 'teacher@example.com');
    fireEvent.click(screen.getByTestId('track-submit'));
    expect(await screen.findByTestId('track-result')).toBeInTheDocument();
    expect(mApi.track).toHaveBeenCalledWith({ reference: 'TR-2026-100001', email: 'teacher@example.com' });
  });

  it('sends mobile (not email) when the contact has no @', async () => {
    mApi.track.mockResolvedValue({ reference: 'TR-2026-100002', status: 'APPROVED', submittedAt: '2026-07-01T00:00:00Z', reviewedAt: '2026-07-02T00:00:00Z' });
    renderPage();
    fill('TR-2026-100002', '01012345678');
    fireEvent.click(screen.getByTestId('track-submit'));
    await waitFor(() => expect(mApi.track).toHaveBeenCalledWith({ reference: 'TR-2026-100002', mobile: '01012345678' }));
  });

  it('shows an error message when the lookup fails', async () => {
    mApi.track.mockRejectedValue({ message: 'No matching request found' });
    renderPage();
    fill('TR-2026-999999', 'nobody@example.com');
    fireEvent.click(screen.getByTestId('track-submit'));
    expect(await screen.findByTestId('track-error')).toHaveTextContent('No matching request found');
  });

  it('keeps the submit button disabled until both fields are filled', () => {
    renderPage();
    const btn = screen.getByTestId('track-submit');
    expect(btn).toBeDisabled();
    fill('TR-2026-100001', '');
    expect(btn).toBeDisabled();
    fill('TR-2026-100001', 'teacher@example.com');
    expect(btn).not.toBeDisabled();
  });
});
