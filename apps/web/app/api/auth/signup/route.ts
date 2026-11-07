import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { hashPassword, createSession } from "@/lib/auth";
import { grantSignupCredits } from "@/lib/credits";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? ""), name = String(b.name ?? "").trim().slice(0, 60);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return badRequest("Enter a valid email.");
  if (password.length < 8) return badRequest("Password must be at least 8 characters.");
  if (await prisma.user.findUnique({ where: { email } })) return badRequest("An account with this email already exists. Sign in instead.");
  const isFirst = (await prisma.user.count()) === 0;
  const user = await prisma.user.create({ data: { email, name: name || null, passwordHash: await hashPassword(password), role: isFirst ? "ADMIN" : "USER" } });
  await grantSignupCredits(user.id);
  await createSession(user.id);
  return json({ ok: true, user: { id: user.id, email, name: user.name, role: user.role } }, 201);
}
