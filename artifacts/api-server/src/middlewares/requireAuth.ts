import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { appAccountsTable, appSessionsTable, db } from "@workspace/db";
import { hashSessionToken, SESSION_COOKIE } from "../lib/internalAuth";

export type AuthAccount = {
  id: number;
  name: string;
  phone: string;
  canManageAccounts: boolean;
};

export type AuthenticatedRequest = Request & {
  userId: string;
  account: AuthAccount;
};

export function getRequestSessionToken(req: Request): string | null {
  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  return typeof cookieToken === "string" && cookieToken ? cookieToken : null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getRequestSessionToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rows = await db
    .select({
      id: appAccountsTable.id,
      name: appAccountsTable.name,
      phone: appAccountsTable.phone,
      canManageAccounts: appAccountsTable.canManageAccounts,
    })
    .from(appSessionsTable)
    .innerJoin(appAccountsTable, eq(appAccountsTable.id, appSessionsTable.accountId))
    .where(and(
      eq(appSessionsTable.tokenHash, hashSessionToken(token)),
      gt(appSessionsTable.expiresAt, new Date()),
      eq(appAccountsTable.active, true),
    ))
    .limit(1);

  const account = rows[0];
  if (!account) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  (req as AuthenticatedRequest).account = account;
  (req as AuthenticatedRequest).userId = `account:${account.id}`;
  next();
}

export async function requireAccountAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    if (!(req as AuthenticatedRequest).account.canManageAccounts) {
      res.status(403).json({ error: "Account management permission required" });
      return;
    }
    next();
  });
}