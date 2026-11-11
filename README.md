# Pulsewatch

Uptime monitor. Node 20 + Express + TypeScript API, React 18 + Vite + TypeScript UI.
Deployed with Docker Compose: `app` (Node) behind `caddy` (reverse proxy + automatic HTTPS).

## Local
    cd server && npm i && npm run dev     # :3000
    cd client && npm i && npm run dev     # :5173
Or: `docker compose up --build` then open http://localhost (DOMAIN defaults to :80).

## Deploy on an Ubuntu VPS
1. **DNS** (skip if using only the IP): create an A record `pulsewatch.example.com` -> VPS IP.
2. **Server setup** (once):
       ssh root@VPS_IP
       git clone <your-repo-url> pulsewatch && cd pulsewatch
       sudo bash scripts/setup-vps.sh
3. **Configure**: `cp .env.example .env` and set `DOMAIN=pulsewatch.example.com`
   (leave empty to serve http://VPS_IP).
4. **Start**: `docker compose up -d --build`
5. **Verify**: `docker compose ps`, `docker compose logs -f caddy`, open `https://your-domain`.
6. **Update later**: `./scripts/deploy.sh`

## Useful ops commands
    docker compose logs -f app
    docker compose exec app wget -qO- localhost:3000/metrics    # metrics (blocked publicly by Caddy)
    docker run --rm -v pulsewatch_pulsewatch-data:/d -v $PWD:/b alpine tar czf /b/backup.tgz -C /d .   # backup data

## Notes
- Only Caddy publishes ports (80/443). The app is reachable only on the internal Docker network.
- Keep the `caddy-data` volume, it holds your TLS certificates (Let's Encrypt rate limits apply).
- Env: `CHECK_INTERVAL_MS`, `DATA_FILE`, `PUBLIC_DIR`, `PORT`.
- Security: the monitor fetches user-supplied URLs (SSRF). Add auth before sharing publicly, e.g. Caddy `basicauth`.
