import { useMemo } from "react";
import type { Match } from "../../lib/types";
import { CourtTimer } from "./CourtTimer";

interface Props {
  courts: number;
  matches: Match[];
  playerName: (id: number | null) => string;
  onDrop?: (matchId: number, court: number) => void;
}

export default function CourtOverview({ courts, matches, playerName, onDrop }: Props) {
  // Finde fuer jedes Feld das aktive (nicht abgeschlossene) Match
  const courtAssignments = useMemo(() => {
    const map = new Map<number, Match>();
    for (const m of matches) {
      if (m.court && m.status !== "completed") {
        map.set(m.court, m);
      }
    }
    return map;
  }, [matches]);

  // Spiele ohne Feldzuweisung (zum Drag starten)
  const unassigned = useMemo(
    () => matches.filter((m) => !m.court && m.status !== "completed"),
    [matches]
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

  return (
    <div className="mb-5">
      {/* Court Grid */}
      <div className={`grid gap-3 ${courts <= 4 ? `grid-cols-${courts}` : "grid-cols-4"}`}
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
              className={`rounded-2xl border-2 border-dashed p-4 transition-all duration-200 min-h-[100px] ${
                isFree
                  ? "border-gray-200 bg-gray-50/50 hover:border-emerald-300 hover:bg-emerald-50/30"
                  : "border-emerald-300 bg-white shadow-sm"
              }`}
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
                  <div className="font-semibold text-gray-900 truncate">
                    {teamLabel(match).t1}
                  </div>
                  <div className="text-gray-400 text-[10px] my-0.5">vs</div>
                  <div className="font-semibold text-gray-900 truncate">
                    {teamLabel(match).t2}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 text-center mt-3">
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
                  className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs cursor-grab active:cursor-grabbing hover:border-amber-300 hover:shadow-sm transition-all select-none"
                >
                  <span className="font-medium">{t1}</span>
                  <span className="text-gray-400 mx-1">vs</span>
                  <span className="font-medium">{t2}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
