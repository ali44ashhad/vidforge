import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";
export const dynamic = "force-dynamic";

/** Stage a narration edit on one scene: text replaced, its voice segment dropped so only this scene is re-voiced. */
export const PATCH = withAuth(async (req: Request, ctx: { params: Promise<{ id: string; sceneId: string }> }) => {
  const { id, sceneId } = await ctx.params; await assertOwner(id);
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, chapter: { projectId: id } }, include: { chapter: { select: { project: { select: { speechMode: true } } } } } });
  if (!scene) return badRequest("Scene not found");
  if (scene.chapter.project.speechMode === "veo_native") return badRequest("Narration can't be edited on native-speech videos (the clips carry the speech). Regenerate the shot instead.");
  const narration = String(((await req.json().catch(() => ({}))) as { narration?: string }).narration ?? "").trim();
  if (narration.length < 3) return badRequest("Narration is too short");
  const lines = (scene.lines as { speaker: string; text: string }[] | null) ?? null;
  // keep the speaker structure when there is exactly one line; otherwise make it a single narrator line
  const newLines = lines && lines.length === 1 ? [{ speaker: lines[0].speaker, text: narration.replace(/^[^:]{1,40}:\s*/, "") }] : lines ? [{ speaker: "narrator", text: narration }] : undefined;
  await prisma.$transaction([
    prisma.scene.update({ where: { id: sceneId }, data: { narration, ...(newLines ? { lines: newLines } : {}) } }),
    prisma.voiceSegment.deleteMany({ where: { sceneId } }),
  ]);
  return json({ ok: true });
});
