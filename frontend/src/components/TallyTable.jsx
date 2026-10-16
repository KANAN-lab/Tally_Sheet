import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, FileSpreadsheet, FileText, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import CancelDialog from "@/components/CancelDialog";
import { useAuth } from "@/context/AuthContext";
import { downloadExcel, errMsg } from "@/lib/api";
import { canCancel, canEdit, fmtDateTime, openPrint, openBeritaAcaraPrint } from "@/lib/format";

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

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm" data-testid={`${testId}-empty`}>
        Belum ada dokumen tally sheet yang sesuai filter.
      </div>
    );
  }

  return (
    <div data-testid={testId}>
      {/* 1. Mobile Cards (< md) */}
      <div className="block md:hidden space-y-3">
        {items.map((s, i) => (
          <div
            key={s.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
            data-testid={`${testId}-mobile-row-${s.doc_no}`}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <span className="font-mono text-xs font-bold text-blue-950 block">{s.doc_no}</span>
                <span className="text-[11px] text-slate-500">{fmtDateTime(s.created_at)}</span>
              </div>
              <StatusBadge status={s.status} testId={`${testId}-status-${s.doc_no}`} />
            </div>

            {(s.delivery_note_no || s.po_no) && (
              <div className="rounded-lg bg-slate-50 p-2 text-xs font-mono text-slate-700 space-y-0.5">
                {s.delivery_note_no && <div><span className="text-slate-400">SJ:</span> <strong>{s.delivery_note_no}</strong></div>}
                {s.po_no && <div><span className="text-slate-400">PO:</span> <strong>{s.po_no}</strong></div>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[10px]">Item / Baris:</span>
                <strong className="font-mono text-slate-900">{s.item_count} Item</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Posisi Dokumen:</span>
                <strong className="text-blue-900 uppercase">{s.current_handler_role || "Checker"}</strong>
              </div>
            </div>

            {s.supplier_name && (
              <div className="text-xs text-slate-600 truncate">
                <span className="text-slate-400">Supplier:</span> {s.supplier_name}
              </div>
            )}

            {s.pending_reason && (
              <div className="flex items-center gap-1.5 rounded bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="truncate">[{s.pending_category || "Pending"}]: {s.pending_reason}</span>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate(`/tally/${s.id}`)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                title="Lihat Detail"
                data-testid={`${testId}-view-${s.doc_no}`}
              >
                <Eye className="h-3.5 w-3.5" /> Detail
              </button>
              <button
                type="button"
                onClick={() => openBeritaAcaraPrint(s.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                title="Cetak Berita Acara (BA)"
                data-testid={`${testId}-print-ba-mobile-${s.doc_no}`}
              >
                <FileText className="h-3.5 w-3.5" /> Cetak BA
              </button>
              {canEdit(s, user) && (
                <button
                  type="button"
                  onClick={() => navigate(`/tally/${s.id}/edit`)}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  title="Edit"
                  data-testid={`${testId}-edit-${s.doc_no}`}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              {canCancel(s, user) && (
                <button
                  type="button"
                  onClick={() => setCancelTarget(s)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  title="Batalkan"
                  data-testid={`${testId}-cancel-${s.doc_no}`}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Batal
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Desktop Table (>= md) */}
      <div className="hidden md:block overflow-x-auto rounded-lg border bg-white">
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
                      <IconBtn title="Print Tally Sheet" onClick={() => openPrint(s.id)} testId={`${testId}-print-${s.doc_no}`}>
                        <Printer className="h-4 w-4" />
                      </IconBtn>
                    )}
                    {extended && (
                      <IconBtn
                        title="Cetak Berita Acara (BA)"
                        onClick={() => openBeritaAcaraPrint(s.id)}
                        testId={`${testId}-print-ba-${s.doc_no}`}
                      >
                        <FileText className={`h-4 w-4 ${s.has_berita_acara ? "text-blue-700" : "text-slate-400 hover:text-blue-700"}`} />
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
      </div>
      <CancelDialog sheet={cancelTarget} onClose={() => setCancelTarget(null)} onDone={onChanged} />
    </div>
  );
}
