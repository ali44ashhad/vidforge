/**
 * Credit pricing. One config to change prices. Derived from measured provider costs (Sept 2026):
 * SnapGen nano-banana-2 ≈ 3 SnapGen credits/image, Veo 8 s clip ≈ 35–40 SnapGen credits, Kie music ≈ 10 Kie credits/track,
 * voice ≈ per 1k chars. 1 Y2ube credit ≈ ₹1 of value at the Starter plan.
 */
export const CREDIT_RATES = {
  baseSecond: 0.15,        // script + voice + render, per second of final video
  stockClip: 0.2,          // per stock shot (Pexels lookups, transcode)
  aiImage: 2,              // per generated image (nano-banana)
  aiVideoClip: 25,         // per 8 s Veo clip (720p)
  aiVideo1080p: 10,        // extra per clip at 1080p
  musicTrack: 6,           // per generated music track
  characterSheet: 4,       // per character design sheet
  thumbnailBackground: 2,  // per AI thumbnail background (2 per kit)
  publishKit: 1,
  minimum: 5,
  reserveBuffer: 1.15,     // reserve 15% above the estimate; the unused part is released at settlement
} as const;

export interface EstimateInput {
  targetDuration: number; visualSource: string; aiVideoResolution?: string; musicEnabled: boolean; voiceEnabled: boolean;
  characterCount?: number; storyMode?: boolean; shotSeconds?: number;
}
export interface Estimate { credits: number; reserve: number; breakdown: { label: string; credits: number }[]; clips: number; images: number }

export function estimateCredits(i: EstimateInput & { presenter?: boolean }, R: typeof CREDIT_RATES = CREDIT_RATES): Estimate {
  const secs = Math.max(10, i.targetDuration);
  // short-form is cut every ~2.2 s (see shotSecondsFor), long-form every ~5 s
  const shotLen = i.shotSeconds ?? (/ai_video/.test(i.visualSource) ? 8 : secs <= 90 ? 2.2 : 5);
  const shots = Math.ceil(secs / shotLen);
  const b: { label: string; credits: number }[] = [];
  b.push({ label: `Script, voice & render (${secs}s)`, credits: secs * R.baseSecond });
  let clips = 0, images = 0;
  switch (i.visualSource) {
    case "stock_videos": b.push({ label: `${shots} stock shots`, credits: shots * R.stockClip }); break;
    case "mixed": images = Math.round(shots * 0.3); b.push({ label: `${shots - images} stock shots`, credits: (shots - images) * R.stockClip }); b.push({ label: `${images} AI images`, credits: images * R.aiImage }); break;
    case "ai_images": images = shots; b.push({ label: `${images} AI images`, credits: images * R.aiImage }); break;
    case "ai_video_hero": { const scenes = Math.max(1, Math.round(secs / 20)); clips = scenes; images = shots; b.push({ label: `${images} AI images`, credits: images * R.aiImage }); b.push({ label: `${clips} AI video clips`, credits: clips * R.aiVideoClip }); break; }
    case "ai_videos": clips = shots; images = shots; b.push({ label: `${images} start frames`, credits: images * R.aiImage }); b.push({ label: `${clips} AI video clips`, credits: clips * R.aiVideoClip }); break;
  }
  if (clips && i.aiVideoResolution === "1080p") b.push({ label: "1080p clips", credits: clips * R.aiVideo1080p });
  if (i.storyMode && i.characterCount) { b.push({ label: `${i.characterCount} character sheets`, credits: i.characterCount * R.characterSheet }); }
  // one presenter clip per spoken part of the script (~8 s of narration each); PRESENTER_MAX_CLIPS on the worker can cap it
  if (i.presenter) { const pc = Math.max(1, Math.ceil(secs / 8)); clips += pc; b.push({ label: `${pc} AI presenter clips`, credits: pc * R.aiVideoClip }); }
  if (i.musicEnabled) b.push({ label: "Music", credits: R.musicTrack });
  b.push({ label: "Thumbnails & publish kit", credits: 2 * R.thumbnailBackground + R.publishKit });
  const credits = Math.max(R.minimum, Math.ceil(b.reduce((a, x) => a + x.credits, 0)));
  return { credits, reserve: Math.ceil(credits * R.reserveBuffer), breakdown: b.map((x) => ({ ...x, credits: Math.round(x.credits * 10) / 10 })), clips, images };
}

/** Actual usage → credits, computed by the worker at finalize from the project's stats. */
export function settleCredits(stats: Record<string, unknown>, targetDuration: number, musicEnabled: boolean, res?: string, R: typeof CREDIT_RATES = CREDIT_RATES): number {
  const n = (k: string) => Number(stats[k] ?? 0) || 0;
  const secs = n("durationSeconds") || targetDuration;
  let c = secs * R.baseSecond + n("videosFound") * R.stockClip + n("imagesFound") * R.stockClip + n("aiImages") * R.aiImage + n("aiVideos") * R.aiVideoClip
    + (res === "1080p" ? n("aiVideos") * R.aiVideo1080p : 0) + n("characters") * R.characterSheet + (n("musicTracks") ? R.musicTrack : 0) + 2 * R.thumbnailBackground + R.publishKit;
  return Math.max(R.minimum, Math.ceil(c));
}

export interface Plan { id: string; name: string; priceInr: number; priceUsd: number; credits: number; monthly: boolean; popular?: boolean; features: string[]; promptChars: number }
export const PLANS: Plan[] = [
  { id: "free", name: "Free", priceInr: 0, priceUsd: 0, credits: 60, promptChars: 2000, monthly: false, features: ["60 credits to try", "720p output", "Stock & AI images", "Watermark-free"] },
  { id: "starter", name: "Starter", priceInr: 99900, priceUsd: 1200, credits: 1000, promptChars: 10000, monthly: true, features: ["1,000 credits / month", "1080p output", "All 27 formats", "AI images & key-shot video"] },
  { id: "creator", name: "Creator", priceInr: 199900, priceUsd: 2400, credits: 2500, promptChars: 30000, monthly: true, popular: true, features: ["2,500 credits / month", "1080p + 4K", "AI video for every shot", "Characters & native speech", "Bulk creation (up to 50 per batch)"] },
  { id: "pro", name: "Pro", priceInr: 399900, priceUsd: 4900, credits: 6000, promptChars: 60000, monthly: true, features: ["6,000 credits / month", "Everything in Creator", "Bulk creation", "API access"] },
  { id: "unlimited", name: "Unlimited", priceInr: 999900, priceUsd: 11900, credits: 20000, promptChars: 100000, monthly: true, features: ["20,000 credits / month (fair use)", "Everything in Pro", "Dedicated support"] },
];
export const FREE_SIGNUP_CREDITS = 60;

/** Display price: always USD on the site; the charge currency is decided at checkout (INR for India). */
export const formatUsd = (cents: number) => (cents ? `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 })}` : "Free");
export const formatInr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
