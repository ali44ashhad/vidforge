"use client";

import { useState } from "react";

const COLORS: Record<string, string> = { "AI video": "#7A5CFF", "AI images": "#4B7BFF", "Stock & render": "#31D583" };

export default function UsageChart({ data }: { data: { thisMonth: Record<string, number>; lastMonth: Record<string, number> } }) {
  const [period, setPeriod] = useState<"thisMonth" | "lastMonth">("thisMonth");
  const d = data[period]; const total = Object.values(d).reduce((a, b) => a + b, 0);
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Credit usage</h2><div className="flex gap-1 rounded-lg border border-line p-0.5 text-[13px]">{(["thisMonth", "lastMonth"] as const).map((p) => <button key={p} onClick={() => setPeriod(p)} className={`rounded-md px-3 py-1 ${period === p ? "bg-accent/20 text-ink" : "text-ink-3"}`}>{p === "thisMonth" ? "This month" : "Last month"}</button>)}</div></div>
      {total === 0 ? <p className="mt-3 text-[14px] text-ink-3">No usage in this period.</p> : (
        <div className="mt-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-panel-2">{Object.entries(d).map(([k, v]) => <div key={k} style={{ width: `${(v / total) * 100}%`, background: COLORS[k] ?? "#888" }} />)}</div>
          <div className="mt-3 flex flex-wrap gap-4 text-[13px]">{Object.entries(d).map(([k, v]) => <span key={k} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[k] ?? "#888" }} />{k} <span className="text-ink-3">{v} credits</span></span>)}<span className="ml-auto text-ink-2">Total {total}</span></div>
        </div>
      )}
    </section>
  );
}
