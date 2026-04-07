import type { Player, Match, StandingEntry, TeamStandingEntry } from "./types";

// Re-export shuffle for use in TournamentView
export function shufflePlayers<T>(arr: T[]): T[] {
  return shuffle(arr);
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  const randomValues = new Uint32Array(arr.length);
  crypto.getRandomValues(randomValues);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Crypto-secure random number in [0, 1) — replacement for Math.random() */
function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / (0xFFFFFFFF + 1);
}

// --- Round Robin (Singles) ---
// Generates all rounds where each player plays against every other player.
export function generateRoundRobinSingles(
  players: Player[]
): { team1_p1: number; team2_p1: number }[][] {
  const ids = players.map((p) => p.id);
  const n = ids.length;
  const list = [...ids];

  // If odd number of players, add a "bye" (-1)
  if (n % 2 !== 0) list.push(-1);

  const totalRounds = list.length - 1;
  const half = list.length / 2;
  const rounds: { team1_p1: number; team2_p1: number }[][] = [];

  for (let r = 0; r < totalRounds; r++) {
    const roundMatches: { team1_p1: number; team2_p1: number }[] = [];
    for (let i = 0; i < half; i++) {
      const p1 = list[i];
      const p2 = list[list.length - 1 - i];
      if (p1 !== -1 && p2 !== -1) {
        roundMatches.push({ team1_p1: p1, team2_p1: p2 });
      }
    }
    rounds.push(roundMatches);
    // Rotate: fix first element, rotate rest
    const last = list.pop()!;
    list.splice(1, 0, last);
  }

  return rounds;
}

