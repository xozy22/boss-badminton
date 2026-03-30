import type { ThemeColors } from "../../lib/theme";
import type {
  Tournament,
  Player,
  StandingEntry,
} from "../../lib/types";

interface RanglisteTabProps {
  tournament: Tournament;
  players: Player[];
  standings: StandingEntry[];
  theme: ThemeColors;
}

export default function RanglisteTab({
  tournament: _tournament,
  players: _players,
  standings,
  theme,
}: RanglisteTabProps) {
  const rankMedal = (i: number) => {
    if (i === 0) return "\u{1F947}";
    if (i === 1) return "\u{1F948}";
    if (i === 2) return "\u{1F949}";
    return `${i + 1}`;
  };

  return (
    <div>
      {/* Normal Standings */}
      <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
        <div className={`px-5 py-3 border-b ${theme.cardBorder} ${theme.headerGradient}`}>
          <span className={`font-semibold text-sm ${theme.standingsHeaderText}`}>
            {"\u{1F4CA}"} Rangliste
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className={`border-b ${theme.cardBorder}`}>
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
                className={`border-b ${theme.cardBorder} last:border-0 ${
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
                  className={`px-3 py-6 text-center ${theme.textMuted}`}
                >
                  Noch keine Ergebnisse
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
