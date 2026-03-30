import { useEffect, useState, useRef } from "react";
import { wipeAllPlayers, wipeAllTournaments, getAppSetting, setAppSetting, deleteAppSetting } from "../lib/db";
import { useTheme } from "../lib/ThemeContext";
import { useT } from "../lib/I18nContext";
import type { Lang } from "../lib/I18nContext";
import { THEMES, type ThemeId, FONT_SIZES, type FontSizeId } from "../lib/theme";
import type { HallConfig } from "../lib/types";

function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

type ConfirmTarget = "players" | "tournaments" | null;

const SETTINGS_KEY = "turnierplaner_settings";

interface AppSettings {
  defaultHalls: HallConfig[];
  timerWarningMin: number;  // yellow threshold in minutes
  timerDangerMin: number;   // red threshold in minutes
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultHalls: [{ name: "Halle 1", courts: 2 }],
  timerWarningMin: 20,
  timerDangerMin: 30,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Backward compat: convert old defaultCourts to defaultHalls
      if (parsed.defaultCourts && !parsed.defaultHalls) {
        parsed.defaultHalls = [{ name: "Halle 1", courts: parsed.defaultCourts }];
        delete parsed.defaultCourts;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// Collapsible Section Component
function Section({
  title,
  icon,
  children,
  defaultOpen = false,
  borderColor,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  borderColor?: string;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const border = borderColor || theme.cardBorder;
  return (
    <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${border} overflow-hidden mb-4`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full px-6 py-4 flex items-center justify-between text-left hover:opacity-80 transition-colors`}
      >
        <span className={`font-semibold ${theme.textPrimary}`}>
          {icon} {title}
        </span>
        <span
          className={`${theme.textMuted} transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>
      {open && <div className={`px-6 pb-5 border-t ${theme.cardBorder} pt-4`}>{children}</div>}
    </div>
  );
}

export default function Settings() {
  const { theme } = useTheme();
  const { t } = useT();
  const [dbPath, setDbPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [confirmText, setConfirmText] = useState("");
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    loadDbPath();
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  };

  const loadDbPath = async () => {
    if (!isTauri()) {
      setDbPath(t.settings_db_browser_mode);
      setLoading(false);
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const path = await invoke<string>("get_db_path");
      setDbPath(path);
    } catch (err) {
      setDbPath(t.settings_db_path_error);
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
      setMessage({ type: "error", text: `${err}` });
    }
  };

  const handleChangeDir = async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.settings_db_choose_title,
      });
      if (!selected) return;
      setChanging(true);
      setMessage(null);
      const { invoke } = await import("@tauri-apps/api/core");
      const newPath = await invoke<string>("change_db_dir", { newDir: selected });
      setDbPath(newPath);
      setMessage({
        type: "success",
        text: t.settings_db_copied_message,
      });
    } catch (err) {
      setMessage({ type: "error", text: `${err}` });
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
        text: t.settings_db_reset_message,
      });
      const path = await invoke<string>("get_db_path");
      setDbPath(path);
    } catch (err) {
      setMessage({ type: "error", text: `${err}` });
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
      setMessage({ type: "success", text: t.settings_backup_success });
    } catch (err) {
      setMessage({ type: "error", text: `${err}` });
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
        title: t.settings_backup_restore,
      });
      if (!selected) return;
      const confirmed = await ask(
        t.settings_backup_restore_confirm,
        { title: t.settings_backup_restore, kind: "warning", okLabel: t.settings_backup_restore, cancelLabel: t.common_cancel }
      );
      if (!confirmed) return;
      await invoke("restore_db", { sourcePath: selected });
      setMessage({
        type: "success",
        text: t.settings_backup_restored,
      });
    } catch (err) {
      setMessage({ type: "error", text: `${err}` });
    }
  };

  const handleWipeConfirm = async () => {
    if (!confirmTarget) return;
    try {
      if (confirmTarget === "players") {
        await wipeAllPlayers();
        setMessage({ type: "success", text: t.settings_players_deleted });
      } else {
        await wipeAllTournaments();
        setMessage({ type: "success", text: t.settings_tournaments_deleted });
      }
    } catch (err) {
      setMessage({ type: "error", text: `${err}` });
    }
    setConfirmTarget(null);
    setConfirmText("");
  };

  const CONFIRM_WORD = confirmTarget === "players" ? t.settings_confirm_word_players : t.settings_confirm_word_tournaments;

  if (loading) return <div>{t.common_loading}</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className={`text-2xl font-extrabold ${theme.textPrimary} tracking-tight`}>
          {t.settings_title}
        </h1>
        <p className={`text-sm ${theme.textSecondary} mt-0.5`}>
          {t.settings_subtitle}
        </p>
      </div>

      {/* ===== Updates ===== */}
      {isTauri() && (
        <Section title={t.settings_updates} icon="🔄" defaultOpen={false}>
          <UpdateChecker />
        </Section>
      )}

      {/* ===== Language ===== */}
      <Section title={t.settings_language} icon="🌐" defaultOpen={false}>
        <LanguageSelector />
      </Section>

      {/* ===== Design ===== */}
      <Section title={t.settings_design} icon="🎨" defaultOpen={false}>
        <ThemeSelector />
        <FontSizeSelector />
        <LogoUploader />
      </Section>

      {/* ===== Voreinstellungen ===== */}
      <Section title={t.settings_defaults} icon="🎯" defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-1.5 uppercase tracking-wide`}>
              {t.settings_default_halls}
            </label>
            <div className="space-y-2">
              {settings.defaultHalls.map((hall, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hall.name}
                    onChange={(e) => {
                      const next = settings.defaultHalls.map((h, i) => i === idx ? { ...h, name: e.target.value } : h);
                      updateSetting("defaultHalls", next);
                    }}
                    className={`flex-1 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-3 py-2 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                    placeholder={t.settings_hall_name_placeholder}
                  />
                  <input
                    type="number"
                    value={hall.courts}
                    min={1}
                    max={8}
                    onChange={(e) => {
                      const next = settings.defaultHalls.map((h, i) => i === idx ? { ...h, courts: Number(e.target.value) || 1 } : h);
                      updateSetting("defaultHalls", next);
                    }}
                    className={`w-20 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-3 py-2 text-sm text-center ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                  />
                  <span className={`text-xs ${theme.textMuted} w-12`}>{t.common_fields}</span>
                  {settings.defaultHalls.length > 1 && (
                    <button
                      onClick={() => {
                        const next = settings.defaultHalls.filter((_, i) => i !== idx);
                        updateSetting("defaultHalls", next);
                      }}
                      className={`${theme.textMuted} hover:text-rose-500 text-sm transition-colors px-1`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    const next = [...settings.defaultHalls, { name: `Halle ${settings.defaultHalls.length + 1}`, courts: 2 }];
                    updateSetting("defaultHalls", next);
                  }}
                  className={`text-xs font-medium ${theme.activeBadgeText} hover:opacity-80 transition-colors`}
                >
                  {t.settings_add_hall}
                </button>
                <span className={`text-xs ${theme.textMuted}`}>
                  {t.settings_total_courts_in_halls.replace("{courts}", String(settings.defaultHalls.reduce((s, h) => s + h.courts, 0))).replace("{halls}", String(settings.defaultHalls.length))}
                </span>
              </div>
            </div>
            <span className="text-xs text-gray-400 mt-1 block">
              {t.settings_default_hint}
            </span>
          </div>

          {/* Timer Thresholds */}
          <div className={`pt-4 border-t ${theme.cardBorder}`}>
            <label className={`block text-xs font-medium ${theme.textSecondary} mb-3 uppercase tracking-wide`}>
              ⏱ {t.settings_timer_thresholds}
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0"></span>
                  <span className={`text-xs font-medium ${theme.textSecondary}`}>{t.settings_timer_warning}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={settings.timerWarningMin}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 20;
                      updateSetting("timerWarningMin", val);
                      if (val >= settings.timerDangerMin) updateSetting("timerDangerMin", val + 5);
                    }}
                    className={`w-20 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-3 py-2 text-sm text-center ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                  />
                  <span className="text-xs text-gray-400">{t.settings_timer_minutes}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0"></span>
                  <span className={`text-xs font-medium ${theme.textSecondary}`}>{t.settings_timer_critical}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={settings.timerDangerMin}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 30;
                      updateSetting("timerDangerMin", val);
                      if (val <= settings.timerWarningMin) updateSetting("timerWarningMin", Math.max(1, val - 5));
                    }}
                    className={`w-20 ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-3 py-2 text-sm text-center ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
                  />
                  <span className="text-xs text-gray-400">{t.settings_timer_minutes}</span>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {t.settings_timer_hint}
            </div>
          </div>
        </div>
      </Section>

      {/* ===== Datenbank ===== */}
      <Section title={t.settings_database} icon="💾">
        {/* Speicherort */}
        <div className="mb-5">
          <h3 className={`text-sm font-medium ${theme.textPrimary} mb-2`}>{t.settings_db_location}</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={dbPath}
              readOnly
              className={`flex-1 border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.inputBg} ${theme.textSecondary} font-mono select-all outline-none`}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            {isTauri() && (
              <button
                onClick={handleOpenFolder}
                className={`${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl ${theme.cardHoverBorder} hover:shadow-sm transition-all text-sm font-medium whitespace-nowrap`}
              >
                📂 {t.settings_db_open}
              </button>
            )}
          </div>
          {isTauri() && (
            <div className="flex gap-2">
              <button
                onClick={handleChangeDir}
                disabled={changing}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 shadow-sm transition-all text-sm font-medium disabled:bg-gray-300"
              >
                {changing ? t.settings_db_changing : `📁 ${t.settings_db_change}`}
              </button>
              <button
                onClick={handleResetToDefault}
                className={`${theme.textMuted} hover:opacity-80 px-4 py-2 rounded-xl text-sm transition-colors`}
              >
                {t.settings_db_reset_default}
              </button>
            </div>
          )}
        </div>

        {/* Backup & Restore */}
        {isTauri() && (
          <div className={`mb-5 pt-4 border-t ${theme.cardBorder}`}>
            <h3 className={`text-sm font-medium ${theme.textPrimary} mb-2`}>
              {t.settings_backup_title}
            </h3>
            <div className="flex gap-3 mb-2">
              <button
                onClick={handleBackup}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 shadow-sm transition-all text-sm font-medium"
              >
                💾 {t.settings_backup_create}
              </button>
              <button
                onClick={handleRestore}
                className={`${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2 rounded-xl hover:border-amber-300 hover:text-amber-700 transition-all text-sm font-medium`}
              >
                📥 {t.settings_backup_restore}
              </button>
            </div>
            <div className="text-xs text-gray-400 leading-relaxed">
              {t.settings_backup_hint}
            </div>
          </div>
        )}

        {/* Danger Zone */}
        <div className={`pt-4 border-t ${theme.cardBorder}`}>
          <h3 className="text-sm font-medium text-rose-600 mb-3">
            {t.settings_danger_zone}
          </h3>
          <div className="space-y-2">
            <div className={`flex items-center justify-between bg-rose-500/10 rounded-xl p-3 border border-rose-500/20`}>
              <div>
                <div className={`text-sm font-medium ${theme.textPrimary}`}>{t.settings_delete_all_players}</div>
                <div className="text-xs text-gray-400">{t.settings_delete_all_players_hint}</div>
              </div>
              <button
                onClick={() => { setConfirmTarget("players"); setConfirmText(""); setMessage(null); }}
                className={`${theme.cardBg} border border-rose-500/30 text-rose-500 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-all text-xs font-medium whitespace-nowrap ml-3`}
              >
                {t.common_delete}
              </button>
            </div>
            <div className={`flex items-center justify-between bg-rose-500/10 rounded-xl p-3 border border-rose-500/20`}>
              <div>
                <div className={`text-sm font-medium ${theme.textPrimary}`}>{t.settings_delete_all_tournaments}</div>
                <div className="text-xs text-gray-400">{t.settings_delete_all_tournaments_hint}</div>
              </div>
              <button
                onClick={() => { setConfirmTarget("tournaments"); setConfirmText(""); setMessage(null); }}
                className={`${theme.cardBg} border border-rose-500/30 text-rose-500 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-all text-xs font-medium whitespace-nowrap ml-3`}
              >
                {t.common_delete}
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Status Message */}
      {message && (
        <div
          className={`mt-2 mb-4 p-4 rounded-xl text-sm ${
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
          <div className={`${theme.cardBg} rounded-2xl shadow-2xl w-full max-w-md p-6 border ${theme.cardBorder}`}>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className={`text-lg font-bold ${theme.textPrimary}`}>{t.settings_confirm_title}</h3>
              <p className={`text-sm ${theme.textSecondary} mt-2`}>
                {confirmTarget === "players"
                  ? t.settings_confirm_players
                  : t.settings_confirm_tournaments}
              </p>
            </div>
            <div className="mb-5">
              <label className={`block text-xs font-medium ${theme.textSecondary} mb-1.5`}>
                {t.common_confirm_type.replace("{word}", "").trim()} <span className="font-bold text-rose-600">{CONFIRM_WORD}</span>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all text-center font-mono tracking-widest`}
                placeholder={CONFIRM_WORD}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmTarget(null); setConfirmText(""); }}
                className={`flex-1 ${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium`}
              >
                {t.common_cancel}
              </button>
              <button
                onClick={handleWipeConfirm}
                disabled={confirmText !== CONFIRM_WORD}
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

const LOGO_KEY = "custom_logo";
const LOGO_CACHE_KEY = "turnierplaner_logo_cache"; // localStorage cache for sync access

// Sync getter (uses localStorage cache, populated from DB on load)
export function getCustomLogo(): string | null {
  try { return localStorage.getItem(LOGO_CACHE_KEY); } catch { return null; }
}

// Async: load from DB and update cache
async function loadLogoFromDb(): Promise<string | null> {
  const logo = await getAppSetting(LOGO_KEY);
  if (logo) {
    localStorage.setItem(LOGO_CACHE_KEY, logo);
  } else {
    localStorage.removeItem(LOGO_CACHE_KEY);
  }
  return logo;
}

// Save to DB + cache
async function saveLogoToDb(dataUrl: string): Promise<void> {
  await setAppSetting(LOGO_KEY, dataUrl);
  localStorage.setItem(LOGO_CACHE_KEY, dataUrl);
}

// Delete from DB + cache
async function deleteLogoFromDb(): Promise<void> {
  await deleteAppSetting(LOGO_KEY);
  localStorage.removeItem(LOGO_CACHE_KEY);
}

function LogoCropper({
  imageSrc,
  onSave,
  onCancel,
}: {
  imageSrc: string;
  onSave: (croppedDataUrl: string) => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const OUTPUT_SIZE = 256; // final image px (1:1 square)

  const [imgLoaded, setImgLoaded] = useState(false);
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, size: 100 });
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, bx: 0, by: 0, bs: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;

      // Fit image into container (max 400px)
      const maxW = 400;
      const maxH = 400;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const dw = Math.round(img.width * scale);
      const dh = Math.round(img.height * scale);
      setDisplaySize({ w: dw, h: dh });

      // Initial crop box: centered square, as large as possible
      const initSize = Math.min(dw, dh) * 0.8;
      setCropBox({
        x: (dw - initSize) / 2,
        y: (dh - initSize) / 2,
        size: initSize,
      });
      setImgLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw overlay
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const { w, h } = displaySize;
    canvasRef.current.width = w;
    canvasRef.current.height = h;

    // Draw image
    ctx.drawImage(imgRef.current, 0, 0, w, h);

    // Dark overlay outside crop
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, w, h);

    // Clear crop area (show original image)
    ctx.clearRect(cropBox.x, cropBox.y, cropBox.size, cropBox.size);
    ctx.drawImage(
      imgRef.current,
      0, 0, imgRef.current.width, imgRef.current.height,
      0, 0, w, h
    );
    // Re-darken outside
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    // Top
    ctx.fillRect(0, 0, w, cropBox.y);
    // Bottom
    ctx.fillRect(0, cropBox.y + cropBox.size, w, h - cropBox.y - cropBox.size);
    // Left
    ctx.fillRect(0, cropBox.y, cropBox.x, cropBox.size);
    // Right
    ctx.fillRect(cropBox.x + cropBox.size, cropBox.y, w - cropBox.x - cropBox.size, cropBox.size);

    // Crop border
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(cropBox.x, cropBox.y, cropBox.size, cropBox.size);

    // Corner handles
    const hs = 8;
    ctx.fillStyle = "#fff";
    // Bottom-right resize handle
    ctx.fillRect(cropBox.x + cropBox.size - hs, cropBox.y + cropBox.size - hs, hs, hs);
  }, [imgLoaded, cropBox, displaySize]);

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { mx: 0, my: 0 };
    return { mx: e.clientX - rect.left, my: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { mx, my } = getPos(e);
    const { x, y, size } = cropBox;
    const hs = 12;

    // Check resize handle (bottom-right)
    if (mx >= x + size - hs && mx <= x + size + 4 && my >= y + size - hs && my <= y + size + 4) {
      setDragging("resize");
      setDragStart({ mx, my, bx: x, by: y, bs: size });
      return;
    }

    // Check inside crop = move
    if (mx >= x && mx <= x + size && my >= y && my <= y + size) {
      setDragging("move");
      setDragStart({ mx, my, bx: x, by: y, bs: size });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const { mx, my } = getPos(e);
    const dx = mx - dragStart.mx;
    const dy = my - dragStart.my;
    const { w, h } = displaySize;
    const minSize = 40;

    if (dragging === "move") {
      const newX = Math.max(0, Math.min(w - cropBox.size, dragStart.bx + dx));
      const newY = Math.max(0, Math.min(h - cropBox.size, dragStart.by + dy));
      setCropBox((b) => ({ ...b, x: newX, y: newY }));
    } else if (dragging === "resize") {
      // Keep aspect 1:1, use diagonal distance
      const delta = Math.max(dx, dy);
      let newSize = Math.max(minSize, dragStart.bs + delta);
      // Clamp to container
      newSize = Math.min(newSize, w - cropBox.x, h - cropBox.y);
      setCropBox((b) => ({ ...b, size: newSize }));
    }
  };

  const handleMouseUp = () => setDragging(null);

  const handleSave = () => {
    if (!imgRef.current) return;
    const { w, h } = displaySize;
    const img = imgRef.current;

    // Convert display coords to original image coords
    const scaleX = img.width / w;
    const scaleY = img.height / h;
    const sx = cropBox.x * scaleX;
    const sy = cropBox.y * scaleY;
    const ss = cropBox.size * Math.min(scaleX, scaleY);

    // Draw cropped area to output canvas
    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(img, sx, sy, ss, ss, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    onSave(out.toDataURL("image/png", 0.9));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${theme.cardBg} rounded-2xl shadow-2xl border ${theme.cardBorder} p-6 max-w-lg w-full`}>
        <h3 className={`text-lg font-bold ${theme.textPrimary} mb-1`}>{t.settings_logo_crop_title}</h3>
        <p className={`text-xs ${theme.textMuted} mb-4`}>
          {t.settings_logo_crop_hint}
        </p>

        {/* Canvas */}
        <div ref={containerRef} className="flex justify-center mb-4">
          <canvas
            ref={canvasRef}
            width={displaySize.w || 400}
            height={displaySize.h || 400}
            className="rounded-lg cursor-crosshair select-none"
            style={{ maxWidth: "100%" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className={`${theme.cardBg} border ${theme.inputBorder} ${theme.textSecondary} px-4 py-2 rounded-xl hover:opacity-80 transition-all text-sm font-medium`}
          >
            {t.common_cancel}
          </button>
          <button
            onClick={handleSave}
            className={`${theme.primaryBg} text-white px-4 py-2 rounded-xl ${theme.primaryHoverBg} shadow-sm transition-all text-sm font-medium`}
          >
            {t.settings_logo_crop_save}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogoUploader() {
  const { theme } = useTheme();
  const { t } = useT();
  const [logo, setLogo] = useState<string | null>(() => getCustomLogo());
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load from DB on mount (updates cache)
  useEffect(() => {
    loadLogoFromDb().then((dbLogo) => {
      setLogo(dbLogo);
    });
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 10MB for source (will be cropped+compressed to ~256x256 PNG)
    if (file.size > 10 * 1024 * 1024) {
      alert(t.settings_logo_too_large);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleCropSave = async (croppedDataUrl: string) => {
    await saveLogoToDb(croppedDataUrl);
    setLogo(croppedDataUrl);
    setCropSrc(null);
    window.dispatchEvent(new Event("logo-changed"));
  };

  const handleRemove = async () => {
    await deleteLogoFromDb();
    setLogo(null);
    window.dispatchEvent(new Event("logo-changed"));
  };

  return (
    <div className={`mt-5 pt-5 border-t ${theme.cardBorder}`}>
      <label className={`block text-xs font-medium ${theme.textSecondary} mb-3 uppercase tracking-wide`}>
        {t.settings_club_logo}
      </label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div
          className={`w-16 h-16 rounded-xl border-2 border-dashed ${theme.inputBorder} flex items-center justify-center overflow-hidden shrink-0 ${
            logo ? "border-solid" : ""
          }`}
        >
          {logo ? (
            <img src={logo} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-3xl">🏸</span>
          )}
        </div>

        <div className="flex-1">
          <div className="flex gap-2 mb-1.5">
            <button
              onClick={() => fileRef.current?.click()}
              className={`${theme.primaryBg} text-white px-3 py-1.5 rounded-lg ${theme.primaryHoverBg} transition-all text-xs font-medium`}
            >
              {logo ? t.settings_logo_change : t.settings_logo_upload}
            </button>
            {logo && (
              <button
                onClick={handleRemove}
                className="text-rose-500 hover:text-rose-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                {t.settings_logo_remove}
              </button>
            )}
          </div>
          <div className={`text-[10px] ${theme.textMuted}`}>
            {t.settings_logo_hint}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Cropper Modal */}
      {cropSrc && (
        <LogoCropper
          imageSrc={cropSrc}
          onSave={handleCropSave}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}

function ThemeSelector() {
  const { themeId, theme, setThemeId } = useTheme();
  const { t } = useT();

  return (
    <div>
      <label className={`block text-xs font-medium ${theme.textSecondary} mb-3 uppercase tracking-wide`}>
        {t.settings_color_scheme}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(
          ([id, { label, preview }]) => {
            const isActive = themeId === id;
            const isDarkTheme = id === "dark";
            return (
              <button
                key={id}
                onClick={() => setThemeId(id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 ${
                  isActive
                    ? "shadow-lg"
                    : `${theme.inputBorder} hover:opacity-80 hover:shadow-sm`
                }`}
                style={isActive ? { borderColor: id === "dark" ? "#10b981" : preview, boxShadow: `0 0 0 3px ${id === "dark" ? "#10b981" : preview}40, 0 0 12px ${id === "dark" ? "#10b981" : preview}20` } : {}}
              >
                {/* Color swatch */}
                <div
                  className="w-10 h-10 rounded-xl shrink-0 shadow-inner flex items-center justify-center"
                  style={{ background: isDarkTheme ? `linear-gradient(135deg, #111827, #1f2937)` : `linear-gradient(135deg, ${preview}, ${preview}dd)` }}
                >
                  {isDarkTheme && <span className="text-lg">🌙</span>}
                </div>
                <div>
                  <div className={`text-sm font-semibold ${theme.textPrimary}`}>
                    {label}
                  </div>
                  <div className={`text-[10px] ${theme.textMuted} uppercase tracking-wide mt-0.5`}>
                    {id === "green" ? t.theme_emerald : id === "blue" ? t.theme_sapphire : id === "orange" ? t.theme_amber : t.theme_night}
                  </div>
                </div>
                {isActive && (
                  <span className="ml-auto text-sm font-bold" style={{ color: id === "dark" ? "#10b981" : preview }}>
                    ✓
                  </span>
                )}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

function LanguageSelector() {
  const { theme } = useTheme();
  const { t, lang, setLang } = useT();

  const LANGS: { id: Lang; label: string }[] = [
    { id: "en", label: "English" },
    { id: "de", label: "Deutsch" },
  ];

  return (
    <div className="mt-5">
      <label className={`block text-xs font-medium ${theme.textSecondary} mb-3 uppercase tracking-wide`}>
        {t.settings_language}
      </label>
      <div className="flex gap-2">
        {LANGS.map(({ id, label }) => {
          const isActive = lang === id;
          return (
            <button
              key={id}
              onClick={() => setLang(id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                isActive
                  ? `${theme.roundActiveBg} ${theme.roundActiveText} border-transparent shadow-md`
                  : `${theme.cardBg} ${theme.textSecondary} ${theme.inputBorder} hover:opacity-80`
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FontSizeSelector() {
  const { fontSizeId, theme, setFontSize } = useTheme();
  const { t } = useT();

  return (
    <div className="mt-5">
      <label className={`block text-xs font-medium ${theme.textSecondary} mb-3 uppercase tracking-wide`}>
        {t.settings_font_size}
      </label>
      <div className="flex gap-2">
        {(Object.entries(FONT_SIZES) as [FontSizeId, typeof FONT_SIZES[FontSizeId]][]).map(
          ([id, { label }]) => {
            const isActive = fontSizeId === id;
            return (
              <button
                key={id}
                onClick={() => setFontSize(id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                  isActive
                    ? `${theme.roundActiveBg} ${theme.roundActiveText} border-transparent shadow-md`
                    : `${theme.cardBg} ${theme.textSecondary} ${theme.inputBorder} hover:opacity-80`
                }`}
              >
                {label}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

function UpdateChecker() {
  const { theme } = useTheme();
  const { t } = useT();
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; notes: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "uptodate" | "available" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const currentVersion = __APP_VERSION__;

  const checkForUpdates = async () => {
    setChecking(true);
    setStatus("idle");
    setErrorMsg("");
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        setUpdateInfo({ version: update.version, notes: update.body || "" });
        setStatus("available");
      } else {
        setStatus("uptodate");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(String(err));
    } finally {
      setChecking(false);
    }
  };

  const installUpdate = async () => {
    setDownloading(true);
    setProgress(0);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      const update = await check();
      if (!update) return;

      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            setProgress(Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)));
          }
        } else if (event.event === "Finished") {
          setProgress(100);
        }
      });

      // Restart after install
      await relaunch();
    } catch (err) {
      setStatus("error");
      setErrorMsg(`${t.settings_update_failed}: ${err}`);
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className={`text-sm font-medium ${theme.textPrimary}`}>
            {t.settings_current_version} <span className="font-mono">{currentVersion}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {t.settings_check_updates_hint}
          </div>
        </div>
        <button
          onClick={checkForUpdates}
          disabled={checking || downloading}
          className={`${theme.primaryBg} text-white px-4 py-2 rounded-xl ${theme.primaryHoverBg} shadow-sm transition-all text-sm font-medium disabled:opacity-50`}
        >
          {checking ? t.settings_checking : `🔄 ${t.settings_check_updates}`}
        </button>
      </div>

      {status === "uptodate" && (
        <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
          ✅ {t.settings_up_to_date.replace("{version}", currentVersion)}
        </div>
      )}

      {status === "available" && updateInfo && (
        <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-xl p-4`}>
          <div className={`text-sm font-semibold ${theme.textPrimary} mb-1`}>
            🎉 {t.settings_new_version.replace("{version}", "")} <span className="font-mono">{updateInfo.version}</span>
          </div>
          {updateInfo.notes && (
            <div className={`text-xs ${theme.textSecondary} mb-3 whitespace-pre-line max-h-32 overflow-y-auto`}>
              {updateInfo.notes}
            </div>
          )}
          {downloading ? (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-500">{progress}%</span>
              </div>
              <div className="text-xs text-gray-400">
                {t.settings_downloading}
              </div>
            </div>
          ) : (
            <button
              onClick={installUpdate}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 shadow-sm transition-all text-sm font-medium"
            >
              ⬇️ {t.settings_install_update}
            </button>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl px-4 py-3 text-sm">
          ❌ {errorMsg || t.settings_update_failed}
        </div>
      )}
    </div>
  );
}

export type { AppSettings };
