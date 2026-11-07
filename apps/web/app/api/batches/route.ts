import { prisma, type Prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
import { postLedger } from "@/lib/credits";
import { parseSettings } from "@/lib/projectInput";
import { estimateCredits, PLANS } from "@vidforge/shared";
import { catalog } from "@/lib/config";
export const dynamic = "force-dynamic";

const MAX_ROWS = 50;
const BULK_PLANS = new Set(["creator", "pro", "unlimited"]);

export const GET = withAuth(async () => {
  const user = await requireUser();
  const batches = await prisma.batch.findMany({ where: user.role === "ADMIN" ? {} : { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { _count: { select: { projects: true } } } });
  return json({ batches });
});

/** Creates a batch: one project per row, all sharing the template settings; credits reserved per project. */
export const POST = withAuth(async (req: Request) => {
  const user = await requireUser();
  if (!BULK_PLANS.has(user.plan) && user.role !== "ADMIN") return json({ error: `Bulk creation is available on the ${PLANS.find((p) => p.id === "creator")?.name} plan and above.`, upgrade: true }, 403);
  const body = (await req.json().catch(() => null)) as { name?: string; rows?: { prompt: string; title?: string; language?: string; targetDuration?: number }[]; settings?: Record<string, unknown> } | null;
  if (!body?.rows?.length) return badRequest("Add at least one topic.");
  const rows = body.rows.map((r) => ({ prompt: String(r.prompt ?? "").trim(), title: String(r.title ?? "").trim(), language: r.language ? String(r.language) : undefined, targetDuration: Number(r.targetDuration) || undefined })).filter((r) => r.prompt.length >= 8);
  if (!rows.length) return badRequest("Every row needs a topic of at least a few words.");
  if (rows.length > MAX_ROWS) return badRequest(`Up to ${MAX_ROWS} videos per batch.`);
  const base = parseSettings({ ...(body.settings ?? {}), prompt: "template" });
  const { characters: _c, ...settings } = base;
  const baseDuration = Number(body.settings?.targetDuration ?? 60);
  // estimate total
  let total = 0;
  const R = (await catalog()).rates;
  const per = rows.map((r) => { const e = estimateCredits({ targetDuration: r.targetDuration ?? baseDuration, visualSource: settings.visualSource, aiVideoResolution: settings.aiVideoResolution, musicEnabled: settings.musicEnabled, voiceEnabled: settings.voiceEnabled, storyMode: settings.storyMode, characterCount: settings.characterCount }, R); total += e.reserve; return e.reserve; });
  if (user.credits < total) return json({ error: `This batch needs ${total} credits; you have ${user.credits}.`, needed: total, balance: user.credits }, 402);
  const batch = await prisma.batch.create({ data: { userId: user.id, name: (body.name || `Batch of ${rows.length}`).slice(0, 80), total: rows.length, settings: (body.settings ?? {}) as Prisma.InputJsonValue } });
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const project = await prisma.project.create({ data: {
      userId: user.id, batchId: batch.id, title: r.title || (r.prompt.length > 80 ? r.prompt.slice(0, 77) + "…" : r.prompt), prompt: r.prompt,
      targetDuration: Math.round(r.targetDuration ?? baseDuration), status: "QUEUED", creditsReserved: per[i], ...settings, ...(r.language ? { language: r.language } : {}),
    } });
    await postLedger(user.id, "RESERVE", -per[i], { projectId: project.id, reason: `Reserved for batch "${batch.name.slice(0, 30)}" #${i + 1}` });
  }
  return json({ batch, reserved: total }, 201);
});
