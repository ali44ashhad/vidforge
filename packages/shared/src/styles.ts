/**
 * Visual style presets. `prompt` is appended to every image/video prompt; `textInImage` means labels are
 * drawn by the image model itself (no overlay); `motion` tunes Ken Burns for still images.
 */
export interface VisualStyle {
  id: string;
  name: string;
  group: "Explainer" | "Animation" | "Cinematic" | "Artistic";
  description: string;
  prompt: string;
  negative: string;
  textInImage: boolean;
  motion: "subtle" | "normal";
  /** SnapGen style enum hint */
  snapStyle?: string;
}

export const VISUAL_STYLES: VisualStyle[] = [
  // --- Explainer ---
  { id: "whiteboard", name: "Whiteboard marker", group: "Explainer", textInImage: true, motion: "subtle", snapStyle: "Illustration",
    description: "Black marker stick figures on white, red/green/blue accents, ticks and crosses, hand-lettered labels",
    prompt: "whiteboard explainer drawing, hand-drawn with thick black marker on plain white background, simple stick figures with round heads, minimal props, a few accents in red, green and blue marker, handwritten uppercase labels, arrows, checkmarks and crosses, flat, no shading, no photorealism",
    negative: "photo, 3D, gradients, realistic faces" },
  { id: "doodle_sketch", name: "Doodle sketch on paper", group: "Explainer", textInImage: true, motion: "subtle", snapStyle: "Illustration",
    description: "Thin ink stick figures on beige paper with muted watercolor fills — calm, minimal, storytelling",
    prompt: "minimal hand-drawn doodle illustration, thin black ink lines on warm beige paper texture, simple stick figure with round head, sparse scene, soft muted watercolor fills in olive, sand and terracotta, lots of empty space, handwritten labels, storybook explainer feel",
    negative: "photo, 3D, detailed faces, busy background" },
  { id: "line_art_accents", name: "Line art with color accents", group: "Explainer", textInImage: true, motion: "subtle", snapStyle: "Illustration",
    description: "Clean grey line drawing, mostly white, selective colour fills on key objects and signs",
    prompt: "clean line-art explainer illustration, thin grey outlines on white, mostly uncoloured with selective flat colour fills on key objects (yellow, blue, brown, green), simple friendly round-headed characters, architectural line detail, readable signage text drawn in the scene",
    negative: "photo, heavy shading, dark background" },
  { id: "chalkboard", name: "Chalkboard", group: "Explainer", textInImage: true, motion: "subtle", snapStyle: "Illustration",
    description: "White and pale-blue chalk drawings and headings on a dark green-black chalkboard, chalk dust, eraser",
    prompt: "chalk drawing on a dark chalkboard, white and pale blue chalk lines with slight dust texture, hand-lettered chalk headings and labels in capitals, simple diagrams and icons, prohibition circles and arrows where relevant, chalk pieces and an eraser on the wooden ledge, straight-on view",
    negative: "photo, glossy, neon" },
  { id: "editorial_infographic", name: "Editorial infographic", group: "Explainer", textInImage: true, motion: "subtle", snapStyle: "Illustration",
    description: "Scientific / editorial illustration with labelled diagrams, charts and realistic objects on cream",
    prompt: "editorial scientific infographic illustration, realistic painted objects on the left, labelled diagram panels on the right with clean sans-serif titles, bar charts, molecular or anatomical cross-sections, muted palette on cream background, precise and educational, magazine quality",
    negative: "cartoon, neon, blurry text" },
  { id: "business_cartoon", name: "Business cartoon", group: "Explainer", textInImage: true, motion: "normal", snapStyle: "Illustration",
    description: "Clean corporate vector cartoon: friendly presenter, storefronts, city, soft colours, readable signs",
    prompt: "clean corporate cartoon illustration, friendly vector-style characters with simple faces, a presenter in a shirt gesturing, colourful shops and city buildings in the background, soft flat colours, subtle shading, readable sign text drawn in the scene, professional and optimistic",
    negative: "photo, dark, gritty" },
  // --- Animation ---
  { id: "flat_2d", name: "Flat 2D animation", group: "Animation", textInImage: false, motion: "normal", snapStyle: "Anime General",
    description: "Modern flat cartoon with anime-influenced character design, bright clean interiors (explainer channel look)",
    prompt: "modern flat 2D animation style, clean cel-shaded character with simple anime-influenced face, black hair, casual hoodie, soft flat shading, bright clean minimal interior with big windows, consistent character design, vector-clean edges, no outlines on backgrounds",
    negative: "photo, 3D render, painterly" },
  { id: "adult_cartoon", name: "Adult cartoon", group: "Animation", textInImage: false, motion: "normal", snapStyle: "Illustration",
    description: "Bold-outline flat cartoon, expressive faces, saturated colours, night scenes (adult-animation look)",
    prompt: "flat 2D adult-animation cartoon style, bold dark outlines, big expressive eyes and eyebrows, exaggerated worried or excited expressions, saturated colours, simple shading, cinematic framing, consistent character",
    negative: "photo, realistic, painterly" },
  { id: "anime_cinematic", name: "Anime cinematic", group: "Animation", textInImage: false, motion: "normal", snapStyle: "Anime General",
    description: "Anime film still: dramatic lighting, glowing screens, detailed moody backgrounds",
    prompt: "cinematic anime film still, detailed background art, dramatic lighting and rim light, glowing screens and particles, moody blue-and-orange palette, high-detail character with expressive eyes, depth of field, 2D anime rendering",
    negative: "3D, western cartoon, low detail" },
  { id: "storybook", name: "Storybook illustration", group: "Animation", textInImage: false, motion: "normal", snapStyle: "Illustration",
    description: "Children's picture-book painting, soft textures, warm colours",
    prompt: "children's storybook illustration, soft painted textures, warm gentle colours, rounded friendly shapes, cozy lighting, consistent character design",
    negative: "photo, scary, dark" },
  { id: "pixar_3d", name: "3D animated movie", group: "Animation", textInImage: false, motion: "normal", snapStyle: "3D Render",
    description: "Glossy 3D animated-film look with big eyes and soft global illumination",
    prompt: "3D animated feature film style render, stylised character with large expressive eyes, soft global illumination, subsurface skin, shallow depth of field, vibrant clean colours",
    negative: "2D, sketch, photo" },
  // --- Cinematic ---
  { id: "cinematic_photo", name: "Cinematic photo", group: "Cinematic", textInImage: false, motion: "normal", snapStyle: "Photorealistic",
    description: "Photorealistic film frame, natural light, shallow depth of field",
    prompt: "photorealistic cinematic film still, natural lighting, shallow depth of field, 35mm lens, subtle film grain, colour graded",
    negative: "cartoon, illustration, text" },
  { id: "documentary_photo", name: "Documentary photo", group: "Cinematic", textInImage: false, motion: "normal", snapStyle: "Photorealistic",
    description: "Honest reportage look, available light, real textures",
    prompt: "documentary photography, available light, candid, real textures, neutral colour grade, editorial",
    negative: "cartoon, illustration, glamour" },
  { id: "dark_moody", name: "Dark moody", group: "Cinematic", textInImage: false, motion: "normal", snapStyle: "Portrait Cinematic",
    description: "Low-key lighting, deep shadows, fog, tension — horror and thriller",
    prompt: "dark moody cinematic still, low-key lighting, deep shadows, fog, cold teal and amber highlights, tension, film grain",
    negative: "bright, cheerful, cartoon" },
  { id: "bright_airy", name: "Bright and airy", group: "Cinematic", textInImage: false, motion: "normal", snapStyle: "Photorealistic",
    description: "Soft daylight, white and pastel tones, lifestyle feel",
    prompt: "bright airy lifestyle photography, soft daylight, white and pastel tones, clean minimal composition",
    negative: "dark, gritty" },
  { id: "clean_corporate", name: "Clean corporate", group: "Cinematic", textInImage: false, motion: "normal", snapStyle: "Stock Photo",
    description: "Modern office, diverse professionals, glass and light — B2B",
    prompt: "clean corporate photography, modern office, glass and daylight, professional people, neutral palette, high-end stock quality",
    negative: "cartoon, messy" },
  // --- Artistic ---
  { id: "oil_painting", name: "Expressive oil painting", group: "Artistic", textInImage: false, motion: "subtle", snapStyle: "Acrylic",
    description: "Thick impasto brushstrokes, exaggerated expressions, dripping paint, surreal dark mood",
    prompt: "expressive oil painting, thick impasto brushstrokes and palette-knife texture, exaggerated grotesque-comic facial expressions, dripping paint, dark surreal mood, muted background figures in suits, saturated accent colours, gallery painting look",
    negative: "photo, clean vector, flat" },
  { id: "watercolor", name: "Soft watercolor", group: "Artistic", textInImage: false, motion: "subtle", snapStyle: "Watercolor",
    description: "Loose watercolour washes, paper texture, gentle bleeds",
    prompt: "soft watercolour painting, loose washes, visible paper texture, gentle colour bleeds, light and airy",
    negative: "photo, hard edges" },
  { id: "paper_cutout", name: "Paper cut-out", group: "Artistic", textInImage: false, motion: "subtle", snapStyle: "Illustration",
    description: "Layered paper craft with soft drop shadows",
    prompt: "layered paper cut-out craft illustration, coloured paper shapes with soft drop shadows, tactile, playful",
    negative: "photo, painterly" },
  { id: "pixel_art", name: "Pixel art", group: "Artistic", textInImage: false, motion: "subtle", snapStyle: "Game Concept",
    description: "Retro 16-bit pixel scenes",
    prompt: "retro 16-bit pixel art scene, limited palette, crisp pixels, game screenshot look",
    negative: "photo, smooth gradients" },
  { id: "crayon", name: "Crayon drawing", group: "Artistic", textInImage: false, motion: "subtle", snapStyle: "Illustration",
    description: "Child-like crayon and pencil on paper",
    prompt: "crayon and coloured pencil drawing on paper, child-like charm, waxy texture, bright simple shapes",
    negative: "photo, 3D" },
];

export const STYLE_GROUPS = ["Explainer", "Animation", "Cinematic", "Artistic"] as const;

/** Finds a preset by id or (legacy) name; unknown values are treated as free text. */
export function findStyle(idOrName: string | null | undefined): VisualStyle | null {
  if (!idOrName) return null;
  const k = idOrName.toLowerCase();
  return VISUAL_STYLES.find((s) => s.id === k || s.name.toLowerCase() === k) ?? null;
}
