# SFL Digging Hub

**This repo is the work:** product spec, milestones, and implementation for **save, replay, journal, community, and uploads** — everything that is *not* “play today’s grid on d1g.uk.”

**Context:** [sfl-crab](https://github.com/jovylle/sfl-crab) / **d1g.uk** is already successfully focused on **digging only** (assistant + thin Save/Share to the hub). The hub is the **new** codebase and deploy surface for history and social features.

**GitHub:** https://github.com/jovylle/sfl-digging-hub

---

## 1. Split of responsibilities

### sfl-crab (d1g.uk)

- Desert dig assistant: 10×10 grid, hints, land sync, practice mode, today’s patterns, dig stats, treasure order badges.
- Netlify + SFL API proxy (API key stays on this side).
- **Thin integration only:** “Save / Share” sends a snapshot payload to the hub API; optional silent private save after sync.
- Stays small and fast — the “known thing” players already trust.

### sfl-digging-hub (this repo)

- Persistence for digs that are **no longer** on the SFL API (history).
- Cloudflare Workers + D1 + R2: snapshots, journal, community feed, comments, screenshot / brag-card storage.
- **Full UI** for: `/replay/:id`, `/journal`, `/community`, comments, uploads.
- Own deploy cadence (e.g. beta first) without bloating the dig app.

**Rule:** The hub never scrapes SFL for past days. It only stores what the dig app (or the user) sends after a successful sync / share.

---

## 2. Why a second repo

- Deploy independently — ship beta hub without touching prod dig.
- Different stack — Workers, D1, R2 vs Vue/Vite on Netlify.
- Clear mental model: **“Dig on d1g.uk, stories on the hub.”**

---

## 3. How the two apps talk (data flow)

1. Player uses d1g.uk — land data loads from SFL (today only).
2. Dig app builds an ordered **dig timeline** from `farm.desert.digging.grid`  
   Fields: `dugAt`, `x`, `y`, `items`, `tool`. Grouped Sand Drill hits share `dugAt`.
3. On Share (and optionally on sync, default **private**), dig app:  
   `POST https://api.<your-domain>/v1/snapshots`  
   Body: `patterns[]`, `digs[]` (ordered), minimal stats, optional manual marks.
4. Hub responds with: `id`, `editToken`, and a URL like `https://hub.d1g.uk/replay/<id>` (exact subdomain is your choice).
5. Replay, journal, community, comments, images — all in sfl-digging-hub.

ASCII flow:

```
[ d1g.uk / sfl-crab ]                    [ sfl-digging-hub ]
      |                                          |
      +---- Netlify proxy ----> SFL API (today)  |
      |                                          |
      +---- HTTPS JSON ----------------> Workers --+--> D1 (snapshots, comments)
      |                                   |      +--> R2 (screenshots)
      +---- open link in new tab ------> Hub web UI reads same API
```

---

## 4. Naming (align with your repo)

- **GitHub:** https://github.com/jovylle/sfl-digging-hub
- **Public URL ideas under d1g.uk:**  
  - `hub.d1g.uk` — short, matches “hub”  
  - `digging-hub.d1g.uk` — very literal
- **API (boring is good):** `api.d1g.uk/v1/...` — single API host; path-prefix for hub routes
- **CORS:** allowlist `d1g.uk`, `beta.d1g.uk`, `development.d1g.uk`, `localhost`

---

## 5. Hub backend (what lives in sfl-digging-hub)

### D1 — snapshots table (conceptual columns)

`id`, `utc_date` (YYYY-MM-DD), `land_id_hash` (never raw land id in public queries), `display_name`, `patterns_json`, `digs_json`, `stats_json`, `marks_json` (optional), `visibility` (`private` | `unlisted` | `public`), `screenshot_key` (R2), `edit_token_hash`, `created_at`, `updated_at`  
**Unique:** `(land_id_hash, utc_date)` for upsert per land per UTC day.

### D1 — comments table

`id`, `snapshot_id`, `display_name`, `body`, `dig_ref` (optional dig order #), `created_at` — plus rate limiting / moderation hooks.

### R2

Screenshots and generated brag-card images.

### Worker routes (conceptual)

- `POST` / `PATCH` / `GET` — `/v1/snapshots`
- `GET` — `/v1/snapshots/mine` (journal: land + token)
- `GET` — `/v1/community` (public feed by date)
- `POST` / `GET` — `/v1/snapshots/:id/comments`
- `POST` — `/v1/snapshots/:id/screenshot`

### Security

- Do **not** persist full farm JSON (inventory, coins, balance, etc.).
- Only desert digging slice + patterns + safe stats.
- v1 auth: edit token for snapshot owner; comments = nickname + IP rate limit.

---

## 6. Hub frontend + repo layout (suggested)

```
sfl-digging-hub/
  apps/web/           # Vue (or similar) — replay, journal, community
  packages/shared/    # optional: dig timeline types + small client SDK
  workers/            # Cloudflare Worker, wrangler.toml, D1 migrations
```

**Key pages**

- Replay player: play / pause / step / speed; read-only grid + order badges
- Journal: list my saved days (token + land)
- Community: public feed by date
- Comments on replay; optional `dig_ref` to pin “dig #3”

---

## 7. What to share with sfl-crab (avoid duplicate logic forever)

From sfl-crab today, the **ordering** logic lives in `Digging.vue`:

- Flatten `digging.grid`, sort by `dugAt`, assign 1-based dig numbers; grouped tiles same timestamp = one dig number.

**Long term:** extract `buildDigTimeline(rawGrid)` into a tiny shared module **or** duplicate once into hub until you publish a shared package.

Hub does **not** need `useGridEngine` for v1 replay — a read-only replay grid is enough.

---

## 8. Milestones (transfer-friendly checklist)

- [x] 1. Scaffold sfl-digging-hub: Worker + D1 migration + health + CORS
- [x] 2. Snapshot POST/GET + minimal “replay JSON loads” page
- [x] 3. Hub UI: replay viewer + journal list
- [ ] 4. sfl-crab PR: Share button → POST snapshot, open hub URL
- [x] 5. Community feed + comments + R2 upload (API; brag card UI later)
- [ ] 6. Brag card PNG + Open Graph for Discord links
- [ ] 7. Beta deploy on chosen subdomain; then prod

## Development

```bash
npm install
npm run db:migrate:local   # apply D1 schema locally
npm run dev:api            # Worker on http://127.0.0.1:8787
npm run dev                # Web on http://localhost:5173 (proxies /v1 to API)
```

**Cloudflare (D1, R2, one Worker for API + UI):** see **[docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md)** — Workers static assets, not Pages.

**Domains:** beta first → **[docs/DOMAINS.md](docs/DOMAINS.md)** (`beta.hub.d1g.uk`, `beta.api.d1g.uk`).

**Layout:** `workers/` (API), `apps/web/` (Vue UI), `packages/shared/` (types + `buildDigTimeline`).

---

## 9. Contributor one-liners per repo

**sfl-crab:** “Community and replay history live in sfl-digging-hub; this repo is the desert dig assistant only.”

**sfl-digging-hub:** “Ingests dig snapshots from d1g.uk; does not replace the SFL API for live play.”

---

## 10. Elevator pitch for the hub

> SFL Digging Hub — save, replay, and share desert digs when the game API only shows today.
