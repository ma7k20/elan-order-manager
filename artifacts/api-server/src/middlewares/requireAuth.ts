import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export type AuthenticatedRequest = Request & { userId: string };

const allowedEmails = new Set(
  (process.env.ALLOWED_CLERK_EMAILS ??
    "fadialaa6407@gmail.com,alkronzmahmoud.2005@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (!email || !allowedEmails.has(email)) {
      res.status(403).json({ error: "This account is not allowed to access ELAN." });
      return;
    }
  } catch {
    res.status(403).json({ error: "Unable to verify this account." });
    return;
  }

  (req as AuthenticatedRequest).userId = userId;
  next();
}