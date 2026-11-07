/**
 * SnapGen (api.snapgen.ai) image generation — nano-banana-pro / nano-banana-2 / nano-banana-2-lite.
 * POST multipart /uapi/v1/generate_image → { uuid, status (1 processing | 2 completed | 3 failed), generate_result }.
 * If the result is still processing we poll the history endpoint (configurable) until status 2.
 */
import { env, requireKey } from "../env";
import { findStyle } from "@vidforge/shared";
import { fetchRetry } from "../lib/http";
import { sleep } from "../lib/log";

const BASE = (process.env.SNAPGEN_BASE_URL || "https://api.snapgen.ai/uapi/v1").replace(/\/$/, "");
const MODEL = process.env.SNAPGEN_IMAGE_MODEL || "nano-banana-2";
/** Poll URL template; {uuid} is replaced. Override with SNAPGEN_HISTORY_URL if SnapGen's docs show a different path. */
const HISTORY = process.env.SNAPGEN_HISTORY_URL || `${BASE}/history/{uuid}`;

interface SnapResult {
  id?: number; uuid?: string; status?: number; status_desc?: string; generate_result?: string | null;
  error_message?: string; error_code?: string; used_credit?: number; message?: string;
  detail?: string | { error_code?: string; error_message?: string };
  generated_image?: { image_url?: string | null; file_download_url?: string | null; status?: number | null; error_message?: string | null }[];
}

function resultUrl(r: SnapResult): string | null {
  return r.generate_result || r.generated_image?.[0]?.image_url || r.generated_image?.[0]?.file_download_url || null;
}
function errMsg(r: SnapResult): string {
  const d = typeof r.detail === "object" && r.detail ? `${r.detail.error_code ?? ""} ${r.detail.error_message ?? ""}`.trim() : (typeof r.detail === "string" ? r.detail : "");
  return r.error_message || r.generated_image?.[0]?.error_message || d || r.message || r.error_code || "unknown";
}

function key() { return requireKey("SNAPGEN_API_KEY"); }

/**
 * Rate pacer: nano-banana-pro is free but limited to 5 requests/min (100/h).
 * Requests are spaced 12.5 s apart when that model is in use; other models are unthrottled.
 */
const PER_MINUTE = Number(process.env.SNAPGEN_RPM || (MODEL === "nano-banana-pro" ? 5 : 0));
let nextSlot = 0;
async function pace() {
  if (!PER_MINUTE) return;
  const gap = 60000 / PER_MINUTE + 500;
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + gap;
  if (at > now) await sleep(at - now);
}

/** Maps our style names to SnapGen's fixed style list. */
export function snapStyle(style?: string | null): string {
  const preset = findStyle(style);
  if (preset?.snapStyle) return preset.snapStyle;
  const s = (style || "").toLowerCase();
  if (/watercolor/.test(s)) return "Watercolor";
  if (/anime/.test(s)) return "Anime General";
  if (/3d|pixar|render/.test(s)) return "3D Render";
  if (/illustration|storybook|cartoon|crayon|paper|flat|vector|pixel/.test(s)) return "Illustration";
  if (/portrait/.test(s)) return "Portrait Cinematic";
  if (/corporate|stock/.test(s)) return "Stock Photo";
  if (/game|concept/.test(s)) return "Game Concept";
  if (/photo|cinematic|documentary|moody|airy|realistic/.test(s)) return "Photorealistic";
  return "None";
}

import fs from "node:fs";
import path from "node:path";

/** Reference = public URL or local file path; local files are uploaded as multipart "files". */
function appendRefs(form: FormData, refs: string[], urlField: string, fileField: string, max: number) {
  for (const r of refs.slice(0, max)) {
    if (/^https?:\/\//.test(r)) form.append(urlField, r);
    else if (fs.existsSync(r)) form.append(fileField, new Blob([fs.readFileSync(r)]), path.basename(r));
  }
}

export async function generateImage(prompt: string, aspect: string, referenceUrls: string[] = [], style?: string | null): Promise<{ url: string; id: string }> {
  const form = new FormData();
  form.append("prompt", prompt.slice(0, 2000));
  form.append("model", MODEL);
  form.append("aspect_ratio", aspect);
  form.append("resolution", process.env.SNAPGEN_RESOLUTION || "1K");
  form.append("style", snapStyle(style));
  appendRefs(form, referenceUrls, "file_urls", "files", 5);

  await pace();
  const res = await fetchRetry(`${BASE}/generate_image`, { method: "POST", headers: { "x-api-key": key() }, body: form, timeoutMs: 90000 }, 4);
  const text = await res.text();
  let data: SnapResult = {};
  try { data = JSON.parse(text); } catch { throw new Error(`SnapGen returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(`SnapGen HTTP ${res.status}: ${errMsg(data) || text.slice(0, 200)}`);
  if (data.status === 3) throw new Error(`SnapGen failed: ${errMsg(data)}`);
  const immediate = resultUrl(data);
  if (data.status === 2 && immediate) return { url: immediate, id: data.uuid || String(data.id) };
  if (!data.uuid) throw new Error(`SnapGen: no result URL and no uuid to poll (${text.slice(0, 200)})`);
  console.log(`[snapgen] submitted ${data.uuid} status=${data.status} (${data.status_desc ?? ""})`);

  // still processing → poll (a slow or failed poll is NOT a failed image — keep polling until the deadline)
  const started = Date.now();
  const deadline = Number(process.env.SNAPGEN_IMAGE_TIMEOUT_MS || 8 * 60 * 1000);
  let polls = 0;
  for (;;) {
    await sleep(4000);
    let r: Response;
    try {
      r = await fetchRetry(HISTORY.replace("{uuid}", encodeURIComponent(data.uuid)), { headers: { "x-api-key": key() }, timeoutMs: 20000 }, 1);
    } catch (e) {
      console.log(`[snapgen] poll ${data.uuid}: ${(e as Error).message} — retrying`);
      if (Date.now() - started > deadline) throw new Error("SnapGen image generation timed out");
      continue;
    }
    const t = await r.text();
    let h: SnapResult = {};
    try { h = JSON.parse(t); } catch { /* keep polling */ }
    if (++polls % 5 === 1) console.log(`[snapgen] poll ${data.uuid}: http=${r.status} status=${h.status} (${h.status_desc ?? ""}) pct=${(h as { status_percentage?: number }).status_percentage ?? "?"} url=${resultUrl(h) ? "yes" : "no"} imgs=${h.generated_image?.length ?? 0}${polls === 1 ? ` raw=${t.slice(0, 300)}` : ""}`);
    const url = resultUrl(h);
    if (h.status === 2 && url) return { url, id: data.uuid };
    if (h.status === 3 || h.generated_image?.[0]?.status === 3) throw new Error(`SnapGen failed: ${errMsg(h)}`);
    if (r.status === 401) throw new Error("SnapGen: API key rejected while polling");
    if (Date.now() - started > deadline) throw new Error("SnapGen image generation timed out");
  }
}

export async function ping(): Promise<string> {
  const r = await fetchRetry(`${BASE}/histories?items_per_page=1&page=1`, { headers: { "x-api-key": key() } }, 0);
  const d = (await r.json().catch(() => ({}))) as { success?: boolean; total?: number } & SnapResult;
  if (r.status === 401) throw new Error(`SNAPGEN_API_KEY rejected: ${errMsg(d)}`);
  if (!r.ok) throw new Error(`SnapGen HTTP ${r.status}: ${errMsg(d)}`);
  return `key accepted (model ${MODEL}, ${d.total ?? 0} generations in history)`;
}
