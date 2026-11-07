"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Play, Pause, Loader2, Check } from "lucide-react";

type V = { voiceId: string; name: string; gender: string | null; age: string | null; accent: string | null; language: string | null; useCase: string | null; description: string | null; previewUrl: string | null; clonedBy: number; addedAt: string | null };
const LANGS: [string, string][] = [["", "Any language"], ["en", "English"], ["hi", "Hindi"], ["pa", "Punjabi"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["pt", "Portuguese"], ["ar", "Arabic"], ["ja", "Japanese"], ["it", "Italian"], ["ta", "Tamil"], ["bn", "Bengali"], ["ur", "Urdu"]];

/** Browse the ElevenLabs shared library (synced into our DB), preview, and use a voice (added to the account on first use). */
export default function VoiceLibrary({ onPick, onClose, gender }: { onPick: (id: string, name: string) => void; onClose: () => void; gender?: string }) {
  const [q, setQ] = useState(""); const [lang, setLang] = useState(""); const [g, setG] = useState(gender ?? ""); const [accent, setAccent] = useState("");
  const [rows, setRows] = useState<V[]>([]); const [byId, setById] = useState(""); const [byIdBusy, setByIdBusy] = useState(false); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(false); const [playing, setPlaying] = useState<string | null>(null); const [adding, setAdding] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { const t = setTimeout(async () => { setLoading(true); const r = await fetch(`/api/voices/community?q=${encodeURIComponent(q)}&language=${lang}&gender=${g}&accent=${encodeURIComponent(accent)}&limit=40`); const d = await r.json(); setRows(d.voices ?? []); setTotal(d.total ?? 0); setLoading(false); }, 300); return () => clearTimeout(t); }, [q, lang, g, accent]);
  const play = (v: V) => { if (!v.previewUrl) return; if (playing === v.voiceId) { audio.current?.pause(); setPlaying(null); return; } audio.current?.pause(); const a = new Audio(v.previewUrl); audio.current = a; a.onended = () => setPlaying(null); a.play().catch(() => {}); setPlaying(v.voiceId); };
  const use = async (v: V) => { setAdding(v.voiceId); setErr(null); const r = await fetch("/api/voices/community/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId: v.voiceId }) }); const d = await r.json(); setAdding(null); if (!r.ok || !d.ok) { setErr(d.error ?? "Could not add this voice"); return; } audio.current?.pause(); onPick(v.voiceId, v.name); };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center md:p-6" onClick={() => { audio.current?.pause(); onClose(); }}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-t-2xl border border-line bg-panel md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><div><div className="text-[15px] font-semibold">Voice library</div><div className="text-[12px] text-ink-3">{total.toLocaleString()} community voices · preview, then use</div></div><button onClick={() => { audio.current?.pause(); onClose(); }} className="rounded-lg p-1 text-ink-3 hover:text-ink"><X size={20} /></button></div>
        <div className="grid gap-2 border-b border-line p-4 md:grid-cols-[1fr_150px_130px_150px]">
          <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-ink-3" /><input className="field pl-9" placeholder="Search by name or description (e.g. Hindi storyteller)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
          <select className="field" value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <select className="field" value={g} onChange={(e) => setG(e.target.value)}><option value="">Any gender</option><option value="female">Female</option><option value="male">Male</option></select>
          <input className="field" placeholder="Accent (indian, british…)" value={accent} onChange={(e) => setAccent(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 md:flex-row md:items-center">
          <span className="text-[13px] text-ink-2">Have an ElevenLabs voice ID?</span>
          <input className="field md:max-w-sm" placeholder="e.g. 21m00Tcm4TlvDq8ikWAM" value={byId} onChange={(e) => setById(e.target.value)} />
          <button className="btn-ghost text-[13px]" disabled={!byId.trim() || byIdBusy} onClick={async () => { setByIdBusy(true); setErr(null); const r = await fetch("/api/voices/by-id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId: byId.trim() }) }); const d = await r.json(); setByIdBusy(false); if (!r.ok || !d.ok) { setErr(d.error ?? "Could not add that voice"); return; } audio.current?.pause(); onPick(d.id, d.name); }}>{byIdBusy ? "Adding…" : "Use this ID"}</button>
        </div>
        {err && <p className="px-5 pt-3 text-[13px] text-danger">{err}</p>}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && rows.length === 0 ? <div className="py-10 text-center text-[14px] text-ink-3"><Loader2 size={18} className="mx-auto animate-spin" /></div> : rows.length === 0 ? <p className="py-10 text-center text-[14px] text-ink-3">{total === 0 ? "The library hasn't synced yet — it fills in a few minutes after the worker starts." : "No voices match. Try fewer filters."}</p> : (
            <ul className="grid gap-2 md:grid-cols-2">{rows.map((v) => (
              <li key={v.voiceId} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <button onClick={() => play(v)} disabled={!v.previewUrl} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${playing === v.voiceId ? "bg-accent text-white" : "bg-panel-2 text-ink"} disabled:opacity-40`} aria-label="Preview">{playing === v.voiceId ? <Pause size={16} /> : <Play size={16} />}</button>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[14px] font-semibold"><span className="truncate">{v.name}</span>{v.addedAt && <span className="pill pill-ready"><Check size={10} /> ready</span>}</div><div className="truncate text-[12px] text-ink-3">{[v.gender, v.age, v.accent, v.language?.toUpperCase(), v.useCase].filter(Boolean).join(" · ")} · {v.clonedBy.toLocaleString()} users</div>{v.description && <div className="truncate text-[12px] text-ink-2">{v.description}</div>}</div>
                <button className="btn-gradient px-3 py-1.5 text-[13px]" disabled={adding === v.voiceId} onClick={() => use(v)}>{adding === v.voiceId ? <Loader2 size={14} className="animate-spin" /> : "Use"}</button>
              </li>))}</ul>
          )}
        </div>
      </div>
    </div>
  );
}
