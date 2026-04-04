import type { Player, Match, GameSet, StandingEntry, TeamStandingEntry } from "./types";

/**
 * Badminton Rallypoint-System:
 * Standard (pointsPerSet = 21):
 *   - Satz gewonnen bei 21 Punkten mit mind. 2 Vorsprung
 *   - Bei 20:20 → Verlaengerung bis 2 Punkte Vorsprung
 *   - Deckelung bei 30: Bei 29:29 entscheidet der naechste Punkt (30:29)
 *
 * Benutzerdefiniert (pointsPerSet != 21):
 *   - Die gesetzte Punktzahl ist das harte Maximum
 *   - Wer zuerst diese Punktzahl erreicht, gewinnt den Satz
 */

const STANDARD_POINTS = 21;
const STANDARD_CAP = 30;

/** Prueft ob ein Score ein gueltiger Satzgewinn ist */
export function isSetWon(
  winnerScore: number,
  loserScore: number,
  pointsPerSet: number
): boolean {
  if (winnerScore <= loserScore) return false;
  if (winnerScore < pointsPerSet) return false;

  if (pointsPerSet === STANDARD_POINTS) {
    // Standard Rallypoint: mind. 2 Vorsprung, Deckel bei 30
    const diff = winnerScore - loserScore;
    if (winnerScore === STANDARD_CAP && diff >= 1) return true; // 30:29
    return diff >= 2;
  }

  // Benutzerdefiniert: exakt die Zielpunktzahl = Sieg
  return winnerScore >= pointsPerSet;
}

/** Prueft ob ein Satz vollstaendig und gueltig eingetragen ist */
export function isSetComplete(s: GameSet, pointsPerSet: number): boolean {
  // Beide muessen eingetragen sein
  if (s.team1_score <= 0 && s.team2_score <= 0) return false;

  // Score-Kombination muss regelkonform sein
  const validation = isScoreValid(s.team1_score, s.team2_score, pointsPerSet);
  if (!validation.valid) return false;

  // Mindestens ein Team muss gewonnen haben
  return (
    isSetWon(s.team1_score, s.team2_score, pointsPerSet) ||
    isSetWon(s.team2_score, s.team1_score, pointsPerSet)
  );
}

/** Prueft ob ein eingegebener Score gueltig ist (zur Validierung) */
export function isScoreValid(
  score1: number,
  score2: number,
  pointsPerSet: number
): { valid: boolean; error?: string } {
  if (score1 < 0 || score2 < 0) {
    return { valid: false, error: "Punkte duerfen nicht negativ sein" };
  }

  const maxAllowed =
    pointsPerSet === STANDARD_POINTS ? STANDARD_CAP : pointsPerSet;

  if (score1 > maxAllowed || score2 > maxAllowed) {
    return {
      valid: false,
      error: `Maximale Punktzahl ist ${maxAllowed}`,
    };
  }

  if (pointsPerSet === STANDARD_POINTS) {
    const high = Math.max(score1, score2);
    const low = Math.min(score1, score2);
    const diff = high - low;

    // Beide unter 21: noch laufend, ok
    if (high < STANDARD_POINTS) {
      return { valid: true };
    }

    // Normaler Satzgewinn: Gewinner hat genau 21, Verlierer 0-19
    if (high === STANDARD_POINTS && low <= 19) {
      return { valid: true };
    }

    // 21:21 oder hoeher gleich: Unentschieden gibt es nicht
    if (high >= STANDARD_POINTS && diff === 0) {
      return {
        valid: false,
        error: "Unentschieden nicht moeglich",
      };
    }

    // Verlaengerung: Beide muessen mindestens 20 haben
    if (high > STANDARD_POINTS && low < STANDARD_POINTS - 1) {
      return {
        valid: false,
        error: `Bei ${high} muss der Gegner mind. ${high - 2} haben`,
      };
    }

    // Verlaengerung: Differenz muss genau 2 sein (ausser Deckel 30:29)
    if (high > STANDARD_POINTS && high < STANDARD_CAP && diff !== 2) {
      return {
        valid: false,
        error: "Verlaengerung: genau 2 Punkte Differenz noetig",
      };
    }

    // Deckel 30: Gegner muss 28 oder 29 sein
    if (high === STANDARD_CAP && low < STANDARD_CAP - 2) {
      return {
        valid: false,
        error: "Bei 30 muss der Gegner 28 oder 29 haben",
      };
    }

    // Beide 30 geht nicht
    if (score1 === STANDARD_CAP && score2 === STANDARD_CAP) {
      return { valid: false, error: "30:30 ist nicht moeglich" };
    }
  } else {
    // Benutzerdefiniert: Gewinner darf nicht ueber Ziel, Verlierer nicht auf Ziel
    if (score1 === pointsPerSet && score2 === pointsPerSet) {
      return { valid: false, error: `${pointsPerSet}:${pointsPerSet} ist nicht moeglich` };
    }
  }

  return { valid: true };
}

