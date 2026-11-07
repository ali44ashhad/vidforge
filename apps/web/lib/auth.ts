import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@vidforge/db";

const COOKIE = "y2_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me-please-32-chars!!");

export type SessionUser = { id: string; email: string; name: string | null; image: string | null; role: "USER" | "ADMIN"; plan: string; credits: number };

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function clearSession() { (await cookies()).set(COOKIE, "", { path: "/", maxAge: 0 }); }

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const u = await prisma.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true, email: true, name: true, image: true, role: true, plan: true, credits: true, suspended: true } });
    if (!u || u.suspended) return null;
    return u;
  } catch { return null; }
}
export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new Response(JSON.stringify({ error: "Sign in required" }), { status: 401, headers: { "Content-Type": "application/json" } });
  return u;
}
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { "Content-Type": "application/json" } });
  return u;
}
export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

/** Wrap a route handler so requireUser/requireAdmin throws become responses. */
export function withAuth<T extends unknown[]>(fn: (...a: T) => Promise<Response>) {
  return async (...a: T): Promise<Response> => { try { return await fn(...a); } catch (e) { if (e instanceof Response) return e; throw e; } };
}
