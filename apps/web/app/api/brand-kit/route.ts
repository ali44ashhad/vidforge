import { prisma, type Prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const GET = withAuth(async () => { const u = await requireUser(); const r = await prisma.user.findUnique({ where: { id: u.id }, select: { brandKit: true } }); return json({ brandKit: r?.brandKit ?? null }); });
export const PUT = withAuth(async (req: Request) => {
  const u = await requireUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const kit = { logoUrl: b.logoUrl ?? null, logoPath: b.logoPath ?? null, logoPosition: b.logoPosition ?? "top_right", brandColor: b.brandColor ?? "#6C4CFF", accentColor: b.accentColor ?? "#FFB648", voiceId: b.voiceId ?? "", voiceStyle: b.voiceStyle ?? "Professional", imageStyle: b.imageStyle ?? "cinematic_photo", captionStyle: b.captionStyle ?? "YouTube Clean", look: b.look ?? "auto", intro: b.intro ?? "", outro: b.outro ?? "" };
  await prisma.user.update({ where: { id: u.id }, data: { brandKit: kit as Prisma.InputJsonValue } });
  return json({ ok: true, brandKit: kit });
});
