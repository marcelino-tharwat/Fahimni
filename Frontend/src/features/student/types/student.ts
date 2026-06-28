export interface StudentProfileUser {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: StudentProfileUser;
}

export interface UpdateStudentProfileInput {
  fullName?: string;
  email?: string;
  mobile?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type EnrollmentPaymentMethod = 'CASH' | 'VISA' | 'PROMO';
export type EnrollmentRecordStatus = 'ACTIVE' | 'DEACTIVATED';

/**
 * A student's own enrollment as returned by `GET /enrollments/my`
 * (backend `EnrollmentListItemDTO`). Dates are ISO strings over the wire.
 */
export interface EnrollmentRecord {
  id: string;
  studentId: string;
  chapterId: string;
  status: EnrollmentRecordStatus;
  price: number;
  paymentMethod: EnrollmentPaymentMethod;
  promoCodeId: string | null;
  enrolledAt: string;
  createdAt: string;
  updatedAt: string;
  chapter: {
    id: string;
    name: string;
    price: number | null;
    stage: { id: string; name: string };
  };
}

export interface StudentApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
