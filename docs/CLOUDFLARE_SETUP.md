# Cloudflare setup (SFL Digging Hub)

**One Worker** hosts everything:

- **API** — `/health`, `/v1/...` (D1 + R2 bindings)
- **Hub UI** — Vue SPA via **Workers static assets** (not Cloudflare Pages)

Cloudflare is moving new full-stack / static sites onto Workers; Pages is legacy for greenfield work like this.

| Resource | Production name | Binding |
|----------|-----------------|---------|
| Worker | `sfl-digging-hub-api` | — |
| D1 | `sfl-digging-hub` | `DB` |
| R2 | `sfl-digging-hub-screenshots` | `SCREENSHOTS` |
| Static UI | `apps/web/dist` (built at deploy) | `ASSETS` |

**Domains** (both can point at the **same** Worker):

| Hostname | Serves |
|----------|--------|
| `hub.d1g.uk` | SPA + `/v1` (same origin — no CORS for hub UI) |
| `api.d1g.uk` | API (for d1g.uk Share POSTs; CORS allowlisted) |

---

## 0. Prerequisites

- Cloudflare account with **d1g.uk** on Cloudflare DNS.
- Node.js 20+, repo cloned, `npm install` at repo root.

---

## 1. Log in

```bash
cd workers
npx wrangler login
npx wrangler whoami
```

If deploy fails with account errors, set `account_id` in `workers/wrangler.toml` from the dashboard sidebar.

---

## 2. Create D1

```bash
cd workers
npx wrangler d1 create sfl-digging-hub
npx wrangler d1 list
```

Copy `database_id` into `workers/wrangler.toml`:

- `[[d1_databases]]`
- `[[env.production.d1_databases]]`

Apply schema remotely:

```bash
npx wrangler d1 migrations apply sfl-digging-hub --remote --env production
```

---

## 3. Create R2

```bash
npx wrangler r2 bucket create sfl-digging-hub-screenshots
```

If the name is taken globally, pick another and update `bucket_name` in `wrangler.toml`.

---

## 4. Build UI + deploy Worker

From repo root:

```bash
npm run cf:deploy
```

This runs `build:ui` (shared + Vue → `apps/web/dist`) then `wrangler deploy --env production`.

Or manually:

```bash
npm run build -w @sfl-digging-hub/shared
npm run build -w @sfl-digging-hub/web
cd workers && npx wrangler deploy --env production
```

Smoke tests:

```bash
curl https://api.d1g.uk/health
curl -I https://hub.d1g.uk/
```

---

## 5. Custom domains

**Workers & Pages** → **sfl-digging-hub-api** → **Settings** → **Domains & Routes**:

- `hub.d1g.uk`
- `api.d1g.uk`

Same Worker, two hostnames.

Production vars in `wrangler.toml` should match:

```toml
HUB_BASE_URL = "https://hub.d1g.uk"
API_BASE_URL = "https://api.d1g.uk"
CORS_ORIGINS = "https://d1g.uk,https://beta.d1g.uk,https://development.d1g.uk,https://hub.d1g.uk"
```

---

## 6. Branch → domain deploy

| Branch | Domains | npm script |
|--------|---------|------------|
| `master` | `hub.d1g.uk`, `api.d1g.uk` | `npm run cf:deploy:production` |
| `development` | `beta.hub.d1g.uk`, `beta.api.d1g.uk` | `npm run cf:deploy:beta:only` |

Full details: **[DOMAINS.md](DOMAINS.md)**.

### Option A — GitHub Actions (recommended)

Workflow: `.github/workflows/deploy.yml`. Add `CLOUDFLARE_API_TOKEN` (and optionally `CLOUDFLARE_ACCOUNT_ID`) as GitHub Actions secrets. Turn off Cloudflare Worker **Builds** auto-deploy if you use Actions only.

### Option B — Cloudflare Workers Builds

**Workers & Pages** → Worker → **Settings** → **Builds** → connect `jovylle/sfl-digging-hub`

| Setting | Value |
|---------|--------|
| **Production branch** | `master` |
| **Root directory** | `/` (repo root) |
| **Build command** | `npm ci && npm run build -w @sfl-digging-hub/shared && npm run build -w @sfl-digging-hub/web` |
| **Deploy command** | `npm run cf:deploy:production` |
| **Non-production branch builds** | Enabled |
| **Non-production branch deploy command** | `npm run cf:deploy:beta:only` |

Use `wrangler deploy` (via the scripts above), not bare `versions upload`, so custom domains get the new version.

Repo root `wrangler.toml` is the config Cloudflare Git expects (not `workers/wrangler.toml` alone).

No separate Pages project. The Vue `dist` folder is uploaded as **Worker assets** via `wrangler.toml` `[assets]`.

**Build-time env (optional):** if UI and API share `hub.d1g.uk`, leave `VITE_API_BASE` unset (see `apps/web/.env.production.example`).

---

## 7. How routing works

```
Request
  ├─ /health, /v1/*  → Worker TypeScript (D1, R2)
  └─ GET /*           → ASSETS (Vue SPA, SPA fallback for /replay/:id)
```

Local dev (unchanged):

- `npm run dev:api` — Worker on :8787
- `npm run dev` — Vite on :5173 (proxies `/v1` to Worker)

To test assets locally, build UI first then `cd workers && npm run build:ui && npx wrangler dev`.

---

## 8. Beta (optional)

```bash
npx wrangler d1 create sfl-digging-hub-beta
npx wrangler r2 bucket create sfl-digging-hub-screenshots-beta
```

Update `[env.beta]` IDs in `wrangler.toml`, migrate, deploy:

```bash
npm run build -w @sfl-digging-hub/shared
npm run build -w @sfl-digging-hub/web
cd workers && npx wrangler d1 migrations apply sfl-digging-hub-beta --remote --env beta
npx wrangler deploy --env beta
```

---

## 9. Checklist

- [ ] D1 created, `database_id` in `wrangler.toml`
- [ ] Migrations applied `--remote --env production`
- [ ] R2 bucket created
- [ ] `npm run cf:deploy` succeeds
- [ ] `/health` on `api.d1g.uk`
- [ ] `hub.d1g.uk` loads the hub UI
- [ ] `hub.d1g.uk/replay/...` SPA works (assets `single-page-application` mode)
- [ ] CORS includes `https://d1g.uk` for Share from crab

---

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| Deploy: *Missing entry-point to Worker script* | Set deploy command to `npm run cf:upload:production` (or beta), not bare `npx wrangler versions upload` from repo root |
| Hub UI 404 | Run `npm run build -w @sfl-digging-hub/web` before deploy; check `[assets] directory` |
| `/replay` refresh 404 | `not_found_handling = "single-page-application"` in `wrangler.toml` |
| CORS from d1g.uk | Add origin to `CORS_ORIGINS`, redeploy |
| `ASSETS` binding missing | Deploy with Wrangler 3.57+ / 4.x and `[assets]` block |

---

## Quick script

```bash
npm run cf:setup    # D1 + R2 create (after wrangler login)
# paste database_id into wrangler.toml
npm run cf:migrate:remote
npm run cf:deploy
```
