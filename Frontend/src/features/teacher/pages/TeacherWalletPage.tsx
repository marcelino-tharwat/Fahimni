import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  Coins,
  Clock,
  CheckCircle2,
  AlertCircle,
  Landmark,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { Card, Badge, Button } from '@/shared/components/ui';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import {
  useTeacherWallet,
  useTeacherWithdrawals,
  useCancelWithdrawal,
} from '@/features/teacher/hooks/useTeacherWallet';
import { EditPayoutProfileModal } from '@/features/teacher/components/EditPayoutProfileModal';
import { RequestWithdrawalModal } from '@/features/teacher/components/RequestWithdrawalModal';
import type { WithdrawalStatus } from '@/features/teacher/types/wallet';

const withdrawalStatusVariant: Record<
  WithdrawalStatus,
  'success' | 'warning' | 'info' | 'danger' | 'default'
> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  TRANSFERRED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

function MoneyCard({
  icon: Icon,
  label,
  value,
  currency,
  testId,
}: {
  icon: typeof Wallet;
  label: string;
  value: number;
  currency: string;
  testId: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-card border border-border bg-white p-4 shadow-card"
      data-testid={testId}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
        <Icon size={22} />
      </span>
      <div>
        <p className="font-cairo text-xs text-text-secondary">{label}</p>
        <p className="font-cairo text-xl font-bold text-navy-900">
          {Math.round(value).toLocaleString('ar-EG')}{' '}
          <span className="text-xs font-normal text-text-muted">{currency}</span>
        </p>
      </div>
    </div>
  );
}

function WalletSkeleton() {
  return (
    <div className="flex flex-col gap-5" data-testid="wallet-skeleton">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-card bg-gray-100" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-card bg-gray-100" />
      <div className="h-32 animate-pulse rounded-card bg-gray-100" />
    </div>
  );
}

