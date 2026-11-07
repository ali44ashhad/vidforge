#!/bin/bash
# One-time setup of the VidForge WORKER on the existing Hostinger VPS (Ubuntu 24.04, nginx + pm2 already present).
# Run as root:  bash setup-worker-vps.sh media.yourdomain.com you@email.com
set -e
DOMAIN="${1:?usage: setup-worker-vps.sh <worker-domain> <email>}"; EMAIL="${2:?usage: setup-worker-vps.sh <worker-domain> <email>}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y zip ffmpeg fonts-noto fonts-noto-cjk fonts-dejavu fonts-lohit-deva git certbot python3-certbot-nginx
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs; }
command -v pm2 >/dev/null || npm install -g pm2
mkdir -p /opt/vidforge-storage
# nginx: the worker domain proxies everything (files, uploads, publish-kit endpoints) to port 4000
cat > /etc/nginx/sites-available/vidforge-worker << NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 50m;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header Range \$http_range;
        proxy_read_timeout 600;
        add_header Access-Control-Allow-Origin * always;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/vidforge-worker /etc/nginx/sites-enabled/vidforge-worker
nginx -t && systemctl reload nginx
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect || echo "certbot failed — make sure the A record for ${DOMAIN} points to this VPS, then rerun: certbot --nginx -d ${DOMAIN}"
ffmpeg -hide_banner -filters 2>/dev/null | grep -cE " (drawtext|subtitles|xfade|zoompan) " | xargs -I{} echo "ffmpeg filters OK: {} (expect 4+)"
echo "Worker VPS ready. Next: git clone the repo to /var/www/vidforge and run deploy/update-worker.sh"
