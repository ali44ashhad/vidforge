import { config } from "dotenv";
import path from "node:path";

// Load the single root .env (works when started from apps/worker OR repo root)
config({ path: path.resolve(process.cwd(), "../../.env") });
config({ path: path.resolve(process.cwd(), ".env") });

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name} (see .env.example)`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  STORAGE_DIR: path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage"),
  STORAGE_PUBLIC_URL: (process.env.STORAGE_PUBLIC_URL || "http://localhost:4000").replace(/\/$/, ""),
  WORKER_PORT: Number(process.env.WORKER_PORT || 4000),
  WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY || 1),

  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  PEXELS_API_KEY: process.env.PEXELS_API_KEY || "",
  /// "elevenlabs" (default) or "abhibots"
  VOICE_PROVIDER: (process.env.VOICE_PROVIDER || "elevenlabs").toLowerCase(),
  /// "kie" (default), "abhibots" or "snapgen"
  IMAGE_PROVIDER: (process.env.IMAGE_PROVIDER || "kie").toLowerCase(),
  SNAPGEN_API_KEY: process.env.SNAPGEN_API_KEY || "",
  VIDEO_CONCURRENCY: Number(process.env.VIDEO_CONCURRENCY || 3),
  /// true = generate an image first and animate it (consistent characters); false = pure text-to-video, no image step
  VIDEO_FROM_IMAGE: (process.env.VIDEO_FROM_IMAGE || "true").toLowerCase() !== "false",
  ABHIBOTS_API_KEY: process.env.ABHIBOTS_API_KEY || "",
  ABHIBOTS_BASE_URL: (process.env.ABHIBOTS_BASE_URL || "https://app.abhibots.com/api").replace(/\/$/, ""),
  // Voice provider: ElevenLabs or any ElevenLabs-compatible API (e.g. a reseller). Set VOICE_API_BASE_URL to switch.
  ELEVENLABS_API_KEY: process.env.VOICE_API_KEY || process.env.ELEVENLABS_API_KEY || "",
  VOICE_API_BASE_URL: (process.env.VOICE_API_BASE_URL || "https://api.elevenlabs.io/v1").replace(/\/$/, ""),
  /// "xi-api-key" (ElevenLabs default) or "bearer" (Authorization: Bearer <key>)
  VOICE_AUTH_STYLE: (process.env.VOICE_AUTH_STYLE || "xi-api-key").toLowerCase(),
  ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || "",
  KIE_API_KEY: process.env.KIE_API_KEY || "",
  KIE_MODEL: process.env.KIE_MODEL || "V4_5",
  KIE_CALLBACK_URL: process.env.KIE_CALLBACK_URL || "https://example.com/kie-callback",
  /// Parallel AI image tasks (Kie runs them concurrently; lower this if you get rate-limit errors)
  IMAGE_CONCURRENCY: Number(process.env.IMAGE_CONCURRENCY || 6),
  /// Parallel Pexels lookups/downloads
  STOCK_CONCURRENCY: Number(process.env.STOCK_CONCURRENCY || 3),
  FFMPEG_PATH: process.env.FFMPEG_PATH || "ffmpeg",
  FFPROBE_PATH: process.env.FFPROBE_PATH || "ffprobe",
};

/** Throws a clear message when a stage needs a key that is not configured. */
export function requireKey(name: "DEEPSEEK_API_KEY" | "PEXELS_API_KEY" | "ELEVENLABS_API_KEY" | "KIE_API_KEY" | "ABHIBOTS_API_KEY" | "SNAPGEN_API_KEY"): string {
  const v = env[name];
  if (!v) throw new Error(`${name === "ELEVENLABS_API_KEY" ? "VOICE_API_KEY / ELEVENLABS_API_KEY" : name} is not set in .env`);
  return v;
}
