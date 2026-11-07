import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireAdmin, withAuth, WORKER_URL } from "@/lib/adminApi";
export const dynamic = "force-dynamic";

/** Admin: starts course generation on the worker (returns immediately; lessons appear as they are created). */
export const POST = withAuth(async (req: Request) => {
  const admin = await requireAdmin();
  const b = (await req.json().catch(() => ({}))) as { topic?: string; audience?: string; lessons?: number; language?: string; courseId?: string };
  const n = Math.min(16, Math.max(4, Number(b.lessons ?? 8)));
  const me = await prisma.user.findUniqueOrThrow({ where: { id: admin.id }, select: { credits: true } });
  if (me.credits < n * 40) return badRequest(`About ${n * 40} credits are needed for ${n} lessons; you have ${me.credits}. Grant credits in Admin → Users first.`);
  const r = await fetch(`${WORKER_URL}/academy/generate`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": process.env.WORKER_ADMIN_TOKEN || "" }, body: JSON.stringify({ ...b, lessons: n, userId: admin.id }) }).catch(() => null);
  if (!r) return json({ error: "Worker unreachable" }, 502);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: d.error ?? "Could not start" }, 502);
  return json({ ok: true, started: true, lessons: n });
});
