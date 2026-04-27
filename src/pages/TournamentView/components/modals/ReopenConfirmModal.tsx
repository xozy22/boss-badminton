// src/pages/TournamentView/components/modals/ReopenConfirmModal.tsx
//
// Simple yes/no confirm before re-activating a completed/archived
// tournament. Status flips back to "active" so the TD can edit results,
// add rounds, etc. Cosmetic safety prompt — no destructive side effects.

import type { ThemeColors } from "../../../../lib/theme";
import { useT } from "../../../../lib/I18nContext";

export default function ReopenConfirmModal({
  open,
  theme,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  theme: ThemeColors;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useT();
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${theme.cardBg} rounded-2xl shadow-2xl p-6 max-w-sm border ${theme.cardBorder} text-center`}>
        <div className="text-4xl mb-3">🔓</div>
        <h3 className={`font-bold text-lg ${theme.textPrimary} mb-2`}>{t.tournament_view_reopen}</h3>
        <p className={`text-sm ${theme.textSecondary} mb-5`}>{t.tournament_view_reopen_confirm}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded-xl text-sm ${theme.textSecondary} border ${theme.cardBorder} hover:opacity-80`}
          >
            {t.common_cancel}
          </button>
          <button
            onClick={onConfirm}
            className={`${theme.primaryBg} text-white px-4 py-2 rounded-xl text-sm font-medium ${theme.primaryHoverBg}`}
          >
            {t.tournament_view_reopen}
          </button>
        </div>
      </div>
    </div>
  );
}
