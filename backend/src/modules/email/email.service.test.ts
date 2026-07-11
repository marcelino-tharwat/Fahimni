import { describe, expect, it, vi } from "vitest";
import { EmailService } from "./email.service.js";
import type { EmailLogRecordInput, EmailLogStore } from "./email.service.js";
import { getEmailConfig } from "./email.provider.js";
import { renderEmailTemplate } from "./email.templates.js";
import type { EmailProvider, EmailTemplateName } from "./email.types.js";

const templates: EmailTemplateName[] = [
  "teacherRegistrationSubmitted",
  "teacherRegistrationApproved",
  "teacherRegistrationRejected",
  "teacherRegistrationResubmitted",
  "studentWelcome",
  "teacherWithdrawalRequested",
  "teacherWithdrawalStatusChanged",
  "studentPaymentSuccess",
  "quizAttemptGraded",
  "passwordReset",
  "genericAdminNotification",
];

function memoryLogStore(deliveredKeys: string[] = []) {
  const records: EmailLogRecordInput[] = [];
  const delivered = new Set(deliveredKeys);
  const store: EmailLogStore = {
    async findDeliveredByDedupeKey(dedupeKey: string) {
      return delivered.has(dedupeKey);
    },
    async record(input: EmailLogRecordInput) {
      records.push(input);
      if ((input.status === "SENT" || input.status === "DRY_RUN") && input.dedupeKey) {
        delivered.add(input.dedupeKey);
      }
    },
  };
  return { store, records };
}

