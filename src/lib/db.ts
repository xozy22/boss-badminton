import type {
  Player,
  Gender,
  Sportstaette,
  Tournament,
  TournamentMode,
  TournamentFormat,
  TournamentPlayerInfo,
  PaymentStatus,
  PaymentMethod,
  Round,
  Match,
  GameSet,
} from "./types";

// ---- Detect if running inside Tauri ----
function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

// =============================================
// Tauri SQLite Backend
// =============================================
let tauriDb: any = null;

async function getTauriDb() {
  if (!tauriDb) {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    const { invoke } = await import("@tauri-apps/api/core");
    // DB-Pfad vom Rust-Backend holen (beruecksichtigt custom Speicherort)
    const dbPath = await invoke<string>("get_db_path");
    tauriDb = await Database.load(`sqlite:${dbPath}`);
  }
  return tauriDb;
}

// =============================================
// LocalStorage Fallback Backend (for browser debugging)
// =============================================
interface LocalStore {
  players: Player[];
  sportstaetten: Sportstaette[];
  tournaments: Tournament[];
  tournamentPlayers: { tournament_id: number; player_id: number }[];
  rounds: Round[];
  matches: Match[];
  sets: GameSet[];
  nextId: { [table: string]: number };
}

function loadStore(): LocalStore {
  const defaults: LocalStore = {
    players: [],
    sportstaetten: [],
    tournaments: [],
    tournamentPlayers: [],
    rounds: [],
    matches: [],
    sets: [],
    nextId: { players: 1, sportstaetten: 1, tournaments: 1, rounds: 1, matches: 1, sets: 1 },
  };
  const raw = localStorage.getItem("turnierplaner");
  if (raw) {
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed, nextId: { ...defaults.nextId, ...parsed.nextId } };
  }
  return defaults;
}

function saveStore(store: LocalStore) {
  localStorage.setItem("turnierplaner", JSON.stringify(store));
}

function nextId(store: LocalStore, table: string): number {
  const id = store.nextId[table] || 1;
  store.nextId[table] = id + 1;
  return id;
}

// =============================================
// Unified API
// =============================================

// --- Players ---

export async function getPlayers(): Promise<Player[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    return d.select("SELECT * FROM players ORDER BY name");
  }
  const store = loadStore();
  return [...store.players].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createPlayer(name: string, gender: Gender, birthYear?: number | null, club?: string | null): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("INSERT INTO players (name, gender, birth_year, club) VALUES ($1, $2, $3, $4)", [name, gender, birthYear ?? null, club ?? null]);
    return;
  }
  const store = loadStore();
  store.players.push({
    id: nextId(store, "players"),
    name,
    gender,
    birth_year: birthYear ?? null,
    club: club ?? null,
    created_at: new Date().toISOString(),
  });
  saveStore(store);
}

export async function updatePlayer(id: number, name: string, gender: Gender, birthYear?: number | null, club?: string | null): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("UPDATE players SET name = $1, gender = $2, birth_year = $3, club = $4 WHERE id = $5", [name, gender, birthYear ?? null, club ?? null, id]);
    return;
  }
  const store = loadStore();
  const p = store.players.find((p) => p.id === id);
  if (p) {
    p.name = name;
    p.gender = gender;
    p.birth_year = birthYear ?? null;
    p.club = club ?? null;
  }
  saveStore(store);
}

export async function deletePlayer(id: number): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    // Remove player references from matches (set to NULL) to avoid FK issues
    await d.execute("UPDATE matches SET team1_p1 = NULL WHERE team1_p1 = $1", [id]);
    await d.execute("UPDATE matches SET team1_p2 = NULL WHERE team1_p2 = $1", [id]);
    await d.execute("UPDATE matches SET team2_p1 = NULL WHERE team2_p1 = $1", [id]);
    await d.execute("UPDATE matches SET team2_p2 = NULL WHERE team2_p2 = $1", [id]);
    await d.execute("DELETE FROM tournament_players WHERE player_id = $1", [id]);
    await d.execute("DELETE FROM players WHERE id = $1", [id]);
    return;
  }
  const store = loadStore();
  store.players = store.players.filter((p) => p.id !== id);
  saveStore(store);
}

