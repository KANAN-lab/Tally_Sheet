import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer, FileText } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { fmtDate, fmtDateTime } from "@/lib/format";

const HEAD = ["No. Urut", "Kode Material", "Nama Material", "UOM", "Supplier", "Qty", "Batch Fisik", "Supplier Batch", "Expired Date", "Production Date", "PIC"];
const SIGN = ["PIC / Pembuat", "Pemeriksa", "Approver"];

export default function TallyPrint() {
  const { id } = useParams();
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/tally-sheets/${id}`).then((r) => {
      setSheet(r.data);
      document.title = `TallySheet_${r.data.doc_no}`;
    }).catch((e) => setError(errMsg(e)));
  }, [id]);

  if (error) return <div className="p-10 text-rose-600" data-testid="print-error">{error}</div>;
  if (!sheet) return <div className="p-10 text-slate-500">Memuat...</div>;
  const mark = sheet.status === "draft" ? "DRAFT" : sheet.status === "cancelled" ? "DIBATALKAN" : "";

  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <span className="text-sm text-slate-600">Pratinjau cetak A4 · gunakan "Simpan sebagai PDF" untuk menyimpan.</span>
        <div className="flex items-center gap-2">
          {sheet.has_berita_acara && (
            <a
              href={`/tally/${sheet.id}/print-ba`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-800 shadow-xs"
              data-testid="print-open-ba-button"
            >
              <FileText className="h-4 w-4" /> CETAK BERITA ACARA (BA)
            </a>
          )}
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#0B2149] px-4 py-2 text-sm font-semibold text-white hover:bg-[#13306a]" data-testid="print-a4-trigger-button">
            <Printer className="h-4 w-4" /> PRINT TALLY SHEET
          </button>
        </div>
      </div>
      <div className="print-sheet relative shadow-lg" data-testid="print-a4-document-container">
        {mark && <div className="pointer-events-none absolute inset-0 grid place-items-center text-[90px] font-black text-slate-300/50 -rotate-[30deg]" data-testid="print-watermark">{mark}</div>}
        <div className="flex items-start justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Diamond Logo" className="h-12 w-auto object-contain shrink-0" />
            <div>
              <div className="text-[12px] font-black uppercase tracking-wider text-slate-900">PT DIAMOND COLD STORAGE</div>
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">PLANT 2111 · MATERIAL MANAGEMENT SYSTEM</div>
              <h1 className="text-xl font-extrabold tracking-wide mt-0.5" style={{ fontFamily: "Manrope" }}>TALLY SHEET</h1>
            </div>
          </div>
          <table className="text-[11px] border-collapse">
            <tbody>
              <tr>
                <td className="pr-3 font-bold text-slate-800">No. Dokumen Resmi (QA)</td>
                <td>: <span className="font-mono font-black text-blue-950 bg-slate-100 px-1 py-0.5 rounded">{sheet.qa_doc_no || sheet.qa_meta?.code || ""}</span> {sheet.qa_meta?.revision ? `(Rev: ${sheet.qa_meta.revision})` : ""}</td>
              </tr>
              <tr>
                <td className="pr-3 font-semibold text-slate-600">No. Transaksi Tally Sheet</td>
                <td data-testid="print-doc-no">: <span className="font-mono font-bold">{sheet.doc_no}</span></td>
              </tr>
              <tr>
                <td className="pr-3 font-semibold text-slate-600">No. Surat Jalan (SJ)</td>
                <td>: <span className="font-mono font-bold">{sheet.delivery_note_no || "-"}</span></td>
              </tr>
              <tr>
                <td className="pr-3 font-semibold text-slate-600">No. PO SAP</td>
                <td>: <span className="font-mono font-bold">{sheet.po_no || "-"}</span></td>
              </tr>
              <tr>
                <td className="pr-3 font-semibold text-slate-600">Tanggal Kedatangan</td>
                <td>: {sheet.arrival_date ? fmtDate(sheet.arrival_date) : fmtDate(sheet.created_at)}</td>
              </tr>
              <tr>
                <td className="pr-3 font-semibold text-slate-600">No. Polisi Armada</td>
                <td>: <span className="font-mono font-bold">{sheet.truck_plate || "-"}</span></td>
              </tr>
              <tr>
                <td className="pr-3 font-semibold text-slate-600">Status</td>
                <td>: <span className="font-bold">{sheet.status === "completed" ? "SELESAI (STOCK TER-UU)" : sheet.status.toUpperCase()}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <table className="print-table mt-4" data-testid="print-table">
          <thead><tr>{HEAD.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {sheet.items.map((it) => (
              <tr key={it.id}>
                <td style={{ textAlign: "center", width: 34 }}>{it.seq}</td>
                <td>{it.material_code}</td>
                <td>{it.material_name}</td>
                <td style={{ textAlign: "center" }}>{it.uom || "-"}</td>
                <td>{it.supplier_code ? `${it.supplier_code} - ${it.supplier_name || ""}` : (it.supplier_name || "-")}</td>
                <td style={{ textAlign: "right" }}>{it.qty !== null && it.qty !== undefined ? it.qty : 0}</td>
                <td>{it.batch_fisik}</td>
                <td>{it.supplier_batch}</td>
                <td style={{ whiteSpace: "nowrap" }}>{it.expired_date ? fmtDate(it.expired_date) : ""}</td>
                <td style={{ whiteSpace: "nowrap" }}>{it.production_date ? fmtDate(it.production_date) : ""}</td>
                <td>{it.pic_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-[10px]">Total baris: {sheet.items.length} · Dibuat oleh: {sheet.created_by_name}{sheet.admin_by_name ? ` · Diverifikasi oleh: ${sheet.admin_by_name} (${fmtDateTime(sheet.admin_at)})` : ""}{sheet.qc_by_name ? ` · Disetujui QC: ${sheet.qc_by_name} (${fmtDateTime(sheet.qc_at)})` : ""}</div>
        <div className="avoid-break mt-10 grid grid-cols-3 gap-6 text-center text-[11px]" data-testid="print-a4-signature-block">
          <div>
            <div className="font-semibold">Checker (Pembuat)</div>
            <div className="mx-auto mt-14 w-4/5 border-t border-black pt-1">
              <span className="font-medium">{sheet.created_by_name || "Checker"}</span>
              <div className="text-[10px] text-slate-500">{sheet.created_at ? fmtDate(sheet.created_at) : ""}</div>
            </div>
          </div>
          <div>
            <div className="font-semibold">Admin Warehouse (Verifikasi)</div>
            <div className="mx-auto mt-14 w-4/5 border-t border-black pt-1">
              <span className="font-medium">{sheet.admin_by_name || "Admin Warehouse"}</span>
              <div className="text-[10px] text-slate-500">{sheet.admin_at ? fmtDate(sheet.admin_at) : ""}</div>
            </div>
          </div>
          <div>
            <div className="font-semibold">Quality Control (Disetujui / Stock UU)</div>
            <div className="mx-auto mt-14 w-4/5 border-t border-black pt-1">
              <span className="font-medium">{sheet.qc_by_name || "Quality Control"}</span>
              <div className="text-[10px] text-slate-500">{sheet.qc_at ? fmtDate(sheet.qc_at) : ""}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
