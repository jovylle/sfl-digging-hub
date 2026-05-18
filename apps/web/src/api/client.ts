import type { CreateSnapshotResponse, SnapshotPublic } from "@sfl-digging-hub/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export type Comment = {
  id: string;
  displayName: string;
  body: string;
  digRef: number | null;
  createdAt: string;
};

export type CommunityItem = {
  id: string;
  utcDate: string;
  displayName: string | null;
  digCount: number;
  stats: Record<string, unknown>;
  createdAt: string;
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

export function getSnapshot(id: string, editToken?: string): Promise<SnapshotPublic> {
  const headers: HeadersInit = {};
  if (editToken) headers["X-Edit-Token"] = editToken;
  return request(`/v1/snapshots/${id}`, { headers });
}

export function getMySnapshots(landId: string, editToken: string): Promise<{ snapshots: SnapshotPublic[] }> {
  const q = new URLSearchParams({ land_id: landId });
  return request(`/v1/snapshots/mine?${q}`, {
    headers: { "X-Edit-Token": editToken },
  });
}

export function getCommunity(date?: string): Promise<{ date: string; items: CommunityItem[] }> {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  return request(`/v1/community${q}`);
}

export function getComments(snapshotId: string, editToken?: string): Promise<{ comments: Comment[] }> {
  const headers: HeadersInit = {};
  if (editToken) headers["X-Edit-Token"] = editToken;
  return request(`/v1/snapshots/${snapshotId}/comments`, { headers });
}

export function postComment(
  snapshotId: string,
  body: { displayName: string; body: string; digRef?: number },
): Promise<Comment> {
  return request(`/v1/snapshots/${snapshotId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createSnapshot(body: unknown): Promise<CreateSnapshotResponse> {
  return request("/v1/snapshots", { method: "POST", body: JSON.stringify(body) });
}

export function checkHealth(): Promise<{ ok: boolean }> {
  return request("/health");
}

export const JOURNAL_STORAGE_KEY = "sfl-hub-journal";

export type JournalCredentials = {
  landId: string;
  editToken: string;
};

export function loadJournalCreds(): JournalCredentials | null {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JournalCredentials;
    if (parsed.landId && parsed.editToken) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveJournalCreds(creds: JournalCredentials): void {
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(creds));
}
