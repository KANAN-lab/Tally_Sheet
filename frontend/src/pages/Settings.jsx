import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, ShieldCheck, AlertTriangle, Layers, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import PageHeader from "@/components/PageHeader";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { api, errMsg } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { swalAlert } from "@/lib/swal";

const FIELDS = [
  ["batch_fisik", "Batch Fisik"],
  ["supplier_batch", "Supplier Batch"],
  ["expired_date", "Expired Date"],
  ["production_date", "Production Date"],
  ["pic", "PIC (Otomatis Terkunci)"],
];

const RULES = [
  ["within_document", "Dalam satu dokumen", "Kombinasi Kode + Batch Fisik + Supplier Batch tidak boleh sama dalam satu tally sheet."],
  ["across_final", "Antar dokumen Selesai/Final", "Kombinasi yang sama tidak boleh ada di dokumen yang sudah selesai."],
  ["both", "Keduanya", "Terapkan kedua aturan pencegahan duplikasi di atas."],
  ["none", "Tidak dicek", "Izinkan data ganda tanpa pembatasan."],
];

export default function Settings() {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/settings")
      .then((r) => setS(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !s) {
    return <DetailSkeleton />;
  }

  const handleAddCategory = () => {
    const val = newCategory.trim();
    if (!val) return;
    const existing = s.hold_categories || [];
    if (existing.includes(val)) {
      return toast.error("Kategori kendala tersebut sudah ada.");
    }
    setS({
      ...s,
      hold_categories: [...existing, val]
    });
    setNewCategory("");
  };

  const handleRemoveCategory = (cat) => {
    const existing = s.hold_categories || [];
    if (existing.length <= 1) {
      return toast.error("Minimal harus tersisa 1 kategori masalah.");
    }
    setS({
      ...s,
      hold_categories: existing.filter((c) => c !== cat)
    });
  };

  const qaDocs = s.qa_documents || {
    TALLY_SHEET: {
      code: "SOP.WH-D.01",
      title: "FORM TALLY SHEET PENERIMAAN MATERIAL",
      revision: "01",
      effective_date: "01 Januari 2024",
      plant: "PT DIAMOND COLD STORAGE - PLANT 2111 (CIBITUNG)"
    },
    BERITA_ACARA_IMPORT: {
      code: "SOP.WH-D.02",
      title: "BERITA ACARA PENERIMAAN BARANG IMPORT",
      revision: "01",
      effective_date: "01 Januari 2024",
      plant: "PT DIAMOND COLD STORAGE - PLANT 2111 (CIBITUNG)"
    }
  };

  const updateQaDoc = (docKey, field, val) => {
    setS((prev) => ({
      ...prev,
      qa_documents: {
        ...(prev.qa_documents || qaDocs),
        [docKey]: {
          ...((prev.qa_documents && prev.qa_documents[docKey]) || qaDocs[docKey]),
          [field]: val
        }
      }
    }));
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        required: s.required,
        duplicate_rule: s.duplicate_rule,
        hold_categories: s.hold_categories || [],
        qa_documents: s.qa_documents || qaDocs
      };
      const r = await api.put("/settings", payload);
      setS(r.data);
      swalAlert("Pengaturan Tersimpan", "Seluruh konfigurasi validasi, kategori kendala, dan Nomor Dokumen Resmi QA berhasil diperbarui.", "success");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="settings-page" className="space-y-6">
      <PageHeader
        title="Pengaturan Administrator (Zero Hardcode Engine)"
        subtitle={
          s.updated_at
            ? `Terakhir diperbarui pada ${fmtDateTime(s.updated_at)} oleh ${s.updated_by_name}`
            : "Konfigurasi aturan validasi, penanganan duplikasi, dan kategori kendala operasional secara dinamis."
        }
        actions={
          <Button
            onClick={save}
            disabled={busy}
            className="bg-blue-700 hover:bg-blue-800 font-semibold text-xs"
            data-testid="admin-save-settings-button"
          >
            <Save className="mr-1.5 h-4 w-4" /> Simpan Pengaturan
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Kolom Wajib */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="border-b pb-3">
            <h2 className="font-display text-base font-bold text-[#0B2149] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-700" /> Kolom Wajib (Mandatory Item Fields)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tentukan kolom mana saja yang wajib diisi oleh Checker saat menyerahkan dokumen ke Admin.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {FIELDS.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between py-3">
                <span className="text-xs font-semibold text-slate-800">{label}</span>
                <Switch
                  checked={!!s.required[k]}
                  onCheckedChange={(v) =>
                    setS({ ...s, required: { ...s.required, [k]: v } })
                  }
                  data-testid={`settings-required-${k}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Aturan Pencegahan Data Ganda */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="border-b pb-3">
            <h2 className="font-display text-base font-bold text-[#0B2149] flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-700" /> Aturan Pencegahan Data Ganda
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pencegahan input material ganda dengan kombinasi Kode + Batch Fisik + Supplier Batch.
            </p>
          </div>

          <RadioGroup
            value={s.duplicate_rule}
            onValueChange={(v) => setS({ ...s, duplicate_rule: v })}
            className="space-y-2.5"
            data-testid="settings-duplicate-rule"
          >
            {RULES.map(([v, t, d]) => (
              <Label
                key={v}
                htmlFor={`rule-${v}`}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                  s.duplicate_rule === v ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-500/20" : "hover:bg-slate-50"
                }`}
              >
                <RadioGroupItem id={`rule-${v}`} value={v} className="mt-0.5" data-testid={`settings-duplicate-${v}`} />
                <div>
                  <span className="block font-bold text-xs text-slate-900">{t}</span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">{d}</span>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>

        {/* Dynamic Hold Categories (Zero Hardcoding) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="border-b pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B2149] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" /> Kategori Kendala / Hold Reasons (Zero Hardcode)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kategori ini digunakan oleh Admin Warehouse dan Tim QC saat menahan atau menolak dokumen secara dinamis.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5">
              {(s.hold_categories || []).length} Kategori Aktif
            </span>
          </div>

          {/* Add Category Input */}
          <div className="flex gap-2 max-w-xl">
            <Input
              placeholder="Ketik kategori baru (contoh: Dokumen Rusak, Suhu Tidak Sesuai)..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              className="text-xs"
              data-testid="input-new-hold-category"
            />
            <Button
              type="button"
              onClick={handleAddCategory}
              variant="outline"
              className="text-xs font-semibold text-blue-700 border-blue-300 hover:bg-blue-50 shrink-0"
              data-testid="btn-add-hold-category"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Kategori
            </Button>
          </div>

          {/* Categories List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
            {(s.hold_categories || []).map((cat, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs"
                data-testid={`hold-category-item-${idx}`}
              >
                <div className="font-semibold text-slate-800 truncate" title={cat}>
                  {idx + 1}. {cat}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(cat)}
                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                  title="Hapus kategori"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* STANDAR NOMOR DOKUMEN QA TERKENDALI (ISO 9001:2015 CLAUSE 7.5) */}
        <div className="lg:col-span-2 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm space-y-5" data-testid="settings-qa-documents-card">
          <div className="border-b pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B2149] flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-700" /> Standar Nomor Dokumen QA Terkendali (Zero Hardcode Registry)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pendaftaran format nomor dokumen resmi, revisi, dan judul formulir ke Quality Assurance (QA) sesuai audit ISO 9001:2015.
              </p>
            </div>
            <span className="rounded-full bg-blue-100 text-blue-900 text-xs font-bold px-2.5 py-0.5">
              ISO 9001:2015 Clause 7.5
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Form 1: Tally Sheet */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-xs text-blue-950 uppercase tracking-wide">
                  1. Formulir Tally Sheet Penerimaan
                </span>
                <span className="font-mono text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {qaDocs.TALLY_SHEET?.code || "SOP.WH-D.01"}
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Nomor Dokumen Resmi (QA Code) *</Label>
                <Input
                  value={qaDocs.TALLY_SHEET?.code || ""}
                  onChange={(e) => updateQaDoc("TALLY_SHEET", "code", e.target.value.toUpperCase())}
                  placeholder="Contoh: SOP.WH-D.01"
                  className="mt-1 font-mono uppercase text-xs"
                  data-testid="input-qa-tally-code"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Judul Dokumen Resmi</Label>
                <Input
                  value={qaDocs.TALLY_SHEET?.title || ""}
                  onChange={(e) => updateQaDoc("TALLY_SHEET", "title", e.target.value)}
                  placeholder="FORM TALLY SHEET PENERIMAAN MATERIAL"
                  className="mt-1 text-xs"
                  data-testid="input-qa-tally-title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-800">No. Revisi</Label>
                  <Input
                    value={qaDocs.TALLY_SHEET?.revision || ""}
                    onChange={(e) => updateQaDoc("TALLY_SHEET", "revision", e.target.value)}
                    placeholder="01"
                    className="mt-1 font-mono text-xs"
                    data-testid="input-qa-tally-rev"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-800">Tanggal Berlaku</Label>
                  <Input
                    value={qaDocs.TALLY_SHEET?.effective_date || ""}
                    onChange={(e) => updateQaDoc("TALLY_SHEET", "effective_date", e.target.value)}
                    placeholder="01 Januari 2024"
                    className="mt-1 text-xs"
                    data-testid="input-qa-tally-date"
                  />
                </div>
              </div>
            </div>

            {/* Form 2: Berita Acara Penerimaan Barang Import */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-xs text-blue-950 uppercase tracking-wide">
                  2. Formulir Berita Acara Penerimaan Barang Import
                </span>
                <span className="font-mono text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {qaDocs.BERITA_ACARA_IMPORT?.code || "SOP.WH-D.02"}
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Nomor Dokumen Resmi (QA Code) *</Label>
                <Input
                  value={qaDocs.BERITA_ACARA_IMPORT?.code || ""}
                  onChange={(e) => updateQaDoc("BERITA_ACARA_IMPORT", "code", e.target.value.toUpperCase())}
                  placeholder="Contoh: SOP.WH-D.02"
                  className="mt-1 font-mono uppercase text-xs"
                  data-testid="input-qa-ba-code"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Judul Dokumen Resmi</Label>
                <Input
                  value={qaDocs.BERITA_ACARA_IMPORT?.title || ""}
                  onChange={(e) => updateQaDoc("BERITA_ACARA_IMPORT", "title", e.target.value)}
                  placeholder="BERITA ACARA PENERIMAAN BARANG IMPORT"
                  className="mt-1 text-xs"
                  data-testid="input-qa-ba-title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-800">No. Revisi</Label>
                  <Input
                    value={qaDocs.BERITA_ACARA_IMPORT?.revision || ""}
                    onChange={(e) => updateQaDoc("BERITA_ACARA_IMPORT", "revision", e.target.value)}
                    placeholder="01"
                    className="mt-1 font-mono text-xs"
                    data-testid="input-qa-ba-rev"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-800">Tanggal Berlaku</Label>
                  <Input
                    value={qaDocs.BERITA_ACARA_IMPORT?.effective_date || ""}
                    onChange={(e) => updateQaDoc("BERITA_ACARA_IMPORT", "effective_date", e.target.value)}
                    placeholder="01 Januari 2024"
                    className="mt-1 text-xs"
                    data-testid="input-qa-ba-date"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
