import { useEffect, useState, useMemo } from "react";
import { getSportstaetten, createSportstaette, updateSportstaette, deleteSportstaette } from "../lib/db";
import type { Sportstaette, HallConfig } from "../lib/types";
import { parseHallConfig, hallConfigTotalCourts } from "../lib/types";
import { useTheme } from "../lib/ThemeContext";

const DEFAULT_HALLS: HallConfig[] = [{ name: "Halle 1", courts: 2 }];

function HallEditor({
  halls,
  onChange,
  theme,
  compact = false,
}: {
  halls: HallConfig[];
  onChange: (h: HallConfig[]) => void;
  theme: any;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {halls.map((hall, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={hall.name}
            onChange={(e) => {
              const next = halls.map((h, i) => i === idx ? { ...h, name: e.target.value } : h);
              onChange(next);
            }}
            className={`${compact ? "flex-1 min-w-0" : "flex-1"} ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-3 py-1.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
            placeholder="Hallenname..."
          />
          <input
            type="number"
            value={hall.courts}
            min={1}
            max={8}
            onChange={(e) => {
              const next = halls.map((h, i) => i === idx ? { ...h, courts: Number(e.target.value) || 1 } : h);
              onChange(next);
            }}
            className={`w-16 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-2 py-1.5 text-sm text-center ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
          />
          <span className={`text-xs ${theme.textMuted} shrink-0`}>Felder</span>
          {halls.length > 1 && (
            <button
              onClick={() => onChange(halls.filter((_, i) => i !== idx))}
              className={`${theme.textMuted} hover:text-rose-500 text-sm transition-colors px-0.5 shrink-0`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onChange([...halls, { name: `Halle ${halls.length + 1}`, courts: 2 }])}
          className={`text-xs font-medium ${theme.activeBadgeText} hover:opacity-80 transition-colors`}
        >
          + Halle
        </button>
        <span className={`text-xs ${theme.textMuted}`}>
          {hallConfigTotalCourts(halls)} Felder
        </span>
      </div>
    </div>
  );
}

export default function Sportstaetten() {
  const { theme } = useTheme();
  const [sportstaetten, setSportstaetten] = useState<Sportstaette[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [halls, setHalls] = useState<HallConfig[]>([...DEFAULT_HALLS]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editZip, setEditZip] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editHalls, setEditHalls] = useState<HallConfig[]>([]);

  // Filter
  const [search, setSearch] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ ids: number[]; names: string[] } | null>(null);

  const load = () => getSportstaetten().then((s) => setSportstaetten(s));

  useEffect(() => { load(); }, []);

  const filteredSportstaetten = useMemo(() => {
    return sportstaetten.filter((s) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.city ?? "").toLowerCase().includes(q);
    });
  }, [sportstaetten, search]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    const totalCourts = hallConfigTotalCourts(halls);
    const hallsJson = JSON.stringify(halls);
    await createSportstaette(name.trim(), address.trim() || null, zip.trim() || null, city.trim() || null, totalCourts, hallsJson);
    setName("");
    setAddress("");
    setZip("");
    setCity("");
    setHalls([...DEFAULT_HALLS]);
    load();
  };

  const handleEdit = (s: Sportstaette) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditAddress(s.address ?? "");
    setEditZip(s.zip ?? "");
    setEditCity(s.city ?? "");
    const parsed = parseHallConfig(s.halls);
    setEditHalls(parsed.length > 0 ? parsed : [{ name: "Halle 1", courts: s.courts }]);
  };

  const handleSave = async () => {
    if (editingId === null || !editName.trim()) return;
    const totalCourts = hallConfigTotalCourts(editHalls);
    const hallsJson = JSON.stringify(editHalls);
    await updateSportstaette(editingId, editName.trim(), editAddress.trim() || null, editZip.trim() || null, editCity.trim() || null, totalCourts, hallsJson);
    setEditingId(null);
    load();
  };

  const handleDeleteSingle = (s: Sportstaette) => {
    setDeleteTarget({ ids: [s.id], names: [s.name] });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    for (const id of deleteTarget.ids) {
      await deleteSportstaette(id);
    }
    setDeleteTarget(null);
    load();
  };

  const formatHallsSummary = (s: Sportstaette): string => {
    const parsed = parseHallConfig(s.halls);
    if (parsed.length === 0) return `${s.courts} Felder`;
    const totalCourts = hallConfigTotalCourts(parsed);
    return `${parsed.length} ${parsed.length === 1 ? "Halle" : "Hallen"}, ${totalCourts} ${totalCourts === 1 ? "Feld" : "Felder"}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className={`text-2xl font-extrabold ${theme.textPrimary} tracking-tight`}>
            Sportstaetten
          </h1>
          <p className={`text-sm ${theme.textSecondary} mt-0.5`}>
            {sportstaetten.length} {sportstaetten.length === 1 ? "Sportstaette" : "Sportstaetten"} registriert
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const data = sportstaetten.map((s) => ({
                name: s.name,
                address: s.address,
                zip: s.zip,
                city: s.city,
                halls: s.halls ? parseHallConfig(s.halls) : [{ name: "Halle 1", courts: s.courts }],
              }));
              const json = JSON.stringify(data, null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "sportstaetten.json";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            disabled={sportstaetten.length === 0}
            className={`${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2 rounded-xl ${theme.cardHoverBorder} hover:shadow-sm transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            📤 Export
          </button>
          <label className={`${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2 rounded-xl ${theme.cardHoverBorder} hover:shadow-sm transition-all text-sm font-medium cursor-pointer`}>
            📥 Import
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (evt) => {
                  try {
                    const imported = JSON.parse(evt.target?.result as string);
                    if (!Array.isArray(imported)) return;
                    for (const s of imported) {
                      if (!s.name) continue;
                      const h = s.halls && Array.isArray(s.halls) ? s.halls : [{ name: "Halle 1", courts: s.courts || 2 }];
                      const totalCourts = h.reduce((sum: number, hall: HallConfig) => sum + hall.courts, 0);
                      await createSportstaette(s.name, s.address || null, s.zip || null, s.city || null, totalCourts, JSON.stringify(h));
                    }
                    load();
                  } catch (err) {
                    console.error("Import fehlgeschlagen:", err);
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {/* Add Sportstaette */}
      <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5 mb-6`}>
        <h2 className={`font-semibold ${theme.textPrimary} mb-3`}>Neue Sportstaette</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
              placeholder="Name der Sportstaette..."
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              Adresse
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
              placeholder="Strasse und Hausnummer..."
            />
          </div>
          <div>
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              PLZ
            </label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className={`w-24 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
              placeholder="PLZ"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`}>
              Stadt
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
              placeholder="Stadt..."
            />
          </div>
          <button
            onClick={handleAdd}
            className={`${theme.primaryBg} text-white px-5 py-2.5 rounded-xl ${theme.primaryHoverBg} shadow-sm hover:shadow-md transition-all text-sm font-medium shrink-0`}
          >
            Hinzufuegen
          </button>
        </div>
        {/* Halls editor */}
        <div className="mt-4">
          <label className={`block text-xs font-medium ${theme.textSecondary} mb-1.5 uppercase tracking-wide`}>
            Hallen
          </label>
          <HallEditor halls={halls} onChange={setHalls} theme={theme} />
        </div>
      </div>

      {/* Filter + Table */}
      <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
        <div className={`px-5 py-3 border-b ${theme.cardBorder} flex items-center gap-3 flex-wrap`}>
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sportstaette suchen..."
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
        </div>

        {/* Info bar */}
        {search && (
          <div className={`px-5 py-1.5 text-xs ${theme.textMuted} border-b ${theme.cardBorder}`}>
            {filteredSportstaetten.length} von {sportstaetten.length} Sportstaetten angezeigt
          </div>
        )}

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${theme.cardBorder} ${theme.headerGradient}`}>
              <th className={`text-left px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide align-middle`}>
                #
              </th>
              <th className={`text-left px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                Name
              </th>
              <th className={`text-left px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                Adresse
              </th>
              <th className={`text-left px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                PLZ
              </th>
              <th className={`text-left px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                Stadt
              </th>
              <th className={`text-center px-3 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                Hallen / Felder
              </th>
              <th className={`text-right px-5 py-3 font-semibold ${theme.standingsHeaderText} text-xs uppercase tracking-wide`}>
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSportstaetten.map((s, i) => (
              <tr
                key={s.id}
                className={`border-b ${theme.cardBorder} last:border-0 transition-colors hover:${theme.cardBg}`}
              >
                <td className={`px-3 py-3 ${theme.textMuted} font-mono text-xs`}>
                  {i + 1}
                </td>
                <td className={`px-3 py-3 font-medium ${theme.textPrimary}`}>
                  {editingId === s.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSave()}
                      className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-3 py-1.5 text-sm w-full focus:ring-2 ${theme.focusRing} outline-none`}
                      autoFocus
                    />
                  ) : (
                    s.name
                  )}
                </td>
                <td className={`px-3 py-3 ${theme.textSecondary}`}>
                  {editingId === s.id ? (
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-3 py-1.5 text-sm w-full`}
                      placeholder="Adresse..."
                    />
                  ) : (
                    <span className="text-sm">{s.address ?? "-"}</span>
                  )}
                </td>
                <td className={`px-3 py-3 ${theme.textSecondary}`}>
                  {editingId === s.id ? (
                    <input
                      type="text"
                      value={editZip}
                      onChange={(e) => setEditZip(e.target.value)}
                      className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-2 py-1.5 text-sm w-20`}
                      placeholder="PLZ"
                    />
                  ) : (
                    <span className="text-sm">{s.zip ?? "-"}</span>
                  )}
                </td>
                <td className={`px-3 py-3 ${theme.textSecondary}`}>
                  {editingId === s.id ? (
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg px-3 py-1.5 text-sm w-full`}
                      placeholder="Stadt..."
                    />
                  ) : (
                    <span className="text-sm">{s.city ?? "-"}</span>
                  )}
                </td>
                <td className={`px-3 py-3 ${theme.textSecondary}`}>
                  {editingId === s.id ? (
                    <div className="min-w-[200px]">
                      <HallEditor halls={editHalls} onChange={setEditHalls} theme={theme} compact />
                    </div>
                  ) : (
                    <span className="text-sm text-center block">{formatHallsSummary(s)}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {editingId === s.id ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={handleSave}
                        className={`${theme.activeBadgeText} text-sm font-medium`}
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className={`${theme.textMuted} hover:opacity-80 text-sm`}
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => handleEdit(s)}
                        className={`${theme.textMuted} hover:${theme.activeBadgeText} text-sm transition-colors`}
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDeleteSingle(s)}
                        className={`${theme.textMuted} hover:text-rose-600 text-sm transition-colors`}
                      >
                        Loeschen
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filteredSportstaetten.length === 0 && (
              <tr>
                <td colSpan={7} className={`px-5 py-12 text-center ${theme.textMuted}`}>
                  {sportstaetten.length === 0
                    ? "Noch keine Sportstaetten vorhanden."
                    : "Keine Sportstaetten fuer diesen Filter gefunden."}
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
                Sportstaette loeschen?
              </h3>
              <div className={`text-sm ${theme.textSecondary} mt-3`}>
                <div className="space-y-1">
                  {deleteTarget.names.map((n, i) => (
                    <div key={i} className={`font-medium ${theme.textPrimary}`}>
                      {n}
                    </div>
                  ))}
                </div>
                <p className={`mt-3 ${theme.textMuted} text-xs`}>
                  Diese Aktion kann nicht rueckgaengig gemacht werden.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className={`flex-1 ${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium`}
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-rose-600 text-white px-4 py-2.5 rounded-xl hover:bg-rose-700 transition-all text-sm font-medium"
              >
                Loeschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