// --- Sportstaetten ---

export async function getSportstaetten(): Promise<Sportstaette[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    return d.select("SELECT * FROM sportstaetten ORDER BY name");
  }
  const store = loadStore();
  return [...store.sportstaetten].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSportstaette(name: string, address: string | null, zip: string | null, city: string | null, courts: number, halls: string | null = null): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("INSERT INTO sportstaetten (name, address, zip, city, courts, halls) VALUES ($1, $2, $3, $4, $5, $6)", [name, address, zip, city, courts, halls]);
    return;
  }
  const store = loadStore();
  store.sportstaetten.push({
    id: nextId(store, "sportstaetten"),
    name,
    address,
    zip,
    city,
    courts,
    halls,
    created_at: new Date().toISOString(),
  });
  saveStore(store);
}

export async function updateSportstaette(id: number, name: string, address: string | null, zip: string | null, city: string | null, courts: number, halls: string | null = null): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("UPDATE sportstaetten SET name = $1, address = $2, zip = $3, city = $4, courts = $5, halls = $6 WHERE id = $7", [name, address, zip, city, courts, halls, id]);
    return;
  }
  const store = loadStore();
  const s = store.sportstaetten.find((s) => s.id === id);
  if (s) {
    s.name = name;
    s.address = address;
    s.zip = zip;
    s.city = city;
    s.courts = courts;
    s.halls = halls;
  }
  saveStore(store);
}

export async function deleteSportstaette(id: number): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("DELETE FROM sportstaetten WHERE id = $1", [id]);
    return;
  }
  const store = loadStore();
  store.sportstaetten = store.sportstaetten.filter((s) => s.id !== id);
  saveStore(store);
}

// --- Tournaments ---

export async function getTournaments(): Promise<Tournament[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    return d.select("SELECT * FROM tournaments ORDER BY created_at DESC");
  }
  const store = loadStore();
  return [...store.tournaments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getTournament(id: number): Promise<Tournament> {
  if (isTauri()) {
    const d = await getTauriDb();
    const rows: Tournament[] = await d.select("SELECT * FROM tournaments WHERE id = $1", [id]);
    if (!rows[0]) throw new Error(`Tournament ${id} not found`);
    return rows[0];
  }
  const store = loadStore();
  const t = store.tournaments.find((t) => t.id === id);
  if (!t) throw new Error(`Tournament ${id} not found`);
  return t;
}

export async function createTournament(
  name: string,
  mode: TournamentMode,
  format: TournamentFormat,
  setsToWin: number,
  pointsPerSet: number,
  courts: number = 1,
  numGroups: number = 0,
  qualifyPerGroup: number = 0,
  entryFeeSingle: number = 0,
  entryFeeDouble: number = 0
): Promise<number> {
  if (isTauri()) {
    const d = await getTauriDb();
    const result = await d.execute(
      "INSERT INTO tournaments (name, mode, format, sets_to_win, points_per_set, courts, num_groups, qualify_per_group, entry_fee_single, entry_fee_double) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
      [name, mode, format, setsToWin, pointsPerSet, courts, numGroups, qualifyPerGroup, entryFeeSingle, entryFeeDouble]
    );
    return result.lastInsertId!;
  }
  const store = loadStore();
  const id = nextId(store, "tournaments");
  store.tournaments.push({
    id,
    name,
    mode,
    format,
    sets_to_win: setsToWin,
    points_per_set: pointsPerSet,
    courts,
    num_groups: numGroups,
    qualify_per_group: qualifyPerGroup,
    current_phase: null,
    entry_fee_single: entryFeeSingle,
    entry_fee_double: entryFeeDouble,
    team_config: null,
    hall_config: null,
    created_at: new Date().toISOString(),
    status: "draft",
  });
  saveStore(store);
  return id;
}

export async function updateTournament(
  id: number,
  name: string,
  mode: TournamentMode,
  format: TournamentFormat,
  setsToWin: number,
  pointsPerSet: number,
  courts: number,
  numGroups: number,
  qualifyPerGroup: number,
  entryFeeSingle: number = 0,
  entryFeeDouble: number = 0
): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute(
      "UPDATE tournaments SET name=$1, mode=$2, format=$3, sets_to_win=$4, points_per_set=$5, courts=$6, num_groups=$7, qualify_per_group=$8, entry_fee_single=$9, entry_fee_double=$10 WHERE id=$11",
      [name, mode, format, setsToWin, pointsPerSet, courts, numGroups, qualifyPerGroup, entryFeeSingle, entryFeeDouble, id]
    );
    return;
  }
  const store = loadStore();
  const t = store.tournaments.find((t) => t.id === id);
  if (t) {
    t.name = name;
    t.mode = mode;
    t.format = format;
    t.sets_to_win = setsToWin;
    t.points_per_set = pointsPerSet;
    t.courts = courts;
    t.num_groups = numGroups;
    t.qualify_per_group = qualifyPerGroup;
    t.entry_fee_single = entryFeeSingle;
    t.entry_fee_double = entryFeeDouble;
  }
  saveStore(store);
}

