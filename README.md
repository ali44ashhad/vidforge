# VidForge — AI long-form video platform

Prompt → strategy → script → storyboard → Pexels media → ElevenLabs voice → Kie music → (render) → one MP4.

```
vidforge/
  apps/web        Next.js 15 app  (home, generation screen, result screen, API)  → Vercel
  apps/worker     Node worker      (claims queued projects, runs the pipeline)     → VPS
    src/services  deepseek.ts  pexels.ts  voice.ts (ElevenLabs)  music.ts (Kie)
    src/pipeline  stages/*     timing.ts (real-audio timing engine)
  packages/db     Prisma schema + client
  packages/shared Constants + Zod schemas for the director's JSON
```

## Status

| Phase | What | Status |
|---|---|---|
| 1 | Scaffold, database, job queue with checkpoints | done |
| 2 | Real providers: DeepSeek, Pexels (+ranking, cache, provenance), ElevenLabs (+timestamps, real durations), Kie music, timing engine | done |
| 3+4 | Timeline validation, captions (SRT + burned-in), FFmpeg render service → final MP4 + thumbnail + asset report | done |
| 4b | Render sync fixes, audio mix controls, visual source modes (stock / AI images / mixed), channel logo, voice library with previews, music styles | this zip |
| 4c | Kids Story mode: characters with reference images (consistent look via image references), narrator + per-character voices, story styles | this zip |
| 4d | Providers: AbhiBots (voice+images), SnapGen (images + Veo AI video); narration modes; verbatim scripts; pause/resume; speech normalisation; publish kit (SEO titles/description/tags/thumbnails) | this zip |
| 4f | Visual style presets (whiteboard, chalkboard, doodle, line-art, infographic, business cartoon, flat 2D, adult cartoon, anime, oil painting…) with in-image labels; output quality; include toggles (voice/captions/music/text); text-to-video option | this zip |
| 4f | Output quality + include toggles (voiceover/captions/music/text); 21 visual style presets (whiteboard, chalkboard, doodle, infographic, anime, oil painting…); emoji/font fixes; YouTube-style thumbnails | this zip |
| 4g | Finishing looks (Cinematic Movie, YouTube Pop, Warm Film, Cool Thriller, Vintage, Vivid, B&W) with intensity; font fixes for Indic scripts | this zip |
| 4h | 26 video formats with YouTube playbooks + auto-applied recommended settings; music retry ladder; Veo audio-failure retries; voice-before-visuals + whole-clip fitting | this zip |
| 4i | Reference images (subject / character / location / style) for AI images and Veo clips; per-topic AI tuning of look & music; duration enforcement with per-language speech rates; per-chapter clip merging | this zip |
| 4j | Spokesperson ad format (AI presenter + burned-in offer/CTA banners); thumbnail hook picker with on-demand rendering; page error handling | this zip |
| 4m | Native speech (Veo speaks each line, lip-synced) for AI-video character projects; characters-only narration; per-language TTS model; AI-decided grade parameters; music overlap; speed settings | this zip |
| 5a | VPS deployment (worker + web on one box, nginx + HTTPS, pm2) | this zip |
| 6 | Accounts (email + Google), credits ledger with reserve/settle/refund, plans + Razorpay, per-user projects, live credit estimate | this zip |
| 7a | Brand kit applied (Y2ube logo, tokens, Noto fonts incl. Devanagari/Gurmukhi), app shell (side nav / bottom tabs), public landing page, dashboard cards, settings page | this zip |
| 7b | 4-step Create studio (format picker with icons + search, sticky summary & estimate), result workspace (player + publish kit, side panel with stats/attention/actions, scenes) | this zip |
| 8a | Admin panel: overview KPIs, projects ops table (retry/restart/refund/stop), users (grant credits, plan, suspend, role), system (worker, queue, providers, VPS) | this zip |
| 9a | Bulk creation: topics list or CSV → one settings template → N projects with per-video reservations; batch page with progress and "Download all" zip | this zip |
| 9b | Scene editor: regenerate a shot with a new description, pick a stock clip/photo, upload your own; edit a paragraph and re-voice only that scene; one Apply re-runs only what changed | this zip |
| 10a | YouTube direct upload: connect channel (OAuth, encrypted refresh token), upload MP4 with title/description/tags/thumbnail, visibility, scheduling | this zip |
| 10b | Legal pages (/privacy, /terms, /refunds), "video ready" / "failed" emails via Resend, light/dark theme toggle | this zip |
| 11a | Admin editors: video-type playbooks & recommended settings, plan prices/credits, credit rates, default narrator voice per language — stored as overrides, no deploy needed | this zip |
| 11b | Project menu (rename / duplicate / delete with storage cleanup + refund of unsettled credits); public API v1 with API keys (Pro+) | this zip |
| 12 | Operations: nightly housekeeping (render intermediates, orphaned folders, disk alert), cron watchdog that restarts the worker and emails you, end-to-end smoke test via the API | this zip |
| 13 | Homepage rebuilt from the Y2ube design pack (components in `components/marketing`, content in `lib/marketing.ts`, assets in `public/assets/y2ube`), brand tokens/fonts per the brief, split-screen auth | this zip |
| 14 | Full app redesign per the product brief: DashboardShell (sidebar/topbar/mobile), 4-screen Create wizard with style thumbnails, generation screen, My Videos library, Bulk, Billing (usage), Settings (tabs, profile/password/delete, API keys, brand kit), Dashboard overview, YouTube Analytics (real via API + demo), Ideas (DeepSeek), Content Plan calendar, Monetization roadmap, Templates, Academy, Brand Kit | this zip |
| 14b | AI everywhere: template starter prompts (one-click ready-to-generate), AI-filled content plan, admin "Generate course with AI" (DeepSeek outline → lesson videos via the pipeline → Academy from the database), brand kit applied to Bulk | this zip |
| 15 | Speed & capacity (Stage A): music library (instant tracks), image provider fallback chain (Kie-first), machine-wide render slots, fair prioritised queue (paid first, per-user cap), queue position + ETA on the progress screen; Stripe Checkout (UPI) | this zip |
| 16 | AI presenter (face cam): one photo → Veo lip-synced clips composited as a circle over the video, its speech becomes the narration | this zip |
| 17 | Stage B: Cloudflare R2 storage + second worker; audience analytics; teams | later |

