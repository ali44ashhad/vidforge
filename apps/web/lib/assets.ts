/**
 * Central asset map. Generated images (apps/worker: `npm run marketing:images`) live in /assets/y2ube/gen and take
 * precedence; the low-res design-pack images are the fallback so the site never shows a broken image.
 */
import fs from "node:fs";
import path from "node:path";

const base = "/assets/y2ube";
const GEN = path.join(process.cwd(), "public", "assets", "y2ube", "gen");
const has = (id: string) => { try { return fs.existsSync(path.join(GEN, `${id}.jpg`)); } catch { return false; } };
const pick = (id: string, fallback: string) => (has(id) ? `${base}/gen/${id}.jpg` : fallback);

export function getAssets() {
  return {
    logo: `${base}/brand_y2ube_logo.png`,
    outputDemo: pick("output_demo", `${base}/feature_video_preview_mountain.png`),
    pillarPublish: pick("pillar_publish", `${base}/hero_dashboard_mockup.png`),
    og: pick("og", `${base}/hero_dashboard_mockup.png`),
    cta: [pick("cta_1", `${base}/creator_story_02.png`), pick("cta_2", `${base}/final_cta_visual.png`), pick("cta_3", `${base}/final_cta_visual.png`)],
    templates: {
      documentary: pick("template_documentary", `${base}/template_documentary.png`), explainer: pick("template_explainer", `${base}/template_explainer.png`),
      top10: pick("template_top10", `${base}/template_top10.png`), finance: pick("template_finance", `${base}/template_finance.png`),
      tech: pick("template_tech", `${base}/template_tech.png`), kids: pick("template_kids", `${base}/template_kids.png`),
      motivation: pick("template_motivation", `${base}/template_motivation.png`), travel: pick("template_travel", `${base}/template_travel.png`),
      horror: pick("template_horror", `${base}/template_motivation.png`), realestate: pick("template_realestate", `${base}/template_travel.png`),
      shorts: pick("template_shorts", `${base}/template_tech.png`), ads: pick("template_ads", `${base}/creator_story_01.png`),
    },
    academy: ["academy_niche", "academy_first_video", "academy_thumbnails", "academy_publish", "academy_retention", "academy_monetize"].map((id) => (has(id) ? `${base}/gen/${id}.jpg` : null)),
    generated: has("output_demo"),
  };
}
export type Assets = ReturnType<typeof getAssets>;
