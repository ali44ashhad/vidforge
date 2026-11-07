#!/bin/bash
# Cron every 5 min on the VPS: */5 * * * * /var/www/vidforge/deploy/watchdog.sh >> /var/log/vidforge-watchdog.log 2>&1
# Restarts the worker if /health fails, and emails ADMIN_EMAIL (via RESEND_API_KEY from .env) when it had to.
set -u
ENV=/var/www/vidforge/.env
get() { grep -E "^$1=" "$ENV" | tail -1 | cut -d= -f2- | tr -d '"'; }
URL="$(get STORAGE_PUBLIC_URL)/health"
if curl -fsS -m 10 "$URL" | grep -q '"ok":true'; then exit 0; fi
echo "$(date -Is) worker unhealthy at $URL — restarting"
pm2 restart vidforge-worker >/dev/null 2>&1 || pm2 start /var/www/vidforge/deploy/worker.config.js >/dev/null 2>&1
sleep 15
STATUS=$(curl -fsS -m 10 "$URL" 2>/dev/null || echo "still down")
KEY="$(get RESEND_API_KEY)"; TO="$(get ADMIN_EMAIL)"; FROM="$(get EMAIL_FROM)"
if [ -n "$KEY" ] && [ -n "$TO" ]; then
  curl -s -X POST https://api.resend.com/emails -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "{\"from\":\"${FROM:-Y2ube <no-reply@y2ube.io>}\",\"to\":\"$TO\",\"subject\":\"Y2ube worker was restarted\",\"html\":\"<p>The worker failed its health check at $(date -Is) and was restarted. Current: $STATUS</p>\"}" >/dev/null
fi
