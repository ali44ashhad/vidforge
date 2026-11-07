import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireAdmin, withAuth } from "@/lib/adminApi";
import { postLedger } from "@/lib/credits";
export const dynamic = "force-dynamic";

/** Admin actions on a project: resume | restart | refund | fail */
export const POST = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { action, reason } = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) return badRequest("Project not found");
  switch (action) {
    case "resume":
      await prisma.project.update({ where: { id }, data: { status: "QUEUED", error: null, lockedAt: null, attempts: 0, pauseRequested: false } });
      return json({ ok: true });
    case "restart":
      await prisma.project.update({ where: { id }, data: { status: "QUEUED", error: null, lockedAt: null, attempts: 0, pauseRequested: false, checkpoint: { completedStages: [] } } });
      return json({ ok: true });
    case "refund": {
      const amount = p.creditsCharged || p.creditsReserved;
      if (!amount) return badRequest("Nothing to refund");
      await postLedger(p.userId, "REFUND", amount, { projectId: id, reason: reason || `Admin refund for "${p.title.slice(0, 40)}"`, actorId: admin.id });
      await prisma.project.update({ where: { id }, data: { creditsCharged: 0, creditsReserved: 0 } });
      return json({ ok: true, refunded: amount });
    }
    case "fail":
      await prisma.project.update({ where: { id }, data: { status: "FAILED", error: reason || "Stopped by admin", lockedAt: null } });
      return json({ ok: true });
    default:
      return badRequest("Unknown action");
  }
});
