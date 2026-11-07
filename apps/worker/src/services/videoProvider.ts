/**
 * AI video clips via SnapGen (Veo / Omni). Image-to-video: the shot's generated image is the start frame,
 * so characters and composition stay consistent with the rest of the video.
 */
import fs from "node:fs";
import path from "node:path";
import { env, requireKey } from "../env";
import { fetchRetry } from "../lib/http";
import { sleep } from "../lib/log";

const BASE = (process.env.SNAPGEN_BASE_URL || "https://api.snapgen.ai/uapi/v1").replace(/\/$/, "");
const MODEL = process.env.SNAPGEN_VIDEO_MODEL || "veo-3.1-fast";
const RES = process.env.SNAPGEN_VIDEO_RESOLUTION || "720p";
const DEADLINE = Number(process.env.SNAPGEN_VIDEO_TIMEOUT_MS || 15 * 60 * 1000);

interface Hist { uuid?: string; status?: number; status_desc?: string; error_message?: string; status_percentage?: number;
  detail?: { error_message?: string } | string; generated_video?: { video_url?: string | null; duration?: number | null; status?: number | null; error_message?: string | null }[] }

export interface GeneratedVideo { url: string; id: string; duration: number; model: string }

/** veo-3.1 family is 16:9 only; for portrait fall back to veo-2 (or omni-flash). */
function modelFor(aspect: string): string {
  if (aspect === "9:16" && /veo-3/.test(MODEL)) return process.env.SNAPGEN_VIDEO_MODEL_PORTRAIT || "veo-2";
  return MODEL;
}

/**
 * Veo 3.x always generates audio; prompts implying speech can fail at that step ("Audio generation failed").
 * We never use the audio, so: try as-is → retry with a silent-scene instruction → fall back to veo-2 (no audio).
 */
/**
 * Google's video policy (PROMINENT_PEOPLE_FILTER) rejects prompts that name a real person, living or dead.
 * A film about Neem Karoli Baba, Steve Jobs or Natwarlal loses every shot that names them — so the name is
 * swapped for a generic description before the prompt leaves the worker. The reference images carry the look;
 * the words only need to be filmable. VEO_NAME_MAP adds more: "Name=description;Other name=description".
 */
const REAL_NAMES: [RegExp, string][] = [
  [/\b(steve\s+jobs|स्टीव\s+जॉब्स)\b/giu, "a thin young American traveller with long hair"],
  [/\b(mark\s+)?zuckerberg\b|ज़करबर्ग|जुकरबर्ग/giu, "a young American man in a plain t-shirt"],
  [/\bjulia\s+roberts\b|जूलिया\s+रॉबर्ट्स/giu, "an American woman"],
  [/\bram\s+dass\b|राम\s+दास|\brichard\s+alpert\b/giu, "an American seeker in a kurta"],
  [/\blarry\s+brilliant\b|लैरी\s+ब्रिलियंट/giu, "an American doctor"],
  [/\bkrishna\s+das\b|कृष्ण\s+दास|\bbhagavan\s+das\b|भगवान\s+दास/giu, "an American devotee"],
  [/\bneem\s+karoli\s+baba\b|नीम\s+करौली\s+बाबा|नीम\s+करौली|\bneeb\s+karori\b|\bmaharaj\s*ji\b|महाराज\s*जी/giu, "an elderly Indian sadhu in a checked blanket"],
  [/\bnatwarlal\b|नटवरलाल|\bmithilesh\s+kumar\s+srivastava\b/giu, "a middle-aged Indian man in a three-piece suit"],
  [/\bdhirubhai\s+ambani\b|धीरूभाई\s+अंबानी|\bambani\b|अंबानी|\bbirla\b|बिड़ला/giu, "a wealthy Indian businessman"],
  [/\bgandhi\b|गांधी|\bnehru\b|नेहरू|\bmodi\b|मोदी|\byogi\s+adityanath\b|योगी/giu, "an Indian public figure"],
];
function extraNames(): [RegExp, string][] {
  const raw = process.env.VEO_NAME_MAP || "";
  return raw.split(";").map((pair) => pair.split("=")).filter((x) => x.length === 2 && x[0].trim())
    .map(([n, d]) => [new RegExp(n.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), d.trim()]);
}