export async function updateTeamConfig(id: number, teamConfig: [number, number][] | null): Promise<void> {
  const json = teamConfig ? JSON.stringify(teamConfig) : null;
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("UPDATE tournaments SET team_config=$1 WHERE id=$2", [json, id]);
    return;
  }
  const store = loadStore();
  const t = store.tournaments.find((t) => t.id === id);
  if (t) (t as any).team_config = json;
  saveStore(store);
}

export async function updateHallConfig(id: number, hallConfig: import("./types").HallConfig[] | null): Promise<void> {
  const json = hallConfig && hallConfig.length > 0 ? JSON.stringify(hallConfig) : null;
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("UPDATE tournaments SET hall_config=$1 WHERE id=$2", [json, id]);
    return;
  }
  const store = loadStore();
  const t = store.tournaments.find((t) => t.id === id);
  if (t) (t as any).hall_config = json;
  saveStore(store);
}

export async function updateTournamentPhase(id: number, phase: string | null): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("UPDATE tournaments SET current_phase = $1 WHERE id = $2", [phase, id]);
    return;
  }
  const store = loadStore();
  const t = store.tournaments.find((t) => t.id === id);
  if (t) t.current_phase = phase as any;
  saveStore(store);
}

export async function updateTournamentStatus(id: number, status: string): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("UPDATE tournaments SET status = $1 WHERE id = $2", [status, id]);
    return;
  }
  const store = loadStore();
  const t = store.tournaments.find((t) => t.id === id);
  if (t) t.status = status as Tournament["status"];
  saveStore(store);
}

export async function deleteTournament(id: number): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    // Get round IDs first, then delete step by step (avoid subquery issues)
    const rounds: { id: number }[] = await d.select(
      "SELECT id FROM rounds WHERE tournament_id = $1", [id]
    );
    const roundIds = rounds.map(r => r.id);
    for (const rid of roundIds) {
      const matches: { id: number }[] = await d.select(
        "SELECT id FROM matches WHERE round_id = $1", [rid]
      );
      for (const m of matches) {
        await d.execute("DELETE FROM sets WHERE match_id = $1", [m.id]);
      }
      await d.execute("DELETE FROM matches WHERE round_id = $1", [rid]);
    }
    await d.execute("DELETE FROM rounds WHERE tournament_id = $1", [id]);
    await d.execute("DELETE FROM tournament_players WHERE tournament_id = $1", [id]);
    await d.execute("DELETE FROM tournaments WHERE id = $1", [id]);
    return;
  }
  const store = loadStore();
  const roundIds = store.rounds.filter((r) => r.tournament_id === id).map((r) => r.id);
  const matchIds = store.matches.filter((m) => roundIds.includes(m.round_id)).map((m) => m.id);
  store.sets = store.sets.filter((s) => !matchIds.includes(s.match_id));
  store.matches = store.matches.filter((m) => !roundIds.includes(m.round_id));
  store.rounds = store.rounds.filter((r) => r.tournament_id !== id);
  store.tournamentPlayers = store.tournamentPlayers.filter((tp) => tp.tournament_id !== id);
  store.tournaments = store.tournaments.filter((t) => t.id !== id);
  saveStore(store);
}

