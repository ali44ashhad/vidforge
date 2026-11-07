import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";

/** Re-run only ASSEMBLING → RENDERING → FINALIZING (keeps script, media, voice, music). */
export const POST = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await assertOwner(id);
  const project = await prisma.project.update({
    where: { id },
    data: {
      status: "QUEUED", error: null, lockedAt: null, attempts: 0, progress: 0,
      checkpoint: { completedStages: ["SCRIPTING", "STORYBOARDING", "FETCHING_MEDIA", "VOICE_GENERATION", "MUSIC_GENERATION"] },
    },
  });
  return json({ project });
});
