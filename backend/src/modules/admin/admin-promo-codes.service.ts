import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/utils/AppError.js";
import type {
  AdminPromoCodeDTO,
  Paginated,
  PromoDisplayStatus,
} from "./admin-promo-codes.types.js";
import type {
  CreatePromoCodeInput,
  ListPromoCodesQuery,
  UpdatePromoCodeInput,
} from "./admin-promo-codes.validation.js";

type PromoRow = {
  id: string;
  code: string;
  scope: string;
  discountType: string;
  discountValue: number;
  currency: string;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number | null;
  applicablePlanIds: string[];
  billingInterval: string;
  createdAt: Date;
  updatedAt: Date;
};

function displayStatus(row: { isActive: boolean; expiresAt: Date | null }): PromoDisplayStatus {
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return "EXPIRED";
  return row.isActive ? "ACTIVE" : "INACTIVE";
}

function toDTO(row: PromoRow): AdminPromoCodeDTO {
  return {
    id: row.id,
    code: row.code,
    scope: row.scope as AdminPromoCodeDTO["scope"],
    discountType: row.discountType as AdminPromoCodeDTO["discountType"],
    discountValue: row.discountValue,
    currency: row.currency,
    startsAt: row.startsAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    isActive: row.isActive,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    perUserLimit: row.perUserLimit,
    applicablePlanIds: row.applicablePlanIds,
    billingInterval: row.billingInterval as AdminPromoCodeDTO["billingInterval"],
    displayStatus: displayStatus(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Admin Promo Codes management (ADMIN-only) over the scope-separated
 * PlatformPromoCode model. Course and teacher-plan codes are managed together
 * here (filtered by `scope`) but can never be cross-used at checkout.
 */
export class AdminPromoCodesService {
  async list(query: ListPromoCodesQuery): Promise<Paginated<AdminPromoCodeDTO>> {
    const { page, limit, scope, q, isActive } = query;
    const where: Prisma.PlatformPromoCodeWhereInput = {
      ...(scope ? { scope } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(q ? { code: { contains: q, mode: "insensitive" } } : {}),
    };
    const [total, rows] = await prisma.$transaction([
      prisma.platformPromoCode.count({ where }),
      prisma.platformPromoCode.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      data: rows.map(toDTO),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(promoId: string): Promise<AdminPromoCodeDTO> {
    const row = await prisma.platformPromoCode.findUnique({ where: { id: promoId } });
    if (!row) throw new AppError("Promo code not found", 404, "PROMO_NOT_FOUND");
    return toDTO(row);
  }

  async create(createdById: string, input: CreatePromoCodeInput): Promise<AdminPromoCodeDTO> {
    const existing = await prisma.platformPromoCode.findUnique({ where: { code: input.code } });
    if (existing) throw new AppError("Promo code already exists", 409, "PROMO_CODE_EXISTS");

    // Validate that TEACHER_PLAN applicablePlanIds reference real plans.
    if (input.scope === "TEACHER_PLAN" && input.applicablePlanIds.length > 0) {
      const count = await prisma.teacherPlan.count({ where: { id: { in: input.applicablePlanIds } } });
      if (count !== input.applicablePlanIds.length) {
        throw new AppError("One or more plan ids are invalid", 400, "INVALID_PLAN_IDS");
      }
    }

    const row = await prisma.platformPromoCode.create({
      data: {
        code: input.code,
        scope: input.scope,
        discountType: input.discountType,
        discountValue: input.discountValue,
        currency: input.currency,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
        isActive: input.isActive,
        maxUses: input.maxUses ?? null,
        perUserLimit: input.perUserLimit ?? null,
        applicablePlanIds: input.scope === "TEACHER_PLAN" ? input.applicablePlanIds : [],
        billingInterval: input.scope === "TEACHER_PLAN" ? input.billingInterval : "ALL",
        createdById,
      },
    });
    return toDTO(row);
  }

  async update(promoId: string, input: UpdatePromoCodeInput): Promise<AdminPromoCodeDTO> {
    const existing = await prisma.platformPromoCode.findUnique({ where: { id: promoId } });
    if (!existing) throw new AppError("Promo code not found", 404, "PROMO_NOT_FOUND");

    // Plan/interval restrictions only apply to TEACHER_PLAN codes.
    if (input.applicablePlanIds && input.applicablePlanIds.length > 0) {
      if (existing.scope !== "TEACHER_PLAN") {
        throw new AppError("applicablePlanIds is only valid for TEACHER_PLAN", 400, "INVALID_FIELD_FOR_SCOPE");
      }
      const count = await prisma.teacherPlan.count({ where: { id: { in: input.applicablePlanIds } } });
      if (count !== input.applicablePlanIds.length) {
        throw new AppError("One or more plan ids are invalid", 400, "INVALID_PLAN_IDS");
      }
    }
    if (input.billingInterval && input.billingInterval !== "ALL" && existing.scope !== "TEACHER_PLAN") {
      throw new AppError("billingInterval is only valid for TEACHER_PLAN", 400, "INVALID_FIELD_FOR_SCOPE");
    }
    if (
      existing.discountType === "PERCENTAGE" &&
      input.discountType !== "FIXED_AMOUNT" &&
      input.discountValue != null &&
      input.discountValue > 100
    ) {
      throw new AppError("Percentage cannot exceed 100", 400, "INVALID_DISCOUNT");
    }

    const row = await prisma.platformPromoCode.update({
      where: { id: promoId },
      data: {
        ...(input.discountType !== undefined ? { discountType: input.discountType } : {}),
        ...(input.discountValue !== undefined ? { discountValue: input.discountValue } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
        ...(input.perUserLimit !== undefined ? { perUserLimit: input.perUserLimit } : {}),
        ...(input.applicablePlanIds !== undefined ? { applicablePlanIds: input.applicablePlanIds } : {}),
        ...(input.billingInterval !== undefined ? { billingInterval: input.billingInterval } : {}),
      },
    });
    return toDTO(row);
  }

  async changeStatus(promoId: string, isActive: boolean): Promise<AdminPromoCodeDTO> {
    const existing = await prisma.platformPromoCode.findUnique({ where: { id: promoId } });
    if (!existing) throw new AppError("Promo code not found", 404, "PROMO_NOT_FOUND");
    const row = await prisma.platformPromoCode.update({ where: { id: promoId }, data: { isActive } });
    return toDTO(row);
  }
}

export const adminPromoCodesService = new AdminPromoCodesService();
