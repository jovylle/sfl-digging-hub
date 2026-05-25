import {
  computePracticeScore,
  type DigEntry,
  type FormationPlacement,
  type PracticeLeaderboardEntry,
  type PracticePatternSource,
  type PracticeRunPayload,
} from "@sfl-digging-hub/shared";
import { randomId } from "./crypto";
import { getUserFromSession, sessionTokenFromRequest } from "./auth";

const MAX_DIG_COUNT = 200;
const MAX_DURATION_MS = 3_600_000;
const MAX_PATTERN_KEYS = 20;
const MAX_PATTERN_KEY_LEN = 64;
const MAX_DISPLAY_NAME = 32;
const LEADERBOARD_LIMIT = 50;

export type PracticeRunRow = {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  display_name: string | null;
  pattern_source: string;
  pattern_date: string | null;
  pattern_keys_json: string;
  dig_count: number;
  duration_ms: number;
  victory: number;
  treasure_count: number;
  score: number;
  created_at: string;
  digs_json: string | null;
  formations_json: string | null;
};

export function validatePracticeRunBody(body: unknown): PracticeRunPayload | string {
  if (!body || typeof body !== "object") return "Invalid JSON body";
  const b = body as Record<string, unknown>;

  const source = String(b.patternSource || "");
  if (source !== "daily" && source !== "random") {
    return "patternSource must be daily or random";
  }

  const patternKeys = Array.isArray(b.patternKeys)
    ? b.patternKeys.map((k) => String(k).slice(0, MAX_PATTERN_KEY_LEN)).slice(0, MAX_PATTERN_KEYS)
    : [];
  if (!patternKeys.length) return "patternKeys required";

  const digCount = Number(b.digCount);
  const durationMs = Number(b.durationMs);
  const treasureCount = Number(b.treasureCount ?? 0);
  const victory = Boolean(b.victory);

  if (!Number.isFinite(digCount) || digCount < 0 || digCount > MAX_DIG_COUNT) {
    return "Invalid digCount";
  }
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > MAX_DURATION_MS) {
    return "Invalid durationMs";
  }
  if (!Number.isFinite(treasureCount) || treasureCount < 0 || treasureCount > 100) {
    return "Invalid treasureCount";
  }

  let patternDate: string | null = null;
  if (source === "daily") {
    const d = String(b.patternDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "patternDate required for daily runs";
    patternDate = d;
  } else if (b.patternDate && /^\d{4}-\d{2}-\d{2}$/.test(String(b.patternDate))) {
    patternDate = String(b.patternDate);
  }

  // Accept `nickname` as an alias for `displayName` (sent by the sfl-crab practice client)
  const rawDisplayName = b.displayName ?? b.nickname;
  const displayName =
    typeof rawDisplayName === "string" ? rawDisplayName.trim().slice(0, MAX_DISPLAY_NAME) : undefined;
  const anonymousId =
    typeof b.anonymousId === "string" ? b.anonymousId.slice(0, 64) : undefined;

  const digs: DigEntry[] | undefined = Array.isArray(b.digs)
    ? (b.digs as DigEntry[]).slice(0, 200)
    : undefined;

  const formations: FormationPlacement[] | undefined = Array.isArray(b.formations)
    ? (b.formations as FormationPlacement[]).slice(0, 20)
    : undefined;

  return {
    patternSource: source as PracticePatternSource,
    patternDate,
    patternKeys,
    digCount: Math.floor(digCount),
    durationMs: Math.floor(durationMs),
    victory,
    treasureCount: Math.floor(treasureCount),
    displayName: displayName || undefined,
    anonymousId,
    digs,
    formations,
  };
}

