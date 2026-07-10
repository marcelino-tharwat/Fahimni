import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailProvider } from "./email.types.js";

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true";
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface EmailRuntimeConfig {
  enabled: boolean;
  provider: "smtp";
  dryRun: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromAddress: string;
  from: string;
  appBaseUrl: string;
  adminEmail: string;
}

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailRuntimeConfig {
  const legacyFrom = env.EMAIL_FROM ?? "";
  const legacyMatch = legacyFrom.match(/^(.*)<([^>]+)>$/);
  const fromName = env.MAIL_FROM_NAME ?? legacyMatch?.[1]?.trim().replace(/^"|"$/g, "") ?? "Fahimni";
  const fromAddress =
    env.MAIL_FROM_ADDRESS ?? legacyMatch?.[2]?.trim() ?? legacyFrom.trim() ?? "no-reply@fahimni.local";

  return {
    enabled: boolFromEnv(env.EMAIL_ENABLED, false),
    provider: "smtp",
    dryRun: boolFromEnv(env.EMAIL_DRY_RUN, true),
    smtpHost: env.SMTP_HOST ?? env.EMAIL_HOST ?? "",
    smtpPort: numberFromEnv(env.SMTP_PORT ?? env.EMAIL_PORT, 587),
    smtpSecure: boolFromEnv(env.SMTP_SECURE, false),
    smtpUser: env.SMTP_USER ?? env.EMAIL_USER ?? "",
    smtpPass: env.SMTP_PASS ?? env.EMAIL_PASS ?? "",
    fromName,
    fromAddress,
    from: `"${fromName}" <${fromAddress}>`,
    appBaseUrl: env.APP_BASE_URL ?? env.FRONTEND_BASE_URL ?? env.CLIENT_URL ?? "http://localhost:5173",
    adminEmail: env.ADMIN_EMAIL ?? "",
  };
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter?: Transporter;

  constructor(private readonly config: EmailRuntimeConfig) {}

  async send(input: Parameters<EmailProvider["send"]>[0]): Promise<unknown> {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth:
          this.config.smtpUser && this.config.smtpPass
            ? { user: this.config.smtpUser, pass: this.config.smtpPass }
            : undefined,
      });
    }
    return this.transporter.sendMail(input);
  }
}
