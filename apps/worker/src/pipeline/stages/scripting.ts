import { prisma, type Prisma } from "@vidforge/db";
import { templateFor } from "../../services/config";
import type { StageDefinition } from "../types";
import { createStrategy, writeChapterScript, writeStoryChapter, rewriteToLength, rewriteLinesToLength, fixScript, fixScriptLines } from "../../services/deepseek";
import { wrongScriptRatio } from "@vidforge/shared";
import { findTemplate, type CharacterSpec } from "@vidforge/shared";
import { bumpStats } from "../stats";

/**
 * SCRIPTING: strategy → chapter outline → narration for each chapter, split into scenes.
 * Persists Chapter + Scene rows and the full script text.
 */
export const scripting: StageDefinition = {
  name: "SCRIPTING",
  async run(ctx) {
    const p = ctx.project;

    if (p.scriptVerbatim) return runVerbatim(ctx);

    ctx.log(p.storyMode ? "creating story and characters" : "creating video strategy");
    const given = p.storyMode
      ? (await prisma.projectCharacter.findMany({ where: { projectId: p.id }, include: { character: true }, orderBy: { order: "asc" } }))
          .map((pc) => ({ name: pc.character.name, description: pc.character.description, personality: pc.character.personality ?? "", voiceHint: pc.character.voiceHint ?? "",
            gender: (pc.character.gender as "female" | "male") ?? "female", ageGroup: (pc.character.ageGroup as CharacterSpec["ageGroup"]) ?? "adult", ethnicity: pc.character.ethnicity ?? "" } satisfies CharacterSpec))
      : [];
    const tplLive = await templateFor(p.videoType);
    const strategy = await createStrategy({
      template: tplLive,
      prompt: p.prompt, targetDuration: p.targetDuration, videoType: p.videoType, language: p.language,
      voiceStyle: p.voiceStyle, voiceSpeed: p.voiceSpeed, aspectRatio: p.aspectRatio, cta: p.cta,
      story: p.storyMode ? { characterCount: Math.max(1, p.characterCount), givenCharacters: given, style: p.imageStyle || "Storybook illustration" } : undefined,
    });
    await prisma.project.update({ where: { id: p.id }, data: { title: strategy.title, strategy: strategy as unknown as Prisma.InputJsonValue } });

    // AI fine-tuning of finishing settings — only for values the user left at the format's recommended defaults
    const tpl = tplLive ?? findTemplate(p.videoType);
    const fin = (strategy as { finishing?: { grade: Record<string, number>; musicStyle: string; captionStyle: string; reason: string } }).finishing;
    if (tpl && fin) {
      const tuned: Record<string, unknown> = {};
      if (p.look === "auto") tuned.lookParams = fin.grade;
      if (p.musicStyle === tpl.defaults.musicStyle || p.musicStyle === "Auto") tuned.musicStyle = fin.musicStyle;
      if (p.captionStyle === tpl.defaults.captionStyle) tuned.captionStyle = fin.captionStyle;
      if (Object.keys(tuned).length) {
        await prisma.project.update({ where: { id: p.id }, data: tuned });
        const g = fin.grade;
        await bumpStats(p.id, { tuning: `${p.look === "auto" ? `grade: contrast ${g.contrast}, saturation ${g.saturation}, brightness ${g.brightness}, warmth ${g.warmth}, vignette ${g.vignette}, grain ${g.grain}; ` : ""}${tuned.musicStyle ? `${fin.musicStyle} music; ` : ""}${tuned.captionStyle ? `${fin.captionStyle} captions; ` : ""}${Object.keys(tuned).length ? "" : "nothing changed; "}${fin.reason}` });
        ctx.log(`finishing tuned by AI: ${JSON.stringify(tuned)} (${fin.reason})`);
      }
    }

    // persist invented characters (given ones already exist)
    if (p.storyMode) {
      const existingNames = new Set(given.map((g) => g.name.toLowerCase()));
      let order = given.length;
      for (const c of strategy.characters) {
        if (existingNames.has(c.name.toLowerCase())) continue;
        const ch = await prisma.character.create({ data: { userId: p.userId, name: c.name, description: c.description, personality: c.personality || null, voiceHint: c.voiceHint || null, gender: c.gender, ageGroup: c.ageGroup, ethnicity: c.ethnicity || null } });
        await prisma.projectCharacter.create({ data: { projectId: p.id, characterId: ch.id, order: order++ } });
      }
      ctx.log(`characters: ${strategy.characters.map((c) => c.name).join(", ")}`);
    }
    await bumpStats(p.id, { chaptersPlanned: strategy.outline.length });
    await ctx.report(15, "plan");

    // wipe any partial script from a previous failed attempt
    await prisma.chapter.deleteMany({ where: { projectId: p.id } });

    let previousEnding: string | undefined;
    let totalWords = 0;
    const scriptParts: string[] = [];

    for (let i = 0; i < strategy.outline.length; i++) {
      ctx.log(`writing chapter ${i + 1}/${strategy.outline.length}: ${strategy.outline[i].title}`);
      let sceneRows: { order: number; narration: string; lines?: Prisma.InputJsonValue }[];
      if (p.storyMode) {
        const sceneLines = splitLongLineScenes(await writeStoryChapter({ strategy, chapterIndex: i, language: p.language, previousChapterEnding: previousEnding, videoType: p.videoType, narratorEnabled: p.narratorEnabled }));
        sceneRows = sceneLines.map((lines, j) => ({
          order: j,
          narration: lines.map((l) => (l.speaker === "narrator" ? l.text : `${l.speaker}: ${l.text}`)).join(" "),
          lines: lines as unknown as Prisma.InputJsonValue,
        }));
      } else {
        const scenes = (await writeChapterScript({ strategy, chapterIndex: i, language: p.language, voiceStyle: p.voiceStyle, previousChapterEnding: previousEnding, videoType: p.videoType, template: tplLive })).flatMap(splitLongScene);
        sceneRows = scenes.map((n, j) => ({ order: j, narration: n }));
      }
      // hard length check: rewrite this chapter when it is off by more than 12%
      const chapterTarget = strategy.outline[i].targetWords ?? Math.round(strategy.targetWords / strategy.outline.length);
      const spokenWords = (rows: typeof sceneRows) => rows.reduce((a, r) => a + ((r.lines as unknown as { text: string }[] | undefined)?.map((l) => l.text).join(" ") ?? r.narration).split(/\s+/).filter(Boolean).length, 0);
      // Up to 4 passes. Writers under-deliver on Hindi dialogue (short lines by design), so each expanding
      // pass aims a little above the target; the hard cap below still trims anything that overshoots.
      for (let pass = 0; pass < 4; pass++) {
        const have = spokenWords(sceneRows);
        if (Math.abs(have - chapterTarget) / chapterTarget <= 0.12) break;
        const aim = have < chapterTarget ? Math.round(chapterTarget * (1 + 0.12 * (pass + 1))) : chapterTarget;
        ctx.log(`chapter ${i + 1}: ${have} words vs target ${chapterTarget} — ${have > chapterTarget ? "tightening" : `expanding to ~${aim}`} (pass ${pass + 1}/4)`);
        if (p.storyMode) {
          const names = (strategy.characters ?? []).map((c) => c.name);
          const lines = sceneRows.flatMap((r) => (r.lines as unknown as { speaker: string; text: string }[]) ?? []);
          const fixed = await rewriteLinesToLength({ lines, targetWords: aim, language: p.language, names, narratorEnabled: p.narratorEnabled });
          sceneRows = fixed.map((ls, j) => ({ order: j, narration: ls.map((l) => (l.speaker === "narrator" ? l.text : `${l.speaker}: ${l.text}`)).join(" "), lines: ls as unknown as Prisma.InputJsonValue }));
        } else {
          const fixed = await rewriteToLength({ text: sceneRows.map((r) => r.narration).join("\n\n"), targetWords: aim, language: p.language });
          sceneRows = fixed.flatMap(splitLongScene).map((n, j) => ({ order: j, narration: n }));
        }
      }
      // HARD CAP: never let a chapter exceed its budget by more than 15% — cut at a sentence/line boundary.
      {
        const cap = Math.round(chapterTarget * 1.15);
        const have = spokenWords(sceneRows);
        if (have > cap) {
          ctx.log(`chapter ${i + 1}: still ${have} words after rewriting (cap ${cap}) — trimming to the budget`);
          if (p.storyMode) {
            let budget = cap; const kept: typeof sceneRows = [];
            for (const r of sceneRows) {
              const lines = ((r.lines as unknown as { speaker: string; text: string }[]) ?? []).filter((l) => { const w = l.text.split(/\s+/).filter(Boolean).length; if (budget - w < -3) return false; budget -= w; return true; });
              if (lines.length) kept.push({ ...r, order: kept.length, narration: lines.map((l) => (l.speaker === "narrator" ? l.text : `${l.speaker}: ${l.text}`)).join(" "), lines: lines as unknown as Prisma.InputJsonValue });
              if (budget <= 0) break;
            }
            sceneRows = kept;
          } else {
            let budget = cap; const kept: typeof sceneRows = [];
            for (const r of sceneRows) {
              const sentences = r.narration.match(/[^.!?।]+[.!?।]+["']?\s*|[^.!?।]+$/g) ?? [r.narration];
              const take: string[] = [];
              for (const s of sentences) { const w = s.split(/\s+/).filter(Boolean).length; if (budget - w < -3) break; budget -= w; take.push(s.trim()); }
              if (take.length) kept.push({ order: kept.length, narration: take.join(" ") });
              if (budget <= 0) break;
            }
            sceneRows = kept;
          }
          ctx.log(`chapter ${i + 1}: trimmed to ${spokenWords(sceneRows)} words`);
        }
      }
      // wrong-script guard (e.g. Hindi/Devanagari inside a Punjabi script)
      {
        const sample = sceneRows.map((r) => ((r.lines as unknown as { text: string }[] | undefined)?.map((l) => l.text).join(" ") ?? r.narration)).join(" ");
        const bad = wrongScriptRatio(p.language, sample);
        if (bad > 0.03) {
          ctx.log(`chapter ${i + 1}: ${(bad * 100).toFixed(0)}% of letters are in the wrong script for ${p.language} — rewriting`);
          if (p.storyMode) {
            const names = (strategy.characters ?? []).map((c) => c.name);
            const lines = sceneRows.flatMap((r) => (r.lines as unknown as { speaker: string; text: string }[]) ?? []);
            const fixed = await fixScriptLines({ lines, language: p.language, names });
            sceneRows = fixed.map((ls, j) => ({ order: j, narration: ls.map((l) => (l.speaker === "narrator" ? l.text : `${l.speaker}: ${l.text}`)).join(" "), lines: ls as unknown as Prisma.InputJsonValue }));
          } else {
            const fixed = await fixScript({ text: sceneRows.map((r) => r.narration).join("\n\n"), language: p.language });
            sceneRows = fixed.flatMap(splitLongScene).map((n, j) => ({ order: j, narration: n }));
          }
        }
      }
      const narration = sceneRows.map((s) => s.narration).join("\n\n");
      previousEnding = sceneRows[sceneRows.length - 1]?.narration.split(/(?<=[.!?])\s+/).slice(-2).join(" ");
      totalWords += narration.split(/\s+/).filter(Boolean).length;
      scriptParts.push(`${strategy.outline[i].title}\n\n${narration}`);

      await prisma.chapter.create({
        data: {
          projectId: p.id, order: i, title: strategy.outline[i].title, narration,
          scenes: { create: sceneRows },
        },
      });
      await bumpStats(p.id, { words: totalWords, chaptersWritten: i + 1 });
      await ctx.report(15 + Math.round(((i + 1) / strategy.outline.length) * 85), `chapter ${i + 1}`);
    }

    await prisma.project.update({ where: { id: p.id }, data: { script: scriptParts.join("\n\n\n") } });
    ctx.log(`script done: ${totalWords} words`);
  },
};

/**
 * Verbatim mode: the prompt is the script. We only clean it (title line, [timing/section] tags, stage
 * directions in brackets) and split it into scenes at blank lines / section markers.
 * A minimal strategy is stored so storyboarding and music still have context.
 */
/**
 * Verbatim SCREENPLAY: when the project has character voices and the pasted text is written as
 *   [दृश्य: place, year, mood]      → a new chapter (its title becomes the chapter card)
 *   पात्र का नाम: संवाद             → a character line (name must match a cast character exactly)
 *   [सूत्रधार]: … / सूत्रधार: … / Narrator: …  → a narrator line
 * each line keeps its speaker, so the voice stage casts one voice per character and the storyboard knows who
 * is in the shot. Plain paragraphs without a speaker are narrator lines. Returns null if the text has no
 * speaker lines at all, in which case the plain verbatim path runs.
 */
const MOODS = ["tense", "calm", "emotional", "uplifting"] as const;
/** "[दृश्य: ट्रेन रुक गई | tense]" → title "ट्रेन रुक गई", mood "tense" (the music bed switches per chapter mood). */
function splitMood(header: string): { title: string; mood: string | null } {
  const parts = header.split("|").map((x) => x.trim());
  if (parts.length < 2) return { title: header.trim(), mood: null };
  const last = parts[parts.length - 1].toLowerCase().replace(/^mood\s*[:：]\s*/, "");
  const mood = MOODS.find((m) => last === m || last.startsWith(m)) ?? null;
  return mood ? { title: parts.slice(0, -1).join(" | "), mood } : { title: header.trim(), mood: null };
}
function parseScreenplay(text: string): { title: string; chapters: { title: string; mood: string | null; lines: { speaker: string; text: string }[] }[] } | null {
  const NARR = /^\[?\s*(सूत्रधार|narrator|नैरेटर|voice ?over)\s*\]?\s*[:：]\s*(.+)$/i;
  const SCENE = /^\[\s*(?:दृश्य|scene)\s*[:：]?\s*([^\]]+)\]\s*$/i;
  const SPEAKER = /^([^\[\]:：.!?।]{1,40}?)\s*[:：]\s*(.+)$/;
  const chapters: { title: string; mood: string | null; lines: { speaker: string; text: string }[] }[] = [];
  let speakers = 0;
  const cur = () => { if (!chapters.length) chapters.push({ title: "", mood: null, lines: [] }); return chapters[chapters.length - 1]; };
  for (const raw of text.split("\n")) {
    // stage directions in brackets — "(हाँफते हुए)" — are for actors, not the TTS: drop them from spoken lines
    const line = raw.replace(/\s*[\(（][^\)）]{0,120}[\)）]\s*/g, " ").replace(/\s{2,}/g, " ").trim();
    if (!line) continue;
    const sm = line.match(SCENE);
    if (sm) { const { title: t, mood } = splitMood(sm[1]); chapters.push({ title: t, mood, lines: [] }); continue; }
    const nm = line.match(NARR);
    if (nm) { cur().lines.push({ speaker: "narrator", text: nm[2].trim() }); continue; }
    const sp = line.match(SPEAKER);
    if (sp && !/^https?$/i.test(sp[1])) { cur().lines.push({ speaker: sp[1].trim(), text: sp[2].trim() }); speakers++; continue; }
    const c = cur();
    if (c.lines.length) c.lines[c.lines.length - 1].text += " " + line;   // continuation of the previous line
    else c.lines.push({ speaker: "narrator", text: line });
  }
  // narrator-only documentaries still use this path when they carry [दृश्य] scene headers: scenes → chapters (cards), cast → visuals
  if (!speakers && chapters.length < 2) return null;
  chapters.forEach((c, i) => { if (!c.title) c.title = `दृश्य ${i + 1}`; });
  return { title: "", chapters: chapters.filter((c) => c.lines.length) };
}

