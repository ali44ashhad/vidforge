/** Single entry point for AI image generation. Kie is the image provider. */
import { env } from "../env";
import { y2fetch, y2ubeRemote } from "./y2ube";
import { submitImage, waitForImage } from "./images";
import { generateImage as snapImage } from "./snapgen";

export type ImageProvider = "kie" | "snapgen";
export interface GeneratedImage { url: string; id: string; provider: ImageProvider; model: string }

async function viaProvider(provider: ImageProvider, prompt: string, aspect: string, referenceUrls: string[], style?: string | null): Promise<GeneratedImage> {
  if (provider === "snapgen") { const r = await snapImage(prompt, aspect, referenceUrls, style); return { ...r, provider: "snapgen", model: process.env.SNAPGEN_IMAGE_MODEL || "nano-banana-2" }; }
  const id = await submitImage(prompt, aspect, referenceUrls); const url = await waitForImage(id);
  return { url, id, provider: "kie", model: process.env.KIE_IMAGE_MODEL || "nano-banana-2" };
}

/**
 * Primary = IMAGE_PROVIDER (kie is the fastest: 20-40 s, high rate limits). On failure it falls through the
 * IMAGE_FALLBACK_PROVIDERS list so one provider's outage never blocks a video.
 */
export async function generateAiImage(prompt: string, aspect: string, referenceUrls: string[] = [], style?: string | null): Promise<GeneratedImage> {
  if (y2ubeRemote()) return y2fetch<GeneratedImage>("/api/v1/providers/image", { method: "POST", body: { prompt, aspect, referenceUrls, style }, timeoutMs: 180_000 });
  const primary = (env.IMAGE_PROVIDER || "kie") as ImageProvider;
  const chain = [primary, ...((process.env.IMAGE_FALLBACK_PROVIDERS || "").split(",").map((s) => s.trim() as ImageProvider).filter((p) => p && p !== primary))];
  const configured = (p: ImageProvider) => (p === "kie" ? !!process.env.KIE_API_KEY : !!process.env.SNAPGEN_API_KEY);
  let lastErr: Error | null = null;
  for (const p of chain) {
    if (!configured(p)) continue;
    try { return await viaProvider(p, prompt, aspect, referenceUrls, style); }
    catch (e) { lastErr = e as Error; console.log(`[images] ${p} failed (${lastErr.message.slice(0, 100)}) — ${chain.indexOf(p) < chain.length - 1 ? "trying next provider" : "no providers left"}`); }
  }
  throw lastErr ?? new Error("No image provider configured");
}
