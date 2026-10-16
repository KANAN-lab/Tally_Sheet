# Material Tally Hub - Status Task & Roadmap Pelaksanaan

Dokumen ini melacak status pengerjaan fitur, perbaikan bug, arsitektur sistem, dan langkah tindak lanjut operasional pada aplikasi **Material Tally Hub**.

---

## 📊 Ringkasan Status

| Kategori | Selesai | Dalam Proses / Pending | Total Item |
| :--- | :---: | :---: | :---: |
| **Alur Kerja & Bisnis Proses (Workflow)** | 6 | 0 | 6 |
| **UI/UX & Wizard Editor** | 7 | 0 | 7 |
| **Standar Dokumen QA & Berita Acara** | 4 | 0 | 4 |
| **Integrasi, Cloud Parity & Sinkronisasi Data** | 6 | 0 | 6 |
| **Manajemen Pengguna & Hak Akses** | 4 | 0 | 4 |
| **Tindakan User & Pengujian Live** | 0 | 2 | 2 |
| **Pengembangan Lanjutan (Backlog / Opsional)** | 1 | 2 | 3 |

---

## ✅ 1. Fitur & Perbaikan yang SUDAH Selesai

### A. Alur Bisnis 3-Tahap (Checker → Admin Warehouse → QC)
- [x] **Alur 3-Tahap Resmi**:
  1. **Checker**: Membuat draf tally sheet, mengisi nomor Surat Jalan, PO SAP, tanggal kedatangan, no polisi armada, serta mencatat hasil cek fisik material dan batch, kemudian meneruskan ke Admin Warehouse (`waiting_admin`).
  2. **Admin Warehouse**: Melakukan verifikasi fisik vs dokumen. Dapat menahan (`hold_admin` dengan alasan & kategori) atau meneruskan ke Quality Control (`waiting_qc`).
  3. **Quality Control (QC)**: Melakukan inspeksi mutu. Menyetujui sebagai *"Lolos Uji Mutu / Stock Ter-UU"* yang langsung menyelesaikan dokumen (`completed`) atau menahan/membatalkan (`hold_qc` / `cancelled`).
- [x] **Tanpa Input COA pada QC**: Sesuai instruksi bisnis terbaru, QC tidak perlu memasukkan nomor COA saat persetujuan.
- [x] **Status Khusus "Stock Ter-UU"**: Dokumen yang disetujui QC langsung berstatus selesai dan stok fisik ditandai resmi ter-UU.
- [x] **Audit Trail & Traceability**: Setiap perubahan status mencatat nama aktor, peran (role), tanggal/waktu, serta alasan penahanan (pending reason & category).

### B. UI/UX & Form Wizard
- [x] **Tally Editor Multi-Step Wizard**:
  - **Langkah 1**: Informasi Dokumen & Surat Jalan (Nomor SJ, Nomor PO SAP, Tanggal Kedatangan, No. Polisi Truk, Container ISO, Berita Acara).
  - **Langkah 2**: Input Item Material & Cek Fisik (Batch, Exp Date, Prod Date, Qty, UOM, Supplier).
  - **Langkah 3**: Review & Finalisasi / Simpan Draft / Kirim ke Admin.
- [x] **Pembersihan Header**:
  - Kolom *Supplier Vendor (MKVZ)* dan *Nama Supir / Ekspedisi* telah dihapus dari header formulir karena vendor/supplier sudah dicatat spesifik per baris material pada tabel.
- [x] **Konsolidasi Master Data Hub**:
  - Menu Master Data disatukan ke dalam satu halaman dengan tab navigasi: *Master Material*, *Master Supplier (MKVZ)*, *Pengaturan Sistem & User*.
- [x] **Filter Default "Hari Ini" (Today) pada Dashboard**:
  - Dashboard secara otomatis memfilter kedatangan material hari ini saat dibuka pertama kali untuk mencegah over-fetching data.