async function runVerbatim(ctx: Parameters<StageDefinition["run"]>[0]) {
  const p = ctx.project;
  let text = p.prompt.replace(/\r/g, "");
  let title = p.title;
  const t = text.match(/^\s*(?:title|शीर्षक)\s*[:：]\s*(.+)$/im);
  if (t) { title = t[1].trim().slice(0, 100); text = text.replace(t[0], ""); }

  // Screenplay with character voices: keep the speakers.
  const play = p.storyMode ? parseScreenplay(text) : null;
  if (play) {
    const given = (await prisma.projectCharacter.findMany({ where: { projectId: p.id }, include: { character: true }, orderBy: { order: "asc" } }))
      .map((pc) => ({ name: pc.character.name, description: pc.character.description, personality: pc.character.personality ?? "", voiceHint: pc.character.voiceHint ?? "",
        gender: (pc.character.gender as "female" | "male") ?? "male", ageGroup: (pc.character.ageGroup as CharacterSpec["ageGroup"]) ?? "adult", ethnicity: pc.character.ethnicity ?? "" } satisfies CharacterSpec));
    const known = new Set(given.map((c) => c.name));
    const unknown = new Set<string>();
    for (const ch of play.chapters) for (const l of ch.lines) if (l.speaker !== "narrator" && !known.has(l.speaker)) unknown.add(l.speaker);
    if (unknown.size) ctx.log(`screenplay speakers not in the cast (they will use the narrator's voice): ${[...unknown].join(", ")}`);
    // scenes of roughly 25-90 words inside each chapter, never splitting a line
    const chapterRows = play.chapters.map((ch) => {
      const scenes: { speaker: string; text: string }[][] = [];
      let bucket: { speaker: string; text: string }[] = [], words = 0;
      for (const l of ch.lines) {
        const w = l.text.split(/\s+/).filter(Boolean).length;
        if (bucket.length && words + w > 70) { scenes.push(bucket); bucket = []; words = 0; }
        bucket.push(l); words += w;
      }
      if (bucket.length) scenes.push(bucket);
      return { title: ch.title, mood: ch.mood, scenes };
    });
    const words = play.chapters.flatMap((c) => c.lines).reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
    const strategy = {
      title, hook: play.chapters[0].lines[0].text.slice(0, 200), audience: "as written by the author", tone: p.voiceStyle.toLowerCase(),
      pacing: "cinematic", targetWords: words, cta: "", characters: given,
      outline: chapterRows.map((c) => ({ title: c.title, summary: c.title, targetWords: c.scenes.flat().reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0) })),
    };
    await prisma.project.update({ where: { id: p.id }, data: { title, strategy: strategy as unknown as Prisma.InputJsonValue, script: text } });
    await prisma.chapter.deleteMany({ where: { projectId: p.id } });
    for (let i = 0; i < chapterRows.length; i++) {
      const c = chapterRows[i];
      await prisma.chapter.create({ data: {
        projectId: p.id, order: i, title: c.title, musicMood: c.mood,
        narration: c.scenes.flat().map((l) => (l.speaker === "narrator" ? l.text : `${l.speaker}: ${l.text}`)).join(" "),
        scenes: { create: c.scenes.map((ls, j) => ({ order: j, narration: ls.map((l) => (l.speaker === "narrator" ? l.text : `${l.speaker}: ${l.text}`)).join(" "), lines: ls as unknown as Prisma.InputJsonValue })) },
      } });
    }
    await bumpStats(p.id, { chaptersPlanned: chapterRows.length, chaptersWritten: chapterRows.length, words });
    ctx.log(`verbatim screenplay: ${chapterRows.length} scenes (chapters), ${chapterRows.reduce((n, c) => n + c.scenes.length, 0)} voice segments, ${words} words, ${given.length} cast`);
    await ctx.report(100);
    return;
  }

  // split on blank lines OR bracketed section markers like [0–5 sec — HOOK]; drop the markers themselves
  const blocks = text.split(/\n\s*\n|(?=^\s*\[[^\]]*\]\s*$)/m)
    .map((b) => b.replace(/^\s*\[[^\]]*\]\s*$/gm, "").replace(/\((?:pause|beat|sfx|music)[^)]*\)/gi, "").replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 0);
  if (!blocks.length) throw new Error("Script is empty after cleaning");

  // merge very short blocks so scenes are 25-90 words
  const scenes: string[] = [];
  for (const b of blocks) {
    const last = scenes[scenes.length - 1];
    if (last && last.split(/\s+/).length + b.split(/\s+/).length < 30) scenes[scenes.length - 1] = `${last} ${b}`;
    else scenes.push(b);
  }
  const words = scenes.join(" ").split(/\s+/).length;
  const strategy = {
    title, hook: scenes[0].slice(0, 200), audience: "as written by the author", tone: p.voiceStyle.toLowerCase(),
    pacing: p.targetDuration <= 90 ? "energetic" : "normal", targetWords: words,
    outline: [{ title: "Script", summary: "User-provided script, spoken verbatim", targetWords: words }], cta: "", characters: [],
  };
  await prisma.project.update({ where: { id: p.id }, data: { title, strategy: strategy as unknown as Prisma.InputJsonValue, script: scenes.join("\n\n") } });
  await prisma.chapter.deleteMany({ where: { projectId: p.id } });
  await prisma.chapter.create({ data: { projectId: p.id, order: 0, title: "Script", narration: scenes.join("\n\n"), scenes: { create: scenes.map((n, j) => ({ order: j, narration: n })) } } });
  await bumpStats(p.id, { chaptersPlanned: 1, chaptersWritten: 1, words });
  ctx.log(`verbatim script: ${scenes.length} scenes, ${words} words`);
  await ctx.report(100);
}

