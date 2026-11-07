"use client";

import { useEffect, useState } from "react";

type Stats = { videos24: number; videos7: number; successRate: number | null; failed7: number; users: number; newUsers7: number; revenue7Inr: number; payments7: number; creditsCharged7: number; generating: number; avgReadySec: number; topErrors: { error: string; count: number }[] };

export default function AdminOverview() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { fetch("/api/admin/stats").then((r) => r.json()).then(setS); }, []);
  if (!s) return <p className="text-ink-3">Loading…</p>;
  const kpi = (label: string, value: string | number, sub?: string) => (
    <div className="panel p-4"><div className="text-xs uppercase tracking-wide text-ink-3">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div>{sub && <div className="text-xs text-ink-3">{sub}</div>}</div>
  );
  const m = Math.round(s.avgReadySec / 60);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpi("Videos (24h / 7d)", `${s.videos24} / ${s.videos7}`, `${s.generating} generating now`)}
        {kpi("Render success rate", s.successRate == null ? "—" : `${s.successRate}%`, `${s.failed7} failed this week`)}
        {kpi("Avg. time to ready", s.avgReadySec ? `${m} min` : "—", "completed videos, 7 days")}
        {kpi("Credits charged (7d)", s.creditsCharged7.toLocaleString(), "settled usage")}
        {kpi("Users", s.users, `+${s.newUsers7} this week`)}
        {kpi("Revenue (7d)", `₹${s.revenue7Inr.toLocaleString("en-IN")}`, `${s.payments7} payments`)}
      </div>
      <div className="panel p-4">
        <div className="text-sm font-medium">Top failure reasons (7 days)</div>
        {s.topErrors.length === 0 ? <p className="mt-2 text-sm text-ink-3">No failures. Nice.</p> : (
          <ul className="mt-2 space-y-1 text-sm">{s.topErrors.map((e) => <li key={e.error} className="flex justify-between gap-3"><span className="truncate text-ink-2">{e.error}</span><span className="text-ink-3">{e.count}</span></li>)}</ul>
        )}
      </div>
    </div>
  );
}
