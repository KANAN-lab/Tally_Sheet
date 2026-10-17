import { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Bell, ChevronDown, KeyRound, LogOut, Menu, 
  CheckCheck, AlertTriangle, CheckCircle2, BadgeCheck, 
  XCircle, RotateCcw, FileText, Inbox, Clock
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { fmtTimeAgo } from "@/lib/format";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

function getCategoryMeta(cat) {
  switch (cat) {
    case "held":
      return { icon: AlertTriangle, bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" };
    case "unheld":
      return { icon: CheckCircle2, bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" };
    case "approved":
      return { icon: BadgeCheck, bg: "bg-green-100", text: "text-green-700", border: "border-green-200" };
    case "rejected":
      return { icon: XCircle, bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" };
    case "qc_review":
      return { icon: Inbox, bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" };
    case "returned":
      return { icon: RotateCcw, bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" };
    case "submitted":
    default:
      return { icon: FileText, bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" };
  }
}

function NotificationCenter() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all"); // "all" | "unread"
  const location = useLocation();
  const navigate = useNavigate();

  const fetchCount = useCallback(() => {
    api.get("/notifications/unread-count")
      .then((r) => setUnreadCount(r.data?.unread || 0))
      .catch(() => {});
  }, []);

  const fetchItems = useCallback(() => {
    setLoading(true);
    api.get("/notifications", { params: { limit: 25 } })
      .then((r) => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Polling pintar unread badge (30 detik, pause saat tab background)
  useEffect(() => {
    fetchCount();
    const timer = setInterval(() => {
      if (!document.hidden) {
        fetchCount();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchCount]);

  // Refresh count saat navigasi halaman
  useEffect(() => {
    fetchCount();
  }, [location.pathname, fetchCount]);

  // Ambil list lengkap notifikasi saat popover dibuka
  const handleOpenChange = (isOpen) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchItems();
      fetchCount();
    }
  };

  const handleMarkAsRead = async (item, e) => {
    e.stopPropagation();
    if (item.is_read) return;
    try {
      await api.patch(`/notifications/${item.id}/read`);
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_read: 1 } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // defensive ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setItems((prev) => prev.map((x) => ({ ...x, is_read: 1 })));
      setUnreadCount(0);
    } catch {
      // defensive ignore
    }
  };

  const handleItemClick = async (item) => {
    if (!item.is_read) {
      api.patch(`/notifications/${item.id}/read`).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_read: 1 } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (item.action_url) {
      navigate(item.action_url);
    }
  };

  const filteredItems = filter === "unread" ? items.filter((x) => !x.is_read) : items;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          data-testid="topbar-notification-button"
          title="Notifikasi Masuk"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-rose-600 text-[10px] font-bold text-white grid place-items-center shadow-sm animate-pulse"
              data-testid="topbar-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 sm:w-96 p-0 shadow-lg border border-slate-200">
        {/* Header Notification Center */}
        <div className="flex items-center justify-between border-b px-4 py-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-slate-900">Notifikasi</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                {unreadCount} baru
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
              title="Tandai semua notifikasi telah dibaca"
              data-testid="btn-mark-all-read"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tandai Semua Dibaca
            </button>
          )}
        </div>

        {/* Tab Filter */}
        <div className="flex border-b text-xs font-medium text-slate-600 bg-white">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${
              filter === "all" ? "border-blue-600 text-blue-700 font-semibold" : "border-transparent hover:text-slate-900"
            }`}
          >
            Semua ({items.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${
              filter === "unread" ? "border-blue-600 text-blue-700 font-semibold" : "border-transparent hover:text-slate-900"
            }`}
          >
            Belum Dibaca ({unreadCount})
          </button>
        </div>

        {/* Notification Items List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">
              Memuat notifikasi...
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="py-10 text-center space-y-2">
              <Inbox className="h-8 w-8 text-slate-300 mx-auto" />
              <div className="text-xs font-medium text-slate-600">
                {filter === "unread" ? "Tidak ada notifikasi baru" : "Belum ada notifikasi"}
              </div>
              <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                Notifikasi transisi status tally sheet akan tampil di sini.
              </p>
            </div>
          )}

          {!loading && filteredItems.map((item) => {
            const meta = getCategoryMeta(item.category);
            const Icon = meta.icon;
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`group relative flex items-start gap-3 p-3 text-left transition-colors cursor-pointer hover:bg-slate-50 ${
                  !item.is_read ? "bg-blue-50/40" : "bg-white"
                }`}
                data-testid={`notification-item-${item.id}`}
              >
                {/* Visual Category Icon */}
                <div className={`mt-0.5 rounded-lg p-1.5 ${meta.bg} ${meta.text} shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {item.title}
                    </span>
                    {!item.is_read && (
                      <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" title="Belum dibaca" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                    {item.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtTimeAgo(item.created_at)}
                    </span>
                    {item.doc_no && (
                      <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                        {item.doc_no}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const initials = (user?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const roleLabel = {
    admin: "Super Admin",
    warehouse_admin: "Admin WH",
    checker: "Checker",
    qc: "QC Staff",
    user: "Staff"
  }[user?.role] || "User";

  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur sm:px-6" data-testid="topbar">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900" data-testid="topbar-menu-button">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <NotificationCenter />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-100" data-testid="topbar-user-menu">
            <div className="h-9 w-9 rounded-full bg-blue-700 grid place-items-center text-xs font-bold text-white">{initials}</div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-sm font-semibold text-slate-900" data-testid="topbar-user-name">{user?.name}</div>
              <div className="text-xs text-slate-500" data-testid="topbar-user-role">{roleLabel}</div>
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
