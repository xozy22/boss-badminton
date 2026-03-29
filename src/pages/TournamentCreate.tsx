import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getPlayers,
  createTournament,
  updateTournament,
  updateTeamConfig,
  addPlayerToTournament,
  removePlayerFromTournament,
  getTournament,
  getTournamentPlayers,
} from "../lib/db";
import type { Player, TournamentMode, TournamentFormat } from "../lib/types";
import { MODE_LABELS, FORMAT_LABELS } from "../lib/types";
import { formFixedDoubleTeams, formFixedMixedTeams } from "../lib/draw";
import { loadSettings } from "./Settings";
import { useTheme } from "../lib/ThemeContext";

const VALID_FORMATS: Record<TournamentMode, TournamentFormat[]> = {
  singles: ["round_robin", "elimination", "group_ko"],
  doubles: ["round_robin", "elimination", "random_doubles", "group_ko"],
  mixed: ["round_robin", "elimination", "random_doubles", "group_ko"],
};

type GenderFilter = "all" | "m" | "f";

export default function TournamentCreate() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEditMode = !!editId;
  const [editLoaded, setEditLoaded] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(
    new Set()
  );

  const generateName = (m: TournamentMode, f: TournamentFormat) => {
    const now = new Date();
    const d = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
    return `${d} - ${MODE_LABELS[m]} - ${FORMAT_LABELS[f]}`;
  };

  const [mode, setMode] = useState<TournamentMode>("doubles");
  const [format, setFormat] = useState<TournamentFormat>("random_doubles");
  const [name, setName] = useState(() => generateName("doubles", "random_doubles"));
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [setsToWin, setSetsToWin] = useState(2);
  const [pointsPerSet, setPointsPerSet] = useState(21);
  const [courts, setCourts] = useState(() => loadSettings().defaultCourts);
  const [numGroups, setNumGroups] = useState(2);
  const [qualifyPerGroup, setQualifyPerGroup] = useState(2);
  const [useEntryFee, setUseEntryFee] = useState(false);
  const [entryFeeSingle, setEntryFeeSingle] = useState<string>("5");
  const [entryFeeDouble, setEntryFeeDouble] = useState<string>("10");
  const [useSeeding, setUseSeeding] = useState(false);
  const [seedOrder, setSeedOrder] = useState<number[]>([]); // player IDs in seed order

  const [dragSeedIdx, setDragSeedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Team pairing state
  const [manualTeams, setManualTeams] = useState<[number, number][]>([]);
  const [firstPick, setFirstPick] = useState<number | null>(null);
  const [createStep, setCreateStep] = useState<"settings" | "players" | "teams" | "seeding" | "create">("settings");

  // Filter state
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");

  useEffect(() => {
    getPlayers().then(setPlayers);
  }, []);

  // Load existing tournament data in edit mode
  useEffect(() => {
    if (!isEditMode || editLoaded) return;
    const loadTournament = async () => {
      const t = await getTournament(Number(editId));
      const tp = await getTournamentPlayers(Number(editId));
      setName(t.name);
      setNameManuallyEdited(true);
      setMode(t.mode);
      setFormat(t.format);
      setSetsToWin(t.sets_to_win);
      setPointsPerSet(t.points_per_set);
      setCourts(t.courts);
      setNumGroups(t.num_groups || 2);
      setQualifyPerGroup(t.qualify_per_group || 2);
      if (t.entry_fee_single > 0 || t.entry_fee_double > 0) {
        setUseEntryFee(true);
        setEntryFeeSingle(String(t.entry_fee_single));
        setEntryFeeDouble(String(t.entry_fee_double));
      }
      setSelectedPlayerIds(new Set(tp.map((p) => p.id)));
      if (t.team_config) {
        try {
          const teams = JSON.parse(t.team_config) as [number, number][];
          setManualTeams(teams);
        } catch {}
      }
      setEditLoaded(true);
    };
    loadTournament();
  }, [isEditMode, editId, editLoaded]);

  useEffect(() => {
    if (editLoaded) return; // Don't auto-correct format during edit load
    if (!VALID_FORMATS[mode].includes(format)) {
      setFormat(VALID_FORMATS[mode][0]);
    }
  }, [mode, format, editLoaded]);

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (genderFilter !== "all" && p.gender !== genderFilter) return false;
      if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [players, search, genderFilter]);

  const selectAllFiltered = () => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      for (const p of filteredPlayers) next.add(p.id);
      return next;
    });
    setSeedOrder((s) => {
      const existing = new Set(s);
      const toAdd = filteredPlayers.filter((p) => !existing.has(p.id)).map((p) => p.id);
      return [...s, ...toAdd];
    });
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
    if (selectedPlayerIds.size < minPlayers) return;

    const finalName = name.trim() || generateName(mode, format);
    const feeSingle = useEntryFee ? (Number(entryFeeSingle) || 0) : 0;
    const feeDouble = useEntryFee ? (Number(entryFeeDouble) || 0) : 0;

    let id: number;

    if (isEditMode) {
      id = Number(editId);
      await updateTournament(
        id, finalName, mode, format, setsToWin, pointsPerSet, courts,
        format === "group_ko" ? numGroups : 0,
        format === "group_ko" ? qualifyPerGroup : 0,
        feeSingle, feeDouble
      );
      // Sync players: remove those no longer selected, add new ones
      const existingPlayers = await getTournamentPlayers(id);
      const existingIds = new Set(existingPlayers.map((p) => p.id));
      for (const ep of existingPlayers) {
        if (!selectedPlayerIds.has(ep.id)) {
          await removePlayerFromTournament(id, ep.id);
        }
      }
      for (const pid of selectedPlayerIds) {
        if (!existingIds.has(pid)) {
          await addPlayerToTournament(id, pid);
        }
      }
    } else {
      id = await createTournament(
        finalName, mode, format, setsToWin, pointsPerSet, courts,
        format === "group_ko" ? numGroups : 0,
        format === "group_ko" ? qualifyPerGroup : 0,
        feeSingle, feeDouble
      );
      for (const pid of selectedPlayerIds) {
        await addPlayerToTournament(id, pid);
      }
    }

    // Pass seed order and/or manual teams via navigation state
    const navState: Record<string, unknown> = {};
    if (useSeeding && format === "elimination" && seedOrder.length > 0) {
      navState.seeds = seedOrder.filter((pid) => selectedPlayerIds.has(pid));
    }
    if (needsTeamPairing && manualTeams.length > 0) {
      navState.teams = manualTeams;
    }

    // Persist team config
    if (needsTeamPairing && manualTeams.length > 0) {
      await updateTeamConfig(id, manualTeams);
    } else {
      await updateTeamConfig(id, null);
    }

    navigate(`/tournaments/${id}`, { state: Object.keys(navState).length > 0 ? navState : undefined });
  };

  const moveSeed = (idx: number, direction: -1 | 1) => {
    const filtered = seedOrder.filter((pid) => selectedPlayerIds.has(pid));
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= filtered.length) return;

    const newFiltered = [...filtered];
    [newFiltered[idx], newFiltered[newIdx]] = [newFiltered[newIdx], newFiltered[idx]];
    setSeedOrder(newFiltered);
  };

  const handleSeedDrop = (dropIdx: number) => {
    if (dragSeedIdx === null || dragSeedIdx === dropIdx) return;
    const filtered = seedOrder.filter((pid) => selectedPlayerIds.has(pid));
    const newArr = [...filtered];
    const [moved] = newArr.splice(dragSeedIdx, 1);
    newArr.splice(dropIdx, 0, moved);
    setSeedOrder(newArr);
    setDragSeedIdx(null);
    setDragOverIdx(null);
  };

  // Keep seedOrder in sync when players are added/removed
  const togglePlayer = (id: number) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSeedOrder((s) => s.filter((pid) => pid !== id));
      } else {
        next.add(id);
        setSeedOrder((s) => s.includes(id) ? s : [...s, id]);
      }
      return next;
    });
  };

  const minPlayers = mode === "singles" ? 2 : 4;
  const needsTeamPairing = (mode === "doubles" || mode === "mixed") && format !== "random_doubles";

  // Team pairing helpers
  const pairedIds = useMemo(() => {
    const s = new Set<number>();
    for (const [a, b] of manualTeams) { s.add(a); s.add(b); }
    return s;
  }, [manualTeams]);

  const poolPlayers = useMemo(() => {
    return players.filter((p) => selectedPlayerIds.has(p.id) && !pairedIds.has(p.id));
  }, [players, selectedPlayerIds, pairedIds]);

  const handlePoolClick = (playerId: number) => {
    if (firstPick === null) {
      setFirstPick(playerId);
    } else if (firstPick === playerId) {
      setFirstPick(null); // Deselect
    } else {
      // Mixed: validate m+f
      if (mode === "mixed") {
        const p1 = players.find((p) => p.id === firstPick);
        const p2 = players.find((p) => p.id === playerId);
        if (p1 && p2 && p1.gender === p2.gender) return; // Same gender not allowed in mixed
      }
      setManualTeams((prev) => [...prev, [firstPick, playerId]]);
      setFirstPick(null);
    }
  };

  const removeTeam = (idx: number) => {
    setManualTeams((prev) => prev.filter((_, i) => i !== idx));
  };

  const autoAssignRemaining = () => {
    const remaining = players.filter((p) => selectedPlayerIds.has(p.id) && !pairedIds.has(p.id));
    const autoTeams = mode === "mixed"
      ? formFixedMixedTeams(remaining)
      : formFixedDoubleTeams(remaining);
    setManualTeams((prev) => [...prev, ...autoTeams]);
  };

  // Remove teams with deselected players
  useEffect(() => {
    if (!editLoaded && isEditMode) return;
    setManualTeams((prev) =>
      prev.filter(([a, b]) => selectedPlayerIds.has(a) && selectedPlayerIds.has(b))
    );
  }, [selectedPlayerIds, editLoaded, isEditMode]);

  const settingsValid = name.trim().length > 0;
  const playersValid = selectedPlayerIds.size >= minPlayers;
  const teamsValid = !needsTeamPairing || (manualTeams.length > 0 && poolPlayers.length < 2);

  const showSeedingStep = useSeeding && format === "elimination";
  const seedingValid = !showSeedingStep || seedOrder.filter((pid) => selectedPlayerIds.has(pid)).length >= 2;

  const steps = [
    { key: "settings" as const, label: "Einstellungen", icon: "⚙️", valid: settingsValid },
    { key: "players" as const, label: "Spieler", icon: "👥", valid: playersValid },
    ...(needsTeamPairing ? [{ key: "teams" as const, label: "Teams", icon: "🤝", valid: teamsValid }] : []),
    ...(showSeedingStep ? [{ key: "seeding" as const, label: "Setzliste", icon: "🎯", valid: seedingValid }] : []),
    { key: "create" as const, label: "Erstellen", icon: "🏆", valid: settingsValid && playersValid && teamsValid },
  ];

  const currentStepIdx = steps.findIndex((s) => s.key === createStep);
  const nextStep = steps[currentStepIdx + 1]?.key;

  return (
    <div>
      {/* Header */}
      <div className="mb-2">
        <h1 className={`text-2xl font-extrabold ${theme.textPrimary} tracking-tight`}>
          {isEditMode ? "Turnier bearbeiten" : "Neues Turnier erstellen"}
        </h1>
      </div>

      {/* Step Tabs */}
      <div className={`flex border-b-2 ${theme.inputBorder} mb-5`}>
        {steps.map((step) => (
          <button
            key={step.key}
            onClick={() => setCreateStep(step.key)}
            className={`px-6 py-3 text-sm font-semibold transition-all relative ${
              createStep === step.key
                ? `${theme.textPrimary}`
                : `${theme.textMuted} hover:${theme.textSecondary}`
            }`}
          >
            <span className="mr-1.5">{step.icon}</span>
            {step.label}
            {step.valid && createStep !== step.key && (
              <span className="ml-1.5 text-green-500">✓</span>
            )}
            {createStep === step.key && (
              <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${theme.primaryBg} rounded-t-full`} />
            )}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {/* Step: Settings */}
        {createStep === "settings" && (
          <>
            <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5`}>
              <div className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
                    Turniername
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setNameManuallyEdited(true); }}
                      className={`flex-1 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                      placeholder="Turniername"
                    />
                    {nameManuallyEdited && (
                      <button
                        onClick={() => { setName(generateName(mode, format)); setNameManuallyEdited(false); }}
                        className={`${theme.textMuted} hover:text-emerald-600 px-3 py-2.5 rounded-xl border ${theme.inputBorder} ${theme.cardHoverBorder} transition-all text-sm`}
                        title="Vorschlag wiederherstellen"
                      >
                        ↻
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
                      Modus
                    </label>
                    <select
                      value={mode}
                      onChange={(e) => {
                        const newMode = e.target.value as TournamentMode;
                        setMode(newMode);
                        setManualTeams([]); setFirstPick(null);
                        if (!nameManuallyEdited) {
                          const newFormat = VALID_FORMATS[newMode].includes(format) ? format : VALID_FORMATS[newMode][0];
                          setName(generateName(newMode, newFormat));
                        }
                      }}
                      className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                    >
                      {Object.entries(MODE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
                      Format
                    </label>
                    <select
                      value={format}
                      onChange={(e) => {
                        const newFormat = e.target.value as TournamentFormat;
                        setFormat(newFormat);
                        setManualTeams([]); setFirstPick(null);
                        if (!nameManuallyEdited) setName(generateName(mode, newFormat));
                      }}
                      className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
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
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
                      Gewinnsaetze (Best of {setsToWin * 2 - 1})
                    </label>
                    <select
                      value={setsToWin}
                      onChange={(e) => setSetsToWin(Number(e.target.value))}
                      className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                    >
                      <option value={1}>1 Satz (Best of 1)</option>
                      <option value={2}>2 Saetze (Best of 3)</option>
                      <option value={3}>3 Saetze (Best of 5)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
                      Punkte pro Satz
                    </label>
                    <input
                      type="number"
                      value={pointsPerSet}
                      onChange={(e) => setPointsPerSet(Number(e.target.value))}
                      className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                      min={1}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
                      Spielfelder
                    </label>
                    <select
                      value={courts}
                      onChange={(e) => setCourts(Number(e.target.value))}
                      className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "Feld" : "Felder"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Group settings - only for group_ko */}
                {format === "group_ko" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
                        Anzahl Gruppen
                      </label>
                      <select
                        value={numGroups}
                        onChange={(e) => setNumGroups(Number(e.target.value))}
                        className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                      >
                        {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <option key={n} value={n}>
                            {n} Gruppen
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
                        Qualifikanten pro Gruppe
                      </label>
                      <select
                        value={qualifyPerGroup}
                        onChange={(e) => setQualifyPerGroup(Number(e.target.value))}
                        className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            Top {n}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-gray-400 mt-1">
                        → {numGroups * qualifyPerGroup} Spieler im KO
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Seeding Toggle - only for elimination */}
            {format === "elimination" && (
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${theme.cardBorder} ${useSeeding ? theme.selectedBg : ''}`}>
                <input
                  type="checkbox"
                  checked={useSeeding}
                  onChange={(e) => {
                    setUseSeeding(e.target.checked);
                    if (e.target.checked) {
                      const existing = seedOrder.filter((pid) => selectedPlayerIds.has(pid));
                      const existingSet = new Set(existing);
                      const missing = players
                        .filter((p) => selectedPlayerIds.has(p.id) && !existingSet.has(p.id))
                        .map((p) => p.id);
                      setSeedOrder([...existing, ...missing]);
                    }
                  }}
                  className="rounded accent-emerald-600"
                />
                <div>
                  <span className={`text-sm font-medium ${theme.textPrimary}`}>🎯 Setzliste aktivieren</span>
                  <p className={`text-xs ${theme.textMuted}`}>Gesetzte Spieler treffen erst in spaeteren Runden aufeinander</p>
                </div>
              </div>
            )}

            {/* Entry Fee Toggle + Fields */}
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${theme.cardBorder} ${useEntryFee ? theme.selectedBg : ''}`}>
              <input
                type="checkbox"
                checked={useEntryFee}
                onChange={(e) => setUseEntryFee(e.target.checked)}
                className="rounded accent-emerald-600 mt-1"
              />
              <div className="flex-1">
                <span className={`text-sm font-medium ${theme.textPrimary}`}>💰 Startgeld erheben</span>
                <p className={`text-xs ${theme.textMuted}`}>Zahlungen pro Teilnehmer verwalten</p>
                {useEntryFee && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>Einzel (EUR)</label>
                      <input
                        type="number"
                        value={entryFeeSingle}
                        onChange={(e) => setEntryFeeSingle(e.target.value)}
                        className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-3 py-2 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                        min={0}
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>Doppel (EUR)</label>
                      <input
                        type="number"
                        value={entryFeeDouble}
                        onChange={(e) => setEntryFeeDouble(e.target.value)}
                        className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-3 py-2 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                        min={0}
                        step="0.5"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {nextStep && (
              <button
                onClick={() => setCreateStep(nextStep)}
                className={`w-full ${theme.primaryBg} text-white px-5 py-3 rounded-2xl ${theme.primaryHoverBg} shadow-sm hover:shadow-md transition-all font-medium text-sm mt-2`}
              >
                Weiter zu {steps.find((s) => s.key === nextStep)?.icon} {steps.find((s) => s.key === nextStep)?.label} →
              </button>
            )}
          </>
        )}

        {/* Step: Players */}
        {createStep === "players" && (
          <>
            <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5`}>
              {/* Header */}
              <div className="flex justify-between items-center mb-3">
                <h2 className={`font-semibold ${theme.textPrimary}`}>
                  Spieler auswaehlen{" "}
                  <span className={`${theme.activeBadgeText} font-normal`}>
                    ({selectedCount} ausgewaehlt)
                  </span>
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllFiltered}
                    className={`${theme.activeBadgeText} text-sm font-medium`}
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
                    className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl pl-9 pr-4 py-2 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
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
                <div className={`flex rounded-xl border ${theme.inputBorder} overflow-hidden text-sm`}>
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
                          ? `${theme.primaryBg} text-white`
                          : `${theme.textSecondary} hover:opacity-80`
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
                    <span className={`${theme.activeBadgeText} ml-1`}>
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
                <div className={`max-h-72 overflow-y-auto rounded-xl border ${theme.cardBorder}`}>
                  {filteredPlayers.map((p, i) => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-all duration-150 ${
                        i > 0 ? `border-t ${theme.cardBorder}` : ""
                      } ${
                        selectedPlayerIds.has(p.id)
                          ? theme.selectedBg
                          : "hover:opacity-80 hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlayerIds.has(p.id)}
                        onChange={() => togglePlayer(p.id)}
                        className="rounded accent-emerald-600 shrink-0"
                      />
                      <span className={`font-medium ${theme.textPrimary} flex-1`}>{p.name}</span>
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

            {nextStep && (
              <button
                onClick={() => setCreateStep(nextStep)}
                className={`w-full ${theme.primaryBg} text-white px-5 py-3 rounded-2xl ${theme.primaryHoverBg} shadow-sm hover:shadow-md transition-all font-medium text-sm mt-2`}
              >
                Weiter zu {steps.find((s) => s.key === nextStep)?.icon} {steps.find((s) => s.key === nextStep)?.label} →
              </button>
            )}
          </>
        )}

        {/* Step: Teams */}
        {createStep === "teams" && needsTeamPairing && (
          <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`font-semibold ${theme.textPrimary}`}>
                🤝 Teams bilden
                <span className={`ml-2 text-xs font-normal ${theme.textSecondary}`}>
                  {manualTeams.length > 0
                    ? `${manualTeams.length} Teams · ${poolPlayers.length} offen`
                    : `${poolPlayers.length} Spieler verfuegbar`}
                </span>
              </h2>
              <div className="flex gap-2">
                {poolPlayers.length >= 2 && (
                  <button
                    onClick={autoAssignRemaining}
                    className={`text-xs font-medium ${theme.activeBadgeText} ${theme.activeBadgeBg} px-3 py-1.5 rounded-lg transition-colors`}
                  >
                    Restliche automatisch zuordnen
                  </button>
                )}
                {manualTeams.length > 0 && (
                  <button
                    onClick={() => { setManualTeams([]); setFirstPick(null); }}
                    className={`text-xs ${theme.textMuted} hover:text-rose-600 transition-colors`}
                  >
                    Alle aufloesen
                  </button>
                )}
              </div>
            </div>

            {/* Pool: ungepaarte Spieler */}
            {poolPlayers.length > 0 && (() => {
              const firstPickGender = firstPick !== null ? players.find((pl) => pl.id === firstPick)?.gender : null;
              const isMixed = mode === "mixed";
              const poolMale = poolPlayers.filter((p) => p.gender === "m").sort((a, b) => a.name.localeCompare(b.name));
              const poolFemale = poolPlayers.filter((p) => p.gender === "f").sort((a, b) => a.name.localeCompare(b.name));
              const poolSorted = isMixed ? [...poolFemale, ...poolMale] : [...poolPlayers].sort((a, b) => a.name.localeCompare(b.name));

              const renderPlayer = (p: typeof poolPlayers[0]) => {
                const isFirst = firstPick === p.id;
                const isMixedBlocked = isMixed && firstPick !== null && firstPickGender === p.gender;
                return (
                  <button
                    key={p.id}
                    onClick={() => !isMixedBlocked && handlePoolClick(p.id)}
                    disabled={!!isMixedBlocked}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                      isFirst
                        ? `${theme.primaryBg} text-white shadow-md`
                        : isMixedBlocked
                        ? `${theme.cardBg} ${theme.textMuted} border-gray-200 opacity-30 cursor-not-allowed`
                        : `${theme.cardBg} ${theme.textPrimary} ${theme.cardBorder} ${theme.cardHoverBorder} hover:shadow-sm cursor-pointer`
                    }`}
                  >
                    {p.name}
                    {!isMixed && (
                      <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                        p.gender === "m" ? "bg-blue-500/10 text-blue-500" : "bg-pink-500/10 text-pink-500"
                      }`}>
                        {p.gender === "m" ? "H" : "D"}
                      </span>
                    )}
                  </button>
                );
              };

              return (
                <div className="mb-4">
                  <div className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wide mb-2`}>
                    Verfuegbar ({poolPlayers.length}) {firstPick !== null && "— Waehle den Partner"}
                  </div>
                  {isMixed ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 px-1 ${firstPickGender === "f" ? theme.textMuted + " opacity-40" : "text-pink-500"}`}>
                          Damen ({poolFemale.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {poolFemale.map(renderPlayer)}
                        </div>
                      </div>
                      <div>
                        <div className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 px-1 ${firstPickGender === "m" ? theme.textMuted + " opacity-40" : "text-blue-500"}`}>
                          Herren ({poolMale.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {poolMale.map(renderPlayer)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {poolSorted.map(renderPlayer)}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Gebildete Teams */}
            {manualTeams.length > 0 && (
              <div>
                <div className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wide mb-2`}>
                  Teams ({manualTeams.length})
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {manualTeams.map(([id1, id2], idx) => {
                    const p1 = players.find((p) => p.id === id1);
                    const p2 = players.find((p) => p.id === id2);
                    return (
                      <div
                        key={idx}
                        className={`${theme.selectedBg} border ${theme.cardBorder} rounded-xl px-3 py-2 flex items-center justify-between group`}
                      >
                        <div className="text-sm">
                          <span className={`font-medium ${theme.textPrimary}`}>{p1?.name ?? "?"}</span>
                          <span className={`${theme.textMuted} mx-1.5`}>/</span>
                          <span className={`font-medium ${theme.textPrimary}`}>{p2?.name ?? "?"}</span>
                        </div>
                        <button
                          onClick={() => removeTeam(idx)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-rose-400 hover:text-rose-600 transition-all ml-2"
                          title="Team aufloesen"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status */}
            {poolPlayers.length > 0 && poolPlayers.length < 2 && (
              <div className={`text-xs ${theme.textMuted} mt-3`}>
                ⚠️ 1 Spieler uebrig - ungerade Anzahl. Spieler wird nicht zugeteilt.
              </div>
            )}
            {poolPlayers.length === 0 && manualTeams.length > 0 && (
              <div className={`text-xs text-green-600 mt-3`}>
                ✓ Alle Spieler sind Teams zugeteilt.
              </div>
            )}

            {nextStep && (
              <button
                onClick={() => setCreateStep(nextStep)}
                className={`w-full ${theme.primaryBg} text-white px-5 py-3 rounded-2xl ${theme.primaryHoverBg} shadow-sm hover:shadow-md transition-all font-medium text-sm mt-4`}
              >
                Weiter zu {steps.find((s) => s.key === nextStep)?.icon} {steps.find((s) => s.key === nextStep)?.label} →
              </button>
            )}
          </div>
        )}

        {/* Step: Seeding */}
        {createStep === "seeding" && showSeedingStep && (
          <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5`}>
            <h2 className={`font-semibold ${theme.textPrimary} mb-3`}>
              🎯 Setzliste
            </h2>
            <p className={`text-xs ${theme.textMuted} mb-3`}>
              Ordne die Spieler nach Staerke per Drag &amp; Drop oder mit den Pfeilen
              (Platz 1 = staerkster Spieler).
            </p>
            <div className={`rounded-xl border ${theme.cardBorder} overflow-hidden`}>
              {seedOrder
                .filter((pid) => selectedPlayerIds.has(pid))
                .map((pid, idx) => {
                          const p = players.find((pl) => pl.id === pid);
                          if (!p) return null;
                          const isDragging = dragSeedIdx === idx;
                          const isOver = dragOverIdx === idx;
                          return (
                            <div
                              key={p.id}
                              draggable
                              onDragStart={(e) => {
                                setDragSeedIdx(idx);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", String(idx));
                              }}
                              onDragEnd={() => { setDragSeedIdx(null); setDragOverIdx(null); }}
                              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIdx(idx); }}
                              onDragLeave={() => { if (dragOverIdx === idx) setDragOverIdx(null); }}
                              onDrop={(e) => { e.preventDefault(); handleSeedDrop(idx); }}
                              className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-grab active:cursor-grabbing select-none transition-all ${
                                idx > 0 ? "border-t border-gray-50" : ""
                              } ${isDragging ? "opacity-40 bg-gray-50" : ""} ${
                                isOver && !isDragging ? "border-t-2 border-t-emerald-400" : ""
                              }`}
                            >
                              <span className="text-gray-300 text-xs cursor-grab" draggable={false}>⠿</span>
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
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
                              <span className={`font-medium ${theme.textPrimary} flex-1`}>
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
                              <div className="flex flex-col gap-0.5" draggable={false}>
                                <button
                                  draggable={false}
                                  onClick={() => moveSeed(idx, -1)}
                                  disabled={idx === 0}
                                  className="text-gray-400 hover:text-emerald-600 disabled:opacity-20 disabled:cursor-default text-xs leading-none"
                                  title="Nach oben"
                                >
                                  ▲
                                </button>
                                <button
                                  draggable={false}
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

            {nextStep && (
              <button
                onClick={() => setCreateStep(nextStep)}
                className={`w-full ${theme.primaryBg} text-white px-5 py-3 rounded-2xl ${theme.primaryHoverBg} shadow-sm hover:shadow-md transition-all font-medium text-sm mt-4`}
              >
                Weiter zu {steps.find((s) => s.key === nextStep)?.icon} {steps.find((s) => s.key === nextStep)?.label} →
              </button>
            )}
          </div>
        )}

        {/* Step: Create */}
        {createStep === "create" && (
          <>
            {/* Summary */}
            <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5`}>
              <h2 className={`font-semibold ${theme.textPrimary} mb-3`}>Zusammenfassung</h2>
              <div className={`text-sm ${theme.textSecondary} space-y-1.5`}>
                <div><span className={`font-medium ${theme.textPrimary}`}>Name:</span> {name || "—"}</div>
                <div><span className={`font-medium ${theme.textPrimary}`}>Modus:</span> {MODE_LABELS[mode]} · {FORMAT_LABELS[format]}</div>
                <div><span className={`font-medium ${theme.textPrimary}`}>Regeln:</span> Best of {setsToWin * 2 - 1} · {pointsPerSet} Punkte · {courts} {courts === 1 ? "Feld" : "Felder"}</div>
                <div><span className={`font-medium ${theme.textPrimary}`}>Spieler:</span> {selectedPlayerIds.size} ausgewaehlt {selectedPlayerIds.size < minPlayers && <span className="text-orange-500">(mind. {minPlayers})</span>}</div>
                {needsTeamPairing && (
                  <div><span className={`font-medium ${theme.textPrimary}`}>Teams:</span> {manualTeams.length} gebildet {poolPlayers.length > 1 && <span className="text-orange-500">({poolPlayers.length} offen)</span>}</div>
                )}
                {(Number(entryFeeSingle) > 0 || Number(entryFeeDouble) > 0) && (
                  <div><span className={`font-medium ${theme.textPrimary}`}>Startgeld:</span> Einzel {entryFeeSingle} EUR · Doppel {entryFeeDouble} EUR</div>
                )}
              </div>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={selectedPlayerIds.size < minPlayers}
              className={`w-full ${theme.primaryBg} text-white px-5 py-3.5 rounded-2xl ${theme.primaryHoverBg} shadow-sm hover:shadow-lg transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none font-semibold text-base`}
            >
              {isEditMode ? "💾 Aenderungen speichern" : "🏆 Turnier erstellen"}
              {selectedPlayerIds.size < minPlayers && (
                <span className="text-sm font-normal ml-2 opacity-70">
                  (mind. {minPlayers} Spieler)
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
