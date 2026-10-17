import os
import io
import json
import uuid
import sqlite3
import hashlib
import hmac
import time
import threading
import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import jwt
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

import requests

try:
    from domain import (
        WorkflowManager, SettingsService, DEFAULT_HOLD_CATEGORIES, DEFAULT_WORKFLOW_STAGES,
        QADocumentRegistry, BeritaAcaraRecord, DEFAULT_QA_DOCUMENTS,
        ROLE_METADATA, PERMISSION_DEFINITIONS, DEFAULT_ROLE_PERMISSIONS, PermissionService,
        DEFAULT_WEBHOOK_CONFIG
    )
except ImportError:
    from backend.domain import (
        WorkflowManager, SettingsService, DEFAULT_HOLD_CATEGORIES, DEFAULT_WORKFLOW_STAGES,
        QADocumentRegistry, BeritaAcaraRecord, DEFAULT_QA_DOCUMENTS,
        ROLE_METADATA, PERMISSION_DEFINITIONS, DEFAULT_ROLE_PERMISSIONS, PermissionService,
        DEFAULT_WEBHOOK_CONFIG
    )

# Constants
SECRET_KEY = os.environ.get("SECRET_KEY", "tally_secret_key_production_grade_jwt_token")
ALGORITHM = "HS256"

# Supabase Cloud Configuration (Persistent storage across serverless lambdas)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jooffdovcomgyvvsftmf.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvb2ZmZG92Y29tZ3l2dnNmdG1mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjAzMzY4NCwiZXhwIjoyMTA3NjA5Njg0fQ.nq3i0vE-oGJv06i9OGkB8vsTUjVvvmV-1r8FGUOsvk0")

def get_sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

def sync_tally_to_supabase(sheet_row: dict, items: list = None, history_row: dict = None, is_new: bool = False):
    if not SUPABASE_KEY or not SUPABASE_URL:
        return
    try:
        sheet_id = sheet_row.get("id")
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        
        if is_new:
            # Full insert for brand new tally sheet
            r = requests.post(
                f"{SUPABASE_URL}/rest/v1/tally_sheets",
                headers={**headers, "Prefer": "resolution=merge-duplicates"},
                json=[sheet_row],
                timeout=4
            )
            if r.status_code >= 400:
                print(f"Notice: Supabase POST sheet error {r.status_code}: {r.text}")
        else:
            # UPDATE existing sheet via PATCH (prevents null constraint violation on created_by/created_at)
            patch_data = {k: v for k, v in sheet_row.items() if k != "id"}
            r = requests.patch(
                f"{SUPABASE_URL}/rest/v1/tally_sheets?id=eq.{sheet_id}",
                headers=headers,
                json=patch_data,
                timeout=4
            )
            if r.status_code >= 400:
                print(f"Notice: Supabase PATCH sheet error {r.status_code}: {r.text}")

        if items is not None and sheet_id:
            requests.delete(f"{SUPABASE_URL}/rest/v1/tally_items?sheet_id=eq.{sheet_id}", headers=headers, timeout=4)
            if items:
                requests.post(f"{SUPABASE_URL}/rest/v1/tally_items", headers=headers, json=items, timeout=4)
        if history_row:
            requests.post(f"{SUPABASE_URL}/rest/v1/tally_history", headers=headers, json=[history_row], timeout=4)
    except Exception as e:
        print("Notice: Supabase push warning:", e)

def sync_notification_to_supabase(notif_row: dict):
    if not SUPABASE_KEY or not SUPABASE_URL:
        return
    try:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        requests.post(f"{SUPABASE_URL}/rest/v1/notifications", headers=headers, json=[notif_row], timeout=3)
    except Exception as e:
        print("Notice: Supabase notification push warning:", e)

def sync_notification_read_to_supabase(notif_id: str = None, user_id: str = None, target_role: str = None):
    if not SUPABASE_KEY or not SUPABASE_URL:
        return
    try:
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        if notif_id:
            requests.patch(f"{SUPABASE_URL}/rest/v1/notifications?id=eq.{notif_id}", headers=headers, json={"is_read": 1}, timeout=3)
        elif user_id or target_role:
            query = []
            if user_id:
                query.append(f"target_user_id=eq.{user_id}")
            if target_role:
                query.append(f"target_role=eq.{target_role}")
            q_str = "&".join(query)
            requests.patch(f"{SUPABASE_URL}/rest/v1/notifications?{q_str}", headers=headers, json={"is_read": 1}, timeout=3)
    except Exception as e:
        print("Notice: Supabase notification read sync warning:", e)

def sync_from_supabase_if_needed(conn, sheet_id: str = None):
    if not SUPABASE_KEY or not SUPABASE_URL:
        return
    try:
        # Sync active global settings from Supabase so serverless instance has latest QA docs & permissions
        try:
            r_set = requests.get(f"{SUPABASE_URL}/rest/v1/settings?id=eq.global", headers=get_sb_headers(), timeout=3)
            if r_set.status_code == 200 and r_set.json():
                s_data = r_set.json()[0]
                conn.execute("""
                    INSERT OR REPLACE INTO settings (id, required_json, duplicate_rule, hold_categories_json, qa_documents_json, role_permissions_json, webhook_config_json, updated_at, updated_by_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    "global",
                    s_data.get("required_json") or "{}",
                    s_data.get("duplicate_rule") or "within_document",
                    s_data.get("hold_categories_json") or "[]",
                    s_data.get("qa_documents_json") or "{}",
                    s_data.get("role_permissions_json") or "{}",
                    s_data.get("webhook_config_json") or "{}",
                    s_data.get("updated_at") or "",
                    s_data.get("updated_by_name") or ""
                ))
                conn.commit()
        except Exception:
            pass

        url = f"{SUPABASE_URL}/rest/v1/tally_sheets?select=*,tally_items(*)"
        if sheet_id:
            url += f"&or=(id.eq.{sheet_id},doc_no.eq.{sheet_id})"
        else:
            url += "&order=created_at.desc&limit=100"
        r = requests.get(url, headers=get_sb_headers(), timeout=4)
        if r.status_code == 200:
            sheets = r.json()
            for s in sheets:
                raw_status = s.get("status") or "draft"
                clean_status = "waiting_admin" if raw_status == "waiting_admin_1" else raw_status
                items = s.get("tally_items") or []
                raw_sup_name = (s.get("supplier_name") or "").strip()
                raw_sup_code = (s.get("supplier_code") or "").strip()
                if not raw_sup_name and items:
                    val_sups = [it.get("supplier_name", "").strip() for it in items if (it.get("supplier_name") or "").strip()]
                    if val_sups:
                        raw_sup_name = ", ".join(dict.fromkeys(val_sups))
                if not raw_sup_code and items:
                    val_codes = [it.get("supplier_code", "").strip() for it in items if (it.get("supplier_code") or "").strip()]
                    if val_codes:
                        raw_sup_code = ", ".join(dict.fromkeys(val_codes))

                if not (s.get("supplier_name") or "").strip() and raw_sup_name:
                    try:
                        requests.patch(
                            f"{SUPABASE_URL}/rest/v1/tally_sheets?id=eq.{s['id']}",
                            headers=get_sb_headers(),
                            json={"supplier_name": raw_sup_name, "supplier_code": raw_sup_code},
                            timeout=2
                        )
                    except Exception:
                        pass

                exists = conn.execute("SELECT id FROM tally_sheets WHERE id = ?", (s["id"],)).fetchone()
                if not exists:
                    conn.execute("""
                        INSERT INTO tally_sheets 
                        (id, doc_no, status, created_by, created_by_name, created_at, updated_by, updated_by_name, updated_at,
                         finalized_at, finalized_by, finalized_by_name, cancelled_at, cancelled_by, cancelled_by_name, cancel_reason,
                         delivery_note_no, po_no, supplier_code, supplier_name, arrival_date, driver_name, truck_plate,
                         current_handler_role, current_handler_name, pending_reason, pending_category, qc_status, qc_notes, qc_by_name, qc_at,
                         qa_doc_no, has_berita_acara, ba_qa_doc_no, ba_data_json, ba_container_no, ba_seal_no, ba_seal_condition, ba_container_temp)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        s["id"], s["doc_no"], clean_status, s["created_by"], s["created_by_name"],
                        s["created_at"], s["updated_by"], s["updated_by_name"], s["updated_at"],
                        s.get("finalized_at"), s.get("finalized_by"), s.get("finalized_by_name"),
                        s.get("cancelled_at"), s.get("cancelled_by"), s.get("cancelled_by_name"),
                        s.get("cancel_reason"),
                        s.get("delivery_note_no", ""), s.get("po_no", ""), raw_sup_code, raw_sup_name,
                        s.get("arrival_date", ""), s.get("driver_name", ""), s.get("truck_plate", ""),
                        s.get("current_handler_role", "admin"), s.get("current_handler_name", ""),
                        s.get("pending_reason", ""), s.get("pending_category", ""),
                        s.get("qc_status", ""), s.get("qc_notes", ""), s.get("qc_by_name", ""), s.get("qc_at"),
                        QADocumentRegistry.resolve_tally_code(s.get("qa_doc_no"), conn), 1 if s.get("has_berita_acara") else 0,
                        QADocumentRegistry.resolve_ba_code(s.get("ba_qa_doc_no"), conn), s.get("ba_data_json", "{}"),
                        s.get("ba_container_no", ""), s.get("ba_seal_no", ""),
                        s.get("ba_seal_condition", ""), s.get("ba_container_temp", "")
                    ))
                else:
                    conn.execute("""
                        UPDATE tally_sheets 
                        SET status = ?, updated_by = ?, updated_by_name = ?, updated_at = ?,
                            finalized_at = ?, finalized_by = ?, finalized_by_name = ?,
                            cancelled_at = ?, cancelled_by = ?, cancelled_by_name = ?, cancel_reason = ?,
                            delivery_note_no = ?, po_no = ?, supplier_code = ?, supplier_name = ?,
                            arrival_date = ?, driver_name = ?, truck_plate = ?,
                            current_handler_role = ?, current_handler_name = ?,
                            pending_reason = ?, pending_category = ?, qc_status = ?, qc_notes = ?, qc_by_name = ?, qc_at = ?,
                            qa_doc_no = ?, has_berita_acara = ?, ba_qa_doc_no = ?, ba_data_json = ?,
                            ba_container_no = ?, ba_seal_no = ?, ba_seal_condition = ?, ba_container_temp = ?
                        WHERE id = ?
                    """, (
                        clean_status, s["updated_by"], s["updated_by_name"], s["updated_at"],
                        s.get("finalized_at"), s.get("finalized_by"), s.get("finalized_by_name"),
                        s.get("cancelled_at"), s.get("cancelled_by"), s.get("cancelled_by_name"),
                        s.get("cancel_reason"),
                        s.get("delivery_note_no", ""), s.get("po_no", ""), raw_sup_code, raw_sup_name,
                        s.get("arrival_date", ""), s.get("driver_name", ""), s.get("truck_plate", ""),
                        s.get("current_handler_role", "admin"), s.get("current_handler_name", ""),
                        s.get("pending_reason", ""), s.get("pending_category", ""),
                        s.get("qc_status", ""), s.get("qc_notes", ""), s.get("qc_by_name", ""), s.get("qc_at"),
                        QADocumentRegistry.resolve_tally_code(s.get("qa_doc_no"), conn), 1 if s.get("has_berita_acara") else 0,
                        QADocumentRegistry.resolve_ba_code(s.get("ba_qa_doc_no"), conn), s.get("ba_data_json", "{}"),
                        s.get("ba_container_no", ""), s.get("ba_seal_no", ""),
                        s.get("ba_seal_condition", ""), s.get("ba_container_temp", ""),
                        s["id"]
                    ))

                items = s.get("tally_items") or []
                if items:
                    conn.execute("DELETE FROM tally_items WHERE sheet_id = ?", (s["id"],))
                    for it in items:
                        conn.execute("""
                            INSERT INTO tally_items 
                            (id, sheet_id, seq, material_code, material_name, uom, qty, supplier_code, supplier_name,
                             batch_fisik, supplier_batch, expired_date, production_date, pic_id, pic_name)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            it["id"], it["sheet_id"], it["seq"], it["material_code"], it["material_name"],
                            it.get("uom", ""), float(it.get("qty") or 0), it.get("supplier_code", ""), it.get("supplier_name", ""),
                            it.get("batch_fisik", ""), it.get("supplier_batch", ""), it.get("expired_date", ""),
                            it.get("production_date", ""), it.get("pic_id", ""), it.get("pic_name", "")
                        ))

            # If specific sheet requested, also sync its tally_history from Supabase
            if sheet_id:
                try:
                    target_id = sheets[0]["id"] if sheets else sheet_id
                    r_hist = requests.get(
                        f"{SUPABASE_URL}/rest/v1/tally_history?sheet_id=eq.{target_id}&order=revision.asc",
                        headers=get_sb_headers(),
                        timeout=4
                    )
                    if r_hist.status_code == 200:
                        for h in r_hist.json():
                            conn.execute("""
                                INSERT OR REPLACE INTO tally_history 
                                (id, sheet_id, action, revision, at, by_name, by_id, by_role, from_status, to_status, category, reason)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                h["id"], h["sheet_id"], h["action"], h.get("revision", 1), h["at"],
                                h.get("by_name", ""), h.get("by_id", ""), h.get("by_role", "user"),
                                h.get("from_status", ""), h.get("to_status", ""), h.get("category", ""), h.get("reason", "")
                            ))
                except Exception as e_hist:
                    print("Notice: Supabase pull history warning:", e_hist)
            if not sheet_id:
                try:
                    r_u = requests.get(f"{SUPABASE_URL}/rest/v1/users", headers=get_sb_headers(), timeout=4)
                    if r_u.status_code == 200 and r_u.json():
                        for u in r_u.json():
                            conn.execute("""
                                INSERT OR REPLACE INTO users (id, email, name, password_hash, role, is_pic, active, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                u["id"], u["email"], u["name"], u["password_hash"], u.get("role", "user"),
                                u.get("is_pic", 1), u.get("active", 1), u.get("created_at")
                            ))
                except Exception as e_u:
                    print("Notice: Supabase pull users warning:", e_u)

            conn.commit()
    except Exception as e:
        print("Notice: Supabase pull warning:", e)

# Ensure serverless environments (Vercel / Lambda) use writable /tmp
DB_ORIGIN = Path(__file__).resolve().parent / "tally_sheet.db"
if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    import shutil
    DB_PATH = Path("/tmp/tally_sheet.db")
    if not DB_PATH.exists() and DB_ORIGIN.exists():
        try:
            shutil.copy2(DB_ORIGIN, DB_PATH)
        except Exception as e:
            print("Notice: could not copy DB to /tmp:", e)
else:
    DB_PATH = DB_ORIGIN

SEED_FILE = Path(__file__).resolve().parent / "seed_materials.json"
LOGO_PATH = Path(__file__).resolve().parent / "logo.png"
if not LOGO_PATH.exists():
    LOGO_PATH = Path(__file__).resolve().parent.parent / "frontend" / "public" / "logo.png"

# Helpers for Password & Auth
def hash_password(password: str) -> str:
    salt = "tally_salt_"
    return hashlib.sha256((salt + password).encode('utf-8')).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_jwt(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

# Database Initialization
def init_db():
    conn = get_db()
    c = conn.cursor()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
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
        status TEXT NOT NULL, -- draft, final, cancelled
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

    CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        city TEXT DEFAULT '',
        country TEXT DEFAULT '',
        postal_code TEXT DEFAULT '',
        purchasing_org TEXT DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tally_items (
        id TEXT PRIMARY KEY,
        sheet_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        material_code TEXT NOT NULL,
        material_name TEXT NOT NULL,
        uom TEXT DEFAULT '',
        qty REAL DEFAULT 0,
        supplier_code TEXT DEFAULT '',
        supplier_name TEXT DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        target_role TEXT DEFAULT '',
        target_user_id TEXT DEFAULT '',
        doc_id TEXT DEFAULT '',
        doc_no TEXT DEFAULT '',
        category TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        action_url TEXT DEFAULT '',
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_lookup ON notifications(target_role, target_user_id, is_read, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
    """)

    # Ensure columns exist in tally_items
    try:
        cols = [col[1] for col in c.execute("PRAGMA table_info(tally_items)").fetchall()]
        for col_name, col_type in [("uom", "TEXT DEFAULT ''"), ("qty", "REAL DEFAULT 0"), ("supplier_code", "TEXT DEFAULT ''"), ("supplier_name", "TEXT DEFAULT ''")]:
            if col_name not in cols:
                c.execute(f"ALTER TABLE tally_items ADD COLUMN {col_name} {col_type}")
    except Exception as e:
        print("Notice: check tally_items columns:", e)

    # Ensure columns exist in tally_sheets (Header & Workflow Traceability)
    try:
        sheet_cols = [col[1] for col in c.execute("PRAGMA table_info(tally_sheets)").fetchall()]
        new_sheet_cols = [
            ("delivery_note_no", "TEXT DEFAULT ''"),
            ("po_no", "TEXT DEFAULT ''"),
            ("supplier_code", "TEXT DEFAULT ''"),
            ("supplier_name", "TEXT DEFAULT ''"),
            ("arrival_date", "TEXT DEFAULT ''"),
            ("driver_name", "TEXT DEFAULT ''"),
            ("truck_plate", "TEXT DEFAULT ''"),
            ("current_handler_role", "TEXT DEFAULT 'checker'"),
            ("current_handler_name", "TEXT DEFAULT ''"),
            ("pending_reason", "TEXT DEFAULT ''"),
            ("pending_category", "TEXT DEFAULT ''"),
            ("qc_status", "TEXT DEFAULT ''"),
            ("qc_notes", "TEXT DEFAULT ''"),
            ("qc_by_name", "TEXT DEFAULT ''"),
            ("qc_by_id", "TEXT DEFAULT ''"),
            ("qc_at", "TEXT DEFAULT ''"),
            ("gr_no", "TEXT DEFAULT ''"),
            ("gr_by_name", "TEXT DEFAULT ''"),
            ("gr_by_id", "TEXT DEFAULT ''"),
            ("gr_at", "TEXT DEFAULT ''"),
            ("gr_notes", "TEXT DEFAULT ''"),
            ("qa_doc_no", "TEXT DEFAULT ''"),
            ("has_berita_acara", "INTEGER DEFAULT 0"),
            ("ba_qa_doc_no", "TEXT DEFAULT ''"),
            ("ba_data_json", "TEXT DEFAULT '{}'"),
            ("ba_container_no", "TEXT DEFAULT ''"),
            ("ba_seal_no", "TEXT DEFAULT ''"),
            ("ba_seal_condition", "TEXT DEFAULT ''"),
            ("ba_container_temp", "TEXT DEFAULT ''"),
        ]
        for col_name, col_type in new_sheet_cols:
            if col_name not in sheet_cols:
                c.execute(f"ALTER TABLE tally_sheets ADD COLUMN {col_name} {col_type}")
    except Exception as e:
        print("Notice: check tally_sheets columns:", e)

    # Ensure columns exist in tally_history (Traceability details)
    try:
        hist_cols = [col[1] for col in c.execute("PRAGMA table_info(tally_history)").fetchall()]
        new_hist_cols = [
            ("from_status", "TEXT DEFAULT ''"),
            ("to_status", "TEXT DEFAULT ''"),
            ("category", "TEXT DEFAULT ''"),
            ("reason", "TEXT DEFAULT ''"),
            ("by_role", "TEXT DEFAULT ''"),
        ]
        for col_name, col_type in new_hist_cols:
            if col_name not in hist_cols:
                c.execute(f"ALTER TABLE tally_history ADD COLUMN {col_name} {col_type}")
    except Exception as e:
        print("Notice: check tally_history columns:", e)

    # Seed Suppliers from Master Data if empty
    SUPPLIER_FILE = Path(__file__).resolve().parent.parent / "Master Data" / "Tcode MKVZ.XLSX"
    try:
        cur = c.execute("SELECT count(*) FROM suppliers")
        if cur.fetchone()[0] == 0 and SUPPLIER_FILE.exists():
            df_sup = pd.read_excel(SUPPLIER_FILE)
            seen_sup = set()
            to_ins = []
            for _, row in df_sup.iterrows():
                code = str(row.get('Supplier', '')).strip()
                name = str(row.get('Supplier Name', '')).strip()
                if not code or not name or code == 'nan' or name == 'nan':
                    continue
                if code in seen_sup:
                    continue
                seen_sup.add(code)
                city = str(row.get('City', '')).strip() if pd.notna(row.get('City')) else ''
                country = str(row.get('Country/Region Key', '')).strip() if pd.notna(row.get('Country/Region Key')) else ''
                postal = str(row.get('Postal Code', '')).strip() if pd.notna(row.get('Postal Code')) else ''
                p_org = str(row.get('Purch. organization', '')).strip() if pd.notna(row.get('Purch. organization')) else ''
                to_ins.append((str(uuid.uuid4()), code, name, city, country, postal, p_org, 1, now, now))
            if to_ins:
                c.executemany("""
                    INSERT OR REPLACE INTO suppliers (id, code, name, city, country, postal_code, purchasing_org, active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, to_ins)
    except Exception as e:
        print("Notice: Error loading seed suppliers:", e)

    # Ensure columns exist in settings
    try:
        set_cols = [col[1] for col in c.execute("PRAGMA table_info(settings)").fetchall()]
        if "hold_categories_json" not in set_cols:
            c.execute("ALTER TABLE settings ADD COLUMN hold_categories_json TEXT DEFAULT '[]'")
        if "qa_documents_json" not in set_cols:
            c.execute("ALTER TABLE settings ADD COLUMN qa_documents_json TEXT DEFAULT '{}'")
        if "role_permissions_json" not in set_cols:
            c.execute("ALTER TABLE settings ADD COLUMN role_permissions_json TEXT DEFAULT '{}'")
        if "webhook_config_json" not in set_cols:
            c.execute("ALTER TABLE settings ADD COLUMN webhook_config_json TEXT DEFAULT '{}'")
    except Exception as e:
        print("Notice: check settings columns:", e)

    # Seed Default Settings if not exists
    cur = c.execute("SELECT id FROM settings WHERE id = 'global'")
    if not cur.fetchone():
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        c.execute("""
            INSERT INTO settings (id, required_json, duplicate_rule, hold_categories_json, qa_documents_json, role_permissions_json, updated_at, updated_by_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "global",
            json.dumps({
                "batch_fisik": True,
                "supplier_batch": True,
                "expired_date": True,
                "production_date": True,
                "pic": True
            }),
            "within_document",
            json.dumps(DEFAULT_HOLD_CATEGORIES),
            json.dumps(DEFAULT_QA_DOCUMENTS),
            json.dumps(DEFAULT_ROLE_PERMISSIONS),
            now,
            "Ade Iksan Ramdani"
        ))

    # Seed Default Users
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    default_users = [
        ("0957b49d-67b9-437a-8d63-18cc1274def3", "admin@tally.com", "Administrator", "admin"),
        ("663aa1ce-82f6-428f-8f3d-9fe4e135a2b1", "adeiksanr@gmail.com", "Ade Iksan Ramdani", "admin"),
        ("9707715a-10b7-498c-94c8-276ab935f5dd", "azes@tally.com", "Azes", "user"),
        ("c1111111-1111-4111-8111-111111111111", "checker@tally.com", "Budi Checker", "checker"),
        ("q2222222-2222-4222-8222-222222222222", "qc@tally.com", "Rina QC Inspector", "qc"),
        ("w3333333-3333-4333-8333-333333333333", "warehouse@tally.com", "Hendra Admin WH", "warehouse_admin")
    ]
    for u_id, u_email, u_name, u_role in default_users:
        if not c.execute("SELECT id FROM users WHERE email = ?", (u_email,)).fetchone():
            c.execute("""
                INSERT INTO users (id, email, name, password_hash, role, is_pic, active, created_at)
                VALUES (?, ?, ?, ?, ?, 1, 1, ?)
            """, (u_id, u_email, u_name, hash_password("Admin123!"), u_role, now))

    # Seed materials from dump if empty
    cur = c.execute("SELECT count(*) FROM materials")
    if cur.fetchone()[0] == 0 and SEED_FILE.exists():
        try:
            with open(SEED_FILE, 'r', encoding='utf-8') as f:
                seed_data = json.load(f)
            
            versions = seed_data.get("versions", [])
            for v in versions:
                c.execute("""
                    INSERT OR REPLACE INTO master_versions 
                    (id, version, filename, mode, uploaded_by, uploaded_by_name, uploaded_at, total_rows, valid_rows, error_rows, inserted, updated, deactivated, active_total)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    v["id"], v["version"], v["filename"], v["mode"], v["uploaded_by"],
                    v["uploaded_by_name"], v["uploaded_at"], v["total_rows"], v["valid_rows"],
                    v["error_rows"], v["inserted"], v["updated"], v["deactivated"], v["active_total"]
                ))
            
            materials = seed_data.get("materials", [])
            for m in materials:
                c.execute("""
                    INSERT OR REPLACE INTO materials
                    (id, code, name, extra_json, active, version_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    m["id"], m["code"], m["name"], json.dumps(m.get("extra", {})),
                    1 if m.get("active", True) else 0, m.get("version_id", ""),
                    m.get("created_at", now), m.get("updated_at", now)
                ))
        except Exception as e:
            print("Error loading seed materials:", e)

    # Self-heal missing supplier_name / supplier_code in tally_sheets from tally_items
    try:
        c.execute("""
            UPDATE tally_sheets
            SET supplier_name = (
                SELECT group_concat(DISTINCT ti.supplier_name)
                FROM tally_items ti
                WHERE ti.sheet_id = tally_sheets.id AND ti.supplier_name != '' AND ti.supplier_name IS NOT NULL
            ),
            supplier_code = (
                SELECT group_concat(DISTINCT ti.supplier_code)
                FROM tally_items ti
                WHERE ti.sheet_id = tally_sheets.id AND ti.supplier_code != '' AND ti.supplier_code IS NOT NULL
            )
            WHERE (supplier_name IS NULL OR supplier_name = '' OR supplier_name = '-')
            AND EXISTS (
                SELECT 1 FROM tally_items ti
                WHERE ti.sheet_id = tally_sheets.id AND ti.supplier_name != '' AND ti.supplier_name IS NOT NULL
            );
        """)
    except Exception as e:
        print("Notice: self-heal supplier_name in init_db:", e)

    conn.commit()
    conn.close()

