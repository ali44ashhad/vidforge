import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";
export const dynamic = "force-dynamic";
/** Public (signed-in) list of lessons with their video status/URL. */
export async function GET() {
  const lessons = await prisma.lesson.findMany({ orderBy: [{ courseId: "asc" }, { order: "asc" }] });
  const ids = lessons.map((l) => l.projectId).filter(Boolean) as string[];
  const projects = ids.length ? await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, progress: true, finalVideoUrl: true, thumbnailUrl: true, actualDuration: true } }) : [];
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  return json({ lessons: lessons.map((l) => ({ ...l, video: l.projectId ? byId[l.projectId] ?? null : null })) });
}
