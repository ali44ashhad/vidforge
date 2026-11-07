"use client";

import { useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { REFERENCE_KINDS, type ReferenceImage } from "@vidforge/shared";

/** Upload up to 4 reference images that guide every AI image / video clip. */
export default function ReferenceImages({ value, onChange }: { value: ReferenceImage[]; onChange: (v: ReferenceImage[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true); setError(null);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Upload failed"); return; }
    onChange([...value, { url: data.url, path: data.path, kind: "subject", label: "" }]);
  }
  const update = (i: number, patch: Partial<ReferenceImage>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {value.map((r, i) => (
        <div key={i} className="grid items-center gap-3 rounded-xl border border-line p-3 md:grid-cols-[72px_180px_1fr_auto]">
          <img src={r.url} alt="" className="h-16 w-16 rounded-lg bg-panel-2 object-cover" />
          <select className="field" value={r.kind} onChange={(e) => update(i, { kind: e.target.value as ReferenceImage["kind"] })}>
            {REFERENCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <div>
            <input className="field" placeholder={r.kind === "character" ? "Character name (must match the story character)" : "Label, e.g. 'our red water bottle'"} value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
            <p className="mt-1 text-xs text-ink-3">{REFERENCE_KINDS.find((k) => k.value === r.kind)?.hint}</p>
          </div>
          <button type="button" className="btn-ghost px-3" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Remove"><Trash2 size={16} /></button>
        </div>
      ))}
      {value.length < 4 && (
        <label className="btn-ghost inline-flex cursor-pointer items-center gap-2 text-sm">
          <Upload size={16} /> {busy ? "Uploading…" : "Add reference image"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-ink-3">Used by AI images and AI video clips (Veo ingredient mode). Not used with stock footage.</p>
    </div>
  );
}
