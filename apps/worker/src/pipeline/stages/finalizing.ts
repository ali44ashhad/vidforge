import fs from "node:fs";
import path from "node:path";
import { prisma } from "@vidforge/db";
import type { StageDefinition } from "../types";
import { projectDir, publicUrl } from "../../lib/storage";
import { bumpStats } from "../stats";
import { buildPublishKit } from "../../services/seo";

/** FINALIZING: write the Project Asset Report (provenance of every external asset). */
export const finalizing: StageDefinition = {
  alwaysRun: true,
  name: "FINALIZING",
  async run(ctx) {
    const p = ctx.project;
    const assets = await prisma.projectAsset.findMany({ where: { projectId: p.id }, include: { mediaAsset: true } });
    const voice = await prisma.voiceSegment.findMany({ where: { projectId: p.id }, orderBy: { order: "asc" } });
    const music = await prisma.musicTrack.findMany({ where: { projectId: p.id, status: "READY" } });
    const report = {
      project: { id: p.id, title: p.title, generatedAt: new Date().toISOString() },
      notice: "Review each provider's licence before commercial use. Attribution and licence links are listed per asset.",
      stockMedia: assets.map(({ mediaAsset: a }) => ({
        provider: a.provider, assetId: a.providerAssetId, type: a.type, creator: a.creator, creatorUrl: a.creatorUrl,
        sourceUrl: a.sourceUrl, license: a.license, licenseUrl: "https://www.pexels.com/license/", downloadedAt: a.downloadedAt,
      })),
      voice: { provider: voice[0]?.provider ?? "elevenlabs", voiceId: p.voiceId, segments: voice.length, generatedAt: voice[0]?.createdAt ?? null },
      music: music.map((m) => ({ provider: m.provider, generationId: m.generationId, prompt: m.prompt, generatedAt: m.createdAt })),
    };
    const file = path.join(projectDir(p.id, "output"), "asset-report.json");
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    await bumpStats(p.id, { assetReportUrl: publicUrl(file) });
    ctx.log(`asset report written (${assets.length} stock assets)`);
    await ctx.report(40, "asset report");
    try {
      await buildPublishKit(p.id, (m) => ctx.log(m));
    } catch (e) {
      ctx.log(`publish kit failed (video is still complete): ${(e as Error).message}`);
    }
    await ctx.report(100);
  },
};
