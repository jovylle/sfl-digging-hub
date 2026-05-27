import { randomToken, sha256Hex } from "./crypto";

const SESSION_DAYS = 30;
const AUTH_TOKEN_DAYS = 30;
const AUTH_TOKEN_ISSUER = "sfl-digging-hub";
const AUTH_TOKEN_AUDIENCE = "d1g.uk";
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 6;
const APPROVAL_TTL_MINUTES = 10;

const NICKNAME_ADJECTIVES = [
  "Sandy", "Dusty", "Lucky", "Golden", "Swift", "Bold", "Rusty", "Wild",
  "Sharp", "Brave", "Sunny", "Gritty", "Eager", "Steady", "Quick", "Mighty",
  "Crafty", "Speedy", "Nimble", "Sturdy",
];

const NICKNAME_NOUNS = [
  "Digger", "Miner", "Scout", "Finder", "Ranger", "Seeker", "Tracker",
  "Rover", "Explorer", "Hunter", "Drifter", "Hauler", "Picker", "Delver",
  "Wanderer", "Prospector", "Spelunker", "Raider", "Sifter", "Tunneler",
];

function generateNickname(): string {
  const adj = NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)];
  const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}`;
}

export type UserRow = {
  id: string;
  email: string;
  nickname: string | null;
  created_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type AuthProvider = "email" | "google";

export type PublicAuthUser = {
  id: string;
  email: string;
  displayName?: string;
  providers: AuthProvider[];
  defaultLandId: string | null;
};

type AuthJwtClaims = {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  jti: string;
  iat: number;
  exp: number;
};

type GoogleIdentity = {
  email: string;
  subject: string;
  displayName?: string;
};

class AuthConflictError extends Error {
  status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}

function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function fromUtf8(input: Uint8Array): string {
  return new TextDecoder().decode(input);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(input: string): Uint8Array | null {
  try {
    const padded = input + "===".slice((input.length + 3) % 4);
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

async function signHmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, utf8(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function secureEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifyGoogleIdTokenRaw(
  idToken: string,
  clientId: string | undefined,
): Promise<GoogleIdentity | null> {
  if (!idToken) return null;
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    email?: string;
    email_verified?: string | boolean;
    aud?: string;
    sub?: string;
    name?: string;
  };
  if (clientId && data.aud !== clientId) return null;
  const verified =
    data.email_verified === true || data.email_verified === "true";
  if (!verified || !data.email || !data.sub) return null;
  return {
    email: normalizeEmail(data.email),
    subject: data.sub,
    displayName: data.name?.trim() || undefined,
  };
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string | undefined,
): Promise<string | null> {
  const identity = await verifyGoogleIdTokenRaw(idToken, clientId);
  return identity?.email ?? null;
}

export async function findOrCreateUser(
  db: D1Database,
  email: string,
): Promise<UserRow> {
  const normalized = normalizeEmail(email);
  const existing = await db
    .prepare("SELECT id, email, nickname, created_at FROM users WHERE email = ?")
    .bind(normalized)
    .first<UserRow>();
  if (existing) return existing;

  const id = crypto.randomUUID();
  const nickname = generateNickname();
  const createdAt = new Date().toISOString();
  await db
    .prepare("INSERT INTO users (id, email, nickname, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, normalized, nickname, createdAt)
    .run();
  return { id, email: normalized, nickname, created_at: createdAt };
}

async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  const user = await db
    .prepare("SELECT id, email, nickname, created_at FROM users WHERE id = ?")
    .bind(id)
    .first<UserRow>();
  return user ?? null;
}

async function ensureAuthProvider(
  db: D1Database,
  userId: string,
  provider: AuthProvider,
  providerSubject: string,
  options?: {
    legacySubjects?: string[];
  },
): Promise<void> {
  const bySubject = await db
    .prepare(
      "SELECT user_id FROM auth_providers WHERE provider = ? AND provider_subject = ? LIMIT 1",
    )
    .bind(provider, providerSubject)
    .first<{ user_id: string }>();
  if (bySubject && bySubject.user_id !== userId) {
    throw new AuthConflictError(
      "This provider is already linked to a different account.",
    );
  }

  const byUser = await db
    .prepare(
      "SELECT provider_subject FROM auth_providers WHERE user_id = ? AND provider = ? LIMIT 1",
    )
    .bind(userId, provider)
    .first<{ provider_subject: string | null }>();
  if (byUser?.provider_subject && byUser.provider_subject !== providerSubject) {
    const legacySubjects = new Set((options?.legacySubjects ?? []).filter(Boolean));
    if (legacySubjects.has(byUser.provider_subject)) {
      await db
        .prepare(
          `UPDATE auth_providers
           SET provider_subject = ?
           WHERE user_id = ? AND provider = ?`,
        )
        .bind(providerSubject, userId, provider)
        .run();
      return;
    }
    throw new AuthConflictError(
      "Your account is already linked to a different identity for this provider.",
    );
  }

  await db
    .prepare(
      `INSERT INTO auth_providers (user_id, provider, provider_subject, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, provider) DO UPDATE SET
         provider_subject = excluded.provider_subject`,
    )
    .bind(userId, provider, providerSubject, new Date().toISOString())
    .run();
}

async function listUserProviders(
  db: D1Database,
  userId: string,
): Promise<AuthProvider[]> {
  const rows = await db
    .prepare(
      "SELECT provider FROM auth_providers WHERE user_id = ? ORDER BY provider ASC",
    )
    .bind(userId)
    .all<{ provider: string }>();
  const providers = new Set<AuthProvider>();
  for (const row of rows.results ?? []) {
    if (row.provider === "email" || row.provider === "google") {
      providers.add(row.provider);
    }
  }
  return [...providers];
}

async function getDefaultLandId(db: D1Database, userId: string): Promise<string | null> {
  const row = await db
    .prepare(
      "SELECT land_id FROM user_saved_lands WHERE user_id = ? ORDER BY saved_at DESC LIMIT 1",
    )
    .bind(userId)
    .first<{ land_id: string | null }>();
  return row?.land_id ?? null;
}

export async function getPublicAuthUser(
  db: D1Database,
  user: UserRow,
): Promise<PublicAuthUser> {
  const providers = await listUserProviders(db, user.id);
  const defaultLandId = await getDefaultLandId(db, user.id);
  const displayName = user.nickname?.trim() || undefined;
  return {
    id: user.id,
    email: user.email,
    displayName,
    providers,
    defaultLandId,
  };
}

async function buildAuthJwt(
  claims: AuthJwtClaims,
  secret: string,
): Promise<string> {
  const header = bytesToBase64Url(utf8(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = bytesToBase64Url(utf8(JSON.stringify(claims)));
  const signingInput = `${header}.${payload}`;
  const signature = await signHmac(secret, signingInput);
  return `${signingInput}.${signature}`;
}

async function verifyAuthJwt(
  token: string,
  secret: string | undefined,
): Promise<AuthJwtClaims | null> {
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expected = await signHmac(secret, signingInput);
  if (!secureEquals(expected, signatureB64)) return null;
  const payloadBytes = base64UrlToBytes(payloadB64);
  if (!payloadBytes) return null;
  const claims = JSON.parse(fromUtf8(payloadBytes)) as Partial<AuthJwtClaims>;
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== AUTH_TOKEN_ISSUER ||
    claims.aud !== AUTH_TOKEN_AUDIENCE ||
    typeof claims.sub !== "string" ||
    typeof claims.email !== "string" ||
    typeof claims.jti !== "string" ||
    typeof claims.exp !== "number" ||
    claims.exp <= now
  ) {
    return null;
  }
  return claims as AuthJwtClaims;
}

export async function issueAuthToken(
  db: D1Database,
  user: UserRow,
  jwtSecret: string | undefined,
): Promise<string> {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  const now = Math.floor(Date.now() / 1000);
  const claims: AuthJwtClaims = {
    iss: AUTH_TOKEN_ISSUER,
    aud: AUTH_TOKEN_AUDIENCE,
    sub: user.id,
    email: user.email,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + AUTH_TOKEN_DAYS * 24 * 60 * 60,
  };
  return buildAuthJwt(claims, jwtSecret);
}

function parseCookie(request: Request, key: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const parts = cookie.split(";").map((p) => p.trim());
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name !== key) continue;
    return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken();
  const tokenHash = await sha256Hex(`session:${token}`);
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  const expiresAt = expires.toISOString();
  await db
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    )
    .bind(tokenHash, userId, expiresAt)
    .run();
  return token;
}

export async function getUserFromSession(
  db: D1Database,
  sessionToken: string | null,
  jwtSecret?: string,
): Promise<UserRow | null> {
  if (!sessionToken) return null;
  if (sessionToken.includes(".") && jwtSecret) {
    const claims = await verifyAuthJwt(sessionToken, jwtSecret);
    if (!claims) return null;
    const revoked = await db
      .prepare("SELECT 1 AS found FROM auth_revoked_tokens WHERE jti = ? LIMIT 1")
      .bind(claims.jti)
      .first<{ found: number }>();
    if (revoked?.found) return null;
    return getUserById(db, claims.sub);
  }
  const tokenHash = await sha256Hex(`session:${sessionToken}`);
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.nickname, u.created_at FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first<UserRow>();
  return row ?? null;
}

export function sessionTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookieToken = parseCookie(request, "sfl_session");
  if (cookieToken) return cookieToken;
  return request.headers.get("X-Session-Token");
}

export async function claimCommentsForUser(
  db: D1Database,
  userId: string,
  anonymousId: string,
): Promise<number> {
  if (!anonymousId || anonymousId.length > 64) return 0;
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE comments SET user_id = ?, claimed_at = ?
       WHERE anonymous_id = ? AND user_id IS NULL`,
    )
    .bind(userId, now, anonymousId)
    .run();
  return result.meta.changes ?? 0;
}

