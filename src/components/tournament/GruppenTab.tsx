import { useState } from "react";
import type { ThemeColors } from "../../lib/theme";
import type {
  Tournament,
  Player,
  Match,
  GameSet,
} from "../../lib/types";
import {
  calculateStandings,
  calculateTeamStandings,
} from "../../lib/scoring";
import { playerDisplayName } from "../../lib/types";
import { useT } from "../../lib/I18nContext";

interface GruppenTabProps {
  tournament: Tournament;
  players: Player[];
  theme: ThemeColors;
  getGroupData: (groupNum: number) => {
    gMatches: Match[];
    gSets: Map<number, GameSet[]>;
    pIds: Set<number>;
  };
}

export default function GruppenTab({
  tournament,
  players,
  theme,
  getGroupData,
}: GruppenTabProps) {
  const { t } = useT();
  const numGroups = tournament.num_groups || 2;
  const [activeGroup, setActiveGroup] = useState<number | "all">("all");

  const groupNums = Array.from({ length: numGroups }, (_, g) => g + 1);
  const visibleGroups = activeGroup === "all" ? groupNums : [activeGroup];

  const renderGroup = (groupNum: number) => {
    const { gMatches, gSets, pIds } = getGroupData(groupNum);
    const gPlayers = players.filter((p) => pIds.has(p.id));
    const qualifyCount = tournament.qualify_per_group || 2;
    const isDoublesGroup = tournament.mode !== "singles";

    if (isDoublesGroup) {
      const teamStandings = calculateTeamStandings(gPlayers, gMatches, gSets);
      return (
        <div key={groupNum} className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
          <div className={`px-5 py-2.5 border-b ${theme.cardBorder} ${theme.headerGradient}`}>
            <span className={`font-semibold text-sm ${theme.standingsHeaderText}`}>
              {t.groups_group.replace("{n}", String(groupNum))}
            </span>
            <span className={`text-xs ${theme.textMuted} ml-2`}>
              {t.groups_teams_count.replace("{count}", String(teamStandings.length)).replace("{qualify}", String(qualifyCount))}
            </span>
          </div>
          <table className="w-full text-xs table-fixed">
            <colgroup>
              <col className="w-12" />
              <col />
              <col className="w-20" />
              <col className="w-20" />
              <col className="w-20" />
            </colgroup>
            <thead>
              <tr className={`border-b ${theme.cardBorder}`}>
                <th className={`px-3 py-2 text-left ${theme.textSecondary} font-medium`}>#</th>
                <th className={`px-3 py-2 text-left ${theme.textSecondary} font-medium`}>{t.groups_team}</th>
                <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>{t.common_wins_abbr}</th>
                <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>{t.common_losses_abbr}</th>
                <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>{t.common_points_abbr}</th>
              </tr>
            </thead>
            <tbody>
              {teamStandings.map((ts, i) => (
                <tr
                  key={ts.teamKey}
                  className={`border-b ${theme.cardBorder} last:border-0 ${
                    i < qualifyCount ? `${theme.selectedBg}` : ""
                  }`}
                >
                  <td className={`px-3 py-2 ${theme.textMuted} font-mono`}>{i + 1}</td>
                  <td className={`px-3 py-2 font-medium ${theme.textPrimary} truncate`}>
                    {playerDisplayName(ts.player1)} / {playerDisplayName(ts.player2)}
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

    const gStandings = calculateStandings(gPlayers, gMatches, gSets);
    return (
      <div key={groupNum} className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
        <div className={`px-5 py-2.5 border-b ${theme.cardBorder} ${theme.headerGradient}`}>
          <span className={`font-semibold text-sm ${theme.standingsHeaderText}`}>
            {t.groups_group.replace("{n}", String(groupNum))}
          </span>
          <span className={`text-xs ${theme.textMuted} ml-2`}>
            {t.groups_players_count.replace("{count}", String(gPlayers.length)).replace("{qualify}", String(qualifyCount))}
          </span>
        </div>
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className={`border-b ${theme.cardBorder}`}>
              <th className={`px-3 py-2 text-left ${theme.textSecondary} font-medium`}>#</th>
              <th className={`px-3 py-2 text-left ${theme.textSecondary} font-medium`}>{t.groups_player}</th>
              <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>{t.common_wins_abbr}</th>
              <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>{t.common_losses_abbr}</th>
              <th className={`px-3 py-2 text-center ${theme.textSecondary} font-medium`}>{t.common_points_abbr}</th>
            </tr>
          </thead>
          <tbody>
            {gStandings.map((s, i) => (
              <tr
                key={s.player.id}
                className={`border-b ${theme.cardBorder} last:border-0 ${
                  i < qualifyCount ? `${theme.selectedBg}` : ""
                }`}
              >
                <td className={`px-3 py-2 ${theme.textMuted} font-mono`}>{i + 1}</td>
                <td className={`px-3 py-2 font-medium ${theme.textPrimary} truncate`}>
                  {playerDisplayName(s.player)}
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
  };

  return (
    <div>
      {/* Group Selector */}
      {numGroups > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setActiveGroup("all")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeGroup === "all"
                ? `${theme.roundActiveBg} ${theme.roundActiveText} shadow-md`
                : `${theme.cardBg} ${theme.textSecondary} hover:opacity-80 border ${theme.cardBorder} ${theme.cardHoverBorder}`
            }`}
          >
            {t.groups_all}
          </button>
          {groupNums.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeGroup === g
                  ? `${theme.roundActiveBg} ${theme.roundActiveText} shadow-md`
                  : `${theme.cardBg} ${theme.textSecondary} hover:opacity-80 border ${theme.cardBorder} ${theme.cardHoverBorder}`
              }`}
            >
              {t.groups_group.replace("{n}", String(g))}
            </button>
          ))}
        </div>
      )}

      {/* Group Tables */}
      <div className="space-y-4">
        {visibleGroups.map(renderGroup)}
      </div>
    </div>
  );
}