// --- Round Robin (Doubles with fixed teams) ---
export function generateRoundRobinDoubles(
  teams: [number, number][]
): { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[][] {
  const n = teams.length;
  const list = [...teams];

  if (n % 2 !== 0) list.push([-1, -1]);

  const totalRounds = list.length - 1;
  const half = list.length / 2;
  const rounds: { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[][] = [];

  for (let r = 0; r < totalRounds; r++) {
    const roundMatches: { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] = [];
    for (let i = 0; i < half; i++) {
      const t1 = list[i];
      const t2 = list[list.length - 1 - i];
      if (t1[0] !== -1 && t2[0] !== -1) {
        roundMatches.push({
          team1_p1: t1[0], team1_p2: t1[1],
          team2_p1: t2[0], team2_p2: t2[1],
        });
      }
    }
    rounds.push(roundMatches);
    const last = list.pop()!;
    list.splice(1, 0, last);
  }

  return rounds;
}

// --- Random Doubles (new partners each round) ---
// Returns matches for ONE round with random partner assignment.
// previousPairings: Set of "id1-id2" strings to avoid repeating partnerships.
// matchCounts: Map of playerId -> number of matches played so far (for fair bye rotation)
// pairingCounts: Map of "id1-id2" -> count of times paired (for weighted pairing avoidance)
export function generateRandomDoublesRound(
  players: Player[],
  previousPairings: Set<string>,
  matchCounts?: Map<number, number>,
  pairingCounts?: Map<string, number>
): { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number; bye?: number }[] {
  const ids = shuffle(players.map((p) => p.id));
  const byePlayers: number[] = [];

  // Doubles needs groups of 4. Remove players until count is divisible by 4.
  // Pick players with the MOST matches to sit out (fair rotation).
  const active = [...ids];
  const byeCount = active.length % 4;
  if (byeCount > 0) {
    if (matchCounts && matchCounts.size > 0) {
      // Sort candidates by match count descending (most matches sit out first)
      const sorted = [...active].sort((a, b) => {
        const ca = matchCounts.get(a) ?? 0;
        const cb = matchCounts.get(b) ?? 0;
        if (cb !== ca) return cb - ca;
        return cryptoRandom() - 0.5;
      });
      for (let i = 0; i < byeCount; i++) {
        const pid = sorted[i];
        byePlayers.push(pid);
        active.splice(active.indexOf(pid), 1);
      }
    } else {
      for (let i = 0; i < byeCount; i++) {
        byePlayers.push(active.pop()!);
      }
    }
  }

  // Need at least 4 for one doubles match
  if (active.length < 4) return [];

  // Try to find pairings that haven't been used before (or least repeated)
  const bestPairing = findBestPairing(active, previousPairings, pairingCounts);

  // Group into matches (pairs of teams) — active.length is divisible by 4
  const matches: { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number; bye?: number }[] = [];
  for (let i = 0; i < bestPairing.length - 1; i += 2) {
    matches.push({
      team1_p1: bestPairing[i][0],
      team1_p2: bestPairing[i][1],
      team2_p1: bestPairing[i + 1][0],
      team2_p2: bestPairing[i + 1][1],
    });
  }

  if (byePlayers.length > 0 && matches.length > 0) {
    matches[0].bye = byePlayers[0]; // Store first bye player for reference
  }

  return matches;
}

function pairingKey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

function findBestPairing(
  players: number[],
  previousPairings: Set<string>,
  pairingCountsInput?: Map<string, number>
): [number, number][] {
  const available = [...players];

  // Use provided counts, or fall back to Set (each entry = 1)
  const pairingCounts = pairingCountsInput ?? new Map<string, number>();
  if (!pairingCountsInput) {
    for (const key of previousPairings) {
      pairingCounts.set(key, 1);
    }
  }

  let bestPairs: [number, number][] = [];
  let bestScore = Infinity; // lower is better

  // More attempts for better results
  const maxAttempts = Math.min(300, Math.max(100, available.length * 20));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffle(available);
    const currentPairs: [number, number][] = [];
    let score = 0;

    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const pair: [number, number] = [shuffled[i], shuffled[i + 1]];
      currentPairs.push(pair);
      const key = pairingKey(pair[0], pair[1]);
      // Each repeat adds to the score - more repeats = worse
      const count = pairingCounts.get(key) ?? 0;
      if (count > 0) {
        score += count * count; // Quadratic penalty: 2x repeat is 4x as bad as 1x
      }
    }

    if (score < bestScore) {
      bestScore = score;
      bestPairs = currentPairs;
      if (score === 0) break; // Perfect: no repeats at all
    }
  }

  return bestPairs;
}

// --- Elimination (KO) ---
// seeds: optional array of player IDs in seed order (best first).
// If empty/undefined, players are shuffled randomly.
export function generateEliminationBracket(
  players: Player[],
  seeds?: number[]
): { team1_p1: number; team2_p1: number }[] {
  const size = nextPowerOf2(players.length);

  // Build ordered list: seeded players first, then rest shuffled
  let ordered: (number | -1)[];
  if (seeds && seeds.length > 0) {
    // Place seeds into bracket positions using standard seeding placement
    ordered = placeSeedsInBracket(seeds, players, size);
  } else {
    const shuffled = shuffle(players).map((p) => p.id);
    ordered = [...shuffled];
    while (ordered.length < size) ordered.push(-1);
  }

  const matches: { team1_p1: number; team2_p1: number }[] = [];
  for (let i = 0; i < size; i += 2) {
    const p1 = ordered[i];
    const p2 = ordered[i + 1];
    if (p1 !== -1 && p2 !== -1) {
      matches.push({ team1_p1: p1, team2_p1: p2 });
    } else if (p1 !== -1) {
      matches.push({ team1_p1: p1, team2_p1: -1 });
    } else if (p2 !== -1) {
      matches.push({ team1_p1: p2, team2_p1: -1 });
    }
  }

  return matches;
}

/**
 * Standard-Seeding: Platziert gesetzte Spieler so im Bracket,
 * dass die besten sich erst im Finale treffen koennen.
 *
 * Seed 1 vs Seed N (letzter), Seed 2 vs Seed N-1, etc.
 * Ungesetzte Spieler fuellen die restlichen Plaetze zufaellig auf.
 */
