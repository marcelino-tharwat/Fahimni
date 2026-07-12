// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import i18n from '@/shared/lib/i18n';
import { EditProfileModal } from './EditProfileModal';
import type { TeacherProfile } from '@/features/teacher/types/teacher';

const mutateMock = vi.fn();
vi.mock('@/features/teacher/hooks/useTeacherProfile', () => ({
  useUpdateTeacherProfile: () => ({ mutate: mutateMock, isPending: false }),
}));
vi.mock('@/shared/store/hooks', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: () => undefined }));
vi.mock('@/features/subjects/useSubjects', () => ({ useSubjects: () => ({ subjects: [], loading: false }) }));

const profile: TeacherProfile = {
  id: 'p1',
  userId: 'u1',
  subject: 'Math',
  bio: 'A bio',
  photoUrl: null,
  logoUrl: null,
  createdAt: '',
  updatedAt: '',
  user: {
    id: 'u1',
    fullName: 'Ahmed Ali',
    email: 'ahmed@example.com',
    mobile: '01012345678',
    role: 'OPERATION',
    status: 'ACTIVE',
    createdAt: '',
    updatedAt: '',
  },
};

afterEach(() => cleanup());

describe('EditProfileModal — whitespace/tab-only input rejected', () => {
  it('a whitespace-only name disables Save and never calls updateProfile', async () => {
    await i18n.changeLanguage('ar');
    render(<EditProfileModal profile={profile} onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('محمد أحمد محمود'), { target: { value: '   \t  ' } });
    const saveButton = screen.getByText('حفظ', { selector: 'button' });
    expect(saveButton).toBeDisabled();

    fireEvent.click(saveButton);
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('a valid save trims the name/phone before calling updateProfile', async () => {
    await i18n.changeLanguage('ar');
    render(<EditProfileModal profile={profile} onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('محمد أحمد محمود'), { target: { value: '  Ahmed Ali  ' } });
    fireEvent.change(screen.getByPlaceholderText('01012345678'), { target: { value: ' 01099998888 ' } });
    fireEvent.click(screen.getByText('حفظ', { selector: 'button' }));

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Ahmed Ali', mobile: '01099998888' }),
      expect.anything(),
    );
  });
});
