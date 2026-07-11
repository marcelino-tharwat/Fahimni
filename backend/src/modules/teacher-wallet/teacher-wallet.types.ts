export interface PayoutProfileDTO {
  instaPayHandle: string | null;
  vodafoneCashNumber: string | null;
  payoutMethodUpdatedAt: string | null;
}

export interface WithdrawalSummaryDTO {
  id: string;
  amount: number;
  currency: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  transferredAt: string | null;
  cancelledAt: string | null;
  teacherNote: string | null;
}

export interface TeacherWalletDTO {
  totalConfirmedEarnings: number;
  availableBalance: number;
  heldWithdrawals: number;
  completedWithdrawals: number;
  currency: string;
  latestWithdrawals: WithdrawalSummaryDTO[];
  payoutProfile: PayoutProfileDTO;
}

/** Payout destination snapshot at request time — safe fields only. */
export interface PayoutMethodSnapshotDTO {
  instaPayHandle: string | null;
  vodafoneCashNumber: string | null;
}

/** GET /api/teacher/withdrawals list item — the teacher's own request. */
export interface TeacherWithdrawalListItemDTO {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payoutMethodSnapshot: PayoutMethodSnapshotDTO | null;
  teacherNote: string | null;
  requestedAt: string;
  processedAt: string | null;
  transferredAt: string | null;
  cancelledAt: string | null;
}
