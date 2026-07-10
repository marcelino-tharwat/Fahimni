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
