/**
 * AbhiBots TTS (https://app.abhibots.com) — ElevenLabs voices via a credit-based reseller API.
 * Async task endpoint (supports speed/style) → poll → download MP3. No word timestamps are
 * returned, so callers estimate caption timing from the audio length.
 */
import fs from "node:fs";
import { env, requireKey } from "../../env";
import { fetchJson, fetchRetry } from "../../lib/http";
import { sleep } from "../../lib/log";
import type { VoiceInfo } from "./elevenlabs";
import { ttsModelFor } from "@vidforge/shared";

const BASE = () => env.ABHIBOTS_BASE_URL;
const headers = () => ({ "X-API-Key": requireKey("ABHIBOTS_API_KEY"), "Content-Type": "application/json" });

interface ProviderEntry { id: string; name: string; voices?: unknown[]; models?: { id: string; name?: string }[] }

/** Voices of the "eleven" provider, normalised to the ElevenLabs shape used across the app. */
export async function listVoices(): Promise<VoiceInfo[]> {
  const providers = await fetchJson<ProviderEntry[]>(`${BASE()}/tts/providers`, { headers: headers() });
  const eleven = providers.find((p) => p.id === "eleven") ?? providers[0];
  const raw = (eleven?.voices ?? []) as Record<string, unknown>[];
  return raw.map((v) => {
    const id = String(v.voice_id ?? v.voiceId ?? v.id ?? "");
    const name = String(v.name ?? v.voice_name ?? id);
    const labels = (v.labels as Record<string, string> | undefined) ?? {};
    for (const k of ["gender", "accent", "age", "language", "description", "use_case"]) if (typeof v[k] === "string" && !labels[k]) labels[k] = v[k] as string;
    const preview = (v.preview_url ?? v.previewUrl ?? v.preview ?? v.sample_url) as string | undefined;
    return { voice_id: id, name, category: String(v.category ?? "abhibots"), labels, preview_url: preview } as VoiceInfo & { preview_url?: string };
  }).filter((v) => v.voice_id);
}

export async function synthesizeToFile(args: {
  text: string; voiceId: string; dest: string; speed: number; stability: number; similarity: number; style: number; language?: string;
}): Promise<void> {
  const created = await fetchJson<{ task_id?: string; id?: string; error?: string }>(`${BASE()}/tts/task`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({
      input: args.text, voice_id: args.voiceId, model_id: ttsModelFor(args.language || "English", env.ELEVENLABS_MODEL_ID),
      stability: args.stability, similarity: args.similarity, style: args.style,
      speed: Math.min(1.2, Math.max(0.7, args.speed)), use_speaker_boost: true,
    }),
  });
  const taskId = created.task_id ?? created.id;
  if (!taskId) throw new Error(`AbhiBots task not created: ${created.error ?? JSON.stringify(created)}`);

  const started = Date.now();
  for (;;) {
    const t = await fetchJson<{ status?: string; result?: string; error?: string }>(`${BASE()}/tts/task/${encodeURIComponent(taskId)}`, { headers: headers() });
    if (t.status === "completed" && t.result) {
      // The file can still be finalising right after "completed" — accept it only when it looks like real audio.
      let lastErr = "";
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await sleep(2500);
        const res = await fetchRetry(t.result, { headers: { "X-API-Key": requireKey("ABHIBOTS_API_KEY") } });
        const type = res.headers.get("content-type") || "";
        const buf = Buffer.from(await res.arrayBuffer());
        if (!res.ok) { lastErr = `HTTP ${res.status}`; continue; }
        if (/json|html|text/i.test(type) || buf.length < 4000) { lastErr = `got ${buf.length} bytes (${type || "unknown type"})`; continue; }
        fs.writeFileSync(args.dest, buf);
        return;
      }
      throw new Error(`AbhiBots audio download failed after retries: ${lastErr}`);
    }
    if (t.status && /fail|error/i.test(t.status)) throw new Error(`AbhiBots task ${t.status}: ${t.error ?? ""}`);
    if (Date.now() - started > 5 * 60 * 1000) throw new Error("AbhiBots TTS task timed out");
    await sleep(3000);
  }
}

export async function ping(): Promise<string> {
  const me = await fetchJson<{ name?: string; credits?: number; tier?: string }>(`${BASE()}/users/me`, { headers: headers() }, 0);
  return `${me.name ?? "account"} — ${me.credits ?? "?"} credits (${me.tier ?? ""})`;
}

/** Image generation: synchronous, returns a temporary URL. 500 credits per image. */
export async function generateImage(prompt: string, aspect: string, referenceUrl?: string): Promise<{ url: string; taskId: string }> {
  const r = await fetchJson<{ url?: string; task_id?: string; error?: string }>(`${BASE()}/ml/image/mediaio`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ prompt: prompt.slice(0, 1500), aspect_ratio: aspect, model: process.env.ABHIBOTS_IMAGE_MODEL || "nano_banana_2", ...(referenceUrl ? { image_url: referenceUrl } : {}) }),
  }, 1);
  if (!r.url) throw new Error(`AbhiBots image failed: ${r.error ?? JSON.stringify(r)}`);
  return { url: r.url, taskId: r.task_id ?? `abhi-${Date.now()}` };
}