export async function savePracticeRun(
  db: D1Database,
  payload: PracticeRunPayload,
  request: Request,
): Promise<PracticeLeaderboardEntry> {
  const sessionUser = await getUserFromSession(db, sessionTokenFromRequest(request));
  const id = randomId();
  const createdAt = new Date().toISOString();
  const score = computePracticeScore(payload.durationMs, payload.digCount);
  const displayName =
    payload.displayName ||
    (sessionUser ? sessionUser.email.split("@")[0]?.slice(0, MAX_DISPLAY_NAME) : null);

  const digsJson = payload.digs && payload.digs.length > 0
    ? JSON.stringify(payload.digs)
    : null;

  const formationsJson = payload.formations && payload.formations.length > 0
    ? JSON.stringify(payload.formations)
    : null;

  await db
    .prepare(
      `INSERT INTO practice_runs (
        id, user_id, anonymous_id, display_name, pattern_source, pattern_date,
        pattern_keys_json, dig_count, duration_ms, victory, treasure_count, score, created_at, digs_json, formations_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      sessionUser?.id ?? null,
      sessionUser ? null : payload.anonymousId ?? null,
      displayName,
      payload.patternSource,
      payload.patternDate,
      JSON.stringify(payload.patternKeys),
      payload.digCount,
      payload.durationMs,
      payload.victory ? 1 : 0,
      payload.treasureCount,
      score,
      createdAt,
      digsJson,
      formationsJson,
    )
    .run();

  return {
    id,
    displayName,
    patternSource: payload.patternSource,
    patternDate: payload.patternDate ?? null,
    patternKeys: payload.patternKeys,
    digCount: payload.digCount,
    durationMs: payload.durationMs,
    score,
    treasureCount: payload.treasureCount,
    victory: payload.victory,
    createdAt,
    owned: Boolean(sessionUser),
    digs: payload.digs ?? undefined,
    formations: payload.formations ?? undefined,
  };
}

function parseDigs(raw: string | null): DigEntry[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DigEntry[]) : undefined;
  } catch {
    return undefined;
  }
}

function parseFormations(raw: string | null): FormationPlacement[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FormationPlacement[]) : undefined;
  } catch {
    return undefined;
  }
}

function parsePatternKeys(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function rowToEntry(row: PracticeRunRow, viewerUserId?: string | null): PracticeLeaderboardEntry {
  return {
    id: row.id,
    displayName: row.display_name,
    patternSource: row.pattern_source as PracticePatternSource,
    patternDate: row.pattern_date,
    patternKeys: parsePatternKeys(row.pattern_keys_json),
    digCount: row.dig_count,
    durationMs: row.duration_ms,
    score: row.score,
    treasureCount: row.treasure_count,
    victory: Boolean(row.victory),
    createdAt: row.created_at,
    owned: Boolean(viewerUserId && row.user_id === viewerUserId),
    digs: parseDigs(row.digs_json),
    formations: parseFormations(row.formations_json),
  };
}

export async function getPracticeRunById(
  db: D1Database,
  id: string,
  viewerUserId?: string | null,
): Promise<PracticeLeaderboardEntry | null> {
  const row = await db
    .prepare(`SELECT * FROM practice_runs WHERE id = ?`)
    .bind(id)
    .first<PracticeRunRow>();
  if (!row) return null;
  return rowToEntry(row, viewerUserId);
}

export async function listPracticeLeaderboard(
  db: D1Database,
  options: {
    source: PracticePatternSource;
    date?: string;
    windowDays?: number;
    victoriesOnly?: boolean;
    viewerUserId?: string | null;
  },
): Promise<PracticeLeaderboardEntry[]> {
  const limit = LEADERBOARD_LIMIT;
  const victoriesOnly = options.victoriesOnly !== false;

  if (options.source === "daily") {
    const date = options.date ?? new Date().toISOString().slice(0, 10);
    const rows = await db
      .prepare(
        `SELECT * FROM practice_runs
         WHERE pattern_source = 'daily' AND pattern_date = ?
         ${victoriesOnly ? "AND victory = 1" : ""}
         ORDER BY score ASC, created_at ASC
         LIMIT ?`,
      )
      .bind(date, limit)
      .all<PracticeRunRow>();
    return (rows.results ?? []).map((r) => rowToEntry(r, options.viewerUserId));
  }

  const windowDays = options.windowDays ?? 7;
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const rows = await db
    .prepare(
      `SELECT * FROM practice_runs
       WHERE pattern_source = 'random' AND created_at >= ?
       ${victoriesOnly ? "AND victory = 1" : ""}
       ORDER BY score ASC, created_at ASC
       LIMIT ?`,
    )
    .bind(since, limit)
    .all<PracticeRunRow>();
  return (rows.results ?? []).map((r) => rowToEntry(r, options.viewerUserId));
}

/** Chronological page of victorious runs (newest first), with cursor pagination. */
export async function listRecentPracticeVictories(
  db: D1Database,
  options: {
    source: PracticePatternSource;
    before?: string | null;
    limit?: number;
    viewerUserId?: string | null;
  },
): Promise<{ entries: PracticeLeaderboardEntry[]; nextCursor: string | null }> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 30));
  const fetchCount = limit + 1;
  const before = options.before ?? null;

  const rows = before
    ? await db
        .prepare(
          `SELECT * FROM practice_runs
           WHERE pattern_source = ? AND victory = 1 AND created_at < ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .bind(options.source, before, fetchCount)
        .all<PracticeRunRow>()
    : await db
        .prepare(
          `SELECT * FROM practice_runs
           WHERE pattern_source = ? AND victory = 1
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .bind(options.source, fetchCount)
        .all<PracticeRunRow>();

  const all = rows.results ?? [];
  const hasMore = all.length > limit;
  const page = hasMore ? all.slice(0, limit) : all;
  const entries = page.map((r) => rowToEntry(r, options.viewerUserId));
  const nextCursor = hasMore ? entries[entries.length - 1].createdAt : null;
  return { entries, nextCursor };
}
