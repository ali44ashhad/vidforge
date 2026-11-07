import { json } from "@/lib/api";

export const dynamic = "force-dynamic";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";
const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");

/** Renders thumbnails from chosen text/background combos (text only — no AI credits). */
export const POST = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await assertOwner(id);
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${WORKER_URL}/projects/${id}/thumbnails`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) return json({ error: "Worker not reachable" }, 502);
  const data = await res.json().catch(() => ({}));
  return json(data, res.ok ? 200 : 502);
});
