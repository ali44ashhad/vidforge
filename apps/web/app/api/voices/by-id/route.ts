import { json } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";
const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");
export const POST = withAuth(async (req: Request) => {
  await requireUser();
  const body = await req.text();
  const r = await fetch(`${WORKER_URL}/voices/by-id`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": process.env.WORKER_ADMIN_TOKEN || "" }, body }).catch(() => null);
  if (!r) return json({ error: "Worker unreachable" }, 502);
  return json(await r.json().catch(() => ({})), r.ok ? 200 : 400);
});
