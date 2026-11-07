"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Download, Upload, RefreshCw, AlertCircle, Pause, Play } from "lucide-react";
import { PIPELINE_STAGES, STAGE_LABELS, CAPTION_STYLES, DEFAULT_MIX, VOICE_STYLES, type PipelineStage, type MixSettings } from "@vidforge/shared";
import AudioMixControls from "./AudioMixControls";
import LogoUpload, { type LogoValue } from "./LogoUpload";
import PublishKit, { type Kit } from "./PublishKit";
import LookPicker from "./LookPicker";
import SceneEditor from "./SceneEditor";
import VoicePicker from "./VoicePicker";
import YouTubeUpload from "./YouTubeUpload";

type Project = {
  id: string; title: string; status: string; currentStage: string | null; progress: number;
  voiceId?: string | null; voiceStyle: string; voiceSpeed?: number;
  error: string | null; finalVideoUrl: string | null; captionsUrl: string | null; thumbnailUrl: string | null; updatedAt?: string;
  actualDuration: number | null; width: number | null; height: number | null; fileSize: number | null;
  aspectRatio: string; checkpoint: { completedStages?: string[] } | null;
  stats: Record<string, number | string> | null; script: string | null; pauseRequested: boolean;
  mixSettings: Partial<MixSettings> | null; musicEnabled: boolean; captionsEnabled: boolean; captionStyle: string;
  logoUrl: string | null; logoPath: string | null; logoPosition: string;
  textOverlaysEnabled: boolean; outputQuality: string; voiceEnabled: boolean; look: string; lookIntensity: number; creditsCharged?: number; speechMode?: string;
  seo: Kit | null;
  characters?: { character: { id: string; name: string; description: string; referencePublicUrl: string | null; voiceId: string | null; gender?: string | null } }[];
  chapters: { id: string; title: string; startTime: number | null; endTime: number | null;
    scenes: { id: string; narration: string; shots: { id: string; visualDescription: string; duration: number; mediaAsset: { previewUrl: string | null; type: string; creator: string | null; sourceUrl: string | null } | null }[] }[] }[];
};

function statLines(stats: Record<string, number | string> | null): string[] {
  if (!stats) return [];
  const out: string[] = [];
  if (stats.chaptersPlanned) out.push(`Video plan created (${stats.chaptersPlanned} chapters)`);
  if (stats.tuning) out.push(`Look & music tuned: ${stats.tuning}`);
  if (stats.words) out.push(`${Number(stats.words).toLocaleString()}-word script written`);
  if (stats.shots) out.push(`${stats.shots} visual shots planned`);
  if (stats.videosFound) out.push(`${stats.videosFound} stock videos found`);
  if (stats.characters) out.push(`${stats.characters} characters designed`);
  if (stats.aiVideos) out.push(`${stats.aiVideos} AI video clips generated`);
  if (stats.aiImages) out.push(`${stats.aiImages} AI images generated`);
  if (stats.aiImagesInProgress && Number(stats.shotsProcessed || 0) < Number(stats.shotsTotal || 0)) out.push(`${stats.aiImagesInProgress} images generating now (${stats.shotsProcessed || 0}/${stats.shotsTotal} done)`);
  if (stats.aiImageFailures) out.push(`${stats.aiImageFailures} AI images failed (check worker log / credits)`);
  if (stats.imagesFound) out.push(`${stats.imagesFound} photos selected`);
  if (stats.shotsWithoutMedia) out.push(`${stats.shotsWithoutMedia} shots use a title card`);
  if (stats.voiceSegments) out.push(`Voiceover generated (${fmt(Number(stats.durationSeconds || 0))})`);
  if (stats.musicTracks) out.push("Music generated");
  if (stats.musicWarning) out.push(String(stats.musicWarning));
  return out;
}

