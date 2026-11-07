/**
 * ElevenLabs shared Voice Library: nightly sync into CommunityVoice, search, and "add to account" so a community
 * voice can be used for TTS (through AbhiBots or ElevenLabs — both address the voice by id).
 * Needs ELEVENLABS_API_KEY (direct key; free tier can browse; adding shared voices needs a paid tier on that account).
 */
import { prisma } from "@vidforge/db";
import { log } from "../../lib/log";

const EL = "https://api.elevenlabs.io/v1";
const key = () => process.env.ELEVENLABS_API_KEY || "";

type Shared = { public_owner_id: string; voice_id: string; name: string; gender?: string; age?: string; accent?: string; language?: string; use_case?: string; category?: string; description?: string; preview_url?: string; cloned_by_count?: number };

let syncing = false;
export async function syncCommunityVoices(maxPages = 400): Promise<number> {
  if (!key()) { log("voices", "ELEVENLABS_API_KEY not set — community library sync skipped"); return 0; }
  if (syncing) { log("voices", "library sync already running"); return 0; }
  syncing = true;
  try { return await syncInner(maxPages); } finally { syncing = false; }
}
async function syncInner(maxPages: number): Promise<number> {
  let lastSortId: string | undefined, pages = 0, total = 0;
  const seen = new Set<string>();
  for (;;) {
    // ElevenLabs pages the library either by page number or by last_sort_id depending on API version — send both.
    const qs = new URLSearchParams({ page_size: "100", page: String(pages) }); if (lastSortId) qs.set("last_sort_id", lastSortId);
    const r = await fetch(`${EL}/shared-voices?${qs}`, { headers: { "xi-api-key": key() } });
    if (!r.ok) { log("voices", `library sync stopped: ${r.status} ${(await r.text()).slice(0, 120)}`); break; }
    const d = (await r.json()) as { voices: Shared[]; has_more?: boolean; last_sort_id?: string };
    const fresh = d.voices.filter((v) => !seen.has(v.voice_id));
    if (!fresh.length) break; // nothing new on this page → end of library
    d.voices = fresh; fresh.forEach((v) => seen.add(v.voice_id));
    for (let i = 0; i < d.voices.length; i += 10) await Promise.all(d.voices.slice(i, i + 10).map(async (v) => {
      await prisma.communityVoice.upsert({ where: { voiceId: v.voice_id }, create: { voiceId: v.voice_id, publicOwnerId: v.public_owner_id, name: v.name, gender: v.gender, age: v.age, accent: v.accent, language: v.language, useCase: v.use_case, category: v.category, description: v.description?.slice(0, 500), previewUrl: v.preview_url, clonedBy: v.cloned_by_count ?? 0 }, update: { name: v.name, gender: v.gender, age: v.age, accent: v.accent, language: v.language, useCase: v.use_case, category: v.category, description: v.description?.slice(0, 500), previewUrl: v.preview_url, clonedBy: v.cloned_by_count ?? 0 } });
    }));
    total += d.voices.length; pages++;
    if (pages % 10 === 0) log("voices", `library sync: ${total} voices so far…`);
    if (d.has_more === false || pages >= maxPages) break;
    if (d.last_sort_id) lastSortId = d.last_sort_id;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  log("voices", `community library synced: ${total} voices (${pages} pages)`);
  return total;
}

export async function searchCommunityVoices(q: { search?: string; language?: string; gender?: string; accent?: string; limit?: number }) {
  const base = { ...(q.language ? { language: q.language.toLowerCase().slice(0, 2) } : {}), ...(q.gender ? { gender: q.gender.toLowerCase() } : {}), ...(q.accent ? { accent: { contains: q.accent, mode: "insensitive" as const } } : {}) };
  const take = Math.min(60, q.limit ?? 30);
  if (!q.search) return prisma.communityVoice.findMany({ where: base, orderBy: [{ clonedBy: "desc" }], take });
  // name matches first (exact/starts-with/contains), then description matches — so "bunty" returns voices called Bunty before anything else
  const byName = await prisma.communityVoice.findMany({ where: { ...base, name: { contains: q.search, mode: "insensitive" } }, orderBy: [{ clonedBy: "desc" }], take });
  const s = q.search.toLowerCase();
  byName.sort((a, b) => Number(b.name.toLowerCase().startsWith(s)) - Number(a.name.toLowerCase().startsWith(s)) || b.clonedBy - a.clonedBy);
  if (byName.length >= take) return byName;
  const byDesc = await prisma.communityVoice.findMany({ where: { ...base, NOT: { name: { contains: q.search, mode: "insensitive" } }, description: { contains: q.search, mode: "insensitive" } }, orderBy: [{ clonedBy: "desc" }], take: take - byName.length });
  return [...byName, ...byDesc];
}

/** Adds a shared voice to our ElevenLabs account and registers it in the Voice table so pickers and TTS can use it. */
export async function addCommunityVoice(voiceId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const v = await prisma.communityVoice.findUnique({ where: { voiceId } });
  if (!v) return { ok: false, error: "Voice not in the library" };
  if (!v.addedAt) {
    const r = await fetch(`${EL}/voices/add/${v.publicOwnerId}/${v.voiceId}`, { method: "POST", headers: { "xi-api-key": key(), "Content-Type": "application/json" }, body: JSON.stringify({ new_name: v.name.slice(0, 80) }) });
    const data = (await r.json().catch(() => ({}))) as { voice_id?: string; detail?: { message?: string } | string };
    if (!r.ok) return { ok: false, error: typeof data.detail === "string" ? data.detail : data.detail?.message ?? `ElevenLabs ${r.status}` };
    await prisma.communityVoice.update({ where: { voiceId }, data: { addedAt: new Date() } });
  }
  await prisma.voice.upsert({ where: { id: voiceId }, create: { id: voiceId, name: v.name, previewUrl: v.previewUrl, labels: { gender: v.gender ?? "", accent: v.accent ?? "", age: v.age ?? "", use_case: v.useCase ?? "", language: v.language ?? "", source: "community" } }, update: { name: v.name, previewUrl: v.previewUrl } });
  return { ok: true, id: voiceId };
}

/** Registers a voice by ElevenLabs voice ID — from our account (own/cloned/added voices) or, if unknown there, from the shared library. */
export async function addVoiceById(voiceId: string): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  const id = voiceId.trim();
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return { ok: false, error: "That doesn't look like an ElevenLabs voice ID" };
  // 1. already ours?
  const r = await fetch(`${EL}/voices/${id}`, { headers: { "xi-api-key": key() } });
  if (r.ok) {
    const v = (await r.json()) as { voice_id: string; name: string; preview_url?: string; labels?: Record<string, string>; category?: string };
    await prisma.voice.upsert({ where: { id: v.voice_id }, create: { id: v.voice_id, name: v.name, previewUrl: v.preview_url, category: v.category, labels: { ...(v.labels ?? {}), source: "elevenlabs-id" } }, update: { name: v.name, previewUrl: v.preview_url } });
    return { ok: true, id: v.voice_id, name: v.name };
  }
  // 2. in the shared library? (add it to the account, then register)
  const lib = await prisma.communityVoice.findUnique({ where: { voiceId: id } });
  if (lib) { const a = await addCommunityVoice(id); return a.ok ? { ok: true, id, name: lib.name } : a; }
  return { ok: false, error: `ElevenLabs doesn't return this voice for our key (${r.status}). If it's a private voice in another account, share it first or add it to the shared library.` };
}
