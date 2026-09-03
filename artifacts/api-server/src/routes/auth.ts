import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { appAccountsTable, appSessionsTable, db } from "@workspace/db";
import {
  createSessionToken,
  ensureBootstrapAccounts,
  hashPin,
  hashSessionToken,
  isValidPhone,
  isValidPin,
  normalizePhone,
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionExpiry,
  verifyPin,
} from "../lib/internalAuth";
import {
  getRequestSessionToken,
  requireAccountAdmin,
  requireAuth,
  type AuthenticatedRequest,
} from "../middlewares/requireAuth";

const router: IRouter = Router();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; windowStartedAt: number }>();

function loginAttemptKey(ip: string | undefined, phone: string): string {
  return `${ip ?? "unknown"}:${phone}`;
}

function isLoginBlocked(key: string): boolean {
  const attempt = loginAttempts.get(key);
  if (!attempt) return false;
  if (Date.now() - attempt.windowStartedAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function registerFailedLogin(key: string): void {
  const attempt = loginAttempts.get(key);
  if (!attempt || Date.now() - attempt.windowStartedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStartedAt: Date.now() });
    return;
  }
  attempt.count += 1;
}

function accountDto(account: typeof appAccountsTable.$inferSelect) {
  return {
    id: account.id,
    name: account.name,
    phone: account.phone,
    canManageAccounts: account.canManageAccounts,
    active: account.active,
  };
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const phone = normalizePhone(String(req.body?.phone ?? ""));
  const pin = String(req.body?.pin ?? "");
  if (!isValidPhone(phone) || !isValidPin(pin)) {
    res.status(400).json({ error: "أدخل رقم هاتف صحيحًا ورمز PIN من 4 إلى 8 أرقام." });
    return;
  }

  const attemptKey = loginAttemptKey(req.ip, phone);
  if (isLoginBlocked(attemptKey)) {
    res.status(429).json({ error: "محاولات كثيرة. انتظر 15 دقيقة ثم حاول مجددًا." });
    return;
  }

  await ensureBootstrapAccounts();
  const [account] = await db.select().from(appAccountsTable).where(eq(appAccountsTable.phone, phone)).limit(1);
  if (!account || !account.active || !(await verifyPin(pin, account.pinHash))) {
    registerFailedLogin(attemptKey);
    res.status(401).json({ error: "رقم الهاتف أو رمز PIN غير صحيح." });
    return;
  }
  loginAttempts.delete(attemptKey);

  const token = createSessionToken();
  const expiresAt = sessionExpiry();
  await db.insert(appSessionsTable).values({
    accountId: account.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
  res.json({ token, account: accountDto(account), expiresAt: expiresAt.toISOString() });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = getRequestSessionToken(req);
  if (token) {
    await db.delete(appSessionsTable).where(eq(appSessionsTable.tokenHash, hashSessionToken(token)));
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(204).send();
});

router.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  res.json(req.account);
});

router.get("/auth/accounts", requireAccountAdmin, async (_req, res): Promise<void> => {
  await ensureBootstrapAccounts();
  const accounts = await db.select().from(appAccountsTable).orderBy(appAccountsTable.id);
  res.json(accounts.map(accountDto));
});

router.post("/auth/accounts", requireAccountAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const name = String(req.body?.name ?? "").trim();
  const phone = normalizePhone(String(req.body?.phone ?? ""));
  const pin = String(req.body?.pin ?? "");
  const canManageAccounts = req.body?.canManageAccounts === true;

  if (name.length < 2 || !isValidPhone(phone) || !isValidPin(pin)) {
    res.status(400).json({ error: "أدخل الاسم ورقم هاتف صحيحًا ورمز PIN من 4 إلى 8 أرقام." });
    return;
  }

  try {
    const [created] = await db.insert(appAccountsTable).values({
      name,
      phone,
      pinHash: await hashPin(pin),
      canManageAccounts,
    }).returning();
    res.status(201).json(accountDto(created));
  } catch {
    res.status(409).json({ error: "رقم الهاتف مستخدم في حساب آخر." });
  }
});

router.patch("/auth/pin", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const currentPin = String(req.body?.currentPin ?? "");
  const newPin = String(req.body?.newPin ?? "");
  if (!isValidPin(newPin)) {
    res.status(400).json({ error: "رمز PIN الجديد يجب أن يتكون من 4 إلى 8 أرقام." });
    return;
  }

  const [account] = await db.select().from(appAccountsTable).where(eq(appAccountsTable.id, req.account.id)).limit(1);
  if (!account || !(await verifyPin(currentPin, account.pinHash))) {
    res.status(401).json({ error: "رمز PIN الحالي غير صحيح." });
    return;
  }

  await db.update(appAccountsTable).set({
    pinHash: await hashPin(newPin),
    updatedAt: new Date(),
  }).where(eq(appAccountsTable.id, account.id));
  res.status(204).send();
});

export default router;