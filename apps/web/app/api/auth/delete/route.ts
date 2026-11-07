import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth, clearSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
/** Deletes the account after the user types their email. Projects/storage are removed by housekeeping (orphan cleanup). */
export const POST = withAuth(async (req: Request) => {
  const u = await requireUser();
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm?.trim().toLowerCase() !== u.email) return badRequest("Type your email exactly to confirm.");
  await prisma.project.deleteMany({ where: { userId: u.id } });
  await prisma.user.delete({ where: { id: u.id } });
  await clearSession();
  return json({ ok: true });
});