export async function claimPracticeRunsForUser(
  db: D1Database,
  userId: string,
  anonymousId: string,
): Promise<number> {
  if (!anonymousId || anonymousId.length > 64) return 0;
  const result = await db
    .prepare(
      `UPDATE practice_runs
       SET user_id = ?, anonymous_id = NULL
       WHERE anonymous_id = ? AND user_id IS NULL`,
    )
    .bind(userId, anonymousId)
    .run();
  return result.meta.changes ?? 0;
}

export async function claimAnonymousActivityForUser(
  db: D1Database,
  userId: string,
  anonymousId: string | undefined,
): Promise<{ claimedComments: number; claimedPracticeRuns: number }> {
  if (!anonymousId) return { claimedComments: 0, claimedPracticeRuns: 0 };
  const [claimedComments, claimedPracticeRuns] = await Promise.all([
    claimCommentsForUser(db, userId, anonymousId),
    claimPracticeRunsForUser(db, userId, anonymousId),
  ]);
  return { claimedComments, claimedPracticeRuns };
}

function generateOtpCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, "0");
}

export async function storeEmailOtp(
  db: D1Database,
  email: string,
  code: string,
  ipHash: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60_000).toISOString();
  const createdAt = now.toISOString();
  const codeHash = await sha256Hex(`otp:${normalized}:${code}`);
  await db
    .prepare(
      `INSERT INTO auth_email_otps (
        id, email, code_hash, expires_at, attempts, consumed_at, created_at, ip_hash
      ) VALUES (?, ?, ?, ?, 0, NULL, ?, ?)`,
    )
    .bind(crypto.randomUUID(), normalized, codeHash, expiresAt, createdAt, ipHash)
    .run();
}