# In-memory storage for preview uploads
previews_cache: Dict[str, Any] = {}

# FastAPI App
app = FastAPI(title="Tally Sheet API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Dependency
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token tidak valid atau tidak disertakan.")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        conn = get_db()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row or not row["active"]:
            conn.close()
            raise HTTPException(status_code=401, detail="Pengguna tidak aktif atau tidak ditemukan.")
        perms = PermissionService.get_permissions(conn).get(row["role"], {})
        conn.close()
        return {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
            "is_pic": bool(row["is_pic"]),
            "active": bool(row["active"]),
            "created_at": row["created_at"],
            "permissions": perms
        }
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sesi berakhir atau token tidak valid.")

def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak. Fitur ini hanya untuk Admin.")
    return user

def log_activity(user_id: str, user_name: str, action: str, entity: str, entity_id: str, details: str):
    conn = get_db()
    conn.execute("""
        INSERT INTO activity_logs (id, user_id, user_name, action, entity, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(uuid.uuid4()), user_id, user_name, action, entity, entity_id, details,
        datetime.datetime.now(datetime.timezone.utc).isoformat()
    ))
    conn.commit()
    conn.close()

# ----------------- AUTH ENDPOINTS -----------------
class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/login")
def login(req: LoginRequest):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (req.email.strip().lower(),)).fetchone()
    if not user or not verify_password(req.password, user["password_hash"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Email atau password salah.")
    if not user["active"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan.")
    
    perms = PermissionService.get_permissions(conn).get(user["role"], {})
    conn.close()
    
    token = create_jwt(user["id"], user["email"], user["role"])
    user_dict = {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "is_pic": bool(user["is_pic"]),
        "active": bool(user["active"]),
        "created_at": user["created_at"],
        "permissions": perms
    }
    log_activity(user["id"], user["name"], "login", "auth", user["id"], "Login berhasil")
    return {"token": token, "user": user_dict}

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return user

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@app.post("/api/auth/change-password")
def change_password(req: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    u = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user["id"],)).fetchone()
    if not verify_password(req.old_password, u["password_hash"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Password lama salah.")
    if len(req.new_password) < 8:
        conn.close()
        raise HTTPException(status_code=400, detail="Password baru minimal 8 karakter.")
    
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(req.new_password), user["id"]))
    conn.commit()
    conn.close()
    log_activity(user["id"], user["name"], "change_password", "auth", user["id"], "Password berhasil diubah")
    return {"message": "Password berhasil diubah"}

# ----------------- USERS & PICS -----------------
@app.get("/api/pics")
def get_pics():
    conn = get_db()
    rows = conn.execute("SELECT id, name FROM users WHERE is_pic = 1 AND active = 1 ORDER BY name ASC").fetchall()
    conn.close()
    return [{"id": r["id"], "name": r["name"]} for r in rows]

@app.get("/api/users")
def get_users(admin: dict = Depends(require_admin)):
    conn = get_db()
    # 1. Pull latest users from Supabase if available
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/users?order=created_at.asc", headers=get_sb_headers(), timeout=4)
            if r.status_code == 200 and r.json():
                for u in r.json():
                    conn.execute("""
                        INSERT OR REPLACE INTO users (id, email, name, password_hash, role, is_pic, active, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        u["id"], u["email"], u["name"], u["password_hash"], u.get("role", "user"),
                        u.get("is_pic", 1), u.get("active", 1), u.get("created_at")
                    ))
                conn.commit()
        except Exception as e:
            print("Notice: fetch users from Supabase warning:", e)

    rows = conn.execute("SELECT id, email, name, role, is_pic, active, created_at FROM users ORDER BY created_at ASC").fetchall()
    conn.close()
    return [{
        "id": r["id"],
        "email": r["email"],
        "name": r["name"],
        "role": r["role"],
        "is_pic": bool(r["is_pic"]),
        "active": bool(r["active"]),
        "created_at": r["created_at"]
    } for r in rows]

class CreateUserRequest(BaseModel):
    email: str
    name: str
    password: str
    role: str = "user"
    is_pic: bool = True

@app.post("/api/users")
def create_user(req: CreateUserRequest, admin: dict = Depends(require_admin)):
    email = req.email.strip().lower()
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password minimal 8 karakter.")
    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email sudah terdaftar.")
    
    uid = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    pw_hash = hash_password(req.password)
    conn.execute("""
        INSERT INTO users (id, email, name, password_hash, role, is_pic, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (uid, email, req.name.strip(), pw_hash, req.role, 1 if req.is_pic else 0, 1, now))
    conn.commit()
    conn.close()

    # Sync to Supabase Cloud
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            requests.post(
                f"{SUPABASE_URL}/rest/v1/users",
                headers={**get_sb_headers(), "Prefer": "resolution=merge-duplicates"},
                json=[{
                    "id": uid,
                    "email": email,
                    "name": req.name.strip(),
                    "password_hash": pw_hash,
                    "role": req.role,
                    "is_pic": 1 if req.is_pic else 0,
                    "active": 1,
                    "created_at": now
                }],
                timeout=4
            )
        except Exception as e:
            print("Notice: create user Supabase sync warning:", e)

    log_activity(admin["id"], admin["name"], "create_user", "user", uid, f"Membuat akun {email} ({req.role})")
    return {"id": uid, "email": email, "name": req.name, "role": req.role, "is_pic": req.is_pic, "active": True, "created_at": now}

class UpdateUserRequest(BaseModel):
    name: str
    role: str
    is_pic: bool
    active: bool
    password: Optional[str] = None

@app.put("/api/users/{user_id}")
def update_user(user_id: str, req: UpdateUserRequest, admin: dict = Depends(require_admin)):
    conn = get_db()
    u = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not u:
        conn.close()
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan.")
    
    pw_hash = hash_password(req.password) if req.password and len(req.password) >= 8 else u["password_hash"]
    conn.execute("""
        UPDATE users SET name = ?, role = ?, is_pic = ?, active = ?, password_hash = ?
        WHERE id = ?
    """, (req.name.strip(), req.role, 1 if req.is_pic else 0, 1 if req.active else 0, pw_hash, user_id))
    conn.commit()
    conn.close()

    # Sync to Supabase Cloud
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            patch_body = {
                "name": req.name.strip(),
                "role": req.role,
                "is_pic": 1 if req.is_pic else 0,
                "active": 1 if req.active else 0
            }
            if req.password and len(req.password) >= 8:
                patch_body["password_hash"] = pw_hash
            requests.patch(
                f"{SUPABASE_URL}/rest/v1/users?id=eq.{user_id}",
                headers=get_sb_headers(),
                json=patch_body,
                timeout=4
            )
        except Exception as e:
            print("Notice: update user Supabase sync warning:", e)

    log_activity(admin["id"], admin["name"], "update_user", "user", user_id, f"Memperbarui akun {u['email']}")
    return {"message": "Pengguna berhasil diperbarui"}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun Anda sendiri.")
    conn = get_db()
    u = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not u:
        conn.close()
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan.")
    
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    # Sync delete to Supabase Cloud
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            requests.delete(
                f"{SUPABASE_URL}/rest/v1/users?id=eq.{user_id}",
                headers=get_sb_headers(),
                timeout=4
            )
        except Exception as e:
            print("Notice: delete user Supabase sync warning:", e)

    log_activity(admin["id"], admin["name"], "delete_user", "user", user_id, f"Menghapus akun {u['email']}")
    return {"message": "Pengguna berhasil dihapus"}

# ----------------- RBAC PERMISSIONS -----------------
@app.get("/api/permissions")
def get_permissions(admin: dict = Depends(require_admin)):
    conn = get_db()
    # Pull latest settings from Supabase if available
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/settings?id=eq.global", headers=get_sb_headers(), timeout=4)
            if r.status_code == 200 and r.json():
                s_data = r.json()[0]
                if s_data.get("role_permissions_json"):
                    conn.execute("""
                        UPDATE settings SET role_permissions_json = ? WHERE id = 'global'
                    """, (s_data["role_permissions_json"],))
                    conn.commit()
        except Exception as e:
            print("Notice: fetch permissions from Supabase warning:", e)

    perms = PermissionService.get_permissions(conn)
    conn.close()
    return {
        "permissions": perms,
        "roles": ROLE_METADATA,
        "definitions": PERMISSION_DEFINITIONS
    }

class UpdatePermissionsRequest(BaseModel):
    permissions: Dict[str, Dict[str, bool]]

@app.put("/api/permissions")
def update_permissions(req: UpdatePermissionsRequest, admin: dict = Depends(require_admin)):
    conn = get_db()
    updated = PermissionService.save_permissions(conn, req.permissions, admin["name"])
    conn.commit()
    conn.close()

    # Push to Supabase Cloud
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            requests.patch(
                f"{SUPABASE_URL}/rest/v1/settings?id=eq.global",
                headers=get_sb_headers(),
                json={
                    "role_permissions_json": json.dumps(updated),
                    "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "updated_by_name": admin["name"]
                },
                timeout=4
            )
        except Exception as e:
            print("Notice: push permissions to Supabase warning:", e)

    log_activity(admin["id"], admin["name"], "update_permissions", "rbac", "global", "Memperbarui matriks otorisasi hak akses peran sistem")
    return {
        "message": "Matriks hak akses berhasil diperbarui",
        "permissions": updated
    }

# ----------------- WEBHOOK DISPATCHER SERVICE -----------------
class WebhookService:
    @staticmethod
    def get_config(conn) -> dict:
        try:
            row = conn.execute("SELECT webhook_config_json FROM settings WHERE id = 'global'").fetchone()
            if row and "webhook_config_json" in row.keys() and row["webhook_config_json"]:
                loaded = json.loads(row["webhook_config_json"])
                if isinstance(loaded, dict):
                    return {**DEFAULT_WEBHOOK_CONFIG, **loaded}
        except Exception:
            pass
        return DEFAULT_WEBHOOK_CONFIG

    @staticmethod
    def build_payload(event: str, sheet_data: dict, actor: dict, notes: str = "", extra: dict = None, delivery_id: str = None, now_iso: str = None) -> dict:
        extra = extra or {}
        sheet_data = sheet_data or {}
        actor = actor or {}
        delivery_id = delivery_id or str(uuid.uuid4())
        now_iso = now_iso or datetime.datetime.now(datetime.timezone.utc).isoformat()

        event_meta = {
            "tally.submitted": ("📥 Penyerahan Draf ke Admin WH", "Checker telah menyelesaikan pemeriksaan fisik dan menyerahkan dokumen ke Admin Warehouse.", "Accent"),
            "tally.verified_to_qc": ("🔍 Verifikasi Admin WH & Teruskan ke QC", "Admin Warehouse memvalidasi dokumen dan mengajukan uji mutu ke Tim QC.", "Accent"),
            "tally.held": ("⚠️ Dokumen Ditahan (Hold Operasional)", "Dokumen ditahan karena kendala fisik, selisih kuantiti, atau administrasi surat jalan.", "Attention"),
            "tally.unheld": ("✅ Status Penahanan Dicabut (Un-Hold)", "Status penahanan berhasil diselesaikan dengan melampirkan catatan tindakan korektif.", "Good"),
            "tally.approved_stock_uu": ("🎉 Lulus Uji Mutu (Stock Ter-UU / Closed)", "Tim QC meluluskan mutu kedatangan & dokumen resmi diakui di sistem stok pabrik.", "Good"),
            "tally.rejected": ("❌ Penolakan Mutu Kedatangan (QC Reject)", "Tim QC menolak mutu barang kedatangan berdasarkan uji fisik / laboratorium.", "Attention"),
            "tally.cancelled": ("🚫 Dokumen Dibatalkan (Cancelled)", "Dokumen tally sheet resmi dibatalkan oleh Super Admin.", "Default"),
            "tally.test_ping": ("🔔 Uji Coba Integrasi Webhook Berhasil", "Ping uji coba integrasi real-time dari Material Tally Hub (Plant 2111 Cibitung).", "Accent")
        }

        title, subtitle, color_code = event_meta.get(event, ("📢 Notifikasi Transisi Dokumen", "Pemberitahuan perubahan status dokumen tally sheet.", "Accent"))

        sheet_id = str(sheet_data.get("id") or sheet_data.get("sheet_id") or "")
        doc_no = str(sheet_data.get("doc_no") or "")
        po_no = str(sheet_data.get("po_no") or "")
        delivery_note_no = str(sheet_data.get("delivery_note_no") or "")
        vendor_name = str(sheet_data.get("supplier_name") or sheet_data.get("vendor_name") or "")
        truck_plate = str(sheet_data.get("truck_plate") or "")
        arrival_date = str(sheet_data.get("arrival_date") or "")
        status = str(sheet_data.get("status") or "")
        pending_category = str(sheet_data.get("pending_category") or "")
        action_notes = notes or str(sheet_data.get("action_notes") or sheet_data.get("pending_reason") or "")
        actor_name = str(actor.get("name") or "System")
        actor_role = str(actor.get("role") or "system")

        facts = []
        if doc_no:
            facts.append({"title": "No Dokumen:", "value": doc_no})
        if delivery_note_no:
            facts.append({"title": "No Surat Jalan:", "value": delivery_note_no})
        if po_no:
            facts.append({"title": "No Purchase Order:", "value": po_no})
        if vendor_name:
            facts.append({"title": "Vendor / Supplier:", "value": vendor_name})
        if truck_plate:
            facts.append({"title": "No Polisi Truk:", "value": truck_plate})
        if arrival_date:
            facts.append({"title": "Tanggal Kedatangan:", "value": arrival_date})
        if status:
            facts.append({"title": "Status Dokumen:", "value": status.replace("_", " ").title()})
        facts.append({"title": "Aktor / Eksekutor:", "value": f"{actor_name} ({actor_role})"})

        if pending_category:
            facts.append({"title": "Kategori Hold:", "value": pending_category})
        if action_notes:
            facts.append({"title": "Catatan / Alasan:", "value": action_notes})

        if event == "tally.test_ping":
            facts = [
                {"title": "Sistem Sumber:", "value": "Material Tally Hub (Plant 2111 Cibitung)"},
                {"title": "Status Koneksi:", "value": "Terhubung (Active / Connected)"},
                {"title": "Penguji:", "value": f"{actor_name} ({actor_role})"},
                {"title": "Waktu Pengujian:", "value": now_iso},
                {"title": "Pesan:", "value": "Integrasi Microsoft Teams Adaptive Card berfungsi optimal."}
            ]

        card_body = [
            {
                "type": "Container",
                "style": "emphasis",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "🏢 DIAMOND COLD STORAGE — PLANT 2111",
                        "size": "Small",
                        "weight": "Bolder",
                        "color": "Accent"
                    },
                    {
                        "type": "TextBlock",
                        "text": title,
                        "size": "Medium",
                        "weight": "Bolder",
                        "color": color_code,
                        "wrap": True
                    },
                    {
                        "type": "TextBlock",
                        "text": subtitle,
                        "size": "Small",
                        "isSubtle": True,
                        "wrap": True
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": facts
            }
        ]

        actions = []
        if sheet_id:
            actions.append({
                "type": "Action.OpenUrl",
                "title": "📄 Buka Dokumen di Tally Hub",
                "url": f"https://tally-incoming.vercel.app/tally/{sheet_id}"
            })
        elif event == "tally.test_ping":
            actions.append({
                "type": "Action.OpenUrl",
                "title": "⚙️ Buka Pengaturan Webhook",
                "url": "https://tally-incoming.vercel.app/settings"
            })

        adaptive_card = {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.4",
            "msteams": {
                "width": "Full"
            },
            "body": card_body
        }
        if actions:
            adaptive_card["actions"] = actions

        summary_text = f"[{title}] {doc_no or 'Uji Coba'} - {vendor_name or 'Tally Hub'} oleh {actor_name}"

        return {
            "event": event,
            "delivery_id": delivery_id,
            "timestamp": now_iso,
            "actor": {
                "id": actor.get("id", ""),
                "name": actor_name,
                "role": actor_role
            },
            "data": {
                "sheet_id": sheet_id,
                "doc_no": doc_no,
                "delivery_note_no": delivery_note_no,
                "po_no": po_no,
                "arrival_date": arrival_date,
                "truck_plate": truck_plate,
                "vendor_name": vendor_name,
                "status": status,
                "previous_status": extra.get("previous_status", ""),
                "pending_category": pending_category,
                "pending_reason": sheet_data.get("pending_reason", ""),
                "has_berita_acara": bool(sheet_data.get("has_berita_acara")),
                "action_notes": action_notes,
                **extra
            },
            "text": summary_text,
            "content": summary_text,
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": adaptive_card
                }
            ]
        }

    @classmethod
    def dispatch(cls, event: str, sheet_data: dict, actor: dict, notes: str = "", extra: dict = None):
        """
        Dispatches webhook event asynchronously in a daemon background thread so it never blocks the user request.
        """
        def _send():
            try:
                conn = get_db()
                cfg = cls.get_config(conn)
                conn.close()

                if not cfg.get("enabled") or not (cfg.get("url") or "").strip():
                    return

                subscribed = cfg.get("events") or []
                if event not in subscribed and event != "tally.test_ping":
                    return

                delivery_id = str(uuid.uuid4())
                now_dt = datetime.datetime.now(datetime.timezone.utc)
                now_iso = now_dt.isoformat()
                now_ts = int(now_dt.timestamp())

                payload = cls.build_payload(
                    event=event,
                    sheet_data=sheet_data,
                    actor=actor,
                    notes=notes,
                    extra=extra,
                    delivery_id=delivery_id,
                    now_iso=now_iso
                )

                payload_bytes = json.dumps(payload, separators=(',', ':')).encode("utf-8")
                target_url = cfg["url"].strip()
                headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "MaterialTallyHub-Webhook/1.0",
                    "X-Tally-Event": event,
                    "X-Tally-Delivery": delivery_id,
                    "X-Tally-Timestamp": str(now_ts)
                }

                secret = (cfg.get("secret") or "").strip()
                if secret:
                    sig = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
                    headers["X-Tally-Signature"] = f"sha256={sig}"

                requests.post(target_url, data=payload_bytes, headers=headers, timeout=5)
            except Exception as e:
                print(f"Notice: Webhook dispatch error ({event}):", e)

        thread = threading.Thread(target=_send, daemon=True)
        thread.start()

# ----------------- IN-APP NOTIFICATION SERVICE & ENDPOINTS -----------------
class NotificationService:
    @classmethod
    def dispatch(cls, event: str, sheet_data: dict, actor: dict, notes: str = "", extra: dict = None):
        """
        Membuat record notifikasi in-app dan menyinkronkannya ke Supabase secara background.
        """
        def _process():
            try:
                conn = get_db()
                doc_id = sheet_data.get("id") or sheet_data.get("sheet_id") or ""
                doc_no = sheet_data.get("doc_no") or "Tally Sheet"
                actor_name = actor.get("name", "Pengguna")
                created_by_id = sheet_data.get("created_by") or ""
                now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                action_url = f"/tally/{doc_id}"

                records_to_create = []

                if event == "tally.submitted":
                    # Kirim ke role warehouse_admin
                    records_to_create.append({
                        "id": str(uuid.uuid4()),
                        "target_role": "warehouse_admin",
                        "target_user_id": "",
                        "doc_id": doc_id,
                        "doc_no": doc_no,
                        "category": "submitted",
                        "title": f"Draf Diserahkan: {doc_no}",
                        "message": f"Checker {actor_name} telah menyerahkan dokumen untuk verifikasi.",
                        "action_url": action_url,
                        "is_read": 0,
                        "created_at": now_iso
                    })
                elif event == "tally.verified_to_qc":
                    # Kirim ke role qc
                    truck = sheet_data.get("truck_plate") or ""
                    truck_str = f" ({truck})" if truck else ""
                    records_to_create.append({
                        "id": str(uuid.uuid4()),
                        "target_role": "qc",
                        "target_user_id": "",
                        "doc_id": doc_id,
                        "doc_no": doc_no,
                        "category": "qc_review",
                        "title": f"Permintaan Uji Mutu: {doc_no}",
                        "message": f"Admin {actor_name} telah memverifikasi dokumen kedatangan armada{truck_str}. Siap untuk inspeksi mutu.",
                        "action_url": action_url,
                        "is_read": 0,
                        "created_at": now_iso
                    })
                elif event == "tally.held":
                    cat = sheet_data.get("pending_category") or "Kendala Fisik/Dokumen"
                    reason = notes or sheet_data.get("pending_reason") or "Tidak ada catatan"
                    records_to_create.append({
                        "id": str(uuid.uuid4()),
                        "target_role": "warehouse_admin",
                        "target_user_id": "",
                        "doc_id": doc_id,
                        "doc_no": doc_no,
                        "category": "held",
                        "title": f"Dokumen Ditahan: {doc_no}",
                        "message": f"Ditahan oleh {actor_name} ({cat}): {reason}",
                        "action_url": action_url,
                        "is_read": 0,
                        "created_at": now_iso
                    })
                    if created_by_id and created_by_id != actor.get("id"):
                        records_to_create.append({
                            "id": str(uuid.uuid4()),
                            "target_role": "",
                            "target_user_id": created_by_id,
                            "doc_id": doc_id,
                            "doc_no": doc_no,
                            "category": "held",
                            "title": f"Dokumen Anda Ditahan: {doc_no}",
                            "message": f"Ditahan oleh {actor_name} ({cat}): {reason}",
                            "action_url": action_url,
                            "is_read": 0,
                            "created_at": now_iso
                        })
                elif event == "tally.unheld":
                    records_to_create.append({
                        "id": str(uuid.uuid4()),
                        "target_role": "warehouse_admin",
                        "target_user_id": "",
                        "doc_id": doc_id,
                        "doc_no": doc_no,
                        "category": "unheld",
                        "title": f"Penahanan Dilepas: {doc_no}",
                        "message": f"Status hold diselesaikan oleh {actor_name}. Catatan: {notes or 'Siap dilanjutkan'}",
                        "action_url": action_url,
                        "is_read": 0,
                        "created_at": now_iso
                    })
                    if created_by_id and created_by_id != actor.get("id"):
                        records_to_create.append({
                            "id": str(uuid.uuid4()),
                            "target_role": "",
                            "target_user_id": created_by_id,
                            "doc_id": doc_id,
                            "doc_no": doc_no,
                            "category": "unheld",
                            "title": f"Status Hold Dilepas: {doc_no}",
                            "message": f"Status hold pada dokumen Anda telah diselesaikan oleh {actor_name}.",
                            "action_url": action_url,
                            "is_read": 0,
                            "created_at": now_iso
                        })
                elif event == "tally.approved_stock_uu":
                    if created_by_id and created_by_id != actor.get("id"):
                        records_to_create.append({
                            "id": str(uuid.uuid4()),
                            "target_role": "",
                            "target_user_id": created_by_id,
                            "doc_id": doc_id,
                            "doc_no": doc_no,
                            "category": "approved",
                            "title": f"Mutu Lulus (Stock Ter-UU): {doc_no}",
                            "message": f"QC {actor_name} telah meluluskan mutu fisik. Dokumen resmi Selesai.",
                            "action_url": action_url,
                            "is_read": 0,
                            "created_at": now_iso
                        })
                    records_to_create.append({
                        "id": str(uuid.uuid4()),
                        "target_role": "warehouse_admin",
                        "target_user_id": "",
                        "doc_id": doc_id,
                        "doc_no": doc_no,
                        "category": "approved",
                        "title": f"Mutu Lulus (Stock Ter-UU): {doc_no}",
                        "message": f"QC {actor_name} meluluskan dokumen kedatangan {doc_no}.",
                        "action_url": action_url,
                        "is_read": 0,
                        "created_at": now_iso
                    })
                elif event == "tally.rejected":
                    reason = notes or "Tidak memenuhi standar mutu"
                    if created_by_id and created_by_id != actor.get("id"):
                        records_to_create.append({
                            "id": str(uuid.uuid4()),
                            "target_role": "",
                            "target_user_id": created_by_id,
                            "doc_id": doc_id,
                            "doc_no": doc_no,
                            "category": "rejected",
                            "title": f"Mutu Ditolak (QC Reject): {doc_no}",
                            "message": f"QC {actor_name} menolak kedatangan: {reason}",
                            "action_url": action_url,
                            "is_read": 0,
                            "created_at": now_iso
                        })
                    records_to_create.append({
                        "id": str(uuid.uuid4()),
                        "target_role": "warehouse_admin",
                        "target_user_id": "",
                        "doc_id": doc_id,
                        "doc_no": doc_no,
                        "category": "rejected",
                        "title": f"Mutu Ditolak (QC Reject): {doc_no}",
                        "message": f"QC {actor_name} menolak kedatangan {doc_no}: {reason}",
                        "action_url": action_url,
                        "is_read": 0,
                        "created_at": now_iso
                    })
                elif event == "tally.returned_to_checker":
                    reason = notes or "Perlu perbaikan data fisik"
                    if created_by_id:
                        records_to_create.append({
                            "id": str(uuid.uuid4()),
                            "target_role": "",
                            "target_user_id": created_by_id,
                            "doc_id": doc_id,
                            "doc_no": doc_no,
                            "category": "returned",
                            "title": f"Dokumen Dikembalikan: {doc_no}",
                            "message": f"Admin {actor_name} mengembalikan dokumen ke Checker: {reason}",
                            "action_url": action_url,
                            "is_read": 0,
                            "created_at": now_iso
                        })

                for rec in records_to_create:
                    conn.execute("""
                        INSERT INTO notifications (id, target_role, target_user_id, doc_id, doc_no, category, title, message, action_url, is_read, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        rec["id"], rec["target_role"], rec["target_user_id"], rec["doc_id"], rec["doc_no"],
                        rec["category"], rec["title"], rec["message"], rec["action_url"], rec["is_read"], rec["created_at"]
                    ))
                conn.commit()
                conn.close()

                # Sync ke Supabase cloud setelah commit lokal sukses
                for rec in records_to_create:
                    sync_notification_to_supabase(rec)
            except Exception as e:
                print(f"Notice: Notification dispatch error ({event}):", e)

        thread = threading.Thread(target=_process, daemon=True)
        thread.start()

@app.get("/api/notifications/unread-count")
def get_unread_notification_count(user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        user_id = user.get("id", "")
        role = user.get("role", "")
        row = conn.execute("""
            SELECT count(*) as cnt FROM notifications
            WHERE (target_user_id = ? OR target_role = ? OR target_role = 'all' OR (? = 'admin' AND target_role IN ('warehouse_admin', 'qc')))
            AND is_read = 0
        """, (user_id, role, role)).fetchone()
        return {"unread": row["cnt"] if row else 0}
    finally:
        conn.close()

@app.get("/api/notifications")
def get_notifications(unread_only: bool = False, limit: int = 20, user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        user_id = user.get("id", "")
        role = user.get("role", "")
        sql = """
            SELECT * FROM notifications
            WHERE (target_user_id = ? OR target_role = ? OR target_role = 'all' OR (? = 'admin' AND target_role IN ('warehouse_admin', 'qc')))
        """
        params = [user_id, role, role]
        if unread_only:
            sql += " AND is_read = 0"
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(max(1, min(limit, 50)))
        
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

@app.patch("/api/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,))
        conn.commit()
        sync_notification_read_to_supabase(notif_id=notif_id)
        return {"status": "ok"}
    finally:
        conn.close()

@app.post("/api/notifications/mark-all-read")
def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    conn = get_db()
    try:
        user_id = user.get("id", "")
        role = user.get("role", "")
        conn.execute("""
            UPDATE notifications SET is_read = 1
            WHERE (target_user_id = ? OR target_role = ? OR target_role = 'all' OR (? = 'admin' AND target_role IN ('warehouse_admin', 'qc')))
            AND is_read = 0
        """, (user_id, role, role))
        conn.commit()
        sync_notification_read_to_supabase(user_id=user_id, target_role=role)
        return {"status": "ok"}
    finally:
        conn.close()

# ----------------- SETTINGS -----------------
@app.get("/api/settings")
def get_settings():
    conn = get_db()
    # 1. Pull latest settings from Supabase if available
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/settings?id=eq.global", headers=get_sb_headers(), timeout=4)
            if r.status_code == 200 and r.json():
                s_data = r.json()[0]
                conn.execute("""
                    INSERT OR REPLACE INTO settings (id, required_json, duplicate_rule, hold_categories_json, qa_documents_json, role_permissions_json, webhook_config_json, updated_at, updated_by_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    "global",
                    s_data.get("required_json") or "{}",
                    s_data.get("duplicate_rule") or "within_document",
                    s_data.get("hold_categories_json") or "[]",
                    s_data.get("qa_documents_json") or "{}",
                    s_data.get("role_permissions_json") or "{}",
                    s_data.get("webhook_config_json") or "{}",
                    s_data.get("updated_at") or "",
                    s_data.get("updated_by_name") or ""
                ))
                conn.commit()
        except Exception as e:
            print("Notice: fetch settings from Supabase warning:", e)

    res = SettingsService.get_settings(conn)
    conn.close()
    return res

class SettingsRequest(BaseModel):
    required: Dict[str, bool]
    duplicate_rule: str
    hold_categories: Optional[List[str]] = None
    qa_documents: Optional[Dict[str, Any]] = None
    webhook_config: Optional[Dict[str, Any]] = None

@app.put("/api/settings")
def update_settings(req: SettingsRequest, admin: dict = Depends(require_admin)):
    conn = get_db()
    res = SettingsService.update_settings(conn, req.required, req.duplicate_rule, req.hold_categories or DEFAULT_HOLD_CATEGORIES, admin["name"], req.qa_documents, req.webhook_config)
    conn.commit()
    conn.close()

    # 2. Push updated settings to Supabase for persistence across serverless lambdas
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            sb_payload = [{
                "id": "global",
                "required_json": json.dumps(res["required"]),
                "duplicate_rule": res["duplicate_rule"],
                "hold_categories_json": json.dumps(res["hold_categories"]),
                "qa_documents_json": json.dumps(res["qa_documents"]),
                "role_permissions_json": json.dumps(res.get("role_permissions", DEFAULT_ROLE_PERMISSIONS)),
                "webhook_config_json": json.dumps(res.get("webhook_config", DEFAULT_WEBHOOK_CONFIG)),
                "updated_at": res["updated_at"],
                "updated_by_name": admin["name"]
            }]
            r_sb = requests.post(
                f"{SUPABASE_URL}/rest/v1/settings",
                headers={**get_sb_headers(), "Prefer": "resolution=merge-duplicates"},
                json=sb_payload,
                timeout=4
            )
            if r_sb.status_code >= 400:
                print(f"Notice: Supabase settings sync error {r_sb.status_code}: {r_sb.text}")
        except Exception as e:
            print("Notice: push settings to Supabase warning:", e)
    
    req_str = ", ".join([k for k, v in req.required.items() if v])
    log_activity(admin["id"], admin["name"], "update_settings", "settings", "global", f"Kolom wajib: {req_str}; aturan duplikat: {req.duplicate_rule}; {len(res['hold_categories'])} kategori hold; QA Docs & Webhook diperbarui")
    return res

class TestWebhookRequest(BaseModel):
    url: str
    secret: Optional[str] = ""

@app.post("/api/settings/webhook/test")
def test_webhook(req: TestWebhookRequest, admin: dict = Depends(require_admin)):
    target_url = (req.url or "").strip()
    if not target_url.startswith("http://") and not target_url.startswith("https://"):
        raise HTTPException(status_code=400, detail="URL Webhook harus diawali dengan http:// atau https://")

    delivery_id = str(uuid.uuid4())
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now_iso = now_dt.isoformat()
    now_ts = int(now_dt.timestamp())

    payload = WebhookService.build_payload(
        event="tally.test_ping",
        sheet_data={
            "doc_no": "TEST-PING",
            "message": "Ping uji coba integrasi Webhook dari Material Tally Hub (Plant 2111 Cibitung)"
        },
        actor=admin,
        notes="Pengujian integrasi endpoint dari UI Pengaturan Sistem",
        delivery_id=delivery_id,
        now_iso=now_iso
    )
    payload_bytes = json.dumps(payload, separators=(',', ':')).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "MaterialTallyHub-Webhook/1.0",
        "X-Tally-Event": "tally.test_ping",
        "X-Tally-Delivery": delivery_id,
        "X-Tally-Timestamp": str(now_ts)
    }
    secret = (req.secret or "").strip()
    if secret:
        sig = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
        headers["X-Tally-Signature"] = f"sha256={sig}"

    t0 = time.time()
    try:
        r = requests.post(target_url, data=payload_bytes, headers=headers, timeout=5)
        elapsed_ms = round((time.time() - t0) * 1000)
        return {
            "success": 200 <= r.status_code < 300,
            "status_code": r.status_code,
            "status_text": r.reason or f"HTTP {r.status_code}",
            "elapsed_ms": elapsed_ms,
            "message": f"Uji coba berhasil terkirim (Status: {r.status_code}, Respon: {elapsed_ms}ms)"
        }
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "status_code": 408,
            "status_text": "Request Timeout",
            "elapsed_ms": 5000,
            "message": "Gagal: Request timeout setelah 5 detik. Server tujuan tidak merespons."
        }
    except Exception as e:
        return {
            "success": False,
            "status_code": 0,
            "status_text": "Connection Failed",
            "elapsed_ms": 0,
            "message": f"Gagal menghubungi endpoint: {str(e)}"
        }

# ----------------- QA DOCUMENT CONTROL REGISTRY -----------------
@app.get("/api/qa-docs")
def get_qa_documents():
    """Mengembalikan daftar nomor format resmi formulir terkendali ISO 9001:2015 QA dari Settings dinamis."""
    conn = get_db()
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/settings?id=eq.global", headers=get_sb_headers(), timeout=4)
            if r.status_code == 200 and r.json():
                s_data = r.json()[0]
                conn.execute("""
                    INSERT OR REPLACE INTO settings (id, required_json, duplicate_rule, hold_categories_json, qa_documents_json, updated_at, updated_by_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    "global",
                    s_data.get("required_json") or "{}",
                    s_data.get("duplicate_rule") or "within_document",
                    s_data.get("hold_categories_json") or "[]",
                    s_data.get("qa_documents_json") or "{}",
                    s_data.get("updated_at") or "",
                    s_data.get("updated_by_name") or ""
                ))
                conn.commit()
        except Exception as e:
            pass
    res = QADocumentRegistry.get_all(conn)
    conn.close()
    return res


# ----------------- DASHBOARD -----------------
@app.get("/api/dashboard")
def get_dashboard():
    conn = get_db()
    sync_from_supabase_if_needed(conn)
    total = conn.execute("SELECT count(*) FROM tally_sheets").fetchone()[0]
    today_str = datetime.date.today().isoformat()
    yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    this_month_prefix = datetime.date.today().strftime("%Y-%m")
    last_month_date = (datetime.date.today().replace(day=1) - datetime.timedelta(days=1))
    last_month_prefix = last_month_date.strftime("%Y-%m")

    today_count = conn.execute("SELECT count(*) FROM tally_sheets WHERE created_at LIKE ?", (f"{today_str}%",)).fetchone()[0]
    yesterday_count = conn.execute("SELECT count(*) FROM tally_sheets WHERE created_at LIKE ?", (f"{yesterday_str}%",)).fetchone()[0]
    total_this_month = conn.execute("SELECT count(*) FROM tally_sheets WHERE created_at LIKE ?", (f"{this_month_prefix}%",)).fetchone()[0]
    total_last_month = conn.execute("SELECT count(*) FROM tally_sheets WHERE created_at LIKE ?", (f"{last_month_prefix}%",)).fetchone()[0]

    rows_total = conn.execute("SELECT count(*) FROM tally_items").fetchone()[0]
    rows_this_month = conn.execute("""
        SELECT count(*) FROM tally_items ti
        JOIN tally_sheets ts ON ti.sheet_id = ts.id
        WHERE ts.created_at LIKE ?
    """, (f"{this_month_prefix}%",)).fetchone()[0]
    rows_last_month = conn.execute("""
        SELECT count(*) FROM tally_items ti
        JOIN tally_sheets ts ON ti.sheet_id = ts.id
        WHERE ts.created_at LIKE ?
    """, (f"{last_month_prefix}%",)).fetchone()[0]

    drafts = conn.execute("SELECT count(*) FROM tally_sheets WHERE status = 'draft'").fetchone()[0]
    drafts_today = conn.execute("SELECT count(*) FROM tally_sheets WHERE status = 'draft' AND created_at LIKE ?", (f"{today_str}%",)).fetchone()[0]
    drafts_yesterday = conn.execute("SELECT count(*) FROM tally_sheets WHERE status = 'draft' AND created_at LIKE ?", (f"{yesterday_str}%",)).fetchone()[0]

    completed_count = conn.execute("SELECT count(*) FROM tally_sheets WHERE status IN ('completed', 'final', 'waiting_gr')").fetchone()[0]
    qc_count = conn.execute("SELECT count(*) FROM tally_sheets WHERE status IN ('waiting_qc', 'qc_hold')").fetchone()[0]
    admin_count = conn.execute("SELECT count(*) FROM tally_sheets WHERE status IN ('waiting_admin', 'waiting_admin_1', 'admin_hold')").fetchone()[0]
    drafts_count = conn.execute("SELECT count(*) FROM tally_sheets WHERE status = 'draft'").fetchone()[0]
    cancelled_count = conn.execute("SELECT count(*) FROM tally_sheets WHERE status IN ('cancelled', 'qc_rejected')").fetchone()[0]
    in_progress = qc_count + admin_count + drafts_count

    last_v = conn.execute("SELECT * FROM master_versions ORDER BY version DESC LIMIT 1").fetchone()
    last_master = None
    if last_v:
        last_master = {
            "id": last_v["id"],
            "version": last_v["version"],
            "filename": last_v["filename"],
            "mode": last_v["mode"],
            "uploaded_by": last_v["uploaded_by"],
            "uploaded_by_name": last_v["uploaded_by_name"],
            "uploaded_at": last_v["uploaded_at"],
            "total_rows": last_v["total_rows"],
            "valid_rows": last_v["valid_rows"],
            "error_rows": last_v["error_rows"],
            "inserted": last_v["inserted"],
            "updated": last_v["updated"],
            "deactivated": last_v["deactivated"],
            "active_total": last_v["active_total"]
        }

    materials_active = conn.execute("SELECT count(*) FROM materials WHERE active = 1").fetchone()[0]
    conn.close()

    return {
        "total": total,
        "total_this_month": total_this_month,
        "total_last_month": total_last_month,
        "today": today_count,
        "yesterday": yesterday_count,
        "rows_total": rows_total,
        "rows_this_month": rows_this_month,
        "rows_last_month": rows_last_month,
        "in_progress": in_progress,
        "drafts": in_progress,
        "drafts_today": drafts_today,
        "drafts_yesterday": drafts_yesterday,
        "status_counts": {
            "completed": completed_count,
            "waiting_qc": qc_count,
            "waiting_admin": admin_count,
            "draft": drafts_count,
            "cancelled": cancelled_count,
            "final": completed_count
        },
        "last_master": last_master,
        "materials_active": materials_active
    }

# ----------------- MATERIALS & MASTER DATA -----------------
@app.get("/api/materials")
def get_materials(q: str = "", page: int = 1, limit: int = 25):
    conn = get_db()
    offset = (page - 1) * limit
    params = []
    where = "WHERE active = 1"
    if q.strip():
        where += " AND (code LIKE ? OR name LIKE ?)"
        params.extend([f"%{q.strip()}%", f"%{q.strip()}%"])
    
    total = conn.execute(f"SELECT count(*) FROM materials {where}", params).fetchone()[0]
    rows = conn.execute(f"""
        SELECT * FROM materials {where}
        ORDER BY code ASC LIMIT ? OFFSET ?
    """, params + [limit, offset]).fetchall()
    conn.close()

    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "code": r["code"],
            "name": r["name"],
            "extra": json.loads(r["extra_json"]),
            "active": bool(r["active"]),
            "version_id": r["version_id"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"]
        })
    return {"items": items, "total": total, "page": page, "limit": limit}

@app.get("/api/materials/search")
def search_materials(q: str = ""):
    term = q.strip()
    if not term:
        return []
    conn = get_db()
    rows = conn.execute("""
        SELECT code, name, extra_json FROM materials
        WHERE active = 1 AND (code LIKE ? OR name LIKE ?)
        ORDER BY code ASC LIMIT 20
    """, (f"%{term}%", f"%{term}%")).fetchall()
    conn.close()
    res = []
    for r in rows:
        extra = json.loads(r["extra_json"]) if r["extra_json"] else {}
        uom = extra.get("BuN", "") or extra.get("UOM", "") or extra.get("Satuan", "")
        res.append({"code": r["code"], "name": r["name"], "uom": uom})
    return res

# ----------------- SUPPLIERS ENDPOINTS -----------------
@app.get("/api/suppliers/search")
def search_suppliers(q: str = ""):
    term = q.strip()
    if not term:
        return []
    conn = get_db()
    rows = conn.execute("""
        SELECT code, name, city FROM suppliers
        WHERE active = 1 AND (code LIKE ? OR name LIKE ?)
        ORDER BY code ASC LIMIT 20
    """, (f"%{term}%", f"%{term}%")).fetchall()
    conn.close()
    return [{"code": r["code"], "name": r["name"], "city": r["city"]} for r in rows]

@app.get("/api/suppliers")
def get_suppliers(q: str = "", page: int = 1, limit: int = 25):
    conn = get_db()
    offset = (page - 1) * limit
    params = []
    where = "WHERE active = 1"
    if q.strip():
        where += " AND (code LIKE ? OR name LIKE ? OR city LIKE ?)"
        wild = f"%{q.strip()}%"
        params.extend([wild, wild, wild])
    
    total = conn.execute(f"SELECT count(*) FROM suppliers {where}", params).fetchone()[0]
    rows = conn.execute(f"""
        SELECT * FROM suppliers {where}
        ORDER BY code ASC LIMIT ? OFFSET ?
    """, params + [limit, offset]).fetchall()
    conn.close()

    items = [{
        "id": r["id"],
        "code": r["code"],
        "name": r["name"],
        "city": r["city"],
        "country": r["country"],
        "postal_code": r["postal_code"],
        "purchasing_org": r["purchasing_org"],
        "active": bool(r["active"]),
        "created_at": r["created_at"],
        "updated_at": r["updated_at"]
    } for r in rows]
    return {"items": items, "total": total, "page": page, "limit": limit}

@app.post("/api/suppliers/upload")
async def upload_suppliers(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca file Excel: {str(e)}")
    
    code_col = None
    name_col = None
    for c in df.columns:
        cl = str(c).strip().lower()
        if "supplier" in cl and "name" not in cl:
            code_col = c
        elif "supplier name" in cl or "name" in cl:
            name_col = c
    
    if not code_col or not name_col:
        raise HTTPException(status_code=400, detail="Kolom 'Supplier' dan 'Supplier Name' tidak ditemukan dalam file Excel.")
    
    conn = get_db()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    inserted = 0
    updated = 0
    
    for _, row in df.iterrows():
        code = str(row[code_col]).strip()
        name = str(row[name_col]).strip()
        if not code or not name or code == "nan" or name == "nan":
            continue
        city = str(row.get("City", "")).strip() if pd.notna(row.get("City")) else ""
        country = str(row.get("Country/Region Key", "")).strip() if pd.notna(row.get("Country/Region Key")) else ""
        postal = str(row.get("Postal Code", "")).strip() if pd.notna(row.get("Postal Code")) else ""
        p_org = str(row.get("Purch. organization", "")).strip() if pd.notna(row.get("Purch. organization")) else ""
        
        existing = conn.execute("SELECT id FROM suppliers WHERE code = ?", (code,)).fetchone()
        if existing:
            conn.execute("""
                UPDATE suppliers SET name = ?, city = ?, country = ?, postal_code = ?, purchasing_org = ?, updated_at = ?
                WHERE code = ?
            """, (name, city, country, postal, p_org, now, code))
            updated += 1
        else:
            conn.execute("""
                INSERT INTO suppliers (id, code, name, city, country, postal_code, purchasing_org, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), code, name, city, country, postal, p_org, 1, now, now))
            inserted += 1
            
    conn.commit()
    conn.close()
    log_activity(user["id"], user["name"], "upload_suppliers", "suppliers", "global", f"Upload Master Supplier {file.filename}: {inserted} baru, {updated} diperbarui")
    return {"message": f"Berhasil memproses {inserted} supplier baru dan memperbarui {updated} supplier.", "inserted": inserted, "updated": updated}


@app.get("/api/master/status")
def get_master_status():
    conn = get_db()
    active_total = conn.execute("SELECT count(*) FROM materials WHERE active = 1").fetchone()[0]
    last_v = conn.execute("SELECT * FROM master_versions ORDER BY version DESC LIMIT 1").fetchone()
    conn.close()
    last_version = None
    if last_v:
        last_version = {
            "id": last_v["id"],
            "version": last_v["version"],
            "filename": last_v["filename"],
            "mode": last_v["mode"],
            "uploaded_by": last_v["uploaded_by"],
            "uploaded_by_name": last_v["uploaded_by_name"],
            "uploaded_at": last_v["uploaded_at"],
            "active_total": last_v["active_total"]
        }
    return {"active_total": active_total, "last_version": last_version}

@app.get("/api/master/versions")
def get_master_versions():
    conn = get_db()
    rows = conn.execute("SELECT * FROM master_versions ORDER BY version DESC").fetchall()
    conn.close()
    return [{
        "id": r["id"],
        "version": r["version"],
        "filename": r["filename"],
        "mode": r["mode"],
        "uploaded_by": r["uploaded_by"],
        "uploaded_by_name": r["uploaded_by_name"],
        "uploaded_at": r["uploaded_at"],
        "total_rows": r["total_rows"],
        "valid_rows": r["valid_rows"],
        "error_rows": r["error_rows"],
        "inserted": r["inserted"],
        "updated": r["updated"],
        "deactivated": r["deactivated"],
        "active_total": r["active_total"]
    } for r in rows]

CODE_ALIASES = ["kode material", "material code", "kode", "code", "material", "sku"]
NAME_ALIASES = ["nama material", "deskripsi", "description", "material description", "nama"]

@app.post("/api/master/preview")
async def preview_master(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    content = await file.read()
    filename = file.filename or "upload.xlsx"
    
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca file: {str(e)}")

    cols = list(df.columns)
    code_col = None
    name_col = None

    for c in cols:
        cl = str(c).strip().lower()
        if not code_col and any(cl == a or cl.startswith(a) for a in CODE_ALIASES):
            code_col = c
        if not name_col and any(cl == a or cl.startswith(a) for a in NAME_ALIASES):
            name_col = c

    if not code_col:
        code_col = cols[0] if len(cols) > 0 else "Kode Material"
    if not name_col:
        name_col = cols[1] if len(cols) > 1 else "Nama Material"

    extra_cols = [c for c in cols if c not in (code_col, name_col)]

    total_rows = len(df)
    errors = []
    valid_rows = []
    seen_codes = set()

    for idx, row in df.iterrows():
        line = idx + 2  # Excel 1-based header is line 1
        raw_code = str(row[code_col]).strip() if pd.notna(row[code_col]) else ""
        raw_name = str(row[name_col]).strip() if pd.notna(row[name_col]) else ""

        if not raw_code or raw_code.lower() == "nan":
            errors.append({"line": line, "code": "", "message": f"Kode material kosong pada kolom '{code_col}'"})
            continue
        if not raw_name or raw_name.lower() == "nan":
            errors.append({"line": line, "code": raw_code, "message": f"Nama material kosong pada kolom '{name_col}'"})
            continue
        if raw_code in seen_codes:
            errors.append({"line": line, "code": raw_code, "message": f"Kode material duplikat dalam file ({raw_code})"})
            continue

        seen_codes.add(raw_code)
        extra = {}
        for ec in extra_cols:
            val = row[ec]
            extra[ec] = str(val).strip() if pd.notna(val) else ""
        
        valid_rows.append({
            "line": line,
            "code": raw_code,
            "name": raw_name,
            "extra": extra
        })

    # Stats vs existing
    conn = get_db()
    existing_codes = set(r[0] for r in conn.execute("SELECT code FROM materials WHERE active = 1").fetchall())
    conn.close()

    new_count = sum(1 for r in valid_rows if r["code"] not in existing_codes)
    updated_count = sum(1 for r in valid_rows if r["code"] in existing_codes)
    valid_set = set(r["code"] for r in valid_rows)
    deactivate_if_replace = sum(1 for c in existing_codes if c not in valid_set)

    preview_id = str(uuid.uuid4())
    preview_data = {
        "filename": filename,
        "valid_rows": valid_rows,
        "total_rows": total_rows,
        "error_rows": len(errors),
        "code_col": code_col,
        "name_col": name_col,
        "extra_cols": extra_cols
    }
    previews_cache[preview_id] = preview_data

    # Persist to database staging table for serverless instance parity
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS master_previews (
            id TEXT PRIMARY KEY,
            data_json TEXT,
            created_at TEXT
        )
    """)
    now_prev = datetime.datetime.now(datetime.timezone.utc).isoformat()
    conn.execute("INSERT OR REPLACE INTO master_previews (id, data_json, created_at) VALUES (?, ?, ?)",
                 (preview_id, json.dumps(preview_data), now_prev))
    conn.commit()
    conn.close()

    # Also push staging to Supabase cloud if configured so any Vercel instance can commit
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            requests.post(
                f"{SUPABASE_URL}/rest/v1/master_previews",
                headers=get_sb_headers(),
                json=[{"id": preview_id, "data_json": json.dumps(preview_data), "created_at": now_prev}],
                timeout=5
            )
        except Exception as e:
            print("Notice: Staging upload to Supabase master_previews warning:", e)

    return {
        "preview_id": preview_id,
        "total_rows": total_rows,
        "valid_rows": len(valid_rows),
        "error_rows": len(errors),
        "stats": {
            "new": new_count,
            "updated": updated_count,
            "deactivate_if_replace": deactivate_if_replace
        },
        "code_column": str(code_col),
        "name_column": str(name_col),
        "extra_columns": extra_cols,
        "errors": errors[:100],
        "sample": valid_rows[:50]
    }

class CommitMasterRequest(BaseModel):
    preview_id: str
    mode: str  # "upsert" or "replace"

@app.post("/api/master/commit")
def commit_master(req: CommitMasterRequest, admin: dict = Depends(require_admin)):
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS master_previews (
            id TEXT PRIMARY KEY,
            data_json TEXT,
            created_at TEXT
        )
    """)
    row_prev = conn.execute("SELECT data_json FROM master_previews WHERE id = ?", (req.preview_id,)).fetchone()
    if row_prev and row_prev["data_json"]:
        cached = json.loads(row_prev["data_json"])
    elif req.preview_id in previews_cache:
        cached = previews_cache.get(req.preview_id)
    else:
        # Fallback fetch from Supabase staging
        cached = None
        if SUPABASE_KEY and SUPABASE_URL:
            try:
                r_sb = requests.get(
                    f"{SUPABASE_URL}/rest/v1/master_previews?id=eq.{req.preview_id}",
                    headers=get_sb_headers(),
                    timeout=5
                )
                if r_sb.status_code == 200 and r_sb.json():
                    cached = json.loads(r_sb.json()[0]["data_json"])
            except Exception as e:
                print("Notice: Staging read from Supabase master_previews warning:", e)

    if not cached:
        conn.close()
        raise HTTPException(status_code=400, detail="Data pratinjau sudah kadaluarsa atau tidak ditemukan. Silakan upload ulang.")
    
    valid_rows = cached["valid_rows"]
    filename = cached["filename"]
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    version_id = str(uuid.uuid4())
    
    last_v = conn.execute("SELECT max(version) FROM master_versions").fetchone()[0] or 0
    new_version = last_v + 1

    existing_map = {r["code"]: r["id"] for r in conn.execute("SELECT code, id FROM materials").fetchall()}
    active_codes = set(r[0] for r in conn.execute("SELECT code FROM materials WHERE active = 1").fetchall())

    inserted = 0
    updated = 0
    deactivated = 0

    incoming_codes = set()
    for item in valid_rows:
        code = item["code"]
        name = item["name"]
        extra_json = json.dumps(item["extra"])
        incoming_codes.add(code)

        if code in existing_map:
            conn.execute("""
                UPDATE materials SET name = ?, extra_json = ?, active = 1, version_id = ?, updated_at = ?
                WHERE code = ?
            """, (name, extra_json, version_id, now, code))
            updated += 1
        else:
            mid = str(uuid.uuid4())
            conn.execute("""
                INSERT INTO materials (id, code, name, extra_json, active, version_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?)
            """, (mid, code, name, extra_json, version_id, now, now))
            inserted += 1

    if req.mode == "replace":
        for code in active_codes:
            if code not in incoming_codes:
                conn.execute("UPDATE materials SET active = 0, updated_at = ? WHERE code = ?", (now, code))
                deactivated += 1

    active_total = conn.execute("SELECT count(*) FROM materials WHERE active = 1").fetchone()[0]

    conn.execute("""
        INSERT INTO master_versions 
        (id, version, filename, mode, uploaded_by, uploaded_by_name, uploaded_at, total_rows, valid_rows, error_rows, inserted, updated, deactivated, active_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        version_id, new_version, filename, req.mode, admin["id"], admin["name"], now,
        cached["total_rows"], len(valid_rows), cached["error_rows"], inserted, updated, deactivated, active_total
    ))

    # Clean up DB staging
    conn.execute("DELETE FROM master_previews WHERE id = ?", (req.preview_id,))
    conn.commit()
    conn.close()

    if req.preview_id in previews_cache:
        del previews_cache[req.preview_id]

    if SUPABASE_KEY and SUPABASE_URL:
        try:
            requests.delete(
                f"{SUPABASE_URL}/rest/v1/master_previews?id=eq.{req.preview_id}",
                headers=get_sb_headers(),
                timeout=4
            )
        except Exception:
            pass

    mode_label = "Tambah/Update Data" if req.mode == "upsert" else "Ganti Data"
    log_activity(admin["id"], admin["name"], "upload_master", "master_data", version_id,
                 f"v{new_version} {filename} ({mode_label}): {inserted} baru, {updated} diperbarui, {deactivated} dinonaktifkan")

    return {
        "version": new_version,
        "inserted": inserted,
        "updated": updated,
        "deactivated": deactivated,
        "active_total": active_total
    }

@app.post("/api/master/versions/{version_id}/restore")
def restore_master_version(version_id: str, admin: dict = Depends(require_admin)):
    conn = get_db()
    target_v = conn.execute("SELECT * FROM master_versions WHERE id = ?", (version_id,)).fetchone()
    if not target_v:
        conn.close()
        raise HTTPException(status_code=404, detail="Versi master data tidak ditemukan.")
    
    last_v = conn.execute("SELECT max(version) FROM master_versions").fetchone()[0] or 0
    new_version = last_v + 1
    new_version_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn.execute("UPDATE materials SET active = 0, updated_at = ?", (now,))
    conn.execute("UPDATE materials SET active = 1, updated_at = ? WHERE version_id = ?", (now, version_id))
    active_total = conn.execute("SELECT count(*) FROM materials WHERE active = 1").fetchone()[0]

    conn.execute("""
        INSERT INTO master_versions 
        (id, version, filename, mode, uploaded_by, uploaded_by_name, uploaded_at, total_rows, valid_rows, error_rows, inserted, updated, deactivated, active_total)
        VALUES (?, ?, ?, 'restore', ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
    """, (
        new_version_id, new_version, f"Restore v{target_v['version']} ({target_v['filename']})",
        admin["id"], admin["name"], now, active_total, active_total, active_total, 0, active_total
    ))

    conn.commit()
    conn.close()

    log_activity(admin["id"], admin["name"], "restore_master", "master_data", new_version_id,
                 f"Pemulihan ke snapshot v{target_v['version']} (menjadi v{new_version})")

    return {"version": new_version, "active_total": active_total}

# ----------------- TALLY SHEETS -----------------
def generate_doc_no(conn) -> str:
    today_str = datetime.date.today().strftime("%Y%m%d")
    prefix = f"TS-{today_str}-"
    cur = conn.execute("SELECT doc_no FROM tally_sheets WHERE doc_no LIKE ? ORDER BY doc_no DESC LIMIT 1", (f"{prefix}%",))
    row = cur.fetchone()
    if row:
        last_seq = int(row[0].split("-")[-1])
        new_seq = last_seq + 1
    else:
        new_seq = 1
    return f"{prefix}{new_seq:04d}"

class TallyItemInput(BaseModel):
    material_code: str
    material_name: str
    uom: Optional[str] = ""
    qty: Optional[float] = 0
    supplier_code: Optional[str] = ""
    supplier_name: Optional[str] = ""
    batch_fisik: Optional[str] = ""
    supplier_batch: Optional[str] = ""
    expired_date: Optional[str] = ""
    production_date: Optional[str] = ""
    pic_id: Optional[str] = ""
    pic_name: Optional[str] = ""

class TallySheetInput(BaseModel):
    delivery_note_no: Optional[str] = ""
    po_no: Optional[str] = ""
    supplier_code: Optional[str] = ""
    supplier_name: Optional[str] = ""
    arrival_date: Optional[str] = ""
    driver_name: Optional[str] = ""
    truck_plate: Optional[str] = ""
    action: str = "draft"  # "draft" | "submit_to_admin" | "final"
    qa_doc_no: Optional[str] = None
    has_berita_acara: Optional[bool] = False
    ba_qa_doc_no: Optional[str] = None
    berita_acara: Optional[Dict[str, Any]] = None
    items: List[TallyItemInput]

class WorkflowTransitionInput(BaseModel):
    action: str  # "submit_to_admin", "admin_hold", "send_to_qc", "qc_hold", "qc_approve", "qc_reject", "admin_gr_hold", "post_gr", "return_to_checker"
    category: Optional[str] = ""
    reason: Optional[str] = ""
    gr_no: Optional[str] = ""
    qc_notes: Optional[str] = ""

class BeritaAcaraAttachInput(BaseModel):
    arrival_type: str = "import"  # "import" | "local"
    container_no: Optional[str] = ""
    seal_no: Optional[str] = ""
    seal_condition: Optional[str] = "Baik / Utuh"
    container_temp_type: Optional[str] = "Frozen"
    temp_celsius: Optional[str] = ""
    floor_before: Optional[str] = ""
    wall_before: Optional[str] = ""
    floor_after: Optional[str] = ""
    wall_after: Optional[str] = ""
    cargo_arrangement: Optional[str] = "Baik"
    cargo_arrangement_notes: Optional[str] = ""
    cargo_condition: Optional[str] = "Baik, tidak ditemukan pecah / bocor"
    cargo_condition_notes: Optional[str] = ""
    cargo_qty_match: Optional[str] = "Sesuai dengan Packing List"
    cargo_qty_notes: Optional[str] = ""
    location: Optional[str] = "Cibitung"
    driver_name: Optional[str] = ""
    spv_name: Optional[str] = ""
    manager_name: Optional[str] = ""
    ba_qa_doc_no: Optional[str] = None

def validate_items(conn, items: List[TallyItemInput], action: str, sheet_id: Optional[str] = None):
    # Fetch settings
    s_row = conn.execute("SELECT required_json, duplicate_rule FROM settings WHERE id = 'global'").fetchone()
    settings = json.loads(s_row["required_json"]) if s_row else {}
    duplicate_rule = s_row["duplicate_rule"] if s_row else "within_document"

    errors = []
    seen_within = {}

    for i, it in enumerate(items):
        if not it.material_code.strip():
            errors.append({"row": i, "field": "material_code", "message": "Material wajib dipilih dari Master Data"})
        else:
            mat = conn.execute("SELECT code, name FROM materials WHERE code = ? AND active = 1", (it.material_code.strip(),)).fetchone()
            if not mat:
                errors.append({"row": i, "field": "material_code", "message": "Material tidak aktif atau tidak ada di Master Data"})

        if it.expired_date and it.production_date and it.production_date > it.expired_date:
            errors.append({"row": i, "field": "production_date", "message": "Production Date tidak boleh lebih besar dari Expired Date"})

        if action in ("final", "submit_to_admin"):
            # Positive quantity check
            try:
                qty_val = float(it.qty or 0)
            except (ValueError, TypeError):
                qty_val = 0.0
            if qty_val <= 0:
                errors.append({"row": i, "field": "qty", "message": "Kuantitas material fisik wajib diisi dan lebih besar dari 0 (positif)"})

            checks = {
                "batch_fisik": (it.batch_fisik or "").strip(),
                "supplier_batch": (it.supplier_batch or "").strip(),
                "expired_date": (it.expired_date or "").strip(),
                "production_date": (it.production_date or "").strip(),
                "pic": (it.pic_id or "").strip()
            }
            labels = {
                "batch_fisik": "Batch Fisik", "supplier_batch": "Produsen",
                "expired_date": "Expired Date", "production_date": "Production Date", "pic": "PIC"
            }
            for f, val in checks.items():
                if settings.get(f) and not val:
                    errors.append({"row": i, "field": f, "message": f"{labels[f]} wajib diisi"})

        # Duplicate check
        k = f"{it.material_code.strip().upper()}|{(it.batch_fisik or '').strip().upper()}|{(it.supplier_batch or '').strip().upper()}"
        if duplicate_rule in ("within_document", "both"):
            if k in seen_within:
                errors.append({"row": i, "field": "batch_fisik", "message": f"Data ganda dengan baris {seen_within[k] + 1} (Kode + Batch Fisik + Produsen)"})
            else:
                seen_within[k] = i

        if duplicate_rule in ("across_final", "both") and it.material_code.strip():
            sql = """
                SELECT ts.doc_no FROM tally_items ti
                JOIN tally_sheets ts ON ti.sheet_id = ts.id
                WHERE ts.status IN ('completed', 'final')
                AND upper(ti.material_code) = ?
                AND upper(ti.batch_fisik) = ?
                AND upper(ti.supplier_batch) = ?
            """
            params = [it.material_code.strip().upper(), (it.batch_fisik or "").strip().upper(), (it.supplier_batch or "").strip().upper()]
            if sheet_id:
                sql += " AND ts.id != ?"
                params.append(sheet_id)
            conflict = conn.execute(sql, params).fetchone()
            if conflict:
                errors.append({"row": i, "field": "batch_fisik", "message": f"Kombinasi ini sudah digunakan di dokumen Final {conflict[0]}"})

    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors, "message": "Data belum valid. Periksa kolom yang ditandai merah."})

@app.get("/api/tally-sheets")
def get_tally_sheets(
    q: str = "",
    date: str = "",
    start_date: str = "",
    end_date: str = "",
    material: str = "",
    pic: str = "",
    status: str = "",
    page: int = 1,
    limit: int = 15
):
    conn = get_db()
    sync_from_supabase_if_needed(conn)
    offset = (page - 1) * limit
    where_clauses = ["1=1"]
    params = []

    if q.strip():
        where_clauses.append("(ts.doc_no LIKE ? OR ts.created_by_name LIKE ? OR ts.delivery_note_no LIKE ? OR ts.po_no LIKE ? OR ts.supplier_name LIKE ? OR ts.id IN (SELECT sheet_id FROM tally_items WHERE material_code LIKE ? OR pic_name LIKE ?))")
        q_wild = f"%{q.strip()}%"
        params.extend([q_wild, q_wild, q_wild, q_wild, q_wild, q_wild, q_wild])
    if date.strip():
        where_clauses.append("(ts.arrival_date = ? OR (ts.arrival_date = '' AND ts.created_at LIKE ?))")
        params.extend([date.strip(), f"{date.strip()}%"])
    else:
        if start_date.strip():
            where_clauses.append("(CASE WHEN ts.arrival_date != '' THEN ts.arrival_date ELSE substr(ts.created_at, 1, 10) END >= ?)")
            params.append(start_date.strip())
        if end_date.strip():
            where_clauses.append("(CASE WHEN ts.arrival_date != '' THEN ts.arrival_date ELSE substr(ts.created_at, 1, 10) END <= ?)")
            params.append(end_date.strip())
    if material.strip():
        where_clauses.append("ts.id IN (SELECT sheet_id FROM tally_items WHERE material_code LIKE ?)")
        params.append(f"%{material.strip()}%")
    if pic.strip():
        where_clauses.append("ts.id IN (SELECT sheet_id FROM tally_items WHERE pic_name LIKE ?)")
        params.append(f"%{pic.strip()}%")
    if status.strip() and status != "all":
        where_clauses.append("ts.status = ?")
        params.append(status.strip())

    where_str = " AND ".join(where_clauses)
    total = conn.execute(f"SELECT count(*) FROM tally_sheets ts WHERE {where_str}", params).fetchone()[0]

    rows = conn.execute(f"""
        SELECT ts.*, 
               coalesce(nullif(ts.supplier_name, ''), group_concat(DISTINCT nullif(ti.supplier_name, ''))) as effective_supplier_name,
               coalesce(nullif(ts.supplier_code, ''), group_concat(DISTINCT nullif(ti.supplier_code, ''))) as effective_supplier_code,
               count(ti.id) as item_count, group_concat(DISTINCT ti.pic_name) as pic_names
        FROM tally_sheets ts
        LEFT JOIN tally_items ti ON ts.id = ti.sheet_id
        WHERE {where_str}
        GROUP BY ts.id
        ORDER BY ts.created_at DESC
        LIMIT ? OFFSET ?
    """, params + [limit, offset]).fetchall()

    conn.close()

    items = []
    for r in rows:
        pic_list = [p for p in (r["pic_names"] or "").split(",") if p]
        effective_sup = (r["effective_supplier_name"] or (r["supplier_name"] if "supplier_name" in r.keys() else "") or "").strip()
        effective_code = (r["effective_supplier_code"] or (r["supplier_code"] if "supplier_code" in r.keys() else "") or "").strip()
        items.append({
            "id": r["id"],
            "doc_no": r["doc_no"],
            "status": r["status"],
            "delivery_note_no": r["delivery_note_no"] if "delivery_note_no" in r.keys() else "",
            "po_no": r["po_no"] if "po_no" in r.keys() else "",
            "supplier_code": effective_code,
            "supplier_name": effective_sup,
            "arrival_date": r["arrival_date"] if "arrival_date" in r.keys() else "",
            "driver_name": r["driver_name"] if "driver_name" in r.keys() else "",
            "truck_plate": r["truck_plate"] if "truck_plate" in r.keys() else "",
            "current_handler_role": r["current_handler_role"] if "current_handler_role" in r.keys() else "checker",
            "current_handler_name": r["current_handler_name"] if "current_handler_name" in r.keys() else "",
            "pending_reason": r["pending_reason"] if "pending_reason" in r.keys() else "",
            "pending_category": r["pending_category"] if "pending_category" in r.keys() else "",
            "qc_status": r["qc_status"] if "qc_status" in r.keys() else "",
            "gr_no": r["gr_no"] if "gr_no" in r.keys() else "",
            "created_by": r["created_by"],
            "created_by_name": r["created_by_name"],
            "created_at": r["created_at"],
            "updated_by": r["updated_by"],
            "updated_by_name": r["updated_by_name"],
            "updated_at": r["updated_at"],
            "finalized_at": r["finalized_at"],
            "finalized_by": r["finalized_by"],
            "finalized_by_name": r["finalized_by_name"],
            "cancelled_at": r["cancelled_at"],
            "cancelled_by": r["cancelled_by"],
            "cancelled_by_name": r["cancelled_by_name"],
            "cancel_reason": r["cancel_reason"],
            "item_count": r["item_count"],
            "pic_names": pic_list
        })

    return {"items": items, "total": total, "page": page, "limit": limit}

@app.post("/api/tally-sheets")
def create_tally_sheet(req: TallySheetInput, user: dict = Depends(get_current_user)):
    if not req.items:
        raise HTTPException(status_code=400, detail="Minimal 1 baris material harus diisi.")
    
    conn = get_db()
    if not PermissionService.has_permission(conn, user.get("role", "user"), "tally_create"):
        conn.close()
        raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user.get('role')}' tidak memiliki izin 'tally_create' untuk membuat dokumen Tally Sheet.")
    
    if req.action not in ("draft", "submit_to_admin"):
        conn.close()
        raise HTTPException(status_code=400, detail="Aksi tidak valid. Hanya 'draft' atau 'submit_to_admin' yang diizinkan saat pembuatan dokumen.")

    if req.action == "submit_to_admin" and not PermissionService.has_permission(conn, user.get("role", "user"), "tally_submit"):
        conn.close()
        raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user.get('role')}' tidak memiliki izin 'tally_submit' untuk menyerahkan dokumen ke Admin.")

    validate_items(conn, req.items, req.action)

    delivery_note = (req.delivery_note_no or "").strip()
    po_num = (req.po_no or "").strip()
    sup_code = (req.supplier_code or "").strip()
    sup_name = (req.supplier_name or "").strip()

    # Automatically derive supplier_name and supplier_code from items if missing
    if not sup_name and req.items:
        val_sups = [it.supplier_name.strip() for it in req.items if (it.supplier_name or "").strip()]
        if val_sups:
            sup_name = ", ".join(dict.fromkeys(val_sups))
    if not sup_code and req.items:
        val_codes = [it.supplier_code.strip() for it in req.items if (it.supplier_code or "").strip()]
        if val_codes:
            sup_code = ", ".join(dict.fromkeys(val_codes))

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    arr_date = (req.arrival_date or "").strip() or now[:10]
    drv_name = (req.driver_name or "").strip()
    trk_plate = (req.truck_plate or "").strip()

    if not trk_plate:
        conn.close()
        raise HTTPException(status_code=400, detail="Nomor Polisi Armada Truk wajib diisi (Mandatory).")

    # Duplicate Delivery Note (Surat Jalan) check on submission
    if delivery_note and req.action == "submit_to_admin":
        dup_sj = conn.execute("""
            SELECT doc_no, status, arrival_date FROM tally_sheets
            WHERE status != 'cancelled'
            AND upper(trim(delivery_note_no)) = ?
        """, (delivery_note.upper(),)).fetchone()
        if dup_sj:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail=f"Nomor Surat Jalan '{delivery_note}' sudah terdaftar pada dokumen {dup_sj['doc_no']} (Status: {dup_sj['status'].upper()}). Harap periksa kembali untuk menghindari penerimaan ganda (double-receiving)."
            )

    sheet_id = str(uuid.uuid4())
    doc_no = generate_doc_no(conn)
    
    # Workflow Status determination - completed ONLY via QC approval
    if req.action == "submit_to_admin":
        status = "waiting_admin"
        handler_role = "warehouse_admin"
        handler_name = ""
    else:
        status = "draft"
        handler_role = "checker"
        handler_name = user["name"]

    qa_code = QADocumentRegistry.resolve_tally_code(req.qa_doc_no, conn)
    has_ba = 1 if req.has_berita_acara else 0
    ba_qa_code = QADocumentRegistry.resolve_ba_code(req.ba_qa_doc_no, conn)
    ba_rec = BeritaAcaraRecord(req.berita_acara) if req.berita_acara else BeritaAcaraRecord()
    ba_json = json.dumps(ba_rec.to_dict()) if has_ba else "{}"
    ba_cont = ba_rec.container_no if has_ba else ""
    ba_seal = ba_rec.seal_no if has_ba else ""
    ba_seal_cond = ba_rec.seal_condition if has_ba else ""
    ba_temp = ba_rec.container_temp_type if has_ba else ""

    conn.execute("""
        INSERT INTO tally_sheets 
        (id, doc_no, status, created_by, created_by_name, created_at, updated_by, updated_by_name, updated_at,
         finalized_at, finalized_by, finalized_by_name,
         delivery_note_no, po_no, supplier_code, supplier_name, arrival_date, driver_name, truck_plate,
         current_handler_role, current_handler_name,
         qa_doc_no, has_berita_acara, ba_qa_doc_no, ba_data_json, ba_container_no, ba_seal_no, ba_seal_condition, ba_container_temp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        sheet_id, doc_no, status, user["id"], user["name"], now, user["id"], user["name"], now,
        now if status == "completed" else None, user["id"] if status == "completed" else None, user["name"] if status == "completed" else None,
        delivery_note, po_num, sup_code, sup_name, arr_date, drv_name, trk_plate,
        handler_role, handler_name,
        qa_code, has_ba, ba_qa_code, ba_json, ba_cont, ba_seal, ba_seal_cond, ba_temp
    ))

    # Fetch users map for pic_name
    u_map = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM users").fetchall()}

    sb_items = []
    for idx, it in enumerate(req.items):
        item_id = str(uuid.uuid4())
        pic_id = it.pic_id or user["id"]
        pic_name = u_map.get(pic_id, user["name"])
        conn.execute("""
            INSERT INTO tally_items 
            (id, sheet_id, seq, material_code, material_name, uom, qty, supplier_code, supplier_name, batch_fisik, supplier_batch, expired_date, production_date, pic_id, pic_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item_id, sheet_id, idx + 1, it.material_code.strip(), it.material_name.strip(),
            (it.uom or "").strip(), float(it.qty or 0),
            (it.supplier_code or sup_code).strip(), (it.supplier_name or sup_name).strip(),
            (it.batch_fisik or "").strip(), (it.supplier_batch or "").strip(),
            (it.expired_date or "").strip(), (it.production_date or "").strip(),
            pic_id, pic_name
        ))
        sb_items.append({
            "id": item_id, "sheet_id": sheet_id, "seq": idx + 1,
            "material_code": it.material_code.strip(), "material_name": it.material_name.strip(),
            "uom": (it.uom or "").strip(), "qty": float(it.qty or 0),
            "supplier_code": (it.supplier_code or sup_code).strip(), "supplier_name": (it.supplier_name or sup_name).strip(),
            "batch_fisik": (it.batch_fisik or "").strip(), "supplier_batch": (it.supplier_batch or "").strip(),
            "expired_date": (it.expired_date or "").strip(), "production_date": (it.production_date or "").strip(),
            "pic_id": pic_id, "pic_name": pic_name
        })

    # History Traceability Log
    hist_id = str(uuid.uuid4())
    initial_reason = "Dokumen tally sheet dibuat oleh Checker" if status == "draft" else "Dokumen diserahkan ke Admin Warehouse"
    conn.execute("""
        INSERT INTO tally_history (id, sheet_id, action, revision, at, by_name, by_id, by_role, from_status, to_status, category, reason)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, '', ?, '', ?)
    """, (hist_id, sheet_id, req.action, now, user["name"], user["id"], user.get("role", "checker"), status, initial_reason))

    conn.commit()
    conn.close()

    # Sync to Supabase cloud
    sb_sheet = {
        "id": sheet_id, "doc_no": doc_no, "status": status,
        "delivery_note_no": delivery_note, "po_no": po_num,
        "supplier_code": sup_code, "supplier_name": sup_name,
        "arrival_date": arr_date, "driver_name": drv_name, "truck_plate": trk_plate,
        "current_handler_role": handler_role, "current_handler_name": handler_name,
        "qa_doc_no": qa_code, "has_berita_acara": bool(has_ba), "ba_qa_doc_no": ba_qa_code,
        "ba_data_json": ba_json, "ba_container_no": ba_cont, "ba_seal_no": ba_seal,
        "ba_seal_condition": ba_seal_cond, "ba_container_temp": ba_temp,
        "created_by": user["id"], "created_by_name": user["name"], "created_at": now,
        "updated_by": user["id"], "updated_by_name": user["name"], "updated_at": now,
        "finalized_at": now if status == "completed" else None,
        "finalized_by": user["id"] if status == "completed" else None,
        "finalized_by_name": user["name"] if status == "completed" else None
    }
    sync_tally_to_supabase(sb_sheet, sb_items, {
        "id": hist_id, "sheet_id": sheet_id, "action": req.action, "revision": 1, "at": now,
        "by_name": user["name"], "by_id": user["id"], "by_role": user.get("role", "checker"),
        "from_status": "", "to_status": status, "category": "", "reason": initial_reason
    }, is_new=True)

    log_action = "submit_tally" if status == "waiting_admin" else ("create_tally" if status == "draft" else "finalize_tally")
    log_activity(user["id"], user["name"], log_action, "tally_sheet", sheet_id, f"Tally sheet {doc_no} ({status}) dengan {len(req.items)} item. SJ: {delivery_note}, PO: {po_num}")

    # Webhook & Notification Trigger: tally.submitted
    if status == "waiting_admin":
        WebhookService.dispatch("tally.submitted", sb_sheet, user, notes=initial_reason, extra={"previous_status": "draft"})
        NotificationService.dispatch("tally.submitted", sb_sheet, user, notes=initial_reason, extra={"previous_status": "draft"})

    return {"id": sheet_id, "doc_no": doc_no, "status": status}

