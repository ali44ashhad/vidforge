import { cookies } from "next/headers";
import { prisma } from "@vidforge/db";
import { requireUser, withAuth } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url); const origin = process.env.APP_URL || url.origin;
  const code = url.searchParams.get("code"), state = url.searchParams.get("state");
  if (!code || state !== (await cookies()).get("y2_yt_state")?.value) return Response.redirect(`${origin}/settings?youtube=error`, 302);
  const tok = (await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${origin}/api/youtube/callback`, grant_type: "authorization_code" }) })).json()) as { access_token?: string; refresh_token?: string };
  if (!tok.access_token || !tok.refresh_token) return Response.redirect(`${origin}/settings?youtube=error`, 302);
  const ch = (await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${tok.access_token}` } })).json()) as { items?: { id: string; snippet: { title: string; thumbnails?: { default?: { url: string } } } }[] };
  const c = ch.items?.[0];
  if (!c) return Response.redirect(`${origin}/settings?youtube=nochannel`, 302);
  await prisma.user.update({ where: { id: user.id }, data: { youtube: { channelId: c.id, channelTitle: c.snippet.title, thumbnail: c.snippet.thumbnails?.default?.url, refreshTokenEnc: encrypt(tok.refresh_token), connectedAt: new Date().toISOString() } } });
  return Response.redirect(`${origin}/settings?youtube=connected`, 302);
});
