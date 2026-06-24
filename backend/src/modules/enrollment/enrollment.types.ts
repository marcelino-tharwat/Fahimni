export const enrollmentPublicFields = {
  id: true,
  studentId: true,
  chapterId: true,
  status: true,
  price: true,
  paymentMethod: true,
  promoCodeId: true,
  enrolledAt: true,
  createdAt: true,
  updatedAt: true,
  chapter: {
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      stageId: true,
    },
  },
} as const;

export type EnrollmentStatus = "ACTIVE" | "DEACTIVATED";
export type PaymentMethod = "CASH" | "VISA" | "PROMO";

export interface EnrollmentChapterDTO {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  stageId: string;
}

export interface EnrollmentResponseDTO {
  id: string;
  studentId: string;
  chapterId: string;
  status: EnrollmentStatus;
  price: number;
  paymentMethod: PaymentMethod;
  promoCodeId: string | null;
  enrolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
  chapter: EnrollmentChapterDTO;
}

/**
 * Select used by the enrollment list endpoints. Reuses the shared public fields
 * but replaces the chapter projection with one that also includes the parent
 * stage, so list cards can show "Stage › Chapter" without an extra round-trip.
 */
export const enrollmentListFields = {
  ...enrollmentPublicFields,
  chapter: {
    select: {
      id: true,
      name: true,
      price: true,
      stage: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

export interface EnrollmentListChapterDTO {
  id: string;
  name: string;
  price: number | null;
  stage: {
    id: string;
    name: string;
  };
}

export interface EnrollmentListItemDTO
  extends Omit<EnrollmentResponseDTO, "chapter"> {
  chapter: EnrollmentListChapterDTO;
}

export type EnrollmentPublicFields = typeof enrollmentPublicFields;
