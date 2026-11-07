/**
 * AI voice casting: when a voice is left on Auto, DeepSeek picks the best-fitting voice from the community library
 * (17k voices) for the video's language, tone and topic — or for a specific character (gender, age, personality).
 * The chosen voice is added to our ElevenLabs account on first use. Falls back to null (caller uses the AbhiBots pool).
 */
import { z } from "zod";
import { prisma } from "@vidforge/db";
import { askValidated } from "../deepseek";
import { addCommunityVoice } from "./community";
import { log } from "../../lib/log";

const LANG: Record<string, string> = { english: "en", hindi: "hi", punjabi: "pa", spanish: "es", french: "fr", german: "de", portuguese: "pt", arabic: "ar", japanese: "ja", italian: "it", bengali: "bn", tamil: "ta", telugu: "te", marathi: "mr", gujarati: "gu", urdu: "ur" };
const Pick = z.object({ voiceId: z.string().min(8), reason: z.string().default("") });

export async function aiPickVoice(args: { projectId: string; language: string; videoType: string; topic: string; voiceStyle: string; gender?: string | null; age?: string | null; persona?: string | null; exclude?: Set<string> }): Promise<string | null> {
  if (process.env.VOICE_AI_PICK === "off") return null;
  const lang = LANG[args.language.toLowerCase()] ?? "en";
  const where = { language: lang, ...(args.gender ? { gender: args.gender.toLowerCase() } : {}), previewUrl: { not: null } };
  let cands = await prisma.communityVoice.findMany({ where, orderBy: { clonedBy: "desc" }, take: 60 });
  if (cands.length < 8 && lang !== "en") cands = [...cands, ...(await prisma.communityVoice.findMany({ where: { ...where, language: "en", accent: { contains: lang === "hi" || lang === "pa" ? "indian" : "", mode: "insensitive" } }, orderBy: { clonedBy: "desc" }, take: 30 }))];
  cands = cands.filter((c) => !args.exclude?.has(c.voiceId));
  if (cands.length < 3) return null;
  const list = cands.map((c) => `${c.voiceId} | ${c.name} | ${[c.gender, c.age, c.accent, c.useCase, c.category].filter(Boolean).join(", ")} | ${(c.description ?? "").slice(0, 90)} | used by ${c.clonedBy}`).join("\n");
  const who = args.persona ? `a CHARACTER: ${args.persona}${args.gender ? ` (${args.gender}${args.age ? `, ${args.age}` : ""})` : ""}` : `the NARRATOR`;
  try {
    const out = await askValidated(Pick,
      `You are a casting director choosing a text-to-speech voice. Respond with JSON only: {"voiceId": "...", "reason": "..."}.`,
      `Choose the best voice for ${who} of a ${args.videoType} video in ${args.language}. Topic: "${args.topic.slice(0, 200)}". Desired delivery: ${args.voiceStyle}.
Pick ONE voiceId from this list (format: id | name | traits | description | popularity). Prefer native-sounding ${args.language} voices with the right gender/age, a clear professional recording, and traits that match the delivery. Popularity is a weak signal only.
${list}`, 600);
    const chosen = cands.find((c) => c.voiceId === out.voiceId);
    if (!chosen) return null;
    const added = await addCommunityVoice(chosen.voiceId);
    if (!added.ok) { log(args.projectId, `AI voice pick "${chosen.name}" could not be added to the account (${added.error}) — using the standard pool`); return null; }
    log(args.projectId, `AI voice pick for ${args.persona ? args.persona.split(",")[0] : "narrator"}: ${chosen.name} — ${out.reason.slice(0, 120)}`);
    return chosen.voiceId;
  } catch (e) { log(args.projectId, `AI voice pick failed: ${(e as Error).message.slice(0, 100)}`); return null; }
}
