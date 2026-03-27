import { useMemo, useState } from "react";
import type { Match } from "../../lib/types";
import { CourtTimer } from "./CourtTimer";
import { useTheme } from "../../lib/ThemeContext";

interface Props {
  courts: number;
  matches: Match[];          // ALL matches across ALL rounds (for court assignments)
  activeRoundMatches?: Match[];  // Matches of the currently viewed round (for unassigned queue)
  playerName: (id: number | null) => string;
  onDrop?: (matchId: number, court: number) => void;
  onMatchClick?: (matchId: number) => void;
}

export default function CourtOverview({ courts, matches, activeRoundMatches, playerName, onDrop, onMatchClick }: Props) {
  const { theme } = useTheme();
  // Finde fuer jedes Feld das aktive (nicht abgeschlossene) Match - aus ALLEN Runden
  const courtAssignments = useMemo(() => {
    const map = new Map<number, Match>();
    for (const m of matches) {
      if (m.court && m.status !== "completed") {
        map.set(m.court, m);
      }
    }
    return map;
  }, [matches]);

  // Spiele ohne Feldzuweisung - nur aus der aktiven Runde (falls angegeben), sonst alle
  const sourceForUnassigned = activeRoundMatches ?? matches;
  const unassigned = useMemo(
    () => sourceForUnassigned.filter((m) => !m.court && m.status !== "completed"),
    [sourceForUnassigned]
  );

  const teamLabel = (m: Match) => {
    const t1 = m.team1_p2
      ? `${playerName(m.team1_p1)} / ${playerName(m.team1_p2)}`
      : playerName(m.team1_p1);
    const t2 = m.team2_p2
      ? `${playerName(m.team2_p1)} / ${playerName(m.team2_p2)}`
      : playerName(m.team2_p1);
    return { t1, t2 };
  };

  const handleDragStart = (e: React.DragEvent, matchId: number) => {
    e.dataTransfer.setData("matchId", String(matchId));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, court: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = courtAssignments.has(court) ? "none" : "move";
  };

  const handleDrop = (e: React.DragEvent, court: number) => {
    e.preventDefault();
    // Nur auf freie Felder droppen
    if (courtAssignments.has(court)) return;
    const matchId = Number(e.dataTransfer.getData("matchId"));
    if (matchId && onDrop) {
      onDrop(matchId, court);
    }
  };

  // Double-click to assign court via popup
  const [courtPickerMatchId, setCourtPickerMatchId] = useState<number | null>(null);
  const freeCourts = useMemo(() => {
    const free: number[] = [];
    for (let i = 1; i <= courts; i++) {
      if (!courtAssignments.has(i)) free.push(i);
    }
    return free;
  }, [courts, courtAssignments]);

  const handleDoubleClick = (matchId: number) => {
    if (freeCourts.length === 1 && onDrop) {
      // Only one free court: assign directly
      onDrop(matchId, freeCourts[0]);
    } else if (freeCourts.length > 1) {
      setCourtPickerMatchId(matchId);
    }
  };

  const handlePickCourt = (court: number) => {
    if (courtPickerMatchId && onDrop) {
      onDrop(courtPickerMatchId, court);
    }
    setCourtPickerMatchId(null);
  };

  return (
    <div className="mb-5">
      {/* Court Grid */}
      <div className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(courts, 4)}, 1fr)` }}
      >
        {Array.from({ length: courts }, (_, i) => i + 1).map((courtNum) => {
          const match = courtAssignments.get(courtNum);
          const isFree = !match;

          return (
            <div
              key={courtNum}
              onDragOver={(e) => handleDragOver(e, courtNum)}
              onDrop={(e) => handleDrop(e, courtNum)}
              onDoubleClick={() => match && onMatchClick?.(match.id)}
              className={`rounded-2xl border-2 border-dashed p-4 transition-all duration-200 min-h-[100px] ${
                isFree
                  ? `${theme.cardBorder} ${theme.cardBg} opacity-70 hover:opacity-100`
                  : `${theme.courtBorder} ${theme.cardBg} shadow-sm cursor-pointer`
              }`}
              title={match ? "Doppelklick: Zum Spiel springen" : undefined}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  Feld {courtNum}
                </span>
                {match && (
                  <CourtTimer assignedAt={match.court_assigned_at} />
                )}
              </div>

              {match ? (
                <div className="text-xs">
                  <div className={`font-semibold ${theme.textPrimary} truncate`}>
                    {teamLabel(match).t1}
                  </div>
                  <div className={`${theme.textMuted} text-[10px] my-0.5`}>vs</div>
                  <div className={`font-semibold ${theme.textPrimary} truncate`}>
                    {teamLabel(match).t2}
                  </div>
                </div>
              ) : (
                <div className={`text-xs ${theme.textMuted} text-center mt-3`}>
                  Frei – Spiel hierher ziehen
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned matches */}
      {unassigned.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
            Warten auf Feld ({unassigned.length})
          </div>
          <div className="flex gap-2 flex-wrap">
            {unassigned.map((m) => {
              const { t1, t2 } = teamLabel(m);
              return (
                <div
                  key={m.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, m.id)}
                  onDoubleClick={() => handleDoubleClick(m.id)}
                  className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl px-3 py-2 text-xs cursor-grab active:cursor-grabbing hover:border-amber-300 hover:shadow-sm transition-all select-none relative`}
                  title="Drag auf ein Feld oder Doppelklick zum Zuweisen"
                >
                  <span className={`font-medium ${theme.textPrimary}`}>{t1}</span>
                  <span className={`${theme.textMuted} mx-1`}>vs</span>
                  <span className={`font-medium ${theme.textPrimary}`}>{t2}</span>

                  {/* Court picker popup */}
                  {courtPickerMatchId === m.id && (
                    <div className={`absolute top-full left-0 mt-1 ${theme.cardBg} border ${theme.cardBorder} rounded-xl shadow-xl z-50 overflow-hidden`}>
                      <div className={`px-3 py-1.5 text-[10px] font-bold ${theme.textMuted} uppercase tracking-wide border-b ${theme.cardBorder}`}>
                        Feld waehlen
                      </div>
                      {freeCourts.map((c) => (
                        <button
                          key={c}
                          onClick={(e) => { e.stopPropagation(); handlePickCourt(c); }}
                          className={`w-full px-4 py-2 text-left text-xs font-medium ${theme.textPrimary} hover:${theme.selectedBg} transition-colors`}
                        >
                          Feld {c}
                        </button>
                      ))}
                      <button
                        onClick={(e) => { e.stopPropagation(); setCourtPickerMatchId(null); }}
                        className={`w-full px-4 py-1.5 text-left text-[10px] ${theme.textMuted} border-t ${theme.cardBorder} hover:opacity-80`}
                      >
                        Abbrechen
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
