import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Ban, FileSpreadsheet, Pencil, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import CancelDialog from "@/components/CancelDialog";
import { useAuth } from "@/context/AuthContext";
import { api, downloadExcel, errMsg } from "@/lib/api";
import { canCancel, canEdit, fmtDate, fmtDateTime, openPrint } from "@/lib/format";

const ACTIONS = { create: "Dibuat", update: "Diperbarui", finalize: "Difinalisasi" };

function Meta({ label, value, testId }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-900" data-testid={testId}>{value || "-"}</div>
    </div>
  );
}

export default function TallyDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(null);
  const [history, setHistory] = useState([]);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(() => {
    api.get(`/tally-sheets/${id}`).then((r) => setSheet(r.data)).catch((e) => { toast.error(errMsg(e)); navigate("/tally"); });
    api.get(`/tally-sheets/${id}/history`).then((r) => setHistory(r.data)).catch(() => {});
  }, [id, navigate]);
  useEffect(() => {
    load();
  }, [load]);

  if (!sheet) return <div className="text-sm text-slate-500" data-testid="tally-detail-loading">Memuat...</div>;
  const exportX = async () => {
    try {
      toast.success(`File ${await downloadExcel(sheet.id)} berhasil diunduh`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div data-testid="tally-detail-page">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono" data-testid="tally-detail-doc-no">{sheet.doc_no}</span><StatusBadge status={sheet.status} testId="tally-detail-status" /></span>}
        subtitle={`Dibuat ${fmtDateTime(sheet.created_at)} oleh ${sheet.created_by_name}`}
        actions={
          <>
            {canEdit(sheet, user) && <Button variant="outline" onClick={() => navigate(`/tally/${sheet.id}/edit`)} data-testid="tally-detail-edit-button"><Pencil className="mr-1 h-4 w-4" /> Edit</Button>}
            {canCancel(sheet, user) && <Button variant="outline" onClick={() => setCancelOpen(true)} className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700" data-testid="tally-detail-cancel-button"><Ban className="mr-1 h-4 w-4" /> Batalkan</Button>}
            <Button onClick={() => openPrint(sheet.id)} className="bg-[#0B2149] hover:bg-[#13306a] font-semibold" data-testid="tally-detail-print-button"><Printer className="mr-1 h-4 w-4" /> PRINT TALLY SHEET</Button>
            <Button onClick={exportX} className="bg-emerald-600 hover:bg-emerald-700 font-semibold" data-testid="tally-detail-export-excel-button"><FileSpreadsheet className="mr-1 h-4 w-4" /> EXPORT EXCEL</Button>
          </>
        }
      />

      {sheet.status === "draft" && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="tally-detail-draft-note">Dokumen masih Draft. Hasil cetak akan diberi tanda DRAFT sampai difinalisasi.</div>}
      {sheet.status === "cancelled" && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" data-testid="tally-detail-cancel-note">Dibatalkan oleh {sheet.cancelled_by_name} pada {fmtDateTime(sheet.cancelled_at)}. Alasan: {sheet.cancel_reason || "-"}</div>}

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border bg-white p-5 shadow-sm md:grid-cols-4">
        <Meta label="Nomor Dokumen" value={sheet.doc_no} />
        <Meta label="PIC" value={sheet.pic_names?.join(", ")} testId="tally-detail-pic" />
        <Meta label="Terakhir diubah" value={`${fmtDateTime(sheet.updated_at)} · ${sheet.updated_by_name}`} />
        <Meta label="Difinalisasi" value={sheet.finalized_at ? `${fmtDateTime(sheet.finalized_at)} · ${sheet.finalized_by_name}` : "-"} testId="tally-detail-finalized" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm" data-testid="tally-detail-items-table">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-[#0B2149] text-left text-xs font-semibold uppercase tracking-wider text-white">
            <tr>
              {["No. Urut", "Kode Material", "Nama Material", "UOM", "Supplier", "Qty", "Batch Fisik", "Supplier Batch", "Expired Date", "Production Date", "PIC"].map((h) => (
                <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sheet.items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50" data-testid={`tally-detail-item-${it.seq}`}>
                <td className="px-3 py-3 font-mono text-center">{it.seq}</td>
                <td className="px-3 py-3 font-mono text-xs font-semibold text-blue-900">{it.material_code}</td>
                <td className="px-3 py-3">{it.material_name}</td>
                <td className="px-3 py-3 font-mono text-center text-xs font-medium">{it.uom || "-"}</td>
                <td className="px-3 py-3 text-xs">
                  {it.supplier_code ? (
                    <div>
                      <span className="font-mono font-semibold text-slate-800">{it.supplier_code}</span>
                      {it.supplier_name && <div className="text-slate-500 truncate max-w-[180px]">{it.supplier_name}</div>}
                    </div>
                  ) : (
                    it.supplier_name || "-"
                  )}
                </td>
                <td className="px-3 py-3 text-right font-mono font-semibold">{it.qty !== null && it.qty !== undefined ? it.qty : 0}</td>
                <td className="px-3 py-3">{it.batch_fisik || "-"}</td>
                <td className="px-3 py-3">{it.supplier_batch || "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{fmtDate(it.expired_date)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{fmtDate(it.production_date)}</td>
                <td className="px-3 py-3">{it.pic_name || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm" data-testid="tally-detail-history">
        <h2 className="font-display text-lg font-bold text-[#0B2149]">Riwayat Perubahan</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-3 border-l-2 border-blue-200 pl-3">
              <span className="font-medium text-slate-900">{ACTIONS[h.action] || h.action} (rev. {h.revision})</span>
              <span className="text-slate-500">{fmtDateTime(h.at)} · {h.by_name}</span>
            </li>
          ))}
          {sheet.status === "cancelled" && <li className="border-l-2 border-rose-300 pl-3 text-slate-700">Dibatalkan · {fmtDateTime(sheet.cancelled_at)} · {sheet.cancelled_by_name}</li>}
        </ul>
      </div>
      <CancelDialog sheet={cancelOpen ? sheet : null} onClose={() => setCancelOpen(false)} onDone={load} />
    </div>
  );
}
