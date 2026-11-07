import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { userFromRequest } from "@/lib/apiKeys";
export const dynamic = "force-dynamic";

/** GET /api/v1/projects/:id → status, progress, stage, outputs, publish kit. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return json({ error: "Invalid or missing API key" }, 401);
  const { id } = await ctx.params;
  const p = await prisma.project.findUnique({ where: { id }, select: { id: true, userId: true, title: true, status: true, progress: true, currentStage: true, error: true, finalVideoUrl: true, thumbnailUrl: true, captionsUrl: true, actualDuration: true, width: true, height: true, creditsReserved: true, creditsCharged: true, seo: true, createdAt: true, updatedAt: true } });
  if (!p || (p.userId !== user.id && user.role !== "ADMIN")) return json({ error: "Not found" }, 404);
  const { userId: _u, ...rest } = p;
  return json({ project: rest });
}