@app.get("/api/tally-sheets/{sheet_id}")
def get_tally_sheet(sheet_id: str):
    conn = get_db()
    sync_from_supabase_if_needed(conn, sheet_id=sheet_id)
    sheet = conn.execute("SELECT * FROM tally_sheets WHERE id = ? OR doc_no = ?", (sheet_id, sheet_id)).fetchone()
    if not sheet:
        conn.close()
        raise HTTPException(status_code=404, detail="Tally sheet tidak ditemukan.")
    
    actual_id = sheet["id"]
    items = conn.execute("SELECT * FROM tally_items WHERE sheet_id = ? ORDER BY seq ASC", (actual_id,)).fetchall()

    qa_code_val = QADocumentRegistry.resolve_tally_code(sheet["qa_doc_no"] if "qa_doc_no" in sheet.keys() else None, conn)
    ba_qa_code_val = QADocumentRegistry.resolve_ba_code(sheet["ba_qa_doc_no"] if "ba_qa_doc_no" in sheet.keys() else None, conn)
    qa_meta_val = QADocumentRegistry.get_doc(QADocumentRegistry.KEY_TALLY, conn)
    ba_qa_meta_val = QADocumentRegistry.get_doc(QADocumentRegistry.KEY_BERITA_ACARA, conn)
    conn.close()

    item_list = []
    pic_names = set()
    for it in items:
        if it["pic_name"]:
            pic_names.add(it["pic_name"])
        item_list.append({
            "id": it["id"],
            "sheet_id": it["sheet_id"],
            "seq": it["seq"],
            "material_code": it["material_code"],
            "material_name": it["material_name"],
            "uom": it["uom"] if "uom" in it.keys() else "",
            "qty": it["qty"] if "qty" in it.keys() else 0,
            "supplier_code": it["supplier_code"] if "supplier_code" in it.keys() else "",
            "supplier_name": it["supplier_name"] if "supplier_name" in it.keys() else "",
            "batch_fisik": it["batch_fisik"],
            "supplier_batch": it["supplier_batch"],
            "expired_date": it["expired_date"],
            "production_date": it["production_date"],
            "pic_id": it["pic_id"],
            "pic_name": it["pic_name"]
        })

    sheet_sup_name = (sheet["supplier_name"] if "supplier_name" in sheet.keys() else "") or ""
    sheet_sup_code = (sheet["supplier_code"] if "supplier_code" in sheet.keys() else "") or ""
    if not sheet_sup_name and item_list:
        val_sups = [it["supplier_name"].strip() for it in item_list if (it.get("supplier_name") or "").strip()]
        if val_sups:
            sheet_sup_name = ", ".join(dict.fromkeys(val_sups))
    if not sheet_sup_code and item_list:
        val_codes = [it["supplier_code"].strip() for it in item_list if (it.get("supplier_code") or "").strip()]
        if val_codes:
            sheet_sup_code = ", ".join(dict.fromkeys(val_codes))

    return {
        "id": sheet["id"],
        "doc_no": sheet["doc_no"],
        "status": sheet["status"],
        "delivery_note_no": sheet["delivery_note_no"] if "delivery_note_no" in sheet.keys() else "",
        "po_no": sheet["po_no"] if "po_no" in sheet.keys() else "",
        "supplier_code": sheet_sup_code,
        "supplier_name": sheet_sup_name,
        "arrival_date": sheet["arrival_date"] if "arrival_date" in sheet.keys() else "",
        "driver_name": sheet["driver_name"] if "driver_name" in sheet.keys() else "",
        "truck_plate": sheet["truck_plate"] if "truck_plate" in sheet.keys() else "",
        "current_handler_role": sheet["current_handler_role"] if "current_handler_role" in sheet.keys() else "checker",
        "current_handler_name": sheet["current_handler_name"] if "current_handler_name" in sheet.keys() else "",
        "pending_reason": sheet["pending_reason"] if "pending_reason" in sheet.keys() else "",
        "pending_category": sheet["pending_category"] if "pending_category" in sheet.keys() else "",
        "qc_status": sheet["qc_status"] if "qc_status" in sheet.keys() else "",
        "qc_notes": sheet["qc_notes"] if "qc_notes" in sheet.keys() else "",
        "qc_by_name": sheet["qc_by_name"] if "qc_by_name" in sheet.keys() else "",
        "qc_at": sheet["qc_at"] if "qc_at" in sheet.keys() else "",
        "gr_no": sheet["gr_no"] if "gr_no" in sheet.keys() else "",
        "gr_by_name": sheet["gr_by_name"] if "gr_by_name" in sheet.keys() else "",
        "gr_at": sheet["gr_at"] if "gr_at" in sheet.keys() else "",
        "gr_notes": sheet["gr_notes"] if "gr_notes" in sheet.keys() else "",
        "created_by": sheet["created_by"],
        "created_by_name": sheet["created_by_name"],
        "created_at": sheet["created_at"],
        "updated_by": sheet["updated_by"],
        "updated_by_name": sheet["updated_by_name"],
        "updated_at": sheet["updated_at"],
        "finalized_at": sheet["finalized_at"],
        "finalized_by": sheet["finalized_by"],
        "finalized_by_name": sheet["finalized_by_name"],
        "cancelled_at": sheet["cancelled_at"],
        "cancelled_by": sheet["cancelled_by"],
        "cancelled_by_name": sheet["cancelled_by_name"],
        "cancel_reason": sheet["cancel_reason"],
        "qa_doc_no": qa_code_val,
        "has_berita_acara": bool(sheet["has_berita_acara"]) if "has_berita_acara" in sheet.keys() else False,
        "ba_qa_doc_no": ba_qa_code_val,
        "qa_meta": qa_meta_val,
        "ba_qa_meta": ba_qa_meta_val,
        "ba_container_no": sheet["ba_container_no"] if "ba_container_no" in sheet.keys() else "",
        "ba_seal_no": sheet["ba_seal_no"] if "ba_seal_no" in sheet.keys() else "",
        "ba_seal_condition": sheet["ba_seal_condition"] if "ba_seal_condition" in sheet.keys() else "",
        "ba_container_temp": sheet["ba_container_temp"] if "ba_container_temp" in sheet.keys() else "",
        "berita_acara": json.loads(sheet["ba_data_json"]) if ("ba_data_json" in sheet.keys() and sheet["ba_data_json"]) else {},
        "pic_names": list(pic_names),
        "items": item_list
    }

