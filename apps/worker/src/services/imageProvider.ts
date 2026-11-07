/** Single entry point for AI image generation across providers (kie | abhibots | snapgen) with automatic fallback. */
import { env } from "../env";
import { submitImage, waitForImage } from "./images";
import { generateImage as abhiImage } from "./voice/abhibots";
import { generateImage as snapImage } from "./snapgen";

export type ImageProvider = "kie" | "abhibots" | "snapgen";
export interface GeneratedImage { url: string; id: string; provider: ImageProvider; model: string }

async function viaProvider(provider: ImageProvider, prompt: string, aspect: string, referenceUrls: string[], style?: string | null): Promise<GeneratedImage> {
  if (provider === "snapgen") { const r = await snapImage(prompt, aspect, referenceUrls, style); return { ...r, provider: "snapgen", model: process.env.SNAPGEN_IMAGE_MODEL || "nano-banana-2" }; }
  if (provider === "abhibots") { const r = await abhiImage(prompt, aspect, referenceUrls[0]); return { url: r.url, id: r.taskId, provider: "abhibots", model: process.env.ABHIBOTS_IMAGE_MODEL || "nano_banana_2" }; }
  const id = await submitImage(prompt, aspect, referenceUrls); const url = await waitForImage(id);
  return { url, id, provider: "kie", model: process.env.KIE_IMAGE_MODEL || "nano-banana-2" };
}

/**
 * Primary = IMAGE_PROVIDER (kie is the fastest: 20-40 s, high rate limits). On failure it falls through the
 * IMAGE_FALLBACK_PROVIDERS list (default "snapgen,abhibots") so one provider's outage or empty balance never blocks a video.
 */
export async function generateAiImage(prompt: string, aspect: string, referenceUrls: string[] = [], style?: string | null): Promise<GeneratedImage> {
  // reference images (characters, products, locations) are followed far more faithfully by SnapGen's nano-banana-2 → prefer it when references are present
  const primary = (referenceUrls.length && process.env.SNAPGEN_API_KEY ? (process.env.IMAGE_PROVIDER_WITH_REFS || "snapgen") : (env.IMAGE_PROVIDER || "kie")) as ImageProvider;
  const chain = [primary, ...((process.env.IMAGE_FALLBACK_PROVIDERS || "snapgen,abhibots").split(",").map((s) => s.trim() as ImageProvider).filter((p) => p && p !== primary))];
  const configured = (p: ImageProvider) => (p === "kie" ? !!process.env.KIE_API_KEY : p === "snapgen" ? !!process.env.SNAPGEN_API_KEY : !!process.env.ABHIBOTS_API_KEY);
  let lastErr: Error | null = null;
  for (const p of chain) {
    if (!configured(p)) continue;
    try { return await viaProvider(p, prompt, aspect, referenceUrls, style); }
    catch (e) { lastErr = e as Error; console.log(`[images] ${p} failed (${lastErr.message.slice(0, 100)}) — ${chain.indexOf(p) < chain.length - 1 ? "trying next provider" : "no providers left"}`); }
  }
  throw lastErr ?? new Error("No image provider configured");
}
