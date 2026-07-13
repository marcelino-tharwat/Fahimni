import bcrypt from "bcryptjs";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { Prisma } from "../src/generated/prisma/client.js";

const BCRYPT_ROUNDS = 12;
const SHARED_PASSWORD = process.env.SEED_SHARED_PASSWORD ?? "Pass@1234";

let passwordHash: string | null = null;

export async function getPasswordHash(): Promise<string> {
  if (!passwordHash) {
    passwordHash = await bcrypt.hash(SHARED_PASSWORD, BCRYPT_ROUNDS);
  }
  return passwordHash;
}

export const SHARED_PASSWORD_CLEAR = SHARED_PASSWORD;

const now = new Date();

export function daysAgo(d: number): Date {
  return new Date(now.getTime() - d * 86400000);
}

export function daysFromNow(d: number): Date {
  return new Date(now.getTime() + d * 86400000);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function randomSubset<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export function randomMobile(): string {
  const prefixes = ["010", "011", "012", "015"];
  const prefix = randomChoice(prefixes);
  const suffix = String(randomInt(10000000, 99999999));
  return prefix + suffix;
}

export function generateEmail(fullName: string, domain = "fahimni.com"): string {
  const latin = fullName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .join(".")
    .toLowerCase();
  return `${latin}@${domain}`;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function withCountLog<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`  ✓ ${label} (${elapsed}s)`);
    return result;
  } catch (err) {
    console.error(`  ✗ ${label} failed:`, err);
    throw err;
  }
}
