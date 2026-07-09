import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  Search, Users, X, AlertCircle, ChevronLeft, UserCog,
  GraduationCap, BookOpen, FileText, Activity, Clock,
} from 'lucide-react';
import { Spinner, Badge, EmptyState } from '@/shared/components/ui';
import { Pagination } from '../components/promo-codes';
import {
  useAdminUsers,
  useAdminUserDetail,
} from '@/features/admin/hooks/useAdminUsers';
import type {
  AdminUserListItem,
  AdminUsersQuery,
  UserRole,
  UserStatus,
  TeacherApprovalState,
  AdminUserDetailResponse,
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

function statusBadge(status: UserStatus) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}

function roleBadge(role: UserRole) {
  return <Badge variant={roleBadgeVariant[role]}>{role}</Badge>;
}

export function AdminUsersPage() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [teacherApprovalFilter, setTeacherApprovalFilter] = useState<TeacherApprovalState | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('adminUsers.title', 'Users')}</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">{t('adminUsers.subtitle', 'Manage all platform users')}</p>
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
          className="h-10 rounded-btn border border-border bg-surface px-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent"
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
          className="h-10 rounded-btn border border-border bg-surface px-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent"
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
          className="h-10 rounded-btn border border-border bg-surface px-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent"
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
            <div className="flex items-center justify-center py-20" role="status" aria-label={t('common:status.loading', 'Loading...')}>
              <Spinner />
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
        <p className="font-cairo text-xs text-text-muted">{t('adminUsers.totalCount', '{{count}} users', { count: total })}</p>
      )}

      {selectedId && <UserDetailDrawer userId={selectedId} onClose={() => setSelectedId(null)} />}
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
    <tr className="border-b border-border/50 last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-cairo font-semibold text-text-primary">{user.fullName}</span>
          <span className="font-cairo text-xs text-text-secondary">{user.email ?? user.mobile}</span>
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
      <td className="px-4 py-3 font-cairo text-text-secondary">{created}</td>
      <td className="px-4 py-3 text-end">
        <button type="button" onClick={onView} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline">
          {t('adminUsers.viewDetails', 'View details')}
          <ChevronLeft size={14} className="rtl:rotate-180" />
        </button>
      </td>
    </tr>
  );
}

function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const nf = (n: number) => n.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
  const detail = useAdminUserDetail(userId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full max-w-lg flex-col gap-4 overflow-y-auto bg-background p-5 shadow-elevated" dir="rtl">
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
          <DetailContent data={detail.data} nf={nf} t={t} locale={i18n.language} />
        )}
      </div>
    </div>
  );
}

function DetailContent({
  data, nf, t, locale,
}: {
  data: AdminUserDetailResponse;
  nf: (n: number) => string;
  t: TFunction;
  locale: string;
}) {
  const { user, studentProfile, teacherProfile, counts, recentAuditLogs } = data;
  const profiles: string[] = [];
  if (user.profiles.student) profiles.push(t('adminUsers.profile.student', 'Student'));
  if (user.profiles.teacher) profiles.push(t('adminUsers.profile.teacher', 'Teacher'));

  return (
    <>
      {/* Identity */}
      <div className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="font-cairo text-base font-bold text-text-primary">{user.fullName}</span>
          <Badge variant={statusVariant[user.status]}>{t(`adminUsers.status.${user.status}`, user.status)}</Badge>
          {roleBadge(user.role)}
        </div>
        <p className="mt-1 font-cairo text-sm text-text-secondary">
          {user.email ?? '—'} · {user.mobile}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-cairo text-xs text-text-muted">{t('adminUsers.col.id', 'ID')}:</span>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-text-secondary">{user.id}</code>
        </div>
        <div className="mt-1 flex items-center gap-1">
          {profiles.map((p) => (
            <Badge key={p} variant="default">{p}</Badge>
          ))}
          {user.teacherApprovalState !== 'NONE' && (
            <Badge variant={teacherApprovalVariant[user.teacherApprovalState]}>
              {user.teacherApprovalState}
            </Badge>
          )}
        </div>
      </div>

      {/* Profile details */}
      {studentProfile && (
        <Section title={t('adminUsers.detail.studentProfile', 'Student Profile')}>
          <p className="font-cairo text-sm text-text-secondary">
            {t('adminUsers.detail.studentProfileId', 'Profile ID')}: {studentProfile.id}
            {studentProfile.stageId && <> · {t('adminUsers.detail.stageId', 'Stage')}: {studentProfile.stageId}</>}
          </p>
        </Section>
      )}

      {teacherProfile && (
        <Section title={t('adminUsers.detail.teacherProfile', 'Teacher Profile')}>
          <p className="font-cairo text-sm text-text-secondary">
            {teacherProfile.subject && <>{t('adminUsers.detail.subject', 'Subject')}: {teacherProfile.subject}</>}
            {teacherProfile.photoUrl && <> · {t('adminUsers.detail.hasPhoto', 'Has photo')}</>}
          </p>
        </Section>
      )}

      {/* Counts */}
      <Section title={t('adminUsers.detail.counts', 'Counts')}>
        <div className="grid grid-cols-2 gap-3">
          <CountCard icon={BookOpen} label={t('adminUsers.detail.enrollments', 'Enrollments')} value={nf(counts.enrollmentsCount)} />
          <CountCard icon={Activity} label={t('adminUsers.detail.quizAttempts', 'Quiz Attempts')} value={nf(counts.quizAttemptsCount)} />
          <CountCard icon={FileText} label={t('adminUsers.detail.payments', 'Payments')} value={nf(counts.paymentTransactionsCount)} />
          {counts.teacherStagesCount > 0 && (
            <CountCard icon={GraduationCap} label={t('adminUsers.detail.stages', 'Stages')} value={nf(counts.teacherStagesCount)} />
          )}
          {counts.teacherSubscriptionsCount > 0 && (
            <CountCard icon={UserCog} label={t('adminUsers.detail.subscriptions', 'Subscriptions')} value={nf(counts.teacherSubscriptionsCount)} />
          )}
        </div>
      </Section>

      {/* Audit Logs */}
      {recentAuditLogs.length > 0 && (
        <Section title={t('adminUsers.detail.recentAuditLogs', 'Recent Activity')}>
          <div className="flex flex-col gap-1.5">
            {recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-2 rounded-card border border-border bg-surface p-2.5">
                <Clock size={14} className="shrink-0 text-text-muted" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-cairo text-xs font-medium text-text-primary">{log.action}</span>
                  <span className="font-cairo text-xs text-text-muted">
                    {new Date(log.createdAt).toLocaleString(locale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-cairo text-sm font-semibold text-text-primary">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function CountCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-card border border-border bg-surface p-3">
      <Icon size={18} className="shrink-0 text-text-muted" />
      <div className="flex flex-col">
        <span className="font-cairo text-xs text-text-secondary">{label}</span>
        <span className="font-cairo text-sm font-semibold text-text-primary">{value}</span>
      </div>
    </div>
  );
}
