import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { appAccountsTable, db } from "@workspace/db";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = "elan_session";
export const SESSION_DAYS = 30;

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPhone(phone: string): boolean {
  return /^05\d{8}$/.test(phone);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(pin, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(pin, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(): Date {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  return expires;
}

export async function ensureBootstrapAccounts(): Promise<void> {
  const accounts = [
    { name: "فادي حمد", phone: "0592116407", pin: "6407" },
    { name: "محمود الكرنز", phone: "0597937805", pin: "7805" },
  ];

  for (const account of accounts) {
    await db
      .insert(appAccountsTable)
      .values({
        name: account.name,
        phone: account.phone,
        pinHash: await hashPin(account.pin),
        canManageAccounts: true,
      })
      .onConflictDoNothing({ target: appAccountsTable.phone });
  }
}