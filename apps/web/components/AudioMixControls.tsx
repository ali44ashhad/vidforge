"use client";

import { DEFAULT_MIX, type MixSettings } from "@vidforge/shared";

export default function AudioMixControls({ value, onChange, musicEnabled, onMusicEnabled }: {
  value: MixSettings; onChange: (v: MixSettings) => void; musicEnabled: boolean; onMusicEnabled: (v: boolean) => void;
}) {
  const set = (k: keyof MixSettings, v: number) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" checked={musicEnabled} onChange={(e) => onMusicEnabled(e.target.checked)} />
        Background music
      </label>
      <Slider label="Voice volume" value={value.voiceVolume} min={0.5} max={1.5} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set("voiceVolume", v)} />
      <Slider label="Music volume" value={value.musicVolume} min={0} max={1} step={0.02} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set("musicVolume", v)} disabled={!musicEnabled} />
      <Slider label="Lower music while narrating" value={value.duck} min={1} max={12} step={1} fmt={(v) => (v <= 1 ? "off" : v <= 3 ? "a little" : v <= 7 ? "normal" : "a lot")} onChange={(v) => set("duck", v)} disabled={!musicEnabled} />
      <Slider label="Music fade in / out" value={value.fadeIn} min={0} max={6} step={0.5} fmt={(v) => `${v}s`} onChange={(v) => onChange({ ...value, fadeIn: v, fadeOut: Math.max(v, 2) })} disabled={!musicEnabled} />
      <button type="button" className="text-xs text-ink-3 hover:text-ink md:col-span-2" onClick={() => onChange(DEFAULT_MIX)}>Reset to defaults</button>
    </div>
  );
}

function Slider({ label, value, min, max, step, fmt, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <label className={`block text-sm ${disabled ? "opacity-40" : ""}`}>
      <span className="mb-1 flex justify-between text-ink-2"><span>{label}</span><span className="text-ink">{fmt(value)}</span></span>
      <input type="range" className="w-full accent-accent" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
