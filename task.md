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
| **Perbaikan UI/UX Laporan & Audit** | 6 | 0 | 6 |
| **Keamanan & Keandalan Fungsional** | 5 | 0 | 5 |
| **Notification Management (In-App Supabase)** | 5 | 0 | 5 |
| **Tindakan User & Pengujian Live** | 0 | 2 | 2 |
| **Pengembangan Lanjutan (Backlog / Opsional)** | 2 | 0 | 2 |

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
| **1** | **Jalankan SQL Migration di Supabase Cloud** | **User / Admin DB** | File [`supabase_schema.sql`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/supabase_schema.sql) telah diperbarui dengan kolom `role_permissions_json` pada tabel `settings`, skema tabel `suppliers`, tabel staging `master_previews`, kolom QA registry, dan RLS policies baru. Buka **Supabase Dashboard → SQL Editor**, paste isi file [`supabase_schema.sql`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/supabase_schema.sql), dan klik **Run**. |
| **2** | **Uji Coba Pengguna & Matriks Hak Akses** | **Tim QA / User** | Login di [tally-incoming.vercel.app](https://tally-incoming.vercel.app/) sebagai `admin@tally.com`, buka menu **Pengguna & Hak Akses**, uji coba pembuatan akun baru dengan role spesifik, lalu buka tab **Matriks Otorisasi Hak Akses (RBAC)** untuk menguji toggle izin fitur dan verifikasi penerapannya saat login sebagai akun terkait. |

---

## 🛠️ 3. Paket Perbaikan UI/UX Halaman Laporan & Audit (`Reports.jsx`)

Daftar perbaikan berdasarkan hasil evaluasi UI/UX terkini:

- [x] **1. Active State & Visual Feedback Quick Preset**:
  - Menambahkan penanda visual aktif (`active state`) pada tombol Quick Preset (*Hari Ini*, *7 Hari Terakhir*, *Bulan Ini*, *Semua Periode*) agar pengguna langsung mengetahui rentang waktu yang sedang ditampilkan.
- [x] **2. Integrasi Filter Vendor & Tombol Clear Pencarian**:
  - Menambahkan input seleksi/pencarian Vendor/Supplier (`filters.supplier`) ke dalam filter bar yang sudah didukung oleh backend API.
  - Menambahkan tombol clear instan (`X`) di dalam kolom pencarian teks untuk memudahkan pengosongan input tanpa backspace manual.
  - Indikator status form filter: Tombol *"Terapkan Filter"* memberikan feedback visual jelas saat ada parameter filter yang diubah namun belum di-apply.
- [x] **3. KPI Cards Loading Skeleton & Harmonisasi Palet**:
  - Menambahkan skeleton shimmer loading pada nilai 4 kartu KPI saat `loading = true` agar sinkron dengan status loading tabel.
  - Menyelaraskan aksen warna kartu *Baris Material* dari indigo ke tema industrial Navy & Slate Blue (`#0B2149` / `blue-700`).
- [x] **4. Responsivitas Layar Mobile untuk Tab 2, 3, dan 4**:
  - Menambahkan mode Mobile Cards (`lg:hidden`) untuk:
    - **Tab 2: Evaluasi Kinerja Vendor (ISO 8.4)** (Kartu metrik acceptance rate, total SJ, total volume, dan badge grade).
    - **Tab 3: Log Ketidaksesuaian & Hold (ISO 8.7)** (Kartu deviasi kronologi, nomor Tally, Surat Jalan, kategori hold, dan PIC).
    - **Tab 4: Monitoring Umur Simpan (FEFO / GMP)** (Kartu umur simpan, sisa hari, persentase sisa, dan badge status keamanan pangan).
  - Memastikan seluruh laporan dapat dibaca optimal di perangkat tablet maupun smartphone gudang tanpa scroll horizontal.
- [x] **5. Optimasi Cetak Dokumen Ringkasan (`@media print`)**:
  - Menambahkan styling cetak `@media print` sehingga saat tombol *"Cetak Ringkasan"* ditekan, elemen non-dokumen (sidebar navigasi, topbar, filter bar, pagination, dan tombol aksi) disembunyikan secara bersih dan menghasilkan lembar audit siap cetak.
- [x] **6. Interaktivitas Klik No. Tally & Modal Pratinjau Cepat (Opsi A & Opsi B)**:
  - Membuka modal popup [`TallyQuickModal`](file:///d:/2.%20FILE%20MEETING/Dashboard/Tally%20Sheet/frontend/src/components/TallyQuickModal.jsx) saat No. Tally diklik di Tab 1 (Ketertelusuran), Tab 3 (Log Ketidaksesuaian), dan Tab 4 (Monitoring Umur Simpan).
  - Menampilkan ringkasan armada, PO, Surat Jalan, peringatan Berita Acara, pipeline alur 3-tahap, tabel material fisik, dan riwayat status tanpa reload atau mereset filter laporan.
  - Menyediakan tombol aksi fleksibel: *Buka Halaman Penuh* di tab baru (`/tally/:id`), *Cetak Tally Sheet*, *Cetak Berita Acara*, *Download Excel*, dan tombol salin nomor ke clipboard.
  - Menambahkan badge visual mini `BA` pada nomor Tally yang memiliki Berita Acara deviasi lapangan.

---

## 🛡️ 4. Paket Peningkatan Keamanan & Keandalan Fungsional

Daftar perbaikan berdasarkan evaluasi fungsional menyeluruh:

- [x] **1. Penutupan Celah Bypass Alur (`action: "final"`)**:
  - Menghapus logika legacy `action: "final"` dari handler pembuatan (`POST /api/tally-sheets`) dan pembaruan draf (`PUT /api/tally-sheets/{id}`).
  - Memastikan status dokumen hanya bisa menjadi `completed` (Stock Ter-UU) melalui endpoint transisi resmi QC (`qc_approve`) yang memvalidasi hak akses peran `qc`.
- [x] **2. Validasi Kuantitas Fisik Wajib Positif (`qty > 0`)**:
  - Menambahkan pengecekan pada fungsi `validate_items` bahwa setiap baris kedatangan material memiliki `qty > 0` saat dokumen diserahkan ke Admin (`submit_to_admin`).
  - Mencegah input kuantitas kosong, 0, atau bernilai negatif.
- [x] **3. Peringatan & Pencegahan Duplikasi Nomor Surat Jalan (`delivery_note_no`)**:
  - Menambahkan validasi pendeteksian duplikasi nomor Surat Jalan dari supplier yang sama pada tanggal kedatangan yang sama.
  - Memberikan pesan error penolakan jelas jika nomor Surat Jalan tersebut sudah pernah dibuat sebelumnya pada dokumen aktif untuk mencegah *double-receiving*.
- [x] **4. Keandalan Upload Master Material di Lingkungan Serverless (Stateless)**:
  - Menggantikan ketergantungan dictionary in-memory `previews_cache` di Python dengan penyimpanan staging database `master_previews` agar import file Excel master material tidak gagal saat worker Vercel berganti instance.
- [x] **5. Pencatatan Tindakan Korektif saat Un-Hold (Resolusi Penahanan Mutu & Dokumen)**:
  - Menyediakan pencatatan *Resolution Notes* (tindakan korektif / catatan penyelesaian) via prompt SweetAlert2 pada transisi melepaskan status Hold (`send_to_qc` setelah hold admin, atau `qc_approve` setelah hold QC) sehingga tercatat utuh dalam riwayat audit trail ISO dan membersihkan status pending aktif.
- [x] **6. Perbaikan Error 500 saat Pengiriman Ulang Dokumen Hasil Revisi (`return_to_checker`)**:
  - Mengonversi `sheet` (`sqlite3.Row`) menjadi dictionary murni di `update_tally_sheet` dan `export_tally_sheet` untuk mencegah `AttributeError: 'sqlite3.Row' object has no attribute 'get'`.
  - Mengizinkan status `returned_to_checker` di samping `draft` dan `admin_hold` pada verifikasi status dokumen di `PUT /api/tally-sheets/{id}`.
  - Membersihkan catatan kendala pending (`pending_category` dan `pending_reason`) saat Checker menyerahkan ulang dokumen ke Admin Warehouse (`new_status == "waiting_admin"`), sembari tetap menjaga rekaman audit trail revisi di `tally_history`.

---

## 🚀 5. Ide Pengembangan Mendatang (Backlog / Opsional)

Berikut adalah usulan fitur lanjutan yang dapat diaktifkan jika diperlukan oleh operasional lapangan:

- [x] **Menu Laporan & Export Rekapitulasi Audit ISO (.xlsx)**:
  - Menyediakan menu `/reports` ("Laporan & Audit") berstandar ISO 9001:2015 (Klausul 8.4, 8.6, 8.7) dan GMP.
  - Menghasilkan file Excel multi-sheet resmi:
    1. *Sheet 1: Ringkasan Audit ISO* (Metadata dokumen kontrol `FORM-WHS-ISO-008 Rev. 02`, KPI ringkasan, First-Pass Acceptance Rate, lembar pengesahan 3 tanda tangan).
    2. *Sheet 2: Detail Ketertelusuran Material* (21 kolom audit trail, formula sum kuantiti, auto-filter, zebra styling).
    3. *Sheet 3: Log Ketidaksesuaian & Status Hold* (Laporan penanganan deviasi ISO Clause 8.7).
- [x] **Integrasi Webhook Notifikasi Real-time Terintegrasi**:
  - [x] **1. Backend Dispatcher Service & Background Tasks**:
    - Service asynchronous non-blocking di `backend/main.py` menggunakan `requests` + `threading` (daemon thread) dengan timeout 4 detik.
    - Menghasilkan signature autentikasi `X-Tally-Signature` berbasis HMAC-SHA256, header event `X-Tally-Event`, ID unik pengiriman `X-Tally-Delivery`, dan timestamp `X-Tally-Timestamp`.
  - [x] **2. Pemicu Event Otomatis pada Workflow**:
    - Trigger `tally.submitted` saat Checker menyerahkan draf ke Admin Warehouse (`create_tally_sheet` & `update_tally_sheet`).
    - Trigger `tally.verified_to_qc` saat Admin Warehouse meneruskan dokumen ke QC (`transition_tally_sheet`).
    - Trigger `tally.held` saat dokumen ditahan oleh Admin atau QC dengan alasan & kategori hold (`transition_tally_sheet`).
    - Trigger `tally.unheld` saat dokumen dilepas dari hold dengan catatan tindakan korektif (`transition_tally_sheet`).
    - Trigger `tally.approved_stock_uu` saat QC meluluskan dokumen (Stock Ter-UU).
    - Trigger `tally.rejected` saat QC menolak mutu material.
    - Trigger `tally.returned_to_checker` saat dokumen dikembalikan ke Checker.
    - Trigger `tally.cancelled` saat dokumen dibatalkan oleh Super Admin (`cancel_tally_sheet`).
  - [x] **3. Endpoint Pengaturan & Uji Coba (Test Ping)**:
    - Endpoint `POST /api/settings/webhook/test` untuk simulasi ping ke URL target dan memberikan respon status HTTP serta latensi round-trip ms.
    - Kolom `webhook_config_json` pada tabel `settings` SQLite & Supabase Cloud (`supabase_schema.sql`).
  - [x] **4. Panel UI Konfigurasi Webhook di Halaman Pengaturan (`/settings`)**:
    - Komponen Card 5 interaktif: Switch toggle On/Off, input URL target, generator Secret Key acak 32-karakter, checklist 7 event alur kerja dengan badge alur & deskripsi, tombol test ping dengan visual latency status, dan penyimpanan terintegrasi.

---

## 🔔 6. Roadmap Pelaksanaan: Notification Management (In-App Supabase)

Rencana perancangan dan implementasi Notification Center in-app berbasis Supabase PostgreSQL & SQLite lokal:

- [x] **Fase 1: Skema Database Non-Destruktif & Sinkronisasi Cloud**
  - [x] Tambahkan DDL tabel `public.notifications` ke `supabase_schema.sql` dengan `CREATE TABLE IF NOT EXISTS` (aman untuk live data Supabase).
  - [x] Buat indeks performa `idx_notifications_lookup` pada kolom `(target_role, target_user_id, is_read, created_at DESC)`.
  - [x] Tambahkan auto-create tabel `notifications` pada inisialisasi SQLite lokal (`init_db` di `backend/main.py`).
  - [x] Sinkronisasi dual-write (SQLite lokal + Supabase REST API `/rest/v1/notifications`).

- [x] **Fase 2: Backend Service & Event Triggering**
  - [x] Buat kelas OOP / helper `NotificationService` di `backend/main.py` / `domain.py`.
  - [x] Pasang dispatch pemicu notifikasi otomatis pada setiap titik transisi status dokumen:
    - `tally.submitted`: Kirim ke `target_role: warehouse_admin`.
    - `tally.verified_to_qc`: Kirim ke `target_role: qc`.
    - `tally.held`: Kirim ke PIC pembuat dokumen (`created_by_id`) dan `target_role: warehouse_admin`.
    - `tally.unheld`: Kirim ke PIC pembuat dokumen dan `target_role: qc`.
    - `tally.approved_stock_uu`: Kirim notifikasi sukses ke PIC pembuat dokumen.
    - `tally.rejected`: Kirim notifikasi penolakan ke PIC pembuat dokumen dan `warehouse_admin`.
    - `tally.returned_to_checker`: Kirim notifikasi revisi ke PIC pembuat dokumen.

- [x] **Fase 3: REST API Endpoints Notifikasi**
  - [x] `GET /api/notifications/unread-count`: Endpoint super-ringan untuk mengecek jumlah badge unread (`< 5ms`).
  - [x] `GET /api/notifications`: Endpoint paginasi lazy-load daftar notifikasi relevan untuk user/role yang sedang login.
  - [x] `PATCH /api/notifications/{id}/read`: Menandai satu notifikasi telah dibaca (`is_read = 1`).
  - [x] `POST /api/notifications/mark-all-read`: Menandai semua notifikasi user/role sebagai telah dibaca.

- [x] **Fase 4: Frontend UI Topbar (Menggantikan `DraftBell`)**
  - [x] Ganti komponen `DraftBell` di `frontend/src/components/Topbar.jsx` menjadi `NotificationCenter`.
  - [x] Tampilkan badge counter merah dengan micro-indicator jika ada notifikasi unread.
  - [x] Popover interaktif dengan tabs ("Semua" dan "Belum Dibaca").
  - [x] Desain item notifikasi dengan ikon status warna (Kuning = Hold, Biru = Review, Hijau = Approved, Merah = Rejected).
  - [x] Format waktu relatif human-friendly (*"5 menit lalu"*, *"1 jam lalu"*).
  - [x] Deep link: Mengklik notifikasi langsung membawa user ke `/tally/:id` dan otomatis menandai notif sebagai *read*.
  - [x] Tombol *"Tandai Semua Dibaca"* di header popover.

- [x] **Fase 5: Optimasi Polling & Data Retention**
  - [x] Implementasi Smart Polling di frontend (interval 30–45 detik, otomatis pause saat tab browser tidak aktif / `document.hidden`).
  - [x] Mekanisme pembersihan berkala (Auto-purge notifikasi `is_read = 1` yang berumur > 30 hari).
  - [x] Pengujian menyeluruh (Unit/Build test & verifikasi end-to-end alur notifikasi antar-role).

---

## 🔄 7. Roadmap Pelaksanaan: Silent Lazy Sync & Concurrency Guard (Multi-User Safe)

Perancangan dan implementasi mekanisme sinkronisasi data latar belakang tanpa reload layar (*Silent Lazy State Reconciliation*) dan proteksi integritas multi-user saat membuka/memproses nomor Tally yang sama:

- [x] **Fase 1: Endpoint Sidik Jari Status Dokumen Super-Ringan (Backend)**
  - [x] Tambahkan endpoint ultra-ringan `GET /api/tally-sheets/{id}/version` yang hanya mengembalikan sidik jari dokumen:
    `{ "id": "...", "status": "...", "updated_at": "...", "updated_by_name": "...", "revision": ... }`.
  - [x] Respons super cepat (`< 5ms`) tanpa beban query JOIN items atau Supabase sync berlebih, sangat hemat resource serverless Vercel & kuota jaringan.

- [x] **Fase 2: Silent Background Synchronizer di Halaman Detail (`TallyDetail.jsx`)**
  - [x] Implementasikan interval pemeriksaan senyap (setiap 12 detik) di latar belakang halaman detail dokumen.
  - [x] Fitur hemat resource (*Smart Pause*): Otomatis jeda jika tab browser di-minimize atau tidak aktif (`document.hidden`).
  - [x] Perlindungan interaksi aktif (*Interaction Lock*): Otomatis jeda jika pengguna sedang membuka dialog modal (`cancelOpen`, `baModalOpen`, SweetAlert2) atau sedang memproses tombol.
  - [x] Jika terdeteksi perbedaan sidik jari `updated_at` atau status:
    - Jalankan pembaruan data di memori React State (`setSheet` dan `setHistory`) secara senyap tanpa refresh F5.
    - Pertahankan posisi scroll dan input aktif pengguna 100%.
    - Tampilkan notifikasi toast non-intrusif: *"ℹ️ Status dokumen diperbarui oleh [Nama Pengguna] menjadi [Status Baru]"*.

- [x] **Fase 3: Optimistic Concurrency Guard pada Mode Edit Fisik (`TallyEditor.jsx` / Edit)**
  - [x] Simpan snapshot `expected_updated_at` saat form edit pertama kali dibuka oleh Checker/Admin.
  - [x] Kirim parameter `expected_updated_at` pada payload `PUT /api/tally-sheets/{id}`.
  - [x] Jika di server `updated_at` sudah berubah (diedit oleh pengguna lain lebih dulu), tolak update (HTTP 409 Conflict) dan beri peringatan proteksi:
    *"Konflik Pengeditan: Dokumen ini telah diperbarui oleh [Nama Pengguna]. Harap muat ulang dokumen untuk meninjau data terbaru sebelum menyimpan."*

- [x] **Fase 4: Supabase Realtime Listener (Instant Sub-Detik Dual-Engine)**
  - [x] Tambahkan modul `frontend/src/lib/supabase.js` untuk inisialisasi dinamis client Supabase Realtime.
  - [x] Tambahkan subscription WebSocket Supabase channel `postgres_changes` untuk tabel `tally_sheets` di `TallyDetail.jsx`.
  - [x] Tambahkan subscription WebSocket Supabase channel `postgres_changes` untuk tabel `notifications` di `Topbar.jsx`.
  - [x] Tambahkan publikasi realtime aman `tally_sheets` dan `notifications` di `supabase_schema.sql`.
  - [x] Pasang mekanisme unmount cleanup (`channel.unsubscribe()`) agar tidak menguras kuota koneksi free-tier Supabase.

- [x] **Fase 5: Verifikasi & Uji Simulasi Multi-User Concurrency**
  - [x] Uji endpoint `GET /api/tally-sheets/{id}/version` menghasilkan sidik jari valid dalam < 10ms.
  - [x] Uji otomatis `PUT /api/tally-sheets/{id}` dengan timestamp kedaluwarsa berhasil dicegat dengan status HTTP 409 Conflict.
  - [x] Validasi build frontend Vite lolos kompilasi (0 error).
  - [x] Validasi sintaks backend Python lolos kompilasi (0 error).


