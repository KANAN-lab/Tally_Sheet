import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, CalendarClock, ClipboardPlus, CloudUpload, Database, FileText, History, Info, Layers, PlusCircle, Settings, Upload, Zap, Clock3 } from "lucide-react";
import StatCard from "@/components/StatCard";
import StatusDonut from "@/components/StatusDonut";
import TallyTable from "@/components/TallyTable";
import Pager from "@/components/Pager";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { fmtDateTime, pctChange } from "@/lib/format";

const LIMIT = 10;
const MODE = { replace: "Ganti Data", upsert: "Tambah / Update Data", restore: "Pemulihan Versi" };

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const opt = { timeZone: "Asia/Jakarta" };
  return (
    <div className="flex items-start gap-3 text-right" data-testid="dashboard-clock">
      <CalendarDays className="h-5 w-5 text-[#0B2149] mt-0.5" />
      <div>
        <div className="font-display font-bold text-[#0B2149]">{now.toLocaleDateString("id-ID", { ...opt, day: "numeric", month: "long", year: "numeric" })}</div>
        <div className="text-sm text-slate-600">{now.toLocaleDateString("id-ID", { ...opt, weekday: "long" })}, {now.toLocaleTimeString("id-ID", { ...opt, hour: "2-digit", minute: "2-digit" })}</div>
      </div>
    </div>
  );
}

