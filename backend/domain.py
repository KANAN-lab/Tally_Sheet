import json
import uuid
import datetime
from typing import Dict, List, Optional, Any
from fastapi import HTTPException

# ----------------- CONSTANTS & DEFAULTS -----------------
DEFAULT_HOLD_CATEGORIES = [
    "COA Belum Lengkap / Kurang",
    "Kuantiti Fisik Selisih vs Surat Jalan / PO",
    "Kualitas Fisik Tidak Sesuai",
    "Dokumen Surat Jalan Buram / Rusak",
    "Pemeriksaan Organoleptik / Lab Tertunda",
    "Lain-lain"
]

DEFAULT_WORKFLOW_STAGES = [
    {"id": "checker", "name": "1. Checker", "role": "checker", "desc": "Hitung Fisik & Input SJ/PO"},
    {"id": "admin", "name": "2. Admin Warehouse", "role": "warehouse_admin", "desc": "Verifikasi Dokumen & Request QC"},
    {"id": "qc", "name": "3. Quality Control", "role": "qc", "desc": "Uji Mutu Fisik & Stock Ter-UU"}
]

# ----------------- OOP: SETTINGS SERVICE -----------------
class SettingsService:
    """Manages application-wide settings with zero hardcoding."""
    
    @staticmethod
    def get_settings(conn) -> Dict[str, Any]:
        row = conn.execute("SELECT * FROM settings WHERE id = 'global'").fetchone()
        if not row:
            return {
                "id": "global",
                "required": {
                    "batch_fisik": True,
                    "supplier_batch": True,
                    "expired_date": True,
                    "production_date": True,
                    "pic": True
                },
                "duplicate_rule": "within_document",
                "hold_categories": DEFAULT_HOLD_CATEGORIES,
                "workflow_stages": DEFAULT_WORKFLOW_STAGES,
                "updated_at": "",
                "updated_by_name": ""
            }
        
        req = json.loads(row["required_json"]) if row["required_json"] else {}
        dup = row["duplicate_rule"] or "within_document"
        
        # Load dynamic hold categories
        categories = DEFAULT_HOLD_CATEGORIES
        if "hold_categories_json" in row.keys() and row["hold_categories_json"]:
            try:
                loaded = json.loads(row["hold_categories_json"])
                if isinstance(loaded, list) and len(loaded) > 0:
                    categories = loaded
            except Exception:
                pass
                
        return {
            "id": "global",
            "required": req,
            "duplicate_rule": dup,
            "hold_categories": categories,
            "workflow_stages": DEFAULT_WORKFLOW_STAGES,
            "updated_at": row["updated_at"],
            "updated_by_name": row["updated_by_name"]
        }

    @staticmethod
    def update_settings(conn, required: Dict[str, bool], duplicate_rule: str, hold_categories: List[str], admin_name: str) -> Dict[str, Any]:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        cats = [c.strip() for c in hold_categories if c and c.strip()]
        if not cats:
            cats = DEFAULT_HOLD_CATEGORIES

        conn.execute("""
            UPDATE settings 
            SET required_json = ?, duplicate_rule = ?, hold_categories_json = ?, updated_at = ?, updated_by_name = ?
            WHERE id = 'global'
        """, (json.dumps(required), duplicate_rule, json.dumps(cats), now, admin_name))
        
        return {
            "id": "global",
            "required": required,
            "duplicate_rule": duplicate_rule,
            "hold_categories": cats,
            "workflow_stages": DEFAULT_WORKFLOW_STAGES,
            "updated_at": now,
            "updated_by_name": admin_name
        }


