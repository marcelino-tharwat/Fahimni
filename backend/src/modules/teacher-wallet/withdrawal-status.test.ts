import { describe, it, expect } from "vitest";
import { AppError } from "../../shared/utils/AppError.js";
import { assertValidAdminTransition } from "./withdrawal-status.js";
import type { TeacherWithdrawalStatus } from "../../generated/prisma/client.js";

function expectStepBack(current: TeacherWithdrawalStatus, target: TeacherWithdrawalStatus) {
  try {
    assertValidAdminTransition(current, target);
    throw new Error("expected assertValidAdminTransition to throw");
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("WITHDRAWAL_STATUS_STEP_BACK_NOT_ALLOWED");
    expect((err as AppError).statusCode).toBe(409);
  }
}

function expectInvalid(current: TeacherWithdrawalStatus, target: TeacherWithdrawalStatus) {
  try {
    assertValidAdminTransition(current, target);
    throw new Error("expected assertValidAdminTransition to throw");
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("WITHDRAWAL_INVALID_STATUS_TRANSITION");
    expect((err as AppError).statusCode).toBe(409);
  }
}

describe("assertValidAdminTransition", () => {
  it("allows PENDING -> PROCESSING, TRANSFERRED, REJECTED", () => {
    expect(() => assertValidAdminTransition("PENDING", "PROCESSING")).not.toThrow();
    expect(() => assertValidAdminTransition("PENDING", "TRANSFERRED")).not.toThrow();
    expect(() => assertValidAdminTransition("PENDING", "REJECTED")).not.toThrow();
  });

  it("allows PROCESSING -> TRANSFERRED, REJECTED", () => {
    expect(() => assertValidAdminTransition("PROCESSING", "TRANSFERRED")).not.toThrow();
    expect(() => assertValidAdminTransition("PROCESSING", "REJECTED")).not.toThrow();
  });

  it("rejects PROCESSING -> PENDING as a step-back", () => {
    expectStepBack("PROCESSING", "PENDING");
  });

  it("rejects any final status reverting to PENDING/PROCESSING as a step-back", () => {
    expectStepBack("TRANSFERRED", "PENDING");
    expectStepBack("TRANSFERRED", "PROCESSING");
    expectStepBack("REJECTED", "PENDING");
    expectStepBack("REJECTED", "PROCESSING");
    expectStepBack("CANCELLED", "PENDING");
    expectStepBack("CANCELLED", "PROCESSING");
  });

  it("rejects sibling-final-to-sibling-final moves as a generic invalid transition", () => {
    expectInvalid("TRANSFERRED", "REJECTED");
    expectInvalid("TRANSFERRED", "CANCELLED");
    expectInvalid("REJECTED", "TRANSFERRED");
    expectInvalid("REJECTED", "CANCELLED");
    expectInvalid("CANCELLED", "TRANSFERRED");
    expectInvalid("CANCELLED", "REJECTED");
  });

  it("rejects PENDING -> CANCELLED via the admin transition (teacher-only action)", () => {
    expectInvalid("PENDING", "CANCELLED");
  });

  it("rejects no-op self-transitions on final states", () => {
    expectInvalid("TRANSFERRED", "TRANSFERRED");
    expectInvalid("REJECTED", "REJECTED");
    expectInvalid("CANCELLED", "CANCELLED");
  });
});
