import { v5 as uuidv5 } from "uuid";

export const SEED_NAMESPACE = "7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function seedId(key: string): string {
  const value = uuidv5(`fahimni-large-seed:${key}`, SEED_NAMESPACE);
  assertValid(value, key);
  return value;
}

export function assertValid(value: string, label: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid seed UUID for ${label}`);
  }
}
