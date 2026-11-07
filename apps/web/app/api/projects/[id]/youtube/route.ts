import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";
import { youtubeAccessToken } from "@/lib/youtube";
export const dynamic = "force-dynamic";
const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");

/** Uploads the finished MP4 to the user's channel via the worker (which holds the file). */
export const POST = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params; await assertOwner(id);
  const user = await requireUser();
  const p = await prisma.project.findUniqueOrThrow({ where: { id }, select: { status: true, finalVideoUrl: true, title: true } });
  if (p.status !== "COMPLETED" || !p.finalVideoUrl) return badRequest("The video isn't finished yet.");
  const b = (await req.json().catch(() => ({}))) as { title?: string; description?: string; tags?: string[]; privacy?: string; publishAt?: string; thumbnailUrl?: string; madeForKids?: boolean };
  const title = String(b.title ?? p.title).slice(0, 100);
  if (!title) return badRequest("Title required");
  const { token, conn } = await youtubeAccessToken(user.id).catch((e: Error) => { throw new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { "Content-Type": "application/json" } }); });
  const token2 = process.env.WORKER_ADMIN_TOKEN || "";
  const r = await fetch(`${WORKER_URL}/projects/${id}/youtube-upload`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": token2 },
    body: JSON.stringify({ accessToken: token, title, description: String(b.description ?? "").slice(0, 5000), tags: (b.tags ?? []).slice(0, 40), privacy: ["public", "unlisted", "private"].includes(String(b.privacy)) ? b.privacy : "private", publishAt: b.publishAt || null, thumbnailUrl: b.thumbnailUrl || null, madeForKids: !!b.madeForKids }),
  }).catch(() => null);
  if (!r) return json({ error: "Worker unreachable" }, 502);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: d.error ?? "Upload failed" }, 502);
  const stats = ((await prisma.project.findUnique({ where: { id }, select: { stats: true } }))?.stats as Record<string, unknown>) ?? {};
  await prisma.project.update({ where: { id }, data: { stats: { ...stats, youtubeVideoId: d.videoId, youtubeUrl: `https://youtu.be/${d.videoId}`, youtubeChannel: conn.channelTitle, youtubePrivacy: b.privacy ?? "private" } } });
  return json({ ok: true, videoId: d.videoId, url: `https://youtu.be/${d.videoId}` });
});
