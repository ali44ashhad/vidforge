"use client";

import { useEffect, useState } from "react";

type S = { ok: boolean; uptimeSec: number; inFlight: number; concurrency: number; queue: { queued: number; running: number; paused: number; failed24h: number; oldestQueuedSec: number }; providers: Record<string, { ok: boolean; detail: string }>; disk: { totalGb: number; freeGb: number } | null; settings: Record<string, string | undefined>; cpu: number[]; memFreeGb: number; memTotalGb: number; error?: string };

export default function AdminSystem() {
  const [s, setS] = useState<S | null>(null);
  const load = () => fetch("/api/admin/system").then((r) => r.json()).then(setS);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  if (!s) return <p className="text-ink-3">Loading…</p>;
  if (s.error) return <div className="rounded-xl border border-danger/50 p-4 text-sm text-danger">{s.error}</div>;
  const card = (label: string, value: string | number, sub?: string) => <div className="panel p-4"><div className="text-xs uppercase tracking-wide text-ink-3">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div>{sub && <div className="text-xs text-ink-3">{sub}</div>}</div>;
  const h = Math.floor(s.uptimeSec / 3600);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card("Worker", "online", `up ${h}h · ${s.inFlight}/${s.concurrency} in flight`)}
        {card("Queue", s.queue.queued, `${s.queue.running} running · ${s.queue.paused} paused · oldest ${Math.round(s.queue.oldestQueuedSec / 60)} min`)}
        {card("Failed (24h)", s.queue.failed24h)}
        {card("VPS", `load ${s.cpu[0]}`, `${s.memFreeGb} GB free of ${s.memTotalGb} GB · disk ${s.disk ? `${s.disk.freeGb}/${s.disk.totalGb} GB free` : "—"}`)}
      </div>
      <div className="panel p-4">
        <div className="text-sm font-medium">Providers</div>
        <ul className="mt-2 space-y-1 text-sm">{Object.entries(s.providers).map(([k, v]) => <li key={k} className="flex gap-3"><span className={`h-2 w-2 shrink-0 translate-y-2 rounded-full ${v.ok ? "bg-success" : "bg-danger"}`} /><span className="w-24 text-ink-2">{k}</span><span className="text-ink-3">{v.detail}</span></li>)}</ul>
      </div>
      <div className="panel p-4">
        <div className="text-sm font-medium">Worker settings (from the VPS .env)</div>
        <dl className="mt-2 grid gap-1 text-sm md:grid-cols-2">{Object.entries(s.settings).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-ink-3">{k}</dt><dd>{v ?? "—"}</dd></div>)}</dl>
      </div>
    </div>
  );
}
