import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { parseSettings } from "@/lib/projectInput";
import { requireUser, withAuth } from "@/lib/auth";
import { postLedger } from "@/lib/credits";
import { estimateCredits } from "@vidforge/shared";
import { catalog } from "@/lib/config";

export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: user.role === "ADMIN" ? {} : { userId: user.id },
    orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, title: true, status: true, progress: true, currentStage: true, targetDuration: true, actualDuration: true, aspectRatio: true, videoType: true, language: true, finalVideoUrl: true, thumbnailUrl: true, createdAt: true, error: true, stats: true },
  });
  return json({ projects });
});

/** Creates a project, reserves credits, and queues it. The worker picks it up within a few seconds. */
export const POST = withAuth(async (req: Request) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("Invalid JSON body");

  const prompt = String(body.prompt ?? "").trim();
  { const limit = user.role === "ADMIN" ? 100000 : ((await catalog()).plans.find((p) => p.id === user.plan)?.promptChars ?? 2000); if (prompt.length > limit) return badRequest(`Your ${user.plan} plan allows scripts up to ${limit.toLocaleString()} characters; this one is ${prompt.length.toLocaleString()}. Upgrade for longer scripts.`); }
  if (prompt.length < 8) return badRequest("Describe the video you want (at least a few words).");
  const targetDuration = Number(body.targetDuration ?? 60);
  if (!Number.isFinite(targetDuration) || targetDuration < 15 || targetDuration > 3 * 3600) return badRequest("Duration must be between 15 seconds and 3 hours.");

  const { characters, ...settings } = parseSettings(body);
  const est = estimateCredits({ targetDuration, visualSource: settings.visualSource, aiVideoResolution: settings.aiVideoResolution, musicEnabled: settings.musicEnabled, voiceEnabled: settings.voiceEnabled, storyMode: settings.storyMode, characterCount: characters.length || settings.characterCount }, (await catalog()).rates);
  if (user.credits < est.reserve) return json({ error: `You need about ${est.reserve - user.credits} more credits for these settings (${est.reserve} needed, ${user.credits} available).`, needed: est.reserve, balance: user.credits }, 402);
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      title: prompt.length > 80 ? prompt.slice(0, 77) + "…" : prompt,
      prompt,
      targetDuration: Math.round(targetDuration),
      status: "QUEUED",
      creditsReserved: est.reserve,
      ...settings,
    },
  });
  await postLedger(user.id, "RESERVE", -est.reserve, { projectId: project.id, reason: `Reserved for "${project.title.slice(0, 40)}"` });
  if (settings.storyMode && characters.length) {
    for (let i = 0; i < characters.length; i++) {
      const c = characters[i];
      const ch = await prisma.character.create({ data: { name: c.name, description: c.description, personality: c.personality ?? null, voiceHint: c.voiceHint ?? null, voiceId: c.voiceId ?? null, gender: c.gender ?? null, ageGroup: c.ageGroup ?? null, ethnicity: c.ethnicity ?? null } });
      await prisma.projectCharacter.create({ data: { projectId: project.id, characterId: ch.id, order: i } });
    }
  }
  return json({ project }, 201);
});
