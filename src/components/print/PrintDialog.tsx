import { useState, useRef } from "react";
import PrintView from "./PrintView";
import type { PrintMode } from "./PrintView";
import type {
  Tournament,
  Player,
  Round,
  Match,
  GameSet,
  StandingEntry,
} from "../../lib/types";

interface PrintDialogProps {
  tournament: Tournament;
  players: Player[];
  rounds: Round[];
  matchesByRound: Map<number, Match[]>;
  setsByMatch: Map<number, GameSet[]>;
  standings: StandingEntry[];
  activeRoundId: number | null;
  onClose: () => void;
}

const PRINT_OPTIONS: { value: PrintMode; label: string; desc: string }[] = [
  {
    value: "report",
    label: "📊 Turnierbericht",
    desc: "Kompletter Bericht mit Highlights, Statistiken, allen Ergebnissen und Endrangliste",
  },
  {
    value: "full",
    label: "Kompletter Bericht",
    desc: "Alle Runden + Rangliste",
  },
  {
    value: "schedule",
    label: "Spielplan",
    desc: "Alle Runden mit Ergebnissen",
  },
  {
    value: "round",
    label: "Aktuelle Runde",
    desc: "Nur die ausgewaehlte Runde",
  },
  {
    value: "standings",
    label: "Rangliste",
    desc: "Aktuelle Platzierungen",
  },
];

export default function PrintDialog({
  tournament,
  players,
  rounds,
  matchesByRound,
  setsByMatch,
  standings,
  activeRoundId,
  onClose,
}: PrintDialogProps) {
  const [mode, setMode] = useState<PrintMode>("full");
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${tournament.name} - Druckansicht</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', system-ui, sans-serif; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          @page { margin: 15mm; size: A4; }
        </style>
      </head>
      <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-gray-900">🖨️ Druckansicht</h2>
            <p className="text-xs text-gray-500 mt-0.5">{tournament.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Print Mode Selection */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex gap-2">
            {PRINT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  mode === opt.value
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {PRINT_OPTIONS.find((o) => o.value === mode)?.desc}
          </p>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          <div className="bg-white shadow-lg rounded-lg mx-auto" style={{ maxWidth: 800 }}>
            <PrintView
              ref={printRef}
              tournament={tournament}
              players={players}
              rounds={rounds}
              matchesByRound={matchesByRound}
              setsByMatch={setsByMatch}
              standings={standings}
              mode={mode}
              activeRoundId={activeRoundId}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-white border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={handlePrint}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all text-sm font-medium"
          >
            🖨️ Drucken
          </button>
        </div>
      </div>
    </div>
  );
}
