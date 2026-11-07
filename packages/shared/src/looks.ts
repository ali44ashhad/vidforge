/** Finishing looks (colour grade + grain + vignette + light leak), applied at the final encode. */
export interface Look { id: string; name: string; description: string }
export const LOOKS: Look[] = [
  { id: "auto", name: "Auto (AI decides)", description: "The AI sets contrast, colour, sharpness and effects from your topic and platform" },
  { id: "none", name: "None", description: "Untouched footage" },
  { id: "bright_clean", name: "Bright & Clean", description: "Bright, saturated, sharp, no vignette or grain — Instagram, Shorts, ads" },
  { id: "youtube_pop", name: "YouTube Pop", description: "Punchier contrast and colour, light sharpening — clean, modern" },
  { id: "cinematic", name: "Cinematic Movie", description: "Film contrast curve, teal-orange balance, vignette, fine grain, warm light leak" },
  { id: "warm_film", name: "Warm Film", description: "Golden tones, soft grain, gentle vignette — lifestyle, travel, stories" },
  { id: "cool_thriller", name: "Cool Thriller", description: "Cold blue shadows, deeper blacks, stronger vignette — horror, tech, drama" },
  { id: "vintage", name: "Vintage", description: "Faded blacks, muted colour, heavier grain — retro, nostalgic" },
  { id: "vivid", name: "Vivid", description: "High saturation and contrast — kids, food, animation" },
  { id: "noir", name: "Black & White", description: "Monochrome with strong contrast and grain" },
];
export const DEFAULT_LOOK = "auto";

export type LookParams = { contrast: number; saturation: number; brightness: number; warmth: number; sharpen: number; vignette: number; grain: number; leak: number };
