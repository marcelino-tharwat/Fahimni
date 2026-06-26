/** Minimal user projection embedded in promo-code list rows (id + name + email). */
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
  createdAt: true,
  expiresAt: true,
} as const;

/**
 * Select used by the list endpoint. Reuses the shared public fields but also
 * embeds the redeeming student and the creating support agent, each trimmed to
 * id + name + email so list rows can show "created by / used by" without an
 * extra round-trip.
 */
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
  createdAt: Date;
  expiresAt: Date | null;
}

export interface PromoCodeListItemDTO extends PromoCodeResponseDTO {
  usedByStudent: PromoCodeUserDTO | null;
  createdBy: PromoCodeUserDTO;
}

/** Machine-readable reason a promo code failed validation. */
export type PromoCodeInvalidReason =
  | "CODE_NOT_FOUND"
  | "CODE_ALREADY_USED"
  | "CODE_EXPIRED";

export interface PromoCodeValidationResult {
  valid: boolean;
  reason?: PromoCodeInvalidReason;
}

/** Page envelope for the list endpoint — matches the shape of the shared paginate() util. */
export interface PaginatedPromoCodes {
  page: number;
  limit: number;
  total: number;
  data: PromoCodeListItemDTO[];
}

export type PromoCodePublicFields = typeof promoCodePublicFields;
