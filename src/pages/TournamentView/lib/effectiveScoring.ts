// src/pages/TournamentView/lib/effectiveScoring.ts
//
// Returns the effective points-per-set / sets-to-win / cap for a given
// round phase. For `group_ko`, the KO phase can have its own scoring
// override (ko_points_per_set etc.) — every other format always uses the
// top-level tournament settings.

import type { Tournament } from "../../../lib/types";

export function getEffectiveScoring(tournament: Tournament, phase: string | null) {
  if (
    tournament.format === "group_ko" &&
    phase === "ko" &&
    tournament.ko_points_per_set != null
  ) {
    return {
      pointsPerSet: tournament.ko_points_per_set,
      setsToWin: tournament.ko_sets_to_win ?? tournament.sets_to_win,
      cap: tournament.ko_cap,
    };
  }
  return {
    pointsPerSet: tournament.points_per_set,
    setsToWin: tournament.sets_to_win,
    cap: tournament.cap,
  };
}
