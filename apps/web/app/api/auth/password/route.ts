import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth, hashPassword, checkPassword } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const POST = withAuth(async (req: Request) => {
  const u = await requireUser();
  const b = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  if (!b.next || b.next.length < 8) return badRequest("New password must be at least 8 characters.");
  const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
  if (row.passwordHash && !(await checkPassword(String(b.current ?? ""), row.passwordHash))) return badRequest("Current password is wrong.");
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(b.next) } });
  return json({ ok: true });
});
