# Web on Vercel

1. Push the repo to GitHub (private).
2. Vercel → Add New Project → import the repo.
   - Root Directory: `apps/web`
   - Framework: Next.js (auto). `apps/web/vercel.json` sets install/build to run from the repo root so the
     workspace packages and Prisma client are built.
3. Environment variables (Production):
   - `DATABASE_URL` — the same Neon connection string as on the Mac
   - `WORKER_URL` — `https://media.yourdomain.com` (the worker domain on the VPS)
   - `NEXT_PUBLIC_APP_NAME` — VidForge
4. Deploy. Every `git push` to main redeploys.
Database migrations are run from the Mac (`npm run db:migrate -- --name …`) against Neon; Vercel and the VPS only
`db:generate` the client.
