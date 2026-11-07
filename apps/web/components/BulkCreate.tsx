"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { ASPECT_RATIOS, DURATION_OPTIONS, VISUAL_SOURCES, VOICE_STYLES, MUSIC_STYLES, CAPTION_STYLES, OUTPUT_QUALITIES, LANGUAGES, LOOKS, findTemplate } from "@vidforge/shared";
import TypePicker from "./TypePicker";
import StylePicker from "./StylePicker";
import VoicePicker from "./VoicePicker";

type Row = { prompt: string; title?: string; language?: string; targetDuration?: number };

function parseRows(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  // CSV with header?
  const head = lines[0].toLowerCase();
  if (/^(prompt|topic)\b/.test(head) && head.includes(",")) {
    const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
    const idx = (n: string) => cols.indexOf(n);
    return lines.slice(1).map((l) => { const c = splitCsv(l); return { prompt: c[Math.max(0, idx("prompt") >= 0 ? idx("prompt") : idx("topic"))] ?? "", title: idx("title") >= 0 ? c[idx("title")] : undefined, language: idx("language") >= 0 ? c[idx("language")] : undefined, targetDuration: idx("duration") >= 0 ? Number(c[idx("duration")]) || undefined : undefined }; });
  }
  return lines.map((l) => ({ prompt: l }));
}
function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; } else cur += ch; }
  out.push(cur.trim()); return out;
}

