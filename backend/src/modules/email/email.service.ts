import { z } from "zod";
import { getEmailConfig, SmtpEmailProvider, type EmailRuntimeConfig } from "./email.provider.js";
import { resolveEmailLocale } from "./email.locale.js";
import { renderEmailTemplate } from "./email.templates.js";
import type { EmailProvider, EmailSendResult, SendEmailInput } from "./email.types.js";

const recipientSchema = z.string().trim().email();

export class EmailService {
  private readonly config: EmailRuntimeConfig;
  private readonly provider: EmailProvider;

  constructor(provider?: EmailProvider, config: EmailRuntimeConfig = getEmailConfig()) {
    this.config = config;
    this.provider = provider ?? new SmtpEmailProvider(config);
  }

  async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    const parsedTo = recipientSchema.safeParse(input.to);
    if (!parsedTo.success) {
      throw new Error("Invalid email recipient");
    }

    const locale = resolveEmailLocale(input.locale);
    const rendered = renderEmailTemplate(input.template, locale, input.data ?? {});
    const result: EmailSendResult = {
      sent: false,
      dryRun: this.config.dryRun,
      skipped: !this.config.enabled,
      template: input.template,
      locale,
      subject: rendered.subject,
    };

    if (!this.config.enabled || this.config.dryRun) {
      console.info("[EmailService] email skipped", {
        to: parsedTo.data,
        template: input.template,
        subject: rendered.subject,
        locale,
        dryRun: this.config.dryRun,
        disabled: !this.config.enabled,
      });
      return result;
    }

    const missingConfig = [
      !this.config.smtpHost ? "EMAIL_HOST" : "",
      !this.config.smtpUser ? "EMAIL_USER" : "",
      !this.config.smtpPass ? "EMAIL_PASS" : "",
      !this.config.from ? "EMAIL_FROM" : "",
    ].filter(Boolean);

    if (missingConfig.length > 0) {
      console.warn("[EmailService] SMTP config missing", {
        to: parsedTo.data,
        template: input.template,
        subject: rendered.subject,
        locale,
        dryRun: this.config.dryRun,
        missing: missingConfig,
      });
      if (input.critical) {
        throw new Error(`${missingConfig.join(", ")} required when email sending is enabled`);
      }
      return result;
    }

    try {
      await this.provider.send({
        to: parsedTo.data,
        from: this.config.from,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      return { ...result, sent: true, skipped: false };
    } catch (error) {
      if (input.critical) throw error;
      console.warn("[EmailService] non-critical email failed", {
        template: input.template,
        to: parsedTo.data,
        metadata: input.metadata,
        error: error instanceof Error ? error.message : String(error),
      });
      return result;
    }
  }
}

export const emailService = new EmailService();