# ----------------- OOP: WORKFLOW MANAGER -----------------
class WorkflowManager:
    """
    Enforces business process state machine:
    Stage 1: Checker (Hitung Fisik & Input SJ/PO) -> kirim ke Admin
    Stage 2: Admin Warehouse (Verifikasi Dokumen & Request QC) -> kirim ke QC / hold / return
    Stage 3: Quality Control (Inspeksi Mutu & Stock Ter-UU) -> approve (completed) / hold / reject
    """

    ALLOWED_ACTIONS = {
        "submit_to_admin",
        "admin_hold",
        "send_to_qc",
        "qc_hold",
        "qc_approve",
        "qc_reject",
        "return_to_checker"
    }

    @classmethod
    def execute_transition(cls, conn, sheet: dict, action: str, payload: dict, user: dict) -> dict:
        action = action.strip()
        if action not in cls.ALLOWED_ACTIONS:
            raise HTTPException(status_code=400, detail=f"Aksi transisi '{action}' tidak valid.")

        status = sheet["status"]
        if status == "cancelled":
            raise HTTPException(status_code=400, detail="Dokumen yang telah dibatalkan tidak dapat diproses.")
        if status == "completed":
            raise HTTPException(status_code=400, detail="Dokumen telah selesai (Stock Ter-UU) dan terkunci.")

        user_role = user.get("role", "user")
        is_admin = user_role in ("admin", "warehouse_admin")
        is_qc = user_role in ("admin", "qc")
        is_checker = user_role in ("admin", "checker")

        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        old_status = status
        actual_id = sheet["id"]

        new_status = old_status
        new_handler_role = sheet.get("current_handler_role") or "admin"
        new_handler_name = ""
        pending_cat = ""
        pending_rsn = ""
        qc_stat = sheet.get("qc_status") or ""
        qc_nts = sheet.get("qc_notes") or ""
        qc_by = sheet.get("qc_by_name") or ""
        qc_at = sheet.get("qc_at") or None
        finalized_at = sheet.get("finalized_at")
        finalized_by = sheet.get("finalized_by")
        finalized_by_name = sheet.get("finalized_by_name")

        reason = (payload.get("reason") or "").strip()
        category = (payload.get("category") or "").strip()

        # 1. ACTION: submit_to_admin (Dari Checker ke Admin Warehouse)
        if action == "submit_to_admin":
            if status not in ("draft", "admin_hold"):
                raise HTTPException(status_code=400, detail=f"Dokumen berstatus '{status}' tidak dapat diserahkan ke Admin. Hanya dokumen Draft atau Revisi yang dapat dikirim.")
            if not is_checker and not is_admin:
                raise HTTPException(status_code=403, detail="Hanya Checker atau Admin yang dapat menyerahkan dokumen.")
            new_status = "waiting_admin"
            new_handler_role = "warehouse_admin"
            log_detail = f"Checker ({user['name']}) menyerahkan dokumen kedatangan ke Admin Warehouse"

        # 2. ACTION: admin_hold (Admin menahan dokumen)
        elif action == "admin_hold":
            if status not in ("waiting_admin", "waiting_admin_1"):
                raise HTTPException(status_code=400, detail=f"Dokumen berstatus '{status}' tidak dapat ditahan Admin. Dokumen harus dalam status Menunggu Verifikasi Admin.")
            if not is_admin:
                raise HTTPException(status_code=403, detail="Hanya Admin Warehouse yang dapat menahan dokumen pada tahap verifikasi.")
            if not reason:
                raise HTTPException(status_code=400, detail="Alasan penahanan dokumen (Hold Reason) wajib diisi.")
            new_status = "admin_hold"
            new_handler_role = "warehouse_admin"
            pending_cat = category or "Kendala Verifikasi Dokumen / PO"
            pending_rsn = reason
            log_detail = f"Admin Warehouse menahan dokumen: [{pending_cat}] {pending_rsn}"

        # 3. ACTION: send_to_qc (Admin meneruskan ke QC)
        elif action == "send_to_qc":
            if status not in ("waiting_admin", "waiting_admin_1", "admin_hold"):
                raise HTTPException(status_code=400, detail=f"Dokumen berstatus '{status}' tidak dapat diteruskan ke QC. Dokumen harus dalam status Menunggu Verifikasi Admin.")
            if not is_admin:
                raise HTTPException(status_code=403, detail="Hanya Admin Warehouse yang dapat meneruskan dokumen ke Tim QC.")
            new_status = "waiting_qc"
            new_handler_role = "qc"
            log_detail = f"Admin Warehouse ({user['name']}) memverifikasi dokumen & meneruskan ke Tim QC untuk sampling/uji mutu"

        # 4. ACTION: return_to_checker (Admin mengembalikan ke Checker untuk revisi fisik)
        elif action == "return_to_checker":
            if status not in ("waiting_admin", "waiting_admin_1", "admin_hold"):
                raise HTTPException(status_code=400, detail=f"Dokumen berstatus '{status}' tidak dapat dikembalikan ke Checker.")
            if not is_admin:
                raise HTTPException(status_code=403, detail="Hanya Admin Warehouse yang dapat mengembalikan dokumen ke Checker.")
            if not reason:
                raise HTTPException(status_code=400, detail="Alasan pengembalian ke Checker wajib diisi.")
            new_status = "draft"
            new_handler_role = "checker"
            pending_cat = category or "Revisi Fisik / Kuantiti"
            pending_rsn = reason
            log_detail = f"Admin Warehouse mengembalikan dokumen ke Checker untuk koreksi: {pending_rsn}"

        # 5. ACTION: qc_hold (QC menahan dokumen/material)
        elif action == "qc_hold":
            if status not in ("waiting_qc",):
                raise HTTPException(status_code=400, detail=f"Dokumen berstatus '{status}' tidak dapat ditahan QC. Dokumen harus dalam status Dalam Pemeriksaan QC.")
            if not is_qc:
                raise HTTPException(status_code=403, detail="Hanya Tim QC yang dapat menahan dokumen pada tahap inspeksi mutu.")
            if not reason:
                raise HTTPException(status_code=400, detail="Alasan penahanan QC (Hold Reason) wajib diisi.")
            new_status = "qc_hold"
            new_handler_role = "qc"
            pending_cat = category or "QC Issue / Analisis Tertunda"
            pending_rsn = reason
            log_detail = f"QC menahan pemeriksaan material: [{pending_cat}] {pending_rsn}"

        # 6. ACTION: qc_approve (QC Lulus Uji Mutu -> SELESAI / STOCK TER-UU)
        elif action == "qc_approve":
            if status not in ("waiting_qc", "qc_hold"):
                raise HTTPException(status_code=400, detail=f"Dokumen berstatus '{status}' tidak dapat disetujui QC. Dokumen harus dalam status Dalam Pemeriksaan QC.")
            if not is_qc:
                raise HTTPException(status_code=403, detail="Hanya Tim QC yang berwenang menyetujui mutu material.")
            # QC tidak perlu nomor COA!
            new_status = "completed"
            new_handler_role = "closed"
            qc_stat = "passed"
            qc_nts = reason or "Lolos Uji Mutu & Stock Ter-UU"
            qc_by = user["name"]
            qc_at = now
            finalized_at = now
            finalized_by = user["id"]
            finalized_by_name = user["name"]
            log_detail = f"QC ({user['name']}) meluluskan material: Lolos Uji Mutu, Dokumen Selesai (Stock Ter-UU)"

        # 7. ACTION: qc_reject (QC menolak mutu material)
        elif action == "qc_reject":
            if status not in ("waiting_qc", "qc_hold"):
                raise HTTPException(status_code=400, detail=f"Dokumen berstatus '{status}' tidak dapat ditolak QC. Dokumen harus dalam status Dalam Pemeriksaan QC.")
            if not is_qc:
                raise HTTPException(status_code=403, detail="Hanya Tim QC yang berwenang menolak material.")
            if not reason:
                raise HTTPException(status_code=400, detail="Alasan penolakan mutu QC wajib diisi.")
            new_status = "cancelled"
            new_handler_role = "closed"
            qc_stat = "rejected"
            qc_nts = reason
            qc_by = user["name"]
            qc_at = now
            pending_cat = category or "QC Reject / Mutu Tidak Sesuai"
            pending_rsn = reason
            log_detail = f"QC ({user['name']}) menolak material: [{pending_cat}] {pending_rsn}"

        # Execute DB update
        conn.execute("""
            UPDATE tally_sheets
            SET status = ?, current_handler_role = ?, current_handler_name = ?,
                pending_category = ?, pending_reason = ?,
                qc_status = ?, qc_notes = ?, qc_by_name = ?, qc_at = ?,
                finalized_at = ?, finalized_by = ?, finalized_by_name = ?,
                updated_at = ?, updated_by = ?, updated_by_name = ?
            WHERE id = ?
        """, (
            new_status, new_handler_role, new_handler_name,
            pending_cat, pending_rsn,
            qc_stat, qc_nts, qc_by, qc_at,
            finalized_at, finalized_by, finalized_by_name,
            now, user["id"], user["name"],
            actual_id
        ))

        # Record History Audit Trail
        rev_count = conn.execute("SELECT count(*) FROM tally_history WHERE sheet_id = ?", (actual_id,)).fetchone()[0] or 1
        hist_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO tally_history 
            (id, sheet_id, action, revision, at, by_name, by_id, by_role, from_status, to_status, category, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            hist_id, actual_id, action, rev_count + 1, now, user["name"], user["id"], user_role,
            old_status, new_status, category, reason or log_detail
        ))

        return {
            "actual_id": actual_id,
            "doc_no": sheet["doc_no"],
            "old_status": old_status,
            "new_status": new_status,
            "new_handler_role": new_handler_role,
            "new_handler_name": new_handler_name,
            "pending_category": pending_cat,
            "pending_reason": pending_rsn,
            "qc_status": qc_stat,
            "qc_notes": qc_nts,
            "qc_by_name": qc_by,
            "qc_at": qc_at,
            "finalized_at": finalized_at,
            "finalized_by": finalized_by,
            "finalized_by_name": finalized_by_name,
            "updated_at": now,
            "updated_by": user["id"],
            "updated_by_name": user["name"],
            "hist_id": hist_id,
            "revision": rev_count + 1,
            "log_detail": log_detail
        }
