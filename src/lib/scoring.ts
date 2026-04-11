import type { Player, Match, GameSet, StandingEntry, TeamStandingEntry } from "./types";

/**
 * 5 feste Spielmodi:
 *
 * 11_1: 11 Pkt · 1 Satz            – kein Cap, keine Verlaengerung
 * 11_2: 11 Pkt · 2 Sätze, Cap 20  – Verlaengerung bei 10:10, Deckel 20
 * 15_1: 15 Pkt · 1 Satz            – kein Cap, keine Verlaengerung
 * 15_2: 15 Pkt · 2 Sätze, Cap 25  – Verlaengerung bei 14:14, Deckel 25
 * 21_2: 21 Pkt · 2 Sätze, Cap 30  – Verlaengerung bei 20:20, Deckel 30 (Standard)
 */

export type ScoringModeId = "11_1" | "11_2" | "15_1" | "15_2" | "21_2";

export interface ScoringMode {
  id: ScoringModeId;
  sets_to_win: number;
  points_per_set: number;
  /** null = kein Cap (Single-Set-Modi), number = Cap-Wert */
  cap: number | null;
}

export const SCORING_MODES: ScoringMode[] = [
  { id: "11_1", sets_to_win: 1, points_per_set: 11, cap: null },
  { id: "11_2", sets_to_win: 2, points_per_set: 11, cap: 20 },
  { id: "15_1", sets_to_win: 1, points_per_set: 15, cap: null },
  { id: "15_2", sets_to_win: 2, points_per_set: 15, cap: 25 },
  { id: "21_2", sets_to_win: 2, points_per_set: 21, cap: 30 },
];

/** Gibt den passenden Spielmodus fuer gespeicherte (sets_to_win, points_per_set) zurueck. Fallback: 21_2 */
export function getScoringModeId(setsToWin: number, pointsPerSet: number): ScoringModeId {
  const found = SCORING_MODES.find(
    (m) => m.sets_to_win === setsToWin && m.points_per_set === pointsPerSet
  );
  return found?.id ?? "21_2";
}

/** Gibt den Cap-Wert fuer eine Kombination zurueck (null = kein Cap) */
export function getScoringCap(setsToWin: number, pointsPerSet: number): number | null {
  const found = SCORING_MODES.find(
    (m) => m.sets_to_win === setsToWin && m.points_per_set === pointsPerSet
  );
  return found?.cap ?? null;
}

// ---------------------------------------------------------------------------
// Scoring-Logik
// ---------------------------------------------------------------------------

/** Prueft ob ein Score ein gueltiger Satzgewinn ist */
export function isSetWon(
  winnerScore: number,
  loserScore: number,
  pointsPerSet: number,
  cap: number | null
): boolean {
  if (winnerScore <= loserScore) return false;
  if (winnerScore < pointsPerSet) return false;

  if (cap !== null) {
    // Modi MIT Verlaengerung (11_2, 15_2, 21_2)
    const diff = winnerScore - loserScore;
    if (winnerScore === cap && diff >= 1) return true; // z.B. 30:29, 20:19, 25:24
    return diff >= 2;
  }

  // Modi OHNE Verlaengerung (11_1, 15_1): exakt Zielpunktzahl = Sieg
  return winnerScore >= pointsPerSet;
}

/** Prueft ob ein Satz vollstaendig und gueltig eingetragen ist */
export function isSetComplete(s: GameSet, pointsPerSet: number, cap?: number | null): boolean {
  // Beide muessen eingetragen sein
  if (s.team1_score <= 0 && s.team2_score <= 0) return false;

  // Score-Kombination muss regelkonform sein
  const resolvedCap = cap !== undefined ? cap : null;
  const validation = isScoreValid(s.team1_score, s.team2_score, pointsPerSet, resolvedCap);
  if (!validation.valid) return false;

  // Mindestens ein Team muss gewonnen haben
  return (
    isSetWon(s.team1_score, s.team2_score, pointsPerSet, resolvedCap) ||
    isSetWon(s.team2_score, s.team1_score, pointsPerSet, resolvedCap)
  );
}

