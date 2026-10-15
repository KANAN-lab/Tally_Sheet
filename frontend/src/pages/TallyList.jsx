import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import TallyTable from "@/components/TallyTable";
import Pager from "@/components/Pager";
import { api } from "@/lib/api";

import { TableSkeleton } from "@/components/ui/skeleton";

const LIMIT = 15;
const EMPTY = { q: "", date: "", material: "", pic: "", status: "all" };

export default function TallyList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = { ...applied, status: applied.status === "all" ? "" : applied.status, page, limit: LIMIT };
    api.get("/tally-sheets", { params })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [applied, page]);
  useEffect(() => {
    load();
  }, [load]);

  const apply = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  };
  const reset = () => {
    setFilters(EMPTY);
    setApplied(EMPTY);
    setPage(1);
  };
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div data-testid="tally-list-page">
      <PageHeader
        title="Tally Sheet"
        subtitle="Cari tally sheet berdasarkan nomor dokumen, tanggal, kode material, atau PIC."
        actions={<Button onClick={() => navigate("/tally/new")} className="bg-blue-700 hover:bg-blue-800" data-testid="tally-list-create-button"><Plus className="mr-1 h-4 w-4" /> Buat Tally Sheet Baru</Button>}
      />
      <form onSubmit={apply} className="mb-5 grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_160px_auto]" data-testid="tally-list-filters">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9 bg-white" placeholder="No. dokumen / kode / PIC" value={filters.q} onChange={set("q")} data-testid="tally-list-search-input" />
        </div>
        <Input type="date" className="bg-white" value={filters.date} onChange={set("date")} data-testid="tally-list-date-filter" />
        <Input className="bg-white" placeholder="Kode material" value={filters.material} onChange={set("material")} data-testid="tally-list-material-filter" />
        <Input className="bg-white" placeholder="Nama PIC" value={filters.pic} onChange={set("pic")} data-testid="tally-list-pic-filter" />
        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="bg-white" data-testid="tally-list-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="draft">Draft (Checker)</SelectItem>
            <SelectItem value="waiting_admin">Menunggu Admin WH</SelectItem>
            <SelectItem value="admin_hold">Pending Admin WH</SelectItem>
            <SelectItem value="waiting_qc">Dalam Pemeriksaan QC</SelectItem>
            <SelectItem value="qc_hold">Pending QC (Pemeriksaan)</SelectItem>
            <SelectItem value="qc_rejected">Ditolak QC</SelectItem>
            <SelectItem value="completed">Selesai (Stock Ter-UU)</SelectItem>
            <SelectItem value="cancelled">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" className="bg-[#0B2149] hover:bg-[#13306a]" data-testid="tally-list-search-button">Cari</Button>
          <Button type="button" variant="outline" onClick={reset} data-testid="tally-list-reset-button"><X className="h-4 w-4" /></Button>
        </div>
      </form>
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
