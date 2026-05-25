# Domains (beta first, production later)

## Beta / staging (use now)

| Hostname | Worker | Purpose |
|----------|--------|---------|
| **beta.hub.d1g.uk** | `sfl-digging-hub-api-beta` | Hub UI + same-origin `/v1` |
| **beta.api.d1g.uk** | `sfl-digging-hub-api-beta` | API for Share from `development.d1g.uk` / `beta.d1g.uk` |

Separate **D1** (`sfl-digging-hub-beta`) and **R2** so staging data is not mixed with production.

### 1. Deploy the beta Worker

```bash
cd workers
npm run deploy:beta
```

Or from repo root: `npm run cf:deploy:beta`

This registers `beta.hub.d1g.uk` and `beta.api.d1g.uk` from `wrangler.toml` routes (zone `d1g.uk` must be on Cloudflare).

### 2. Migrations (beta D1, once)

```bash
cd workers
npx wrangler d1 migrations apply sfl-digging-hub-beta --remote --env beta
```

### 3. DNS

If Wrangler did not create records automatically:

**DNS → d1g.uk → Records**

| Type | Name | Target |
|------|------|--------|
| CNAME | `beta.hub` | `sfl-digging-hub-api-beta.<account>.workers.dev` (or value shown in Worker → Domains) |
| CNAME | `beta.api` | same Worker |

Often Cloudflare adds these when you attach **Custom domains** on the Worker.

### 4. Verify

```bash
curl https://beta.api.d1g.uk/health
curl -I https://beta.hub.d1g.uk/
```

Browser: https://beta.hub.d1g.uk/

### 5. Secrets (dashboard)

Set on **beta** Worker (and Netlify for d1g.uk):

- `HUB_WRITE_SECRET` — shared with Netlify `HUB_WRITE_SECRET` (dig-day proxy)
- `GOOGLE_CLIENT_ID` — in `wrangler.toml` / `packages/shared/src/googleOAuth.ts` (public; comment sign-in)

### 6. Git deploy (Cloudflare dashboard)

Until production is ready, set **Deploy command** to:

```bash
cd workers && npx wrangler deploy --env beta
```

Keep the same **Build command** (`npm ci` + build shared + web).

---

## Production (later)

| Hostname | Worker |
|----------|--------|
| hub.d1g.uk | `sfl-digging-hub-api` |
| api.d1g.uk | `sfl-digging-hub-api` |

1. Uncomment `[[env.production.routes]]` in `workers/wrangler.toml` (or add domains in dashboard).
2. `npm run cf:deploy` (or `wrangler deploy --env production`).
3. Switch Git **Deploy command** back to `--env production`.

---

## d1g.uk integration (milestone 4)

Point Share POST at:

```text
https://beta.api.d1g.uk/v1/snapshots
```

while testing; use `https://api.d1g.uk/v1/snapshots` after production cutover.
