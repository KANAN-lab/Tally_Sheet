import { NavLink } from "react-router-dom";
import { Boxes, ChevronRight, Database, History, LayoutDashboard, Settings, UploadCloud, Users, ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, id: "dashboard" },
  { to: "/tally", label: "Tally Sheet", icon: ClipboardList, id: "tally" },
  { to: "/master", label: "Master Data Material", icon: Database, end: true, id: "master" },
  { to: "/master/upload", label: "Upload Master Data", icon: UploadCloud, admin: true, id: "upload" },
  { to: "/users", label: "Pengguna", icon: Users, admin: true, id: "users" },
  { to: "/activity", label: "Riwayat Aktivitas", icon: History, admin: true, id: "activity" },
  { to: "/settings", label: "Pengaturan", icon: Settings, admin: true, id: "settings" },
];

export function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="h-11 w-11 rounded-xl bg-white/10 grid place-items-center ring-1 ring-white/20">
        <Boxes className="h-6 w-6 text-white" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-xl font-extrabold text-white tracking-tight">Tally Sheet</div>
        <div className="text-[11px] text-blue-100/80">Material Management System</div>
      </div>
    </div>
  );
}

export function NavList({ onNavigate, collapsed }) {
  const { user } = useAuth();
  return (
    <nav className="flex-1 px-3 space-y-1" data-testid="sidebar-nav">
      {NAV.filter((n) => !n.admin || user?.role === "admin").map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={onNavigate}
          data-testid={`nav-${n.id}`}
          title={n.label}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
              isActive ? "bg-blue-600 text-white shadow-md shadow-blue-900/40" : "text-blue-50/85 hover:bg-white/10 hover:text-white"
            } ${collapsed ? "justify-center" : ""}`
          }
        >
          <n.icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{n.label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export function SidebarUser({ collapsed }) {
  const { user } = useAuth();
  const initials = (user?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="m-3 mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10" data-testid="sidebar-user-card">
      <div className="h-10 w-10 shrink-0 rounded-full bg-blue-500 grid place-items-center text-sm font-bold text-white">{initials}</div>
      {!collapsed && (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
            <div className="text-xs text-blue-100/70">{user?.role === "admin" ? "Admin" : "User"}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-blue-100/60" />
        </>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed }) {
  return (
    <aside
      className={`hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-[#0B2149] transition-[width] duration-200 ${collapsed ? "w-20" : "w-64"}`}
      data-testid="sidebar"
    >
      {collapsed ? <div className="py-5 grid place-items-center"><Boxes className="h-7 w-7 text-white" /></div> : <Brand />}
      <NavList collapsed={collapsed} />
      <SidebarUser collapsed={collapsed} />
    </aside>
  );
}
