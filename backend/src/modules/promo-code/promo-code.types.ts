export const promoCodeUserFields = {
  id: true,
  fullName: true,
  email: true,
} as const;

export const promoCodePublicFields = {
  id: true,
  code: true,
  isUsed: true,
  usedByStudentId: true,
  usedAt: true,
  createdById: true,
  chapterId: true,
  createdAt: true,
  expiresAt: true,
} as const;

export const promoCodeListFields = {
  ...promoCodePublicFields,
  usedByStudent: { select: promoCodeUserFields },
  createdBy: { select: promoCodeUserFields },
} as const;

export interface PromoCodeUserDTO {
  id: string;
  fullName: string;
  email: string;
}

export interface PromoCodeResponseDTO {
  id: string;
  code: string;
  isUsed: boolean;
  usedByStudentId: string | null;
  usedAt: Date | null;
  createdById: string;
  chapterId: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface PromoCodeListItemDTO extends PromoCodeResponseDTO {
  usedByStudent: PromoCodeUserDTO | null;
  createdBy: PromoCodeUserDTO;
}

export type PromoCodeInvalidReason =
  | "CODE_NOT_FOUND"
  | "CODE_ALREADY_USED"
  | "CODE_EXPIRED"
  | "CODE_NOT_FOR_THIS_CHAPTER";

export interface PromoCodeValidationResult {
  valid: boolean;
  reason?: PromoCodeInvalidReason;
}

export interface PaginatedPromoCodes {
  page: number;
  limit: number;
  total: number;
  data: PromoCodeListItemDTO[];
}

export type PromoCodePublicFields = typeof promoCodePublicFields;
