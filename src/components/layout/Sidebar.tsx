import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTheme } from "../../lib/ThemeContext";

const COLLAPSED_KEY = "turnierplaner_sidebar_collapsed";

const links = [
  { to: "/", label: "Start", icon: "🏠" },
  { to: "/players", label: "Spieler", icon: "👥" },
  { to: "/tournaments", label: "Turniere", icon: "🏆" },
];

export default function Sidebar() {
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, String(next));
  };

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-60"} ${theme.sidebarBg} text-white min-h-screen flex flex-col shrink-0 transition-all duration-200`}
    >
      {/* Branding */}
      <div className={`${collapsed ? "p-3" : "p-5"} border-b ${theme.sidebarBorder}`}>
        {collapsed ? (
          <div className="text-2xl text-center">🏸</div>
        ) : (
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
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            title={collapsed ? link.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-4"} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? `${theme.sidebarActiveBg} text-white shadow-lg ${theme.sidebarActiveShadow}`
                  : `${theme.sidebarText} ${theme.sidebarHoverBg} hover:text-white`
              }`
            }
          >
            <span className={collapsed ? "text-xl" : "text-lg"}>{link.icon}</span>
            {!collapsed && link.label}
          </NavLink>
        ))}
      </nav>

      {/* Settings + Toggle - bottom */}
      <div className={`p-2 border-t ${theme.sidebarBorder} space-y-1`}>
        <NavLink
          to="/settings"
          title={collapsed ? "Einstellungen" : undefined}
          className={({ isActive }) =>
            `flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-4"} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive
                ? `${theme.sidebarActiveBg} text-white shadow-lg ${theme.sidebarActiveShadow}`
                : `${theme.sidebarText} ${theme.sidebarHoverBg} hover:text-white`
            }`
          }
        >
          <span className={collapsed ? "text-xl" : "text-lg"}>⚙️</span>
          {!collapsed && "Einstellungen"}
        </NavLink>

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className={`w-full flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-4"} py-2 rounded-lg text-xs transition-all duration-200 ${theme.sidebarText} ${theme.sidebarHoverBg} hover:text-white`}
          title={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        >
          <span className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}>
            «
          </span>
          {!collapsed && <span>Einklappen</span>}
        </button>
      </div>
    </aside>
  );
}
