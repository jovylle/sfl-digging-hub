import { randomToken, sha256Hex } from "./crypto";

const SESSION_DAYS = 30;

export type UserRow = {
  id: string;
  email: string;
  nickname: string | null;
  created_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string | undefined,
): Promise<string | null> {
  if (!idToken) return null;
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    email?: string;
    email_verified?: string | boolean;
    aud?: string;
  };
  if (clientId && data.aud !== clientId) return null;
  const verified =
    data.email_verified === true || data.email_verified === "true";
  if (!verified || !data.email) return null;
  return normalizeEmail(data.email);
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
  const createdAt = new Date().toISOString();
  await db
    .prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)")
    .bind(id, normalized, createdAt)
    .run();
  return { id, email: normalized, nickname: null, created_at: createdAt };
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
): Promise<UserRow | null> {
  if (!sessionToken) return null;
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
