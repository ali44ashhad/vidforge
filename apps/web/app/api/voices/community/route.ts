import { json } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";
const WORKER_URL = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");
export const GET = withAuth(async (req: Request) => {
  await requireUser();
  const r = await fetch(`${WORKER_URL}/voices/community?${new URL(req.url).searchParams.toString()}`, { cache: "no-store" }).catch(() => null);
  if (!r) return json({ error: "Worker unreachable" }, 502);
  return json(await r.json(), r.ok ? 200 : 502);
});
