import type { Player, Match, GameSet } from "./types";
import { isSetComplete } from "./scoring";

export interface TournamentHighlights {
  closestMatch: {
    match: Match;
    totalDiff: number;
    description: string;
  } | null;
  biggestWin: {
    match: Match;
    totalDiff: number;
    description: string;
  } | null;
  highestScoringMatch: {
    match: Match;
    totalPoints: number;
    description: string;
  } | null;
  mostSetsMatch: {
    match: Match;
    setsPlayed: number;
    description: string;
  } | null;
  topScorer: {
    player: Player;
    totalPoints: number;
  } | null;
  mostWins: {
    player: Player;
    wins: number;
  } | null;
  totalMatches: number;
  completedMatches: number;
  totalSets: number;
  totalPoints: number;
}

export function calculateHighlights(
  players: Player[],
  matches: Match[],
  setsByMatch: Map<number, GameSet[]>,
  pointsPerSet: number,
  _playerName: (id: number | null) => string,
  teamLabel: (m: Match) => [string, string]
): TournamentHighlights {
  const completedMatches = matches.filter(
    (m) => m.status === "completed" && m.winner_team
  );

  let closestMatch: TournamentHighlights["closestMatch"] = null;
  let biggestWin: TournamentHighlights["biggestWin"] = null;
  let highestScoringMatch: TournamentHighlights["highestScoringMatch"] = null;
  let mostSetsMatch: TournamentHighlights["mostSetsMatch"] = null;

  let totalSets = 0;
  let totalPoints = 0;

  // Per-player stats
  const playerPoints = new Map<number, number>();
  const playerWins = new Map<number, number>();

  for (const m of completedMatches) {
    const sets = setsByMatch.get(m.id) || [];
    const completeSets = sets.filter((s) => isSetComplete(s, pointsPerSet));
    const [label1, label2] = teamLabel(m);

    let matchT1Points = 0;
    let matchT2Points = 0;
    let setsPlayed = 0;

    for (const s of completeSets) {
      matchT1Points += s.team1_score;
      matchT2Points += s.team2_score;
      setsPlayed++;
      totalSets++;
      totalPoints += s.team1_score + s.team2_score;
    }

    // Track per-player points
    const t1Players = [m.team1_p1, m.team1_p2].filter((id): id is number => id !== null);
    const t2Players = [m.team2_p1, m.team2_p2].filter((id): id is number => id !== null);
    for (const pid of t1Players) {
      playerPoints.set(pid, (playerPoints.get(pid) || 0) + matchT1Points);
    }
    for (const pid of t2Players) {
      playerPoints.set(pid, (playerPoints.get(pid) || 0) + matchT2Points);
    }

    // Track wins
    const winners = m.winner_team === 1 ? t1Players : t2Players;
    for (const pid of winners) {
      playerWins.set(pid, (playerWins.get(pid) || 0) + 1);
    }

    const totalDiff = Math.abs(matchT1Points - matchT2Points);
    const totalMatchPoints = matchT1Points + matchT2Points;

    const winnerLabel = m.winner_team === 1 ? label1 : label2;
    const loserLabel = m.winner_team === 1 ? label2 : label1;

    // Closest match (smallest point difference)
    if (totalDiff > 0 && (!closestMatch || totalDiff < closestMatch.totalDiff)) {
      closestMatch = {
        match: m,
        totalDiff,
        description: `${winnerLabel} vs ${loserLabel} (${matchT1Points}:${matchT2Points} Punkte gesamt)`,
      };
    }

    // Biggest win (largest point difference)
    if (!biggestWin || totalDiff > biggestWin.totalDiff) {
      biggestWin = {
        match: m,
        totalDiff,
        description: `${winnerLabel} vs ${loserLabel} (${totalDiff} Punkte Differenz)`,
      };
    }

    // Highest scoring match
    if (
      !highestScoringMatch ||
      totalMatchPoints > highestScoringMatch.totalPoints
    ) {
      highestScoringMatch = {
        match: m,
        totalPoints: totalMatchPoints,
        description: `${label1} vs ${label2} (${totalMatchPoints} Punkte)`,
      };
    }

    // Most sets played
    if (!mostSetsMatch || setsPlayed > mostSetsMatch.setsPlayed) {
      mostSetsMatch = {
        match: m,
        setsPlayed,
        description: `${label1} vs ${label2} (${setsPlayed} Saetze)`,
      };
    }
  }

  // Top scorer
  let topScorer: TournamentHighlights["topScorer"] = null;
  for (const [pid, pts] of playerPoints) {
    if (!topScorer || pts > topScorer.totalPoints) {
      const player = players.find((p) => p.id === pid);
      if (player) topScorer = { player, totalPoints: pts };
    }
  }

  // Most wins
  let mostWins: TournamentHighlights["mostWins"] = null;
  for (const [pid, wins] of playerWins) {
    if (!mostWins || wins > mostWins.wins) {
      const player = players.find((p) => p.id === pid);
      if (player) mostWins = { player, wins };
    }
  }

  return {
    closestMatch,
    biggestWin,
    highestScoringMatch,
    mostSetsMatch,
    topScorer,
    mostWins,
    totalMatches: matches.length,
    completedMatches: completedMatches.length,
    totalSets,
    totalPoints,
  };
}
