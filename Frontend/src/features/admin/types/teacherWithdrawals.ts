export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'TRANSFERRED' | 'REJECTED' | 'CANCELLED';

export interface UserRef {
  id: string;
  fullName: string;
  email: string;
}

export interface PayoutMethodSnapshot {
  instaPayHandle: string | null;
  vodafoneCashNumber: string | null;
}

export interface AdminWithdrawalListItem {
  id: string;
  teacher: UserRef;
  amount: number;
  currency: string;
  status: WithdrawalStatus;
  payoutMethodSnapshot: PayoutMethodSnapshot | null;
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

export interface AdminWithdrawalsQuery {
  q?: string;
  status?: WithdrawalStatus;
  teacherId?: string;
  page?: number;
  limit?: number;
}

export type UpdatableWithdrawalStatus = 'PROCESSING' | 'TRANSFERRED' | 'REJECTED';

export interface UpdateWithdrawalStatusBody {
  status: UpdatableWithdrawalStatus;
  adminNote?: string;
}
