import os
import json
import uuid
import datetime
import sqlite3
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path
import requests

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "tally_sheet.db"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jooffdovcomgyvvsftmf.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY", "")

# Determine storage mode: Supabase by default in production or when configured, SQLite locally
STORAGE_MODE = os.environ.get("STORAGE_MODE", "auto")

def get_supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

class SQLiteDB:
    @staticmethod
    def get_conn():
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def init():
        conn = SQLiteDB.get_conn()
        c = conn.cursor()
        c.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            is_pic INTEGER NOT NULL DEFAULT 1,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            id TEXT PRIMARY KEY,
            required_json TEXT NOT NULL,
            duplicate_rule TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            updated_by_name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS master_versions (
            id TEXT PRIMARY KEY,
            version INTEGER NOT NULL,
            filename TEXT NOT NULL,
            mode TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_by_name TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            total_rows INTEGER NOT NULL,
            valid_rows INTEGER NOT NULL,
            error_rows INTEGER NOT NULL,
            inserted INTEGER NOT NULL,
            updated INTEGER NOT NULL,
            deactivated INTEGER NOT NULL,
            active_total INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS materials (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            extra_json TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            version_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tally_sheets (
            id TEXT PRIMARY KEY,
            doc_no TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_by_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_by TEXT NOT NULL,
            updated_by_name TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            finalized_at TEXT,
            finalized_by TEXT,
            finalized_by_name TEXT,
            cancelled_at TEXT,
            cancelled_by TEXT,
            cancelled_by_name TEXT,
            cancel_reason TEXT
        );
        CREATE TABLE IF NOT EXISTS tally_items (
            id TEXT PRIMARY KEY,
            sheet_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            material_code TEXT NOT NULL,
            material_name TEXT NOT NULL,
            batch_fisik TEXT DEFAULT '',
            supplier_batch TEXT DEFAULT '',
            expired_date TEXT DEFAULT '',
            production_date TEXT DEFAULT '',
            pic_id TEXT DEFAULT '',
            pic_name TEXT DEFAULT '',
            FOREIGN KEY (sheet_id) REFERENCES tally_sheets(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS tally_history (
            id TEXT PRIMARY KEY,
            sheet_id TEXT NOT NULL,
            action TEXT NOT NULL,
            revision INTEGER NOT NULL,
            at TEXT NOT NULL,
            by_name TEXT NOT NULL,
            by_id TEXT NOT NULL,
            FOREIGN KEY (sheet_id) REFERENCES tally_sheets(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS activity_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            action TEXT NOT NULL,
            entity TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """)
        conn.commit()
        conn.close()

def is_supabase_ready() -> bool:
    """Check if Supabase tables exist and are accessible."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/users?select=id&limit=1"
        r = requests.get(url, headers=get_supabase_headers(), timeout=3)
        return r.status_code == 200
    except Exception:
        return False

# Initialize local SQLite if not exists
try:
    SQLiteDB.init()
except Exception as e:
    print("Notice: SQLite initialization warning:", e)
