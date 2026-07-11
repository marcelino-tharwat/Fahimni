import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronDown, BookOpen } from 'lucide-react';
import { useUpdateTeacherProfile } from '@/features/teacher/hooks/useTeacherProfile';
import { addToast } from '@/shared/store/slices/toastSlice';
import { useAppDispatch } from '@/shared/store/hooks';
import { getApiErrorMessage } from '@/shared/lib/api/errors';
import { useSubjects } from '@/features/subjects/useSubjects';
import type { TeacherProfile } from '@/features/teacher/types/teacher';

interface EditProfileModalProps {
  profile: TeacherProfile;
  onClose: () => void;
}

export function EditProfileModal({ profile, onClose }: EditProfileModalProps) {
  const { t, i18n } = useTranslation('profile');
  const { t: tc } = useTranslation();
  const dispatch = useAppDispatch();
  const { mutate: updateProfile, isPending } = useUpdateTeacherProfile();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const isRtl = i18n.language === 'ar';

  const [name, setName] = useState(profile.user.fullName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [phone, setPhone] = useState(profile.user.mobile);
  const [subject, setSubject] = useState(profile.subject ?? '');
  const [subjectOpen, setSubjectOpen] = useState(false);

  const handleSubmit = () => {
    updateProfile(
      { fullName: name, bio, mobile: phone, subject: subject || undefined },
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

          <div>
            <label className="mb-1 block font-cairo text-small font-medium text-gray-700">
              {t('editModal.subjectLabel', 'المادة')}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => !subjectsLoading && setSubjectOpen((o) => !o)}
                disabled={subjectsLoading}
                dir={isRtl ? "rtl" : "ltr"}
                className={`flex w-full items-center rounded-input border border-gray-300 px-3 py-2 font-cairo text-body text-navy-900 outline-none transition-colors focus:border-cyan-500 ${
                  subjectsLoading ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                <span className="flex-1 text-left">
                  {subject || t('editModal.subjectPlaceholder', 'اختر المادة')}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${subjectOpen ? "rotate-180" : ""}`} />
              </button>
              {subjectOpen && !subjectsLoading && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                  {subjects.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => {
                        setSubject(s.displayName);
                        setSubjectOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 font-cairo text-body transition hover:bg-gray-50 ${
                        subject === s.displayName ? "bg-cyan-50 font-semibold text-cyan-700" : "text-navy-900"
                      }`}
                    >
                      <BookOpen size={14} className="shrink-0 text-gray-400" />
                      <span>{s.displayName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
