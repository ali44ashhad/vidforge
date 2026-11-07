import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // DeepSeek / ElevenLabs calls can take a while
const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");

/** Generates ideas via the worker (DeepSeek); personalizes with the user's recent video topics. */
export const POST = withAuth(async (req: Request) => {
  const u = await requireUser();
  const b = (await req.json().catch(() => ({}))) as { topic?: string; filter?: string; language?: string };
  const recent = await prisma.project.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 8, select: { title: true, videoType: true, language: true } });
  const niche = recent.length ? `channel that recently made: ${recent.map((r) => r.title).join("; ")}` : undefined;
  const r = await fetch(`${WORKER_URL}/ideas`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": process.env.WORKER_ADMIN_TOKEN || "" }, body: JSON.stringify({ topic: b.topic ?? "", niche, language: b.language ?? recent[0]?.language ?? "English", filter: b.filter, count: 8 }) }).catch(() => null);
  if (!r) return json({ error: "Worker unreachable" }, 502);
  const d = await r.json().catch(() => ({}));
  return json(d, r.ok ? 200 : 502);
});