export async function createAndStoreEmailOtp(
  db: D1Database,
  email: string,
  ipHash: string,
): Promise<string> {
  const code = generateOtpCode();
  await storeEmailOtp(db, email, code, ipHash);
  return code;
}

export async function verifyEmailOtp(
  db: D1Database,
  email: string,
  code: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!/^\d{6}$/.test(code)) return false;
  const row = await db
    .prepare(
      `SELECT id, code_hash, attempts, expires_at
       FROM auth_email_otps
       WHERE email = ? AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(normalized)
    .first<{ id: string; code_hash: string; attempts: number; expires_at: string }>();
  if (!row) return false;
  if (new Date(row.expires_at).getTime() <= Date.now()) return false;
  if ((row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) return false;

  const codeHash = await sha256Hex(`otp:${normalized}:${code}`);
  if (!secureEquals(codeHash, row.code_hash)) {
    await db
      .prepare("UPDATE auth_email_otps SET attempts = attempts + 1 WHERE id = ?")
      .bind(row.id)
      .run();
    return false;
  }
  await db
    .prepare(
      "UPDATE auth_email_otps SET attempts = attempts + 1, consumed_at = ? WHERE id = ?",
    )
    .bind(new Date().toISOString(), row.id)
    .run();
  return true;
}

export async function findOrCreateUserForProvider(
  db: D1Database,
  email: string,
  provider: AuthProvider,
  providerSubject: string,
): Promise<UserRow> {
  const normalized = normalizeEmail(email);
  let user = await db
    .prepare("SELECT id, email, nickname, created_at FROM users WHERE email = ?")
    .bind(normalized)
    .first<UserRow>();
  if (!user) {
    user = await findOrCreateUser(db, normalized);
  }
  await ensureAuthProvider(db, user.id, provider, providerSubject, {
    // Legacy Google sign-ins used email as provider_subject. Allow transparent
    // one-time upgrade to the stable Google subject when the same user signs in.
    legacySubjects: provider === "google" ? [normalized] : [],
  });
  return user;
}

export async function revokeJwtFromRequest(
  db: D1Database,
  request: Request,
  jwtSecret: string | undefined,
): Promise<boolean> {
  const token = sessionTokenFromRequest(request);
  if (!token || !jwtSecret || !token.includes(".")) return false;
  const claims = await verifyAuthJwt(token, jwtSecret);
  if (!claims) return false;
  await db
    .prepare(
      `INSERT INTO auth_revoked_tokens (jti, user_id, expires_at, revoked_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(jti) DO NOTHING`,
    )
    .bind(
      claims.jti,
      claims.sub,
      new Date(claims.exp * 1000).toISOString(),
      new Date().toISOString(),
    )
    .run();
  return true;
}

export function createGoogleOAuthState(
  returnUrl: string,
  jwtSecret: string | undefined,
): Promise<string> {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  const payload = JSON.stringify({
    returnUrl,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
    nonce: crypto.randomUUID(),
  });
  const encoded = bytesToBase64Url(utf8(payload));
  return signHmac(jwtSecret, `oauth-state:${encoded}`).then(
    (signature) => `${encoded}.${signature}`,
  );
}

export async function verifyGoogleOAuthState(
  state: string,
  jwtSecret: string | undefined,
): Promise<string | null> {
  if (!jwtSecret || !state?.includes(".")) return null;
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;
  const expected = await signHmac(jwtSecret, `oauth-state:${encoded}`);
  if (!secureEquals(expected, signature)) return null;
  const payloadBytes = base64UrlToBytes(encoded);
  if (!payloadBytes) return null;
  const payload = JSON.parse(fromUtf8(payloadBytes)) as {
    returnUrl?: string;
    exp?: number;
  };
  if (!payload.returnUrl || typeof payload.exp !== "number") return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload.returnUrl;
}

export async function exchangeGoogleCodeForIdentity(
  code: string,
  options: {
    clientId: string | undefined;
    clientSecret: string | undefined;
    redirectUri: string | undefined;
  },
): Promise<GoogleIdentity | null> {
  if (!code || !options.clientId || !options.clientSecret || !options.redirectUri) {
    return null;
  }

  const form = new URLSearchParams();
  form.set("code", code);
  form.set("client_id", options.clientId);
  form.set("client_secret", options.clientSecret);
  form.set("redirect_uri", options.redirectUri);
  form.set("grant_type", "authorization_code");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!tokenRes.ok) return null;
  const tokenData = (await tokenRes.json()) as {
    id_token?: string;
    access_token?: string;
  };

  if (tokenData.id_token) {
    const identity = await verifyGoogleIdTokenRaw(tokenData.id_token, options.clientId);
    if (identity) return identity;
  }
  if (!tokenData.access_token) return null;
  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) return null;
  const userInfo = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!userInfo.sub || !userInfo.email || userInfo.email_verified !== true) return null;
  return {
    email: normalizeEmail(userInfo.email),
    subject: userInfo.sub,
    displayName: userInfo.name?.trim() || undefined,
  };
}

export function buildGoogleAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function sendOtpEmail(
  email: string,
  code: string,
  options: {
    from?: string;
    resendApiKey?: string;
  },
): Promise<void> {
  if (!options.resendApiKey || !options.from) {
    console.log(`OTP email provider not configured; code for ${email}: ${code}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: [email],
      subject: "Your d1g.uk sign-in code",
      text: `Your sign-in code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "unknown");
    throw new Error(`Failed to send OTP email (${response.status}): ${body}`);
  }
}

export async function checkRateLimit(
  db: D1Database,
  scope: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSeconds);
  const row = await db
    .prepare(
      "SELECT count FROM auth_rate_limits WHERE scope = ? AND rate_key = ? AND window_start = ?",
    )
    .bind(scope, key, windowStart)
    .first<{ count: number }>();
  if ((row?.count ?? 0) >= limit) return false;
  await db
    .prepare(
      `INSERT INTO auth_rate_limits (scope, rate_key, window_start, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(scope, rate_key, window_start) DO UPDATE SET count = count + 1`,
    )
    .bind(scope, key, windowStart)
    .run();
  return true;
}

export type EmailApprovalStartResult = {
  requestId: string;
  challengeId: string;
  flowId: string;
  expiresAt: string;
  status: "pending";
};

type ApprovalLookupRow = {
  id: string;
  email: string;
  challenge_id: string;
  flow_id: string;
  expires_at: string;
  approved_at: string | null;
  session_consumed_at: string | null;
};

async function getLatestEmailApprovalForEmail(
  db: D1Database,
  email: string,
): Promise<ApprovalLookupRow | null> {
  const normalized = normalizeEmail(email);
  return (
    (await db
      .prepare(
        `SELECT id, email, challenge_id, flow_id, expires_at, approved_at, session_consumed_at
         FROM auth_email_approvals
         WHERE email = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(normalized)
      .first<ApprovalLookupRow>()) ?? null
  );
}

