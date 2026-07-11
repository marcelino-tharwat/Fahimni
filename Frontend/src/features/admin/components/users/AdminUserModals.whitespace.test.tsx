// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AdminUserModals } from './AdminUserModals';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

afterEach(() => cleanup());

function renderCreateModal(onSubmit = vi.fn()) {
  render(
    <AdminUserModals
      mode="create"
      onClose={() => {}}
      selectedUser={null}
      currentAdminId="admin-1"
      onSubmit={onSubmit}
      isSubmitting={false}
      error={null}
    />,
  );
  return onSubmit;
}

describe('CreateUserModal (via AdminUserModals) — whitespace/tab-only input rejected', () => {
  it('6. a whitespace-only password keeps the Create button disabled', () => {
    renderCreateModal();
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Ahmed Ali' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ahmed@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: '        ' } });

    expect(screen.getByText('Create')).toBeDisabled();
  });

  it('1 & 2. a tab-only full name keeps the Create button disabled even with email/password filled', () => {
    renderCreateModal();
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: '\t\t' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ahmed@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Pass' } });

    expect(screen.getByText('Create')).toBeDisabled();
  });

  it('5. a valid submission trims fullName/email/mobile (password stays untouched)', () => {
    const onSubmit = renderCreateModal();
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: '  Ahmed Ali  ' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  ahmed@example.com\t' } });
    fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: ' 01012345678 ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: '  Str0ng!Pass  ' } });

    fireEvent.click(screen.getByText('Create'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'Ahmed Ali',
      email: 'ahmed@example.com',
      mobile: '01012345678',
      password: '  Str0ng!Pass  ', // never trimmed
    }));
  });
});
