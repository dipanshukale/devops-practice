#!/usr/bin/env bash
# Run once on a fresh Ubuntu 22.04/24.04 VPS:  sudo bash scripts/setup-vps.sh
set -euo pipefail
apt-get update && apt-get -y upgrade
apt-get install -y ca-certificates curl ufw git
curl -fsSL https://get.docker.com | sh          # installs Docker Engine + compose plugin
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
ufw --force enable
echo "Done. Log out/in, then: docker compose up -d --build"
