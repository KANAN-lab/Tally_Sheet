# Material Tally Hub - Status Task & Roadmap Pelaksanaan

Dokumen ini melacak status pengerjaan fitur, perbaikan bug, arsitektur sistem, dan langkah tindak lanjut operasional pada aplikasi **Material Tally Hub**.

---

## 📊 Ringkasan Status

| Kategori | Selesai | Dalam Proses / Pending | Total Item |
| :--- | :---: | :---: | :---: |
| **Alur Kerja & Bisnis Proses (Workflow)** | 6 | 0 | 6 |
| **UI/UX & Wizard Editor** | 6 | 0 | 6 |
| **Integrasi & Sinkronisasi Data** | 4 | 0 | 4 |
| **Manajemen Pengguna & Hak Akses** | 3 | 0 | 3 |
| **Tindakan User & Pengujian Live** | 0 | 2 | 2 |
| **Pengembangan Lanjutan (Opsional)** | 0 | 3 | 3 |

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
  - **Langkah 1**: Informasi Dokumen & Surat Jalan (Nomor SJ, Nomor PO SAP, Tanggal Kedatangan, No. Polisi Truk).
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
- [x] **Template Cetak A4 (Print Tally Sheet)**:
  - Menampilkan Nomor Surat Jalan (SJ), Nomor PO SAP, Nomor Polisi Armada Truk, status "SELESAI (STOCK TER-UU)", serta 3 kolom tanda tangan peran: *Checker (Pembuat)*, *Admin Warehouse (Verifikasi)*, dan *Quality Control (Disetujui / Stock UU)*.
- [x] **Perbaikan Seleksi Dropdown Kode Material**:
  - Memperbaiki signature pemanggilan `update(i, patch)` pada komponen `TallyRow` serta menambahkan defensive null check pada `Object.keys()` sehingga pemilihan item dari dropdown `MaterialSearch` dan `SupplierSearch` berjalan lancar tanpa error `TypeError: Cannot convert undefined or null to object`.

### C. Arsitektur OOP & Zero Hardcoding
- [x] **Backend Domain Service**:
  - Kelas OOP `WorkflowManager` (`backend/domain.py`) mengontrol validasi transisi antar status, hak akses role, dan pembatasan alur.
  - Kelas OOP `SettingsService` (`backend/domain.py`) mengelola konfigurasi sistem, validasi dilarang simpan ganda, dan kategori penahanan dinamis.
- [x] **Frontend Workflow Service**:
  - Kelas OOP `WorkflowService` (`frontend/src/services/WorkflowService.js`) menangani mapping status, penanda langkah stepper, otorisasi aksi tombol berdasarkan peran pengguna yang sedang login.
- [x] **Dynamic Hold Categories (Zero Hardcode)**:
  - Kategori alasan pending (seperti *Dokumen Belum Lengkap*, *Kuantitas Selisih*, *Kualitas Kemasan Rusak*, dll.) dapat ditambah, dihapus, dan dikelola langsung melalui halaman *Pengaturan Administrator* tanpa mengubah source code.

### D. Manajemen Data & Akun Awal (Demo Accounts)
- [x] **4 Akun Demo Bawaan Sistem**:
  - **Checker**: `checker@tally.com` (Password: `Admin123!`)
  - **Admin Warehouse**: `warehouse@tally.com` (Password: `Admin123!`)
  - **Quality Control**: `qc@tally.com` (Password: `Admin123!`)
  - **Super Administrator**: `admin@tally.com` (Password: `Admin123!`)
- [x] **Perbaikan Bug Serverless Supabase Sync**:
  - Menyelesaikan masalah *"Tally Tidak Ditemukan"* dan kolom header kosong pada Vercel dengan menyinkronkan seluruh kolom (`delivery_note_no`, `po_no`, `arrival_date`, `truck_plate`, `current_handler_role`, `qc_status`, dll.) dari Supabase PostgreSQL ke cache instance lokal.

---

## ⏳ 2. Tindakan yang PERLU Dilakukan (Action Items)

| No | Tindakan | Penanggung Jawab | Keterangan |
| :---: | :--- | :---: | :--- |
| **1** | **Jalankan SQL Migration di Supabase Cloud** | **User / Admin DB** | File [`supabase_schema.sql`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/supabase_schema.sql) telah diperbarui dengan kolom `hold_categories_json` dan data seed 4 akun pengguna baru. Silakan buka **Supabase Dashboard → SQL Editor** dan jalankan query tersebut untuk memastikan skema Cloud PostgreSQL sinkron 100%. |
| **2** | **Uji Coba Alur Penuh (End-to-End Live Testing)** | **Tim QA / User** | Login di [tally-incoming.vercel.app](https://tally-incoming.vercel.app/) menggunakan akun `checker@tally.com`, buat 1 Tally Sheet baru hingga tahap Review, kirim ke Admin Warehouse, login sebagai `warehouse@tally.com` untuk verifikasi, dan selesaikan dengan akun `qc@tally.com` hingga dokumen berstatus *"Selesai (Stock Ter-UU)"*. |

---

## 🚀 3. Ide Pengembangan Mendatang (Backlog / Opsional)

Berikut adalah usulan fitur lanjutan yang dapat diaktifkan jika diperlukan oleh operasional lapangan:

- [ ] **Export Rekapitulasi ke Excel (.xlsx)**:
  - Menghasilkan file Excel rekapitulasi penerimaan barang berkala (harian, mingguan, bulanan) lengkap dengan informasi batch dan vendor.
- [ ] **Integrasi Notifikasi Real-time (Webhook / Email / WhatsApp)**:
  - Mengirim notifikasi otomatis ke Admin Warehouse saat Checker meneruskan draf baru, atau ke QC saat material siap uji mutu.
- [ ] **Barcode / QR Code Scanner**:
  - Dukungan pemindaian kamera HP / scanner barcode untuk membaca nomor Surat Jalan atau batch material secara instan di gudang.
