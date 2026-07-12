import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import type { EmailProvider } from "./email.types.js";

const SMTP_TIMEOUT_MS = 60_000;

type GmailSmtpOptions = SMTPTransport.Options & {
  family: 4;
};

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true";
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringFromEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export interface EmailRuntimeConfig {
  enabled: boolean;
  provider: "smtp" | "resend";
  dryRun: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpRequireTls: boolean;
  smtpFamily: 4;
  smtpUser: string;
  smtpPass: string;
  resendApiKey: string;
  from: string;
  replyTo: string;
  clientUrl: string;
  adminEmail: string;
}

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailRuntimeConfig {
  const smtpPort = numberFromEnv(env.EMAIL_PORT, 587);

  return {
    enabled: boolFromEnv(env.EMAIL_ENABLED, false),
    provider: env.EMAIL_PROVIDER === "resend" ? "resend" : "smtp",
    dryRun: boolFromEnv(env.EMAIL_DRY_RUN, true),
    smtpHost: stringFromEnv(env.EMAIL_HOST),
    smtpPort,
    smtpSecure: smtpPort === 465,
    smtpRequireTls: smtpPort === 587,
    smtpFamily: 4,
    smtpUser: stringFromEnv(env.EMAIL_USER),
    smtpPass: stringFromEnv(env.EMAIL_PASS),
    resendApiKey: stringFromEnv(env.RESEND_API_KEY),
    from: stringFromEnv(env.EMAIL_FROM),
    replyTo: stringFromEnv(env.EMAIL_REPLY_TO),
    clientUrl: stringFromEnv(env.CLIENT_URL) || "http://localhost:5173",
    adminEmail: stringFromEnv(env.ADMIN_EMAIL),
  };
}

export function getSafeEmailConfigSummary(config: EmailRuntimeConfig = getEmailConfig()) {
  return {
    enabled: config.enabled,
    dryRun: config.dryRun,
    provider: config.provider,
    hostConfigured: Boolean(config.smtpHost),
    port: config.smtpPort,
    secure: config.smtpSecure,
    requireTLS: config.smtpRequireTls,
    family: config.smtpFamily,
    userConfigured: Boolean(config.smtpUser),
    resendConfigured: Boolean(config.resendApiKey),
    fromConfigured: Boolean(config.from),
    clientUrlConfigured: Boolean(config.clientUrl),
  };
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter?: Transporter;

  constructor(private readonly config: EmailRuntimeConfig) {}

  getSafeTransportSummary() {
    return {
      hostConfigured: Boolean(this.config.smtpHost),
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      requireTLS: this.config.smtpRequireTls,
      family: this.config.smtpFamily,
      userConfigured: Boolean(this.config.smtpUser),
      fromConfigured: Boolean(this.config.from),
    };
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const options: GmailSmtpOptions = {
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        requireTLS: this.config.smtpRequireTls,
        family: this.config.smtpFamily,
        connectionTimeout: SMTP_TIMEOUT_MS,
        greetingTimeout: SMTP_TIMEOUT_MS,
        socketTimeout: SMTP_TIMEOUT_MS,
        auth:
          this.config.smtpUser && this.config.smtpPass
            ? { user: this.config.smtpUser, pass: this.config.smtpPass }
            : undefined,
      };
      this.transporter = nodemailer.createTransport(options);
    }
    return this.transporter;
  }

  async verify(): Promise<boolean> {
    return this.getTransporter().verify();
  }

  async send(input: Parameters<EmailProvider["send"]>[0]): Promise<unknown> {
    return this.getTransporter().sendMail(input);
  }
}

const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly config: EmailRuntimeConfig) {}

  async send(input: Parameters<EmailProvider["send"]>[0]): Promise<{ messageId?: string }> {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.headers ? { headers: input.headers } : {}),
      }),
    });

    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };

    if (!response.ok) {
      throw new Error(`Resend API error (${response.status}): ${body.message ?? "unknown error"}`);
    }

    // Normalized to `.messageId` (rather than Resend's native `.id`) so the
    // existing providerMessageId() helper in email.service.ts works unchanged
    // for either provider.
    return body.id ? { messageId: body.id } : {};
  }
}

export function createEmailProvider(config: EmailRuntimeConfig): EmailProvider {
  return config.provider === "resend" ? new ResendEmailProvider(config) : new SmtpEmailProvider(config);
}
