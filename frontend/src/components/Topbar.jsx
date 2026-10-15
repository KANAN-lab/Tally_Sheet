import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, KeyRound, LogOut, Menu } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

function DraftBell() {
  const [drafts, setDrafts] = useState([]);
  const location = useLocation();
  useEffect(() => {
    api.get("/tally-sheets", { params: { status: "draft", limit: 5 } }).then((r) => setDrafts(r.data)).catch(() => {});
  }, [location.pathname]);
  const count = drafts.total || 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900" data-testid="topbar-notification-button">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white grid place-items-center" data-testid="topbar-notification-count">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b text-sm font-semibold">Draft belum selesai</div>
        {(drafts.items || []).length === 0 && <div className="px-4 py-6 text-sm text-slate-500">Tidak ada draft.</div>}
        {(drafts.items || []).map((d) => (
          <Link key={d.id} to={`/tally/${d.id}`} className="block px-4 py-2.5 hover:bg-slate-50 border-b last:border-0" data-testid={`notification-draft-${d.doc_no}`}>
            <div className="font-mono text-xs font-medium text-slate-900">{d.doc_no}</div>
            <div className="text-xs text-slate-500">{fmtDateTime(d.created_at)} · {d.item_count} baris</div>
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const initials = (user?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur sm:px-6" data-testid="topbar">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900" data-testid="topbar-menu-button">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <DraftBell />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-100" data-testid="topbar-user-menu">
            <div className="h-9 w-9 rounded-full bg-blue-700 grid place-items-center text-xs font-bold text-white">{initials}</div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-sm font-semibold text-slate-900" data-testid="topbar-user-name">{user?.name}</div>
              <div className="text-xs text-slate-500" data-testid="topbar-user-role">{user?.role === "admin" ? "Admin" : "User"}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal text-xs text-slate-500">{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPwOpen(true)} data-testid="topbar-change-password">
            <KeyRound className="mr-2 h-4 w-4" /> Ganti Password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { logout(); navigate("/login"); }} data-testid="topbar-logout" className="text-rose-600">
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </header>
  );
}
