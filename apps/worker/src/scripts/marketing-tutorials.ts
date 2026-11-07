/**
 * Creates the Creator Academy lessons and the 90-second demo WITH Y2ube itself (public API), waits for them, and writes
 * apps/web/lib/tutorials.json so the homepage shows real videos.
 *   Y2_API_KEY=y2_… APP_URL=https://app.y2ube.io npm run marketing:tutorials -w apps/worker
 *   … -- --only niche,demo   … -- --force     (re-create)
 * Cost: ~6 × 2-minute explainers (≈ 40 credits each with AI images) + 1 demo ≈ 300 credits.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@vidforge/db";

const key = process.env.Y2_API_KEY, base = (process.env.APP_URL || "https://app.y2ube.io").replace(/\/$/, "");
if (!key) { console.error("Set Y2_API_KEY (Settings → API keys)"); process.exit(2); }
const H = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const OUT = path.resolve(__dirname, "../../../web/lib/tutorials.json");
const PENDING = path.resolve(__dirname, "../../../web/lib/tutorials-pending.json");
/** fetch with retries — a Wi-Fi blip must not abort an hour-long run */
async function get(url: string, init?: RequestInit): Promise<Response | null> {
  for (let i = 0; i < 5; i++) { try { return await fetch(url, init); } catch { await new Promise((ok) => setTimeout(ok, 5000 * (i + 1))); } }
  return null;
}

const COMMON = { language: "English", aspectRatio: "R16_9", visualSource: "ai_images", imageStyle: "clean_corporate", look: "bright_clean", lookIntensity: 70, captionsEnabled: true, captionStyle: "YouTube Clean", musicStyle: "Lo-fi", voiceStyle: "Educational", outputQuality: "1080p", videoType: "Educational" };

const LESSONS = [
  // Homepage showreel — plays inline, muted. No narration, no captions, no on-screen text: pure visual quality.
  { id: "showreel", targetDuration: 40, videoType: "Cinematic Showreel", title: "Y2ube showreel", visualSource: "ai_videos", aiVideoResolution: "1080p", voiceEnabled: false, captionsEnabled: false, textOverlaysEnabled: false, musicStyle: "Cinematic", look: "cinematic", lookIntensity: 85, imageStyle: "cinematic_photo", narrationMode: "narrator",
    prompt: "A 40-second cinematic showreel with NO people speaking and NO text: (1) slow aerial drone over a turquoise mountain lake at sunrise with mist, (2) a neon-lit city street at night in the rain with reflections, camera gliding forward, (3) a huge ocean wave curling in golden light, slow motion, (4) sunbeams through a foggy pine forest, dolly through the trees, (5) wind sweeping ripples across desert dunes at dusk. Every shot has smooth camera movement, rich colour, film-like depth. Order the shots by rising energy and end on a calm wide shot." },
  { id: "demo", targetDuration: 90, videoType: "Explainer", title: "Y2ube in 90 seconds", prompt: "A 90-second product explainer for Y2ube, an AI video studio for YouTube creators. Show the journey: type an idea → Y2ube writes the script, plans scenes, generates visuals, voiceover, music, captions, three thumbnails and an SEO package → the finished video is published to YouTube in one click. Audience: beginner creators. Tone: confident, friendly, no hype, no promises about earnings. End with 'Start free at y2ube.io'." },
  { id: "niche", targetDuration: 150, title: "Choose a profitable channel direction", prompt: "Lesson for new YouTube creators: how to choose a channel direction. Cover: pick a topic at the overlap of what you know, what people search for, and what can be made consistently; test 5 ideas before committing; look at demand using search suggestions and competitor upload frequency; avoid overly broad channels. Practical, concrete examples (finance explainers, history, tech reviews, kids stories). No income promises." },
  { id: "first-video", targetDuration: 150, title: "Create your first video", prompt: "Lesson: how to make your first YouTube video with an AI studio like Y2ube. Cover: writing a one-sentence idea with audience, tone and must-cover points; choosing format and length; picking visuals (stock vs AI images vs AI video); voice and captions; reviewing the result and fixing a scene; why the first video should be short and simple. Encouraging tone." },
  { id: "thumbnails", targetDuration: 150, title: "Make thumbnails people click", prompt: "Lesson: thumbnails that get clicks. Cover: one clear subject, 2-4 words max, one highlighted word, high contrast, faces and emotion, consistency across the channel, test two variants, and matching the thumbnail to the title without clickbait that the video doesn't deliver. Show do/don't examples described visually." },
  { id: "publish", targetDuration: 150, title: "Publish correctly on YouTube", prompt: "Lesson: publishing a video correctly on YouTube. Cover: title under 60 characters with the keyword early; description with chapters and links; tags and hashtags; choosing a thumbnail; scheduling for when your audience is online; the AI-content disclosure setting; pinned comment; checking the first 24 hours. Neutral, practical." },
  { id: "retention", targetDuration: 150, title: "Understand watch time & retention", prompt: "Lesson: watch time and audience retention explained simply. Cover: what the retention graph shows, the first 30 seconds, why hooks matter, pattern interrupts every 30-60 seconds, cutting slow intros, when to look at average view duration vs percentage, and how to read one video's graph to improve the next one." },
  { id: "monetize", targetDuration: 150, title: "Prepare for monetization", prompt: "Lesson: preparing a channel for the YouTube Partner Program. Cover: current eligibility thresholds in general terms (subscribers and watch hours or Shorts views — tell viewers to check YouTube's current requirements), community guidelines and reused-content rules, consistency and a publishing schedule, building a content library, and the mistakes that get channels rejected. No earnings promises; say results vary." },
];

