import crypto from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { PaymobService } from "./paymob.service.js";
import type { BillingData } from "./paymob.service.js";
import { teacherSubscriptionPaymentService } from "../teacher-plans/teacher-subscription-payment.service.js";
import type { PaymentStatusDTO } from "./payment.types.js";
import { paymentMessages } from "./payment.i18n.js";
import type { Lang } from "./payment.i18n.js";
import { isTeacherVisibleForDiscovery } from "../teacher-access/teacher-access.service.js";

export class PaymentService {
  private paymobService = new PaymobService();

  async checkout(
    studentId: string,
    chapterId: string,
    lang: Lang = "en",
  ): Promise<{ iframeUrl: string; orderId: string }> {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true,
        name: true,
        price: true,
        deletedAt: true,
        teacherId: true,
      },
    });

    if (!chapter || chapter.deletedAt) {
      throw new AppError(paymentMessages.chapterNotFound[lang], 404, "CHAPTER_NOT_FOUND");
    }

    const visible = await isTeacherVisibleForDiscovery(chapterId);
    if (!visible) {
      throw new AppError(
        "هذا المحتوى غير متاح حاليًا",
        403,
        "COURSE_NOT_AVAILABLE",
      );
    }

    if (chapter.price === null || Number(chapter.price) === 0) {
      throw new AppError(paymentMessages.chapterFree[lang], 400, "CHAPTER_FREE");
    }

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { studentId, chapterId, status: "ACTIVE" },
      select: { id: true },
    });

    if (existingEnrollment) {
      throw new AppError(paymentMessages.alreadyEnrolled[lang], 409, "ALREADY_ENROLLED");
    }

    const amountEGP = Number(chapter.price);

    const token = await this.paymobService.getValidToken();
    const paymobOrderId = await this.paymobService.createOrder(token, amountEGP);

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { fullName: true, email: true, mobile: true },
    });

    if (!student) {
      throw new AppError(paymentMessages.studentNotFound[lang], 404, "STUDENT_NOT_FOUND");
    }

    const nameParts = student.fullName.split(" ");
    const billingData: BillingData = {
      first_name: nameParts[0] ?? "NA",
      last_name: nameParts.slice(1).join(" ") || "NA",
      email: student.email,
      phone_number: student.mobile.startsWith("+2")
        ? student.mobile
        : `+2${student.mobile}`,
      apartment: "NA",
      floor: "NA",
      street: "NA",
      building: "NA",
      city: "NA",
      country: "NA",
      state: "NA",
      postal_code: "NA",
    };

    const paymentKey = await this.paymobService.getPaymentKey(
      token,
      paymobOrderId,
      amountEGP,
      billingData,
      chapterId,
    );

    const iframeUrl = this.paymobService.buildIframeUrl(paymentKey);

    await prisma.paymentTransaction.create({
      data: {
        studentId,
        chapterId,
        paymobOrderId,
        amount: amountEGP,
        status: "PENDING",
      },
    });

    return { iframeUrl, orderId: paymobOrderId };
  }

  async handleWebhook(payload: Record<string, unknown>, hmacFromQuery: string): Promise<void> {
    const calculated = this.calculateHmac(payload);
    if (calculated !== hmacFromQuery) {
      logger.warn("Paymob webhook rejected — HMAC mismatch");
      throw new AppError("Invalid HMAC signature", 401, "INVALID_HMAC");
    }

    logger.info("Paymob webhook received — HMAC verified");

    const payloadOrder = payload.order as Record<string, unknown> | undefined;
    if (!payloadOrder?.id) {
      logger.info("Paymob webhook skipped — no order ID in payload");
      return;
    }

    const paymobOrderId = String(payloadOrder.id);

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { paymobOrderId },
      include: {
        chapter: {
          select: { teacherId: true },
        },
      },
    });

    if (!transaction) {
      // Not a student chapter payment — it may be a teacher subscription
      // payment. The HMAC has already been verified above, so it is safe to
      // hand the verified payload to the teacher-subscription handler.
      const handled =
        await teacherSubscriptionPaymentService.handleProviderWebhook(
          paymobOrderId,
          payload,
        );
      if (!handled) {
        logger.info("Paymob webhook skipped — unknown order", { paymobOrderId });
      }
      return;
    }

    if (transaction.status === "SUCCESS" || transaction.status === "FAILED") {
      logger.info("Paymob webhook skipped — already processed", {
        paymobOrderId,
        status: transaction.status,
      });
      return;
    }

    if (payload.success === true) {
      await prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: "SUCCESS",
            paymobTransactionId: String(payload.id),
            rawCallback: payload as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.enrollment.upsert({
          where: {
            studentId_chapterId: {
              studentId: transaction.studentId,
              chapterId: transaction.chapterId,
            },
          },
          create: {
            studentId: transaction.studentId,
            chapterId: transaction.chapterId,
            status: "ACTIVE",
            paymentMethod: "PAYMOB",
            price: transaction.amount,
          },
          update: { status: "ACTIVE" },
        });
      });

      logger.info("Paymob payment succeeded — enrollment created", {
        paymobOrderId,
        transactionId: transaction.id,
        paymobTransactionId: String(payload.id),
      });

      await auditLogService.record({
        action: "PAYMENT_COMPLETED",
        resourceType: "PAYMENT_TRANSACTION",
        resourceId: transaction.id,
        actorId: transaction.studentId,
        actorType: "STUDENT",
        scopeTeacherId: transaction.chapter.teacherId,
        details: {
          chapterId: transaction.chapterId,
          amount: transaction.amount,
          paymobTransactionId: String(payload.id),
        },
      });
    } else {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: "FAILED",
          errorMessage: ((payload.data as Record<string, unknown> | undefined)?.message as string) ?? "Payment failed",
          rawCallback: payload as unknown as Prisma.InputJsonValue,
        },
      });

      logger.info("Paymob payment failed", {
        paymobOrderId,
        transactionId: transaction.id,
        error: ((payload.data as Record<string, unknown> | undefined)?.message as string) ?? "Payment failed",
      });

      await auditLogService.record({
        action: "PAYMENT_FAILED",
        resourceType: "PAYMENT_TRANSACTION",
        resourceId: transaction.id,
        actorId: transaction.studentId,
        actorType: "STUDENT",
        scopeTeacherId: transaction.chapter.teacherId,
        details: {
          chapterId: transaction.chapterId,
          amount: transaction.amount,
          error: ((payload.data as Record<string, unknown> | undefined)?.message as string) ?? "Payment failed",
        },
      });
    }
  }

  /**
   * Get payment status by Paymob order ID. The `status` field in the response
   * is always one of: "PENDING" | "SUCCESS" | "FAILED".
   *
   * ## Polling recommendation (frontend)
   * The Paymob webhook is the source of truth for payment finalisation. It
   * typically arrives **3–30 seconds** after the user completes payment in the
   * iframe. To bridge the gap between iframe completion and webhook delivery,
   * the frontend SHOULD poll this endpoint:
   *
   *   Interval:   every 3 seconds
   *   Timeout:    120 seconds (2 minutes)
   *   Stop when:  status !== "PENDING"
   *
   * ## Alternative — PostMessage (no polling needed)
   * Paymob's iframe supports a `post_message=true` query parameter. When set,
   * the Paymob iframe posts a `message` event to the parent window with the
   * transaction result, which the frontend can listen for directly. This
   * eliminates the need for polling.
   *
   * To enable, add `&post_message=true` to the iframe URL in PaymobService's
   * `buildIframeUrl()`. The frontend would then listen:
   *   window.addEventListener('message', (event) => { … });
   *
   * The webhook remains the canonical source of truth regardless of which
   * mechanism the frontend uses for the interim waiting period.
   */
  async getPaymentStatus(
    paymobOrderId: string,
    studentId: string,
    lang: Lang = "en",
  ): Promise<PaymentStatusDTO> {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { paymobOrderId },
    });

    if (!transaction) {
      throw new AppError(paymentMessages.paymentNotFound[lang], 404, "PAYMENT_NOT_FOUND");
    }

    if (transaction.studentId !== studentId) {
      throw new AppError(paymentMessages.forbidden[lang], 403, "FORBIDDEN");
    }

    return this.toDTO(transaction);
  }

  private toDTO(
    transaction: {
      status: string;
      amount: number;
    } & Record<string, unknown>,
  ): PaymentStatusDTO {
    return {
      id: transaction.id as string,
      chapterId: transaction.chapterId as string,
      amount: transaction.amount,
      currency: transaction.currency as string,
      status: transaction.status,
      paymobTransactionId: (transaction.paymobTransactionId as string | null) ?? null,
      errorMessage: (transaction.errorMessage as string | null) ?? null,
      createdAt: transaction.createdAt as Date,
    };
  }

  private calculateHmac(payload: Record<string, unknown>): string {
    const order = payload.order as Record<string, unknown>;
    const sourceData = payload.source_data as Record<string, unknown>;

    const fields = [
      payload.amount_cents,
      payload.created_at,
      payload.currency,
      payload.error_occured,
      payload.has_parent_transaction,
      payload.id,
      payload.integration_id,
      payload.is_3d_secure,
      payload.is_auth,
      payload.is_capture,
      payload.is_refunded,
      payload.is_standalone_payment,
      payload.is_voided,
      order?.id,
      payload.owner,
      payload.pending,
      sourceData?.pan,
      sourceData?.sub_type,
      sourceData?.type,
      payload.success,
    ];

    const message = fields.map((f) => String(f ?? "")).join("");
    return crypto.createHmac("sha512", env.PAYMOB_HMAC_SECRET).update(message).digest("hex");
  }
}
