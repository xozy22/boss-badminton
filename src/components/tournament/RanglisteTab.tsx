import React from "react";
import type { ThemeColors } from "../../lib/theme";
import type {
  Tournament,
  Player,
  Round,
  Match,
  GameSet,
  StandingEntry,
} from "../../lib/types";
import {
  calculateStandings,
  calculateTeamStandings,
} from "../../lib/scoring";

interface RanglisteTabProps {
  tournament: Tournament;
  players: Player[];
  rounds: Round[];
  matchesByRound: Map<number, Match[]>;
  setsByMatch: Map<number, GameSet[]>;
  standings: StandingEntry[];
  theme: ThemeColors;
  isGroupKo: boolean;
  groupRounds: Round[];
  koRounds: Round[];
  getGroupData: (groupNum: number) => {
    gMatches: Match[];
    gSets: Map<number, GameSet[]>;
    pIds: Set<number>;
  };
}

export default function RanglisteTab({
  tournament,
  players,
  rounds,
  matchesByRound,
  setsByMatch,
  standings,
  theme,
  isGroupKo,
  groupRounds,
  koRounds,
  getGroupData,
}: RanglisteTabProps) {
  const rankMedal = (i: number) => {
    if (i === 0) return "\u{1F947}";
    if (i === 1) return "\u{1F948}";
    if (i === 2) return "\u{1F949}";
    return `${i + 1}`;
  };

  return (
    <div>
      {/* Standings */}
      {isGroupKo && groupRounds.length > 0 ? (
        /* Group Standings */
        <>
          {Array.from({ length: tournament.num_groups || 2 }, (_, g) => g + 1).map((groupNum) => {
            const { gMatches, gSets, pIds } = getGroupData(groupNum);
            const gPlayers = players.filter((p) => pIds.has(p.id));
            const qualifyCount = tournament.qualify_per_group || 2;
            const isDoublesGroup = tournament.mode !== "singles";

            if (isDoublesGroup) {
              // Team standings
              const teamStandings = calculateTeamStandings(gPlayers, gMatches, gSets);
              return (
                <div key={groupNum} className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
                  <div className={`px-5 py-2.5 border-b ${theme.cardBorder} ${theme.headerGradient}`}>
                    <span className={`font-semibold text-sm ${theme.standingsHeaderText}`}>
                      Gruppe {groupNum}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      ({teamStandings.length} Teams, Top {qualifyCount})
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className={`px-3 py-2 text-left ${theme.textSecondary} font-medium`}>#</th>
                        <th className={`px-3 py-2 text-left ${theme.textSecondary} font-medium`}>Team</th>
                        <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>S</th>
                        <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>N</th>
                        <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>Pkt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamStandings.map((ts, i) => (
                        <tr
                          key={ts.teamKey}
                          className={`border-b border-gray-50 last:border-0 ${
                            i < qualifyCount ? `${theme.selectedBg}` : ""
                          }`}
                        >
                          <td className={`px-3 py-2 ${theme.textMuted} font-mono`}>{i + 1}</td>
                          <td className={`px-3 py-2 font-medium ${theme.textPrimary}`}>
                            {ts.player1.name} / {ts.player2.name}
                            {i < qualifyCount && (
                              <span className="ml-1 text-[9px] text-emerald-500 font-bold">Q</span>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-center font-bold ${theme.activeBadgeText}`}>{ts.wins}</td>
                          <td className="px-3 py-2 text-center text-rose-400">{ts.losses}</td>
                          <td className={`px-3 py-2 text-center font-mono ${theme.textSecondary}`}>
                            {ts.pointsWon}:{ts.pointsLost}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            // Einzel standings
            const gStandings = calculateStandings(gPlayers, gMatches, gSets);
            return (
              <div key={groupNum} className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
                <div className={`px-5 py-2.5 border-b ${theme.cardBorder} ${theme.headerGradient}`}>
                  <span className={`font-semibold text-sm ${theme.standingsHeaderText}`}>
                    Gruppe {groupNum}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    ({gPlayers.length} Spieler, Top {qualifyCount})
                  </span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className={`px-3 py-2 text-left ${theme.textSecondary} font-medium`}>#</th>
                      <th className={`px-3 py-2 text-left ${theme.textSecondary} font-medium`}>Spieler</th>
                      <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>S</th>
                      <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>N</th>
                      <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>Pkt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gStandings.map((s, i) => (
                      <tr
                        key={s.player.id}
                        className={`border-b border-gray-50 last:border-0 ${
                          i < qualifyCount ? `${theme.selectedBg}` : ""
                        }`}
                      >
                        <td className={`px-3 py-2 ${theme.textMuted} font-mono`}>{i + 1}</td>
                        <td className={`px-3 py-2 font-medium ${theme.textPrimary}`}>
                          {s.player.name}
                          {i < qualifyCount && (
                            <span className="ml-1 text-[9px] text-emerald-500 font-bold">Q</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 text-center font-bold ${theme.activeBadgeText}`}>{s.wins}</td>
                        <td className="px-3 py-2 text-center text-rose-400">{s.losses}</td>
                        <td className={`px-3 py-2 text-center font-mono ${theme.textSecondary}`}>
                          {s.pointsWon}:{s.pointsLost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {/* Overall KO Standings */}
          {koRounds.length > 0 && (
            <div className={`${theme.cardBg} rounded-2xl shadow-sm border border-violet-500/20 overflow-hidden`}>
              <div className="px-5 py-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-transparent">
                <span className="font-semibold text-sm text-violet-800">
                  {"\u{1F3C6}"} KO-Phase
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className={`px-3 py-2.5 text-left ${theme.textSecondary} font-medium`}>#</th>
                    <th className={`px-3 py-2.5 text-left ${theme.textSecondary} font-medium`}>Spieler</th>
                    <th className={`px-3 py-2.5 text-center ${theme.textSecondary} font-medium`}>S</th>
                    <th className={`px-3 py-2.5 text-center ${theme.textSecondary} font-medium`}>N</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.player.id} className="border-b border-gray-50 last:border-0">
                      <td className={`px-3 py-2.5 text-center text-sm ${theme.textSecondary}`}>{rankMedal(i)}</td>
                      <td className={`px-3 py-2.5 font-medium ${theme.textPrimary}`}>{s.player.name}</td>
                      <td className={`px-3 py-2.5 text-center font-bold ${theme.activeBadgeText}`}>{s.wins}</td>
                      <td className="px-3 py-2.5 text-center text-rose-400">{s.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Normal Standings */
        <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
          <div className={`px-5 py-3 border-b ${theme.cardBorder} ${theme.headerGradient}`}>
            <span className={`font-semibold text-sm ${theme.standingsHeaderText}`}>
              {"\u{1F4CA}"} Rangliste
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className={`px-3 py-2.5 text-left ${theme.textSecondary} font-medium`}>#</th>
                <th className={`px-3 py-2.5 text-left ${theme.textSecondary} font-medium`}>Spieler</th>
                <th className={`px-3 py-2.5 text-center ${theme.textSecondary} font-medium`}>S</th>
                <th className={`px-3 py-2.5 text-center ${theme.textSecondary} font-medium`}>N</th>
                <th className={`px-3 py-2.5 text-center ${theme.textSecondary} font-medium`}>Saetze</th>
                <th className={`px-3 py-2.5 text-center ${theme.textSecondary} font-medium`}>Punkte</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr
                  key={s.player.id}
                  className={`border-b border-gray-50 last:border-0 ${
                    i < 3 && s.wins > 0 ? "bg-amber-500/10" : ""
                  }`}
                >
                  <td className={`px-3 py-2.5 text-center text-sm ${theme.textSecondary}`}>
                    {rankMedal(i)}
                  </td>
                  <td className={`px-3 py-2.5 font-medium ${theme.textPrimary}`}>
                    {s.player.name}
                  </td>
                  <td className={`px-3 py-2.5 text-center font-bold ${theme.activeBadgeText}`}>
                    {s.wins}
                  </td>
                  <td className="px-3 py-2.5 text-center text-rose-400">
                    {s.losses}
                  </td>
                  <td className={`px-3 py-2.5 text-center font-mono ${theme.textSecondary}`}>
                    {s.setsWon}:{s.setsLost}
                  </td>
                  <td className={`px-3 py-2.5 text-center font-mono ${theme.textSecondary}`}>
                    {s.pointsWon}:{s.pointsLost}
                  </td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-gray-400"
                  >
                    Noch keine Ergebnisse
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
