import { prisma } from "@vidforge/db";
import { getUser } from "@/lib/auth";
import MonetizationBoard from "@/components/MonetizationBoard";

export const dynamic = "force-dynamic";

export default async function MonetizationPage() {
  const user = await getUser(); if (!user) return null;
  const since = new Date(Date.now() - 90 * 86400e3);
  const [videos90d, done, full] = await Promise.all([
    prisma.project.count({ where: { userId: user.id, status: "COMPLETED", createdAt: { gte: since } } }),
    prisma.project.findMany({ where: { userId: user.id, status: "COMPLETED" }, select: { captionsEnabled: true, seo: true, logoUrl: true, stats: true }, take: 50 }),
    prisma.user.findUnique({ where: { id: user.id }, select: { youtube: true, brandKit: true } }),
  ]);
  const readiness = [
    { label: "Original content", ok: done.length > 0, hint: "Videos generated from your own prompts and scripts" },
    { label: "Video consistency", ok: videos90d >= 8, hint: `${videos90d} videos in the last 90 days (target 12)` },
    { label: "Thumbnail quality", ok: done.some((p) => (p.seo as { thumbnails?: unknown[] } | null)?.thumbnails?.length), hint: "Custom thumbnails with a clear hook on every video" },
    { label: "Metadata completeness", ok: done.every((p) => (p.seo as { tags?: string[] } | null)?.tags?.length), hint: "Titles, descriptions with chapters, and tags" },
    { label: "AI disclosure", ok: false, hint: "Mark synthetic/AI content in YouTube Studio when uploading" },
    { label: "Copyright readiness", ok: true, hint: "Stock and AI assets come with usage rights; music is generated" },
    { label: "Channel branding", ok: !!full?.brandKit || done.some((p) => p.logoUrl), hint: "Logo and consistent look via the Brand Kit" },
  ];
  return <MonetizationBoard videos90d={videos90d} readiness={readiness} />;
}
