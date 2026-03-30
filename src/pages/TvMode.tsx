import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getTournament,
  getTournamentPlayers,
  getRounds,
  getMatchesByRound,
  getSetsByMatch,
} from "../lib/db";
import { isSetComplete } from "../lib/scoring";
import type {
  Tournament,
  Player,
  Round,
  Match,
  GameSet,
} from "../lib/types";
import { MODE_LABELS, FORMAT_LABELS } from "../lib/types";
import { useTheme } from "../lib/ThemeContext";
import { useT } from "../lib/I18nContext";
import { getCustomLogo } from "./Settings";

interface Announcement {
  id: number;
  court: number;
  team1: string;
  team2: string;
  timestamp: number;
}

// TV accent color mapping per theme
const TV_ACCENTS: Record<string, { primary: string; primaryBg: string; gradient: string; headerBorder: string; courtBorder: string; courtBg: string; courtBadge: string; winText: string }> = {
  green:  { primary: "text-emerald-400", primaryBg: "bg-emerald-600", gradient: "from-gray-950 via-emerald-950 to-gray-950", headerBorder: "border-emerald-800/30", courtBorder: "border-emerald-500/50", courtBg: "bg-emerald-900/20", courtBadge: "bg-emerald-600", winText: "text-emerald-400" },
  blue:   { primary: "text-blue-400",    primaryBg: "bg-blue-600",    gradient: "from-gray-950 via-blue-950 to-gray-950",    headerBorder: "border-blue-800/30",    courtBorder: "border-blue-500/50",    courtBg: "bg-blue-900/20",    courtBadge: "bg-blue-600",    winText: "text-blue-400" },
  orange: { primary: "text-orange-400",  primaryBg: "bg-orange-600",  gradient: "from-gray-950 via-orange-950 to-gray-950",  headerBorder: "border-orange-800/30",  courtBorder: "border-orange-500/50",  courtBg: "bg-orange-900/20",  courtBadge: "bg-orange-600",  winText: "text-orange-400" },
  dark:   { primary: "text-emerald-400", primaryBg: "bg-emerald-600", gradient: "from-gray-950 via-gray-900 to-gray-950",    headerBorder: "border-gray-700/30",    courtBorder: "border-emerald-500/50", courtBg: "bg-emerald-900/20", courtBadge: "bg-emerald-600", winText: "text-emerald-400" },
};

