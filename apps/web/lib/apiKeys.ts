import crypto from "node:crypto";
import { prisma } from "@vidforge/db";
import type { SessionUser } from "@/lib/auth";
import { getUser } from "@/lib/auth";

export const hashKey = (k: string) => crypto.createHash("sha256").update(k).digest("hex");
export function newKey() { const raw = `y2_${crypto.randomBytes(24).toString("base64url")}`; return { raw, prefix: raw.slice(0, 11), hash: hashKey(raw) }; }

/** Resolves the caller from a Bearer API key, or falls back to the session cookie. */
export async function userFromRequest(req: Request): Promise<SessionUser | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer y2_")) {
    const key = await prisma.apiKey.findUnique({ where: { hash: hashKey(auth.slice(7).trim()) } });
    if (!key || key.revokedAt) return null;
    const u = await prisma.user.findUnique({ where: { id: key.userId }, select: { id: true, email: true, name: true, image: true, role: true, plan: true, credits: true, suspended: true } });
    if (!u || u.suspended) return null;
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return u;
  }
  return getUser();
}
