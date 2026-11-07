import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";
const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");

/** Redirects to the worker's zip of all finished MP4s in the batch. */
export const GET = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const batch = await prisma.batch.findUnique({ where: { id }, select: { userId: true } });
  if (!batch || (batch.userId !== user.id && user.role !== "ADMIN")) return json({ error: "Not found" }, 404);
  return Response.redirect(`${WORKER_URL}/batches/${id}/zip`, 302);
});