- [x] **SweetAlert2 (Modern Interactive Modal)**:
  - Menggantikan prompt native browser dengan modal pop-up SweetAlert2 bergaya Manrope/Slate untuk konfirmasi aksi dan input alasan penahanan/reject.
- [x] **Lazy Loading Skeleton**:
  - Komponen `Skeleton`, `TableSkeleton`, dan `DetailSkeleton` diimplementasikan pada Dashboard, Daftar Tally, dan Detail Dokumen untuk pengalaman navigasi yang mulus tanpa kedip layout.
- [x] **Perbaikan Seleksi Dropdown Kode Material**:
  - Memperbaiki signature pemanggilan `update(i, patch)` pada komponen `TallyRow` serta menambahkan defensive null check pada `Object.keys()` sehingga pemilihan item dari dropdown `MaterialSearch` dan `SupplierSearch` berjalan lancar tanpa error `TypeError: Cannot convert undefined or null to object`.
- [x] **Optimasi Layout Grid & Responsivitas Layar Mobile**:
  - Menghapus paksaan `min-w-[1280px]` pada layar kecil di Tally Editor; tabel otomatis menjadi mode Card terstruktur pada mobile (`< lg`) dan tabel lebar pada desktop.
  - Menambahkan tampilan responsif Mobile Cards pada `TallyDetail.jsx` dan `TallyTable.jsx` (Dashboard & Daftar Tally) sehingga data item material mudah dibaca di layar HP tanpa harus scroll horizontal 1000px.

### C. Arsitektur OOP & Konfigurasi Dinamis (Dynamic Configuration)
- [x] **Backend Domain Service**:
  - Kelas OOP `WorkflowManager` ([`domain.py`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/backend/domain.py)) mengontrol validasi transisi antar status, hak akses role, dan pembatasan alur.
  - Kelas OOP `SettingsService` ([`domain.py`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/backend/domain.py)) mengelola konfigurasi sistem, validasi pencegahan duplikasi, nomor dokumen kontrol QA, dan kategori penahanan dinamis.
- [x] **Frontend Workflow Service**:
  - Kelas OOP `WorkflowService` ([`WorkflowService.js`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/frontend/src/services/WorkflowService.js)) menangani mapping status, penanda langkah stepper, otorisasi aksi tombol berdasarkan peran pengguna yang sedang login.
- [x] **Dynamic Hold Categories & Master Registry**:
  - Kategori alasan pending (seperti *Dokumen Belum Lengkap*, *Kuantitas Selisih*, *Kualitas Kemasan Rusak*, dll.) dapat ditambah, dihapus, dan dikelola langsung melalui halaman *Pengaturan Administrator* tanpa mengubah source code.

### D. Standar Dokumen QA & Berita Acara (BA) Kedatangan Material
- [x] **Nomor Dokumen Resmi QA Terkontrol (Dynamic Master Registry)**:
  - Penomoran dokumen resmi QA terkontrol (misal: `SOP.WH-D.01` untuk Tally Sheet dan `SOP.WH-D.02` untuk Berita Acara) dikelola secara dinamis di halaman Pengaturan Administrator (`qa_tally_doc_no`, `qa_ba_doc_no`) dan tersimpan di database, bukan hardcoded.
  - Nomor dokumen resmi QA ditampilkan secara otomatis pada header cetak Tally Sheet, Berita Acara, dan lembar export audit.
- [x] **Mekanisme Berita Acara (BA) Fleksibel**:
  - Ditambahkan opsi toggle switch *"Perlu Berita Acara (BA) Ketidaksesuaian/Catatan Lapangan?"* pada Langkah 1 Tally Editor.
  - Membuka form kondisional untuk nomor BA, tanggal BA, dan rincian catatan deviasi fisik (barang basah, kemasan bocor, segel rusak, selisih kuantiti) hanya jika ada kejadian khusus di lapangan.
- [x] **Mandatory Nopol & Auto-Format Container ISO 6346**:
  - Field No. Polisi armada ditetapkan sebagai field wajib (`required / mandatory`).
  - Input No. Container menerapkan format standar internasional **ISO 6346** secara real-time (`AAAA 123456-7`: 4 huruf kode pemilik/tipe, 6 angka seri, 1 angka check digit).
