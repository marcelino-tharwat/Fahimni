export interface PaymentStatusDTO {
  id: string;
  chapterId: string;
  amount: number;
  currency: string;
  status: string;
  paymobTransactionId: string | null;
  errorMessage: string | null;
  createdAt: Date;
}
