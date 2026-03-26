import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTournaments, deleteTournament, updateTournamentStatus } from "../lib/db";
import type { Tournament } from "../lib/types";
import { MODE_LABELS, FORMAT_LABELS, STATUS_LABELS } from "../lib/types";

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const load = () => getTournaments().then(setTournaments);

  useEffect(() => {
    load();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteConfirmText !== "LOESCHEN") return;
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
    (t) => t.status !== "archived"
  );
  const archivedTournaments = tournaments.filter(
    (t) => t.status === "archived"
  );

  const statusStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-700";
      case "completed":
        return "bg-gray-100 text-gray-500";
      case "archived":
        return "bg-violet-100 text-violet-600";
      default:
        return "bg-amber-100 text-amber-700";
    }
  };

  const renderTournamentCard = (t: Tournament, isArchived: boolean) => (
    <div
      key={t.id}
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex justify-between items-center hover:shadow-md transition-all duration-200 ${
        isArchived ? "opacity-70 hover:opacity-100" : "hover:border-emerald-200"
      }`}
    >
      <Link to={`/tournaments/${t.id}`} className="flex-1">
        <div className="font-semibold text-gray-900">{t.name}</div>
        <div className="text-sm text-gray-500 mt-0.5">
          {MODE_LABELS[t.mode]} &middot; {FORMAT_LABELS[t.format]} &middot;
          Best of {t.sets_to_win * 2 - 1} (bis {t.points_per_set})
        </div>
      </Link>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-medium px-3 py-1 rounded-full ${statusStyle(t.status)}`}
        >
          {STATUS_LABELS[t.status]}
        </span>
        {t.status === "completed" && (
          <button
            onClick={() => handleArchive(t.id)}
            className="text-gray-400 hover:text-violet-600 text-sm transition-colors"
            title="Turnier archivieren"
          >
            📦 Archivieren
          </button>
        )}
        {t.status === "archived" && (
          <button
            onClick={() => handleUnarchive(t.id)}
            className="text-gray-400 hover:text-emerald-600 text-sm transition-colors"
            title="Aus dem Archiv wiederherstellen"
          >
            ↩ Wiederherstellen
          </button>
        )}
        <button
          onClick={() => { setDeleteTarget(t); setDeleteConfirmText(""); }}
          className="text-gray-400 hover:text-rose-600 text-sm transition-colors"
          title="Turnier loeschen"
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
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Turniere
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeTournaments.length} aktiv
            {archivedTournaments.length > 0 && (
              <span> &middot; {archivedTournaments.length} archiviert</span>
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
                  : "bg-white border-gray-200 text-gray-600 hover:border-violet-200"
              }`}
            >
              📦 Archiv ({archivedTournaments.length})
            </button>
          )}
          <Link
            to="/tournaments/new"
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all text-sm font-medium"
          >
            🏆 Neues Turnier
          </Link>
        </div>
      </div>

      {/* Active Tournaments */}
      {activeTournaments.length === 0 && !showArchive ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-3">🏸</div>
          <div className="text-gray-400">Noch keine Turniere vorhanden.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeTournaments.map((t) => renderTournamentCard(t, false))}
        </div>
      )}

      {/* Archive Section */}
      {showArchive && archivedTournaments.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
            📦 Archiv
          </h2>
          <div className="space-y-3">
            {archivedTournaments.map((t) => renderTournamentCard(t, true))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-gray-900">
                Turnier loeschen?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                <span className="font-semibold text-gray-800">"{deleteTarget.name}"</span> wird
                mit allen Runden, Spielen und Ergebnissen unwiderruflich geloescht.
              </p>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Tippe <span className="font-bold text-rose-600">LOESCHEN</span> zur Bestaetigung:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-center font-mono tracking-widest"
                placeholder="LOESCHEN"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
                className="flex-1 bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== "LOESCHEN"}
                className="flex-1 bg-rose-600 text-white px-4 py-2.5 rounded-xl hover:bg-rose-700 transition-all text-sm font-medium disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Endgueltig loeschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
