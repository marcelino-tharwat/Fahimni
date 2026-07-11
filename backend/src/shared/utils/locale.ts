export type Locale = "en" | "ar";

/** Resolve the response locale from the `Accept-Language` header. Defaults to English. */
export function getRequestLocale(req: {
  headers?: { "accept-language"?: string | string[] | undefined };
}): Locale {
  const header = req.headers?.["accept-language"];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.toLowerCase().startsWith("ar") ? "ar" : "en";
}
