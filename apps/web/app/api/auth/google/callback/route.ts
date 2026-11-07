import { cookies } from "next/headers";
import { prisma } from "@vidforge/db";
import { createSession } from "@/lib/auth";
import { grantSignupCredits } from "@/lib/credits";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.APP_URL || url.origin;
  const code = url.searchParams.get("code"), state = url.searchParams.get("state");
  const saved = (await cookies()).get("y2_oauth_state")?.value;
  if (!code || !state || state !== saved) return Response.redirect(`${origin}/login?error=google`, 302);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code" }),
  });
  const tok = (await tokenRes.json()) as { access_token?: string };
  if (!tok.access_token) return Response.redirect(`${origin}/login?error=google`, 302);
  const info = (await (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } })).json()) as { sub: string; email: string; name?: string; picture?: string };
  if (!info.email) return Response.redirect(`${origin}/login?error=google`, 302);
  const email = info.email.toLowerCase();
  let user = await prisma.user.findFirst({ where: { OR: [{ googleId: info.sub }, { email }] } });
  if (!user) {
    const isFirst = (await prisma.user.count()) === 0;
    user = await prisma.user.create({ data: { email, name: info.name ?? null, image: info.picture ?? null, googleId: info.sub, role: isFirst ? "ADMIN" : "USER" } });
    await grantSignupCredits(user.id);
  } else if (!user.googleId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleId: info.sub, image: user.image ?? info.picture ?? null } });
  }
  if (user.suspended) return Response.redirect(`${origin}/login?error=suspended`, 302);
  await createSession(user.id);
  return Response.redirect(`${origin}/dashboard`, 302);
}
