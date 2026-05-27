# Domains and branches

| Git branch | Worker | Hub UI | API |
|------------|--------|--------|-----|
| **master** | `sfl-digging-hub-api` | https://hub.d1g.uk | https://api.d1g.uk |
| **development** | `sfl-digging-hub-api-beta` | https://beta.hub.d1g.uk | https://beta.api.d1g.uk |

Beta uses separate **D1** (`sfl-digging-hub-beta`) and **R2** so staging data is not mixed with production.

---

## Automatic deploy (GitHub Actions)

Pushes to `master` or `development` run [.github/workflows/deploy.yml](../.github/workflows/deploy.yml).

**One-time setup**

1. Cloudflare dashboard → **My Profile** → **API Tokens** → create token with **Edit Cloudflare Workers** (and account read).
2. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → add `CLOUDFLARE_API_TOKEN`.
3. If `account_id` is not in `wrangler.toml`, also add `CLOUDFLARE_ACCOUNT_ID`.

**Disable Cloudflare “Builds” auto-deploy** on the Worker if you use Actions only (otherwise you may deploy twice).

```bash
# Manual deploy (same as CI)
npm ci && npm run build -w @sfl-digging-hub/shared && npm run build -w @sfl-digging-hub/web
npm run cf:deploy:production   # master / prod
npm run cf:deploy:beta:only      # development / beta
```

---

## Cloudflare Workers Builds (alternative to Actions)

Same branch mapping in the dashboard (**Workers** → your project → **Settings** → **Builds**):

| Setting | Value |
|---------|--------|
| **Production branch** | `master` |
| **Build command** | `npm ci && npm run build -w @sfl-digging-hub/shared && npm run build -w @sfl-digging-hub/web` |
| **Deploy command** | `npm run cf:deploy:production` |
| **Non-production branch builds** | Enabled |
| **Non-production branch deploy command** | `npm run cf:deploy:beta:only` |

Use `wrangler deploy` (not bare `versions upload`) so the branch updates the **live** custom domains.

Only connect **one** Worker project in Git, or use Actions instead—both `production` and `beta` envs deploy different Worker **names** from the same repo root `wrangler.toml`.

---

## First-time / migrations

**Production D1** (once, from repo root):

```bash
npm run cf:migrate:production
```

**Beta D1** (once):

```bash
npm run cf:migrate:beta
```

Migrations live in `workers/migrations/` (root `wrangler.toml` sets `migrations_dir`). From `workers/` you can also run `npm run cf:migrate -w @sfl-digging-hub/worker`.

---

## Verify

```bash
curl https://api.d1g.uk/health
curl -I https://hub.d1g.uk/

curl https://beta.api.d1g.uk/health
curl -I https://beta.hub.d1g.uk/
```

---

## Secrets (not in git)

Set on **each** Worker in Cloudflare (or `workers/.dev.vars` locally):

- `HUB_WRITE_SECRET` — shared with Netlify on d1g.uk (dig-day proxy)
- `GOOGLE_CLIENT_ID` — also in `wrangler.toml` / `packages/shared/src/googleOAuth.ts` (public)
- `GOOGLE_CLIENT_SECRET` — server-side Google OAuth code exchange secret
- `GOOGLE_REDIRECT_URI` — callback URL (`https://beta.api.d1g.uk/v1/auth/google/callback` or prod)
- `JWT_SECRET` — signs Bearer JWT returned by `/v1/auth/otp/verify` and Google auth
- `OTP_RESEND_API_KEY` — API key for OTP email delivery (Resend)
- `OTP_EMAIL_FROM` — sender identity for OTP email, e.g. `Digging Hub <auth@d1g.uk>`

---

## d1g.uk Share URLs

| Environment | Snapshot POST |
|-------------|----------------|
| Production (`master`) | `https://api.d1g.uk/v1/snapshots` |
| Beta (`development`) | `https://beta.api.d1g.uk/v1/snapshots` |