const MAX_SCENE_WORDS = 90;
const wc = (t: string) => t.split(/\s+/).filter(Boolean).length;

/** DeepSeek sometimes returns one huge scene; split it at sentence ends into ~60-word scenes. */
function splitLongScene(text: string): string[] {
  if (wc(text) <= MAX_SCENE_WORDS) return [text];
  const sentences = text.split(/(?<=[.!?।])\s+/);
  const out: string[] = []; let cur = "";
  for (const s of sentences) {
    if (wc(cur) + wc(s) > 60 && cur) { out.push(cur.trim()); cur = s; } else cur = `${cur} ${s}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Same for story scenes made of lines: split at line boundaries. */
function splitLongLineScenes(scenes: { speaker: string; text: string }[][]): { speaker: string; text: string }[][] {
  const out: { speaker: string; text: string }[][] = [];
  for (const lines of scenes) {
    const total = lines.reduce((a, l) => a + wc(l.text), 0);
    if (total <= MAX_SCENE_WORDS) { out.push(lines); continue; }
    let cur: typeof lines = []; let n = 0;
    for (const l of lines) {
      if (n + wc(l.text) > 60 && cur.length) { out.push(cur); cur = []; n = 0; }
      cur.push(l); n += wc(l.text);
    }
    if (cur.length) out.push(cur);
  }
  return out;
}
