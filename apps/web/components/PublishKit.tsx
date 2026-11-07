"use client";

import { useState } from "react";
import { Copy, Check, Download, RefreshCw, Loader2 } from "lucide-react";

export type Kit = {
  titles: string[]; description: string; tags: string[]; hashtags: string[]; thumbnailTexts: string[]; thumbnailHighlightWords?: string[]; pinnedComment?: string;
  chapters: { time: string; title: string }[]; backgrounds?: { url: string }[]; thumbnails: { url: string; text: string; highlight?: string; bg?: number }[]; generatedAt: string;
};

export default function PublishKit({ projectId, kit, slug }: { projectId: string; kit: Kit | null; slug: string }) {
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(0);
  const [picks, setPicks] = useState<{ bg: number; text: string; highlight: string }[]>(() =>
    (kit?.thumbnails?.length ? kit.thumbnails.map((t) => ({ bg: t.bg ?? 0, text: t.text, highlight: t.highlight ?? "" })) : [{ bg: 0, text: kit?.thumbnailTexts?.[0] ?? "", highlight: kit?.thumbnailHighlightWords?.[0] ?? "" }]));
  const [rendering, setRendering] = useState(false);

  async function renderThumbs() {
    setRendering(true);
    await fetch(`/api/projects/${projectId}/thumbnails`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: picks }) });
    window.location.reload();
  }
  const setPick = (i: number, patch: Partial<{ bg: number; text: string; highlight: string }>) => setPicks(picks.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  async function regenerate() {
    setBusy(true);
    await fetch(`/api/projects/${projectId}/publish-kit`, { method: "POST" });
    window.location.reload();
  }

  if (!kit) {
    return (
      <div className="panel mt-8 p-5">
        <h2 className="text-lg font-semibold">Publish kit</h2>
        <p className="mt-1 text-sm text-ink-3">Titles, description, tags and thumbnails are generated at the end of every run. This project doesn't have one yet.</p>
        <button className="btn-ghost mt-4 flex items-center gap-2" onClick={regenerate} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Generate publish kit</button>
      </div>
    );
  }

  return (
    <div className="panel mt-8 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Publish kit</h2>
        <button className="btn-ghost flex items-center gap-2 text-sm" onClick={regenerate} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regenerate</button>
      </div>

      <h3 className="mt-5 text-sm font-medium text-ink-2">Title — pick one</h3>
      <div className="mt-2 space-y-2">
        {kit.titles.map((t, i) => (
          <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${title === i ? "border-accent" : "border-line"}`}>
            <input type="radio" checked={title === i} onChange={() => setTitle(i)} />
            <span className="flex-1">{t}</span>
            <span className="text-xs text-ink-3">{t.length} chars</span>
            <CopyBtn text={t} />
          </label>
        ))}
      </div>

      <Field label="Description" text={kit.description} rows={10} />
      <Field label={`Tags (${kit.tags.join(", ").length} chars)`} text={kit.tags.join(", ")} rows={3} />
      <Field label="Hashtags" text={kit.hashtags.join(" ")} rows={1} />
      {kit.pinnedComment && <Field label="Pinned comment" text={kit.pinnedComment} rows={2} />}

      {(kit.backgrounds?.length ?? 0) > 0 && (
        <div className="mt-6 rounded-xl border border-line p-4">
          <h3 className="text-sm font-medium text-ink-2">Thumbnail text — pick or write the hook, then render</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {kit.thumbnailTexts.map((t, i) => (
              <button key={i} type="button" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent"
                onClick={() => setPick(picks.length - 1, { text: t, highlight: kit.thumbnailHighlightWords?.[i] ?? "" })}>{t}</button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {picks.map((p, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_180px_140px_auto]">
                <input className="field" placeholder="Thumbnail text (2-4 words)" value={p.text} onChange={(e) => setPick(i, { text: e.target.value })} />
                <input className="field" placeholder="Yellow word" value={p.highlight} onChange={(e) => setPick(i, { highlight: e.target.value })} />
                <select className="field" value={p.bg} onChange={(e) => setPick(i, { bg: Number(e.target.value) })}>
                  {kit.backgrounds!.map((_, b) => <option key={b} value={b}>Background {b + 1}</option>)}
                </select>
                <button type="button" className="btn-ghost px-3" onClick={() => setPicks(picks.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            {picks.length < 4 && <button type="button" className="text-sm text-ink-2 hover:text-ink" onClick={() => setPicks([...picks, { bg: Math.min(1, kit.backgrounds!.length - 1), text: "", highlight: "" }])}>+ Add another variant</button>}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button className="btn-primary flex items-center gap-2" onClick={renderThumbs} disabled={rendering || picks.every((p) => !p.text.trim())}>{rendering ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Render thumbnails</button>
            <div className="flex gap-2">{kit.backgrounds!.map((b, i) => <img key={i} src={b.url} alt={`Background ${i + 1}`} className="h-10 rounded border border-line" title={`Background ${i + 1}`} />)}</div>
          </div>
        </div>
      )}
      {kit.thumbnails.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-medium text-ink-2">Thumbnails</h3>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            {kit.thumbnails.map((t, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-line">
                <img src={t.url} alt={t.text} className="w-full" />
                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-ink-2">"{t.text}"</span>
                  <a className="btn-ghost flex items-center gap-2 px-3 py-1.5 text-xs" href={`${t.url}?download=${encodeURIComponent(slug)}-thumbnail-${i + 1}.jpg`}><Download size={14} /> Download</a>
                </div>
              </div>
            ))}
          </div>

        </>
      )}
    </div>
  );
}

function Field({ label, text, rows }: { label: string; text: string; rows: number }) {
  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center justify-between"><span className="text-sm font-medium text-ink-2">{label}</span><CopyBtn text={text} /></div>
      <textarea className="field text-sm" rows={rows} readOnly value={text} />
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="rounded-md p-1.5 text-ink-3 hover:bg-panel-2 hover:text-ink" title="Copy"
      onClick={async (e) => { e.preventDefault(); await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? <Check size={16} className="text-ok" /> : <Copy size={16} />}
    </button>
  );
}
