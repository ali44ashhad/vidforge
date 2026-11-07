"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Wand2, Sparkles } from "lucide-react";
import { ASPECT_RATIOS, DURATION_OPTIONS, LANGUAGES, VISUAL_STYLES, VOICE_STYLES, VISUAL_SOURCES, MUSIC_STYLES, CAPTION_STYLES, OUTPUT_QUALITIES, DEFAULT_MIX, findTemplate, type MixSettings, type CharacterInput } from "@vidforge/shared";
import CharacterEditor from "./CharacterEditor";
import StylePicker from "./StylePicker";
import LookPicker from "./LookPicker";
import ReferenceImages from "./ReferenceImages";
import PresenterPicker, { PRESENTER_DEFAULT, type PresenterValue } from "./PresenterPicker";
import EstimateCard from "./EstimateCard";
import TypePicker from "./TypePicker";
import type { ReferenceImage } from "@vidforge/shared";
import AudioMixControls from "./AudioMixControls";
import VoicePicker from "./VoicePicker";
import LogoUpload, { type LogoValue } from "./LogoUpload";


export default function CreateVideoForm({ promptLimit = 2000, planName = "Free" }: { promptLimit?: number; planName?: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [targetDuration, setTargetDuration] = useState(300);
  const [aspectRatio, setAspectRatio] = useState("R16_9");
  const [videoType, setVideoType] = useState("YouTube Video");
  const [language, setLanguage] = useState("English");
  const [voiceStyle, setVoiceStyle] = useState("Professional");
  const [voiceId, setVoiceId] = useState("");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [visualSource, setVisualSource] = useState("mixed");
  const [imageStyle, setImageStyle] = useState<string>("cinematic_photo");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicStyle, setMusicStyle] = useState("Auto");
  const [musicCustomPrompt, setMusicCustomPrompt] = useState("");
  const [mix, setMix] = useState<MixSettings>(DEFAULT_MIX);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [captionStyle, setCaptionStyle] = useState("YouTube Clean");
  const [cta, setCta] = useState("");
  const [logo, setLogo] = useState<LogoValue>({ logoUrl: null, logoPath: null, logoPosition: "top_right" });
  const [characters, setCharacters] = useState<CharacterInput[]>([]);
  const [characterCount, setCharacterCount] = useState(2);
  const [characterVoices, setCharacterVoices] = useState(true);
  const [storyStyle, setStoryStyle] = useState<string>("storybook");
  const [allowStockFallback, setAllowStockFallback] = useState(false);
  const [scriptVerbatim, setScriptVerbatim] = useState(false);
  const [outputQuality, setOutputQuality] = useState("1080p");
  const [aiVideoResolution, setAiVideoResolution] = useState("720p");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [look, setLook] = useState("auto");
  const [presenter, setPresenter] = useState<PresenterValue>(PRESENTER_DEFAULT);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [banners, setBanners] = useState({ top: "", topHighlight: "", bottom: "", color: "#FF7A00" });
  const [speechMode, setSpeechMode] = useState<"tts" | "veo_native">("tts");
  const [step, setStep] = useState(0);
  const [prefilled, setPrefilled] = useState<string | null>(null);

  // "Duplicate": /create?from=<projectId> prefills every setting from that project
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const promptQ = qs.get("prompt");
    const type = qs.get("type"); if (type && findTemplate(type)) applyTemplate(type, { starter: !promptQ });
    if (promptQ) setPrompt(promptQ);
    const from = qs.get("from");
    if (!from) {
      // brand kit defaults
      fetch("/api/brand-kit").then((r) => r.json()).then((d) => { const k = d.brandKit; if (!k) return;
        if (k.logoUrl) setLogo({ logoUrl: k.logoUrl, logoPath: k.logoPath, logoPosition: k.logoPosition || "top_right" });
        if (k.voiceId) setVoiceId(k.voiceId); if (k.voiceStyle) setVoiceStyle(k.voiceStyle); if (k.captionStyle) setCaptionStyle(k.captionStyle);
        if (k.look) setLook(k.look); if (k.imageStyle && !type) setImageStyle(k.imageStyle); if (k.accentColor) setBanners((b) => ({ ...b, color: k.accentColor }));
        if (k.outro) setCta(k.outro);
      }).catch(() => {});
      return;
    }
    fetch(`/api/projects/${from}/duplicate`).then((r) => r.json()).then((d) => {
      const s = d.settings; if (!s) return;
      setPrompt(s.prompt ?? ""); setScriptVerbatim(!!s.scriptVerbatim); setTargetDuration(s.targetDuration ?? 60); setAspectRatio(s.aspectRatio ?? "R16_9"); setVideoType(s.videoType ?? "YouTube Video");
      setLanguage(s.language ?? "English"); setVisualSource(s.visualSource ?? "mixed"); setImageStyle(s.imageStyle ?? "cinematic_photo"); setStoryStyle(s.imageStyle ?? "storybook");
      setVoiceStyle(s.voiceStyle ?? "Professional"); setVoiceId(s.voiceId ?? ""); setVoiceSpeed(s.voiceSpeed ?? 1); setCaptionsEnabled(!!s.captionsEnabled); setCaptionStyle(s.captionStyle ?? "YouTube Clean");
      setMusicEnabled(!!s.musicEnabled); setMusicStyle(s.musicStyle ?? "Auto"); setMusicCustomPrompt(s.musicCustomPrompt ?? ""); setMix(s.mixSettings ?? DEFAULT_MIX); setCta(s.cta ?? "");
      setOutputQuality(s.outputQuality ?? "1080p"); setAiVideoResolution(s.aiVideoResolution ?? "720p"); setVoiceEnabled(s.voiceEnabled !== false); setTextOverlaysEnabled(s.textOverlaysEnabled !== false);
      setLook(s.look ?? "auto"); setLookIntensity(s.lookIntensity ?? 70); setReferenceImages(s.referenceImages ?? []); if (s.banners) setBanners(s.banners);
      setNarrationMode(s.storyMode ? (s.narratorEnabled === false ? "characters_only" : "characters") : "narrator"); setCharacters(s.characters ?? []); setCharacterCount(s.characterCount ?? 2); setSpeechMode(s.speechMode ?? "tts");
      if (s.logoUrl) setLogo({ logoUrl: s.logoUrl, logoPath: s.logoPath, logoPosition: s.logoPosition });
      if (s.presenterMode === "ai") setPresenter({ presenterMode: "ai", presenterImageUrl: s.presenterImageUrl, presenterImagePath: s.presenterImagePath, presenterPosition: s.presenterPosition ?? "bottom_left", presenterSize: s.presenterSize ?? 34, presenterRing: s.presenterRing ?? "#6C4CFF", presenterShape: s.presenterShape === "cutout" ? "cutout" : "circle" });
      setPrefilled(s.title ?? "previous video");
    }).catch(() => {});
  }, []);
  const [lookIntensity, setLookIntensity] = useState(70);
  const [textOverlaysEnabled, setTextOverlaysEnabled] = useState(true);
  const isAiVideo = visualSource.startsWith("ai_video");
  const [narrationMode, setNarrationMode] = useState<"narrator" | "characters" | "characters_only">("narrator");
  const isKids = videoType === "Kids Story";
  const template = findTemplate(videoType);

  /** Selecting a format applies its recommended settings (all still editable). */
  function applyTemplate(id: string, opts: { starter?: boolean } = {}) {
    setVideoType(id);
    const t = findTemplate(id); if (!t) return;
    if ((opts.starter || !prompt.trim()) && t.starter) setPrompt(t.starter);
    const d = t.defaults;
    if (d.aspectRatio) setAspectRatio(d.aspectRatio);
    setVisualSource(d.visualSource); setImageStyle(d.style); setStoryStyle(d.style);
    setLook(d.look); setLookIntensity(d.lookIntensity);
    setMusicStyle(d.musicStyle); setMusicEnabled(true);
    setCaptionsEnabled(d.captionsEnabled); setCaptionStyle(d.captionStyle);
    setVoiceStyle(d.voiceStyle); setVoiceEnabled(d.voiceEnabled); if (d.voiceId) setVoiceId(d.voiceId);
    setNarrationMode(d.narrationMode as "narrator" | "characters" | "characters_only"); setTextOverlaysEnabled(d.textOverlays);
    if (d.durationSeconds) setTargetDuration(d.durationSeconds);
  }
  const isStory = narrationMode !== "narrator" || isKids;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    const res = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt, targetDuration, aspectRatio, videoType, language, voiceStyle, voiceId, voiceSpeed,
        // characters/story mode needs AI visuals; keep an AI-video choice, otherwise fall back to AI images
        visualSource: isStory && !visualSource.startsWith("ai_video") ? "ai_images" : visualSource, imageStyle: isStory ? storyStyle : imageStyle,
        musicEnabled, musicStyle: isStory && musicStyle === "Auto" ? "Ambient" : musicStyle, musicCustomPrompt, mixSettings: mix,
        captionsEnabled, captionStyle, cta, ...logo,
        characters, characterCount, characterVoices, allowStockFallback, scriptVerbatim, narrationMode: isStory ? (narrationMode === "characters_only" ? "characters_only" : "characters") : "narrator",
        outputQuality, aiVideoResolution, voiceEnabled, textOverlaysEnabled, look, lookIntensity, referenceImages, ...presenter,
        banners: banners.top || banners.bottom ? banners : null,
        speechMode: isAiVideo && isStory ? speechMode : "tts",
      }),
    }).catch((e) => { setError(`Network error: ${(e as Error).message}`); setBusy(false); return null; });
    if (!res) return;
    if (res.status === 401) { window.location.href = "/login?next=/create"; return; }
    const text = await res.text();
    let data: { error?: string; project?: { id: string } } = {};
    try { data = JSON.parse(text); } catch { /* non-JSON (e.g. a platform 500/504 page) */ }
    if (!res.ok || !data.project) { setError(data.error ?? `The server returned ${res.status}${text && !data.error ? `: ${text.replace(/<[^>]+>/g, " ").trim().slice(0, 160)}` : ""}`); setBusy(false); return; }
    router.push(`/projects/${data.project.id}`);
  }

  const vs = VISUAL_SOURCES.find((v) => v.value === visualSource);

  const steps = ["Idea & Format", "Look & Voice", "Characters & References", "Review & Generate"];
  const showStep3 = isStory || visualSource !== "stock_videos";
  const estimateSettings = { presenter: presenter.presenterMode === "ai", targetDuration, visualSource: isStory && !visualSource.startsWith("ai_video") ? "ai_images" : visualSource, aiVideoResolution, musicEnabled, voiceEnabled, narrationMode: isStory ? "characters" : "narrator", characterCount: isStory ? Math.max(characters.length, characterCount) : 0 };
  const canGo = prompt.trim().length >= 8;
  const goto = (n: number) => { if (n === 2 && !showStep3) n = step < 2 ? 3 : 1; setStep(Math.max(0, Math.min(3, n))); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const SUGGESTIONS = ["History of AI", "How money works", "Luxury homes tour", "Top 10 travel", "Healthy habits"];
  const styleName = (id: string) => VISUAL_STYLES.find((x) => x.id === id)?.name ?? id;
  const voiceLabel = voiceId ? "Custom voice" : `Auto (${voiceStyle})`;
  const summary: [string, string][] = [
    ["Video type", template?.name ?? videoType], ["Duration", `${DURATION_OPTIONS.find((d) => d.seconds === targetDuration)?.label ?? `${targetDuration}s`} · ${aspectRatio === "R9_16" ? "9:16 Shorts" : "16:9 YouTube"}`], ["Language", language],
    ["Voice", voiceEnabled ? voiceLabel : "No voiceover"], ["Visual style", visualSource === "stock_videos" ? "Stock footage" : styleName(isStory ? storyStyle : imageStyle)], ["Visuals", vs?.label ?? visualSource],
    ["Look", look === "auto" ? "Auto (AI decides)" : look.replace(/_/g, " ")], ["Captions & text", [captionsEnabled && voiceEnabled && "captions", textOverlaysEnabled && "on-screen text"].filter(Boolean).join(", ") || "off"], ["Music", musicEnabled ? musicStyle : "off"], ["Quality", `${outputQuality}${isAiVideo ? ` · clips ${aiVideoResolution}` : ""}`], ...(presenter.presenterMode === "ai" ? ([["Presenter", `Face cam ${presenter.presenterSize}% ${presenter.presenterPosition.replace("_", " ")}`]] as [string, string][]) : []),
  ];
  const minutesEst = Math.ceil(2 + targetDuration / 60 * (isAiVideo ? 6 : visualSource === "stock_videos" ? 1.5 : 3));

  return (
    <div>
      {/* stepper */}
      <ol className="mb-7 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {steps.map((label, i) => { const disabled = i === 2 && !showStep3; const on = i === step; return (
          <li key={label} className="shrink-0">
            <button type="button" disabled={disabled || (!canGo && i > 0)} onClick={() => goto(i)} className={`flex min-h-[40px] items-center gap-2 rounded-xl border px-3.5 text-[13px] transition ${on ? "border-accent bg-accent/15 text-ink" : i < step ? "border-line text-ink-2" : "border-line text-ink-3"} disabled:opacity-40`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${on ? "bg-accent text-white" : i < step ? "bg-success/20 text-success" : "bg-white/8"}`}>{i < step ? "✓" : i + 1}</span>{label}
            </button>
          </li>); })}
      </ol>
      {prefilled && <p className="mb-4 rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-ink-2">Settings copied from “{prefilled}”. Change anything and generate.</p>}

      {/* ---------- 1 Idea & Format ---------- */}
      {step === 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div>
              <h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">What video do you want to create?</h1>
              <p className="mt-1 text-[15px] text-ink-2">Describe the topic, product or idea. You get a complete video, ready to upload.</p>
            </div>
            <div className="rounded-2xl border border-line bg-panel p-4">
              <textarea className="min-h-[150px] w-full resize-y bg-transparent text-[16px] leading-relaxed outline-none placeholder:text-ink-3" maxLength={promptLimit} placeholder="Create a 7-minute faceless documentary about how the internet changed the world. Include key milestones, real examples and a strong hook in the first 10 seconds." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <div className="flex items-center justify-between border-t border-line pt-3"><span className={`text-xs ${prompt.length >= promptLimit ? "text-warning" : "text-ink-3"}`}>{prompt.length.toLocaleString()}/{promptLimit.toLocaleString()} characters{prompt.length >= promptLimit && <> · <a href="/billing" className="underline">upgrade for longer scripts</a></>} · {planName} plan</span><button type="button" className="btn-gradient flex items-center gap-2 px-4 py-2 text-sm" disabled={!canGo || busy} onClick={submit} title="Generate now with the recommended settings for this video type">{busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Generate with AI</button></div>
            </div>
            <label className="flex items-center gap-2 text-[14px] text-ink-2"><input type="checkbox" checked={scriptVerbatim} onChange={(e) => setScriptVerbatim(e.target.checked)} /> This is my finished script — speak it word for word</label>
            <div><div className="mb-2 text-[13px] text-ink-3">Quick suggestions</div><div className="flex flex-wrap gap-2">{SUGGESTIONS.map((q) => <button key={q} type="button" className="rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 hover:border-accent hover:text-ink" onClick={() => setPrompt(q)}>{q}</button>)}</div></div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="col-span-2 md:col-span-1"><span className="mb-1 block text-[13px] text-ink-2">Video type</span><TypePicker value={videoType} onChange={applyTemplate} /></div>
              <Select label="Duration" value={String(targetDuration)} onChange={(v) => setTargetDuration(Number(v))} options={DURATION_OPTIONS.map((d) => ({ value: String(d.seconds), label: d.label }))} />
              <Select label="Format" value={aspectRatio} onChange={setAspectRatio} options={ASPECT_RATIOS.map((a) => ({ value: a.value, label: a.label }))} />
              <Select label="Language" value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Visuals" value={visualSource} onChange={setVisualSource} options={VISUAL_SOURCES.map((v) => ({ value: v.value, label: v.label }))} />
              <Select label="Narration" value={isKids && narrationMode === "narrator" ? "characters" : narrationMode} onChange={(v) => setNarrationMode(v as "narrator" | "characters" | "characters_only")} options={[{ value: "narrator", label: "Narrator only" }, { value: "characters", label: "Narrator + characters" }, { value: "characters_only", label: "Characters only (no narrator)" }]} />
            </div>
            {isStory ? <p className="text-[13px] text-ink-3">Characters mode: recurring characters are drawn consistently and each speaks with its own voice. Visuals: {visualSource.startsWith("ai_video") ? "AI video clips" : "AI images for every shot"}.</p> : vs && <p className="text-[13px] text-ink-3">{vs.hint}</p>}
            {isStory && isAiVideo && (
              <div className="rounded-xl border border-line p-3 text-[14px]"><div className="mb-1 text-ink-2">Speech</div>
                <label className="mr-5 inline-flex items-center gap-2"><input type="radio" checked={speechMode === "tts"} onChange={() => setSpeechMode("tts")} /> Our voices (TTS)</label>
                <label className="inline-flex items-center gap-2"><input type="radio" checked={speechMode === "veo_native"} onChange={() => setSpeechMode("veo_native")} /> Native speech — lip-synced by Veo</label>
                {speechMode === "veo_native" && <p className="mt-2 text-[12px] text-warning">Veo invents a new voice for every 8-second clip, so a character only sounds consistent in videos of one clip per speaker (≈ 8 s). Longer videos automatically use our voices instead.</p>}
              </div>
            )}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-line bg-panel p-4 text-[14px]">
              <div className="text-[12px] uppercase tracking-wide text-ink-3">Recommended for {template?.name ?? "this type"}</div>
              <p className="mt-1 text-ink-2">{template?.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{template && [template.defaults.visualSource.replace(/_/g, " "), styleName(template.defaults.style), template.defaults.look.replace(/_/g, " "), template.defaults.musicStyle].map((c) => <span key={c} className="chip">{c}</span>)}</div>
            </div>
            <EstimateCard settings={estimateSettings} />
          </aside>
        </div>
      )}

      {/* ---------- 2 Look & Voice ---------- */}
      {step === 1 && (
        <div>
          <h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Choose the look and voice</h1>
          <p className="mt-1 text-[15px] text-ink-2">Select visual style, voice, language and overall look for your video.</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {visualSource !== "stock_videos" ? (
                <div><div className="mb-3 text-[15px] font-semibold">Visual style</div><StylePicker value={isStory ? storyStyle : imageStyle} onChange={isStory ? setStoryStyle : setImageStyle} />
                  {(isStory || visualSource === "ai_images") && <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={allowStockFallback} onChange={(e) => setAllowStockFallback(e.target.checked)} /> If an AI image fails after 3 tries, use a stock photo instead of a title card</label>}
                </div>
              ) : <div className="rounded-2xl border border-line bg-panel p-5 text-[14px] text-ink-2">Stock footage is selected — visual style applies to AI images and video. Switch Visuals in step 1 to use a style.</div>}
              <details className="rounded-2xl border border-line bg-panel p-4"><summary className="cursor-pointer text-[14px] font-medium">Captions & on-screen text</summary>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 text-[14px]"><label className={`flex items-center gap-2 ${voiceEnabled ? "" : "opacity-40"}`}><input type="checkbox" checked={captionsEnabled && voiceEnabled} disabled={!voiceEnabled} onChange={(e) => setCaptionsEnabled(e.target.checked)} /> Burn captions into the video</label><label className="flex items-center gap-2"><input type="checkbox" checked={textOverlaysEnabled} onChange={(e) => setTextOverlaysEnabled(e.target.checked)} /> On-screen text (titles, labels)</label></div>
                  <Select label="Caption style" value={captionStyle} onChange={setCaptionStyle} options={CAPTION_STYLES.map((c) => ({ value: c, label: c }))} />
                </div>
              </details>
            </div>
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-2xl border border-line bg-panel p-4">
                <div className="text-[15px] font-semibold">Voice & language</div>
                <div className="mt-3 space-y-3">
                  <Select label="Language" value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
                  <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={voiceEnabled} onChange={(e) => { setVoiceEnabled(e.target.checked); if (!e.target.checked) setCaptionsEnabled(false); }} /> Voiceover</label>
                  {voiceEnabled && <>
                    <VoicePicker value={voiceId} onChange={setVoiceId} />
                    <Select label="Voice style" value={voiceStyle} onChange={setVoiceStyle} options={VOICE_STYLES.map((v) => ({ value: v, label: v }))} />
                    <label className="block text-[14px]"><span className="mb-1 flex justify-between text-ink-2"><span>Speed</span><span className="text-ink">{voiceSpeed.toFixed(2)}×</span></span><input type="range" className="w-full accent-accent" min={0.8} max={1.2} step={0.05} value={voiceSpeed} onChange={(e) => setVoiceSpeed(Number(e.target.value))} /><span className="flex justify-between text-[11px] text-ink-3"><span>0.8x</span><span>1.0x</span><span>1.2x</span></span></label>
                  </>}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-panel p-4">
                <label className="flex items-center justify-between text-[15px] font-semibold">Background music <input type="checkbox" checked={musicEnabled} onChange={(e) => setMusicEnabled(e.target.checked)} /></label>
                {musicEnabled && <div className="mt-3 space-y-3">
                  <Select label="Music style" value={musicStyle} onChange={setMusicStyle} options={MUSIC_STYLES.map((m) => ({ value: m, label: m }))} />
                  {musicStyle === "Custom" && <textarea className="field" rows={2} placeholder="Warm acoustic guitar, slow tempo, hopeful, no vocals" value={musicCustomPrompt} onChange={(e) => setMusicCustomPrompt(e.target.value)} />}
                  <AudioMixControls value={mix} onChange={setMix} musicEnabled={musicEnabled} onMusicEnabled={setMusicEnabled} />
                </div>}
              </div>
              <div className="rounded-2xl border border-line bg-panel p-4">
                <div className="text-[15px] font-semibold">Finishing look</div>
                <div className="mt-3"><LookPicker look={look} intensity={lookIntensity} onLook={setLook} onIntensity={setLookIntensity} /></div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* ---------- 3 Characters & References ---------- */}
      {step === 2 && showStep3 && (
        <div>
          <h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Characters & References</h1>
          <p className="mt-1 text-[15px] text-ink-2">Add characters, reference images or brand elements when needed.</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              {isStory && <div className="rounded-2xl border border-line bg-panel p-5"><div className="mb-3 text-[15px] font-semibold">AI characters</div><CharacterEditor value={characters} onChange={setCharacters} count={characterCount} onCount={setCharacterCount} voices={characterVoices} onVoices={setCharacterVoices} /></div>}
              <PresenterPicker value={presenter} onChange={setPresenter} aspect={aspectRatio} />
              <div className="rounded-2xl border border-line bg-panel p-5"><div className="mb-1 text-[15px] font-semibold">Reference images (optional)</div><p className="mb-3 text-[13px] text-ink-3">Subject / product, character, location or a style frame — up to 4. They guide every AI image and clip.</p><ReferenceImages value={referenceImages} onChange={setReferenceImages} /></div>
            </div>
            <aside className="rounded-2xl border border-line bg-panel p-4 text-[14px] lg:sticky lg:top-20 lg:self-start">
              <div className="text-[12px] uppercase tracking-wide text-ink-3">{isStory ? "Selected characters" : "Tips"}</div>
              {isStory ? (characters.length ? <ul className="mt-2 space-y-2">{characters.map((c, i) => <li key={i} className="rounded-xl border border-line p-3"><div className="font-semibold">{c.name || `Character ${i + 1}`}</div><div className="text-[12px] text-ink-3">{[c.gender, c.ageGroup, c.ethnicity].filter(Boolean).join(" · ") || "Describe the look and voice"}</div>{c.personality && <div className="mt-1 text-[12px] text-ink-2">{c.personality}</div>}</li>)}</ul> : <p className="mt-2 text-ink-3">Leave empty and the AI invents {characterCount} character{characterCount === 1 ? "" : "s"} for the story.</p>)
                : <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-2"><li>Upload the product to keep it identical in every shot.</li><li>A style frame copies colours and lighting, not content.</li></ul>}
            </aside>
          </div>
        </div>
      )}

      {/* ---------- 4 Review & Generate ---------- */}
      {step === 3 && (
        <div>
          <h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Review & generate</h1>
          <p className="mt-1 text-[15px] text-ink-2">Almost ready. Review your settings and generate your video.</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="text-[15px] font-semibold">Video summary</div>
                <div className="mt-3 line-clamp-2 text-[14px] text-ink-2">{prompt}</div>
                <dl className="mt-4 space-y-2 text-[14px]">{summary.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-ink-3">{k}</dt><dd className="text-right capitalize">{v}</dd></div>)}</dl>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-panel-2 px-3 py-2 text-[13px]"><span className="text-ink-3">Estimated time</span><span>~{minutesEst} min</span></div>
                <div className="mt-2"><EstimateCard settings={estimateSettings} /></div>
              </div>
              <details className="rounded-2xl border border-line bg-panel p-4"><summary className="cursor-pointer text-[14px] font-medium">Finishing & publish settings</summary>
                <div className="mt-4 space-y-5">
                  <div className="grid gap-4 md:grid-cols-2"><Select label="Output quality" value={outputQuality} onChange={setOutputQuality} options={OUTPUT_QUALITIES.map((q) => ({ value: q.value, label: q.label }))} />{isAiVideo && <Select label="AI clip resolution" value={aiVideoResolution} onChange={setAiVideoResolution} options={[{ value: "720p", label: "720p (cheaper)" }, { value: "1080p", label: "1080p" }]} />}</div>
                  <div><div className="mb-2 text-[13px] text-ink-2">Ad banners (burned in)</div><div className="grid gap-2 md:grid-cols-[1fr_140px_90px]"><input className="field" placeholder="Top headline" value={banners.top} onChange={(e) => setBanners({ ...banners, top: e.target.value })} /><input className="field" placeholder="Highlight word" value={banners.topHighlight} onChange={(e) => setBanners({ ...banners, topHighlight: e.target.value })} /><input type="color" className="field h-[44px] p-1" value={banners.color} onChange={(e) => setBanners({ ...banners, color: e.target.value })} /><input className="field md:col-span-3" placeholder="Bottom CTA" value={banners.bottom} onChange={(e) => setBanners({ ...banners, bottom: e.target.value })} /></div></div>
                  <LogoUpload value={logo} onChange={setLogo} />
                  <label className="block text-[14px]"><span className="mb-1 block text-ink-2">Call to action at the end</span><input className="field" placeholder="Subscribe for weekly explainers" value={cta} onChange={(e) => setCta(e.target.value)} /></label>
                </div>
              </details>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="mb-3 text-[15px] font-semibold">Preview style</div>
                <div className={`relative overflow-hidden rounded-xl bg-panel-2 ${aspectRatio === "R9_16" ? "mx-auto aspect-[9/16] max-h-[420px]" : "aspect-video"}`}>
                  <div className="absolute inset-0 bg-cover bg-center opacity-80" style={{ backgroundImage: `url(/assets/y2ube/gen/output_demo.jpg)` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute inset-x-5 bottom-5"><div className="display text-2xl font-bold uppercase leading-tight text-white md:text-3xl">{(prompt.split(/[.!?]/)[0] || "Your title").slice(0, 60)}</div><div className="mt-1 text-[12px] text-white/70">{template?.name} · {look === "auto" ? "AI-chosen look" : look.replace(/_/g, " ")}</div></div>
                </div>
              </div>
              <div className="rounded-2xl border border-accent/40 bg-accent/10 p-5">
                <div className="flex items-center gap-2 text-[15px] font-semibold"><Sparkles size={16} className="text-accent" /> Ready to generate!</div>
                <p className="mt-1 text-[14px] text-ink-2">This will create a complete video: script → storyboard → {voiceEnabled ? "voiceover → " : ""}visuals → {musicEnabled ? "music → " : ""}{captionsEnabled && voiceEnabled ? "captions → " : ""}rendering → thumbnails & SEO package.</p>
                {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button className="btn-gradient flex items-center justify-center gap-2 text-[15px]" onClick={submit} disabled={busy || !canGo}>{busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />} Generate video</button><button type="button" className="btn-ghost" onClick={() => goto(step - 1)}>Back</button></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step < 3 && (
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          <button type="button" className="btn-ghost" onClick={() => goto(step - 1)} disabled={step === 0}>Back</button>
          <button type="button" className="btn-gradient flex items-center gap-2" onClick={() => goto(step + 1)} disabled={!canGo}>Next: {steps[step + 1 === 2 && !showStep3 ? 3 : step + 1]} <ArrowRight size={18} /></button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="mb-3 text-sm font-medium text-ink">{title}</h3>{children}</div>;
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-2">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
