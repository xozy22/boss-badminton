import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { createPlayer, getPlayers } from "../../lib/db";
import type { Gender, Player } from "../../lib/types";
import { useTheme } from "../../lib/ThemeContext";
import { useT } from "../../lib/I18nContext";

interface ExcelImportProps {
  onImportDone: () => void;
  onClose: () => void;
}

type Step = "upload" | "mapping" | "preview" | "done";

const GENDER_MAP: Record<string, Gender> = {
  m: "m",
  M: "m",
  herr: "m",
  Herr: "m",
  mann: "m",
  Mann: "m",
  male: "m",
  Male: "m",
  maennlich: "m",
  männlich: "m",
  Männlich: "m",
  h: "m",
  H: "m",
  f: "f",
  F: "f",
  dame: "f",
  Dame: "f",
  frau: "f",
  Frau: "f",
  female: "f",
  Female: "f",
  weiblich: "f",
  Weiblich: "f",
  w: "f",
  W: "f",
  d: "f",
  D: "f",
};

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function findFuzzyMatch(name: string, existingNames: { lower: string; original: string }[], threshold = 0.75): string | null {
  const lower = name.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;
  for (const existing of existingNames) {
    if (existing.lower === lower) continue; // exact match handled separately
    const score = similarity(lower, existing.lower);
    if (score >= threshold && score > bestScore) {
      bestScore = score;
      bestMatch = existing.original;
    }
  }
  return bestMatch;
}

function parseGender(val: unknown): Gender | null {
  if (val == null) return null;
  const str = String(val).trim();
  return GENDER_MAP[str] ?? null;
}

