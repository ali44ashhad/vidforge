"use client";

import { useState } from "react";
import { Loader2, Youtube } from "lucide-react";
import type { Kit } from "./PublishKit";

export default function YouTubeUpload({ projectId, kit, connected, existing }: { projectId: string; kit: Kit | null; connected: boolean; existing?: { url: string; privacy?: string } | null }) {
  const [title, setTitle] = useState(kit?.titles?.[0] ?? "");
  const [description, setDescription] = useState(kit?.description ?? "");
  const [privacy, setPrivacy] = useState("private");
  const [publishAt, setPublishAt] = useState("");
  const [thumb, setThumb] = useState(kit?.thumbnails?.[0]?.url ?? "");
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<{ url: string } | null>(existing ?? null); const [error, setError] = useState<string | null>(null);

  if (!connected) return <div className="panel mt-6 p-5 text-sm"><div className="flex items-center gap-2 font-medium"><Youtube size={18} className="text-danger" /> Upload to YouTube</div><p className="mt-1 text-ink-3">Connect your channel in <a href="/settings" className="underline">Settings</a> to publish directly from here.</p></div>;

  async function upload() {
    setBusy(true); setError(null);
    const r = await fetch(`/api/projects/${projectId}/youtube`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description, tags: kit?.tags ?? [], privacy, publishAt: publishAt ? new Date(publishAt).toISOString() : null, thumbnailUrl: thumb || null }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error ?? "Upload failed"); return; }
    setResult({ url: d.url });
  }
  return (
    <div className="panel mt-6 p-5">
      <div className="flex items-center gap-2 font-medium"><Youtube size={18} className="text-danger" /> Upload to YouTube</div>
      {result ? (
        <p className="mt-2 text-sm">Uploaded: <a href={result.url} target="_blank" rel="noreferrer" className="text-accent underline">{result.url}</a> {publishAt ? "(scheduled)" : `(${privacy})`}. You can upload again to create another copy.</p>
      ) : null}
      <div className="mt-3 grid gap-3">
        <label className="text-sm"><span className="mb-1 block text-ink-2">Title</span>{kit?.titles?.length ? <select className="field mb-2" value={title} onChange={(e) => setTitle(e.target.value)}>{kit.titles.map((t) => <option key={t}>{t}</option>)}</select> : null}<input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} /></label>
        <label className="text-sm"><span className="mb-1 block text-ink-2">Description</span><textarea className="field" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm"><span className="mb-1 block text-ink-2">Visibility</span><select className="field" value={privacy} onChange={(e) => setPrivacy(e.target.value)}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></label>
          <label className="text-sm"><span className="mb-1 block text-ink-2">Schedule (optional)</span><input type="datetime-local" className="field" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block text-ink-2">Thumbnail</span><select className="field" value={thumb} onChange={(e) => setThumb(e.target.value)}><option value="">None (YouTube auto)</option>{(kit?.thumbnails ?? []).map((t, i) => <option key={t.url} value={t.url}>Thumbnail {i + 1} — {t.text}</option>)}</select></label>
        </div>
        {publishAt && <p className="text-xs text-ink-3">Scheduled videos are uploaded as private and go public at the chosen time.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary flex w-fit items-center gap-2" onClick={upload} disabled={busy || !title}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Youtube size={16} />} {busy ? "Uploading…" : "Upload to YouTube"}</button>
      </div>
    </div>
  );
}
