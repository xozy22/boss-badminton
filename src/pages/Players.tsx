import { useEffect, useState, useMemo } from "react";
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from "../lib/db";
import * as XLSX from "xlsx";
import type { Player, Gender } from "../lib/types";
import { calculateAge } from "../lib/types";
import ExcelImport from "../components/players/ExcelImport";
import { useTheme } from "../lib/ThemeContext";
import { useT } from "../lib/I18nContext";

type GenderFilter = "all" | "m" | "f";

export default function Players() {
  const { theme } = useTheme();
  const { t } = useT();
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("m");
  const [birthDate, setBirthDate] = useState<string>("");
  const [club, setClub] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState<Gender>("m");
  const [editBirthDate, setEditBirthDate] = useState<string>("");
  const [editClub, setEditClub] = useState("");
  const [showImport, setShowImport] = useState(false);

  // Filter
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ ids: number[]; names: string[] } | null>(null);

  const load = () => getPlayers().then((p) => { setPlayers(p); setSelectedIds(new Set()); });

  useEffect(() => { load(); }, []);

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (genderFilter !== "all" && p.gender !== genderFilter) return false;
      if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, search, genderFilter]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await createPlayer(name.trim(), gender, birthDate || null, club.trim() || null);
    setName("");
    setBirthDate("");
    setClub("");
    load();
  };

  const handleEdit = (p: Player) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditGender(p.gender);
    setEditBirthDate(p.birth_date ?? "");
    setEditClub(p.club ?? "");
  };

  const handleSave = async () => {
    if (editingId === null || !editName.trim()) return;
    try {
      await updatePlayer(editingId, editName.trim(), editGender, editBirthDate || null, editClub.trim() || null);
      setEditingId(null);
      load();
    } catch (err) {
      console.error("Error updating player:", err);
    }
  };

  // Single delete with confirmation
  const handleDeleteSingle = (p: Player) => {
    setDeleteTarget({ ids: [p.id], names: [p.name] });
  };

  // Multi delete with confirmation
  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    const names = ids.map((id) => players.find((p) => p.id === id)?.name ?? "?");
    setDeleteTarget({ ids, names });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      for (const id of deleteTarget.ids) {
        await deletePlayer(id);
      }
      setDeleteTarget(null);
      load();
    } catch (err) {
      console.error("Error deleting player:", err);
    }
  };

  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filteredIds = filteredPlayers.map((p) => p.id);
    const allSelected = filteredIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      // Deselect all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) next.delete(id);
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) next.add(id);
        return next;
      });
    }
  };

  const allFilteredSelected = filteredPlayers.length > 0 && filteredPlayers.every((p) => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  const handleExport = async () => {
    const data = players.map((p) => ({
      Name: p.name,
      Geschlecht: p.gender === "m" ? t.common_gender_male : t.common_gender_female,
      [t.common_birth_date]: p.birth_date ?? "",
      [t.common_age]: calculateAge(p.birth_date) ?? "",
      Verein: p.club ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Spieler");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        const path = await save({
          defaultPath: "spieler.xlsx",
          filters: [{ name: "Excel-Arbeitsmappe (*.xlsx)", extensions: ["xlsx"] }],
        });
        if (path) {
          await writeFile(path, new Uint8Array(buf));
        }
        return;
      } catch (err) {
        console.error("Tauri save failed, falling back to browser download", err);
      }
    }
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spieler.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`text-2xl font-extrabold ${theme.textPrimary} tracking-tight`}>
            {t.players_title}
          </h1>
          <p className={`text-sm ${theme.textSecondary} mt-0.5`}>
            {t.players_count.replace("{count}", String(players.length))}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={players.length === 0}
            className={`${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2 rounded-xl ${theme.cardHoverBorder} hover:shadow-sm transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            📤 {t.common_export}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className={`${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2 rounded-xl ${theme.cardHoverBorder} hover:shadow-sm transition-all text-sm font-medium`}
          >
            📥 {t.common_import}
          </button>
        </div>
      </div>

      {showImport && (
        <ExcelImport onImportDone={load} onClose={() => setShowImport(false)} />
      )}

      {/* Add Player */}
      <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5 mb-6`}>
        <h2 className={`font-semibold ${theme.textPrimary} mb-3`}>{t.players_new_player}</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              {t.common_name}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
              placeholder={t.players_name_placeholder}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              {t.common_gender}
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
            >
              <option value="m">{t.common_gender_male}</option>
              <option value="f">{t.common_gender_female}</option>
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              {t.common_birth_date}
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className={`w-40 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="flex-1">
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              {t.common_club}
            </label>
            <input
              type="text"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
              placeholder={t.players_club_placeholder}
            />
          </div>
          <button
            onClick={handleAdd}
            className={`${theme.primaryBg} text-white px-5 py-2.5 rounded-xl ${theme.primaryHoverBg} shadow-sm hover:shadow-md transition-all text-sm font-medium`}
          >
            {t.common_add}
          </button>
        </div>
      </div>

      {/* Filter + Actions Bar */}
      <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
        <div className={`px-5 py-3 border-b ${theme.cardBorder} flex items-center gap-3 flex-wrap`}>
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.players_search_placeholder}
              className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg pl-8 pr-3 py-1.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
            />
            <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${theme.textMuted} text-xs`}>🔍</span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${theme.textMuted} hover:opacity-80 text-xs`}
              >✕</button>
            )}
          </div>

          {/* Gender Filter */}
          <div className={`flex rounded-lg border ${theme.inputBorder} overflow-hidden text-xs`}>
            {([
              { value: "all" as GenderFilter, label: t.players_filter_all },
              { value: "m" as GenderFilter, label: t.players_filter_men },
              { value: "f" as GenderFilter, label: t.players_filter_women },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGenderFilter(opt.value)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  genderFilter === opt.value
                    ? `${theme.primaryBg} text-white`
                    : `${theme.textSecondary} hover:opacity-80`
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Selection Actions */}
          {someSelected && (
            <div className="flex items-center gap-2 ml-auto">
              <span className={`text-xs ${theme.textMuted}`}>
                {t.common_selected.replace("{count}", String(selectedIds.size))}
              </span>
              <button
                onClick={handleDeleteSelected}
                className="bg-rose-500/10 text-rose-600 border border-rose-500/20 px-3 py-1.5 rounded-lg hover:bg-rose-500/20 transition-all text-xs font-medium"
              >
                🗑 {t.players_delete_selected}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className={`${theme.textMuted} hover:opacity-80 px-2 py-1.5 text-xs`}
              >
                {t.players_clear_selection}
              </button>
            </div>
          )}
        </div>

        {/* Info bar */}
        {(genderFilter !== "all" || search) && (
          <div className={`px-5 py-1.5 text-xs ${theme.textMuted} border-b ${theme.cardBorder}`}>
            {t.players_shown_of_total.replace("{shown}", String(filteredPlayers.length)).replace("{total}", String(players.length))}
          </div>
        )}

        {/* Player Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${theme.cardBorder} ${theme.headerGradient}`}>
              <th className="w-10 px-3 py-3 text-center align-middle">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="rounded accent-emerald-600"
                  title={t.players_select_all}
                />
              </th>
              <th className={`text-left px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide align-middle`}>
                #
              </th>
              <th className={`text-left px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                {t.common_name}
              </th>
              <th className={`text-left px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                {t.common_gender}
              </th>
              <th className={`text-center px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                {t.common_age}
              </th>
              <th className={`text-left px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                {t.common_club}
              </th>
              <th className={`text-right px-5 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                {t.common_actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((p, i) => {
              const isSelected = selectedIds.has(p.id);
              return (
                <tr
                  key={p.id}
                  className={`border-b ${theme.cardBorder} last:border-0 transition-colors ${
                    isSelected ? theme.selectedBg : `hover:${theme.cardBg}`
                  }`}
                >
                  <td className="px-3 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.id)}
                      className="rounded accent-emerald-600"
                    />
                  </td>
                  <td className={`px-3 py-3 ${theme.textMuted} font-mono text-xs`}>
                    {i + 1}
                  </td>
                  <td className={`px-3 py-3 font-medium ${theme.textPrimary}`}>
                    {editingId === p.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSave()}
                        className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-3 py-1.5 text-sm w-full focus:ring-2 ${theme.focusRing} outline-none`}
                        autoFocus
                      />
                    ) : (
                      p.name
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {editingId === p.id ? (
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value as Gender)}
                        className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-3 py-1.5 text-sm`}
                      >
                        <option value="m">{t.common_gender_male}</option>
                        <option value="f">{t.common_gender_female}</option>
                      </select>
                    ) : (
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          p.gender === "m"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-pink-500/10 text-pink-500"
                        }`}
                      >
                        {p.gender === "m" ? t.common_gender_male : t.common_gender_female}
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-3 text-center ${theme.textSecondary}`}>
                    {editingId === p.id ? (
                      <input
                        type="date"
                        value={editBirthDate}
                        onChange={(e) => setEditBirthDate(e.target.value)}
                        className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-2 py-1.5 text-sm w-36 text-center`}
                        max={new Date().toISOString().split("T")[0]}
                      />
                    ) : (
                      p.birth_date != null ? (
                        <span className="text-sm" title={`${t.common_birth_date}: ${new Date(p.birth_date).toLocaleDateString()}`}>
                          {calculateAge(p.birth_date)}
                        </span>
                      ) : (
                        <span className="text-sm">-</span>
                      )
                    )}
                  </td>
                  <td className={`px-3 py-3 ${theme.textSecondary}`}>
                    {editingId === p.id ? (
                      <input
                        type="text"
                        value={editClub}
                        onChange={(e) => setEditClub(e.target.value)}
                        className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-3 py-1.5 text-sm w-full`}
                        placeholder={t.players_club_placeholder}
                      />
                    ) : (
                      <span className="text-sm">{p.club ?? "-"}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {editingId === p.id ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleSave}
                          className={`${theme.activeBadgeText} text-sm font-medium`}
                        >
                          {t.common_save}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className={`${theme.textMuted} hover:opacity-80 text-sm`}
                        >
                          {t.common_cancel}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => handleEdit(p)}
                          className={`${theme.textMuted} hover:${theme.activeBadgeText} text-sm transition-colors`}
                        >
                          {t.common_edit}
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(p)}
                          className={`${theme.textMuted} hover:text-rose-600 text-sm transition-colors`}
                        >
                          {t.common_delete}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredPlayers.length === 0 && (
              <tr>
                <td colSpan={7} className={`px-5 py-12 text-center ${theme.textMuted}`}>
                  {players.length === 0
                    ? t.players_none_yet
                    : t.players_no_filter_results}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${theme.cardBg} rounded-2xl shadow-2xl w-full max-w-md p-6 border ${theme.cardBorder}`}>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className={`text-lg font-bold ${theme.textPrimary}`}>
                {deleteTarget.ids.length === 1
                  ? t.players_delete_confirm_single
                  : t.players_delete_confirm_multi.replace("{count}", String(deleteTarget.ids.length))}
              </h3>
              <div className={`text-sm ${theme.textSecondary} mt-3`}>
                {deleteTarget.ids.length <= 5 ? (
                  <div className="space-y-1">
                    {deleteTarget.names.map((n, i) => (
                      <div key={i} className={`font-medium ${theme.textPrimary}`}>
                        {n}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="space-y-1 mb-2">
                      {deleteTarget.names.slice(0, 3).map((n, i) => (
                        <div key={i} className={`font-medium ${theme.textPrimary}`}>{n}</div>
                      ))}
                    </div>
                    <div className={theme.textMuted}>
                      {t.common_and_more.replace("{count}", String(deleteTarget.ids.length - 3))}
                    </div>
                  </div>
                )}
                <p className={`mt-3 ${theme.textMuted} text-xs`}>
                  {t.common_action_irreversible}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className={`flex-1 ${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium`}
              >
                {t.common_cancel}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-rose-600 text-white px-4 py-2.5 rounded-xl hover:bg-rose-700 transition-all text-sm font-medium"
              >
                {deleteTarget.ids.length === 1 ? t.common_delete : t.players_delete_confirm_multi.replace("{count}", String(deleteTarget.ids.length))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
