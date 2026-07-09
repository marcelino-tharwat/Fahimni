import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Input } from '@/shared/components/ui/Input';
import { cn } from '@/shared/lib/utils/cn';
import type { AdminUserIdentity, UserRole, UserStatus } from '@/features/admin/types/users';

export type ModalMode =
  | null
  | 'create'
  | 'edit'
  | 'ban'
  | 'unban'
  | 'activate'
  | 'deactivate'
  | 'change-role';

interface AdminUserModalsProps {
  mode: ModalMode;
  onClose: () => void;
  selectedUser: AdminUserIdentity | null;
  currentAdminId: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}

export function AdminUserModals({
  mode, onClose, selectedUser, currentAdminId, onSubmit, isSubmitting, error,
}: AdminUserModalsProps) {
  const { t } = useTranslation();

  if (mode === 'create') {
    return (
      <CreateUserModal
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    );
  }

  if ((mode === 'edit') && selectedUser) {
    return (
      <EditUserModal
        user={selectedUser}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    );
  }

  if (mode === 'ban' && selectedUser) {
    return (
      <BanUserModal
        user={selectedUser}
        isSelf={selectedUser.id === currentAdminId}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    );
  }

  if (mode === 'unban' && selectedUser) {
    return (
      <ConfirmActionModal
        title={t('adminUsers.unbanTitle', 'Unban User')}
        message={t('adminUsers.unbanConfirm', 'Are you sure you want to unban {{name}}?', { name: selectedUser.fullName })}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    );
  }

  if (mode === 'activate' && selectedUser) {
    return (
      <ConfirmActionModal
        title={t('adminUsers.activateTitle', 'Activate User')}
        message={t('adminUsers.activateConfirm', 'Are you sure you want to activate {{name}}?', { name: selectedUser.fullName })}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    );
  }

  if (mode === 'deactivate' && selectedUser) {
    return (
      <ConfirmActionModal
        title={t('adminUsers.deactivateTitle', 'Deactivate User')}
        message={t('adminUsers.deactivateConfirm', 'Are you sure you want to deactivate {{name}}?', { name: selectedUser.fullName })}
        isDanger
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    );
  }

  if (mode === 'change-role' && selectedUser) {
    return (
      <ChangeRoleModal
        user={selectedUser}
        isSelf={selectedUser.id === currentAdminId}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        error={error}
      />
    );
  }

  return null;
}

