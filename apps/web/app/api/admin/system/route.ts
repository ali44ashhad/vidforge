import { json } from "@/lib/api";
import { requireAdmin, withAuth, WORKER_URL } from "@/lib/adminApi";
export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
  await requireAdmin();
  const token = process.env.WORKER_ADMIN_TOKEN;
  if (!token) return json({ error: "WORKER_ADMIN_TOKEN is not set on the web app" }, 503);
  const res = await fetch(`${WORKER_URL}/admin/status`, { headers: { "x-admin-token": token }, cache: "no-store" }).catch(() => null);
  if (!res) return json({ error: "Worker unreachable" }, 502);
  return json(await res.json(), res.ok ? 200 : 502);
});
