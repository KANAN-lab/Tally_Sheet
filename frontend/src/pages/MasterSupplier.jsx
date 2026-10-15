import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, FileSpreadsheet, Loader2, Search, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";

const LIMIT = 25;

export default function MasterSupplier() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/suppliers", { params: { q: applied, page, limit: LIMIT } })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, [applied, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(q.trim());
  };

  const handleClearSearch = () => {
    setQ("");
    setApplied("");
    setPage(1);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return toast.error("Silakan pilih file Excel Tcode MKVZ terlebih dahulu");
    }
    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploading(true);
    try {
      const res = await api.post("/suppliers/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(
        `Upload berhasil! ${res.data.inserted} supplier baru, ${res.data.updated} diperbarui (${res.data.total_rows} total baris)`
      );
      setUploadOpen(false);
      setSelectedFile(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid="master-supplier-page">
      <PageHeader
        title="Master Data Supplier"
        subtitle="Daftar vendor SAP (Tcode MKVZ) resmi untuk pencarian supplier pada tally sheet."
        actions={
          isAdmin && (
            <Button
              onClick={() => setUploadOpen(true)}
              className="bg-[#0B2149] hover:bg-[#13306a]"
              data-testid="supplier-upload-button"
            >
              <UploadCloud className="mr-1.5 h-4 w-4" /> Upload Excel MKVZ
            </Button>
          )
        }
      />

      {/* Info Card */}
      <div
        className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4"
        data-testid="supplier-stats-card"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600/10 grid place-items-center text-blue-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-[#0B2149]">
              {data.total.toLocaleString("id-ID")} Supplier Terdaftar
            </div>
            <div className="text-xs text-slate-600">
              Format kompatibel SAP Tcode MKVZ (Kolom: Supplier, Supplier Name, City, Purch. organization)
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Data tersimpan di database lokal & sinkron dengan Supabase
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 pr-9 bg-white"
              placeholder="Cari kode vendor atau nama supplier..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="supplier-search-input"
            />
            {q && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" className="bg-[#0B2149] hover:bg-[#13306a]" data-testid="supplier-search-submit">
            Cari
          </Button>
        </form>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border" data-testid="supplier-table">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3 w-16">No.</th>
                <th className="px-4 py-3 w-36">Kode Supplier</th>
                <th className="px-4 py-3">Nama Supplier</th>
                <th className="px-4 py-3">Kota</th>
                <th className="px-4 py-3">Negara / Region</th>
                <th className="px-4 py-3">Purch. Org</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-600 mb-1" />
                    Memuat data supplier...
                  </td>
                </tr>
              )}
              {!loading && data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500" data-testid="supplier-empty">
                    {applied ? "Supplier tidak ditemukan." : "Belum ada master supplier."}
                  </td>
                </tr>
              )}
              {!loading &&
                data.items.map((s, idx) => (
                  <tr key={s.id || s.code} className="hover:bg-slate-50/70 transition-colors" data-testid={`supplier-row-${s.code}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {(page - 1) * LIMIT + idx + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-900">
                      {s.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.city || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.country || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {s.purch_org || "-"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pager
          page={page}
          total={data.total}
          limit={LIMIT}
          onChange={setPage}
          testId="supplier-pager"
        />
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md" data-testid="supplier-upload-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-700" />
              Upload Master Supplier MKVZ
            </DialogTitle>
            <DialogDescription>
              Upload file Excel export SAP Tcode MKVZ (.xlsx atau .xls). Sistem akan otomatis memperbarui database supplier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50/60 hover:bg-blue-50/40 transition-colors"
            >
              <UploadCloud className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <div className="text-sm font-semibold text-slate-700">
                {selectedFile ? selectedFile.name : "Pilih file Excel MKVZ"}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                  : "Klik untuk memilih file dari komputer Anda"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                }}
              />
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <strong>Info:</strong> Kolom yang dideteksi otomatis meliputi <em>Supplier</em>, <em>Supplier Name</em>, <em>City</em>, <em>Country/Region Key</em>, dan <em>Purch. organization</em>.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Batal
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="bg-[#0B2149] hover:bg-[#13306a]"
              data-testid="supplier-upload-submit"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Mengunggah...
                </>
              ) : (
                "Proses Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
