import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { postLedger } from "@/lib/credits";
import { estimateCredits } from "@vidforge/shared";
import { catalog } from "@/lib/config";
import { parseSettings } from "@/lib/projectInput";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // database only, but up to 16 lessons × 3 writes

type OutlineLesson = { category: string; title: string; description: string; prompt: string; minutes: number };

/**
 * Called by the worker (x-admin-token) once DeepSeek has designed the course: creates one project per lesson
 * (Educational format, AI images, captions) plus the Lesson rows, reserving credits from the requesting admin.
 * body: { userId, courseId?, language?, lessons: [...] }
 */
export async function POST(req: Request) {
  const token = process.env.WORKER_ADMIN_TOKEN;
  if (!token || req.headers.get("x-admin-token") !== token) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => ({}))) as { userId?: string; courseId?: string; language?: string; lessons?: OutlineLesson[] };
  if (!b.userId || !Array.isArray(b.lessons) || b.lessons.length === 0) return badRequest("userId and lessons are required");

  const user = await prisma.user.findUnique({ where: { id: b.userId }, select: { id: true, credits: true, role: true } });
  if (!user || user.role !== "ADMIN") return json({ error: "Requesting user not found or not an admin" }, 403);

  const courseId = (b.courseId || "main").slice(0, 40);
  const { rates } = await catalog();
  const { characters: _c, ...settings } = parseSettings({ prompt: "course", language: b.language || "English", videoType: "Educational", aspectRatio: "R16_9", visualSource: "ai_images", imageStyle: "clean_corporate", look: "bright_clean", lookIntensity: 70, captionsEnabled: true, captionStyle: "YouTube Clean", musicStyle: "Lo-fi", voiceStyle: "Educational", outputQuality: "1080p", voiceEnabled: true, musicEnabled: true, textOverlaysEnabled: true, narrationMode: "narrator" });

  const estimate = (l: OutlineLesson) => estimateCredits({ targetDuration: Math.round(l.minutes * 60), visualSource: "ai_images", musicEnabled: true, voiceEnabled: true }, rates);
  const total = b.lessons.reduce((a, l) => a + estimate(l).reserve, 0);
  if (user.credits < total) return badRequest(`This course needs about ${total} credits; the admin has ${user.credits}. Grant credits in Admin → Users first.`);

  const existing = await prisma.lesson.count({ where: { courseId } });
  const created: string[] = [];
  for (let i = 0; i < b.lessons.length; i++) {
    const l = b.lessons[i];
    const est = estimate(l);
    const project = await prisma.project.create({ data: { ...settings, userId: user.id, title: l.title, prompt: l.prompt, targetDuration: Math.round(l.minutes * 60), status: "QUEUED", creditsReserved: est.reserve } });
    await postLedger(user.id, "RESERVE", -est.reserve, { projectId: project.id, reason: `Academy lesson "${l.title.slice(0, 40)}"` });
    await prisma.lesson.create({ data: { courseId, order: existing + i, category: l.category, title: l.title, description: l.description, prompt: l.prompt, projectId: project.id, published: true } });
    created.push(project.id);
  }
  return json({ ok: true, lessons: created.length, projects: created, reserved: total }, 201);
}
