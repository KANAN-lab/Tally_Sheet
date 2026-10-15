import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, FileSpreadsheet, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import CancelDialog from "@/components/CancelDialog";
import { useAuth } from "@/context/AuthContext";
import { downloadExcel, errMsg } from "@/lib/api";
import { canCancel, canEdit, fmtDateTime, openPrint } from "@/lib/format";

function IconBtn({ onClick, title, children, testId, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testId}
      className={`h-8 w-8 grid place-items-center rounded-md border border-transparent transition-colors ${danger ? "text-slate-500 hover:bg-rose-50 hover:text-rose-600" : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"}`}
    >
      {children}
    </button>
  );
}

export default function TallyTable({ items, startIndex = 0, onChanged, extended, testId = "tally-table" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cancelTarget, setCancelTarget] = useState(null);

  const exportX = async (s) => {
    try {
      const name = await downloadExcel(s.id);
      toast.success(`File ${name} berhasil diunduh`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-white" data-testid={testId}>
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
          <tr>
            <th className="px-4 py-3 w-12 text-center">No.</th>
            <th className="px-4 py-3">Dokumen / SJ / PO</th>
            <th className="px-4 py-3">Tanggal</th>
            <th className="px-4 py-3">Supplier</th>
            <th className="px-4 py-3">PIC / Posisi</th>
            {extended && <th className="px-4 py-3">Dibuat Oleh</th>}
            <th className="px-4 py-3 text-center">Item</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-slate-500" data-testid={`${testId}-empty`}>
                Belum ada dokumen tally sheet.
              </td>
            </tr>
          )}
          {items.map((s, i) => (
            <tr key={s.id} className="hover:bg-slate-50/70 transition-colors" data-testid={`${testId}-row-${s.doc_no}`}>
              <td className="px-4 py-3 font-mono text-center text-slate-500 text-xs">{startIndex + i + 1}</td>
              <td className="px-4 py-3">
                <div className="font-mono text-xs font-bold text-blue-950">{s.doc_no}</div>
                {(s.delivery_note_no || s.po_no) && (
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {s.delivery_note_no ? `SJ: ${s.delivery_note_no}` : ""}
                    {s.delivery_note_no && s.po_no ? " · " : ""}
                    {s.po_no ? `PO: ${s.po_no}` : ""}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-xs">{fmtDateTime(s.created_at)}</td>
              <td className="px-4 py-3 text-xs max-w-[180px] truncate text-slate-800" title={s.supplier_name}>
                {s.supplier_name || "-"}
              </td>
              <td className="px-4 py-3 text-xs">
                <div className="font-medium text-slate-900 truncate max-w-[140px]">{s.pic_names?.join(", ") || "-"}</div>
                {s.current_handler_role && s.status !== "completed" && s.status !== "cancelled" && (
                  <div className="text-[10px] text-slate-500 uppercase tracking-tight">
                    Di: <span className="font-semibold text-blue-800">{s.current_handler_role}</span>
                  </div>
                )}
              </td>
              {extended && <td className="px-4 py-3 text-slate-700 text-xs">{s.created_by_name}</td>}
              <td className="px-4 py-3 text-center font-mono font-semibold text-xs text-slate-800">{s.item_count}</td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <StatusBadge status={s.status} testId={`${testId}-status-${s.doc_no}`} />
                  {s.pending_reason && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-800" title={s.pending_reason}>
                      <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                      <span className="truncate max-w-[130px]">{s.pending_category || "Pending Issue"}</span>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center justify-center gap-0.5">
                  <IconBtn title="Lihat Detail" onClick={() => navigate(`/tally/${s.id}`)} testId={`${testId}-view-${s.doc_no}`}>
                    <Eye className="h-4 w-4" />
                  </IconBtn>
                  {canEdit(s, user) && (
                    <IconBtn title="Edit" onClick={() => navigate(`/tally/${s.id}/edit`)} testId={`${testId}-edit-${s.doc_no}`}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                  )}
                  {extended && (
                    <IconBtn title="Print" onClick={() => openPrint(s.id)} testId={`${testId}-print-${s.doc_no}`}>
                      <Printer className="h-4 w-4" />
                    </IconBtn>
                  )}
                  {extended && (
                    <IconBtn title="Export Excel" onClick={() => exportX(s)} testId={`${testId}-export-${s.doc_no}`}>
                      <FileSpreadsheet className="h-4 w-4" />
                    </IconBtn>
                  )}
                  {canCancel(s, user) && (
                    <IconBtn danger title="Batalkan" onClick={() => setCancelTarget(s)} testId={`${testId}-cancel-${s.doc_no}`}>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <CancelDialog sheet={cancelTarget} onClose={() => setCancelTarget(null)} onDone={onChanged} />
    </div>
  );
}
