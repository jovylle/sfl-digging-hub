import type {
  CreateSnapshotBody,
  DigEntry,
  ReactionEmoji,
  SnapshotPublic,
  Visibility,
} from "@sfl-digging-hub/shared";
import { isReactionEmoji } from "@sfl-digging-hub/shared";
import {
  approveEmailRequestByLink,
  buildGoogleAuthorizeUrl,
  checkRateLimit,
  claimAnonymousActivityForUser,
  consumeEmailApprovalSession,
  createAndStoreEmailOtp,
  createEmailApprovalRequest,
  createGoogleOAuthState,
  exchangeGoogleCodeForIdentity,
  findOrCreateUserForProvider,
  getEmailApprovalStatus,
  getUserFromSession,
  getPublicAuthUser,
  issueAuthToken,
  revokeJwtFromRequest,
  sendApprovalEmail,
  sendOtpEmail,
  sessionTokenFromRequest,
  verifyGoogleIdToken,
  verifyGoogleOAuthState,
  verifyEmailOtp,
} from "./auth";
import { corsHeaders, parseAllowedOrigins } from "./cors";
import { randomId, sha256Hex } from "./crypto";
import {
  emptyDigDay,
  getDigDayRow,
  getTodayUTC,
  isValidLandId,
  rowToDigDayWithReplay,
  saveDigDay,
  validateDigDayBody,
  verifyWriteSecret,
} from "./digDay";
import {
  getPracticeRunById,
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
import {
  buildCommunityMeta,
  buildHomeMeta,
  buildSnapshotMeta,
  handleSnapshotOgPng,
  handleStaticOgPng,
  injectOgIntoHtml,
} from "./og";
import {
  handleDeleteSavedLand,
  handleGetMyDigsToday,
  handleGetProfile,
  handleGetSavedLands,
  handlePostSavedLand,
  handlePutProfile,
} from "./profile";

export interface Env {
  DB: D1Database;
  SCREENSHOTS: R2Bucket;
  ASSETS?: Fetcher;
  CORS_ORIGINS?: string;
  HUB_BASE_URL?: string;
  API_BASE_URL?: string;
  HUB_WRITE_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  JWT_SECRET?: string;
  OTP_EMAIL_FROM?: string;
  OTP_RESEND_API_KEY?: string;
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

async function metaForPath(
  db: D1Database,
  path: string,
  hubBase: string,
  apiBase: string,
) {
  if (path === "/" || path === "") {
    return buildHomeMeta(hubBase, apiBase);
  }
  if (path === "/community" || path === "/community/") {
    return buildCommunityMeta(hubBase, apiBase);
  }
  const digMatch = path.match(/^\/dig\/([^/]+)\/?$/);
  if (digMatch) {
    const row = await getSnapshotById(db, digMatch[1]);
    if (row && canViewSnapshot(row)) {
      return buildSnapshotMeta(row, hubBase, apiBase);
    }
  }
  return null;
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAllowedAuthReturnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "d1g.uk" || host === "beta.d1g.uk" || host === "development.d1g.uk") {
      return true;
    }
    if (host === "hub.d1g.uk" || host === "beta.hub.d1g.uk") {
      return true;
    }
    if (host === "localhost" || host === "127.0.0.1") {
      return true;
    }
    if (/^[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i.test(host)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isEmailApproveStartPath(path: string): boolean {
  return (
    path === "/v1/auth/approve/start" ||
    path === "/v1/auth/magic/start" ||
    path === "/v1/auth/magic-link/start"
  );
}

function isEmailApproveCheckPath(path: string): boolean {
  return (
    path === "/v1/auth/approve/check" ||
    path === "/v1/auth/approve/complete" ||
    path === "/v1/auth/magic/check" ||
    path === "/v1/auth/magic/complete" ||
    path === "/v1/auth/magic-link/verify"
  );
}

function isEmailApproveCompletePath(path: string): boolean {
  return (
    path === "/v1/auth/approve/complete" ||
    path === "/v1/auth/magic/complete" ||
    path === "/v1/auth/magic-link/verify"
  );
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

    const apiBase = env.API_BASE_URL ?? "http://localhost:8787";

    try {
      if (path === "/health" && request.method === "GET") {
        return json({ ok: true, service: "sfl-digging-hub-api" }, 200, cors);
      }

      const snapshotOgMatch = path.match(/^\/v1\/snapshots\/([^/]+)\/og\.png$/);
      if (snapshotOgMatch && request.method === "GET") {
        return handleSnapshotOgPng(env.DB, request, snapshotOgMatch[1], cors);
      }

      if (path === "/v1/og/home.png" && request.method === "GET") {
        return handleStaticOgPng(request, "home", cors);
      }

      if (path === "/v1/og/community.png" && request.method === "GET") {
        return handleStaticOgPng(request, "community", cors);
      }

      if (path === "/v1/dig-day" && request.method === "GET") {
        const landId = String(url.searchParams.get("landId") || "");
        const utcDate =
          url.searchParams.get("utcDate") ||
          new Date().toISOString().slice(0, 10);
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
        const sessionUser = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        const raw = await request.json().catch(() => null);
        const validated = validateDigDayBody(raw);
        if (typeof validated === "string") return error(validated, 400, cors);
        try {
          const saved = await saveDigDay(env.DB, validated, hubBase, sessionUser?.id ?? null);
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
        if (!isValidLandId(landId)) {
          return error("Invalid landId", 400, cors);
        }
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Not signed in", 401, cors);
        const saved = await env.DB
          .prepare(
            "SELECT 1 FROM user_saved_lands WHERE user_id = ? AND land_id = ? LIMIT 1",
          )
          .bind(user.id, landId)
          .first();
        if (!saved) return error("Land not in your saved list", 403, cors);
        const utcDate = getTodayUTC();
        const row = await getDigDayRow(env.DB, landId, utcDate);
        const base = hubBase.replace(/\/$/, "");
        const days = row
          ? [
              {
                id: row.id,
                utcDate: row.utc_date,
                digCount: (JSON.parse(row.digs_json) as unknown[]).length,
                updatedAt: row.updated_at,
                replayUrl: `${base}/dig/${row.id}`,
              },
            ]
          : [];
        return json({ landId, utcDate, days }, 200, cors);
      }

      if (path === "/v1/auth/otp/send" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
        const body = (await request.json().catch(() => null)) as { email?: string } | null;
        const email = (body?.email ?? "").trim().toLowerCase();

        if (email && isValidEmail(email)) {
          const emailHash = await sha256Hex(`otp-email:${email}`);
          const ipHash = await sha256Hex(`otp-ip:${ip}`);
          const keyHash = await sha256Hex(`otp-ip-email:${ip}:${email}`);
          const [ipOk, emailOk, comboOk] = await Promise.all([
            checkRateLimit(env.DB, "otp_send_ip", ipHash, 20, 60),
            checkRateLimit(env.DB, "otp_send_email", emailHash, 8, 10 * 60),
            checkRateLimit(env.DB, "otp_send_pair", keyHash, 5, 10 * 60),
          ]);
          if (ipOk && emailOk && comboOk) {
            const code = await createAndStoreEmailOtp(env.DB, email, ipHash);
            await sendOtpEmail(email, code, {
              from: env.OTP_EMAIL_FROM,
              resendApiKey: env.OTP_RESEND_API_KEY,
            });
          }
        }

        // Always return ok to avoid account enumeration.
        return json({ ok: true }, 200, cors);
      }

      if (isEmailApproveStartPath(path) && request.method === "POST") {
        const body = (await request.json().catch(() => null)) as {
          email?: string;
          anonymousId?: string;
          returnUrl?: string;
        } | null;
        const email = (body?.email ?? "").trim().toLowerCase();
        const returnUrlRaw = (body?.returnUrl ?? "").trim();
        const returnUrl =
          returnUrlRaw && isAllowedAuthReturnUrl(returnUrlRaw) ? returnUrlRaw : null;
        if (!isValidEmail(email)) {
          return error("Invalid email", 400, cors);
        }
        if (returnUrlRaw && !returnUrl) {
          return error("Invalid returnUrl", 400, cors);
        }

        const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
        const emailHash = await sha256Hex(`approve-email:${email}`);
        const ipHash = await sha256Hex(`approve-ip:${ip}`);
        const pairHash = await sha256Hex(`approve-ip-email:${ip}:${email}`);
        const [ipOk, emailOk, pairOk] = await Promise.all([
          checkRateLimit(env.DB, "approve_start_ip", ipHash, 20, 60),
          checkRateLimit(env.DB, "approve_start_email", emailHash, 8, 10 * 60),
          checkRateLimit(env.DB, "approve_start_pair", pairHash, 5, 10 * 60),
        ]);
        if (!ipOk || !emailOk || !pairOk) {
          return error("Too many requests. Please try again shortly.", 429, cors);
        }

        const started = await createEmailApprovalRequest(env.DB, email, {
          returnUrl,
          ipHash,
        });
        const apiBase = (env.API_BASE_URL ?? `${url.protocol}//${url.host}`).replace(/\/$/, "");
        const approveLink = new URL(`${apiBase}/v1/auth/approve/complete`);
        approveLink.searchParams.set("requestId", started.requestId);
        approveLink.searchParams.set("email", email);
        approveLink.searchParams.set("token", started.approveToken);
        await sendApprovalEmail(email, approveLink.toString(), {
          from: env.OTP_EMAIL_FROM,
          resendApiKey: env.OTP_RESEND_API_KEY,
        });
        return json(
          {
            requestId: started.requestId,
            challengeId: started.challengeId,
            flowId: started.flowId,
            expiresAt: started.expiresAt,
            status: "pending",
          },
          200,
          cors,
        );
      }

      if (isEmailApproveCompletePath(path) && request.method === "GET") {
        const requestId = String(url.searchParams.get("requestId") ?? "").trim();
        const email = String(url.searchParams.get("email") ?? "").trim().toLowerCase();
        const token = String(url.searchParams.get("token") ?? "").trim();
        if (!requestId || !email || !token || !isValidEmail(email)) {
          return error("Invalid approval link", 400, cors);
        }

        const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
        const approvedIpHash = await sha256Hex(`approve-ip:${ip}`);
        const approved = await approveEmailRequestByLink(env.DB, {
          requestId,
          email,
          approveToken: token,
          approvedIpHash,
        });

        const fallbackReturn = `${hubBase.replace(/\/$/, "")}/`;
        const safeReturnUrl =
          approved.returnUrl && isAllowedAuthReturnUrl(approved.returnUrl)
            ? approved.returnUrl
            : fallbackReturn;
        const target = new URL(safeReturnUrl);
        target.searchParams.set("authApprove", approved.ok ? "approved" : "invalid");
        target.searchParams.set("requestId", requestId);
        if (!approved.ok && approved.reason) {
          target.searchParams.set("reason", approved.reason);
        }
        return Response.redirect(target.toString(), 302);
      }

      if (isEmailApproveCheckPath(path) && request.method === "POST") {
        if (!env.JWT_SECRET) return error("Auth is not configured", 500, cors);
        const body = (await request.json().catch(() => null)) as {
          email?: string;
          requestId?: string;
          anonymousId?: string;
          challengeId?: string;
          flowId?: string;
        } | null;
        const email = (body?.email ?? "").trim().toLowerCase();
        if (!isValidEmail(email)) {
          return error("Invalid email", 400, cors);
        }

        const approval = await getEmailApprovalStatus(env.DB, {
          email,
          requestId: body?.requestId,
          challengeId: body?.challengeId,
          flowId: body?.flowId,
        });
        if (approval.status === "none" || approval.status === "pending") {
          return json(
            {
              status: "pending",
              requestId: approval.status === "pending" ? approval.requestId : body?.requestId ?? null,
              challengeId: approval.status === "pending" ? approval.challengeId : body?.challengeId ?? null,
              flowId: approval.status === "pending" ? approval.flowId : body?.flowId ?? null,
              expiresAt: approval.status === "pending" ? approval.expiresAt : null,
            },
            200,
            cors,
          );
        }
        if (approval.status === "expired") {
          return error("Approval request expired. Please start again.", 409, cors);
        }
        if (approval.status === "consumed") {
          return error("Approval request already used. Please start again.", 409, cors);
        }

        const user = await findOrCreateUserForProvider(env.DB, email, "email", email);
        const token = await issueAuthToken(env.DB, user, env.JWT_SECRET);
        const consumed = await consumeEmailApprovalSession(env.DB, approval.requestId);
        if (!consumed) {
          return error("Approval request already used. Please start again.", 409, cors);
        }
        const claimed = await claimAnonymousActivityForUser(env.DB, user.id, body?.anonymousId);
        const authUser = await getPublicAuthUser(env.DB, user);
        return json(
          {
            status: "approved",
            requestId: approval.requestId,
            challengeId: approval.challengeId,
            flowId: approval.flowId,
            token,
            accessToken: token,
            user: authUser,
            claimed,
          },
          200,
          cors,
        );
      }

      if (path === "/v1/auth/otp/verify" && request.method === "POST") {
        if (!env.JWT_SECRET) return error("Auth is not configured", 500, cors);
        const body = (await request.json().catch(() => null)) as {
          email?: string;
          code?: string;
          anonymousId?: string;
        } | null;
        const email = (body?.email ?? "").trim().toLowerCase();
        const code = (body?.code ?? "").trim();
        if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
          return error("Invalid email or code", 400, cors);
        }
        const ok = await verifyEmailOtp(env.DB, email, code);
        if (!ok) return error("Invalid or expired code", 401, cors);
        const user = await findOrCreateUserForProvider(env.DB, email, "email", email);
        const token = await issueAuthToken(env.DB, user, env.JWT_SECRET);
        const claimed = await claimAnonymousActivityForUser(
          env.DB,
          user.id,
          body?.anonymousId,
        );
        const authUser = await getPublicAuthUser(env.DB, user);
        return json({ token, user: authUser, claimed }, 200, cors);
      }

      if (path === "/v1/auth/google/start" && request.method === "GET") {
        const returnUrl = String(url.searchParams.get("returnUrl") ?? "");
        if (!returnUrl || !isAllowedAuthReturnUrl(returnUrl)) {
          return error("Invalid returnUrl", 400, cors);
        }
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI || !env.JWT_SECRET) {
          return error("Google OAuth is not configured", 500, cors);
        }
        const state = await createGoogleOAuthState(returnUrl, env.JWT_SECRET);
        const authUrl = buildGoogleAuthorizeUrl(
          env.GOOGLE_CLIENT_ID,
          env.GOOGLE_REDIRECT_URI,
          state,
        );
        return json({ url: authUrl }, 200, cors);
      }

      if (path === "/v1/auth/google/callback" && request.method === "GET") {
        if (!env.JWT_SECRET) return error("Auth is not configured", 500, cors);
        const code = String(url.searchParams.get("code") ?? "");
        const state = String(url.searchParams.get("state") ?? "");
        if (!code || !state) return error("Missing OAuth parameters", 400, cors);
        const returnUrl = await verifyGoogleOAuthState(state, env.JWT_SECRET);
        if (!returnUrl || !isAllowedAuthReturnUrl(returnUrl)) {
          return error("Invalid OAuth state", 400, cors);
        }
        const identity = await exchangeGoogleCodeForIdentity(code, {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: env.GOOGLE_REDIRECT_URI,
        });
        if (!identity) return error("Google authentication failed", 401, cors);
        const user = await findOrCreateUserForProvider(
          env.DB,
          identity.email,
          "google",
          identity.subject,
        );
        const token = await issueAuthToken(env.DB, user, env.JWT_SECRET);
        const target = new URL(returnUrl);
        target.searchParams.set("token", token);
        return Response.redirect(target.toString(), 302);
      }

      // Legacy route kept for compatibility with the existing hub web client.
      if (path === "/v1/auth/google" && request.method === "POST") {
        if (!env.JWT_SECRET) return error("Auth is not configured", 500, cors);
        const body = (await request.json().catch(() => null)) as {
          idToken?: string;
          anonymousId?: string;
        } | null;
        if (!body?.idToken) return error("idToken required", 400, cors);
        const email = await verifyGoogleIdToken(body.idToken, env.GOOGLE_CLIENT_ID);
        if (!email) return error("Invalid Google token", 401, cors);
        const user = await findOrCreateUserForProvider(env.DB, email, "google", email);
        const token = await issueAuthToken(env.DB, user, env.JWT_SECRET);
        const claimed = await claimAnonymousActivityForUser(
          env.DB,
          user.id,
          body.anonymousId,
        );
        const authUser = await getPublicAuthUser(env.DB, user);
        return json(
          {
            token,
            user: authUser,
            claimed,
            // Legacy fields for existing hub web clients:
            email: user.email,
            sessionToken: token,
            claimedComments: claimed.claimedComments,
          },
          200,
          cors,
        );
      }

      if (path === "/v1/auth/me" && request.method === "GET") {
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Unauthorized", 401, cors);
        const anonymousId = url.searchParams.get("anonymousId") || undefined;
        if (anonymousId) {
          await claimAnonymousActivityForUser(env.DB, user.id, anonymousId);
        }
        const authUser = await getPublicAuthUser(env.DB, user);
        return json({ user: authUser }, 200, cors);
      }

      // Legacy route mapped to /v1/auth/me shape for old clients.
      if (path === "/v1/auth/session" && request.method === "GET") {
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Not signed in", 401, cors);
        return json({ email: user.email, nickname: user.nickname ?? null }, 200, cors);
      }

      if (path === "/v1/auth/logout" && request.method === "POST") {
        await revokeJwtFromRequest(env.DB, request, env.JWT_SECRET);
        return json(
          { ok: true },
          200,
          {
            ...cors,
            "Set-Cookie":
              "sfl_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
          },
        );
      }

      if (path === "/v1/auth/claim-comments" && request.method === "POST") {
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Not signed in", 401, cors);
        const body = (await request.json().catch(() => null)) as {
          anonymousId?: string;
        } | null;
        if (!body?.anonymousId) return error("anonymousId required", 400, cors);
        const claimed = await claimAnonymousActivityForUser(env.DB, user.id, body.anonymousId);
        return json(claimed, 200, cors);
      }

      if (path === "/v1/profile" && request.method === "GET") {
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Not signed in", 401, cors);
        return handleGetProfile(env.DB, user, cors);
      }

      if (path === "/v1/profile" && request.method === "PUT") {
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Not signed in", 401, cors);
        const body = await request.json().catch(() => null);
        return handlePutProfile(env.DB, user, body, cors);
      }

      if (path === "/v1/profile/my-digs-today" && request.method === "GET") {
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Not signed in", 401, cors);
        return handleGetMyDigsToday(env.DB, user, hubBase, cors);
      }

      if (path === "/v1/profile/saved-lands" && request.method === "GET") {
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Not signed in", 401, cors);
        return handleGetSavedLands(env.DB, user, cors);
      }

      if (path === "/v1/profile/saved-lands" && request.method === "POST") {
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Not signed in", 401, cors);
        const body = await request.json().catch(() => null);
        return handlePostSavedLand(env.DB, user, body, cors);
      }

      const deleteSavedLandMatch = path.match(/^\/v1\/profile\/saved-lands\/([^/]+)$/);
      if (deleteSavedLandMatch && request.method === "DELETE") {
        const user = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        if (!user) return error("Not signed in", 401, cors);
        return handleDeleteSavedLand(env.DB, user, deleteSavedLandMatch[1], cors);
      }

      if (path === "/v1/snapshots" && request.method === "POST") {
        if (!verifyWriteSecret(request, env.HUB_WRITE_SECRET)) {
          return error("Unauthorized", 401, cors);
        }
        const sessionUser = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        const raw = await request.json().catch(() => null);
        if (raw && typeof raw === "object" && "landId" in raw && "digs" in raw) {
          const validated = validateDigDayBody(raw);
          if (typeof validated === "string") return error(validated, 400, cors);
          const saved = await saveDigDay(env.DB, validated, hubBase, sessionUser?.id ?? null);
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
        const limit = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("limit") || 30) || 30),
        );
        const offset = Math.max(0, Number(url.searchParams.get("offset") || 0) || 0);
        const fetchCount = limit + 1;
        const sessionUser = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        const viewerId = sessionUser?.id ?? null;

        const selectCols = `s.id, s.utc_date, s.created_at, s.digs_json, s.stats_json,
              (SELECT COUNT(*) FROM comments c WHERE c.snapshot_id = s.id) AS comment_count,
              (SELECT json_group_object(emoji, c) FROM (
                 SELECT emoji, COUNT(*) AS c FROM dig_reactions WHERE snapshot_id = s.id GROUP BY emoji
               )) AS reactions_json,
              (SELECT emoji FROM dig_reactions WHERE snapshot_id = s.id AND user_id = ?) AS viewer_emoji`;
        type Row = {
          id: string;
          utc_date: string;
          created_at: string;
          digs_json: string;
          stats_json: string;
          comment_count: number;
          reactions_json: string | null;
          viewer_emoji: string | null;
        };
        const rows = await env.DB
          .prepare(
            `SELECT ${selectCols}
             FROM snapshots s
             WHERE s.visibility = 'public'
             ORDER BY RANDOM()
             LIMIT ? OFFSET ?`,
          )
          .bind(viewerId, fetchCount, offset)
          .all<Row>();

        const all = rows.results ?? [];
        const hasMore = all.length > limit;
        const page = hasMore ? all.slice(0, limit) : all;
        const feed = page.map((r) => {
          const digs = JSON.parse(r.digs_json) as DigEntry[] | unknown;
          const digList: DigEntry[] = Array.isArray(digs) ? (digs as DigEntry[]) : [];
          const stats = JSON.parse(r.stats_json) as Record<string, unknown>;
          const counts = r.reactions_json
            ? (JSON.parse(r.reactions_json) as Record<string, number>)
            : {};
          const userEmoji = isReactionEmoji(r.viewer_emoji) ? r.viewer_emoji : null;
          return {
            id: r.id,
            utcDate: r.utc_date,
            landId: null,
            displayName: null,
            digs: digList,
            digCount: digList.length,
            commentCount: Number(r.comment_count) || 0,
            stats,
            createdAt: r.created_at,
            replayUrl: `${hubBase.replace(/\/$/, "")}/dig/${r.id}`,
            reactions: { counts, userEmoji },
          };
        });
        const nextOffset = hasMore ? offset + limit : null;
        return json({ items: feed, nextOffset }, 200, cors);
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

        const saved = await savePracticeRun(env.DB, validated, request, env.JWT_SECRET);
        return json(saved, 201, cors);
      }

      const practiceRunMatch = path.match(/^\/v1\/practice\/runs\/([^/]+)$/);
      if (practiceRunMatch && request.method === "GET") {
        const runId = practiceRunMatch[1];
        const sessionUser = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
        );
        const run = await getPracticeRunById(env.DB, runId, sessionUser?.id ?? null);
        if (!run) return error("Practice run not found", 404, cors);
        return json(run, 200, {
          ...cors,
          "Cache-Control": "public, max-age=60, must-revalidate",
        });
      }

      if (path === "/v1/practice/leaderboard" && request.method === "GET") {
        const sourceParam = url.searchParams.get("source") || "daily";
        if (sourceParam !== "daily" && sourceParam !== "random") {
          return error("source must be daily or random", 400, cors);
        }
        const sessionUser = await getUserFromSession(
          env.DB,
          sessionTokenFromRequest(request),
          env.JWT_SECRET,
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
          env.JWT_SECRET,
        );
        const limit = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("limit") || 30) || 30),
        );
        const { entries, nextCursor } = await listRecentPracticeVictories(env.DB, {
          source: sourceParam,
          before: url.searchParams.get("before"),
          limit,
          viewerUserId: sessionUser?.id ?? null,
        });
        return json(
          {
            source: sourceParam,
            entries,
            nextCursor,
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

      const reactionsMatch = path.match(/^\/v1\/snapshots\/([^/]+)\/reactions$/);
      if (reactionsMatch) {
        const snapshotId = reactionsMatch[1];
        const row = await getSnapshotById(env.DB, snapshotId);
        if (!row) return error("Snapshot not found", 404, cors);
        if (!canViewSnapshot(row) && row.visibility === "private") {
          return error("Cannot react to private snapshot", 403, cors);
        }

        async function loadReactionState(
          viewerUserId: string | null,
        ): Promise<{ counts: Record<string, number>; userEmoji: ReactionEmoji | null }> {
          const aggRow = await env.DB
            .prepare(
              `SELECT json_group_object(emoji, c) AS reactions_json FROM (
                 SELECT emoji, COUNT(*) AS c FROM dig_reactions WHERE snapshot_id = ? GROUP BY emoji
               )`,
            )
            .bind(snapshotId)
            .first<{ reactions_json: string | null }>();
          const counts = aggRow?.reactions_json
            ? (JSON.parse(aggRow.reactions_json) as Record<string, number>)
            : {};
          let userEmoji: ReactionEmoji | null = null;
          if (viewerUserId) {
            const userRow = await env.DB
              .prepare(
                `SELECT emoji FROM dig_reactions WHERE snapshot_id = ? AND user_id = ?`,
              )
              .bind(snapshotId, viewerUserId)
              .first<{ emoji: string }>();
            userEmoji = isReactionEmoji(userRow?.emoji) ? userRow.emoji : null;
          }
          return { counts, userEmoji };
        }

        if (request.method === "GET") {
          const sessionUser = await getUserFromSession(
            env.DB,
            sessionTokenFromRequest(request),
            env.JWT_SECRET,
          );
          const state = await loadReactionState(sessionUser?.id ?? null);
          return json(state, 200, cors);
        }

        if (request.method === "POST") {
          const sessionUser = await getUserFromSession(
            env.DB,
            sessionTokenFromRequest(request),
            env.JWT_SECRET,
          );
          if (!sessionUser) {
            return error("Sign in required to react", 401, cors);
          }

          const body = (await request.json().catch(() => null)) as
            | { emoji?: unknown }
            | null;
          const rawEmoji = body?.emoji ?? null;
          if (rawEmoji !== null && !isReactionEmoji(rawEmoji)) {
            return error("Invalid emoji", 400, cors);
          }

          const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
          const ipHash = await sha256Hex(`ip:${ip}`);
          if (!(await checkCommentRate(env.DB, ipHash))) {
            return error("Rate limit exceeded", 429, cors);
          }

          const existing = await env.DB
            .prepare(
              `SELECT emoji FROM dig_reactions WHERE snapshot_id = ? AND user_id = ?`,
            )
            .bind(snapshotId, sessionUser.id)
            .first<{ emoji: string }>();

          if (rawEmoji === null || existing?.emoji === rawEmoji) {
            await env.DB
              .prepare(
                `DELETE FROM dig_reactions WHERE snapshot_id = ? AND user_id = ?`,
              )
              .bind(snapshotId, sessionUser.id)
              .run();
          } else {
            await env.DB
              .prepare(
                `INSERT INTO dig_reactions (snapshot_id, user_id, emoji, created_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(snapshot_id, user_id) DO UPDATE SET
                   emoji = excluded.emoji,
                   created_at = excluded.created_at`,
              )
              .bind(snapshotId, sessionUser.id, rawEmoji, new Date().toISOString())
              .run();
          }

          const state = await loadReactionState(sessionUser.id);
          return json(state, 200, cors);
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

          const sessionUser = await getUserFromSession(
            env.DB,
            sessionTokenFromRequest(request),
            env.JWT_SECRET,
          );
          if (!sessionUser) {
            return error("Sign in required to comment", 401, cors);
          }

          const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
          if (!body || typeof body.body !== "string") {
            return error("body required", 400, cors);
          }
          const text = body.body.slice(0, 500);
          if (!text.trim()) return error("body required", 400, cors);

          const displayName =
            typeof body.displayName === "string" && body.displayName.trim()
              ? body.displayName.trim().slice(0, 32)
              : (sessionUser.nickname?.slice(0, 32) ||
                 sessionUser.email.split("@")[0]?.slice(0, 32) ||
                 "Player");

          const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
          const ipHash = await sha256Hex(`ip:${ip}`);
          if (!(await checkCommentRate(env.DB, ipHash))) {
            return error("Rate limit exceeded", 429, cors);
          }

          const anonymousId = null;
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
              sessionUser.id,
              anonymousId,
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
        const ogMeta = await metaForPath(env.DB, path, hubBase, apiBase);
        if (ogMeta) {
          const assetUrl = new URL(request.url);
          assetUrl.pathname = "/";
          const indexResponse = await env.ASSETS.fetch(
            new Request(assetUrl.toString(), { method: "GET" }),
          );
          if (indexResponse.ok) {
            const contentType = indexResponse.headers.get("content-type") ?? "";
            if (contentType.includes("text/html")) {
              return injectOgIntoHtml(indexResponse, { tags: ogMeta });
            }
          }
          return indexResponse;
        }
        return env.ASSETS.fetch(request);
      }

      return error("Not found", 404, cors);
    } catch (e) {
      console.error(e);
      const err = e as Error & { status?: number };
      if (err?.status && err.status >= 400 && err.status < 500) {
        return error(err.message || "Request failed", err.status, cors);
      }
      return error("Internal server error", 500, cors);
    }
  },
};
