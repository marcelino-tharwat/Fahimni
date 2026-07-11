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
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
}): Promise<void> {
  if (!input.to) return;
  const payload = {
    to: input.to,
    template: input.template,
    locale: normalizeLocale(input.locale),
    critical: false,
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    ...(input.data ? { data: input.data } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
  await emailService.sendEmail(payload);
}
