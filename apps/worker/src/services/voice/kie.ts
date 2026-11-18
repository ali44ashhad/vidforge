/**
 * Narration through Kie Gemini text-to-speech. Same API key as images and video.
 * Output is WAV with no word timings; the voice stage estimates caption timing.
 */
import fs from "node:fs";
import { env, requireKey } from "../../env";
import { fetchJson } from "../../lib/http";
import { sleep } from "../../lib/log";
import { downloadFile } from "../../lib/media";
import { runFfmpeg } from "../../lib/ffmpeg";
import type { VoiceInfo } from "./elevenlabs";

const BASE = "https://api.kie.ai/api/v1";
const MODEL = process.env.KIE_TTS_MODEL || "google/gemini-2-5-pro-tts";

const VOICES = ["Kore", "Fenrir", "Puck", "Charon", "Aoede", "Zephyr", "Leda", "Orus", "Callirrhoe", "Autonoe"] as const;

const STYLE_VOICE: Record<string, string> = {
  Professional: "Charon", Documentary: "Fenrir", Conversational: "Kore", Energetic: "Puck",
  Luxury: "Aoede", Warm: "Leda", Educational: "Kore", News: "Charon", Storytelling: "Aoede", Motivational: "Puck",
};
const STYLE_TONE: Record<string, string> = {
  Professional: "Newscaster", Documentary: "Deadpan", Conversational: "Empathetic", Energetic: "Promo/Hype",
  Luxury: "Vocal Smile", Warm: "Empathetic", Educational: "Newscaster", News: "Newscaster", Storytelling: "Vocal Smile", Motivational: "Promo/Hype",
};

function headers() {
  return { Authorization: `Bearer ${requireKey("KIE_API_KEY")}`, "Content-Type": "application/json" };
}

export function listKieVoices(): VoiceInfo[] {
  return VOICES.map((name) => ({ voice_id: name, name, category: "kie", labels: { language: "multilingual hindi english", provider: "kie" } }));
}

export function resolveKieVoice(style: string, projectVoiceId?: string | null): string {
  if (projectVoiceId && (VOICES as readonly string[]).includes(projectVoiceId)) return projectVoiceId;
  return STYLE_VOICE[style] || "Kore";
}

export async function kieSpeakToFile(text: string, voiceName: string, dest: string, style: string): Promise<void> {
  let last = "Kie voice failed";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await speakOnce(text, voiceName, dest, style);
      return;
    } catch (e) {
      last = (e as Error).message;
      if (attempt === 3 || !/internal error|try again|timed out/i.test(last)) throw e;
      await sleep(3000 * attempt);
    }
  }
  throw new Error(last);
}

async function speakOnce(text: string, voiceName: string, dest: string, style: string): Promise<void> {
  const voice = (VOICES as readonly string[]).includes(voiceName) ? voiceName : "Kore";
  const created = await fetchJson<{ code: number; msg: string; data?: { taskId: string } }>(`${BASE}/jobs/createTask`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      callBackUrl: env.KIE_CALLBACK_URL,
      input: {
        temperature: 1,
        scene: "A quiet studio booth, close-miked narration for a video.",
        sample_context: `${style} narration. Clear speech, natural pace, no music.`,
        speakers: [{ speaker_id: "Speaker 1", voice_name: voice, accent: "Neutral", style: STYLE_TONE[style] || "Newscaster", pace: "Natural" }],
        dialogue_turns: [{ speaker_id: "Speaker 1", text: text.slice(0, 4000) }],
      },
    }),
    timeoutMs: 60_000,
  });
  if (created.code !== 200 || !created.data?.taskId) throw new Error(`Kie voice createTask failed: ${created.msg ?? JSON.stringify(created)}`);
  const started = Date.now();
  let url = "";
  for (;;) {
    const data = await fetchJson<{ code: number; msg: string; data?: { state: string; resultJson?: string; failMsg?: string } }>(
      `${BASE}/jobs/recordInfo?taskId=${encodeURIComponent(created.data.taskId)}`, { headers: headers() });
    const state = (data.data?.state ?? "").toLowerCase();
    if (state === "success") {
      const parsed = JSON.parse(data.data?.resultJson || "{}") as { resultUrls?: string[] };
      url = parsed.resultUrls?.[0] ?? "";
      if (!url) throw new Error("Kie voice finished without audio");
      break;
    }
    if (["fail", "failed", "error"].includes(state)) throw new Error(`Kie voice failed: ${data.data?.failMsg ?? data.msg}`);
    if (Date.now() - started > 4 * 60 * 1000) throw new Error("Kie voice timed out");
    await sleep(2500);
  }
  const wav = dest.replace(/\.mp3$/i, "") + ".wav";
  await downloadFile(url, wav);
  await runFfmpeg(["-i", wav, "-c:a", "libmp3lame", "-q:a", "4", dest]);
  fs.rmSync(wav, { force: true });
}
