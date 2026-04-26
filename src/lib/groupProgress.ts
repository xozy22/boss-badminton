// src/lib/groupProgress.ts
//
// Group-phase progress aggregation. Used to:
//   1. Render a per-group progress bar above the match queue
//      (<GroupProgressBar />) with per-round status pills baked in,
//      so the tournament director sees which group is leading/lagging
//      AND which specific rounds within each group are done.
//   2. Sort the unassigned-match queue in CourtOverview so that
//      matches from the group with the largest backlog appear first —
//      the simplest heuristic that keeps groups in lockstep so they
//      finish around the same time before KO starts.
//
// All helpers ignore non-group rounds (KO, third_place, …). Cheap to
// recompute on every match completion (O(n) in matches).

import type { Match, Round } from "./types";

export interface GroupRoundProgress {
  roundId: number;
  /** "1", "2", "3" — index inside the group's round sequence. */
  label: string;
  /** All matches in this round are completed. */
  isComplete: boolean;
  /** Some matches are completed but at least one is still pending/active. */
  isPartial: boolean;
}

export interface GroupProgress {
  /** group_number, 1-based. */
  group: number;
  /** Matches with status === "completed". */
  completed: number;
  /** Total matches scheduled for this group. */
  total: number;
  /** total - completed. Matches still pending or in progress. */
  remaining: number;
  /** Per-round status pills for inline rendering. */
  rounds: GroupRoundProgress[];
}

/**
 * Aggregates per-group match counts from group-phase rounds. Returns one
 * entry per group, sorted ascending by group number. Non-group rounds
 * (phase !== "group") are ignored.
 */
export function getGroupProgress(
  rounds: Round[],
  matchesByRound: Map<number, Match[]>,
): GroupProgress[] {
  // Bucket rounds by group_number first.
  const byGroup = new Map<number, Round[]>();
  for (const r of rounds) {
    if (r.phase !== "group" || r.group_number == null) continue;
    const arr = byGroup.get(r.group_number) ?? [];
    arr.push(r);
    byGroup.set(r.group_number, arr);
  }

  return Array.from(byGroup.entries())
    .sort(([a], [b]) => a - b)
    .map(([group, gRounds]) => {
      const sorted = [...gRounds].sort((a, b) => a.round_number - b.round_number);
      let completed = 0;
      let total = 0;
      const roundProgress: GroupRoundProgress[] = sorted.map((r, idx) => {
        const matches = matchesByRound.get(r.id) ?? [];
        const done = matches.filter((m) => m.status === "completed").length;
        total += matches.length;
        completed += done;
        return {
          roundId: r.id,
          label: String(idx + 1),
          isComplete: matches.length > 0 && done === matches.length,
          isPartial: done > 0 && done < matches.length,
        };
      });
      return {
        group,
        completed,
        total,
        remaining: total - completed,
        rounds: roundProgress,
      };
    });
}

/**
 * Map<groupNumber, remainingMatches>. Used as the priority lookup when
 * sorting the unassigned-match queue (bigger remaining = higher priority).
 */
export function getRemainingByGroup(
  rounds: Round[],
  matchesByRound: Map<number, Match[]>,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of getGroupProgress(rounds, matchesByRound)) {
    out.set(p.group, p.remaining);
  }
  return out;
}

/**
 * Map<roundId, groupNumber> — fast lookup so a Match can be mapped to its
 * group via round_id without scanning rounds[] for every comparison.
 */
export function getRoundToGroupMap(rounds: Round[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of rounds) {
    if (r.group_number != null) out.set(r.id, r.group_number);
  }
  return out;
}
