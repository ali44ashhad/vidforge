import { json } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";
export const dynamic = "force-dynamic";
const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");

export const GET = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params; await assertOwner(id);
  const u = new URL(req.url);
  const r = await fetch(`${WORKER_URL}/stock/search?${u.searchParams.toString()}`, { cache: "no-store" }).catch(() => null);
  if (!r) return json({ error: "Worker unreachable" }, 502);
  return json(await r.json(), r.ok ? 200 : 502);
});
