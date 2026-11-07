"use client";

import { useState } from "react";
import { Loader2, Pencil, RefreshCw, Search, Upload, Wand2, X } from "lucide-react";

type Shot = { id: string; duration: number; visualDescription: string; mediaAsset: { previewUrl: string | null; type: string } | null };
type Scene = { id: string; narration: string; shots: Shot[] };
type Chapter = { id: string; title: string; startTime: number | null; endTime: number | null; scenes: Scene[] };
type Stock = { id: string; type: string; url: string; previewUrl: string; width: number; height: number; duration?: number; creator: string };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Scene editor: stage shot/narration edits, then apply once — only what changed is regenerated. */
export default function SceneEditor({ projectId, chapters, vertical, nativeSpeech, initialPending }: { projectId: string; chapters: Chapter[]; vertical: boolean; nativeSpeech: boolean; initialPending: number }) {
  const [pending, setPending] = useState(initialPending);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [stockFor, setStockFor] = useState<Shot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [editingScene, setEditingScene] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function shotAction(shot: Shot, body: Record<string, unknown>) {
    setBusy(shot.id); setMsg(null);
    const r = await fetch(`/api/projects/${projectId}/shots/${shot.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setMsg(d.error ?? "Could not stage that change."); return; }
    setPending(d.pending); setEdited((e) => new Set(e).add(shot.id));
  }
  async function regenerate(shot: Shot) {
    const description = prompt("Describe the visual for this shot (leave as is to regenerate with the same description):", shot.visualDescription);
    if (description === null) return;
    await shotAction(shot, { action: "regenerate", description });
  }
  async function upload(shot: Shot, file: File) {
    setBusy(shot.id);
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/uploads", { method: "POST", body: fd }); const d = await r.json();
    if (!r.ok) { setMsg(d.error ?? "Upload failed"); setBusy(null); return; }
    await shotAction(shot, { action: "pin", source: { type: "upload", path: d.path, url: d.url, kind: file.type.startsWith("video") ? "video" : "image" } });
  }
  async function saveScene(scene: Scene) {
    setBusy(scene.id); setMsg(null);
    const r = await fetch(`/api/projects/${projectId}/scenes/${scene.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ narration: draft }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setMsg(d.error ?? "Could not save."); return; }
    scene.narration = draft; setEditingScene(null); setEdited((e) => new Set(e).add(scene.id)); setPending((p) => p + 1);
  }
  async function apply() {
    setApplying(true);
    await fetch(`/api/projects/${projectId}/apply-edits`, { method: "POST" });
    window.location.reload();
  }
  const hasEdits = edited.size > 0 || pending > 0;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Scenes</h2><p className="mt-1 text-sm text-ink-3">Click a shot to replace its visual; edit a paragraph to re-voice just that scene. Apply once — only what changed is regenerated, then the video re-renders.</p></div>
        {hasEdits && <button className="btn-primary flex items-center gap-2" onClick={apply} disabled={applying}>{applying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Apply changes & render</button>}
      </div>
      {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
      <div className="mt-4 space-y-6">
        {chapters.map((ch) => (
          <div key={ch.id} className="panel p-5">
            <div className="flex items-baseline justify-between"><h3 className="font-medium">{ch.title}</h3>{ch.startTime != null && ch.endTime != null && <span className="text-xs text-ink-3">{fmt(ch.startTime)} – {fmt(ch.endTime)}</span>}</div>
            <div className="mt-3 space-y-5">
              {ch.scenes.map((sc) => (
                <div key={sc.id} className="grid gap-3 md:grid-cols-[1fr_300px]">
                  <div>
                    {editingScene === sc.id ? (
                      <div>
                        <textarea className="field text-sm" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
                        <div className="mt-2 flex gap-2"><button className="btn-primary px-3 py-1.5 text-xs" disabled={busy === sc.id} onClick={() => saveScene(sc)}>Save & re-voice</button><button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEditingScene(null)}>Cancel</button></div>
                      </div>
                    ) : (
                      <div className="group relative">
                        <p className={`text-sm leading-relaxed ${edited.has(sc.id) ? "text-warning" : "text-ink-2"}`}>{sc.narration}</p>
                        {!nativeSpeech && <button className="mt-1 flex items-center gap-1 text-xs text-ink-3 hover:text-ink" onClick={() => { setEditingScene(sc.id); setDraft(sc.narration); }}><Pencil size={12} /> Edit text</button>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sc.shots.map((sh) => {
                      const changed = edited.has(sh.id) || !sh.mediaAsset;
                      return (
                        <div key={sh.id} className={`group relative h-16 w-24 overflow-hidden rounded-md border ${changed ? "border-warning" : "border-transparent"} bg-panel-2`} title={`${sh.visualDescription} (${sh.duration.toFixed(1)}s)`}>
                          {sh.mediaAsset?.previewUrl && !edited.has(sh.id) ? <img src={sh.mediaAsset.previewUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] text-warning">{edited.has(sh.id) ? "will regenerate" : "no media"}</span>}
                          {sh.mediaAsset?.type === "VIDEO" && <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[9px] text-white">▶</span>}
                          {busy === sh.id ? <div className="absolute inset-0 flex items-center justify-center bg-black/60"><Loader2 size={14} className="animate-spin" /></div> : (
                            <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/70 group-hover:flex">
                              <button title="Regenerate with AI" className="rounded bg-white/15 p-1 hover:bg-white/30" onClick={() => regenerate(sh)}><Wand2 size={13} /></button>
                              <button title="Choose stock footage" className="rounded bg-white/15 p-1 hover:bg-white/30" onClick={() => setStockFor(sh)}><Search size={13} /></button>
                              <label title="Upload my own" className="cursor-pointer rounded bg-white/15 p-1 hover:bg-white/30"><Upload size={13} /><input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" className="hidden" onChange={(e) => e.target.files?.[0] && upload(sh, e.target.files[0])} /></label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {stockFor && <StockPicker projectId={projectId} vertical={vertical} shot={stockFor} onClose={() => setStockFor(null)} onPick={async (s) => { const shot = stockFor; setStockFor(null); await shotAction(shot, { action: "pin", source: { type: s.type === "VIDEO" ? "pexels_video" : "pexels_photo", id: s.id, url: s.url, previewUrl: s.previewUrl, width: s.width, height: s.height, duration: s.duration } }); }} />}
    </section>
  );
}

function StockPicker({ projectId, vertical, shot, onClose, onPick }: { projectId: string; vertical: boolean; shot: Shot; onClose: () => void; onPick: (s: Stock) => void }) {
  const [q, setQ] = useState(shot.visualDescription.split(/[,.]/)[0].slice(0, 60));
  const [type, setType] = useState<"video" | "photo">("video");
  const [results, setResults] = useState<Stock[]>([]); const [loading, setLoading] = useState(false);
  async function search() {
    setLoading(true);
    const r = await fetch(`/api/projects/${projectId}/stock?q=${encodeURIComponent(q)}&type=${type}&orientation=${vertical ? "portrait" : "landscape"}`);
    const d = await r.json().catch(() => ({})); setResults(d.results ?? []); setLoading(false);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-6" onClick={onClose}>
      <div className="panel max-h-[85vh] w-full max-w-3xl overflow-y-auto p-4 md:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-medium">Choose stock footage</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="mt-3 flex gap-2">
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search Pexels, e.g. farmer sunrise field" />
          <select className="field max-w-[110px]" value={type} onChange={(e) => setType(e.target.value as "video" | "photo")}><option value="video">Videos</option><option value="photo">Photos</option></select>
          <button className="btn-primary px-4" onClick={search} disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : "Search"}</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {results.map((s) => (
            <button key={s.id} className="group relative aspect-video overflow-hidden rounded-lg border border-line hover:border-accent" onClick={() => onPick(s)}>
              <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">{s.duration ? `${Math.round(s.duration)}s · ` : ""}{s.creator}</span>
            </button>
          ))}
          {!loading && results.length === 0 && <p className="col-span-full py-6 text-center text-sm text-ink-3">Search to see results.</p>}
        </div>
      </div>
    </div>
  );
}