- [x] **Fitur Cetak Berita Acara Resmi**:
  - Tombol aksi *"Cetak BA"* ditambahkan pada tabel daftar dokumen (`TallyTable.jsx`), kartu mobile, dan header dokumen detail (`TallyDetail.jsx`).
  - Tampilan cetak A4 Berita Acara khusus ([`TallyPrint.jsx`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/frontend/src/pages/TallyPrint.jsx)) lengkap dengan kop dokumen QA (`SOP.WH-D.02`), data armada, rincian kronologi, tabel barang terdampak, dan 3 kolom tanda tangan resmi (Checker, Driver/Ekspedisi, dan Ka. Gudang / QC).

### E. Integrasi, Cloud Parity & Sinkronisasi Supabase
- [x] **Sinkronisasi Riwayat Status & Audit Trail ke Supabase**:
  - Memperbaiki sinkronisasi riwayat audit status (`tally_history`) ke Supabase Cloud sehingga log jejak status (Checker, Admin Warehouse, QC) tetap tersimpan utuh dan tidak hilang menjadi 0 catatan saat instance serverless Vercel mengalami cold start.
  - Endpoint `GET /api/tallies/{id}/history` memprioritaskan pengambilan data dari tabel `tally_history` di Supabase Cloud PostgreSQL.
- [x] **Persistensi Pengaturan Administrator ke Supabase**:
  - Endpoint `GET /api/settings` dan `PUT /api/settings` tersinkronisasi dua arah ke tabel `settings` di Supabase. Perubahan nomor dokumen QA, kategori hold, dan konfigurasi lainnya tersimpan permanen di cloud database.
- [x] **Pembaruan Skema SQL Supabase (`supabase_schema.sql`)**:
  - Skema [`supabase_schema.sql`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/supabase_schema.sql) telah diperbarui secara menyeluruh mencakup:
    - Tabel `suppliers` lengkap (`purchasing_org`, `active`, `updated_at`).
    - Kolom `qa_tally_doc_no` dan `qa_ba_doc_no` pada tabel `settings`.
    - RLS Policies dengan klausul `WITH CHECK (true)` untuk operasi `INSERT` dan `UPDATE` guna mencegah penolakan permission.
    - Default seed data untuk akun pengguna, pengaturan sistem, dan master data awal.
- [x] **Perbaikan Transisi Status Supabase**:
  - Sinkronisasi transisi status menggunakan `PATCH /rest/v1/tally_sheets` untuk menjaga integritas data tanpa memicu pelanggaran constraint foreign key atau memutar balik status dokumen.
- [x] **Sinkronisasi Cache Serverless**:
  - Kolom header lengkap (`delivery_note_no`, `po_no`, `arrival_date`, `truck_plate`, `container_no`, `has_ba`, `ba_no`, `ba_date`, `ba_notes`, `current_handler_role`, dll.) tersinkronisasi otomatis saat inisialisasi serverless.

### F. Manajemen Pengguna & Pengendalian Hak Akses (RBAC Matrix)
- [x] **Manajemen Pengguna Terpadu (CRUD User + Supabase Cloud Sync)**:
  - Form dialog pendaftaran & edit akun dengan 5 Peran resmi: `checker` (Checker Gudang), `warehouse_admin` (Admin Warehouse), `qc` (Quality Control Inspector), `admin` (Super Administrator), dan `user` (Viewer/Staff).
  - Sinkronisasi instan dua arah (`INSERT`, `PATCH`, `DELETE`) ke tabel `public.users` di Supabase Cloud PostgreSQL sehingga akun yang dibuat/diedit tidak hilang saat serverless restart.
  - Fitur pencarian instan (nama/email), filter peran, filter status aktif, dan tombol hapus akun permanen dengan konfirmasi modal SweetAlert2.
