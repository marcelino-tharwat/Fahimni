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
  provider: "smtp";
  dryRun: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpRequireTls: boolean;
  smtpFamily: 4;
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
    smtpHost: stringFromEnv(env.EMAIL_HOST),
    smtpPort,
    smtpSecure: smtpPort === 465,
    smtpRequireTls: smtpPort === 587,
    smtpFamily: 4,
    smtpUser: stringFromEnv(env.EMAIL_USER),
    smtpPass: stringFromEnv(env.EMAIL_PASS),
    from: stringFromEnv(env.EMAIL_FROM),
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
