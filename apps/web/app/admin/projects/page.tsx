"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type P = { id: string; email: string; title: string; status: string; progress: number; currentStage: string | null; videoType: string; language: string; visualSource: string; targetDuration: number; creditsReserved: number; creditsCharged: number; error: string | null; createdAt: string; attempts: number };

export default function AdminProjects() {
  const [rows, setRows] = useState<P[]>([]); const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  const load = () => fetch(`/api/admin/projects?q=${encodeURIComponent(q)}&status=${status}`).then((r) => r.json()).then((d) => setRows(d.projects ?? []));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(id: string, action: string) {
    const reason = action === "refund" || action === "fail" ? prompt("Reason (recorded in the audit log):") : undefined;
    if ((action === "refund" || action === "fail") && !reason) return;
    setBusy(id);
    await fetch(`/api/admin/projects/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
    setBusy(null); load();
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input className="field max-w-sm" placeholder="Search title, id or error" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{["QUEUED", "SCRIPTING", "STORYBOARDING", "VOICE_GENERATION", "FETCHING_MEDIA", "MUSIC_GENERATION", "ASSEMBLING", "RENDERING", "FINALIZING", "COMPLETED", "FAILED", "PAUSED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-left text-xs uppercase text-ink-3"><tr><th className="px-3 py-2">Project</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Credits</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Actions</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-line align-top">
                <td className="px-3 py-2"><Link href={`/projects/${p.id}`} className="font-medium hover:text-accent">{p.title}</Link><div className="text-xs text-ink-3">{p.videoType} · {p.language} · {p.visualSource} · {p.targetDuration}s · <span className="font-mono">{p.id}</span></div>{p.error && <div className="mt-0.5 line-clamp-2 text-xs text-danger">{p.error}</div>}</td>
                <td className="px-3 py-2 text-xs">{p.email}</td>
                <td className="px-3 py-2 text-xs"><span className={p.status === "COMPLETED" ? "text-success" : p.status === "FAILED" ? "text-danger" : "text-ink-2"}>{p.status}</span>{p.currentStage && <div className="text-ink-3">{p.currentStage} · {p.progress}% · try {p.attempts}</div>}</td>
                <td className="px-3 py-2 text-right text-xs">{p.creditsCharged || 0} / {p.creditsReserved}</td>
                <td className="px-3 py-2 text-xs text-ink-3">{new Date(p.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1 text-xs">
                    {(p.status === "FAILED" || p.status === "PAUSED") && <button className="chip hover:border-accent" disabled={busy === p.id} onClick={() => act(p.id, "resume")}>Retry</button>}
                    <button className="chip hover:border-accent" disabled={busy === p.id} onClick={() => confirm("Restart from scratch?") && act(p.id, "restart")}>Restart</button>
                    {(p.creditsCharged || p.creditsReserved) ? <button className="chip hover:border-warning" disabled={busy === p.id} onClick={() => act(p.id, "refund")}>Refund</button> : null}
                    {!["COMPLETED", "FAILED"].includes(p.status) && <button className="chip hover:border-danger" disabled={busy === p.id} onClick={() => act(p.id, "fail")}>Stop</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-ink-3">No projects match.</p>}
      </div>
    </div>
  );
}
