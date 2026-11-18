/**
 * Pexels search + ranking. Results are cached in the database because the
 * free API key allows ~200 requests/hour.
 */
import { prisma, type Prisma } from "@vidforge/db";
import { requireKey } from "../env";
import { fetchJson, HttpError } from "../lib/http";
import { y2fetch, y2ubeRemote } from "./y2ube";

export type Orientation = "landscape" | "portrait" | "square";

export interface Candidate {
  provider: "pexels" | "kie" | "snapgen";
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

interface PixabayVideoFile { url: string; width: number; height: number; size: number }
interface PixabayVideoHit {
  id: number; pageURL: string; duration: number; picture_id: string;
  videos: { large?: PixabayVideoFile; medium?: PixabayVideoFile; small?: PixabayVideoFile; tiny?: PixabayVideoFile };
  user: string; tags: string;
}
interface PixabayPhotoHit {
  id: number; pageURL: string; largeImageURL: string; webformatURL: string; previewURL: string;
  imageWidth: number; imageHeight: number; user: string; tags: string;
}

function coverrKey(): string {
  return process.env.COVERR_API_KEY?.trim() || "";
}

/** Coverr is videos only. Use it when it is the only stock key, or when STOCK_PROVIDER=coverr. */
function useCoverr(): boolean {
  const key = coverrKey();
  if (!key) return false;
  if (process.env.STOCK_PROVIDER === "coverr") return true;
  return !process.env.PEXELS_API_KEY?.trim() && !process.env.PIXABAY_API_KEY?.trim();
}

interface CoverrHit {
  id: string;
  title?: string;
  poster?: string;
  thumbnail?: string;
  tags?: string[];
  is_vertical?: boolean;
  duration?: number;
  max_width?: number;
  max_height?: number;
  urls?: { mp4?: string; mp4_download?: string; mp4_preview?: string };
}

/** Fresh request every time: Coverr's mp4 links are signed and go stale if cached for days. */
async function searchCoverr(query: string, orientation: Orientation, perPage: number): Promise<Candidate[]> {
  const data = await fetchJson<{ hits?: CoverrHit[] }>(
    `https://api.coverr.co/videos?query=${encodeURIComponent(query)}&page_size=${perPage}&urls=true`,
    { headers: { "x-api-key": coverrKey() } },
  );
  return (data.hits ?? []).flatMap((v) => {
    const url = v.urls?.mp4_download || v.urls?.mp4;
    if (!url || !v.id) return [];
    const vertical = !!v.is_vertical;
    if (orientation === "landscape" && vertical) return [];
    if (orientation === "portrait" && !vertical) return [];
    const tags = [...(v.tags ?? []), ...(v.title ?? "").split(/\s+/)]
      .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter((w) => w.length > 2);
    return [{
      provider: "pexels" as const,
      providerAssetId: `coverr_${v.id}`,
      type: "VIDEO" as const,
      url,
      previewUrl: v.thumbnail || v.poster || "",
      creator: "Coverr",
      creatorUrl: "https://coverr.co",
      sourceUrl: `https://coverr.co/videos/${v.id}`,
      width: v.max_width || (vertical ? 1080 : 1920),
      height: v.max_height || (vertical ? 1920 : 1080),
      duration: v.duration != null ? Number(v.duration) : undefined,
      slugWords: tags,
    }];
  });
}

export async function searchVideos(query: string, orientation: Orientation, targetW: number, targetH: number, perPage = 15): Promise<Candidate[]> {
  if (y2ubeRemote()) {
    const q = new URLSearchParams({ type: "video", q: query, orientation, w: String(targetW), h: String(targetH), perPage: String(perPage) });
    const r = await y2fetch<{ results: Candidate[] }>(`/api/v1/providers/stock?${q}`, { timeoutMs: 60_000 });
    return r.results ?? [];
  }
  if (useCoverr()) return searchCoverr(query, orientation, perPage);
  const pixabayKey = process.env.PIXABAY_API_KEY?.trim();
  if (pixabayKey && (!process.env.PEXELS_API_KEY || process.env.STOCK_PROVIDER === "pixabay")) {
    const pixOrientation = orientation === "portrait" ? "vertical" : "horizontal";
    const key = `pixabay:v:${orientation}:${perPage}:${query.toLowerCase()}`;
    const data = await cached(key, () =>
      fetchJson<{ hits: PixabayVideoHit[] }>(
        `https://pixabay.com/api/videos/?key=${encodeURIComponent(pixabayKey)}&q=${encodeURIComponent(query)}&orientation=${pixOrientation}&per_page=${perPage}`
      )
    );
    return (data.hits ?? []).flatMap((v) => {
      const files = [v.videos.large, v.videos.medium, v.videos.small].filter((f): f is PixabayVideoFile => !!(f && f.url && f.width && f.height));
      if (!files.length) return [];
      const targetLong = Math.max(targetW, targetH);
      const sorted = [...files].sort((a, b) => Math.max(a.width, a.height) - Math.max(b.width, b.height));
      const file = sorted.find((f) => Math.max(f.width, f.height) >= targetLong) ?? sorted[sorted.length - 1];
      const tags = v.tags ? v.tags.split(/,\s*/).map((w) => w.toLowerCase()).filter((w) => w.length > 2) : [];
      return [{
        provider: "pexels" as const,
        providerAssetId: `pixabay_${v.id}`,
        type: "VIDEO" as const,
        url: file.url,
        previewUrl: `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg`,
        creator: v.user ?? "Pixabay Creator",
        creatorUrl: v.pageURL,
        sourceUrl: v.pageURL,
        width: file.width,
        height: file.height,
        duration: v.duration,
        slugWords: tags,
      }];
    });
  }

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
  if (y2ubeRemote()) {
    const q = new URLSearchParams({ type: "photo", q: query, orientation, perPage: String(perPage) });
    const r = await y2fetch<{ results: Candidate[] }>(`/api/v1/providers/stock?${q}`, { timeoutMs: 60_000 });
    return r.results ?? [];
  }
  if (useCoverr()) return [];
  const pixabayKey = process.env.PIXABAY_API_KEY?.trim();
  if (pixabayKey && (!process.env.PEXELS_API_KEY || process.env.STOCK_PROVIDER === "pixabay")) {
    const pixOrientation = orientation === "portrait" ? "vertical" : "horizontal";
    const key = `pixabay:p:${orientation}:${perPage}:${query.toLowerCase()}`;
    const data = await cached(key, () =>
      fetchJson<{ hits: PixabayPhotoHit[] }>(
        `https://pixabay.com/api/?key=${encodeURIComponent(pixabayKey)}&q=${encodeURIComponent(query)}&image_type=photo&orientation=${pixOrientation}&per_page=${perPage}`
      )
    );
    return (data.hits ?? []).map((p) => {
      const tags = p.tags ? p.tags.split(/,\s*/).map((w) => w.toLowerCase()).filter((w) => w.length > 2) : [];
      return {
        provider: "pexels" as const,
        providerAssetId: `pixabay_${p.id}`,
        type: "IMAGE" as const,
        url: p.largeImageURL || p.webformatURL,
        previewUrl: p.previewURL,
        creator: p.user ?? "Pixabay Creator",
        creatorUrl: p.pageURL,
        sourceUrl: p.pageURL,
        width: p.imageWidth,
        height: p.imageHeight,
        slugWords: tags,
      };
    });
  }

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

export async function pingPexels(): Promise<number | string> {
  if (useCoverr()) {
    const d = await fetchJson<{ total?: number }>(`https://api.coverr.co/videos?query=city&page_size=1`, { headers: { "x-api-key": coverrKey() } }, 0);
    return `${d.total ?? 0} (Coverr)`;
  }
  const pixabayKey = process.env.PIXABAY_API_KEY?.trim();
  if (pixabayKey && (!process.env.PEXELS_API_KEY || process.env.STOCK_PROVIDER === "pixabay")) {
    const d = await fetchJson<{ totalHits: number }>(`https://pixabay.com/api/videos/?key=${encodeURIComponent(pixabayKey)}&q=city&per_page=3`, {}, 0);
    return `${d.totalHits ?? 0} (Pixabay)`;
  }
  try {
    const d = await fetchJson<{ total_results: number }>("https://api.pexels.com/videos/search?query=city&per_page=1", { headers: headers() }, 0);
    return d.total_results;
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) throw new Error("PEXELS_API_KEY rejected (401)");
    throw e;
  }
}
