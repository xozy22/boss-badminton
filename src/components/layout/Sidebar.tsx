import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTheme } from "../../lib/ThemeContext";
import { getCustomLogo } from "../../pages/Settings";
import { getAppSetting } from "../../lib/db";

const COLLAPSED_KEY = "turnierplaner_sidebar_collapsed";

const links = [
  { to: "/", label: "Start", icon: "🏠" },
  { to: "/sportstaetten", label: "Sportstaetten", icon: "🏟️" },
  { to: "/players", label: "Spieler", icon: "👥" },
  { to: "/tournaments", label: "Turniere", icon: "🏆" },
];

export default function Sidebar() {
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const [customLogo, setCustomLogo] = useState<string | null>(() => getCustomLogo());

  // Load logo from DB on mount + listen for changes
  useEffect(() => {
    // Load from DB and update cache
    getAppSetting("custom_logo").then((dbLogo) => {
      if (dbLogo) {
        localStorage.setItem("turnierplaner_logo_cache", dbLogo);
        setCustomLogo(dbLogo);
      }
    });
    const handler = () => setCustomLogo(getCustomLogo());
    window.addEventListener("logo-changed", handler);
    return () => window.removeEventListener("logo-changed", handler);
  }, []);

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
          <div className="text-2xl text-center flex justify-center">
            <img src={customLogo || "/logo.png"} alt="Logo" className="w-14 h-14 object-contain" />
          </div>
        ) : customLogo ? (
          <div className="flex items-center gap-3">
            <img src={customLogo} alt="Logo" className="w-14 h-14 object-contain shrink-0" />
            <div>
              <div className="text-base font-bold tracking-tight text-white">
                Badminton
              </div>
              <div className={`text-xs font-medium ${theme.sidebarAccent} tracking-wide uppercase`}>
                Turnierplaner
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src="/logo.png" alt="Logo" className="w-40 object-contain" />
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