describe("EmailService", () => {
  it("reuses the injected provider and canonical email env config", async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({}) };
    const config = getEmailConfig({
      EMAIL_ENABLED: "true",
      EMAIL_DRY_RUN: "false",
      EMAIL_HOST: "smtp.local",
      EMAIL_PORT: "2525",
      EMAIL_USER: "smtp-user",
      EMAIL_PASS: "smtp-pass",
      EMAIL_FROM: '"Fahimni" <canonical@example.test>',
      CLIENT_URL: "https://client.example.test",
    } as NodeJS.ProcessEnv);

    await new EmailService(provider, config).sendEmail({
      to: "teacher@example.test",
      template: "teacherRegistrationApproved",
      locale: "en",
    });

    expect(provider.send).toHaveBeenCalledOnce();
    expect(config.smtpHost).toBe("smtp.local");
    expect(config.smtpPort).toBe(2525);
    expect(config.smtpSecure).toBe(false);
    expect(config.from).toBe('"Fahimni" <canonical@example.test>');
    expect(config.clientUrl).toBe("https://client.example.test");
  });

  it("renders Arabic templates as RTL", () => {
    const email = renderEmailTemplate("teacherRegistrationSubmitted", "ar", { referenceNumber: "TR-1" });
    expect(email.html).toContain('dir="rtl"');
    expect(email.html).toContain("فاهمني");
  });

  it("renders English templates as LTR", () => {
    const email = renderEmailTemplate("teacherRegistrationSubmitted", "en", { referenceNumber: "TR-1" });
    expect(email.html).toContain('dir="ltr"');
    expect(email.subject).toContain("Fahimni");
  });

  it("applies Fahimni brand colors", () => {
    const email = renderEmailTemplate("studentPaymentSuccess", "en", { amount: "100 EGP" });
    expect(email.html).toContain("#0F0A2B");
    expect(email.html).toContain("#00C9DB");
  });

  it("has text fallback for every template", () => {
    for (const template of templates) {
      expect(renderEmailTemplate(template, "en", { amount: "10", quizTitle: "Quiz" }).text.length).toBeGreaterThan(20);
      expect(renderEmailTemplate(template, "ar", { amount: "10", quizTitle: "اختبار" }).text.length).toBeGreaterThan(20);
    }
  });

  it("dry-run does not send externally", async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({}) };
    const logs = memoryLogStore();
    const result = await new EmailService(
      provider,
      getEmailConfig({ EMAIL_ENABLED: "true", EMAIL_DRY_RUN: "true", EMAIL_HOST: "smtp.local" } as NodeJS.ProcessEnv),
      logs.store,
    ).sendEmail({
      to: "student@example.test",
      template: "studentPaymentSuccess",
      locale: "en",
      dedupeKey: "payment-1:SUCCESS:studentPaymentSuccess",
    });

    expect(result.dryRun).toBe(true);
    expect(result.sent).toBe(false);
    expect(provider.send).not.toHaveBeenCalled();
    expect(logs.records).toMatchObject([{ status: "DRY_RUN", dedupeKey: "payment-1:SUCCESS:studentPaymentSuccess" }]);
  });

  it("real mode calls the provider and reports the provider message id", async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({ messageId: "smtp-1" }) };
    const logs = memoryLogStore();
    const result = await new EmailService(
      provider,
      getEmailConfig({
        EMAIL_ENABLED: "true",
        EMAIL_DRY_RUN: "false",
        EMAIL_HOST: "smtp.local",
        EMAIL_USER: "smtp-user",
        EMAIL_PASS: "smtp-pass",
        EMAIL_FROM: '"Fahimni" <no-reply@example.test>',
      } as NodeJS.ProcessEnv),
      logs.store,
    ).sendEmail({
      to: "student@example.test",
      template: "studentWelcome",
      locale: "en",
      entityType: "User",
      entityId: "student-1",
      dedupeKey: "student-1:studentWelcome",
    });

    expect(result.sent).toBe(true);
    expect(result.providerMessageId).toBe("smtp-1");
    expect(provider.send).toHaveBeenCalledOnce();
    expect(logs.records).toMatchObject([
      {
        status: "SENT",
        providerMessageId: "smtp-1",
        entityType: "User",
        entityId: "student-1",
        dedupeKey: "student-1:studentWelcome",
      },
    ]);
  });

  it("logs failed real sends safely", async () => {
    const provider: EmailProvider = { send: vi.fn().mockRejectedValue(new Error("SMTP timeout")) };
    const logs = memoryLogStore();
    const result = await new EmailService(
      provider,
      getEmailConfig({
        EMAIL_ENABLED: "true",
        EMAIL_DRY_RUN: "false",
        EMAIL_HOST: "smtp.local",
        EMAIL_USER: "smtp-user",
        EMAIL_PASS: "smtp-pass",
        EMAIL_FROM: '"Fahimni" <no-reply@example.test>',
      } as NodeJS.ProcessEnv),
      logs.store,
    ).sendEmail({ to: "student@example.test", template: "studentWelcome", locale: "en" });

    expect(result.sent).toBe(false);
    expect(logs.records).toMatchObject([{ status: "FAILED", errorMessage: "SMTP timeout" }]);
  });

  it("skips duplicate dedupe keys without calling the provider", async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({ messageId: "smtp-1" }) };
    const logs = memoryLogStore(["student-1:studentWelcome"]);
    const result = await new EmailService(
      provider,
      getEmailConfig({
        EMAIL_ENABLED: "true",
        EMAIL_DRY_RUN: "false",
        EMAIL_HOST: "smtp.local",
        EMAIL_USER: "smtp-user",
        EMAIL_PASS: "smtp-pass",
        EMAIL_FROM: '"Fahimni" <no-reply@example.test>',
      } as NodeJS.ProcessEnv),
      logs.store,
    ).sendEmail({
      to: "student@example.test",
      template: "studentWelcome",
      locale: "en",
      dedupeKey: "student-1:studentWelcome",
    });

    expect(result.skipped).toBe(true);
    expect(provider.send).not.toHaveBeenCalled();
    expect(logs.records).toMatchObject([{ status: "SKIPPED_DUPLICATE" }]);
  });

  it("does not send when enabled without required canonical SMTP config", async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({}) };
    const result = await new EmailService(
      provider,
      getEmailConfig({ EMAIL_ENABLED: "true", EMAIL_DRY_RUN: "false", EMAIL_HOST: "smtp.local" } as NodeJS.ProcessEnv),
    ).sendEmail({ to: "student@example.test", template: "studentPaymentSuccess", locale: "en" });

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(false);
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("rejects invalid recipients", async () => {
    await expect(
      new EmailService({ send: vi.fn() }, getEmailConfig({} as NodeJS.ProcessEnv)).sendEmail({
        to: "not-an-email",
        template: "passwordReset",
        locale: "en",
      }),
    ).rejects.toThrow("Invalid email recipient");
  });

  it("escapes dynamic values", () => {
    const email = renderEmailTemplate("quizAttemptGraded", "en", {
      quizTitle: '<script>alert("x")</script>',
      score: "10",
    });
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain('<script>alert("x")</script>');
  });

  it("falls back to Arabic locale", () => {
    const email = renderEmailTemplate("passwordReset", undefined, {});
    expect(email.html).toContain('lang="ar"');
  });

  it("does not require SMTP credentials while disabled", async () => {
    const provider: EmailProvider = { send: vi.fn() };
    const result = await new EmailService(provider, getEmailConfig({ EMAIL_ENABLED: "false" } as NodeJS.ProcessEnv)).sendEmail({
      to: "student@example.test",
      template: "passwordReset",
    });
    expect(result.skipped).toBe(true);
    expect(provider.send).not.toHaveBeenCalled();
  });
});
