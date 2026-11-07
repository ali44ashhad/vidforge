"use client";

import { useState } from "react";
import { LOGO_POSITIONS } from "@vidforge/shared";

export type LogoValue = { logoUrl: string | null; logoPath: string | null; logoPosition: string };

export default function LogoUpload({ value, onChange }: { value: LogoValue; onChange: (v: LogoValue) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true); setError(null);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Upload failed"); return; }
    onChange({ ...value, logoUrl: data.url, logoPath: data.path });
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_200px]">
      <label className="block text-sm">
        <span className="mb-1 block text-ink-2">Channel logo (PNG with transparency works best)</span>
        <div className="flex items-center gap-3">
          {value.logoUrl && <img src={value.logoUrl} alt="" className="h-10 w-10 rounded bg-panel-2 object-contain" />}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="text-sm text-ink-2" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {value.logoUrl && <button type="button" className="text-xs text-ink-3 hover:text-ink" onClick={() => onChange({ ...value, logoUrl: null, logoPath: null })}>Remove</button>}
        </div>
        {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-ink-2">Position</span>
        <select className="field" value={value.logoPosition} onChange={(e) => onChange({ ...value, logoPosition: e.target.value })}>
          {LOGO_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
    </div>
  );
}
