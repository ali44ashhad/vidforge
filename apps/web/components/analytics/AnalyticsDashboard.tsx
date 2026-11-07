"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Youtube, Sparkles, ArrowRight, AlertCircle } from "lucide-react";
import type { Overview } from "@/lib/analytics";
import LineChart from "./LineChart";
import { MetricCard, Tabs, Skeleton } from "@/components/ui/Card";

const fmtN = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : n.toLocaleString());
const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const delta = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : undefined);

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(28); const [data, setData] = useState<Overview | null>(null); const [metric, setMetric] = useState<"views" | "minutes" | "subs">("views"); const [tab, setTab] = useState("overview"); const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); fetch(`/api/analytics?days=${days}`).then((r) => r.json()).then((d) => { setData(d); setLoading(false); }); };
  useEffect(load, [days]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = data;
  const insights = d ? buildInsights(d) : [];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">YouTube Analytics</h1><p className="mt-1 text-[15px] text-ink-2">Track channel performance and discover what to make next.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field max-w-[160px]" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={28}>Last 28 days</option><option value={90}>Last 90 days</option><option value={365}>This year</option></select>
          {d?.channel && <span className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[13px]"><Youtube size={14} className="text-danger" />{d.channel.title}{d.connected && !d.demo && <span className="pill pill-ready">Connected</span>}</span>}
          <button className="btn-ghost px-3" onClick={load} title="Refresh"><RefreshCw size={16} /></button>
        </div>
      </div>
      {d?.demo && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4 text-[14px]"><span className="flex items-center gap-2"><AlertCircle size={16} className="text-warning" />{d.error ? <>We couldn&apos;t refresh your YouTube analytics ({d.error.slice(0, 80)}). Showing sample data — reconnect to grant analytics access.</> : <>Sample data. Connect your YouTube channel to see real analytics.</>}</span><a href="/api/youtube/connect" className="btn-gradient px-4 py-2 text-[13px]">{d.connected ? "Reconnect YouTube" : "Connect YouTube"}</a></div>}
      <Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "content", label: "Content" }, { id: "audience", label: "Audience" }, { id: "revenue", label: "Revenue" }]} value={tab} onChange={setTab} />
      {loading || !d ? <div className="mt-6 grid gap-4 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : tab === "overview" ? (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <MetricCard label="Views" value={fmtN(d.totals.views)} delta={delta(d.totals.views, d.prev.views)} />
            <MetricCard label="Watch time" value={`${fmtN(Math.round(d.totals.minutes / 60))} hrs`} delta={delta(d.totals.minutes, d.prev.minutes)} />
            <MetricCard label="Subscribers" value={d.channel ? d.channel.subscribers.toLocaleString() : "—"} delta={d.totals.subsNet >= 0 ? `+${d.totals.subsNet}` : String(d.totals.subsNet)} hint="net in period" />
            <MetricCard label="Avg. view duration" value={fmtT(d.totals.avgViewDuration)} />
            <MetricCard label="Likes" value={fmtN(d.totals.likes)} hint="CTR needs YouTube Studio" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-line bg-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[15px] font-semibold">{metric === "views" ? "Views" : metric === "minutes" ? "Watch time (min)" : "Net subscribers"} over time</h2><div className="flex gap-1 rounded-lg border border-line p-0.5 text-[13px]">{(["views", "minutes", "subs"] as const).map((m) => <button key={m} onClick={() => setMetric(m)} className={`rounded-md px-3 py-1 ${metric === m ? "bg-accent/20 text-ink" : "text-ink-3"}`}>{m === "views" ? "Views" : m === "minutes" ? "Watch time" : "Subscribers"}</button>)}</div></div>
              <div className="mt-2"><LineChart label={metric} points={d.series.map((p) => ({ x: p.date, y: p[metric] }))} /></div>
              <div className="mt-1 text-[12px] text-ink-3">{d.range.start} → {d.range.end}</div>
            </div>
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h2 className="text-[15px] font-semibold">Top videos</h2>
              <ul className="mt-3 space-y-3">{d.top.map((v) => <li key={v.id} className="flex items-center gap-3"><div className="h-11 w-[72px] shrink-0 overflow-hidden rounded-md bg-panel-2">{v.thumbnail && <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{v.title}</div><div className="text-[12px] text-ink-3">{fmtT(v.avgDuration)} avg · {fmtN(v.likes)} likes</div></div><div className="text-[14px] font-semibold tabular-nums">{fmtN(v.views)}</div></li>)}{d.top.length === 0 && <li className="text-[14px] text-ink-3">No video data in this period.</li>}</ul>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-[15px] font-semibold"><Sparkles size={16} className="text-accent" /> Insights from AI</h2><Link href="/ideas" className="text-[13px] text-accent">View all ideas →</Link></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{insights.map((i) => <div key={i.title} className="rounded-xl border border-line bg-panel-2 p-4"><div className="text-[13px] font-semibold">{i.title}</div><p className="mt-1 text-[13px] text-ink-2">{i.body}</p>{i.cta && <Link href={i.href!} className="mt-3 inline-flex items-center gap-1 text-[13px] text-accent">{i.cta} <ArrowRight size={12} /></Link>}</div>)}</div>
          </div>
        </div>
      ) : tab === "content" ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-panel">
          <table className="w-full text-[14px]"><thead className="text-left text-[12px] uppercase text-ink-3"><tr><th className="px-5 py-3">Video</th><th className="px-5 py-3">Published</th><th className="px-5 py-3 text-right">Views</th><th className="px-5 py-3 text-right">Avg view duration</th><th className="px-5 py-3 text-right">Watch time</th><th className="px-5 py-3 text-right">Likes</th></tr></thead>
            <tbody>{d.top.map((v) => <tr key={v.id} className="border-t border-line"><td className="px-5 py-3 font-medium">{v.title}</td><td className="px-5 py-3 text-ink-3">{v.published ? new Date(v.published).toLocaleDateString() : "—"}</td><td className="px-5 py-3 text-right tabular-nums">{v.views.toLocaleString()}</td><td className="px-5 py-3 text-right tabular-nums">{fmtT(v.avgDuration)}</td><td className="px-5 py-3 text-right tabular-nums">{Math.round(v.minutes / 60).toLocaleString()} h</td><td className="px-5 py-3 text-right tabular-nums">{v.likes.toLocaleString()}</td></tr>)}</tbody></table>
          <p className="px-5 py-3 text-[12px] text-ink-3">Impressions and CTR are not exposed by the YouTube Analytics API; see YouTube Studio for those.</p>
        </div>
      ) : tab === "audience" ? (
        <div className="mt-6 rounded-2xl border border-line bg-panel p-8 text-center text-[14px] text-ink-2">Audience breakdowns (geography, age, device, active hours) are the next analytics integration.{/* TODO: youtubeAnalytics reports with dimensions=country / ageGroup,gender / deviceType */}</div>
      ) : (
        <div className="mt-6 rounded-2xl border border-line bg-panel p-8 text-center text-[14px] text-ink-2">Revenue data will appear when eligible YouTube analytics permissions are connected and the channel is monetized.</div>
      )}
    </div>
  );
}

