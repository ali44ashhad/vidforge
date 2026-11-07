import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";

/**
 * Re-run from FETCHING_MEDIA.
 *   default        → only shots without media are (re)generated
 *   ?all=1         → every shot's media is dropped and regenerated
 *   ?characters=1  → character reference images are regenerated too
 */
export const POST = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await assertOwner(id);
  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "1";
  const chars = url.searchParams.get("characters") === "1";

  if (all) {
    await prisma.shot.updateMany({ where: { scene: { chapter: { projectId: id } } }, data: { mediaAssetId: null } });
    await prisma.projectAsset.deleteMany({ where: { projectId: id } });
  }
  if (chars) {
    const pcs = await prisma.projectCharacter.findMany({ where: { projectId: id } });
    await prisma.character.updateMany({ where: { id: { in: pcs.map((p) => p.characterId) } }, data: { referenceImageUrl: null, referenceImagePath: null, referencePublicUrl: null } });
  }
  const missing = await prisma.shot.count({ where: { scene: { chapter: { projectId: id } }, mediaAssetId: null } });
  const project = await prisma.project.update({
    where: { id },
    data: { status: "QUEUED", error: null, lockedAt: null, attempts: 0, progress: 0, pauseRequested: false,
      checkpoint: { completedStages: ["SCRIPTING", "STORYBOARDING", "VOICE_GENERATION"] } },
  });
  return json({ project, missing, all, characters: chars });
});
