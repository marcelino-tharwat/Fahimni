import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../config/logger.js";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits structured JSON with event name", () => {
    logger.info("server_started", { port: 3000 });
    expect(console.info).toHaveBeenCalled();
    const line = String((console.info as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    const parsed = JSON.parse(line) as { event: string; port: number };
    expect(parsed.event).toBe("server_started");
    expect(parsed.port).toBe(3000);
  });
});
