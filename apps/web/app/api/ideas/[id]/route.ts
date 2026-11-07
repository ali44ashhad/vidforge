import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const PATCH = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireUser(); const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const idea = await prisma.idea.findFirst({ where: { id, userId: u.id } });
  if (!idea) return badRequest("Not found");
  const updated = await prisma.idea.update({ where: { id }, data: { ...(b.status ? { status: String(b.status) } : {}), ...(b.plannedFor !== undefined ? { plannedFor: b.plannedFor ? new Date(String(b.plannedFor)) : null } : {}), ...(b.title ? { title: String(b.title).slice(0, 140) } : {}), ...(b.projectId ? { projectId: String(b.projectId) } : {}) } });
  return json({ idea: updated });
});
export const DELETE = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => { const u = await requireUser(); const { id } = await ctx.params; await prisma.idea.deleteMany({ where: { id, userId: u.id } }); return json({ ok: true }); });
