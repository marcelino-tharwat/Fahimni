import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SkeletonBlock } from './SkeletonBlock';
import type { TeacherProfile } from '@/features/teacher/types/teacher';

interface AcademicIdentityCardProps {
  isLoading: boolean;
  profile: TeacherProfile | null;
}

export function AcademicIdentityCard({ isLoading, profile }: AcademicIdentityCardProps) {
  const { t } = useTranslation('profile');

  if (isLoading) {
    return (
      <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
        <SkeletonBlock className="mb-4 h-5 w-32" />
        <div className="mb-4 flex items-center gap-3">
          <SkeletonBlock variant="circle" className="h-10 w-10" />
          <SkeletonBlock className="h-4 flex-1" />
        </div>
        <SkeletonBlock className="mb-4 h-3 w-24" />
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-16" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBlock key={i} variant="circle" className="h-6 w-6" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const fullName = profile?.user.fullName ?? 'أ. محمد أحمد محمود';
  const initials = fullName.replace(/^[أإآا]\.\s*/, '').charAt(0) || 'ك';

  return (
    <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
      <h3 className="mb-4 font-cairo text-h3 font-bold text-navy-900">
        {t('academicIdentity.title')}
      </h3>

      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500 font-cairo text-sm font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-cairo text-body font-semibold text-navy-900">
            {profile
              ? t('academicIdentity.academyName')
              : 'أكاديمية الكيمياء — أ. محمد'}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="mb-4 flex items-center gap-1 font-cairo text-small text-cyan-600 transition-colors hover:text-cyan-700"
      >
        {t('academicIdentity.editLink')}
        <ArrowLeft size={14} />
      </button>

      <div className="space-y-3">
        <div>
          <p className="mb-1 font-cairo text-caption text-gray-600">
            {t('academicIdentity.fontLabel')}
          </p>
          <p className="font-cairo text-body font-medium text-navy-900">
            Cairo
          </p>
        </div>
        <div>
          <p className="mb-1.5 font-cairo text-caption text-gray-600">
            {t('academicIdentity.colorsLabel')}
          </p>
          <div className="flex gap-2">
            <span className="h-6 w-6 rounded-full bg-warning-500" />
            <span className="h-6 w-6 rounded-full bg-navy-900" />
            <span className="h-6 w-6 rounded-full bg-cyan-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