export default function BulkCreate() {
  const router = useRouter();
  const [text, setText] = useState(""); const [name, setName] = useState("");
  const [videoType, setVideoType] = useState("YouTube Video");
  const [s, setS] = useState({ targetDuration: 60, aspectRatio: "R16_9", language: "English", visualSource: "mixed", imageStyle: "cinematic_photo", look: "auto", lookIntensity: 70, voiceStyle: "Professional", voiceId: "", musicStyle: "Auto", captionsEnabled: true, captionStyle: "YouTube Clean", outputQuality: "1080p", musicEnabled: true, voiceEnabled: true, textOverlaysEnabled: true, narrationMode: "narrator" as const });
  const [est, setEst] = useState<{ per: number; total: number; balance: number | null } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [upgrade, setUpgrade] = useState(false);
  const rows = useMemo(() => parseRows(text), [text]);
  useEffect(() => { fetch("/api/brand-kit").then((r) => r.json()).then((d) => { const k = d.brandKit; if (!k) return; setS((x) => ({ ...x, ...(k.voiceId ? { voiceId: k.voiceId } : {}), ...(k.voiceStyle ? { voiceStyle: k.voiceStyle } : {}), ...(k.captionStyle ? { captionStyle: k.captionStyle } : {}), ...(k.look ? { look: k.look } : {}), ...(k.imageStyle ? { imageStyle: k.imageStyle } : {}) })); }).catch(() => {}); }, []);
  const set = (patch: Partial<typeof s>) => setS({ ...s, ...patch });
  function applyType(id: string) { setVideoType(id); const t = findTemplate(id); if (!t) return; const d = t.defaults; set({ ...(d.aspectRatio ? { aspectRatio: d.aspectRatio } : {}), visualSource: d.visualSource, imageStyle: d.style, look: d.look, lookIntensity: d.lookIntensity, musicStyle: d.musicStyle, captionsEnabled: d.captionsEnabled, captionStyle: d.captionStyle, voiceStyle: d.voiceStyle, voiceEnabled: d.voiceEnabled, textOverlaysEnabled: d.textOverlays, ...(d.voiceId ? { voiceId: d.voiceId } : {}), ...(d.durationSeconds ? { targetDuration: d.durationSeconds } : {}) }); }
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch("/api/projects/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s, narrationMode: "narrator" }) });
      if (r.ok) { const d = await r.json(); setEst({ per: d.estimate.reserve, total: d.estimate.reserve * rows.length, balance: d.balance }); }
    }, 400); return () => clearTimeout(t);
  }, [JSON.stringify(s), rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true); setError(null); setUpgrade(false);
    const res = await fetch("/api/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, rows, settings: { ...s, videoType, prompt: "template" } }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Could not start the batch."); setUpgrade(!!d.upgrade); setBusy(false); return; }
    router.push(`/bulk/${d.batch.id}`);
  }
  const Sel = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
    <label className="block text-sm"><span className="mb-1 block text-ink-2">{label}</span><select className="field" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-line bg-panel p-5 md:p-6">
          <h2 className="text-[16px] font-semibold">1. Add topics</h2>
          <p className="mt-1 text-xs text-ink-3">One topic per line, or paste a CSV with a header row: <code>prompt,title,language,duration</code>. Up to 50 per batch.</p>
          <textarea className="field mt-3 min-h-[180px] font-mono text-sm" placeholder={"5 morning habits that changed my life\nWhy the Sahara was once green\n\"Mohali real estate: is 2026 the year to buy?\",Mohali property guide,Punjabi,45"} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
            <span>{rows.length} video{rows.length === 1 ? "" : "s"} detected</span>
            <label className="flex cursor-pointer items-center gap-1 hover:text-ink"><Upload size={14} /> Upload CSV<input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(setText); }} /></label>
          </div>
        </div>

        <div className="space-y-5 rounded-2xl border border-line bg-panel p-5 md:p-6">
          <h2 className="text-[16px] font-semibold">2. Settings for all videos</h2>
          <div><span className="mb-1 block text-sm text-ink-2">Video type</span><TypePicker value={videoType} onChange={applyType} /></div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Sel label="Duration" value={String(s.targetDuration)} onChange={(v) => set({ targetDuration: Number(v) })} options={DURATION_OPTIONS.map((d) => ({ value: String(d.seconds), label: d.label }))} />
            <Sel label="Format" value={s.aspectRatio} onChange={(v) => set({ aspectRatio: v })} options={ASPECT_RATIOS.map((a) => ({ value: a.value, label: a.label }))} />
            <Sel label="Language" value={s.language} onChange={(v) => set({ language: v })} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
            <Sel label="Visuals" value={s.visualSource} onChange={(v) => set({ visualSource: v })} options={VISUAL_SOURCES.filter((v) => !v.value.startsWith("ai_video")).map((v) => ({ value: v.value, label: v.label }))} />
          </div>
          {s.visualSource !== "stock_videos" && <div><span className="mb-2 block text-sm text-ink-2">Visual style</span><StylePicker value={s.imageStyle} onChange={(v) => set({ imageStyle: v })} /></div>}
          <details className="rounded-xl border border-line p-3"><summary className="cursor-pointer text-[14px] font-medium">Advanced settings (optional)</summary>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Sel label="Look" value={s.look} onChange={(v) => set({ look: v })} options={LOOKS.map((l) => ({ value: l.id, label: l.name }))} />
            <Sel label="Voice style" value={s.voiceStyle} onChange={(v) => set({ voiceStyle: v })} options={VOICE_STYLES.map((v) => ({ value: v, label: v }))} />
            <Sel label="Music" value={s.musicStyle} onChange={(v) => set({ musicStyle: v })} options={MUSIC_STYLES.map((m) => ({ value: m, label: m }))} />
            <Sel label="Captions" value={s.captionsEnabled ? s.captionStyle : "off"} onChange={(v) => set(v === "off" ? { captionsEnabled: false } : { captionsEnabled: true, captionStyle: v })} options={[{ value: "off", label: "Off" }, ...CAPTION_STYLES.map((c) => ({ value: c, label: c }))]} />
            <Sel label="Quality" value={s.outputQuality} onChange={(v) => set({ outputQuality: v })} options={OUTPUT_QUALITIES.map((q) => ({ value: q.value, label: q.label }))} />
            <div className="md:col-span-3"><VoicePicker value={s.voiceId} onChange={(v) => set({ voiceId: v })} /></div>
          </div></details>
          <p className="text-xs text-ink-3">AI video for every shot and character stories are per-video features — use the single Create flow for those.</p>
        </div>
        {error && <p className="text-sm text-danger">{error} {upgrade && <a href="/billing" className="underline">See plans</a>}</p>}
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-2xl border border-line bg-panel p-5 text-[14px]">
          <div className="mb-3 text-[15px] font-semibold">3. Create projects</div>
          <input className="field mb-3" placeholder="Batch name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <dl className="space-y-1.5 text-ink-2">
            <div className="flex justify-between"><dt className="text-ink-3">Videos</dt><dd>{rows.length}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Format</dt><dd className="text-right">{findTemplate(videoType)?.name}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Each</dt><dd>{DURATION_OPTIONS.find((d) => d.seconds === s.targetDuration)?.label} · {s.language}</dd></div>
            {est && <div className="flex justify-between"><dt className="text-ink-3">Credits</dt><dd>{est.per} × {rows.length} = <span className="text-ink">{est.total}</span></dd></div>}
            {est?.balance != null && <div className="flex justify-between"><dt className="text-ink-3">Balance</dt><dd className={est.balance < est.total ? "text-warning" : ""}>{est.balance.toLocaleString()}</dd></div>}
          </dl>
          {est && <div className="mt-2 flex justify-between text-ink-2"><span className="text-ink-3">Est. render time</span><span>~{Math.ceil(rows.length * (2 + s.targetDuration / 60 * (s.visualSource === "stock_videos" ? 1.5 : 3)) / 3)} min</span></div>}
          <button className="btn-gradient mt-4 flex w-full items-center justify-center gap-2" disabled={busy || rows.length === 0} onClick={start}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} Start {rows.length || ""} video{rows.length === 1 ? "" : "s"}</button>
          <p className="mt-2 text-xs text-ink-3">Credits are reserved per video and settled as each one finishes.</p>
        </div>
      </aside>
    </div>
  );
}
