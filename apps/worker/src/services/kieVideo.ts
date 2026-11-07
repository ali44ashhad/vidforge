/**
 * Kie.ai video generation (Veo 3) — same createTask → recordInfo pattern as the Kie image client.
 * Used as the primary or fallback AI-video provider so a SnapGen outage doesn't block generation.
 * Models: veo3_fast (default, cheaper/quicker) or veo3.
 */
import { fetchJson } from "../lib/http";
import { sleep } from "../lib/log";

const BASE = "https://api.kie.ai/api/v1";
const headers = () => ({ Authorization: `Bearer ${process.env.KIE_API_KEY || ""}`, "Content-Type": "application/json" });
export const kieVideoConfigured = () => !!process.env.KIE_API_KEY;

export async function submitVideo(prompt: string, aspect: string, startImageUrl?: string | null, model = process.env.KIE_VIDEO_MODEL || "veo3_fast"): Promise<string> {
  const data = await fetchJson<{ code: number; msg: string; data?: { taskId: string } }>(`${BASE}/jobs/createTask`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({
      model,
      input: {
        prompt: prompt.slice(0, 1800),
        aspect_ratio: aspect === "9:16" ? "9:16" : "16:9",
        ...(startImageUrl ? { image_urls: [startImageUrl] } : {}),
        enable_audio: true,
      },
    }),
  });
  if (data.code !== 200 || !data.data?.taskId) throw new Error(`Kie video createTask failed: ${data.msg ?? JSON.stringify(data)}`);
  console.log(`[kie-video] submitted ${data.data.taskId} model=${model}`);
  return data.data.taskId;
}

export async function waitForVideo(taskId: string, timeoutMs = Number(process.env.KIE_VIDEO_TIMEOUT_MS || 12 * 60 * 1000)): Promise<{ url: string; duration?: number }> {
  const started = Date.now();
  for (;;) {
    const data = await fetchJson<{ code: number; msg: string; data?: { state: string; resultJson?: string; failMsg?: string } }>(
      `${BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: headers() });
    const state = (data.data?.state ?? "").toLowerCase();
    if (state === "success") {
      const parsed = JSON.parse(data.data?.resultJson || "{}") as { resultUrls?: string[] };
      const url = parsed.resultUrls?.[0];
      if (!url) throw new Error("Kie video finished without a result URL");
      return { url };
    }
    if (["fail", "failed", "error"].includes(state)) throw new Error(`Kie video failed: ${data.data?.failMsg ?? data.msg}`);
    if (Date.now() - started > timeoutMs) throw new Error("Kie video generation timed out");
    await sleep(5000);
  }
}