/** Prueft ob ein eingegebener Score gueltig ist (zur Validierung) */
export function isScoreValid(
  score1: number,
  score2: number,
  pointsPerSet: number,
  cap: number | null
): { valid: boolean; error?: string } {
  if (score1 < 0 || score2 < 0) {
    return { valid: false, error: "Punkte duerfen nicht negativ sein" };
  }

  const maxAllowed = cap !== null ? cap : pointsPerSet;

  if (score1 > maxAllowed || score2 > maxAllowed) {
    return {
      valid: false,
      error: `Maximale Punktzahl ist ${maxAllowed}`,
    };
  }

  if (cap !== null) {
    // Modi MIT Verlaengerung (11_2, 15_2, 21_2)
    const high = Math.max(score1, score2);
    const low = Math.min(score1, score2);
    const diff = high - low;
    const extStart = pointsPerSet - 1; // 20, 10, 14 je nach Modus

    // Beide unter Zielpunktzahl: noch laufend
    if (high < pointsPerSet) {
      return { valid: true };
    }

    // Normaler Satzgewinn: Gewinner hat genau Zielpunktzahl, Verlierer <= extStart-1
    if (high === pointsPerSet && low <= extStart - 1) {
      return { valid: true };
    }

    // Gleichstand auf oder ueber Zielpunktzahl: kein Unentschieden
    if (high >= pointsPerSet && diff === 0) {
      return { valid: false, error: "Unentschieden nicht moeglich" };
    }

    // Verlaengerung: Beide muessen mindestens extStart (z.B. 20, 10, 14) haben
    if (high > pointsPerSet && low < extStart) {
      return {
        valid: false,
        error: `Bei ${high} muss der Gegner mind. ${high - 2} haben`,
      };
    }

    // Verlaengerung: Differenz muss genau 2 sein (ausser am Cap)
    if (high > pointsPerSet && high < cap && diff !== 2) {
      return {
        valid: false,
        error: "Verlaengerung: genau 2 Punkte Differenz noetig",
      };
    }

    // Am Cap: Verlierer muss cap-2 oder cap-1 sein
    if (high === cap && low < cap - 2) {
      return {
        valid: false,
        error: `Bei ${cap} muss der Gegner ${cap - 2} oder ${cap - 1} haben`,
      };
    }

    // cap:cap geht nicht
    if (score1 === cap && score2 === cap) {
      return { valid: false, error: `${cap}:${cap} ist nicht moeglich` };
    }
  } else {
    // Modi OHNE Verlaengerung (11_1, 15_1): first-to-N
    const high = Math.max(score1, score2);

    // Beide unter Zielpunktzahl: noch laufend
    if (high < pointsPerSet) {
      return { valid: true };
    }

    // Gleichstand auf Zielpunktzahl: unmoeoglich
    if (score1 === pointsPerSet && score2 === pointsPerSet) {
      return { valid: false, error: `${pointsPerSet}:${pointsPerSet} ist nicht moeglich` };
    }

    // Verlierer darf nicht auch Zielpunktzahl haben
    if (high === pointsPerSet) {
      return { valid: true };
    }
  }

  return { valid: true };
}

/**
 * Auto-Vervollstaendigung: Berechnet den Gegner-Score wenn er eindeutig ist.
 *
 * Mit Cap (11_2, 15_2, 21_2):
 *   Eingabe 0..N-2      → Gegner hat mit N gewonnen (nur bei frischer Eingabe)
 *   Eingabe N-1         → Verlaengerung, Gegner = N+1 (z.B. 20→22, 10→12, 14→16)
 *   Eingabe N+1..cap-1  → Verlaengerung, Gegner = Eingabe - 2
 *   Eingabe cap         → Deckel, Gegner = cap - 1
 *
 * Ohne Cap (11_1, 15_1):
 *   Eingabe < N         → Gegner hat mit N gewonnen (nur bei frischer Eingabe)
 *   Eingabe = N         → nicht eindeutig, kein Auto-Fill
 */
export function autoFillOpponentScore(
  enteredScore: number,
  pointsPerSet: number,
  cap: number | null,
  onlyIfFresh: boolean
): number | null {
  if (enteredScore <= 0) return null;

  if (cap !== null) {
    const extStart = pointsPerSet - 1; // z.B. 20, 10, 14

    // Am Cap: Gegner = cap - 1 (immer eindeutig)
    if (enteredScore === cap) return cap - 1;

    // Verlaengerung N+1 bis cap-1: Gegner = Eingabe - 2
    if (enteredScore > pointsPerSet && enteredScore < cap) return enteredScore - 2;

    // Genau extStart eingegeben (z.B. 20 bei 21er, 10 bei 11er): Verlaengerung, Gegner = N+1
    if (enteredScore === extStart) return pointsPerSet + 1;

    // Frische Eingabe 1..N-2: Gegner hat mit N gewonnen
    if (onlyIfFresh && enteredScore >= 1 && enteredScore < extStart) {
      return pointsPerSet;
    }
  } else {
    // Kein Cap: nur bei frischer Eingabe < N
    if (onlyIfFresh && enteredScore >= 1 && enteredScore < pointsPerSet) {
      return pointsPerSet;
    }
  }

  return null;
}

