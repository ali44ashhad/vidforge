"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/** Muted autoplay loop inside the page (no external player); tap the speaker to unmute. */
export default function InlineVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [touched, setTouched] = useState(false);
  useEffect(() => { const v = ref.current; if (!v) return; v.muted = true; v.play().catch(() => {}); }, [src]);
  async function toggle() {
    const v = ref.current; if (!v) return;
    const next = !muted;
    v.muted = next; v.volume = 1; v.defaultMuted = next;
    if (!next) { try { await v.play(); } catch { v.currentTime = 0; await v.play().catch(() => {}); } }
    setMuted(next); setTouched(true);
  }
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line-2 shadow-md">
      <video ref={ref} src={src} poster={poster} autoPlay muted loop playsInline preload="auto" controls={touched} aria-label={label} className="aspect-video w-full bg-black object-cover" />
      <button type="button" onClick={toggle} className={`absolute right-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur transition hover:bg-black/80 ${touched ? "top-3" : "bottom-3"}`} aria-label={muted ? "Unmute" : "Mute"}>
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? "Sound on" : "Mute"}
      </button>
    </div>
  );
}
