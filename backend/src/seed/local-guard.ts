/**
 * Local-only safety guard for the development seed.
 *
 * Refuses to run against anything that looks like a production / remote
 * database. Never prints the password or the full connection string.
 */

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres", // docker-compose service name
  "db",
  "host.docker.internal",
]);

export class SeedGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedGuardError";
  }
}

/** Extract only the hostname from a connection string, without credentials. */
export function extractHost(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null;
  try {
    // Normalize the postgres scheme so the URL parser accepts it.
    const u = new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "http://"));
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export interface GuardInput {
  nodeEnv: string | undefined;
  databaseUrl: string | undefined;
  /** Explicit production flag, if any. */
  productionFlag?: string | undefined;
}

/**
 * Throws {@link SeedGuardError} when the environment is not a verified local
 * development database. Returns the safe (credential-free) host on success.
 */
export function assertLocalDatabase(input: GuardInput): string {
  const abort = (reason: string): never => {
    throw new SeedGuardError(
      `Seed aborted: this seed is allowed only against a local development database. (${reason})`,
    );
  };

  if ((input.nodeEnv ?? "").toLowerCase() === "production") {
    return abort("NODE_ENV=production");
  }

  if (
    input.productionFlag &&
    ["1", "true", "yes", "production"].includes(
      input.productionFlag.toLowerCase(),
    )
  ) {
    return abort("explicit production flag is set");
  }

  const host = extractHost(input.databaseUrl);
  if (!host) {
    return abort("DATABASE_URL is missing or unparseable");
  }

  if (!LOCAL_HOSTS.has(host)) {
    // Do not echo the URL; only state that the host is not recognized as local.
    return abort("database host is not a recognized local host");
  }

  return host;
}
