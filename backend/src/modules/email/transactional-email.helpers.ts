import { emailService } from "./email.service.js";
import type { EmailTemplateName } from "./email.types.js";

export function normalizeLocale(locale?: string | null): "ar" | "en" {
  return locale === "en" ? "en" : "ar";
}

export async function sendTransactionalEmail(input: {
  to: string | null;
  template: EmailTemplateName;
  locale?: string | null;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!input.to) return;
  const payload = {
    to: input.to,
    template: input.template,
    locale: normalizeLocale(input.locale),
    critical: false,
    ...(input.data ? { data: input.data } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
  await emailService.sendEmail(payload);
}
