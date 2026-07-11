import { describe, expect, it, vi } from "vitest";
import { EmailService } from "./email.service.js";
import { getEmailConfig } from "./email.provider.js";
import { renderEmailTemplate } from "./email.templates.js";
import type { EmailProvider, EmailTemplateName } from "./email.types.js";

const templates: EmailTemplateName[] = [
  "teacherRegistrationSubmitted",
  "teacherRegistrationApproved",
  "teacherRegistrationRejected",
  "teacherRegistrationResubmitted",
  "teacherWithdrawalRequested",
  "teacherWithdrawalStatusChanged",
  "studentPaymentSuccess",
  "quizAttemptGraded",
  "passwordReset",
  "genericAdminNotification",
];

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
    const result = await new EmailService(
      provider,
      getEmailConfig({ EMAIL_ENABLED: "true", EMAIL_DRY_RUN: "true", EMAIL_HOST: "smtp.local" } as NodeJS.ProcessEnv),
    ).sendEmail({ to: "student@example.test", template: "studentPaymentSuccess", locale: "en" });

    expect(result.dryRun).toBe(true);
    expect(result.sent).toBe(false);
    expect(provider.send).not.toHaveBeenCalled();
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
