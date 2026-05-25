import type { UserRow } from "./auth";
import { isValidLandId } from "./digDay";

const NICKNAME_MAX_LEN = 30;

function validateNickname(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return "nickname must be a string";
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > NICKNAME_MAX_LEN) {
    return `nickname must be ${NICKNAME_MAX_LEN} characters or fewer`;
  }
  return null;
}

export async function handleGetProfile(
  db: D1Database,
  user: UserRow,
  cors: HeadersInit,
): Promise<Response> {
  return Response.json(
    { email: user.email, nickname: user.nickname ?? null },
    { status: 200, headers: cors },
  );
}

export async function handlePutProfile(
  db: D1Database,
  user: UserRow,
  body: unknown,
  cors: HeadersInit,
): Promise<Response> {
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: cors });
  }
  const b = body as Record<string, unknown>;
  const validationError = validateNickname(b.nickname);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400, headers: cors });
  }

  const nickname =
    typeof b.nickname === "string" && b.nickname.trim().length > 0
      ? b.nickname.trim()
      : null;

  await db
    .prepare("UPDATE users SET nickname = ? WHERE id = ?")
    .bind(nickname, user.id)
    .run();

  return Response.json({ nickname }, { status: 200, headers: cors });
}

export async function handleGetSavedLands(
  db: D1Database,
  user: UserRow,
  cors: HeadersInit,
): Promise<Response> {
  const rows = await db
    .prepare(
      "SELECT land_id, saved_at FROM user_saved_lands WHERE user_id = ? ORDER BY saved_at DESC",
    )
    .bind(user.id)
    .all<{ land_id: string; saved_at: string }>();

  const lands = (rows.results ?? []).map((r) => ({
    landId: r.land_id,
    savedAt: r.saved_at,
  }));

  return Response.json({ lands }, { status: 200, headers: cors });
}

export async function handlePostSavedLand(
  db: D1Database,
  user: UserRow,
  body: unknown,
  cors: HeadersInit,
): Promise<Response> {
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: cors });
  }
  const b = body as Record<string, unknown>;
  const landId = typeof b.landId === "string" ? b.landId.trim() : "";
  if (!landId || !isValidLandId(landId)) {
    return Response.json({ error: "Invalid landId" }, { status: 400, headers: cors });
  }

  const savedAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO user_saved_lands (user_id, land_id, saved_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, land_id) DO NOTHING`,
    )
    .bind(user.id, landId, savedAt)
    .run();

  const count = await db
    .prepare("SELECT COUNT(*) AS c FROM user_saved_lands WHERE user_id = ?")
    .bind(user.id)
    .first<{ c: number }>();

  return Response.json(
    { landId, savedAt, total: count?.c ?? 0 },
    { status: 201, headers: cors },
  );
}

export async function handleDeleteSavedLand(
  db: D1Database,
  user: UserRow,
  landId: string,
  cors: HeadersInit,
): Promise<Response> {
  if (!landId || !isValidLandId(landId)) {
    return Response.json({ error: "Invalid landId" }, { status: 400, headers: cors });
  }

  await db
    .prepare("DELETE FROM user_saved_lands WHERE user_id = ? AND land_id = ?")
    .bind(user.id, landId)
    .run();

  return Response.json({ ok: true }, { status: 200, headers: cors });
}
