import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { checkPassword, createSession } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await checkPassword(password, user.passwordHash))) return badRequest("Wrong email or password.");
  if (user.suspended) return json({ error: "This account is suspended." }, 403);
  await createSession(user.id);
  return json({ ok: true });
}
