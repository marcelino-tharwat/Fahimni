import { v5 as uuidv5 } from "uuid";

/** Stable namespace for all Chemistry demo seed UUIDs (v5). */
export const CHEMISTRY_SEED_NAMESPACE =
  "4f2a05db-e8cb-4b85-a4f1-45cd56e902c7";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Deterministic, valid UUID for a Chemistry seed logical key. */
export function seedId(key: string): string {
  const value = uuidv5(`fahimni-chemistry:${key}`, CHEMISTRY_SEED_NAMESPACE);
  assertValidSeedUuid(value, key);
  return value;
}

export function assertValidSeedUuid(value: string, label: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid seed UUID for ${label}`);
  }
}

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}
