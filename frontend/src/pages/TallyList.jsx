import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Filter, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import TallyTable from "@/components/TallyTable";
import Pager from "@/components/Pager";
import { api } from "@/lib/api";
import { TableSkeleton } from "@/components/ui/skeleton";

const LIMIT = 15;

const getPastDateStr = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function TallyList() {
  const navigate = useNavigate();

  const initialStartDate = getPastDateStr(7);
  const initialEndDate = getPastDateStr(0);

  const initialFilters = {
    q: "",
    start_date: initialStartDate,
    end_date: initialEndDate,
    material: "",
    pic: "",
    status: "all"
  };

  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [activePreset, setActivePreset] = useState("week"); // "today" | "week" | "month" | "all" | "custom"
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      q: applied.q,
      start_date: applied.start_date,
      end_date: applied.end_date,
      material: applied.material,
      pic: applied.pic,
      status: applied.status === "all" ? "" : applied.status,
      page,
      limit: LIMIT
    };
    api.get("/tally-sheets", { params })
      .then((r) => setData(r.data))
      .catch(() => setData({ items: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [applied, page]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (preset) => {
    const todayStr = getPastDateStr(0);
    let newStart = "";
    let newEnd = "";

    if (preset === "today") {
      newStart = todayStr;
      newEnd = todayStr;
    } else if (preset === "week") {
      newStart = getPastDateStr(7);
      newEnd = todayStr;
    } else if (preset === "month") {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
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

  const handleApply = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    setApplied(filters);
    setActivePreset("custom");
  };

  const handleReset = () => {
    const empty = { q: "", start_date: "", end_date: "", material: "", pic: "", status: "all" };
    setFilters(empty);
    setApplied(empty);
    setActivePreset("all");
    setPage(1);
  };

  const setField = (k) => (e) => {
    setFilters({ ...filters, [k]: e.target.value });
  };

  return (
    <div data-testid="tally-list-page" className="space-y-4">
      <PageHeader
        title="Tally Sheet"
        subtitle="Cari dan kelola dokumen tally sheet kedatangan material berdasarkan rentang tanggal, nomor dokumen, kode material, atau PIC."
        actions={
          <Button onClick={() => navigate("/tally/new")} className="bg-blue-700 hover:bg-blue-800" data-testid="tally-list-create-button">
            <Plus className="mr-1 h-4 w-4" /> Buat Tally Sheet Baru
          </Button>
        }
      />

      {/* Filter Box with Date Range & Fast Presets */}
      <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3" data-testid="tally-list-filters">
        {/* Preset Periode Cepat */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Calendar className="h-4 w-4 text-blue-700" />
            <span>Filter Cepat Periode:</span>
          </div>
          <div className="inline-flex rounded-lg border bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => applyPreset("today")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                activePreset === "today" ? "bg-blue-700 text-white shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="preset-today"
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => applyPreset("week")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                activePreset === "week" ? "bg-blue-700 text-white shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="preset-week"
            >
              7 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => applyPreset("month")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                activePreset === "month" ? "bg-blue-700 text-white shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="preset-month"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => applyPreset("all")}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                activePreset === "all" ? "bg-blue-700 text-white shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="preset-all"
            >
              Semua Periode
            </button>
          </div>
        </div>

        {/* Form Filter Inputs */}
        <form onSubmit={handleApply} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
          {/* 1. Keyword search */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 bg-white text-xs"
              placeholder="No. dokumen / SJ / PO / Plat Truk..."
              value={filters.q}
              onChange={setField("q")}
              data-testid="tally-list-search-input"
            />
          </div>

          {/* 2. Start Date */}
          <div>
            <Input
              type="date"
              className="bg-white text-xs"
              value={filters.start_date}
              onChange={setField("start_date")}
              title="Dari Tanggal"
              data-testid="tally-list-start-date"
            />
          </div>

          {/* 3. End Date */}
          <div>
            <Input
              type="date"
              className="bg-white text-xs"
              value={filters.end_date}
              onChange={setField("end_date")}
              title="Sampai Tanggal"
              data-testid="tally-list-end-date"
            />
          </div>

          {/* 4. Status Filter */}
          <div>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="bg-white text-xs" data-testid="tally-list-status-filter">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="draft">Draft (Checker)</SelectItem>
                <SelectItem value="waiting_admin">Menunggu Admin WH</SelectItem>
                <SelectItem value="admin_hold">Pending Admin WH</SelectItem>
                <SelectItem value="waiting_qc">Dalam Pemeriksaan QC</SelectItem>
                <SelectItem value="qc_hold">Pending QC</SelectItem>
                <SelectItem value="qc_rejected">Ditolak QC</SelectItem>
                <SelectItem value="completed">Selesai (Stock Ter-UU)</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 5. Action Buttons */}
          <div className="flex gap-1.5">
            <Button type="submit" className="flex-1 bg-[#0B2149] hover:bg-[#13306a] text-xs h-9" data-testid="tally-list-search-button">
              Cari
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="h-9 px-2.5 text-slate-500 hover:text-slate-800"
              title="Reset seluruh filter"
              data-testid="tally-list-reset-button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        {loading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : (
          <>
            <TallyTable items={data.items} startIndex={(page - 1) * LIMIT} onChanged={load} extended testId="tally-list-table" />
            <Pager page={page} total={data.total} limit={LIMIT} onChange={setPage} testId="tally-list-pager" />
          </>
        )}
      </div>
    </div>
  );
}