function CreateUserModal({
  onClose, onSubmit, isSubmitting, error,
}: {
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('STUDENT');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');

  const handleSubmit = async () => {
    await onSubmit({ fullName, email, mobile, password, role, status });
  };

  return (
    <Modal isOpen onClose={onClose} title={t('adminUsers.createTitle', 'Create User')} size="lg">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('adminUsers.fullName', 'Full Name')} value={fullName} onChange={(e) => setFullName(e.target.value)} className="sm:col-span-2" />
          <Input label={t('adminUsers.email', 'Email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label={t('adminUsers.mobile', 'Mobile')} value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <Input label={t('adminUsers.password', 'Password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-cairo text-sm font-medium text-text-primary">{t('adminUsers.role', 'Role')}</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
              className="h-10 w-full rounded-input border border-border bg-surface px-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent">
              <option value="STUDENT">{t('roles.STUDENT', 'Student')}</option>
              <option value="OPERATION">{t('roles.OPERATION', 'Teacher')}</option>
              <option value="ADMIN">{t('roles.ADMIN', 'Admin')}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-cairo text-sm font-medium text-text-primary">{t('adminUsers.status', 'Status')}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}
              className="h-10 w-full rounded-input border border-border bg-surface px-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent">
              <option value="ACTIVE">{t('adminUsers.status.ACTIVE', 'Active')}</option>
              <option value="INACTIVE">{t('adminUsers.status.INACTIVE', 'Inactive')}</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-card bg-danger/10 p-3 font-cairo text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !fullName || !email || !password}>
            {isSubmitting ? <Spinner /> : t('adminUsers.create', 'Create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditUserModal({
  user, onClose, onSubmit, isSubmitting, error,
}: {
  user: AdminUserIdentity;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email ?? '');
  const [mobile, setMobile] = useState(user.mobile);

  const handleSubmit = async () => {
    const data: Record<string, unknown> = {};
    if (fullName !== user.fullName) data.fullName = fullName;
    if (email !== user.email) data.email = email;
    if (mobile !== user.mobile) data.mobile = mobile;
    await onSubmit(data);
  };

  return (
    <Modal isOpen onClose={onClose} title={t('adminUsers.editTitle', 'Edit User')} size="lg">
      <div className="flex flex-col gap-4">
        <Input label={t('adminUsers.fullName', 'Full Name')} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('adminUsers.email', 'Email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label={t('adminUsers.mobile', 'Mobile')} value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-card bg-danger/10 p-3 font-cairo text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : t('adminUsers.save', 'Save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BanUserModal({
  user, isSelf, onClose, onSubmit, isSubmitting, error,
}: {
  user: AdminUserIdentity;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    const data: Record<string, unknown> = { status: 'BANNED', reason };
    await onSubmit(data);
  };

  return (
    <Modal isOpen onClose={onClose} title={t('adminUsers.banTitle', 'Ban User')} size="md">
      <div className="flex flex-col gap-4">
        {(isSelf || user.role === 'ADMIN') && (
          <div className="flex items-start gap-2.5 rounded-card bg-warning/10 p-3 font-cairo text-sm text-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              {isSelf
                ? t('adminUsers.cannotBanSelf', 'You cannot ban yourself.')
                : t('adminUsers.adminBanWarning', 'This user is an admin. Banning may affect platform operations.')}
            </span>
          </div>
        )}

        <p className="font-cairo text-sm text-text-secondary">
          {t('adminUsers.banConfirm', 'Are you sure you want to ban {{name}}?', { name: user.fullName })}
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="font-cairo text-sm font-medium text-text-primary">{t('adminUsers.banReason', 'Reason')}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            className="h-24 resize-none rounded-input border border-border bg-surface p-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent"
            placeholder={t('adminUsers.banReasonPlaceholder', 'Enter reason for ban...')} />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-card bg-danger/10 p-3 font-cairo text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="danger" onClick={handleSubmit} disabled={isSubmitting || isSelf || !reason}>
            {isSubmitting ? <Spinner /> : t('adminUsers.ban', 'Ban')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmActionModal({
  title, message, isDanger, onClose, onSubmit, isSubmitting, error,
}: {
  title: string;
  message: string;
  isDanger?: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();

  const handleSubmit = async () => {
    await onSubmit({});
  };

  return (
    <Modal isOpen onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={cn(
            'flex size-12 items-center justify-center rounded-full',
            isDanger ? 'bg-danger/10' : 'bg-success/10',
          )}>
            {isDanger ? (
              <AlertTriangle size={24} className="text-danger" />
            ) : (
              <CheckCircle size={24} className="text-success" />
            )}
          </div>
          <p className="font-cairo text-sm text-text-secondary">{message}</p>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-card bg-danger/10 p-3 font-cairo text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant={isDanger ? 'danger' : 'primary'} onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : t('common.confirm', 'Confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ChangeRoleModal({
  user, isSelf, onClose, onSubmit, isSubmitting, error,
}: {
  user: AdminUserIdentity;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const [newRole, setNewRole] = useState<UserRole>(user.role);
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    const data: Record<string, unknown> = { role: newRole };
    if (reason.trim()) data.reason = reason;
    await onSubmit(data);
  };

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'STUDENT', label: t('roles.STUDENT', 'Student') },
    { value: 'OPERATION', label: t('roles.OPERATION', 'Teacher') },
    { value: 'ADMIN', label: t('roles.ADMIN', 'Admin') },
  ];

  return (
    <Modal isOpen onClose={onClose} title={t('adminUsers.changeRoleTitle', 'Change Role')} size="md">
      <div className="flex flex-col gap-4">
        {isSelf && (
          <div className="flex items-start gap-2.5 rounded-card bg-warning/10 p-3 font-cairo text-sm text-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{t('adminUsers.cannotChangeOwnRole', 'You cannot change your own role.')}</span>
          </div>
        )}

        <div className="rounded-card border border-border bg-surface p-3">
          <p className="font-cairo text-xs text-text-muted">{t('adminUsers.currentRole', 'Current role')}</p>
          <p className="mt-0.5 font-cairo text-sm font-semibold text-text-primary">{user.role}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-cairo text-sm font-medium text-text-primary">{t('adminUsers.newRole', 'New Role')}</label>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}
            className="h-10 w-full rounded-input border border-border bg-surface px-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent">
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-cairo text-sm font-medium text-text-primary">{t('adminUsers.changeRoleReason', 'Reason (optional)')}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            className="h-20 resize-none rounded-input border border-border bg-surface p-3 font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent"
            placeholder={t('adminUsers.changeRoleReasonPlaceholder', 'Enter reason for role change...')} />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-card bg-danger/10 p-3 font-cairo text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isSelf || newRole === user.role}>
            {isSubmitting ? <Spinner /> : t('adminUsers.changeRole', 'Change Role')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
