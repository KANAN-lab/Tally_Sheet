import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Truck, FileText, CheckCircle2, AlertCircle, ShieldCheck, Thermometer, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errMsg } from "@/lib/api";
import { formatContainerNo } from "@/lib/format";

export default function BeritaAcaraModal({ sheet, isOpen, onClose, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    arrival_type: "import", // "import" | "local"
    container_no: "",
    seal_no: "",
    seal_condition: "Baik / Utuh",
    container_temp_type: "Frozen",
    temp_celsius: "",
    floor_before: "Rata, tidak ditemukan kebocoran, bersih, tidak berminyak",
    wall_before: "Tidak penyok, tidak baret, tidak bolong",
    floor_after: "Rata, tidak ditemukan kebocoran",
    wall_after: "Tidak penyok, tidak baret, tidak bolong",
    cargo_arrangement: "Baik",
    cargo_arrangement_notes: "",
    cargo_condition: "Baik, tidak ditemukan pecah / bocor",
    cargo_condition_notes: "",
    cargo_qty_match: "Sesuai dengan Packing List",
    cargo_qty_notes: "",
    driver_name: "",
    location: "Cibitung"
  });

  useEffect(() => {
    if (sheet && isOpen) {
      const existing = sheet.berita_acara || {};
      const isLocal = existing.arrival_type === "local" || (!existing.arrival_type && !sheet.has_berita_acara);
      setForm({
        arrival_type: existing.arrival_type || (isLocal ? "local" : "import"),
        container_no: existing.container_no || sheet.ba_container_no || (isLocal && sheet.truck_plate ? `BOX-${sheet.truck_plate}` : ""),
        seal_no: existing.seal_no || sheet.ba_seal_no || (isLocal ? "TANPA SEGEL" : ""),
        seal_condition: existing.seal_condition || sheet.ba_seal_condition || "Baik / Utuh",
        container_temp_type: existing.container_temp_type || sheet.ba_container_temp || "Frozen",
        temp_celsius: existing.temp_celsius || "",
        floor_before: existing.floor_before || "Rata, tidak ditemukan kebocoran, bersih, tidak berminyak",
        wall_before: existing.wall_before || "Tidak penyok, tidak baret, tidak bolong",
        floor_after: existing.floor_after || "Rata, tidak ditemukan kebocoran",
        wall_after: existing.wall_after || "Tidak penyok, tidak baret, tidak bolong",
        cargo_arrangement: existing.cargo_arrangement || "Baik",
        cargo_arrangement_notes: existing.cargo_arrangement_notes || "",
        cargo_condition: existing.cargo_condition || "Baik, tidak ditemukan pecah / bocor",
        cargo_condition_notes: existing.cargo_condition_notes || "",
        cargo_qty_match: existing.cargo_qty_match || "Sesuai dengan Packing List",
        cargo_qty_notes: existing.cargo_qty_notes || "",
        driver_name: existing.driver_name || sheet.driver_name || "",
        location: existing.location || "Cibitung"
      });
    }
  }, [sheet, isOpen]);

  const update = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.container_no.trim()) {
      toast.error(form.arrival_type === "local" ? "Nomor Box Truk / Identitas Armada wajib diisi" : "Nomor Kontainer wajib diisi");
      return;
    }

    if (form.arrival_type === "import" && !form.seal_no.trim()) {
      toast.error("Nomor Segel wajib diisi untuk kedatangan kontainer import");
      return;
    }

    setBusy(true);
    try {
      const res = await api.post(`/tally-sheets/${sheet.id}/berita-acara`, form);
      toast.success(res.data.message || "Berita Acara berhasil disimpan dan dilampirkan");
      onSuccess?.(res.data);
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6" data-testid="berita-acara-modal">
        <DialogHeader className="border-b pb-3 text-left">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                {sheet?.has_berita_acara ? "Edit Berita Acara Penerimaan Barang" : "Lampirkan Berita Acara Penerimaan Barang"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Dokumen: <strong className="text-slate-700 font-mono">{sheet?.doc_no}</strong> · SJ: <span className="font-semibold">{sheet?.delivery_note_no || "-"}</span> · PO: <span className="font-semibold">{sheet?.po_no || "-"}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Pilihan Moda: Import vs Lokal */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-800">Jenis Moda Kedatangan Armada:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => update("arrival_type", "import")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  form.arrival_type === "import"
                    ? "bg-blue-700 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
                data-testid="ba-modal-mode-import"
              >
                🚢 Kontainer Import (Laut)
              </button>
              <button
                type="button"
                onClick={() => {
                  update("arrival_type", "local");
                  if (!form.container_no) {
                    update("container_no", sheet?.truck_plate ? `BOX-${sheet.truck_plate}` : "BOX-TRUK");
                  }
                  if (!form.seal_no) {
                    update("seal_no", "TANPA SEGEL");
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  form.arrival_type === "local"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
                data-testid="ba-modal-mode-local"
              >
                🚛 Armada Truk Lokal (Domestik)
              </button>
            </div>
          </div>

          {/* Section: Identitas Kontainer & Segel */}
          <div className="rounded-xl border border-slate-200 p-3.5 space-y-3 bg-white">
            <div className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              1. Identitas {form.arrival_type === "local" ? "Box Truk & Pengaman" : "Kontainer & Segel"} (Sebelum Bongkar)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-800">
                    {form.arrival_type === "local" ? "No. Box Truk / Identitas Armada" : "No. Container"} <span className="text-rose-600 font-bold">*</span>
                  </Label>
                  {form.arrival_type === "local" && sheet?.truck_plate && (
                    <button
                      type="button"
                      onClick={() => update("container_no", `BOX-${sheet.truck_plate}`)}
                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                    >
                      Salin Nopol
                    </button>
                  )}
                </div>
                <Input
                  placeholder={form.arrival_type === "local" ? "Contoh: BOX-01 atau No. Polisi" : "Contoh: TCLU 123456-7"}
                  value={form.container_no}
                  onChange={(e) => update("container_no", form.arrival_type === "import" ? formatContainerNo(e.target.value) : e.target.value.toUpperCase())}
                  className="mt-1 font-mono uppercase text-xs"
                  data-testid="ba-modal-container-no"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">
                  {form.arrival_type === "local" ? "No. Segel Gembok / Tali Pengaman (Opsional)" : "No. Segel"}{" "}
                  <span className={form.arrival_type === "local" ? "text-slate-400 font-normal" : "text-rose-600 font-bold"}>
                    {form.arrival_type === "local" ? "(Bisa dikosongkan)" : "*"}
                  </span>
                </Label>
                <Input
                  placeholder={form.arrival_type === "local" ? "Contoh: SEGEL-123 / TANPA SEGEL" : "Contoh: SEAL-8899120"}
                  value={form.seal_no}
                  onChange={(e) => update("seal_no", e.target.value)}
                  className="mt-1 font-mono text-xs"
                  data-testid="ba-modal-seal-no"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Kondisi Segel / Pengaman</Label>
                <select
                  value={form.seal_condition}
                  onChange={(e) => update("seal_condition", e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Baik / Utuh">Baik / Utuh</option>
                  <option value="Rusak / Putus">Rusak / Putus</option>
                  <option value="Tidak Ada Segel">Tidak Ada Segel / Tanpa Segel</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Suhu Box / Kontainer (*)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="grid grid-cols-3 gap-1 flex-1">
                    {["Dry", "Chiller", "Frozen"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => update("container_temp_type", type)}
                        className={`py-1.5 text-xs font-semibold rounded border transition-all ${
                          form.container_temp_type === type
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <Input
                    placeholder="°C (misal: -20)"
                    value={form.temp_celsius}
                    onChange={(e) => update("temp_celsius", e.target.value)}
                    className="w-24 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Kondisi Fisik Kontainer (Sebelum & Sesudah Bongkar) */}
          <div className="rounded-xl border border-slate-200 p-3.5 space-y-3 bg-white">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b pb-2">
              2. Kondisi Fisik Armada / Kontainer (Sebelum & Sesudah Bongkar)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <Label className="text-[11px] text-slate-600 font-medium">Lantai (Sebelum Bongkar)</Label>
                <select
                  value={form.floor_before}
                  onChange={(e) => update("floor_before", e.target.value)}
                  className="mt-1 flex h-8 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  <option value="Rata, tidak ditemukan kebocoran, bersih, tidak berminyak">Rata, bersih, tidak bocor, tidak berminyak</option>
                  <option value="Tidak rata, rusak, ada bolong atau sobek, kotor, berminyak">Tidak rata, rusak, bolong, kotor, berminyak</option>
                </select>
              </div>

              <div>
                <Label className="text-[11px] text-slate-600 font-medium">Dinding (Sebelum Bongkar)</Label>
                <select
                  value={form.wall_before}
                  onChange={(e) => update("wall_before", e.target.value)}
                  className="mt-1 flex h-8 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  <option value="Tidak penyok, tidak baret, tidak bolong">Tidak penyok, tidak baret, tidak bolong</option>
                  <option value="Penyok, baret, bolong">Penyok, baret, bolong</option>
                </select>
              </div>

              <div>
                <Label className="text-[11px] text-slate-600 font-medium">Lantai (Setelah Bongkar)</Label>
                <select
                  value={form.floor_after}
                  onChange={(e) => update("floor_after", e.target.value)}
                  className="mt-1 flex h-8 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  <option value="Rata, tidak ditemukan kebocoran">Rata, tidak ditemukan kebocoran</option>
                  <option value="Tidak rata, rusak, ada bolong atau sobek">Tidak rata, rusak, ada bolong atau sobek</option>
                </select>
              </div>

              <div>
                <Label className="text-[11px] text-slate-600 font-medium">Dinding (Setelah Bongkar)</Label>
                <select
                  value={form.wall_after}
                  onChange={(e) => update("wall_after", e.target.value)}
                  className="mt-1 flex h-8 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  <option value="Tidak penyok, tidak baret, tidak bolong">Tidak penyok, tidak baret, tidak bolong</option>
                  <option value="Penyok, baret, bolong">Penyok, baret, bolong</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Kondisi Isi Barang */}
          <div className="rounded-xl border border-slate-200 p-3.5 space-y-3 bg-white">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b pb-2">
              3. Evaluasi Kondisi Fisik Barang
            </div>

            <div className="space-y-3 text-xs">
              {/* Point 1: Penyusunan barang */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">1. Penyusunan barang di dalam kontainer / truk:</span>
                  <div className="flex gap-3">
                    {["Baik", "Roboh"].map((val) => (
                      <label key={val} className="inline-flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                        <input
                          type="radio"
                          name="ba_cargo_arrangement"
                          value={val}
                          checked={form.cargo_arrangement === val}
                          onChange={(e) => update("cargo_arrangement", e.target.value)}
                          className="accent-blue-600"
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Input
                  placeholder="Catatan penyusunan (misal: Rapi di atas palet, tidak miring)"
                  value={form.cargo_arrangement_notes}
                  onChange={(e) => update("cargo_arrangement_notes", e.target.value)}
                  className="h-8 text-xs bg-slate-50/50"
                />
              </div>

              {/* Point 2: Fisik barang */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">2. Fisik kemasan & barang (tidak pecah/bocor):</span>
                  <div className="flex gap-3">
                    {[
                      { key: "Baik, tidak ditemukan pecah / bocor", label: "Baik" },
                      { key: "Pecah / bocor / rusak", label: "Rusak / Bocor" }
                    ].map((item) => (
                      <label key={item.key} className="inline-flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                        <input
                          type="radio"
                          name="ba_cargo_condition"
                          value={item.key}
                          checked={form.cargo_condition === item.key}
                          onChange={(e) => update("cargo_condition", e.target.value)}
                          className="accent-blue-600"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Input
                  placeholder="Catatan kondisi fisik (misal: Segel kemasan utuh, kering)"
                  value={form.cargo_condition_notes}
                  onChange={(e) => update("cargo_condition_notes", e.target.value)}
                  className="h-8 text-xs bg-slate-50/50"
                />
              </div>

              {/* Point 3: Kesesuaian kuantitas */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">3. Jumlah fisik barang sesuai dengan Packing List:</span>
                  <div className="flex gap-3">
                    {[
                      { key: "Sesuai dengan Packing List", label: "Sesuai" },
                      { key: "Terdapat Selisih", label: "Selisih" }
                    ].map((item) => (
                      <label key={item.key} className="inline-flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                        <input
                          type="radio"
                          name="ba_cargo_qty_match"
                          value={item.key}
                          checked={form.cargo_qty_match === item.key}
                          onChange={(e) => update("cargo_qty_match", e.target.value)}
                          className="accent-blue-600"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Input
                  placeholder="Catatan kuantitas fisik (misal: Hitungan fisik 100% cocok dengan PL)"
                  value={form.cargo_qty_notes}
                  onChange={(e) => update("cargo_qty_notes", e.target.value)}
                  className="h-8 text-xs bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          {/* Section: Driver & Lokasi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <Label className="text-[11px] font-semibold text-slate-700">Nama Driver Pengiriman (Ekspedisi)</Label>
              <Input
                placeholder="Nama supir truk pengantar"
                value={form.driver_name}
                onChange={(e) => update("driver_name", e.target.value)}
                className="mt-1 h-8 text-xs bg-white"
                data-testid="ba-modal-driver-name"
              />
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-slate-700">Lokasi Penerimaan (Plant)</Label>
              <Input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                className="mt-1 h-8 text-xs bg-white"
              />
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={busy}
              className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-xs"
              data-testid="ba-modal-submit-button"
            >
              {busy ? "Menyimpan..." : (sheet?.has_berita_acara ? "Simpan Perubahan BA" : "Lampirkan Berita Acara")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