// --- Tournament Players ---

export async function getTournamentPlayers(tournamentId: number): Promise<Player[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    return d.select(
      "SELECT p.* FROM players p JOIN tournament_players tp ON p.id = tp.player_id WHERE tp.tournament_id = $1 ORDER BY p.name",
      [tournamentId]
    );
  }
  const store = loadStore();
  const playerIds = store.tournamentPlayers
    .filter((tp) => tp.tournament_id === tournamentId)
    .map((tp) => tp.player_id);
  return store.players
    .filter((p) => playerIds.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function addPlayerToTournament(tournamentId: number, playerId: number): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute(
      "INSERT OR IGNORE INTO tournament_players (tournament_id, player_id) VALUES ($1, $2)",
      [tournamentId, playerId]
    );
    return;
  }
  const store = loadStore();
  const exists = store.tournamentPlayers.some(
    (tp) => tp.tournament_id === tournamentId && tp.player_id === playerId
  );
  if (!exists) {
    store.tournamentPlayers.push({ tournament_id: tournamentId, player_id: playerId });
  }
  saveStore(store);
}

export async function removePlayerFromTournament(
  tournamentId: number,
  playerId: number
): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute(
      "DELETE FROM tournament_players WHERE tournament_id = $1 AND player_id = $2",
      [tournamentId, playerId]
    );
    return;
  }
  const store = loadStore();
  store.tournamentPlayers = store.tournamentPlayers.filter(
    (tp) => !(tp.tournament_id === tournamentId && tp.player_id === playerId)
  );
  saveStore(store);
}

export async function retirePlayerFromTournament(
  tournamentId: number,
  playerId: number
): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute(
      "UPDATE tournament_players SET retired = 1 WHERE tournament_id = $1 AND player_id = $2",
      [tournamentId, playerId]
    );
    return;
  }
  const store = loadStore();
  const tp = store.tournamentPlayers.find(
    (tp) => tp.tournament_id === tournamentId && tp.player_id === playerId
  );
  if (tp) (tp as any).retired = 1;
  saveStore(store);
}

export async function unretirePlayerFromTournament(
  tournamentId: number,
  playerId: number
): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute(
      "UPDATE tournament_players SET retired = 0 WHERE tournament_id = $1 AND player_id = $2",
      [tournamentId, playerId]
    );
    return;
  }
  const store = loadStore();
  const tp = store.tournamentPlayers.find(
    (tp) => tp.tournament_id === tournamentId && tp.player_id === playerId
  );
  if (tp) (tp as any).retired = 0;
  saveStore(store);
}

export async function getRetiredPlayerIds(tournamentId: number): Promise<number[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    const rows: { player_id: number }[] = await d.select(
      "SELECT player_id FROM tournament_players WHERE tournament_id = $1 AND retired = 1",
      [tournamentId]
    );
    return rows.map((r) => r.player_id);
  }
  const store = loadStore();
  return store.tournamentPlayers
    .filter((tp) => tp.tournament_id === tournamentId && (tp as any).retired === 1)
    .map((tp) => tp.player_id);
}

// --- Payment Tracking ---

