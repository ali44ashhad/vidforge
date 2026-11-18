import { json } from "@/lib/api";
import { userFromRequest } from "@/lib/apiKeys";
import { postLedger } from "@/lib/credits";

const WORKER = (process.env.WORKER_URL || "http://localhost:4000").replace(/\/$/, "");

const TIMEOUT_MS: Record<string, number> = {
  llm: 180_000,
  voice: 360_000,
  image: 180_000,
  music: 540_000,
  stock: 60_000,
  voices: 60_000,
  ping: 30_000,
};

function costOf(kind: string, body: Record<string, unknown>): number {
  if (kind === "llm") return 1;
  if (kind === "image") return 2;
  if (kind === "music") return 6;
  if (kind === "voice") return Math.max(1, Math.ceil(String(body.text ?? "").length / 800));
  return 0;
}

/** Authenticate a y2_ key, charge credits, and forward to the worker gateway. */
export async function proxyProvider(req: Request, kind: string): Promise<Response> {
  const user = await userFromRequest(req);
  if (!user) return json({ error: "Invalid or missing API key" }, 401);
  const isGet = req.method === "GET";
  const body = isGet ? Object.fromEntries(new URL(req.url).searchParams) : (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!isGet && !body) return json({ error: "Invalid JSON body" }, 400);
  const cost = costOf(kind, (body ?? {}) as Record<string, unknown>);
  if (cost > 0 && user.credits < cost) return json({ error: "insufficient_credits", needed: cost, balance: user.credits }, 402);
  if (cost > 0) {
    try { await postLedger(user.id, "ADJUST", -cost, { reason: `API ${kind}` }); }
    catch (e) {
      if ((e as Error).message === "INSUFFICIENT_CREDITS") return json({ error: "insufficient_credits", needed: cost, balance: user.credits }, 402);
      throw e;
    }
  }
  const refund = async () => { if (cost > 0) await postLedger(user.id, "ADJUST", cost, { reason: `API ${kind} refund` }).catch(() => {}); };
  try {
    const url = isGet ? `${WORKER}/v1/gateway/${kind}?${new URL(req.url).searchParams}` : `${WORKER}/v1/gateway/${kind}`;
    const res = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json", "x-gateway-token": process.env.WORKER_ADMIN_TOKEN || "" },
      body: isGet ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS[kind] ?? 60_000),
    });
    const text = await res.text();
    if (!res.ok) {
      await refund();
      let error = text.slice(0, 300);
      try { error = JSON.parse(text).error || error; } catch { /* keep text */ }
      return json({ error }, res.status >= 400 && res.status < 600 ? res.status : 502);
    }
    return new Response(text, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    await refund();
    return json({ error: (e as Error).message }, 502);
  }
}
