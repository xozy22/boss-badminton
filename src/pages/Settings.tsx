import { useEffect, useState } from "react";
import { wipeAllPlayers, wipeAllTournaments } from "../lib/db";

function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

type ConfirmTarget = "players" | "tournaments" | null;

export default function Settings() {
  const [dbPath, setDbPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    loadDbPath();
  }, []);

  const loadDbPath = async () => {
    if (!isTauri()) {
      setDbPath("Browser-Modus (localStorage)");
      setLoading(false);
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const path = await invoke<string>("get_db_path");
      setDbPath(path);
    } catch (err) {
      setDbPath("Pfad konnte nicht ermittelt werden");
    }
    setLoading(false);
  };

  const handleOpenFolder = async () => {
    if (!isTauri()) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const dir = await invoke<string>("get_db_dir");
      await invoke("open_folder", { path: dir });
    } catch (err) {
      setMessage({ type: "error", text: `Fehler: ${err}` });
    }
  };

  const handleChangeDir = async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Neuen Speicherort fuer die Datenbank waehlen",
      });

      if (!selected) return;

      setChanging(true);
      setMessage(null);

      const { invoke } = await import("@tauri-apps/api/core");
      const newPath = await invoke<string>("change_db_dir", {
        newDir: selected,
      });

      setDbPath(newPath);
      setMessage({
        type: "success",
        text: "Datenbank wurde kopiert. Bitte starte die App neu, damit der neue Speicherort verwendet wird.",
      });
    } catch (err) {
      setMessage({ type: "error", text: `Fehler: ${err}` });
    } finally {
      setChanging(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!isTauri()) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { appDataDir } = await import("@tauri-apps/api/path");
      const { remove } = await import("@tauri-apps/plugin-fs");
      const dir = await appDataDir();
      await remove(dir + "db_config.json");
      setMessage({
        type: "success",
        text: "Speicherort auf Standard zurueckgesetzt. Bitte starte die App neu.",
      });
      const path = await invoke<string>("get_db_path");
      setDbPath(path);
    } catch (err) {
      setMessage({
        type: "error",
        text: `Fehler beim Zuruecksetzen: ${err}`,
      });
    }
  };

  const handleBackup = async () => {
    if (!isTauri()) return;
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");

      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;

      const path = await save({
        defaultPath: `turnierplaner_backup_${stamp}.db`,
        filters: [
          { name: "SQLite Datenbank (*.db)", extensions: ["db"] },
          { name: "Alle Dateien (*.*)", extensions: ["*"] },
        ],
      });

      if (!path) return;

      await invoke("backup_db", { targetPath: path });
      setMessage({
        type: "success",
        text: `Backup erfolgreich gespeichert.`,
      });
    } catch (err) {
      setMessage({ type: "error", text: `Backup fehlgeschlagen: ${err}` });
    }
  };

  const handleRestore = async () => {
    if (!isTauri()) return;
    try {
      const { open, ask } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");

      const selected = await open({
        multiple: false,
        filters: [
          { name: "SQLite Datenbank (*.db)", extensions: ["db"] },
          { name: "Alle Dateien (*.*)", extensions: ["*"] },
        ],
        title: "Backup-Datei auswaehlen",
      });

      if (!selected) return;

      const confirmed = await ask(
        "Die aktuelle Datenbank wird durch das Backup ersetzt. Alle aktuellen Daten gehen verloren!\n\nBitte starte die App nach der Wiederherstellung neu.\n\nFortfahren?",
        {
          title: "Backup wiederherstellen",
          kind: "warning",
          okLabel: "Wiederherstellen",
          cancelLabel: "Abbrechen",
        }
      );

      if (!confirmed) return;

      await invoke("restore_db", { sourcePath: selected });
      setMessage({
        type: "success",
        text: "Datenbank wurde wiederhergestellt. Bitte starte die App jetzt neu, damit die Aenderungen wirksam werden.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: `Wiederherstellung fehlgeschlagen: ${err}`,
      });
    }
  };

  const handleWipeConfirm = async () => {
    if (!confirmTarget) return;
    try {
      if (confirmTarget === "players") {
        await wipeAllPlayers();
        setMessage({ type: "success", text: "Alle Spieler wurden geloescht." });
      } else {
        await wipeAllTournaments();
        setMessage({ type: "success", text: "Alle Turniere und Ergebnisse wurden geloescht." });
      }
    } catch (err) {
      setMessage({ type: "error", text: `Fehler: ${err}` });
    }
    setConfirmTarget(null);
    setConfirmText("");
  };

  const CONFIRM_WORD = confirmTarget === "players" ? "SPIELER" : "TURNIERE";

  if (loading) return <div>Laden...</div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Einstellungen
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          App-Konfiguration und Datenverwaltung.
        </p>
      </div>

      {/* Database Path */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
        <h2 className="font-semibold text-gray-800 mb-4">
          💾 Datenbank-Speicherort
        </h2>

        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
            Aktueller Pfad
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={dbPath}
              readOnly
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-600 font-mono select-all outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            {isTauri() && (
              <button
                onClick={handleOpenFolder}
                className="bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl hover:border-emerald-300 hover:shadow-sm transition-all text-sm font-medium whitespace-nowrap"
                title="Ordner im Explorer oeffnen"
              >
                📂 Oeffnen
              </button>
            )}
          </div>
        </div>

        {isTauri() && (
          <div className="flex gap-2">
            <button
              onClick={handleChangeDir}
              disabled={changing}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all text-sm font-medium disabled:bg-gray-300"
            >
              {changing ? "Kopiere..." : "📁 Speicherort aendern"}
            </button>
            <button
              onClick={handleResetToDefault}
              className="text-gray-400 hover:text-gray-600 px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              Standard wiederherstellen
            </button>
          </div>
        )}

        <div className="mt-5 text-xs text-gray-400 leading-relaxed">
          Die Datenbank enthaelt alle Spieler, Turniere und Ergebnisse.
          Beim Aendern des Speicherorts wird die Datenbank an den neuen Ort
          kopiert. Nach dem Neustart der App wird der neue Speicherort
          verwendet.
        </div>
      </div>

      {/* Backup & Restore */}
      {isTauri() && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
          <h2 className="font-semibold text-gray-800 mb-1">
            📦 Backup & Wiederherstellung
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Erstelle ein Backup der Datenbank oder stelle ein vorheriges Backup wieder her.
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleBackup}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all text-sm font-medium"
            >
              💾 Backup erstellen
            </button>
            <button
              onClick={handleRestore}
              className="bg-white border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl hover:border-amber-300 hover:text-amber-700 transition-all text-sm font-medium"
            >
              📥 Backup wiederherstellen
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-400 leading-relaxed">
            Das Backup speichert eine Kopie der gesamten Datenbank (Spieler, Turniere, Ergebnisse).
            Beim Wiederherstellen wird die aktuelle Datenbank durch das Backup ersetzt.
            <strong className="text-gray-500"> Die App muss danach neu gestartet werden.</strong>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl shadow-sm border border-rose-200 p-6">
        <h2 className="font-semibold text-rose-700 mb-1">
          ⚠️ Gefahrenzone
        </h2>
        <p className="text-xs text-gray-400 mb-5">
          Diese Aktionen koennen nicht rueckgaengig gemacht werden.
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between bg-rose-50/50 rounded-xl p-4 border border-rose-100">
            <div>
              <div className="text-sm font-medium text-gray-800">
                Alle Spieler loeschen
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Entfernt alle Spieler. Turnierzuordnungen bleiben bestehen, aber ohne Spieler-Referenz.
              </div>
            </div>
            <button
              onClick={() => {
                setConfirmTarget("players");
                setConfirmText("");
                setMessage(null);
              }}
              className="bg-white border border-rose-200 text-rose-600 px-4 py-2 rounded-xl hover:bg-rose-50 hover:border-rose-300 transition-all text-sm font-medium whitespace-nowrap ml-4"
            >
              Spieler loeschen
            </button>
          </div>

          <div className="flex items-center justify-between bg-rose-50/50 rounded-xl p-4 border border-rose-100">
            <div>
              <div className="text-sm font-medium text-gray-800">
                Alle Turniere loeschen
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Entfernt alle Turniere, Runden, Spiele und Ergebnisse. Spieler bleiben erhalten.
              </div>
            </div>
            <button
              onClick={() => {
                setConfirmTarget("tournaments");
                setConfirmText("");
                setMessage(null);
              }}
              className="bg-white border border-rose-200 text-rose-600 px-4 py-2 rounded-xl hover:bg-rose-50 hover:border-rose-300 transition-all text-sm font-medium whitespace-nowrap ml-4"
            >
              Turniere loeschen
            </button>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`mt-5 p-4 rounded-xl text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-gray-900">
                Bist du sicher?
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                {confirmTarget === "players"
                  ? "Alle Spieler werden unwiderruflich geloescht."
                  : "Alle Turniere, Runden, Spiele und Ergebnisse werden unwiderruflich geloescht."}
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Tippe <span className="font-bold text-rose-600">{CONFIRM_WORD}</span> zur Bestaetigung:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-center font-mono tracking-widest"
                placeholder={CONFIRM_WORD}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmTarget(null);
                  setConfirmText("");
                }}
                className="flex-1 bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={handleWipeConfirm}
                disabled={confirmText !== CONFIRM_WORD}
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
