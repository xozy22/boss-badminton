/**
 * Live Publishing — builds JSON snapshots of an active tournament and pushes
 * them to a configured WordPress endpoint via the BOSS Live Results plugin.
 *
 * Privacy: only first_name, last_name and club are exposed. Birth date and
 * payment info are deliberately omitted — public WordPress sites must not
 * expose member-PII or financial data.
 */

import { fetch } from "@tauri-apps/plugin-http";
import type {
  Tournament,
  Player,
  Round,
  Match,
  GameSet,
  StandingEntry,
  TeamStandingEntry,
  LivePublishConfig,
} from "./types";
import { calculateStandings, calculateTeamStandings } from "./scoring";
import { getAppSetting, setAppSetting } from "./db";

export const LIVE_PUBLISH_SETTING_KEY = "live_publish_config";
/**
 * app_settings key holding a JSON array of tournament IDs the user has
 * explicitly opted into live publishing for. Default off — a tournament
 * only gets pushed once the user clicks "Live aktivieren" in its detail
 * page.
 */
export const LIVE_PUBLISH_TOURNAMENTS_KEY = "live_publish_tournament_ids";
export const LIVE_PUBLISH_SCHEMA_VERSION = 1;

// --- Per-tournament opt-in storage -----------------------------------------

/** Returns the set of tournament IDs the user has enabled for live publishing. */
export async function getLiveTournamentIds(): Promise<number[]> {
  try {
    const raw = await getAppSetting(LIVE_PUBLISH_TOURNAMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Coerce + filter — defensive against legacy shapes.
    return parsed
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch (err) {
    console.error("getLiveTournamentIds: failed to load:", err);
    return [];
  }
}

async function writeLiveTournamentIds(ids: number[]): Promise<void> {
  // De-dupe + sort for stable persistence.
  const unique = Array.from(new Set(ids)).sort((a, b) => a - b);
  await setAppSetting(LIVE_PUBLISH_TOURNAMENTS_KEY, JSON.stringify(unique));
}

/** Returns true if `tournamentId` is currently opted into live publishing. */
export async function isTournamentLive(tournamentId: number): Promise<boolean> {
  const ids = await getLiveTournamentIds();
  return ids.includes(tournamentId);
}

/**
 * Adds or removes `tournamentId` from the opt-in set. Idempotent —
 * enabling an already-enabled tournament is a no-op.
 */
export async function setTournamentLive(
  tournamentId: number,
  on: boolean,
): Promise<void> {
  const current = await getLiveTournamentIds();
  const has = current.includes(tournamentId);
  if (on && !has) {
    await writeLiveTournamentIds([...current, tournamentId]);
  } else if (!on && has) {
    await writeLiveTournamentIds(current.filter((id) => id !== tournamentId));
  }
}

/** Lean player record — only the fields the public WP site needs. */
export interface PublicPlayer {
  id: number;
  first_name: string;
  last_name: string;
  club: string | null;
}

/** Lean tournament record — strips out internal-only knobs. */
export interface PublicTournament {
  id: number;
  name: string;
  status: Tournament["status"];
  mode: Tournament["mode"];
  format: Tournament["format"];
  current_phase: Tournament["current_phase"];
  courts: number;
  num_groups: number;
  qualify_per_group: number;
  sets_to_win: number;
  points_per_set: number;
  cap: number | null;
  ko_sets_to_win: number | null;
  ko_points_per_set: number | null;
  ko_cap: number | null;
}

export interface LiveSnapshot {
  schema: typeof LIVE_PUBLISH_SCHEMA_VERSION;
  pushed_at: string;
  app_version: string;
  tournament: PublicTournament;
  players: Record<number, PublicPlayer>;
  rounds: Round[];
  matches: Match[];
  sets: GameSet[];
  standings: StandingEntry[] | TeamStandingEntry[];
  /** Per-group standings when the tournament is in/after a group phase. */
  groups?: { number: number; standings: StandingEntry[] }[];
}

export interface DeleteRequest {
  schema: typeof LIVE_PUBLISH_SCHEMA_VERSION;
  pushed_at: string;
  delete: true;
  tournament: { id: number };
}

export interface TestRequest {
  schema: typeof LIVE_PUBLISH_SCHEMA_VERSION;
  test: true;
}

// --- Snapshot builder -------------------------------------------------------

function toPublicTournament(t: Tournament): PublicTournament {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    mode: t.mode,
    format: t.format,
    current_phase: t.current_phase,
    courts: t.courts,
    num_groups: t.num_groups,
    qualify_per_group: t.qualify_per_group,
    sets_to_win: t.sets_to_win,
    points_per_set: t.points_per_set,
    cap: t.cap,
    ko_sets_to_win: t.ko_sets_to_win,
    ko_points_per_set: t.ko_points_per_set,
    ko_cap: t.ko_cap,
  };
}

function toPublicPlayers(players: Player[]): Record<number, PublicPlayer> {
  const map: Record<number, PublicPlayer> = {};
  for (const p of players) {
    map[p.id] = {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      club: p.club,
    };
  }
  return map;
}

/**
 * Build a JSON-serializable snapshot of a single tournament's live state.
 *
 * Group-phase tournaments get an extra `groups[]` array with per-group
 * standings so the WP frontend can render group tables independently.
 */
export function buildSnapshot(
  tournament: Tournament,
  players: Player[],
  rounds: Round[],
  matches: Match[],
  sets: GameSet[],
  appVersion: string,
): LiveSnapshot {
  // Group sets by match_id for the standings calculator.
  const setsByMatch = new Map<number, GameSet[]>();
  for (const s of sets) {
    const arr = setsByMatch.get(s.match_id);
    if (arr) arr.push(s);
    else setsByMatch.set(s.match_id, [s]);
  }

  // Choose singles or doubles standings based on mode.
  const isDoubles = tournament.mode !== "singles";
  const standings = isDoubles
    ? calculateTeamStandings(players, matches, setsByMatch)
    : calculateStandings(players, matches, setsByMatch);

  // For group_ko: compute standings per group separately.
  let groups: { number: number; standings: StandingEntry[] }[] | undefined;
  if (tournament.format === "group_ko" && tournament.num_groups > 0) {
    const groupRounds = rounds.filter((r) => r.phase === "group");
    const byGroup = new Map<number, Round[]>();
    for (const r of groupRounds) {
      const g = r.group_number ?? 0;
      const arr = byGroup.get(g);
      if (arr) arr.push(r);
      else byGroup.set(g, [r]);
    }
    groups = [];
    for (const [groupNum, rs] of byGroup.entries()) {
      const roundIds = new Set(rs.map((r) => r.id));
      const groupMatches = matches.filter((m) => roundIds.has(m.round_id));
      const groupPlayerIds = new Set<number>();
      for (const m of groupMatches) {
        groupPlayerIds.add(m.team1_p1);
        if (m.team1_p2) groupPlayerIds.add(m.team1_p2);
        groupPlayerIds.add(m.team2_p1);
        if (m.team2_p2) groupPlayerIds.add(m.team2_p2);
      }
      const groupPlayers = players.filter((p) => groupPlayerIds.has(p.id));
      groups.push({
        number: groupNum,
        standings: calculateStandings(groupPlayers, groupMatches, setsByMatch),
      });
    }
    groups.sort((a, b) => a.number - b.number);
  }

  return {
    schema: LIVE_PUBLISH_SCHEMA_VERSION,
    pushed_at: new Date().toISOString(),
    app_version: appVersion,
    tournament: toPublicTournament(tournament),
    players: toPublicPlayers(players),
    rounds,
    matches,
    sets,
    standings,
    ...(groups ? { groups } : {}),
  };
}

/**
 * Stable signature of a snapshot for change detection. Excludes pushed_at
 * (which always differs) so that no-op heartbeats can be skipped on event
 * triggers.
 */
export function snapshotSignature(snap: LiveSnapshot): string {
  // JSON.stringify is fine for small objects; key order is stable since we
  // build the snapshot ourselves.
  const stripped = {
    schema: snap.schema,
    tournament: snap.tournament,
    rounds: snap.rounds,
    matches: snap.matches,
    sets: snap.sets,
    standings: snap.standings,
    groups: snap.groups,
  };
  // Cheap 32-bit string hash (FNV-1a) — collisions extremely unlikely for
  // change-detection purposes, and signature only needs to differ when state
  // does.
  const s = JSON.stringify(stripped);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

// --- Push -------------------------------------------------------------------

export type PushResult = { ok: true; status: number } | { ok: false; error: string };

async function postJson(
  endpoint: string,
  secret: string,
  body: unknown,
): Promise<PushResult> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BOSS-Secret": secret,
      },
      body: JSON.stringify(body),
      // 10s connect timeout — typical WP REST is fast; a hung request
      // shouldn't block a 60s heartbeat.
      connectTimeout: 10_000,
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function pushSnapshot(
  config: LivePublishConfig,
  snapshot: LiveSnapshot,
): Promise<PushResult> {
  return postJson(config.endpoint, config.secret, snapshot);
}

export async function pushDelete(
  config: LivePublishConfig,
  tournamentId: number,
): Promise<PushResult> {
  const body: DeleteRequest = {
    schema: LIVE_PUBLISH_SCHEMA_VERSION,
    pushed_at: new Date().toISOString(),
    delete: true,
    tournament: { id: tournamentId },
  };
  return postJson(config.endpoint, config.secret, body);
}

export async function testConnection(
  endpoint: string,
  secret: string,
): Promise<PushResult> {
  const body: TestRequest = {
    schema: LIVE_PUBLISH_SCHEMA_VERSION,
    test: true,
  };
  return postJson(endpoint, secret, body);
}