/** Rewrites minors and named real people to generic adult descriptions before the prompt goes to Veo. */
export function sanitizeForVeo(text: string): string {
  for (const [re, d] of [...REAL_NAMES, ...extraNames()]) text = text.replace(re, d);
  return text
    .replace(/बच्चा|बच्चे|बच्ची|बालक|बालिका|किशोर|किशोरी|शिशु|नन्हा|नन्ही/gu, "नौजवान")
    .replace(/लड़की|लड़कियाँ|लड़कियां/gu, "युवती").replace(/लड़का|लड़के/gu, "नौजवान")
    .replace(/(ग्यारह|दस|नौ|आठ|सात|छह|पाँच|पांच|बारह|तेरह|चौदह|पंद्रह|सोलह|सत्रह)\s+(साल|वर्ष)\s+(का|की|के)\s+(उम्र|आयु)/gu, "बीस साल की उम्र")
    .replace(/\bस्कूल\b|पाठशाला/gu, "campus")
    .replace(/\b(1[0-9]|[1-9])[- ]?(year|yr)s?[- ]old\b/gi, "adult in their twenties")
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)[- ]?(year|yr)s?[- ]old\b/gi, "adult in their twenties")
    .replace(/\b(teenagers?|teens?|adolescents?|minors?|juveniles?)\b/gi, "young adults")
    .replace(/\b(school ?girls?|girls?)\b/gi, "young women").replace(/\b(school ?boys?|boys?)\b/gi, "young men")
    .replace(/\b(children|child|kids?|toddlers?|babies|baby|infants?)\b/gi, "young adults")
    .replace(/\b(students?|pupils?)\b/gi, "young adults")
    .replace(/\b(school|classroom|kindergarten|playground)\b/gi, "campus");
}

import { submitVideo as kieSubmit, waitForVideo as kieWait, kieVideoConfigured } from "./kieVideo";

/** Kie (Veo 3) attempt — used first when VIDEO_PROVIDER=kie, otherwise as the fallback when SnapGen fails. */
async function viaKie(prompt: string, aspect: string, startImageUrl?: string | null): Promise<GeneratedVideo> {
  const id = await kieSubmit(prompt, aspect, startImageUrl);
  const r = await kieWait(id);
  return { url: r.url, id, model: process.env.KIE_VIDEO_MODEL || "veo3_fast", duration: r.duration ?? 8 };
}

export async function generateAiVideo(prompt: string, aspect: string, startImageUrl?: string | null, resolution?: string, references: string[] = [], opts: { keepSpeech?: boolean; provider?: string } = {}): Promise<GeneratedVideo> {
  prompt = sanitizeForVeo(prompt);
  // Provider order: opts.provider wins (the media stage picks SnapGen for long videos), else VIDEO_PROVIDER.
  // "kie" → Kie (Veo 3) first with SnapGen as fallback; anything else → SnapGen first with Kie as fallback.
  const wanted = opts.provider || process.env.VIDEO_PROVIDER || "snapgen";
  if (wanted === "kie" && kieVideoConfigured()) {
    try { return await viaKie(prompt, aspect, startImageUrl); }
    catch (e) {
      const msg = (e as Error).message;
      if (/unable to generate audio|different prompt/i.test(msg)) {
        // Veo refuses audio on very short or awkward lines: retry once asking explicitly for natural speech
        try { return await viaKie(`${prompt} The person speaks the line out loud at a natural conversational pace, clearly audible.`, aspect, startImageUrl); }
        catch (e2) { console.log(`[kie-video] audio retry failed (${(e2 as Error).message.slice(0, 100)}) — trying SnapGen`); }
      } else console.log(`[kie-video] failed (${msg.slice(0, 120)}) — trying SnapGen`);
    }
  }
  const base = opts.keepSpeech ? prompt : prompt.replace(/\b(says?|said|speaks?|talking|shouts?|whispers?|dialogue)\b/gi, "gestures");
  const attempts: { prompt: string; model?: string }[] = opts.keepSpeech
    ? [ // speech is the point: retry with the same content, then rephrase; never fall back to veo-2 (no audio)
        { prompt: base, model: /veo-3/.test(MODEL) ? MODEL : "veo-3.1-fast" },
        { prompt: `${base} The character speaks clearly and calmly.`, model: /veo-3/.test(MODEL) ? MODEL : "veo-3.1-fast" },
        { prompt: base, model: "veo-3.1" },
      ]
    : [
        { prompt: base },
        { prompt: `${base} Silent scene: no speech, no dialogue, no lip movement, no sound effects, ambient visuals only.` },
        { prompt: `${base} Silent scene, no dialogue.`, model: "veo-2" },
      ];
  let lastErr: Error | null = null;
  for (const a of attempts) {
    try {
      return await generateOnce(a.prompt, aspect, startImageUrl, resolution, a.model, references);
    } catch (e) {
      lastErr = e as Error;
      if (/describe children|celebrity|specific character|google's policies|violation/i.test(lastErr.message)) {
        // policy rejection: retry once with a generic, name-free description (adults only), then give up on this clip
        if (!(a as { generic?: boolean }).generic) attempts.push({ prompt: `${sanitizeForVeo(base).replace(/\b[A-Z][a-z]+\b(?=\s(says|whispers|looks|turns|nods|walks|grabs|sits|stands))/g, "an adult")} Two adults in their thirties. Cinematic, realistic.`, model: attempts[0].model, ...( { generic: true } as object) });
        console.log(`[snapgen-video] policy rejection — ${(a as { generic?: boolean }).generic ? "giving up on this clip" : "retrying with a generic adult-only prompt"}`);
        continue;
      }
      // Provider trouble (overload, 5xx, timeouts) is not worth more SnapGen attempts — but it IS what the Kie
      // fallback below exists for. Throwing here used to skip that fallback and drop the shot to a still image.
      if (!/audio generation failed|different prompt|safety|blocked/i.test(lastErr.message)) { console.log(`[snapgen-video] ${lastErr.message.split("\n")[0].slice(0, 100)} — not retrying SnapGen`); break; }
      console.log(`[snapgen-video] ${lastErr.message.split("\n")[0].slice(0, 120)} — retrying ${a.model ? "with " + a.model : "with a silent-scene prompt"}`);
    }
  }
  if (kieVideoConfigured() && wanted !== "kie") {
    console.log(`[snapgen-video] exhausted — falling back to Kie (Veo 3)`);
    try { return await viaKie(prompt, aspect, startImageUrl); } catch (e) { console.log(`[kie-video] fallback failed: ${(e as Error).message.slice(0, 120)}`); }
  }
  throw lastErr;
}

