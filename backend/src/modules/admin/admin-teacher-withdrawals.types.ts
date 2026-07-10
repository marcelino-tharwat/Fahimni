export interface UserRef {
  id: string;
  fullName: string;
  email: string;
}

/** Payout destination snapshot at request time — safe fields only. */
export interface PayoutMethodSnapshotDTO {
  instaPayHandle: string | null;
  vodafoneCashNumber: string | null;
}

export interface AdminWithdrawalListItem {
  id: string;
  teacher: UserRef;
  amount: number;
  currency: string;
  status: string;
  payoutMethodSnapshot: PayoutMethodSnapshotDTO | null;
  teacherNote: string | null;
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
  transferredAt: string | null;
  cancelledAt: string | null;
  reviewedBy: UserRef | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
