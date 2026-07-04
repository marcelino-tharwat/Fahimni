/**
 * Sanitize a filename for Content-Disposition headers.
 * Strips CRLF and control characters; provides ASCII fallback.
 */
export function sanitizeContentDispositionFilename(displayName: string): {
  filename: string;
  filenameStar: string;
} {
  const cleaned = displayName
    .replace(/[\r\n\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, 200);

  const safe = cleaned.length > 0 ? cleaned : "material.pdf";
  const asciiFallback =
    safe.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_") || "material.pdf";

  return { filename: asciiFallback, filenameStar: safe };
}

export function buildContentDisposition(
  displayName: string,
  disposition: "attachment" | "inline",
): string {
  const { filename, filenameStar } = sanitizeContentDispositionFilename(displayName);
  const encoded = encodeURIComponent(filenameStar);
  return `${disposition}; filename="${filename}"; filename*=UTF-8''${encoded}`;
}
