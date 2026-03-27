import { useTimer } from "../../hooks/useTimer";
import { useTheme } from "../../lib/ThemeContext";

const SETTINGS_KEY = "turnierplaner_settings";

function getThresholds(): { warningMin: number; dangerMin: number } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        warningMin: s.timerWarningMin ?? 20,
        dangerMin: s.timerDangerMin ?? 30,
      };
    }
  } catch {}
  return { warningMin: 20, dangerMin: 30 };
}

interface Props {
  assignedAt: string | null;
  completed?: boolean;
}

export function CourtTimer({ assignedAt, completed }: Props) {
  const { theme } = useTheme();
  const { display, totalSeconds } = useTimer(completed ? null : assignedAt);

  if (!assignedAt) return null;

  const thresholds = getThresholds();
  const elapsedMin = totalSeconds / 60;

  // Use distinct colors that work across all themes (incl. Bernstein/Orange)
  let colorClass: string;
  if (completed) {
    colorClass = "bg-gray-100 text-gray-500";
  } else if (elapsedMin >= thresholds.dangerMin) {
    colorClass = "bg-rose-600 text-white animate-pulse";
  } else if (elapsedMin >= thresholds.warningMin) {
    colorClass = "bg-yellow-400 text-yellow-900 animate-pulse";
  } else {
    colorClass = `${theme.activeBadgeBg} ${theme.activeBadgeText}`;
  }

  return (
    <span
      className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${colorClass}`}
      title={`Gestartet: ${new Date(assignedAt).toLocaleTimeString("de-DE")}${
        !completed && elapsedMin >= thresholds.warningMin
          ? ` (${elapsedMin >= thresholds.dangerMin ? "Kritisch!" : "Warnung"})`
          : ""
      }`}
    >
      ⏱ {display || "00:00"}
    </span>
  );
}
