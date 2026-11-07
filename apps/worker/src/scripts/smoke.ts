/**
 * End-to-end smoke test through the public API. Run on the Mac or VPS:
 *   Y2_API_KEY=y2_xxx APP_URL=https://app.y2ube.io npm run smoke -w apps/worker
 * Creates a 15-second stock-footage video and waits (max 20 min) for COMPLETED.
 */
const key = process.env.Y2_API_KEY, base = (process.env.APP_URL || "https://app.y2ube.io").replace(/\/$/, "");
if (!key) { console.error("Set Y2_API_KEY"); process.exit(2); }
const H = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
(async () => {
  const t0 = Date.now();
  const r = await fetch(`${base}/api/v1/projects`, { method: "POST", headers: H, body: JSON.stringify({ prompt: "Smoke test: three quick facts about honey bees.", targetDuration: 15, videoType: "Facts", language: "English", visualSource: "stock_videos", outputQuality: "720p", look: "none", title: `smoke ${new Date().toISOString().slice(0, 16)}` }) });
  const c = await r.json();
  if (!r.ok) { console.error("create failed:", c); process.exit(1); }
  console.log(`created ${c.id} (reserved ${c.creditsReserved})`);
  for (;;) {
    await new Promise((ok) => setTimeout(ok, 8000));
    const p = (await (await fetch(`${base}/api/v1/projects/${c.id}`, { headers: H })).json()).project;
    process.stdout.write(`\r${p.status} ${p.progress}% ${p.currentStage ?? ""}        `);
    if (p.status === "COMPLETED") { console.log(`\nOK in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${p.finalVideoUrl} (${p.creditsCharged} credits)`); process.exit(0); }
    if (p.status === "FAILED") { console.log(`\nFAILED: ${p.error}`); process.exit(1); }
    if (Date.now() - t0 > 20 * 60e3) { console.log("\nTIMEOUT"); process.exit(1); }
  }
})();
