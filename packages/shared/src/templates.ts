/**
 * Video format templates. Each carries a playbook (what performs for this format on YouTube/Shorts)
 * and recommended defaults. Selecting a type in the form applies the defaults; the worker feeds the
 * playbook to the script and storyboard prompts.
 */
export interface VideoTemplate {
  id: string;                 // stored as Project.videoType
  name: string;
  group: "Long-form" | "Short-form" | "Story & entertainment" | "Business" | "Music-led";
  description: string;
  playbook: string;           // retention tactics and structure for the writer/director
  starter?: string;           // starter prompt shown when the template is chosen (bracketed parts are for the user to fill)
  pacing: "energetic" | "normal" | "cinematic";
  defaults: {
    aspectRatio?: "R16_9" | "R9_16";
    visualSource: string;
    style: string;            // visual style preset id
    look: string; lookIntensity: number;
    musicStyle: string;
    captionsEnabled: boolean; captionStyle: string;
    voiceStyle: string; voiceEnabled: boolean;
    voiceId?: string;         // optional default voice (set in Admin → Templates)
    narrationMode: "narrator" | "characters" | "characters_only";
    textOverlays: boolean;
    durationSeconds?: number;
  };
}

const D = { aspectRatio: "R16_9" as const, visualSource: "mixed", style: "cinematic_photo", look: "auto", lookIntensity: 70, musicStyle: "Auto", captionsEnabled: true, captionStyle: "YouTube Clean", voiceStyle: "Professional", voiceEnabled: true, narrationMode: "narrator" as const, textOverlays: true };

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  // ---- Long-form ----
  { id: "YouTube Video", name: "YouTube video (general)", group: "Long-form", pacing: "normal",
    starter: "A 7-minute YouTube video about [your topic]: open with a bold claim, cover the 3 things viewers must know with real examples, and end with a clear takeaway.",
    description: "Standard 5-15 min video: hook, value, payoff, CTA",
    playbook: "Cold-open hook in the first 5 seconds (a bold claim, a question, or the end result). State what the viewer gets. Deliver in 3-5 clear sections with a mini-payoff each. Re-hook every 60-90 seconds with a question or a surprising fact. Change visuals every 3-6 seconds. End with a one-line takeaway and a CTA that names the next video.",
    defaults: { ...D } },
  { id: "YouTube Documentary", name: "Documentary", group: "Long-form", pacing: "cinematic",
    starter: "A cinematic documentary on [your topic]: the origins, the turning point nobody expected, and why it still matters today.",
    description: "Narrative, slower, cinematic — history, science, true stories",
    playbook: "Open on the most dramatic moment of the story, then rewind. Build in acts: setup, complication, turning point, resolution. Use specific dates, names and numbers. Long, atmospheric shots; cross-dissolves; music swells at act changes. Narration is calm and authoritative. Close with why it still matters today.",
    defaults: { ...D, style: "documentary_photo", look: "cinematic", lookIntensity: 80, musicStyle: "Cinematic", captionStyle: "Documentary", voiceStyle: "Documentary" } },
  { id: "History Documentary", name: "History documentary", group: "Long-form", pacing: "cinematic",
    starter: "A history documentary about [event or empire]: how it rose, the decisive moment, and its lasting legacy - with dates, names and one vivid human detail per chapter.",
    description: "Maps, paintings, ruins, re-enactment feel",
    playbook: "Start with a 'what if you were there' image. Timeline structure with dated chapters. Use painting-style and archival-looking visuals, maps with routes, ruins and artifacts. One vivid human detail per chapter. End by connecting the past to the present.",
    defaults: { ...D, visualSource: "ai_images", style: "oil_painting", look: "vintage", lookIntensity: 60, musicStyle: "Epic orchestral", captionStyle: "Documentary", voiceStyle: "Documentary" } },
  { id: "Explainer", name: "Explainer", group: "Long-form", pacing: "normal",
    starter: "An explainer on how [thing] works, from the simplest idea up: use one analogy, one diagram per concept, and recap the ladder at the end.",
    description: "How something works, step by step, with diagrams",
    playbook: "Hook with the misconception or the surprising outcome. Explain in a ladder: simplest idea first, each step builds on the last. Use analogies. One diagram-style visual per concept with a 2-4 word label. Recap the ladder in 15 seconds at the end.",
    defaults: { ...D, visualSource: "ai_images", style: "line_art_accents", look: "youtube_pop", lookIntensity: 60, musicStyle: "Electronic tech", voiceStyle: "Educational" } },
  { id: "Whiteboard Explainer", name: "Whiteboard explainer", group: "Long-form", pacing: "normal",
    starter: "A whiteboard explainer: why [common belief] is wrong and what actually happens - simple drawings with short labels, before/after comparisons.",
    description: "Marker stick figures and hand-lettered labels (Sprouts / 'in a nutshell' style)",
    playbook: "Every idea becomes a simple drawing with a label written in the picture. Keep sentences short and concrete. Use before/after and ✓/✗ contrasts. Numbers are drawn big. Friendly, slightly playful narration.",
    defaults: { ...D, visualSource: "ai_images", style: "whiteboard", look: "youtube_pop", lookIntensity: 50, musicStyle: "Lo-fi", captionsEnabled: false, voiceStyle: "Educational", textOverlays: false } },
  { id: "Educational", name: "Educational / course", group: "Long-form", pacing: "normal",
    starter: "A structured lesson on [topic] with a stated learning outcome, three numbered sections, worked examples and a summary.",
    description: "Teach a topic thoroughly with structure",
    playbook: "State the learning outcome up front. Numbered sections with a visual title card for each. Worked examples over theory. Quick check-in questions to the viewer. Summary slide at the end.",
    defaults: { ...D, style: "clean_corporate", look: "youtube_pop", lookIntensity: 55, musicStyle: "Ambient", voiceStyle: "Educational" } },
  { id: "Top 10", name: "Top 10 / listicle", group: "Long-form", pacing: "energetic",
    starter: "Top 10 [category] ranked from 10 to 1, each with one surprising fact and a visual, escalating to a #1 that changes how you see the topic.",
    description: "Countdown format — extremely high retention when items escalate",
    playbook: "Tease the #1 in the hook without revealing it. Count DOWN from 10 to 1 with a big on-screen number for each item. Each item: name, one surprising fact, one visual. Escalate — each item bigger than the last. Tease 'the last one changes everything' around #4. Ask viewers which one they'd pick.",
    defaults: { ...D, look: "youtube_pop", lookIntensity: 70, musicStyle: "Upbeat pop", captionStyle: "Bold", voiceStyle: "Energetic" } },
  { id: "Comparison", name: "Comparison (X vs Y)", group: "Long-form", pacing: "normal",
    starter: "[Option A] vs [Option B]: compared on 5 criteria with a clear verdict for different kinds of buyers.",
    description: "Head-to-head with a verdict",
    playbook: "Hook: the winner is not the one you think. Compare on 4-6 criteria, one section each, with a split-screen feel. Score visibly. Give a clear verdict for different kinds of viewers ('if you… choose…').",
    defaults: { ...D, style: "clean_corporate", look: "youtube_pop", lookIntensity: 60, musicStyle: "Electronic tech" } },
  { id: "Finance", name: "Finance / investing", group: "Long-form", pacing: "normal",
    starter: "How [money topic] really works, explained with simple math on screen: the common mistake, the numbers, and a decision framework - no guarantees.",
    description: "Money topics — numbers, charts, credibility",
    playbook: "Open with a concrete number ('₹10,000 became…'). Explain with simple math on screen. Cite sources conversationally. Address the obvious objection. No guarantees; end with a decision framework, not a tip.",
    defaults: { ...D, style: "editorial_infographic", look: "youtube_pop", lookIntensity: 55, musicStyle: "Corporate", voiceStyle: "Professional" } },
  { id: "Tech Review", name: "Tech review / gadget", group: "Long-form", pacing: "normal",
    starter: "A review of [product]: who it's for, the 3 things that matter, the 2 annoyances, price and value, and a verdict.",
    description: "Product deep-dive: specs, real use, verdict",
    playbook: "Show the product in use in the first 3 seconds. Structure: who it's for, the 3 things that matter, the 2 annoyances, price/value, verdict. Close-ups and hands-on shots. Verdict sentence at the end with who should skip it.",
    defaults: { ...D, style: "cinematic_photo", look: "youtube_pop", lookIntensity: 65, musicStyle: "Electronic tech" } },
  { id: "Health & Fitness", name: "Health & fitness", group: "Long-form", pacing: "normal",
    starter: "The common mistake people make with [habit or workout], the why in one sentence, the how in numbered steps, and a 7-day challenge.",
    description: "Habits, workouts, nutrition explained simply",
    playbook: "Hook with the common mistake. Explain the 'why' in one sentence, then the 'how' in numbered steps. Show the movement or food clearly. Add one safety caveat naturally. End with a 7-day challenge.",
    defaults: { ...D, style: "bright_airy", look: "youtube_pop", lookIntensity: 60, musicStyle: "Upbeat pop", voiceStyle: "Energetic" } },
  { id: "Travel", name: "Travel guide", group: "Long-form", pacing: "cinematic",
    starter: "A travel guide to [place]: itinerary by area, one insider tip per stop, costs and timing, and a 3-item booking checklist.",
    description: "Places, itineraries, tips — beautiful footage",
    playbook: "Open on the most beautiful shot. Structure by days or areas. For each place: what it is, one insider tip, cost or timing. Drone-style wide shots and food close-ups. End with a 3-item packing/booking checklist.",
    defaults: { ...D, style: "cinematic_photo", look: "warm_film", lookIntensity: 70, musicStyle: "Acoustic", voiceStyle: "Warm" } },
  { id: "Facts", name: "Facts & curiosities", group: "Long-form", pacing: "energetic",
    starter: "15 facts about [topic] that sound fake but are true - most unbelievable first, second-best last.",
    description: "'Did you know' rapid facts",
    playbook: "One fact every 8-12 seconds, each with its own striking visual. Number them on screen. Put the most unbelievable fact first and the second-best last. Ask 'which one shocked you?' at the end.",
    defaults: { ...D, look: "youtube_pop", lookIntensity: 70, musicStyle: "Upbeat pop", captionStyle: "Bold", voiceStyle: "Energetic" } },
  { id: "Faceless Video", name: "Faceless channel video", group: "Long-form", pacing: "normal",
    starter: "A faceless video about [topic] with a bold claim in the hook, personal 'you' narration, and a mid-roll re-hook.",
    description: "Stock/AI visuals, strong narration — the classic faceless format",
    playbook: "Hook with a bold claim. Keep narration personal ('you'). Visual change every 3-5 seconds, never a static frame. Mid-roll re-hook. Clear CTA to the next video.",
    defaults: { ...D } },
  // ---- Story & entertainment ----
  { id: "Kids Story", name: "Kids story", group: "Story & entertainment", pacing: "cinematic",
    starter: "A kids' story about a kind [animal or child] who faces a small problem, meets a helper, and learns a gentle lesson - with two characters who speak.",
    description: "Illustrated story with character voices",
    playbook: "Warm, simple language. A likeable hero, a small problem, a helper, a gentle lesson. Repetition and rhythm. Dialogue with distinct voices. Bright storybook visuals.",
    defaults: { ...D, visualSource: "ai_images", style: "storybook", look: "vivid", lookIntensity: 50, musicStyle: "Ambient", captionsEnabled: false, voiceStyle: "Storytelling", narrationMode: "characters", textOverlays: false } },
  { id: "Horror Story", name: "Horror / thriller story", group: "Story & entertainment", pacing: "cinematic",
    starter: "A horror story in [an ordinary place]: one wrong detail, slow escalation, a reveal, and a cold ending that leaves a question.",
    description: "Atmospheric fear built from silence and sound",
    playbook: "Cold-open on the scariest moment, then rewind. Build dread slowly: ordinary setting, one wrong detail, escalation, reveal, cold ending. Long dark shots, minimal cuts, whispers and silence. Never explain everything. End with a question to the viewer.",
    defaults: { ...D, visualSource: "ai_images", style: "dark_moody", look: "cool_thriller", lookIntensity: 85, musicStyle: "Suspense", captionsEnabled: false, voiceStyle: "Storytelling", narrationMode: "characters", textOverlays: false } },
  { id: "Reddit Story", name: "Reddit / real-life story", group: "Story & entertainment", pacing: "normal",
    starter: "A first-person confession-style story: '[the most outrageous line]' - with a 'but then...' turn every 40 seconds and a final twist; ask viewers who was wrong.",
    description: "First-person confession style, very high retention",
    playbook: "Start mid-drama with the most outrageous line. First person, conversational, past tense. Short scenes, constant small reveals. 'But then…' turns every 30-45 seconds. End with the update/twist and ask 'who was in the wrong?'.",
    defaults: { ...D, style: "adult_cartoon", visualSource: "ai_images", look: "youtube_pop", lookIntensity: 60, musicStyle: "Lo-fi", captionStyle: "Bold", voiceStyle: "Conversational", narrationMode: "characters" } },
  { id: "Motivational", name: "Motivational", group: "Story & entertainment", pacing: "cinematic",
    starter: "A motivational speech for people who feel stuck: pain, turning point, discipline, vision - repeating one key phrase three times.",
    description: "Speech-style with epic visuals",
    playbook: "Short punchy sentences. Second person. Pain → turning point → discipline → vision. Repeat one key phrase three times. Epic slow visuals: mountains, athletes, city at dawn. Music rises to the last line.",
    defaults: { ...D, style: "cinematic_photo", look: "cinematic", lookIntensity: 90, musicStyle: "Epic orchestral", captionStyle: "Bold", voiceStyle: "Motivational" } },
  // ---- Short-form ----
  { id: "Short", name: "YouTube Short / Reel", group: "Short-form", pacing: "energetic",
    starter: "A 45-second Short: one idea about [topic], hook in the first line, a punchy fact every 8 seconds, and a loop-friendly last line.",
    description: "30-60 s vertical, hook in 1 second",
    playbook: "First line is the hook and must fit in 2 seconds. One idea only. No intro, no outro. Bold captions on every line. End with a loop-friendly last line or a 'part 2' tease. PACING IS THE FORMAT: a new shot every 1.5-3 seconds, so a 30-second Short has 12-18 shots and a 45-second Short has 18-26 - never a shot that sits on screen longer than 3 seconds. Every shot is a different subject or angle: no two consecutive shots of the same thing. Each shot brief names the subject, what it is doing, the framing or camera move, the light and the setting - concrete enough to film, never 'person using phone'.",
    defaults: { ...D, aspectRatio: "R9_16", look: "bright_clean", lookIntensity: 80, musicStyle: "Upbeat pop", captionStyle: "Word Highlight", voiceStyle: "Energetic", durationSeconds: 45 } },
  { id: "Spokesperson Ad", name: "Spokesperson ad (AI presenter)", group: "Short-form", pacing: "energetic",
    starter: "A 30-second ad where a presenter tells local businesses about [offer]: what they get, why it's easy, and how to book on WhatsApp.",
    description: "A consistent AI presenter talks to camera; offer banner on top, CTA banner at the bottom (Instagram/Facebook ad style)",
    playbook: "One presenter, always the same person, speaking directly to camera in a premium setting (office, showroom, clinic). First line is the offer or the pain point. 3 quick benefits, each with a gesture or a product close-up. Close with the CTA and how to contact. Confident, friendly, no filler. Shots: medium close-up presenter, gesture, product/service visual, presenter again.",
    defaults: { ...D, aspectRatio: "R9_16", visualSource: "ai_videos", style: "cinematic_photo", look: "bright_clean", lookIntensity: 80, musicStyle: "Corporate", captionsEnabled: false, voiceStyle: "Conversational", narrationMode: "characters_only", textOverlays: false, durationSeconds: 30 } },
  { id: "Advertisement", name: "Ad / promo", group: "Short-form", pacing: "energetic",
    starter: "A 45-second ad for [product]: the pain in the first sentence, the product solving it within 10 seconds, one proof point, and a clear offer.",
    description: "Problem → product → proof → offer",
    playbook: "Name the pain in the first sentence. Show the product solving it within 10 seconds. One proof point (number, testimonial). Clear offer and CTA repeated at the end. Bright, clean, product-centric visuals.",
    defaults: { ...D, style: "bright_airy", look: "bright_clean", lookIntensity: 80, musicStyle: "Upbeat pop", captionStyle: "Bold", voiceStyle: "Energetic", durationSeconds: 45 } },
  // ---- Business ----
  { id: "Product Video", name: "Product video", group: "Business", pacing: "normal",
    starter: "A product video for [product]: the outcome the customer gets, three features shown then explained as benefits, and pricing.",
    description: "Features and benefits, demo-style",
    playbook: "Lead with the outcome the customer gets. Three features, each shown then explained as a benefit. Realistic use context. Pricing/CTA at the end.",
    defaults: { ...D, style: "clean_corporate", look: "youtube_pop", lookIntensity: 55, musicStyle: "Corporate" } },
  { id: "Corporate", name: "Corporate / brand", group: "Business", pacing: "normal",
    starter: "A brand video for [company]: the mission in one human sentence, why we exist, what we do, where we're going.",
    description: "Company story, culture, mission",
    playbook: "Open with the mission in one human sentence. People over logos. Three chapters: why we exist, what we do, where we're going. Restrained music, clean visuals, understated CTA.",
    defaults: { ...D, style: "clean_corporate", look: "cinematic", lookIntensity: 50, musicStyle: "Corporate", captionStyle: "Corporate" } },
  { id: "Real Estate", name: "Real estate", group: "Business", pacing: "cinematic",
    starter: "A property walkthrough of [property]: hero exterior at golden hour, living, kitchen, bedrooms, the special feature, the neighbourhood, price and contact.",
    description: "Property walkthrough and area highlights",
    playbook: "Open on the hero exterior at golden hour. Flow: exterior, living, kitchen, bedrooms, special feature, neighbourhood, price/contact. Slow smooth motion, warm light. Mention 3 concrete numbers (area, bedrooms, distance).",
    defaults: { ...D, style: "bright_airy", look: "warm_film", lookIntensity: 60, musicStyle: "Acoustic", captionsEnabled: false, voiceStyle: "Luxury" } },
  { id: "News", name: "News explainer", group: "Business", pacing: "normal",
    starter: "A news explainer on [event]: what happened, who, when, where; then context, implications and what to watch next.",
    description: "What happened, why it matters, what's next",
    playbook: "Headline first. Facts in order: what, who, when, where. Then context, then implications, then what to watch. Neutral tone, no speculation stated as fact. Lower-third style on-screen labels.",
    defaults: { ...D, look: "youtube_pop", lookIntensity: 50, musicStyle: "Electronic tech", captionStyle: "Corporate", voiceStyle: "News" } },
  { id: "Case Study", name: "Case study", group: "Business", pacing: "normal",
    starter: "A case study: [client] went from [before] to [result] - the problem, the 3-step approach, the outcome with numbers.",
    description: "Before → approach → result with numbers",
    playbook: "Start with the result number. Then the starting problem, the approach in 3 steps, and the outcome with metrics. One quote-style line from the client. CTA to talk.",
    defaults: { ...D, style: "clean_corporate", look: "youtube_pop", lookIntensity: 55, musicStyle: "Corporate", captionStyle: "Corporate" } },
  // ---- Music-led (no narration) ----
  { id: "Cinematic Showreel", name: "Cinematic showreel (no voice)", group: "Music-led", pacing: "cinematic",
    starter: "A cinematic showreel of [subject]: slow aerials, city nights, ocean, forest light, dunes - every shot with camera movement, no narration.",
    description: "Drone shots, city, nature — music only",
    playbook: "No narration. Sequence shots by energy: calm opening, build, peak at the two-thirds mark, calm close. Every shot has a clear camera move. Cut on the music's phrases.",
    defaults: { ...D, visualSource: "ai_video_hero", style: "cinematic_photo", look: "cinematic", lookIntensity: 85, musicStyle: "Cinematic", captionsEnabled: false, voiceEnabled: false, textOverlays: false } },
  { id: "Ambient", name: "Ambient / relaxation (no voice)", group: "Music-led", pacing: "cinematic",
    starter: "A 10-minute ambient video for studying: rain on a cabin window, soft fireplace, slow camera drifts, continuous calm music.",
    description: "Sleep, study, meditation backgrounds",
    playbook: "No narration. Very slow visuals, long shots (8-10 s), gentle motion, soft palette. Nature, rain, fireplace, night city. Music continuous with no hard changes.",
    defaults: { ...D, visualSource: "ai_images", style: "watercolor", look: "warm_film", lookIntensity: 50, musicStyle: "Ambient", captionsEnabled: false, voiceEnabled: false, textOverlays: false } },
];

/** Short-form cut rhythm: every shot lasts between these bounds. */
export const SHORT_FORM_SHOT_SECONDS = { min: 1.5, max: 3 } as const;

/**
 * The shot-length window for a project, or null when the format sets its own.
 * Short-form templates and anything up to 90 seconds get the fast-cut rhythm; AI-video modes are excluded because
 * there the provider's clip length (8-10 s) decides how long a shot is.
 */
export function shotSecondsFor(videoType: string | null | undefined, targetDuration: number, visualSource: string | null | undefined): { min: number; max: number } | null {
  if (/ai_video/.test(visualSource ?? "")) return null;
  const t = findTemplate(videoType);
  const shortForm = t?.group === "Short-form" || targetDuration <= 90;
  return shortForm ? { ...SHORT_FORM_SHOT_SECONDS } : null;
}

export const TEMPLATE_GROUPS = ["Long-form", "Short-form", "Story & entertainment", "Business", "Music-led"] as const;

export function findTemplate(idOrName: string | null | undefined): VideoTemplate | null {
  if (!idOrName) return null;
  const k = idOrName.toLowerCase();
  return VIDEO_TEMPLATES.find((t) => t.id.toLowerCase() === k || t.name.toLowerCase() === k) ?? null;
}
