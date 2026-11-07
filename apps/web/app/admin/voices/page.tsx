"use client";

import { useEffect, useState } from "react";
import { LANGUAGES } from "@vidforge/shared";

type Voice = { id: string; name: string; previewUrl: string | null; labels: Record<string, string> | null };

export default function AdminVoices() {
  const [voices, setVoices] = useState<Voice[]>([]); const [ov, setOv] = useState<Record<string, { voiceId?: string } | undefined>>({}); const [q, setQ] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { fetch("/api/voices").then((r) => r.json()).then((d) => setVoices(d.voices ?? [])); fetch("/api/admin/config").then((r) => r.json()).then((d) => setOv(d.overrides ?? {})); }, []);
  async function setDefault(language: string, voiceId: string) {
    const r = await fetch("/api/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: `voice-default:${language.toLowerCase()}`, value: voiceId ? { voiceId } : null }) });
    setMsg(r.ok ? `Default for ${language} saved.` : "Save failed."); setOv({ ...ov, [`voice-default:${language.toLowerCase()}`]: voiceId ? { voiceId } : undefined });
  }
  const describe = (v: Voice) => Object.values(v.labels ?? {}).filter(Boolean).join(" · ");
  const shown = voices.filter((v) => !q || `${v.name} ${describe(v)}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-2">Default narrator voice per language (used when a project leaves Voice on Auto)</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {LANGUAGES.map((l) => (
            <label key={l} className="flex items-center gap-3 text-sm"><span className="w-24 text-ink-2">{l}</span>
              <select className="field" value={ov[`voice-default:${l.toLowerCase()}`]?.voiceId ?? ""} onChange={(e) => setDefault(l, e.target.value)}><option value="">Auto (by labels)</option>{voices.map((v) => <option key={v.id} value={v.id}>{v.name} — {describe(v)}</option>)}</select>
            </label>
          ))}
        </div>
        {msg && <p className="mt-2 text-sm text-ink-3">{msg}</p>}
      </section>
      <section>
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium text-ink-2">Synced voices ({voices.length})</h2><input className="field max-w-xs" placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm"><tbody>{shown.map((v) => (
            <tr key={v.id} className="border-t border-line"><td className="px-3 py-2 font-medium">{v.name}</td><td className="px-3 py-2 text-xs text-ink-3">{describe(v)}</td><td className="px-3 py-2 text-right">{v.previewUrl && <audio controls preload="none" src={v.previewUrl} className="h-8 max-w-[220px]" />}</td></tr>
          ))}</tbody></table>
        </div>
      </section>
    </div>
  );
}
