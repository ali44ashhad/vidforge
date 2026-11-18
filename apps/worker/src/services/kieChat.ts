/**
 * Script writing through Kie's OpenAI-compatible Gemini chat.
 * Same KIE_API_KEY as images and video. A full script is a fraction of a credit.
 */
import { requireKey } from "../env";
import { fetchJson } from "../lib/http";
import { sleep } from "../lib/log";

const URL = process.env.KIE_CHAT_URL || "https://api.kie.ai/gemini-3-8-flash-openai/v1/chat/completions";
const MODEL = process.env.KIE_CHAT_MODEL || "gemini-3-8-flash";

type Msg = { role: "system" | "user" | "assistant"; content: string };

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text ?? "");
    return "";
  }).join("");
}

export async function kieChat(messages: Msg[], maxTokens = 8000, temperature = 0.7): Promise<string> {
  let last = "empty response";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const data = await fetchJson<{ code?: number; msg?: string; choices?: { message?: { content?: unknown } }[] }>(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${requireKey("KIE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens, stream: false }),
      timeoutMs: 180_000,
    });
    const text = textOf(data.choices?.[0]?.message?.content).trim();
    if (text && !(data.code && data.code >= 500)) return text;
    last = JSON.stringify(data).slice(0, 180);
    if (attempt < 3) await sleep(4000 * attempt);
  }
  throw new Error(`Kie chat returned no text (${last})`);
}
