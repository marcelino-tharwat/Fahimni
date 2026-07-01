import { env } from "./env.js";

export type LogMeta = Record<string, unknown>;

function coerceMeta(meta?: unknown): LogMeta | undefined {
  if (meta === undefined) return undefined;
  if (typeof meta === "string") return { message: meta };
  if (meta instanceof Error) {
    return { errorName: meta.name, message: meta.message };
  }
  if (typeof meta === "object" && meta !== null) {
    return meta as LogMeta;
  }
  return { detail: String(meta) };
}

function serialize(level: string, event: string, meta?: unknown): string {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    ...(coerceMeta(meta) ?? {}),
  };
  return env.NODE_ENV === "production"
    ? JSON.stringify(payload)
    : JSON.stringify(payload, null, 0);
}

function write(
  stream: (message?: unknown, ...optionalParams: unknown[]) => void,
  level: string,
  event: string,
  meta?: unknown,
): void {
  stream(serialize(level, event, meta));
}

/** Single application logger — stdout JSON lines (readable under tsx in development). */
export const logger = {
  info: (event: string, meta?: unknown) => write(console.info, "info", event, meta),
  warn: (event: string, meta?: unknown) => write(console.warn, "warn", event, meta),
  error: (event: string, meta?: unknown) => write(console.error, "error", event, meta),
  debug: (event: string, meta?: unknown) => {
    if (env.NODE_ENV === "test") return;
    write(console.debug, "debug", event, meta);
  },
};
