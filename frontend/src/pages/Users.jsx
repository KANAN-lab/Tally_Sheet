import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

function UserDialog({ target, onClose, onSaved }) {
  const isNew = target === "new";
  const [form, setForm] = useState({});
  useEffect(() => {
    if (target) setForm(isNew ? { email: "", name: "", password: "", role: "user", is_pic: true, active: true } : { ...target, password: "" });
  }, [target, isNew]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    try {
      if (isNew) await api.post("/users", { email: form.email, name: form.name, password: form.password, role: form.role, is_pic: form.is_pic });
      else await api.put(`/users/${target.id}`, { name: form.name, role: form.role, is_pic: form.is_pic, active: form.active, ...(form.password ? { password: form.password } : {}) });
      toast.success(isNew ? "Pengguna berhasil ditambahkan" : "Pengguna berhasil diperbarui");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="user-dialog">
        <DialogHeader><DialogTitle>{isNew ? "Tambah Pengguna" : `Edit ${target?.email}`}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {isNew && <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={form.email || ""} onChange={(e) => set("email", e.target.value)} data-testid="user-dialog-email" /></div>}
          <div className="space-y-1.5"><Label>Nama</Label><Input required minLength={2} value={form.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="user-dialog-name" /></div>
          <div className="space-y-1.5"><Label>{isNew ? "Password (min. 8 karakter)" : "Reset Password (kosongkan jika tidak diubah)"}</Label><Input type="password" required={isNew} minLength={8} value={form.password || ""} onChange={(e) => set("password", e.target.value)} data-testid="user-dialog-password" /></div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger data-testid="user-dialog-role"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3"><div><div className="text-sm font-medium">Terdaftar sebagai PIC</div><div className="text-xs text-slate-500">Dapat dipilih sebagai PIC pada tally sheet</div></div><Switch checked={!!form.is_pic} onCheckedChange={(v) => set("is_pic", v)} data-testid="user-dialog-is-pic" /></div>
          {!isNew && <div className="flex items-center justify-between rounded-lg border p-3"><div className="text-sm font-medium">Akun aktif</div><Switch checked={!!form.active} onCheckedChange={(v) => set("active", v)} data-testid="user-dialog-active" /></div>}
          <DialogFooter><Button type="submit" className="bg-blue-700 hover:bg-blue-800" data-testid="user-dialog-submit">Simpan</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [target, setTarget] = useState(null);
  const load = useCallback(() => {
    api.get("/users").then((r) => setUsers(r.data));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div data-testid="users-page">
      <PageHeader title="Pengguna & PIC" subtitle="Kelola akun pengguna, role, dan daftar PIC yang diizinkan." actions={<Button onClick={() => setTarget("new")} className="bg-blue-700 hover:bg-blue-800" data-testid="admin-add-user-button"><UserPlus className="mr-1 h-4 w-4" /> Tambah Pengguna</Button>} />
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm" data-testid="users-table">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
            <tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">PIC</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Dibuat</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} data-testid={`users-row-${u.email}`}>
                <td className="px-4 py-3 font-medium text-slate-900">{u.name}{u.id === me.id && <span className="ml-2 text-xs text-slate-400">(Anda)</span>}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3"><span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${u.role === "admin" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{u.role === "admin" ? "Admin" : "User"}</span></td>
                <td className="px-4 py-3">{u.is_pic ? "Ya" : "Tidak"}</td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold ${u.active ? "text-emerald-600" : "text-rose-600"}`}>{u.active ? "Aktif" : "Nonaktif"}</span></td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDateTime(u.created_at)}</td>
                <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => setTarget(u)} data-testid={`users-edit-${u.email}`}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserDialog target={target} onClose={() => setTarget(null)} onSaved={load} />
    </div>
  );
}
