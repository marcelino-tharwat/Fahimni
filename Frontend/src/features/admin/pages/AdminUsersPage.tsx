import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import {
  Search, Users, X, AlertCircle, ChevronLeft, UserCog,
  GraduationCap, BookOpen, FileText, Activity, Clock,
  Plus, Edit, Ban, CheckCircle, XCircle, Shield, UserCheck,
  Calendar, Copy, Check, KeyRound,
} from 'lucide-react';
import { Spinner, Badge, EmptyState } from '@/shared/components/ui';
import { Button } from '@/shared/components/ui/Button';
import { Card } from '@/shared/components/ui/Card';
import { cn } from '@/shared/lib/utils/cn';
import { Pagination } from '../components/promo-codes';
import {
  useAdminUsers,
  useAdminUserDetail,
  useCreateUser,
  useUpdateUser,
  useChangeUserStatus,
  useChangeUserRole,
  useResetUserPassword,
} from '@/features/admin/hooks/useAdminUsers';
import { AdminUserModals, type ModalMode } from '@/features/admin/components/users/AdminUserModals';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import type {
  AdminUserListItem,
  AdminUsersQuery,
  UserRole,
  UserStatus,
  TeacherApprovalState,
  AdminUserDetailResponse,
  AdminUserIdentity,
  AdminCreateUserPayload,
  AdminUpdateUserPayload,
  AdminChangeStatusPayload,
  AdminChangeRolePayload,
  AdminResetPasswordPayload,
} from '@/features/admin/types/users';

const PAGE_SIZE = 20;

const statusVariant: Record<UserStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  BANNED: 'danger',
};

const roleBadgeVariant: Record<UserRole, 'info' | 'cyan' | 'default'> = {
  ADMIN: 'info',
  OPERATION: 'cyan',
  STUDENT: 'default',
};

const teacherApprovalVariant: Record<TeacherApprovalState, 'warning' | 'success' | 'danger' | 'default'> = {
  NONE: 'default',
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function statusBadge(status: UserStatus) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}

function roleBadge(role: UserRole) {
  return <Badge variant={roleBadgeVariant[role]}>{role}</Badge>;
}

