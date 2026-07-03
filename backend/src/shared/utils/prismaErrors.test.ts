import { describe, it, expect } from "vitest";
import { Prisma } from "../../generated/prisma/client.js";
import { mapPrismaClientError } from "./prismaErrors.js";

describe("mapPrismaClientError", () => {
  it("maps P2022 to a safe schema-out-of-date response", () => {
    const err = new Prisma.PrismaClientKnownRequestError("column missing", {
      code: "P2022",
      clientVersion: "test",
    });
    const safe = mapPrismaClientError(err);
    expect(safe.statusCode).toBe(503);
    expect(safe.reason).toBe("DATABASE_SCHEMA_OUT_OF_DATE");
    expect(safe.message).not.toContain("Invalid `");
    expect(safe.details).toBeTruthy();
    expect(safe.suggestion).toBeTruthy();
  });
});