## Phase 12 — operations

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase12.zip && cd vidforge
npm install && git add -A && git commit -m "phase 12: operations" && git push
```
VPS:
```bash
bash /var/www/vidforge/deploy/update-worker.sh
printf '\nRENDER_KEEP_DAYS=3\nDISK_ALERT_FREE_GB=15\nADMIN_EMAIL=you@gmail.com\n' >> /var/www/vidforge/.env && pm2 restart vidforge-worker
( crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/vidforge/deploy/watchdog.sh >> /var/log/vidforge-watchdog.log 2>&1" ) | crontab -
```
- Housekeeping runs 1 min after start and every 24 h: deletes render intermediates older than `RENDER_KEEP_DAYS`
  (final MP4s, thumbnails and assets are kept; a re-render rebuilds intermediates), removes storage of deleted projects
  and old batch zips, logs free disk and emails `ADMIN_EMAIL` when below `DISK_ALERT_FREE_GB`.
- Watchdog (cron, every 5 min): if `https://media.y2ube.io/health` fails, restarts the worker with pm2 and emails you.
- Smoke test: `Y2_API_KEY=y2_… APP_URL=https://app.y2ube.io npm run smoke -w apps/worker` — creates a 15-second
  stock video through the public API and waits for COMPLETED. Run it after every deploy.

## Phase 11b — project management & API

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase11b.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase11b
git add -A && git commit -m "phase 11b: project menu, public API" && git push
```
Then on the VPS `bash /var/www/vidforge/deploy/update-worker.sh`.
- My videos → ⋯ on a card: **Rename**, **Duplicate** (opens Create prefilled with every setting), **Delete** (removes DB rows and the storage folder on the VPS; unsettled reservations are refunded).
- Settings → **API keys** (Pro and above; admins always): `POST /api/v1/projects` with `Authorization: Bearer y2_…` creates a video; `GET /api/v1/projects/:id` polls status and returns the MP4/thumbnail/publish kit when done. Any Create-form field is accepted.

## Phase 11a — admin editors (templates, plans, voices)

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase11a.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase11a
git add -A && git commit -m "phase 11a: admin editors" && git push
```
Then on the VPS `bash /var/www/vidforge/deploy/update-worker.sh`.
Admin → **Templates** (edit name, description, playbook text, pacing, recommended settings, hide a type), **Plans**
(price, credits, popular, active; credit rates), **Voices** (default narrator voice per language; browse/preview synced
voices). Code stays the baseline; the admin saves overrides in `ConfigOverride`, read by the web app (30 s cache) and the
worker (60 s cache). "Reset to default" removes an override.

## Phase 10b — legal pages, emails, theme

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase10b.zip && cd vidforge
npm install && git add -A && git commit -m "phase 10b: legal pages, emails, theme" && git push
```
No migration. Emails: sign up at resend.com, verify the `y2ube.io` domain (add their DNS records in GoDaddy), create an API key,
then on the VPS add `RESEND_API_KEY=…`, `EMAIL_FROM=Y2ube <no-reply@y2ube.io>`, `APP_URL=https://app.y2ube.io` to `.env`
and restart the worker. Without a key, no emails are sent. Legal pages are public and linked from the landing footer —
use `https://app.y2ube.io/privacy` and `/terms` on the Google OAuth consent screen.

## Phase 10a — YouTube upload

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase10a.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase10a
git add -A && git commit -m "phase 10a: youtube upload" && git push
```
Then on the VPS `bash /var/www/vidforge/deploy/update-worker.sh`.

**Google Cloud (once):** in the Y2ube project → APIs & Services → Library → enable **YouTube Data API v3**. Credentials → your
OAuth client → add redirect URI `https://app.y2ube.io/api/youtube/callback`. OAuth consent screen → add scopes
`youtube.upload` and `youtube.readonly` (these are "sensitive" scopes: while the app is unverified, only accounts listed
under Test users can connect — add your own Gmail there; verification is needed before customers can connect).

Settings → YouTube → Connect. On a finished video the "Upload to YouTube" panel picks a title from the publish kit, the
description with chapters, tags, a thumbnail, visibility and an optional schedule. Uploads go through the VPS worker
(which holds the MP4). The video link is stored on the project.

## Phase 9b — scene editor

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase9b.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase9b
git add -A && git commit -m "phase 9b: scene editor" && git push
```
Then on the VPS `bash /var/www/vidforge/deploy/update-worker.sh`.
On a finished video, the Scenes section is now an editor: hover a shot → regenerate (AI, with a new description), choose stock
(Pexels search, videos or photos), or upload (image/mp4). "Edit text" on a paragraph re-voices only that scene (not on native-
speech videos). Edits are staged; **Apply changes & render** re-runs only the missing pieces and re-renders. Credits are not
re-reserved for edits.

## Phase 9a — bulk creation

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase9a.zip && cd vidforge
npm install && git add -A && git commit -m "phase 9a: bulk creation" && git push
```
No migration. VPS: `apt-get install -y zip` once (for "Download all"), then `bash /var/www/vidforge/deploy/update-worker.sh`.
`/bulk`: paste one topic per line or a CSV (`prompt,title,language,duration`), choose the settings template (type, duration,
format, language, visuals, style, look, voice, music, captions, quality), see credits per video × rows, start. Available on
Creator and above (admins always). Each row is an ordinary project; the batch page polls progress and zips finished MP4s.

## Phase 8a — admin panel

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase8a.zip && cd vidforge
npm install && git add -A && git commit -m "phase 8a: admin panel" && git push
```
No migration. Set the same `WORKER_ADMIN_TOKEN` (any long random string) in **Vercel** env vars and in the **VPS `.env`**,
then `pm2 restart vidforge-worker` on the VPS and Redeploy on Vercel. The System tab reads the worker's `/admin/status`.
Admin is the `/admin` link in the side nav (ADMIN role only). All financial actions ask for a reason and write a ledger row with the admin as actor.

## Phase 7b — create studio & result workspace

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase7b.zip && cd vidforge
npm install && git add -A && git commit -m "phase 7b: create studio, result workspace" && git push
```
No migration. Create is now 4 steps — 1 Idea & format (format picker with icons, search and recommended-setting chips),
2 Look & voice, 3 Characters & references (only when relevant), 4 Finishing & publish — with a sticky Summary & estimate
panel. Every option from before is still present.

## Phase 7a — brand & shell

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase7a.zip && cd vidforge
npm install && git add -A && git commit -m "phase 7a: brand kit, shell, landing" && git push
```
No migration. Routes: `/` = public landing (signed-in users are sent to `/create`), `/create` = studio, `/projects`, `/billing`, `/settings`.
Assets from the spec live in `apps/web/public/` (brand/, illustrations/, type-icons/). Light mode: set `data-theme="light"` on `<html>`.

## Phase 6 — accounts & credits

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase6.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase6
git add -A && git commit -m "phase 6: accounts and credits" && git push
```
Then on the VPS: `bash /var/www/vidforge/deploy/update-worker.sh`.

**Vercel env vars to add** (Settings → Environment Variables, then Redeploy):
`AUTH_SECRET` (any long random string), `APP_URL=https://app.y2ube.io`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
(Google Cloud → OAuth client, authorised redirect URI `https://app.y2ube.io/api/auth/google/callback`),
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (Razorpay dashboard → Webhooks →
URL `https://app.y2ube.io/api/webhooks/razorpay`, event `payment.captured`).

- **The first account to sign up becomes ADMIN** and sees every project (including the older ones made before accounts).
- Credits: 60 free at signup. Prices/plans live in `packages/shared/src/credits.ts` (`CREDIT_RATES`, `PLANS`).
- Flow: estimate shown live on the create form → reservation (estimate +15%) debited at Create → worker settles actual usage at completion and releases the rest → full refund if the job fails.
- Ledger is append-only (`CreditLedger`); `User.credits` is a cached balance. `/billing` shows plans, checkout and history.

## Phase 5a — deploy: web on Vercel, worker on the Hostinger VPS

**Once (Mac):** create a private GitHub repo `vidforge` and push:
```bash
cd ~/Desktop/Projects/vidforge
git init -b main && git add -A && git commit -m "VidForge"
git remote add origin git@github.com:jatin80542/vidforge.git   # or the https URL
git push -u origin main
```
`.env`, `storage/` and `logs/` are git-ignored — never commit them.

**Worker (VPS, as root):** add DNS A record `media.yourdomain.com → VPS IP`, then
```bash
git clone git@github.com:jatin80542/vidforge.git /var/www/vidforge   # or https
bash /var/www/vidforge/deploy/setup-worker-vps.sh media.yourdomain.com you@email.com
nano /var/www/vidforge/.env      # paste your Mac .env, apply deploy/env.worker.example changes
bash /var/www/vidforge/deploy/update-worker.sh
curl -s https://media.yourdomain.com/health     # → {"ok":true,...}
```
Updates later: push from the Mac, then on the VPS `bash /var/www/vidforge/deploy/update-worker.sh`.

**Web (Vercel):** see `deploy/VERCEL.md` (root directory `apps/web`, env `DATABASE_URL`, `WORKER_URL`).

## Phase 4m — native speech (lip-sync)

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase4m.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase4m && ./restart.sh
```
For AI-video projects in a characters mode, a **Speech** switch appears: *Our voices (TTS)* or **Native speech** — the
storyboard assigns each spoken line to an 8-second clip, Veo 3.1 renders the character saying it (lip-synced), and the
clip's own audio becomes the voice track (music is still mixed under it). A clip that comes back without speech gets TTS
for its line. Veo 3.1 is 16:9 only on SnapGen: vertical projects are generated centred and cropped.
Also: `narrationMode = characters_only` (no narrator at all), TTS model chosen per language (`eleven_v3` for Punjabi
and other languages multilingual_v2 lacks), look "Auto" = AI-chosen grade parameters, music generated in parallel
with visuals, `VOICE_CONCURRENCY` / `VIDEO_CONCURRENCY` / `IMAGE_CONCURRENCY` / `RENDER_PARALLEL` speed knobs.

## Phase 4j — spokesperson ads

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase4j.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase4j && ./restart.sh
```
Video type **Spokesperson ad (AI presenter)**: 9:16, 30 s, one consistent presenter (characters mode — describe them or
upload a face as a Character reference), Veo clips from the presenter's image, banners burned in: top headline with a
highlighted price/number in your accent colour, bottom CTA. Fill the banners under "Ad banners" on the create form.
Captions automatically sit above the bottom banner.

## Phase 4i — reference images

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase4i.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase4i && ./restart.sh
```
Upload up to 4 reference images on the create form (under "Voice, music, captions, logo"): **subject/product**
(must appear exactly), **character** (label = the story character's name), **location**, or **style frame** (match
look, not content). They are passed to nano-banana (SnapGen `files`, Kie `image_input`) and to Veo (`ingredient`
mode for text-to-video; image-to-video keeps the start frame). Note: Kie needs public URLs — on your Mac
(localhost) references work with SnapGen only; on the VPS with a public media domain they work everywhere.

## Phase 4h — video formats with playbooks

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase4h.zip && cd vidforge
npm install && ./restart.sh
```
Video type is now a **format** (26 of them, grouped: long-form, short-form, story & entertainment, business,
music-led). Each carries a playbook of what performs for that format — hook style, structure, re-hook cadence,
visual rhythm — which the writer and storyboarder follow, plus recommended settings (visual source, style, look,
music, captions, voice, narration mode, aspect ratio) that are applied when you pick it. Everything stays editable.

## Phase 4g — finishing looks

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase4g.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase4g
```
A **look** is applied at the final encode, before captions and logo: contrast curve, colour balance, sharpening,
vignette, fine grain and a slowly drifting warm light leak (screen-blended). Presets: YouTube Pop, Cinematic Movie
(default), Warm Film, Cool Thriller, Vintage, Vivid, Black & White, None. Intensity 20–130 % scales everything.
Changeable on the result page ("Adjust and render again"). Looks roughly double final-encode time.

## Phase 4f — styles, toggles, thumbnails, fonts

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase4f.zip && cd vidforge
npm install && npm run db:generate && npm run db:migrate -- --name phase4f
```
- **Visual styles**: 21 presets in a picker (Explainer: whiteboard, doodle sketch, line art, chalkboard, editorial infographic,
  business cartoon · Animation: flat 2D, adult cartoon, anime cinematic, storybook, 3D movie · Cinematic · Artistic).
  Styles marked "Aa" draw their labels inside the image (the storyboarder writes short labels for every shot).
- **Include toggles**: voiceover / captions / music / on-screen text; output quality 720p–4K; AI-video clip resolution.
- **Boxes in text** were emojis or missing glyphs: emojis are now stripped everywhere and fonts are chosen per script
  (Devanagari, Gurmukhi, Arabic, CJK). Ubuntu VPS: `apt install fonts-noto fonts-noto-cjk fonts-dejavu`.
- **Thumbnails**: DeepSeek writes 2-3-word hooks with a highlight word; rendered with big bold outlined text on the left
  55%, the emotional word in yellow, contrast/saturation boost — three variants per video.

## Phase 4d — AI video, publish kit, providers

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase4d.zip && cd vidforge
npm install
npm run db:generate
npm run db:migrate -- --name phase4d
```
Restart both terminals.

**Visual sources** now include *AI images + AI video for key shots* (first shot of each scene becomes an 8-second Veo clip
generated from its image, so characters stay consistent) and *AI video for every shot*. Video clips are expensive and slow
(minutes each) — test with 30-second projects. Settings: `SNAPGEN_VIDEO_MODEL` (veo-3.1-fast default), `VIDEO_CONCURRENCY`.

**Publish kit** (end of every run, or the *Regenerate* button on the result page): 3-5 SEO titles, description with hook +
chapter timestamps + CTA + hashtags, 15-25 tags, pinned comment, and two generated thumbnails with bold text.
For Hindi/Devanagari thumbnail text set `THUMBNAIL_FONT` to a font that has those glyphs
(Mac: `/System/Library/Fonts/Supplemental/Kohinoor.ttc`; Ubuntu: install `fonts-noto` and use
`/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf`).

**Providers** (`.env`): `VOICE_PROVIDER=elevenlabs|abhibots`, `IMAGE_PROVIDER=kie|abhibots|snapgen`. AI video uses SnapGen.

## Phase 4c — Kids Story mode

```bash
cd ~/Desktop/Projects && unzip -o ~/Downloads/vidforge-phase4c.zip && cd vidforge
npm install
npm run db:generate
npm run db:migrate -- --name phase4c
```

Pick **Video type: Kids Story**. Optionally describe your characters (name, looks, personality, voice hint) — or leave empty and
the AI invents them from the prompt. How it works:
1. DeepSeek creates the characters (precise visual descriptions) and writes the story as narrator + dialogue lines.
2. One reference image per character is generated first (full body, white background). Every shot that features a character
   sends that reference to the image model (`image_input`), so the character looks the same in every illustration.
3. Narrator lines use the Storytelling voice; each character gets its own voice, matched from the synced voice list by the
   character's voice hint (or a voice you choose). Lines are synthesized separately and joined per scene.
4. Characters are saved in a library (`Character` table) so the same hero can be reused in future stories.

Costs: one image per character + one image per shot (2-3 per scene). A 3-minute story ≈ 20-30 images.

## Phase 4b — install over your existing folder

```bash
cd ~/Desktop/Projects
unzip -o ~/Downloads/vidforge-phase4.zip
cd vidforge
npm install
npm run db:generate
npm run db:migrate -- --name phase4
npm run render:selftest -w apps/worker
```
Optional `.env` additions:
```
KIE_IMAGE_MODEL=nano-banana-2     # or nano-banana-2-lite (cheaper)
WORKER_URL=http://localhost:4000  # web → worker (logo uploads); on Vercel set to the VPS media URL
```

### Voice / image providers
```
VOICE_PROVIDER=abhibots          # or elevenlabs (default)
IMAGE_PROVIDER=abhibots          # or kie (default)
ABHIBOTS_API_KEY=abhi_live_...
```
AbhiBots gives ElevenLabs voices through its own API (credits per character) and nano-banana images (500 credits each).
It returns no word timestamps, so captions are timed by estimation (weighted by word length and punctuation) instead of
ElevenLabs' exact word timings — usually within a few tenths of a second. `npm run check -w apps/worker` shows the credit balance.

### What changed
- **Sync fix**: shot clips are always allowed to loop and are frame-padded, every scene is padded then cut to the
  exact narration slot, and the final mux uses an explicit length instead of `-shortest`. A shot that renders
  the wrong length now fails loudly instead of silently shortening the video.
- **Audio controls**: voice volume, music volume, ducking amount, fades, music on/off — on the create form and on the
  result screen ("Adjust and render again" re-renders in ~1 min per 5 min of video).
- **Visual sources**: *Stock videos only* (free), *AI images only* (Kie nano-banana, credits per image), or *Mixed*
  (stock video when a good match exists, AI image otherwise). AI image style selectable.
- **Channel logo**: upload PNG/JPG/WEBP, choose corner; overlaid at ~11% of frame width.
- **Voices**: the worker syncs the full ElevenLabs voice list into the DB (every 6 h); the form shows all voices with
  a preview button. Speaking speed slider.
- **Music**: style presets (Cinematic, Ambient, Corporate, …) feed the DeepSeek music prompt, or write a custom prompt.

## Phase 3+4 — install over your existing folder (done)

```bash
cd ~/Desktop/Projects
unzip -o ~/Downloads/vidforge-phase3.zip
cd vidforge
npm install
```
No database change in this phase. Optional in `.env`: `RENDER_PARALLEL=2` (parallel ffmpeg encoders).

Self-test the render engine on synthetic media (no API calls, ~10 s):
```bash
npm run render:selftest -w apps/worker
```
Expected last lines: `OK in …s → …/final.mp4 8.17s (expected 8.20s)` and a captions preview.
(The test builds its inputs in `/tmp/rt` — see README section "Self-test inputs" below.)

Then restart the worker and re-render an existing project: open it → **Regenerate** re-runs everything;
to render only, use the API: `curl -X POST localhost:3000/api/projects/<id>/render`.

### How rendering works
1. Each shot → normalized clip (target size, 30 fps, exact length + a small tail for its outgoing transition).
   Videos are trimmed (looped only if shorter than needed); photos get Ken Burns motion; missing media → title card.
2. Shots of a scene → one scene file with `xfade` transitions (cut / dissolve / fade-black / zoom / blur / slide).
3. Scenes → video track (stream copy, no quality loss).
4. Narration: each scene's voice padded to that scene's measured video length → locked sync scene by scene.
5. Music looped to length, faded, ducked under narration with a sidechain compressor, mixed, loudness-normalised (-16 LUFS).
6. Captions from ElevenLabs word timestamps → `captions.srt`, burned in with the chosen style if enabled.
7. Final H.264/AAC MP4 (faststart), thumbnail, `asset-report.json` with provenance for every asset.

### Self-test inputs
`render:selftest` expects these files in `/tmp/rt` (created once):
```bash
mkdir -p /tmp/rt && cd /tmp/rt
ffmpeg -y -f lavfi -i testsrc=size=640x360:rate=25 -t 3 -pix_fmt yuv420p clip1.mp4
ffmpeg -y -f lavfi -i smptebars=size=1920x1080:rate=30 -t 12 -pix_fmt yuv420p clip2.mp4
ffmpeg -y -f lavfi -i color=c=orange:s=1600x1200 -frames:v 1 photo.jpg
ffmpeg -y -f lavfi -i sine=frequency=440:duration=4 -ac 1 v0.mp3
ffmpeg -y -f lavfi -i sine=frequency=660:duration=3.5 -ac 1 v1.mp3
ffmpeg -y -f lavfi -i sine=frequency=220:duration=6 -ac 2 music.mp3
cd ~/Desktop/Projects/vidforge
```

## Phase 2 — install over your existing folder (done)

```bash
cd ~/Desktop/Projects
unzip -o ~/Downloads/vidforge-phase2.zip      # -o = overwrite, your .env is NOT in the zip
cd vidforge
npm install
brew install ffmpeg                            # needed to measure audio durations (skip if installed)
```

Add the keys to `.env` (`open -e .env`):

```
DEEPSEEK_API_KEY=sk-...        https://platform.deepseek.com
PEXELS_API_KEY=...             https://www.pexels.com/api/
ELEVENLABS_API_KEY=...         https://elevenlabs.io → Profile → API keys
KIE_API_KEY=...                https://kie.ai → API key
```

Also add these lines (optional, defaults shown):
```
DEEPSEEK_MODEL=deepseek-chat
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_VOICE_ID=
KIE_MODEL=V4_5
KIE_CALLBACK_URL=https://example.com/kie-callback
```

Update the database (adds `SearchCache` table and `Project.stats`):

```bash
npm run db:generate
npm run db:migrate -- --name phase2
```

Check every provider with one cheap call each:

```bash
npm run check -w apps/worker
```
All five lines must start with ✓.

Run:
```bash
npm run dev:worker      # terminal 1
npm run dev:web         # terminal 2
```

Create a **30-second** video first (cheap: ~2 DeepSeek calls, ~10 Pexels searches, ~2 voice segments, 1 music track).
The generation screen now shows live counters (words, shots, videos found…). The result screen shows the
script and the chosen stock footage per scene. Downloaded media lives in `apps/worker/storage/projects/<id>/`.

## Notes

- **Pexels rate limit**: free keys allow ~200 requests/hour. Searches are cached in the DB for 7 days; a 10-minute
  video uses roughly 100–200 searches. For heavy use request a higher limit from Pexels (free, via their form).
- **Music is optional**: if Kie fails twice the video continues without music and a warning is shown.
- **Resume**: a failed stage requeues from its checkpoint; already-generated scenes/segments/assets are reused.
- **Provenance**: every Pexels asset stores creator, source URL and license; voice/music store provider generation IDs.

## Commands

| Command | What it does |
|---|---|
| `npm run check -w apps/worker` | Test all API keys |
| `npm run db:migrate -- --name xyz` | Apply schema changes |
| `npm run db:studio` | Browse the database |
| `npm run dev:web` / `npm run dev:worker` | Run locally |
