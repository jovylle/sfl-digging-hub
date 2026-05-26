import type { DigEntry } from "@sfl-digging-hub/shared";
import { sanitizeDisplayName } from "./anonymize";
import { randomId } from "./crypto";
import { hashLandId, type SnapshotRow } from "./snapshots";

export const MAX_MARK_EVENTS = 500;
export const MAX_DIG_DAY_BYTES = 256 * 1024;

export type MarkEvent = {
  seq: number;
  [key: string]: unknown;
};

export type DigDayPayload = {
  v?: number;
  landId: string;
  utcDate: string;
  /** When true, land_id is not stored or returned on public hub views (lookup still uses landId hash). */
  hideLandId?: boolean;
  displayName?: string | null;
  patterns?: unknown[];
  digs: DigEntry[];
  markEvents?: MarkEvent[];
  stats?: Record<string, unknown>;
  updatedAt?: string | null;
};

export function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseUTCDate(value: unknown): string {
  if (typeof value !== "string") return getTodayUTC();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getTodayUTC();
}

/** SFL farm IDs are numeric; api-dev test farms can exceed 12 digits (e.g. 913531074720548). */
export const LAND_ID_MAX_LEN = 20;

export function isValidLandId(landId: string): boolean {
  return (
    typeof landId === "string" &&
    new RegExp(`^\\d{1,${LAND_ID_MAX_LEN}}$`).test(landId)
  );
}

/** Public hub views never expose raw land IDs (lookup uses land_id_hash). */
export function shouldHideLandId(
  _landId: string,
  _hideLandId?: boolean,
): boolean {
  return true;
}

export function publicLandId(
  landId: string | null | undefined,
): string | null {
  return landId?.trim() ? landId : null;
}

export function emptyDigDay(landId: string, utcDate: string): DigDayPayload {
  return {
    v: 1,
    landId,
    utcDate,
    patterns: [],
    digs: [],
    markEvents: [],
    stats: { totalDigs: 0, treasureCount: 0 },
    updatedAt: null,
  };
}

export function mergeMarkEvents(
  existing: MarkEvent[] | undefined,
  incoming: MarkEvent[] | undefined,
): MarkEvent[] {
  const bySeq = new Map<number, MarkEvent>();
  for (const e of existing || []) {
    if (e?.seq != null) bySeq.set(e.seq, e);
  }
  for (const e of incoming || []) {
    if (e?.seq != null) bySeq.set(e.seq, e);
  }
  const merged = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  return merged.slice(-MAX_MARK_EVENTS);
}

export function shouldReplaceDigs(
  existing: DigDayPayload | null,
  incoming: DigDayPayload,
): boolean {
  if (!existing?.digs?.length) return true;
  if (!incoming.digs?.length) return false;

  const existingLen = existing.digs.length;
  const incomingLen = incoming.digs.length;
  if (incomingLen > existingLen) return true;
  if (incomingLen < existingLen) return false;

  const existingAt = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
  const incomingAt = incoming.updatedAt ? Date.parse(incoming.updatedAt) : 0;
  return incomingAt >= existingAt;
}

