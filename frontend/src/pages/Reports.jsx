import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  Filter,
  Hourglass,
  Layers,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Truck,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import SupplierSearch from "@/components/SupplierSearch";
import { TableSkeleton } from "@/components/ui/skeleton";
import TallyQuickModal from "@/components/TallyQuickModal";
import { api, downloadReportExcel, errMsg } from "@/lib/api";

const LIMIT = 20;

const getPastDateStr = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function Reports() {
  const initialStartDate = getPastDateStr(7);
  const initialEndDate = getPastDateStr(0);

  const [activeTab, setActiveTab] = useState("traceability");
  const [activePreset, setActivePreset] = useState("week");
  const [previewSheetId, setPreviewSheetId] = useState(null);
  const [filters, setFilters] = useState({
    start_date: initialStartDate,
    end_date: initialEndDate,
    status: "all",
    supplier: "",
    q: ""
  });
  const [applied, setApplied] = useState({
    start_date: initialStartDate,
    end_date: initialEndDate,
    status: "all",
    supplier: "",
    q: ""
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState({
    kpi: {
      total_docs: 0,
      total_items: 0,
      total_qty: 0,
      completed_docs: 0,
      hold_docs: 0,
      in_progress_docs: 0,
      cancelled_docs: 0,
      first_pass_yield: 100
    },
    items: [],
    total: 0,
    vendor_performance: [],
    non_conformance: [],
    shelf_life: []
  });

  const isDirty = (
    filters.start_date !== applied.start_date ||
    filters.end_date !== applied.end_date ||
    filters.status !== applied.status ||
    filters.supplier !== applied.supplier ||
    filters.q !== applied.q
  );

  const loadData = useCallback(() => {
    setLoading(true);
    const params = {
      ...applied,
      page,
      limit: LIMIT
    };
    api.get("/reports/summary", { params })
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        toast.error(errMsg(err));
      })
      .finally(() => setLoading(false));
  }, [applied, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApply = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    setApplied(filters);
  };

  const handleReset = () => {
    const empty = { start_date: "", end_date: "", status: "all", supplier: "", q: "" };
    setFilters(empty);
    setApplied(empty);
    setActivePreset("all");
    setPage(1);
  };

  const applyPreset = (preset) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    let newStart = "";
    let newEnd = "";

    if (preset === "today") {
      newStart = todayStr;
      newEnd = todayStr;
    } else if (preset === "week") {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      const pastY = past7.getFullYear();
      const pastM = String(past7.getMonth() + 1).padStart(2, "0");
      const pastD = String(past7.getDate()).padStart(2, "0");
      newStart = `${pastY}-${pastM}-${pastD}`;
      newEnd = todayStr;
    } else if (preset === "month") {
      newStart = `${yyyy}-${mm}-01`;
      newEnd = todayStr;
    } else if (preset === "all") {
      newStart = "";
      newEnd = "";
    }

    const updated = { ...filters, start_date: newStart, end_date: newEnd };
    setFilters(updated);
    setApplied(updated);
    setActivePreset(preset);
    setPage(1);
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      toast.info("Sedang menyusun file Excel Laporan Audit ISO multi-sheet...");
      const filename = await downloadReportExcel({
        start_date: applied.start_date,
        end_date: applied.end_date,
        status: applied.status,
        supplier: applied.supplier,
        q: applied.q
      });
      toast.success(`Berhasil mengunduh ${filename}`);
    } catch (err) {
      toast.error(errMsg(err) || "Gagal mengunduh laporan Excel");
    } finally {
      setExporting(false);
    }
  };

  const kpi = data.kpi || {};
  const vendorList = data.vendor_performance || [];
  const ncrList = data.non_conformance || [];
  const shelfLifeList = data.shelf_life || [];

  return (
    <div className="space-y-6" data-testid="reports-page">
      {/* Header */}
      <PageHeader
        title="Laporan & Rekapitulasi Audit (ISO 9001:2015 / GMP)"
        subtitle="Dokumen resmi ketertelusuran penerimaan material incoming, evaluasi vendor, status rilis mutu QC, serta log ketidaksesuaian."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleExportExcel}
              disabled={exporting}
              className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm font-semibold gap-1.5"
              data-testid="btn-export-excel"
            >
              <Download className={`h-4 w-4 ${exporting ? "animate-bounce" : ""}`} />
              {exporting ? "Menyiapkan Excel..." : "Download Laporan Audit (.xlsx)"}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5 print:hidden"
            >
              <Printer className="h-4 w-4" /> Cetak Ringkasan
            </Button>
          </div>
        }
      />

      {/* ISO Document Control Notice */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-blue-50/50 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-white p-1 border border-slate-200 shadow-sm shrink-0 grid place-items-center">
            <img src="/logo.png" alt="Diamond Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-[#0B2149] text-sm">PT DIAMOND COLD STORAGE (PLANT 2111) — Standar Dokumen Kontrol Mutu FORM-WHS-ISO-008 Rev. 02</div>
            <div className="text-slate-600 mt-0.5">
              Sistem Manajemen Mutu Penerimaan Material Incoming. Memenuhi Klausul ISO 9001:2015 8.4, 8.6, 8.7, serta ISO 22000 / GMP Traceability.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 rounded bg-blue-100/80 px-2.5 py-1 font-mono font-semibold text-blue-800 border border-blue-200">
            Audit Ready
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total SJ Incoming */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2" data-testid="kpi-total-docs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Dokumen SJ</span>
            <div className="h-9 w-9 rounded-lg bg-blue-50 grid place-items-center text-blue-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-24 bg-slate-200 animate-pulse rounded-md mt-1" />
          ) : (
            <div className="text-2xl font-bold font-display text-slate-900">{kpi.total_docs ?? "-"}</div>
          )}
          <div className="text-[11px] text-slate-500">
            Total armada/SJ masuk tercatat
          </div>
        </div>

        {/* Total Baris Material */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2" data-testid="kpi-total-items">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Baris Material</span>
            <div className="h-9 w-9 rounded-lg bg-slate-100 grid place-items-center text-[#0B2149]">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-28 bg-slate-200 animate-pulse rounded-md mt-1" />
          ) : (
            <div className="text-2xl font-bold font-display text-slate-900">{kpi.total_items ?? "-"}</div>
          )}
          <div className="text-[11px] text-slate-500">
            Total Qty: <strong className="text-slate-700">{Number(kpi.total_qty || 0).toLocaleString("id-ID")}</strong> unit
          </div>
        </div>

        {/* Quality First-Pass Acceptance Rate */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2" data-testid="kpi-first-pass-yield">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quality Pass Rate</span>
            <div className="h-9 w-9 rounded-lg bg-emerald-50 grid place-items-center text-emerald-700">
              <Award className="h-5 w-5" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-20 bg-slate-200 animate-pulse rounded-md mt-1" />
          ) : (
            <div className="text-2xl font-bold font-display text-emerald-700">{kpi.first_pass_yield ?? 100}%</div>
          )}
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Target ISO: &ge; 98.0%</span>
            <span className="text-emerald-700 font-semibold">{kpi.completed_docs} Selesai</span>
          </div>
        </div>

        {/* Deviasi / Hold Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2" data-testid="kpi-hold-docs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kasus Hold / Deviasi</span>
            <div className={`h-9 w-9 rounded-lg grid place-items-center ${kpi.hold_docs > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-16 bg-slate-200 animate-pulse rounded-md mt-1" />
          ) : (
            <div className={`text-2xl font-bold font-display ${kpi.hold_docs > 0 ? "text-amber-700" : "text-slate-900"}`}>
              {kpi.hold_docs ?? 0}
            </div>
          )}
          <div className="text-[11px] text-slate-500">
            {kpi.hold_docs > 0 ? "Perlu tindak lanjut rekonsiliasi" : "Nihil deviasi terbuka"}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm space-y-4 no-print print:hidden" data-testid="reports-filter-card">
        {/* Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-blue-700" /> Filter Cepat Periode:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "today", label: "Hari Ini" },
              { id: "week", label: "7 Hari Terakhir" },
              { id: "month", label: "Bulan Ini" },
              { id: "all", label: "Semua Periode" }
            ].map((p) => {
              const isActive = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-700 text-white font-bold shadow-xs border border-blue-800"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50 hover:border-blue-300"
                  }`}
                  data-testid={`preset-${p.id}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Filter Inputs */}
        <form onSubmit={handleApply} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Dari Tanggal</label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => {
                  setActivePreset(null);
                  setFilters({ ...filters, start_date: e.target.value });
                }}
                className="bg-white text-xs h-9"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Sampai Tanggal</label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => {
                  setActivePreset(null);
                  setFilters({ ...filters, end_date: e.target.value });
                }}
                className="bg-white text-xs h-9"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Status Mutu / Alur</label>
              <Select
                value={filters.status}
                onValueChange={(val) => setFilters({ ...filters, status: val })}
              >
                <SelectTrigger className="bg-white text-xs h-9">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="completed">Selesai (Stock Ter-UU)</SelectItem>
                  <SelectItem value="hold">Hanya Status Hold (Tertahan)</SelectItem>
                  <SelectItem value="in_progress">Dalam Proses (Antrean)</SelectItem>
                  <SelectItem value="waiting_admin">Menunggu Admin WH</SelectItem>
                  <SelectItem value="waiting_qc">Menunggu QC</SelectItem>
                  <SelectItem value="draft">Draf Checker</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Filter Vendor / Supplier</label>
              <SupplierSearch
                value={filters.supplier}
                supplierName={filters.supplier}
                onSelect={(s) => setFilters({ ...filters, supplier: s.name || s.code })}
                onClear={() => setFilters({ ...filters, supplier: "" })}
                testId="filter-supplier-search"
              />
            </div>
          </div>

          {/* Row 2: Search input + Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Cari No. SJ, PO, Plat armada, kode/nama material, atau nomor batch..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="pl-8 pr-8 bg-white text-xs h-9"
              />
              {filters.q && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, q: "" })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-100 transition"
                  title="Bersihkan teks pencarian"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              {isDirty && (
                <span className="text-[11px] text-amber-600 font-semibold px-2 py-1 rounded bg-amber-50 border border-amber-200">
                  Filter belum diterapkan
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="text-xs text-slate-600 hover:text-slate-900 h-9 px-3"
              >
                <X className="mr-1 h-3.5 w-3.5" /> Reset
              </Button>
              <Button
                type="submit"
                className={`text-xs text-white h-9 px-5 transition-all ${
                  isDirty
                    ? "bg-blue-700 hover:bg-blue-800 shadow-md font-bold ring-2 ring-blue-400/50"
                    : "bg-slate-800 hover:bg-slate-900 font-semibold"
                }`}
              >
                Terapkan Filter
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* ISO Report Navigation Tabs */}
      <div className="border-b border-slate-200 no-print print:hidden">
        <nav className="flex space-x-2 sm:space-x-6 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("traceability")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === "traceability"
                ? "border-blue-700 text-blue-900 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            1. Rekap Ketertelusuran Material
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
              {data.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("vendor")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === "vendor"
                ? "border-blue-700 text-blue-900 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Building2 className="h-4 w-4" />
            2. Evaluasi Kinerja Vendor (ISO 8.4)
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-800 font-bold">
              {vendorList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ncr")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === "ncr"
                ? "border-blue-700 text-blue-900 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            3. Log Ketidaksesuaian &amp; Hold (ISO 8.7)
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              ncrList.length > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
            }`}>
              {ncrList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("shelf_life")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === "shelf_life"
                ? "border-blue-700 text-blue-900 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Hourglass className="h-4 w-4 text-emerald-600" />
            4. Monitoring Umur Simpan (FEFO / GMP)
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800 font-bold">
              {shelfLifeList.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content Display */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden" data-testid="reports-content-card">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : (
          <>
            {/* ================= TAB 1: REKAP KETERTELUSURAN ================= */}
            {activeTab === "traceability" && (
              <>
                <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Pratinjau Data Ketertelusuran Material ({data.total} Baris Ditemukan)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Log lengkap kedatangan fisik, PO SAP, batch supplier, dan tanggal rilis QC.
                    </p>
                  </div>
                  <span className="text-xs text-slate-600 font-mono">
                    Hal {page} dari {Math.max(1, Math.ceil(data.total / LIMIT))}
                  </span>
                </div>

                {data.items.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-2">
                    <FileCheck className="h-10 w-10 text-slate-300 mx-auto" />
                    <div className="text-sm font-semibold text-slate-700">Tidak ada data penerimaan yang cocok</div>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Coba sesuaikan rentang tanggal atau bersihkan kata kunci pencarian.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#0B2149] text-white font-semibold">
                          <tr>
                            <th className="py-3 px-3 w-10 text-center">No</th>
                            <th className="py-3 px-3">Tgl Datang</th>
                            <th className="py-3 px-3">No. Tally</th>
                            <th className="py-3 px-3">Surat Jalan / PO</th>
                            <th className="py-3 px-3">Armada Truk</th>
                            <th className="py-3 px-3">Material &amp; Batch</th>
                            <th className="py-3 px-3">Vendor / Supplier</th>
                            <th className="py-3 px-3 text-right">Kuantitas</th>
                            <th className="py-3 px-3 text-center">Status Mutu</th>
                            <th className="py-3 px-3">Aktor Verifikasi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {data.items.map((it, idx) => {
                            const rowNo = (page - 1) * LIMIT + idx + 1;
                            const isCompleted = it.status === "completed";
                            const isHold = it.status.includes("hold");

                            return (
                              <tr key={it.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-3 text-center font-mono text-slate-500">{rowNo}</td>
                                <td className="py-3 px-3 font-mono text-slate-800 whitespace-nowrap">{it.arrival_date || "-"}</td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewSheetId(it.sheet_id || it.id)}
                                      className="font-mono font-bold text-blue-900 hover:text-blue-700 hover:underline cursor-pointer inline-flex items-center gap-1 group text-left transition"
                                      title="Klik untuk melihat pratinjau cepat dokumen"
                                    >
                                      <span>{it.doc_no}</span>
                                      <ExternalLink className="h-3 w-3 text-blue-500 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </button>
                                    {it.has_berita_acara ? (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold" title="Berita Acara Dilampirkan">
                                        BA
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <div className="font-semibold text-slate-900">{it.delivery_note_no || "-"}</div>
                                  <div className="text-[11px] text-slate-500 font-mono">PO: {it.po_no || "-"}</div>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap font-mono font-semibold text-slate-800">{it.truck_plate || "-"}</td>
                                <td className="py-3 px-3 min-w-[200px]">
                                  <div className="font-semibold text-slate-900">{it.material_name}</div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    Kode: {it.material_code} | Batch: <span className="text-slate-800 font-semibold">{it.batch_fisik || "-"}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 max-w-[160px] truncate" title={it.supplier_name}>
                                  <div className="font-medium text-slate-800">{it.supplier_name || "-"}</div>
                                  {it.supplier_code && <div className="text-[10px] text-slate-400 font-mono">{it.supplier_code}</div>}
                                </td>
                                <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-semibold text-slate-900">
                                  {Number(it.qty || 0).toLocaleString("id-ID")} {it.uom}
                                </td>
                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold tracking-tight border ${
                                      isCompleted
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                        : isHold
                                        ? "bg-amber-50 text-amber-900 border-amber-300"
                                        : "bg-blue-50 text-blue-800 border-blue-200"
                                    }`}
                                  >
                                    {isCompleted
                                      ? "STOCK TER-UU"
                                      : isHold
                                      ? (it.pending_category || "HOLD")
                                      : it.status.replace("_", " ").toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                                  <div>Checker: <strong className="text-slate-800">{it.pic_name || it.created_by_name || "-"}</strong></div>
                                  {it.qc_by_name && <div className="text-emerald-700 font-medium">QC: {it.qc_by_name}</div>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="lg:hidden divide-y divide-slate-100">
                      {data.items.map((it, idx) => {
                        const rowNo = (page - 1) * LIMIT + idx + 1;
                        const isCompleted = it.status === "completed";
                        const isHold = it.status.includes("hold");

                        return (
                          <div key={it.id || idx} className="p-4 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[11px] font-mono text-slate-400 mr-2">#{rowNo}</span>
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewSheetId(it.sheet_id || it.id)}
                                    className="font-mono font-bold text-blue-900 hover:text-blue-700 hover:underline text-xs inline-flex items-center gap-1 text-left"
                                    title="Klik untuk membuka pratinjau cepat dokumen"
                                  >
                                    <span>{it.doc_no}</span>
                                    <ExternalLink className="h-3 w-3 text-blue-500 opacity-60 shrink-0" />
                                  </button>
                                  {it.has_berita_acara ? (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[9px] font-bold">
                                      BA
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs font-semibold text-slate-900 mt-0.5">{it.material_name}</div>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 ${
                                  isCompleted
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : isHold
                                    ? "bg-amber-50 text-amber-900 border-amber-300"
                                    : "bg-blue-50 text-blue-800 border-blue-200"
                                }`}
                              >
                                {isCompleted ? "Stock Ter-UU" : isHold ? "Hold" : it.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <div>
                                <span className="text-slate-500">Surat Jalan:</span>{" "}
                                <strong className="text-slate-800">{it.delivery_note_no || "-"}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">Armada Truk:</span>{" "}
                                <strong className="font-mono text-slate-800">{it.truck_plate || "-"}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">Batch Fisik:</span>{" "}
                                <strong className="font-mono text-slate-800">{it.batch_fisik || "-"}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500">Kuantitas:</span>{" "}
                                <strong className="text-slate-900">{Number(it.qty || 0).toLocaleString("id-ID")} {it.uom}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 px-4 py-3 no-print print:hidden">
                      <Pager page={page} total={data.total} limit={LIMIT} onChange={setPage} />
                    </div>
                  </>
                )}
              </>
            )}

            {/* ================= TAB 2: EVALUASI KINERJA VENDOR (ISO 8.4) ================= */}
            {activeTab === "vendor" && (
              <>
                <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                  <h3 className="text-sm font-bold text-slate-800">
                    Evaluasi &amp; Peringkat Kinerja Pemasok (ISO 9001:2015 Clause 8.4)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Penilaian rasio kelolosan mutu, kedatangan armada, dan kategori audit vendor pengirim.
                  </p>
                </div>

                {vendorList.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-slate-700">Belum ada data transaksi vendor pada periode ini</div>
                  </div>
                ) : (
                  <>
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#0B2149] text-white font-semibold">
                          <tr>
                            <th className="py-3 px-3 w-10 text-center">No</th>
                            <th className="py-3 px-3">Nama Vendor / Supplier</th>
                            <th className="py-3 px-3">Kode MKVZ</th>
                            <th className="py-3 px-3 text-center">Total Pengiriman (SJ)</th>
                            <th className="py-3 px-3 text-right">Total Volume Masuk</th>
                            <th className="py-3 px-3 text-center">Selesai (Ter-UU)</th>
                            <th className="py-3 px-3 text-center">Kasus Hold</th>
                            <th className="py-3 px-3 text-right">Acceptance Rate</th>
                            <th className="py-3 px-3 text-center">Grade Kinerja</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {vendorList.map((v, idx) => (
                            <tr key={v.supplier_code || idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-3 px-3 font-semibold text-slate-900">{v.supplier_name}</td>
                              <td className="py-3 px-3 font-mono text-slate-500">{v.supplier_code}</td>
                              <td className="py-3 px-3 text-center font-bold text-slate-800">{v.total_docs} SJ</td>
                              <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                                {Number(v.total_qty || 0).toLocaleString("id-ID")} unit
                              </td>
                              <td className="py-3 px-3 text-center text-emerald-700 font-bold">{v.completed_docs}</td>
                              <td className="py-3 px-3 text-center font-bold text-amber-700">{v.hold_docs}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-blue-900">
                                {v.acceptance_rate}%
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold border ${
                                    v.grade_color === "emerald"
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                      : v.grade_color === "amber"
                                      ? "bg-amber-50 text-amber-800 border-amber-300"
                                      : "bg-rose-50 text-rose-800 border-rose-300"
                                  }`}
                                >
                                  {v.grade}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards for Tab 2 */}
                    <div className="lg:hidden divide-y divide-slate-100">
                      {vendorList.map((v, idx) => (
                        <div key={v.supplier_code || idx} className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[11px] font-mono text-slate-400 mr-2">#{idx + 1}</span>
                              <span className="font-semibold text-slate-900 text-sm">{v.supplier_name}</span>
                              {v.supplier_code && (
                                <div className="text-xs font-mono text-slate-500 mt-0.5">Kode MKVZ: {v.supplier_code}</div>
                              )}
                            </div>
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${
                                v.grade_color === "emerald"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : v.grade_color === "amber"
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-rose-50 text-rose-800 border-rose-300"
                              }`}
                            >
                              Grade {v.grade}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              <span className="text-slate-500 block text-[11px]">Total Pengiriman</span>
                              <strong className="text-slate-800">{v.total_docs} Surat Jalan</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Total Volume</span>
                              <strong className="font-mono text-slate-900">{Number(v.total_qty || 0).toLocaleString("id-ID")} unit</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Lolos (Ter-UU) / Hold</span>
                              <span>
                                <strong className="text-emerald-700">{v.completed_docs}</strong> /{" "}
                                <strong className={v.hold_docs > 0 ? "text-amber-700" : "text-slate-600"}>{v.hold_docs}</strong>
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Acceptance Rate</span>
                              <strong className="text-blue-900 font-bold">{v.acceptance_rate}%</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ================= TAB 3: LOG KETIDAKSESUAIAN & HOLD (ISO 8.7) ================= */}
            {activeTab === "ncr" && (
              <>
                <div className="border-b border-slate-100 bg-amber-50/50 px-5 py-4">
                  <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-700" />
                    Log Ketidaksesuaian &amp; Penahanan Material (ISO 9001:2015 Clause 8.7)
                  </h3>
                  <p className="text-xs text-amber-800/80">
                    Daftar insiden penahanan fisik atau dokumen (Hold Admin &amp; Hold QC) untuk audit perbaikan mutu.
                  </p>
                </div>

                {ncrList.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-2">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                    <div className="text-sm font-semibold text-slate-700">Nihil Deviasi / Kasus Hold</div>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Semua dokumen pada periode ini memenuhi standar inspeksi tanpa catatan penahanan terbuka.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#7F1D1D] text-white font-semibold">
                          <tr>
                            <th className="py-3 px-3 w-10 text-center">No</th>
                            <th className="py-3 px-3">Tgl Masuk</th>
                            <th className="py-3 px-3">No. Tally</th>
                            <th className="py-3 px-3">Surat Jalan / PO</th>
                            <th className="py-3 px-3">Vendor</th>
                            <th className="py-3 px-3">Material &amp; Batch</th>
                            <th className="py-3 px-3 text-center">Kategori Deviasi</th>
                            <th className="py-3 px-3">Uraian Masalah / Alasan Hold</th>
                            <th className="py-3 px-3 text-center">Status</th>
                            <th className="py-3 px-3">PIC Bertugas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {ncrList.map((ncr, idx) => (
                            <tr key={ncr.id || idx} className="hover:bg-amber-50/40 transition-colors">
                              <td className="py-3 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-3 px-3 font-mono text-slate-800 whitespace-nowrap">{ncr.arrival_date || "-"}</td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewSheetId(ncr.sheet_id || ncr.id)}
                                    className="font-mono font-bold text-red-900 hover:text-red-700 hover:underline cursor-pointer inline-flex items-center gap-1 group text-left transition"
                                    title="Klik untuk melihat pratinjau cepat dokumen"
                                  >
                                    <span>{ncr.doc_no}</span>
                                    <ExternalLink className="h-3 w-3 text-red-500 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </button>
                                  {ncr.has_berita_acara ? (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold" title="Berita Acara Dilampirkan">
                                      BA
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="font-semibold text-slate-900">{ncr.delivery_note_no || "-"}</div>
                                <div className="text-[11px] text-slate-500 font-mono">PO: {ncr.po_no || "-"}</div>
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-800 max-w-[150px] truncate">{ncr.supplier_name || "-"}</td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{ncr.material_name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">Batch: {ncr.batch_fisik || "-"}</div>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className="inline-block px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300 text-[11px]">
                                  {ncr.pending_category || "Lain-lain"}
                                </span>
                              </td>
                              <td className="py-3 px-3 max-w-[220px] text-slate-800 font-medium">{ncr.pending_reason || "-"}</td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold uppercase text-[10px] border border-red-200">
                                  {ncr.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                                {ncr.updated_by_name || ncr.created_by_name || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards for Tab 3 */}
                    <div className="lg:hidden divide-y divide-slate-100">
                      {ncrList.map((ncr, idx) => (
                        <div key={ncr.id || idx} className="p-4 space-y-2.5 bg-amber-50/15">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[11px] font-mono text-slate-400 mr-2">#{idx + 1}</span>
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setPreviewSheetId(ncr.sheet_id || ncr.id)}
                                  className="font-mono font-bold text-red-900 hover:text-red-700 hover:underline text-xs inline-flex items-center gap-1 text-left"
                                  title="Klik untuk membuka pratinjau cepat dokumen"
                                >
                                  <span>{ncr.doc_no}</span>
                                  <ExternalLink className="h-3 w-3 text-red-500 opacity-60 shrink-0" />
                                </button>
                                {ncr.has_berita_acara ? (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[9px] font-bold">
                                    BA
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs font-semibold text-slate-900 mt-0.5">{ncr.material_name}</div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold uppercase text-[10px] border border-red-200 shrink-0">
                              {ncr.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                            <div>
                              <span className="text-slate-500">Tgl Masuk:</span>{" "}
                              <strong className="font-mono text-slate-800">{ncr.arrival_date || "-"}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Surat Jalan:</span>{" "}
                              <strong className="text-slate-800">{ncr.delivery_note_no || "-"}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Batch Fisik:</span>{" "}
                              <strong className="font-mono text-slate-800">{ncr.batch_fisik || "-"}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Vendor:</span>{" "}
                              <strong className="text-slate-800 truncate block">{ncr.supplier_name || "-"}</strong>
                            </div>
                          </div>

                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-950 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-900">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                              Kategori: {ncr.pending_category || "Lain-lain"}
                            </div>
                            <div className="text-slate-800 pl-5">
                              {ncr.pending_reason || "Tidak ada catatan spesifik"}
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-0.5">
                            <span>PIC Verifikasi:</span>
                            <span className="font-medium text-slate-800">{ncr.updated_by_name || ncr.created_by_name || "-"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ================= TAB 4: MONITORING UMUR SIMPAN (FEFO) ================= */}
            {activeTab === "shelf_life" && (
              <>
                <div className="border-b border-slate-100 bg-emerald-50/50 px-5 py-4">
                  <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <Hourglass className="h-4 w-4 text-emerald-700" />
                    Monitoring Umur Simpan &amp; Kontrol Kedaluwarsa (ISO 22000 / GMP FEFO)
                  </h3>
                  <p className="text-xs text-emerald-800/80">
                    Pengawasan sisa umur simpan material saat tiba di gudang untuk mencegah penerimaan barang mendekati expired date.
                  </p>
                </div>

                {shelfLifeList.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <Hourglass className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-slate-700">Belum ada data expired date pada periode ini</div>
                  </div>
                ) : (
                  <>
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#0B2149] text-white font-semibold">
                          <tr>
                            <th className="py-3 px-3 w-10 text-center">No</th>
                            <th className="py-3 px-3">Tgl Kedatangan</th>
                            <th className="py-3 px-3">Material &amp; Batch Fisik</th>
                            <th className="py-3 px-3">Vendor</th>
                            <th className="py-3 px-3 text-center">Tgl Produksi</th>
                            <th className="py-3 px-3 text-center">Tgl Kedaluwarsa</th>
                            <th className="py-3 px-3 text-right">Sisa Hari Simpan</th>
                            <th className="py-3 px-3 text-right">% Sisa Umur</th>
                            <th className="py-3 px-3 text-center">Kategori Keamanan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {shelfLifeList.map((sl, idx) => (
                            <tr key={sl.id || idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-3 px-3 font-mono text-slate-800 whitespace-nowrap">{sl.arrival_date || "-"}</td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{sl.material_name}</div>
                                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                                  <span>Kode: {sl.material_code}</span>
                                  <span>| Batch: <strong className="text-slate-800">{sl.batch_fisik || "-"}</strong></span>
                                  {sl.doc_no && (
                                    <>
                                      <span>| Tally:</span>
                                      <button
                                        type="button"
                                        onClick={() => setPreviewSheetId(sl.sheet_id || sl.id)}
                                        className="text-blue-700 hover:text-blue-900 hover:underline font-bold inline-flex items-center gap-0.5"
                                        title="Klik untuk melihat pratinjau cepat dokumen"
                                      >
                                        <span>{sl.doc_no}</span>
                                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-800 max-w-[150px] truncate">{sl.supplier_name || "-"}</td>
                              <td className="py-3 px-3 text-center font-mono text-slate-600">{sl.production_date || "-"}</td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{sl.expired_date || "-"}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                                {sl.remaining_days !== null ? `${sl.remaining_days} hari` : "-"}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-blue-900">
                                {sl.remaining_pct !== null ? `${sl.remaining_pct}%` : "-"}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold border ${
                                    sl.shelf_status === "safe"
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                      : sl.shelf_status === "warning"
                                      ? "bg-amber-50 text-amber-800 border-amber-300"
                                      : "bg-rose-50 text-rose-800 border-rose-300"
                                  }`}
                                >
                                  {sl.shelf_status === "safe"
                                    ? "Aman (Fresh)"
                                    : sl.shelf_status === "warning"
                                    ? "Perhatian (Medium)"
                                    : "Kritis / Near Expired"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards for Tab 4 */}
                    <div className="lg:hidden divide-y divide-slate-100">
                      {shelfLifeList.map((sl, idx) => (
                        <div key={sl.id || idx} className="p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[11px] font-mono text-slate-400 mr-2">#{idx + 1}</span>
                              <span className="font-semibold text-slate-900 text-xs">{sl.material_name}</span>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>Kode: {sl.material_code}</span>
                                <span>| Batch: <strong className="text-slate-800 font-bold">{sl.batch_fisik || "-"}</strong></span>
                                {sl.doc_no && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewSheetId(sl.sheet_id || sl.id)}
                                    className="text-blue-700 hover:text-blue-900 hover:underline font-bold inline-flex items-center gap-0.5 ml-1"
                                    title="Klik untuk melihat pratinjau cepat dokumen"
                                  >
                                    <span>{sl.doc_no}</span>
                                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                                sl.shelf_status === "safe"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : sl.shelf_status === "warning"
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-rose-50 text-rose-800 border-rose-300"
                              }`}
                            >
                              {sl.shelf_status === "safe"
                                ? "Aman (Fresh)"
                                : sl.shelf_status === "warning"
                                ? "Perhatian (Medium)"
                                : "Kritis / Near Expired"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <div>
                              <span className="text-slate-500 block text-[11px]">Tgl Datang:</span>
                              <strong className="font-mono text-slate-800">{sl.arrival_date || "-"}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Vendor:</span>
                              <strong className="text-slate-800 truncate block">{sl.supplier_name || "-"}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Tgl Produksi:</span>
                              <strong className="font-mono text-slate-700">{sl.production_date || "-"}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Tgl Kedaluwarsa:</span>
                              <strong className="font-mono text-slate-900">{sl.expired_date || "-"}</strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1 px-1">
                            <div>
                              <span className="text-slate-500 text-[11px]">Sisa Hari:</span>{" "}
                              <strong className="font-mono text-slate-800">
                                {sl.remaining_days !== null ? `${sl.remaining_days} hari` : "-"}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[11px]">Sisa Umur:</span>{" "}
                              <strong className="font-mono text-blue-900">
                                {sl.remaining_pct !== null ? `${sl.remaining_pct}%` : "-"}
                              </strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Official ISO Sign-off Section for Print */}
      <div className="hidden print:block avoid-break mt-8 pt-6 border-t-2 border-slate-800 text-xs">
        <div className="text-center font-bold text-slate-900 mb-6 uppercase tracking-wider">
          Lembar Verifikasi &amp; Pengesahan Dokumen Audit (ISO 9001:2015 / GMP)
        </div>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div className="border border-slate-400 p-3 rounded space-y-12">
            <div className="font-semibold text-slate-700">Dibuat Oleh (Checker Gudang)</div>
            <div>
              <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
              <div className="text-[10px] text-slate-500">Nama &amp; Tanda Tangan / Tgl</div>
            </div>
          </div>
          <div className="border border-slate-400 p-3 rounded space-y-12">
            <div className="font-semibold text-slate-700">Diverifikasi (Spv. Warehouse)</div>
            <div>
              <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
              <div className="text-[10px] text-slate-500">Nama &amp; Tanda Tangan / Tgl</div>
            </div>
          </div>
          <div className="border border-slate-400 p-3 rounded space-y-12">
            <div className="font-semibold text-slate-700">Disetujui (Quality Control / QA)</div>
            <div>
              <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
              <div className="text-[10px] text-slate-500">Nama &amp; Tanda Tangan / Tgl</div>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-500 mt-4">
          <span>Dicetak dari Sistem Material Tally Hub</span>
          <span>PT Diamond Cold Storage - Plant 2111 Cibitung</span>
        </div>
      </div>

      {/* Tally Document Quick Preview Modal (Opsi A & B) */}
      <TallyQuickModal
        sheetId={previewSheetId}
        onClose={() => setPreviewSheetId(null)}
      />
    </div>
  );
}
