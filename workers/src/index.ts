import type {
  CreateSnapshotBody,
  SnapshotPublic,
  Visibility,
} from "@sfl-digging-hub/shared";
import {
  claimCommentsForUser,
  createSession,
  findOrCreateUser,
  getUserFromSession,
  sessionTokenFromRequest,
  verifyGoogleIdToken,
} from "./auth";
import { corsHeaders, parseAllowedOrigins } from "./cors";
import { randomId, sha256Hex } from "./crypto";
import {
  emptyDigDay,
  getDigDayRow,
  isValidLandId,
  listLandDays,
  testnetLandError,
  rowToDigDayWithReplay,
  saveDigDay,
  validateDigDayBody,
  verifyWriteSecret,
} from "./digDay";
import {
  listPracticeLeaderboard,
  listRecentPracticeVictories,
  savePracticeRun,
  validatePracticeRunBody,
} from "./practice";
import {
  createSnapshot,
  getSnapshotById,
  hashLandId,
  rowToPublic,
  validateCreateBody,
  verifyEditToken,
  type SnapshotRow,
} from "./snapshots";

export interface Env {
  DB: D1Database;
  SCREENSHOTS: R2Bucket;
  ASSETS?: Fetcher;
  CORS_ORIGINS?: string;
  HUB_BASE_URL?: string;
  HUB_WRITE_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
}

type CommentRow = {
  id: string;
  snapshot_id: string;
  display_name: string;
  body: string;
  dig_ref: number | null;
  created_at: string;
  user_id: string | null;
  anonymous_id: string | null;
};

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return Response.json(data, { status, headers: extraHeaders });
}

function error(message: string, status: number, cors: HeadersInit): Response {
  return json({ error: message }, status, cors);
}

function canViewSnapshot(row: SnapshotRow): boolean {
  return row.visibility === "public" || row.visibility === "unlisted";
}

