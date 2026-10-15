import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import PageHeader from "@/components/PageHeader";
import { api, errMsg } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

const FIELDS = [
  ["batch_fisik", "Batch Fisik"],
  ["supplier_batch", "Supplier Batch"],
  ["expired_date", "Expired Date"],
  ["production_date", "Production Date"],
  ["pic", "PIC"],
];
const RULES = [
  ["within_document", "Dalam satu dokumen", "Kombinasi Kode + Batch Fisik + Supplier Batch tidak boleh sama dalam satu tally sheet."],
  ["across_final", "Antar dokumen Final", "Kombinasi yang sama tidak boleh ada di dokumen Final lain."],
  ["both", "Keduanya", "Terapkan kedua aturan di atas."],
  ["none", "Tidak dicek", "Izinkan data ganda."],
];

export default function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data));
  }, []);
  if (!s) return null;
  const save = async () => {
    try {
      const r = await api.put("/settings", { required: s.required, duplicate_rule: s.duplicate_rule });
      setS(r.data);
      toast.success("Pengaturan validasi disimpan");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div data-testid="settings-page">
      <PageHeader title="Pengaturan Validasi" subtitle={s.updated_at ? `Terakhir diubah ${fmtDateTime(s.updated_at)} oleh ${s.updated_by_name}` : "Atur kolom wajib dan aturan data ganda."}
        actions={<Button onClick={save} className="bg-blue-700 hover:bg-blue-800" data-testid="admin-save-settings-button"><Save className="mr-1 h-4 w-4" /> Simpan Pengaturan</Button>} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[#0B2149]">Kolom Wajib (saat Finalisasi)</h2>
          <p className="mb-4 text-xs text-slate-500">Kode & Nama Material selalu wajib dan hanya dari Master Data.</p>
          <div className="divide-y">
            {FIELDS.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-slate-800">{label}</span>
                <Switch checked={!!s.required[k]} onCheckedChange={(v) => setS({ ...s, required: { ...s.required, [k]: v } })} data-testid={`settings-required-${k}`} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-bold text-[#0B2149]">Aturan Pencegahan Data Ganda</h2>
          <RadioGroup value={s.duplicate_rule} onValueChange={(v) => setS({ ...s, duplicate_rule: v })} className="space-y-2" data-testid="settings-duplicate-rule">
            {RULES.map(([v, t, d]) => (
              <Label key={v} htmlFor={`rule-${v}`} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${s.duplicate_rule === v ? "border-blue-600 bg-blue-50/50" : ""}`}>
                <RadioGroupItem id={`rule-${v}`} value={v} className="mt-0.5" data-testid={`settings-duplicate-${v}`} />
                <span><span className="block font-semibold text-slate-900">{t}</span><span className="text-xs font-normal text-slate-500">{d}</span></span>
              </Label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