@app.put("/api/tally-sheets/{sheet_id}")
def update_tally_sheet(sheet_id: str, req: TallySheetInput, user: dict = Depends(get_current_user)):
    conn = get_db()
    if not PermissionService.has_permission(conn, user.get("role", "user"), "tally_edit"):
        conn.close()
        raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user.get('role')}' tidak memiliki izin 'tally_edit' untuk mengubah dokumen Tally Sheet.")

    if req.action not in ("draft", "submit_to_admin"):
        conn.close()
        raise HTTPException(status_code=400, detail="Aksi tidak valid. Hanya 'draft' atau 'submit_to_admin' yang diizinkan saat mengedit dokumen.")

    if req.action == "submit_to_admin" and not PermissionService.has_permission(conn, user.get("role", "user"), "tally_submit"):
        conn.close()
        raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user.get('role')}' tidak memiliki izin 'tally_submit' untuk menyerahkan dokumen ke Admin.")

    sync_from_supabase_if_needed(conn, sheet_id=sheet_id)
    sheet_row = conn.execute("SELECT * FROM tally_sheets WHERE id = ? OR doc_no = ?", (sheet_id, sheet_id)).fetchone()
    if not sheet_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Tally sheet tidak ditemukan.")
    
    sheet = dict(sheet_row)
    
    if sheet["status"] not in ("draft", "admin_hold", "returned_to_checker"):
        conn.close()
        raise HTTPException(status_code=400, detail="Hanya dokumen Draft atau Revisi yang dapat diubah barisnya.")
    
    validate_items(conn, req.items, req.action, sheet_id=sheet["id"])

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    actual_id = sheet["id"]

    delivery_note = (req.delivery_note_no or sheet.get("delivery_note_no") or "").strip()
    po_num = (req.po_no or sheet.get("po_no") or "").strip()
    sup_code = (req.supplier_code or sheet.get("supplier_code") or "").strip()
    sup_name = (req.supplier_name or sheet.get("supplier_name") or "").strip()

    # Always ensure supplier_name and supplier_code reflect items if revised or missing
    if req.items:
        val_sups = [it.supplier_name.strip() for it in req.items if (it.supplier_name or "").strip()]
        if val_sups:
            sup_name = ", ".join(dict.fromkeys(val_sups))
        val_codes = [it.supplier_code.strip() for it in req.items if (it.supplier_code or "").strip()]
        if val_codes:
            sup_code = ", ".join(dict.fromkeys(val_codes))
    arr_date = (req.arrival_date or sheet.get("arrival_date") or "").strip() or now[:10]
    drv_name = (req.driver_name or sheet.get("driver_name") or "").strip()
    trk_plate = (req.truck_plate or sheet.get("truck_plate") or "").strip()

    if not trk_plate:
        conn.close()
        raise HTTPException(status_code=400, detail="Nomor Polisi Armada Truk wajib diisi (Mandatory).")

    # Duplicate Delivery Note check on update & submission
    if delivery_note and req.action == "submit_to_admin":
        dup_sj = conn.execute("""
            SELECT doc_no, status, arrival_date FROM tally_sheets
            WHERE status != 'cancelled'
            AND id != ?
            AND upper(trim(delivery_note_no)) = ?
        """, (actual_id, delivery_note.upper(),)).fetchone()
        if dup_sj:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail=f"Nomor Surat Jalan '{delivery_note}' sudah terdaftar pada dokumen {dup_sj['doc_no']} (Status: {dup_sj['status'].upper()}). Harap periksa kembali untuk menghindari penerimaan ganda (double-receiving)."
            )

    # Workflow Status determination - completed ONLY via QC approval
    if req.action == "submit_to_admin":
        new_status = "waiting_admin"
        handler_role = "warehouse_admin"
        handler_name = ""
    else:
        new_status = "draft"
        handler_role = "checker"
        handler_name = user["name"]

    current_sheet_qa = sheet.get("qa_doc_no")
    qa_code = QADocumentRegistry.resolve_tally_code(req.qa_doc_no or current_sheet_qa, conn)
    has_ba = 1 if req.has_berita_acara else (1 if (sheet.get("has_berita_acara") and req.has_berita_acara is not False) else 0)
    current_sheet_ba_qa = sheet.get("ba_qa_doc_no")
    ba_qa_code = QADocumentRegistry.resolve_ba_code(req.ba_qa_doc_no or current_sheet_ba_qa, conn)

    if req.berita_acara:
        ba_rec = BeritaAcaraRecord(req.berita_acara)
    elif sheet.get("ba_data_json"):
        try:
            ba_rec = BeritaAcaraRecord(json.loads(sheet["ba_data_json"]))
        except Exception:
            ba_rec = BeritaAcaraRecord()
    else:
        ba_rec = BeritaAcaraRecord()

    ba_json = json.dumps(ba_rec.to_dict()) if has_ba else "{}"
    ba_cont = ba_rec.container_no if has_ba else ""
    ba_seal = ba_rec.seal_no if has_ba else ""
    ba_seal_cond = ba_rec.seal_condition if has_ba else ""
    ba_temp = ba_rec.container_temp_type if has_ba else ""

    new_pending_cat = "" if new_status == "waiting_admin" else (sheet.get("pending_category") or "")
    new_pending_rsn = "" if new_status == "waiting_admin" else (sheet.get("pending_reason") or "")

    conn.execute("""
        UPDATE tally_sheets 
        SET status = ?, updated_by = ?, updated_by_name = ?, updated_at = ?,
            finalized_at = ?, finalized_by = ?, finalized_by_name = ?,
            delivery_note_no = ?, po_no = ?, supplier_code = ?, supplier_name = ?,
            arrival_date = ?, driver_name = ?, truck_plate = ?,
            current_handler_role = ?, current_handler_name = ?,
            qa_doc_no = ?, has_berita_acara = ?, ba_qa_doc_no = ?, ba_data_json = ?,
            ba_container_no = ?, ba_seal_no = ?, ba_seal_condition = ?, ba_container_temp = ?,
            pending_category = ?, pending_reason = ?
        WHERE id = ?
    """, (
        new_status, user["id"], user["name"], now,
        now if new_status == "completed" else None, user["id"] if new_status == "completed" else None, user["name"] if new_status == "completed" else None,
        delivery_note, po_num, sup_code, sup_name, arr_date, drv_name, trk_plate,
        handler_role, handler_name,
        qa_code, has_ba, ba_qa_code, ba_json, ba_cont, ba_seal, ba_seal_cond, ba_temp,
        new_pending_cat, new_pending_rsn,
        actual_id
    ))

    # Replace items
    conn.execute("DELETE FROM tally_items WHERE sheet_id = ?", (actual_id,))
    u_map = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM users").fetchall()}

    sb_items = []
    for idx, it in enumerate(req.items):
        item_id = str(uuid.uuid4())
        pic_id = it.pic_id or user["id"]
        pic_name = u_map.get(pic_id, it.pic_name or user["name"])
        conn.execute("""
            INSERT INTO tally_items 
            (id, sheet_id, seq, material_code, material_name, uom, qty, supplier_code, supplier_name, batch_fisik, supplier_batch, expired_date, production_date, pic_id, pic_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item_id, actual_id, idx + 1, it.material_code.strip(), it.material_name.strip(),
            (it.uom or "").strip(), float(it.qty or 0),
            (it.supplier_code or sup_code).strip(), (it.supplier_name or sup_name).strip(),
            (it.batch_fisik or "").strip(), (it.supplier_batch or "").strip(),
            (it.expired_date or "").strip(), (it.production_date or "").strip(),
            pic_id, pic_name
        ))
        sb_items.append({
            "id": item_id, "sheet_id": actual_id, "seq": idx + 1,
            "material_code": it.material_code.strip(), "material_name": it.material_name.strip(),
            "uom": (it.uom or "").strip(), "qty": float(it.qty or 0),
            "supplier_code": (it.supplier_code or sup_code).strip(), "supplier_name": (it.supplier_name or sup_name).strip(),
            "batch_fisik": (it.batch_fisik or "").strip(), "supplier_batch": (it.supplier_batch or "").strip(),
            "expired_date": (it.expired_date or "").strip(), "production_date": (it.production_date or "").strip(),
            "pic_id": pic_id, "pic_name": pic_name
        })

    # Revisions count
    rev_count = conn.execute("SELECT count(*) FROM tally_history WHERE sheet_id = ?", (actual_id,)).fetchone()[0] or 1
    next_rev = rev_count + 1

    action_name = req.action
    hist_reason = "Dokumen diperbarui oleh Checker" if new_status == "draft" else "Dokumen diserahkan ke Admin Warehouse"
    hist_id = str(uuid.uuid4())
    conn.execute("""
        INSERT INTO tally_history (id, sheet_id, action, revision, at, by_name, by_id, by_role, from_status, to_status, category, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
    """, (hist_id, actual_id, action_name, next_rev, now, user["name"], user["id"], user.get("role", "checker"), sheet["status"], new_status, hist_reason))

    conn.commit()
    conn.close()

    # Sync to Supabase
    sb_sheet = {
        "id": actual_id, "doc_no": sheet["doc_no"], "status": new_status,
        "delivery_note_no": delivery_note, "po_no": po_num,
        "supplier_code": sup_code, "supplier_name": sup_name,
        "arrival_date": arr_date, "driver_name": drv_name, "truck_plate": trk_plate,
        "current_handler_role": handler_role, "current_handler_name": handler_name,
        "pending_category": new_pending_cat, "pending_reason": new_pending_rsn,
        "qa_doc_no": qa_code, "has_berita_acara": bool(has_ba), "ba_qa_doc_no": ba_qa_code,
        "ba_data_json": ba_json, "ba_container_no": ba_cont, "ba_seal_no": ba_seal,
        "ba_seal_condition": ba_seal_cond, "ba_container_temp": ba_temp,
        "updated_by": user["id"], "updated_by_name": user["name"], "updated_at": now,
        "finalized_at": now if new_status == "completed" else sheet["finalized_at"],
        "finalized_by": user["id"] if new_status == "completed" else sheet["finalized_by"],
        "finalized_by_name": user["name"] if new_status == "completed" else sheet["finalized_by_name"]
    }
    sync_tally_to_supabase(sb_sheet, sb_items, {
        "id": hist_id, "sheet_id": actual_id, "action": action_name, "revision": next_rev, "at": now,
        "by_name": user["name"], "by_id": user["id"], "by_role": user.get("role", "checker"),
        "from_status": sheet["status"], "to_status": new_status, "category": "", "reason": hist_reason
    })

    log_activity(user["id"], user["name"], f"update_{new_status}", "tally_sheet", actual_id, f"Tally sheet {sheet['doc_no']} ({new_status}) diperbarui")

    # Webhook & Notification Trigger: tally.submitted jika diserahkan ke admin
    if new_status == "waiting_admin" and sheet["status"] != "waiting_admin":
        WebhookService.dispatch("tally.submitted", sb_sheet, user, notes=hist_reason, extra={"previous_status": sheet["status"]})
        NotificationService.dispatch("tally.submitted", sb_sheet, user, notes=hist_reason, extra={"previous_status": sheet["status"]})

    return {"id": actual_id, "doc_no": sheet["doc_no"], "status": new_status}

@app.post("/api/tally-sheets/{sheet_id}/transition")
def transition_tally_sheet(sheet_id: str, req: WorkflowTransitionInput, user: dict = Depends(get_current_user)):
    conn = get_db()
    sync_from_supabase_if_needed(conn, sheet_id=sheet_id)
    sheet = conn.execute("SELECT * FROM tally_sheets WHERE id = ? OR doc_no = ?", (sheet_id, sheet_id)).fetchone()
    if not sheet:
        conn.close()
        raise HTTPException(status_code=404, detail="Tally sheet tidak ditemukan.")

    if sheet["status"] == "cancelled":
        conn.close()
        raise HTTPException(status_code=400, detail="Dokumen yang dibatalkan tidak dapat diproses lebih lanjut.")
    if sheet["status"] == "completed":
        conn.close()
        raise HTTPException(status_code=400, detail="Dokumen sudah selesai (GR Posted) dan terkunci.")

    action = req.action.strip()
    res = WorkflowManager.execute_transition(conn, dict(sheet), action, req.dict(), user)
    conn.commit()
    conn.close()

    # Sync transition to Supabase
    sync_tally_to_supabase({
        "id": res["actual_id"], "doc_no": res["doc_no"], "status": res["new_status"],
        "current_handler_role": res["new_handler_role"], "current_handler_name": res["new_handler_name"],
        "pending_category": res["pending_category"], "pending_reason": res["pending_reason"],
        "qc_status": res["qc_status"], "qc_notes": res["qc_notes"], "qc_by_name": res["qc_by_name"], "qc_at": res["qc_at"],
        "finalized_at": res["finalized_at"], "finalized_by": res["finalized_by"], "finalized_by_name": res["finalized_by_name"],
        "updated_at": res["updated_at"], "updated_by": res["updated_by"], "updated_by_name": res["updated_by_name"]
    }, None, {
        "id": res["hist_id"], "sheet_id": res["actual_id"], "action": action, "revision": res["revision"],
        "at": res["updated_at"], "by_name": user["name"], "by_id": user["id"], "by_role": user.get("role", "admin"),
        "from_status": res["old_status"], "to_status": res["new_status"], "category": res["pending_category"], "reason": res["pending_reason"] or res["log_detail"]
    })

    log_activity(user["id"], user["name"], f"transition_{action}", "tally_sheet", res["actual_id"], res["log_detail"])

    # Webhook triggers for workflow transitions
    event_map = {
        "send_to_qc": "tally.verified_to_qc",
        "verify_to_qc": "tally.verified_to_qc",
        "admin_hold": "tally.held",
        "qc_hold": "tally.held",
        "qc_approve": "tally.approved_stock_uu",
        "qc_reject": "tally.rejected",
        "return_to_checker": "tally.returned_to_checker"
    }
    primary_event = event_map.get(action)
    sheet_summary = {
        **dict(sheet),
        "id": res["actual_id"],
        "status": res["new_status"],
        "pending_category": res["pending_category"],
        "pending_reason": res["pending_reason"]
    }
    if res["old_status"] in ["admin_hold", "qc_hold"] and res["new_status"] not in ["admin_hold", "qc_hold"]:
        unhold_note = req.dict().get("resolution_notes") or req.dict().get("reason") or res["log_detail"]
        WebhookService.dispatch("tally.unheld", sheet_summary, user, notes=unhold_note, extra={"previous_status": res["old_status"]})
        NotificationService.dispatch("tally.unheld", sheet_summary, user, notes=unhold_note, extra={"previous_status": res["old_status"]})

    if primary_event:
        WebhookService.dispatch(primary_event, sheet_summary, user, notes=res["pending_reason"] or res["log_detail"], extra={"previous_status": res["old_status"]})
        NotificationService.dispatch(primary_event, sheet_summary, user, notes=res["pending_reason"] or res["log_detail"], extra={"previous_status": res["old_status"]})

    return {
        "message": f"Dokumen berhasil diperbarui ke status '{res['new_status']}'",
        "status": res["new_status"],
        "current_handler_role": res["new_handler_role"]
    }

class CancelRequest(BaseModel):
    reason: str

@app.post("/api/tally-sheets/{sheet_id}/cancel")
def cancel_tally_sheet(sheet_id: str, req: CancelRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    sync_from_supabase_if_needed(conn, sheet_id=sheet_id)
    sheet = conn.execute("SELECT * FROM tally_sheets WHERE id = ? OR doc_no = ?", (sheet_id, sheet_id)).fetchone()
    if not sheet:
        conn.close()
        raise HTTPException(status_code=404, detail="Tally sheet tidak ditemukan.")
    if sheet["status"] == "cancelled":
        conn.close()
        raise HTTPException(status_code=400, detail="Dokumen sudah dibatalkan sebelumnya.")
    if user["role"] != "admin" and (sheet["status"] != "draft" or sheet["created_by"] != user["id"]):
        conn.close()
        raise HTTPException(status_code=403, detail="Hanya Admin atau pembuat draft yang dapat membatalkan dokumen.")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    actual_id = sheet["id"]
    conn.execute("""
        UPDATE tally_sheets 
        SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancelled_by_name = ?, cancel_reason = ?,
            current_handler_role = 'closed'
        WHERE id = ?
    """, (now, user["id"], user["name"], req.reason.strip(), actual_id))

    rev_count = conn.execute("SELECT count(*) FROM tally_history WHERE sheet_id = ?", (actual_id,)).fetchone()[0] or 1
    hist_id = str(uuid.uuid4())
    conn.execute("""
        INSERT INTO tally_history (id, sheet_id, action, revision, at, by_name, by_id, by_role, from_status, to_status, category, reason)
        VALUES (?, ?, 'cancel', ?, ?, ?, ?, ?, ?, 'cancelled', 'Pembatalan Dokumen', ?)
    """, (hist_id, actual_id, rev_count + 1, now, user["name"], user["id"], user.get("role", "admin"), sheet["status"], req.reason.strip()))

    conn.commit()
    conn.close()

    # Sync cancel to Supabase
    sync_tally_to_supabase({
        "id": actual_id, "doc_no": sheet["doc_no"], "status": "cancelled",
        "cancelled_at": now, "cancelled_by": user["id"], "cancelled_by_name": user["name"],
        "cancel_reason": req.reason.strip(), "updated_at": now, "updated_by": user["id"], "updated_by_name": user["name"],
        "current_handler_role": "closed"
    }, None, {
        "id": hist_id, "sheet_id": actual_id, "action": "cancel", "revision": rev_count + 1,
        "at": now, "by_name": user["name"], "by_id": user["id"], "by_role": user.get("role", "admin"),
        "from_status": sheet["status"], "to_status": "cancelled", "category": "Pembatalan Dokumen", "reason": req.reason.strip()
    })

    log_activity(user["id"], user["name"], "cancel_tally", "tally_sheet", actual_id, f"Tally sheet {sheet['doc_no']} dibatalkan: {req.reason.strip()}")

    # Webhook Trigger: tally.cancelled
    WebhookService.dispatch("tally.cancelled", {
        **dict(sheet),
        "id": actual_id,
        "status": "cancelled",
        "cancel_reason": req.reason.strip()
    }, user, notes=req.reason.strip(), extra={"previous_status": sheet["status"]})

    return {"message": "Tally sheet berhasil dibatalkan"}

@app.post("/api/tally-sheets/{sheet_id}/berita-acara")
def attach_or_update_berita_acara(sheet_id: str, req: BeritaAcaraAttachInput, user: dict = Depends(get_current_user)):
    conn = get_db()
    sync_from_supabase_if_needed(conn, sheet_id=sheet_id)
    sheet_row = conn.execute("SELECT * FROM tally_sheets WHERE id = ? OR doc_no = ?", (sheet_id, sheet_id)).fetchone()
    if not sheet_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Tally sheet tidak ditemukan.")

    sheet = dict(sheet_row)
    if sheet["status"] == "cancelled":
        conn.close()
        raise HTTPException(status_code=400, detail="Dokumen yang dibatalkan tidak dapat ditambahkan Berita Acara.")

    cont_no = (req.container_no or "").strip()
    if not cont_no:
        conn.close()
        raise HTTPException(status_code=400, detail="Nomor Container / Box Truk wajib diisi.")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    actual_id = sheet["id"]

    ba_qa_code = QADocumentRegistry.resolve_ba_code(req.ba_qa_doc_no or sheet.get("ba_qa_doc_no"), conn)
    ba_rec = BeritaAcaraRecord(req.dict())
    ba_json = json.dumps(ba_rec.to_dict())

    conn.execute("""
        UPDATE tally_sheets
        SET has_berita_acara = 1,
            ba_qa_doc_no = ?,
            ba_data_json = ?,
            ba_container_no = ?,
            ba_seal_no = ?,
            ba_seal_condition = ?,
            ba_container_temp = ?,
            updated_at = ?,
            updated_by = ?,
            updated_by_name = ?
        WHERE id = ?
    """, (
        ba_qa_code,
        ba_json,
        ba_rec.container_no,
        ba_rec.seal_no,
        ba_rec.seal_condition,
        ba_rec.container_temp_type,
        now,
        user["id"],
        user["name"],
        actual_id
    ))

    rev_count = conn.execute("SELECT count(*) FROM tally_history WHERE sheet_id = ?", (actual_id,)).fetchone()[0] or 1
    hist_id = str(uuid.uuid4())
    is_update = bool(sheet.get("has_berita_acara"))
    action_type = "update_berita_acara" if is_update else "attach_berita_acara"
    hist_desc = f"Berita Acara {ba_rec.arrival_type.upper()} ({ba_qa_code}) {'diperbarui' if is_update else 'dilampirkan'} oleh {user['name']}"

    conn.execute("""
        INSERT INTO tally_history (id, sheet_id, action, revision, at, by_name, by_id, by_role, from_status, to_status, category, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Berita Acara', ?)
    """, (
        hist_id,
        actual_id,
        action_type,
        rev_count + 1,
        now,
        user["name"],
        user["id"],
        user.get("role", "checker"),
        sheet["status"],
        sheet["status"],
        hist_desc
    ))

    conn.commit()
    conn.close()

    sync_tally_to_supabase({
        "id": actual_id,
        "has_berita_acara": 1,
        "ba_qa_doc_no": ba_qa_code,
        "ba_data_json": ba_json,
        "ba_container_no": ba_rec.container_no,
        "ba_seal_no": ba_rec.seal_no,
        "ba_seal_condition": ba_rec.seal_condition,
        "ba_container_temp": ba_rec.container_temp_type,
        "updated_at": now,
        "updated_by": user["id"],
        "updated_by_name": user["name"]
    }, None, {
        "id": hist_id,
        "sheet_id": actual_id,
        "action": action_type,
        "revision": rev_count + 1,
        "at": now,
        "by_name": user["name"],
        "by_id": user["id"],
        "by_role": user.get("role", "checker"),
        "from_status": sheet["status"],
        "to_status": sheet["status"],
        "category": "Berita Acara",
        "reason": hist_desc
    })

    log_activity(user["id"], user["name"], action_type, "tally_sheet", actual_id, hist_desc)

    return {
        "message": f"Berita Acara berhasil {'diperbarui' if is_update else 'dilampirkan'}.",
        "has_berita_acara": True,
        "ba_qa_doc_no": ba_qa_code,
        "berita_acara": ba_rec.to_dict()
    }

@app.get("/api/tally-sheets/{sheet_id}/history")
def get_tally_history(sheet_id: str):
    conn = get_db()
    sheet = conn.execute("SELECT id FROM tally_sheets WHERE id = ? OR doc_no = ?", (sheet_id, sheet_id)).fetchone()
    actual_id = sheet["id"] if sheet else sheet_id

    # Sync history from Supabase cloud so serverless lambdas always have up-to-date audit trail
    if SUPABASE_KEY and SUPABASE_URL:
        try:
            r = requests.get(
                f"{SUPABASE_URL}/rest/v1/tally_history?sheet_id=eq.{actual_id}&order=revision.asc",
                headers=get_sb_headers(),
                timeout=4
            )
            if r.status_code == 200:
                rows_sb = r.json()
                for h in rows_sb:
                    conn.execute("""
                        INSERT OR REPLACE INTO tally_history 
                        (id, sheet_id, action, revision, at, by_name, by_id, by_role, from_status, to_status, category, reason)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        h["id"], h["sheet_id"], h["action"], h.get("revision", 1), h["at"],
                        h.get("by_name", ""), h.get("by_id", ""), h.get("by_role", "user"),
                        h.get("from_status", ""), h.get("to_status", ""), h.get("category", ""), h.get("reason", "")
                    ))
                conn.commit()
        except Exception as e:
            print("Notice: fetch history from Supabase warning:", e)

    rows = conn.execute("SELECT * FROM tally_history WHERE sheet_id = ? ORDER BY revision ASC", (actual_id,)).fetchall()
    conn.close()
    return [{
        "id": r["id"],
        "sheet_id": r["sheet_id"],
        "action": r["action"],
        "revision": r["revision"],
        "at": r["at"],
        "by_name": r["by_name"],
        "by_id": r["by_id"],
        "by_role": r["by_role"] if "by_role" in r.keys() else "user",
        "from_status": r["from_status"] if "from_status" in r.keys() else "",
        "to_status": r["to_status"] if "to_status" in r.keys() else "",
        "category": r["category"] if "category" in r.keys() else "",
        "reason": r["reason"] if "reason" in r.keys() else ""
    } for r in rows]

# ----------------- EXCEL EXPORT -----------------
@app.get("/api/tally-sheets/{sheet_id}/export")
def export_tally_sheet(sheet_id: str):
    conn = get_db()
    sheet = conn.execute("SELECT * FROM tally_sheets WHERE id = ? OR doc_no = ?", (sheet_id, sheet_id)).fetchone()
    if not sheet:
        sync_from_supabase_if_needed(conn, sheet_id=sheet_id)
        sheet = conn.execute("SELECT * FROM tally_sheets WHERE id = ? OR doc_no = ?", (sheet_id, sheet_id)).fetchone()
    if not sheet:
        conn.close()
        raise HTTPException(status_code=404, detail="Tally sheet tidak ditemukan.")
    sheet = dict(sheet)
    
    actual_id = sheet["id"]
    items = conn.execute("SELECT * FROM tally_items WHERE sheet_id = ? ORDER BY seq ASC", (actual_id,)).fetchall()
    conn.close()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Tally Sheet"

    # Header styling
    title_font = Font(name="Arial", size=14, bold=True, color="0B2149")
    meta_font = Font(name="Arial", size=10)
    meta_bold = Font(name="Arial", size=10, bold=True)
    th_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    th_fill = PatternFill(start_color="0B2149", end_color="0B2149", fill_type="solid")
    border_thin = Border(
        left=Side(style='thin', color='D3D3D3'),
        right=Side(style='thin', color='D3D3D3'),
        top=Side(style='thin', color='D3D3D3'),
        bottom=Side(style='thin', color='D3D3D3')
    )

    ws.merge_cells("A1:H1")
    ws["A1"] = "PT DIAMOND COLD STORAGE (PLANT 2111) - TALLY SHEET MATERIAL"
    ws["A1"].font = title_font
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    if LOGO_PATH.exists():
        try:
            from openpyxl.drawing.image import Image as OpenpyxlImage
            logo_img = OpenpyxlImage(str(LOGO_PATH))
            target_h = 42
            target_w = int(logo_img.width * (target_h / logo_img.height)) if logo_img.height else 42
            logo_img.width = target_w
            logo_img.height = target_h
            ws.add_image(logo_img, "J1")
        except Exception as e:
            print("Notice: could not add logo to tally excel:", e)

    ws["A3"] = "No. Transaksi:"
    ws["A3"].font = meta_bold
    ws["B3"] = sheet["doc_no"]
    ws["B3"].font = meta_font

    qa_code_val = QADocumentRegistry.resolve_tally_code(sheet.get("qa_doc_no"), conn)
    ws["C3"] = "No. Dokumen QA:"
    ws["C3"].font = meta_bold
    ws["D3"] = qa_code_val
    ws["D3"].font = meta_font

    ws["E3"] = "Tanggal:"
    ws["E3"].font = meta_bold
    ws["F3"] = sheet["created_at"][:10]
    ws["F3"].font = meta_font

    ws["A4"] = "Status:"
    ws["A4"].font = meta_bold
    ws["B4"] = sheet["status"].upper()
    ws["B4"].font = meta_font

    ws["E4"] = "Dibuat Oleh:"
    ws["E4"].font = meta_bold
    ws["F4"] = sheet["created_by_name"]
    ws["F4"].font = meta_font

    headers = ["No. Urut", "Kode Material", "Nama Material", "UOM", "Supplier", "Qty", "Batch Fisik", "Produsen", "Expired Date", "Production Date", "PIC"]
    row_idx = 6

    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=row_idx, column=col_idx, value=h)
        cell.font = th_font
        cell.fill = th_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for it in items:
        row_idx += 1
        ws.cell(row=row_idx, column=1, value=it["seq"]).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=2, value=it["material_code"]).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=3, value=it["material_name"])
        ws.cell(row=row_idx, column=4, value=it["uom"] if "uom" in it.keys() else "").alignment = Alignment(horizontal="center")
        s_code = it["supplier_code"] if "supplier_code" in it.keys() else ""
        s_name = it["supplier_name"] if "supplier_name" in it.keys() else ""
        supplier_display = f"{s_code} - {s_name}" if (s_code and s_name) else (s_name or s_code or "")
        ws.cell(row=row_idx, column=5, value=supplier_display)
        qty_val = float(it["qty"]) if ("qty" in it.keys() and it["qty"] is not None) else 0.0
        ws.cell(row=row_idx, column=6, value=qty_val).alignment = Alignment(horizontal="right")
        ws.cell(row=row_idx, column=7, value=it["batch_fisik"])
        ws.cell(row=row_idx, column=8, value=it["supplier_batch"])
        ws.cell(row=row_idx, column=9, value=it["expired_date"]).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=10, value=it["production_date"]).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=11, value=it["pic_name"])

        for col_idx in range(1, 12):
            ws.cell(row=row_idx, column=col_idx).border = border_thin

    # Column widths
    col_widths = [10, 18, 35, 10, 25, 12, 18, 18, 15, 15, 20]
    for col_idx, width in enumerate(col_widths, start=1):
        col_letter = openpyxl.utils.get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"TallySheet_{sheet['doc_no']}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ----------------- ISO 9001 / AUDIT REPORTING ENDPOINTS -----------------