type Row = { id: string; title: string; projectId: string; url: string; thumbnailUrl: string | null; duration: number | null };

(async () => {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.find((a) => a.startsWith("--only"))?.split("=")[1] ?? (args.includes("--only") ? args[args.indexOf("--only") + 1] : "");
  const wanted = only ? new Set(only.split(",")) : null;
  const existing: { items: Row[] } = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { items: [] };
  const items = new Map(existing.items.map((r) => [r.id, r]));
  // resume: projects created by an earlier run that haven't finished yet
  const pending: Record<string, string> = fs.existsSync(PENDING) ? JSON.parse(fs.readFileSync(PENDING, "utf8")) : {};
  const created: { lesson: (typeof LESSONS)[number]; projectId: string }[] = [];
  for (const [id, projectId] of Object.entries(pending)) { const l = LESSONS.find((x) => x.id === id); if (l && !items.has(id)) created.push({ lesson: l, projectId }); }
  if (created.length) console.log(`resuming ${created.length} project(s) from the previous run`);
  const savePending = () => fs.writeFileSync(PENDING, JSON.stringify(Object.fromEntries(created.map((c) => [c.lesson.id, c.projectId])), null, 2));
  const todo = LESSONS.filter((l) => (!wanted || wanted.has(l.id)) && (force || (!items.has(l.id) && !created.some((c) => c.lesson.id === l.id))));
  console.log(`${todo.length} video(s) to create`);
  for (const l of todo) {
    const r = await get(`${base}/api/v1/projects`, { method: "POST", headers: H, body: JSON.stringify({ ...COMMON, ...l, prompt: l.prompt, title: l.title }) });
    const d = r ? await r.json() : { error: "network" };
    if (!r || !r.ok) { console.error(`create ${l.id} failed:`, d.error); continue; }
    console.log(`created ${l.id} → ${d.id} (reserved ${d.creditsReserved})`); created.push({ lesson: l, projectId: d.id }); savePending();
  }
  const t0 = Date.now();
  while (created.length) {
    await new Promise((ok) => setTimeout(ok, 15000));
    for (const c of [...created]) {
      const r = await get(`${base}/api/v1/projects/${c.projectId}`, { headers: H });
      const p = r ? (await r.json().catch(() => ({}))).project : null;
      if (!p) continue;
      if (p.status === "COMPLETED") {
        items.set(c.lesson.id, { id: c.lesson.id, title: c.lesson.title, projectId: c.projectId, url: p.finalVideoUrl, thumbnailUrl: p.thumbnailUrl, duration: p.actualDuration });
        // feature it on the homepage right away (same as Admin → Projects → Homepage)
        try { await prisma.project.updateMany({ where: { showcaseSlot: c.lesson.id, id: { not: c.projectId } }, data: { showcaseSlot: null } }); await prisma.project.update({ where: { id: c.projectId }, data: { showcaseSlot: c.lesson.id } }); console.log(`  featured on homepage as "${c.lesson.id}"`); } catch (e) { console.log(`  could not set homepage slot: ${(e as Error).message.slice(0, 80)}`); }
        created.splice(created.indexOf(c), 1); savePending(); console.log(`\n✓ ${c.lesson.id} ready (${Math.round(p.actualDuration ?? 0)}s)`);
        fs.writeFileSync(OUT, JSON.stringify({ available: true, items: LESSONS.map((l) => items.get(l.id)).filter(Boolean) }, null, 2));
      } else if (p.status === "FAILED") { console.log(`\n✗ ${c.lesson.id} failed: ${p.error}`); created.splice(created.indexOf(c), 1); savePending(); }
    }
    process.stdout.write(`\r${created.length} in progress · ${Math.round((Date.now() - t0) / 60000)} min   `);
    if (Date.now() - t0 > 3 * 3600e3) { console.log("\ntimeout"); break; }
  }
  fs.writeFileSync(OUT, JSON.stringify({ available: items.size > 0, items: LESSONS.map((l) => items.get(l.id)).filter(Boolean) }, null, 2));
  console.log(`\nwrote ${OUT}. Commit and push: git add apps/web/lib/tutorials.json && git commit -m "academy videos" && git push`);
  process.exit(0);
})();