/** Gibt die maximale erlaubte Punktzahl fuer ein Turnier zurueck */
export function getMaxScore(pointsPerSet: number, cap: number | null): number {
  return cap !== null ? cap : pointsPerSet;
}

/** Beschreibt das Zaehsystem als Text */
export function getScoringDescription(setsToWin: number, pointsPerSet: number): string {
  const mode = SCORING_MODES.find(
    (m) => m.sets_to_win === setsToWin && m.points_per_set === pointsPerSet
  );
  if (!mode) return `Erster bis ${pointsPerSet} Punkte`;

  if (mode.cap !== null) {
    return `Rallypoint bis ${pointsPerSet}, Verlaengerung bei ${pointsPerSet - 1}:${pointsPerSet - 1} (max. ${mode.cap})`;
  }
  return `Erster bis ${pointsPerSet} Punkte (1 Satz)`;
}

export function calculateStandings(
  players: Player[],
  matches: Match[],
  sets: Map<number, GameSet[]>
): StandingEntry[] {
  const entries = new Map<number, StandingEntry>();

  for (const p of players) {
    entries.set(p.id, {
      player: p,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      pointsWon: 0,
      pointsLost: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== "completed" || !match.winner_team) continue;

    const matchSets = sets.get(match.id) || [];

    const team1Players = [match.team1_p1, match.team1_p2].filter(
      (id): id is number => id !== null
    );
    const team2Players = [match.team2_p1, match.team2_p2].filter(
      (id): id is number => id !== null
    );

    const winners = match.winner_team === 1 ? team1Players : team2Players;
    const losers = match.winner_team === 1 ? team2Players : team1Players;

    for (const pid of winners) {
      const e = entries.get(pid);
      if (e) e.wins++;
    }
    for (const pid of losers) {
      const e = entries.get(pid);
      if (e) e.losses++;
    }

    let team1SetsWon = 0;
    let team2SetsWon = 0;
    for (const s of matchSets) {
      if (s.team1_score > s.team2_score) team1SetsWon++;
      else if (s.team2_score > s.team1_score) team2SetsWon++;

      for (const pid of team1Players) {
        const e = entries.get(pid);
        if (e) {
          e.pointsWon += s.team1_score;
          e.pointsLost += s.team2_score;
        }
      }
      for (const pid of team2Players) {
        const e = entries.get(pid);
        if (e) {
          e.pointsWon += s.team2_score;
          e.pointsLost += s.team1_score;
        }
      }
    }

    for (const pid of team1Players) {
      const e = entries.get(pid);
      if (e) {
        e.setsWon += team1SetsWon;
        e.setsLost += team2SetsWon;
      }
    }
    for (const pid of team2Players) {
      const e = entries.get(pid);
      if (e) {
        e.setsWon += team2SetsWon;
        e.setsLost += team1SetsWon;
      }
    }
  }

  const result = Array.from(entries.values());
  result.sort((a, b) => {
    // 1. Match win percentage (wins / total matches)
    const matchPctA = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
    const matchPctB = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
    if (matchPctB !== matchPctA) return matchPctB - matchPctA;

    // 2. Set win percentage (setsWon / total sets)
    const setPctA = (a.setsWon + a.setsLost) > 0 ? a.setsWon / (a.setsWon + a.setsLost) : 0;
    const setPctB = (b.setsWon + b.setsLost) > 0 ? b.setsWon / (b.setsWon + b.setsLost) : 0;
    if (setPctB !== setPctA) return setPctB - setPctA;

    // 3. Point win percentage (pointsWon / total points)
    const ptPctA = (a.pointsWon + a.pointsLost) > 0 ? a.pointsWon / (a.pointsWon + a.pointsLost) : 0;
    const ptPctB = (b.pointsWon + b.pointsLost) > 0 ? b.pointsWon / (b.pointsWon + b.pointsLost) : 0;
    return ptPctB - ptPctA;
  });

  return result;
}

function teamKey(p1: number, p2: number): string {
  return `${Math.min(p1, p2)}-${Math.max(p1, p2)}`;
}

export function calculateTeamStandings(
  players: Player[],
  matches: Match[],
  sets: Map<number, GameSet[]>
): TeamStandingEntry[] {
  const entries = new Map<string, TeamStandingEntry>();
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Discover teams from matches
  for (const m of matches) {
    if (m.team1_p2) {
      const key = teamKey(m.team1_p1, m.team1_p2);
      if (!entries.has(key)) {
        entries.set(key, {
          teamKey: key,
          player1: playerMap.get(Math.min(m.team1_p1, m.team1_p2))!,
          player2: playerMap.get(Math.max(m.team1_p1, m.team1_p2))!,
          wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0,
        });
      }
    }
    if (m.team2_p2) {
      const key = teamKey(m.team2_p1, m.team2_p2);
      if (!entries.has(key)) {
        entries.set(key, {
          teamKey: key,
          player1: playerMap.get(Math.min(m.team2_p1, m.team2_p2))!,
          player2: playerMap.get(Math.max(m.team2_p1, m.team2_p2))!,
          wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0,
        });
      }
    }
  }

  for (const m of matches) {
    if (m.status !== "completed" || !m.winner_team) continue;
    const matchSets = sets.get(m.id) || [];

    const t1key = m.team1_p2 ? teamKey(m.team1_p1, m.team1_p2) : null;
    const t2key = m.team2_p2 ? teamKey(m.team2_p1, m.team2_p2) : null;

    const winKey = m.winner_team === 1 ? t1key : t2key;
    const loseKey = m.winner_team === 1 ? t2key : t1key;

    if (winKey) { const e = entries.get(winKey); if (e) e.wins++; }
    if (loseKey) { const e = entries.get(loseKey); if (e) e.losses++; }

    let t1SetsWon = 0, t2SetsWon = 0;
    for (const s of matchSets) {
      if (s.team1_score > s.team2_score) t1SetsWon++;
      else if (s.team2_score > s.team1_score) t2SetsWon++;

      if (t1key) {
        const e = entries.get(t1key);
        if (e) { e.pointsWon += s.team1_score; e.pointsLost += s.team2_score; }
      }
      if (t2key) {
        const e = entries.get(t2key);
        if (e) { e.pointsWon += s.team2_score; e.pointsLost += s.team1_score; }
      }
    }
    if (t1key) { const e = entries.get(t1key); if (e) { e.setsWon += t1SetsWon; e.setsLost += t2SetsWon; } }
    if (t2key) { const e = entries.get(t2key); if (e) { e.setsWon += t2SetsWon; e.setsLost += t1SetsWon; } }
  }

  const result = Array.from(entries.values());
  result.sort((a, b) => {
    // 1. Match win percentage
    const matchPctA = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
    const matchPctB = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
    if (matchPctB !== matchPctA) return matchPctB - matchPctA;

    // 2. Set win percentage
    const setPctA = (a.setsWon + a.setsLost) > 0 ? a.setsWon / (a.setsWon + a.setsLost) : 0;
    const setPctB = (b.setsWon + b.setsLost) > 0 ? b.setsWon / (b.setsWon + b.setsLost) : 0;
    if (setPctB !== setPctA) return setPctB - setPctA;

    // 3. Point win percentage
    const ptPctA = (a.pointsWon + a.pointsLost) > 0 ? a.pointsWon / (a.pointsWon + a.pointsLost) : 0;
    const ptPctB = (b.pointsWon + b.pointsLost) > 0 ? b.pointsWon / (b.pointsWon + b.pointsLost) : 0;
    return ptPctB - ptPctA;
  });

  return result;
}

export function determineMatchWinner(
  matchSets: GameSet[],
  setsToWin: number,
  pointsPerSet: number,
  cap?: number | null
): 1 | 2 | null {
  const resolvedCap = cap !== undefined ? cap : getScoringCap(setsToWin, pointsPerSet);
  let team1Sets = 0;
  let team2Sets = 0;

  for (const s of matchSets) {
    if (!isSetComplete(s, pointsPerSet, resolvedCap)) continue;
    if (s.team1_score > s.team2_score) team1Sets++;
    else if (s.team2_score > s.team1_score) team2Sets++;
  }

  if (team1Sets >= setsToWin) return 1;
  if (team2Sets >= setsToWin) return 2;
  return null;
}
