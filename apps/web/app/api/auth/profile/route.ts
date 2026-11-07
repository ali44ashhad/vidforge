import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const PATCH = withAuth(async (req: Request) => {
  const u = await requireUser();
  const b = (await req.json().catch(() => ({}))) as { name?: string };
  const name = String(b.name ?? "").trim().slice(0, 60);
  if (!name) return badRequest("Name required");
  await prisma.user.update({ where: { id: u.id }, data: { name } });
  return json({ ok: true });
});
