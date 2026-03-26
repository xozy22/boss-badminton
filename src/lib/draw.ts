import type { Player, Match } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
export function generateRandomDoublesRound(
  players: Player[],
  previousPairings: Set<string>
): { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number; bye?: number }[] {
  const ids = shuffle(players.map((p) => p.id));
  let byePlayer: number | undefined;

  // If odd number, one sits out
  const active = [...ids];
  if (active.length % 2 !== 0) {
    byePlayer = active.pop();
  }

  // Need groups of 4 for doubles matches
  // If active count not divisible by 4, we need to handle it
  // Strategy: pair up into teams of 2, then match teams against each other
  if (active.length < 4) return [];

  // Try to find pairings that haven't been used before
  const bestPairing = findBestPairing(active, previousPairings);

  // Group into matches (pairs of teams)
  const matches: { team1_p1: number; team1_p2: number; team2_p1: number; team2_p2: number; bye?: number }[] = [];
  for (let i = 0; i < bestPairing.length - 1; i += 2) {
    matches.push({
      team1_p1: bestPairing[i][0],
      team1_p2: bestPairing[i][1],
      team2_p1: bestPairing[i + 1][0],
      team2_p2: bestPairing[i + 1][1],
    });
  }

  // If odd number of teams, remaining team gets bye
  if (bestPairing.length % 2 !== 0) {
    // Extra pair that couldn't be matched - put them back as bye
  }

  if (byePlayer !== undefined && matches.length > 0) {
    matches[0].bye = byePlayer;
  }

  return matches;
}

function pairingKey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

function findBestPairing(
  players: number[],
  previousPairings: Set<string>
): [number, number][] {
  // Greedy approach: try to avoid previous pairings
  const available = [...players];
  const pairs: [number, number][] = [];

  // Try multiple random shuffles and pick the one with fewest repeats
  let bestPairs: [number, number][] = [];
  let bestRepeats = Infinity;

  for (let attempt = 0; attempt < 50; attempt++) {
    const shuffled = shuffle(available);
    const currentPairs: [number, number][] = [];
    let repeats = 0;

    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const pair: [number, number] = [shuffled[i], shuffled[i + 1]];
      currentPairs.push(pair);
      if (previousPairings.has(pairingKey(pair[0], pair[1]))) {
        repeats++;
      }
    }

    if (repeats < bestRepeats) {
      bestRepeats = repeats;
      bestPairs = currentPairs;
      if (repeats === 0) break;
    }
  }

  return bestPairs.length > 0 ? bestPairs : pairs;
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

  const pairCount = Math.min(males.length, females.length);
  if (pairCount < 2) return [];

  // Try to find pairings that minimize repeats
  let bestTeams: [number, number][] = [];
  let bestRepeats = Infinity;

  for (let attempt = 0; attempt < 50; attempt++) {
    const mShuffled = shuffle(males);
    const fShuffled = shuffle(females);
    const teams: [number, number][] = [];
    let repeats = 0;

    for (let i = 0; i < pairCount; i++) {
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
  for (let i = 0; i < bestTeams.length - 1; i += 2) {
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

// Generates round-robin matches for a single group (singles)
export function generateGroupRoundRobinSingles(
  groupPlayers: Player[]
): { team1_p1: number; team2_p1: number }[][] {
  return generateRoundRobinSingles(groupPlayers);
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
