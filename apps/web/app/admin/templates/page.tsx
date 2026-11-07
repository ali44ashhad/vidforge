"use client";

import { useEffect, useState } from "react";
import { VIDEO_TEMPLATES, LOOKS, MUSIC_STYLES, CAPTION_STYLES, VISUAL_SOURCES, VOICE_STYLES, VISUAL_STYLES } from "@vidforge/shared";
import VoicePicker from "@/components/VoicePicker";

type Ov = Record<string, Record<string, unknown> | undefined>;

export default function AdminTemplates() {
  const [ov, setOv] = useState<Ov>({}); const [sel, setSel] = useState(VIDEO_TEMPLATES[0].id); const [saving, setSaving] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const load = () => fetch("/api/admin/config").then((r) => r.json()).then((d) => setOv(d.overrides ?? {}));
  useEffect(() => { load(); }, []);
  const base = VIDEO_TEMPLATES.find((t) => t.id === sel)!;
  const o = (ov[`template:${sel}`] ?? {}) as { name?: string; description?: string; playbook?: string; pacing?: string; active?: boolean; defaults?: Record<string, unknown> };
  const cur = { name: o.name ?? base.name, description: o.description ?? base.description, playbook: o.playbook ?? base.playbook, pacing: o.pacing ?? base.pacing, active: o.active !== false, defaults: { ...base.defaults, ...(o.defaults ?? {}) } };
  const [form, setForm] = useState(cur);
  useEffect(() => { setForm(cur); }, [sel, ov]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(reset = false) {
    setSaving(true); setMsg(null);
    const value = reset ? null : { name: form.name, description: form.description, playbook: form.playbook, pacing: form.pacing, active: form.active, defaults: form.defaults };
    const r = await fetch("/api/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: `template:${sel}`, value }) });
    setSaving(false); setMsg(r.ok ? (reset ? "Reset to code default." : "Saved. Takes effect on the next generation.") : "Save failed."); load();
  }
  const D = form.defaults as Record<string, string | number | boolean>;
  const setD = (k: string, v: string | number | boolean) => setForm({ ...form, defaults: { ...form.defaults, [k]: v } });
  const Sel = ({ k, label, options }: { k: string; label: string; options: { value: string; label: string }[] }) => (
    <label className="block text-sm"><span className="mb-1 block text-ink-2">{label}</span><select className="field" value={String(D[k])} onChange={(e) => setD(k, e.target.value)}>{options.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="panel max-h-[70vh] overflow-y-auto p-2">
        {VIDEO_TEMPLATES.map((t) => <button key={t.id} onClick={() => setSel(t.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${sel === t.id ? "bg-accent/15" : "hover:bg-panel-2"}`}><span>{(ov[`template:${t.id}`] as { name?: string } | undefined)?.name ?? t.name}</span>{ov[`template:${t.id}`] && <span className="chip">edited</span>}</button>)}
      </div>
      <div className="panel space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block text-ink-2">Name</span><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visible to users</label>
        </div>
        <label className="block text-sm"><span className="mb-1 block text-ink-2">Description (one line)</span><input className="field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label className="block text-sm"><span className="mb-1 block text-ink-2">Playbook (what the writer and storyboarder follow)</span><textarea className="field" rows={6} value={form.playbook} onChange={(e) => setForm({ ...form, playbook: e.target.value })} /></label>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm"><span className="mb-1 block text-ink-2">Pacing</span><select className="field" value={form.pacing} onChange={(e) => setForm({ ...form, pacing: e.target.value })}>{["energetic", "normal", "cinematic"].map((p) => <option key={p}>{p}</option>)}</select></label>
          <Sel k="visualSource" label="Visuals" options={VISUAL_SOURCES.map((v) => ({ value: v.value, label: v.label }))} />
          <Sel k="style" label="Visual style" options={VISUAL_STYLES.map((s) => ({ value: s.id, label: s.name }))} />
          <Sel k="look" label="Look" options={LOOKS.map((l) => ({ value: l.id, label: l.name }))} />
          <Sel k="musicStyle" label="Music" options={MUSIC_STYLES.map((m) => ({ value: m, label: m }))} />
          <Sel k="captionStyle" label="Caption style" options={CAPTION_STYLES.map((c) => ({ value: c, label: c }))} />
          <Sel k="voiceStyle" label="Voice style" options={VOICE_STYLES.map((v) => ({ value: v, label: v }))} />
          <Sel k="narrationMode" label="Narration" options={[{ value: "narrator", label: "Narrator only" }, { value: "characters", label: "Narrator + characters" }, { value: "characters_only", label: "Characters only" }]} />
          <Sel k="aspectRatio" label="Aspect" options={[{ value: "R16_9", label: "16:9" }, { value: "R9_16", label: "9:16" }]} />
          <div className="md:col-span-3"><VoicePicker label="Default voice for this type (optional)" value={String(D.voiceId ?? "")} onChange={(id) => setD("voiceId", id)} /></div>
          <label className="block text-sm"><span className="mb-1 block text-ink-2">Look intensity</span><input type="number" className="field" value={Number(D.lookIntensity)} onChange={(e) => setD("lookIntensity", Number(e.target.value))} /></label>
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={!!D.captionsEnabled} onChange={(e) => setD("captionsEnabled", e.target.checked)} /> Captions on</label>
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={!!D.voiceEnabled} onChange={(e) => setD("voiceEnabled", e.target.checked)} /> Voiceover on</label>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={saving} onClick={() => save(false)}>Save</button>
          <button className="btn-ghost" disabled={saving || !ov[`template:${sel}`]} onClick={() => save(true)}>Reset to default</button>
          {msg && <span className="text-sm text-ink-3">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