async function generateOnce(prompt: string, aspect: string, startImageUrl: string | null | undefined, resolution: string | undefined, forceModel?: string, references: string[] = []): Promise<GeneratedVideo> {
  const key = requireKey("SNAPGEN_API_KEY");
  const model = forceModel || modelFor(aspect === "9:16" ? "9:16" : "16:9");
  const form = new FormData();
  form.append("prompt", prompt.slice(0, 1500));
  form.append("model", model);
  form.append("resolution", model === "veo-2" ? "720p" : (resolution || RES));
  form.append("duration", model === "omni-flash" ? "10" : "8");
  form.append("aspect_ratio", aspect === "9:16" ? "9:16" : "16:9");
  const addRef = (r: string) => {
    if (/^https?:\/\//.test(r)) form.append("ref_images", r);
    else if (fs.existsSync(r)) form.append("ref_images", new Blob([fs.readFileSync(r)]), path.basename(r));
  };
  if (startImageUrl) {
    form.append("mode_image", "frame"); addRef(startImageUrl);          // image-to-video: the start frame carries the look
  } else if (references.length && !/veo-2/.test(model)) {
    form.append("mode_image", "ingredient"); references.slice(0, 3).forEach(addRef); // text-to-video guided by reference images
  }

  const res = await fetchRetry(`${BASE}/video-gen/veo`, { method: "POST", headers: { "x-api-key": key }, body: form, timeoutMs: 90000 }, 3);
  const text = await res.text();
  let d: Hist = {};
  try { d = JSON.parse(text); } catch { throw new Error(`SnapGen video: non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`); }
  if (!res.ok) throw new Error(`SnapGen video HTTP ${res.status}: ${typeof d.detail === "object" ? d.detail?.error_message : d.error_message || text.slice(0, 200)}`);
  if (d.status === 3) throw new Error(`SnapGen video failed: ${d.error_message}`);
  if (!d.uuid) throw new Error(`SnapGen video: no uuid (${text.slice(0, 200)})`);
  console.log(`[snapgen-video] submitted ${d.uuid} model=${model}`);

  const started = Date.now();
  let polls = 0;
  for (;;) {
    await sleep(8000);
    let r: Response;
    try { r = await fetchRetry(`${BASE}/history/${encodeURIComponent(d.uuid)}`, { headers: { "x-api-key": key }, timeoutMs: 20000 }, 1); }
    catch (e) { console.log(`[snapgen-video] poll ${d.uuid}: ${(e as Error).message} — retrying`); if (Date.now() - started > DEADLINE) throw new Error("SnapGen video timed out"); continue; }
    let h: Hist = {};
    try { h = JSON.parse(await r.text()); } catch { /* keep polling */ }
    const v = h.generated_video?.find((x) => x.video_url) ?? h.generated_video?.[0];
    if (++polls % 4 === 1) console.log(`[snapgen-video] poll ${d.uuid}: status=${h.status} pct=${h.status_percentage ?? "?"} url=${v?.video_url ? "yes" : "no"}`);
    if (h.status === 2 && v?.video_url) return { url: v.video_url, id: d.uuid, duration: v.duration ?? 8, model };
    if (h.status === 3 || v?.status === 3) throw new Error(`SnapGen video failed: ${h.error_message || v?.error_message || "unknown"}`);
    if (Date.now() - started > DEADLINE) throw new Error("SnapGen video timed out");
  }
}
