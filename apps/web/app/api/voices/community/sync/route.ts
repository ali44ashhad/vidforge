import { json } from "@/lib/api";
import { requireAdmin, withAuth, WORKER_URL } from "@/lib/adminApi";
export const dynamic = "force-dynamic";
export const POST = withAuth(async () => {
  await requireAdmin();
  const r = await fetch(`${WORKER_URL}/voices/community/sync`, { method: "POST", headers: { "x-admin-token": process.env.WORKER_ADMIN_TOKEN || "" } }).catch(() => null);
  return json(r ? await r.json() : { error: "Worker unreachable" }, r?.ok ? 200 : 502);
});