function QuickActions({ isAdmin }) {
  const items = [
    { to: "/tally/new", icon: ClipboardPlus, title: "Buat Tally Sheet Baru", desc: "Mulai membuat tally sheet baru", id: "new" },
    { to: "/master/upload", icon: Upload, title: "Upload Master Data", desc: "Update data material harian", admin: true, id: "upload" },
    { to: isAdmin ? "/activity" : "/tally", icon: History, title: "Lihat Riwayat", desc: "Lihat semua riwayat tally sheet", id: "history" },
    { to: "/settings", icon: Settings, title: "Pengaturan", desc: "Atur aturan validasi sistem", admin: true, id: "settings" },
  ].filter((i) => !i.admin || isAdmin);
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm" data-testid="dashboard-quick-actions">
      <div className="flex items-center gap-2 font-display font-bold text-[#0B2149]"><Zap className="h-5 w-5" /> Quick Action</div>
      <div className="mt-3 divide-y">
        {items.map((i) => (
          <Link key={i.id} to={i.to} className="group flex items-center gap-3 py-3" data-testid={`quick-action-${i.id}`}>
            <div className="h-10 w-10 rounded-lg bg-blue-50 grid place-items-center text-blue-700 group-hover:bg-blue-700 group-hover:text-white transition-colors"><i.icon className="h-5 w-5" /></div>
            <div><div className="text-sm font-medium text-slate-900">{i.title}</div><div className="text-xs text-slate-500">{i.desc}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LastUpload({ last, isAdmin }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm" data-testid="dashboard-last-upload">
      <div className="flex items-center gap-2 font-display font-bold text-[#0B2149]"><Database className="h-5 w-5" /> Upload Master Data Terakhir</div>
      {last ? (
        <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">Tanggal</dt><dd className="font-medium text-slate-900">{fmtDateTime(last.uploaded_at)}</dd>
          <dt className="text-slate-500">Oleh</dt><dd className="font-medium text-slate-900">{last.uploaded_by_name}</dd>
          <dt className="text-slate-500">Metode</dt><dd className="font-medium text-slate-900">{MODE[last.mode]}</dd>
          <dt className="text-slate-500">Versi</dt><dd className="font-medium text-slate-900">v{last.version} · {last.active_total} material aktif</dd>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Belum ada master data yang di-upload.</p>
      )}
      <Link to={isAdmin ? "/master/upload" : "/master"} className="mt-4 inline-flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100" data-testid="dashboard-upload-history-link">
        Lihat Riwayat Upload <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    api.get("/dashboard").then((r) => setStats(r.data));
    api.get("/tally-sheets", { params: { page, limit: LIMIT } }).then((r) => setRecent(r.data));
  }, [page]);
  useEffect(() => {
    load();
  }, [load]);

  const s = stats || {};
  const last = s.last_master;
  return (
    <div data-testid="dashboard-page">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0B2149]">Dashboard</h1>
          <p className="mt-2 text-base text-blue-700/80">Selamat datang, <span className="font-semibold text-[#0B2149]" data-testid="dashboard-welcome-name">{user?.name}!</span></p>
          <p className="text-sm text-slate-500">Berikut adalah ringkasan aktivitas Tally Sheet dan data material.</p>
        </div>
        <Clock />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard testId="dashboard-stat-total-tally" icon={FileText} color="bg-blue-600" label="Total Tally Sheet" value={s.total ?? "-"} change={stats ? pctChange(s.total_this_month, s.total_last_month) : undefined} caption="Bulan ini dibanding bulan lalu" />
        <StatCard testId="dashboard-stat-today-tally" delay={50} icon={CalendarClock} color="bg-emerald-600" label="Tally Sheet Hari Ini" value={s.today ?? "-"} change={stats ? pctChange(s.today, s.yesterday) : undefined} caption="Dibanding kemarin" />
        <StatCard testId="dashboard-stat-total-rows" delay={100} icon={Layers} color="bg-violet-600" label="Total Baris Material" value={s.rows_total ?? "-"} change={stats ? pctChange(s.rows_this_month, s.rows_last_month) : undefined} caption="Bulan ini dibanding bulan lalu" />
        <StatCard testId="dashboard-stat-draft-tally" delay={150} icon={Clock3} color="bg-orange-500" label="Draft Belum Selesai" value={s.drafts ?? "-"} change={stats ? pctChange(s.drafts_today, s.drafts_yesterday) : undefined} caption="Draft baru dibanding kemarin" />
        <StatCard testId="dashboard-stat-last-master" delay={200} icon={CloudUpload} color="bg-teal-500" label="Master Data Terakhir" small value={last ? fmtDateTime(last.uploaded_at) : "Belum ada"} sub={last ? `Oleh: ${last.uploaded_by_name}` : ""} />
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr_330px] gap-6">
        <div className="space-y-6 min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.1fr] gap-4">
            <button onClick={() => navigate("/tally/new")} className="group flex items-center gap-3 rounded-xl bg-blue-700 px-5 py-5 text-left text-white shadow-md shadow-blue-700/25 hover:bg-blue-800 transition-colors" data-testid="dashboard-create-tally-button">
              <PlusCircle className="h-7 w-7" />
              <span className="flex-1 font-semibold">Buat Tally Sheet Baru</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            {isAdmin ? (
              <button onClick={() => navigate("/master/upload")} className="group flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-5 py-4 text-left hover:border-blue-600 transition-colors" data-testid="dashboard-upload-master-button">
                <Upload className="h-7 w-7 text-blue-700" />
                <span className="flex-1"><span className="block font-semibold text-[#0B2149]">Upload Master Data</span><span className="text-xs text-slate-500">Hanya untuk Admin</span></span>
                <ArrowRight className="h-4 w-4 text-[#0B2149] transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <button onClick={() => navigate("/master")} className="group flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-5 py-4 text-left hover:border-blue-600 transition-colors" data-testid="dashboard-view-master-button">
                <Database className="h-7 w-7 text-blue-700" />
                <span className="flex-1"><span className="block font-semibold text-[#0B2149]">Lihat Master Data</span><span className="text-xs text-slate-500">{s.materials_active ?? 0} material aktif</span></span>
                <ArrowRight className="h-4 w-4 text-[#0B2149]" />
              </button>
            )}
            <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-4" data-testid="dashboard-info-box">
              <Info className="h-5 w-5 shrink-0 text-blue-700 mt-0.5" />
              <div><div className="text-sm font-semibold text-[#0B2149]">Informasi</div>
                <p className="text-xs text-slate-600 mt-1">{last ? `Master data terakhir diupload pada ${fmtDateTime(last.uploaded_at)} oleh ${last.uploaded_by_name}.` : "Master data belum tersedia. Admin perlu meng-upload master data terlebih dahulu."}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm" data-testid="dashboard-recent-card">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <FileText className="h-7 w-7 text-[#0B2149]" />
                <div><h2 className="font-display text-lg font-bold text-[#0B2149]">Tally Sheet Terbaru</h2><p className="text-xs text-slate-500">Daftar tally sheet terbaru yang telah dibuat.</p></div>
              </div>
              <Link to="/tally" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900" data-testid="dashboard-see-all-link">Lihat Semua <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <TallyTable items={recent.items} startIndex={(page - 1) * LIMIT} onChanged={load} testId="dashboard-recent-table" />
            <Pager page={page} total={recent.total} limit={LIMIT} onChange={setPage} testId="dashboard-pager" />
          </div>
        </div>

        <div className="space-y-6">
          <QuickActions isAdmin={isAdmin} />
          <StatusDonut counts={s.status_counts} />
          <LastUpload last={last} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}
