import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database.js", () => ({ prisma: {} }));

import { ContentProtectionController } from "./contentProtection.controller.js";
import { auditLogService } from "../../shared/services/auditLog.service.js";

function flush(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}

interface MockReq {
  body: Record<string, unknown>;
  user?: { id: string; role?: string };
}

type MockSend = ReturnType<typeof vi.fn>;
type MockStatus = ReturnType<typeof vi.fn>;
type MockJson = ReturnType<typeof vi.fn>;
type MockRes = { status: MockStatus; json: MockJson; send: MockSend };
type MockNext = ReturnType<typeof vi.fn>;

function makeReqRes(body: Record<string, unknown>, userId = "user-1"): {
  req: MockReq;
  res: MockRes;
  next: MockNext;
} {
  const send = vi.fn();
  const json = vi.fn();
  const status = vi.fn(() => ({ json, send })) as unknown as MockStatus;
  const res: MockRes = { status, json, send };
  const next = vi.fn();
  const req: MockReq = { body, user: { id: userId } };
  return { req, res, next };
}

describe("ContentProtectionController", () => {
  let controller: ContentProtectionController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ContentProtectionController();
  });

  describe("reportEvent", () => {
    it("returns 400 when action is missing", async () => {
      const { req, res, next } = makeReqRes({});

      controller.reportEvent(req as never, res as never, next as never);
      await flush();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid or missing action",
      });
    });

    it("returns 400 when action is not in the valid set", async () => {
      const { req, res, next } = makeReqRes({ action: "invalid_action" });

      controller.reportEvent(req as never, res as never, next as never);
      await flush();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid or missing action",
      });
    });

    it("records an audit log entry and returns 204 for a valid action", async () => {
      const spy = vi.spyOn(auditLogService, "record").mockResolvedValue(undefined);
      const { req, res, next } = makeReqRes({
        action: "copy_blocked",
        resourceType: "quiz",
        resourceId: "quiz-123",
      });

      controller.reportEvent(req as never, res as never, next as never);
      await flush();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        action: "CONTENT_PROTECTION_COPY_BLOCKED",
        resourceType: "quiz",
        resourceId: "quiz-123",
        actorId: "user-1",
        actorType: "STUDENT",
        scopeTeacherId: "user-1",
        details: null,
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("uses default resourceType and resourceId when omitted", async () => {
      const spy = vi.spyOn(auditLogService, "record").mockResolvedValue(undefined);
      const { req, res, next } = makeReqRes({ action: "paste_blocked" });

      controller.reportEvent(req as never, res as never, next as never);
      await flush();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONTENT_PROTECTION_PASTE_BLOCKED",
          resourceType: "content_protection",
          resourceId: "unknown",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it("includes route in audit details when provided", async () => {
      const spy = vi.spyOn(auditLogService, "record").mockResolvedValue(undefined);
      const { req, res, next } = makeReqRes({
        action: "print_blocked",
        route: "/lessons/abc",
      });

      controller.reportEvent(req as never, res as never, next as never);
      await flush();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CONTENT_PROTECTION_PRINT_BLOCKED",
          details: { route: "/lessons/abc" },
        }),
      );
    });

    it("strips details when route is undefined (not present)", async () => {
      const spy = vi.spyOn(auditLogService, "record").mockResolvedValue(undefined);
      const { req, res, next } = makeReqRes({ action: "contextmenu_blocked" });

      controller.reportEvent(req as never, res as never, next as never);
      await flush();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ details: null }),
      );
    });

    it("returns 204 even when audit log recording fails", async () => {
      vi.spyOn(auditLogService, "record").mockRejectedValue(
        new Error("DB down"),
      );
      const { req, res, next } = makeReqRes({ action: "copy_blocked" });

      controller.reportEvent(req as never, res as never, next as never);
      await flush();

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it("maps each valid action to the correct audit log action", async () => {
      const actions: Record<string, string> = {
        copy_blocked: "CONTENT_PROTECTION_COPY_BLOCKED",
        paste_blocked: "CONTENT_PROTECTION_PASTE_BLOCKED",
        print_blocked: "CONTENT_PROTECTION_PRINT_BLOCKED",
        protected_content_blurred: "CONTENT_PROTECTION_CONTENT_BLURRED",
        contextmenu_blocked: "CONTENT_PROTECTION_CONTEXTMENU_BLOCKED",
      };

      for (const [action, expectedAuditAction] of Object.entries(actions)) {
        const spy = vi.spyOn(auditLogService, "record").mockResolvedValue(undefined);
        const { req, res, next } = makeReqRes({ action });
        vi.clearAllMocks();

        controller.reportEvent(req as never, res as never, next as never);
        await flush();

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({ action: expectedAuditAction }),
        );
      }
    });
  });
});
