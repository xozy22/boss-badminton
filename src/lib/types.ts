export type Gender = "m" | "f";
export type TournamentMode = "singles" | "doubles" | "mixed";
export type TournamentFormat = "round_robin" | "elimination" | "random_doubles";
export type TournamentStatus = "draft" | "active" | "completed" | "archived";
export type MatchStatus = "pending" | "active" | "completed";

export interface Player {
  id: number;
  name: string;
  gender: Gender;
  created_at: string;
}

export interface Tournament {
  id: number;
  name: string;
  mode: TournamentMode;
  format: TournamentFormat;
  sets_to_win: number;
  points_per_set: number;
  courts: number;
  created_at: string;
  status: TournamentStatus;
}

export interface TournamentPlayer {
  tournament_id: number;
  player_id: number;
}

export interface Round {
  id: number;
  tournament_id: number;
  round_number: number;
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

export const MODE_LABELS: Record<TournamentMode, string> = {
  singles: "Einzel",
  doubles: "Doppel",
  mixed: "Mixed",
};

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  round_robin: "Jeder gegen Jeden",
  elimination: "KO-System",
  random_doubles: "Wechselnde Partner",
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: "Entwurf",
  active: "Läuft",
  completed: "Beendet",
  archived: "Archiviert",
};
