import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users as UsersIcon,
  ShieldCheck,
  UserPlus,
  Pencil,
  Trash2,
  Search,
  RotateCcw,
  Save,
  CheckCircle2,
  XCircle,
  Lock,
  Filter,
  Info,
  Shield,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { swalAlert } from "@/lib/swal";
import { ROLE_LABELS } from "@/services/WorkflowService";

const ROLE_BADGE_STYLES = {
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  warehouse_admin: "bg-indigo-100 text-indigo-800 border-indigo-200",
  checker: "bg-emerald-100 text-emerald-800 border-emerald-200",
  qc: "bg-purple-100 text-purple-800 border-purple-200",
  user: "bg-slate-100 text-slate-700 border-slate-200"
};

function UserDialog({ target, onClose, onSaved }) {
  const isNew = target === "new";
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setForm(
        isNew
          ? {
              email: "",
              name: "",
              password: "",
              role: "checker",
              is_pic: true,
              active: true
            }
          : { ...target, password: "" }
      );
    }
  }, [target, isNew]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post("/users", {
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
          is_pic: form.is_pic
        });
        toast.success(`Akun ${form.email} berhasil didaftarkan`);
      } else {
        await api.put(`/users/${target.id}`, {
          name: form.name,
          role: form.role,
          is_pic: form.is_pic,
          active: form.active,
          ...(form.password ? { password: form.password } : {})
        });
        toast.success(`Akun ${target.email} berhasil diperbarui`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="user-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold">
            <UserPlus className="h-5 w-5 text-blue-700" />
            <span>{isNew ? "Tambah Pengguna Baru" : `Edit Akun: ${target?.email}`}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isNew
              ? "Daftarkan akun petugas baru beserta penetapan peran (role) dan izin otorisasi."
              : "Perbarui identitas, hak peran, status keaktifan, atau reset kata sandi akun."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-2">
          {isNew && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Alamat Email *</Label>
              <Input
                type="email"
                required
                placeholder="misal: petugas@tally.com"
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
                data-testid="user-dialog-email"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Nama Lengkap *</Label>
            <Input
              required
              minLength={2}
              placeholder="misal: Budi Santoso"
              value={form.name || ""}
              onChange={(e) => set("name", e.target.value)}
              data-testid="user-dialog-name"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              {isNew ? "Password (min. 8 karakter) *" : "Reset Password Baru (Opsional)"}
            </Label>
            <Input
              type="password"
              required={isNew}
              minLength={8}
              placeholder={isNew ? "Minimal 8 karakter..." : "Kosongkan jika tidak ingin mengubah password"}
              value={form.password || ""}
              onChange={(e) => set("password", e.target.value)}
              data-testid="user-dialog-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Peran Sistem (Role) *</Label>
            <Select value={form.role || "checker"} onValueChange={(v) => set("role", v)}>
              <SelectTrigger data-testid="user-dialog-role" className="bg-white">
                <SelectValue placeholder="Pilih Peran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checker">
                  <div className="text-left">
                    <div className="font-semibold text-slate-900">Checker Gudang</div>
                    <div className="text-[11px] text-slate-500">Hitung fisik, input SJ/PO, dan buat draf tally</div>
                  </div>
                </SelectItem>
                <SelectItem value="warehouse_admin">
                  <div className="text-left">
                    <div className="font-semibold text-slate-900">Admin Warehouse</div>
                    <div className="text-[11px] text-slate-500">Verifikasi dokumen vs PO SAP & teruskan ke QC</div>
                  </div>
                </SelectItem>
                <SelectItem value="qc">
                  <div className="text-left">
                    <div className="font-semibold text-slate-900">Quality Control (QC)</div>
                    <div className="text-[11px] text-slate-500">Inspeksi mutu, uji lab/sampling, Stock Ter-UU</div>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="text-left">
                    <div className="font-semibold text-slate-900">Super Administrator</div>
                    <div className="text-[11px] text-slate-500">Akses penuh ke master data, pengaturan & users</div>
                  </div>
                </SelectItem>
                <SelectItem value="user">
                  <div className="text-left">
                    <div className="font-semibold text-slate-900">Viewer / Staff</div>
                    <div className="text-[11px] text-slate-500">Melihat daftar dokumen tally sheet saja (Read-only)</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div>
              <div className="text-xs font-bold text-slate-900">Terdaftar sebagai PIC Tally</div>
              <div className="text-[11px] text-slate-500">Nama petugas ini dapat dipilih pada baris item tally sheet</div>
            </div>
            <Switch
              checked={!!form.is_pic}
              onCheckedChange={(v) => set("is_pic", v)}
              data-testid="user-dialog-is-pic"
            />
          </div>

          {!isNew && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div>
                <div className="text-xs font-bold text-slate-900">Status Akun Aktif</div>
                <div className="text-[11px] text-slate-500">Jika dinonaktifkan, pengguna tidak dapat login</div>
              </div>
              <Switch
                checked={!!form.active}
                onCheckedChange={(v) => set("active", v)}
                data-testid="user-dialog-active"
              />
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-blue-700 hover:bg-blue-800 font-semibold"
              data-testid="user-dialog-submit"
            >
              {saving ? "Menyimpan..." : isNew ? "Daftarkan Pengguna" : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [activeTab, setActiveTab] = useState("users"); // "users" | "permissions"

  // Users State
  const [users, setUsers] = useState([]);
  const [targetUser, setTargetUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Permissions State
  const [permissions, setPermissions] = useState({});
  const [permDefs, setPermDefs] = useState([]);
  const [rolesMeta, setRolesMeta] = useState([]);
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [savingPerms, setSavingPerms] = useState(false);

  // Load Users
  const loadUsers = useCallback(() => {
    setLoadingUsers(true);
    api.get("/users")
      .then((r) => setUsers(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoadingUsers(false));
  }, []);

  // Load Permissions Matrix
  const loadPermissions = useCallback(() => {
    setLoadingPerms(true);
    api.get("/permissions")
      .then((r) => {
        setPermissions(r.data.permissions || {});
        setPermDefs(r.data.definitions || []);
        setRolesMeta(r.data.roles || []);
      })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoadingPerms(false));
  }, []);

  useEffect(() => {
    loadUsers();
    loadPermissions();
  }, [loadUsers, loadPermissions]);

  // Handle Delete User
  const handleDeleteUser = async (u) => {
    if (u.id === me?.id) {
      return toast.error("Anda tidak dapat menghapus akun Anda sendiri.");
    }
    const confirmed = await swalAlert.confirm(
      "Hapus Pengguna?",
      `Akun <b>${u.name}</b> (${u.email}) akan dihapus secara permanen dari sistem dan database cloud Supabase.`,
      "Ya, Hapus Akun"
    );
    if (!confirmed) return;

    try {
      await api.delete(`/users/${u.id}`);
      toast.success(`Akun ${u.email} berhasil dihapus.`);
      loadUsers();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  // Toggle Single Permission in Matrix
  const togglePermission = (role, permKey) => {
    if (role === "admin") {
      return; // Admin always full access
    }
    setPermissions((prev) => {
      const rolePerms = prev[role] || {};
      return {
        ...prev,
        [role]: {
          ...rolePerms,
          [permKey]: !rolePerms[permKey]
        }
      };
    });
  };

  // Save Permissions Matrix
  const handleSavePermissions = async () => {
    setSavingPerms(true);
    try {
      await api.put("/permissions", { permissions });
      toast.success("Matriks otorisasi hak akses berhasil disimpan dan disinkronkan ke Cloud.");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingPerms(false);
    }
  };

  // Reset to Default SOP Permissions
  const handleResetPermissions = async () => {
    const confirmed = await swalAlert.confirm(
      "Reset ke Standar SOP?",
      "Seluruh konfigurasi hak akses akan dikembalikan ke matriks default SOP PT Diamond Cold Storage.",
      "Reset Standar"
    );
    if (!confirmed) return;

    // Default permission payload
    const defaults = {
      admin: {
        tally_view: true, tally_create: true, tally_edit: true, tally_submit: true, tally_delete: true,
        admin_verify: true, admin_hold: true, return_to_checker: true,
        qc_approve: true, qc_hold: true, qc_reject: true,
        print_tally: true, print_ba: true, export_reports: true,
        manage_master: true, manage_settings: true, manage_users: true
      },
      warehouse_admin: {
        tally_view: true, tally_create: true, tally_edit: true, tally_submit: true, tally_delete: false,
        admin_verify: true, admin_hold: true, return_to_checker: true,
        qc_approve: false, qc_hold: false, qc_reject: false,
        print_tally: true, print_ba: true, export_reports: true,
        manage_master: true, manage_settings: false, manage_users: false
      },
      checker: {
        tally_view: true, tally_create: true, tally_edit: true, tally_submit: true, tally_delete: false,
        admin_verify: false, admin_hold: false, return_to_checker: false,
        qc_approve: false, qc_hold: false, qc_reject: false,
        print_tally: true, print_ba: true, export_reports: false,
        manage_master: false, manage_settings: false, manage_users: false
      },
      qc: {
        tally_view: true, tally_create: false, tally_edit: false, tally_submit: false, tally_delete: false,
        admin_verify: false, admin_hold: false, return_to_checker: false,
        qc_approve: true, qc_hold: true, qc_reject: true,
        print_tally: true, print_ba: true, export_reports: true,
        manage_master: false, manage_settings: false, manage_users: false
      },
      user: {
        tally_view: true, tally_create: false, tally_edit: false, tally_submit: false, tally_delete: false,
        admin_verify: false, admin_hold: false, return_to_checker: false,
        qc_approve: false, qc_hold: false, qc_reject: false,
        print_tally: true, print_ba: false, export_reports: false,
        manage_master: false, manage_settings: false, manage_users: false
      }
    };

    setPermissions(defaults);
    try {
      await api.put("/permissions", { permissions: defaults });
      toast.success("Hak akses berhasil dikembalikan ke standar SOP.");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && u.active) ||
        (statusFilter === "inactive" && !u.active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="space-y-6" data-testid="users-management-page">
      <PageHeader
        title="Pengguna & Otorisasi Hak Akses"
        subtitle="Kelola akun pengguna operasional gudang, hak peran (RBAC), dan matriks perizinan modul sistem."
        actions={
          activeTab === "users" ? (
            <Button
              onClick={() => setTargetUser("new")}
              className="bg-blue-700 hover:bg-blue-800 font-semibold shadow-sm"
              data-testid="admin-add-user-button"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              <span>Tambah Pengguna</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPermissions}
                className="text-slate-600 border-slate-300 hover:bg-slate-100"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                <span>Reset Default SOP</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSavePermissions}
                disabled={savingPerms}
                className="bg-blue-700 hover:bg-blue-800 font-semibold shadow-sm"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                <span>{savingPerms ? "Menyimpan..." : "Simpan Hak Akses"}</span>
              </Button>
            </div>
          )
        }
      />

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "users"
              ? "border-blue-700 text-blue-900 bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
          data-testid="tab-users-accounts"
        >
          <UsersIcon className="h-4 w-4" />
          <span>Daftar Akun Pengguna</span>
          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700">
            {users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("permissions")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "permissions"
              ? "border-blue-700 text-blue-900 bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
          data-testid="tab-users-permissions"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Matriks Otorisasi Hak Akses (RBAC)</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
            5 Role
          </span>
        </button>
      </div>

      {/* TAB 1: USER ACCOUNTS */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari berdasarkan nama atau email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-[160px] text-xs bg-white">
                  <Filter className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  <SelectValue placeholder="Semua Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Role</SelectItem>
                  <SelectItem value="admin">Super Admin</SelectItem>
                  <SelectItem value="warehouse_admin">Admin Warehouse</SelectItem>
                  <SelectItem value="checker">Checker Gudang</SelectItem>
                  <SelectItem value="qc">Quality Control</SelectItem>
                  <SelectItem value="user">Viewer</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px] text-xs bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="users-table">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nama Pengguna</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Peran (Role)</th>
                  <th className="px-4 py-3 text-center">PIC Tally</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Tanggal Dibuat</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                      Memuat daftar pengguna...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                      Tidak ditemukan akun pengguna yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const roleLabel = ROLE_LABELS[u.role] || u.role;
                    const badgeClass = ROLE_BADGE_STYLES[u.role] || "bg-slate-100 text-slate-700 border-slate-200";

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors" data-testid={`users-row-${u.email}`}>
                        <td className="px-4 py-3.5 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{u.name}</span>
                            {u.id === me?.id && (
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                                Anda
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 text-xs font-mono">{u.email}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border ${badgeClass}`}>
                            {roleLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {u.is_pic ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Ya
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {u.active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              <span>Aktif</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                              <span>Nonaktif</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                          {fmtDateTime(u.created_at)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setTargetUser(u)}
                              className="h-8 px-2.5 text-xs text-slate-700 hover:bg-slate-100"
                              data-testid={`users-edit-${u.email}`}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              <span>Edit</span>
                            </Button>
                            {u.id !== me?.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteUser(u)}
                                className="h-8 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                title="Hapus Akun"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PERMISSIONS MATRIX (RBAC) */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
            <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Pengendalian Akses Peran Terpadu: </span>
              Administrator dapat mengaktifkan atau mematikan izin fitur secara granular untuk setiap peran pengguna di bawah ini.
              Perubahan disimpan ke dalam basis data cloud Supabase dan langsung berlaku secara real-time pada tombol aksi dan validasi alur kerja backend.
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="permissions-matrix-table">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 w-[38%]">Fitur & Aksi Sistem</th>
                  <th className="px-3 py-3.5 text-center w-[12%]">
                    <div className="flex flex-col items-center">
                      <span className="text-blue-900 font-extrabold">Super Admin</span>
                      <span className="text-[10px] text-slate-400 font-normal">Akses Penuh</span>
                    </div>
                  </th>
                  <th className="px-3 py-3.5 text-center w-[13%]">
                    <div className="flex flex-col items-center">
                      <span className="text-indigo-900 font-extrabold">Admin Warehouse</span>
                      <span className="text-[10px] text-slate-400 font-normal">Verifikasi PO/SJ</span>
                    </div>
                  </th>
                  <th className="px-3 py-3.5 text-center w-[13%]">
                    <div className="flex flex-col items-center">
                      <span className="text-emerald-900 font-extrabold">Checker Gudang</span>
                      <span className="text-[10px] text-slate-400 font-normal">Cek Fisik & Draf</span>
                    </div>
                  </th>
                  <th className="px-3 py-3.5 text-center w-[12%]">
                    <div className="flex flex-col items-center">
                      <span className="text-purple-900 font-extrabold">Quality Control</span>
                      <span className="text-[10px] text-slate-400 font-normal">Uji Mutu / UU</span>
                    </div>
                  </th>
                  <th className="px-3 py-3.5 text-center w-[12%]">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-800 font-extrabold">Viewer</span>
                      <span className="text-[10px] text-slate-400 font-normal">Lihat Saja</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permDefs.map((group) => (
                  <tr key={group.module} className="contents">
                    {/* Group Header Row */}
                    <tr className="bg-slate-100/70 border-t border-b border-slate-200">
                      <td colSpan={6} className="px-5 py-2 font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-blue-700" />
                        <span>{group.module_name}</span>
                      </td>
                    </tr>

                    {/* Permission Items */}
                    {group.permissions.map((p) => (
                      <tr key={p.key} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-slate-900 text-xs">{p.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{p.desc}</div>
                        </td>

                        {/* Super Admin (Always Active & Disabled) */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center">
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800 border border-blue-200">
                              <Lock className="h-3 w-3 text-blue-600" /> Aktif
                            </span>
                          </div>
                        </td>

                        {/* Warehouse Admin */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={!!permissions.warehouse_admin?.[p.key]}
                              onCheckedChange={() => togglePermission("warehouse_admin", p.key)}
                              data-testid={`perm-warehouse_admin-${p.key}`}
                            />
                          </div>
                        </td>

                        {/* Checker */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={!!permissions.checker?.[p.key]}
                              onCheckedChange={() => togglePermission("checker", p.key)}
                              data-testid={`perm-checker-${p.key}`}
                            />
                          </div>
                        </td>

                        {/* QC */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={!!permissions.qc?.[p.key]}
                              onCheckedChange={() => togglePermission("qc", p.key)}
                              data-testid={`perm-qc-${p.key}`}
                            />
                          </div>
                        </td>

                        {/* Viewer */}
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={!!permissions.user?.[p.key]}
                              onCheckedChange={() => togglePermission("user", p.key)}
                              data-testid={`perm-user-${p.key}`}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Save Bar */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500">
              Perubahan matriks otorisasi akan otomatis diterapkan pada login berikutnya dan aksi transisi dokumen.
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPermissions}
                className="text-slate-600 border-slate-300 hover:bg-slate-100"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                <span>Reset Default</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSavePermissions}
                disabled={savingPerms}
                className="bg-blue-700 hover:bg-blue-800 font-semibold shadow-sm"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                <span>{savingPerms ? "Menyimpan..." : "Simpan Hak Akses"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* User Add / Edit Modal */}
      <UserDialog
        target={targetUser}
        onClose={() => setTargetUser(null)}
        onSaved={loadUsers}
      />
    </div>
  );
}
