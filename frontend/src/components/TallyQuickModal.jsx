import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Layers,
  Printer,
  ShieldCheck,
  Truck,
  User,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { api, downloadExcel, errMsg } from "@/lib/api";
import { fmtDateTime, openBeritaAcaraPrint, openPrint } from "@/lib/format";

export default function TallyQuickModal({ sheetId, onClose }) {
  const [sheet, setSheet] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [copiedSj, setCopiedSj] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!sheetId) return;
    setLoading(true);
    try {
      const [resSheet, resHist] = await Promise.all([
        api.get(`/tally-sheets/${sheetId}`),
        api.get(`/tally-sheets/${sheetId}/history`).catch(() => ({ data: [] }))
      ]);
      setSheet(resSheet.data);
      setHistory(resHist.data || []);
    } catch (e) {
      toast.error(errMsg(e));
      onClose();
    } finally {
      setLoading(false);
    }
  }, [sheetId, onClose]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!sheetId) return null;

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "doc") {
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 2000);
      toast.success(`No. Tally ${text} disalin ke clipboard`);
    } else {
      setCopiedSj(true);
      setTimeout(() => setCopiedSj(false), 2000);
      toast.success(`No. Surat Jalan ${text} disalin ke clipboard`);
    }
  };

  const handleOpenFull = () => {
    window.open(`/tally/${sheet?.id || sheetId}`, "_blank", "noopener,noreferrer");
  };

  const handleDownloadExcel = async () => {
    if (!sheet?.id) return;
    try {
      const name = await downloadExcel(sheet.id);
      toast.success(`File ${name} berhasil diunduh`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const totalQty = sheet?.items?.reduce((sum, it) => sum + (Number(it.qty) || 0), 0) || 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
      data-testid="tally-quick-modal-backdrop"
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        data-testid="tally-quick-modal-dialog"
      >
        {/* Header */}
        <div className="bg-[#0B2149] text-white px-5 py-4 flex items-center justify-between border-b border-blue-950 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-blue-600/30 border border-blue-400/40 grid place-items-center shrink-0">
              <FileText className="h-5 w-5 text-blue-200" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-wider text-blue-200 uppercase">
                Pratinjau Dokumen Audit · Diamond Cold Storage (Plant 2111)
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="font-mono text-base sm:text-lg font-bold text-white tracking-wide">
                  {sheet?.doc_no || sheetId}
                </span>
                {sheet?.doc_no && (
                  <button
                    type="button"
                    onClick={() => handleCopy(sheet.doc_no, "doc")}
                    className="text-blue-300 hover:text-white transition p-1 rounded hover:bg-blue-800/50"
                    title="Salin No. Tally"
                  >
                    {copiedDoc ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
                {sheet?.status && <StatusBadge status={sheet.status} />}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/10 transition shrink-0"
            title="Tutup (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-800 text-xs">
          {loading ? (
            <div className="space-y-4 py-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-lg" />
                ))}
              </div>
              <div className="h-36 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-44 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ) : !sheet ? (
            <div className="py-12 text-center text-slate-500">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">Data dokumen tidak dapat dimuat</p>
            </div>
          ) : (
            <>
              {/* Card 1: Key Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Surat Jalan (SJ)</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 text-xs truncate">{sheet.delivery_note_no || "-"}</span>
                    {sheet.delivery_note_no && (
                      <button
                        type="button"
                        onClick={() => handleCopy(sheet.delivery_note_no, "sj")}
                        className="text-slate-400 hover:text-slate-700 transition"
                        title="Salin No. SJ"
                      >
                        {copiedSj ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Nomor PO SAP</div>
                  <div className="font-bold font-mono text-slate-900 text-xs truncate">{sheet.po_no || "-"}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Tgl Kedatangan</div>
                  <div className="font-semibold text-slate-900 text-xs flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-blue-700" />
                    {sheet.arrival_date || "-"}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Armada &amp; Truk</div>
                  <div className="font-semibold text-slate-900 text-xs flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5 text-slate-700" />
                    <span className="font-mono font-bold">{sheet.truck_plate || "-"}</span>
                  </div>
                  {sheet.driver_name && <div className="text-[10px] text-slate-500 mt-0.5">Supir: {sheet.driver_name}</div>}
                </div>
              </div>

              {/* Card 2: QA & Container Info */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Standar QA Kontrol:</span>
                  <span className="font-mono font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200">
                    {sheet.qa_doc_no || "SOP.WH-D.01"}
                  </span>
                </div>
                {sheet.ba_container_no && (
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-500">Container ISO:</span>
                    <strong className="text-slate-800">{sheet.ba_container_no}</strong>
                  </div>
                )}
                <div className="text-slate-500">
                  Dibuat: <span className="font-mono text-slate-700">{fmtDateTime(sheet.created_at)}</span>
                </div>
              </div>

              {/* Berita Acara Alert (jika ada) */}
              {sheet.has_berita_acara && (
                <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-950 flex items-center gap-2">
                        <span>Berita Acara (BA) Dilampirkan</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 font-bold">
                          {sheet.ba_qa_doc_no || "SOP.WH-D.02"}
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-900 mt-0.5">
                        No. BA: <span className="font-mono font-semibold">{sheet.ba_no || "-"}</span>
                        {sheet.ba_date && <span> · Tgl: {sheet.ba_date}</span>}
                      </div>
                      {sheet.ba_notes && (
                        <p className="text-[11px] text-amber-800 mt-1 italic bg-white/70 p-1.5 rounded border border-amber-200">
                          Catatan: "{sheet.ba_notes}"
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openBeritaAcaraPrint(sheet.id)}
                    className="border-amber-400 bg-white text-amber-900 hover:bg-amber-100 text-xs shrink-0 font-semibold"
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" /> Cetak Berita Acara
                  </Button>
                </div>
              )}

              {/* Status & Riwayat 3-Tahap */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 space-y-2.5">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-blue-700" />
                    Ketertelusuran Alur 3-Tahap &amp; Verifikasi Mutu
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">ISO 9001:2015 Clause 8.6</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Stage 1: Checker */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">1. Checker Gudang</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{sheet.created_by_name || "-"}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{fmtDateTime(sheet.created_at)}</div>
                  </div>

                  {/* Stage 2: Admin WH */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">2. Admin Warehouse</div>
                    <div className="font-semibold text-slate-900 mt-0.5">{sheet.updated_by_name || "Verifikasi Selesai"}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Dokumen fisik vs PO SAP cocok</div>
                  </div>

                  {/* Stage 3: QC */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">3. Quality Control (QC)</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {sheet.qc_by_name ? `QC: ${sheet.qc_by_name}` : "Menunggu Pemeriksaan"}
                    </div>
                    {sheet.qc_at && <div className="text-[10px] text-slate-500 font-mono">{fmtDateTime(sheet.qc_at)}</div>}
                    {sheet.qc_notes && (
                      <div className="text-[10px] text-emerald-700 font-medium mt-0.5 truncate" title={sheet.qc_notes}>
                        {sheet.qc_notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* If there is active Hold Reason */}
                {(sheet.pending_category || sheet.pending_reason) && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Penahanan Aktif:</strong> {sheet.pending_category} — {sheet.pending_reason}
                    </div>
                  </div>
                )}
              </div>

              {/* Tabel Material & Batch */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-slate-600" />
                    Daftar Material Fisik ({sheet.items?.length || 0} Baris Item)
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">
                    Total Kuantitas: {totalQty.toLocaleString("id-ID")}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B2149] text-white font-semibold">
                        <tr>
                          <th className="py-2.5 px-3 w-8 text-center">No</th>
                          <th className="py-2.5 px-3">Kode &amp; Nama Material</th>
                          <th className="py-2.5 px-3">Batch Fisik / Vendor</th>
                          <th className="py-2.5 px-3 text-center">Prod. Date</th>
                          <th className="py-2.5 px-3 text-center">Exp. Date</th>
                          <th className="py-2.5 px-3 text-right">Kuantitas</th>
                          <th className="py-2.5 px-3">Vendor / Supplier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {sheet.items?.map((it, idx) => (
                          <tr key={it.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">{it.seq || idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{it.material_name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">Kode: {it.material_code}</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                              <div className="font-bold text-slate-800">{it.batch_fisik || "-"}</div>
                              {it.supplier_batch && (
                                <div className="text-[10px] text-slate-500">Vendor: {it.supplier_batch}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                              {it.production_date || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 whitespace-nowrap">
                              {it.expired_date || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {Number(it.qty || 0).toLocaleString("id-ID")} {it.uom}
                            </td>
                            <td className="py-2.5 px-3 max-w-[150px] truncate" title={it.supplier_name}>
                              <div className="font-medium text-slate-800">{it.supplier_name || "-"}</div>
                              {it.supplier_code && (
                                <div className="text-[10px] text-slate-400 font-mono">{it.supplier_code}</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Log Jejak Perubahan (History) */}
              {history.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40 space-y-2">
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    Riwayat Jejak Status &amp; Aksi ({history.length} Catatan)
                  </div>
                  <div className="divide-y divide-slate-200/60 max-h-36 overflow-y-auto pr-1">
                    {history.map((h, i) => (
                      <div key={h.id || i} className="py-1.5 flex items-start justify-between text-[11px] gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">{h.by_name}</span>
                          <span className="text-slate-500"> ({h.by_role || "User"}): </span>
                          <span className="text-slate-700">{h.reason || h.action}</span>
                          {h.category && (
                            <span className="ml-1 px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[10px]">
                              {h.category}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-slate-400 text-[10px] shrink-0">
                          {fmtDateTime(h.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions (Opsi B: Navigasi Penuh & Cetak) */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              disabled={!sheet}
              className="text-xs h-8"
              title="Unduh Excel Tally Sheet ini"
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openPrint(sheet?.id || sheetId)}
              disabled={!sheet}
              className="text-xs h-8"
              title="Cetak Tally Sheet (SOP.WH-D.01)"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5 text-slate-600" /> Cetak Tally
            </Button>
            {sheet?.has_berita_acara && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openBeritaAcaraPrint(sheet.id)}
                className="text-xs h-8 border-amber-300 text-amber-900 hover:bg-amber-100"
                title="Cetak Berita Acara (SOP.WH-D.02)"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5 text-amber-600" /> Cetak BA
              </Button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs text-slate-600 hover:text-slate-900 h-8"
            >
              Tutup
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleOpenFull}
              disabled={!sheet}
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs h-8 shadow-xs"
              title="Buka Halaman Detail Penuh di Tab Baru"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Buka Halaman Penuh
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