/** Rule-based insights from the numbers we actually have (no invented CTR/impressions). */
function buildInsights(d: Overview) {
  const out: { title: string; body: string; cta?: string; href?: string }[] = [];
  const g = d.prev.views ? (d.totals.views - d.prev.views) / d.prev.views : 0;
  out.push(g >= 0 ? { title: "Views are up", body: `Views grew ${Math.round(g * 100)}% versus the previous period. Keep the publishing rhythm that produced it.` } : { title: "Views dipped", body: `Views are ${Math.round(-g * 100)}% below the previous period. Try a stronger hook in the first 10 seconds and a clearer thumbnail.`, cta: "Make a new video", href: "/create" });
  if (d.top[0]) out.push({ title: "Audience loves", body: `"${d.top[0].title}" leads with ${fmtN(d.top[0].views)} views and ${fmtT(d.top[0].avgDuration)} average view duration. Make a follow-up on the same theme.`, cta: "Create a follow-up", href: `/create?prompt=${encodeURIComponent(`A follow-up to my video "${d.top[0].title}"`)}` });
  out.push({ title: "Retention", body: d.totals.avgViewDuration >= 240 ? "Average view duration above 4 minutes — long-form is working; 8–10 minute explainers can raise watch time further." : "Average view duration is under 4 minutes; tighten intros and add a re-hook every 60–90 seconds." });
  out.push({ title: "Next video idea", body: "Get personalized ideas based on your channel's best-performing topics.", cta: "Generate ideas", href: "/ideas" });
  return out;
}
