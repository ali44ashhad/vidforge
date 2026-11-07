import { prisma } from "@vidforge/db";

/**
 * Homepage video slots. A finished project is featured by setting Project.showcaseSlot to one of these ids
 * (Admin → Projects → "Homepage"). The landing page, login and signup read them from the database.
 */
export const SHOWCASE_SLOTS = [
  { id: "demo", label: "Hero — 90-second demo" },
  { id: "showreel", label: "Product section — showreel (plays muted, inline)" },
  { id: "niche", label: "Lesson 01 — Choose a channel direction" },
  { id: "first-video", label: "Lesson 02 — Create your first video" },
  { id: "thumbnails", label: "Lesson 03 — Thumbnails people click" },
  { id: "publish", label: "Lesson 04 — Publish correctly" },
  { id: "retention", label: "Lesson 05 — Watch time & retention" },
  { id: "monetize", label: "Lesson 06 — Prepare for monetization" },
] as const;
const LESSON_SLOTS = ["niche", "first-video", "thumbnails", "publish", "retention", "monetize"];

export type ShowcaseItem = { id: string; title: string; url: string; thumbnailUrl: string | null; duration: number | null };

/** Featured videos keyed by slot id. Never throws — an empty list just shows the "coming soon" state. */
export async function getShowcase(): Promise<{ available: boolean; items: ShowcaseItem[] }> {
  try {
    const rows = await prisma.project.findMany({
      where: { showcaseSlot: { not: null }, status: "COMPLETED", finalVideoUrl: { not: null } },
      select: { showcaseSlot: true, title: true, finalVideoUrl: true, thumbnailUrl: true, actualDuration: true },
    });
    const items = rows.map((r) => ({ id: r.showcaseSlot as string, title: r.title, url: r.finalVideoUrl as string, thumbnailUrl: r.thumbnailUrl, duration: r.actualDuration }));
    return { available: items.some((i) => LESSON_SLOTS.includes(i.id)), items };
  } catch {
    return { available: false, items: [] };
  }
}
