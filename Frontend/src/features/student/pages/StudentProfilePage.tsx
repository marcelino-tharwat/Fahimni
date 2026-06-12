import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  Phone,
  Calendar,
  Shield,
  Briefcase,
  Lock,
  LogOut,
  Globe,
  Bell,
  ChevronLeft,
  User,
  BookOpen,
  CheckCircle,
} from 'lucide-react';
import { Card, Button, Input, Badge, Avatar, EmptyState, Skeleton } from '@/shared/components/ui';
import { useAppSelector, useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { setStudentProfile } from '@/features/student/store/studentSlice';
import { formatDate } from '@/shared/lib/utils/formatDate';
import {
  useStudentProfile,
  useUpdateStudentProfile,
  useChangePassword,
  useStudentEnrollments,
} from '@/features/student/hooks/useStudentProfile';
import { createStudentProfileSchema, createChangePasswordSchema, zodToFieldErrors } from '@/features/student/validation';
import type { ApiError } from '@/shared/lib/api/client';
import { getApiErrorMessage } from '@/shared/lib/api/errors';

export function StudentProfilePage() {
  const { t, i18n } = useTranslation('student');
  useStudentProfile();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PersonalInfoCard />
          <EnrollmentHistoryCard />
          <SecurityCard />
          <PreferencesCard />
        </div>
        <div className="flex flex-col gap-6">
          <ProfileSummaryCard />
          <AccountInfoCard />
        </div>
      </div>
    </div>
  );
}

function PersonalInfoCard() {
  const { t, i18n } = useTranslation('student');
  const dispatch = useAppDispatch();
  const updateProfile = useUpdateStudentProfile();
  const studentUser = useAppSelector((state) => state.student.profile?.user);
  const authUser = useAppSelector((state) => state.auth.user);
  const profileUser = studentUser ?? authUser;

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const displayName = profileUser?.fullName ?? '';
  const displayEmail = profileUser?.email ?? '';
  const displayPhone = profileUser?.mobile ?? '';
  const ltrAlign = i18n.language === 'ar' ? 'text-end' : 'text-start';

  useEffect(() => {
    setName(displayName);
    setEmail(displayEmail);
  }, [displayName, displayEmail]);

  const handleSave = () => {
    setErrors({});
    const payload = { fullName: name.trim(), email: email.trim().toLowerCase() };
    const parsed = createStudentProfileSchema(t).safeParse(payload);
    if (!parsed.success) {
      setErrors(zodToFieldErrors(parsed.error));
      return;
    }
    updateProfile.mutate(parsed.data, {
      onSuccess: () => {
        setIsEditing(false);
        dispatch(addToast({ type: 'success', message: t('profile.saved') }));
      },
      onError: (error) => {
        const apiError = error as ApiError;
        if (apiError.statusCode === 409) {
          if (apiError.message.toLowerCase().includes('email')) {
            setErrors({ email: t('profile.validation.emailInvalid') });
          }
          return;
        }
        dispatch(addToast({ type: 'error', message: getApiErrorMessage(error, t('profile.saveError')) }));
      },
    });
  };

  const handleCancel = () => {
    setName(displayName);
    setEmail(displayEmail);
    setErrors({});
    setIsEditing(false);
  };

  return (
    <Card padding="lg">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-cairo text-lg font-bold text-text-primary">
          {t('profile.personalInfo')}
        </h2>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="font-cairo text-sm font-medium text-accent transition-colors hover:text-accent/80"
          >
            {t('profile.edit')}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={updateProfile.isPending}
            >
              {t('profile.cancel')}
            </Button>
            <Button
              size="sm"
              loading={updateProfile.isPending}
              onClick={handleSave}
            >
              {t('profile.save')}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block font-cairo text-xs font-medium uppercase tracking-wide text-text-secondary">
            {t('profile.fullName')}
          </label>
          {isEditing ? (
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, fullName: '' })); }}
              error={errors.fullName}
              icon={<User size={16} />}
            />
          ) : (
            <p className="font-cairo text-base font-semibold text-text-primary">{displayName}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block font-cairo text-xs font-medium uppercase tracking-wide text-text-secondary">
            {t('profile.email')}
          </label>
          {isEditing ? (
            <Input
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: '' })); }}
              error={errors.email}
              icon={<Mail size={16} />}
              dir="ltr"
            />
          ) : (
            <p className={`font-cairo text-base font-semibold text-text-primary ${ltrAlign}`} dir="ltr">{displayEmail}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block font-cairo text-xs font-medium uppercase tracking-wide text-text-secondary">
            {t('profile.phone')}
          </label>
          <p className={`font-cairo text-base font-semibold text-text-primary ${ltrAlign}`} dir="ltr">{displayPhone}</p>
        </div>
      </div>
    </Card>
  );
}

