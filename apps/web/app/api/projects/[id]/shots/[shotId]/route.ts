import { prisma, Prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";
export const dynamic = "force-dynamic";

/**
 * Stage an edit on one shot (applied by POST /apply-edits):
 *  { action: "regenerate", description? }  → detach media, optionally new description → media stage regenerates
 *  { action: "pin", source: {...} }         → detach media, pin a stock result or an upload
 */
export const POST = withAuth(async (req: Request, ctx: { params: Promise<{ id: string; shotId: string }> }) => {
  const { id, shotId } = await ctx.params; await assertOwner(id);
  const shot = await prisma.shot.findFirst({ where: { id: shotId, scene: { chapter: { projectId: id } } } });
  if (!shot) return badRequest("Shot not found");
  const b = (await req.json().catch(() => ({}))) as { action?: string; description?: string; source?: Record<string, unknown> };
  if (b.action === "regenerate") {
    const description = String(b.description ?? "").trim();
    await prisma.shot.update({ where: { id: shotId }, data: { mediaAssetId: null, pinnedSource: Prisma.DbNull, ...(description.length >= 8 ? { visualDescription: description, videoQueries: [], imageQueries: [] } : {}) } });
  } else if (b.action === "pin" && b.source && typeof b.source === "object") {
    await prisma.shot.update({ where: { id: shotId }, data: { mediaAssetId: null, pinnedSource: b.source as Prisma.InputJsonValue } });
  } else return badRequest("Unknown action");
  const pending = await prisma.shot.count({ where: { scene: { chapter: { projectId: id } }, mediaAssetId: null } });
  return json({ ok: true, pending });
});
