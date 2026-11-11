#!/usr/bin/env bash
# Redeploy latest code on the VPS:  ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build
docker image prune -f
docker compose ps