function ProfileSummaryCard() {
  const { t, i18n } = useTranslation('student');
  const studentUser = useAppSelector((state) => state.student.profile?.user);
  const authUser = useAppSelector((state) => state.auth.user);
  const profileUser = studentUser ?? authUser;

  const displayName = profileUser?.fullName ?? '';
  const displayEmail = profileUser?.email ?? '';
  const displayPhone = profileUser?.mobile ?? '';
  const createdAt = profileUser?.createdAt ?? '';
  const initial =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join('') || '?';

  return (
    <Card padding="lg" className="flex flex-col items-center">
      <div className="relative mb-3">
        <Avatar name={displayName} size="lg" className="h-20 w-20 text-xl" />
        <span className="absolute bottom-0 end-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-success" />
      </div>
      <h3 className="font-cairo text-lg font-bold text-text-primary">{displayName}</h3>
      <Badge variant="success" className="mt-2">
        {t('profile.active')}
      </Badge>

      <div className="my-4 w-full border-t border-border" />

      <div className="flex w-full flex-col gap-3">
        <InfoRow icon={Mail} label={t('profile.email')} value={displayEmail} ltr />
        <InfoRow icon={Phone} label={t('profile.phone')} value={displayPhone} ltr />
        {createdAt && (
          <InfoRow
            icon={Calendar}
            label={t('profile.joinedAt')}
            value={formatDate(createdAt, i18n.language === 'ar' ? 'ar-EG' : 'en')}
          />
        )}
      </div>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value, ltr }: { icon: typeof Mail; label: string; value: string; ltr?: boolean }) {
  const { i18n } = useTranslation('student');
  const align = ltr ? (i18n.language === 'ar' ? 'text-end' : 'text-start') : '';
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-text-secondary">
        <Icon size={16} />
        <span className="font-cairo text-xs">{label}</span>
      </div>
      <span className={`font-cairo text-sm font-medium text-text-primary ${align}`} dir={ltr ? 'ltr' : undefined}>
        {value}
      </span>
    </div>
  );
}

function AccountInfoCard() {
  const { t, i18n } = useTranslation('student');
  const studentUser = useAppSelector((state) => state.student.profile?.user);
  const authUser = useAppSelector((state) => state.auth.user);
  const profileUser = studentUser ?? authUser;

  const createdAt = profileUser?.createdAt ?? '';
  const joinedDate = createdAt
    ? formatDate(createdAt, i18n.language === 'ar' ? 'ar-EG' : 'en')
    : '—';

  return (
    <Card padding="lg">
      <h2 className="mb-5 font-cairo text-lg font-bold text-text-primary">
        {t('profile.accountInfo')}
      </h2>
      <div className="flex flex-col gap-4">
        <AccountRow icon={Calendar} label={t('profile.joinedAt')} value={joinedDate} />
        <AccountRow icon={Briefcase} label={t('profile.accountType')} value={t('profile.topStudent')} />
        <AccountRow
          icon={Shield}
          label={t('profile.accountStatus')}
          value={t('profile.verified')}
          valueBadge
        />
      </div>
    </Card>
  );
}

function AccountRow({ icon: Icon, label, value, valueBadge }: { icon: typeof Calendar; label: string; value: string; valueBadge?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
        <Icon size={16} className="text-accent" />
      </span>
      <div className="flex flex-1 items-center justify-between">
        <span className="font-cairo text-sm text-text-secondary">{label}</span>
        {valueBadge ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 font-cairo text-xs font-medium text-success">
            <CheckCircle size={12} />
            {value}
          </span>
        ) : (
          <span className="font-cairo text-sm font-medium text-text-primary">{value}</span>
        )}
      </div>
    </div>
  );
}

