import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";

/** { action: "pause" } asks the worker to stop after its current step; { action: "resume" } re-queues from the checkpoint. */
export const POST = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await assertOwner(id);
  const body = await req.json().catch(() => ({}));
  const current = await prisma.project.findUnique({ where: { id } });
  if (!current) return json({ error: "Not found" }, 404);

  if (body.action === "resume") {
    const project = await prisma.project.update({ where: { id }, data: { status: "QUEUED", pauseRequested: false, error: null, lockedAt: null, attempts: 0 } });
    return json({ project });
  }
  // pause: if the worker hasn't picked it up yet, pause immediately; otherwise flag it
  const data = current.status === "QUEUED" ? { status: "PAUSED" as const, pauseRequested: false, lockedAt: null } : { pauseRequested: true };
  const project = await prisma.project.update({ where: { id }, data });
  return json({ project });
});
