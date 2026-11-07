/**
 * Verifies every API key with one cheap call each. Run: npm run check -w apps/worker
 */
import "../env";
import { env } from "../env";
import { pingDeepSeek } from "../services/deepseek";
import { pingPexels } from "../services/pexels";
import { ping as pingVoice } from "../services/voice";
import { pingKie } from "../services/music";
import { ping as pingSnap } from "../services/snapgen";
import { assertFfmpegInstalled } from "../lib/media";

async function check(name: string, fn: () => Promise<string>) {
  try {
    const info = await fn();
    console.log(`✓ ${name}: ${info}`);
  } catch (e) {
    console.log(`✗ ${name}: ${(e as Error).message}`);
  }
}

(async () => {
  await check("ffmpeg", async () => { await assertFfmpegInstalled(); return "installed"; });
  await check("DeepSeek", async () => `model ${env.DEEPSEEK_MODEL} replied ${await pingDeepSeek()}`);
  await check("Pexels", async () => `${await pingPexels()} results for "city"`);
  await check(`Voice provider (${env.VOICE_PROVIDER})`, pingVoice);
  await check("Kie.ai", pingKie);
  if (env.SNAPGEN_API_KEY) await check("SnapGen", pingSnap);
  process.exit(0);
})();
