export type ThemeId = "green" | "blue" | "orange" | "dark";

export interface ThemeColors {
  // Sidebar
  sidebarBg: string;
  sidebarBorder: string;
  sidebarActiveBg: string;
  sidebarActiveShadow: string;
  sidebarText: string;
  sidebarHoverBg: string;
  sidebarAccent: string; // "TURNIERPLANER" text

  // Page background
  pageBg: string;

  // Primary action buttons
  primaryBg: string;
  primaryHoverBg: string;
  primaryText: string;

  // Cards & Borders
  cardBg: string;
  cardBorder: string;
  cardHoverBorder: string;
  headerGradient: string; // table headers etc

  // Focus rings
  focusBorder: string;
  focusRing: string;

  // Selected / Active states
  selectedBg: string;
  selectedText: string;
  selectedRing: string;

  // Stat cards on home
  statCard1: string;
  statCard2: string; // amber stays same
  statCard3: string; // violet stays same

  // Round tabs
  roundActiveBg: string;
  roundActiveText: string;

  // Standings
  standingsHeaderBg: string;
  standingsHeaderText: string;

  // Scrollbar
  scrollbarThumb: string;
  scrollbarThumbHover: string;

  // Court accent (for active court border + badge)
  courtBorder: string;
  courtBadgeBg: string;
  courtBadgeText: string;

  // Completed match border
  completedBorder: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Badge (gender, status)
  activeBadgeBg: string;
  activeBadgeText: string;

  // Input
  inputBg: string;
  inputBorder: string;
  inputText: string;

  // Body bg (for dark mode)
  bodyBg: string;
}

const greenTheme: ThemeColors = {
  sidebarBg: "bg-gradient-to-b from-emerald-950 via-emerald-950 to-gray-950",
  sidebarBorder: "border-emerald-800/50",
  sidebarActiveBg: "bg-emerald-600",
  sidebarActiveShadow: "shadow-emerald-900/30",
  sidebarText: "text-emerald-200/70",
  sidebarHoverBg: "hover:bg-emerald-900/50",
  sidebarAccent: "text-emerald-400",
  pageBg: "bg-gradient-to-br from-emerald-50 via-gray-50 to-white",
  primaryBg: "bg-emerald-600",
  primaryHoverBg: "hover:bg-emerald-700",
  primaryText: "text-white",
  cardBg: "bg-white",
  cardBorder: "border-gray-100",
  cardHoverBorder: "hover:border-emerald-200",
  headerGradient: "bg-gradient-to-r from-emerald-50 to-transparent",
  focusBorder: "focus:border-emerald-400",
  focusRing: "focus:ring-emerald-100",
  selectedBg: "bg-emerald-50/70",
  selectedText: "text-emerald-800",
  selectedRing: "ring-emerald-200",
  statCard1: "bg-gradient-to-br from-emerald-500 to-emerald-700",
  statCard2: "bg-gradient-to-br from-amber-400 to-amber-600",
  statCard3: "bg-gradient-to-br from-violet-500 to-violet-700",
  roundActiveBg: "bg-emerald-600",
  roundActiveText: "text-white",
  standingsHeaderBg: "bg-gradient-to-r from-emerald-50 to-transparent",
  standingsHeaderText: "text-emerald-800",
  courtBorder: "border-emerald-400",
  courtBadgeBg: "bg-emerald-600",
  courtBadgeText: "text-white",
  scrollbarThumb: "#a7f3d0",
  scrollbarThumbHover: "#6ee7b7",
  completedBorder: "border-l-emerald-500",
  textPrimary: "text-gray-900",
  textSecondary: "text-gray-500",
  textMuted: "text-gray-400",
  activeBadgeBg: "bg-emerald-100",
  activeBadgeText: "text-emerald-700",
  inputBg: "bg-white",
  inputBorder: "border-gray-200",
  inputText: "text-gray-900",
  bodyBg: "",
};

