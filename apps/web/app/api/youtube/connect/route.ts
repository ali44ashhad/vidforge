import { cookies } from "next/headers";
import { badRequest } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";

/** Starts YouTube OAuth (upload + read scopes, offline access so we get a refresh token). */
export const GET = withAuth(async (req: Request) => {
  await requireUser();
  if (!process.env.GOOGLE_CLIENT_ID) return badRequest("Google OAuth is not configured.");
  const origin = process.env.APP_URL || new URL(req.url).origin;
  const state = crypto.randomUUID();
  (await cookies()).set("y2_yt_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: `${origin}/api/youtube/callback`, response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly", access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
});
