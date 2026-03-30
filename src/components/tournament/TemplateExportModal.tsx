import { useState } from "react";
import type { ThemeColors } from "../../lib/theme";
import type { Tournament, Player } from "../../lib/types";
import { useT } from "../../lib/I18nContext";

interface TemplateExportModalProps {
  tournament: Tournament;
  players: Player[];
  theme: ThemeColors;
  onClose: () => void;
}

export default function TemplateExportModal({
  tournament,
  players,
  theme,
  onClose,
}: TemplateExportModalProps) {
  const { t } = useT();
  const [templateInclude, setTemplateInclude] = useState({ settings: true, players: true, teams: true });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${theme.cardBg} rounded-2xl shadow-2xl w-full max-w-md p-6 border ${theme.cardBorder}`}>
        <h3 className={`text-lg font-bold ${theme.textPrimary} mb-4`}>📋 {t.template_export_title}</h3>
        <p className={`text-sm ${theme.textSecondary} mb-4`}>{t.template_export_description}</p>
        <div className="space-y-3 mb-5">
          <label className={`flex items-center gap-3 p-3 rounded-xl border ${theme.cardBorder} ${templateInclude.settings ? theme.selectedBg : ''} cursor-pointer`}>
            <input type="checkbox" checked={templateInclude.settings} onChange={(e) => setTemplateInclude((p) => ({ ...p, settings: e.target.checked }))} className="rounded accent-emerald-600" />
            <div>
              <div className={`text-sm font-medium ${theme.textPrimary}`}>⚙️ {t.template_settings}</div>
              <div className={`text-xs ${theme.textMuted}`}>{t.template_settings_desc}</div>
            </div>
          </label>
          <label className={`flex items-center gap-3 p-3 rounded-xl border ${theme.cardBorder} ${templateInclude.players ? theme.selectedBg : ''} cursor-pointer`}>
            <input type="checkbox" checked={templateInclude.players} onChange={(e) => setTemplateInclude((p) => ({ ...p, players: e.target.checked, teams: e.target.checked ? p.teams : false }))} className="rounded accent-emerald-600" />
            <div>
              <div className={`text-sm font-medium ${theme.textPrimary}`}>👥 {t.template_players.replace("{count}", String(players.length))}</div>
              <div className={`text-xs ${theme.textMuted}`}>{t.template_players_desc}</div>
            </div>
          </label>
          {tournament.team_config && (
            <label className={`flex items-center gap-3 p-3 rounded-xl border ${theme.cardBorder} ${templateInclude.teams ? theme.selectedBg : ''} cursor-pointer ${!templateInclude.players ? 'opacity-40 pointer-events-none' : ''}`}>
              <input type="checkbox" checked={templateInclude.teams} disabled={!templateInclude.players} onChange={(e) => setTemplateInclude((p) => ({ ...p, teams: e.target.checked }))} className="rounded accent-emerald-600" />
              <div>
                <div className={`text-sm font-medium ${theme.textPrimary}`}>🤝 {t.template_teams}</div>
                <div className={`text-xs ${theme.textMuted}`}>{t.template_teams_desc}</div>
              </div>
            </label>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 ${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium`}
          >
            {t.common_cancel}
          </button>
          <button
            onClick={() => {
              const template: Record<string, unknown> = { version: 1 };
              if (templateInclude.settings) {
                template.name = tournament.name;
                template.mode = tournament.mode;
                template.format = tournament.format;
                template.sets_to_win = tournament.sets_to_win;
                template.points_per_set = tournament.points_per_set;
                template.courts = tournament.courts;
                template.num_groups = tournament.num_groups;
                template.qualify_per_group = tournament.qualify_per_group;
                template.entry_fee_single = tournament.entry_fee_single;
                template.entry_fee_double = tournament.entry_fee_double;
              }
              if (templateInclude.players) {
                template.players = players.map((p) => ({ id: p.id, name: p.name, gender: p.gender }));
              }
              if (templateInclude.teams && tournament.team_config) {
                try { template.team_config = JSON.parse(tournament.team_config); } catch {}
              }
              const json = JSON.stringify(template, null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${(tournament.name || "vorlage").replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ .]/g, "")}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              onClose();
            }}
            className={`flex-1 ${theme.primaryBg} text-white px-4 py-2.5 rounded-xl ${theme.primaryHoverBg} shadow-sm transition-all text-sm font-medium`}
          >
            📥 {t.template_export_button}
          </button>
        </div>
      </div>
    </div>
  );
}
