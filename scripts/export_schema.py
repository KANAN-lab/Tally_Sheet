import sqlite3
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "backend" / "tally_sheet.db"
OUTPUT_SQL = BASE_DIR / "supabase_schema.sql"

conn = sqlite3.connect(str(DB_PATH))
conn.row_factory = sqlite3.Row
c = conn.cursor()

out = []
out.append('-- ===============================================================')
out.append('-- TALLY SHEET - SUPABASE POSTGRESQL SCHEMA & SEED DATA')
out.append('-- Run this script directly in the Supabase SQL Editor')
out.append('-- Project: https://jooffdovcomgyvvsftmf.supabase.co')
out.append('-- ===============================================================\n')

# 1. USERS
out.append('''-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_pic INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
''')

# 2. SETTINGS
out.append('''-- 2. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY,
    required_json TEXT NOT NULL,
    duplicate_rule TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_by_name TEXT NOT NULL
);
''')

# 3. MASTER_VERSIONS
out.append('''-- 3. MASTER VERSIONS TABLE
CREATE TABLE IF NOT EXISTS public.master_versions (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    filename TEXT NOT NULL,
    mode TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_by_name TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    total_rows INTEGER NOT NULL,
    valid_rows INTEGER NOT NULL,
    error_rows INTEGER NOT NULL,
    inserted INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    deactivated INTEGER NOT NULL,
    active_total INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_master_versions_ver ON public.master_versions(version DESC);
''')

# 4. MATERIALS
out.append('''-- 4. MATERIALS TABLE
CREATE TABLE IF NOT EXISTS public.materials (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    extra_json TEXT NOT NULL DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1,
    version_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_materials_code ON public.materials(code);
CREATE INDEX IF NOT EXISTS idx_materials_name ON public.materials(name);
CREATE INDEX IF NOT EXISTS idx_materials_active ON public.materials(active);
''')

# 5. TALLY_SHEETS
out.append('''-- 5. TALLY SHEETS TABLE
CREATE TABLE IF NOT EXISTS public.tally_sheets (
    id TEXT PRIMARY KEY,
    doc_no TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by TEXT NOT NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_by TEXT NOT NULL,
    updated_by_name TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    finalized_at TIMESTAMPTZ,
    finalized_by TEXT,
    finalized_by_name TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT,
    cancelled_by_name TEXT,
    cancel_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_tally_sheets_doc_no ON public.tally_sheets(doc_no);
CREATE INDEX IF NOT EXISTS idx_tally_sheets_status ON public.tally_sheets(status);
CREATE INDEX IF NOT EXISTS idx_tally_sheets_created_at ON public.tally_sheets(created_at DESC);
''')

# 6. TALLY_ITEMS
out.append('''-- 6. TALLY ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.tally_items (
    id TEXT PRIMARY KEY,
    sheet_id TEXT NOT NULL REFERENCES public.tally_sheets(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    material_code TEXT NOT NULL,
    material_name TEXT NOT NULL,
    batch_fisik TEXT DEFAULT '',
    supplier_batch TEXT DEFAULT '',
    expired_date TEXT DEFAULT '',
    production_date TEXT DEFAULT '',
    pic_id TEXT DEFAULT '',
    pic_name TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_tally_items_sheet_id ON public.tally_items(sheet_id);
CREATE INDEX IF NOT EXISTS idx_tally_items_batch_fisik ON public.tally_items(batch_fisik);
''')

# 7. TALLY_HISTORY
out.append('''-- 7. TALLY HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.tally_history (
    id TEXT PRIMARY KEY,
    sheet_id TEXT NOT NULL REFERENCES public.tally_sheets(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    revision INTEGER NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    by_name TEXT NOT NULL,
    by_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tally_history_sheet_id ON public.tally_history(sheet_id);
''')

# 8. ACTIVITY_LOGS
out.append('''-- 8. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
''')

