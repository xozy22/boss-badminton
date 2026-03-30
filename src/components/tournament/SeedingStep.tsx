import type { ThemeColors } from "../../lib/theme";
import type { Player } from "../../lib/types";
import { useT } from "../../lib/I18nContext";

interface SeedingStepProps {
  seedOrder: number[];
  selectedPlayerIds: Set<number>;
  players: Player[];
  theme: ThemeColors;
  dragSeedIdx: number | null;
  dragOverIdx: number | null;
  onSeedDrop: (dropIdx: number) => void;
  onMoveSeed: (idx: number, direction: -1 | 1) => void;
  onDragStart: (idx: number, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (idx: number, e: React.DragEvent) => void;
  onDragLeave: (idx: number) => void;
}

export default function SeedingStep({
  seedOrder,
  selectedPlayerIds,
  players,
  theme,
  dragSeedIdx,
  dragOverIdx,
  onSeedDrop,
  onMoveSeed,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
}: SeedingStepProps) {
  const { t } = useT();
  const filteredSeedOrder = seedOrder.filter((pid) => selectedPlayerIds.has(pid));

  return (
    <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-5`}>
      <h2 className={`font-semibold ${theme.textPrimary} mb-3`}>
        🎯 {t.seeding_title}
      </h2>
      <p className={`text-xs ${theme.textMuted} mb-3`}>
        {t.seeding_description}
      </p>
      <div className={`rounded-xl border ${theme.cardBorder} overflow-hidden`}>
        {filteredSeedOrder.map((pid, idx) => {
          const p = players.find((pl) => pl.id === pid);
          if (!p) return null;
          const isDragging = dragSeedIdx === idx;
          const isOver = dragOverIdx === idx;
          return (
            <div
              key={p.id}
              draggable
              onDragStart={(e) => onDragStart(idx, e)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onDragOver(idx, e)}
              onDragLeave={() => onDragLeave(idx)}
              onDrop={(e) => { e.preventDefault(); onSeedDrop(idx); }}
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
                {p.gender === "m" ? t.common_gender_male_short : t.common_gender_female_short}
              </span>
              <div className="flex flex-col gap-0.5" draggable={false}>
                <button
                  draggable={false}
                  onClick={() => onMoveSeed(idx, -1)}
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-emerald-600 disabled:opacity-20 disabled:cursor-default text-xs leading-none"
                  title={t.seeding_move_up}
                >
                  ▲
                </button>
                <button
                  draggable={false}
                  onClick={() => onMoveSeed(idx, 1)}
                  disabled={idx === filteredSeedOrder.length - 1}
                  className="text-gray-400 hover:text-emerald-600 disabled:opacity-20 disabled:cursor-default text-xs leading-none"
                  title={t.seeding_move_down}
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
