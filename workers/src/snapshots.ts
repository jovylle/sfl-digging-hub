import type {
  CreateSnapshotBody,
  CreateSnapshotResponse,
  DigEntry,
  SnapshotPublic,
  SnapshotStats,
  Visibility,
} from "@sfl-digging-hub/shared";
import { randomId, randomToken, sha256Hex } from "./crypto";

export type SnapshotRow = {
  id: string;
  utc_date: string;
  land_id: string | null;
  land_id_hash: string;
  display_name: string | null;
  patterns_json: string;
  digs_json: string;
  stats_json: string;
  marks_json: string | null;
  mark_events_json: string | null;
  visibility: Visibility;
  screenshot_key: string | null;
  edit_token_hash: string | null;
  created_at: string;
  updated_at: string;
};

export function rowToPublic(row: SnapshotRow): SnapshotPublic {
  return {
    id: row.id,
    utcDate: row.utc_date,
    displayName: row.display_name,
    patterns: JSON.parse(row.patterns_json),
    digs: JSON.parse(row.digs_json) as DigEntry[],
    stats: JSON.parse(row.stats_json) as SnapshotStats,
    marks: row.marks_json ? JSON.parse(row.marks_json) : null,
    visibility: row.visibility,
    screenshotKey: row.screenshot_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function hashLandId(landId: string): Promise<string> {
  return sha256Hex(`land:${landId.trim()}`);
}

export async function hashEditToken(token: string): Promise<string> {
  return sha256Hex(`edit:${token}`);
}

export function validateCreateBody(body: unknown): CreateSnapshotBody | string {
  if (!body || typeof body !== "object") return "Invalid JSON body";
  const b = body as Record<string, unknown>;
  if (typeof b.landId !== "string" || !b.landId.trim()) return "landId is required";
  if (typeof b.utcDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.utcDate)) {
    return "utcDate must be YYYY-MM-DD";
  }
  if (!Array.isArray(b.digs) || b.digs.length === 0) return "digs array is required";
  const visibility = b.visibility as Visibility | undefined;
  if (visibility && !["private", "unlisted", "public"].includes(visibility)) {
    return "invalid visibility";
  }
  return {
    landId: b.landId.trim(),
    utcDate: b.utcDate,
    displayName: typeof b.displayName === "string" ? b.displayName.slice(0, 64) : undefined,
    patterns: Array.isArray(b.patterns) ? b.patterns : [],
    digs: b.digs as DigEntry[],
    stats: (b.stats && typeof b.stats === "object" ? b.stats : {}) as SnapshotStats,
    marks: Array.isArray(b.marks) ? b.marks : undefined,
    visibility: visibility ?? "private",
  };
}

export async function createSnapshot(
  db: D1Database,
  body: CreateSnapshotBody,
  hubBaseUrl: string,
): Promise<CreateSnapshotResponse> {
  const id = randomId();
  const editToken = randomToken();
  const editTokenHash = await hashEditToken(editToken);
  const landIdHash = await hashLandId(body.landId);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO snapshots (
        id, utc_date, land_id_hash, display_name, patterns_json, digs_json,
        stats_json, marks_json, visibility, screenshot_key, edit_token_hash,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
      ON CONFLICT(land_id_hash, utc_date) DO UPDATE SET
        display_name = excluded.display_name,
        patterns_json = excluded.patterns_json,
        digs_json = excluded.digs_json,
        stats_json = excluded.stats_json,
        marks_json = excluded.marks_json,
        visibility = excluded.visibility,
        edit_token_hash = excluded.edit_token_hash,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      body.utcDate,
      landIdHash,
      body.displayName ?? null,
      JSON.stringify(body.patterns ?? []),
      JSON.stringify(body.digs),
      JSON.stringify(body.stats ?? {}),
      body.marks ? JSON.stringify(body.marks) : null,
      body.visibility ?? "private",
      editTokenHash,
      now,
      now,
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM snapshots WHERE land_id_hash = ? AND utc_date = ?")
    .bind(landIdHash, body.utcDate)
    .first<SnapshotRow>();

  if (!row) throw new Error("Failed to persist snapshot");

  const pub = rowToPublic(row);
  const base = hubBaseUrl.replace(/\/$/, "");
  return {
    ...pub,
    editToken,
    replayUrl: `${base}/replay/${row.id}`,
  };
}

export async function getSnapshotById(
  db: D1Database,
  id: string,
): Promise<SnapshotRow | null> {
  return db.prepare("SELECT * FROM snapshots WHERE id = ?").bind(id).first<SnapshotRow>();
}

export async function verifyEditToken(
  row: SnapshotRow,
  token: string | null,
): Promise<boolean> {
  if (!token || !row.edit_token_hash) return false;
  const hash = await hashEditToken(token);
  return hash === row.edit_token_hash;
}