const blueTheme: ThemeColors = {
  sidebarBg: "bg-gradient-to-b from-blue-950 via-blue-950 to-gray-950",
  sidebarBorder: "border-blue-800/50",
  sidebarActiveBg: "bg-blue-600",
  sidebarActiveShadow: "shadow-blue-900/30",
  sidebarText: "text-blue-200/70",
  sidebarHoverBg: "hover:bg-blue-900/50",
  sidebarAccent: "text-blue-400",
  pageBg: "bg-gradient-to-br from-blue-50 via-gray-50 to-white",
  primaryBg: "bg-blue-600",
  primaryHoverBg: "hover:bg-blue-700",
  primaryText: "text-white",
  cardBg: "bg-white",
  cardBorder: "border-gray-100",
  cardHoverBorder: "hover:border-blue-200",
  headerGradient: "bg-gradient-to-r from-blue-50 to-transparent",
  focusBorder: "focus:border-blue-400",
  focusRing: "focus:ring-blue-100",
  selectedBg: "bg-blue-50/70",
  selectedText: "text-blue-800",
  selectedRing: "ring-blue-200",
  statCard1: "bg-gradient-to-br from-blue-500 to-blue-700",
  statCard2: "bg-gradient-to-br from-amber-400 to-amber-600",
  statCard3: "bg-gradient-to-br from-violet-500 to-violet-700",
  roundActiveBg: "bg-blue-600",
  roundActiveText: "text-white",
  standingsHeaderBg: "bg-gradient-to-r from-blue-50 to-transparent",
  standingsHeaderText: "text-blue-800",
  courtBorder: "border-blue-400",
  courtBadgeBg: "bg-blue-600",
  courtBadgeText: "text-white",
  scrollbarThumb: "#93c5fd",
  scrollbarThumbHover: "#60a5fa",
  completedBorder: "border-l-blue-500",
  textPrimary: "text-gray-900",
  textSecondary: "text-gray-500",
  textMuted: "text-gray-400",
  activeBadgeBg: "bg-blue-100",
  activeBadgeText: "text-blue-700",
  inputBg: "bg-white",
  inputBorder: "border-gray-200",
  inputText: "text-gray-900",
  bodyBg: "",
};

const orangeTheme: ThemeColors = {
  sidebarBg: "bg-gradient-to-b from-orange-950 via-orange-950 to-gray-950",
  sidebarBorder: "border-orange-800/50",
  sidebarActiveBg: "bg-orange-600",
  sidebarActiveShadow: "shadow-orange-900/30",
  sidebarText: "text-orange-200/70",
  sidebarHoverBg: "hover:bg-orange-900/50",
  sidebarAccent: "text-orange-400",
  pageBg: "bg-gradient-to-br from-orange-50 via-gray-50 to-white",
  primaryBg: "bg-orange-600",
  primaryHoverBg: "hover:bg-orange-700",
  primaryText: "text-white",
  cardBg: "bg-white",
  cardBorder: "border-gray-100",
  cardHoverBorder: "hover:border-orange-200",
  headerGradient: "bg-gradient-to-r from-orange-50 to-transparent",
  focusBorder: "focus:border-orange-400",
  focusRing: "focus:ring-orange-100",
  selectedBg: "bg-orange-50/70",
  selectedText: "text-orange-800",
  selectedRing: "ring-orange-200",
  statCard1: "bg-gradient-to-br from-orange-500 to-orange-700",
  statCard2: "bg-gradient-to-br from-amber-400 to-amber-600",
  statCard3: "bg-gradient-to-br from-violet-500 to-violet-700",
  roundActiveBg: "bg-orange-600",
  roundActiveText: "text-white",
  standingsHeaderBg: "bg-gradient-to-r from-orange-50 to-transparent",
  standingsHeaderText: "text-orange-800",
  courtBorder: "border-orange-400",
  courtBadgeBg: "bg-orange-600",
  courtBadgeText: "text-white",
  scrollbarThumb: "#fdba74",
  scrollbarThumbHover: "#fb923c",
  completedBorder: "border-l-orange-500",
  textPrimary: "text-gray-900",
  textSecondary: "text-gray-500",
  textMuted: "text-gray-400",
  activeBadgeBg: "bg-orange-100",
  activeBadgeText: "text-orange-700",
  inputBg: "bg-white",
  inputBorder: "border-gray-200",
  inputText: "text-gray-900",
  bodyBg: "",
};