- [x] **Matriks Otorisasi Hak Akses (Dynamic Role-Based Access Control)**:
  - Tab *"Matriks Otorisasi Hak Akses (RBAC)"* langsung di menu `/users` Administrator.
  - Memungkinkan Administrator mengendalikan izin 17 fitur sistem (Buat Tally, Edit Draf, Submit ke Admin, Verifikasi WH, Hold Dokumen, Approval QC, Cetak Dokumen, Export Excel, Master Data, dll.) secara interaktif via toggle switch per peran.
  - Backend OOP `PermissionService` dan frontend `WorkflowService` mengecek izin secara dinamis sebelum mengeksekusi setiap aksi atau transisi status.
  - Fitur *"Reset Default SOP"* untuk mengembalikan matriks otorisasi ke standar operasional pabrik.
  - Persistensi matriks perizinan ke kolom `role_permissions_json` di tabel `settings` Supabase Cloud.
- [x] **Akun Bawaan Sistem**:
  - **Checker**: `checker@tally.com` (Password: `Admin123!`)
  - **Admin Warehouse**: `warehouse@tally.com` (Password: `Admin123!`)
  - **Quality Control**: `qc@tally.com` (Password: `Admin123!`)
  - **Super Administrator**: `admin@tally.com` (Password: `Admin123!`)

---

## ⏳ 2. Tindakan yang PERLU Dilakukan (Action Items)

| No | Tindakan | Penanggung Jawab | Keterangan |
| :---: | :--- | :---: | :--- |
| **1** | **Jalankan SQL Migration di Supabase Cloud** | **User / Admin DB** | File [`supabase_schema.sql`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/supabase_schema.sql) telah diperbarui dengan kolom `role_permissions_json` pada tabel `settings`, skema tabel `suppliers`, kolom QA registry, dan RLS policies baru. Buka **Supabase Dashboard → SQL Editor**, paste isi file [`supabase_schema.sql`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/supabase_schema.sql), dan klik **Run**. |
| **2** | **Uji Coba Pengguna & Matriks Hak Akses** | **Tim QA / User** | Login di [tally-incoming.vercel.app](https://tally-incoming.vercel.app/) sebagai `admin@tally.com`, buka menu **Pengguna & Hak Akses**, uji coba pembuatan akun baru dengan role spesifik, lalu buka tab **Matriks Otorisasi Hak Akses (RBAC)** untuk menguji toggle izin fitur dan verifikasi penerapannya saat login sebagai akun terkait. |

---

## 🚀 3. Ide Pengembangan Mendatang (Backlog / Opsional)

Berikut adalah usulan fitur lanjutan yang dapat diaktifkan jika diperlukan oleh operasional lapangan:

- [x] **Menu Laporan & Export Rekapitulasi Audit ISO (.xlsx)**:
  - Menyediakan menu `/reports` ("Laporan & Audit") berstandar ISO 9001:2015 (Klausul 8.4, 8.6, 8.7) dan GMP.
  - Menghasilkan file Excel multi-sheet resmi:
    1. *Sheet 1: Ringkasan Audit ISO* (Metadata dokumen kontrol `FORM-WHS-ISO-008 Rev. 02`, KPI ringkasan, First-Pass Acceptance Rate, lembar pengesahan 3 tanda tangan).
    2. *Sheet 2: Detail Ketertelusuran Material* (21 kolom audit trail, formula sum kuantiti, auto-filter, zebra styling).
    3. *Sheet 3: Log Ketidaksesuaian & Status Hold* (Laporan penanganan deviasi ISO Clause 8.7).
- [ ] **Integrasi Notifikasi Real-time (Webhook / Email / WhatsApp)**:
  - Mengirim notifikasi otomatis ke Admin Warehouse saat Checker meneruskan draf baru, atau ke QC saat material siap uji mutu.
- [ ] **Barcode / QR Code Scanner**:
  - Dukungan pemindaian kamera HP / scanner barcode untuk membaca nomor Surat Jalan atau batch material secara instan di gudang.
