/**
 * Kie.ai (Suno) background music: submit a task, poll until SUCCESS, return the MP3 URL.
 */
import { env, requireKey } from "../env";
import { fetchJson } from "../lib/http";
import { sleep } from "../lib/log";
import { y2fetch, y2ubeRemote } from "./y2ube";

const BASE = "https://api.kie.ai/api/v1";

function headers() {
  return { Authorization: `Bearer ${requireKey("KIE_API_KEY")}`, "Content-Type": "application/json" };
}

export interface MusicResult { audioUrl: string; duration: number; id: string }

const remoteMusic = new Map<string, MusicResult>();

export async function submitMusic(prompt: string, model = env.KIE_MODEL): Promise<string> {
  if (y2ubeRemote()) {
    const r = await y2fetch<MusicResult>("/api/v1/providers/music", { method: "POST", body: { prompt, model }, timeoutMs: 540_000 });
    const taskId = `y2:${r.id}`;
    remoteMusic.set(taskId, r);
    return taskId;
  }
  const data = await fetchJson<{ code: number; msg: string; data?: { taskId: string } }>(`${BASE}/generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      prompt: prompt.slice(0, 500),
      customMode: false,
      instrumental: true,
      model,
      callBackUrl: env.KIE_CALLBACK_URL,
    }),
  });
  if (data.code !== 200 || !data.data?.taskId) throw new Error(`Kie generate failed: ${data.msg ?? JSON.stringify(data)}`);
  return data.data.taskId;
}

/** Polls record-info until all tracks are ready. Returns the longest track. */
export async function waitForMusic(taskId: string, timeoutMs = 8 * 60 * 1000, onTick?: (status: string) => void): Promise<MusicResult> {
  const remote = remoteMusic.get(taskId);
  if (remote) return remote;
  if (taskId.startsWith("y2:")) throw new Error("y2ube music result was lost before download. Retry the music stage.");
  const started = Date.now();
  for (;;) {
    const data = await fetchJson<{
      code: number; msg: string;
      data?: { status: string; errorMessage?: string; response?: { sunoData?: { id: string; audioUrl: string; duration: number }[] } };
    }>(`${BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, { headers: headers() });

    const status = data.data?.status ?? "UNKNOWN";
    onTick?.(status);
    const tracks = (data.data?.response?.sunoData ?? []).filter((t) => t.audioUrl);
    if (status === "SUCCESS" && tracks.length) {
      const best = tracks.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))[0];
      return { audioUrl: best.audioUrl, duration: best.duration ?? 0, id: best.id };
    }
    if (/FAILED|ERROR|EXCEPTION/.test(status)) throw new Error(`Kie music ${status}: ${data.data?.errorMessage ?? data.msg}`);
    if (Date.now() - started > timeoutMs) throw new Error("Kie music generation timed out");
    await sleep(10_000);
  }
}

export async function pingKie(): Promise<string> {
  const d = await fetchJson<{ code: number; msg: string; data?: number }>(`${BASE}/chat/credit`, { headers: headers() }, 0);
  if (d.code !== 200) throw new Error(`Kie: ${d.msg}`);
  return `credits: ${d.data}`;
}
