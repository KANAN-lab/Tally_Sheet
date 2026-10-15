import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const rule = settings.duplicate_rule;

  rows.forEach((r, i) => {
    if (!r.material_code) {
      errs[`${i}-material_code`] = "Material wajib dipilih dari Master Data";
    }
    if (r.expired_date && r.production_date && r.production_date > r.expired_date) {
      errs[`${i}-production_date`] = "Production Date tidak boleh lebih besar dari Expired Date";
    }
    if (action === "final") {
      const vals = {
        batch_fisik: (r.batch_fisik || "").trim(),
        supplier_batch: (r.supplier_batch || "").trim(),
        expired_date: r.expired_date,
        production_date: r.production_date,
        pic: r.pic_id || "ok" // PIC is auto-filled by current user
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
  const [confirmFinal, setConfirmFinal] = useState(false);

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

  const save = async (action) => {
    setConfirmFinal(false);
    setGeneral("");
    const filled = rows.filter((r) => !isEmpty(r));
    if (!filled.length) {
      setGeneral("Minimal 1 baris material harus diisi");
      return toast.error("Minimal 1 baris material harus diisi");
    }
    if (filled.length !== rows.length) setRows(filled);

    const errs = clientValidate(filled, action, settings);
    setErrors(errs);
    if (Object.keys(errs).length) {
      return toast.error("Data belum valid. Periksa kolom yang ditandai merah.");
    }

    const payload = {
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
        action === "final"
          ? `Tally sheet ${r.data.doc_no} berhasil difinalisasi`
          : `Tally sheet ${r.data.doc_no} disimpan sebagai Draft`
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
    <div data-testid="tally-editor-page">
      <PageHeader
        title={sheet ? `Edit ${sheet.doc_no}` : "Buat Tally Sheet Baru"}
        subtitle={
          sheet
            ? "Dokumen Draft — dapat diubah sebelum difinalisasi."
            : "Nomor dokumen dibuat otomatis saat disimpan. Kolom bertanda * wajib saat finalisasi."
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate(sheet ? `/tally/${sheet.id}` : "/tally")}
              data-testid="tally-editor-back-button"
            >
              Kembali
            </Button>
            <Button
              onClick={() => save("draft")}
              disabled={busy}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="tally-editor-save-draft-button"
            >
              <Save className="mr-1 h-4 w-4" /> Simpan Draft
            </Button>
            <Button
              onClick={() => setConfirmFinal(true)}
              disabled={busy}
              className="bg-[#0B2149] hover:bg-[#13306a]"
              data-testid="tally-editor-finalize-button"
            >
              <CheckCircle2 className="mr-1 h-4 w-4" /> Finalisasi
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md bg-white border px-3 py-1.5 text-slate-700 font-medium" data-testid="tally-editor-row-count">
          {rows.length} baris · {completeRows} material dipilih
        </span>
        <span className="rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-blue-900 text-xs">
          PIC Aktif: <strong>{user?.name}</strong> (Terkunci Otomatis)
        </span>
        {errorCount > 0 && (
          <span
            className="flex items-center gap-1.5 rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-rose-700 font-medium"
            data-testid="tally-editor-error-count"
          >
            <AlertTriangle className="h-4 w-4" /> {errorCount} kesalahan perlu diperbaiki
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

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[1220px] p-3 lg:p-0 space-y-3 lg:space-y-0">
            <div className={`${GRID} hidden rounded-t-xl bg-[#0B2149] px-2 py-3 text-[11px] font-semibold uppercase tracking-wider text-white`}>
              <div>No.</div>
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
            onClick={() => setRows((rs) => [...rs, blank(user)])}
            className="border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            data-testid="tally-editor-add-row-button"
          >
            <Plus className="mr-1 h-4 w-4" /> Tambah Baris
          </Button>
          <p className="text-xs text-slate-500">
            Gunakan tombol <span className="font-semibold text-slate-700">Duplikat</span> pada baris jika barang sama namun beda batch/tanggal.
          </p>
        </div>
      </div>

      <AlertDialog open={confirmFinal} onOpenChange={setConfirmFinal}>
        <AlertDialogContent data-testid="tally-editor-finalize-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Finalisasi tally sheet?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen Final tidak dapat diedit lagi. Pastikan seluruh data, batch, dan tanggal sudah benar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="tally-editor-finalize-cancel">Periksa Lagi</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => save("final")}
              className="bg-[#0B2149] hover:bg-[#13306a]"
              data-testid="tally-editor-finalize-confirm"
            >
              Ya, Finalisasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
