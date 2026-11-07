import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: Request) => {
  const u = await requireUser();
  const status = new URL(req.url).searchParams.get("status");
  const ideas = await prisma.idea.findMany({ where: { userId: u.id, ...(status ? { status } : { status: { not: "dismissed" } }) }, orderBy: [{ plannedFor: "asc" }, { createdAt: "desc" }], take: 200 });
  return json({ ideas });
});

/** Save an idea (from generation or manual "+ Add content"). */
export const POST = withAuth(async (req: Request) => {
  const u = await requireUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = String(b.title ?? "").trim().slice(0, 140);
  if (!title) return badRequest("Title required");
  const idea = await prisma.idea.create({ data: { userId: u.id, title, topic: b.topic ? String(b.topic).slice(0, 200) : null, format: b.format ? String(b.format) : null, length: b.length ? Number(b.length) : null, potential: b.potential ? String(b.potential) : null, competition: b.competition ? String(b.competition) : null, why: b.why ? String(b.why).slice(0, 500) : null, status: b.plannedFor ? "planned" : String(b.status ?? "idea"), plannedFor: b.plannedFor ? new Date(String(b.plannedFor)) : null } });
  return json({ idea }, 201);
});
