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
  from: string;
  clientUrl: string;
  adminEmail: string;
}

export function getEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailRuntimeConfig {
  const smtpPort = numberFromEnv(env.EMAIL_PORT, 587);

  return {
    enabled: boolFromEnv(env.EMAIL_ENABLED, false),
    provider: "smtp",
    dryRun: boolFromEnv(env.EMAIL_DRY_RUN, true),
    smtpHost: env.EMAIL_HOST ?? "",
    smtpPort,
    smtpSecure: smtpPort === 465,
    smtpUser: env.EMAIL_USER ?? "",
    smtpPass: env.EMAIL_PASS ?? "",
    from: env.EMAIL_FROM ?? "",
    clientUrl: env.CLIENT_URL ?? "http://localhost:5173",
    adminEmail: env.ADMIN_EMAIL ?? "",
  };
}

export function getSafeEmailConfigSummary(config: EmailRuntimeConfig = getEmailConfig()) {
  return {
    enabled: config.enabled,
    dryRun: config.dryRun,
    provider: config.provider,
    hostConfigured: Boolean(config.smtpHost),
    userConfigured: Boolean(config.smtpUser),
    fromConfigured: Boolean(config.from),
    clientUrlConfigured: Boolean(config.clientUrl),
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
        connectionTimeout: 60_000,
        greetingTimeout: 60_000,
        socketTimeout: 60_000,
        auth:
          this.config.smtpUser && this.config.smtpPass
            ? { user: this.config.smtpUser, pass: this.config.smtpPass }
            : undefined,
      });
    }
    return this.transporter.sendMail(input);
  }
}
