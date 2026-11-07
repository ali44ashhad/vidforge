#!/bin/bash
# Kills every VidForge dev process and starts exactly one worker + one web server.
cd "$(dirname "$0")"
pkill -9 -f "tsx watch" 2>/dev/null; pkill -9 -f "apps/worker/src/index.ts" 2>/dev/null; pkill -9 -f "next dev" 2>/dev/null
sleep 2
for p in 3000 3001 4000; do lsof -i :$p -t 2>/dev/null | xargs kill -9 2>/dev/null; done
sleep 1
mkdir -p logs
nohup npm run dev:worker > logs/worker.log 2>&1 &
nohup npm run dev:web    > logs/web.log    2>&1 &
sleep 12
echo "--- worker"; grep -E "ffmpeg OK|listening|synced|released|claimed|EADDRINUSE" logs/worker.log | tail -6
echo "--- web";    grep -E "Ready|Local:|EADDRINUSE" logs/web.log | tail -3