export default function ExcelImport({ onImportDone, onClose }: ExcelImportProps) {
  const { theme } = useTheme();
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);

  // Mapping
  const [nameCol, setNameCol] = useState("");
  const [genderCol, setGenderCol] = useState("");
  const [birthYearCol, setBirthYearCol] = useState("");
  const [clubCol, setClubCol] = useState("");
  const [defaultGender, setDefaultGender] = useState<Gender>("m");

  // Existing players for duplicate check
  const [existingPlayers, setExistingPlayers] = useState<Player[]>([]);

  // Preview
  const [previewRows, setPreviewRows] = useState<
    { name: string; gender: Gender; birthYear: number | null; club: string | null; valid: boolean; duplicate: boolean; fuzzyMatch: string | null; skipFuzzy: boolean }[]
  >([]);
  const [importCount, setImportCount] = useState(0);
  const [importing, setImporting] = useState(false);

  // Workbook ref for sheet switching
  const workbookRef = useRef<XLSX.WorkBook | null>(null);

  useEffect(() => {
    getPlayers().then(setExistingPlayers);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      workbookRef.current = wb;

      setSheets(wb.SheetNames);
      if (wb.SheetNames.length > 0) {
        loadSheet(wb, wb.SheetNames[0]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    setSelectedSheet(sheetName);
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    setRawData(json);

    if (json.length > 0) {
      const cols = Object.keys(json[0]);
      setColumns(cols);

      // Auto-detect columns
      const nameLower = cols.find((c) =>
        ["name", "spieler", "spielername", "vorname", "nachname", "teilnehmer"].includes(
          c.toLowerCase()
        )
      );
      const genderLower = cols.find((c) =>
        ["geschlecht", "gender", "sex", "m/w", "m/f"].includes(c.toLowerCase())
      );

      const ageLower = cols.find((c) =>
        ["alter", "age", "jahrgang", "geburtsjahr", "birth_year", "birth year", "born", "geb", "geb."].includes(c.toLowerCase())
      );
      const clubLower = cols.find((c) =>
        ["verein", "club", "team", "mannschaft"].includes(c.toLowerCase())
      );

      setNameCol(nameLower ?? cols[0] ?? "");
      setGenderCol(genderLower ?? "");
      setBirthYearCol(ageLower ?? "");
      setClubCol(clubLower ?? "");
    }

    setStep("mapping");
  };

  const handleSheetChange = (sheetName: string) => {
    if (workbookRef.current) {
      loadSheet(workbookRef.current, sheetName);
    }
  };

  const handlePreview = () => {
    const existingNames = new Set(
      existingPlayers.map((p) => p.name.toLowerCase().trim())
    );
    const existingNameList = existingPlayers.map((p) => ({
      lower: p.name.toLowerCase().trim(),
      original: p.name,
    }));
    const seenInImport = new Set<string>();

    const rows = rawData.map((row) => {
      const rawName = row[nameCol];
      const name = rawName != null ? String(rawName).trim() : "";
      const nameLower = name.toLowerCase();

      let gender: Gender;
      if (genderCol && row[genderCol] != null) {
        gender = parseGender(row[genderCol]) ?? defaultGender;
      } else {
        gender = defaultGender;
      }

      const duplicate =
        name.length > 0 &&
        (existingNames.has(nameLower) || seenInImport.has(nameLower));

      // Fuzzy match only if not an exact duplicate
      const fuzzyMatch = !duplicate && name.length > 0
        ? findFuzzyMatch(name, existingNameList)
        : null;

      if (name.length > 0) seenInImport.add(nameLower);

      const rawBirthYear = birthYearCol ? row[birthYearCol] : null;
      let birthYear: number | null = null;
      if (rawBirthYear != null) {
        const num = Number(rawBirthYear);
        if (num) {
          // Smart detection: values > 1900 are birth years, values < 200 are ages to convert
          birthYear = num > 1900 ? num : (num < 200 ? new Date().getFullYear() - num : null);
        }
      }
      const rawClub = clubCol ? row[clubCol] : null;
      const club = rawClub != null ? String(rawClub).trim() || null : null;

      return { name, gender, birthYear, club, valid: name.length > 0, duplicate, fuzzyMatch, skipFuzzy: false };
    });

    setPreviewRows(rows);
    setStep("preview");
  };

  const handleImport = async () => {
    setImporting(true);
    let count = 0;

    for (const row of previewRows) {
      if (!row.valid || row.duplicate || (row.fuzzyMatch && row.skipFuzzy)) continue;
      try {
        await createPlayer(row.name, row.gender, row.birthYear, row.club);
        count++;
      } catch (err) {
        console.error("Import error:", err);
      }
    }

    setImportCount(count);
    setImporting(false);
    setStep("done");
    onImportDone();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${theme.cardBg} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border ${theme.cardBorder} overflow-hidden`}>
        {/* Header */}
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className={`font-semibold text-lg ${theme.textPrimary}`}>{t.import_title}</h2>
          <button
            onClick={onClose}
            className={`${theme.textMuted} hover:opacity-80 text-xl leading-none`}
          >
            ×
          </button>
        </div>

        {/* Steps indicator */}
        <div className={`px-5 py-3 border-b ${theme.cardBorder} ${theme.headerGradient} flex gap-4 text-xs`}>
          {(["upload", "mapping", "preview", "done"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-1.5 ${
                step === s
                  ? `${theme.activeBadgeText} font-semibold`
                  : previewRows.length > 0 || i < ["upload", "mapping", "preview", "done"].indexOf(step)
                  ? theme.textSecondary
                  : theme.textMuted
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === s
                    ? `${theme.primaryBg} text-white`
                    : i < ["upload", "mapping", "preview", "done"].indexOf(step)
                    ? "bg-gray-500/70 text-white"
                    : `bg-gray-500/20 ${theme.textMuted}`
                }`}
              >
                {i + 1}
              </span>
              {s === "upload"
                ? t.import_step_file
                : s === "mapping"
                ? t.import_step_mapping
                : s === "preview"
                ? t.import_step_preview
                : t.import_step_done}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="text-center py-8">
              <div className={`mb-4 ${theme.textSecondary}`}>
                {t.import_file_hint}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className={`${theme.primaryBg} text-white px-6 py-3 rounded ${theme.primaryHoverBg} transition-colors`}
              >
                {t.import_choose_file}
              </button>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === "mapping" && (
            <div className="space-y-4">
              {sheets.length > 1 && (
                <div>
                  <label className={`block text-sm ${theme.textSecondary} mb-1`}>
                    {t.import_sheet}
                  </label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className={`w-full border rounded px-3 py-2 text-sm ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                  >
                    {sheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={`${theme.activeBadgeBg} border ${theme.cardBorder} rounded p-3 text-sm ${theme.activeBadgeText}`}>
                {t.import_rows_found.replace("{count}", String(rawData.length))}
              </div>

              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1`}>
                  {t.import_column_name}
                </label>
                <select
                  value={nameCol}
                  onChange={(e) => setNameCol(e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-sm ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                >
                  <option value="">{t.import_please_select}</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1`}>
                  {t.import_column_gender}
                </label>
                <select
                  value={genderCol}
                  onChange={(e) => setGenderCol(e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-sm ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                >
                  <option value="">{t.import_not_available}</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1`}>
                  {t.import_column_age}
                </label>
                <select
                  value={birthYearCol}
                  onChange={(e) => setBirthYearCol(e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-sm ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                >
                  <option value="">{t.import_not_available}</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm ${theme.textSecondary} mb-1`}>
                  {t.import_column_club}
                </label>
                <select
                  value={clubCol}
                  onChange={(e) => setClubCol(e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-sm ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                >
                  <option value="">{t.import_not_available}</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {!genderCol && (
                <div>
                  <label className={`block text-sm ${theme.textSecondary} mb-1`}>
                    {t.import_default_gender}
                  </label>
                  <select
                    value={defaultGender}
                    onChange={(e) => setDefaultGender(e.target.value as Gender)}
                    className={`w-full border rounded px-3 py-2 text-sm ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                  >
                    <option value="m">{t.common_gender_male}</option>
                    <option value="f">{t.common_gender_female}</option>
                  </select>
                </div>
              )}

              {/* Live preview of first rows */}
              {nameCol && rawData.length > 0 && (
                <div>
                  <div className={`text-sm ${theme.textSecondary} mb-2`}>
                    {t.import_preview_first_rows}
                  </div>
                  <table className={`w-full text-xs border ${theme.cardBorder} ${theme.inputText}`}>
                    <thead>
                      <tr className={theme.headerGradient}>
                        <th className={`px-2 py-1 text-left border ${theme.cardBorder}`}>{t.common_name}</th>
                        <th className={`px-2 py-1 text-left border ${theme.cardBorder}`}>{t.common_gender}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawData.slice(0, 5).map((row, i) => {
                        const name = row[nameCol]
                          ? String(row[nameCol]).trim()
                          : "";
                        const gender = genderCol
                          ? parseGender(row[genderCol]) ?? defaultGender
                          : defaultGender;
                        return (
                          <tr key={i} className={`border-t ${theme.cardBorder}`}>
                            <td className={`px-2 py-1 border ${theme.cardBorder}`}>
                              {name || (
                                <span className={theme.textMuted}>{t.import_empty}</span>
                              )}
                            </td>
                            <td className={`px-2 py-1 border ${theme.cardBorder}`}>
                              {gender === "m" ? t.common_gender_male : t.common_gender_female}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div>
              <div className={`mb-3 text-sm ${theme.textSecondary}`}>
                {t.import_will_import
                  .replace("{count}", String(previewRows.filter((r) => r.valid && !r.duplicate && !(r.fuzzyMatch && r.skipFuzzy)).length))
                  .replace("{total}", String(previewRows.length))}
                {previewRows.some((r) => !r.valid) && (
                  <span className="text-red-500 ml-1">
                    ({previewRows.filter((r) => !r.valid).length} {t.import_no_name})
                  </span>
                )}
                {previewRows.some((r) => r.duplicate) && (
                  <span className="text-orange-500 ml-1">
                    ({previewRows.filter((r) => r.duplicate).length} {t.import_duplicate})
                  </span>
                )}
                {previewRows.some((r) => r.fuzzyMatch) && (
                  <span className="text-amber-500 ml-1">
                    ({t.import_fuzzy_count.replace("{count}", String(previewRows.filter((r) => r.fuzzyMatch).length))})
                  </span>
                )}
              </div>
              <div className="max-h-60 overflow-auto border rounded">
                <table className="w-full text-sm">
                  <thead className={`${theme.headerGradient} sticky top-0`}>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs">#</th>
                      <th className="px-3 py-2 text-left text-xs">{t.common_name}</th>
                      <th className="px-3 py-2 text-left text-xs">
                        {t.common_gender}
                      </th>
                      <th className="px-3 py-2 text-left text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-t ${
                          !row.valid
                            ? `bg-red-500/10 ${theme.textMuted}`
                            : row.duplicate
                            ? `bg-orange-500/10 ${theme.textMuted}`
                            : row.fuzzyMatch
                            ? `bg-amber-500/10`
                            : ""
                        }`}
                      >
                        <td className={`px-3 py-1.5 ${theme.textMuted}`}>{i + 1}</td>
                        <td className="px-3 py-1.5">
                          <div>{row.name || <em>{t.import_empty}</em>}</div>
                          {row.fuzzyMatch && (
                            <div className="text-[10px] text-amber-500 mt-0.5">
                              {t.import_fuzzy_match.replace("{name}", row.fuzzyMatch)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.gender === "m" ? t.common_gender_male : t.common_gender_female}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.duplicate ? (
                            <span className="text-orange-500 text-xs">
                              {t.import_duplicate}
                            </span>
                          ) : row.fuzzyMatch ? (
                            <button
                              onClick={() => {
                                setPreviewRows(prev => prev.map((r, idx) =>
                                  idx === i ? { ...r, skipFuzzy: !r.skipFuzzy } : r
                                ));
                              }}
                              className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                                row.skipFuzzy
                                  ? "bg-red-500/20 text-red-500"
                                  : "bg-emerald-500/20 text-emerald-600"
                              }`}
                            >
                              {row.skipFuzzy ? t.import_fuzzy_skip : t.import_fuzzy_keep}
                            </button>
                          ) : row.valid ? (
                            <span className="text-green-600 text-xs">OK</span>
                          ) : (
                            <span className="text-red-500 text-xs">
                              {t.import_no_name}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === "done" && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✓</div>
              <div className={`text-lg font-medium ${theme.activeBadgeText}`}>
                {t.import_players_imported.replace("{count}", String(importCount))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t ${theme.cardBorder} ${theme.headerGradient} flex justify-between`}>
          <button
            onClick={
              step === "done"
                ? onClose
                : step === "preview"
                ? () => setStep("mapping")
                : step === "mapping"
                ? () => {
                    setStep("upload");
                    setRawData([]);
                    setColumns([]);
                  }
                : onClose
            }
            className={`px-4 py-2 text-sm ${theme.textSecondary} hover:opacity-80`}
          >
            {step === "done" ? t.common_close : t.common_back}
          </button>

          {step === "mapping" && (
            <button
              onClick={handlePreview}
              disabled={!nameCol}
              className={`${theme.primaryBg} text-white px-4 py-2 rounded text-sm ${theme.primaryHoverBg} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {t.import_continue_preview}
            </button>
          )}
          {step === "preview" && (
            <button
              onClick={handleImport}
              disabled={importing || previewRows.filter((r) => r.valid && !r.duplicate).length === 0}
              className={`${theme.primaryBg} text-white px-4 py-2 rounded text-sm ${theme.primaryHoverBg} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {importing ? t.import_importing : t.import_import_button}
            </button>
          )}
          {step === "done" && (
            <button
              onClick={onClose}
              className={`${theme.primaryBg} text-white px-4 py-2 rounded text-sm ${theme.primaryHoverBg}`}
            >
              {t.common_done}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
