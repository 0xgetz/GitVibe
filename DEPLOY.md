# Deploying GitVibe

GitVibe is a standard Next.js 15 app with a single SQLite file for the prompt library.
It self-hosts trivially.

## 1. Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up --build -d        # http://localhost:3000
```

- The SQLite DB lives in the named volume `gitvibe-data` (`/app/data` in the container), so it survives rebuilds.
- Logs: `docker compose logs -f gitvibe`
- Update: `git pull && docker compose up --build -d`

### With a bundled local LLM (Ollama)

```bash
docker compose --profile ollama up --build -d
docker exec -it gitvibe-ollama ollama pull qwen2.5-coder:7b
```

Then in `.env`: `OLLAMA_BASE_URL="http://ollama:11434"` (compose service name).
If instead you run Ollama on the host, uncomment the `extra_hosts` block in
`docker-compose.yml` and set `OLLAMA_BASE_URL="http://host.docker.internal:11434"`.

## 2. Bare metal / VPS

```bash
npm ci
npm run build
node .next/standalone/server.js     # honours PORT / HOSTNAME / DATABASE_URL
```

Put it behind nginx/Caddy and point a domain at it. Example Caddy:

```
gitvibe.example.com {
    reverse_proxy localhost:3000
}
```

Run it under a process manager (systemd, pm2) and persist `./data`.

### systemd unit

```ini
[Unit]
Description=GitVibe
After=network.target

[Service]
WorkingDirectory=/opt/gitvibe
Environment=PORT=3000
Environment=DATABASE_URL=file:/opt/gitvibe/data/gitvibe.db
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
User=gitvibe

[Install]
WantedBy=multi-user.target
```

## 3. Vercel / serverless

Works, with one caveat: SQLite needs a persistent filesystem, which serverless
platforms don't provide. For Vercel either:

- disable the prompt library (it degrades gracefully — generation/export still work), or
- swap the Drizzle driver to Postgres (Neon/Supabase). Change `src/lib/db/index.ts` to
  `drizzle-orm/postgres-js` and set `DATABASE_URL` to your Postgres URL. The schema in
  `src/lib/db/schema.ts` is dialect-portable; switch `sqliteTable` → `pgTable`.

## 4. Environment variables

See [`.env.example`](./.env.example). None are required to start. Add Git tokens to lift
rate limits and reach private repos, and at least one LLM key if you want AI architecture
summaries in Deep/Ultra mode.

## 5. Hardening

- Front it with HTTPS (Caddy/nginx/Cloudflare Tunnel).
- Keep the default per-IP rate limit (`RATE_LIMIT_MAX`) or lower it for public deployments.
- If exposing publicly, consider putting it behind your own auth proxy — GitVibe ships no
  user accounts by design (it's meant to be personal/self-hosted).
- Back up `./data/gitvibe.db` if you care about your saved prompts.

## Troubleshooting

- **`better-sqlite3` build errors** — ensure `python3`, `make`, `g++` are present (the
  Docker image installs them; on bare metal install build-essential).
- **GitHub 403 rate limit** — add `GITHUB_TOKEN`.
- **LLM provider not listed in UI** — it only appears once its key/URL is set in `.env`.
- **Empty analysis on a huge repo** — try a `subpath` (e.g. `apps/web`) or `Quick` mode.
