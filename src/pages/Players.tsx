import { useEffect, useState } from "react";
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from "../lib/db";
import * as XLSX from "xlsx";
import type { Player, Gender } from "../lib/types";
import ExcelImport from "../components/players/ExcelImport";
import { useTheme } from "../lib/ThemeContext";

export default function Players() {
  const { theme } = useTheme();
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("m");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState<Gender>("m");
  const [showImport, setShowImport] = useState(false);

  const load = () => getPlayers().then(setPlayers);

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await createPlayer(name.trim(), gender);
    setName("");
    load();
  };

  const handleEdit = (p: Player) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditGender(p.gender);
  };

  const handleSave = async () => {
    if (editingId === null || !editName.trim()) return;
    await updatePlayer(editingId, editName.trim(), editGender);
    setEditingId(null);
    load();
  };

  const handleDelete = async (id: number) => {
    await deletePlayer(id);
    load();
  };

  const handleExport = async () => {
    const data = players.map((p) => ({
      Name: p.name,
      Geschlecht: p.gender === "m" ? "Herr" : "Dame",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 30 }, { wch: 12 }];
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`text-2xl font-extrabold ${theme.textPrimary} tracking-tight`}>
            Spielerverwaltung
          </h1>
          <p className={`text-sm ${theme.textSecondary} mt-0.5`}>
            {players.length} Spieler registriert
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={players.length === 0}
            className={`${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2 rounded-xl ${theme.cardHoverBorder} hover:shadow-sm transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            📤 Export
          </button>
          <button
            onClick={() => setShowImport(true)}
            className={`${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2 rounded-xl ${theme.cardHoverBorder} hover:shadow-sm transition-all text-sm font-medium`}
          >
            📥 Import
          </button>
        </div>
      </div>

      {showImport && (
        <ExcelImport
          onImportDone={load}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Add Player */}
      <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5 mb-6`}>
        <h2 className={`font-semibold ${theme.textPrimary} mb-3`}>Neuer Spieler</h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
              placeholder="Name eingeben..."
            />
          </div>
          <div>
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              Geschlecht
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
            >
              <option value="m">Herr</option>
              <option value="f">Dame</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            className={`${theme.primaryBg} text-white px-5 py-2.5 rounded-xl ${theme.primaryHoverBg} shadow-sm hover:shadow-md transition-all text-sm font-medium`}
          >
            Hinzufuegen
          </button>
        </div>
      </div>

      {/* Player Table */}
      <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${theme.cardBorder} ${theme.headerGradient}`}>
              <th className={`text-left px-5 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                #
              </th>
              <th className={`text-left px-5 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                Name
              </th>
              <th className={`text-left px-5 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                Geschlecht
              </th>
              <th className={`text-right px-5 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr
                key={p.id}
                className="border-b border-gray-50 last:border-0 hover:bg-emerald-50/30 transition-colors"
              >
                <td className="px-5 py-3 text-gray-400 font-mono text-xs">
                  {i + 1}
                </td>
                <td className={`px-5 py-3 font-medium ${theme.textPrimary}`}>
                  {editingId === p.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSave()}
                      className={`border ${theme.inputBorder} rounded-lg px-3 py-1.5 text-sm w-full focus:ring-2 ${theme.focusRing} outline-none`}
                      autoFocus
                    />
                  ) : (
                    p.name
                  )}
                </td>
                <td className="px-5 py-3">
                  {editingId === p.id ? (
                    <select
                      value={editGender}
                      onChange={(e) =>
                        setEditGender(e.target.value as Gender)
                      }
                      className={`border ${theme.inputBorder} rounded-lg px-3 py-1.5 text-sm`}
                    >
                      <option value="m">Herr</option>
                      <option value="f">Dame</option>
                    </select>
                  ) : (
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        p.gender === "m"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-pink-50 text-pink-600"
                      }`}
                    >
                      {p.gender === "m" ? "Herr" : "Dame"}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {editingId === p.id ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleSave}
                        className={`${theme.activeBadgeText} text-sm font-medium`}
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => handleEdit(p)}
                        className="text-gray-400 hover:text-emerald-600 text-sm transition-colors"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-gray-400 hover:text-rose-600 text-sm transition-colors"
                      >
                        Loeschen
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-12 text-center text-gray-400"
                >
                  Noch keine Spieler vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
