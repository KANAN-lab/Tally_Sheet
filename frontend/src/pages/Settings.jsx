import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, ShieldCheck, AlertTriangle, Layers, FileText, Radio, Send, Key, RefreshCw, CheckCircle2, XCircle, CheckSquare, Square, Zap, Loader2 } from "lucide-react";
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

const DEFAULT_WEBHOOK_CONFIG = {
  enabled: false,
  url: "",
  secret: "",
  events: [
    "tally.submitted",
    "tally.verified_to_qc",
    "tally.held",
    "tally.unheld",
    "tally.approved_stock_uu",
    "tally.rejected",
    "tally.cancelled"
  ]
};

const WEBHOOK_EVENT_LIST = [
  { id: "tally.submitted", label: "Penyerahan Draf ke Admin WH", tag: "Checker -> Admin", desc: "Dipicu saat Checker menyelesaikan input fisik & menyerahkan dokumen ke Admin Warehouse." },
  { id: "tally.verified_to_qc", label: "Verifikasi & Teruskan ke QC", tag: "Admin -> QC", desc: "Dipicu saat Admin Warehouse memvalidasi dokumen dan mengajukan uji mutu fisik/lab ke Tim QC." },
  { id: "tally.held", label: "Penahanan Dokumen (Hold Admin / QC)", tag: "Hold Operasional", desc: "Dipicu saat dokumen ditahan karena selisih kuantiti, mutu tertunda, atau kendala surat jalan." },
  { id: "tally.unheld", label: "Pelepasan Status Penahanan (Un-Hold)", tag: "Resolusi Korektif", desc: "Dipicu saat status hold diselesaikan dengan melampirkan catatan tindakan korektif." },
  { id: "tally.approved_stock_uu", label: "Lulus Uji Mutu (Stock Ter-UU / Completed)", tag: "QC Approved", desc: "Dipicu saat Tim QC meluluskan mutu fisik & dokumen resmi diakui di sistem stok pabrik." },
  { id: "tally.rejected", label: "Penolakan Mutu (QC Reject)", tag: "QC Rejected", desc: "Dipicu saat Tim QC menolak mutu fisik atau hasil uji laboratorium kedatangan." },
  { id: "tally.cancelled", label: "Pembatalan Dokumen", tag: "Dokumen Batal", desc: "Dipicu saat dokumen tally sheet resmi dibatalkan oleh Super Admin." },
];

