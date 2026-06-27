import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useUpdateTeacherProfile } from '@/features/teacher/hooks/useTeacherProfile';
import { addToast } from '@/shared/store/slices/toastSlice';
import { useAppDispatch } from '@/shared/store/hooks';
import { getApiErrorMessage } from '@/shared/lib/api/errors';
import type { TeacherProfile } from '@/features/teacher/types/teacher';

interface EditProfileModalProps {
  profile: TeacherProfile;
  onClose: () => void;
}

export function EditProfileModal({ profile, onClose }: EditProfileModalProps) {
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation();
  const dispatch = useAppDispatch();
  const { mutate: updateProfile, isPending } = useUpdateTeacherProfile();

  const [name, setName] = useState(profile.user.fullName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [phone, setPhone] = useState(profile.user.mobile);

  const handleSubmit = () => {
    updateProfile(
      { fullName: name, bio, mobile: phone },
      {
        onSuccess: () => {
          dispatch(addToast({ type: 'success', message: tc('status.success') }));
          onClose();
        },
        onError: (error) => {
          dispatch(addToast({
            type: 'error',
            message: getApiErrorMessage(error, tc('status.error')),
          }));
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-card bg-white p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-cairo text-h3 font-bold text-navy-900">
            {t('editModal.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block font-cairo text-small font-medium text-gray-700">
              {t('editModal.nameLabel')}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('editModal.namePlaceholder')}
              className="w-full rounded-input border border-gray-300 px-3 py-2 font-cairo text-body text-navy-900 outline-none transition-colors focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="mb-1 block font-cairo text-small font-medium text-gray-700">
              {t('editModal.bioLabel')}
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('editModal.bioPlaceholder')}
              rows={3}
              className="w-full resize-none rounded-input border border-gray-300 px-3 py-2 font-cairo text-body text-navy-900 outline-none transition-colors focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="mb-1 block font-cairo text-small font-medium text-gray-700">
              {t('editModal.phoneLabel')}
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('editModal.phonePlaceholder')}
              className="w-full rounded-input border border-gray-300 px-3 py-2 font-cairo text-body text-navy-900 outline-none transition-colors focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn border border-gray-300 px-5 py-2 font-cairo text-body font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            {tc('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-btn bg-cyan-500 px-6 py-2 font-cairo text-body font-semibold text-navy-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? t('editModal.saving') : tc('actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
