import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import { VersionTable } from "@/pages/MasterData";
import { api, errMsg } from "@/lib/api";

function Stat({ label, value, tone = "slate", testId }) {
  const tones = { slate: "text-slate-900", green: "text-emerald-700", red: "text-rose-700", blue: "text-blue-700", amber: "text-amber-700" };
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${tones[tone]}`} data-testid={testId}>{value}</div>
    </div>
  );
}

function Preview({ p, mode }) {
  return (
    <div className="space-y-5" data-testid="master-data-preview">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Total baris" value={p.total_rows} testId="preview-total-rows" />
        <Stat label="Valid" value={p.valid_rows} tone="green" testId="preview-valid-rows" />
        <Stat label="Error" value={p.error_rows} tone="red" testId="preview-error-rows" />
        <Stat label="Material baru" value={p.stats.new} tone="blue" testId="preview-new" />
        <Stat label="Diperbarui" value={p.stats.updated} tone="blue" testId="preview-updated" />
        <Stat label="Dinonaktifkan" value={mode === "replace" ? p.stats.deactivate_if_replace : 0} tone="amber" testId="preview-deactivate" />
      </div>
      <div className="text-xs text-slate-500">Kolom terdeteksi: Kode = <b>{p.code_column}</b>, Nama = <b>{p.name_column}</b>{p.extra_columns.length > 0 && <>, pendukung = {p.extra_columns.join(", ")}</>}</div>
      {p.errors.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3" data-testid="master-data-error-report">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-700"><AlertTriangle className="h-4 w-4" /> Laporan kesalahan ({p.error_rows} baris dilewati)</div>
          <div className="max-h-56 overflow-auto rounded border border-rose-100 bg-white">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-rose-50 text-left"><tr><th className="px-3 py-1.5">Baris</th><th className="px-3 py-1.5">Kode</th><th className="px-3 py-1.5">Kesalahan</th></tr></thead>
              <tbody className="divide-y">{p.errors.map((e, i) => <tr key={i}><td className="px-3 py-1.5 font-mono">{e.line}</td><td className="px-3 py-1.5 font-mono">{e.code || "-"}</td><td className="px-3 py-1.5 text-rose-700">{e.message}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      <div>
        <div className="mb-2 text-sm font-semibold text-slate-800">Pratinjau data valid (maks. 50 baris pertama)</div>
        <div className="max-h-80 overflow-auto rounded-lg border" data-testid="master-data-preview-table">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold"><tr><th className="px-3 py-2">Baris</th><th className="px-3 py-2">Kode Material</th><th className="px-3 py-2">Nama Material</th>{p.extra_columns.slice(0, 3).map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr></thead>
            <tbody className="divide-y">{p.sample.map((r) => <tr key={r.code}><td className="px-3 py-2 font-mono text-xs text-slate-500">{r.line}</td><td className="px-3 py-2 font-mono text-xs font-semibold text-blue-900">{r.code}</td><td className="px-3 py-2">{r.name}</td>{p.extra_columns.slice(0, 3).map((c) => <td key={c} className="px-3 py-2 text-slate-600">{r.extra[c]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function MasterUpload() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("upsert");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    api.get("/master/versions").then((r) => setVersions(r.data));
  }, []);

  const pick = (f) => {
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return toast.error("Format file harus .xlsx, .xls, atau .csv");
    setFile(f);
    setPreview(null);
  };

  const doPreview = async () => {
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const r = await api.post("/master/preview", fd);
      setPreview(r.data);
      toast.success("Pratinjau siap. Periksa data sebelum memproses.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const r = await api.post("/master/commit", { preview_id: preview.preview_id, mode });
      toast.success(`Master data v${r.data.version} berhasil diproses: ${r.data.inserted} baru, ${r.data.updated} diperbarui, ${r.data.deactivated} dinonaktifkan`);
      navigate("/master");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="master-upload-page">
      <PageHeader title="Upload Master Data" subtitle="Upload file Excel (.xlsx, .xls) atau CSV berisi kolom Kode Material dan Nama/Deskripsi Material." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5 rounded-xl border bg-white p-5 shadow-sm">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50"
            data-testid="master-data-dropzone"
          >
            <UploadCloud className="mx-auto h-10 w-10 text-blue-600" />
            <div className="mt-2 font-semibold text-[#0B2149]">{file ? file.name : "Klik atau seret file ke sini"}</div>
            <div className="text-xs text-slate-500">{file ? `${(file.size / 1024).toFixed(1)} KB` : "Maksimal 10 MB · .xlsx, .xls, .csv"}</div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} data-testid="master-data-file-input" />
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-800">Metode pembaruan</div>
            <RadioGroup value={mode} onValueChange={setMode} className="grid gap-3 md:grid-cols-2" data-testid="master-data-mode-select">
              {[
                { v: "upsert", t: "Tambah / Update Data", d: "Tambah material baru dan perbarui yang sudah ada berdasarkan kode material." },
                { v: "replace", t: "Ganti Data", d: "Ganti seluruh master aktif. Material yang tidak ada di file dinonaktifkan (histori tetap tersimpan)." },
              ].map((o) => (
                <Label key={o.v} htmlFor={`mode-${o.v}`} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${mode === o.v ? "border-blue-600 bg-blue-50/50" : ""}`}>
                  <RadioGroupItem id={`mode-${o.v}`} value={o.v} data-testid={`master-data-mode-${o.v}`} className="mt-0.5" />
                  <span><span className="block font-semibold text-slate-900">{o.t}</span><span className="text-xs font-normal text-slate-500">{o.d}</span></span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={doPreview} disabled={!file || busy} variant="outline" data-testid="master-data-preview-button">
              {busy && !preview ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />} Pratinjau & Validasi
            </Button>
            {preview && (
              <Button onClick={commit} disabled={busy || preview.valid_rows === 0} className="bg-blue-700 hover:bg-blue-800" data-testid="master-data-commit-button">
                <CheckCircle2 className="mr-1 h-4 w-4" /> Proses {preview.valid_rows} Baris ({mode === "replace" ? "Ganti Data" : "Tambah/Update"})
              </Button>
            )}
          </div>
          {preview && <Preview p={preview} mode={mode} />}
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm text-sm">
          <h2 className="font-display font-bold text-[#0B2149]">Format file</h2>
          <p className="mt-2 text-slate-600">Baris pertama adalah judul kolom. Sistem mengenali nama kolom berikut:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
            <li><b>Kode:</b> Kode Material, Material Code, Kode, Code, Material, SKU</li>
            <li><b>Nama:</b> Nama Material, Deskripsi, Description, Material Description, Nama</li>
            <li>Kolom lain (mis. Satuan, Kategori) disimpan sebagai data pendukung.</li>
          </ul>
          <p className="mt-3 text-slate-600">Baris dengan kode kosong, nama kosong, atau kode duplikat akan ditolak dan ditampilkan di laporan kesalahan.</p>
        </div>
      </div>
      <div className="mt-6 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-display text-lg font-bold text-[#0B2149]">Riwayat Upload</h2>
        <VersionTable versions={versions} />
      </div>
    </div>
  );
}
