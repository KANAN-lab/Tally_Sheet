import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, FileSpreadsheet, Pencil, Printer, Trash2 } from "lucide-react";
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
    <div className="overflow-x-auto rounded-lg border" data-testid={testId}>
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
          <tr>
            <th className="px-4 py-3 w-12">No.</th>
            <th className="px-4 py-3">Nomor Dokumen</th>
            <th className="px-4 py-3">Tanggal</th>
            <th className="px-4 py-3">PIC</th>
            {extended && <th className="px-4 py-3">Dibuat Oleh</th>}
            <th className="px-4 py-3">Total Material</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500" data-testid={`${testId}-empty`}>Belum ada tally sheet.</td></tr>
          )}
          {items.map((s, i) => (
            <tr key={s.id} className="hover:bg-slate-50/70 transition-colors" data-testid={`${testId}-row-${s.doc_no}`}>
              <td className="px-4 py-3 font-medium text-slate-700">{startIndex + i + 1}</td>
              <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900">{s.doc_no}</td>
              <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmtDateTime(s.created_at)}</td>
              <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{s.pic_names?.join(", ") || "-"}</td>
              {extended && <td className="px-4 py-3 text-slate-700">{s.created_by_name}</td>}
              <td className="px-4 py-3 text-slate-700">{s.item_count}</td>
              <td className="px-4 py-3"><StatusBadge status={s.status} testId={`${testId}-status-${s.doc_no}`} /></td>
              <td className="px-2 py-2">
                <div className="flex items-center justify-center gap-0.5">
                  <IconBtn title="Lihat" onClick={() => navigate(`/tally/${s.id}`)} testId={`${testId}-view-${s.doc_no}`}><Eye className="h-4 w-4" /></IconBtn>
                  {canEdit(s, user) && <IconBtn title="Edit" onClick={() => navigate(`/tally/${s.id}/edit`)} testId={`${testId}-edit-${s.doc_no}`}><Pencil className="h-4 w-4" /></IconBtn>}
                  {extended && <IconBtn title="Print" onClick={() => openPrint(s.id)} testId={`${testId}-print-${s.doc_no}`}><Printer className="h-4 w-4" /></IconBtn>}
                  {extended && <IconBtn title="Export Excel" onClick={() => exportX(s)} testId={`${testId}-export-${s.doc_no}`}><FileSpreadsheet className="h-4 w-4" /></IconBtn>}
                  {canCancel(s, user) && <IconBtn danger title="Batalkan" onClick={() => setCancelTarget(s)} testId={`${testId}-cancel-${s.doc_no}`}><Trash2 className="h-4 w-4" /></IconBtn>}
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
