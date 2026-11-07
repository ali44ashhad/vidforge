"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

export default function ProjectMenu({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false); const router = useRouter();
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  async function rename(e: React.MouseEvent) { stop(e); const t = prompt("New title:", title); if (!t) return; await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t }) }); router.refresh(); setOpen(false); }
  async function del(e: React.MouseEvent) { stop(e); if (!confirm(`Delete "${title}"? The video and its files are removed. This can't be undone.`)) return; const r = await fetch(`/api/projects/${id}`, { method: "DELETE" }); if (!r.ok) alert((await r.json()).error ?? "Could not delete"); router.refresh(); setOpen(false); }
  return (
    <div className="absolute right-2 top-2 z-10" onClick={stop}>
      <button className="rounded-md bg-black/60 p-1 text-white hover:bg-black/80" onClick={(e) => { stop(e); setOpen(!open); }} aria-label="Project menu"><MoreHorizontal size={16} /></button>
      {open && (
        <div className="mt-1 w-36 overflow-hidden rounded-lg border border-line bg-panel text-sm shadow-md">
          <button className="block w-full px-3 py-2 text-left hover:bg-panel-2" onClick={rename}>Rename</button>
          <button className="block w-full px-3 py-2 text-left hover:bg-panel-2" onClick={(e) => { stop(e); router.push(`/create?from=${id}`); }}>Duplicate</button>
          <button className="block w-full px-3 py-2 text-left text-danger hover:bg-panel-2" onClick={del}>Delete</button>
        </div>
      )}
    </div>
  );
}
