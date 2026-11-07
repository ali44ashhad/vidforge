import { cookies } from "next/headers";
import { badRequest } from "@/lib/api";
export const dynamic = "force-dynamic";

/** Starts Google OAuth (authorization code flow). Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / APP_URL. */
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return badRequest("Google sign-in is not configured.");
  const origin = process.env.APP_URL || new URL(req.url).origin;
  const state = crypto.randomUUID();
  (await cookies()).set("y2_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: `${origin}/api/auth/google/callback`, response_type: "code", scope: "openid email profile", state, prompt: "select_account" });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}
