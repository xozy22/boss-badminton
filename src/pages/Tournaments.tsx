import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTournaments, deleteTournament, updateTournamentStatus } from "../lib/db";
import type { Tournament } from "../lib/types";
import { MODE_LABELS, FORMAT_LABELS, STATUS_LABELS } from "../lib/types";
import { useTheme } from "../lib/ThemeContext";
import { useT } from "../lib/I18nContext";

export default function Tournaments() {
  const { theme } = useTheme();
  const { t } = useT();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const load = () => getTournaments().then(setTournaments);

  useEffect(() => {
    load();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteConfirmText !== t.tournaments_delete_confirm_word) return;
    await deleteTournament(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteConfirmText("");
    load();
  };

  const handleArchive = async (id: number) => {
    await updateTournamentStatus(id, "archived");
    load();
  };

  const handleUnarchive = async (id: number) => {
    await updateTournamentStatus(id, "completed");
    load();
  };

  const activeTournaments = tournaments.filter(
    (tr) => tr.status !== "archived"
  );
  const archivedTournaments = tournaments.filter(
    (tr) => tr.status === "archived"
  );

  const statusStyle = (status: string) => {
    switch (status) {
      case "active":
        return `${theme.activeBadgeBg} ${theme.activeBadgeText}`;
      case "completed":
        return `${theme.cardBg} ${theme.textMuted} border ${theme.cardBorder}`;
      case "archived":
        return "bg-violet-100 text-violet-600";
      default:
        return "bg-amber-100 text-amber-700";
    }
  };

  const renderTournamentCard = (tr: Tournament, isArchived: boolean) => (
    <div
      key={tr.id}
      className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5 flex justify-between items-center hover:shadow-md transition-all duration-200 ${
        isArchived ? "opacity-70 hover:opacity-100" : theme.cardHoverBorder
      }`}
    >
      <Link to={`/tournaments/${tr.id}`} className="flex-1">
        <div className={`font-semibold ${theme.textPrimary}`}>{tr.name}</div>
        <div className={`text-sm ${theme.textSecondary} mt-0.5`}>
          {MODE_LABELS[tr.mode]} &middot; {FORMAT_LABELS[tr.format]} &middot;{" "}
          {t.tournaments_best_of.replace("{count}", String(tr.sets_to_win * 2 - 1))} ({t.tournaments_up_to.replace("{points}", String(tr.points_per_set))})
        </div>
      </Link>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-medium px-3 py-1 rounded-full ${statusStyle(tr.status)}`}
        >
          {STATUS_LABELS[tr.status]}
        </span>
        {tr.status === "completed" && (
          <button
            onClick={() => handleArchive(tr.id)}
            className="text-gray-400 hover:text-violet-600 text-sm transition-colors"
            title={t.tournaments_archive_button}
          >
            📦 {t.tournaments_archive_button}
          </button>
        )}
        {tr.status === "archived" && (
          <button
            onClick={() => handleUnarchive(tr.id)}
            className="text-gray-400 hover:text-emerald-600 text-sm transition-colors"
            title={t.tournaments_unarchive}
          >
            ↩ {t.tournaments_unarchive}
          </button>
        )}
        <button
          onClick={() => { setDeleteTarget(tr); setDeleteConfirmText(""); }}
          className="text-gray-400 hover:text-rose-600 text-sm transition-colors"
          title={t.tournaments_delete_title}
        >
          🗑
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`text-2xl font-extrabold ${theme.textPrimary} tracking-tight`}>
            {t.tournaments_title}
          </h1>
          <p className={`text-sm ${theme.textSecondary} mt-0.5`}>
            {t.tournaments_active_count.replace("{count}", String(activeTournaments.length))}
            {archivedTournaments.length > 0 && (
              <span> &middot; {t.tournaments_archived_count.replace("{count}", String(archivedTournaments.length))}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {archivedTournaments.length > 0 && (
            <button
              onClick={() => setShowArchive(!showArchive)}
              className={`border px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                showArchive
                  ? "bg-violet-50 border-violet-200 text-violet-700"
                  : `${theme.cardBg} ${theme.cardBorder} ${theme.textSecondary} hover:border-violet-200`
              }`}
            >
              📦 {t.tournaments_archive} ({archivedTournaments.length})
            </button>
          )}
          <Link
            to="/tournaments/new"
            className={`${theme.primaryBg} text-white px-5 py-2.5 rounded-xl ${theme.primaryHoverBg} shadow-sm hover:shadow-md transition-all text-sm font-medium`}
          >
            🏆 {t.tournaments_new}
          </Link>
        </div>
      </div>

      {/* Active Tournaments */}
      {activeTournaments.length === 0 && !showArchive ? (
        <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-12 text-center`}>
          <div className="text-4xl mb-3">🏸</div>
          <div className="text-gray-400">{t.tournaments_none_yet}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTournaments.map((tr) => renderTournamentCard(tr, false))}
        </div>
      )}

      {/* Archive Section */}
      {showArchive && archivedTournaments.length > 0 && (
        <div className="mt-8">
          <h2 className={`text-lg font-bold ${theme.textPrimary} mb-3 flex items-center gap-2`}>
            📦 {t.tournaments_archive}
          </h2>
          <div className="space-y-3">
            {archivedTournaments.map((tr) => renderTournamentCard(tr, true))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${theme.cardBg} rounded-2xl shadow-2xl w-full max-w-md p-6 border ${theme.cardBorder}`}>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className={`text-lg font-bold ${theme.textPrimary}`}>
                {t.tournaments_delete_title}
              </h3>
              <p className={`text-sm ${theme.textSecondary} mt-2`}>
                <span className={`font-semibold ${theme.textPrimary}`}>"{deleteTarget.name}"</span>{" "}
                {t.tournaments_delete_message.replace(`"{name}"`, "").trim()}
              </p>
            </div>
            <div className="mb-5">
              <label className={`block text-xs font-medium ${theme.textSecondary} mb-1.5`}>
                {t.tournaments_delete_confirm_label.replace("{word}", "")} <span className="font-bold text-rose-600">{t.tournaments_delete_confirm_word}</span>
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-center font-mono tracking-widest`}
                placeholder={t.tournaments_delete_confirm_word}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
                className={`flex-1 ${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium`}
              >
                {t.common_cancel}
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== t.tournaments_delete_confirm_word}
                className="flex-1 bg-rose-600 text-white px-4 py-2.5 rounded-xl hover:bg-rose-700 transition-all text-sm font-medium disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {t.common_delete_permanently}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
