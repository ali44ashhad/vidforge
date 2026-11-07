# Homepage videos from the database

Before: the landing page, login and signup read `apps/web/lib/tutorials.json`, which was never filled
(`{ "available": false, "items": [] }`), so every play button pointed at nothing.

Now: a finished video is featured by giving it a homepage slot in **Admin → Projects → Homepage** (a select on
every COMPLETED row). Slots: Hero demo, Product showreel, Lesson 01–06. One video per slot; picking a slot that is
taken moves it. The pages read `Project.showcaseSlot` on every visit — no JSON, no script, no redeploy.

Changed: schema (`showcaseSlot`), lib/showcase.ts (new), app/page.tsx, app/login + app/signup pages,
components/marketing/Academy.tsx, components/auth/AuthForm.tsx, admin projects page + API.
`tutorials.json` and `scripts/marketing-tutorials.ts` are no longer used (left in place).

## Install (Mac)
```bash
cd ~/Desktop/Projects
unzip -o ~/Downloads/vidforge-homepage-videos.zip
cd vidforge
npm run db:generate && npm run db:migrate -- --name homepage-showcase
ls packages/db/prisma/migrations | tail -1
git add -A && git commit -m "homepage videos from the database (showcaseSlot)" && git push
```
Wanted: the `ls` prints a folder ending in `_homepage-showcase`. No worker/VPS change needed.

## Use
Vercel build green → Admin → Projects → status filter COMPLETED → on a row, Homepage → pick a slot.
Open app.y2ube.io (logged out) → the video plays. Academy lessons from "Generate course with AI" show up
here too once rendered; feature six of them as Lesson 01–06.