function placeSeedsInBracket(
  seeds: number[],
  allPlayers: Player[],
  bracketSize: number
): (number | -1)[] {
  // Standard seed positions for power-of-2 bracket
  const positions = getSeedPositions(bracketSize);
  const slots: (number | -1)[] = new Array(bracketSize).fill(-1);

  // Place seeded players at their positions
  for (let i = 0; i < seeds.length && i < positions.length; i++) {
    slots[positions[i]] = seeds[i];
  }

  // Fill remaining slots with unseeded players (shuffled)
  const seededSet = new Set(seeds);
  const unseeded = shuffle(
    allPlayers.filter((p) => !seededSet.has(p.id))
  ).map((p) => p.id);

  let ui = 0;
  for (let i = 0; i < bracketSize; i++) {
    if (slots[i] === -1 && ui < unseeded.length) {
      slots[i] = unseeded[ui++];
    }
  }

  return slots;
}

/**
 * Berechnet die Bracket-Positionen fuer Seeds.
 * Seed 1 -> Position 0, Seed 2 -> letzte Position,
 * dann werden die Haelften rekursiv gefuellt.
 * So treffen Seed 1 und Seed 2 erst im Finale aufeinander.
 */
function getSeedPositions(bracketSize: number): number[] {
  return generateSeedOrder(bracketSize);
}

/**
 * Generates standard tournament seed positions.
 * For 8 players: [0, 7, 3, 4, 1, 6, 2, 5]
 * Seed 1 at pos 0, Seed 2 at pos 7 (opposite end),
 * Seed 3 at pos 3 (bottom of top half), Seed 4 at pos 4 (top of bottom half), etc.
 */
function generateSeedOrder(size: number): number[] {
  let round = [0, 1];

  while (round.length < size) {
    const next: number[] = [];
    const len = round.length * 2;
    for (const pos of round) {
      next.push(pos);
      next.push(len - 1 - pos);
    }
    round = next;
  }

  return round;
}

// --- Elimination (KO) for fixed doubles teams ---
export function generateEliminationBracketDoubles(
  teams: [number, number][]
): { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] {
  const size = nextPowerOf2(teams.length);
  const shuffled = shuffle(teams);
  const ordered: ([number, number] | null)[] = [...shuffled];
  while (ordered.length < size) ordered.push(null);

  const matches: { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] = [];
  for (let i = 0; i < size; i += 2) {
    const t1 = ordered[i];
    const t2 = ordered[i + 1];
    if (t1 && t2) {
      matches.push({ team1_p1: t1[0], team1_p2: t1[1], team2_p1: t2[0], team2_p2: t2[1] });
    }
    // Byes (nur ein Team) werden uebersprungen - Team kommt automatisch weiter
  }
  return matches;
}

// --- Mixed Doubles (random, gender-balanced) ---
export function generateMixedDoublesRound(
  players: Player[],
  previousPairings: Set<string>
): { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] {
  const males = shuffle(players.filter((p) => p.gender === "m"));
  const females = shuffle(players.filter((p) => p.gender === "f"));

  // Need even number of teams (each match = 2 teams), so pairs must be divisible by 2
  const pairCount = Math.min(males.length, females.length);
  const usablePairs = pairCount - (pairCount % 2); // ensure even number of teams
  if (usablePairs < 2) return [];

  // Try to find pairings that minimize repeats
  let bestTeams: [number, number][] = [];
  let bestRepeats = Infinity;

  for (let attempt = 0; attempt < 50; attempt++) {
    const mShuffled = shuffle(males);
    const fShuffled = shuffle(females);
    const teams: [number, number][] = [];
    let repeats = 0;

    for (let i = 0; i < usablePairs; i++) {
      const pair: [number, number] = [mShuffled[i].id, fShuffled[i].id];
      teams.push(pair);
      if (previousPairings.has(pairingKey(pair[0], pair[1]))) {
        repeats++;
      }
    }

    if (repeats < bestRepeats) {
      bestRepeats = repeats;
      bestTeams = teams;
      if (repeats === 0) break;
    }
  }

  const matches: { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] = [];
  for (let i = 0; i < bestTeams.length; i += 2) {
    matches.push({
      team1_p1: bestTeams[i][0],
      team1_p2: bestTeams[i][1],
      team2_p1: bestTeams[i + 1][0],
      team2_p2: bestTeams[i + 1][1],
    });
  }

  return matches;
}

