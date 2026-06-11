export type EnrollmentMethod = 'paymob' | 'promo_code';

export interface Enrollment {
  id: string;
  studentId: string;
  chapterId: string;
  tenantId: string;
  method: EnrollmentMethod;
  purchasedAt: string;
}
