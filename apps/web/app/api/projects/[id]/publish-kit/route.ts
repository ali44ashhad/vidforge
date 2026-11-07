import { json } from "@/lib/api";

export const dynamic = "force-dynamic";
import { withAuth } from "@/lib/auth";
import { assertOwner } from "@/lib/owner";
const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");

/** Asks the worker to regenerate the publish kit (SEO copy + thumbnails). Takes ~1-3 minutes. */
export const POST = withAuth(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await assertOwner(id);
  const res = await fetch(`${WORKER_URL}/projects/${id}/publish-kit`, { method: "POST" }).catch(() => null);
  if (!res) return json({ error: "Worker not reachable" }, 502);
  const data = await res.json().catch(() => ({}));
  return json(data, res.ok ? 200 : 502);
});
