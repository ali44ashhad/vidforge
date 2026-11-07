# Academy: course generation in the background

Why: the DeepSeek outline takes 30–60 s, longer than a Vercel API route may run, so "Generate course with AI"
died before anything was saved.

Now:
1. Web `POST /api/academy/generate` checks credits, asks the worker to start a job, and returns in under a second.
2. Worker `POST /course-generate` (new, `apps/worker/src/courseJobs.ts`) runs DeepSeek in the background, then
   POSTs the outline to the web app's `POST /api/academy/materialize` (new, worker-token protected), which creates
   one project per lesson + the Lesson rows and reserves credits — the same code as before, just DB-only and fast.
3. The Academy page polls `GET /api/academy/generate?job=ID` every 5 s and shows the phase; lessons appear as
   soon as they are queued and fill in as each video renders. You can leave the page.

Files: apps/web/app/api/academy/generate/route.ts (rewritten), apps/web/app/api/academy/materialize/route.ts (new),
apps/web/components/AcademyGrid.tsx (rewritten), apps/worker/src/courseJobs.ts (new), deploy/patch-academy-worker.py.

## Install (Mac)
```bash
cd ~/Desktop/Projects
unzip -o ~/Downloads/vidforge-academy-background.zip
cd vidforge
python3 deploy/patch-academy-worker.py
grep -c registerCourseRoutes apps/worker/src/server.ts        # want 2
git add -A && git commit -m "academy: generate course on the worker in the background" && git push
```

## VPS
```bash
cd /var/www/vidforge && git checkout -- deploy/update-worker.sh package-lock.json; bash deploy/update-worker.sh
sleep 8; curl -s -o /dev/null -w "%{http_code}\n" -X POST https://media.y2ube.io/course-generate -H "Content-Type: application/json" -d '{}'
```
Want `401` (route exists; no token given). `404` = old code still running.

## Test
Wait for the Vercel build to go green, open Academy → Generate course with AI → topic → 8. The banner shows
"Designing the course with AI…" then "Saving the lessons…" then "Course created: 8 lessons…" and 8 cards at 0%.
Worker log: `pm2 logs vidforge-worker --lines 50 | grep academy`.

Optional env (Vercel): `APP_URL=https://app.y2ube.io` — only needed if the worker's callback ever fails with a
wrong host; by default the web app derives its own URL from the request.
