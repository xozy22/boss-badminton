import { useTimer } from "../../hooks/useTimer";
import { useTheme } from "../../lib/ThemeContext";

interface Props {
  assignedAt: string | null;
  completed?: boolean;
}

export function CourtTimer({ assignedAt, completed }: Props) {
  const { theme } = useTheme();
  const elapsed = useTimer(completed ? null : assignedAt);

  if (!assignedAt) return null;

  return (
    <span
      className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
        completed
          ? "bg-gray-100 text-gray-500"
          : `${theme.activeBadgeBg} ${theme.activeBadgeText} animate-pulse`
      }`}
      title={`Gestartet: ${new Date(assignedAt).toLocaleTimeString("de-DE")}`}
    >
      ⏱ {elapsed || "00:00"}
    </span>
  );
}
