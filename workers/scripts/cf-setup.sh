#!/usr/bin/env bash
# Create Cloudflare D1 + R2 for production (run after: wrangler login)
set -euo pipefail
cd "$(dirname "$0")/.."

D1_NAME="${D1_NAME:-sfl-digging-hub}"
R2_NAME="${R2_NAME:-sfl-digging-hub-screenshots}"

echo "==> Checking wrangler auth..."
npx wrangler whoami

echo ""
echo "==> Creating D1 database: $D1_NAME"
echo "    (If it already exists, wrangler will error — that's OK; copy database_id from: wrangler d1 list)"
npx wrangler d1 create "$D1_NAME" || true

echo ""
echo "==> Creating R2 bucket: $R2_NAME"
echo "    (If name is taken globally, pick another name and update wrangler.toml)"
npx wrangler r2 bucket create "$R2_NAME" || true

echo ""
echo "==> Next steps:"
echo "  1. Copy database_id from 'wrangler d1 list' into wrangler.toml ([[d1_databases]] and env.production)"
echo "  2. npx wrangler d1 migrations apply $D1_NAME --remote"
echo "  3. Set production vars (CORS_ORIGINS, HUB_BASE_URL) in wrangler.toml"
echo "  4. npx wrangler deploy --env production"
echo ""
echo "Full guide: docs/CLOUDFLARE_SETUP.md"
