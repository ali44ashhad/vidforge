"use client";

import { useState } from "react";

export default function YouTubeConnect({ conn }: { conn: { channelTitle: string; thumbnail?: string; connectedAt: string } | null }) {
  const [busy, setBusy] = useState(false);
  if (!conn) return <a className="btn-primary inline-flex" href="/api/youtube/connect">Connect YouTube channel</a>;
  return (
    <div className="flex items-center gap-3">
      {conn.thumbnail && <img src={conn.thumbnail} alt="" className="h-10 w-10 rounded-full" />}
      <div className="flex-1 text-sm"><div className="font-medium">{conn.channelTitle}</div><div className="text-xs text-ink-3">Connected {new Date(conn.connectedAt).toLocaleDateString()}</div></div>
      <button className="btn-ghost text-sm" disabled={busy} onClick={async () => { setBusy(true); await fetch("/api/youtube/disconnect", { method: "POST" }); window.location.reload(); }}>Disconnect</button>
    </div>
  );
}
