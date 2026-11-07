"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";

type K = { id: string; name: string; prefix: string; lastUsedAt: string | null; createdAt: string };

export default function ApiKeysPanel() {
  const [keys, setKeys] = useState<K[]>([]); const [secret, setSecret] = useState<string | null>(null); const [name, setName] = useState(""); const [err, setErr] = useState<string | null>(null);
  const load = () => fetch("/api/keys").then((r) => r.json()).then((d) => setKeys(d.keys ?? []));
  useEffect(() => { load(); }, []);
  async function create() { setErr(null); const r = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); const d = await r.json(); if (!r.ok) { setErr(d.error); return; } setSecret(d.secret); setName(""); load(); }
  const base = typeof window !== "undefined" ? window.location.origin : "https://app.y2ube.io";
  return (
    <div className="space-y-6">
      <div><h2 className="text-[15px] font-semibold">API keys</h2><p className="mt-1 text-[14px] text-ink-2">Create videos from your own scripts, tools or n8n. Keys are shown once.</p></div>
      <div className="panel p-5">
        <div className="flex gap-2"><input className="field" placeholder="Key name (e.g. n8n automation)" value={name} onChange={(e) => setName(e.target.value)} /><button className="btn-primary flex items-center gap-2 whitespace-nowrap" onClick={create}><KeyRound size={16} /> Create key</button></div>
        {err && <p className="mt-2 text-sm text-danger">{err} {err.includes("Pro") && <a href="/billing" className="underline">See plans</a>}</p>}
        {secret && <div className="mt-3 rounded-lg border border-warning/50 bg-warning/5 p-3 text-sm"><div className="text-warning">Copy this key now — it won't be shown again.</div><div className="mt-1 flex items-center gap-2 font-mono text-xs"><code className="break-all">{secret}</code><button onClick={() => navigator.clipboard.writeText(secret)} title="Copy"><Copy size={14} /></button></div></div>}
        <ul className="mt-4 divide-y divide-line text-sm">{keys.map((k) => <li key={k.id} className="flex items-center justify-between py-2"><div><div className="font-medium">{k.name}</div><div className="text-xs text-ink-3"><span className="font-mono">{k.prefix}…</span> · created {new Date(k.createdAt).toLocaleDateString()}{k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}` : " · never used"}</div></div><button className="text-ink-3 hover:text-danger" title="Revoke" onClick={async () => { if (confirm("Revoke this key?")) { await fetch(`/api/keys/${k.id}`, { method: "DELETE" }); load(); } }}><Trash2 size={16} /></button></li>)}{keys.length === 0 && <li className="py-2 text-ink-3">No keys yet.</li>}</ul>
      </div>
      <div className="panel p-5 text-sm">
        <h2 className="font-medium">Quick start</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-panel-2 p-3 text-xs">{`# create a video
curl -X POST ${base}/api/v1/projects \\
  -H "Authorization: Bearer y2_YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{"prompt":"5 morning habits that changed my life","targetDuration":60,"videoType":"YouTube Video","language":"English","visualSource":"mixed"}'
# → {"id":"…","status":"QUEUED","creditsReserved":18,"url":"…"}

# poll until status is COMPLETED (finalVideoUrl, thumbnailUrl, seo)
curl ${base}/api/v1/projects/PROJECT_ID -H "Authorization: Bearer y2_YOUR_KEY"`}</pre>
        <p className="mt-2 text-xs text-ink-3">Any field from the Create form is accepted (aspectRatio R16_9 / R9_16, imageStyle, look, musicStyle, captionsEnabled, voiceId, characters…). Credits are reserved on create and settled on completion.</p>
      </div>
    </div>
  );
}
