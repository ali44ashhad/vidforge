"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Film } from "lucide-react";

type P = { id: string; title: string; status: string; progress: number; currentStage: string | null; finalVideoUrl: string | null; thumbnailUrl: string | null; actualDuration: number | null; error: string | null; creditsReserved: number; creditsCharged: number; language: string; targetDuration: number };
type B = { id: string; name: string; total: number; completed: number; failed: number; status: string; createdAt: string; projects: P[] };

export default function BatchStatus({ id }: { id: string }) {
  const [b, setB] = useState<B | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => { const r = await fetch(`/api/batches/${id}`, { cache: "no-store" }); const d = await r.json().catch(() => null); if (!stop && d?.batch) { setB(d.batch); if (d.batch.status !== "COMPLETED") setTimeout(tick, 4000); } };
    tick(); return () => { stop = true; };
  }, [id]);
  if (!b) return <p className="text-ink-3">Loading…</p>;
  const running = b.total - b.completed - b.failed;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Link href="/bulk" className="text-xs text-ink-3 hover:text-ink">← Bulk creation</Link><h1 className="mt-1 text-2xl font-semibold">{b.name}</h1><p className="text-sm text-ink-2">{b.completed} of {b.total} ready{b.failed ? ` · ${b.failed} failed` : ""}{running ? ` · ${running} in progress` : ""}</p></div>
        {b.completed > 0 && <a className="btn-primary flex items-center gap-2" href={`/api/batches/${id}/zip`}><Download size={18} /> Download all ({b.completed})</a>}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-2"><div className="h-full bg-accent transition-all" style={{ width: `${Math.round(((b.completed + b.failed) / Math.max(1, b.total)) * 100)}%` }} /></div>
      <div className="mt-6 overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-left text-xs uppercase text-ink-3"><tr><th className="px-3 py-2">Video</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Credits</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>{b.projects.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="px-3 py-2"><div className="flex items-center gap-3">{p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="h-10 w-16 rounded object-cover" /> : <div className="flex h-10 w-16 items-center justify-center rounded bg-panel-2 text-ink-3"><Film size={14} /></div>}<div><Link href={`/projects/${p.id}`} className="font-medium hover:text-accent">{p.title}</Link><div className="text-xs text-ink-3">{p.language} · {p.targetDuration}s</div></div></div></td>
              <td className="px-3 py-2 text-xs">{p.status === "COMPLETED" ? <span className="text-success">Ready</span> : p.status === "FAILED" ? <span className="text-danger" title={p.error ?? ""}>Failed</span> : <span className="text-ink-2">{p.currentStage?.replace(/_/g, " ").toLowerCase() ?? "queued"} · {p.progress}%</span>}</td>
              <td className="px-3 py-2 text-right text-xs">{p.creditsCharged || "—"} / {p.creditsReserved}</td>
              <td className="px-3 py-2 text-right">{p.finalVideoUrl && <a className="chip hover:border-accent" href={`${p.finalVideoUrl}?download=1`}>MP4</a>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
