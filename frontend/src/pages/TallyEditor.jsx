import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Building2, CalendarDays, CheckCircle2, FileText, Plus, Save, Send, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import PageHeader from "@/components/PageHeader";
import TallyRow, { GRID } from "@/components/TallyRow";
import SupplierSearch from "@/components/SupplierSearch";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { canEdit } from "@/lib/format";

const LABELS = {
  batch_fisik: "Batch Fisik",
  supplier_batch: "Supplier Batch",
  expired_date: "Expired Date",
  production_date: "Production Date",
  pic: "PIC"
};

let keySeq = 0;
const blank = (currentUser, defaultSupplier = null) => ({
  key: ++keySeq,
  material_code: "",
  material_name: "",
  uom: "",
  qty: "",
  supplier_code: defaultSupplier?.code || "",
  supplier_name: defaultSupplier?.name || "",
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
  const rule = settings.duplicate_rule;

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
        if (settings.required?.[f] && !v) {
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

export default function TallyEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState(() => (id ? [] : [blank(user)]));
  const [settings, setSettings] = useState({ required: {}, duplicate_rule: "within_document" });
  const [errors, setErrors] = useState({});
  const [general, setGeneral] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Header State
  const [header, setHeader] = useState({
    delivery_note_no: "",
    po_no: "",
    supplier_code: "",
    supplier_name: "",
    arrival_date: new Date().toISOString().slice(0, 10),
    driver_name: "",
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
            supplier_code: r.data.supplier_code || "",
            supplier_name: r.data.supplier_name || "",
            arrival_date: r.data.arrival_date || new Date().toISOString().slice(0, 10),
            driver_name: r.data.driver_name || "",
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
        });
    } else {
      setRows([blank(user)]);
    }
  }, [id, user, navigate]);

  const updateHeader = (k, v) => {
    setHeader((prev) => ({ ...prev, [k]: v }));
  };

  const handleHeaderSupplierSelect = (sup) => {
    if (sup) {
      setHeader((prev) => ({ ...prev, supplier_code: sup.code, supplier_name: sup.name }));
      // Optional: prefill rows with empty supplier
      setRows((rs) =>
        rs.map((r) => (!r.supplier_code ? { ...r, supplier_code: sup.code, supplier_name: sup.name } : r))
      );
    } else {
      setHeader((prev) => ({ ...prev, supplier_code: "", supplier_name: "" }));
    }
  };

  const update = (i, patch) => {
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
      supplier_code: target.supplier_code || header.supplier_code || "",
      supplier_name: target.supplier_name || header.supplier_name || "",
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

  const save = async (action) => {
    setGeneral("");

    // Validate header if submitting to admin
    if (action === "submit_to_admin") {
      if (!header.delivery_note_no.trim()) {
        return toast.error("Nomor Surat Jalan wajib diisi sebelum mengirim ke Admin");
      }
      if (!header.po_no.trim()) {
        return toast.error("Nomor PO SAP wajib diisi sebelum mengirim ke Admin");
      }
    }

    const filled = rows.filter((r) => !isEmpty(r));
    if (!filled.length) {
      return toast.error("Minimal 1 baris material harus diisi");
    }

    const errs = clientValidate(filled, action, settings);
    setErrors(errs);
    if (Object.keys(errs).length) {
      return toast.error("Data material belum valid. Periksa kolom yang ditandai merah.");
    }

    const payload = {
      delivery_note_no: header.delivery_note_no.trim(),
      po_no: header.po_no.trim(),
      supplier_code: header.supplier_code.trim(),
      supplier_name: header.supplier_name.trim(),
      arrival_date: header.arrival_date || new Date().toISOString().slice(0, 10),
      driver_name: header.driver_name.trim(),
      truck_plate: header.truck_plate.trim(),
      action,
      items: filled.map((r) => ({
        material_code: r.material_code,
        material_name: r.material_name,
        uom: r.uom || "",
        qty: r.qty === "" || r.qty === null || r.qty === undefined ? 0 : parseFloat(r.qty) || 0,
        supplier_code: r.supplier_code || header.supplier_code || "",
        supplier_name: r.supplier_name || header.supplier_name || "",
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

  const errorCount = Object.keys(errors).length;
  const completeRows = rows.filter((r) => r.material_code).length;

  return (
    <div data-testid="tally-editor-page" className="space-y-5">
      <PageHeader
        title={sheet ? `Edit ${sheet.doc_no}` : "Buat Tally Sheet Baru"}
        subtitle="Langkah 1: Lengkapi data Surat Jalan & PO. Langkah 2: Isi rincian material kedatangan fisik."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => save("draft")}
              disabled={busy}
              data-testid="tally-editor-save-draft"
            >
              <Save className="mr-1.5 h-4 w-4" /> Simpan Draft
            </Button>
            <Button
              onClick={() => setConfirmSubmit(true)}
              disabled={busy}
              className="bg-blue-700 hover:bg-blue-800 font-semibold"
              data-testid="tally-editor-submit-button"
            >
              <Send className="mr-1.5 h-4 w-4" /> Kirim ke Admin Warehouse
            </Button>
          </div>
        }
      />

      {/* Alert if Returning from Admin */}
      {sheet?.pending_reason && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm" data-testid="tally-editor-revision-alert">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Catatan Revisi dari Admin Warehouse:
          </div>
          <div className="mt-1 text-sm">
            <span className="font-semibold">[{sheet.pending_category || "Catatan"}]</span> {sheet.pending_reason}
          </div>
        </div>
      )}

      {/* 1. HEADER FORM KEDATANGAN */}
      <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm space-y-4" data-testid="tally-header-form">
        <div className="flex items-center gap-2 font-display text-base font-bold text-[#0B2149] border-b pb-2">
          <FileText className="h-5 w-5 text-blue-700" />
          Informasi Header Surat Jalan & PO Kedatangan
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Tanggal Kedatangan (Today)</Label>
            <div className="relative mt-1">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="date"
                value={header.arrival_date}
                onChange={(e) => updateHeader("arrival_date", e.target.value)}
                className="pl-9 bg-slate-50 font-medium text-xs"
                data-testid="header-arrival-date"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Nomor Surat Jalan (SJ) <span className="text-rose-600">*</span>
            </Label>
            <Input
              placeholder="Contoh: SJ-2026/10/001"
              value={header.delivery_note_no}
              onChange={(e) => updateHeader("delivery_note_no", e.target.value)}
              className="mt-1 font-mono text-xs font-semibold"
              data-testid="header-delivery-note"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">
              Nomor PO SAP <span className="text-rose-600">*</span>
            </Label>
            <Input
              placeholder="Contoh: 4500123456"
              value={header.po_no}
              onChange={(e) => updateHeader("po_no", e.target.value)}
              className="mt-1 font-mono text-xs font-semibold"
              data-testid="header-po-no"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Supplier Vendor (MKVZ)</Label>
            <div className="mt-1">
              <SupplierSearch
                value={header.supplier_code}
                supplierName={header.supplier_name}
                onSelect={handleHeaderSupplierSelect}
                testId="header-supplier-search"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">No. Polisi Armada Truk</Label>
            <Input
              placeholder="Contoh: B 9123 KAN"
              value={header.truck_plate}
              onChange={(e) => updateHeader("truck_plate", e.target.value)}
              className="mt-1 text-xs"
              data-testid="header-truck-plate"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Nama Supir / Ekspedisi</Label>
            <Input
              placeholder="Nama supir atau ekspedisi pengirim"
              value={header.driver_name}
              onChange={(e) => updateHeader("driver_name", e.target.value)}
              className="mt-1 text-xs"
              data-testid="header-driver-name"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-3 rounded-lg bg-blue-50/70 p-3 text-xs text-blue-900 border border-blue-200">
            <Truck className="h-5 w-5 text-blue-700 shrink-0" />
            <div>
              <span className="font-semibold">Petunjuk Checker:</span> Pastikan Nomor Surat Jalan dan Nomor PO sesuai dengan dokumen fisik vendor sebelum mengirim ke Admin.
            </div>
          </div>
        </div>
      </div>

      {/* Row Stats & Alerts */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md bg-white border px-3 py-1.5 text-slate-700 font-medium" data-testid="tally-editor-row-count">
          {rows.length} baris · {completeRows} material dipilih
        </span>
        <span className="rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-blue-900 text-xs">
          Checker Aktif: <strong>{user?.name}</strong> (Terkunci Otomatis)
        </span>
        {errorCount > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-rose-700 font-medium"
            data-testid="tally-editor-error-count"
          >
            <AlertTriangle className="h-4 w-4" /> {errorCount} kolom material perlu diperbaiki
          </span>
        )}
        {general && (
          <span
            className="rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-rose-700"
            data-testid="tally-editor-general-error"
          >
            {general}
          </span>
        )}
      </div>

      {/* 2. MATERIAL GRID */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[1240px] p-3 lg:p-0 space-y-3 lg:space-y-0">
            <div className={`${GRID} hidden rounded-t-xl bg-[#0B2149] px-2 py-3 text-[11px] font-semibold uppercase tracking-wider text-white`}>
              <div className="text-center">No.</div>
              <div>Kode Material *</div>
              <div>Nama Material</div>
              <div className="text-center">UOM</div>
              <div>Supplier</div>
              <div className="text-right">Qty</div>
              <div>Batch Fisik{settings.required.batch_fisik && " *"}</div>
              <div>Supplier Batch{settings.required.supplier_batch && " *"}</div>
              <div>Expired Date{settings.required.expired_date && " *"}</div>
              <div>Production Date{settings.required.production_date && " *"}</div>
              <div>PIC *</div>
              <div className="text-center">Aksi</div>
            </div>

            {rows.map((r, i) => (
              <TallyRow
                key={r.key}
                row={r}
                index={i}
                errors={errors}
                currentUser={user}
                required={settings.required}
                onChange={(p) => update(i, p)}
                onDuplicate={() => duplicate(i)}
                onRemove={() => remove(i)}
                canRemove={rows.length > 1}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3">
          <Button
            variant="outline"
            onClick={() => setRows((rs) => [...rs, blank(user, { code: header.supplier_code, name: header.supplier_name })])}
            className="border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            data-testid="tally-editor-add-row-button"
          >
            <Plus className="mr-1 h-4 w-4" /> Tambah Baris Material
          </Button>
          <p className="text-xs text-slate-500">
            Gunakan tombol <span className="font-semibold text-slate-700">Duplikat</span> pada baris jika barang sama namun beda batch/tanggal.
          </p>
        </div>
      </div>

      {/* DIALOG CONFIRM SUBMIT TO ADMIN */}
      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent data-testid="tally-editor-submit-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#0B2149]">Kirim dokumen ke Admin Warehouse?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Dokumen Surat Jalan <strong>{header.delivery_note_no || "-"}</strong> (PO: <strong>{header.po_no || "-"}</strong>) akan diserahkan ke Admin Warehouse untuk verifikasi kesesuaian dokumen & PO SAP sebelum diajukan ke QC.
              </p>
              <p className="text-xs text-slate-600">
                Pastikan seluruh kuantiti dan nomor batch fisik telah selesai dihitung.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="tally-editor-submit-cancel">Periksa Lagi</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSubmit(false);
                save("submit_to_admin");
              }}
              className="bg-blue-700 hover:bg-blue-800"
              data-testid="tally-editor-submit-confirm"
            >
              Kirim ke Admin WH
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