export function TeacherWalletPage() {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const { data, isLoading, isError, refetch } = useTeacherWallet();
  const { data: withdrawals } = useTeacherWithdrawals();
  const cancelWithdrawal = useCancelWithdrawal();
  const [editOpen, setEditOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const handleCancel = (withdrawalId: string) => {
    cancelWithdrawal.mutate(withdrawalId, {
      onSuccess: () => {
        dispatch(addToast({ type: 'success', message: t('wallet.withdrawals.cancelled') }));
      },
      onError: (error) => {
        dispatch(
          addToast({
            type: 'error',
            message: translateApiError(t, error),
          }),
        );
      },
    });
  };

  if (isLoading) {
    return (
      <div dir="rtl" className="flex flex-col gap-5">
        <div>
          <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('wallet.pageTitle')}</h1>
          <p className="mt-1 font-cairo text-sm text-text-secondary">{t('wallet.pageSubtitle')}</p>
        </div>
        <WalletSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <AlertCircle size={48} className="text-danger" />
        <p className="font-cairo text-body text-text-secondary">{t('wallet.errorTitle')}</p>
        <Button onClick={() => refetch()}>{t('wallet.retry')}</Button>
      </div>
    );
  }

  const currency = t('wallet.currency', { defaultValue: data.currency });

  return (
    <div dir="rtl" className="flex flex-col gap-5" data-testid="teacher-wallet-page">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('wallet.pageTitle')}</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">{t('wallet.pageSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="wallet-balance-cards">
        <MoneyCard
          testId="card-total-earnings"
          icon={Coins}
          label={t('wallet.cards.totalEarnings')}
          value={data.totalConfirmedEarnings}
          currency={currency}
        />
        <MoneyCard
          testId="card-available-balance"
          icon={Wallet}
          label={t('wallet.cards.availableBalance')}
          value={data.availableBalance}
          currency={currency}
        />
        <MoneyCard
          testId="card-held-withdrawals"
          icon={Clock}
          label={t('wallet.cards.heldWithdrawals')}
          value={data.heldWithdrawals}
          currency={currency}
        />
        <MoneyCard
          testId="card-completed-withdrawals"
          icon={CheckCircle2}
          label={t('wallet.cards.completedWithdrawals')}
          value={data.completedWithdrawals}
          currency={currency}
        />
      </div>

      {!data.payoutProfile.instaPayHandle && !data.payoutProfile.vodafoneCashNumber && (
        <div
          className="flex items-center gap-2 rounded-card border border-warning/30 bg-warning/10 p-3"
          data-testid="no-payout-method-warning"
        >
          <AlertCircle size={18} className="shrink-0 text-warning" />
          <p className="font-cairo text-sm text-warning">
            {t('wallet.withdrawals.noPayoutMethodWarning')}
          </p>
        </div>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-cairo text-base font-bold text-navy-900">
            {t('wallet.withdrawals.title')}
          </h2>
          <Button onClick={() => setRequestOpen(true)} data-testid="request-withdrawal-btn">
            <Plus size={16} />
            {t('wallet.withdrawals.requestButton')}
          </Button>
        </div>
        {!withdrawals || withdrawals.length === 0 ? (
          <p className="py-6 text-center font-cairo text-sm text-text-muted" data-testid="withdrawals-empty">
            {t('wallet.withdrawals.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="withdrawals-table">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">
                    {t('wallet.withdrawals.amount')}
                  </th>
                  <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">
                    {t('wallet.withdrawals.status')}
                  </th>
                  <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">
                    {t('wallet.withdrawals.requestedAt')}
                  </th>
                  <th className="px-3 py-2 text-start font-cairo text-xs font-semibold text-text-secondary">
                    {t('wallet.withdrawals.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-border/60" data-testid={`withdrawal-row-${w.id}`}>
                    <td className="px-3 py-2 font-cairo text-sm text-text-primary">
                      {Math.round(w.amount).toLocaleString('ar-EG')} {w.currency}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={withdrawalStatusVariant[w.status]}>
                        {t(`wallet.withdrawals.statusLabels.${w.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-cairo text-sm text-text-secondary">
                      {new Date(w.requestedAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-3 py-2">
                      {w.status === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={() => handleCancel(w.id)}
                          disabled={cancelWithdrawal.isPending}
                          data-testid={`cancel-withdrawal-${w.id}`}
                          className="inline-flex items-center gap-1 font-cairo text-xs font-medium text-danger hover:opacity-80 disabled:opacity-50"
                        >
                          <X size={12} />
                          {t('wallet.withdrawals.cancelButton')}
                        </button>
                      ) : (
                        <span className="font-cairo text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-cairo text-base font-bold text-navy-900">
            {t('wallet.payoutProfile.title')}
          </h2>
          <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="edit-payout-profile-btn">
            <Pencil size={16} />
            {t('wallet.payoutProfile.editButton')}
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-card border border-border p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Landmark size={18} />
            </span>
            <div>
              <p className="font-cairo text-xs text-text-secondary">
                {t('wallet.payoutProfile.instaPayHandle')}
              </p>
              <p className="font-cairo text-sm font-semibold text-navy-900" data-testid="instapay-value">
                {data.payoutProfile.instaPayHandle ?? t('wallet.payoutProfile.notSet')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-card border border-border p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <Landmark size={18} />
            </span>
            <div>
              <p className="font-cairo text-xs text-text-secondary">
                {t('wallet.payoutProfile.vodafoneCashNumber')}
              </p>
              <p className="font-cairo text-sm font-semibold text-navy-900" data-testid="vodafone-value">
                {data.payoutProfile.vodafoneCashNumber ?? t('wallet.payoutProfile.notSet')}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <EditPayoutProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        currentProfile={data.payoutProfile}
      />
      <RequestWithdrawalModal
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        availableBalance={data.availableBalance}
        currency={currency}
      />
    </div>
  );
}
