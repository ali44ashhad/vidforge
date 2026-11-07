"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Overview } from "@/lib/analytics";
import { MetricCard, Skeleton } from "@/components/ui/Card";

const fmtN = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : n.toLocaleString());
const delta = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : undefined);

/** Channel metrics on the overview — real when YouTube is connected, otherwise sample with a note. */
export default function DashboardStats() {
  const [d, setD] = useState<Overview | null>(null);
  useEffect(() => { fetch("/api/analytics?days=28").then((r) => r.json()).then(setD); }, []);
  if (!d) return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Subscribers" value={d.channel ? d.channel.subscribers.toLocaleString() : "—"} delta={d.totals.subsNet >= 0 ? `+${d.totals.subsNet}` : String(d.totals.subsNet)} hint="last 28 days" />
        <MetricCard label="Views" value={fmtN(d.totals.views)} delta={delta(d.totals.views, d.prev.views)} hint="last 28 days" />
        <MetricCard label="Watch time" value={`${fmtN(Math.round(d.totals.minutes / 60))} hrs`} delta={delta(d.totals.minutes, d.prev.minutes)} hint="last 28 days" />
        <MetricCard label="Videos on channel" value={d.channel ? d.channel.videos.toLocaleString() : "—"} />
      </div>
      {d.demo && <p className="mt-2 text-[12px] text-ink-3">Sample numbers — <a href="/api/youtube/connect" className="text-accent">connect YouTube</a> for your real channel. <Link href="/analytics" className="text-accent">Full analytics →</Link></p>}
    </div>
  );
}
