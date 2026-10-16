import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Plus,
  RotateCcw,
  Save,
  Send,
  Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import TallyRow, { GRID } from "@/components/TallyRow";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { canEdit, formatTruckPlate } from "@/lib/format";
import { swalConfirm } from "@/lib/swal";

const LABELS = {
  batch_fisik: "Batch Fisik",
  supplier_batch: "Supplier Batch",
  expired_date: "Expired Date",
  production_date: "Production Date",
  pic: "PIC"
};

let keySeq = 0;
const blank = (currentUser) => ({
  key: ++keySeq,
  material_code: "",
  material_name: "",
  uom: "",
  qty: "",
  supplier_code: "",
  supplier_name: "",
  batch_fisik: "",
  supplier_batch: "",
  expired_date: "",
  production_date: "",
  pic_id: currentUser?.id || "",
  pic_name: currentUser?.name || ""
});

const isEmpty = (r) =>
  !r.material_code &&
  !r.batch_fisik &&
  !r.supplier_batch &&
  !r.expired_date &&
  !r.production_date &&
  !r.qty &&
  !r.supplier_code;

function clientValidate(rows, action, settings) {
  const errs = {};
  const seen = {};
  const rule = settings?.duplicate_rule || "within_document";

  rows.forEach((r, i) => {
    if (!r.material_code) {
      errs[`${i}-material_code`] = "Material wajib dipilih dari Master Data";
    }
    if (r.expired_date && r.production_date && r.production_date > r.expired_date) {
      errs[`${i}-production_date`] = "Production Date tidak boleh lebih besar dari Expired Date";
    }
    if (action === "final" || action === "submit_to_admin") {
      const vals = {
        batch_fisik: (r.batch_fisik || "").trim(),
        supplier_batch: (r.supplier_batch || "").trim(),
        expired_date: r.expired_date,
        production_date: r.production_date,
        pic: r.pic_id || "ok"
      };
      Object.entries(vals).forEach(([f, v]) => {
        if (settings?.required?.[f] && !v) {
          errs[`${i}-${f}`] = `${LABELS[f]} wajib diisi`;
        }
      });
    }
    if (r.material_code && (rule === "within_document" || rule === "both")) {
      const k = [r.material_code, r.batch_fisik || "", r.supplier_batch || ""]
        .map((x) => x.trim().toUpperCase())
        .join("|");
      if (k in seen) {
        errs[`${i}-batch_fisik`] = `Data ganda dengan baris ${seen[k] + 1} (Kode + Batch Fisik + Supplier Batch)`;
      } else {
        seen[k] = i;
      }
    }
  });

  return errs;
}

const WIZARD_STEPS = [
  { step: 1, title: "1. Header Kedatangan", desc: "No. Surat Jalan & PO SAP" },
  { step: 2, title: "2. Input Material Fisik", desc: "Rincian & Hitung Fisik" },
  { step: 3, title: "3. Review & Konfirmasi", desc: "Verifikasi Akhir & Kirim" }
];

