"use client";

import { useEffect, useState } from "react";
import { Palette, Save } from "lucide-react";
import { VISUAL_STYLES, CAPTION_STYLES, VOICE_STYLES, LOOKS, LOGO_POSITIONS } from "@vidforge/shared";
import LogoUpload, { type LogoValue } from "@/components/LogoUpload";
import VoicePicker from "@/components/VoicePicker";

export type BrandKit = { logoUrl: string | null; logoPath: string | null; logoPosition: string; brandColor: string; accentColor: string; voiceId: string; voiceStyle: string; imageStyle: string; captionStyle: string; look: string; intro: string; outro: string };
const DEFAULT: BrandKit = { logoUrl: null, logoPath: null, logoPosition: "top_right", brandColor: "#6C4CFF", accentColor: "#FFB648", voiceId: "", voiceStyle: "Professional", imageStyle: "cinematic_photo", captionStyle: "YouTube Clean", look: "auto", intro: "", outro: "" };

/** Brand defaults applied to every new video (logo, colours, voice, style, captions, look, intro/outro lines). */
export default function BrandKitEditor({ compact = false }: { compact?: boolean }) {
  const [kit, setKit] = useState<BrandKit>(DEFAULT); const [msg, setMsg] = useState<string | null>(null); const [loaded, setLoaded] = useState(false);
  useEffect(() => { fetch("/api/brand-kit").then((r) => r.json()).then((d) => { if (d.brandKit) setKit({ ...DEFAULT, ...d.brandKit }); setLoaded(true); }); }, []);
  const set = (p: Partial<BrandKit>) => setKit({ ...kit, ...p });
  const Sel = ({ label, k, options }: { label: string; k: keyof BrandKit; options: { value: string; label: string }[] }) => <label className="block text-[14px]"><span className="mb-1 block text-ink-2">{label}</span><select className="field" value={String(kit[k])} onChange={(e) => set({ [k]: e.target.value } as Partial<BrandKit>)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  if (!loaded) return <div className="skeleton h-64" />;
  return (
    <div className={`grid gap-6 ${compact ? "lg:grid-cols-[1fr_300px]" : "lg:grid-cols-[1fr_360px]"}`}>
      <div className="space-y-5 rounded-2xl border border-line bg-panel p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Palette size={16} /> Brand kit</h2>
        <LogoUpload value={{ logoUrl: kit.logoUrl, logoPath: kit.logoPath, logoPosition: kit.logoPosition } as LogoValue} onChange={(v: LogoValue) => set({ logoUrl: v.logoUrl, logoPath: v.logoPath, logoPosition: v.logoPosition })} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-[14px]"><span className="mb-1 block text-ink-2">Brand colour</span><div className="flex gap-2"><input type="color" className="field h-[44px] w-16 p-1" value={kit.brandColor} onChange={(e) => set({ brandColor: e.target.value })} /><input className="field" value={kit.brandColor} onChange={(e) => set({ brandColor: e.target.value })} /></div></label>
          <label className="block text-[14px]"><span className="mb-1 block text-ink-2">Accent colour (thumbnail highlight, banners)</span><div className="flex gap-2"><input type="color" className="field h-[44px] w-16 p-1" value={kit.accentColor} onChange={(e) => set({ accentColor: e.target.value })} /><input className="field" value={kit.accentColor} onChange={(e) => set({ accentColor: e.target.value })} /></div></label>
          <div className="md:col-span-2"><VoicePicker label="Default voice" value={kit.voiceId} onChange={(id) => set({ voiceId: id })} /></div>
          <Sel label="Default voice style" k="voiceStyle" options={VOICE_STYLES.map((v) => ({ value: v, label: v }))} />
          <Sel label="Default visual style" k="imageStyle" options={VISUAL_STYLES.map((s) => ({ value: s.id, label: s.name }))} />
          <Sel label="Caption style" k="captionStyle" options={CAPTION_STYLES.map((c) => ({ value: c, label: c }))} />
          <Sel label="Finishing look" k="look" options={LOOKS.map((l) => ({ value: l.id, label: l.name }))} />
          <Sel label="Logo position" k="logoPosition" options={LOGO_POSITIONS.map((p) => ({ value: p.value, label: p.label }))} />
          <label className="block text-[14px] md:col-span-2"><span className="mb-1 block text-ink-2">Intro line (spoken at the start, optional)</span><input className="field" placeholder="Welcome back to the channel." value={kit.intro} onChange={(e) => set({ intro: e.target.value })} /></label>
          <label className="block text-[14px] md:col-span-2"><span className="mb-1 block text-ink-2">Outro line / CTA (spoken at the end, optional)</span><input className="field" placeholder="Subscribe for a new video every week." value={kit.outro} onChange={(e) => set({ outro: e.target.value })} /></label>
        </div>
        <div className="flex items-center gap-3"><button className="btn-gradient flex items-center gap-2 text-[14px]" onClick={async () => { const r = await fetch("/api/brand-kit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kit) }); setMsg(r.ok ? "Saved. New videos will use these defaults." : "Could not save."); }}><Save size={16} /> Save brand kit</button>{msg && <span className="text-[13px] text-ink-3">{msg}</span>}</div>
      </div>
      <aside className="rounded-2xl border border-line bg-panel p-5 lg:sticky lg:top-20 lg:self-start">
        <div className="text-[12px] uppercase tracking-wide text-ink-3">Preview</div>
        <div className="relative mt-3 aspect-video overflow-hidden rounded-xl bg-cover bg-center" style={{ backgroundImage: "url(/assets/y2ube/gen/output_demo.jpg)" }}>
          {kit.logoUrl && <img src={kit.logoUrl} alt="" className={`absolute h-8 w-auto ${kit.logoPosition.includes("top") ? "top-2" : "bottom-8"} ${kit.logoPosition.includes("right") ? "right-2" : "left-2"}`} />}
          <div className="absolute inset-x-0 top-0 flex h-[12%] items-center justify-center bg-black/85 text-[11px] font-bold text-white"><span style={{ color: kit.accentColor }}>₹8000</span>&nbsp;में 10 Ads Videos</div>
          <div className="absolute inset-x-4 bottom-2 rounded bg-black/60 px-2 py-0.5 text-center text-[10px] text-white">{kit.outro || "Captions in your chosen style"}</div>
        </div>
        <p className="mt-3 text-[13px] text-ink-3">The Create form starts from these values; you can still change anything per video.</p>
      </aside>
    </div>
  );
}
