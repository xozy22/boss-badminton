import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPlayers,
  createTournament,
  addPlayerToTournament,
} from "../lib/db";
import type { Player, TournamentMode, TournamentFormat } from "../lib/types";
import { MODE_LABELS, FORMAT_LABELS } from "../lib/types";

const VALID_FORMATS: Record<TournamentMode, TournamentFormat[]> = {
  singles: ["round_robin", "elimination"],
  doubles: ["round_robin", "elimination", "random_doubles"],
  mixed: ["round_robin", "elimination", "random_doubles"],
};

type GenderFilter = "all" | "m" | "f";

export default function TournamentCreate() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(
    new Set()
  );

  const [name, setName] = useState("");
  const [mode, setMode] = useState<TournamentMode>("doubles");
  const [format, setFormat] = useState<TournamentFormat>("random_doubles");
  const [setsToWin, setSetsToWin] = useState(2);
  const [pointsPerSet, setPointsPerSet] = useState(21);
  const [courts, setCourts] = useState(1);
  const [useSeeding, setUseSeeding] = useState(false);
  const [seedOrder, setSeedOrder] = useState<number[]>([]); // player IDs in seed order

  // Filter state
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");

  useEffect(() => {
    getPlayers().then(setPlayers);
  }, []);

  useEffect(() => {
    if (!VALID_FORMATS[mode].includes(format)) {
      setFormat(VALID_FORMATS[mode][0]);
    }
  }, [mode]);

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (genderFilter !== "all" && p.gender !== genderFilter) return false;
      if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [players, search, genderFilter]);

  const selectAllFiltered = () => {
    const newIds: number[] = [];
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      for (const p of filteredPlayers) {
        if (!next.has(p.id)) newIds.push(p.id);
        next.add(p.id);
      }
      return next;
    });
    if (newIds.length > 0) {
      setSeedOrder((s) => [...s, ...newIds]);
    }
  };

  const selectNoneFiltered = () => {
    const removedIds = new Set(filteredPlayers.map((p) => p.id));
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      for (const p of filteredPlayers) next.delete(p.id);
      return next;
    });
    setSeedOrder((s) => s.filter((pid) => !removedIds.has(pid)));
  };

  const selectedCount = selectedPlayerIds.size;
  const filteredSelectedCount = filteredPlayers.filter((p) =>
    selectedPlayerIds.has(p.id)
  ).length;

  const handleCreate = async () => {
    if (!name.trim() || selectedPlayerIds.size < 2) return;

    const id = await createTournament(
      name.trim(),
      mode,
      format,
      setsToWin,
      pointsPerSet,
      courts
    );

    for (const pid of selectedPlayerIds) {
      await addPlayerToTournament(id, pid);
    }

    // Pass seed order via navigation state if seeding is enabled
    const navState = useSeeding && format === "elimination" && seedOrder.length > 0
      ? { seeds: seedOrder.filter((pid) => selectedPlayerIds.has(pid)) }
      : undefined;

    navigate(`/tournaments/${id}`, { state: navState });
  };

  const moveSeed = (idx: number, direction: -1 | 1) => {
    const filtered = seedOrder.filter((pid) => selectedPlayerIds.has(pid));
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= filtered.length) return;

    const newFiltered = [...filtered];
    [newFiltered[idx], newFiltered[newIdx]] = [newFiltered[newIdx], newFiltered[idx]];

    // Rebuild full seedOrder: keep unselected in place, replace selected
    const result = [...newFiltered];
    setSeedOrder(result);
  };

  // Keep seedOrder in sync when players are added/removed
  const togglePlayer = (id: number) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Remove from seed order
        setSeedOrder((s) => s.filter((pid) => pid !== id));
      } else {
        next.add(id);
        // Add to end of seed order
        setSeedOrder((s) => [...s, id]);
      }
      return next;
    });
  };

  const minPlayers = mode === "singles" ? 2 : 4;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Neues Turnier erstellen
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Konfiguriere dein Turnier und waehle die Teilnehmer.
        </p>
      </div>

      <div className="space-y-5">
        {/* Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">
            Grundeinstellungen
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Turniername
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                placeholder="z.B. Vereinsturnier Fruehling 2026"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  Modus
                </label>
                <select
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value as TournamentMode)
                  }
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                >
                  {Object.entries(MODE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) =>
                    setFormat(e.target.value as TournamentFormat)
                  }
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                >
                  {VALID_FORMATS[mode].map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  Gewinnsaetze (Best of {setsToWin * 2 - 1})
                </label>
                <select
                  value={setsToWin}
                  onChange={(e) => setSetsToWin(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                >
                  <option value={1}>1 Satz (Best of 1)</option>
                  <option value={2}>2 Saetze (Best of 3)</option>
                  <option value={3}>3 Saetze (Best of 5)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  Punkte pro Satz
                </label>
                <input
                  type="number"
                  value={pointsPerSet}
                  onChange={(e) => setPointsPerSet(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  Spielfelder
                </label>
                <select
                  value={courts}
                  onChange={(e) => setCourts(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "Feld" : "Felder"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Player Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-gray-800">
              Spieler auswaehlen{" "}
              <span className="text-emerald-600 font-normal">
                ({selectedCount} ausgewaehlt)
              </span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={selectAllFiltered}
                className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
              >
                {genderFilter !== "all" || search ? "Gefilterte" : "Alle"}
              </button>
              <button
                onClick={selectNoneFiltered}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                {genderFilter !== "all" || search ? "Gefilterte abw." : "Keine"}
              </button>
            </div>
          </div>

          {/* Search + Filter */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Spieler suchen..."
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                🔍
              </span>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
              {([
                { value: "all", label: "Alle" },
                { value: "m", label: "Herren" },
                { value: "f", label: "Damen" },
              ] as { value: GenderFilter; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGenderFilter(opt.value)}
                  className={`px-3 py-2 transition-colors font-medium ${
                    genderFilter === opt.value
                      ? "bg-emerald-600 text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info bar */}
          {(genderFilter !== "all" || search) && (
            <div className="text-xs text-gray-400 mb-2">
              {filteredPlayers.length} von {players.length} Spielern angezeigt
              {filteredSelectedCount > 0 && (
                <span className="text-emerald-600 ml-1">
                  ({filteredSelectedCount} davon ausgewaehlt)
                </span>
              )}
            </div>
          )}

          {/* Player List */}
          {players.length === 0 ? (
            <p className="text-gray-400 text-sm py-4">
              Noch keine Spieler vorhanden. Bitte erst Spieler anlegen.
            </p>
          ) : filteredPlayers.length === 0 ? (
            <p className="text-gray-400 text-sm py-4">
              Keine Spieler fuer diesen Filter gefunden.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100">
              {filteredPlayers.map((p, i) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-all duration-150 ${
                    i > 0 ? "border-t border-gray-50" : ""
                  } ${
                    selectedPlayerIds.has(p.id)
                      ? "bg-emerald-50/70"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPlayerIds.has(p.id)}
                    onChange={() => togglePlayer(p.id)}
                    className="rounded accent-emerald-600 shrink-0"
                  />
                  <span className="font-medium text-gray-900 flex-1">{p.name}</span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      p.gender === "m"
                        ? "bg-blue-50 text-blue-500"
                        : "bg-pink-50 text-pink-500"
                    }`}
                  >
                    {p.gender === "m" ? "Herr" : "Dame"}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Seeding Section - only for elimination */}
        {format === "elimination" && selectedPlayerIds.size >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">
                🎯 Setzliste (optional)
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSeeding}
                  onChange={(e) => {
                    setUseSeeding(e.target.checked);
                    if (e.target.checked && seedOrder.length === 0) {
                      // Initialize seed order with selected players
                      setSeedOrder(
                        players
                          .filter((p) => selectedPlayerIds.has(p.id))
                          .map((p) => p.id)
                      );
                    }
                  }}
                  className="rounded accent-emerald-600"
                />
                <span className="text-sm text-gray-600">Seeding aktivieren</span>
              </label>
            </div>

            {useSeeding && (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  Ordne die Spieler nach Staerke (Platz 1 = staerkster Spieler).
                  Die besten Spieler treffen erst in spaeteren Runden aufeinander.
                </p>
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  {seedOrder
                    .filter((pid) => selectedPlayerIds.has(pid))
                    .map((pid, idx) => {
                      const p = players.find((pl) => pl.id === pid);
                      if (!p) return null;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                            idx > 0 ? "border-t border-gray-50" : ""
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? "bg-amber-100 text-amber-700"
                              : idx === 1
                              ? "bg-gray-200 text-gray-600"
                              : idx === 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-500"
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-medium text-gray-900 flex-1">
                            {p.name}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              p.gender === "m"
                                ? "bg-blue-50 text-blue-500"
                                : "bg-pink-50 text-pink-500"
                            }`}
                          >
                            {p.gender === "m" ? "H" : "D"}
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveSeed(idx, -1)}
                              disabled={idx === 0}
                              className="text-gray-400 hover:text-emerald-600 disabled:opacity-20 disabled:cursor-default text-xs leading-none"
                              title="Nach oben"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveSeed(idx, 1)}
                              disabled={idx === seedOrder.filter((id) => selectedPlayerIds.has(id)).length - 1}
                              className="text-gray-400 hover:text-emerald-600 disabled:opacity-20 disabled:cursor-default text-xs leading-none"
                              title="Nach unten"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={!name.trim() || selectedPlayerIds.size < minPlayers}
          className="w-full bg-emerald-600 text-white px-5 py-3.5 rounded-2xl hover:bg-emerald-700 shadow-sm hover:shadow-lg transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none font-semibold text-base"
        >
          🏆 Turnier erstellen
          {selectedPlayerIds.size < minPlayers && (
            <span className="text-sm font-normal ml-2 opacity-70">
              (mind. {minPlayers} Spieler)
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