export async function getTournamentPlayersDetailed(tournamentId: number): Promise<TournamentPlayerInfo[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    const rows: any[] = await d.select(
      `SELECT p.*, tp.retired, tp.payment_status, tp.payment_method, tp.paid_date
       FROM tournament_players tp
       JOIN players p ON p.id = tp.player_id
       WHERE tp.tournament_id = $1
       ORDER BY p.name`,
      [tournamentId]
    );
    return rows.map((r) => ({
      player: { id: r.id, name: r.name, gender: r.gender, birth_year: r.birth_year, club: r.club, created_at: r.created_at },
      payment_status: r.payment_status ?? "unpaid",
      payment_method: r.payment_method ?? null,
      paid_date: r.paid_date ?? null,
      retired: r.retired === 1,
    }));
  }
  const store = loadStore();
  const tps = store.tournamentPlayers.filter((tp) => tp.tournament_id === tournamentId);
  return tps.map((tp) => {
    const player = store.players.find((p) => p.id === tp.player_id)!;
    return {
      player,
      payment_status: (tp as any).payment_status ?? "unpaid",
      payment_method: (tp as any).payment_method ?? null,
      paid_date: (tp as any).paid_date ?? null,
      retired: (tp as any).retired === 1,
    };
  }).filter((x) => x.player).sort((a, b) => a.player.name.localeCompare(b.player.name));
}

export async function updatePlayerPayment(
  tournamentId: number,
  playerId: number,
  status: PaymentStatus,
  method: PaymentMethod | null,
  date: string | null
): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute(
      "UPDATE tournament_players SET payment_status=$1, payment_method=$2, paid_date=$3 WHERE tournament_id=$4 AND player_id=$5",
      [status, method, date, tournamentId, playerId]
    );
    return;
  }
  const store = loadStore();
  const tp = store.tournamentPlayers.find(
    (tp) => tp.tournament_id === tournamentId && tp.player_id === playerId
  ) as any;
  if (tp) {
    tp.payment_status = status;
    tp.payment_method = method;
    tp.paid_date = date;
  }
  saveStore(store);
}

// --- Rounds ---

export async function getRounds(tournamentId: number): Promise<Round[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    return d.select(
      "SELECT * FROM rounds WHERE tournament_id = $1 ORDER BY round_number",
      [tournamentId]
    );
  }
  const store = loadStore();
  return store.rounds
    .filter((r) => r.tournament_id === tournamentId)
    .sort((a, b) => a.round_number - b.round_number);
}

export async function createRound(
  tournamentId: number,
  roundNumber: number,
  phase: string | null = null,
  groupNumber: number | null = null
): Promise<number> {
  if (isTauri()) {
    const d = await getTauriDb();
    const result = await d.execute(
      "INSERT INTO rounds (tournament_id, round_number, phase, group_number) VALUES ($1, $2, $3, $4)",
      [tournamentId, roundNumber, phase, groupNumber]
    );
    return result.lastInsertId!;
  }
  const store = loadStore();
  const id = nextId(store, "rounds");
  store.rounds.push({
    id,
    tournament_id: tournamentId,
    round_number: roundNumber,
    phase: phase as any,
    group_number: groupNumber,
  });
  saveStore(store);
  return id;
}

// --- Matches ---

export async function getMatchesByRound(roundId: number): Promise<Match[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    return d.select("SELECT * FROM matches WHERE round_id = $1 ORDER BY id", [roundId]);
  }
  const store = loadStore();
  return store.matches.filter((m) => m.round_id === roundId).sort((a, b) => a.id - b.id);
}

