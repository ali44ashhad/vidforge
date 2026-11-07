"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose} role="dialog" aria-label={title}>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between text-sm text-white"><span>{title}</span><button onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-white/10"><X size={20} /></button></div>
        <video src={url} controls autoPlay playsInline className="aspect-video w-full rounded-xl bg-black" />
      </div>
    </div>
  );
}
