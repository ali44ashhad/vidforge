"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, Library } from "lucide-react";
import VoiceLibrary from "./VoiceLibrary";

type Voice = { id: string; name: string; category: string | null; labels: Record<string, string> | null; previewUrl: string | null };

/** Voice list comes from the DB (synced by the worker from ElevenLabs). Empty list = worker hasn't synced yet. */
export default function VoicePicker({ value, onChange, gender, label = "Voice" }: { value: string; onChange: (id: string) => void; gender?: string; label?: string }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [lib, setLib] = useState(false);
  const reload = () => fetch("/api/voices").then((r) => r.json()).then((d) => setVoices(d.voices ?? [])).catch(() => {});
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { fetch("/api/voices").then((r) => r.json()).then((d) => setVoices(d.voices ?? [])).catch(() => {}); }, []);

  const genderOf = (v: Voice) => { const l = Object.values(v.labels ?? {}).join(" ").toLowerCase() + " " + v.name.toLowerCase(); return /\bfemale\b|woman|girl/.test(l) ? "female" : /\bmale\b|\bman\b|boy/.test(l) ? "male" : ""; };
  const shown = gender ? voices.filter((v) => genderOf(v) === gender || genderOf(v) === "") : voices;
  const current = voices.find((v) => v.id === value);
  function preview() {
    if (!current?.previewUrl) return;
    if (playing === current.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause();
    const a = new Audio(current.previewUrl);
    audio.current = a; setPlaying(current.id);
    a.onended = () => setPlaying(null);
    a.play().catch(() => setPlaying(null));
  }
  const describe = (v: Voice) => {
    const l = v.labels ?? {};
    return [l.gender, l.accent, l.age, l.descriptive ?? l.description ?? l.use_case].filter(Boolean).join(", ");
  };

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-2">{label}</span>
      <div className="flex gap-2">
        <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Auto (match voice style)</option>
          {shown.map((v) => <option key={v.id} value={v.id}>{v.name}{describe(v) ? ` — ${describe(v)}` : ""}</option>)}
        </select>
        <button type="button" className="btn-ghost shrink-0 px-3" onClick={preview} disabled={!current?.previewUrl} title="Preview voice">
          {playing ? <Square size={16} /> : <Play size={16} />}
        </button>
        <button type="button" className="btn-ghost flex shrink-0 items-center gap-1.5 px-3 text-[13px]" onClick={() => setLib(true)} title="Browse the community voice library"><Library size={15} /> <span className="hidden sm:inline">Library</span></button>
      </div>
      {lib && <VoiceLibrary gender={gender} onClose={() => setLib(false)} onPick={(id) => { reload().then(() => onChange(id)); setLib(false); }} />}
      {voices.length === 0 && <span className="mt-1 block text-xs text-ink-3">Voice list appears once the worker has started with an ElevenLabs key.</span>}
    </label>
  );
}
