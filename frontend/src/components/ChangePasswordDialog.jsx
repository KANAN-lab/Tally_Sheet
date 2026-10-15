import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errMsg } from "@/lib/api";

export default function ChangePasswordDialog({ open, onOpenChange }) {
  const [form, setForm] = useState({ current_password: "", new_password: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 8) return toast.error("Password baru minimal 8 karakter");
    setBusy(true);
    try {
      await api.post("/auth/change-password", form);
      toast.success("Password berhasil diganti");
      setForm({ current_password: "", new_password: "" });
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="change-password-dialog">
        <DialogHeader><DialogTitle>Ganti Password</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Password Lama</Label>
            <Input type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} data-testid="change-password-current" required />
          </div>
          <div className="space-y-1.5">
            <Label>Password Baru (min. 8 karakter)</Label>
            <Input type="password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} data-testid="change-password-new" required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="bg-blue-700 hover:bg-blue-800" data-testid="change-password-submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