export default function TallyEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(Boolean(id));
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState(() => (id ? [] : [blank(user)]));
  const [settings, setSettings] = useState({ required: {}, duplicate_rule: "within_document" });
  const [errors, setErrors] = useState({});
  const [general, setGeneral] = useState("");
  const [busy, setBusy] = useState(false);

  // Header State (Supplier & Nama Supir removed as requested by user)
  const [header, setHeader] = useState({
    delivery_note_no: "",
    po_no: "",
    arrival_date: new Date().toISOString().slice(0, 10),
    truck_plate: ""
  });

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data));

    if (id) {
      api.get(`/tally-sheets/${id}`)
        .then((r) => {
          if (!canEdit(r.data, user)) {
            toast.error("Dokumen ini tidak dapat diedit");
            navigate(`/tally/${id}`, { replace: true });
            return;
          }
          setSheet(r.data);
          setHeader({
            delivery_note_no: r.data.delivery_note_no || "",
            po_no: r.data.po_no || "",
            arrival_date: r.data.arrival_date || new Date().toISOString().slice(0, 10),
            truck_plate: r.data.truck_plate || ""
          });
          setRows(
            r.data.items.map((it) => ({
              ...blank(user),
              ...it,
              pic_id: user?.id || it.pic_id,
              pic_name: user?.name || it.pic_name,
              key: ++keySeq
            }))
          );
        })
        .catch((e) => {
          toast.error(errMsg(e));
          navigate("/tally");
        })
        .finally(() => setLoading(false));
    } else {
      setRows([blank(user)]);
    }
  }, [id, user, navigate]);

  const updateHeader = (k, v) => {
    setHeader((prev) => ({ ...prev, [k]: v }));
  };

  const update = (i, patch) => {
    if (!patch || typeof patch !== "object") return;
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setErrors((er) => {
      const n = { ...er };
      Object.keys(patch).forEach((f) => delete n[`${i}-${f}`]);
      return n;
    });
  };

  const duplicate = (i) => {
    const target = rows[i];
    if (!target || !target.material_code) return;

    const newRow = {
      key: ++keySeq,
      material_code: target.material_code,
      material_name: target.material_name,
      uom: target.uom || "",
      qty: target.qty ?? "",
      supplier_code: target.supplier_code || "",
      supplier_name: target.supplier_name || "",
      batch_fisik: "",
      supplier_batch: "",
      expired_date: target.expired_date || "",
      production_date: target.production_date || "",
      pic_id: user?.id || target.pic_id,
      pic_name: user?.name || target.pic_name
    };

    const updated = [...rows];
    updated.splice(i + 1, 0, newRow);
    setRows(updated);
    toast.success(`Baris #${i + 1} (${target.material_code}) berhasil diduplikat ke baris #${i + 2}.`);
  };

  const remove = (i) => {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
    setErrors({});
  };

  // Step 1 Validation
  const handleProceedToStep2 = () => {
    if (!header.delivery_note_no.trim()) {
      return toast.error("Nomor Surat Jalan (SJ) wajib diisi sebelum lanjut.");
    }
    if (!header.po_no.trim()) {
      return toast.error("Nomor PO SAP wajib diisi sebelum lanjut.");
    }
    setCurrentStep(2);
  };

  // Step 2 Validation
  const handleProceedToStep3 = () => {
    const filled = rows.filter((r) => !isEmpty(r));
    if (!filled.length) {
      return toast.error("Minimal 1 baris material harus diisi sebelum melanjutkan.");
    }

    const errs = clientValidate(filled, "submit_to_admin", settings);
    setErrors(errs);
    if (Object.keys(errs).length) {
      return toast.error("Periksa baris material yang ditandai merah sebelum lanjut.");
    }

    setCurrentStep(3);
  };

  const handleSave = async (action) => {
    setGeneral("");

    if (action === "submit_to_admin") {
      const ok = await swalConfirm({
        title: "Kirim Dokumen ke Admin Warehouse?",
        text: `Dokumen dengan No. SJ "${header.delivery_note_no}" dan PO "${header.po_no}" akan diteruskan ke antrean Admin Warehouse untuk verifikasi.`,
        confirmButtonText: "Ya, Kirim Dokumen",
        confirmButtonColor: "#1d4ed8"
      });
      if (!ok) return;
    }

    const filled = rows.filter((r) => !isEmpty(r));
    if (!filled.length) {
      return toast.error("Minimal 1 baris material harus diisi");
    }

    const payload = {
      delivery_note_no: header.delivery_note_no.trim(),
      po_no: header.po_no.trim(),
      arrival_date: header.arrival_date || new Date().toISOString().slice(0, 10),
      truck_plate: header.truck_plate.trim(),
      action,
      items: filled.map((r) => ({
        material_code: r.material_code,
        material_name: r.material_name,
        uom: r.uom || "",
        qty: r.qty === "" || r.qty === null || r.qty === undefined ? 0 : parseFloat(r.qty) || 0,
        supplier_code: r.supplier_code || "",
        supplier_name: r.supplier_name || "",
        batch_fisik: r.batch_fisik || "",
        supplier_batch: r.supplier_batch || "",
        expired_date: r.expired_date || "",
        production_date: r.production_date || "",
        pic_id: user?.id || r.pic_id,
        pic_name: user?.name || r.pic_name
      }))
    };

    setBusy(true);
    try {
      const r = id
        ? await api.put(`/tally-sheets/${id}`, payload)
        : await api.post("/tally-sheets", payload);

      toast.success(
        action === "submit_to_admin"
          ? `Tally sheet ${r.data.doc_no} berhasil diserahkan ke Admin Warehouse`
          : `Tally sheet ${r.data.doc_no} berhasil disimpan sebagai Draft`
      );
      navigate(`/tally/${r.data.id}`);
    } catch (e) {
      const d = e.response?.data?.detail;
      if (d && typeof d === "object" && Array.isArray(d.errors)) {
        const map = {};
        const gen = [];
        d.errors.forEach((x) =>
          x.row === null || x.row === undefined
            ? gen.push(x.message)
            : (map[`${x.row}-${x.field}`] = x.message)
        );
        setErrors(map);
        setGeneral(gen.join(" "));
      }
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  const completeRows = rows.filter((r) => r.material_code).length;
  const totalQty = rows.reduce((acc, r) => acc + (parseFloat(r.qty) || 0), 0);

  return (
    <div data-testid="tally-editor-page" className="space-y-6">
      {/* Header Title */}
      <PageHeader
        title={id ? `Edit Tally Sheet — ${sheet?.doc_no || ""}` : "Buat Tally Sheet Baru (Incoming Goods)"}
        subtitle="Alur terfokus dengan Wizard: Lengkapi Header → Isi Material Fisik → Review & Submit"
        actions={
          <Button variant="outline" onClick={() => navigate(-1)} className="text-xs">
            Batal & Kembali
          </Button>
        }
      />

      {/* BANNER REVISI DARI ADMIN JIKA ADA */}
      {sheet?.pending_reason && (
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 shadow-xs" data-testid="revision-alert-banner">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-950 text-sm">
                DOKUMEN DIKEMBALIKAN OLEH ADMIN UNTUK REVISI: [{sheet.pending_category || "Revisi Fisik"}]
              </div>
              <p className="text-xs text-rose-900 leading-relaxed font-medium">"{sheet.pending_reason}"</p>
              <div className="text-[11px] text-rose-800">
                Silakan lakukan penyesuaian data fisik pada Langkah 2 sebelum mengirim ulang ke Admin.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WIZARD STEP NAVIGATION BAR */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        {/* Mobile Stepper Header (< md) */}
        <div className="md:hidden space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#0B2149]">
              Langkah {currentStep} dari 3:{" "}
              <span className="text-blue-700">{WIZARD_STEPS[currentStep - 1]?.title.replace(/^\d+\.\s*/, "")}</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {currentStep === 1 ? "Langkah 1" : currentStep === 2 ? "Langkah 2" : "Langkah 3"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 h-1.5">
            {WIZARD_STEPS.map((s) => (
              <div
                key={s.step}
                className={`rounded-full transition-all ${
                  s.step < currentStep
                    ? "bg-emerald-600"
                    : s.step === currentStep
                    ? "bg-blue-600"
                    : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Desktop Stepper Bar (>= md) */}
        <div className="hidden md:grid md:grid-cols-3 gap-2">
          {WIZARD_STEPS.map((s) => {
            const isCurrent = currentStep === s.step;
            const isDone = currentStep > s.step;

            return (
              <button
                key={s.step}
                type="button"
                onClick={() => {
                  if (s.step < currentStep || (s.step === 2 && header.delivery_note_no && header.po_no)) {
                    setCurrentStep(s.step);
                  }
                }}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                  isCurrent
                    ? "border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20"
                    : isDone
                    ? "border-emerald-200 bg-emerald-50/50 text-emerald-950 hover:bg-emerald-50"
                    : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                }`}
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-bold text-xs ${
                    isDone
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : s.step}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">{s.title}</div>
                  <div className="text-[11px] text-slate-600 truncate">{s.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= STEP 1: HEADER SURAT JALAN & PO ================= */}
      {currentStep === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-6" data-testid="wizard-step-1">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-[#0B2149] flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-700" /> Langkah 1: Informasi Kedatangan Dokumen
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Checker wajib memasukkan Nomor Surat Jalan fisik dari vendor dan Nomor PO SAP yang berlaku sebelum menghitung material.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-3xl">
            {/* Tanggal Kedatangan (Default Today) */}
            <div>
              <Label className="text-xs font-semibold text-slate-800">Tanggal Kedatangan (Today)</Label>
              <Input
                type="date"
                value={header.arrival_date}
                onChange={(e) => updateHeader("arrival_date", e.target.value)}
                className="mt-1 bg-white text-xs font-medium"
                data-testid="input-arrival-date"
              />
            </div>

            {/* Nomor Surat Jalan */}
            <div>
              <Label className="text-xs font-semibold text-slate-800">
                Nomor Surat Jalan (SJ) Fisik <span className="text-rose-600 font-bold">*</span>
              </Label>
              <Input
                placeholder="Contoh: SJ-2026/10/081"
                value={header.delivery_note_no}
                onChange={(e) => updateHeader("delivery_note_no", e.target.value)}
                className="mt-1 font-semibold text-xs text-slate-900"
                data-testid="input-delivery-note-no"
              />
            </div>

            {/* Nomor PO SAP */}
            <div>
              <Label className="text-xs font-semibold text-slate-800">
                Nomor PO SAP Resmi <span className="text-rose-600 font-bold">*</span>
              </Label>
              <Input
                placeholder="Contoh: 4500123456"
                value={header.po_no}
                onChange={(e) => updateHeader("po_no", e.target.value)}
                className="mt-1 font-mono font-semibold text-xs text-slate-900"
                data-testid="input-po-no"
              />
            </div>

            {/* No. Polisi Armada Truk */}
            <div>
              <Label className="text-xs font-semibold text-slate-800">No. Polisi Armada Truk (Opsional)</Label>
              <Input
                placeholder="B 1234 ABC"
                value={header.truck_plate}
                onChange={(e) => updateHeader("truck_plate", formatTruckPlate(e.target.value))}
                maxLength={12}
                className="mt-1 font-mono uppercase text-xs"
                data-testid="input-truck-plate"
              />
            </div>

            {/* PIC Checker */}
            <div className="sm:col-span-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-600">Checker Bertugas:</span>{" "}
                  <strong className="text-blue-950 font-bold">{user?.name}</strong>{" "}
                  <span className="text-slate-500 font-mono">({user?.email})</span>
                </div>
                <span className="rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 self-start sm:self-auto">
                  Terkunci Otomatis (Mandatory PIC)
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
            <Button
              type="button"
              onClick={handleProceedToStep2}
              className="bg-blue-700 hover:bg-blue-800 font-semibold text-xs px-5 w-full sm:w-auto h-10"
              data-testid="btn-step1-next"
            >
              Lanjut ke Input Material Fisik <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: INPUT MATERIAL FISIK ================= */}
      {currentStep === 2 && (
        <div className="space-y-4" data-testid="wizard-step-2">
          {/* Header Summary Banner */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500">No. Surat Jalan:</span>{" "}
                <strong className="text-slate-900 font-mono font-bold">{header.delivery_note_no}</strong>
              </div>
              <div className="h-4 w-px bg-slate-300" />
              <div>
                <span className="text-slate-500">No. PO SAP:</span>{" "}
                <strong className="text-slate-900 font-mono font-bold">{header.po_no}</strong>
              </div>
              <div className="h-4 w-px bg-slate-300" />
              <div>
                <span className="text-slate-500">Tanggal:</span>{" "}
                <strong className="text-slate-900">{header.arrival_date}</strong>
              </div>
              {header.truck_plate && (
                <>
                  <div className="h-4 w-px bg-slate-300" />
                  <div>
                    <span className="text-slate-500">No. Truk:</span>{" "}
                    <strong className="text-slate-900">{header.truck_plate}</strong>
                  </div>
                </>
              )}
            </div>

            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)} className="text-xs text-blue-700 hover:text-blue-800">
              Ubah Header
            </Button>
          </div>

          {general && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{general}</span>
            </div>
          )}

          {/* TABLE CONTAINER */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-full lg:min-w-[1280px]">
                {/* Table Header (Hidden on mobile, visible on desktop) */}
                <div
                  className={`hidden lg:grid ${GRID} items-center bg-[#0B2149] text-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider`}
                >
                  <div>No.</div>
                  <div>Kode Material *</div>
                  <div>Nama Material</div>
                  <div>Supplier (MKVZ)</div>
                  <div>Qty Fisik *</div>
                  <div>UOM</div>
                  <div>Batch Fisik *</div>
                  <div>Supplier Batch *</div>
                  <div>Expired Date *</div>
                  <div>Production Date *</div>
                  <div>PIC *</div>
                  <div className="text-center">Aksi</div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-slate-100">
                  {rows.map((row, i) => (
                    <TallyRow
                      key={row.key}
                      index={i}
                      row={row}
                      errors={errors}
                      onChange={(patch) => update(i, patch)}
                      onDuplicate={() => duplicate(i)}
                      onRemove={() => remove(i)}
                      canRemove={rows.length > 1}
                      required={settings.required}
                      currentUser={user}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Table Footer */}
            <div className="border-t border-slate-100 bg-slate-50/50 p-3 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRows((rs) => [...rs, blank(user)])}
                className="text-xs font-semibold border-dashed border-slate-300 text-blue-700 hover:border-blue-500 hover:bg-blue-50"
                data-testid="btn-add-row"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Tambah Baris Material
              </Button>

              <div className="text-xs text-slate-500">
                Gunakan tombol <strong>Duplikat</strong> pada baris jika terdapat batch/tanggal berbeda untuk material yang sama.
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(1)}
              className="text-xs w-full sm:w-auto h-10"
              data-testid="btn-step2-prev"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali ke Header
            </Button>

            <Button
              type="button"
              onClick={handleProceedToStep3}
              className="bg-blue-700 hover:bg-blue-800 font-semibold text-xs px-5 w-full sm:w-auto h-10 shadow-sm"
              data-testid="btn-step2-next"
            >
              Lanjut ke Review & Konfirmasi <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: REVIEW & KONFIRMASI ================= */}
      {currentStep === 3 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6" data-testid="wizard-step-3">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-[#0B2149] flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Langkah 3: Review & Finalisasi Dokumen
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Periksa kembali seluruh data kedatangan fisik sebelum menyimpannya sebagai Draft atau menyerahkannya ke Admin Warehouse.
            </p>
          </div>

          {/* Review Grid: Header Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-slate-50/70 p-3">
              <div className="text-[10px] uppercase font-bold text-slate-400">Nomor Surat Jalan</div>
              <div className="mt-1 font-mono font-bold text-sm text-slate-900">{header.delivery_note_no}</div>
            </div>
            <div className="rounded-xl border bg-slate-50/70 p-3">
              <div className="text-[10px] uppercase font-bold text-slate-400">Nomor PO SAP</div>
              <div className="mt-1 font-mono font-bold text-sm text-slate-900">{header.po_no}</div>
            </div>
            <div className="rounded-xl border bg-slate-50/70 p-3">
              <div className="text-[10px] uppercase font-bold text-slate-400">Tanggal Kedatangan</div>
              <div className="mt-1 font-medium text-xs text-slate-900">{header.arrival_date}</div>
            </div>
            <div className="rounded-xl border bg-slate-50/70 p-3">
              <div className="text-[10px] uppercase font-bold text-slate-400">No. Polisi Armada</div>
              <div className="mt-1 font-medium text-xs text-slate-900">{header.truck_plate || "-"}</div>
            </div>
          </div>

          {/* Material Items Preview Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Rincian Material ({completeRows} item — Total Qty Fisik: {totalQty.toLocaleString()})
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)} className="text-xs text-blue-700">
                Ubah Baris Material
              </Button>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B2149] text-white text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">No.</th>
                    <th className="py-2 px-3">Material</th>
                    <th className="py-2 px-3">Supplier</th>
                    <th className="py-2 px-3">Qty</th>
                    <th className="py-2 px-3">UOM</th>
                    <th className="py-2 px-3">Batch Fisik</th>
                    <th className="py-2 px-3">Supplier Batch</th>
                    <th className="py-2 px-3">Expired Date</th>
                    <th className="py-2 px-3">Production Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.filter((r) => r.material_code).map((r, i) => (
                    <tr key={r.key || i} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-semibold">{i + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-mono font-bold text-slate-900">{r.material_code}</div>
                        <div className="text-[11px] text-slate-600 truncate max-w-xs">{r.material_name}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-slate-900 font-medium truncate max-w-[160px]">
                          {r.supplier_name || r.supplier_code || "-"}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-900">{r.qty || 0}</td>
                      <td className="py-2 px-3 font-semibold text-slate-600">{r.uom || "-"}</td>
                      <td className="py-2 px-3 font-mono font-semibold">{r.batch_fisik || "-"}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{r.supplier_batch || "-"}</td>
                      <td className="py-2 px-3 text-slate-700">{r.expired_date || "-"}</td>
                      <td className="py-2 px-3 text-slate-700">{r.production_date || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Submission Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(2)}
              className="text-xs w-full sm:w-auto h-10"
              data-testid="btn-step3-prev"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali ke Material
            </Button>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => handleSave("draft")}
                className="text-slate-700 hover:bg-slate-100 text-xs font-semibold w-full sm:w-auto h-10"
                data-testid="btn-save-draft"
              >
                <Save className="mr-1.5 h-4 w-4" /> Simpan Draft
              </Button>

              <Button
                type="button"
                disabled={busy}
                onClick={() => handleSave("submit_to_admin")}
                className="bg-blue-700 hover:bg-blue-800 text-xs font-bold px-6 shadow-sm w-full sm:w-auto h-10"
                data-testid="btn-submit-admin"
              >
                <Send className="mr-1.5 h-4 w-4" /> Kirim ke Admin Warehouse
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
