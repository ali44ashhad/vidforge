/**
 * Internal provider gateway. The public y2_ key is checked by the web app, which
 * forwards here with the shared admin token. Handlers always use local provider keys.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { completeChat } from "./services/deepseek";
import { generateAiImage } from "./services/imageProvider";
import { submitMusic, waitForMusic } from "./services/music";
import { searchPhotos, searchVideos } from "./services/pexels";
import { listVoices, ping, synthesizeToFile } from "./services/voice";
import { runAsGateway } from "./services/y2ube";

function auth(req: Request, res: Response, next: NextFunction) {
  const token = process.env.WORKER_ADMIN_TOKEN;
  if (!token || req.header("x-gateway-token") !== token) return res.status(401).json({ error: "unauthorized" });
  next();
}

function wrap(fn: (req: Request) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    runAsGateway(() => fn(req))
      .then((data) => res.json(data))
      .catch((e) => {
        const message = (e as Error).message || "gateway failed";
        res.status(/required|invalid/i.test(message) ? 400 : 500).json({ error: message });
      });
  };
}

export function mountGateway(app: Express) {
  const json = express.json({ limit: "8mb" });
  app.get("/v1/gateway/ping", auth, wrap(async () => ({ ok: true, detail: await ping() })));
  app.get("/v1/gateway/voices", auth, wrap(async () => ({ voices: await listVoices() })));
  app.get("/v1/gateway/stock", auth, wrap(async (req) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) throw new Error("q is required");
    const orientation = req.query.orientation === "portrait" ? "portrait" : req.query.orientation === "square" ? "square" : "landscape";
    const perPage = Math.min(30, Math.max(1, Number(req.query.perPage ?? 15) || 15));
    const type = req.query.type === "photo" ? "photo" : "video";
    const w = Number(req.query.w ?? (orientation === "portrait" ? 1080 : 1920)) || 1920;
    const h = Number(req.query.h ?? (orientation === "portrait" ? 1920 : 1080)) || 1080;
    const results = type === "photo" ? await searchPhotos(q, orientation, perPage) : await searchVideos(q, orientation, w, h, perPage);
    return { results };
  }));
  app.post("/v1/gateway/llm", auth, json, wrap(async (req) => {
    const b = req.body as { messages?: { role: "system" | "user" | "assistant"; content: string }[]; maxTokens?: number; temperature?: number };
    if (!Array.isArray(b.messages) || b.messages.length === 0) throw new Error("messages is required");
    const text = await completeChat(b.messages, Number(b.maxTokens ?? 4000) || 4000, Number(b.temperature ?? 0.7));
    return { text };
  }));
  app.post("/v1/gateway/voice", auth, json, wrap(async (req) => {
    const b = req.body as { text?: string; voiceId?: string; style?: string; speed?: number; language?: string; previousText?: string; nextText?: string };
    const text = String(b.text ?? "").trim();
    const voiceId = String(b.voiceId ?? "").trim();
    if (!text) throw new Error("text is required");
    if (!voiceId) throw new Error("voiceId is required");
    if (text.length > 8000) throw new Error("text is too long");
    const dest = path.join(os.tmpdir(), `y2-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
    try {
      const { alignment } = await synthesizeToFile({ text, voiceId, style: b.style || "Documentary", speed: Number(b.speed ?? 1) || 1, dest, language: b.language, previousText: b.previousText, nextText: b.nextText });
      return { audioBase64: fs.readFileSync(dest).toString("base64"), alignment };
    } finally { fs.rmSync(dest, { force: true }); }
  }));
  app.post("/v1/gateway/image", auth, json, wrap(async (req) => {
    const b = req.body as { prompt?: string; aspect?: string; referenceUrls?: string[]; style?: string | null };
    const prompt = String(b.prompt ?? "").trim();
    if (!prompt) throw new Error("prompt is required");
    return generateAiImage(prompt, b.aspect || "16:9", Array.isArray(b.referenceUrls) ? b.referenceUrls.filter((u) => typeof u === "string") : [], b.style);
  }));
  app.post("/v1/gateway/music", auth, json, wrap(async (req) => {
    const b = req.body as { prompt?: string; model?: string };
    const prompt = String(b.prompt ?? "").trim();
    if (!prompt) throw new Error("prompt is required");
    const taskId = await submitMusic(prompt, b.model);
    return waitForMusic(taskId);
  }));
}