async function checkCommentRate(db: D1Database, ipHash: string): Promise<boolean> {
  const windowStart = new Date().toISOString().slice(0, 13);
  const row = await db
    .prepare("SELECT count FROM comment_rate WHERE ip_hash = ? AND window_start = ?")
    .bind(ipHash, windowStart)
    .first<{ count: number }>();

  const count = row?.count ?? 0;
  if (count >= 30) return false;

  await db
    .prepare(
      `INSERT INTO comment_rate (ip_hash, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(ip_hash, window_start) DO UPDATE SET count = count + 1`,
    )
    .bind(ipHash, windowStart)
    .run();

  return true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowed = parseAllowedOrigins(env.CORS_ORIGINS);
    const cors = corsHeaders(request, allowed);
    const hubBase = env.HUB_BASE_URL ?? "http://localhost:5173";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/health" && request.method === "GET") {
        return json({ ok: true, service: "sfl-digging-hub-api" }, 200, cors);
      }

      if (path === "/v1/dig-day" && request.method === "GET") {
        const landId = String(url.searchParams.get("landId") || "");
        const utcDate =
          url.searchParams.get("utcDate") ||
          new Date().toISOString().slice(0, 10);
        const testnetErr = testnetLandError(landId);
        if (testnetErr) return error(testnetErr, 400, cors);
        if (!isValidLandId(landId)) {
          return error("Invalid landId", 400, cors);
        }
        const row = await getDigDayRow(env.DB, landId, utcDate);
        if (!row) {
          return json(emptyDigDay(landId, utcDate), 404, {
            ...cors,
            "Cache-Control": "public, max-age=30, must-revalidate",
          });
        }
        return json(rowToDigDayWithReplay(row, hubBase), 200, {
          ...cors,
          "Cache-Control": "public, max-age=30, must-revalidate",
        });
      }

      if (path === "/v1/dig-day" && request.method === "POST") {
        if (!verifyWriteSecret(request, env.HUB_WRITE_SECRET)) {
          return error("Unauthorized", 401, cors);
        }
        const raw = await request.json().catch(() => null);
        const validated = validateDigDayBody(raw);
        if (typeof validated === "string") return error(validated, 400, cors);
        try {
          const saved = await saveDigDay(env.DB, validated, hubBase);
          return json(saved, 200, { ...cors, "Cache-Control": "no-store" });
        } catch (e) {
          const err = e as Error & { statusCode?: number };
          if (err.statusCode === 413) return error(err.message, 413, cors);
          throw e;
        }
      }

      const landDaysMatch = path.match(/^\/v1\/lands\/(\d+)\/days$/);
      if (landDaysMatch && request.method === "GET") {
        const landId = landDaysMatch[1];
        const testnetErrDays = testnetLandError(landId);
        if (testnetErrDays) return error(testnetErrDays, 400, cors);
        if (!isValidLandId(landId)) {
          return error("Invalid landId", 400, cors);
        }
        const days = await listLandDays(env.DB, landId);
        const base = hubBase.replace(/\/$/, "");
        return json(
          {
            landId,
            days: days.map((d) => ({
              ...d,
              replayUrl: `${base}/replay/${d.id}`,
            })),
          },
          200,
          cors,
        );
      }

      if (path === "/v1/auth/google" && request.method === "POST") {
        const body = (await request.json().catch(() => null)) as {
          idToken?: string;
          anonymousId?: string;
        } | null;
        if (!body?.idToken) return error("idToken required", 400, cors);
        const email = await verifyGoogleIdToken(body.idToken, env.GOOGLE_CLIENT_ID);
        if (!email) return error("Invalid Google token", 401, cors);
        const user = await findOrCreateUser(env.DB, email);
        const sessionToken = await createSession(env.DB, user.id);
        let claimed = 0;
        if (body.anonymousId) {
          claimed = await claimCommentsForUser(env.DB, user.id, body.anonymousId);
        }
        return json(
          { email: user.email, sessionToken, claimedComments: claimed },
          200,
          cors,
        );
      }

      if (path === "/v1/auth/session" && request.method === "GET") {
        const user = await getUserFromSession(env.DB, sessionTokenFromRequest(request));
        if (!user) return error("Not signed in", 401, cors);
        return json({ email: user.email }, 200, cors);
      }

      if (path === "/v1/auth/claim-comments" && request.method === "POST") {
        const user = await getUserFromSession(env.DB, sessionTokenFromRequest(request));
        if (!user) return error("Not signed in", 401, cors);
        const body = (await request.json().catch(() => null)) as {
          anonymousId?: string;
        } | null;
        if (!body?.anonymousId) return error("anonymousId required", 400, cors);
        const claimed = await claimCommentsForUser(
          env.DB,
          user.id,
          body.anonymousId,
        );
        return json({ claimedComments: claimed }, 200, cors);
      }

      if (path === "/v1/snapshots" && request.method === "POST") {
        if (!verifyWriteSecret(request, env.HUB_WRITE_SECRET)) {
          return error("Unauthorized", 401, cors);
        }
        const raw = await request.json().catch(() => null);
        if (raw && typeof raw === "object" && "landId" in raw && "digs" in raw) {
          const validated = validateDigDayBody(raw);
          if (typeof validated === "string") return error(validated, 400, cors);
          const saved = await saveDigDay(env.DB, validated, hubBase);
          return json(saved, 201, cors);
        }
        const validated = validateCreateBody(raw);
        if (typeof validated === "string") return error(validated, 400, cors);
        const result = await createSnapshot(env.DB, validated as CreateSnapshotBody, hubBase);
        return json(result, 201, cors);
      }

      if (path === "/v1/snapshots/mine" && request.method === "GET") {
        const landId = url.searchParams.get("land_id");
        if (!landId) return error("land_id required", 400, cors);
        const landHash = await hashLandId(landId);
        const rows = await env.DB
          .prepare(
            `SELECT * FROM snapshots WHERE land_id_hash = ? ORDER BY utc_date DESC LIMIT 100`,
          )
          .bind(landHash)
          .all<SnapshotRow>();
        return json(
          { snapshots: (rows.results ?? []).map((r) => rowToPublic(r)) },
          200,
          cors,
        );
      }

      if (path === "/v1/community" && request.method === "GET") {
        const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
        const limit = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("limit") || 50) || 50),
        );
        const rows = await env.DB
          .prepare(
            `SELECT s.id, s.utc_date, s.land_id, s.display_name, s.created_at, s.digs_json, s.stats_json,
              (SELECT COUNT(*) FROM comments c WHERE c.snapshot_id = s.id) AS comment_count
             FROM snapshots s
             WHERE s.visibility = 'public' AND s.utc_date = ?
             ORDER BY s.created_at DESC LIMIT ?`,
          )
          .bind(date, limit)
          .all<{
            id: string;
            utc_date: string;
            land_id: string | null;
            display_name: string | null;
            created_at: string;
            digs_json: string;
            stats_json: string;
            comment_count: number;
          }>();

        const feed = (rows.results ?? []).map((r) => {
          const digs = JSON.parse(r.digs_json) as { length: number };
          const stats = JSON.parse(r.stats_json) as Record<string, unknown>;
          return {
            id: r.id,
            utcDate: r.utc_date,
            landId: r.land_id,
            displayName: r.display_name,
            digCount: Array.isArray(digs) ? digs.length : 0,
            commentCount: Number(r.comment_count) || 0,
            stats,
            createdAt: r.created_at,
            replayUrl: `${hubBase.replace(/\/$/, "")}/replay/${r.id}`,
          };
        });
        return json({ date, items: feed }, 200, cors);
      }

      if (path === "/v1/practice/runs" && request.method === "POST") {
        const raw = await request.json().catch(() => null);
        const validated = validatePracticeRunBody(raw);
        if (typeof validated === "string") return error(validated, 400, cors);

        const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
        const ipHash = await sha256Hex(`practice:${ip}`);
        if (!(await checkCommentRate(env.DB, ipHash))) {
          return error("Rate limit exceeded", 429, cors);
        }

        const saved = await savePracticeRun(env.DB, validated, request);
        return json(saved, 201, cors);
      }

      if (path === "/v1/practice/leaderboard" && request.method === "GET") {
        const sourceParam = url.searchParams.get("source") || "daily";
        if (sourceParam !== "daily" && sourceParam !== "random") {
          return error("source must be daily or random", 400, cors);
        }
        const sessionUser = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
        );
        const entries = await listPracticeLeaderboard(env.DB, {
          source: sourceParam,
          date: url.searchParams.get("date") ?? undefined,
          windowDays: Number(url.searchParams.get("window") || 7) || 7,
          viewerUserId: sessionUser?.id ?? null,
        });
        return json(
          {
            source: sourceParam,
            date: url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10),
            entries,
          },
          200,
          cors,
        );
      }

      if (path === "/v1/practice/victories" && request.method === "GET") {
        const sourceParam = url.searchParams.get("source") || "daily";
        if (sourceParam !== "daily" && sourceParam !== "random") {
          return error("source must be daily or random", 400, cors);
        }
        const sessionUser = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
        );
        const limit = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("limit") || 50) || 50),
        );
        const entries = await listRecentPracticeVictories(env.DB, {
          source: sourceParam,
          date: url.searchParams.get("date") ?? undefined,
          windowDays: Number(url.searchParams.get("window") || 7) || 7,
          limit,
          viewerUserId: sessionUser?.id ?? null,
        });
        return json(
          {
            source: sourceParam,
            date: url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10),
            entries,
          },
          200,
          cors,
        );
      }

      const snapshotMatch = path.match(/^\/v1\/snapshots\/([^/]+)$/);
      if (snapshotMatch) {
        const id = snapshotMatch[1];
        const row = await getSnapshotById(env.DB, id);
        if (!row) return error("Snapshot not found", 404, cors);

        const editToken = request.headers.get("X-Edit-Token");

        if (request.method === "GET") {
          const allowedView =
            canViewSnapshot(row) ||
            (editToken ? await verifyEditToken(row, editToken) : false);
          if (!allowedView) return error("Snapshot not found", 404, cors);
          return json(rowToPublic(row), 200, cors);
        }

        if (request.method === "PATCH") {
          if (!(await verifyEditToken(row, editToken))) {
            return error("Invalid edit token", 403, cors);
          }
          const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
          if (!body) return error("Invalid JSON body", 400, cors);

          const visibility = body.visibility as Visibility | undefined;
          const displayName =
            typeof body.displayName === "string" ? body.displayName.slice(0, 64) : row.display_name;
          const now = new Date().toISOString();

          await env.DB
            .prepare(
              `UPDATE snapshots SET
                visibility = COALESCE(?, visibility),
                display_name = COALESCE(?, display_name),
                updated_at = ?
               WHERE id = ?`,
            )
            .bind(visibility ?? row.visibility, displayName, now, id)
            .run();

          const updated = await getSnapshotById(env.DB, id);
          return json(rowToPublic(updated!), 200, cors);
        }
      }

      const commentsMatch = path.match(/^\/v1\/snapshots\/([^/]+)\/comments$/);
      if (commentsMatch) {
        const snapshotId = commentsMatch[1];
        const row = await getSnapshotById(env.DB, snapshotId);
        if (!row) return error("Snapshot not found", 404, cors);

        if (request.method === "GET") {
          if (!canViewSnapshot(row) && row.visibility === "private") {
            const editToken = request.headers.get("X-Edit-Token");
            if (!(await verifyEditToken(row, editToken))) {
              return error("Snapshot not found", 404, cors);
            }
          }
          const comments = await env.DB
            .prepare(
              `SELECT id, snapshot_id, display_name, body, dig_ref, created_at, user_id, anonymous_id
               FROM comments WHERE snapshot_id = ? ORDER BY created_at ASC`,
            )
            .bind(snapshotId)
            .all<CommentRow>();
          return json(
            {
              comments: (comments.results ?? []).map((c) => ({
                id: c.id,
                displayName: c.display_name,
                body: c.body,
                digRef: c.dig_ref,
                createdAt: c.created_at,
                owned: Boolean(c.user_id),
              })),
            },
            200,
            cors,
          );
        }

        if (request.method === "POST") {
          if (!canViewSnapshot(row) && row.visibility === "private") {
            return error("Cannot comment on private snapshot", 403, cors);
          }
          const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
          if (!body || typeof body.displayName !== "string" || typeof body.body !== "string") {
            return error("displayName and body required", 400, cors);
          }
          const displayName = body.displayName.slice(0, 32);
          const text = body.body.slice(0, 500);
          if (!text.trim()) return error("body required", 400, cors);

          const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
          const ipHash = await sha256Hex(`ip:${ip}`);
          if (!(await checkCommentRate(env.DB, ipHash))) {
            return error("Rate limit exceeded", 429, cors);
          }

          const sessionUser = await getUserFromSession(
            env.DB,
            sessionTokenFromRequest(request),
          );
          const anonymousId =
            typeof body.anonymousId === "string"
              ? body.anonymousId.slice(0, 64)
              : null;
          const digRef =
            typeof body.digRef === "number" && Number.isInteger(body.digRef)
              ? body.digRef
              : null;
          const id = randomId();
          const createdAt = new Date().toISOString();
          await env.DB
            .prepare(
              `INSERT INTO comments (id, snapshot_id, display_name, body, dig_ref, created_at, user_id, anonymous_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              id,
              snapshotId,
              displayName,
              text,
              digRef,
              createdAt,
              sessionUser?.id ?? null,
              sessionUser ? null : anonymousId,
            )
            .run();

          return json(
            {
              id,
              displayName,
              body: text,
              digRef,
              createdAt,
              owned: Boolean(sessionUser),
            },
            201,
            cors,
          );
        }
      }

      const screenshotMatch = path.match(/^\/v1\/snapshots\/([^/]+)\/screenshot$/);
      if (screenshotMatch && request.method === "POST") {
        if (!verifyWriteSecret(request, env.HUB_WRITE_SECRET)) {
          return error("Unauthorized", 401, cors);
        }
        const snapshotId = screenshotMatch[1];
        const row = await getSnapshotById(env.DB, snapshotId);
        if (!row) return error("Snapshot not found", 404, cors);

        const contentType = request.headers.get("Content-Type") ?? "image/png";
        if (!contentType.startsWith("image/")) {
          return error("Expected image upload", 400, cors);
        }

        const key = `snapshots/${snapshotId}/${randomId()}.png`;
        const bytes = await request.arrayBuffer();
        await env.SCREENSHOTS.put(key, bytes, {
          httpMetadata: { contentType },
        });
        const now = new Date().toISOString();
        await env.DB
          .prepare("UPDATE snapshots SET screenshot_key = ?, updated_at = ? WHERE id = ?")
          .bind(key, now, snapshotId)
          .run();

        return json({ screenshotKey: key }, 200, cors);
      }

      if (
        env.ASSETS &&
        (request.method === "GET" || request.method === "HEAD")
      ) {
        return env.ASSETS.fetch(request);
      }

      return error("Not found", 404, cors);
    } catch (e) {
      console.error(e);
      return error("Internal server error", 500, cors);
    }
  },
};
