import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  History,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Send,
  ShieldCheck,
  Truck,
  User,
  XCircle
} from "lucide-react";
import BeritaAcaraModal from "@/components/BeritaAcaraModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { api, downloadExcel, errMsg } from "@/lib/api";
import { canCancel, canEdit, fmtDate, fmtDateTime, openPrint, openBeritaAcaraPrint } from "@/lib/format";
import { swalAlert, swalConfirm, swalPromptReason } from "@/lib/swal";
import { WorkflowService } from "@/services/WorkflowService";

function Stepper({ status }) {
  const steps = WorkflowService.getStages();
  const activeIndex = WorkflowService.getActiveStageIndex(status);
  const isHold = WorkflowService.isHold(status);
  const isReject = WorkflowService.isReject(status);

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4" data-testid="tally-workflow-stepper">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="font-display text-sm font-bold text-[#0B2149]">
          Siklus Hidup Dokumen: Checker → Admin Warehouse → Quality Control (Stock Ter-UU)
        </div>
        <div className="text-xs text-slate-500">Traceability Pipeline Terintegrasi</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
  const [holdCategories, setHoldCategories] = useState([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [baModalOpen, setBaModalOpen] = useState(false);
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

    api.get("/settings")
      .then((r) => {
        if (r.data?.hold_categories) {
          setHoldCategories(r.data.hold_categories);
        }
      })
      .catch(() => {});
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  if (!sheet) {
    return <DetailSkeleton />;
  }

  const exportX = async () => {
    try {
      const name = await downloadExcel(sheet.id);
      toast.success(`File ${name} berhasil diunduh`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  // Generic Workflow Transition Handler using SweetAlert2
  const handleAction = async (action) => {
    // 1. Submit to Admin (Checker)
    if (action === "submit_to_admin") {
      const ok = await swalConfirm({
        title: "Kirim Dokumen ke Admin Warehouse?",
        text: "Dokumen ini akan diserahkan ke antrean Admin Warehouse untuk verifikasi fisik vs PO SAP.",
        confirmButtonText: "Ya, Kirim Dokumen",
        confirmButtonColor: "#1d4ed8"
      });
      if (!ok) return;

      executeTransition(action, {});
    }

    // 2. Admin Forward to QC
    else if (action === "send_to_qc") {
      let resolutionReason = "";
      if (sheet.status === "admin_hold") {
        const res = await swalPromptReason({
          title: "Lepas Hold Admin & Teruskan ke QC",
          categories: ["Verifikasi Dokumen Revisi Selesai", "Kuantiti Fisik Telah Disesuaikan", "Surat Jalan / PO Telah Diperbaiki", "Lain-lain"],
          confirmButtonText: "Lepas Hold & Teruskan ke QC"
        });
        if (!res) return;
        resolutionReason = res.reason;
      } else {
        const ok = await swalConfirm({
          title: "Teruskan Dokumen ke QC?",
          text: "Material telah diverifikasi dan siap diserahkan ke Tim Quality Control untuk sampling & uji mutu.",
          confirmButtonText: "Ya, Teruskan ke QC",
          confirmButtonColor: "#7e22ce"
        });
        if (!ok) return;
      }

      executeTransition(action, { reason: resolutionReason });
    }

    // 3. Admin Hold
    else if (action === "admin_hold") {
      const res = await swalPromptReason({
        title: "Tahan Dokumen (Hold Admin Warehouse)",
        categories: holdCategories,
        confirmButtonText: "Tahan Dokumen"
      });
      if (!res) return;

      executeTransition(action, { category: res.category, reason: res.reason });
    }

    // 4. Return to Checker
    else if (action === "return_to_checker") {
      const res = await swalPromptReason({
        title: "Kembalikan ke Checker (Minta Revisi)",
        categories: holdCategories,
        confirmButtonText: "Kembalikan ke Checker"
      });
      if (!res) return;

      executeTransition(action, { category: res.category, reason: res.reason });
    }

    // 5. QC Hold
    else if (action === "qc_hold") {
      const res = await swalPromptReason({
        title: "Tahan Pemeriksaan QC (QC Hold)",
        categories: holdCategories,
        confirmButtonText: "Tahan QC"
      });
      if (!res) return;

      executeTransition(action, { category: res.category, reason: res.reason });
    }

    // 6. QC Approve (Selesai - Stock Ter-UU)
    else if (action === "qc_approve") {
      let qcResolution = "Lolos Uji Mutu Fisik QC (Stock Ter-UU)";
      if (sheet.status === "qc_hold") {
        const res = await swalPromptReason({
          title: "Luluskan Mutu Setelah Penahanan QC",
          categories: ["Hasil Lab Ulang Memenuhi Standar", "COA Lengkap & Sesuai", "Uji Organoleptik Lolos", "Dispensasi QA Disetujui", "Lain-lain"],
          confirmButtonText: "Luluskan (Stock Ter-UU)"
        });
        if (!res) return;
        qcResolution = res.reason;
      } else {
        const ok = await swalConfirm({
          title: "Luluskan Uji Mutu Material (Stock Ter-UU)?",
          text: "Material dinyatakan Lolos Uji Mutu QC. Status dokumen akan langsung diselesaikan dan stok dinyatakan Ter-UU.",
          confirmButtonText: "Ya, Luluskan & Selesaikan",
          confirmButtonColor: "#059669"
        });
        if (!ok) return;
      }

      executeTransition(action, { reason: qcResolution });
    }

    // 7. QC Reject
    else if (action === "qc_reject") {
      const res = await swalPromptReason({
        title: "Tolak Mutu Material (QC Reject)",
        categories: holdCategories,
        confirmButtonText: "Tolak Material",
        isReject: true
      });
      if (!res) return;

      executeTransition(action, { category: res.category, reason: res.reason });
    }
  };

  const executeTransition = async (action, data = {}) => {
    setBusy(true);
    try {
      const payload = { action, ...data };
      const res = await api.post(`/tally-sheets/${sheet.id}/transition`, payload);
      toast.success(res.data.message);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      return toast.error("Alasan pembatalan wajib diisi.");
    }
    setBusy(true);
    try {
      await api.post(`/tally-sheets/${sheet.id}/cancel`, { reason: cancelReason.trim() });
      toast.success("Dokumen berhasil dibatalkan.");
      setCancelOpen(false);
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
            {sheet.has_berita_acara ? (
              <Button
                onClick={() => openBeritaAcaraPrint(sheet.id)}
                className="bg-blue-700 hover:bg-blue-800 font-semibold text-xs text-white shadow-xs"
                data-testid="tally-detail-print-ba-button"
                title={`Cetak Berita Acara Penerimaan Barang (${sheet.ba_qa_doc_no || sheet.ba_qa_meta?.code || ""})`}
              >
                <FileText className="mr-1.5 h-4 w-4" /> CETAK BERITA ACARA (BA)
              </Button>
            ) : sheet.status !== "cancelled" ? (
              <Button
                onClick={() => setBaModalOpen(true)}
                className="bg-blue-700 hover:bg-blue-800 font-semibold text-xs text-white shadow-xs"
                data-testid="tally-detail-attach-ba-top-button"
                title="Lampirkan Berita Acara Penerimaan Barang (Import / Lokal)"
              >
                <Plus className="mr-1.5 h-4 w-4" /> + LAMPIRKAN BERITA ACARA
              </Button>
            ) : (
              <Button
                disabled
                className="bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed font-semibold text-xs border border-slate-300 dark:border-slate-700 shadow-none"
                data-testid="tally-detail-print-ba-button-disabled"
                title="Dokumen ini tidak menyertakan Berita Acara (Non-BA / Kedatangan Reguler Domestik)"
              >
                <FileText className="mr-1.5 h-4 w-4 opacity-40" /> TANPA BERITA ACARA
              </Button>
            )}
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

      {/* WORKFLOW 3-STAGE STEPPER */}
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
              <p className="text-xs text-amber-900 leading-relaxed font-medium">"{sheet.pending_reason}"</p>
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
              <div className="font-bold text-rose-950 text-sm">MATERIAL DITOLAK OLEH QUALITY CONTROL (QC REJECTED)</div>
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
                disabled={busy}
                onClick={() => handleAction("submit_to_admin")}
                className="bg-blue-700 hover:bg-blue-800 text-xs font-semibold"
                data-testid="action-submit-to-admin"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Kirim ke Admin Warehouse
              </Button>
            )}

            {/* 2. ADMIN ACTIONS (Tahap 1: Verifikasi & Forward QC) */}
            {(sheet.status === "waiting_admin" || sheet.status === "waiting_admin_1" || sheet.status === "admin_hold") && (
              <>
                <Button
                  disabled={busy}
                  onClick={() => handleAction("send_to_qc")}
                  className="bg-purple-700 hover:bg-purple-800 text-xs font-semibold"
                  data-testid="action-send-to-qc"
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Teruskan ke QC (Request Sampling)
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleAction("admin_hold")}
                  className="text-amber-800 border-amber-300 hover:bg-amber-50 text-xs"
                  data-testid="action-admin-hold"
                >
                  <Clock className="mr-1.5 h-3.5 w-3.5" /> Tahan Dokumen (Hold Admin)
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleAction("return_to_checker")}
                  className="text-slate-700 hover:bg-slate-100 text-xs"
                  data-testid="action-return-checker"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Kembalikan ke Checker (Revisi)
                </Button>
              </>
            )}

            {/* 3. QC ACTIONS (Tahap 2: Sampling & Pengujian Mutu -> SELESAI / STOCK TER-UU) */}
            {(sheet.status === "waiting_qc" || sheet.status === "qc_hold") && (
              <>
                <Button
                  disabled={busy}
                  onClick={() => handleAction("qc_approve")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm"
                  data-testid="action-qc-approve"
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Lolos Uji Mutu / Stock Ter-UU
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleAction("qc_hold")}
                  className="text-amber-800 border-amber-300 hover:bg-amber-50 text-xs"
                  data-testid="action-qc-hold"
                >
                  <Clock className="mr-1.5 h-3.5 w-3.5" /> Tahan QC (Pending Lab/Sampling)
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleAction("qc_reject")}
                  className="text-rose-700 border-rose-300 hover:bg-rose-50 text-xs font-semibold"
                  data-testid="action-qc-reject"
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" /> Tolak Mutu (QC Reject)
                </Button>
              </>
            )}

            {sheet.status === "completed" && (
              <span className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Dokumen Selesai (Stock Ter-UU)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* INCOMING GOODS HEADER METADATA (Supplier & Nama Supir removed from header) */}
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4" data-testid="tally-detail-header-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-2">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-[#0B2149]">
            <FileText className="h-4 w-4 text-blue-700" />
            Rincian Header Surat Jalan & PO SAP Kedatangan
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">Standar QA Terkendali:</span>
            <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {sheet.qa_doc_no || sheet.qa_meta?.code || ""}
            </span>
            {sheet.has_berita_acara && (
              <span className="font-mono text-xs font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <Truck className="h-3 w-3" /> {sheet.ba_qa_doc_no || sheet.ba_qa_meta?.code || ""}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetaBox label="No. Surat Jalan (SJ)" value={sheet.delivery_note_no} mono testId="detail-delivery-note" />
          <MetaBox label="No. PO SAP" value={sheet.po_no} mono testId="detail-po-no" />
          <MetaBox label="Tanggal Kedatangan" value={sheet.arrival_date ? fmtDate(sheet.arrival_date) : "-"} testId="detail-arrival-date" />
          <MetaBox label="No. Polisi Armada Truk" value={sheet.truck_plate} mono testId="detail-truck-plate" />
        </div>

        {/* BERITA ACARA CONTAINER SECTION IF ACTIVE */}
        {sheet.has_berita_acara && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-700" />
                <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                  Berita Acara Penerimaan Barang {sheet.berita_acara?.arrival_type === "local" ? "(Truk Lokal / Domestik)" : "(Kontainer Import)"} {sheet.ba_qa_doc_no || sheet.ba_qa_meta?.code ? `(${sheet.ba_qa_doc_no || sheet.ba_qa_meta?.code})` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {sheet.status !== "cancelled" && (
                  <button
                    onClick={() => setBaModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-blue-800 underline mr-1"
                    data-testid="detail-edit-ba-button"
                  >
                    <Pencil className="h-3 w-3" /> Edit Data BA
                  </button>
                )}
                <button
                  onClick={() => openBeritaAcaraPrint(sheet.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 underline"
                >
                  <Printer className="h-3.5 w-3.5" /> Buka Formulir Cetak
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                  {sheet.berita_acara?.arrival_type === "local" ? "No. Box Truk" : "No. Container"}
                </span>
                <span className="font-mono font-bold text-blue-950">
                  {sheet.ba_container_no || sheet.berita_acara?.container_no || "-"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                  {sheet.berita_acara?.arrival_type === "local" ? "No. Segel/Gembok" : "No. Segel"}
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {sheet.ba_seal_no || sheet.berita_acara?.seal_no || "-"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">Kondisi Pengaman</span>
                <span className="font-medium text-slate-800">
                  {sheet.ba_seal_condition || sheet.berita_acara?.seal_condition || "-"}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">Suhu Armada</span>
                <span className="font-medium text-slate-800">
                  {sheet.ba_container_temp || sheet.berita_acara?.container_temp_type || "-"}
                  {sheet.berita_acara?.temp_celsius ? ` (${sheet.berita_acara.temp_celsius}°C)` : ""}
                </span>
              </div>
            </div>
          </div>
        )}

        {!sheet.has_berita_acara && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
              <div>
                <span>Dokumen ini berstatus <strong>Non-Berita Acara</strong> (Kedatangan Reguler Domestik).</span>
                <p className="text-[11px] text-slate-500 mt-0.5">Jika dibutuhkan Berita Acara pemeriksaan fisik kontainer/truk untuk audit atau klaim, Anda dapat melampirkannya langsung.</p>
              </div>
            </div>
            {sheet.status !== "cancelled" && (
              <Button
                size="sm"
                onClick={() => setBaModalOpen(true)}
                className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shrink-0 shadow-xs"
                data-testid="detail-attach-ba-banner-button"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> + Lampirkan Berita Acara
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 pt-2 border-t text-xs">
          <div>
            <span className="text-slate-500">Status Mutu QC:</span>{" "}
            <span className="font-semibold text-slate-900">
              {sheet.qc_status === "passed" ? "Lolos QC (Stock Ter-UU)" : (sheet.qc_status === "rejected" ? "Ditolak (Rejected)" : "Belum Diperiksa QC")}
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

      {/* ITEMS: MOBILE CARDS & DESKTOP TABLE */}
      {/* 1. Mobile Cards (< md) */}
      <div className="block md:hidden space-y-3" data-testid="tally-detail-items-mobile">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          Daftar Material Fisik ({sheet.items?.length || 0} Item)
        </div>
        {sheet.items?.map((it, idx) => (
          <div key={it.id || idx} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                #{it.seq || idx + 1} · {it.material_code}
              </span>
              <span className="font-mono font-bold text-xs text-blue-950 bg-slate-100 px-2 py-0.5 rounded">
                {it.qty ?? 0} {it.uom || ""}
              </span>
            </div>

            <div className="text-xs font-bold text-slate-900 leading-snug">{it.material_name}</div>

            {it.supplier_name && (
              <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-700">
                <span className="text-slate-400 font-medium">Supplier:</span>{" "}
                <strong>{it.supplier_code}</strong> - {it.supplier_name}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600 border-t border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px]">Batch Fisik:</span>
                <strong className="font-mono text-slate-900">{it.batch_fisik || "-"}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Supplier Batch:</span>
                <strong className="font-mono text-slate-900">{it.supplier_batch || "-"}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Expired Date:</span>
                <span className="text-slate-800">{it.expired_date ? fmtDate(it.expired_date) : "-"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Production Date:</span>
                <span className="text-slate-800">{it.production_date ? fmtDate(it.production_date) : "-"}</span>
              </div>
            </div>

            <div className="pt-1 text-[10px] text-slate-500 border-t border-slate-100 flex items-center justify-between">
              <span>PIC: {it.pic_name || "-"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Desktop Table (>= md) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border bg-white shadow-sm" data-testid="tally-detail-items-table">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-[#0B2149] text-left text-xs font-semibold uppercase tracking-wider text-white">
            <tr>
              {["No.", "Kode Material", "Nama Material", "UOM", "Supplier (MKVZ)", "Qty Fisik", "Batch Fisik", "Supplier Batch", "Expired Date", "Production Date", "PIC"].map((h) => (
                <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans text-xs">
            {sheet.items?.map((it, idx) => (
              <tr key={it.id || idx} className="hover:bg-slate-50/60">
                <td className="px-3 py-2.5 font-medium text-slate-600">{it.seq || idx + 1}</td>
                <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{it.material_code}</td>
                <td className="px-3 py-2.5 font-medium text-slate-800">{it.material_name}</td>
                <td className="px-3 py-2.5 font-bold text-slate-700">{it.uom || "-"}</td>
                <td className="px-3 py-2.5 font-medium text-slate-700">
                  {it.supplier_name ? (
                    <div>
                      <div className="font-semibold text-slate-900">{it.supplier_code}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{it.supplier_name}</div>
                    </div>
                  ) : "-"}
                </td>
                <td className="px-3 py-2.5 font-mono font-bold text-blue-900">{it.qty ?? 0}</td>
                <td className="px-3 py-2.5 font-mono text-slate-900">{it.batch_fisik || "-"}</td>
                <td className="px-3 py-2.5 font-mono text-slate-600">{it.supplier_batch || "-"}</td>
                <td className="px-3 py-2.5 text-slate-700">{it.expired_date ? fmtDate(it.expired_date) : "-"}</td>
                <td className="px-3 py-2.5 text-slate-700">{it.production_date ? fmtDate(it.production_date) : "-"}</td>
                <td className="px-3 py-2.5 text-slate-700">{it.pic_name || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FULL CHRONOLOGICAL AUDIT TRAIL / TRACEABILITY TIMELINE */}
      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4" data-testid="tally-history-section">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-[#0B2149]">
            <History className="h-4 w-4 text-blue-700" />
            Audit Trail & Log Jejak Status (Traceability)
          </div>
          <div className="text-xs text-slate-500">
            {history.length} catatan aktivitas terekam
          </div>
        </div>

        {history.length === 0 && (
          <div className="py-4 text-center text-xs text-slate-400">Belum ada riwayat aktivitas.</div>
        )}

        <div className="space-y-3">
          {history.map((h, i) => (
            <div
              key={h.id || i}
              className="relative flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs"
              data-testid={`history-item-${i}`}
            >
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    Aksi: <span className="font-mono text-blue-950 uppercase">{h.action}</span>
                    {h.by_role && (
                      <span className="ml-2 rounded bg-slate-200/80 px-1.5 py-0.2 text-[10px] text-slate-700 font-semibold uppercase">
                        {h.by_role}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">{fmtDateTime(h.at)}</div>
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

      {/* CANCEL ALERT DIALOG */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent data-testid="cancel-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600">Batalkan Tally Sheet?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Masukkan alasan pembatalan dokumen resmi ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Contoh: Salah input dokumen kedatangan / PO dibatalkan vendor"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-xs"
              data-testid="input-cancel-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubmit}
              disabled={busy}
              className="bg-rose-600 hover:bg-rose-700 text-white"
              data-testid="confirm-cancel-button"
            >
              Ya, Batalkan Dokumen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BeritaAcaraModal
        sheet={sheet}
        isOpen={baModalOpen}
        onClose={() => setBaModalOpen(false)}
        onSuccess={(updated) => {
          setSheet((prev) => ({
            ...prev,
            has_berita_acara: true,
            ba_qa_doc_no: updated.ba_qa_doc_no,
            ba_data_json: JSON.stringify(updated.berita_acara),
            berita_acara: updated.berita_acara,
            ba_container_no: updated.berita_acara?.container_no,
            ba_seal_no: updated.berita_acara?.seal_no,
            ba_seal_condition: updated.berita_acara?.seal_condition,
            ba_container_temp: updated.berita_acara?.container_temp_type
          }));
          load();
        }}
      />
    </div>
  );
}