@app.get("/api/reports/summary")
def get_reports_summary(
    start_date: str = "",
    end_date: str = "",
    status: str = "all",
    supplier: str = "",
    q: str = "",
    page: int = 1,
    limit: int = 25,
    user: dict = Depends(get_current_user)
):
    conn = get_db()
    sync_from_supabase_if_needed(conn)

    where_clauses = ["1=1"]
    params = []

    if start_date.strip():
        where_clauses.append("(ts.arrival_date >= ? OR substr(ts.created_at, 1, 10) >= ?)")
        params.extend([start_date.strip(), start_date.strip()])
    if end_date.strip():
        where_clauses.append("(ts.arrival_date <= ? OR substr(ts.created_at, 1, 10) <= ?)")
        params.extend([end_date.strip(), end_date.strip()])
    if status.strip() and status != "all":
        if status == "hold":
            where_clauses.append("ts.status IN ('hold_admin', 'hold_qc')")
        elif status == "in_progress":
            where_clauses.append("ts.status IN ('draft', 'waiting_admin', 'waiting_qc')")
        elif status == "completed":
            where_clauses.append("ts.status = 'completed'")
        else:
            where_clauses.append("ts.status = ?")
            params.append(status.strip())
    if supplier.strip():
        where_clauses.append("(ts.supplier_code LIKE ? OR ts.supplier_name LIKE ? OR ti.supplier_code LIKE ? OR ti.supplier_name LIKE ?)")
        s_wild = f"%{supplier.strip()}%"
        params.extend([s_wild, s_wild, s_wild, s_wild])
    if q.strip():
        q_wild = f"%{q.strip()}%"
        where_clauses.append("(ts.doc_no LIKE ? OR ts.delivery_note_no LIKE ? OR ts.po_no LIKE ? OR ts.truck_plate LIKE ? OR ti.material_code LIKE ? OR ti.material_name LIKE ? OR ti.batch_fisik LIKE ?)")
        params.extend([q_wild, q_wild, q_wild, q_wild, q_wild, q_wild, q_wild])

    where_str = " AND ".join(where_clauses)

    kpi_query = f"""
        SELECT 
            count(DISTINCT ts.id) as total_docs,
            count(ti.id) as total_items,
            coalesce(sum(ti.qty), 0) as total_qty,
            count(DISTINCT CASE WHEN ts.status = 'completed' THEN ts.id END) as completed_docs,
            count(DISTINCT CASE WHEN ts.status IN ('hold_admin', 'hold_qc') THEN ts.id END) as hold_docs,
            count(DISTINCT CASE WHEN ts.status IN ('draft', 'waiting_admin', 'waiting_qc') THEN ts.id END) as in_progress_docs,
            count(DISTINCT CASE WHEN ts.status = 'cancelled' THEN ts.id END) as cancelled_docs
        FROM tally_sheets ts
        LEFT JOIN tally_items ti ON ts.id = ti.sheet_id
        WHERE {where_str}
    """
    kpi_row = conn.execute(kpi_query, params).fetchone()
    total_docs = kpi_row["total_docs"] or 0
    completed_docs = kpi_row["completed_docs"] or 0
    first_pass_yield = round((completed_docs / total_docs * 100), 1) if total_docs > 0 else 100.0

    kpi = {
        "total_docs": total_docs,
        "total_items": kpi_row["total_items"] or 0,
        "total_qty": round(float(kpi_row["total_qty"] or 0), 2),
        "completed_docs": completed_docs,
        "hold_docs": kpi_row["hold_docs"] or 0,
        "in_progress_docs": kpi_row["in_progress_docs"] or 0,
        "cancelled_docs": kpi_row["cancelled_docs"] or 0,
        "first_pass_yield": first_pass_yield
    }

    count_items_query = f"""
        SELECT count(ti.id)
        FROM tally_sheets ts
        JOIN tally_items ti ON ts.id = ti.sheet_id
        WHERE {where_str}
    """
    total_items = conn.execute(count_items_query, params).fetchone()[0]

    offset = (page - 1) * limit
    items_query = f"""
        SELECT 
            ti.id, ti.sheet_id, ti.seq, ti.material_code, ti.material_name, ti.uom, ti.qty,
            ti.supplier_code, ti.supplier_name, ti.batch_fisik, ti.supplier_batch,
            ti.expired_date, ti.production_date, ti.pic_name,
            ts.doc_no, ts.delivery_note_no, ts.po_no, ts.truck_plate, ts.arrival_date,
            ts.status, ts.created_by_name, ts.updated_by_name, ts.qc_by_name, ts.qc_at,
            ts.pending_category, ts.pending_reason, ts.created_at,
            ts.has_berita_acara, ts.ba_qa_doc_no
        FROM tally_sheets ts
        JOIN tally_items ti ON ts.id = ti.sheet_id
        WHERE {where_str}
        ORDER BY ts.arrival_date DESC, ts.created_at DESC, ti.seq ASC
        LIMIT ? OFFSET ?
    """
    rows = conn.execute(items_query, params + [limit, offset]).fetchall()

    # 4. Vendor Performance (ISO 9001 Clause 8.4 Evaluation)
    vendor_query = f"""
        SELECT 
            coalesce(nullif(ti.supplier_name, ''), ts.supplier_name, 'Tanpa Vendor') as supplier_name,
            coalesce(nullif(ti.supplier_code, ''), ts.supplier_code, '-') as supplier_code,
            count(DISTINCT ts.id) as total_docs,
            count(ti.id) as total_items,
            coalesce(sum(ti.qty), 0) as total_qty,
            count(DISTINCT CASE WHEN ts.status = 'completed' THEN ts.id END) as completed_docs,
            count(DISTINCT CASE WHEN ts.status IN ('hold_admin', 'hold_qc') THEN ts.id END) as hold_docs
        FROM tally_sheets ts
        LEFT JOIN tally_items ti ON ts.id = ti.sheet_id
        WHERE {where_str}
        GROUP BY coalesce(nullif(ti.supplier_name, ''), ts.supplier_name, 'Tanpa Vendor')
        ORDER BY total_docs DESC, total_qty DESC
    """
    vendor_rows = conn.execute(vendor_query, params).fetchall()
    vendor_perf = []
    for vr in vendor_rows:
        v_total = vr["total_docs"] or 0
        v_comp = vr["completed_docs"] or 0
        v_rate = round((v_comp / v_total * 100), 1) if v_total > 0 else 100.0
        if v_rate >= 98.0:
            grade = "Grade A (Excellent)"
            grade_color = "emerald"
        elif v_rate >= 90.0:
            grade = "Grade B (Perhatian)"
            grade_color = "amber"
        else:
            grade = "Grade C (Kritis / NCR)"
            grade_color = "rose"

        vendor_perf.append({
            "supplier_name": vr["supplier_name"],
            "supplier_code": vr["supplier_code"],
            "total_docs": v_total,
            "total_items": vr["total_items"] or 0,
            "total_qty": round(float(vr["total_qty"] or 0), 2),
            "completed_docs": v_comp,
            "hold_docs": vr["hold_docs"] or 0,
            "acceptance_rate": v_rate,
            "grade": grade,
            "grade_color": grade_color
        })

    # 5. Non-Conformance / NCR Log (ISO 9001 Clause 8.7)
    ncr_query = f"""
        SELECT 
            ti.id, ti.sheet_id, ti.material_code, ti.material_name, ti.uom, ti.qty,
            ti.supplier_name, ti.batch_fisik,
            ts.doc_no, ts.delivery_note_no, ts.po_no, ts.truck_plate, ts.arrival_date,
            ts.status, ts.pending_category, ts.pending_reason,
            ts.created_by_name, ts.updated_by_name, ts.created_at,
            ts.has_berita_acara, ts.ba_qa_doc_no
        FROM tally_sheets ts
        JOIN tally_items ti ON ts.id = ti.sheet_id
        WHERE ({where_str}) AND (ts.status IN ('hold_admin', 'hold_qc', 'cancelled') OR ts.pending_category != '' OR ts.pending_reason != '')
        ORDER BY ts.arrival_date DESC, ts.created_at DESC
        LIMIT 50
    """
    ncr_rows = conn.execute(ncr_query, params).fetchall()
    ncr_items = [dict(r) for r in ncr_rows]

    # 6. Shelf Life & Expired Control (ISO 22000 / GMP)
    shelf_query = f"""
        SELECT 
            ti.id, ti.sheet_id, ti.material_code, ti.material_name, ti.uom, ti.qty,
            ti.supplier_name, ti.batch_fisik, ti.supplier_batch,
            ti.production_date, ti.expired_date,
            ts.doc_no, ts.delivery_note_no, ts.arrival_date, ts.created_at
        FROM tally_sheets ts
        JOIN tally_items ti ON ts.id = ti.sheet_id
        WHERE ({where_str}) AND (ti.expired_date != '' AND ti.expired_date IS NOT NULL)
        ORDER BY ti.expired_date ASC
        LIMIT 50
    """
    shelf_rows = conn.execute(shelf_query, params).fetchall()
    conn.close()

    shelf_life_items = []
    for sr in shelf_rows:
        arr_str = sr["arrival_date"] or (sr["created_at"] or "")[:10]
        prod_str = sr["production_date"] or ""
        exp_str = sr["expired_date"] or ""

        rem_pct = None
        rem_days = None
        status_code = "safe"

        try:
            exp_d = datetime.date.fromisoformat(exp_str)
            arr_d = datetime.date.fromisoformat(arr_str) if arr_str else datetime.date.today()
            rem_days = (exp_d - arr_d).days

            if prod_str:
                prod_d = datetime.date.fromisoformat(prod_str)
                total_days = (exp_d - prod_d).days
                if total_days > 0:
                    rem_pct = round(max(0, rem_days) / total_days * 100, 1)
            
            if rem_days < 0:
                status_code = "expired"
            elif rem_pct is not None:
                if rem_pct >= 70:
                    status_code = "safe"
                elif rem_pct >= 50:
                    status_code = "warning"
                else:
                    status_code = "critical"
            else:
                if rem_days >= 180:
                    status_code = "safe"
                elif rem_days >= 90:
                    status_code = "warning"
                else:
                    status_code = "critical"
        except Exception:
            pass

        shelf_life_items.append({
            **dict(sr),
            "remaining_days": rem_days,
            "remaining_pct": rem_pct,
            "shelf_status": status_code
        })

    items = [dict(r) for r in rows]
    return {
        "kpi": kpi,
        "items": items,
        "total": total_items,
        "page": page,
        "limit": limit,
        "vendor_performance": vendor_perf,
        "non_conformance": ncr_items,
        "shelf_life": shelf_life_items
    }


