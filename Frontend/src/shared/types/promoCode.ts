// Promo-code domain types — mirror the backend wire shapes documented in
// docs/promo-code-api-report.md (SCRUM-417). Every date field is a JSON ISO 8601
// string over the wire (Prisma `DateTime` serialized by res.json), even though
// the server-side DTO types them as `Date`.

/** Minimal user projection embedded in list-endpoint rows. */
export interface PromoCodeUser {
  id: string;
  fullName: string;
  email: string;
}

/**
 * `POST /promo-codes` (generate) response — the flat `PromoCodeResponseDTO`.
 * Does NOT include the nested `createdBy`/`usedByStudent` objects (list-only).
 */
export interface PromoCode {
  id: string;
  code: string;
  isUsed: boolean;
  usedByStudentId: string | null;
  usedAt: string | null; // ISO date string
  createdById: string;
  createdAt: string; // ISO date string
  expiresAt: string | null; // ISO date string
}

/**
 * `GET /promo-codes` list item — extends the flat shape with the embedded
 * creating agent (always present) and redeeming student (null when unused).
 */
export interface PromoCodeListItem extends PromoCode {
  usedByStudent: PromoCodeUser | null;
  createdBy: PromoCodeUser;
}

/**
 * Query params for the list endpoint. Omit `isUsed` for "all"; `true` →
 * used only, `false` → unused only.
 */
export interface ListPromoCodesParams {
  page?: number;
  limit?: number;
  isUsed?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Student-side validate / redeem (SCRUM-425)                          */
/* ------------------------------------------------------------------ */

/**
 * `POST /promo-codes/:code/validate` (STUDENT) result — the `data` payload.
 *
 * ⚠️ The endpoint ALWAYS returns HTTP 200 + `success: true`, even for an
 * invalid code. The verdict lives in this body: read `valid` (and `reason`
 * when false), never the HTTP status. `reason` is omitted when `valid` is true.
 */
export interface PromoValidationResult {
  valid: boolean;
  reason?: 'CODE_NOT_FOUND' | 'CODE_ALREADY_USED' | 'CODE_EXPIRED';
}

/**
 * `POST /promo-codes/redeem` (STUDENT) success result — the `data` payload of
 * the 201 response. A promo code grants a single free (price 0) PROMO
 * enrollment in one chapter — there is no discount/amount.
 */
export interface RedeemResult {
  enrollment: {
    id: string;
    studentId: string;
    chapterId: string;
    status: 'ACTIVE';
    price: number;
    paymentMethod: 'PROMO';
    promoCodeId: string;
    enrolledAt: string; // ISO date string
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
    chapter: {
      id: string;
      name: string;
      description: string | null;
      price: number | null;
      stageId: string;
    };
  };
  promoCode: {
    code: string;
    isUsed: boolean;
    usedAt: string; // ISO date string
  };
}
