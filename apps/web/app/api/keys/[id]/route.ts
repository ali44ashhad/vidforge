import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const DELETE = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(); const { id } = await ctx.params;
  await prisma.apiKey.updateMany({ where: { id, userId: u.id }, data: { revokedAt: new Date() } });
  return json({ ok: true });
});
