#!/usr/bin/env node
/**
 * Import dig-day JSON blobs into hub D1 via POST /v1/dig-day.
 *
 * Usage:
 *   node scripts/import-blobs-to-hub.mjs --dir ./blob-export
 *   node scripts/import-blobs-to-hub.mjs --file 12345/2026-05-18.json
 *
 * Env:
 *   HUB_API_BASE  (default https://beta.api.d1g.uk)
 *   HUB_WRITE_SECRET (required for POST)
 *
 * Export blobs first (from sfl-crab repo):
 *   netlify blobs:list --store dig-day-snapshots
 *   netlify blobs:get dig-day-snapshots 12345/2026-05-18.json > blob-export/12345/2026-05-18.json
 */

import fs from 'node:fs'
import path from 'node:path'

const base = (process.env.HUB_API_BASE || 'https://beta.api.d1g.uk').replace(/\/$/, '')
const secret = process.env.HUB_WRITE_SECRET

function parseArgs () {
  const args = process.argv.slice(2)
  let dir = null
  let file = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') dir = args[++i]
    if (args[i] === '--file') file = args[++i]
  }
  return { dir, file }
}

function collectFiles (dir) {
  const out = []
  function walk (d) {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name)
      if (fs.statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.json')) out.push(p)
    }
  }
  walk(dir)
  return out
}

async function importOne (filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!raw.landId || !raw.utcDate) {
    console.warn('skip (missing landId/utcDate):', filePath)
    return false
  }
  const res = await fetch(`${base}/v1/dig-day`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'X-Hub-Write-Secret': secret } : {}),
    },
    body: JSON.stringify(raw),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('fail', raw.landId, raw.utcDate, res.status, err)
    return false
  }
  console.log('ok', raw.landId, raw.utcDate)
  return true
}

async function main () {
  if (!secret) {
    console.error('Set HUB_WRITE_SECRET')
    process.exit(1)
  }
  const { dir, file } = parseArgs()
  if (!dir && !file) {
    console.error('Provide --dir or --file')
    process.exit(1)
  }
  const files = file ? [file] : collectFiles(dir)
  let ok = 0
  for (const f of files) {
    if (await importOne(f)) ok++
  }
  console.log(`Imported ${ok}/${files.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
