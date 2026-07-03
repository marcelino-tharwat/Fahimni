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
  stageId: string;
  stage: { name: string };
  createdAt: string;
  updatedAt: string;
  user: StudentProfileUser;
}

export interface PublicStage {
  id: string;
  name: string;
  sortOrder: number;
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

export type EnrollmentPaymentMethod = 'FREE' | 'PROMO' | 'PAYMOB';
export type EnrollmentRecordStatus = 'ACTIVE' | 'DEACTIVATED';

/**
 * Enrollment as returned by `POST /enrollments/free` (backend
 * `EnrollmentResponseDTO`). Same row as `EnrollmentRecord` but the chapter
 * projection differs (description + stageId instead of the nested stage), so
 * it gets its own shape. `price` is a number (0 for free); `paymentMethod` is
 * `'FREE'`.
 */
export interface FreeEnrollment {
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
    description: string | null;
    price: number | null;
    stageId: string;
  };
}

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
