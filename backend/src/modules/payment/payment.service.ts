import crypto from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/utils/AppError.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";
import { PaymobService } from "./paymob.service.js";
import type { BillingData } from "./paymob.service.js";
import type { PaymentStatusDTO } from "./payment.types.js";
import { paymentMessages } from "./payment.i18n.js";
import type { Lang } from "./payment.i18n.js";

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
        stage: { select: { teacherId: true } },
      },
    });

    if (!chapter || chapter.deletedAt) {
      throw new AppError(paymentMessages.chapterNotFound[lang], 404);
    }

    if (chapter.price === null || Number(chapter.price) === 0) {
      throw new AppError(paymentMessages.chapterFree[lang], 400);
    }

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { studentId, chapterId, status: "ACTIVE" },
      select: { id: true },
    });

    if (existingEnrollment) {
      throw new AppError(paymentMessages.alreadyEnrolled[lang], 409);
    }

    const amountEGP = Number(chapter.price);

    const token = await this.paymobService.authenticate();
    const paymobOrderId = await this.paymobService.createOrder(token, amountEGP);

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { fullName: true, email: true, mobile: true },
    });

    if (!student) {
      throw new AppError(paymentMessages.studentNotFound[lang], 404);
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
      throw new AppError("Invalid HMAC signature", 401);
    }

    const payloadOrder = payload.order as Record<string, unknown> | undefined;
    if (!payloadOrder?.id) {
      return;
    }

    const paymobOrderId = String(payloadOrder.id);

    const transaction = await prisma.paymentTransaction.findUnique({
      where: { paymobOrderId },
      include: {
        chapter: {
          select: { stage: { select: { teacherId: true } } },
        },
      },
    });

    if (!transaction) {
      return;
    }

    if (transaction.status === "SUCCESS" || transaction.status === "FAILED") {
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

      await auditLogService.record({
        action: "PAYMENT_COMPLETED",
        resourceType: "PAYMENT_TRANSACTION",
        resourceId: transaction.id,
        actorId: transaction.studentId,
        actorType: "STUDENT",
        scopeTeacherId: transaction.chapter.stage.teacherId,
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

      await auditLogService.record({
        action: "PAYMENT_FAILED",
        resourceType: "PAYMENT_TRANSACTION",
        resourceId: transaction.id,
        actorId: transaction.studentId,
        actorType: "STUDENT",
        scopeTeacherId: transaction.chapter.stage.teacherId,
        details: {
          chapterId: transaction.chapterId,
          amount: transaction.amount,
          error: ((payload.data as Record<string, unknown> | undefined)?.message as string) ?? "Payment failed",
        },
      });
    }
  }

  async getPaymentStatus(
    paymobOrderId: string,
    studentId: string,
    lang: Lang = "en",
  ): Promise<PaymentStatusDTO> {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { paymobOrderId },
    });

    if (!transaction) {
      throw new AppError(paymentMessages.paymentNotFound[lang], 404);
    }

    if (transaction.studentId !== studentId) {
      throw new AppError(paymentMessages.forbidden[lang], 403);
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
