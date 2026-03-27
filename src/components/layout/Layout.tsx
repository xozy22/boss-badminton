import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useTheme } from "../../lib/ThemeContext";

export default function Layout() {
  const { theme } = useTheme();
  return (
    <div className={`flex h-screen ${theme.pageBg} overflow-hidden`}>
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
