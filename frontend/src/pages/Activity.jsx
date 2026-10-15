import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

const LIMIT = 25;
const ENTITIES = { all: "Semua", tally_sheet: "Tally Sheet", master_data: "Master Data", user: "Pengguna", settings: "Pengaturan", auth: "Login" };

export default function Activity() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState({ q: "", entity: "all" });
  const [entity, setEntity] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const load = useCallback(() => {
    api.get("/activity", { params: { q: applied.q, entity: applied.entity === "all" ? "" : applied.entity, page, limit: LIMIT } }).then((r) => setData(r.data));
  }, [applied, page]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div data-testid="activity-page">
      <PageHeader title="Riwayat Aktivitas" subtitle="Audit log: siapa membuat, mengedit, memfinalisasi, meng-upload, dan login." />
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied({ q, entity }); }} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9 bg-white" placeholder="Cari pengguna / detail..." value={q} onChange={(e) => setQ(e.target.value)} data-testid="activity-search-input" /></div>
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="sm:w-48 bg-white" data-testid="activity-entity-filter"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(ENTITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="submit" className="bg-[#0B2149] hover:bg-[#13306a]" data-testid="activity-search-button">Cari</Button>
      </form>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="overflow-x-auto rounded-lg border" data-testid="admin-activity-log-table">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700"><tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Pengguna</th><th className="px-4 py-3">Modul</th><th className="px-4 py-3">Aksi</th><th className="px-4 py-3">Detail</th></tr></thead>
            <tbody className="divide-y">
              {data.items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Belum ada aktivitas.</td></tr>}
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{fmtDateTime(a.created_at)}</td>
                  <td className="px-4 py-2.5 font-medium">{a.user_name}</td>
                  <td className="px-4 py-2.5">{ENTITIES[a.entity] || a.entity}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{a.action}</td>
                  <td className="px-4 py-2.5 text-slate-700">{a.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={data.total} limit={LIMIT} onChange={setPage} testId="activity-pager" />
      </div>
    </div>
  );
}
