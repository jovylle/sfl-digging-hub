import type { SnapshotPublic } from "@sfl-digging-hub/shared";

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
  digCount: number;
  stats: Record<string, unknown>;
  createdAt: string;
  replayUrl: string;
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

export function getCommunity(date?: string): Promise<{ date: string; items: CommunityItem[] }> {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return request(`/v1/community${q}`);
}

export function getComments(snapshotId: string): Promise<{ comments: Comment[] }> {
  return request(`/v1/snapshots/${snapshotId}/comments`);
}

export function postComment(
  snapshotId: string,
  body: { displayName: string; body: string; digRef?: number },
): Promise<Comment> {
  return request(`/v1/snapshots/${snapshotId}/comments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      ...body,
      anonymousId: getAnonymousId(),
    }),
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

export function getSession(): Promise<{ email: string }> {
  return request("/v1/auth/session", { headers: authHeaders() });
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