export default function TvMode() {
  const { themeId } = useTheme();
  const { t } = useT();
  const tv = TV_ACCENTS[themeId] || TV_ACCENTS.green;
  const { id } = useParams<{ id: string }>();
  const tournamentId = Number(id);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matchesByRound, setMatchesByRound] = useState<Map<number, Match[]>>(new Map());
  const [setsByMatch, setSetsByMatch] = useState<Map<number, GameSet[]>>(new Map());
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [now, setNow] = useState(Date.now());
  const announcementIdRef = useRef(0);

  // Tick every second for timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts: Escape = close, F11 = toggle fullscreen
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if ((window as any).__TAURI_INTERNALS__) {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          getCurrentWindow().close();
        } else {
          window.close();
        }
      } else if (e.key === "F11") {
        e.preventDefault();
        if ((window as any).__TAURI_INTERNALS__) {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const win = getCurrentWindow();
          const isFs = await win.isFullscreen();
          await win.setFullscreen(!isFs);
        } else {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const t = await getTournament(tournamentId);
      setTournament(t);
      const p = await getTournamentPlayers(tournamentId);
      setPlayers(p);
      const r = await getRounds(tournamentId);
      setRounds(r);

      const mbr = new Map<number, Match[]>();
      const sbm = new Map<number, GameSet[]>();
      for (const round of r) {
        const matches = await getMatchesByRound(round.id);
        mbr.set(round.id, matches);
        for (const match of matches) {
          const sets = await getSetsByMatch(match.id);
          sbm.set(match.id, sets);
        }
      }
      setMatchesByRound(mbr);
      setSetsByMatch(sbm);
    } catch {}
  }, [tournamentId]);

  // Poll data every 3 seconds
  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 3000);
    return () => clearInterval(interval);
  }, [loadAll]);

  // Listen for announcements from main window
  useEffect(() => {
    const bc = new BroadcastChannel(`tournament-${tournamentId}`);
    bc.onmessage = (e) => {
      if (e.data.type === "announce") {
        const a: Announcement = {
          id: ++announcementIdRef.current,
          court: e.data.court,
          team1: e.data.team1,
          team2: e.data.team2,
          timestamp: Date.now(),
        };
        setAnnouncements((prev) => [a, ...prev.slice(0, 2)]); // Keep max 3
        // Auto-remove after 30 seconds
        setTimeout(() => {
          setAnnouncements((prev) => prev.filter((ann) => ann.id !== a.id));
        }, 30000);
      }
    };
    return () => bc.close();
  }, [tournamentId]);

  const playerName = (playerId: number | null): string => {
    if (playerId === null || playerId === undefined) return "-";
    return players.find((p) => p.id === playerId)?.name ?? "?";
  };

  const matchLabel = (m: Match): { team1: string; team2: string } => {
    const t1 = m.team1_p2
      ? `${playerName(m.team1_p1)} / ${playerName(m.team1_p2)}`
      : playerName(m.team1_p1);
    const t2 = m.team2_p2
      ? `${playerName(m.team2_p1)} / ${playerName(m.team2_p2)}`
      : playerName(m.team2_p1);
    return { team1: t1, team2: t2 };
  };

  const formatTimer = (assignedAt: string | null): string => {
    if (!assignedAt) return "00:00";
    const elapsed = Math.floor((now - new Date(assignedAt).getTime()) / 1000);
    if (elapsed < 0) return "00:00";
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Collect all matches from all rounds
  const allMatches: (Match & { roundNum: number })[] = [];
  for (const r of rounds) {
    const matches = matchesByRound.get(r.id) || [];
    for (const m of matches) {
      allMatches.push({ ...m, roundNum: r.round_number });
    }
  }

  // Court assignments (active matches on courts)
  const courtMatches = allMatches.filter((m) => m.court && m.status !== "completed");

  // Waiting matches (not on a court, not completed)
  const waitingMatches = allMatches.filter((m) => !m.court && m.status !== "completed");

  // Recently completed
  const completedMatches = allMatches
    .filter((m) => m.status === "completed")
    .slice(-6);

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-2xl">{t.common_loading}</div>
      </div>
    );
  }

  const numCourts = tournament.courts || 1;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${tv.gradient} text-white overflow-hidden`}>
      {/* Header */}
      <div className={`bg-black/30 backdrop-blur-sm border-b ${tv.headerBorder} px-8 py-4 flex justify-between items-center`}>
        <div className="flex items-center gap-4">
          <img src={getCustomLogo() || "/logo.png"} alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{tournament.name}</h1>
            <div className={`${tv.primary} text-sm font-medium`}>
              {MODE_LABELS[tournament.mode]} &middot; {FORMAT_LABELS[tournament.format]}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-mono font-bold ${tv.primary}`}>
            {new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-gray-400 text-sm">
            {t.tv_players_round.replace("{players}", String(players.length)).replace("{round}", String(rounds.length))}
          </div>
        </div>
      </div>

      {/* Announcement Banner */}
      {announcements.length > 0 && (
        <div className="bg-amber-500 text-gray-950">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="px-8 py-3 flex items-center gap-4 text-lg font-bold animate-pulse border-b border-amber-600 last:border-0"
            >
              <span className="text-2xl">📢</span>
              <span>{t.tv_court_label.replace("{n}", String(a.court))}:</span>
              <span className="flex-1">
                {a.team1} <span className="font-normal mx-2">{t.common_vs}</span> {a.team2}
              </span>
              <span className="text-amber-800 text-sm font-normal">
                {t.tv_please_go_to_court}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="p-6 grid grid-cols-3 gap-6 h-[calc(100vh-80px)]">
        {/* LEFT: Courts */}
        <div className="col-span-2 space-y-4">
          <h2 className={`text-lg font-bold ${tv.primary} uppercase tracking-wider mb-2`}>
            {t.tv_courts}
          </h2>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(numCourts, 3)}, 1fr)` }}
          >
            {Array.from({ length: numCourts }, (_, i) => i + 1).map((courtNum) => {
              const match = courtMatches.find((m) => m.court === courtNum);
              const isFree = !match;

              if (isFree) {
                return (
                  <div
                    key={courtNum}
                    className="rounded-2xl border-2 border-dashed border-gray-700 bg-gray-900/50 p-6 flex flex-col items-center justify-center min-h-[180px]"
                  >
                    <div className="text-2xl font-bold text-gray-600 mb-2">
                      {t.tv_court_label.replace("{n}", String(courtNum))}
                    </div>
                    <div className="text-gray-600 text-lg">{t.tv_free}</div>
                  </div>
                );
              }

              const { team1, team2 } = matchLabel(match);
              const sets = setsByMatch.get(match.id) || [];
              let t1Sets = 0, t2Sets = 0;
              for (const s of sets) {
                if (isSetComplete(s, tournament.points_per_set)) {
                  if (s.team1_score > s.team2_score) t1Sets++;
                  else t2Sets++;
                }
              }

              return (
                <div
                  key={courtNum}
                  className={`rounded-2xl border-2 ${tv.courtBorder} ${tv.courtBg} p-5 min-h-[180px] flex flex-col`}
                >
                  {/* Court header */}
                  <div className="flex justify-between items-center mb-4">
                    <span className={`text-sm font-bold ${tv.courtBadge} text-white px-3 py-1 rounded-full`}>
                      {t.tv_court_label.replace("{n}", String(courtNum))}
                    </span>
                    <span className="text-lg font-mono font-bold text-amber-400">
                      ⏱ {formatTimer(match.court_assigned_at)}
                    </span>
                  </div>

                  {/* Teams */}
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="text-xl font-bold text-white leading-tight mb-1">
                      {team1}
                    </div>
                    <div className="text-gray-500 text-sm my-1">{t.common_vs}</div>
                    <div className="text-xl font-bold text-white leading-tight">
                      {team2}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-3 mt-3">
                    <div className="text-2xl font-extrabold font-mono text-center bg-black/30 rounded-xl px-4 py-2 flex-1">
                      <span className={t1Sets > t2Sets ? tv.winText : "text-white"}>
                        {t1Sets}
                      </span>
                      <span className="text-gray-600 mx-2">:</span>
                      <span className={t2Sets > t1Sets ? tv.winText : "text-white"}>
                        {t2Sets}
                      </span>
                    </div>
                    {/* Current set score */}
                    {sets.length > 0 && (
                      <div className="text-sm font-mono text-gray-400">
                        {sets
                          .filter((s) => s.team1_score > 0 || s.team2_score > 0)
                          .map((s) => (
                            <div key={s.set_number}>
                              {s.team1_score}:{s.team2_score}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recently Completed */}
          {completedMatches.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">
                {t.tv_recent_results}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {completedMatches.slice().reverse().slice(0, 4).map((m) => {
                  const { team1, team2 } = matchLabel(m);
                  const sets = setsByMatch.get(m.id) || [];
                  let t1Sets = 0, t2Sets = 0;
                  for (const s of sets) {
                    if (s.team1_score > s.team2_score) t1Sets++;
                    else if (s.team2_score > s.team1_score) t2Sets++;
                  }
                  return (
                    <div
                      key={m.id}
                      className="bg-black/20 rounded-xl px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-semibold ${m.winner_team === 1 ? tv.winText : "text-gray-500"}`}>
                          {team1}
                        </span>
                        <span className={`font-mono font-bold text-lg ${m.winner_team === 1 ? tv.winText : "text-gray-500"}`}>
                          {t1Sets}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold ${m.winner_team === 2 ? tv.winText : "text-gray-500"}`}>
                          {team2}
                        </span>
                        <span className={`font-mono font-bold text-lg ${m.winner_team === 2 ? tv.winText : "text-gray-500"}`}>
                          {t2Sets}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Queue */}
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-amber-400 uppercase tracking-wider mb-3">
            {t.tv_queue}
          </h2>

          {waitingMatches.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-600 text-lg text-center">
                <div className="text-4xl mb-2">✅</div>
                {t.tv_no_waiting}
              </div>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1">
              {waitingMatches.slice(0, 12).map((m, i) => {
                const { team1, team2 } = matchLabel(m);
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl px-4 py-3 border transition-all ${
                      i === 0
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-black/20 border-gray-800"
                    }`}
                  >
                    {i === 0 && (
                      <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">
                        {t.tv_next_up}
                      </div>
                    )}
                    <div className="text-sm">
                      <div className="font-semibold text-white">{team1}</div>
                      <div className="text-gray-500 text-xs my-0.5">{t.common_vs}</div>
                      <div className="font-semibold text-white">{team2}</div>
                    </div>
                  </div>
                );
              })}
              {waitingMatches.length > 12 && (
                <div className="text-center text-gray-600 text-sm py-2">
                  {t.tv_more.replace("{count}", String(waitingMatches.length - 12))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyboard hint - fades after 5 seconds */}
      <div className="fixed bottom-2 right-3 text-[10px] text-gray-600 opacity-60">
        {t.tv_keyboard_hint}
      </div>
    </div>
  );
}
