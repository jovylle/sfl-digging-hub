import type {
  DigEntry,
  PracticeLeaderboardEntry,
  PracticePatternSource,
  PracticeRunPayload,
  ReactionEmoji,
  SnapshotPublic,
} from "@sfl-digging-hub/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export type Comment = {
  id: string;
  displayName: string;
  body: string;
  digRef: number | null;
  createdAt: string;
  owned?: boolean;
};

export type CommunityItem = {
  id: string;
  utcDate: string;
  landId: string | null;
  displayName: string | null;
  digs: DigEntry[];
  digCount: number;
  commentCount: number;
  stats: Record<string, unknown>;
  createdAt: string;
  replayUrl: string;
  reactions: {
    counts: Record<string, number>;
    userEmoji: ReactionEmoji | null;
  };
};

export type LandDayItem = {
  id: string;
  utcDate: string;
  digCount: number;
  updatedAt: string;
  replayUrl: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  return data as T;
}

function authHeaders(): HeadersInit {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getSnapshot(id: string): Promise<SnapshotPublic> {
  return request(`/v1/snapshots/${id}`);
}

export function getLandDays(landId: string): Promise<{ landId: string; days: LandDayItem[] }> {
  return request(`/v1/lands/${encodeURIComponent(landId)}/days`);
}

export function getCommunity(options: {
  before?: string | null;
  limit?: number;
} = {}): Promise<{ items: CommunityItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (options.before) params.set("before", options.before);
  if (options.limit) params.set("limit", String(options.limit));
  const q = params.toString();
  return request(`/v1/community${q ? `?${q}` : ""}`);
}

export function getComments(snapshotId: string): Promise<{ comments: Comment[] }> {
  return request(`/v1/snapshots/${snapshotId}/comments`);
}

export function postComment(
  snapshotId: string,
  body: { body: string },
): Promise<Comment> {
  return request(`/v1/snapshots/${snapshotId}/comments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export function reactToSnapshot(
  snapshotId: string,
  emoji: ReactionEmoji | null,
): Promise<{ counts: Record<string, number>; userEmoji: ReactionEmoji | null }> {
  return request(`/v1/snapshots/${snapshotId}/reactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ emoji }),
  });
}

export function checkHealth(): Promise<{ ok: boolean }> {
  return request("/health");
}

export const JOURNAL_LAND_KEY = "sfl-hub-journal-land";

export function loadJournalLandId(): string | null {
  return localStorage.getItem(JOURNAL_LAND_KEY);
}

export function saveJournalLandId(landId: string): void {
  localStorage.setItem(JOURNAL_LAND_KEY, landId);
}

const ANON_KEY = "sfl-hub-anonymous-id";
const SESSION_KEY = "sfl-hub-session";

export function getAnonymousId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string | null): void {
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

export type SessionInfo = {
  email: string;
  nickname: string | null;
};

export function getDisplayName(session: SessionInfo): string {
  return session.nickname?.trim() || session.email.split("@")[0] || "Player";
}

export function getSession(): Promise<SessionInfo> {
  return request("/v1/auth/session", { headers: authHeaders() });
}

export type SavedLand = {
  landId: string;
  savedAt: string;
};

export function getProfile(): Promise<SessionInfo> {
  return request("/v1/profile", { headers: authHeaders() });
}

export function updateProfile(data: { nickname: string | null }): Promise<{ nickname: string | null }> {
  return request("/v1/profile", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export function getSavedLands(): Promise<{ lands: SavedLand[] }> {
  return request("/v1/profile/saved-lands", { headers: authHeaders() });
}

export function saveLand(landId: string): Promise<{ landId: string; savedAt: string; total: number }> {
  return request("/v1/profile/saved-lands", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ landId }),
  });
}

export function unsaveLand(landId: string): Promise<{ ok: boolean }> {
  return request(`/v1/profile/saved-lands/${encodeURIComponent(landId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export function signInWithGoogle(idToken: string): Promise<{
  email: string;
  sessionToken: string;
  claimedComments: number;
}> {
  return request("/v1/auth/google", {
    method: "POST",
    body: JSON.stringify({
      idToken,
      anonymousId: getAnonymousId(),
    }),
  });
}

export function signOut(): void {
  setSessionToken(null);
}

export function submitPracticeRun(
  body: Omit<PracticeRunPayload, "anonymousId">,
): Promise<PracticeLeaderboardEntry> {
  return request("/v1/practice/runs", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      ...body,
      anonymousId: getAnonymousId(),
    }),
  });
}

export function getPracticeLeaderboard(options: {
  source: PracticePatternSource;
  date?: string;
}): Promise<{
  source: PracticePatternSource;
  date: string;
  entries: PracticeLeaderboardEntry[];
}> {
  const params = new URLSearchParams({ source: options.source });
  if (options.source === "daily" && options.date) {
    params.set("date", options.date);
  }
  return request(`/v1/practice/leaderboard?${params.toString()}`);
}

/** Recent practice victories, newest first (like the community dig list). */
export function getPracticeVictories(options: {
  source: PracticePatternSource;
  before?: string | null;
  limit?: number;
}): Promise<{
  source: PracticePatternSource;
  entries: PracticeLeaderboardEntry[];
  nextCursor: string | null;
}> {
  const params = new URLSearchParams({ source: options.source });
  if (options.before) params.set("before", options.before);
  if (options.limit) params.set("limit", String(options.limit));
  return request(`/v1/practice/victories?${params.toString()}`);
}