export function getPreviousPairings(matches: Match[]): Set<string> {
  const pairings = new Set<string>();
  for (const m of matches) {
    if (m.team1_p2) pairings.add(pairingKey(m.team1_p1, m.team1_p2));
    if (m.team2_p2) pairings.add(pairingKey(m.team2_p1, m.team2_p2));
  }
  return pairings;
}

/** Returns a Map counting how often each partner pairing has occurred */
export function getPreviousPairingCounts(matches: Match[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.team1_p2) {
      const key = pairingKey(m.team1_p1, m.team1_p2);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (m.team2_p2) {
      const key = pairingKey(m.team2_p1, m.team2_p2);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

// --- Fixed Team Formation ---
// Forms random doubles teams from players
export function formFixedDoubleTeams(
  players: Player[]
): [number, number][] {
  const shuffled = shuffle(players);
  const teams: [number, number][] = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    teams.push([shuffled[i].id, shuffled[i + 1].id]);
  }
  return teams;
}

// Forms mixed doubles teams (1m + 1f each)
export function formFixedMixedTeams(
  players: Player[]
): [number, number][] {
  const males = shuffle(players.filter((p) => p.gender === "m"));
  const females = shuffle(players.filter((p) => p.gender === "f"));
  const count = Math.min(males.length, females.length);
  const teams: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    teams.push([males[i].id, females[i].id]);
  }
  return teams;
}

// Splits teams into numGroups groups (evenly distributed)
export function splitTeamsIntoGroups(
  teams: [number, number][],
  numGroups: number
): [number, number][][] {
  const groups: [number, number][][] = Array.from({ length: numGroups }, () => []);
  for (let i = 0; i < teams.length; i++) {
    groups[i % numGroups].push(teams[i]);
  }
  return groups;
}

// --- Group Phase ---
// Splits players into numGroups groups (shuffled, evenly distributed)
export function splitIntoGroups(
  players: Player[],
  numGroups: number
): Player[][] {
  const shuffled = shuffle(players);
  const groups: Player[][] = Array.from({ length: numGroups }, () => []);
  for (let i = 0; i < shuffled.length; i++) {
    groups[i % numGroups].push(shuffled[i]);
  }
  return groups;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// --- Swiss System ---

/** Returns the recommended number of rounds for a Swiss tournament. */
export function recommendedSwissRounds(playerCount: number): number {
  return Math.max(3, Math.ceil(Math.log2(playerCount)));
}

/** Generates the first round of a Swiss singles tournament (random pairing). */
export function generateSwissFirstRound(
  players: Player[]
): { team1_p1: number; team2_p1: number }[] {
  const shuffled = shuffle(players);
  const ids = shuffled.map((p) => p.id);

  // If odd count, last player gets a bye (excluded from matches)
  if (ids.length % 2 !== 0) ids.pop();

  const matches: { team1_p1: number; team2_p1: number }[] = [];
  for (let i = 0; i < ids.length - 1; i += 2) {
    matches.push({ team1_p1: ids[i], team2_p1: ids[i + 1] });
  }
  return matches;
}

/**
 * Generates a Swiss round based on current standings and previous matchups.
 * Pairs by ranking (#1 vs #2, #3 vs #4, etc.) with conflict resolution.
 */
export function generateSwissRound(
  standings: StandingEntry[],
  previousMatchups: Set<string>
): { team1_p1: number; team2_p1: number }[] {
  const ids = standings.map((s) => s.player.id);

  // If odd count, lowest-ranked player not yet having a bye should get the bye.
  // For simplicity, remove the last player (lowest ranked).
  if (ids.length % 2 !== 0) ids.pop();

  const matches: { team1_p1: number; team2_p1: number }[] = [];

  const used = new Set<number>();

  for (let i = 0; i < ids.length; i++) {
    if (used.has(ids[i])) continue;

    // Find the best opponent: next unused player, preferring one not yet matched
    let bestJ = -1;
    for (let j = i + 1; j < ids.length; j++) {
      if (used.has(ids[j])) continue;
      if (bestJ === -1) bestJ = j; // fallback: first available

      const key = pairingKey(ids[i], ids[j]);
      if (!previousMatchups.has(key)) {
        bestJ = j;
        break; // ideal: no previous matchup
      }
    }

    if (bestJ === -1) continue;

    used.add(ids[i]);
    used.add(ids[bestJ]);
    matches.push({ team1_p1: ids[i], team2_p1: ids[bestJ] });
  }

  return matches;
}

/** Generates the first round of a Swiss doubles tournament (random pairing). */
export function generateSwissFirstRoundDoubles(
  teams: [number, number][]
): { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] {
  const shuffled = shuffle(teams);

  // If odd count, last team gets a bye
  const active = shuffled.length % 2 !== 0 ? shuffled.slice(0, -1) : shuffled;

  const matches: { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] = [];
  for (let i = 0; i < active.length - 1; i += 2) {
    matches.push({
      team1_p1: active[i][0], team1_p2: active[i][1],
      team2_p1: active[i + 1][0], team2_p2: active[i + 1][1],
    });
  }
  return matches;
}

/**
 * Generates a Swiss doubles round based on current team standings and previous matchups.
 * Matchup key: sorted team keys joined by "-".
 */
export function generateSwissRoundDoubles(
  standings: TeamStandingEntry[],
  previousMatchups: Set<string>
): { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] {
  const teamKeys = standings.map((s) => s.teamKey);

  // If odd count, remove last (lowest-ranked) team for bye
  if (teamKeys.length % 2 !== 0) teamKeys.pop();

  // Build a lookup from teamKey -> standing entry
  const lookup = new Map<string, TeamStandingEntry>();
  for (const s of standings) lookup.set(s.teamKey, s);

  const matches: { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] = [];
  const used = new Set<string>();

  for (let i = 0; i < teamKeys.length; i++) {
    if (used.has(teamKeys[i])) continue;

    let bestJ = -1;
    for (let j = i + 1; j < teamKeys.length; j++) {
      if (used.has(teamKeys[j])) continue;
      if (bestJ === -1) bestJ = j;

      const parts = [teamKeys[i], teamKeys[j]].sort();
      const key = `${parts[0]}-${parts[1]}`;
      if (!previousMatchups.has(key)) {
        bestJ = j;
        break;
      }
    }

    if (bestJ === -1) continue;

    const t1 = lookup.get(teamKeys[i])!;
    const t2 = lookup.get(teamKeys[bestJ])!;
    used.add(teamKeys[i]);
    used.add(teamKeys[bestJ]);

    matches.push({
      team1_p1: t1.player1.id, team1_p2: t1.player2.id,
      team2_p1: t2.player1.id, team2_p2: t2.player2.id,
    });
  }

  return matches;
}

// --- Monrad System ---
// Like Swiss but strictly pairs by ranking (#1 vs #2, #3 vs #4) without rematch avoidance.

/** Generates a Monrad round based on current standings (strict ranking pairing). */
export function generateMonradRound(
  standings: StandingEntry[],
): { team1_p1: number; team2_p1: number }[] {
  const ids = standings.map((s) => s.player.id);

  // If odd count, lowest-ranked player gets a bye
  if (ids.length % 2 !== 0) ids.pop();

  const matches: { team1_p1: number; team2_p1: number }[] = [];
  for (let i = 0; i < ids.length - 1; i += 2) {
    matches.push({ team1_p1: ids[i], team2_p1: ids[i + 1] });
  }
  return matches;
}

/** Generates a Monrad doubles round based on current team standings (strict ranking pairing). */
export function generateMonradRoundDoubles(
  standings: TeamStandingEntry[],
): { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] {
  const entries = [...standings];

  // If odd count, lowest-ranked team gets a bye
  if (entries.length % 2 !== 0) entries.pop();

  const matches: { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number }[] = [];
  for (let i = 0; i < entries.length - 1; i += 2) {
    const t1 = entries[i];
    const t2 = entries[i + 1];
    matches.push({
      team1_p1: t1.player1.id, team1_p2: t1.player2.id,
      team2_p1: t2.player1.id, team2_p2: t2.player2.id,
    });
  }
  return matches;
}

// --- King of the Court ---
// Winner stays on court, loser goes to back of queue. One match at a time.

/** Generates ONE King of the Court match from the queue. */
export function generateKingOfCourtMatch(
  queue: number[],
): { team1_p1: number; team2_p1: number; remainingQueue: number[] } {
  if (queue.length < 2) throw new Error("Need at least 2 players in queue");
  const [king, challenger, ...rest] = queue;
  return {
    team1_p1: king,
    team2_p1: challenger,
    remainingQueue: rest,
  };
}

// --- Waterfall ---
// Multiple courts, numbered 1 to N. Each round all courts play simultaneously.
// Winners move up one court, losers move down one court. Court 1 is the "King" court.

/** Generates matches for all courts simultaneously from court assignments. */
export function generateWaterfallRound(
  courtAssignments: number[],
): { court: number; team1_p1: number; team2_p1: number }[] {
  const matches: { court: number; team1_p1: number; team2_p1: number }[] = [];
  for (let i = 0; i < courtAssignments.length - 1; i += 2) {
    const courtNum = Math.floor(i / 2) + 1;
    matches.push({
      court: courtNum,
      team1_p1: courtAssignments[i],
      team2_p1: courtAssignments[i + 1],
    });
  }
  return matches;
}

/** Advances waterfall court assignments based on results.
 * Winners move up (lower index), losers move down (higher index).
 * Court 1 winner stays, Court 1 loser goes to court 2.
 * Returns new court assignments array.
 */
export function advanceWaterfall(
  courtAssignments: number[],
  results: { court: number; winner: number; loser: number }[],
): number[] {
  const sorted = [...results].sort((a, b) => a.court - b.court);
  const numCourts = sorted.length;

  if (numCourts === 0) return courtAssignments;

  const winners: number[] = sorted.map((r) => r.winner);
  const losers: number[] = sorted.map((r) => r.loser);

  const newAssignments: number[] = [];

  for (let c = 0; c < numCourts; c++) {
    if (c === 0) {
      // Court 1: court 1 winner stays, court 2 winner moves up
      newAssignments.push(winners[0]);
      if (numCourts > 1) {
        newAssignments.push(winners[1]);
      }
    } else if (c === numCourts - 1) {
      // Last court: previous court's loser moves down, this court's loser stays
      newAssignments.push(losers[c - 1]);
      newAssignments.push(losers[c]);
    } else {
      // Middle court: previous court's loser moves down, next court's winner moves up
      newAssignments.push(losers[c - 1]);
      newAssignments.push(winners[c + 1]);
    }
  }

  // Add any players not in matches (odd player sitting out)
  const inResults = new Set<number>();
  for (const r of results) {
    inResults.add(r.winner);
    inResults.add(r.loser);
  }
  for (const pid of courtAssignments) {
    if (!inResults.has(pid)) {
      newAssignments.push(pid);
    }
  }

  return newAssignments;
}
