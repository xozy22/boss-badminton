export type Gender = "m" | "f";
export type TournamentMode = "singles" | "doubles" | "mixed";
export type TournamentFormat = "round_robin" | "elimination" | "random_doubles" | "group_ko" | "swiss" | "double_elimination" | "monrad" | "king_of_court" | "waterfall";
export type TournamentStatus = "draft" | "active" | "completed" | "archived";
export type MatchStatus = "pending" | "active" | "completed";

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  gender: Gender;
  birth_date: string | null;
  club: string | null;
  created_at: string;
}

export function playerDisplayName(p: { first_name: string; last_name: string }): string {
  return p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name;
}

export function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export interface HallConfig {
  name: string;
  courts: number;
}

export function parseHallConfig(json: string | null): HallConfig[] {
  if (!json) return [];
  try { return JSON.parse(json) as HallConfig[]; } catch (err) { console.error("parseHallConfig: failed to parse hall config JSON:", err); return []; }
}

export function hallConfigTotalCourts(config: HallConfig[]): number {
  return config.reduce((sum, h) => sum + h.courts, 0);
}

/** Convert global court number to hall-local label */
export function getCourtHallLabel(courtNum: number, config: HallConfig[]): { hallName: string; localCourt: number } {
  let offset = 0;
  for (const h of config) {
    if (courtNum <= offset + h.courts) {
      return { hallName: h.name, localCourt: courtNum - offset };
    }
    offset += h.courts;
  }
  return { hallName: "", localCourt: courtNum };
}

export interface Sportstaette {
  id: number;
  name: string;
  address: string | null;
  zip: string | null;
  city: string | null;
  courts: number;
  halls: string | null;
  created_at: string;
}

export type TournamentPhase = "group" | "ko" | "swiss" | "winners" | "losers" | "ready" | null;

export interface Tournament {
  id: number;
  name: string;
  mode: TournamentMode;
  format: TournamentFormat;
  sets_to_win: number;
  points_per_set: number;
  courts: number;
  num_groups: number;
  qualify_per_group: number;
  current_phase: TournamentPhase;
  entry_fee_single: number;
  entry_fee_double: number;
  team_config: string | null;
  hall_config: string | null;
  created_at: string;
  status: TournamentStatus;
}

export type PaymentMethod = "bar" | "ueberweisung" | "paypal";
export type PaymentStatus = "unpaid" | "paid";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bar: "Bar",
  ueberweisung: "Ueberweisung",
  paypal: "PayPal",
};

export interface TournamentPlayer {
  tournament_id: number;
  player_id: number;
}

export interface TournamentPlayerInfo {
  player: Player;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_date: string | null;
  retired: boolean;
}

export interface Round {
  id: number;
  tournament_id: number;
  round_number: number;
  phase: TournamentPhase;
  group_number: number | null;
}

export interface Match {
  id: number;
  round_id: number;
  court: number | null;
  court_assigned_at: string | null;
  team1_p1: number;
  team1_p2: number | null;
  team2_p1: number;
  team2_p2: number | null;
  winner_team: 1 | 2 | null;
  status: MatchStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface GameSet {
  id: number;
  match_id: number;
  set_number: number;
  team1_score: number;
  team2_score: number;
}

export interface StandingEntry {
  player: Player;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
}

export interface TeamStandingEntry {
  teamKey: string; // "id1-id2" sorted
  player1: Player;
  player2: Player;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
}

export const MODE_LABELS: Record<TournamentMode, string> = {
  singles: "Einzel",
  doubles: "Doppel",
  mixed: "Mixed",
};

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  round_robin: "Jeder gegen Jeden",
  elimination: "KO-System",
  random_doubles: "Wechselnde Partner",
  group_ko: "Gruppenphase + KO",
  swiss: "Schweizer System",
  double_elimination: "Doppel-KO",
  monrad: "Monrad-System",
  king_of_court: "King of the Court",
  waterfall: "Waterfall",
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: "Entwurf",
  active: "Läuft",
  completed: "Beendet",
  archived: "Archiviert",
};
