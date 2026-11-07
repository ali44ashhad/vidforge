#!/bin/bash
# Pull latest code and (re)start the worker. Run as root:  bash /var/www/vidforge/deploy/update-worker.sh
set -e
cd /var/www/vidforge
git checkout -- package-lock.json 2>/dev/null; git pull --ff-only
npm install
npm run db:generate
pm2 startOrRestart deploy/worker.config.js --update-env
pm2 save
echo "--- worker log (last 15 lines)"; sleep 6; pm2 logs vidforge-worker --lines 15 --nostream
# pin ffmpeg to the Ubuntu build (has drawtext/freetype) and make sure the mixed-script fonts are present
grep -q '^FFMPEG_PATH=' /var/www/vidforge/.env || printf '\nFFMPEG_PATH=/usr/bin/ffmpeg\nFFPROBE_PATH=/usr/bin/ffprobe\n' >> /var/www/vidforge/.env
[ -f /var/www/vidforge/fonts/Mukta-ExtraBold.ttf ] || bash /var/www/vidforge/deploy/install-fonts.sh || true
