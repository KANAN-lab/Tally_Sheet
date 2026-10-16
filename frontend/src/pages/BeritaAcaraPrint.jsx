import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer, CheckCircle2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export default function BeritaAcaraPrint() {
  const { id } = useParams();
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/tally-sheets/${id}`)
      .then((r) => {
        setSheet(r.data);
        document.title = `BeritaAcara_${r.data.doc_no}`;
      })
      .catch((e) => setError(errMsg(e)));
  }, [id]);

  if (error) return <div className="p-10 text-rose-600">{error}</div>;
  if (!sheet) return <div className="p-10 text-slate-500">Memuat Formulir Berita Acara...</div>;

  const ba = sheet.berita_acara || {};
  const itemsText = sheet.items?.map((it) => it.material_name).filter(Boolean).slice(0, 3).join(", ") || "-";

  // Tanggal & Hari
  const dateObj = sheet.arrival_date ? new Date(sheet.arrival_date) : new Date(sheet.created_at);
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = isNaN(dateObj.getTime()) ? "-" : days[dateObj.getDay()];
  const formattedDate = sheet.arrival_date ? fmtDate(sheet.arrival_date) : fmtDate(sheet.created_at);

  return (
    <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0 text-slate-900 font-sans">
      {/* Top action bar (hidden on print) */}
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <span className="text-xs text-slate-600">
          Pratinjau Cetak A4 · <strong>Berita Acara Penerimaan Barang Import</strong> {sheet.ba_qa_doc_no ? `(${sheet.ba_qa_doc_no})` : ""}
        </span>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0B2149] px-4 py-2 text-xs font-bold text-white hover:bg-[#13306a] shadow-sm"
          data-testid="print-ba-trigger-button"
        >
          <Printer className="h-4 w-4" /> CETAK BERITA ACARA (PDF A4)
        </button>
      </div>

      {/* Main A4 Document Paper */}
      <div
        className="mx-auto w-[210mm] min-h-[297mm] bg-white p-10 shadow-xl border border-slate-300 print:border-none print:shadow-none print:p-8 flex flex-col justify-between"
        style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}
        data-testid="print-ba-document-container"
      >
        <div className="space-y-4">
          {/* Header Kop Resmi ISO/QA */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Diamond Logo" className="h-12 w-auto object-contain shrink-0" />
              <div>
                <div className="text-[12px] font-black uppercase tracking-wider text-slate-950">
                  PT DIAMOND COLD STORAGE
                </div>
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  PLANT 2111 · CIBITUNG
                </div>
              </div>
            </div>

            {/* QA Controlled Document Standard Box */}
            <table className="text-[10px] border border-slate-800 text-left">
              <tbody>
                <tr className="border-b border-slate-800">
                  <td className="px-2 py-0.5 font-bold bg-slate-100">No. Dokumen QA</td>
                  <td className="px-2 py-0.5 font-mono font-bold">: {sheet.ba_qa_doc_no || ""}</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="px-2 py-0.5 font-semibold text-slate-600">No. Transaksi</td>
                  <td className="px-2 py-0.5 font-mono">: {sheet.doc_no}</td>
                </tr>
                <tr>
                  <td className="px-2 py-0.5 font-semibold text-slate-600">Revisi / Efektif</td>
                  <td className="px-2 py-0.5">: 01 / 01 Jan 2024</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Document Title */}
          <div className="text-center py-2">
            <h1 className="text-base font-extrabold tracking-wide uppercase text-slate-950 underline underline-offset-4">
              BERITA ACARA PENERIMAAN BARANG IMPORT
            </h1>
          </div>

          {/* Form Header Info Table */}
          <div className="text-[11px] leading-relaxed">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="w-36 py-1 font-semibold text-slate-800">Hari / Tanggal</td>
                  <td className="w-4">:</td>
                  <td className="py-1 font-medium">{dayName}, {formattedDate}</td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold text-slate-800">No PO</td>
                  <td>:</td>
                  <td className="py-1 font-mono font-bold">{sheet.po_no || "-"}</td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold text-slate-800">Nama Barang</td>
                  <td>:</td>
                  <td className="py-1 font-medium">{itemsText}</td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold text-slate-800">No Container</td>
                  <td>:</td>
                  <td className="py-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{ba.container_no || "-"}</span>
                      <span className="font-semibold text-slate-700">No Plat Mobil Trucking : <span className="font-mono font-bold">{sheet.truck_plate || "-"}</span></span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold text-slate-800">No Segel</td>
                  <td>:</td>
                  <td className="py-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{ba.seal_no || "-"}</span>
                      <span className="font-semibold text-slate-700">Kondisi Segel : <span className="font-medium">{ba.seal_condition || "-"}</span></span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold text-slate-800">Suhu container</td>
                  <td>:</td>
                  <td className="py-1">
                    <span className="font-medium">
                      <span className={ba.container_temp_type === "Dry" ? "font-bold text-blue-900 underline" : "text-slate-500"}>Dry</span> / {" "}
                      <span className={ba.container_temp_type === "Chiller" ? "font-bold text-blue-900 underline" : "text-slate-500"}>Chiller</span> / {" "}
                      <span className={ba.container_temp_type === "Frozen" ? "font-bold text-blue-900 underline" : "text-slate-500"}>Frozen</span> *)
                    </span>
                    {ba.temp_celsius && <span className="ml-2 font-mono font-bold">({ba.temp_celsius}°C)</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 1: KONDISI FISIK CONTAINER PENGIRIMAN */}
          <div className="pt-2">
            <div className="text-center font-bold text-xs uppercase tracking-wider py-1 border-y border-slate-400 bg-slate-50">
              ================= KONDISI FISIK CONTAINER PENGIRIMAN =================
            </div>

            <div className="text-[11px] space-y-3 pt-2">
              {/* 1. Sebelum dibongkar */}
              <div>
                <div className="font-bold italic text-slate-900">1. Sebelum dibongkar</div>
                <table className="w-full mt-1 ml-4 text-[11px]">
                  <tbody>
                    <tr>
                      <td className="w-40 font-semibold text-slate-800">Lantai</td>
                      <td className="w-4">:</td>
                      <td>
                        <span className="font-medium text-slate-900">
                          {ba.floor_before || "Rata, tidak ditemukan kebocoran, bersih, tidak berminyak"}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-slate-800">Dinding Cont Dalam</td>
                      <td>:</td>
                      <td>
                        <span className="font-medium text-slate-900">
                          {ba.wall_before || "Tidak penyok, tidak baret, tidak bolong"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2. Setelah isi container dibongkar */}
              <div>
                <div className="font-bold italic text-slate-900">2. Setelah isi container dibongkar</div>
                <table className="w-full mt-1 ml-4 text-[11px]">
                  <tbody>
                    <tr>
                      <td className="w-40 font-semibold text-slate-800">Lantai</td>
                      <td className="w-4">:</td>
                      <td>
                        <span className="font-medium text-slate-900">
                          {ba.floor_after || "Rata, tidak ditemukan kebocoran"}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-slate-800">Dinding Cont Dalam</td>
                      <td>:</td>
                      <td>
                        <span className="font-medium text-slate-900">
                          {ba.wall_after || "Tidak penyok, tidak baret, tidak bolong"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: KONDISI ISI BARANG YANG DIKIRIM */}
          <div className="pt-2">
            <div className="text-center font-bold text-xs uppercase tracking-wider py-1 border-y border-slate-400 bg-slate-50">
              ================= KONDISI ISI BARANG YANG DIKIRIM =================
            </div>

            <div className="text-[11px] space-y-3 pt-2">
              {/* Point 1 */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-slate-900">1. Penyusunan barang didalam container:</span>
                  <span className="font-bold text-slate-900 uppercase">[{ba.cargo_arrangement || "Baik"}]</span>
                </div>
                <div className="ml-5 mt-0.5 text-slate-700">
                  <span className="text-slate-500 italic">Jelaskan:</span> {ba.cargo_arrangement_notes || "Tersusun rapi dan kokoh di atas palet."}
                </div>
              </div>

              {/* Point 2 */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-slate-900">2. Fisik barang dalam kondisi baik, tidak ditemukan pecah / bocor:</span>
                  <span className="font-bold text-slate-900 uppercase">[{ba.cargo_condition || "Baik"}]</span>
                </div>
                <div className="ml-5 mt-0.5 text-slate-700">
                  <span className="text-slate-500 italic">Jelaskan:</span> {ba.cargo_condition_notes || "Kemasan fisik utuh, kering, dan segel kemasan baik."}
                </div>
              </div>

              {/* Point 3 */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-slate-900">3. Jumlah fisik barang sesuai dengan Packing List:</span>
                  <span className="font-bold text-slate-900 uppercase">[{ba.cargo_qty_match || "Sesuai"}]</span>
                </div>
                <div className="ml-5 mt-0.5 text-slate-700">
                  <span className="text-slate-500 italic">Jelaskan:</span> {ba.cargo_qty_notes || "Jumlah hitungan fisik lengkap dan sesuai packing list."}
                </div>
              </div>
            </div>
          </div>

          {/* Penutup */}
          <div className="pt-4 text-[11px] leading-relaxed text-slate-700">
            Demikian berita Acara ini dibuat sesuai dengan kondisi sebenarnya dan untuk dipergunakan sebagai mana mestinya.
          </div>
        </div>

        {/* Kolom Tanda Tangan 3 Pihak */}
        <div className="pt-6">
          <div className="text-right text-[11px] font-semibold text-slate-800 mb-4">
            Cibitung, {formattedDate}
          </div>

          <div className="grid grid-cols-3 gap-6 text-center text-[11px]">
            <div>
              <div className="font-semibold text-slate-800">Dibuat Oleh,</div>
              <div className="mx-auto mt-20 w-4/5 border-t border-black pt-1">
                <div className="font-bold text-slate-900">
                  {ba.spv_name || sheet.admin_by_name || sheet.created_by_name || "SPV WH RMPM"}
                </div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  SPV WH RMPM
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-slate-800">Mengetahui,</div>
              <div className="mx-auto mt-20 w-4/5 border-t border-black pt-1">
                <div className="font-bold text-slate-900">
                  {ba.manager_name || "Manajer WH RMPM"}
                </div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Manajer WH RMPM
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-slate-800">Disaksikan Oleh,</div>
              <div className="mx-auto mt-20 w-4/5 border-t border-black pt-1">
                <div className="font-bold text-slate-900">
                  {ba.driver_name || sheet.driver_name || "Driver Ekspedisi"}
                </div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  Driver Pengiriman
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