export async function createMatch(
  roundId: number,
  team1P1: number,
  team1P2: number | null,
  team2P1: number,
  team2P2: number | null,
  court: number | null = null
): Promise<number> {
  const assignedAt = court ? new Date().toISOString() : null;
  const startedAt = court ? new Date().toISOString() : null;
  if (isTauri()) {
    const d = await getTauriDb();
    const result = await d.execute(
      "INSERT INTO matches (round_id, team1_p1, team1_p2, team2_p1, team2_p2, court, court_assigned_at, started_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [roundId, team1P1, team1P2, team2P1, team2P2, court, assignedAt, startedAt]
    );
    return result.lastInsertId!;
  }
  const store = loadStore();
  const id = nextId(store, "matches");
  store.matches.push({
    id,
    round_id: roundId,
    court,
    court_assigned_at: assignedAt,
    team1_p1: team1P1,
    team1_p2: team1P2,
    team2_p1: team2P1,
    team2_p2: team2P2,
    winner_team: null,
    status: "pending",
    started_at: startedAt,
    completed_at: null,
  });
  saveStore(store);
  return id;
}

export async function updateMatchCourt(matchId: number, court: number | null): Promise<void> {
  const assignedAt = court ? new Date().toISOString() : null;
  const startedAt = court ? new Date().toISOString() : null;
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("UPDATE matches SET court = $1, court_assigned_at = $2, started_at = $3 WHERE id = $4", [court, assignedAt, startedAt, matchId]);
    return;
  }
  const store = loadStore();
  const m = store.matches.find((m) => m.id === matchId);
  if (m) {
    m.court = court;
    m.court_assigned_at = assignedAt;
    m.started_at = startedAt;
  }
  saveStore(store);
}

export async function clearMatchCourt(matchId: number): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("UPDATE matches SET court = NULL WHERE id = $1", [matchId]);
    return;
  }
  const store = loadStore();
  const m = store.matches.find((m) => m.id === matchId);
  if (m) m.court = null;
  saveStore(store);
}

export async function updateMatchResult(matchId: number, winnerTeam: 1 | 2 | null): Promise<void> {
  if (winnerTeam === null) {
    // Reset match to active (scores changed, no winner yet)
    if (isTauri()) {
      const d = await getTauriDb();
      await d.execute(
        "UPDATE matches SET winner_team = NULL, status = 'active', completed_at = NULL WHERE id = $1",
        [matchId]
      );
      return;
    }
    const store = loadStore();
    const m = store.matches.find((m) => m.id === matchId);
    if (m) {
      m.winner_team = null;
      m.status = "active";
      m.completed_at = null;
    }
    saveStore(store);
    return;
  }
  const completedAt = new Date().toISOString();
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute(
      "UPDATE matches SET winner_team = $1, status = 'completed', completed_at = $2 WHERE id = $3",
      [winnerTeam, completedAt, matchId]
    );
    return;
  }
  const store = loadStore();
  const m = store.matches.find((m) => m.id === matchId);
  if (m) {
    m.winner_team = winnerTeam;
    m.status = "completed";
    m.completed_at = completedAt;
  }
  saveStore(store);
}

export async function reopenMatch(matchId: number): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute(
      "UPDATE matches SET winner_team = NULL, status = 'pending' WHERE id = $1",
      [matchId]
    );
    return;
  }
  const store = loadStore();
  const m = store.matches.find((m) => m.id === matchId);
  if (m) {
    m.winner_team = null;
    m.status = "pending";
  }
  saveStore(store);
}

// --- Sets ---

export async function getSetsByMatch(matchId: number): Promise<GameSet[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    return d.select("SELECT * FROM sets WHERE match_id = $1 ORDER BY set_number", [matchId]);
  }
  const store = loadStore();
  return store.sets
    .filter((s) => s.match_id === matchId)
    .sort((a, b) => a.set_number - b.set_number);
}

