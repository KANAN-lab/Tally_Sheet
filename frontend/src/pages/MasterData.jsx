import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileUp,
  History,
  Loader2,
  RotateCcw,
  Search,
  UploadCloud,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

const LIMIT = 25;
export const MODE = { replace: "Ganti Data", upsert: "Tambah/Update", restore: "Pemulihan" };

export function VersionTable({ versions, onRestore }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white" data-testid="master-data-version-history-table">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
          <tr>
            <th className="px-3 py-2.5">Versi</th>
            <th className="px-3 py-2.5">Tanggal Upload</th>
            <th className="px-3 py-2.5">Nama File</th>
            <th className="px-3 py-2.5">Metode</th>
            <th className="px-3 py-2.5">Oleh</th>
            <th className="px-3 py-2.5">Baru / Update / Nonaktif</th>
            <th className="px-3 py-2.5">Total Aktif</th>
            {onRestore && <th className="px-3 py-2.5 text-right">Aksi</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {versions.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                Belum ada riwayat upload master data.
              </td>
            </tr>
          )}
          {versions.map((v, i) => (
            <tr key={v.id} className="hover:bg-slate-50/60" data-testid={`master-version-row-${v.version}`}>
              <td className="px-3 py-2.5 font-mono font-semibold">
                v{v.version}
                {i === 0 && (
                  <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    AKTIF
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{fmtDateTime(v.uploaded_at)}</td>
              <td className="px-3 py-2.5 max-w-[200px] truncate text-slate-800" title={v.filename}>{v.filename}</td>
              <td className="px-3 py-2.5 text-slate-700">{MODE[v.mode] || v.mode}</td>
              <td className="px-3 py-2.5 text-slate-700">{v.uploaded_by_name}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{v.inserted} / {v.updated} / {v.deactivated}</td>
              <td className="px-3 py-2.5 font-semibold text-blue-900">{v.active_total}</td>
              {onRestore && (
                <td className="px-3 py-2 text-right">
                  {i > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRestore(v)}
                      className="text-xs text-blue-700 hover:bg-blue-50"
                      data-testid={`master-version-restore-${v.version}`}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Pulihkan
                    </Button>
                  )}
                </td>
              )}
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: "materials" | "suppliers" | "history"
  const activeTab = searchParams.get("tab") || "materials";
  const setActiveTab = (tab) => {
    const p = new URLSearchParams(searchParams);
    p.set("tab", tab);
    p.delete("upload");
    setSearchParams(p);
  };

  // Materials State
  const [matQ, setMatQ] = useState("");
  const [matApplied, setMatApplied] = useState("");
  const [matPage, setMatPage] = useState(1);
  const [matData, setMatData] = useState({ items: [], total: 0 });
  const [matLoading, setMatLoading] = useState(false);

  // Suppliers State
  const [supQ, setSupQ] = useState("");
  const [supApplied, setSupApplied] = useState("");
  const [supPage, setSupPage] = useState(1);
  const [supData, setSupData] = useState({ items: [], total: 0 });
  const [supLoading, setSupLoading] = useState(false);

  // Meta & History State
  const [status, setStatus] = useState(null);
  const [versions, setVersions] = useState([]);
  const [restoreTarget, setRestoreTarget] = useState(null);

  // Material Upload Modal State
  const [matUploadOpen, setMatUploadOpen] = useState(false);
  const [matFile, setMatFile] = useState(null);
  const [matMode, setMatMode] = useState("upsert");
  const [matPreview, setMatPreview] = useState(null);
  const [matBusy, setMatBusy] = useState(false);
  const matFileInputRef = useRef(null);

  // Supplier Upload Modal State
  const [supUploadOpen, setSupUploadOpen] = useState(false);
  const [supFile, setSupFile] = useState(null);
  const [supUploading, setSupUploading] = useState(false);
  const supFileInputRef = useRef(null);

  // Auto-open upload dialog if URL has ?upload=1
  useEffect(() => {
    if (searchParams.get("upload") === "1" && isAdmin) {
      if (activeTab === "suppliers") {
        setSupUploadOpen(true);
      } else {
        setMatUploadOpen(true);
      }
    }
  }, [searchParams, activeTab, isAdmin]);

  // Load Meta Data (Master Status & Versions)
  const loadMeta = useCallback(() => {
    api.get("/master/status").then((r) => setStatus(r.data)).catch(() => {});
    api.get("/master/versions").then((r) => setVersions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // Load Materials
  const loadMaterials = useCallback(() => {
    setMatLoading(true);
    api.get("/materials", { params: { q: matApplied, page: matPage, limit: LIMIT } })
      .then((r) => setMatData(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setMatLoading(false));
  }, [matApplied, matPage]);

  useEffect(() => {
    if (activeTab === "materials") {
      loadMaterials();
    }
  }, [activeTab, loadMaterials]);

  // Load Suppliers
  const loadSuppliers = useCallback(() => {
    setSupLoading(true);
    api.get("/suppliers", { params: { q: supApplied, page: supPage, limit: LIMIT } })
      .then((r) => setSupData(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setSupLoading(false));
  }, [supApplied, supPage]);

  useEffect(() => {
    if (activeTab === "suppliers") {
      loadSuppliers();
    }
  }, [activeTab, loadSuppliers]);

  // Material Search Handler
  const handleMatSearch = (e) => {
    e.preventDefault();
    setMatPage(1);
    setMatApplied(matQ.trim());
  };

  const handleMatClear = () => {
    setMatQ("");
    setMatApplied("");
    setMatPage(1);
  };

  // Supplier Search Handler
  const handleSupSearch = (e) => {
    e.preventDefault();
    setSupPage(1);
    setSupApplied(supQ.trim());
  };

  const handleSupClear = () => {
    setSupQ("");
    setSupApplied("");
    setSupPage(1);
  };

  // Restore Action
  const restore = async () => {
    try {
      const r = await api.post(`/master/versions/${restoreTarget.id}/restore`);
      toast.success(`Master data dipulihkan (versi baru v${r.data.version})`);
      setRestoreTarget(null);
      loadMeta();
      loadMaterials();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  // Material Upload Actions
  const handleMatFilePick = (f) => {
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
      return toast.error("Format file harus .xlsx, .xls, atau .csv");
    }
    setMatFile(f);
    setMatPreview(null);
  };

  const handleMatPreview = async () => {
    if (!matFile) return toast.error("Pilih file Excel terlebih dahulu");
    const fd = new FormData();
    fd.append("file", matFile);
    setMatBusy(true);
    try {
      const r = await api.post("/master/preview", fd);
      setMatPreview(r.data);
      toast.success("Pratinjau data valid. Silakan periksa statistik sebelum memproses.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setMatBusy(false);
    }
  };

  const handleMatCommit = async () => {
    if (!matPreview?.preview_id) return;
    setMatBusy(true);
    try {
      const r = await api.post("/master/commit", { preview_id: matPreview.preview_id, mode: matMode });
      toast.success(
        `Master data v${r.data.version} berhasil diproses: ${r.data.inserted} baru, ${r.data.updated} diperbarui, ${r.data.deactivated} dinonaktifkan`
      );
      setMatUploadOpen(false);
      setMatFile(null);
      setMatPreview(null);
      loadMeta();
      loadMaterials();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setMatBusy(false);
    }
  };

  // Supplier Upload Action
  const handleSupUpload = async () => {
    if (!supFile) {
      return toast.error("Silakan pilih file Excel Tcode MKVZ terlebih dahulu");
    }
    const formData = new FormData();
    formData.append("file", supFile);

    setSupUploading(true);
    try {
      const res = await api.post("/suppliers/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(
        `Upload berhasil! ${res.data.inserted} supplier baru, ${res.data.updated} diperbarui`
      );
      setSupUploadOpen(false);
      setSupFile(null);
      loadSuppliers();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSupUploading(false);
    }
  };

  const last = status?.last_version;
  const extraCols = Array.from(new Set(matData.items.flatMap((m) => Object.keys(m.extra || {})))).slice(0, 4);

  return (
    <div data-testid="master-data-hub" className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Master Data Hub"
        subtitle="Satu pusat pengelolaan terpadu untuk Master Data Material (SAP), Master Supplier (MKVZ), serta Riwayat Versi."
        actions={
          isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setMatUploadOpen(true)}
                className="bg-blue-700 hover:bg-blue-800"
                data-testid="master-upload-mat-btn"
              >
                <UploadCloud className="mr-1.5 h-4 w-4" /> Upload Material SAP
              </Button>
              <Button
                onClick={() => setSupUploadOpen(true)}
                className="bg-[#0B2149] hover:bg-[#13306a]"
                data-testid="master-upload-sup-btn"
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Upload Supplier MKVZ
              </Button>
            </div>
          )
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="master-kpi-summary">
        <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Material SAP Aktif</div>
            <div className="font-display text-2xl font-bold text-slate-900" data-testid="master-total-materials">
              {(status?.active_total ?? matData.total).toLocaleString("id-ID")}
            </div>
            <div className="text-[11px] text-slate-500">
              {last ? `Versi v${last.version} · ${MODE[last.mode] || last.mode}` : "Belum ada upload"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Supplier Vendor (MKVZ)</div>
            <div className="font-display text-2xl font-bold text-slate-900" data-testid="master-total-suppliers">
              {supData.total.toLocaleString("id-ID")}
            </div>
            <div className="text-[11px] text-slate-500">Vendor SAP Tcode MKVZ Resmi</div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <History className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pembaruan Terakhir</div>
            <div className="font-display text-sm font-bold text-slate-900">
              {last ? fmtDateTime(last.uploaded_at) : "Belum ada riwayat"}
            </div>
            <div className="text-[11px] text-slate-500">
              {last ? `Oleh: ${last.uploaded_by_name}` : "Siap menerima file"}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Header */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("materials")}
          className={`relative flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "materials"
              ? "border-blue-700 text-blue-900 bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
          data-testid="tab-materials"
        >
          <Boxes className="h-4 w-4" />
          <span>Material (SAP)</span>
          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700">
            {(status?.active_total ?? matData.total).toLocaleString("id-ID")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("suppliers")}
          className={`relative flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "suppliers"
              ? "border-blue-700 text-blue-900 bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
          data-testid="tab-suppliers"
        >
          <Building2 className="h-4 w-4" />
          <span>Supplier Vendor (MKVZ)</span>
          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700">
            {supData.total.toLocaleString("id-ID")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`relative flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "history"
              ? "border-blue-700 text-blue-900 bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
          data-testid="tab-history"
        >
          <History className="h-4 w-4" />
          <span>Riwayat Versi Master</span>
          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700">
            {versions.length}
          </span>
        </button>
      </div>

      {/* TAB 1: MATERIAL SAP */}
      {activeTab === "materials" && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4" data-testid="tab-materials-content">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleMatSearch} className="flex flex-1 max-w-lg gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9 pr-9 bg-white"
                  placeholder="Cari kode atau nama material..."
                  value={matQ}
                  onChange={(e) => setMatQ(e.target.value)}
                  data-testid="master-material-search-input"
                />
                {matQ && (
                  <button
                    type="button"
                    onClick={handleMatClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="submit" className="bg-[#0B2149] hover:bg-[#13306a]" data-testid="master-material-search-button">
                Cari
              </Button>
            </form>

            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setMatUploadOpen(true)}
                className="text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <UploadCloud className="mr-1.5 h-4 w-4" /> Upload Material
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-3 w-16">No.</th>
                  <th className="px-4 py-3">Kode Material</th>
                  <th className="px-4 py-3">Nama / Deskripsi Material</th>
                  {extraCols.map((c) => (
                    <th key={c} className="px-4 py-3">{c}</th>
                  ))}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Diperbarui</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {matLoading ? (
                  <tr>
                    <td colSpan={6 + extraCols.length} className="px-4 py-10 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-700" /> Memuat data material...
                      </div>
                    </td>
                  </tr>
                ) : matData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6 + extraCols.length} className="px-4 py-10 text-center text-slate-500" data-testid="master-data-empty">
                      {matApplied ? "Material tidak ditemukan dalam Master Data." : "Master data material masih kosong."}
                    </td>
                  </tr>
                ) : (
                  matData.items.map((m, idx) => (
                    <tr key={m.code} className="hover:bg-slate-50/60" data-testid={`master-data-row-${m.code}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{(matPage - 1) * LIMIT + idx + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-900">{m.code}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium">{m.name}</td>
                      {extraCols.map((c) => (
                        <td key={c} className="px-4 py-3 text-slate-600">{m.extra?.[c] || "-"}</td>
                      ))}
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Aktif
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">{fmtDateTime(m.updated_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pager page={matPage} total={matData.total} limit={LIMIT} onChange={setMatPage} testId="master-material-pager" />
        </div>
      )}

      {/* TAB 2: SUPPLIER VENDOR (MKVZ) */}
      {activeTab === "suppliers" && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4" data-testid="tab-suppliers-content">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleSupSearch} className="flex flex-1 max-w-lg gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9 pr-9 bg-white"
                  placeholder="Cari kode vendor, nama supplier, atau kota..."
                  value={supQ}
                  onChange={(e) => setSupQ(e.target.value)}
                  data-testid="supplier-search-input"
                />
                {supQ && (
                  <button
                    type="button"
                    onClick={handleSupClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="submit" className="bg-[#0B2149] hover:bg-[#13306a]" data-testid="supplier-search-button">
                Cari
              </Button>
            </form>

            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setSupUploadOpen(true)}
                className="text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Upload Excel MKVZ
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
                <tr>
                  <th className="px-4 py-3 w-16">No.</th>
                  <th className="px-4 py-3">Kode Vendor</th>
                  <th className="px-4 py-3">Nama Supplier / Vendor</th>
                  <th className="px-4 py-3">Kota</th>
                  <th className="px-4 py-3">Purchasing Org</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {supLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-700" /> Memuat data supplier...
                      </div>
                    </td>
                  </tr>
                ) : supData.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500" data-testid="supplier-empty">
                      {supApplied ? "Supplier tidak ditemukan." : "Belum ada master supplier terdaftar."}
                    </td>
                  </tr>
                ) : (
                  supData.items.map((s, idx) => (
                    <tr key={s.id || s.code} className="hover:bg-slate-50/60" data-testid={`supplier-row-${s.code}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{(supPage - 1) * LIMIT + idx + 1}</td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-900">{s.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                      <td className="px-4 py-3 text-slate-600">{s.city || "-"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.purchasing_org || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Aktif
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pager page={supPage} total={supData.total} limit={LIMIT} onChange={setSupPage} testId="supplier-pager" />
        </div>
      )}

      {/* TAB 3: RIWAYAT VERSI */}
      {activeTab === "history" && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4" data-testid="tab-history-content">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B2149]">Riwayat Pembaruan & Snapshot Versi</h2>
            <p className="text-xs text-slate-500">
              Setiap kali upload dilakukan, versi baru dicatat. Anda dapat memulihkan (rollback) data material ke versi sebelumnya tanpa kehilangan histori.
            </p>
          </div>
          <VersionTable versions={versions} onRestore={isAdmin ? setRestoreTarget : null} />
        </div>
      )}

      {/* DIALOG 1: UPLOAD MATERIAL SAP */}
      <Dialog open={matUploadOpen} onOpenChange={setMatUploadOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="material-upload-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#0B2149]">
              <UploadCloud className="h-5 w-5 text-blue-700" />
              Upload Master Data Material (SAP)
            </DialogTitle>
            <DialogDescription>
              Unggah file Excel (.xlsx, .xls) atau .csv. Sistem akan otomatis mendeteksi kolom Kode Material, Nama/Deskripsi, serta kolom tambahan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Mode Selection */}
            <div className="rounded-lg border bg-slate-50/70 p-4">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Metode Pembaruan</Label>
              <RadioGroup value={matMode} onValueChange={setMatMode} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${matMode === "upsert" ? "border-blue-600 bg-white shadow-sm ring-1 ring-blue-600" : "bg-white/60 hover:bg-white"}`}>
                  <RadioGroupItem value="upsert" id="mat-m-upsert" className="mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Tambah / Perbarui (Upsert) - Disarankan</div>
                    <div className="text-[11px] text-slate-500">Material baru ditambahkan, yang sudah ada diperbarui, tidak menonaktifkan material lama.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${matMode === "replace" ? "border-rose-600 bg-white shadow-sm ring-1 ring-rose-600" : "bg-white/60 hover:bg-white"}`}>
                  <RadioGroupItem value="replace" id="mat-m-replace" className="mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-rose-900">Ganti Seluruh Data (Replace)</div>
                    <div className="text-[11px] text-slate-500">Hanya material di file ini yang aktif. Material yang tidak ada di file akan dinonaktifkan.</div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* File Dropzone */}
            <div
              onClick={() => matFileInputRef.current?.click()}
              className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer transition-all"
            >
              <input
                ref={matFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleMatFilePick(e.target.files?.[0])}
                className="hidden"
              />
              <FileUp className="h-9 w-9 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <div className="mt-2 text-sm font-semibold text-slate-800">
                {matFile ? matFile.name : "Klik atau seret file Excel material ke sini"}
              </div>
              <div className="text-xs text-slate-500">Mendukung format .xlsx, .xls, .csv</div>
              {matFile && (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMatPreview();
                    }}
                    disabled={matBusy}
                    className="bg-blue-700 hover:bg-blue-800 text-xs"
                  >
                    {matBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    Pratinjau Data File
                  </Button>
                </div>
              )}
            </div>

            {/* Preview Section */}
            {matPreview && (
              <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-950">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Hasil Validasi File
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-white p-2.5 border text-center">
                    <div className="text-[10px] uppercase font-semibold text-slate-500">Total Baris</div>
                    <div className="text-base font-bold text-slate-900">{matPreview.total_rows}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border text-center">
                    <div className="text-[10px] uppercase font-semibold text-emerald-600">Valid</div>
                    <div className="text-base font-bold text-emerald-700">{matPreview.valid_rows}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border text-center">
                    <div className="text-[10px] uppercase font-semibold text-blue-600">Material Baru</div>
                    <div className="text-base font-bold text-blue-700">{matPreview.stats.new}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border text-center">
                    <div className="text-[10px] uppercase font-semibold text-indigo-600">Diperbarui</div>
                    <div className="text-base font-bold text-indigo-700">{matPreview.stats.updated}</div>
                  </div>
                </div>

                <div className="text-xs text-slate-600">
                  Kolom terdeteksi: Kode = <b>{matPreview.code_column}</b>, Nama = <b>{matPreview.name_column}</b>
                  {matPreview.extra_columns.length > 0 && <>, Ekstra: {matPreview.extra_columns.join(", ")}</>}
                </div>

                {matPreview.errors?.length > 0 && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <div className="font-semibold flex items-center gap-1.5 mb-1 text-rose-900">
                      <AlertTriangle className="h-3.5 w-3.5" /> Ditemukan {matPreview.error_rows} baris error (akan dilewati)
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                      {matPreview.errors.slice(0, 5).map((er, idx) => (
                        <li key={idx}>Baris {er.line}: {er.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMatUploadOpen(false)} disabled={matBusy}>
              Batal
            </Button>
            <Button
              onClick={handleMatCommit}
              disabled={!matPreview || matBusy}
              className="bg-[#0B2149] hover:bg-[#13306a]"
            >
              {matBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1.5 h-4 w-4" />}
              Proses & Simpan ke Master Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: UPLOAD SUPPLIER MKVZ */}
      <Dialog open={supUploadOpen} onOpenChange={setSupUploadOpen}>
        <DialogContent className="max-w-md" data-testid="supplier-upload-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#0B2149]">
              <FileSpreadsheet className="h-5 w-5 text-blue-700" />
              Upload Excel Supplier (MKVZ)
            </DialogTitle>
            <DialogDescription>
              Unggah file data vendor export SAP Tcode MKVZ (.xlsx atau .xls).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900">Format Kolom yang Dibutuhkan:</div>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                <li><b>Supplier</b> (Kode Vendor)</li>
                <li><b>Supplier Name</b> (Nama Supplier)</li>
                <li><b>City</b> (Kota, opsional)</li>
                <li><b>Purch. organization</b> (Organisasi Pembelian, opsional)</li>
              </ul>
            </div>

            <div
              onClick={() => supFileInputRef.current?.click()}
              className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer transition-all"
            >
              <input
                ref={supFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setSupFile(e.target.files?.[0])}
                className="hidden"
              />
              <FileSpreadsheet className="h-9 w-9 text-slate-400 group-hover:text-blue-600 transition-colors" />
              <div className="mt-2 text-sm font-semibold text-slate-800">
                {supFile ? supFile.name : "Klik atau seret file Excel MKVZ ke sini"}
              </div>
              <div className="text-xs text-slate-500">Mendukung .xlsx, .xls</div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSupUploadOpen(false)} disabled={supUploading}>
              Batal
            </Button>
            <Button
              onClick={handleSupUpload}
              disabled={!supFile || supUploading}
              className="bg-[#0B2149] hover:bg-[#13306a]"
            >
              {supUploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1.5 h-4 w-4" />}
              Upload & Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: RESTORE VERSION CONFIRMATION */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent data-testid="master-restore-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan master data ke v{restoreTarget?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              Data material aktif akan diganti dengan snapshot versi {restoreTarget?.version} ({restoreTarget?.filename}). Versi baru pemulihan akan dicatat dan histori dokumen tally sheet yang sudah ada tidak akan berubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={restore} className="bg-[#0B2149]" data-testid="master-restore-confirm">
              Pulihkan Versi Ini
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