/**
 * Auto-Vervollstaendigung: Berechnet den Gegner-Score wenn er eindeutig ist.
 *
 * Standard (21):
 *   Eingabe 0-19  → Gegner hat mit 21 gewonnen
 *   Eingabe 20    → nicht eindeutig (21:20 oder 22:20), kein Auto-Fill
 *   Eingabe 21    → nicht eindeutig (Gegner 0-19 moeglich), kein Auto-Fill
 *   Eingabe 22-29 → Verlaengerung, Gegner = Eingabe - 2
 *   Eingabe 30    → Deckel, Gegner = 29
 *
 * Benutzerdefiniert (z.B. 15):
 *   Eingabe < Ziel → Gegner hat mit Zielpunktzahl gewonnen
 *   Eingabe = Ziel → nicht eindeutig, kein Auto-Fill
 */
/**
 * Auto-Vervollstaendigung: Berechnet den Gegner-Score wenn er eindeutig ist.
 *
 * onlyIfFresh = true: Nur bei Neu-Eingabe (Gegner ist 0)
 *   → Scores 1-19 setzen Gegner auf 21 (Verlierer-Score)
 *   → Custom: Scores < Ziel setzen Gegner auf Zielpunktzahl
 *
 * onlyIfFresh = false: Immer (auch beim Bearbeiten)
 *   → Scores 22-29: Verlaengerung, Gegner = Eingabe - 2
 *   → Score 30: Deckel, Gegner = 29
 */
export function autoFillOpponentScore(
  enteredScore: number,
  pointsPerSet: number,
  onlyIfFresh: boolean
): number | null {
  if (enteredScore <= 0) return null;

  if (pointsPerSet === STANDARD_POINTS) {
    // Immer eindeutig (Verlaengerung/Deckel):
    if (enteredScore === 20) return 22; // 20:22 Verlaengerung verloren
    if (enteredScore >= 22 && enteredScore <= 29) return enteredScore - 2;
    if (enteredScore === STANDARD_CAP) return 29;

    // Nur bei frischer Eingabe (Gegner war 0):
    if (onlyIfFresh) {
      if (enteredScore >= 1 && enteredScore <= 19) return STANDARD_POINTS;
    }
  } else {
    // Benutzerdefiniert: nur bei frischer Eingabe
    if (onlyIfFresh) {
      if (enteredScore >= 1 && enteredScore < pointsPerSet) return pointsPerSet;
    }
  }

  return null;
}

/** Gibt die maximale erlaubte Punktzahl fuer ein Turnier zurueck */
export function getMaxScore(pointsPerSet: number): number {
  return pointsPerSet === STANDARD_POINTS ? STANDARD_CAP : pointsPerSet;
}

/** Beschreibt das Zaehsystem als Text */
export function getScoringDescription(pointsPerSet: number): string {
  if (pointsPerSet === STANDARD_POINTS) {
    return "Rallypoint bis 21, Verlaengerung bei 20:20 (max. 30)";
  }
  return `Erster bis ${pointsPerSet} Punkte`;
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
  pointsPerSet: number
): 1 | 2 | null {
  let team1Sets = 0;
  let team2Sets = 0;

  for (const s of matchSets) {
    if (!isSetComplete(s, pointsPerSet)) continue;
    if (s.team1_score > s.team2_score) team1Sets++;
    else if (s.team2_score > s.team1_score) team2Sets++;
  }

  if (team1Sets >= setsToWin) return 1;
  if (team2Sets >= setsToWin) return 2;
  return null;
}
