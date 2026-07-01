import { apiClient } from '@/shared/lib/api/client';

export interface CheckoutResponse {
  iframeUrl: string;
  orderId: string;
}

export interface PaymentStatusData {
  id: string;
  chapterId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  paymobTransactionId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export const paymentApi = {
  checkout: (chapterId: string) =>
    apiClient.post<{ success: boolean; message: string; data: CheckoutResponse }>(
      '/payments/checkout',
      { chapterId },
    ),
  getPaymentStatus: (orderId: string) =>
    apiClient.get<{ success: boolean; message: string; data: PaymentStatusData }>(
      `/payments/status/${orderId}`,
    ),
};
