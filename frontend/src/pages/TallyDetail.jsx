import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import CancelDialog from "@/components/CancelDialog";
import { useAuth } from "@/context/AuthContext";
import { api, downloadExcel, errMsg } from "@/lib/api";
import { canCancel, canEdit, fmtDate, fmtDateTime, openPrint } from "@/lib/format";

const HOLD_CATEGORIES = [
  "COA Belum Lengkap / Belum Ada",
  "Dokumen Surat Jalan Cacat / Kurang",
  "Kuantiti Fisik Selisih dengan PO",
  "Menunggu Hasil Uji Lab / Karantina",
  "PO SAP Belum Rilis / Belum Open",
  "Suhu Barang Kedatangan Tidak Sesuai",
  "Kemasan Fisik Rusak / Basah",
  "Storage Location Gudang Penuh",
  "Lainnya"
];

function Stepper({ status }) {
  // Determine active step index (0: Checker, 1: Admin Verifikasi, 2: QC Inspeksi, 3: Admin GR)
  let activeIndex = 0;
  if (status === "waiting_admin_1" || status === "admin_hold") activeIndex = 1;
  else if (status === "waiting_qc" || status === "qc_hold") activeIndex = 2;
  else if (status === "waiting_gr" || status === "gr_hold") activeIndex = 3;
  else if (status === "completed" || status === "final") activeIndex = 4;
  else if (status === "qc_rejected") activeIndex = 2;

  const steps = [
    { label: "1. Checker", desc: "Hitung Fisik & Input SJ" },
    { label: "2. Admin Warehouse", desc: "Verifikasi PO & Dokumen" },
    { label: "3. Quality Control", desc: "Sampling & Uji Mutu" },
    { label: "4. Admin Warehouse", desc: "Posting GR SAP (MIGO)" }
  ];

  const isHold = status.includes("hold");
  const isReject = status === "qc_rejected";

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4" data-testid="tally-workflow-stepper">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="font-display text-sm font-bold text-[#0B2149]">
          Siklus Hidup Dokumen: Checker → Admin → QC → Admin
        </div>
        <div className="text-xs text-slate-500">
          Traceability Pipeline Terintegrasi
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {steps.map((s, idx) => {
          const isDone = activeIndex > idx;
          const isCurrent = activeIndex === idx;

          let cardTone = "border-slate-200 bg-slate-50/60 text-slate-500";
          let badgeTone = "bg-slate-200 text-slate-700";

          if (isDone) {
            cardTone = "border-emerald-200 bg-emerald-50/50 text-emerald-950 shadow-xs";
            badgeTone = "bg-emerald-600 text-white";
          } else if (isCurrent) {
            if (isReject) {
              cardTone = "border-rose-300 bg-rose-50 text-rose-950 ring-2 ring-rose-500/20";
              badgeTone = "bg-rose-600 text-white";
            } else if (isHold) {
              cardTone = "border-amber-300 bg-amber-50 text-amber-950 ring-2 ring-amber-500/20";
              badgeTone = "bg-amber-600 text-white";
            } else {
              cardTone = "border-blue-300 bg-blue-50/60 text-blue-950 ring-2 ring-blue-500/20";
              badgeTone = "bg-blue-700 text-white";
            }
          }

          return (
            <div key={idx} className={`relative flex items-start gap-3 rounded-xl border p-3 transition-all ${cardTone}`}>
              <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${badgeTone}`}>
                {isDone ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs truncate">{s.label}</div>
                <div className="text-[11px] text-slate-600 leading-tight">{s.desc}</div>
                {isCurrent && (
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                    Sedang Aktif
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetaBox({ label, value, testId, mono }) {
  return (
    <div className="rounded-lg border bg-slate-50/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 text-xs font-medium text-slate-900 ${mono ? "font-mono font-semibold" : ""}`} data-testid={testId}>
        {value || "-"}
      </div>
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

  // Workflow Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState("");
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogDesc, setDialogDesc] = useState("");
  const [category, setCategory] = useState(HOLD_CATEGORIES[0]);
  const [reason, setReason] = useState("");
  const [grNo, setGrNo] = useState("");
  const [qcNotes, setQcNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/tally-sheets/${id}`)
      .then((r) => setSheet(r.data))
      .catch((e) => {
        toast.error(errMsg(e));
        navigate("/tally");
      });
    api.get(`/tally-sheets/${id}/history`)
      .then((r) => setHistory(r.data))
      .catch(() => {});
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  if (!sheet) {
    return <div className="text-sm text-slate-500 p-6" data-testid="tally-detail-loading">Memuat rincian dokumen...</div>;
  }

  const exportX = async () => {
    try {
      const name = await downloadExcel(sheet.id);
      toast.success(`File ${name} berhasil diunduh`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const openActionDialog = (action) => {
    setDialogAction(action);
    setReason("");
    setGrNo("");
    setQcNotes("");

    if (action === "admin_hold") {
      setDialogTitle("Tahan Dokumen (Hold Admin)");
      setDialogDesc("Tentukan kategori kendala dan alasan penahanan dokumen ini.");
      setCategory(HOLD_CATEGORIES[1]); // Dokumen Kurang
    } else if (action === "send_to_qc") {
      setDialogTitle("Teruskan ke QC (Request Sampling)");
      setDialogDesc("Kirimkan dokumen dan material kedatangan ini ke Tim Quality Control untuk pemeriksaan mutu.");
    } else if (action === "qc_hold") {
      setDialogTitle("Tahan Pemeriksaan QC (QC Hold)");
      setDialogDesc("Masukkan alasan kendala kualitas, misalnya COA belum lengkap atau menunggu hasil lab.");
      setCategory(HOLD_CATEGORIES[0]); // COA
    } else if (action === "qc_approve") {
      setDialogTitle("Persetujuan Kualitas QC (QC Approved)");
      setDialogDesc("Material dinyatakan Lolos Uji Mutu dan siap diproses Goods Receipt (GR) oleh Admin.");
    } else if (action === "qc_reject") {
      setDialogTitle("Penolakan Kualitas QC (QC Reject)");
      setDialogDesc("Material dinyatakan Tidak Lolos Uji Mutu (Reject / Retur Vendor).");
      setCategory("Kualitas Fisik Tidak Sesuai");
    } else if (action === "admin_gr_hold") {
      setDialogTitle("Tunda Posting GR (GR Hold)");
      setDialogDesc("Masukkan alasan penundaan posting GR SAP.");
      setCategory(HOLD_CATEGORIES[4]);
    } else if (action === "post_gr") {
      setDialogTitle("Posting Goods Receipt SAP (Selesai)");
      setDialogDesc("Masukkan Nomor Material Document GR SAP resmi (MIGO) untuk menyelesaikan dokumen ini.");
    } else if (action === "return_to_checker") {
      setDialogTitle("Kembalikan ke Checker (Minta Revisi)");
      setDialogDesc("Tentukan alasan koreksi hitung fisik atau data yang perlu diperbaiki oleh Checker.");
      setCategory(HOLD_CATEGORIES[2]);
    }
    setDialogOpen(true);
  };

  const handleTransitionSubmit = async () => {
    setBusy(true);
    try {
      const payload = {
        action: dialogAction,
        category,
        reason: reason.trim(),
        gr_no: grNo.trim(),
        qc_notes: qcNotes.trim()
      };
      const res = await api.post(`/tally-sheets/${sheet.id}/transition`, payload);
      toast.success(res.data.message);
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const isAdmin = user?.role === "admin" || user?.role === "warehouse_admin";
  const isQC = user?.role === "qc" || user?.role === "admin";
  const isChecker = user?.role === "checker" || user?.role === "admin";

  return (
    <div data-testid="tally-detail-page" className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xl font-bold" data-testid="tally-detail-doc-no">{sheet.doc_no}</span>
            <StatusBadge status={sheet.status} testId="tally-detail-status" />
          </span>
        }
        subtitle={`Dibuat ${fmtDateTime(sheet.created_at)} oleh ${sheet.created_by_name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit(sheet, user) && (
              <Button
                variant="outline"
                onClick={() => navigate(`/tally/${sheet.id}/edit`)}
                data-testid="tally-detail-edit-button"
              >
                <Pencil className="mr-1.5 h-4 w-4" /> Edit
              </Button>
            )}
            {canCancel(sheet, user) && (
              <Button
                variant="outline"
                onClick={() => setCancelOpen(true)}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                data-testid="tally-detail-cancel-button"
              >
                <Ban className="mr-1.5 h-4 w-4" /> Batalkan
              </Button>
            )}
            <Button
              onClick={() => openPrint(sheet.id)}
              className="bg-[#0B2149] hover:bg-[#13306a] font-semibold text-xs"
              data-testid="tally-detail-print-button"
            >
              <Printer className="mr-1.5 h-4 w-4" /> PRINT TALLY SHEET
            </Button>
            <Button
              onClick={exportX}
              className="bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs"
              data-testid="tally-detail-export-excel-button"
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> EXPORT EXCEL
            </Button>
          </div>
        }
      />

      {/* WORKFLOW 4-STAGE STEPPER */}
      <Stepper status={sheet.status} />

      {/* PENDING / HOLD WARNING BANNER */}
      {sheet.pending_reason && (
        <div
          className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm"
          data-testid="tally-detail-hold-alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-950 text-sm">
                DOKUMEN SEDANG DITAHAN (PENDING) — {sheet.pending_category || "Kendala Operasional"}
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                "{sheet.pending_reason}"
              </p>
              <div className="text-[11px] text-amber-800/80">
                Posisi Antrean Saat Ini: <strong>{sheet.current_handler_role?.toUpperCase()}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QC REJECT WARNING BANNER */}
      {sheet.status === "qc_rejected" && (
        <div className="rounded-xl border-2 border-rose-400 bg-rose-50 p-4 shadow-sm" data-testid="tally-detail-reject-alert">
          <div className="flex items-start gap-3">
            <XCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-950 text-sm">
                MATERIAL DITOLAK OLEH QUALITY CONTROL (QC REJECTED)
              </div>
              <p className="text-xs text-rose-900 leading-relaxed font-medium">
                Alasan Penolakan: "{sheet.qc_notes || sheet.pending_reason || "Tidak memenuhi standar mutu"}"
              </p>
              <div className="text-[11px] text-rose-800/80">
                Diperiksa oleh: <strong>{sheet.qc_by_name}</strong> pada {fmtDateTime(sheet.qc_at)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE WORKFLOW ACTION BAR */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm" data-testid="tally-action-controls">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs uppercase tracking-wider text-blue-950">Aksi Tahapan:</span>
            <span className="rounded bg-blue-100 px-2 py-0.5 font-semibold text-xs text-blue-900">
              Role Aktif: {user?.role?.toUpperCase() || "USER"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. DRAFT ACTIONS (Checker / Admin) */}
            {sheet.status === "draft" && (
              <Button
                onClick={() => openActionDialog("submit_to_admin")}
                className="bg-blue-700 hover:bg-blue-800 text-xs font-semibold"
                data-testid="action-submit-to-admin"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Kirim ke Admin Warehouse
              </Button>
            )}

            {/* 2. ADMIN ACTIONS (Tahap 1: Verifikasi & Forward QC) */}
            {(sheet.status === "waiting_admin_1" || sheet.status === "admin_hold") && (
              <>
                <Button
                  onClick={() => openActionDialog("send_to_qc")}
                  className="bg-purple-700 hover:bg-purple-800 text-xs font-semibold"
                  data-testid="action-send-to-qc"
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Teruskan ke QC (Request Sampling)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openActionDialog("admin_hold")}
                  className="text-amber-800 border-amber-300 hover:bg-amber-50 text-xs"
                  data-testid="action-admin-hold"
                >
                  <Clock className="mr-1.5 h-3.5 w-3.5" /> Tahan Dokumen (Hold Admin)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openActionDialog("return_to_checker")}
                  className="text-slate-700 hover:bg-slate-100 text-xs"
                  data-testid="action-return-checker"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Kembalikan ke Checker (Revisi)
                </Button>
              </>
            )}

            {/* 3. QC ACTIONS (Tahap 2: Sampling & Pengujian Mutu) */}
            {(sheet.status === "waiting_qc" || sheet.status === "qc_hold") && (
              <>
                <Button
                  onClick={() => openActionDialog("qc_approve")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
                  data-testid="action-qc-approve"
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Lolos QC (QC Approved)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openActionDialog("qc_hold")}
                  className="text-amber-800 border-amber-300 hover:bg-amber-50 text-xs"
                  data-testid="action-qc-hold"
                >
                  <Clock className="mr-1.5 h-3.5 w-3.5" /> Tahan QC (Pending COA/Lab)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openActionDialog("qc_reject")}
                  className="text-rose-700 border-rose-300 hover:bg-rose-50 text-xs font-semibold"
                  data-testid="action-qc-reject"
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" /> Tolak QC (Reject Material)
                </Button>
              </>
            )}

            {/* 4. ADMIN ACTIONS (Tahap 3: Posting GR SAP) */}
            {(sheet.status === "waiting_gr" || sheet.status === "gr_hold") && (
              <>
                <Button
                  onClick={() => openActionDialog("post_gr")}
                  className="bg-[#0B2149] hover:bg-[#13306a] text-xs font-bold text-white shadow-sm"
                  data-testid="action-post-gr"
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" /> Posting Goods Receipt SAP (MIGO)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openActionDialog("admin_gr_hold")}
                  className="text-amber-800 border-amber-300 hover:bg-amber-50 text-xs"
                  data-testid="action-gr-hold"
                >
                  <Clock className="mr-1.5 h-3.5 w-3.5" /> Tunda Posting GR
                </Button>
              </>
            )}

            {sheet.status === "completed" && (
              <span className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Dokumen Selesai (GR Posted: {sheet.gr_no || "-"})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* INCOMING GOODS HEADER METADATA */}
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4" data-testid="tally-detail-header-card">
        <div className="flex items-center gap-2 font-display text-sm font-bold text-[#0B2149] border-b pb-2">
          <FileText className="h-4 w-4 text-blue-700" />
          Rincian Header Surat Jalan, PO SAP & Armada Kedatangan
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetaBox label="No. Surat Jalan (SJ)" value={sheet.delivery_note_no} mono testId="detail-delivery-note" />
          <MetaBox label="No. PO SAP" value={sheet.po_no} mono testId="detail-po-no" />
          <MetaBox
            label="Supplier / Vendor"
            value={sheet.supplier_name ? `${sheet.supplier_code ? sheet.supplier_code + " - " : ""}${sheet.supplier_name}` : "-"}
            testId="detail-supplier"
          />
          <MetaBox label="Tanggal Kedatangan" value={sheet.arrival_date ? fmtDate(sheet.arrival_date) : "-"} testId="detail-arrival-date" />
          <MetaBox label="No. Polisi Armada" value={sheet.truck_plate} mono testId="detail-truck-plate" />
          <MetaBox label="Nama Supir" value={sheet.driver_name} testId="detail-driver-name" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2 border-t text-xs">
          <div>
            <span className="text-slate-500">Nomor GR SAP:</span>{" "}
            <span className="font-mono font-bold text-blue-900">{sheet.gr_no || "Belum GR"}</span>
          </div>
          <div>
            <span className="text-slate-500">Status QC:</span>{" "}
            <span className="font-semibold text-slate-900">
              {sheet.qc_status === "passed" ? "Lolos QC (Passed)" : (sheet.qc_status === "rejected" ? "Ditolak (Rejected)" : "Belum QC")}
            </span>
          </div>
          <div>
            <span className="text-slate-500">PIC Checker:</span>{" "}
            <span className="font-medium text-slate-800">{sheet.pic_names?.join(", ") || sheet.created_by_name}</span>
          </div>
          <div>
            <span className="text-slate-500">Posisi Dokumen:</span>{" "}
            <span className="font-bold text-blue-950 uppercase">{sheet.current_handler_role || "Checker"}</span>
          </div>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm" data-testid="tally-detail-items-table">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-[#0B2149] text-left text-xs font-semibold uppercase tracking-wider text-white">
            <tr>
              {["No. Urut", "Kode Material", "Nama Material", "UOM", "Supplier", "Qty Fisik", "Batch Fisik", "Supplier Batch", "Expired Date", "Production Date", "PIC"].map((h) => (
                <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sheet.items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50/80" data-testid={`tally-detail-item-${it.seq}`}>
                <td className="px-3 py-3 font-mono text-center text-xs">{it.seq}</td>
                <td className="px-3 py-3 font-mono text-xs font-bold text-blue-900">{it.material_code}</td>
                <td className="px-3 py-3 font-medium text-slate-800">{it.material_name}</td>
                <td className="px-3 py-3 font-mono text-center text-xs">{it.uom || "-"}</td>
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
                <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">{it.qty !== null && it.qty !== undefined ? it.qty : 0}</td>
                <td className="px-3 py-3 font-mono text-xs">{it.batch_fisik || "-"}</td>
                <td className="px-3 py-3 font-mono text-xs">{it.supplier_batch || "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap text-xs">{fmtDate(it.expired_date)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-xs">{fmtDate(it.production_date)}</td>
                <td className="px-3 py-3 text-xs">{it.pic_name || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TRACEABILITY AUDIT TRAIL LOG */}
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4" data-testid="tally-detail-traceability">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-display text-base font-bold text-[#0B2149]">
            <Clock className="h-5 w-5 text-blue-700" />
            Audit Trail & Log Jejak Status (Traceability)
          </div>
          <div className="text-xs text-slate-500">
            {history.length} catatan aktivitas terekam
          </div>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {history.length === 0 && (
            <p className="text-xs text-slate-500 italic">Belum ada riwayat aktivitas.</p>
          )}
          {history.map((h, i) => (
            <div key={h.id || i} className="relative group">
              <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-600 shadow-xs" />
              <div className="rounded-lg border bg-slate-50/70 p-3 hover:bg-slate-50 transition-colors space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#0B2149] uppercase tracking-wide">
                      {h.action?.replace(/_/g, " ")}
                    </span>
                    {h.by_role && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 uppercase">
                        {h.by_role}
                      </span>
                    )}
                    {h.to_status && (
                      <span className="text-xs text-slate-500">
                        → Status: <strong>{h.to_status}</strong>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">{fmtDateTime(h.at)}</span>
                </div>

                <div className="text-xs text-slate-700">
                  Diproses oleh: <strong>{h.by_name}</strong>
                </div>

                {h.category && (
                  <div className="text-xs text-amber-900 font-semibold">
                    Kategori Masalah: [{h.category}]
                  </div>
                )}

                {h.reason && (
                  <p className="text-xs text-slate-600 italic bg-white/70 p-2 rounded border border-slate-200/60 mt-1">
                    "{h.reason}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DIALOG TRANSITION ACTIONS */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" data-testid="workflow-transition-dialog">
          <DialogHeader>
            <DialogTitle className="text-[#0B2149] font-bold">{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDesc}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* GR Number input for post_gr */}
            {dialogAction === "post_gr" && (
              <div>
                <Label className="text-xs font-semibold text-slate-800">
                  Nomor Material Document GR SAP (MIGO) <span className="text-rose-600">*</span>
                </Label>
                <Input
                  placeholder="Contoh: 5000189234"
                  value={grNo}
                  onChange={(e) => setGrNo(e.target.value)}
                  className="mt-1 font-mono text-sm font-bold"
                  data-testid="input-gr-no"
                />
              </div>
            )}

            {/* Category selection for hold/reject */}
            {(dialogAction.includes("hold") || dialogAction === "qc_reject" || dialogAction === "return_to_checker") && (
              <div>
                <Label className="text-xs font-semibold text-slate-800">Kategori Kendala / Alasan</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1 bg-white text-xs" data-testid="select-hold-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOLD_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* QC Notes for approve */}
            {dialogAction === "qc_approve" && (
              <div>
                <Label className="text-xs font-semibold text-slate-800">Nomor Lot Analisis / No. COA Vendor (Opsional)</Label>
                <Input
                  placeholder="Contoh: COA-2026-X88 / Lot Pass"
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  className="mt-1 text-xs"
                  data-testid="input-qc-notes"
                />
              </div>
            )}

            {/* Textarea Reason (Mandatory for hold/reject/return) */}
            <div>
              <Label className="text-xs font-semibold text-slate-800">
                Catatan / Alasan Detail{" "}
                {(dialogAction.includes("hold") || dialogAction === "qc_reject" || dialogAction === "return_to_checker") && (
                  <span className="text-rose-600">* Wajib Diisi</span>
                )}
              </Label>
              <Textarea
                placeholder="Tuliskan alasan lengkap agar terdokumentasi di riwayat audit trail..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 text-xs"
                data-testid="textarea-action-reason"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button
              onClick={handleTransitionSubmit}
              disabled={busy || (dialogAction === "post_gr" && !grNo.trim())}
              className="bg-[#0B2149] hover:bg-[#13306a]"
              data-testid="btn-confirm-transition"
            >
              {busy ? "Memproses..." : "Konfirmasi & Perbarui Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CANCEL DIALOG */}
      <CancelDialog sheet={cancelOpen ? sheet : null} onClose={() => setCancelOpen(false)} onDone={load} />
    </div>
  );
}
