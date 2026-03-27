import { NavLink } from "react-router-dom";
import { useTheme } from "../../lib/ThemeContext";

const links = [
  { to: "/", label: "Start", icon: "🏠" },
  { to: "/players", label: "Spieler", icon: "👥" },
  { to: "/tournaments", label: "Turniere", icon: "🏆" },
];

export default function Sidebar() {
  const { theme } = useTheme();

  return (
    <aside className={`w-60 ${theme.sidebarBg} text-white min-h-screen flex flex-col shrink-0`}>
      {/* Branding */}
      <div className={`p-5 border-b ${theme.sidebarBorder}`}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏸</div>
          <div>
            <div className="text-base font-bold tracking-tight text-white">
              Badminton
            </div>
            <div className={`text-xs font-medium ${theme.sidebarAccent} tracking-wide uppercase`}>
              Turnierplaner
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? `${theme.sidebarActiveBg} text-white shadow-lg ${theme.sidebarActiveShadow}`
                  : `${theme.sidebarText} ${theme.sidebarHoverBg} hover:text-white`
              }`
            }
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Settings - bottom */}
      <div className={`p-3 border-t ${theme.sidebarBorder}`}>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive
                ? `${theme.sidebarActiveBg} text-white shadow-lg ${theme.sidebarActiveShadow}`
                : `${theme.sidebarText} ${theme.sidebarHoverBg} hover:text-white`
            }`
          }
        >
          <span className="text-lg">⚙️</span>
          Einstellungen
        </NavLink>
      </div>
    </aside>
  );
}
