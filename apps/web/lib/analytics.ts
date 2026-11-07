import { prisma } from "@vidforge/db";
import { youtubeAccessToken } from "@/lib/youtube";

export type Point = { date: string; views: number; minutes: number; subs: number };
export type TopVideo = { id: string; title: string; thumbnail: string | null; views: number; minutes: number; avgDuration: number; likes: number; published?: string };
export type Overview = {
  connected: boolean; demo: boolean; channel?: { title: string; thumbnail?: string; subscribers: number; totalViews: number; videos: number };
  range: { start: string; end: string; days: number };
  totals: { views: number; minutes: number; subsNet: number; avgViewDuration: number; likes: number }; prev: { views: number; minutes: number; subsNet: number };
  series: Point[]; top: TopVideo[]; watchHours365: number; error?: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d; };

/** Fixture used when no channel is connected (clearly labelled demo=true in the UI). */
export function demoOverview(days: number): Overview {
  const series: Point[] = Array.from({ length: days }, (_, i) => { const d = daysAgo(days - 1 - i); const base = 4000 + i * 180 + Math.sin(i / 3) * 900; return { date: iso(d), views: Math.round(base), minutes: Math.round(base * 3.1), subs: Math.round(20 + i * 1.4) }; });
  const views = series.reduce((a, p) => a + p.views, 0), minutes = series.reduce((a, p) => a + p.minutes, 0), subs = series.reduce((a, p) => a + p.subs, 0);
  return { connected: false, demo: true, channel: { title: "Demo channel", subscribers: 18421, totalViews: 2_140_000, videos: 64 }, range: { start: series[0].date, end: series[series.length - 1].date, days },
    totals: { views, minutes, subsNet: subs, avgViewDuration: 272, likes: Math.round(views * 0.03) }, prev: { views: Math.round(views * 0.89), minutes: Math.round(minutes * 0.85), subsNet: Math.round(subs * 0.92) },
    series, top: [["Japan Travel Guide", 103000], ["How Money Works", 88000], ["Luxury Living", 76000], ["Workout Motivation", 62000], ["History of India", 56000]].map(([t, v], i) => ({ id: `demo${i}`, title: String(t), thumbnail: null, views: Number(v), minutes: Number(v) * 3, avgDuration: 250 + i * 12, likes: Math.round(Number(v) * 0.03) })), watchHours365: 4120 };
}

/** Real data from the YouTube Analytics API for the connected channel. Requires the yt-analytics.readonly scope (reconnect if missing). */
export async function youtubeOverview(userId: string, days: number): Promise<Overview> {
  const conn = await prisma.user.findUnique({ where: { id: userId }, select: { youtube: true } });
  const yt = conn?.youtube as { channelId: string; channelTitle: string; thumbnail?: string } | null;
  if (!yt) return demoOverview(days);
  try {
    const { token } = await youtubeAccessToken(userId);
    const H = { Authorization: `Bearer ${token}` };
    const start = iso(daysAgo(days - 1)), end = iso(daysAgo(0)), pStart = iso(daysAgo(days * 2 - 1)), pEnd = iso(daysAgo(days));
    const q = async (params: Record<string, string>) => { const u = new URL("https://youtubeanalytics.googleapis.com/v2/reports"); Object.entries({ ids: "channel==MINE", ...params }).forEach(([k, v]) => u.searchParams.set(k, v)); const r = await fetch(u, { headers: H }); if (!r.ok) throw new Error(`Analytics ${r.status}: ${(await r.text()).slice(0, 160)}`); return (await r.json()) as { rows?: (string | number)[][] }; };
    const [daily, prev, top, year, ch] = await Promise.all([
      q({ startDate: start, endDate: end, metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost,averageViewDuration,likes", dimensions: "day", sort: "day" }),
      q({ startDate: pStart, endDate: pEnd, metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost" }),
      q({ startDate: start, endDate: end, metrics: "views,estimatedMinutesWatched,averageViewDuration,likes", dimensions: "video", sort: "-views", maxResults: "8" }),
      q({ startDate: iso(daysAgo(364)), endDate: end, metrics: "estimatedMinutesWatched" }),
      fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true`, { headers: H }).then((r) => r.json()) as Promise<{ items?: { snippet: { title: string; thumbnails?: { default?: { url: string } } }; statistics: { subscriberCount: string; viewCount: string; videoCount: string } }[] }>,
    ]);
    const series: Point[] = (daily.rows ?? []).map((r) => ({ date: String(r[0]), views: Number(r[1]), minutes: Number(r[2]), subs: Number(r[3]) - Number(r[4]) }));
    const sum = (k: keyof Point) => series.reduce((a, p) => a + Number(p[k]), 0);
    const avd = series.length ? Math.round((daily.rows ?? []).reduce((a, r) => a + Number(r[5]) * Number(r[1]), 0) / Math.max(1, sum("views"))) : 0;
    const likes = (daily.rows ?? []).reduce((a, r) => a + Number(r[6]), 0);
    const ids = (top.rows ?? []).map((r) => String(r[0]));
    const meta = ids.length ? ((await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(",")}`, { headers: H })).json()) as { items?: { id: string; snippet: { title: string; publishedAt: string; thumbnails?: { medium?: { url: string } } } }[] }).items ?? [] : [];
    const topVideos: TopVideo[] = (top.rows ?? []).map((r) => { const m = meta.find((x) => x.id === String(r[0])); return { id: String(r[0]), title: m?.snippet.title ?? String(r[0]), thumbnail: m?.snippet.thumbnails?.medium?.url ?? null, published: m?.snippet.publishedAt, views: Number(r[1]), minutes: Number(r[2]), avgDuration: Number(r[3]), likes: Number(r[4]) }; });
    const c = ch.items?.[0]; const pr = prev.rows?.[0] ?? [0, 0, 0, 0];
    return { connected: true, demo: false, channel: { title: c?.snippet.title ?? yt.channelTitle, thumbnail: c?.snippet.thumbnails?.default?.url ?? yt.thumbnail, subscribers: Number(c?.statistics.subscriberCount ?? 0), totalViews: Number(c?.statistics.viewCount ?? 0), videos: Number(c?.statistics.videoCount ?? 0) },
      range: { start, end, days }, totals: { views: sum("views"), minutes: sum("minutes"), subsNet: sum("subs"), avgViewDuration: avd, likes }, prev: { views: Number(pr[0]), minutes: Number(pr[1]), subsNet: Number(pr[2]) - Number(pr[3]) }, series, top: topVideos, watchHours365: Math.round(Number(year.rows?.[0]?.[0] ?? 0) / 60) };
  } catch (e) {
    const d = demoOverview(days); return { ...d, connected: true, demo: true, error: (e as Error).message };
  }
}
