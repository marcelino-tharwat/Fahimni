import { z } from "zod";
import type { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { getEmailConfig, SmtpEmailProvider, type EmailRuntimeConfig } from "./email.provider.js";
import { resolveEmailLocale } from "./email.locale.js";
import { renderEmailTemplate } from "./email.templates.js";
import type { EmailProvider, EmailSendResult, SendEmailInput } from "./email.types.js";

const recipientSchema = z.string().trim().email();
const SMTP_SEND_TIMEOUT_MS = 60_000;

type EmailLogStatus = "SENT" | "FAILED" | "DRY_RUN" | "SKIPPED_DUPLICATE";

export interface EmailLogRecordInput {
  to: string;
  subject: string;
  template: string;
  locale: string;
  status: EmailLogStatus;
  providerMessageId?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  dedupeKey?: string | undefined;
  errorMessage?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  sentAt?: Date | undefined;
}

export interface EmailLogStore {
  findDeliveredByDedupeKey(dedupeKey: string): Promise<boolean>;
  record(input: EmailLogRecordInput): Promise<void>;
}

class PrismaEmailLogStore implements EmailLogStore {
  async findDeliveredByDedupeKey(dedupeKey: string): Promise<boolean> {
    const existing = await prisma.emailLog.findFirst({
      where: { dedupeKey, status: { in: ["SENT", "DRY_RUN"] } },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async record(input: EmailLogRecordInput): Promise<void> {
    const data: Prisma.EmailLogCreateInput = {
      to: input.to,
      subject: input.subject,
      template: input.template,
      locale: input.locale,
      status: input.status,
      ...(input.providerMessageId ? { providerMessageId: input.providerMessageId } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...((input.status === "SENT" || input.status === "DRY_RUN") && input.dedupeKey
        ? { dedupeKey: input.dedupeKey }
        : {}),
      ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
      ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
      ...(input.sentAt ? { sentAt: input.sentAt } : {}),
    };
    await prisma.emailLog.create({
      data,
    });
  }
}

function providerMessageId(response: unknown): string | undefined {
  if (typeof response !== "object" || response === null) return undefined;
  const value = (response as { messageId?: unknown }).messageId;
  return typeof value === "string" ? value : undefined;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`SMTP send timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class EmailService {
  private readonly config: EmailRuntimeConfig;
  private readonly provider: EmailProvider;
  private readonly logStore: EmailLogStore | undefined;

  constructor(
    provider?: EmailProvider,
    config: EmailRuntimeConfig = getEmailConfig(),
    logStore: EmailLogStore | undefined = process.env.NODE_ENV === "test" ? undefined : new PrismaEmailLogStore(),
  ) {
    this.config = config;
    this.provider = provider ?? new SmtpEmailProvider(config);
    this.logStore = logStore;
  }

  private async recordEmailLog(input: EmailLogRecordInput): Promise<void> {
    if (!this.logStore) return;
    try {
      await this.logStore.record(input);
    } catch (error) {
      logger.warn("email_log_write_failed", {
        template: input.template,
        status: input.status,
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async isDuplicate(dedupeKey?: string): Promise<boolean> {
    if (!dedupeKey || !this.logStore) return false;
    try {
      return await this.logStore.findDeliveredByDedupeKey(dedupeKey);
    } catch (error) {
      logger.warn("email_log_dedupe_check_failed", {
        dedupeKey,
        errorName: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
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

    if (await this.isDuplicate(input.dedupeKey)) {
      await this.recordEmailLog({
        to: parsedTo.data,
        subject: rendered.subject,
        template: input.template,
        locale,
        status: "SKIPPED_DUPLICATE",
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: input.dedupeKey,
        metadata: input.metadata,
      });
      logger.info("email_skipped_duplicate", {
        to: parsedTo.data,
        template: input.template,
        locale,
        entityType: input.entityType,
        entityId: input.entityId,
      });
      return { ...result, skipped: true };
    }

    if (!this.config.enabled || this.config.dryRun) {
      console.info("[EmailService] email skipped", {
        to: parsedTo.data,
        template: input.template,
        subject: rendered.subject,
        locale,
        dryRun: this.config.dryRun,
        disabled: !this.config.enabled,
      });
      await this.recordEmailLog({
        to: parsedTo.data,
        subject: rendered.subject,
        template: input.template,
        locale,
        status: "DRY_RUN",
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: input.dedupeKey,
        metadata: input.metadata,
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
      await this.recordEmailLog({
        to: parsedTo.data,
        subject: rendered.subject,
        template: input.template,
        locale,
        status: "FAILED",
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: input.dedupeKey,
        errorMessage: `EMAIL_CONFIG_MISSING: ${missingConfig.join(", ")}`,
        metadata: input.metadata,
      });
      return result;
    }

    try {
      logger.info("email_smtp_send_attempt", {
        to: parsedTo.data,
        template: input.template,
        locale,
        provider: this.config.provider,
      });
      const response = await withTimeout(
        this.provider.send({
          to: parsedTo.data,
          from: this.config.from,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
        SMTP_SEND_TIMEOUT_MS,
      );
      const messageId = providerMessageId(response);
      logger.info("email_smtp_send_succeeded", {
        to: parsedTo.data,
        template: input.template,
        locale,
        ...(messageId ? { providerMessageId: messageId } : {}),
      });
      await this.recordEmailLog({
        to: parsedTo.data,
        subject: rendered.subject,
        template: input.template,
        locale,
        status: "SENT",
        providerMessageId: messageId,
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: input.dedupeKey,
        metadata: input.metadata,
        sentAt: new Date(),
      });
      return { ...result, sent: true, skipped: false, ...(messageId ? { providerMessageId: messageId } : {}) };
    } catch (error) {
      if (input.critical) throw error;
      logger.warn("email_smtp_send_failed", {
        template: input.template,
        to: parsedTo.data,
        metadata: input.metadata,
        errorName: error instanceof Error ? error.name : "UnknownError",
        error: error instanceof Error ? error.message : String(error),
      });
      await this.recordEmailLog({
        to: parsedTo.data,
        subject: rendered.subject,
        template: input.template,
        locale,
        status: "FAILED",
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: input.dedupeKey,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: input.metadata,
      });
      return result;
    }
  }
}

export const emailService = new EmailService();
