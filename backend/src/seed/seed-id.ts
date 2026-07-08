import { v5 as uuidv5 } from "uuid";

export const SEED_NAMESPACE = "f5a0b1c2-d3e4-4f6a-a8bc-9d0e1f2a3b4c";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function seedId(key: string): string {
  const value = uuidv5(`fahimni-seed:${key}`, SEED_NAMESPACE);
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
