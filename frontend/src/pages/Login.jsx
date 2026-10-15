import { useState } from "react";
import { Boxes, Lock, Mail, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-white">
      <div className="hidden lg:flex flex-col justify-between bg-[#0B2149] p-12 text-white relative overflow-hidden">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="flex items-center gap-3 relative">
          <div className="h-12 w-12 rounded-xl bg-white/10 grid place-items-center ring-1 ring-white/20"><Boxes className="h-7 w-7" /></div>
          <div>
            <div className="font-display text-2xl font-extrabold">Tally Sheet</div>
            <div className="text-xs text-blue-100/80">Material Management System</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">Pencatatan material yang akurat, tervalidasi, dan siap cetak.</h1>
          <p className="mt-4 text-blue-100/80 text-sm leading-relaxed">
            Kode dan nama material diambil langsung dari Master Data resmi. Setiap dokumen memiliki nomor unik, histori perubahan, dan dapat dicetak A4 atau diekspor ke Excel.
          </p>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-blue-100/70"><ShieldCheck className="h-4 w-4" /> Akses berbasis role · Admin & User</div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6 fade-up" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#0B2149] grid place-items-center"><Boxes className="h-6 w-6 text-white" /></div>
            <div className="font-display text-xl font-extrabold text-[#0B2149]">Tally Sheet</div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Masuk ke akun Anda</h2>
            <p className="mt-1 text-sm text-slate-500">Akun dibuat oleh Admin. Hubungi Admin jika belum memiliki akun.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="email" type="email" className="pl-9 bg-slate-50 h-11" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-username-input" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="password" type="password" className="pl-9 bg-slate-50 h-11" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" />
            </div>
          </div>
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="login-error">{error}</div>}
          <Button type="submit" disabled={busy} className="w-full h-11 bg-blue-700 hover:bg-blue-800 text-white" data-testid="login-submit-button">
            {busy ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </div>
    </div>
  );
}