export function mergeDigDay(
  existing: DigDayPayload | null,
  incoming: DigDayPayload,
): DigDayPayload {
  const landId = incoming.landId;
  const utcDate = incoming.utcDate;
  const base = existing || emptyDigDay(landId, utcDate);
  const replaceDigs = shouldReplaceDigs(base, incoming);

  const merged: DigDayPayload = {
    v: 1,
    landId,
    utcDate,
    hideLandId: shouldHideLandId(landId, incoming.hideLandId ?? base.hideLandId),
    displayName: incoming.displayName?.trim() || base.displayName || null,
    patterns: replaceDigs
      ? [...(incoming.patterns || [])]
      : [...(base.patterns || [])],
    digs: replaceDigs ? [...incoming.digs] : [...base.digs],
    markEvents: mergeMarkEvents(base.markEvents, incoming.markEvents),
    stats: replaceDigs
      ? { ...(incoming.stats || {}) }
      : { ...(base.stats || {}) },
    updatedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(merged);
  if (json.length > MAX_DIG_DAY_BYTES) {
    const err = new Error("Snapshot too large") as Error & { statusCode?: number };
    err.statusCode = 413;
    throw err;
  }

  return merged;
}

export function rowToDigDay(row: SnapshotRow): DigDayPayload {
  const markEvents = row.mark_events_json
    ? (JSON.parse(row.mark_events_json) as MarkEvent[])
    : [];
  const visibleLandId = publicLandId(row.land_id);
  const visibleDisplayName = sanitizeDisplayName(
    row.display_name,
    row.visibility,
    row.land_id,
  );
  return {
    v: 1,
    landId: visibleLandId || "",
    utcDate: row.utc_date,
    displayName: visibleDisplayName,
    patterns: JSON.parse(row.patterns_json),
    digs: JSON.parse(row.digs_json) as DigEntry[],
    markEvents,
    stats: JSON.parse(row.stats_json) as Record<string, unknown>,
    updatedAt: row.updated_at,
  };
}

/** GET /v1/dig-day — same payload as POST save, including shareable replay link. */
export function rowToDigDayWithReplay(
  row: SnapshotRow,
  hubBaseUrl: string,
): DigDayPayload & { id: string; replayUrl: string } {
  const base = hubBaseUrl.replace(/\/$/, "");
  return {
    ...rowToDigDay(row),
    id: row.id,
    replayUrl: `${base}/dig/${row.id}`,
  };
}

export async function getDigDayRow(
  db: D1Database,
  landId: string,
  utcDate: string,
): Promise<SnapshotRow | null> {
  const landHash = await hashLandId(landId);
  return db
    .prepare("SELECT * FROM snapshots WHERE land_id_hash = ? AND utc_date = ?")
    .bind(landHash, utcDate)
    .first<SnapshotRow>();
}

export function validateDigDayBody(body: unknown): DigDayPayload | string {
  if (!body || typeof body !== "object") return "Invalid JSON body";
  const b = body as Record<string, unknown>;
  const landId = String(b.landId || "");
  if (!isValidLandId(landId)) return "Invalid landId";
  const hideLandId = shouldHideLandId(landId);
  const utcDate = parseUTCDate(b.utcDate);
  if (!Array.isArray(b.digs)) return "digs must be an array";

  const displayName =
    typeof b.displayName === "string" ? b.displayName.trim().slice(0, 64) : null;

  return {
    v: 1,
    landId,
    utcDate,
    hideLandId,
    displayName: displayName || null,
    patterns: Array.isArray(b.patterns) ? b.patterns : [],
    digs: b.digs as DigEntry[],
    markEvents: Array.isArray(b.markEvents) ? (b.markEvents as MarkEvent[]) : [],
    stats:
      b.stats && typeof b.stats === "object"
        ? (b.stats as Record<string, unknown>)
        : { totalDigs: 0, treasureCount: 0 },
    updatedAt:
      typeof b.updatedAt === "string" ? b.updatedAt : new Date().toISOString(),
  };
}

export async function saveDigDay(
  db: D1Database,
  incoming: DigDayPayload,
  hubBaseUrl: string,
): Promise<DigDayPayload & { id: string; replayUrl: string }> {
  const existingRow = await getDigDayRow(db, incoming.landId, incoming.utcDate);
  const existing = existingRow ? rowToDigDay(existingRow) : null;
  const merged = mergeDigDay(existing, incoming);

  const landHash = await hashLandId(merged.landId);
  const now = merged.updatedAt || new Date().toISOString();
  const id = existingRow?.id ?? randomId();

  const storedLandId = shouldHideLandId(merged.landId, merged.hideLandId)
    ? null
    : merged.landId;
  const storedDisplayName = null;

  await db
    .prepare(
      `INSERT INTO snapshots (
        id, utc_date, land_id, land_id_hash, display_name, patterns_json, digs_json,
        stats_json, marks_json, mark_events_json, visibility, screenshot_key,
        edit_token_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'public', NULL, NULL, ?, ?)
      ON CONFLICT(land_id_hash, utc_date) DO UPDATE SET
        land_id = excluded.land_id,
        display_name = excluded.display_name,
        patterns_json = excluded.patterns_json,
        digs_json = excluded.digs_json,
        stats_json = excluded.stats_json,
        mark_events_json = excluded.mark_events_json,
        visibility = 'public',
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      merged.utcDate,
      storedLandId,
      landHash,
      storedDisplayName,
      JSON.stringify(merged.patterns ?? []),
      JSON.stringify(merged.digs),
      JSON.stringify(merged.stats ?? {}),
      JSON.stringify(merged.markEvents ?? []),
      existingRow?.created_at ?? now,
      now,
    )
    .run();

  const row = await getDigDayRow(db, merged.landId, merged.utcDate);
  if (!row) throw new Error("Failed to persist dig day");

  const base = hubBaseUrl.replace(/\/$/, "");
  const response = rowToDigDay(row);
  return {
    ...response,
    id: row.id,
    replayUrl: `${base}/dig/${row.id}`,
  };
}

export async function listLandDays(
  db: D1Database,
  landId: string,
): Promise<
  { id: string; utcDate: string; digCount: number; updatedAt: string; replayUrl: string }[]
> {
  if (!isValidLandId(landId)) return [];
  const landHash = await hashLandId(landId);
  const rows = await db
    .prepare(
      `SELECT id, utc_date, digs_json, updated_at FROM snapshots
       WHERE land_id_hash = ? ORDER BY utc_date DESC LIMIT 100`,
    )
    .bind(landHash)
    .all<{ id: string; utc_date: string; digs_json: string; updated_at: string }>();

  return (rows.results ?? []).map((r) => {
    const digs = JSON.parse(r.digs_json) as unknown[];
    return {
      id: r.id,
      utcDate: r.utc_date,
      digCount: Array.isArray(digs) ? digs.length : 0,
      updatedAt: r.updated_at,
      replayUrl: "",
    };
  });
}

export function verifyWriteSecret(request: Request, secret: string | undefined): boolean {
  if (!secret) return true;
  return request.headers.get("X-Hub-Write-Secret") === secret;
}
