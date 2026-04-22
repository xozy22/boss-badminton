import { useMemo, useState } from "react";
import type { Match, HallConfig, Round, TournamentStatus } from "../../lib/types";
import { getCourtHallLabel } from "../../lib/types";
import { CourtTimer } from "./CourtTimer";
import { useTheme } from "../../lib/ThemeContext";
import { useT } from "../../lib/I18nContext";
import RestIndicator from "../players/RestIndicator";

interface Props {
  courts: number;
  matches: Match[];          // ALL matches across ALL rounds (for court assignments)
  activeRoundMatches?: Match[];  // Matches of the currently viewed round (for unassigned queue)
  futureRoundQueues?: { round: Round; matches: Match[] }[];  // Early-draw: next rounds in queue
  playerName: (id: number | null) => string;
  onDrop?: (matchId: number, court: number) => void;
  onMatchClick?: (matchId: number) => void;
  hallConfig?: HallConfig[];
  /** For the ⏱ rest indicator next to player names. */
  minRestMinutes?: number;
  tournamentStatus?: TournamentStatus;
}

export default function CourtOverview({ courts, matches, activeRoundMatches, futureRoundQueues, playerName, onDrop, onMatchClick, hallConfig, minRestMinutes = 0, tournamentStatus }: Props) {
  const { theme } = useTheme();
  const { t } = useT();
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

  // JSX renderer with inline ⏱ RestIndicator next to each resting player.
  // Active/non-completed matches only — the indicator is for scheduling clarity.
  const showRestIcons = tournamentStatus === "active" && minRestMinutes > 0;
  const renderTeam = (p1: number, p2: number | null, m: Match) => {
    const scheduled = m.status !== "completed";
    const wantIcons = showRestIcons && scheduled;
    return (
      <>
        <span>{playerName(p1)}</span>
        {wantIcons && (
          <RestIndicator
            playerId={p1}
            matches={matches}
            minRestMinutes={minRestMinutes}
            excludeMatchId={m.id}
          />
        )}
        {p2 != null && (
          <>
            <span className="mx-1 text-gray-400">/</span>
            <span>{playerName(p2)}</span>
            {wantIcons && (
              <RestIndicator
                playerId={p2}
                matches={matches}
                minRestMinutes={minRestMinutes}
                excludeMatchId={m.id}
              />
            )}
          </>
        )}
      </>
    );
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

  // SVG Badminton-Court als Hintergrund (dezent durchscheinend)
  // Querformat: Netz vertikal in der Mitte, Spielfeld horizontal
  const courtBgSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 134" fill="none" opacity="0.18">
    <rect x="2" y="2" width="256" height="130" rx="2" stroke="#9CA3AF" stroke-width="1.5"/>
    <line x1="130" y1="2" x2="130" y2="132" stroke="#9CA3AF" stroke-width="2"/>
    <rect x="2" y="17" width="256" height="100" rx="1" stroke="#9CA3AF" stroke-width="1"/>
    <line x1="46" y1="17" x2="46" y2="117" stroke="#9CA3AF" stroke-width="1"/>
    <line x1="214" y1="17" x2="214" y2="117" stroke="#9CA3AF" stroke-width="1"/>
    <line x1="46" y1="67" x2="214" y2="67" stroke="#9CA3AF" stroke-width="1"/>
    <line x1="236" y1="2" x2="236" y2="132" stroke="#9CA3AF" stroke-width="1" stroke-dasharray="4 3"/>
    <line x1="24" y1="2" x2="24" y2="132" stroke="#9CA3AF" stroke-width="1" stroke-dasharray="4 3"/>
  </svg>`)}`;

  // Determine if we should render multi-hall sections
  const useMultiHall = hallConfig && hallConfig.length > 1;

  // Build hall sections for multi-hall rendering
  const hallSections = useMemo(() => {
    if (!hallConfig || hallConfig.length <= 1) return null;
    const sections: { name: string; globalStart: number; count: number }[] = [];
    let offset = 0;
    for (const hall of hallConfig) {
      sections.push({ name: hall.name, globalStart: offset + 1, count: hall.courts });
      offset += hall.courts;
    }
    return sections;
  }, [hallConfig]);

  // Get display label for a court number
  const getCourtLabel = (courtNum: number): string => {
    if (hallConfig && hallConfig.length > 1) {
      const { localCourt } = getCourtHallLabel(courtNum, hallConfig);
      return t.court_field.replace("{n}", String(localCourt));
    }
    return t.court_field.replace("{n}", String(courtNum));
  };

  // Render a single court card
  const renderCourt = (courtNum: number) => {
    const match = courtAssignments.get(courtNum);
    const isFree = !match;

    return (
      <div
        key={courtNum}
        onDragOver={(e) => handleDragOver(e, courtNum)}
        onDrop={(e) => handleDrop(e, courtNum)}
        onDoubleClick={() => match && onMatchClick?.(match.id)}
        className={`rounded-2xl border-2 border-dashed p-4 transition-all duration-200 min-h-[100px] relative overflow-hidden ${
          isFree
            ? `${theme.cardBorder} ${theme.cardBg} opacity-70 hover:opacity-100`
            : `${theme.courtBorder} ${theme.cardBg} shadow-sm cursor-pointer`
        }`}
        style={{
          backgroundImage: `url("${courtBgSvg}")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'auto 85%',
          opacity: undefined,
        }}
        title={match ? t.court_double_click_jump : undefined}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
            {getCourtLabel(courtNum)}
          </span>
          {match && (
            <CourtTimer assignedAt={match.court_assigned_at} />
          )}
        </div>

        {match ? (
          <div className="text-xs">
            <div className={`font-semibold ${theme.textPrimary} truncate`}>
              {renderTeam(match.team1_p1, match.team1_p2, match)}
            </div>
            <div className={`${theme.textMuted} text-[10px] my-0.5`}>{t.common_vs}</div>
            <div className={`font-semibold ${theme.textPrimary} truncate`}>
              {renderTeam(match.team2_p1, match.team2_p2, match)}
            </div>
          </div>
        ) : (
          <div className={`text-xs ${theme.textMuted} text-center mt-3`}>
            {t.court_free_drag}
          </div>
        )}
      </div>
    );
  };

  // Group free courts by hall for the picker popup
  const freeCourtsByHall = useMemo(() => {
    if (!hallConfig || hallConfig.length <= 1) return null;
    const groups: { hallName: string; courts: number[] }[] = [];
    let offset = 0;
    for (const hall of hallConfig) {
      const hallCourts: number[] = [];
      for (let i = offset + 1; i <= offset + hall.courts; i++) {
        if (!courtAssignments.has(i)) hallCourts.push(i);
      }
      if (hallCourts.length > 0) {
        groups.push({ hallName: hall.name, courts: hallCourts });
      }
      offset += hall.courts;
    }
    return groups;
  }, [hallConfig, courtAssignments]);

  return (
    <div className="mb-5">
      {/* Court Grid */}
      {useMultiHall && hallSections ? (
        // Multi-hall: render sections per hall
        <div className="space-y-4">
          {hallSections.map((section) => (
            <div key={section.name}>
              <div className={`text-xs font-semibold ${theme.textSecondary} uppercase tracking-wide mb-2`}>
                {section.name}
              </div>
              <div className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(section.count, 4)}, 1fr)` }}
              >
                {Array.from({ length: section.count }, (_, i) => section.globalStart + i).map(renderCourt)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Single hall or no config: flat grid
        <div className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(courts, 4)}, 1fr)` }}
        >
          {Array.from({ length: courts }, (_, i) => i + 1).map(renderCourt)}
        </div>
      )}

      {/* Unassigned match card — shared renderer */}
      {(() => {
        const renderUnassignedCard = (m: Match) => {
          return (
            <div
              key={m.id}
              draggable
              onDragStart={(e) => handleDragStart(e, m.id)}
              onDoubleClick={() => handleDoubleClick(m.id)}
              className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl px-3 py-2 text-xs cursor-grab active:cursor-grabbing hover:border-amber-300 hover:shadow-md transition-all duration-200 select-none relative ${courtPickerMatchId === m.id ? "z-40" : ""}`}
              title={t.court_drag_or_double_click}
            >
              <span className={`font-medium ${theme.textPrimary}`}>
                {renderTeam(m.team1_p1, m.team1_p2, m)}
              </span>
              <span className={`${theme.textMuted} mx-1`}>{t.common_vs}</span>
              <span className={`font-medium ${theme.textPrimary}`}>
                {renderTeam(m.team2_p1, m.team2_p2, m)}
              </span>

              {/* Court picker popup */}
              {courtPickerMatchId === m.id && (
                <div className={`absolute top-full left-0 mt-1 ${theme.cardBg} border ${theme.cardBorder} rounded-xl shadow-xl z-50 overflow-hidden`}>
                  <div className={`px-3 py-1.5 text-[10px] font-bold ${theme.textMuted} uppercase tracking-wide border-b ${theme.cardBorder}`}>
                    {t.court_choose_court}
                  </div>
                  {freeCourtsByHall ? (
                    freeCourtsByHall.map((group) => (
                      <div key={group.hallName}>
                        <div className={`px-3 py-1 text-[10px] font-semibold ${theme.textMuted} ${theme.cardBg}`}>
                          {group.hallName}
                        </div>
                        {group.courts.map((c) => {
                          const { localCourt } = getCourtHallLabel(c, hallConfig!);
                          return (
                            <button
                              key={c}
                              onClick={(e) => { e.stopPropagation(); handlePickCourt(c); }}
                              className={`w-full px-4 py-2 text-left text-xs font-medium ${theme.textPrimary} hover:${theme.selectedBg} hover:pl-5 transition-all duration-150`}
                            >
                              {t.court_field.replace("{n}", String(localCourt))}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    freeCourts.map((c) => (
                      <button
                        key={c}
                        onClick={(e) => { e.stopPropagation(); handlePickCourt(c); }}
                        className={`w-full px-4 py-2 text-left text-xs font-medium ${theme.textPrimary} hover:${theme.selectedBg} hover:pl-5 transition-all duration-150`}
                      >
                        {t.court_field.replace("{n}", String(c))}
                      </button>
                    ))
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setCourtPickerMatchId(null); }}
                    className={`w-full px-4 py-1.5 text-left text-[10px] ${theme.textMuted} border-t ${theme.cardBorder} hover:opacity-80`}
                  >
                    {t.common_cancel}
                  </button>
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            {/* Current-round unassigned queue */}
            {unassigned.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  {t.court_waiting.replace("{count}", String(unassigned.length))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {unassigned.map(renderUnassignedCard)}
                </div>
              </div>
            )}

            {/* Future rounds (early draw) */}
            {futureRoundQueues?.map(({ round, matches: futureMatches }) => {
              const pending = futureMatches.filter((m) => !m.court && m.status !== "completed");
              if (pending.length === 0) return null;
              return (
                <div key={round.id} className="mt-3">
                  <div className={`text-[11px] font-medium uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>
                    {t.court_next_round_separator.replace("{n}", String(round.round_number))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {pending.map(renderUnassignedCard)}
                  </div>
                </div>
              );
            })}
          </>
        );
      })()}
    </div>
  );
}
