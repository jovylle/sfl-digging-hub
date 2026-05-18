# Cloudflare setup (SFL Digging Hub)

Create these once per environment (start with **production**; add **beta** later if you want).

| Resource | Production name | Worker binding |
|----------|-----------------|----------------|
| Worker | `sfl-digging-hub-api` | — |
| D1 database | `sfl-digging-hub` | `DB` |
| R2 bucket | `sfl-digging-hub-screenshots` | `SCREENSHOTS` |
| Web (Vue) | Cloudflare **Pages** project | — |

Suggested hostnames (DNS on `d1g.uk`):

| Service | Hostname |
|---------|----------|
| Hub UI | `hub.d1g.uk` |
| API | `api.d1g.uk` |

---

## 0. Prerequisites

- Cloudflare account with **d1g.uk** (or your zone) added.
- Node.js 20+ and this repo installed: `npm install` from repo root.
- Wrangler CLI (included in `workers/`): `cd workers && npx wrangler --version`

---

## 1. Log in to Cloudflare

```bash
cd workers
npx wrangler login
npx wrangler whoami
```

Note your **Account ID** from the [Cloudflare dashboard](https://dash.cloudflare.com/) (right sidebar on any zone) — you may need it in `wrangler.toml` as `account_id = "..."` if deploy fails.

---

## 2. Create D1 database

```bash
cd workers
npx wrangler d1 create sfl-digging-hub
```

Wrangler prints something like:

```text
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy that ID** into `workers/wrangler.toml`:

- Under `[[d1_databases]]` → `database_id = "..."` (replace the placeholder)
- Under `[env.production.d1_databases]]` if you use the production env block

List databases to verify:

```bash
npx wrangler d1 list
```

---

## 3. Apply D1 schema (migrations) on Cloudflare

From `workers/`:

```bash
npx wrangler d1 migrations apply sfl-digging-hub --remote
```

Local dev (optional, separate SQLite file):

```bash
npm run db:migrate:local
```

---

## 4. Create R2 bucket

```bash
cd workers
npx wrangler r2 bucket create sfl-digging-hub-screenshots
```

List buckets:

```bash
npx wrangler r2 bucket list
```

> R2 bucket names are **global** on Cloudflare. If the name is taken, use e.g. `sfl-digging-hub-screenshots-jovylle` and update `bucket_name` in `wrangler.toml` to match.

Enable R2 in the dashboard if prompted: **R2 → Overview → Enable R2**.

---

## 5. Set production vars and deploy the Worker (API)

Edit `workers/wrangler.toml` `[env.production.vars]` (or root `[vars]` if you deploy without `--env`):

```toml
CORS_ORIGINS = "https://d1g.uk,https://beta.d1g.uk,https://development.d1g.uk,https://hub.d1g.uk"
HUB_BASE_URL = "https://hub.d1g.uk"
API_BASE_URL = "https://api.d1g.uk"
```

Deploy:

```bash
cd workers
npx wrangler deploy --env production
```

Or from repo root:

```bash
npm run cf:deploy
```

Smoke test (replace host if you use workers.dev URL first):

```bash
curl https://api.d1g.uk/health
```

---

## 6. Custom domain for the API (`api.d1g.uk`)

**Dashboard:** Workers & Pages → **sfl-digging-hub-api** → Settings → **Domains & Routes** → Add Custom Domain → `api.d1g.uk`.

Or CLI (Wrangler 3+):

```bash
cd workers
npx wrangler deploy --env production
# Then attach route in dashboard: api.d1g.uk/*
```

DNS: Cloudflare usually adds the record automatically when the zone is on CF.

---

## 7. Deploy the web UI (Cloudflare Pages)

### Option A — Git-connected Pages (recommended)

1. Push this repo to GitHub.
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Project name: e.g. `sfl-digging-hub-web`.
4. Build settings:
   - **Root directory:** `/` (repo root)
   - **Build command:** `npm ci && npm run build -w @sfl-digging-hub/shared && npm run build -w @sfl-digging-hub/web`
   - **Build output directory:** `apps/web/dist`
5. **Environment variables** (Production):
   - `VITE_API_BASE` = `https://api.d1g.uk`  
     (browser calls API directly; CORS must include `https://hub.d1g.uk`)
6. Deploy → **Custom domains** → add `hub.d1g.uk`.

### Option B — Manual deploy from CLI

```bash
npm run build -w @sfl-digging-hub/shared
VITE_API_BASE=https://api.d1g.uk npm run build -w @sfl-digging-hub/web
npx wrangler pages deploy apps/web/dist --project-name=sfl-digging-hub-web
```

Then attach `hub.d1g.uk` in the Pages project.

---

## 8. Beta environment (optional)

Create separate resources:

```bash
npx wrangler d1 create sfl-digging-hub-beta
npx wrangler r2 bucket create sfl-digging-hub-screenshots-beta
```

Put the new D1 `database_id` in `[env.beta]` in `wrangler.toml`, then:

```bash
npx wrangler d1 migrations apply sfl-digging-hub-beta --remote --env beta
npx wrangler deploy --env beta
```

Use `hub-beta.d1g.uk` / `api-beta.d1g.uk` (or similar) and matching `CORS_ORIGINS` / `HUB_BASE_URL`.

---

## 9. Checklist

- [ ] `wrangler login` works
- [ ] D1 `sfl-digging-hub` created, `database_id` in `wrangler.toml`
- [ ] Migrations applied `--remote`
- [ ] R2 `sfl-digging-hub-screenshots` created
- [ ] Worker deployed, `/health` returns `{"ok":true}`
- [ ] `api.d1g.uk` → Worker
- [ ] Pages built with `VITE_API_BASE=https://api.d1g.uk`
- [ ] `hub.d1g.uk` → Pages
- [ ] CORS includes `https://d1g.uk` and `https://hub.d1g.uk`

---

## 10. Troubleshooting

| Problem | Fix |
|---------|-----|
| `database_id` invalid | Re-copy from `wrangler d1 list` after `d1 create` |
| CORS errors from d1g.uk | Add exact origin to `CORS_ORIGINS`, redeploy Worker |
| 404 on `/v1/...` from Pages | API is on **Worker**, not Pages — use `VITE_API_BASE=https://api.d1g.uk` |
| R2 upload fails | Confirm bucket name matches `wrangler.toml`; R2 enabled on account |
| D1 empty in prod | Run `migrations apply ... --remote`, not only `--local` |

---

## Quick script

After `wrangler login` and editing `database_id` in `wrangler.toml`:

```bash
npm run cf:setup
npm run cf:deploy
```

See `workers/scripts/cf-setup.sh`.
