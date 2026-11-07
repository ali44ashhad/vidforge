"use client";

import { LOOKS } from "@vidforge/shared";

export default function LookPicker({ look, intensity, onLook, onIntensity }: { look: string; intensity: number; onLook: (v: string) => void; onIntensity: (v: number) => void }) {
  return (
    <div>
      <div className="grid gap-2 md:grid-cols-4">
        {LOOKS.map((l) => (
          <button key={l.id} type="button" onClick={() => onLook(l.id)} className={`rounded-xl border p-3 text-left transition ${look === l.id ? "border-accent bg-panel-2" : "border-line hover:border-line-2"}`}>
            <div className="text-sm font-medium">{l.name}</div>
            <p className="mt-1 text-xs leading-snug text-ink-3">{l.description}</p>
          </button>
        ))}
      </div>
      {look === "auto" && <p className="mt-2 text-xs text-ink-3">The AI reads the topic and platform (bright and clean for Shorts, Reels and ads; cinematic only for documentary/story formats) and sets the grade. Pick a preset to override.</p>}
      {look !== "none" && look !== "auto" && (
        <label className="mt-3 block text-sm">
          <span className="mb-1 flex justify-between text-ink-2"><span>Look intensity</span><span className="text-ink">{intensity}%</span></span>
          <input type="range" className="w-full accent-accent" min={20} max={130} step={5} value={intensity} onChange={(e) => onIntensity(Number(e.target.value))} />
        </label>
      )}
    </div>
  );
}
