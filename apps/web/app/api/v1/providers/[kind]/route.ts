import { json } from "@/lib/api";
import { proxyProvider } from "@/lib/providerGateway";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const GET_KINDS = new Set(["stock", "voices", "ping"]);
const POST_KINDS = new Set(["llm", "voice", "image", "music"]);

/**
 * Public provider API. Authorization: Bearer y2_…
 * GET  /api/v1/providers/ping | /voices | /stock?q=&type=video|photo&orientation=
 * POST /api/v1/providers/llm | /voice | /image | /music
 * Credits: llm 1, voice 1 per 800 chars, image 2, music 6. Stock, voices and ping are free. Failed calls are refunded.
 */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!GET_KINDS.has(kind)) return json({ error: "Unknown provider call" }, 404);
  return proxyProvider(req, kind);
}

export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!POST_KINDS.has(kind)) return json({ error: "Unknown provider call" }, 404);
  return proxyProvider(req, kind);
}
