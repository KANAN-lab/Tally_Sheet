# Material Tally Hub (Tally Sheet)

Sistem pencatatan dan verifikasi Tally Sheet material incoming dengan verifikasi batch fisik, supplier batch, tanggal kedaluwarsa, monitoring dashboard, manajemen master data versi, serta ekspor Excel berformat resmi.

---

## 🚀 Arsitektur Deployment

- **Frontend**: React 18 + Vite + Tailwind CSS + Radix UI (dideploy di **Vercel**: [tally-incoming.vercel.app](https://tally-incoming.vercel.app/))
- **Backend API**: Python FastAPI (berjalan secara serverless di Vercel Functions `/api` atau server lokal)
- **Database**: **Supabase** (PostgreSQL cloud di `https://jooffdovcomgyvvsftmf.supabase.co`) + fallback SQLite lokal
- **Repository**: [GitHub KANAN-lab/Tally_Sheet](https://github.com/KANAN-lab/Tally_Sheet.git)

---

## 🗄️ Langkah Setup Database Supabase

Untuk mengaktifkan database di Supabase:

1. Buka [Supabase Dashboard](https://supabase.com/dashboard/project/jooffdovcomgyvvsftmf).
2. Masuk ke menu **SQL Editor** di sidebar kiri.
3. Buka file [`supabase_schema.sql`](./supabase_schema.sql) dari repositori ini, salin seluruh isinya.
4. Tempel ke dalam SQL Editor dan klik tombol **Run**.
5. Script ini secara otomatis membuat:
   - 8 tabel lengkap: `users`, `settings`, `master_versions`, `materials`, `tally_sheets`, `tally_items`, `tally_history`, `activity_logs`
   - Indeks performa pencarian kode material dan nomor dokumen
   - Kebijakan keamanan Row Level Security (RLS)
   - Seed data 3 akun pengguna awal & pengaturan global
   - Seed data lengkap **981 Master Materials**!

---

## 🔑 Akun Default

Setelah database di-seed, gunakan akun berikut untuk masuk:

| Email | Password | Role | PIC |
| :--- | :--- | :--- | :--- |
| `admin@tally.com` | `Admin123!` | Administrator | Ya |
| `adeiksanr@gmail.com` | `Admin123!` | Administrator | Ya |
| `azes@tally.com` | `Admin123!` | User PIC | Ya |

---

## ☁️ Konfigurasi Environment Variables di Vercel

Di [Dashboard Vercel](https://vercel.com/) untuk project `tally-incoming`:
Buka **Settings > Environment Variables**, lalu tambahkan:

```env
SUPABASE_URL=https://jooffdovcomgyvvsftmf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_here
SUPABASE_ANON_KEY=your_supabase_anon_public_key_here
SECRET_KEY=tally_secret_key_production_grade_jwt_token
```

---

## 💻 Menjalankan Secara Lokal

### 1. Menjalankan Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Menjalankan Frontend:
```bash
cd frontend
npm install
npm run dev
```
Buka browser di `http://localhost:3000`.

---

## 📁 Struktur Proyek

```text
├── api/
│   ├── index.py              # Serverless API entrypoint untuk Vercel
│   └── requirements.txt      # Dependency Python runtime Vercel
├── backend/
│   ├── main.py               # Aplikasi FastAPI lengkap dengan logic bisnis
│   ├── db.py                 # Abstraksi koneksi database (Supabase / SQLite)
│   ├── requirements.txt      # Python dependencies
│   └── tally_sheet.db        # Database SQLite lokal (offline fallback)
├── frontend/
│   ├── src/                  # Komponen React, Halaman & Styles
│   ├── package.json          # Dependencies frontend
│   └── vite.config.js        # Konfigurasi build Vite
├── scripts/
│   ├── export_schema.py      # Generator schema SQL & seed
│   └── seed_supabase_api.py  # Script seeding via Supabase REST API
├── supabase_schema.sql       # Script SQL lengkap untuk Supabase SQL Editor
├── vercel.json               # Konfigurasi build & rewrite Vercel
└── README.md
```
