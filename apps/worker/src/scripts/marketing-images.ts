/**
 * Generates the homepage imagery with the configured image provider (SnapGen nano-banana-2 / Kie) and saves it into
 * apps/web/public/assets/y2ube/gen/. Prompts live in MANIFEST — edit freely.
 *   npm run marketing:images -w apps/worker            # all missing
 *   npm run marketing:images -w apps/worker -- --force # regenerate everything
 *   npm run marketing:images -w apps/worker -- --only template_finance,cta_1
 * Cost: ~3 SnapGen credits per image (≈ 30 images → ~90 credits).
 */
import fs from "node:fs";
import path from "node:path";
import { generateAiImage } from "../services/imageProvider";
import { downloadFile } from "../lib/media";
import { VISUAL_STYLES } from "@vidforge/shared";

const STYLE = "Premium dark-mode SaaS brand imagery: deep navy/black background, subtle purple (#7357FF) and blue (#4776FF) glow accents, cinematic lighting, ultra sharp, photoreal, clean composition, no text, no captions, no watermark, no logos, no UI.";
const OUT = path.resolve(__dirname, "../../../web/public/assets/y2ube/gen");

const MANIFEST: { id: string; aspect: "16:9" | "9:16" | "1:1" | "4:3" | "3:4"; prompt: string }[] = [
  // output showcase (main video preview)
  { id: "output_demo", aspect: "16:9", prompt: "Breathtaking mountain lake at golden hour, mirror-still turquoise water, snow-capped peaks, dramatic clouds, documentary-grade cinematography, wide shot, rich colour" },
  // templates (3:4 cards)
  { id: "template_documentary", aspect: "3:4", prompt: "Sea turtle gliding over a coral reef, sunbeams through deep blue water, nature-documentary still" },
  { id: "template_explainer", aspect: "3:4", prompt: "A single glowing light bulb floating in a dark studio, soft purple rim light, minimal, symbolic of ideas" },
  { id: "template_top10", aspect: "3:4", prompt: "Hiker on a ridge above dramatic mountains at sunrise, back to camera, adventure travel photography" },
  { id: "template_finance", aspect: "3:4", prompt: "Abstract 3D rising bar chart and upward arrow made of glass and gold on a dark desk, finance concept, shallow depth of field" },
  { id: "template_tech", aspect: "3:4", prompt: "Sleek futuristic sneaker product shot floating with neon purple and blue reflections, dark studio, tech review aesthetic" },
  { id: "template_kids", aspect: "3:4", prompt: "Adorable 3D animated child character with big eyes smiling, colourful storybook world, Pixar-like render, joyful" },
  { id: "template_motivation", aspect: "3:4", prompt: "Silhouette of an athlete at the top of a stadium staircase at dawn, epic sky, motivational cinematic" },
  { id: "template_travel", aspect: "3:4", prompt: "Kyoto pagoda with cherry blossoms and mountains at sunset, travel guide photography, vivid" },
  { id: "template_horror", aspect: "3:4", prompt: "Abandoned corridor with a single flickering light, fog, cold blue tones, horror story mood, no people" },
  { id: "template_realestate", aspect: "3:4", prompt: "Modern luxury villa exterior at dusk with warm interior lights and pool reflections, real-estate photography" },
  { id: "template_shorts", aspect: "3:4", prompt: "Close-up of a smartphone playing a vertical video in a dark room with neon purple glow, creator energy" },
  { id: "template_ads", aspect: "3:4", prompt: "Confident young professional in a modern office smiling at camera, product-ad lighting, clean background" },
  // academy (16:9)
  { id: "academy_niche", aspect: "16:9", prompt: "Creator at a desk with sticky notes and a laptop planning a channel, warm workspace, over-the-shoulder" },
  { id: "academy_first_video", aspect: "16:9", prompt: "Person recording at a home studio desk with a ring light and microphone, dark room, purple accent light" },
  { id: "academy_thumbnails", aspect: "16:9", prompt: "Designer's screen showing bold colourful thumbnail layouts, close-up of monitor, no readable text" },
  { id: "academy_publish", aspect: "16:9", prompt: "Laptop on a desk with an upload progress screen glowing, evening home office, shallow depth of field" },
  { id: "academy_retention", aspect: "16:9", prompt: "Abstract glowing analytics line chart rising on a dark screen, purple and blue light, no text" },
  { id: "academy_monetize", aspect: "16:9", prompt: "Creator celebrating in front of a laptop with confetti-like light particles, dark studio, joyful" },
  // final CTA collage (three cards)
  { id: "cta_1", aspect: "3:4", prompt: "Smiling young woman creator with headphones around neck, studio portrait, dark background, purple rim light" },
  { id: "cta_2", aspect: "16:9", prompt: "Golden-hour drone shot over a European old town with towers and river, cinematic travel" },
  { id: "cta_3", aspect: "16:9", prompt: "Ornate temple at sunset with warm sky and reflections, cinematic wide shot" },
  // pillars panels
  { id: "pillar_publish", aspect: "16:9", prompt: "Astronaut floating above Earth with the sunrise on the horizon, cinematic space documentary still" },
  // visual style previews (one per preset) — same subject rendered in each style so users can compare
  ...VISUAL_STYLES.map((st) => ({ id: `style_${st.id}`, aspect: "4:3" as const, prompt: `A lighthouse on a cliff at sunset with a small boat below. ${st.prompt} ${st.negative ? `Avoid: ${st.negative}.` : ""}` })),
  // open graph / social
  { id: "og", aspect: "16:9", prompt: "Wide cinematic still: a glowing play-button shape emerging from dark studio smoke with purple and blue light, abstract, premium" },
];

(async () => {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.find((a) => a.startsWith("--only"))?.split("=")[1] ?? (args.includes("--only") ? args[args.indexOf("--only") + 1] : "");
  const wanted = only ? new Set(only.split(",")) : null;
  fs.mkdirSync(OUT, { recursive: true });
  let done = 0;
  for (const m of MANIFEST) {
    if (wanted && !wanted.has(m.id)) continue;
    const file = path.join(OUT, `${m.id}.jpg`);
    if (fs.existsSync(file) && !force) { console.log(`skip ${m.id} (exists)`); continue; }
    process.stdout.write(`generating ${m.id} … `);
    try {
      const isStyle = m.id.startsWith("style_");
      const img = await generateAiImage(isStyle ? `${m.prompt} No text, no watermark.` : `${m.prompt}. ${STYLE}`, m.aspect, [], isStyle ? m.id.replace("style_", "") : "cinematic_photo");
      await downloadFile(img.url, file);
      console.log(`ok (${(fs.statSync(file).size / 1e3).toFixed(0)} KB)`); done++;
    } catch (e) { console.log(`FAILED: ${(e as Error).message.slice(0, 120)}`); }
  }
  console.log(`\n${done} image(s) written to ${OUT}\nNext: cd ../.. && git add apps/web/public/assets/y2ube/gen && git commit -m "homepage images" && git push`);
  process.exit(0);
})();
