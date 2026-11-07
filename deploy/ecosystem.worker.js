// pm2 process for the VidForge worker on the VPS (web runs on Vercel)
module.exports = {
  apps: [
    { name: "vidforge-worker", cwd: "/var/www/vidforge/apps/worker", script: "npx", args: "tsx src/index.ts",
      env: { NODE_ENV: "production" }, max_memory_restart: "3G", restart_delay: 5000, time: true },
  ],
};