# RLS Policies
out.append('''-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tally_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tally_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tally_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Full access users" ON public.users;
CREATE POLICY "Full access users" ON public.users FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access settings" ON public.settings;
CREATE POLICY "Full access settings" ON public.settings FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access master_versions" ON public.master_versions;
CREATE POLICY "Full access master_versions" ON public.master_versions FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access materials" ON public.materials;
CREATE POLICY "Full access materials" ON public.materials FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access tally_sheets" ON public.tally_sheets;
CREATE POLICY "Full access tally_sheets" ON public.tally_sheets FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access tally_items" ON public.tally_items;
CREATE POLICY "Full access tally_items" ON public.tally_items FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access tally_history" ON public.tally_history;
CREATE POLICY "Full access tally_history" ON public.tally_history FOR ALL USING (true);

DROP POLICY IF EXISTS "Full access activity_logs" ON public.activity_logs;
CREATE POLICY "Full access activity_logs" ON public.activity_logs FOR ALL USING (true);
''')

# Seed users
out.append('-- 10. SEED DATA')
users = c.execute('SELECT * FROM users').fetchall()
for u in users:
    name_esc = u['name'].replace("'", "''")
    sql = f"""INSERT INTO public.users (id, email, name, password_hash, role, is_pic, active, created_at)
VALUES ('{u['id']}', '{u['email']}', '{name_esc}', '{u['password_hash']}', '{u['role']}', {u['is_pic']}, {u['active']}, '{u['created_at']}')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, password_hash = EXCLUDED.password_hash;"""
    out.append(sql)

# Seed settings
settings = c.execute('SELECT * FROM settings').fetchall()
for s in settings:
    req_json = s['required_json'].replace("'", "''")
    by_esc = s['updated_by_name'].replace("'", "''")
    sql = f"""INSERT INTO public.settings (id, required_json, duplicate_rule, updated_at, updated_by_name)
VALUES ('{s['id']}', '{req_json}', '{s['duplicate_rule']}', '{s['updated_at']}', '{by_esc}')
ON CONFLICT (id) DO UPDATE SET required_json = EXCLUDED.required_json;"""
    out.append(sql)

# Seed master_versions
versions = c.execute('SELECT * FROM master_versions').fetchall()
for v in versions:
    fn_esc = v['filename'].replace("'", "''")
    by_esc = v['uploaded_by_name'].replace("'", "''")
    sql = f"""INSERT INTO public.master_versions (id, version, filename, mode, uploaded_by, uploaded_by_name, uploaded_at, total_rows, valid_rows, error_rows, inserted, updated, deactivated, active_total)
VALUES ('{v['id']}', {v['version']}, '{fn_esc}', '{v['mode']}', '{v['uploaded_by']}', '{by_esc}', '{v['uploaded_at']}', {v['total_rows']}, {v['valid_rows']}, {v['error_rows']}, {v['inserted']}, {v['updated']}, {v['deactivated']}, {v['active_total']})
ON CONFLICT (id) DO NOTHING;"""
    out.append(sql)

# Seed materials in chunks
materials = c.execute('SELECT * FROM materials').fetchall()
if materials:
    out.append('\n-- SEED MATERIALS (981 ITEMS)')
    chunk_size = 50
    for i in range(0, len(materials), chunk_size):
        chunk = materials[i:i+chunk_size]
        vals = []
        for m in chunk:
            name_esc = m['name'].replace("'", "''")
            extra_esc = m['extra_json'].replace("'", "''")
            vals.append(f"('{m['id']}', '{m['code']}', '{name_esc}', '{extra_esc}', {m['active']}, '{m['version_id']}', '{m['created_at']}', '{m['updated_at']}')")
        sql = "INSERT INTO public.materials (id, code, name, extra_json, active, version_id, created_at, updated_at) VALUES\n" + ",\n".join(vals) + "\nON CONFLICT (id) DO NOTHING;"
        out.append(sql)

with open(OUTPUT_SQL, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print(f"SUCCESS: {OUTPUT_SQL} generated with {len(materials)} materials, {len(users)} users, {len(settings)} settings.")
