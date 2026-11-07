import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";
export const dynamic = "force-dynamic";

/**
 * Re-generate the voiceover (optionally with a different voice/style/speed), keep the script and visuals, then re-render.
 * The timeline is rebuilt from the new audio, so the music stage and render also rerun.
 */
export const POST = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params; await assertOwner(id);
  const b = (await req.json().catch(() => ({}))) as { voiceId?: string; voiceStyle?: string; voiceSpeed?: number; characterVoices?: Record<string, string> };
  const p = await prisma.project.findUniqueOrThrow({ where: { id }, select: { status: true } });
  if (!["COMPLETED", "FAILED", "PAUSED"].includes(p.status)) return badRequest("Wait for the current generation to finish.");
  await prisma.voiceSegment.deleteMany({ where: { projectId: id } });
  // per-character voices (spokesperson ads, stories): set the chosen voice on each character of this project
  if (b.characterVoices) {
    const links = await prisma.projectCharacter.findMany({ where: { projectId: id }, select: { characterId: true } });
    for (const [characterId, voiceId] of Object.entries(b.characterVoices)) if (links.some((l) => l.characterId === characterId)) await prisma.character.update({ where: { id: characterId }, data: { voiceId: voiceId || null } });
  }
  await prisma.project.update({ where: { id }, data: {
    status: "QUEUED", error: null, lockedAt: null, attempts: 0, progress: 0, pauseRequested: false, voiceEnabled: true,
    ...(b.voiceId !== undefined ? { voiceId: b.voiceId || null } : {}), ...(b.voiceStyle ? { voiceStyle: b.voiceStyle } : {}), ...(b.voiceSpeed ? { voiceSpeed: Math.min(1.3, Math.max(0.7, Number(b.voiceSpeed))) } : {}),
    checkpoint: { completedStages: ["SCRIPTING", "STORYBOARDING"] },
  } });
  return json({ ok: true });
});