export async function createEmailApprovalRequest(
  db: D1Database,
  email: string,
  options: {
    returnUrl: string | null;
    ipHash: string;
  },
): Promise<EmailApprovalStartResult & { approveToken: string }> {
  const normalized = normalizeEmail(email);
  const requestId = crypto.randomUUID();
  const challengeId = crypto.randomUUID();
  const flowId = crypto.randomUUID();
  const approveToken = randomToken();
  const tokenHash = await sha256Hex(`approve:${requestId}:${approveToken}`);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + APPROVAL_TTL_MINUTES * 60_000).toISOString();
  const createdAt = now.toISOString();

  await db
    .prepare(
      `INSERT INTO auth_email_approvals (
        id, email, challenge_id, flow_id, token_hash, return_url,
        expires_at, approved_at, approval_consumed_at, session_consumed_at,
        request_ip_hash, approved_ip_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?, ?)`,
    )
    .bind(
      requestId,
      normalized,
      challengeId,
      flowId,
      tokenHash,
      options.returnUrl,
      expiresAt,
      options.ipHash,
      createdAt,
      createdAt,
    )
    .run();

  return {
    requestId,
    challengeId,
    flowId,
    expiresAt,
    status: "pending",
    approveToken,
  };
}

export async function approveEmailRequestByLink(
  db: D1Database,
  options: {
    requestId: string;
    email: string;
    approveToken: string;
    approvedIpHash: string;
  },
): Promise<{ ok: boolean; returnUrl: string | null; reason?: "invalid" | "expired" }> {
  const normalized = normalizeEmail(options.email);
  const tokenHash = await sha256Hex(`approve:${options.requestId}:${options.approveToken}`);
  const row = await db
    .prepare(
      `SELECT id, expires_at, approved_at, approval_consumed_at, return_url
       FROM auth_email_approvals
       WHERE id = ? AND email = ? AND token_hash = ?`,
    )
    .bind(options.requestId, normalized, tokenHash)
    .first<{
      id: string;
      expires_at: string;
      approved_at: string | null;
      approval_consumed_at: string | null;
      return_url: string | null;
    }>();
  if (!row) return { ok: false, returnUrl: null, reason: "invalid" };

  if (
    new Date(row.expires_at).getTime() <= Date.now() ||
    row.approval_consumed_at ||
    row.approved_at
  ) {
    return { ok: false, returnUrl: row.return_url ?? null, reason: "expired" };
  }

  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE auth_email_approvals
       SET approved_at = ?, approval_consumed_at = ?, approved_ip_hash = ?, updated_at = ?
       WHERE id = ? AND approved_at IS NULL AND approval_consumed_at IS NULL`,
    )
    .bind(now, now, options.approvedIpHash, now, row.id)
    .run();
  if ((result.meta.changes ?? 0) < 1) {
    return { ok: false, returnUrl: row.return_url ?? null, reason: "expired" };
  }
  return { ok: true, returnUrl: row.return_url ?? null };
}

export async function getEmailApprovalStatus(
  db: D1Database,
  options: {
    email: string;
    requestId?: string;
    challengeId?: string;
    flowId?: string;
  },
): Promise<
  | {
      status: "pending";
      requestId: string;
      challengeId: string;
      flowId: string;
      expiresAt: string;
    }
  | {
      status: "approved";
      requestId: string;
      challengeId: string;
      flowId: string;
      expiresAt: string;
    }
  | {
      status: "expired";
      requestId: string;
    }
  | {
      status: "consumed";
      requestId: string;
    }
  | {
      status: "none";
    }
> {
  const normalized = normalizeEmail(options.email);
  let row: ApprovalLookupRow | null = null;

  if (options.requestId) {
    row =
      (await db
        .prepare(
          `SELECT id, email, challenge_id, flow_id, expires_at, approved_at, session_consumed_at
           FROM auth_email_approvals
           WHERE id = ? AND email = ?
           LIMIT 1`,
        )
        .bind(options.requestId, normalized)
        .first<ApprovalLookupRow>()) ?? null;
  } else if (options.challengeId) {
    row =
      (await db
        .prepare(
          `SELECT id, email, challenge_id, flow_id, expires_at, approved_at, session_consumed_at
           FROM auth_email_approvals
           WHERE challenge_id = ? AND email = ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .bind(options.challengeId, normalized)
        .first<ApprovalLookupRow>()) ?? null;
  } else if (options.flowId) {
    row =
      (await db
        .prepare(
          `SELECT id, email, challenge_id, flow_id, expires_at, approved_at, session_consumed_at
           FROM auth_email_approvals
           WHERE flow_id = ? AND email = ?
           ORDER BY created_at DESC
           LIMIT 1`,
        )
        .bind(options.flowId, normalized)
        .first<ApprovalLookupRow>()) ?? null;
  } else {
    row = await getLatestEmailApprovalForEmail(db, normalized);
  }

  if (!row) return { status: "none" };
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { status: "expired", requestId: row.id };
  }
  if (row.session_consumed_at) {
    return { status: "consumed", requestId: row.id };
  }
  if (!row.approved_at) {
    return {
      status: "pending",
      requestId: row.id,
      challengeId: row.challenge_id,
      flowId: row.flow_id,
      expiresAt: row.expires_at,
    };
  }
  return {
    status: "approved",
    requestId: row.id,
    challengeId: row.challenge_id,
    flowId: row.flow_id,
    expiresAt: row.expires_at,
  };
}

export async function consumeEmailApprovalSession(
  db: D1Database,
  requestId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE auth_email_approvals
       SET session_consumed_at = ?, updated_at = ?
       WHERE id = ? AND approved_at IS NOT NULL AND session_consumed_at IS NULL`,
    )
    .bind(now, now, requestId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function sendApprovalEmail(
  email: string,
  approveUrl: string,
  options: {
    from?: string;
    resendApiKey?: string;
  },
): Promise<void> {
  if (!options.resendApiKey || !options.from) {
    console.log(`Approval email provider not configured; link for ${email}: ${approveUrl}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: [email],
      subject: "Approve sign in to d1g.uk",
      text: `Open this link to approve sign in: ${approveUrl}\n\nThis link expires in ${APPROVAL_TTL_MINUTES} minutes.`,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "unknown");
    throw new Error(`Failed to send approval email (${response.status}): ${body}`);
  }
}
