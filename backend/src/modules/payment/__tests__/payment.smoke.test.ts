import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// ── Prisma mock ────────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  chapter: {
    findUnique: vi.fn().mockResolvedValue({
      id: "",
      price: 100,
      deletedAt: null,
      stage: { teacher: { status: "ACTIVE", role: "OPERATION", teacherApprovalState: "APPROVED" }, teacherId: "t1" },
    }),
  },
  enrollment: { findFirst: vi.fn(), upsert: vi.fn() },
  paymentTransaction: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../../config/database.js", () => ({ prisma: mockPrisma }));

// ── PaymobService mock ─────────────────────────────────────────────────────
const mockGetValidToken = vi.hoisted(() => vi.fn());
const mockCreateOrder = vi.hoisted(() => vi.fn());
const mockGetPaymentKey = vi.hoisted(() => vi.fn());
const mockBuildIframeUrl = vi.hoisted(() => vi.fn());

vi.mock("../paymob.service.js", () => ({
  PaymobService: vi.fn(() => ({
    getValidToken: mockGetValidToken,
    createOrder: mockCreateOrder,
    getPaymentKey: mockGetPaymentKey,
    buildIframeUrl: mockBuildIframeUrl,
  })),
}));

// ── Env mock ───────────────────────────────────────────────────────────────
vi.mock("../../../config/env.js", () => ({
  env: {
    PAYMOB_API_KEY: "test-key",
    PAYMOB_INTEGRATION_ID: 456,
    PAYMOB_IFRAME_ID: "test-iframe",
    PAYMOB_HMAC_SECRET: "test-hmac-secret",
    PAYMOB_CURRENCY: "EGP",
    PAYMOB_BASE_URL: "https://accept.paymob.com",
  },
}));

// ── SUT ────────────────────────────────────────────────────────────────────
import { PaymentService } from "../payment.service.js";
import { AppError } from "../../../shared/utils/AppError.js";

// ── Helpers ────────────────────────────────────────────────────────────────
function computeHmac(payload: Record<string, unknown>): string {
  const order = payload.order as Record<string, unknown> | undefined;
  const sourceData = payload.source_data as Record<string, unknown> | undefined;

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
  return crypto
    .createHmac("sha512", "test-hmac-secret")
    .update(message)
    .digest("hex");
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("PaymentService", () => {
  const service = new PaymentService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkout", () => {
    it("throws 404 when chapter is not found", async () => {
      mockPrisma.chapter.findUnique.mockResolvedValue(null);

      await expect(service.checkout("stu1", "ch1")).rejects.toMatchObject({
        statusCode: 404,
        code: "CHAPTER_NOT_FOUND",
      });
    });

    it("throws 400 when chapter price is null", async () => {
      mockPrisma.chapter.findUnique.mockResolvedValue({
        id: "ch1",
        price: null,
        deletedAt: null,
        stage: { teacherId: "t1", teacher: { status: "ACTIVE", role: "OPERATION", teacherApprovalState: "APPROVED" } },
        name: "Free Chapter",
      });

      await expect(service.checkout("stu1", "ch1")).rejects.toMatchObject({
        statusCode: 400,
        code: "CHAPTER_FREE",
      });
    });

    it("throws 409 when already enrolled", async () => {
      mockPrisma.chapter.findUnique.mockResolvedValue({
        id: "ch1",
        price: 100,
        deletedAt: null,
        stage: { teacherId: "t1", teacher: { status: "ACTIVE", role: "OPERATION", teacherApprovalState: "APPROVED" } },
        name: "Paid Chapter",
      });

      mockPrisma.enrollment.findFirst.mockResolvedValue({ id: "enr1" });

      await expect(service.checkout("stu1", "ch1")).rejects.toMatchObject({
        statusCode: 409,
        code: "ALREADY_ENROLLED",
      });
    });
  });

  describe("handleWebhook", () => {
    it("throws 401 when HMAC is invalid", async () => {
      const payload = { id: 1, success: true, order: { id: "ord1" } };

      await expect(
        service.handleWebhook(payload, "wrong-hmac"),
      ).rejects.toMatchObject({ statusCode: 401, code: "INVALID_HMAC" });
    });

    it("returns silently when transaction is already SUCCESS (idempotency)", async () => {
      const orderId = "ord-123";
      const payload = {
        id: 999,
        amount_cents: 10000,
        success: true,
        order: { id: orderId },
      };
      const validHmac = computeHmac(payload);

      mockPrisma.paymentTransaction.findUnique.mockResolvedValue({
        id: "txn-1",
        studentId: "stu1",
        chapterId: "ch1",
        paymobOrderId: orderId,
        status: "SUCCESS",
        amount: 100,
        chapter: { stage: { teacherId: "t1" } },
      });

      await service.handleWebhook(payload, validHmac);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.enrollment.upsert).not.toHaveBeenCalled();
    });
  });
});
