import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";

/** Re-run MUSIC_GENERATION (then re-render). Script, visuals and voice are kept. */
export const POST = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await assertOwner(id);
  const project = await prisma.project.update({
    where: { id },
    data: { status: "QUEUED", error: null, lockedAt: null, attempts: 0, progress: 0, pauseRequested: false, musicEnabled: true,
      checkpoint: { completedStages: ["SCRIPTING", "STORYBOARDING", "VOICE_GENERATION", "FETCHING_MEDIA"] } },
  });
  return json({ project });
});
