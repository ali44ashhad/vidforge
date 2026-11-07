/**
 * Pexels search + ranking. Results are cached in the database because the
 * free API key allows ~200 requests/hour.
 */
import { prisma, type Prisma } from "@vidforge/db";
import { requireKey } from "../env";
import { fetchJson, HttpError } from "../lib/http";

export type Orientation = "landscape" | "portrait" | "square";

export interface Candidate {
  provider: "pexels" | "kie" | "abhibots" | "snapgen";
  providerAssetId: string;
  type: "VIDEO" | "IMAGE";
  url: string;         // download URL (best fitting file)
  previewUrl: string;
  creator: string;
  creatorUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
  duration?: number;
  slugWords: string[]; // words from the pexels page URL, used for relevance
}

interface PexelsVideo {
  id: number; width: number; height: number; duration: number; url: string;
  image: string; user: { name: string; url: string };
  video_files: { link: string; width: number | null; height: number | null; quality: string | null; file_type: string }[];
}
interface PexelsPhoto {
  id: number; width: number; height: number; url: string; photographer: string; photographer_url: string;
  src: { original: string; large2x: string; large: string; medium: string };
}

const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = await prisma.searchCache.findUnique({ where: { key } });
  if (hit && Date.now() - hit.createdAt.getTime() < CACHE_TTL_MS) return hit.payload as T;
  const payload = await loader();
  await prisma.searchCache.upsert({
    where: { key },
    create: { key, payload: payload as unknown as Prisma.InputJsonValue },
    update: { payload: payload as unknown as Prisma.InputJsonValue, createdAt: new Date() },
  });
  return payload;
}

function headers() {
  return { Authorization: requireKey("PEXELS_API_KEY") };
}

function slugWords(pageUrl: string): string[] {
  const m = pageUrl.match(/\/(?:video|photo)\/([^/]+?)-\d+\/?$/);
  return m ? m[1].split("-").filter((w) => w.length > 2) : [];
}

function pickVideoFile(v: PexelsVideo, targetWidth: number, targetHeight: number) {
  const files = v.video_files.filter((f) => f.file_type === "video/mp4" && f.width && f.height);
  if (!files.length) return null;
  const targetLong = Math.max(targetWidth, targetHeight);
  // prefer the smallest file whose longest side >= target; else the largest available
  const sorted = [...files].sort((a, b) => Math.max(a.width!, a.height!) - Math.max(b.width!, b.height!));
  return sorted.find((f) => Math.max(f.width!, f.height!) >= targetLong) ?? sorted[sorted.length - 1];
}

export async function searchVideos(query: string, orientation: Orientation, targetW: number, targetH: number, perPage = 15): Promise<Candidate[]> {
  const key = `pexels:v:${orientation}:${perPage}:${query.toLowerCase()}`;
  const data = await cached(key, () =>
    fetchJson<{ videos: PexelsVideo[] }>(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}&size=medium`,
      { headers: headers() }
    )
  );
  return (data.videos ?? []).flatMap((v) => {
    const file = pickVideoFile(v, targetW, targetH);
    if (!file) return [];
    return [{
      provider: "pexels" as const, providerAssetId: String(v.id), type: "VIDEO" as const,
      url: file.link, previewUrl: v.image, creator: v.user?.name ?? "", creatorUrl: v.user?.url ?? "",
      sourceUrl: v.url, width: file.width!, height: file.height!, duration: v.duration, slugWords: slugWords(v.url),
    }];
  });
}

export async function searchPhotos(query: string, orientation: Orientation, perPage = 15): Promise<Candidate[]> {
  const key = `pexels:p:${orientation}:${perPage}:${query.toLowerCase()}`;
  const data = await cached(key, () =>
    fetchJson<{ photos: PexelsPhoto[] }>(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}&size=large`,
      { headers: headers() }
    )
  );
  return (data.photos ?? []).map((p) => ({
    provider: "pexels" as const, providerAssetId: String(p.id), type: "IMAGE" as const,
    url: p.src.large2x || p.src.large || p.src.original, previewUrl: p.src.medium,
    creator: p.photographer, creatorUrl: p.photographer_url, sourceUrl: p.url,
    width: p.width, height: p.height, slugWords: slugWords(p.url),
  }));
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface RankInput {
  candidate: Candidate;
  queryWords: string[];         // all words from the shot's queries + description
  shotDuration: number;
  orientation: Orientation;
  usedIds: Set<string>;         // provider asset ids already used in this project/batch
  queryRank: number;            // 0 = first query (most relevant), 1 = second...
}

export function scoreCandidate(i: RankInput): number {
  const c = i.candidate;
  let s = 0;
  // keyword relevance: overlap between page slug and shot vocabulary
  const overlap = c.slugWords.filter((w) => i.queryWords.includes(w)).length;
  s += Math.min(overlap, 4) * 6;
  // earlier queries are more relevant
  s -= i.queryRank * 4;
  // orientation
  const isLandscape = c.width >= c.height;
  if (i.orientation === "landscape" && isLandscape) s += 10;
  if (i.orientation === "portrait" && !isLandscape) s += 10;
  if (i.orientation === "landscape" && !isLandscape) s -= 15;
  if (i.orientation === "portrait" && isLandscape) s -= 15;
  // resolution
  const longSide = Math.max(c.width, c.height);
  if (longSide >= 1920) s += 8; else if (longSide >= 1280) s += 4; else s -= 6;
  // duration fit (videos)
  if (c.type === "VIDEO" && c.duration !== undefined) {
    if (c.duration >= i.shotDuration) s += 10;
    else if (c.duration >= i.shotDuration * 0.7) s += 2;
    else s -= 12;
    if (c.duration > 60) s -= 3; // very long clips are often slow/static
  }
  // videos preferred over images
  s += c.type === "VIDEO" ? 6 : 0;
  // avoid repeats
  if (i.usedIds.has(c.providerAssetId)) s -= 40;
  return s;
}

export async function pingPexels(): Promise<number> {
  try {
    const d = await fetchJson<{ total_results: number }>("https://api.pexels.com/videos/search?query=city&per_page=1", { headers: headers() }, 0);
    return d.total_results;
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) throw new Error("PEXELS_API_KEY rejected (401)");
    throw e;
  }
}
