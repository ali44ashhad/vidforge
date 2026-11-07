"use client";

import { Plus, Trash2 } from "lucide-react";
import { GENDERS, AGE_GROUPS, type CharacterInput } from "@vidforge/shared";
import VoicePicker from "./VoicePicker";

/** Story characters: leave empty to let the AI invent them, or describe your own. */
export default function CharacterEditor({ value, onChange, count, onCount, voices, onVoices }: {
  value: CharacterInput[]; onChange: (v: CharacterInput[]) => void;
  count: number; onCount: (n: number) => void;
  voices: boolean; onVoices: (v: boolean) => void;
}) {
  const update = (i: number, patch: Partial<CharacterInput>) => onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-ink-2">Number of characters</span>
          <select className="field" value={count} onChange={(e) => onCount(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={voices} onChange={(e) => onVoices(e.target.checked)} /> Give each character its own voice
        </label>
      </div>
      <p className="text-xs text-ink-3">Leave the list empty and the AI invents the characters from your prompt. Add your own to keep the same hero across stories.</p>
      {value.map((c, i) => (
        <div key={i} className="grid gap-3 rounded-xl border border-line p-4 md:grid-cols-[160px_1fr_auto]">
          <input className="field" placeholder="Name (e.g. Priya)" value={c.name} onChange={(e) => update(i, { name: e.target.value })} />
          <div className="space-y-2">
            <div className="grid gap-2 md:grid-cols-3">
              <select className="field" value={c.gender ?? ""} onChange={(e) => update(i, { gender: e.target.value || undefined })}>
                <option value="">Gender…</option>{GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select className="field" value={c.ageGroup ?? ""} onChange={(e) => update(i, { ageGroup: e.target.value || undefined })}>
                <option value="">Age group…</option>{AGE_GROUPS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <input className="field" placeholder="Ethnicity / look (Punjabi Indian, fair skin)" value={c.ethnicity ?? ""} onChange={(e) => update(i, { ethnicity: e.target.value })} />
            </div>
            <textarea className="field" rows={2} placeholder="Looks: long black hair, white shirt, black blazer, warm smile" value={c.description} onChange={(e) => update(i, { description: e.target.value })} />
            <div className="grid gap-2 md:grid-cols-2">
              <input className="field" placeholder="Personality (confident, friendly)" value={c.personality ?? ""} onChange={(e) => update(i, { personality: e.target.value })} />
              <input className="field" placeholder="Voice hint (warm, energetic)" value={c.voiceHint ?? ""} onChange={(e) => update(i, { voiceHint: e.target.value })} />
            </div>
            <VoicePicker label={`Voice for ${c.name || "this character"}${c.gender ? ` (${c.gender} voices)` : ""}`} value={c.voiceId ?? ""} onChange={(id) => update(i, { voiceId: id || null })} gender={c.gender} />
          </div>
          <button type="button" className="btn-ghost self-start px-3" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Remove"><Trash2 size={16} /></button>
        </div>
      ))}
      {value.length < 4 && (
        <button type="button" className="btn-ghost flex items-center gap-2 text-sm" onClick={() => onChange([...value, { name: "", description: "", personality: "", voiceHint: "", gender: "female", ageGroup: "young adult", ethnicity: "" }])}>
          <Plus size={16} /> Add a character
        </button>
      )}
    </div>
  );
}
