/**
 * Kie.ai image generation (nano-banana family) — same API key as music.
 * createTask → poll recordInfo → resultUrls.
 */
import { env, requireKey } from "../env";
import { fetchJson } from "../lib/http";
import { sleep } from "../lib/log";

const BASE = "https://api.kie.ai/api/v1";
const MODEL = process.env.KIE_IMAGE_MODEL || "nano-banana-2";

function headers() {
  return { Authorization: `Bearer ${requireKey("KIE_API_KEY")}`, "Content-Type": "application/json" };
}

export function kieAspect(aspectRatio: string): string {
  return { R16_9: "16:9", R9_16: "9:16", R1_1: "1:1", R4_5: "4:5" }[aspectRatio] ?? "16:9";
}

export async function submitImage(prompt: string, aspect: string, referenceUrls: string[] = []): Promise<string> {
  const lite = /lite|google\//.test(MODEL);
  const dropped = referenceUrls.filter((r) => !/^https?:\/\//.test(r));
  if (dropped.length) console.log(`[kie] ${dropped.length} local reference file(s) skipped — Kie needs public URLs (set STORAGE_PUBLIC_URL to a public domain, e.g. on the VPS)`);
  referenceUrls = referenceUrls.filter((r) => /^https?:\/\//.test(r));
  const data = await fetchJson<{ code: number; msg: string; data?: { taskId: string } }>(`${BASE}/jobs/createTask`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      callBackUrl: env.KIE_CALLBACK_URL,
      input: lite
        ? { prompt: prompt.slice(0, 1500), image_urls: referenceUrls.slice(0, 5), aspect_ratio: aspect, output_format: "jpg" }
        : { prompt: prompt.slice(0, 1500), image_input: referenceUrls.slice(0, 5), aspect_ratio: aspect, resolution: "1K", output_format: "jpg" },
    }),
  });
  if (data.code !== 200 || !data.data?.taskId) throw new Error(`Kie image createTask failed: ${data.msg ?? JSON.stringify(data)}`);
  return data.data.taskId;
}

export async function waitForImage(taskId: string, timeoutMs = 4 * 60 * 1000): Promise<string> {
  const started = Date.now();
  for (;;) {
    const data = await fetchJson<{ code: number; msg: string; data?: { state: string; resultJson?: string; failMsg?: string; failCode?: string } }>(
      `${BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: headers() });
    const state = (data.data?.state ?? "").toLowerCase();
    if (state === "success") {
      const parsed = JSON.parse(data.data?.resultJson || "{}") as { resultUrls?: string[] };
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error("Kie image finished without a result URL");
      return url;
    }
    if (state === "fail" || state === "failed" || state === "error") throw new Error(`Kie image failed: ${data.data?.failMsg ?? data.msg}`);
    if (Date.now() - started > timeoutMs) throw new Error("Kie image generation timed out");
    await sleep(2500);
  }
}

/** Full prompt for a shot image: description + style + no-text guard. */
import { findStyle } from "@vidforge/shared";
export function imagePrompt(visualDescription: string, style: string | null | undefined, tone: string, onScreenText?: string | null): string {
  const preset = findStyle(style);
  if (!preset) return `${visualDescription}. Style: ${style || "cinematic photo"}, ${tone}. High detail, no text, no watermark, no logos, no captions.`;
  const textPart = preset.textInImage && onScreenText
    ? ` The text "${onScreenText}" is written in the scene in the same hand-drawn style, large and legible.`
    : preset.textInImage ? " Any labels in the scene are short and legible." : " No text, no captions, no watermark.";
  return `${visualDescription}. ${preset.prompt}. Mood: ${tone}.${textPart} Avoid: ${preset.negative}.`;
}
