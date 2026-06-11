export function resolveTenantSlug(): string | null {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length > 2) return parts[0];
  const match = window.location.pathname.match(/^\/t\/([^/]+)/);
  if (match) return match[1];
  return null;
}
