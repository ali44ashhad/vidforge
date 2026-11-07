import express from "express";
import { generateIdeas, generateCourseOutline } from "./services/deepseek";
import { reserveCredits } from "./services/credits";
import { rates } from "./services/config";
import { estimateCredits } from "@vidforge/shared";
import { searchCommunityVoices, addCommunityVoice, syncCommunityVoices, addVoiceById } from "./services/voice/community";
import { Readable } from "node:stream";
import { searchVideos, searchPhotos } from "./services/pexels";
import { prisma } from "@vidforge/db";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pingKie } from "./services/music";
import { ping as pingSnap } from "./services/snapgen";
import { providerName } from "./services/voice";
import { workerState } from "./poller";
const execFileP = promisify(execFile);

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "./env";
import { log } from "./lib/log";
import { buildPublishKit, renderThumbnailsFromChoices } from "./services/seo";

/** Tiny HTTP server: health check + serves everything under STORAGE_DIR at /files/... */
export function startFileServer() {
  fs.mkdirSync(env.STORAGE_DIR, { recursive: true });
  const app = express();
  app.use((_req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); });
  app.get("/health", (_req, res) => res.json({ ok: true, service: "vidforge-worker" }));

  /** Admin status (queue, in-flight, provider balances, disk). Needs header x-admin-token = WORKER_ADMIN_TOKEN. */
  app.get("/admin/status", async (req, res) => {
    const token = process.env.WORKER_ADMIN_TOKEN;
    if (!token || req.header("x-admin-token") !== token) return res.status(401).json({ error: "unauthorized" });
    const [queued, running, paused, failed24] = await Promise.all([
      prisma.project.count({ where: { status: "QUEUED" } }),
      prisma.project.count({ where: { lockedAt: { not: null }, status: { notIn: ["COMPLETED", "FAILED", "PAUSED", "QUEUED"] } } }),
      prisma.project.count({ where: { status: "PAUSED" } }),
      prisma.project.count({ where: { status: "FAILED", updatedAt: { gte: new Date(Date.now() - 86400e3) } } }),
    ]);
    const oldest = await prisma.project.findFirst({ where: { status: "QUEUED" }, orderBy: { updatedAt: "asc" }, select: { updatedAt: true } });
    const providers: Record<string, { ok: boolean; detail: string }> = {};
    const probe = async (name: string, fn: () => Promise<string>) => { try { providers[name] = { ok: true, detail: await fn() }; } catch (e) { providers[name] = { ok: false, detail: (e as Error).message.slice(0, 160) }; } };
    await Promise.all([probe("Kie.ai", pingKie), probe("SnapGen", pingSnap), probe("Voice", async () => `${providerName()} · ${(await prisma.voice.count())} voices synced`)]);
    let disk: { totalGb: number; freeGb: number } | null = null;
    try { const { stdout } = await execFileP("df", ["-k", env.STORAGE_DIR]); const parts = stdout.trim().split("\n").pop()!.split(/\s+/); disk = { totalGb: Math.round(Number(parts[1]) / 1e6), freeGb: Math.round(Number(parts[3]) / 1e6) }; } catch { /* ignore */ }
    res.json({
      ok: true, uptimeSec: Math.round((Date.now() - workerState.startedAt) / 1000), inFlight: workerState.active, concurrency: env.WORKER_CONCURRENCY,
      queue: { queued, running, paused, failed24h: failed24, oldestQueuedSec: oldest ? Math.round((Date.now() - oldest.updatedAt.getTime()) / 1000) : 0 },
      providers, disk, settings: { imageProvider: process.env.IMAGE_PROVIDER, videoModel: process.env.SNAPGEN_VIDEO_MODEL, videoConcurrency: process.env.VIDEO_CONCURRENCY, imageConcurrency: process.env.IMAGE_CONCURRENCY, renderParallel: process.env.RENDER_PARALLEL },
      cpu: os.loadavg().map((n) => Math.round(n * 100) / 100), memFreeGb: Math.round(os.freemem() / 1e8) / 10, memTotalGb: Math.round(os.totalmem() / 1e8) / 10,
    });
  });
  app.options("/projects/:id/publish-kit", (_req, res) => { res.setHeader("Access-Control-Allow-Headers", "Content-Type"); res.setHeader("Access-Control-Allow-Methods", "POST"); res.sendStatus(204); });
  // Regenerate titles/description/tags/thumbnails only (no re-render)
  app.post("/projects/:id/publish-kit", async (req, res) => {
    try {
      const kit = await buildPublishKit(req.params.id, (m) => log(req.params.id, `publish kit: ${m}`));
      res.json({ ok: true, kit });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
  app.options("/projects/:id/thumbnails", (_req, res) => { res.setHeader("Access-Control-Allow-Headers", "Content-Type"); res.setHeader("Access-Control-Allow-Methods", "POST"); res.sendStatus(204); });
  app.post("/projects/:id/thumbnails", express.json(), async (req, res) => {
    try {
      const items = ((req.body as { items?: { bg: number; text: string; highlight?: string }[] }).items ?? []).filter((x) => x && typeof x.text === "string");
      const kit = await renderThumbnailsFromChoices(req.params.id, items);
      res.json({ ok: true, kit });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });
  /** YouTube resumable upload of a project's final.mp4 (+ thumbnail). Called by the web app with a fresh access token. */
  app.post("/projects/:id/youtube-upload", express.json(), async (req, res) => {
    const token = process.env.WORKER_ADMIN_TOKEN;
    if (!token || req.header("x-admin-token") !== token) return res.status(401).json({ error: "unauthorized" });
    try {
      const b = req.body as { accessToken: string; title: string; description: string; tags: string[]; privacy: string; publishAt: string | null; thumbnailUrl: string | null; madeForKids: boolean };
      const file = path.join(env.STORAGE_DIR, "projects", req.params.id, "output", "final.mp4");
      if (!fs.existsSync(file)) return res.status(404).json({ error: "final.mp4 not found" });
      const size = fs.statSync(file).size;
      const meta = { snippet: { title: b.title, description: b.description, tags: b.tags, categoryId: "22" }, status: { privacyStatus: b.publishAt ? "private" : b.privacy, selfDeclaredMadeForKids: b.madeForKids, ...(b.publishAt ? { publishAt: new Date(b.publishAt).toISOString() } : {}) } };
      const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
        method: "POST", headers: { Authorization: `Bearer ${b.accessToken}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": "video/mp4" }, body: JSON.stringify(meta),
      });
      if (!init.ok) return res.status(502).json({ error: `YouTube init failed: ${init.status} ${(await init.text()).slice(0, 300)}` });
      const location = init.headers.get("location");
      if (!location) return res.status(502).json({ error: "YouTube did not return an upload URL" });
      const up = await fetch(location, { method: "PUT", headers: { "Content-Length": String(size), "Content-Type": "video/mp4" }, body: Readable.toWeb(fs.createReadStream(file)) as unknown as ReadableStream, duplex: "half" } as RequestInit);
      if (!up.ok) return res.status(502).json({ error: `YouTube upload failed: ${up.status} ${(await up.text()).slice(0, 300)}` });
      const video = (await up.json()) as { id: string };
      // thumbnail (optional; needs a verified channel on YouTube's side)
      let thumbOk = false;
      const thumbLocal = b.thumbnailUrl ? path.join(env.STORAGE_DIR, b.thumbnailUrl.replace(/^https?:\/\/[^/]+\/files\//, "").split("?")[0]) : null;
      if (thumbLocal && fs.existsSync(thumbLocal)) {
        const t = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${video.id}`, { method: "POST", headers: { Authorization: `Bearer ${b.accessToken}`, "Content-Type": "image/jpeg" }, body: fs.readFileSync(thumbLocal) });
        thumbOk = t.ok; if (!t.ok) log(req.params.id, `thumbnail set failed: ${t.status} ${(await t.text()).slice(0, 200)}`);
      }
      log(req.params.id, `uploaded to YouTube: ${video.id} (${b.privacy}${b.publishAt ? ", scheduled" : ""}, thumbnail ${thumbOk ? "set" : "not set"})`);
      res.json({ ok: true, videoId: video.id, thumbnailSet: thumbOk });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  /** Removes a project's storage folder (called by the web app after a DB delete). */
  app.delete("/projects/:id/storage", (req, res) => {
    const token = process.env.WORKER_ADMIN_TOKEN;
    if (!token || req.header("x-admin-token") !== token) return res.status(401).json({ error: "unauthorized" });
    const dir = path.join(env.STORAGE_DIR, "projects", req.params.id);
    if (!/^[a-z0-9]+$/i.test(req.params.id) || !fs.existsSync(dir)) return res.json({ ok: true, removed: false });
    fs.rmSync(dir, { recursive: true, force: true });
    res.json({ ok: true, removed: true });
  });

  /** Community voice library: search (any signed-in user via the web app), add (adds to our ElevenLabs account), sync (admin). */
  app.get("/voices/community", async (req, res) => {
    try { const q = req.query as Record<string, string>; res.json({ voices: await searchCommunityVoices({ search: q.q, language: q.language, gender: q.gender, accent: q.accent, limit: Number(q.limit) || 30 }), total: await prisma.communityVoice.count() }); }
    catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });
  app.post("/voices/community/add", express.json(), async (req, res) => {
    const token = process.env.WORKER_ADMIN_TOKEN;
    if (!token || req.header("x-admin-token") !== token) return res.status(401).json({ error: "unauthorized" });
    const r = await addCommunityVoice(String((req.body as { voiceId?: string }).voiceId ?? ""));
    res.status(r.ok ? 200 : 400).json(r);
  });
  app.post("/voices/by-id", express.json(), async (req, res) => {
    const token = process.env.WORKER_ADMIN_TOKEN;
    if (!token || req.header("x-admin-token") !== token) return res.status(401).json({ error: "unauthorized" });
    const r = await addVoiceById(String((req.body as { voiceId?: string }).voiceId ?? ""));
    res.status(r.ok ? 200 : 400).json(r);
  });
  app.post("/voices/community/sync", async (req, res) => {
    const token = process.env.WORKER_ADMIN_TOKEN;
    if (!token || req.header("x-admin-token") !== token) return res.status(401).json({ error: "unauthorized" });
    syncCommunityVoices().catch(() => {}); res.json({ ok: true, started: true });
  });

  /** Academy: generate a whole course in the background (outline → one project per lesson → Lesson rows). Admin token. */
  app.post("/academy/generate", express.json(), async (req, res) => {
    const token = process.env.WORKER_ADMIN_TOKEN;
    if (!token || req.header("x-admin-token") !== token) return res.status(401).json({ error: "unauthorized" });
    const b = req.body as { userId: string; topic?: string; audience?: string; lessons?: number; language?: string; courseId?: string };
    if (!b.userId) return res.status(400).json({ error: "userId required" });
    res.json({ ok: true, started: true });
    (async () => {
      const courseId = (b.courseId || "main").slice(0, 40);
      try {
        log("academy", `generating course "${b.topic || "default"}" (${b.lessons ?? 8} lessons)`);
        const lessons = await generateCourseOutline({ topic: b.topic || "YouTube success with AI video: from first video to monetization", audience: b.audience || "beginner creators", lessons: Math.min(16, Math.max(4, Number(b.lessons ?? 8))), language: b.language || "English" });
        const existing = await prisma.lesson.count({ where: { courseId } });
        const R = await rates();
        for (let i = 0; i < lessons.length; i++) {
          const l = lessons[i];
          const est = estimateCredits({ targetDuration: l.minutes * 60, visualSource: "ai_images", musicEnabled: true, voiceEnabled: true }, R);
          const project = await prisma.project.create({ data: { userId: b.userId, title: l.title, prompt: l.prompt, targetDuration: l.minutes * 60, status: "QUEUED", creditsReserved: est.reserve, language: b.language || "English", videoType: "Educational", aspectRatio: "R16_9", visualSource: "ai_images", imageStyle: "clean_corporate", look: "bright_clean", lookIntensity: 70, captionsEnabled: true, captionStyle: "YouTube Clean", musicStyle: "Lo-fi", voiceStyle: "Educational", outputQuality: "1080p", voiceEnabled: true, musicEnabled: true, textOverlaysEnabled: true } });
          try { await reserveCredits(b.userId, est.reserve, project.id, `Academy lesson "${l.title.slice(0, 40)}"`); }
          catch (e) { await prisma.project.delete({ where: { id: project.id } }); log("academy", `stopped: ${(e as Error).message} after ${i} lesson(s)`); return; }
          await prisma.lesson.create({ data: { courseId, order: existing + i, category: l.category, title: l.title, description: l.description, prompt: l.prompt, projectId: project.id, published: true } });
          log("academy", `lesson ${i + 1}/${lessons.length} queued: ${l.title}`);
        }
      } catch (e) { log("academy", `course generation failed: ${(e as Error).message}`); }
    })();
  });

  /** Course outline for the Academy (DeepSeek). POST { topic, audience, lessons, language } — admin token. */
  app.post("/course-outline", express.json(), async (req, res) => {
    const token = process.env.WORKER_ADMIN_TOKEN;
    if (!token || req.header("x-admin-token") !== token) return res.status(401).json({ error: "unauthorized" });
    try { const b = req.body as { topic?: string; audience?: string; lessons?: number; language?: string }; res.json({ lessons: await generateCourseOutline({ topic: b.topic || "YouTube success with AI video: from first video to monetization", audience: b.audience || "beginner creators", lessons: Math.min(16, Math.max(4, Number(b.lessons ?? 8))), language: b.language || "English" }) }); }
    catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  /** Video idea generation (DeepSeek). POST { topic, niche?, language?, audience?, count? } — protected by the admin token (called by the web app). */
  app.post("/ideas", express.json(), async (req, res) => {
    const token = process.env.WORKER_ADMIN_TOKEN;
    if (!token || req.header("x-admin-token") !== token) return res.status(401).json({ error: "unauthorized" });
    try {
      const b = req.body as { topic?: string; niche?: string; language?: string; audience?: string; count?: number; filter?: string };
      const ideas = await generateIdeas({ topic: String(b.topic ?? ""), niche: b.niche, language: b.language ?? "English", audience: b.audience, count: Math.min(12, Math.max(4, Number(b.count ?? 8))), filter: b.filter });
      res.json({ ideas });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  /** Stock search for the scene editor. GET /stock/search?q=...&orientation=landscape|portrait&type=video|photo */
  app.get("/stock/search", async (req, res) => {
    try {
      const q = String(req.query.q ?? "").trim(); if (!q) return res.json({ results: [] });
      const orientation = req.query.orientation === "portrait" ? "portrait" : "landscape";
      const type = req.query.type === "photo" ? "photo" : "video";
      const results = type === "video" ? await searchVideos(q, orientation, orientation === "portrait" ? 1080 : 1920, orientation === "portrait" ? 1920 : 1080, 18) : await searchPhotos(q, orientation, 18);
      res.json({ results: results.map((r) => ({ id: r.providerAssetId, type: r.type, url: r.url, previewUrl: r.previewUrl, width: r.width, height: r.height, duration: r.duration, creator: r.creator })) });
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  /** Zip of all finished MP4s in a batch (public URLs are unguessable ids; the web app checks ownership before redirecting here). */
  app.get("/batches/:id/zip", async (req, res) => {
    try {
      const projects = await prisma.project.findMany({ where: { batchId: req.params.id, status: "COMPLETED" }, select: { id: true, title: true } });
      if (!projects.length) return res.status(404).json({ error: "No finished videos in this batch yet" });
      const dir = path.join(env.STORAGE_DIR, "batches"); fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, `${req.params.id}.zip`);
      const tmp = path.join(dir, `${req.params.id}-stage`); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
      for (const p of projects) {
        const src = path.join(env.STORAGE_DIR, "projects", p.id, "output", "final.mp4");
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, `${p.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || p.id}-${p.id.slice(-6)}.mp4`));
      }
      fs.rmSync(out, { force: true });
      await execFileP("zip", ["-j", "-q", out, ...fs.readdirSync(tmp).map((f) => path.join(tmp, f))]);
      fs.rmSync(tmp, { recursive: true, force: true });
      res.setHeader("Content-Disposition", `attachment; filename="batch-${req.params.id.slice(-6)}.zip"`);
      res.sendFile(out);
    } catch (e) { res.status(500).json({ error: (e as Error).message }); }
  });

  app.options("/upload", (_req, res) => { res.setHeader("Access-Control-Allow-Headers", "Content-Type"); res.setHeader("Access-Control-Allow-Methods", "POST"); res.sendStatus(204); });
  // JSON { name, dataBase64 } (≤ 4 MB) → saved under storage/uploads; returns { path, url }
  app.post("/upload", express.json({ limit: "6mb" }), (req, res) => {
    try {
      const { name, dataBase64 } = req.body as { name?: string; dataBase64?: string };
      if (!dataBase64) return res.status(400).json({ error: "dataBase64 required" });
      const ext = (path.extname(name || "").toLowerCase() || ".png").replace(/[^.a-z0-9]/g, "");
      if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return res.status(400).json({ error: "Use a PNG, JPG or WEBP image" });
      const dir = path.join(env.STORAGE_DIR, "uploads");
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${crypto.randomUUID()}${ext}`);
      fs.writeFileSync(file, Buffer.from(dataBase64, "base64"));
      res.json({ path: file, url: `${env.STORAGE_PUBLIC_URL}/files/uploads/${path.basename(file)}` });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
  app.use(
    "/files",
    (req, res, next) => {
      if (req.query.download !== undefined) {
        const name = String(req.query.download || "") || undefined;
        res.setHeader("Content-Disposition", `attachment${name ? `; filename="${name.replace(/[^\w.-]+/g, "_")}"` : ""}`);
      }
      next();
    },
    express.static(env.STORAGE_DIR, {
      setHeaders(res, filePath) {
        if (filePath.endsWith(".mp4")) res.setHeader("Accept-Ranges", "bytes");
      },
    })
  );
  app.listen(env.WORKER_PORT, () => {
    log("server", `file server listening on http://localhost:${env.WORKER_PORT}`);
    log("server", `serving ${env.STORAGE_DIR} at ${env.STORAGE_PUBLIC_URL}/files/`);
  });
}
