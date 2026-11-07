import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
import { newKey } from "@/lib/apiKeys";
export const dynamic = "force-dynamic";
const API_PLANS = new Set(["pro", "unlimited"]);

export const GET = withAuth(async () => { const u = await requireUser(); return json({ keys: await prisma.apiKey.findMany({ where: { userId: u.id, revokedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true } }) }); });

/** Creates a key; the full secret is returned once. */
export const POST = withAuth(async (req: Request) => {
  const u = await requireUser();
  if (!API_PLANS.has(u.plan) && u.role !== "ADMIN") return json({ error: "API access is available on the Pro plan and above.", upgrade: true }, 403);
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if ((await prisma.apiKey.count({ where: { userId: u.id, revokedAt: null } })) >= 5) return badRequest("Up to 5 active keys.");
  const k = newKey();
  const row = await prisma.apiKey.create({ data: { userId: u.id, name: (name || "API key").slice(0, 40), prefix: k.prefix, hash: k.hash } });
  return json({ id: row.id, name: row.name, prefix: row.prefix, secret: k.raw }, 201);
});
