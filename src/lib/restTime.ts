// src/lib/restTime.ts
//
// Rest-time calculations for players between matches.
//
// A player is "resting" when their most recent completed match finished less than
// `min_rest_minutes` ago. Used both by the court-assignment warning modal
// (handleCourtChange in TournamentView.tsx) and the visual <RestIndicator>
// next to player names.

import type { Match } from "./types";

export interface PlayerRestStatus {
  /** True when the player's last completed match is newer than minRestMinutes ago. */
  isResting: boolean;
  /** Whole minutes remaining, rounded up. Min 1 while still resting, 0 when not. */
  minutesLeft: number;
  /** ISO timestamp of the latest completed match the player played; null if none. */
  lastCompletedAt: string | null;
}

const NOT_RESTING: PlayerRestStatus = {
  isResting: false,
  minutesLeft: 0,
  lastCompletedAt: null,
};

function containsPlayer(m: Match, playerId: number): boolean {
  return (
    m.team1_p1 === playerId ||
    m.team1_p2 === playerId ||
    m.team2_p1 === playerId ||
    m.team2_p2 === playerId
  );
}

/**
 * Computes rest status for a single player.
 *
 * Returns {@link NOT_RESTING} when:
 *  - `minRestMinutes <= 0` (feature disabled)
 *  - `playerId` is null/undefined or non-positive
 *  - the player has no completed match
 *  - the rest interval has already elapsed
 */
export function getPlayerRestStatus(
  playerId: number | null | undefined,
  matches: Match[],
  minRestMinutes: number,
  now: number,
  excludeMatchId?: number,
): PlayerRestStatus {
  if (minRestMinutes <= 0) return NOT_RESTING;
  if (playerId === null || playerId === undefined || playerId <= 0) return NOT_RESTING;

  let latestCompletedAt: string | null = null;
  for (const m of matches) {
    if (m.id === excludeMatchId) continue;
    if (m.status !== "completed" || !m.completed_at) continue;
    if (!containsPlayer(m, playerId)) continue;
    if (!latestCompletedAt || m.completed_at > latestCompletedAt) {
      latestCompletedAt = m.completed_at;
    }
  }

  if (!latestCompletedAt) return NOT_RESTING;

  const minRestMs = minRestMinutes * 60 * 1000;
  const elapsedMs = now - new Date(latestCompletedAt).getTime();
  if (elapsedMs >= minRestMs) {
    return { isResting: false, minutesLeft: 0, lastCompletedAt: latestCompletedAt };
  }

  const minutesLeft = Math.max(1, Math.ceil((minRestMs - elapsedMs) / 60_000));
  return { isResting: true, minutesLeft, lastCompletedAt: latestCompletedAt };
}

/**
 * Batch variant — returns only players who are currently resting. Scans the
 * matches list exactly once, so O(M + P) instead of O(M × P) for the
 * single-player version called in a loop.
 *
 * Usage: `const map = getRestingPlayers(...); map.get(playerId)?.minutesLeft`.
 * Absence from the map means "not resting".
 */
export function getRestingPlayers(
  matches: Match[],
  minRestMinutes: number,
  now: number,
  excludeMatchId?: number,
): Map<number, PlayerRestStatus> {
  const out = new Map<number, PlayerRestStatus>();
  if (minRestMinutes <= 0) return out;

  // First pass: for each player, find the latest completed_at across all
  // included matches.
  const latest = new Map<number, string>();
  for (const m of matches) {
    if (m.id === excludeMatchId) continue;
    if (m.status !== "completed" || !m.completed_at) continue;
    const ids = [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2];
    for (const pid of ids) {
      if (pid === null || pid === undefined || pid <= 0) continue;
      const prev = latest.get(pid);
      if (!prev || m.completed_at > prev) {
        latest.set(pid, m.completed_at);
      }
    }
  }

  // Second pass: convert to PlayerRestStatus for those still resting.
  const minRestMs = minRestMinutes * 60 * 1000;
  for (const [pid, ts] of latest) {
    const elapsedMs = now - new Date(ts).getTime();
    if (elapsedMs < minRestMs) {
      out.set(pid, {
        isResting: true,
        minutesLeft: Math.max(1, Math.ceil((minRestMs - elapsedMs) / 60_000)),
        lastCompletedAt: ts,
      });
    }
  }

  return out;
}