function SecurityCard() {
  const { t } = useTranslation('student');
  const dispatch = useAppDispatch();
  const changePassword = useChangePassword();

  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearErrors = () => setErrors({});

  const handleChangePassword = () => {
    clearErrors();
    const payload = { currentPassword, newPassword, confirmPassword };
    const parsed = createChangePasswordSchema(t).safeParse(payload);
    if (!parsed.success) {
      setErrors(zodToFieldErrors(parsed.error));
      return;
    }
    changePassword.mutate(parsed.data, {
      onSuccess: () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setIsOpen(false);
        dispatch(addToast({ type: 'success', message: t('profile.passwordChanged') }));
      },
      onError: (error) => {
        const apiError = error as ApiError;
        if (apiError.statusCode === 401) {
          setErrors({ currentPassword: t('profile.validation.passwordRequired') });
          return;
        }
        dispatch(addToast({ type: 'error', message: getApiErrorMessage(error, t('profile.passwordError')) }));
      },
    });
  };

  return (
    <Card padding="lg">
      <h2 className="mb-4 font-cairo text-lg font-bold text-text-primary">
        {t('profile.security')}
      </h2>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 rounded-button bg-surface p-4 shadow-sm transition-colors hover:bg-gray-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
          <Lock size={16} className="text-accent" />
        </span>
        <span className="flex-1 text-start font-cairo text-sm font-medium text-text-primary">
          {t('profile.changePassword')}
        </span>
        <ChevronLeft
          size={18}
          className={`text-text-secondary transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="mt-4 flex flex-col gap-4">
          <Input
            type="password"
            label={t('profile.currentPassword')}
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setErrors((prev) => ({ ...prev, currentPassword: '' })); }}
            error={errors.currentPassword}
          />
          <Input
            type="password"
            label={t('profile.newPassword')}
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setErrors((prev) => ({ ...prev, newPassword: '' })); }}
            error={errors.newPassword}
          />
          <Input
            type="password"
            label={t('profile.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setErrors((prev) => ({ ...prev, confirmPassword: '' })); }}
            error={errors.confirmPassword}
          />
          <Button
            className="self-start"
            size="sm"
            loading={changePassword.isPending}
            onClick={handleChangePassword}
          >
            {t('profile.save')}
          </Button>
        </div>
      )}

      <button
        type="button"
        className="mt-3 flex w-full items-center gap-3 rounded-button bg-surface p-4 shadow-sm transition-colors hover:bg-red-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10">
          <LogOut size={16} className="text-danger" />
        </span>
        <span className="flex-1 text-start font-cairo text-sm font-medium text-danger">
          {t('profile.logout')}
        </span>
        <ChevronLeft size={18} className="text-danger" />
      </button>
    </Card>
  );
}

function PreferencesCard() {
  const { t, i18n } = useTranslation('student');
  const [notificationsOn, setNotificationsOn] = useState(true);

  const toggleLanguage = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
  };

  return (
    <Card padding="lg">
      <h2 className="mb-5 font-cairo text-lg font-bold text-text-primary">
        {t('profile.preferences')}
      </h2>

      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <Globe size={16} className="text-accent" />
            </span>
            <div>
              <p className="font-cairo text-sm font-medium text-text-primary">
                {t('profile.language')}
              </p>
              <p className="font-cairo text-xs text-text-secondary">
                {t('profile.languageSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-2 rounded-button border border-border bg-surface px-3 py-2 font-cairo text-sm text-text-primary transition-colors hover:bg-gray-50"
          >
            <Globe size={14} className="text-text-secondary" />
            <span>{i18n.language === 'ar' ? 'العربية' : 'English'}</span>
            <ChevronLeft size={14} className="text-text-secondary" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <Bell size={16} className="text-accent" />
            </span>
            <div>
              <p className="font-cairo text-sm font-medium text-text-primary">
                {t('profile.notifications')}
              </p>
              <p className="font-cairo text-xs text-text-secondary">
                {t('profile.notificationsSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsOn}
            onClick={() => setNotificationsOn(!notificationsOn)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${notificationsOn ? 'bg-teal-400' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${notificationsOn ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>
    </Card>
  );
}

function EnrollmentHistoryCard() {
  const { t, i18n } = useTranslation('student');
  const { data: enrollments, isLoading, isError } = useStudentEnrollments();

  if (isLoading) {
    return (
      <Card padding="lg">
        <Skeleton className="mb-4 h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-2 h-10 w-full" />
        <Skeleton className="mt-2 h-10 w-full" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card padding="lg">
        <p className="font-cairo text-sm text-danger">{t('profile.enrollmentLoadError')}</p>
      </Card>
    );
  }

  if (!enrollments || enrollments.length === 0) {
    return (
      <Card padding="lg">
        <h2 className="mb-4 font-cairo text-lg font-bold text-text-primary">
          {t('profile.enrollmentHistory')}
        </h2>
        <EmptyState
          icon={BookOpen}
          title={t('profile.noEnrollments')}
          description={t('profile.noEnrollmentsDesc')}
        />
      </Card>
    );
  }

  const monthNames = i18n.language === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <Card padding="lg">
      <h2 className="mb-4 font-cairo text-lg font-bold text-text-primary">
        {t('profile.enrollmentHistory')}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <Th>{t('profile.chapterName')}</Th>
              <Th>{t('profile.month')}</Th>
              <Th>{t('profile.year')}</Th>
              <Th>{t('profile.status')}</Th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enr) => (
              <tr key={enr.id} className="border-b border-border last:border-b-0">
                <Td>{enr.chapterName}</Td>
                <Td>{monthNames[parseInt(enr.month) - 1] || enr.month}</Td>
                <Td>{enr.year}</Td>
                <Td>
                  <Badge variant={enr.status === 'Active' ? 'success' : 'default'}>
                    {enr.status === 'Active' ? t('profile.activeStatus') : t('profile.inactiveStatus')}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children }: { children: string }) {
  return (
    <th className="px-4 py-3 text-start font-cairo text-sm font-medium text-text-secondary">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-3 font-cairo text-sm text-text-primary">
      {children}
    </td>
  );
}