export function AdminUsersPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [teacherApprovalFilter, setTeacherApprovalFilter] = useState<TeacherApprovalState | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalUser, setModalUser] = useState<AdminUserIdentity | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const statusMutation = useChangeUserStatus();
  const roleMutation = useChangeUserRole();
  const resetPasswordMutation = useResetUserPassword();

  useEffect(() => {
    const id = setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useMemo(() => {
    const qq: AdminUsersQuery = { page, limit: PAGE_SIZE };
    if (q) qq.q = q;
    if (roleFilter) qq.role = roleFilter;
    if (statusFilter) qq.status = statusFilter;
    if (teacherApprovalFilter) qq.teacherApprovalState = teacherApprovalFilter;
    return qq;
  }, [page, q, roleFilter, statusFilter, teacherApprovalFilter]);

  const { data, isLoading, isError, refetch, isFetching } = useAdminUsers(query);

  const users = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 0;
  const isEmpty = !isLoading && users.length === 0;

  const openModal = useCallback((mode: ModalMode, user: AdminUserIdentity | null = null) => {
    setModalMode(mode);
    setModalUser(user);
    setSubmitError(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setModalUser(null);
    setSubmitError(null);
  }, []);

  const currentAdminId = currentUser?.id ?? '';

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    setSubmitError(null);
    try {
      if (modalMode === 'create') {
        await createMutation.mutateAsync(data as unknown as AdminCreateUserPayload);
        dispatch(addToast({ type: 'success', message: t('adminUsers.userCreated', 'User created successfully') }));
      } else if (modalMode === 'edit' && selectedId) {
        await updateMutation.mutateAsync({ userId: selectedId, payload: data as unknown as AdminUpdateUserPayload });
        dispatch(addToast({ type: 'success', message: t('adminUsers.userUpdated', 'User updated successfully') }));
      } else if ((modalMode === 'ban' || modalMode === 'unban' || modalMode === 'activate' || modalMode === 'deactivate') && selectedId) {
        const payload = { status: modalMode === 'ban' ? 'BANNED' as const : modalMode === 'activate' ? 'ACTIVE' as const : 'INACTIVE' as const } as { status: UserStatus; reason?: string };
        if (data.reason) payload.reason = data.reason as string;
        await statusMutation.mutateAsync({ userId: selectedId, payload: payload as AdminChangeStatusPayload });
        const msgKey = modalMode === 'ban' ? 'adminUsers.userBanned' : modalMode === 'unban' ? 'adminUsers.userUnbanned' : modalMode === 'activate' ? 'adminUsers.userActivated' : 'adminUsers.userDeactivated';
        dispatch(addToast({ type: 'success', message: t(msgKey, 'User status changed successfully') }));
      } else if (modalMode === 'change-role' && selectedId) {
        await roleMutation.mutateAsync({ userId: selectedId, payload: data as unknown as AdminChangeRolePayload });
        dispatch(addToast({ type: 'success', message: t('adminUsers.roleChanged', 'Role changed successfully') }));
      } else if (modalMode === 'reset-password' && selectedId) {
        await resetPasswordMutation.mutateAsync({ userId: selectedId, payload: data as unknown as AdminResetPasswordPayload });
        dispatch(addToast({ type: 'success', message: t('adminUsers.passwordResetSuccess', 'Password reset successfully') }));
      }
      closeModal();
    } catch (err) {
      setSubmitError(translateApiError(t, err));
    }
  }, [modalMode, selectedId, createMutation, updateMutation, statusMutation, roleMutation, closeModal, t, dispatch]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending || statusMutation.isPending || roleMutation.isPending || resetPasswordMutation.isPending;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('adminUsers.title', 'Users')}</h1>
          <p className="mt-1 font-cairo text-sm text-text-secondary">{t('adminUsers.subtitle', 'Manage all platform users')}</p>
        </div>
        <Button onClick={() => openModal('create')} className="flex items-center gap-2 bg-cyan-gradient text-white shadow-glow transition-all duration-150 active:scale-[0.97] hover:opacity-90">
          <Plus size={16} />
          {t('adminUsers.createUser', 'Create User')}
        </Button>
      </div>

      {/* Search + Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute inset-y-0 my-auto text-text-muted ltr:left-3 rtl:right-3" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('adminUsers.searchPlaceholder', 'Search by name, email, or mobile')}
            aria-label={t('adminUsers.searchPlaceholder', 'Search by name, email, or mobile')}
            className="h-10 w-full rounded-btn border border-border bg-surface font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as UserRole | ''); setPage(1); }}
          aria-label={t('adminUsers.filterRole', 'Role')}
          className="h-10 min-w-[130px] rounded-input border border-border bg-surface px-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent"
        >
          <option value="">{t('adminUsers.roleAll', 'All Roles')}</option>
          <option value="ADMIN">{t('roles.ADMIN', 'Admin')}</option>
          <option value="OPERATION">{t('roles.OPERATION', 'Teacher')}</option>
          <option value="STUDENT">{t('roles.STUDENT', 'Student')}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as UserStatus | ''); setPage(1); }}
          aria-label={t('adminUsers.filterStatus', 'Status')}
          className="h-10 min-w-[130px] rounded-input border border-border bg-surface px-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent"
        >
          <option value="">{t('adminUsers.statusAll', 'All Statuses')}</option>
          <option value="ACTIVE">{t('adminUsers.status.ACTIVE', 'Active')}</option>
          <option value="INACTIVE">{t('adminUsers.status.INACTIVE', 'Inactive')}</option>
          <option value="BANNED">{t('adminUsers.status.BANNED', 'Banned')}</option>
        </select>

        <select
          value={teacherApprovalFilter}
          onChange={(e) => { setTeacherApprovalFilter(e.target.value as TeacherApprovalState | ''); setPage(1); }}
          aria-label={t('adminUsers.filterTeacherApproval', 'Teacher Approval')}
          className="h-10 min-w-[150px] rounded-input border border-border bg-surface px-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent"
        >
          <option value="">{t('adminUsers.teacherApprovalAll', 'All Teacher States')}</option>
          <option value="NONE">{t('adminUsers.teacherApproval.NONE', 'None')}</option>
          <option value="PENDING_REVIEW">{t('adminUsers.teacherApproval.PENDING_REVIEW', 'Pending Review')}</option>
          <option value="APPROVED">{t('adminUsers.teacherApproval.APPROVED', 'Approved')}</option>
          <option value="REJECTED">{t('adminUsers.teacherApproval.REJECTED', 'Rejected')}</option>
        </select>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-16 text-center shadow-card">
          <AlertCircle size={48} className="text-danger" />
          <p className="font-cairo text-text-secondary">{t('adminUsers.errorLoading', 'Failed to load users')}</p>
          <button type="button" onClick={() => refetch()} className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100">
            {t('adminUsers.retry', 'Retry')}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          {isLoading ? (
            <div className="flex flex-col divide-y divide-border/50" role="status" aria-label={t('common:status.loading', 'Loading...')}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-4 py-3.5">
                  <div className="size-9 rounded-full bg-gray-200" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="h-3.5 w-44 rounded-full bg-gray-200" />
                    <div className="h-2.5 w-28 rounded-full bg-gray-100" />
                  </div>
                  <div className="h-5 w-14 rounded-full bg-gray-200" />
                  <div className="h-5 w-14 rounded-full bg-gray-200" />
                  <div className="h-2.5 w-16 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <div className="py-12">
              <EmptyState icon={Users} title={t('adminUsers.emptyTitle', 'No users found')} description={t('adminUsers.emptyDescription', 'No users matched your search or filters')} />
            </div>
          ) : (
            <div className="overflow-x-auto" aria-busy={isFetching}>
              <table className="w-full min-w-[900px] text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-text-secondary">
                    <th className="px-4 py-3 text-start font-medium">{t('adminUsers.col.user', 'User')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminUsers.col.role', 'Role')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminUsers.col.status', 'Status')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminUsers.col.teacherApproval', 'Teacher Approval')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminUsers.col.profiles', 'Profiles')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminUsers.col.createdAt', 'Created')}</th>
                    <th className="px-4 py-3 text-end font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} onView={() => setSelectedId(u.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isEmpty && !isLoading && totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} isLoading={isFetching} />
          )}
        </div>
      )}

      {!isLoading && !isError && total > 0 && (
        <div className="flex items-center gap-1.5 font-cairo text-xs text-text-muted">
          <Users size={13} />
          <span>{t('adminUsers.totalCount', '{{count}} users', { count: total })}</span>
        </div>
      )}

      {selectedId && (
        <UserDetailDrawer
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onAction={(mode, user) => {
            openModal(mode, user);
          }}
          currentAdminId={currentAdminId}
        />
      )}

      <AdminUserModals
        mode={modalMode}
        onClose={closeModal}
        selectedUser={modalUser}
        currentAdminId={currentAdminId}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={submitError}
      />
    </div>
  );
}

function UserRow({
  user, onView,
}: {
  user: AdminUserListItem;
  onView: () => void;
}) {
  const { t, i18n } = useTranslation();
  const created = new Date(user.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
  const profiles: string[] = [];
  if (user.profiles.student) profiles.push(t('adminUsers.profile.student', 'Student'));
  if (user.profiles.teacher) profiles.push(t('adminUsers.profile.teacher', 'Teacher'));

  return (
    <tr className="border-b border-border/50 last:border-0 transition-colors hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 font-cairo text-xs font-bold text-accent">
            {initials(user.fullName)}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-cairo font-semibold text-text-primary">{user.fullName}</span>
            <span className="truncate font-cairo text-xs text-text-secondary">{user.email ?? user.mobile}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">{roleBadge(user.role)}</td>
      <td className="px-4 py-3">{statusBadge(user.status)}</td>
      <td className="px-4 py-3">
        <Badge variant={teacherApprovalVariant[user.teacherApprovalState]}>{user.teacherApprovalState}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          {profiles.length === 0 ? (
            <span className="font-cairo text-xs text-text-muted">—</span>
          ) : (
            profiles.map((p) => (
              <Badge key={p} variant="default">{p}</Badge>
            ))
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-cairo text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} className="text-text-muted" />
          {created}
        </span>
      </td>
      <td className="px-4 py-3 text-end">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-btn px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10"
        >
          {t('adminUsers.viewDetails', 'View details')}
          <ChevronLeft size={14} className="rtl:rotate-180" />
        </button>
      </td>
    </tr>
  );
}

function UserDetailDrawer({
  userId, onClose, onAction, currentAdminId,
}: {
  userId: string;
  onClose: () => void;
  onAction: (mode: ModalMode, user: AdminUserIdentity) => void;
  currentAdminId: string;
}) {
  const { t, i18n } = useTranslation();
  const nf = (n: number) => n.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
  const detail = useAdminUserDetail(userId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full max-w-lg flex-col gap-4 overflow-y-auto bg-background p-5 shadow-elevated" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between">
          <h2 className="font-cairo text-lg font-bold text-text-primary">{t('adminUsers.detail.title', 'User Details')}</h2>
          <button type="button" onClick={onClose} aria-label={t('adminUsers.detail.close', 'Close')} className="rounded-btn p-1.5 text-text-muted hover:bg-gray-100 hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {detail.isLoading ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label={t('common:status.loading', 'Loading...')}><Spinner /></div>
        ) : detail.isError || !detail.data ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle size={40} className="text-danger" />
            <p className="font-cairo text-text-secondary">{t('adminUsers.detail.error', 'Failed to load user data')}</p>
            <button type="button" onClick={() => detail.refetch()} className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary hover:bg-gray-100">
              {t('adminUsers.retry', 'Retry')}
            </button>
          </div>
        ) : (
          <DetailContent data={detail.data} nf={nf} t={t} locale={i18n.language} onAction={onAction} currentAdminId={currentAdminId} />
        )}
      </div>
    </div>
  );
}

function DetailContent({
  data, nf, t, locale, onAction, currentAdminId,
}: {
  data: AdminUserDetailResponse;
  nf: (n: number) => string;
  t: TFunction;
  locale: string;
  onAction: (mode: ModalMode, user: AdminUserIdentity) => void;
  currentAdminId: string;
}) {
  const { user, studentProfile, teacherProfile, counts, recentAuditLogs } = data;

  const navigate = useNavigate();
  const isSelf = user.id === currentAdminId;
  const canEdit = !isSelf;
  const canBan = !isSelf && user.status !== 'BANNED';
  const canUnban = !isSelf && user.status === 'BANNED';
  const canActivate = !isSelf && user.status === 'INACTIVE';
  const canDeactivate = !isSelf && user.status === 'ACTIVE';
  const canChangeRole = !isSelf;

  return (
    <div className="flex flex-col gap-4">
      {/* Identity Card */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 font-cairo text-base font-bold text-accent">
            {initials(user.fullName)}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-cairo text-base font-bold text-text-primary">{user.fullName}</span>
              <Badge variant={statusVariant[user.status]}>{t(`adminUsers.status.${user.status}`, user.status)}</Badge>
              {roleBadge(user.role)}
            </div>
            <p className="truncate font-cairo text-sm text-text-secondary">
              {user.email ?? '—'} <span className="text-text-muted">·</span> {user.mobile}
            </p>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>{t('adminUsers.col.id', 'ID')}:</span>
              <CopyId id={user.id} />
            </div>
            {user.teacherApprovalState !== 'NONE' && (
              <div className="flex flex-wrap gap-1">
                <Badge variant={teacherApprovalVariant[user.teacherApprovalState]}>
                  {user.teacherApprovalState}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Action buttons */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Constructive actions */}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => onAction('edit', user)} className="flex items-center gap-1">
              <Edit size={14} />
              {t('adminUsers.edit', 'Edit')}
            </Button>
          )}
          {canChangeRole && (
            <Button size="sm" variant="outline" onClick={() => onAction('change-role', user)} className="flex items-center gap-1">
              <Shield size={14} />
              {t('adminUsers.changeRole', 'Change Role')}
            </Button>
          )}
          {!isSelf && (
            <Button size="sm" variant="outline" onClick={() => onAction('reset-password', user)} className="flex items-center gap-1">
              <KeyRound size={14} />
              {t('adminUsers.resetPassword', 'Reset Password')}
            </Button>
          )}

          {/* Separator */}
          {(canEdit || canChangeRole || !isSelf) && (canBan || canUnban || canActivate || canDeactivate) && (
            <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          )}

          {/* Moderation actions */}
          {canActivate && (
            <Button size="sm" variant="outline" onClick={() => onAction('activate', user)} className="flex items-center gap-1 border-success/30 text-success hover:bg-success/10">
              <CheckCircle size={14} />
              {t('adminUsers.activate', 'Activate')}
            </Button>
          )}
          {canUnban && (
            <Button size="sm" variant="outline" onClick={() => onAction('unban', user)} className="flex items-center gap-1 border-success/30 text-success hover:bg-success/10">
              <UserCheck size={14} />
              {t('adminUsers.unban', 'Unban')}
            </Button>
          )}
          {canDeactivate && (
            <Button size="sm" variant="danger" onClick={() => onAction('deactivate', user)} className="flex items-center gap-1">
              <XCircle size={14} />
              {t('adminUsers.deactivate', 'Deactivate')}
            </Button>
          )}
          {canBan && (
            <Button size="sm" variant="danger" onClick={() => onAction('ban', user)} className="flex items-center gap-1">
              <Ban size={14} />
              {t('adminUsers.ban', 'Ban')}
            </Button>
          )}
        </div>
      </Card>

      {/* Profile details */}
      {studentProfile && (
        <Card>
          <h3 className="mb-2 font-cairo text-sm font-semibold text-text-primary">{t('adminUsers.detail.studentProfile', 'Student Profile')}</h3>
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 font-cairo text-sm text-text-secondary">
              <span className="text-text-muted">{t('adminUsers.detail.studentProfileId', 'Profile ID')}:</span>
              <CopyId id={studentProfile.id} />
            </p>
            {studentProfile.stageId && (
              <p className="flex items-center gap-2 font-cairo text-sm text-text-secondary">
                <span className="text-text-muted">{t('adminUsers.detail.stageId', 'Stage')}:</span>
                <CopyId id={studentProfile.stageId} />
              </p>
            )}
          </div>
        </Card>
      )}

      {teacherProfile && (
        <Card>
          <h3 className="mb-2 font-cairo text-sm font-semibold text-text-primary">{t('adminUsers.detail.teacherProfile', 'Teacher Profile')}</h3>
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 font-cairo text-sm text-text-secondary">
              <span className="text-text-muted">{t('adminUsers.detail.studentProfileId', 'Profile ID')}:</span>
              <CopyId id={teacherProfile.id} />
            </p>
            {teacherProfile.subject && (
              <p className="font-cairo text-sm text-text-secondary">
                <span className="text-text-muted">{t('adminUsers.detail.subject', 'Subject')}:</span> {teacherProfile.subject}
              </p>
            )}
            {teacherProfile.photoUrl && (
              <p className="font-cairo text-sm text-text-secondary">{t('adminUsers.detail.hasPhoto', 'Has photo')}</p>
            )}
          </div>
        </Card>
      )}

      {/* Counts */}
      <Card>
        <h3 className="mb-3 font-cairo text-sm font-semibold text-text-primary">{t('adminUsers.detail.counts', 'Counts')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <CountCard icon={BookOpen} label={t('adminUsers.detail.enrollments', 'Enrollments')} value={nf(counts.enrollmentsCount)} onClick={() => navigate(`/admin/students?userId=${user.id}`)} />
          <CountCard icon={Activity} label={t('adminUsers.detail.quizAttempts', 'Quiz Attempts')} value={nf(counts.quizAttemptsCount)} onClick={() => navigate(`/admin/students?userId=${user.id}`)} />
          <CountCard icon={FileText} label={t('adminUsers.detail.payments', 'Payments')} value={nf(counts.paymentTransactionsCount)} onClick={() => navigate(`/admin/students?userId=${user.id}`)} />
          {counts.teacherStagesCount > 0 && (
            <CountCard icon={GraduationCap} label={t('adminUsers.detail.stages', 'Stages')} value={nf(counts.teacherStagesCount)} />
          )}
          {counts.teacherSubscriptionsCount > 0 && (
            <CountCard icon={UserCog} label={t('adminUsers.detail.subscriptions', 'Subscriptions')} value={nf(counts.teacherSubscriptionsCount)} />
          )}
        </div>
      </Card>

      {/* Audit Logs */}
      {recentAuditLogs.length > 0 && (
        <Card>
          <h3 className="mb-3 font-cairo text-sm font-semibold text-text-primary">{t('adminUsers.detail.recentAuditLogs', 'Recent Activity')}</h3>
          <div className="flex flex-col gap-1.5">
            {recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-2.5 rounded-card border border-border bg-surface p-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <Clock size={14} className="text-accent" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-cairo text-xs font-medium text-text-primary">{log.action}</span>
                  <span className="font-cairo text-xs text-text-muted">
                    {new Date(log.createdAt).toLocaleString(locale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function CopyId({ id }: { id: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, [id]);

  const shortId = id.length > 12 ? `${id.slice(0, 8)}...` : id;

  return (
    <span className="inline-flex items-center gap-1">
      <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-text-secondary">{shortId}</code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t('adminUsers.copyId', 'Copy ID')}
        className="rounded p-0.5 text-text-muted transition-colors hover:text-accent"
      >
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      </button>
    </span>
  );
}

function CountCard({ icon: Icon, label, value, onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; onClick?: () => void }) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-card border border-border bg-surface p-3',
        onClick && 'cursor-pointer transition-all hover:shadow-elevated hover:-translate-y-0.5',
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-card bg-accent/10">
        <Icon size={16} className="text-accent" />
      </div>
      <div className="flex flex-col text-start">
        <span className="font-cairo text-xs text-text-secondary">{label}</span>
        <span className="font-cairo text-sm font-semibold text-text-primary">{value}</span>
      </div>
    </Component>
  );
}
