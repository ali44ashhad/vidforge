import { prisma } from "@vidforge/db";
import { decrypt } from "@/lib/crypto";

export type YouTubeConn = { channelId: string; channelTitle: string; thumbnail?: string; refreshTokenEnc: string; connectedAt: string };

/** Exchanges the stored refresh token for a short-lived access token. */
export async function youtubeAccessToken(userId: string): Promise<{ token: string; conn: YouTubeConn }> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { youtube: true } });
  const conn = u.youtube as YouTubeConn | null;
  if (!conn?.refreshTokenEnc) throw new Error("YouTube is not connected");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: decrypt(conn.refreshTokenEnc), grant_type: "refresh_token" }),
  });
  const d = (await res.json()) as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(`YouTube token refresh failed (${d.error ?? res.status}) — reconnect your channel`);
  return { token: d.access_token, conn };
}
