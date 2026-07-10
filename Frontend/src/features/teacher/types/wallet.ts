export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'TRANSFERRED' | 'REJECTED' | 'CANCELLED';

export interface PayoutProfile {
  instaPayHandle: string | null;
  vodafoneCashNumber: string | null;
  payoutMethodUpdatedAt: string | null;
}

export interface WithdrawalSummary {
  id: string;
  amount: number;
  currency: string;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt: string | null;
  transferredAt: string | null;
  cancelledAt: string | null;
  teacherNote: string | null;
}

export interface TeacherWallet {
  totalConfirmedEarnings: number;
  availableBalance: number;
  heldWithdrawals: number;
  completedWithdrawals: number;
  currency: string;
  latestWithdrawals: WithdrawalSummary[];
  payoutProfile: PayoutProfile;
}

export interface UpdatePayoutProfileInput {
  instaPayHandle?: string;
  vodafoneCashNumber?: string;
}

/** Payout destination snapshot at request time — safe fields only. */
export interface PayoutMethodSnapshot {
  instaPayHandle: string | null;
  vodafoneCashNumber: string | null;
}

/** GET /api/teacher/withdrawals list item — the teacher's own request. */
export interface TeacherWithdrawalListItem {
  id: string;
  amount: number;
  currency: string;
  status: WithdrawalStatus;
  payoutMethodSnapshot: PayoutMethodSnapshot | null;
  teacherNote: string | null;
  requestedAt: string;
  processedAt: string | null;
  transferredAt: string | null;
  cancelledAt: string | null;
}

export interface CreateWithdrawalInput {
  amount: number;
  teacherNote?: string;
}
