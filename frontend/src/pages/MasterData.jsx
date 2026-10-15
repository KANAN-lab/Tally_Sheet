import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Database, RotateCcw, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

const LIMIT = 25;
export const MODE = { replace: "Ganti Data", upsert: "Tambah/Update", restore: "Pemulihan" };

export function VersionTable({ versions, onRestore }) {
  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="master-data-version-history-table">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
          <tr><th className="px-3 py-2.5">Versi</th><th className="px-3 py-2.5">Tanggal</th><th className="px-3 py-2.5">File</th><th className="px-3 py-2.5">Metode</th><th className="px-3 py-2.5">Oleh</th><th className="px-3 py-2.5">Baru / Update / Nonaktif</th><th className="px-3 py-2.5">Aktif</th>{onRestore && <th className="px-3 py-2.5" />}</tr>
        </thead>
        <tbody className="divide-y">
          {versions.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Belum ada riwayat upload.</td></tr>}
          {versions.map((v, i) => (
            <tr key={v.id} data-testid={`master-version-row-${v.version}`}>
              <td className="px-3 py-2.5 font-mono font-semibold">v{v.version}{i === 0 && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">AKTIF</span>}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">{fmtDateTime(v.uploaded_at)}</td>
              <td className="px-3 py-2.5 max-w-[200px] truncate">{v.filename}</td>
              <td className="px-3 py-2.5">{MODE[v.mode]}</td>
              <td className="px-3 py-2.5">{v.uploaded_by_name}</td>
              <td className="px-3 py-2.5">{v.inserted} / {v.updated} / {v.deactivated}</td>
              <td className="px-3 py-2.5">{v.active_total}</td>
              {onRestore && <td className="px-3 py-2">{i > 0 && <Button size="sm" variant="outline" onClick={() => onRestore(v)} data-testid={`master-version-restore-${v.version}`}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Pulihkan</Button>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MasterData() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [status, setStatus] = useState(null);
  const [versions, setVersions] = useState([]);
  const [restoreTarget, setRestoreTarget] = useState(null);

  const load = useCallback(() => {
    api.get("/materials", { params: { q: applied, page, limit: LIMIT } }).then((r) => setData(r.data));
  }, [applied, page]);
  const loadMeta = useCallback(() => {
    api.get("/master/status").then((r) => setStatus(r.data));
    api.get("/master/versions").then((r) => setVersions(r.data));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const restore = async () => {
    try {
      const r = await api.post(`/master/versions/${restoreTarget.id}/restore`);
      toast.success(`Master data dipulihkan (versi baru v${r.data.version})`);
      setRestoreTarget(null);
      loadMeta();
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const extraCols = Array.from(new Set(data.items.flatMap((m) => Object.keys(m.extra || {})))).slice(0, 4);
  const last = status?.last_version;
  return (
    <div data-testid="master-data-page">
      <PageHeader
        title="Master Data Material"
        subtitle="Sumber data resmi untuk pencarian material pada tally sheet."
        actions={isAdmin && <Button asChild className="bg-blue-700 hover:bg-blue-800"><Link to="/master/upload" data-testid="master-data-upload-link"><Upload className="mr-1 h-4 w-4" /> Upload Master Data</Link></Button>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4" data-testid="master-data-status">
        <Database className="h-6 w-6 text-blue-700" />
        <div className="text-sm">
          <div className="font-semibold text-[#0B2149]">Pembaruan terakhir: {last ? fmtDateTime(last.uploaded_at) : "Belum ada upload"}</div>
          <div className="text-slate-600">{last ? `v${last.version} · ${MODE[last.mode]} · oleh ${last.uploaded_by_name} · ` : ""}{status?.active_total ?? 0} material aktif</div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(q); }} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9 bg-white" placeholder="Cari kode atau nama material..." value={q} onChange={(e) => setQ(e.target.value)} data-testid="master-data-search-input" />
          </div>
          <Button type="submit" className="bg-[#0B2149] hover:bg-[#13306a]" data-testid="master-data-search-button">Cari</Button>
        </form>
        <div className="overflow-x-auto rounded-lg border" data-testid="master-data-table">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
              <tr><th className="px-3 py-2.5">Kode Material</th><th className="px-3 py-2.5">Nama / Deskripsi Material</th>{extraCols.map((c) => <th key={c} className="px-3 py-2.5">{c}</th>)}<th className="px-3 py-2.5">Diperbarui</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.items.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500" data-testid="master-data-empty">{applied ? "Material tidak ditemukan dalam Master Data" : "Master data masih kosong."}</td></tr>}
              {data.items.map((m) => (
                <tr key={m.code} data-testid={`master-data-row-${m.code}`}>
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-blue-900">{m.code}</td>
                  <td className="px-3 py-2.5">{m.name}</td>
                  {extraCols.map((c) => <td key={c} className="px-3 py-2.5 text-slate-600">{m.extra?.[c] || "-"}</td>)}
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{fmtDateTime(m.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={data.total} limit={LIMIT} onChange={setPage} testId="master-data-pager" />
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-bold text-[#0B2149]">Riwayat Versi Master Data</h2>
        <VersionTable versions={versions} onRestore={isAdmin ? setRestoreTarget : null} />
      </div>

      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent data-testid="master-restore-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan master data ke v{restoreTarget?.version}?</AlertDialogTitle>
            <AlertDialogDescription>Data aktif akan diganti dengan snapshot versi tersebut. Versi baru akan dicatat; histori tidak dihapus. Dokumen lama tidak berubah.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={restore} className="bg-[#0B2149]" data-testid="master-restore-confirm">Pulihkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
