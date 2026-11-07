/** Renders a test image per script to prove the chosen fonts have the glyphs. Run: npm run font:check -w apps/worker */
import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { runFfmpeg, filterPath } from "../lib/ffmpeg";
import { fontFileFor, captionFontFor } from "../lib/text";
const samples: [string, string][] = [["latin", "WHY THE SAHARA WAS GREEN?"], ["hindi", "काम क्यों टलता है?"], ["punjabi", "ਕੰਮ ਕਿਉਂ ਟਲਦਾ ਹੈ?"]];
(async () => {
  const dir = path.join(os.tmpdir(), "vidforge-fonts"); fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of samples) {
    const ff = fontFileFor(text, "display");
    const tf = path.join(dir, `${name}.txt`); fs.writeFileSync(tf, text);
    const out = path.join(dir, `${name}.png`);
    try {
      await runFfmpeg(["-f", "lavfi", "-i", "color=c=0x222222:s=900x200", "-frames:v", "1", "-vf", `drawtext=textfile='${filterPath(tf)}'${ff ? `:fontfile='${filterPath(ff)}'` : ""}:fontsize=64:fontcolor=white:x=20:y=60`, out]);
      console.log(`${name.padEnd(8)} drawtext font: ${ff ?? "(fontconfig default)"}  caption font: ${captionFontFor(text)}  → ${out}`);
    } catch (e) { console.log(`${name}: FAILED ${(e as Error).message.split("\n")[0]}`); }
  }
  console.log(`\nOpen the PNGs to check for boxes:  open ${dir}`);
})();
