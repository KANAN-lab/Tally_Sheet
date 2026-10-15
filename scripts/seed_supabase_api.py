import os
import json
import sqlite3
import requests
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "backend" / "tally_sheet.db"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jooffdovcomgyvvsftmf.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY", "")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def seed_supabase():
    print(f"Connecting to Supabase at {SUPABASE_URL}...")
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # 1. Users
    users = [dict(r) for r in c.execute("SELECT * FROM users").fetchall()]
    print(f"Seeding {len(users)} users...")
    r = requests.post(f"{SUPABASE_URL}/rest/v1/users", headers=headers, json=users)
    if r.status_code in [200, 201]:
        print(" Users seeded successfully.")
    else:
        print(f" Users seed returned: {r.status_code} - {r.text}")

    # 2. Settings
    settings = [dict(r) for r in c.execute("SELECT * FROM settings").fetchall()]
    print(f"Seeding {len(settings)} settings...")
    r = requests.post(f"{SUPABASE_URL}/rest/v1/settings", headers=headers, json=settings)
    if r.status_code in [200, 201]:
        print(" Settings seeded successfully.")
    else:
        print(f" Settings seed returned: {r.status_code} - {r.text}")

    # 3. Master Versions
    versions = [dict(r) for r in c.execute("SELECT * FROM master_versions").fetchall()]
    if versions:
        print(f"Seeding {len(versions)} master versions...")
        r = requests.post(f"{SUPABASE_URL}/rest/v1/master_versions", headers=headers, json=versions)
        if r.status_code in [200, 201]:
            print(" Master versions seeded successfully.")
        else:
            print(f" Master versions seed returned: {r.status_code} - {r.text}")

    # 4. Materials
    materials = [dict(r) for r in c.execute("SELECT * FROM materials").fetchall()]
    print(f"Seeding {len(materials)} materials...")
    chunk_size = 100
    for i in range(0, len(materials), chunk_size):
        chunk = materials[i:i + chunk_size]
        r = requests.post(f"{SUPABASE_URL}/rest/v1/materials", headers=headers, json=chunk)
        if r.status_code in [200, 201]:
            print(f"   Materials {i + 1} - {min(i + chunk_size, len(materials))} seeded.")
        else:
            print(f"   Materials chunk error: {r.status_code} - {r.text}")

    print("Supabase API seed complete!")

if __name__ == "__main__":
    seed_supabase()
