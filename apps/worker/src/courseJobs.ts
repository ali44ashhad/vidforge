/**
 * Academy course generation — runs on the worker so the web app never waits on DeepSeek.
 *
 *   POST /course-generate  { topic, audience, lessons, language, courseId, userId, callbackUrl }  (x-admin-token)
 *     → 202 { jobId } immediately; in the background: DeepSeek designs the course, then the worker POSTs the
 *       outline to callbackUrl (the web app's /api/academy/materialize), which creates the lesson videos.
 *   GET  /course-jobs/:id  → { status: designing | creating | done | failed, error?, lessons?, reserved? }
 *
 * Jobs live in memory (a pm2 restart forgets them — the Academy list is the source of truth).
 */
import express from "express";
import type { Express, Request as ExReq, Response as ExRes } from "express";
import { randomUUID } from "node:crypto";
import { generateCourseOutline } from "./services/deepseek";

type Job = {
  id: string;
  status: "designing" | "creating" | "done" | "failed";
  startedAt: number;
  finishedAt?: number;
  error?: string;
  lessons?: number;
  reserved?: number;
  projects?: string[];
};

type Body = { topic?: string; audience?: string; lessons?: number; language?: string; courseId?: string; userId?: string; callbackUrl?: string };

const jobs = new Map<string, Job>();
const DEFAULT_TOPIC = "YouTube success with AI video: from first video to monetization";
const log = (m: string) => console.log(`[academy] ${m}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function authed(req: ExReq, res: ExRes) {
  const token = process.env.WORKER_ADMIN_TOKEN;
  if (!token || req.header("x-admin-token") !== token) { res.status(401).json({ error: "unauthorized" }); return false; }
  return true;
}

export function registerCourseRoutes(app: Express) {
  app.post("/course-generate", express.json(), (req, res) => {
    if (!authed(req, res)) return;
    const b = (req.body ?? {}) as Body;
    if (!b.callbackUrl || !b.userId) return res.status(400).json({ error: "callbackUrl and userId are required" });
    // forget jobs older than 6 hours
    for (const [k, j] of jobs) if (Date.now() - j.startedAt > 6 * 3600_000) jobs.delete(k);
    const job: Job = { id: randomUUID(), status: "designing", startedAt: Date.now() };
    jobs.set(job.id, job);
    res.status(202).json({ ok: true, jobId: job.id });
    void run(job, b);
  });

  app.get("/course-jobs/:id", (req, res) => {
    if (!authed(req, res)) return;
    const j = jobs.get(req.params.id);
    if (!j) return res.status(404).json({ status: "unknown", error: "Unknown job — the worker may have restarted. Check the lesson list below." });
    res.json(j);
  });
}

async function run(job: Job, b: Body) {
  const lessonsWanted = Math.min(16, Math.max(4, Number(b.lessons ?? 8) || 8));
  const language = b.language || "English";
  try {
    log(`job ${job.id}: designing ${lessonsWanted} lessons for "${(b.topic || DEFAULT_TOPIC).slice(0, 60)}"`);
    const lessons = await generateCourseOutline({ topic: b.topic || DEFAULT_TOPIC, audience: b.audience || "beginner creators", lessons: lessonsWanted, language });
    job.status = "creating";
    log(`job ${job.id}: outline ready (${lessons.length} lessons) → ${b.callbackUrl}`);

    const body = JSON.stringify({ userId: b.userId, courseId: b.courseId, language, lessons });
    let last = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(b.callbackUrl as string, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": process.env.WORKER_ADMIN_TOKEN || "" }, body });
        const d = (await r.json().catch(() => ({}))) as { error?: string; lessons?: number; reserved?: number; projects?: string[] };
        if (r.ok) {
          Object.assign(job, { status: "done", finishedAt: Date.now(), lessons: d.lessons, reserved: d.reserved, projects: d.projects });
          log(`job ${job.id}: done — ${d.lessons} lesson videos queued (${d.reserved} credits reserved)`);
          return;
        }
        last = d.error || `HTTP ${r.status}`;
        if (r.status >= 400 && r.status < 500) break; // e.g. not enough credits — retrying won't help
      } catch (e) { last = (e as Error).message; }
      log(`job ${job.id}: callback attempt ${attempt} failed: ${last}`);
      await sleep(10_000 * attempt);
    }
    throw new Error(`Course designed, but the web app could not save it: ${last}`);
  } catch (e) {
    Object.assign(job, { status: "failed", finishedAt: Date.now(), error: (e as Error).message });
    log(`job ${job.id}: FAILED — ${(e as Error).message}`);
  }
}