export default function ProjectStatus({ id, youtubeConnected = false }: { id: string; youtubeConnected?: boolean }) {
  const [project, setProject] = useState<Project | null>(null);
  const [queue, setQueue] = useState<{ position: number; etaMinutes: number } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function tick() {
      const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.project) { setServerError(data?.error ?? `Server error ${res.status} — check logs/web.log (database unreachable or migration missing)`); if (!stop) setTimeout(tick, 4000); return; }
      setServerError(null);
      if (!stop) { setProject(data.project); setQueue(data.queue ?? null); }
      const done = ["COMPLETED", "FAILED", "PAUSED"].includes(data.project?.status);
      if (!stop && !done) setTimeout(tick, 2000);
    }
    tick();
    return () => { stop = true; };
  }, [id]);

  async function pauseResume(action: "pause" | "resume") {
    await fetch(`/api/projects/${id}/pause`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    window.location.reload();
  }

  async function retry(fresh = false) {
    await fetch(`/api/projects/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fresh }) });
    window.location.reload();
  }

  if (notFound) return <p className="text-ink-2">This video doesn't exist.</p>;
  if (!project) return <p className="text-ink-2">{serverError ? `Can't load the project: ${serverError} — retrying…` : "Loading…"}</p>;

  const done = (project.checkpoint?.completedStages ?? []) as string[];
  const current = (project.currentStage ?? "").split(":")[0] as PipelineStage | "";

  if (project.status === "COMPLETED") {
    const vertical = project.aspectRatio === "R9_16";
    const needsAttention = Number(project.stats?.shotsWithoutMedia) > 0 || Number(project.stats?.aiImageFailures) > 0 || (project.musicEnabled && !Number(project.stats?.musicTracks));
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Your video is ready 🎉</h1>
            <p className="mt-1 text-[15px] text-ink-2">{project.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#publish" className="btn-gradient flex items-center gap-2"><Upload size={18} /> Publish to YouTube</a>
            <a className={`btn-ghost flex items-center gap-2 ${project.finalVideoUrl ? "" : "pointer-events-none opacity-50"}`} href={project.finalVideoUrl ? `${project.finalVideoUrl}?v=${encodeURIComponent(project.updatedAt ?? "")}&download=${encodeURIComponent(slug(project.title))}.mp4` : "#"}><Download size={18} /> Download MP4</a>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="panel overflow-hidden">
              {project.finalVideoUrl ? (
                <video key={project.updatedAt} src={`${project.finalVideoUrl}?v=${encodeURIComponent(project.updatedAt ?? "")}`} poster={project.thumbnailUrl ?? undefined} controls className={`${vertical ? "mx-auto aspect-[9/16] max-h-[70vh]" : "aspect-video w-full"} bg-black`} />
              ) : <div className="flex aspect-video items-center justify-center text-ink-3">No MP4 was produced.</div>}
            </div>
            <PublishKit projectId={project.id} kit={project.seo} slug={slug(project.title)} />
            <div id="publish" /><YouTubeUpload projectId={project.id} kit={project.seo} connected={youtubeConnected} existing={project.stats?.youtubeUrl ? { url: String(project.stats.youtubeUrl), privacy: String(project.stats.youtubePrivacy ?? "") } : null} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="panel p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Duration" value={project.actualDuration ? fmt(project.actualDuration) : "—"} />
                <Stat label="Resolution" value={project.width ? `${project.width}×${project.height}` : "—"} />
                <Stat label="Format" value={project.aspectRatio.replace("R", "").replace("_", ":")} />
                <Stat label="File size" value={project.fileSize ? `${(project.fileSize / 1e6).toFixed(1)} MB` : "—"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {project.captionsUrl && <a className="chip" href={`${project.captionsUrl}?download=${encodeURIComponent(slug(project.title))}.srt`}>Captions .srt</a>}
                {project.stats?.assetReportUrl && <a className="chip" href={String(project.stats.assetReportUrl)} target="_blank" rel="noreferrer">Asset report</a>}
                {project.creditsCharged ? <span className="chip">{project.creditsCharged} credits used</span> : null}
              </div>
            </div>

            {needsAttention && (
              <div className="rounded-xl border border-warning/50 bg-warning/5 p-4 text-sm">
                <div className="flex items-center gap-2 text-warning"><AlertCircle size={16} /> Needs attention</div>
                <div className="mt-3 space-y-2">
                  {project.musicEnabled && !Number(project.stats?.musicTracks) && (
                    <button className="btn-ghost w-full text-sm" onClick={async () => { await fetch(`/api/projects/${id}/retry-music`, { method: "POST" }); window.location.reload(); }}>Add music</button>
                  )}
                  {(Number(project.stats?.shotsWithoutMedia) > 0 || Number(project.stats?.aiImageFailures) > 0) && (
                    <button className="btn-ghost w-full text-sm" onClick={async () => { await fetch(`/api/projects/${id}/retry-media`, { method: "POST" }); window.location.reload(); }}>Regenerate missing visuals</button>
                  )}
                </div>
              </div>
            )}

            <div className="panel p-4 text-sm">
              <div className="text-xs uppercase tracking-wide text-ink-3">More actions</div>
              <div className="mt-2 space-y-2">
                <button className="btn-ghost w-full text-sm" onClick={async () => { if (!confirm("Drop all visuals and generate them again? Script, voice and music are kept.")) return; await fetch(`/api/projects/${id}/retry-media?all=1`, { method: "POST" }); window.location.reload(); }}>Regenerate all visuals</button>
                <button className="btn-ghost w-full text-sm" onClick={() => retry(true)}>Regenerate everything</button>
              </div>
            </div>

            {project.characters && project.characters.length > 0 && (
              <div className="panel p-4">
                <div className="text-xs uppercase tracking-wide text-ink-3">Characters</div>
                <div className="mt-2 space-y-2">
                  {project.characters.map(({ character: c }) => (
                    <div key={c.id} className="flex gap-3">
                      {c.referencePublicUrl ? <img src={c.referencePublicUrl} alt={c.name} className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-panel-2" />}
                      <div className="min-w-0"><div className="text-sm font-medium">{c.name}</div><p className="line-clamp-2 text-xs text-ink-3">{c.description}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        <RevoicePanel project={project} onDone={() => window.location.reload()} />
        <RenderSettings project={project} onDone={() => window.location.reload()} />

        {project.chapters?.length > 0 && (
          <SceneEditor projectId={project.id} chapters={project.chapters as never} vertical={vertical} nativeSpeech={project.speechMode === "veo_native"}
            initialPending={project.chapters.reduce((a, ch) => a + ch.scenes.reduce((b, sc) => b + sc.shots.filter((sh) => !sh.mediaAsset).length, 0), 0)} />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">{project.status === "FAILED" ? "Generation failed" : project.status === "PAUSED" ? "Paused" : "Creating your video"}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{project.title}</p>
        </div>
        {project.status === "PAUSED" ? (
          <button className="btn-primary flex items-center gap-2" onClick={() => pauseResume("resume")}><Play size={16} /> Resume</button>
        ) : project.status !== "FAILED" ? (
          <button className="btn-ghost flex items-center gap-2" onClick={() => pauseResume("pause")} disabled={project.pauseRequested}>
            <Pause size={16} /> {project.pauseRequested ? "Pausing after this step…" : "Pause"}
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-line bg-panel p-6">
          <div className="flex items-end justify-between">
            <div><div className="text-[13px] text-ink-3">{project.status === "PAUSED" ? "Paused — progress is saved" : current && STAGE_LABELS[current] ? STAGE_LABELS[current] : project.status === "QUEUED" ? (queue ? `Position ${queue.position} in queue · about ${queue.etaMinutes} min` : "Waiting for a worker…") : "Working"}</div><div className="display text-[56px] font-bold leading-none tabular-nums">{project.progress}%</div></div>
            {project.status !== "FAILED" && project.status !== "PAUSED" && <span className="flex items-center gap-2 text-[13px] text-accent"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Generating</span>}
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-panel-2"><div className="h-full rounded-full bg-gradient-to-r from-[#6650FF] to-[#7B4DFF] transition-[width] duration-700" style={{ width: `${project.progress}%` }} /></div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {PIPELINE_STAGES.map((s) => {
              const isDone = done.includes(s); const isCurrent = current === s;
              return (
                <li key={s} className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-3 text-[14px] ${isDone ? "border-success/30 bg-success/5 text-ink" : isCurrent ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-ink-3"}`}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: isDone ? "rgba(49,213,131,.2)" : isCurrent ? "rgba(108,76,255,.25)" : "rgba(255,255,255,.06)" }}>{isDone ? <Check size={14} className="text-success" /> : isCurrent ? <Loader2 size={14} className="animate-spin text-accent" /> : <span className="h-1.5 w-1.5 rounded-full bg-line-2" />}</span>
                  {STAGE_LABELS[s]}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="text-[15px] font-semibold">Live statistics</div>
            {statLines(project.stats).length > 0 ? <ul className="mt-3 space-y-2 text-[14px] text-ink-2">{statLines(project.stats).map((l) => <li key={l} className="flex items-start gap-2"><Check size={14} className="mt-1 shrink-0 text-success" />{l}</li>)}</ul> : <p className="mt-2 text-[14px] text-ink-3">Stats appear as each stage completes.</p>}
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5 text-[14px] text-ink-2">
            <div className="text-[15px] font-semibold text-ink">While you wait</div>
            <ul className="mt-2 list-disc space-y-1 pl-4"><li>You can close this page — we'll email you when it's ready.</li><li>Three thumbnails and an SEO package are generated at the end.</li><li>After it finishes, any shot or paragraph can be replaced without re-generating everything.</li></ul>
          </div>
        </div>
      </div>

      {project.status === "FAILED" && (
        <div className="panel mt-4 flex items-start gap-3 border-danger/40 p-4 text-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="text-ink">{project.error ?? "Unknown error"}</p>
            <div className="mt-3 flex gap-2">
              <button className="btn-ghost" onClick={() => retry(false)}>Resume from last step</button>
              <button className="btn-ghost" onClick={() => retry(true)}>Start over</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RevoicePanel({ project, onDone }: { project: Project; onDone: () => void }) {
  const [voiceId, setVoiceId] = useState(project.voiceId ?? "");
  const [voiceStyle, setVoiceStyle] = useState(project.voiceStyle);
  const [speed, setSpeed] = useState(project.voiceSpeed ?? 1);
  const [busy, setBusy] = useState(false);
  const chars = project.characters ?? [];
  const [charVoices, setCharVoices] = useState<Record<string, string>>(Object.fromEntries(chars.map((c) => [c.character.id, c.character.voiceId ?? ""])));
  async function go() { setBusy(true); await fetch(`/api/projects/${project.id}/retry-voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId, voiceStyle, voiceSpeed: speed, characterVoices: charVoices }) }); onDone(); }
  return (
    <div className="panel mt-6 p-5">
      <h2 className="text-lg font-semibold">Regenerate voiceover</h2>
      <p className="mt-1 text-sm text-ink-3">Re-records every line with the voice below (script and visuals are kept), then re-renders. Free — no credits are charged.</p>
      {chars.length > 0 && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <div className="text-sm font-medium">Character voices — this is the voice you hear in this video</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">{chars.map((c) => <VoicePicker key={c.character.id} label={`${c.character.name}${c.character.gender ? ` (${c.character.gender})` : ""}`} gender={c.character.gender ?? undefined} value={charVoices[c.character.id] ?? ""} onChange={(id) => setCharVoices({ ...charVoices, [c.character.id]: id })} />)}</div>
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_200px_160px]">
        <VoicePicker label={chars.length ? "Narrator voice (only for narrated lines)" : "Voice"} value={voiceId} onChange={setVoiceId} />
        <label className="block text-sm"><span className="mb-1 block text-ink-2">Voice style</span><select className="field" value={voiceStyle} onChange={(e) => setVoiceStyle(e.target.value)}>{VOICE_STYLES.map((v) => <option key={v}>{v}</option>)}</select></label>
        <label className="block text-sm"><span className="mb-1 flex justify-between text-ink-2"><span>Speed</span><span>{speed.toFixed(2)}×</span></span><input type="range" className="mt-3 w-full accent-accent" min={0.8} max={1.2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label>
      </div>
      <button className="btn-gradient mt-4 flex items-center gap-2" disabled={busy} onClick={go}>{busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Regenerate voiceover</button>
    </div>
  );
}

function RenderSettings({ project, onDone }: { project: Project; onDone: () => void }) {
  const [mix, setMix] = useState<MixSettings>({ ...DEFAULT_MIX, ...(project.mixSettings ?? {}) });
  const [musicEnabled, setMusicEnabled] = useState(project.musicEnabled);
  const [captionsEnabled, setCaptionsEnabled] = useState(project.captionsEnabled);
  const [captionStyle, setCaptionStyle] = useState(project.captionStyle);
  const [logo, setLogo] = useState<LogoValue>({ logoUrl: project.logoUrl, logoPath: project.logoPath, logoPosition: project.logoPosition });
  const [textOverlaysEnabled, setTextOverlays] = useState(project.textOverlaysEnabled);
  const [outputQuality, setOutputQuality] = useState(project.outputQuality);
  const [look, setLook] = useState(project.look ?? "auto");
  const [lookIntensity, setLookIntensity] = useState(project.lookIntensity ?? 70);
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mixSettings: mix, musicEnabled, captionsEnabled, captionStyle, textOverlaysEnabled, outputQuality, look, lookIntensity, ...logo }) });
    await fetch(`/api/projects/${project.id}/render`, { method: "POST" });
    onDone();
  }

  return (
    <div className="panel mt-8 p-5">
      <h2 className="text-lg font-semibold">Adjust and render again</h2>
      <p className="mt-1 text-sm text-ink-3">Changes here only re-render the video (about a minute per 5 minutes of video). Script, footage and voice are kept.</p>
      <div className="mt-5 space-y-6">
        <LookPicker look={look} intensity={lookIntensity} onLook={setLook} onIntensity={setLookIntensity} />
        <AudioMixControls value={mix} onChange={setMix} musicEnabled={musicEnabled} onMusicEnabled={setMusicEnabled} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={textOverlaysEnabled} onChange={(e) => setTextOverlays(e.target.checked)} /> On-screen text overlays</label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-2">Output quality</span>
            <select className="field" value={outputQuality} onChange={(e) => setOutputQuality(e.target.value)}>
              <option value="720p">720p</option><option value="1080p">1080p</option><option value="4k">4K</option>
            </select>
          </label>
          <label className={`flex items-center gap-2 text-sm ${project.voiceEnabled ? "" : "opacity-40"}`}><input type="checkbox" checked={captionsEnabled && project.voiceEnabled} disabled={!project.voiceEnabled} onChange={(e) => setCaptionsEnabled(e.target.checked)} /> Burn captions into the video</label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-2">Caption style</span>
            <select className="field" value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)}>
              {CAPTION_STYLES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <LogoUpload value={logo} onChange={setLogo} />
      </div>
      <button className="btn-primary mt-6 flex items-center gap-2" onClick={apply} disabled={busy}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} Apply and render again
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="panel p-3"><div className="text-xs text-ink-3">{label}</div><div className="mt-1 text-ink">{value}</div></div>;
}
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "video";
}
function fmt(s: number) {
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