export default function Settings() {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);

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

  const qaDocs = s.qa_documents || {};

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

  const webhookConfig = s.webhook_config || DEFAULT_WEBHOOK_CONFIG;

  const updateWebhook = (field, val) => {
    setS((prev) => ({
      ...prev,
      webhook_config: {
        ...(prev.webhook_config || DEFAULT_WEBHOOK_CONFIG),
        [field]: val
      }
    }));
  };

  const handleGenerateSecret = () => {
    try {
      const arr = new Uint8Array(16);
      window.crypto.getRandomValues(arr);
      const secret = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
      updateWebhook("secret", secret);
      toast.success("Secret key acak berhasil di-generate");
    } catch {
      const randomSecret = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      updateWebhook("secret", randomSecret);
      toast.success("Secret key acak berhasil di-generate");
    }
  };

  const toggleWebhookEvent = (eventId) => {
    const currentEvents = webhookConfig.events || [];
    const nextEvents = currentEvents.includes(eventId)
      ? currentEvents.filter((e) => e !== eventId)
      : [...currentEvents, eventId];
    updateWebhook("events", nextEvents);
  };

  const selectAllEvents = () => {
    updateWebhook("events", WEBHOOK_EVENT_LIST.map((e) => e.id));
  };

  const deselectAllEvents = () => {
    updateWebhook("events", []);
  };

  const handleTestPing = async () => {
    const url = (webhookConfig.url || "").trim();
    if (!url) {
      return toast.error("Silakan masukkan URL Webhook tujuan terlebih dahulu.");
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return toast.error("URL Webhook harus diawali dengan http:// atau https://");
    }

    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await api.post("/settings/webhook/test", {
        url: url,
        secret: webhookConfig.secret || ""
      });
      setTestResult(res.data);
      if (res.data.success) {
        toast.success(`Uji coba ping berhasil (Status ${res.data.status_code}, ${res.data.elapsed_ms}ms)`);
      } else {
        toast.warning(res.data.message || `Uji coba ping merespons status ${res.data.status_code}`);
      }
    } catch (err) {
      const errorMsg = errMsg(err);
      setTestResult({
        success: false,
        status_code: 0,
        elapsed_ms: 0,
        message: errorMsg
      });
      toast.error(errorMsg);
    } finally {
      setTestBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        required: s.required,
        duplicate_rule: s.duplicate_rule,
        hold_categories: s.hold_categories || [],
        qa_documents: s.qa_documents || qaDocs,
        webhook_config: s.webhook_config || DEFAULT_WEBHOOK_CONFIG
      };
      const r = await api.put("/settings", payload);
      setS(r.data);
      swalAlert("Pengaturan Tersimpan", "Seluruh konfigurasi validasi, kategori kendala, Nomor Dokumen QA, dan Webhook berhasil diperbarui.", "success");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="settings-page" className="space-y-6">
      <PageHeader
        title="Pengaturan Administrator"
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

        {/* Dynamic Hold Categories */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="border-b pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B2149] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" /> Kategori Kendala & Alasan Penahanan (Hold Reasons)
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
                <FileText className="h-5 w-5 text-blue-700" /> Standar Nomor Dokumen QA Terkendali (Master Registry)
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
                  {qaDocs.TALLY_SHEET?.code || ""}
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Nomor Dokumen Resmi (QA Code) *</Label>
                <Input
                  value={qaDocs.TALLY_SHEET?.code || ""}
                  onChange={(e) => updateQaDoc("TALLY_SHEET", "code", e.target.value.toUpperCase())}
                  placeholder="Kode QA..."
                  className="mt-1 font-mono uppercase text-xs"
                  data-testid="input-qa-tally-code"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Judul Dokumen Resmi</Label>
                <Input
                  value={qaDocs.TALLY_SHEET?.title || ""}
                  onChange={(e) => updateQaDoc("TALLY_SHEET", "title", e.target.value)}
                  placeholder="Judul Dokumen Resmi..."
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

            {/* Form 2: Berita Acara Penerimaan Barang (Universal: Import & Lokal) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-xs text-blue-950 uppercase tracking-wide">
                  2. Formulir Berita Acara Penerimaan Barang (Import & Lokal)
                </span>
                <span className="font-mono text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {qaDocs.BERITA_ACARA_IMPORT?.code || ""}
                </span>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Nomor Dokumen Resmi (QA Code) *</Label>
                <Input
                  value={qaDocs.BERITA_ACARA_IMPORT?.code || ""}
                  onChange={(e) => updateQaDoc("BERITA_ACARA_IMPORT", "code", e.target.value.toUpperCase())}
                  placeholder="Kode QA..."
                  className="mt-1 font-mono uppercase text-xs"
                  data-testid="input-qa-ba-code"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Judul Dokumen Resmi</Label>
                <Input
                  value={qaDocs.BERITA_ACARA_IMPORT?.title || ""}
                  onChange={(e) => updateQaDoc("BERITA_ACARA_IMPORT", "title", e.target.value)}
                  placeholder="BERITA ACARA PENERIMAAN BARANG"
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

        {/* 5. INTEGRASI WEBHOOK NOTIFIKASI REAL-TIME TERINTEGRASI */}
        <div className="lg:col-span-2 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm space-y-5" data-testid="settings-webhook-card">
          <div className="border-b pb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="font-display text-base font-bold text-[#0B2149] flex items-center gap-2">
                <Radio className={`h-5 w-5 ${webhookConfig.enabled ? "text-emerald-600 animate-pulse" : "text-slate-400"}`} />
                Integrasi Webhook Notifikasi Real-time
              </h2>
              <p className="text-xs text-slate-500">
                Kirim notifikasi payload JSON secara otomatis ke sistem eksternal (ERP SAP, Slack, MS Teams, Discord, atau API custom) pada setiap transisi status tally sheet.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${webhookConfig.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                {webhookConfig.enabled ? "Webhook Aktif" : "Nonaktif"}
              </span>
              <div className="flex items-center gap-2 border-l pl-3">
                <Switch
                  checked={!!webhookConfig.enabled}
                  onCheckedChange={(v) => updateWebhook("enabled", v)}
                  data-testid="switch-webhook-enabled"
                />
                <span className="text-xs font-semibold text-slate-700">Aktifkan</span>
              </div>
            </div>
          </div>

          {!webhookConfig.enabled ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center space-y-2">
              <Zap className="h-8 w-8 text-slate-400 mx-auto" />
              <div className="text-xs font-semibold text-slate-700">Dispatcher Webhook Sedang Nonaktif</div>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Aktifkan toggle di atas untuk mulai menyiarkan event kedatangan material, verifikasi dokumen, notifikasi hold, dan approval mutu QC secara real-time tanpa membebani performa server.
              </p>
            </div>
          ) : (
            <div className="space-y-5 pt-1">
              {/* URL & Secret Key Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Target URL */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                    <span>Target URL Webhook Endpoint *</span>
                    <span className="text-[10px] text-slate-500 font-normal">HTTP / HTTPS</span>
                  </Label>
                  <Input
                    value={webhookConfig.url || ""}
                    onChange={(e) => updateWebhook("url", e.target.value)}
                    placeholder="https://api.perusahaan.com/webhook/tally atau URL Slack/Teams..."
                    className="text-xs font-mono"
                    data-testid="input-webhook-url"
                  />
                  <p className="text-[11px] text-slate-500">
                    Endpoint penerima payload POST JSON (asinkron daemon thread, timeout 4 detik).
                  </p>
                </div>

                {/* Secret Key */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                    <span>Secret Key (HMAC-SHA256 Signature)</span>
                    <span className="text-[10px] text-emerald-700 font-mono font-semibold">X-Tally-Signature</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={webhookConfig.secret || ""}
                      onChange={(e) => updateWebhook("secret", e.target.value)}
                      placeholder="Ketik secret key atau klik generate..."
                      className="text-xs font-mono"
                      data-testid="input-webhook-secret"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateSecret}
                      className="text-xs shrink-0 font-semibold border-slate-300 hover:bg-slate-100"
                      title="Generate secret key acak 32 karakter"
                      data-testid="btn-generate-webhook-secret"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Acak
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Digunakan penerima untuk memverifikasi keaslian payload via header <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono text-slate-800">X-Tally-Signature: sha256=&lt;hash&gt;</code>.
                  </p>
                </div>
              </div>

              {/* Event Subscriptions Checklist */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                      Event Langganan (Workflow Triggers)
                    </span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.2">
                      {(webhookConfig.events || []).length} dari {WEBHOOK_EVENT_LIST.length} Dipilih
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllEvents}
                      className="text-blue-700 hover:underline font-semibold text-[11px]"
                      data-testid="btn-select-all-webhook-events"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={deselectAllEvents}
                      className="text-rose-600 hover:underline font-semibold text-[11px]"
                      data-testid="btn-deselect-all-webhook-events"
                    >
                      Kosongkan Semua
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {WEBHOOK_EVENT_LIST.map((ev) => {
                    const isChecked = (webhookConfig.events || []).includes(ev.id);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => toggleWebhookEvent(ev.id)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                          isChecked
                            ? "bg-white border-emerald-300 shadow-xs ring-1 ring-emerald-500/10"
                            : "bg-slate-50/70 border-slate-200 hover:bg-white text-slate-500"
                        }`}
                        data-testid={`webhook-event-item-${ev.id}`}
                      >
                        <div className="mt-0.5 shrink-0 text-emerald-700">
                          {isChecked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-400" />}
                        </div>
                        <div className="space-y-0.5 grow min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 truncate">{ev.label}</span>
                            <span className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                              {ev.tag}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-emerald-800">{ev.id}</div>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{ev.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Bar Uji Coba & Test Ping */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Send className="h-3.5 w-3.5 text-blue-700" /> Uji Coba Pengiriman Endpoint (Ping Test)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Kirim paket payload pengujian <code className="font-mono text-emerald-700 font-semibold">tally.test_ping</code> untuk memverifikasi konektivitas dan latensi respon server tujuan.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={testBusy || !webhookConfig.url}
                    onClick={handleTestPing}
                    className="text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-50 shrink-0"
                    data-testid="btn-test-webhook-ping"
                  >
                    {testBusy ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Mengirim Ping...
                      </>
                    ) : (
                      <>
                        <Send className="mr-1.5 h-3.5 w-3.5" /> Uji Coba Ping
                      </>
                    )}
                  </Button>
                </div>

                {/* Hasil Test Ping */}
                {testResult && (
                  <div
                    className={`rounded-lg p-3 text-xs border flex items-start gap-2.5 ${
                      testResult.success
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    }`}
                    data-testid="webhook-test-result"
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 grow min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">
                          {testResult.success ? "Uji Coba Berhasil" : "Uji Coba Gagal"}
                        </span>
                        {testResult.status_code > 0 && (
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 border border-current">
                            HTTP {testResult.status_code}
                          </span>
                        )}
                        {testResult.elapsed_ms > 0 && (
                          <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/80 border border-current">
                            {testResult.elapsed_ms} ms
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed break-words">{testResult.message}</p>
                    </div>
                  </div>
                )}

                {/* Spesifikasi Header Standar */}
                <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 border-t border-slate-100">
                  <span className="font-semibold text-slate-700">Headers Otomatis:</span>
                  <span className="font-mono text-[10px]">X-Tally-Event</span>
                  <span className="font-mono text-[10px]">X-Tally-Delivery</span>
                  <span className="font-mono text-[10px]">X-Tally-Timestamp</span>
                  <span className="font-mono text-[10px]">X-Tally-Signature (HMAC-SHA256)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
