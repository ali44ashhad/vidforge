"use client";

import { useRef, useState } from "react";
import { Loader2, UserSquare2, X } from "lucide-react";

export type PresenterValue = { presenterMode: "off" | "ai"; presenterImageUrl: string | null; presenterImagePath: string | null; presenterPosition: string; presenterSize: number; presenterRing: string; presenterShape: "circle" | "cutout" };
export const PRESENTER_DEFAULT: PresenterValue = { presenterMode: "off", presenterImageUrl: null, presenterImagePath: null, presenterPosition: "bottom_left", presenterSize: 34, presenterRing: "#6C4CFF", presenterShape: "circle" };
const POSITIONS = [["bottom_left", "Bottom left"], ["bottom_right", "Bottom right"], ["top_left", "Top left"], ["top_right", "Top right"]];

/** AI presenter ("face cam"): one photo → Veo speaks the script lip-synced, composited as a circle over the video. */
export default function PresenterPicker({ value, onChange, aspect = "R16_9" }: { value: PresenterValue; onChange: (v: PresenterValue) => void; aspect?: string }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const set = (p: Partial<PresenterValue>) => onChange({ ...value, ...p });
  async function upload(file: File) {
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/uploads", { method: "POST", body: fd });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Upload failed"); return; }
    set({ presenterImageUrl: d.url, presenterImagePath: d.path, presenterMode: "ai" });
  }
  const on = value.presenterMode === "ai";
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <label className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[15px] font-semibold"><UserSquare2 size={16} className="text-accent" /> AI presenter (face cam)</span>
        <input type="checkbox" checked={on} onChange={(e) => set({ presenterMode: e.target.checked ? "ai" : "off" })} />
      </label>
      <p className="mt-1 text-[13px] text-ink-3">Upload one clear photo of your face. The AI generates you speaking the script, lip-synced, in a circle over the video — your voice replaces the AI narrator.</p>
      {on && (
        <div className="mt-4 grid gap-4 md:grid-cols-[160px_1fr]">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-full border-2" style={{ borderColor: value.presenterRing }}>
              {value.presenterImageUrl ? <img src={value.presenterImageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-panel-2 text-[12px] text-ink-3">No photo</div>}
              {value.presenterImageUrl && <button type="button" className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white" onClick={() => set({ presenterImageUrl: null, presenterImagePath: null })}><X size={12} /></button>}
            </div>
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <button type="button" className="btn-ghost mt-2 w-full text-[13px]" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 size={14} className="mx-auto animate-spin" /> : value.presenterImageUrl ? "Change photo" : "Upload photo"}</button>
            {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
          </div>
          <div className="space-y-3 text-[14px]">
            <div><span className="mb-1 block text-ink-2">Style</span><div className="grid grid-cols-2 gap-2">
              {([["circle", "Circle", "Face in a ringed circle"], ["cutout", "Cut-out (no frame)", "Background removed — just you"]] as const).map(([v, l, d]) => (
                <button key={v} type="button" onClick={() => set({ presenterShape: v })} className={`rounded-xl border p-3 text-left ${value.presenterShape === v ? "border-accent bg-accent/10" : "border-line"}`}><span className="block text-[13px] font-medium">{l}</span><span className="block text-[11px] text-ink-3">{d}</span></button>
              ))}
            </div></div>
            <label className="block"><span className="mb-1 block text-ink-2">Position</span><select className="field" value={value.presenterPosition} onChange={(e) => set({ presenterPosition: e.target.value })}>{POSITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="block"><span className="mb-1 flex justify-between text-ink-2"><span>Size</span><span className="text-ink">{value.presenterSize}% of width</span></span><input type="range" className="w-full accent-accent" min={14} max={aspect === "R9_16" ? 70 : 50} value={value.presenterSize} onChange={(e) => set({ presenterSize: Number(e.target.value) })} /></label>
            {value.presenterShape === "circle" && <label className="block"><span className="mb-1 block text-ink-2">Ring colour</span><div className="flex gap-2"><input type="color" className="field h-[44px] w-16 p-1" value={value.presenterRing} onChange={(e) => set({ presenterRing: e.target.value })} /><input className="field" value={value.presenterRing} onChange={(e) => set({ presenterRing: e.target.value })} /></div></label>}
            <p className="text-[12px] text-ink-3">Clips are generated in sequence, each continuing from the last frame of the previous one, so your look, clothing and background stay the same for the whole video.</p>
            <p className="text-[12px] text-warning">Each 8-second presenter clip costs the same as an AI video clip (~25 credits), so a 60-second video adds ~200 credits.</p>
          </div>
        </div>
      )}
    </div>
  );
}
