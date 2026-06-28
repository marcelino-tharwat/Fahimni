import { useState } from 'react';
import { Mail, Phone, Calendar, Edit3, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SkeletonBlock } from './SkeletonBlock';
import { EditProfileModal } from './EditProfileModal';
import type { TeacherProfile } from '@/features/teacher/types/teacher';

interface ProfileInfoCardProps {
  isLoading: boolean;
  profile: TeacherProfile | null;
  reviewCount: number;
}

function formatJoinDate(dateStr: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(dateStr));
}

export function ProfileInfoCard({ isLoading, profile, reviewCount }: ProfileInfoCardProps) {
  const { t, i18n } = useTranslation('profile');
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
        <div className="mb-4 flex flex-col items-center gap-3">
          <SkeletonBlock variant="circle" className="h-20 w-20" />
          <SkeletonBlock className="h-6 w-44" />
          <SkeletonBlock className="h-5 w-36 rounded-badge" />
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-4 w-40" />
        </div>
        <div className="mb-4 border-t border-gray-300" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock variant="circle" className="h-5 w-5" />
              <div className="flex flex-1 flex-col gap-1">
                <SkeletonBlock className="h-3 w-12" />
                <SkeletonBlock className="h-3.5 w-36" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <SkeletonBlock className="h-3.5 w-16" />
          <SkeletonBlock className="h-10 w-full rounded-btn" />
        </div>
      </div>
    );
  }

  const name = profile?.user.fullName ?? 'أ. محمد أحمد محمود';
  const email = profile?.user.email ?? 'm.ahmed@fahimni.com';
  const phone = profile?.user.mobile ?? '+20 123456789';
  const subject = profile?.subject ?? t('profileInfo.subject');
  const status = profile?.user.status ?? 'active';
  const bio = profile?.bio ?? t('profileInfo.bioText');
  const joinedAt = profile?.user.createdAt
    ? formatJoinDate(profile.user.createdAt, i18n.language)
    : t('profileInfo.september2025');
  const avatarUrl = profile?.photoUrl;
  const rating = 4.8;

  return (
    <>
      <div className="rounded-card border border-gray-300 bg-white p-6 shadow-card">
        <div className="relative mx-auto mb-3 h-20 w-20">
          {avatarUrl ? (
            <img src={avatarUrl} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-700">
              <span className="font-cairo text-h2 font-bold text-white">
                {name.charAt(0)}
              </span>
            </div>
          )}
          {status === 'active' && (
            <span className="absolute bottom-1 end-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-success-500" />
          )}
        </div>

        <h2 className="mb-2 text-center font-cairo text-h2 font-bold text-navy-900">
          {name}
        </h2>

        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="rounded-badge bg-cyan-100 px-3 py-1 font-cairo text-small font-semibold text-cyan-700">
            {subject}
          </span>
          {status === 'active' && (
            <span className="flex items-center gap-1 font-cairo text-small font-semibold text-success-600">
              <span className="inline-block h-2 w-2 rounded-full bg-success-500" />
              {t('profileInfo.status')}
            </span>
          )}
        </div>

        <div className="mb-4 flex items-center justify-center gap-1">
          <span className="font-bold text-navy-900">{rating}</span>
          {Array.from({ length: 4 }).map((_, i) => (
            <Star key={i} size={14} className="fill-warning-500 text-warning-500" />
          ))}
          <span className="ms-1 font-cairo text-caption text-gray-500">
            {t('profileInfo.reviews', { count: reviewCount })}
          </span>
        </div>

        <div className="mb-4 border-t border-gray-300" />

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail size={18} className="shrink-0 text-gray-500" />
            <div>
              <p className="font-cairo text-caption text-gray-600">{t('profileInfo.email')}</p>
              <p className="font-cairo text-body text-navy-900">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone size={18} className="shrink-0 text-gray-500" />
            <div>
              <p className="font-cairo text-caption text-gray-600">{t('profileInfo.phone')}</p>
              <p className="font-cairo text-body text-navy-900 ltr">{phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={18} className="shrink-0 text-gray-500" />
            <div>
              <p className="font-cairo text-caption text-gray-600">{t('profileInfo.joinDate')}</p>
              <p className="font-cairo text-body text-navy-900">{joinedAt}</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1 font-cairo text-caption text-gray-600">{t('profileInfo.bio')}</p>
          <p className="line-clamp-2 font-cairo text-body text-gray-700">{bio}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-btn border border-gray-400 px-4 py-2.5 font-cairo text-body font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          <Edit3 size={16} />
          {t('profileInfo.editButton')}
        </button>
      </div>

      {isEditing && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setIsEditing(false)}
        />
      )}
    </>
  );
}
