import type { ThemeColors } from "../../lib/theme";
import type { Tournament } from "../../lib/types";

interface DeleteTournamentModalProps {
  tournament: Tournament;
  theme: ThemeColors;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteTournamentModal({
  tournament,
  theme,
  onClose,
  onConfirm,
}: DeleteTournamentModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${theme.cardBg} rounded-2xl shadow-2xl w-full max-w-md p-6 border ${theme.cardBorder}`}>
        <div className="text-center mb-5">
          <div className="text-4xl mb-3">🗑️</div>
          <h3 className={`text-lg font-bold ${theme.textPrimary}`}>
            Turnier loeschen?
          </h3>
          <p className={`text-sm ${theme.textSecondary} mt-2`}>
            <span className={`font-semibold ${theme.textPrimary}`}>{tournament.name}</span> wird
            unwiderruflich geloescht.
          </p>
          <p className={`text-xs ${theme.textMuted} mt-2`}>
            Alle Runden, Spiele und Ergebnisse werden entfernt.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 ${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium`}
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-rose-600 text-white px-4 py-2.5 rounded-xl hover:bg-rose-700 shadow-sm transition-all text-sm font-medium"
          >
            Endgueltig loeschen
          </button>
        </div>
      </div>
    </div>
  );
}
