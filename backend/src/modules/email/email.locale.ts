import type { EmailLocale } from "./email.types.js";

export function resolveEmailLocale(...candidates: Array<string | null | undefined>): EmailLocale {
  for (const candidate of candidates) {
    const value = candidate?.trim().toLowerCase();
    if (!value) continue;
    if (value === "ar" || value.startsWith("ar-") || value.includes("ar;q")) return "ar";
    if (value === "en" || value.startsWith("en-") || value.includes("en;q")) return "en";
  }
  return "ar";
}

export function localeDirection(locale: EmailLocale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
