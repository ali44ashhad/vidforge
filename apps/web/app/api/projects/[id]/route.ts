import { prisma } from "@vidforge/db";
import { withAuth } from "@/lib/auth";
import { json } from "@/lib/api";
import { parseSettings } from "@/lib/projectInput";

export const dynamic = "force-dynamic";

import { assertOwner } from "@/lib/owner";

export const GET = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await assertOwner(id);
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      chapters: { orderBy: { order: "asc" }, include: { scenes: { orderBy: { order: "asc" }, include: { shots: { orderBy: { order: "asc" }, include: { mediaAsset: { select: { previewUrl: true, type: true, creator: true, sourceUrl: true, provider: true } } } } } } } },
      musicTracks: true,
      renderJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      characters: { orderBy: { order: "asc" }, include: { character: true } },
    },
  });
  if (!project) return json({ error: "Not found" }, 404);
  // queue position + rough ETA while waiting (paid plans and single videos are served first)
  let queue: { position: number; etaMinutes: number } | null = null;
  if (project.status === "QUEUED" && !project.lockedAt) {
    const ahead = await prisma.project.count({ where: { status: "QUEUED", lockedAt: null, createdAt: { lt: project.createdAt } } });
    const running = await prisma.project.count({ where: { lockedAt: { not: null }, status: { notIn: ["COMPLETED", "FAILED", "DRAFT", "PAUSED", "QUEUED"] } } });
    const perVideoMin = /ai_video/.test(project.visualSource) ? 20 : /ai_images|mixed/.test(project.visualSource) ? 7 : 4;
    const slots = Number(process.env.WORKER_CONCURRENCY_HINT || 6);
    queue = { position: ahead + 1, etaMinutes: Math.max(1, Math.round(((ahead + Math.max(0, running - slots + 1)) / slots) * perVideoMin + perVideoMin * 0.3)) };
  }
  return json({ project, queue });
});

/** Re-queue a failed/completed project. Resumes from its checkpoint unless { fresh: true }. */
export const POST = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await assertOwner(id);
  const body = await req.json().catch(() => ({}));
  const project = await prisma.project.update({
    where: { id },
    data: { status: "QUEUED", error: null, lockedAt: null, attempts: 0, progress: 0, ...(body.fresh ? { checkpoint: { completedStages: [] } } : {}) },
  });
  return json({ project });
});

/** Update render-time settings (audio mix, captions, logo, music on/off). Follow with POST …/render. */
export const PATCH = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await assertOwner(id);
  const current = await prisma.project.findUnique({ where: { id } });
  if (!current) return json({ error: "Not found" }, 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // merge over current values so partial updates work
  const merged = parseSettings({ ...current, mixSettings: { ...(current.mixSettings as object ?? {}), ...((body.mixSettings as object) ?? {}) }, ...body, characters: [] });
  const project = await prisma.project.update({
    where: { id },
    data: {
      mixSettings: merged.mixSettings, captionsEnabled: merged.captionsEnabled, captionStyle: merged.captionStyle,
      musicEnabled: merged.musicEnabled, logoUrl: merged.logoUrl, logoPath: merged.logoPath, logoPosition: merged.logoPosition,
      ...(typeof body.title === "string" && body.title.trim() ? { title: body.title.trim().slice(0, 120) } : {}),
      textOverlaysEnabled: merged.textOverlaysEnabled, outputQuality: merged.outputQuality, look: merged.look, lookIntensity: merged.lookIntensity,
      ...(merged.lookParams !== undefined ? { lookParams: merged.lookParams } : {}),
      ...(body.banners !== undefined ? { banners: merged.banners ?? undefined } : {}),
      // generation-time fields (take effect on "Regenerate all visuals" / retry-media)
      ...(body.visualSource !== undefined ? { visualSource: merged.visualSource } : {}),
      ...(body.aiVideoResolution !== undefined ? { aiVideoResolution: merged.aiVideoResolution } : {}),
      ...(body.imageStyle !== undefined ? { imageStyle: merged.imageStyle } : {}),
    },
  });
  return json({ project });
});

const WORKER = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");

/** Deletes the project and asks the worker to remove its files. Reserved-but-unsettled credits are refunded. */
export const DELETE = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params; await assertOwner(id);
  const p = await prisma.project.findUniqueOrThrow({ where: { id }, select: { status: true, creditsReserved: true, creditsCharged: true, userId: true, title: true } });
  if (!["COMPLETED", "FAILED", "PAUSED", "QUEUED", "DRAFT"].includes(p.status)) return json({ error: "Pause the project before deleting it." }, 409);
  if (p.creditsReserved && !p.creditsCharged) {
    const { postLedger } = await import("@/lib/credits");
    await postLedger(p.userId, "REFUND", p.creditsReserved, { projectId: id, reason: `Deleted before completion: "${p.title.slice(0, 40)}"` });
  }
  await prisma.project.delete({ where: { id } });
  fetch(`${WORKER}/projects/${id}/storage`, { method: "DELETE", headers: { "x-admin-token": process.env.WORKER_ADMIN_TOKEN || "" } }).catch(() => {});
  return json({ ok: true });
});
