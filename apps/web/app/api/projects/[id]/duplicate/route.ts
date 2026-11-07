import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";
export const dynamic = "force-dynamic";

/** Returns the settings of a project so the Create form can be prefilled ("Duplicate"). */
export const GET = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params; await assertOwner(id);
  const p = await prisma.project.findUniqueOrThrow({ where: { id }, include: { characters: { include: { character: true }, orderBy: { order: "asc" } } } });
  const { id: _i, userId: _u, status: _s, checkpoint: _c, strategy: _st, script: _sc, stats: _sta, seo: _seo, finalVideoUrl: _f, thumbnailUrl: _t, captionsUrl: _cap, fileSize: _fs, width: _w, height: _h, actualDuration: _ad, error: _e, lockedAt: _l, attempts: _a, createdAt: _ca, updatedAt: _ua, batchId: _b, creditsReserved: _cr, creditsCharged: _cc, progress: _pr, currentStage: _cs, pauseRequested: _pq, musicPrompt: _mp, characters, ...settings } = p as typeof p & Record<string, unknown>;
  return json({ settings: { ...settings, characters: characters.map((pc) => ({ name: pc.character.name, description: pc.character.description, personality: pc.character.personality, voiceHint: pc.character.voiceHint, voiceId: pc.character.voiceId, gender: pc.character.gender, ageGroup: pc.character.ageGroup, ethnicity: pc.character.ethnicity })) } });
});