const darkTheme: ThemeColors = {
  sidebarBg: "bg-gradient-to-b from-gray-900 via-gray-900 to-black",
  sidebarBorder: "border-gray-700/50",
  sidebarActiveBg: "bg-emerald-600",
  sidebarActiveShadow: "shadow-emerald-900/30",
  sidebarText: "text-gray-400",
  sidebarHoverBg: "hover:bg-gray-800/50",
  sidebarAccent: "text-emerald-400",
  pageBg: "bg-gray-950",
  primaryBg: "bg-emerald-600",
  primaryHoverBg: "hover:bg-emerald-700",
  primaryText: "text-white",
  cardBg: "bg-gray-900",
  cardBorder: "border-gray-800",
  cardHoverBorder: "hover:border-gray-700",
  headerGradient: "bg-gradient-to-r from-gray-800 to-transparent",
  focusBorder: "focus:border-emerald-500",
  focusRing: "focus:ring-emerald-900/50",
  selectedBg: "bg-emerald-950/50",
  selectedText: "text-emerald-300",
  selectedRing: "ring-emerald-800",
  statCard1: "bg-gradient-to-br from-emerald-700 to-emerald-900",
  statCard2: "bg-gradient-to-br from-amber-600 to-amber-800",
  statCard3: "bg-gradient-to-br from-violet-700 to-violet-900",
  roundActiveBg: "bg-emerald-600",
  roundActiveText: "text-white",
  standingsHeaderBg: "bg-gradient-to-r from-gray-800 to-transparent",
  standingsHeaderText: "text-emerald-400",
  courtBorder: "border-emerald-400",
  courtBadgeBg: "bg-emerald-600",
  courtBadgeText: "text-white",
  scrollbarThumb: "#374151",
  scrollbarThumbHover: "#4b5563",
  completedBorder: "border-l-emerald-600",
  textPrimary: "text-gray-100",
  textSecondary: "text-gray-400",
  textMuted: "text-gray-500",
  activeBadgeBg: "bg-emerald-900/50",
  activeBadgeText: "text-emerald-400",
  inputBg: "bg-gray-800",
  inputBorder: "border-gray-700",
  inputText: "text-gray-100",
  bodyBg: "bg-gray-950",
};

// Hex-Farbwerte fuer Print/Inline-Styles (nicht als Tailwind-Klassen verfuegbar)
export interface PrintColors {
  accent: string;       // Hauptakzent (Ueberschriften, Gewinner, Headerline)
  accentLight: string;  // Heller Hintergrund (Tabellen-Header, Highlight-Karten)
  accentBorder: string; // Rand fuer Highlight-Karten
  winColor: string;     // Siege-Farbe
  lossColor: string;    // Niederlagen-Farbe
}

export const PRINT_COLORS: Record<ThemeId, PrintColors> = {
  green:  { accent: "#059669", accentLight: "#f0fdf4", accentBorder: "#d1fae5", winColor: "#059669", lossColor: "#e11d48" },
  blue:   { accent: "#2563eb", accentLight: "#eff6ff", accentBorder: "#bfdbfe", winColor: "#2563eb", lossColor: "#e11d48" },
  orange: { accent: "#ea580c", accentLight: "#fff7ed", accentBorder: "#fed7aa", winColor: "#ea580c", lossColor: "#e11d48" },
  dark:   { accent: "#059669", accentLight: "#f0fdf4", accentBorder: "#d1fae5", winColor: "#059669", lossColor: "#e11d48" },
};

export const THEMES: Record<ThemeId, { label: string; colors: ThemeColors; preview: string }> = {
  green: { label: "Smaragd (Standard)", colors: greenTheme, preview: "#059669" },
  blue: { label: "Saphir", colors: blueTheme, preview: "#2563eb" },
  orange: { label: "Bernstein", colors: orangeTheme, preview: "#ea580c" },
  dark: { label: "Dunkel", colors: darkTheme, preview: "#111827" },
};

// Font size
export type FontSizeId = "xxs" | "xs" | "s" | "m" | "l" | "xl" | "xxl";

export const FONT_SIZES: Record<FontSizeId, { label: string; factor: number }> = {
  xxs: { label: "XXS", factor: 0.75 },
  xs:  { label: "XS",  factor: 0.85 },
  s:   { label: "S",   factor: 0.925 },
  m:   { label: "M",   factor: 1.0 },
  l:   { label: "L",   factor: 1.075 },
  xl:  { label: "XL",  factor: 1.15 },
  xxl: { label: "XXL", factor: 1.25 },
};

const FONTSIZE_KEY = "turnierplaner_fontsize";

export function loadFontSize(): FontSizeId {
  try {
    const stored = localStorage.getItem(FONTSIZE_KEY);
    if (stored && stored in FONT_SIZES) return stored as FontSizeId;
  } catch {}
  return "m";
}

export function saveFontSize(id: FontSizeId): void {
  localStorage.setItem(FONTSIZE_KEY, id);
}

const THEME_KEY = "turnierplaner_theme";

export function loadThemeId(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored && stored in THEMES) return stored as ThemeId;
  } catch {}
  return "green";
}

export function saveThemeId(id: ThemeId): void {
  localStorage.setItem(THEME_KEY, id);
}

export function getTheme(id?: ThemeId): ThemeColors {
  return THEMES[id ?? loadThemeId()].colors;
}
