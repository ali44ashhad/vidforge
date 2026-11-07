import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { userFromRequest } from "@/lib/apiKeys";
import { postLedger } from "@/lib/credits";
import { parseSettings } from "@/lib/projectInput";
import { estimateCredits } from "@vidforge/shared";
import { catalog } from "@/lib/config";
export const dynamic = "force-dynamic";

/**
 * Public API v1.
 * POST /api/v1/projects  Authorization: Bearer y2_…   body: { prompt, targetDuration?, videoType?, language?, aspectRatio?, visualSource?, ... any create-form field }
 * → { id, status, creditsReserved, url }
 */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return json({ error: "Invalid or missing API key" }, 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("Invalid JSON body");
  const prompt = String(body.prompt ?? "").trim();
  if (prompt.length < 8) return badRequest("prompt is required (min 8 chars)");
  { const limit = user.role === "ADMIN" ? 100000 : ((await catalog()).plans.find((p) => p.id === user.plan)?.promptChars ?? 2000); if (prompt.length > limit) return badRequest(`Plan limit: ${limit} characters per script`); }
  const targetDuration = Number(body.targetDuration ?? 60);
  if (!Number.isFinite(targetDuration) || targetDuration < 10 || targetDuration > 3600) return badRequest("targetDuration must be 10–3600 seconds");
  const { characters, ...settings } = parseSettings(body);
  const est = estimateCredits({ targetDuration, visualSource: settings.visualSource, aiVideoResolution: settings.aiVideoResolution, musicEnabled: settings.musicEnabled, voiceEnabled: settings.voiceEnabled, storyMode: settings.storyMode, characterCount: characters.length || settings.characterCount }, (await catalog()).rates);
  if (user.credits < est.reserve) return json({ error: "insufficient_credits", needed: est.reserve, balance: user.credits }, 402);
  const project = await prisma.project.create({ data: { userId: user.id, title: String(body.title ?? (prompt.length > 80 ? prompt.slice(0, 77) + "…" : prompt)).slice(0, 120), prompt, targetDuration: Math.round(targetDuration), status: "QUEUED", creditsReserved: est.reserve, ...settings } });
  await postLedger(user.id, "RESERVE", -est.reserve, { projectId: project.id, reason: `Reserved (API) for "${project.title.slice(0, 40)}"` });
  return json({ id: project.id, status: project.status, creditsReserved: est.reserve, url: `${process.env.APP_URL || ""}/projects/${project.id}` }, 201);
}

export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return json({ error: "Invalid or missing API key" }, 401);
  const projects = await prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, status: true, progress: true, finalVideoUrl: true, thumbnailUrl: true, actualDuration: true, createdAt: true } });
  return json({ projects });
}
