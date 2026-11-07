import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";
export const dynamic = "force-dynamic";

/** Re-runs only what the staged edits invalidated: missing voice segments, missing shot media, then assemble/render/finalize. */
export const POST = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params; await assertOwner(id);
  const missingVoice = await prisma.scene.count({ where: { chapter: { projectId: id }, voiceSegment: null } });
  const project = await prisma.project.findUniqueOrThrow({ where: { id }, select: { voiceEnabled: true, speechMode: true } });
  const completed = ["SCRIPTING", "STORYBOARDING", ...(missingVoice && project.voiceEnabled && project.speechMode !== "veo_native" ? [] : ["VOICE_GENERATION"])];
  await prisma.project.update({ where: { id }, data: { status: "QUEUED", error: null, lockedAt: null, attempts: 0, progress: 0, pauseRequested: false, checkpoint: { completedStages: completed } } });
  return json({ ok: true, revoicing: missingVoice });
});
