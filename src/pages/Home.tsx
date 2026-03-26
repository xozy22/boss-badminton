import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTournaments, getPlayers } from "../lib/db";
import type { Tournament, Player } from "../lib/types";
import { STATUS_LABELS, MODE_LABELS, FORMAT_LABELS } from "../lib/types";

export default function Home() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    getTournaments().then(setTournaments);
    getPlayers().then(setPlayers);
  }, []);

  const activeTournaments = tournaments.filter((t) => t.status === "active");
  const visibleTournaments = tournaments.filter((t) => t.status !== "archived");

  return (
    <div>
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          Willkommen 🏸
        </h1>
        <p className="text-gray-500 mt-1">
          Dein Badminton-Turnierplaner fuer den Verein.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl shadow-lg p-5 text-white">
          <div className="text-4xl font-extrabold">{players.length}</div>
          <div className="text-emerald-100 text-sm font-medium mt-1">
            Spieler registriert
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl shadow-lg p-5 text-white">
          <div className="text-4xl font-extrabold">
            {activeTournaments.length}
          </div>
          <div className="text-amber-100 text-sm font-medium mt-1">
            Laufende Turniere
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-violet-700 rounded-2xl shadow-lg p-5 text-white">
          <div className="text-4xl font-extrabold">{visibleTournaments.length}</div>
          <div className="text-violet-100 text-sm font-medium mt-1">
            Turniere gesamt
          </div>
        </div>
      </div>

      {/* Active Tournaments */}
      {activeTournaments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            Laufende Turniere
          </h2>
          <div className="space-y-2">
            {activeTournaments.map((t) => (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                className="block bg-white rounded-xl shadow-sm border border-emerald-100 p-4 hover:shadow-md hover:border-emerald-300 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {t.name}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {MODE_LABELS[t.mode]} &middot;{" "}
                      {FORMAT_LABELS[t.format]}
                    </div>
                  </div>
                  <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                    {STATUS_LABELS[t.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link
          to="/players"
          className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl hover:border-emerald-300 hover:shadow-sm transition-all duration-200 text-sm font-medium"
        >
          👥 Spieler verwalten
        </Link>
        <Link
          to="/tournaments/new"
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all duration-200 text-sm font-medium"
        >
          🏆 Neues Turnier
        </Link>
      </div>
    </div>
  );
}
