/** Penalty per dig added to duration for ranking (lower score is better). */
export const PRACTICE_DIG_PENALTY_MS = 5000;

export type PracticePatternSource = "daily" | "random";

import type { DigEntry } from "./dig";

export type PracticeRunPayload = {
  patternSource: PracticePatternSource;
  patternDate?: string | null;
  patternKeys: string[];
  digCount: number;
  durationMs: number;
  victory: boolean;
  treasureCount: number;
  displayName?: string;
  anonymousId?: string;
  digs?: DigEntry[];
};

export type PracticeLeaderboardEntry = {
  id: string;
  displayName: string | null;
  patternSource: PracticePatternSource;
  patternDate: string | null;
  digCount: number;
  durationMs: number;
  score: number;
  treasureCount: number;
  createdAt: string;
  owned?: boolean;
  digs?: DigEntry[];
};

export function computePracticeScore(durationMs: number, digCount: number): number {
  const duration = Math.max(0, Math.floor(durationMs));
  const digs = Math.max(0, Math.floor(digCount));
  return duration + digs * PRACTICE_DIG_PENALTY_MS;
}

export function formatPracticeScore(score: number): string {
  const durationMs = score % PRACTICE_DIG_PENALTY_MS;
  const digs = Math.floor(score / PRACTICE_DIG_PENALTY_MS);
  const sec = Math.floor(durationMs / 1000);
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s} + ${digs} digs`;
}