@app.get("/api/reports/export-excel")
def export_reports_excel(
    start_date: str = "",
    end_date: str = "",
    status: str = "all",
    supplier: str = "",
    q: str = "",
    user: dict = Depends(get_current_user)
):
    conn = get_db()
    sync_from_supabase_if_needed(conn)

    where_clauses = ["1=1"]
    params = []

    if start_date.strip():
        where_clauses.append("(ts.arrival_date >= ? OR substr(ts.created_at, 1, 10) >= ?)")
        params.extend([start_date.strip(), start_date.strip()])
    if end_date.strip():
        where_clauses.append("(ts.arrival_date <= ? OR substr(ts.created_at, 1, 10) <= ?)")
        params.extend([end_date.strip(), end_date.strip()])
    if status.strip() and status != "all":
        if status == "hold":
            where_clauses.append("ts.status IN ('hold_admin', 'hold_qc')")
        elif status == "in_progress":
            where_clauses.append("ts.status IN ('draft', 'waiting_admin', 'waiting_qc')")
        elif status == "completed":
            where_clauses.append("ts.status = 'completed'")
        else:
            where_clauses.append("ts.status = ?")
            params.append(status.strip())
    if supplier.strip():
        where_clauses.append("(ts.supplier_code LIKE ? OR ts.supplier_name LIKE ? OR ti.supplier_code LIKE ? OR ti.supplier_name LIKE ?)")
        s_wild = f"%{supplier.strip()}%"
        params.extend([s_wild, s_wild, s_wild, s_wild])
    if q.strip():
        q_wild = f"%{q.strip()}%"
        where_clauses.append("(ts.doc_no LIKE ? OR ts.delivery_note_no LIKE ? OR ts.po_no LIKE ? OR ts.truck_plate LIKE ? OR ti.material_code LIKE ? OR ti.material_name LIKE ? OR ti.batch_fisik LIKE ?)")
        params.extend([q_wild, q_wild, q_wild, q_wild, q_wild, q_wild, q_wild])

    where_str = " AND ".join(where_clauses)

    items_query = f"""
        SELECT 
            ti.id, ti.sheet_id, ti.seq, ti.material_code, ti.material_name, ti.uom, ti.qty,
            ti.supplier_code, ti.supplier_name, ti.batch_fisik, ti.supplier_batch,
            ti.expired_date, ti.production_date, ti.pic_name,
            ts.doc_no, ts.delivery_note_no, ts.po_no, ts.truck_plate, ts.arrival_date,
            ts.status, ts.created_by_name, ts.updated_by_name, ts.qc_by_name, ts.qc_at,
            ts.pending_category, ts.pending_reason, ts.created_at
        FROM tally_sheets ts
        JOIN tally_items ti ON ts.id = ti.sheet_id
        WHERE {where_str}
        ORDER BY ts.arrival_date DESC, ts.created_at DESC, ti.seq ASC
    """
    rows = conn.execute(items_query, params).fetchall()

    kpi_query = f"""
        SELECT 
            count(DISTINCT ts.id) as total_docs,
            count(ti.id) as total_items,
            coalesce(sum(ti.qty), 0) as total_qty,
            count(DISTINCT CASE WHEN ts.status = 'completed' THEN ts.id END) as completed_docs,
            count(DISTINCT CASE WHEN ts.status IN ('hold_admin', 'hold_qc') THEN ts.id END) as hold_docs,
            count(DISTINCT CASE WHEN ts.status IN ('draft', 'waiting_admin', 'waiting_qc') THEN ts.id END) as in_progress_docs,
            count(DISTINCT CASE WHEN ts.status = 'cancelled' THEN ts.id END) as cancelled_docs
        FROM tally_sheets ts
        LEFT JOIN tally_items ti ON ts.id = ti.sheet_id
        WHERE {where_str}
    """
    kpi_row = conn.execute(kpi_query, params).fetchone()
    conn.close()

    total_docs = kpi_row["total_docs"] or 0
    completed_docs = kpi_row["completed_docs"] or 0
    hold_docs = kpi_row["hold_docs"] or 0
    first_pass_yield = round((completed_docs / total_docs * 100), 1) if total_docs > 0 else 100.0

    wb = openpyxl.Workbook()

    navy_header_fill = PatternFill(start_color="0B2149", end_color="0B2149", fill_type="solid")
    maroon_header_fill = PatternFill(start_color="7F1D1D", end_color="7F1D1D", fill_type="solid")
    ice_blue_fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    
    white_bold_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    navy_title_font = Font(name="Calibri", size=15, bold=True, color="0B2149")
    bold_font = Font(name="Calibri", size=10, bold=True, color="0F172A")
    regular_font = Font(name="Calibri", size=10, color="0F172A")
    small_italic_font = Font(name="Calibri", size=9, italic=True, color="64748B")
    
    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    border_total = Border(
        top=Side(style='thin', color='0B2149'),
        bottom=Side(style='double', color='0B2149')
    )

    now_str = datetime.datetime.now().strftime("%d-%m-%Y %H:%M WIB")
    period_str = f"{start_date or 'Awal'} s/d {end_date or 'Sekarang'}"

    status_label_map = {
        "completed": "SELESAI (STOCK TER-UU)",
        "hold_admin": "HOLD ADMIN WH",
        "hold_qc": "HOLD QC INSPECTOR",
        "waiting_qc": "MENUNGGU QC",
        "waiting_admin": "MENUNGGU ADMIN WH",
        "draft": "DRAFT CHECKER",
        "cancelled": "DIBATALKAN"
    }

    # ------------------ SHEET 1: RINGKASAN AUDIT ISO ------------------
    ws1 = wb.active
    ws1.title = "Ringkasan Audit ISO"
    ws1.views.sheetView[0].showGridLines = True

    def style_merged_range(ws, cell_range, font=None, fill=None, border=None, alignment=None):
        for row in ws[cell_range]:
            for cell in row:
                if font: cell.font = font
                if fill: cell.fill = fill
                if border: cell.border = border
                if alignment: cell.alignment = alignment

    ws1.row_dimensions[1].height = 20
    ws1.row_dimensions[2].height = 24
    ws1.row_dimensions[3].height = 18
    ws1.row_dimensions[4].height = 10
    ws1.row_dimensions[5].height = 20
    ws1.row_dimensions[6].height = 20
    ws1.row_dimensions[7].height = 20
    ws1.row_dimensions[8].height = 12
    ws1.row_dimensions[9].height = 24
    ws1.row_dimensions[10].height = 24

    ws1.merge_cells("A1:E1")
    ws1["A1"] = "PT DIAMOND COLD STORAGE — PLANT 2111"
    ws1["A1"].font = Font(name="Calibri", size=11, bold=True, color="1E3A8A")
    ws1["A1"].alignment = Alignment(vertical="center")

    ws1.merge_cells("A2:E2")
    ws1["A2"] = "LAPORAN AUDIT & REKAPITULASI PENERIMAAN MATERIAL INCOMING (SAP PLANT 2111)"
    ws1["A2"].font = Font(name="Calibri", size=13, bold=True, color="0B2149")
    ws1["A2"].alignment = Alignment(vertical="center")

    ws1.merge_cells("A3:E3")
    ws1["A3"] = "Standar Kepatuhan: ISO 9001:2015 Clause 8.4 (Control of Externally Provided Processes) & Clause 8.6 (Release of Products)"
    ws1["A3"].font = small_italic_font
    ws1["A3"].alignment = Alignment(vertical="center")

    if LOGO_PATH.exists():
        try:
            from openpyxl.drawing.image import Image as OpenpyxlImage
            logo_img = OpenpyxlImage(str(LOGO_PATH))
            target_h = 56
            target_w = int(logo_img.width * (target_h / logo_img.height)) if logo_img.height else 56
            logo_img.width = target_w
            logo_img.height = target_h
            ws1.add_image(logo_img, "F1")
        except Exception as e:
            print("Notice: could not add logo to report excel:", e)

    ws1["A5"] = "Nomor Dokumen:"
    ws1.merge_cells("B5:C5")
    ws1["B5"] = "FORM-WHS-ISO-008 Rev. 02"

    ws1["A6"] = "Klasifikasi:"
    ws1.merge_cells("B6:C6")
    ws1["B6"] = "Confidential / Official Audit Record"

    ws1["A7"] = "Periode Kedatangan:"
    ws1.merge_cells("B7:C7")
    ws1["B7"] = period_str

    ws1["D5"] = "Tanggal Ditarik:"
    ws1.merge_cells("E5:F5")
    ws1["E5"] = now_str

    ws1["D6"] = "Ditarik Oleh:"
    ws1.merge_cells("E6:F6")
    ws1["E6"] = f"{user.get('name', 'Admin')} ({user.get('role', 'admin')})"

    ws1["D7"] = "Filter Status:"
    ws1.merge_cells("E7:F7")
    ws1["E7"] = status.upper()

    meta_label_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    meta_val_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    meta_label_font = Font(name="Calibri", size=9.5, bold=True, color="1E293B")
    meta_val_font = Font(name="Calibri", size=9.5, color="0F172A")

    for r in range(5, 8):
        ws1[f"A{r}"].font = meta_label_font
        ws1[f"A{r}"].fill = meta_label_fill
        ws1[f"A{r}"].border = border_thin
        ws1[f"A{r}"].alignment = Alignment(vertical="center", indent=1)

        style_merged_range(ws1, f"B{r}:C{r}", font=meta_val_font, fill=meta_val_fill, border=border_thin, alignment=Alignment(vertical="center", indent=1))

        ws1[f"D{r}"].font = meta_label_font
        ws1[f"D{r}"].fill = meta_label_fill
        ws1[f"D{r}"].border = border_thin
        ws1[f"D{r}"].alignment = Alignment(vertical="center", indent=1)

        style_merged_range(ws1, f"E{r}:F{r}", font=meta_val_font, fill=meta_val_fill, border=border_thin, alignment=Alignment(vertical="center", indent=1))

    ws1.merge_cells("A9:F9")
    ws1["A9"] = "  RINGKASAN METRIK AUDIT MUTU (QUALITY AUDIT SUMMARY)"
    style_merged_range(ws1, "A9:F9", font=white_bold_font, fill=navy_header_fill, border=border_thin, alignment=Alignment(vertical="center"))

    sub_header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")

    kpi_cols = [
        ("A10", "Parameter Metrik Mutu", Alignment(horizontal="center", vertical="center")),
        ("B10", "Nilai / Capaian", Alignment(horizontal="center", vertical="center")),
        ("C10", "Satuan", Alignment(horizontal="center", vertical="center")),
        ("D10", "Standar Mutu (Acuan ISO)", Alignment(horizontal="center", vertical="center")),
    ]
    for pos, text, align in kpi_cols:
        ws1[pos] = text
        ws1[pos].font = white_bold_font
        ws1[pos].fill = sub_header_fill
        ws1[pos].alignment = align
        ws1[pos].border = border_thin

    ws1.merge_cells("E10:F10")
    ws1["E10"] = "Keterangan & Analisis Operasional"
    style_merged_range(ws1, "E10:F10", font=white_bold_font, fill=sub_header_fill, border=border_thin, alignment=Alignment(horizontal="center", vertical="center"))

    kpi_data = [
        ("Total Dokumen Kedatangan (Surat Jalan)", total_docs, "Dokumen", "100% Tercatat & Terverifikasi", "Total armada / surat jalan masuk tercatat di Plant 2111"),
        ("Total Baris Material Diterima", kpi_row["total_items"] or 0, "Baris", "Kesesuaian Item PO vs SJ", "Total variasi material, kode SAP, dan batch kedatangan"),
        ("Total Kuantitas Fisik Masuk", float(kpi_row["total_qty"] or 0), "Unit/Qty", "Toleransi Selisih Fisik 0%", "Akumulasi kuantiti seluruh material diterima dan dihitung"),
        ("First-Pass Quality Yield (Tingkat Kelolosan)", f"{first_pass_yield}%", "Persen", "Target ISO: ≥ 98.0% Lolos", "Tingkat material lolos verifikasi tanpa hold deviasi"),
        ("Dokumen Selesai (Stock Ter-UU)", completed_docs, "Dokumen", "Status Release Mutu (UU)", "Resmi lolos verifikasi fisik & uji mutu QC (Stock Ter-UU)"),
        ("Dokumen Ditahan (Hold Admin / QC)", hold_docs, "Dokumen", "Deviasi: 0 Toleransi Kritis", "Mengalami deviasi / hold sementara menunggu investigasi"),
        ("Dokumen Dalam Proses Antrean", kpi_row["in_progress_docs"] or 0, "Dokumen", "SLA Verifikasi < 24 Jam", "Sedang dalam proses verifikasi Admin WH atau inspeksi QC")
    ]

    target_badge_font = Font(name="Calibri", size=9, bold=True, color="1E3A8A")

    for row_idx, (param, val, unit, std, desc) in enumerate(kpi_data, start=11):
        ws1.row_dimensions[row_idx].height = 22
        fill_c = zebra_fill if row_idx % 2 == 0 else white_fill

        c_a = ws1.cell(row=row_idx, column=1, value=param)
        c_a.font = regular_font
        c_a.alignment = Alignment(vertical="center", indent=1)
        c_a.border = border_thin
        c_a.fill = fill_c

        c_b = ws1.cell(row=row_idx, column=2, value=val)
        c_b.font = bold_font
        c_b.alignment = Alignment(horizontal="right", vertical="center")
        if isinstance(val, (int, float)):
            c_b.number_format = "#,##0.00" if isinstance(val, float) else "#,##0"
        c_b.border = border_thin
        c_b.fill = fill_c

        c_c = ws1.cell(row=row_idx, column=3, value=unit)
        c_c.font = regular_font
        c_c.alignment = Alignment(horizontal="center", vertical="center")
        c_c.border = border_thin
        c_c.fill = fill_c

        c_d = ws1.cell(row=row_idx, column=4, value=std)
        c_d.font = target_badge_font
        c_d.alignment = Alignment(horizontal="center", vertical="center")
        c_d.border = border_thin
        c_d.fill = fill_c

        ws1.merge_cells(start_row=row_idx, start_column=5, end_row=row_idx, end_column=6)
        ws1.cell(row=row_idx, column=5, value=desc)
        style_merged_range(ws1, f"E{row_idx}:F{row_idx}", font=small_italic_font, fill=fill_c, border=border_thin, alignment=Alignment(vertical="center", indent=1))

    ws1.row_dimensions[18].height = 14

    ws1.row_dimensions[19].height = 24
    ws1.merge_cells("A19:F19")
    ws1["A19"] = "  LEMBAR PENGESAHAN DOKUMEN AUDIT (ISO 9001 SIGN-OFF)"
    style_merged_range(ws1, "A19:F19", font=white_bold_font, fill=navy_header_fill, border=border_thin, alignment=Alignment(vertical="center"))

    ws1.row_dimensions[20].height = 22
    ws1.merge_cells("A20:B20")
    ws1["A20"] = "Dibuat Oleh (Checker / Operator)"
    style_merged_range(ws1, "A20:B20", font=white_bold_font, fill=sub_header_fill, border=border_thin, alignment=Alignment(horizontal="center", vertical="center"))

    ws1.merge_cells("C20:D20")
    ws1["C20"] = "Diperiksa Oleh (Warehouse Supervisor)"
    style_merged_range(ws1, "C20:D20", font=white_bold_font, fill=sub_header_fill, border=border_thin, alignment=Alignment(horizontal="center", vertical="center"))

    ws1.merge_cells("E20:F20")
    ws1["E20"] = "Diverifikasi Mutu (QC / QA Manager)"
    style_merged_range(ws1, "E20:F20", font=white_bold_font, fill=sub_header_fill, border=border_thin, alignment=Alignment(horizontal="center", vertical="center"))

    for r in range(21, 25):
        ws1.row_dimensions[r].height = 18

    ws1.merge_cells("A21:B24")
    style_merged_range(ws1, "A21:B24", fill=white_fill, border=border_thin)

    ws1.merge_cells("C21:D24")
    style_merged_range(ws1, "C21:D24", fill=white_fill, border=border_thin)

    ws1.merge_cells("E21:F24")
    style_merged_range(ws1, "E21:F24", fill=white_fill, border=border_thin)

    ws1.row_dimensions[25].height = 50
    ws1.merge_cells("A25:B25")
    ws1["A25"] = "Nama       : ____________________\nTanggal : ____________________\nStatus     : [  ] Sesuai    [  ] Ada Catatan"
    style_merged_range(ws1, "A25:B25", font=regular_font, fill=meta_label_fill, border=border_thin, alignment=Alignment(vertical="center", indent=1, wrap_text=True))

    ws1.merge_cells("C25:D25")
    ws1["C25"] = "Nama       : ____________________\nTanggal : ____________________\nStatus     : [  ] Approved    [  ] Revisi"
    style_merged_range(ws1, "C25:D25", font=regular_font, fill=meta_label_fill, border=border_thin, alignment=Alignment(vertical="center", indent=1, wrap_text=True))

    ws1.merge_cells("E25:F25")
    ws1["E25"] = "Nama       : ____________________\nTanggal : ____________________\nStatus     : [  ] Released    [  ] Hold Mutu"
    style_merged_range(ws1, "E25:F25", font=regular_font, fill=meta_label_fill, border=border_thin, alignment=Alignment(vertical="center", indent=1, wrap_text=True))

    ws1.column_dimensions["A"].width = 28
    ws1.column_dimensions["B"].width = 16
    ws1.column_dimensions["C"].width = 16
    ws1.column_dimensions["D"].width = 28
    ws1.column_dimensions["E"].width = 22
    ws1.column_dimensions["F"].width = 22

    # ------------------ SHEET 2: DETAIL KETERTELUSURAN MATERIAL ------------------
    ws2 = wb.create_sheet(title="Detail Ketertelusuran")
    ws2.views.sheetView[0].showGridLines = True

    headers_ws2 = [
        "No.", "Tgl Kedatangan", "No. Tally", "No. Surat Jalan", "No. PO SAP", "No. Polisi Armada",
        "Kode Vendor", "Nama Vendor / Supplier", "Kode Material", "Deskripsi Material",
        "Batch Fisik", "Batch Supplier", "Tgl Produksi", "Tgl Expired",
        "Qty Fisik", "UOM", "Status Mutu", "Checker", "Admin WH", "QC Approver", "Tgl Rilis Mutu"
    ]

    for col_idx, h in enumerate(headers_ws2, start=1):
        cell = ws2.cell(row=1, column=col_idx, value=h)
        cell.font = white_bold_font
        cell.fill = navy_header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border_thin

    ws2.row_dimensions[1].height = 26
    data_start_row = 2
    for idx, r in enumerate(rows, start=1):
        curr_row = data_start_row + idx - 1
        ws2.row_dimensions[curr_row].height = 20
        qty_num = float(r["qty"] or 0)
        st_text = status_label_map.get(r["status"], r["status"].upper())
        qc_time = (r["qc_at"] or "")[:16].replace("T", " ") if r["qc_at"] else "-"

        ws2.cell(row=curr_row, column=1, value=idx).alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=2, value=r["arrival_date"] or "").alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=3, value=r["doc_no"]).alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=4, value=r["delivery_note_no"] or "-").alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=5, value=r["po_no"] or "-").alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=6, value=r["truck_plate"] or "-").alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=7, value=r["supplier_code"] or "-").alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=8, value=r["supplier_name"] or "-").alignment = Alignment(vertical="center")
        ws2.cell(row=curr_row, column=9, value=r["material_code"]).alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=10, value=r["material_name"]).alignment = Alignment(vertical="center")
        ws2.cell(row=curr_row, column=11, value=r["batch_fisik"] or "-").alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=12, value=r["supplier_batch"] or "-").alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=13, value=r["production_date"] or "-").alignment = Alignment(horizontal="center", vertical="center")
        ws2.cell(row=curr_row, column=14, value=r["expired_date"] or "-").alignment = Alignment(horizontal="center", vertical="center")
        
        c_qty = ws2.cell(row=curr_row, column=15, value=qty_num)
        c_qty.number_format = "#,##0.00"
        c_qty.alignment = Alignment(horizontal="right", vertical="center")
        
        ws2.cell(row=curr_row, column=16, value=r["uom"] or "").alignment = Alignment(horizontal="center", vertical="center")
        
        c_stat = ws2.cell(row=curr_row, column=17, value=st_text)
        c_stat.alignment = Alignment(horizontal="center", vertical="center")
        c_stat.font = Font(name="Calibri", size=9, bold=True, color="047857" if r["status"] == "completed" else ("B91C1C" if "hold" in r["status"] else "1E3A8A"))

        ws2.cell(row=curr_row, column=18, value=r["pic_name"] or r["created_by_name"] or "-").alignment = Alignment(vertical="center")
        ws2.cell(row=curr_row, column=19, value=r["updated_by_name"] or "-").alignment = Alignment(vertical="center")
        ws2.cell(row=curr_row, column=20, value=r["qc_by_name"] or "-").alignment = Alignment(vertical="center")
        ws2.cell(row=curr_row, column=21, value=qc_time).alignment = Alignment(horizontal="center", vertical="center")

        row_fill = zebra_fill if idx % 2 == 0 else white_fill
        for c in range(1, 22):
            cell = ws2.cell(row=curr_row, column=c)
            cell.border = border_thin
            if c != 17:
                cell.font = regular_font
            cell.fill = row_fill

    total_row_idx = data_start_row + len(rows)
    ws2.row_dimensions[total_row_idx].height = 24
    ws2.cell(row=total_row_idx, column=1, value="TOTAL KUANTITAS").font = bold_font
    ws2.merge_cells(start_row=total_row_idx, start_column=1, end_row=total_row_idx, end_column=14)
    ws2.cell(row=total_row_idx, column=1).alignment = Alignment(horizontal="right", vertical="center")
    
    total_qty_cell = ws2.cell(row=total_row_idx, column=15, value=f"=SUM(O2:O{total_row_idx-1})" if len(rows) > 0 else 0)
    total_qty_cell.font = bold_font
    total_qty_cell.number_format = "#,##0.00"
    total_qty_cell.alignment = Alignment(horizontal="right", vertical="center")
    total_qty_cell.border = border_total

    for c in range(1, 22):
        ws2.cell(row=total_row_idx, column=c).border = border_total

    ws2.auto_filter.ref = f"A1:U{total_row_idx}"
    ws2.freeze_panes = "A2"

    ws2_widths = [6, 14, 16, 16, 14, 14, 12, 28, 14, 32, 16, 16, 14, 14, 14, 8, 22, 18, 18, 18, 18]
    for c_idx, w in enumerate(ws2_widths, start=1):
        ws2.column_dimensions[openpyxl.utils.get_column_letter(c_idx)].width = w

    # ------------------ SHEET 3: LOG KETIDAKSESUAIAN & PENAHANAN (HOLD) ------------------
    ws3 = wb.create_sheet(title="Log Ketidaksesuaian & Hold")
    ws3.views.sheetView[0].showGridLines = True

    ws3.row_dimensions[1].height = 24
    ws3.row_dimensions[2].height = 18
    ws3.row_dimensions[4].height = 26

    ws3["A1"] = "LOG PENANGANAN KETIDAKSESUAIAN MATERIAL & STATUS HOLD"
    ws3["A1"].font = Font(name="Calibri", size=13, bold=True, color="7F1D1D")
    ws3["A2"] = "Klausul Kepatuhan: ISO 9001:2015 Clause 8.7 (Control of Nonconforming Outputs)"
    ws3["A2"].font = small_italic_font

    headers_ws3 = [
        "No.", "Tgl Kedatangan", "No. Tally", "No. Surat Jalan", "No. PO SAP",
        "Nama Vendor / Supplier", "Kode & Nama Material", "Kategori Deviasi (Hold)", "Alasan & Uraian Masalah",
        "Status Terakhir", "Aktor Penanggung Jawab"
    ]
    for col_idx, h in enumerate(headers_ws3, start=1):
        cell = ws3.cell(row=4, column=col_idx, value=h)
        cell.font = white_bold_font
        cell.fill = maroon_header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border_thin

    hold_rows = [r for r in rows if "hold" in r["status"] or r["status"] == "cancelled" or r["pending_category"] or r["pending_reason"]]
    
    if not hold_rows:
        ws3.row_dimensions[5].height = 24
        ws3.cell(row=5, column=1, value="Tidak ada catatan deviasi atau penahanan (Hold) pada periode ini. Semua material memenuhi standar mutu.").font = small_italic_font
        ws3.merge_cells("A5:K5")
    else:
        for idx, hr in enumerate(hold_rows, start=1):
            curr_r = 4 + idx
            ws3.row_dimensions[curr_r].height = 20
            ws3.cell(row=curr_r, column=1, value=idx).alignment = Alignment(horizontal="center", vertical="center")
            ws3.cell(row=curr_r, column=2, value=hr["arrival_date"] or "").alignment = Alignment(horizontal="center", vertical="center")
            ws3.cell(row=curr_r, column=3, value=hr["doc_no"]).alignment = Alignment(horizontal="center", vertical="center")
            ws3.cell(row=curr_r, column=4, value=hr["delivery_note_no"] or "-").alignment = Alignment(horizontal="center", vertical="center")
            ws3.cell(row=curr_r, column=5, value=hr["po_no"] or "-").alignment = Alignment(horizontal="center", vertical="center")
            ws3.cell(row=curr_r, column=6, value=hr["supplier_name"] or "-").alignment = Alignment(vertical="center")
            ws3.cell(row=curr_r, column=7, value=f"{hr['material_code']} - {hr['material_name']}").alignment = Alignment(vertical="center")
            ws3.cell(row=curr_r, column=8, value=hr["pending_category"] or "Lain-lain").alignment = Alignment(horizontal="center", vertical="center")
            ws3.cell(row=curr_r, column=9, value=hr["pending_reason"] or "-").alignment = Alignment(vertical="center")
            ws3.cell(row=curr_r, column=10, value=status_label_map.get(hr["status"], hr["status"].upper())).alignment = Alignment(horizontal="center", vertical="center")
            ws3.cell(row=curr_r, column=11, value=hr["updated_by_name"] or hr["created_by_name"] or "-").alignment = Alignment(vertical="center")

            row_fill = zebra_fill if idx % 2 == 0 else white_fill
            for c in range(1, 12):
                cell = ws3.cell(row=curr_r, column=c)
                cell.border = border_thin
                cell.font = regular_font
                cell.fill = row_fill

    ws3.auto_filter.ref = f"A4:K{max(5, 4 + len(hold_rows))}"
    ws3.freeze_panes = "A5"

    ws3_widths = [6, 14, 16, 16, 14, 28, 35, 25, 35, 22, 22]
    for c_idx, w in enumerate(ws3_widths, start=1):
        ws3.column_dimensions[openpyxl.utils.get_column_letter(c_idx)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"Laporan_Audit_ISO_Tally_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# ----------------- ACTIVITY LOGS -----------------

@app.get("/api/activity")
def get_activity_logs(q: str = "", entity: str = "", page: int = 1, limit: int = 25, admin: dict = Depends(require_admin)):
    conn = get_db()
    offset = (page - 1) * limit
    where_clauses = ["1=1"]
    params = []

    if q.strip():
        where_clauses.append("(user_name LIKE ? OR details LIKE ? OR action LIKE ?)")
        q_wild = f"%{q.strip()}%"
        params.extend([q_wild, q_wild, q_wild])
    if entity.strip() and entity != "all":
        where_clauses.append("entity = ?")
        params.append(entity.strip())

    where_str = " AND ".join(where_clauses)
    total = conn.execute(f"SELECT count(*) FROM activity_logs WHERE {where_str}", params).fetchone()[0]

    rows = conn.execute(f"""
        SELECT * FROM activity_logs WHERE {where_str}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """, params + [limit, offset]).fetchall()
    conn.close()

    items = [{
        "id": r["id"],
        "user_id": r["user_id"],
        "user_name": r["user_name"],
        "action": r["action"],
        "entity": r["entity"],
        "entity_id": r["entity_id"],
        "details": r["details"],
        "created_at": r["created_at"]
    } for r in rows]

    return {"items": items, "total": total, "page": page, "limit": limit}

# Startup hook
@app.on_event("startup")
def on_startup():
    init_db()

if __name__ == "__main__":
    import uvicorn
    init_db()
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