export async function upsertSet(
  matchId: number,
  setNumber: number,
  team1Score: number,
  team2Score: number
): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    const existing: GameSet[] = await d.select(
      "SELECT * FROM sets WHERE match_id = $1 AND set_number = $2",
      [matchId, setNumber]
    );
    if (existing.length > 0) {
      await d.execute(
        "UPDATE sets SET team1_score = $1, team2_score = $2 WHERE match_id = $3 AND set_number = $4",
        [team1Score, team2Score, matchId, setNumber]
      );
    } else {
      await d.execute(
        "INSERT INTO sets (match_id, set_number, team1_score, team2_score) VALUES ($1, $2, $3, $4)",
        [matchId, setNumber, team1Score, team2Score]
      );
    }
    return;
  }
  const store = loadStore();
  const existing = store.sets.find(
    (s) => s.match_id === matchId && s.set_number === setNumber
  );
  if (existing) {
    existing.team1_score = team1Score;
    existing.team2_score = team2Score;
  } else {
    store.sets.push({
      id: nextId(store, "sets"),
      match_id: matchId,
      set_number: setNumber,
      team1_score: team1Score,
      team2_score: team2Score,
    });
  }
  saveStore(store);
}

// --- Wipe / Reset ---

export async function wipeAllPlayers(): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("DELETE FROM tournament_players");
    await d.execute("DELETE FROM players");
    return;
  }
  const store = loadStore();
  store.players = [];
  store.tournamentPlayers = [];
  saveStore(store);
}

export async function wipeAllTournaments(): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("DELETE FROM sets");
    await d.execute("DELETE FROM matches");
    await d.execute("DELETE FROM rounds");
    await d.execute("DELETE FROM tournament_players");
    await d.execute("DELETE FROM tournaments");
    return;
  }
  const store = loadStore();
  store.sets = [];
  store.matches = [];
  store.rounds = [];
  store.tournamentPlayers = [];
  store.tournaments = [];
  saveStore(store);
}

// --- App Settings (key-value store in DB) ---

export async function getAppSetting(key: string): Promise<string | null> {
  if (isTauri()) {
    const d = await getTauriDb();
    const rows: { value: string }[] = await d.select(
      "SELECT value FROM app_settings WHERE key = $1",
      [key]
    );
    return rows.length > 0 ? rows[0].value : null;
  }
  // Fallback: localStorage
  return localStorage.getItem(`app_setting_${key}`);
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    const existing: { key: string }[] = await d.select(
      "SELECT key FROM app_settings WHERE key = $1",
      [key]
    );
    if (existing.length > 0) {
      await d.execute("UPDATE app_settings SET value = $1 WHERE key = $2", [value, key]);
    } else {
      await d.execute("INSERT INTO app_settings (key, value) VALUES ($1, $2)", [key, value]);
    }
    return;
  }
  localStorage.setItem(`app_setting_${key}`, value);
}

export async function deleteAppSetting(key: string): Promise<void> {
  if (isTauri()) {
    const d = await getTauriDb();
    await d.execute("DELETE FROM app_settings WHERE key = $1", [key]);
    return;
  }
  localStorage.removeItem(`app_setting_${key}`);
}

// --- Match Duration Queries ---

export async function getAllMatchesWithTournament(): Promise<(Match & { tournament_id: number; tournament_name: string })[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    return d.select(
      "SELECT m.*, r.tournament_id, t.name as tournament_name FROM matches m JOIN rounds r ON m.round_id = r.id JOIN tournaments t ON r.tournament_id = t.id WHERE m.status = 'completed'"
    );
  }
  const store = loadStore();
  const completedMatches = store.matches.filter((m) => m.status === "completed");
  return completedMatches.map((m) => {
    const round = store.rounds.find((r) => r.id === m.round_id);
    const tournament = store.tournaments.find((t) => t.id === round?.tournament_id);
    return {
      ...m,
      tournament_id: round?.tournament_id ?? 0,
      tournament_name: tournament?.name ?? "",
    };
  });
}

export async function getAllSetsFlat(): Promise<GameSet[]> {
  if (isTauri()) {
    const d = await getTauriDb();
    return d.select("SELECT * FROM sets");
  }
  const store = loadStore();
  return [...store.sets];
}
