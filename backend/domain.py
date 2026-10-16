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

ROLE_METADATA = [
    {"role": "admin", "label": "Super Administrator", "desc": "Akses kontrol penuh ke seluruh sistem dan konfigurasi master"},
    {"role": "warehouse_admin", "label": "Admin Warehouse", "desc": "Verifikasi dokumen kedatangan, cek PO SAP, dan disposisi ke QC"},
    {"role": "checker", "label": "Checker Gudang", "desc": "Pemeriksaan fisik material, batch, kuantiti, dan pembuatan draf tally"},
    {"role": "qc", "label": "Quality Control (QC)", "desc": "Inspeksi mutu, uji organoleptik/lab, dan approval Stock Ter-UU"},
    {"role": "user", "label": "Viewer / Staff Gudang", "desc": "Melihat data dokumen dan memantau status kedatangan"}
]

PERMISSION_DEFINITIONS = [
    {
        "module": "tally",
        "module_name": "Modul Tally Sheet (Penerimaan Material)",
        "permissions": [
            {"key": "tally_view", "label": "Lihat Daftar & Detail Tally", "desc": "Melihat daftar dokumen tally sheet dan rincian item material"},
            {"key": "tally_create", "label": "Buat Dokumen Baru", "desc": "Membuat draf tally sheet kedatangan material baru"},
            {"key": "tally_edit", "label": "Edit Draf Tally", "desc": "Mengubah informasi surat jalan, nopol, kontainer, dan baris material"},
            {"key": "tally_submit", "label": "Kirim ke Admin WH", "desc": "Menyerahkan draf tally sheet ke Admin Warehouse untuk verifikasi"},
            {"key": "tally_delete", "label": "Hapus Draf Tally", "desc": "Menghapus dokumen tally sheet yang masih berstatus draf"}
        ]
    },
    {
        "module": "warehouse_admin",
        "module_name": "Modul Verifikasi Gudang (Admin Warehouse)",
        "permissions": [
            {"key": "admin_verify", "label": "Verifikasi & Teruskan ke QC", "desc": "Memvalidasi kesesuaian dokumen vs PO SAP dan mengajukan uji mutu ke Tim QC"},
            {"key": "admin_hold", "label": "Tahan Dokumen (Hold Admin)", "desc": "Menahan alur dokumen jika ditemukan selisih kuantiti atau kendala dokumen"},
            {"key": "return_to_checker", "label": "Kembalikan ke Checker", "desc": "Mengembalikan dokumen ke Checker untuk perbaikan data fisik"}
        ]
    },
    {
        "module": "qc",
        "module_name": "Modul Uji Mutu & Kualitas (Quality Control)",
        "permissions": [
            {"key": "qc_approve", "label": "Approve Mutu (Stock Ter-UU)", "desc": "Meluluskan inspeksi mutu dan meresmikan status Selesai / Stock Ter-UU"},
            {"key": "qc_hold", "label": "Tahan Uji Mutu (QC Hold)", "desc": "Menahan dokumen jika sampel uji laboratorium/organoleptik memerlukan waktu"},
            {"key": "qc_reject", "label": "Tolak Mutu (Reject QC)", "desc": "Menolak penerimaan material jika mutu tidak memenuhi standar QA"}
        ]
    },
    {
        "module": "print_export",
        "module_name": "Modul Cetak & Pelaporan Dokumen",
        "permissions": [
            {"key": "print_tally", "label": "Cetak Lembar Tally Sheet", "desc": "Mencetak formulir resmi Tally Sheet Penerimaan"},
            {"key": "print_ba", "label": "Cetak Berita Acara", "desc": "Mencetak Berita Acara Penerimaan Kontainer / Import"},
            {"key": "export_reports", "label": "Export Rekapitulasi Audit ISO", "desc": "Mengunduh file Excel multi-sheet resmi laporan audit ISO"}
        ]
    },
    {
        "module": "master_admin",
        "module_name": "Modul Master Data & Administrator",
        "permissions": [
            {"key": "manage_master", "label": "Kelola Master Data", "desc": "Upload & maintenance master data Material dan Supplier (MKVZ)"},
            {"key": "manage_settings", "label": "Kelola Pengaturan Sistem", "desc": "Mengubah kategori kendala hold, aturan duplikasi, dan nomor dokumen QA"},
            {"key": "manage_users", "label": "Kelola Akun & Hak Akses", "desc": "Menambah, mengedit, menonaktifkan pengguna, dan mengatur matriks otorisasi"}
        ]
    }
]

DEFAULT_ROLE_PERMISSIONS = {
    "admin": {
        "tally_view": True, "tally_create": True, "tally_edit": True, "tally_submit": True, "tally_delete": True,
        "admin_verify": True, "admin_hold": True, "return_to_checker": True,
        "qc_approve": True, "qc_hold": True, "qc_reject": True,
        "print_tally": True, "print_ba": True, "export_reports": True,
        "manage_master": True, "manage_settings": True, "manage_users": True
    },
    "warehouse_admin": {
        "tally_view": True, "tally_create": True, "tally_edit": True, "tally_submit": True, "tally_delete": False,
        "admin_verify": True, "admin_hold": True, "return_to_checker": True,
        "qc_approve": False, "qc_hold": False, "qc_reject": False,
        "print_tally": True, "print_ba": True, "export_reports": True,
        "manage_master": True, "manage_settings": False, "manage_users": False
    },
    "checker": {
        "tally_view": True, "tally_create": True, "tally_edit": True, "tally_submit": True, "tally_delete": False,
        "admin_verify": False, "admin_hold": False, "return_to_checker": False,
        "qc_approve": False, "qc_hold": False, "qc_reject": False,
        "print_tally": True, "print_ba": True, "export_reports": False,
        "manage_master": False, "manage_settings": False, "manage_users": False
    },
    "qc": {
        "tally_view": True, "tally_create": False, "tally_edit": False, "tally_submit": False, "tally_delete": False,
        "admin_verify": False, "admin_hold": False, "return_to_checker": False,
        "qc_approve": True, "qc_hold": True, "qc_reject": True,
        "print_tally": True, "print_ba": True, "export_reports": True,
        "manage_master": False, "manage_settings": False, "manage_users": False
    },
    "user": {
        "tally_view": True, "tally_create": False, "tally_edit": False, "tally_submit": False, "tally_delete": False,
        "admin_verify": False, "admin_hold": False, "return_to_checker": False,
        "qc_approve": False, "qc_hold": False, "qc_reject": False,
        "print_tally": True, "print_ba": False, "export_reports": False,
        "manage_master": False, "manage_settings": False, "manage_users": False
    }
}

DEFAULT_QA_DOCUMENTS = {
    "TALLY_SHEET": {
        "code": "SOP.WH-D.01",
        "title": "FORM TALLY SHEET PENERIMAAN MATERIAL",
        "revision": "01",
        "effective_date": "01 Januari 2024",
        "plant": "PT DIAMOND COLD STORAGE - PLANT 2111 (CIBITUNG)"
    },
    "BERITA_ACARA_IMPORT": {
        "code": "SOP.WH-D.02",
        "title": "BERITA ACARA PENERIMAAN BARANG",
        "revision": "01",
        "effective_date": "01 Januari 2024",
        "plant": "PT DIAMOND COLD STORAGE - PLANT 2111 (CIBITUNG)"
    }
}

# ----------------- OOP: QA CONTROLLED DOCUMENT REGISTRY -----------------
class QADocumentRegistry:
    """
    ISO 9001:2015 Clause 7.5 Controlled Document Master Registry for PT DIAMOND COLD STORAGE (PLANT 2111).
    Menjaga identitas resmi formulir terdaftar di Quality Assurance (QA).
    Dikelola secara OOP murni dan dinamis melalui Settings tanpa hardcode kode form.
    """
    KEY_TALLY = "TALLY_SHEET"
    KEY_BERITA_ACARA = "BERITA_ACARA_IMPORT"

    @classmethod
    def get_all(cls, conn=None) -> Dict[str, Dict[str, str]]:
        if conn:
            try:
                s = SettingsService.get_settings(conn)
                if s.get("qa_documents") and isinstance(s["qa_documents"], dict):
                    return s["qa_documents"]
            except Exception:
                pass
        return DEFAULT_QA_DOCUMENTS

    @classmethod
    def get_doc(cls, form_key: str, conn=None) -> Dict[str, str]:
        all_docs = cls.get_all(conn)
        # Search case-insensitively or by semantic key
        for k, v in all_docs.items():
            if k.upper() == form_key.upper() or (form_key.lower() == "tally_sheet" and "tally" in k.lower()) or (form_key.lower() == "berita_acara" and "berita" in k.lower()):
                return v
        return all_docs.get(form_key, DEFAULT_QA_DOCUMENTS.get(form_key, {}))

    @classmethod
    def get_code(cls, form_key: str, conn=None) -> str:
        doc = cls.get_doc(form_key, conn)
        return str(doc.get("code", "")).strip()

    @classmethod
    def get_title(cls, form_key: str, conn=None) -> str:
        doc = cls.get_doc(form_key, conn)
        return str(doc.get("title", "")).strip()

    @classmethod
    def get_plant(cls, form_key: str, conn=None) -> str:
        doc = cls.get_doc(form_key, conn)
        return str(doc.get("plant", "")).strip()

    @classmethod
    def get_revision(cls, form_key: str, conn=None) -> str:
        doc = cls.get_doc(form_key, conn)
        return str(doc.get("revision", "01")).strip()

    @classmethod
    def resolve_tally_code(cls, current_val: Optional[str] = None, conn=None) -> str:
        master_code = cls.get_code(cls.KEY_TALLY, conn)
        val_str = str(current_val).strip() if current_val else ""
        if not val_str or val_str.upper() in ["SOP.WH-D.01", "NONE", "NULL"]:
            return master_code
        return val_str or master_code

    @classmethod
    def resolve_ba_code(cls, current_val: Optional[str] = None, conn=None) -> str:
        master_code = cls.get_code(cls.KEY_BERITA_ACARA, conn)
        val_str = str(current_val).strip() if current_val else ""
        if not val_str or val_str.upper() in ["SOP.WH-D.02", "NONE", "NULL"]:
            return master_code
        return val_str or master_code


# ----------------- OOP: BERITA ACARA DOMAIN MODEL -----------------
class BeritaAcaraRecord:
    """
    OOP Model Berita Acara Penerimaan Barang Import / Kontainer.
    Mengelola seluruh status inspeksi kontainer pengiriman (sebelum & sesudah bongkar)
    serta evaluasi kondisi fisik barang dan tanda tangan 3 peran.
    """
    def __init__(self, data: Optional[Dict[str, Any]] = None):
        data = data or {}
        # Jenis Kedatangan: "import" (Kontainer) | "local" (Armada Truk Domestik)
        self.arrival_type = str(data.get("arrival_type", "import")).strip().lower()
        if self.arrival_type not in ["import", "local"]:
            self.arrival_type = "import"

        # Header Kontainer / Armada
        self.container_no = str(data.get("container_no", "")).strip()
        self.seal_no = str(data.get("seal_no", "")).strip()
        self.seal_condition = str(data.get("seal_condition", "Baik / Utuh")).strip()
        self.container_temp_type = str(data.get("container_temp_type", "Frozen")).strip()  # Dry / Chiller / Frozen
        self.temp_celsius = str(data.get("temp_celsius", "")).strip()

        # 1. Kondisi Fisik Kontainer / Bak Truk Sebelum Dibongkar
        self.floor_before = str(data.get("floor_before", "Rata, tidak ditemukan kebocoran, bersih, tidak berminyak")).strip()
        self.wall_before = str(data.get("wall_before", "Tidak penyok, tidak baret, tidak bolong")).strip()

        # 2. Kondisi Fisik Kontainer / Bak Truk Setelah Isi Dibongkar
        self.floor_after = str(data.get("floor_after", "Rata, tidak ditemukan kebocoran")).strip()
        self.wall_after = str(data.get("wall_after", "Tidak penyok, tidak baret, tidak bolong")).strip()

        # 3. Kondisi Isi Barang Yang Dikirim
        self.cargo_arrangement = str(data.get("cargo_arrangement", "Baik")).strip()  # Baik / Roboh
        self.cargo_arrangement_notes = str(data.get("cargo_arrangement_notes", "")).strip()
        self.cargo_condition = str(data.get("cargo_condition", "Baik, tidak ditemukan pecah / bocor")).strip()
        self.cargo_condition_notes = str(data.get("cargo_condition_notes", "")).strip()
        self.cargo_qty_match = str(data.get("cargo_qty_match", "Sesuai dengan Packing List")).strip()
        self.cargo_qty_notes = str(data.get("cargo_qty_notes", "")).strip()

        # Penutup & Legalitas
        self.location = str(data.get("location", "Cibitung")).strip()
        self.spv_name = str(data.get("spv_name", "")).strip()
        self.manager_name = str(data.get("manager_name", "")).strip()
        self.driver_name = str(data.get("driver_name", "")).strip()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "arrival_type": self.arrival_type,
            "container_no": self.container_no,
            "seal_no": self.seal_no,
            "seal_condition": self.seal_condition,
            "container_temp_type": self.container_temp_type,
            "temp_celsius": self.temp_celsius,
            "floor_before": self.floor_before,
            "wall_before": self.wall_before,
            "floor_after": self.floor_after,
            "wall_after": self.wall_after,
            "cargo_arrangement": self.cargo_arrangement,
            "cargo_arrangement_notes": self.cargo_arrangement_notes,
            "cargo_condition": self.cargo_condition,
            "cargo_condition_notes": self.cargo_condition_notes,
            "cargo_qty_match": self.cargo_qty_match,
            "cargo_qty_notes": self.cargo_qty_notes,
            "location": self.location,
            "spv_name": self.spv_name,
            "manager_name": self.manager_name,
            "driver_name": self.driver_name
        }


# ----------------- OOP: SETTINGS SERVICE -----------------
class SettingsService:
    """Manages application-wide settings with dynamic configuration."""
    
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
                "qa_documents": DEFAULT_QA_DOCUMENTS,
                "role_permissions": DEFAULT_ROLE_PERMISSIONS,
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

        # Load dynamic QA Documents
        qa_docs = DEFAULT_QA_DOCUMENTS
        if "qa_documents_json" in row.keys() and row["qa_documents_json"]:
            try:
                loaded_qa = json.loads(row["qa_documents_json"])
                if isinstance(loaded_qa, dict) and len(loaded_qa) > 0:
                    qa_docs = {**DEFAULT_QA_DOCUMENTS, **loaded_qa}
            except Exception:
                pass

        # Load dynamic Role Permissions
        role_perms = PermissionService.get_permissions(conn)
                
        return {
            "id": "global",
            "required": req,
            "duplicate_rule": dup,
            "hold_categories": categories,
            "workflow_stages": DEFAULT_WORKFLOW_STAGES,
            "qa_documents": qa_docs,
            "role_permissions": role_perms,
            "updated_at": row["updated_at"],
            "updated_by_name": row["updated_by_name"]
        }

    @staticmethod
    def update_settings(conn, required: Dict[str, bool], duplicate_rule: str, hold_categories: List[str], admin_name: str, qa_documents: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        cats = [c.strip() for c in hold_categories if c and c.strip()]
        if not cats:
            cats = DEFAULT_HOLD_CATEGORIES

        qa_docs_to_save = {**DEFAULT_QA_DOCUMENTS, **(qa_documents or {})}

        # Preserve existing permissions
        existing_row = conn.execute("SELECT * FROM settings WHERE id = 'global'").fetchone()
        existing_perms_json = json.dumps(DEFAULT_ROLE_PERMISSIONS)
        if existing_row and "role_permissions_json" in existing_row.keys() and existing_row["role_permissions_json"]:
            existing_perms_json = existing_row["role_permissions_json"]

        conn.execute("""
            INSERT OR REPLACE INTO settings 
            (id, required_json, duplicate_rule, hold_categories_json, qa_documents_json, role_permissions_json, updated_at, updated_by_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ("global", json.dumps(required), duplicate_rule, json.dumps(cats), json.dumps(qa_docs_to_save), existing_perms_json, now, admin_name))
        
        return {
            "id": "global",
            "required": required,
            "duplicate_rule": duplicate_rule,
            "hold_categories": cats,
            "workflow_stages": DEFAULT_WORKFLOW_STAGES,
            "qa_documents": qa_docs_to_save,
            "role_permissions": json.loads(existing_perms_json),
            "updated_at": now,
            "updated_by_name": admin_name
        }


# ----------------- OOP: PERMISSION SERVICE (RBAC) -----------------
class PermissionService:
    """
    OOP RBAC (Role-Based Access Control) Service.
    Mengelola matriks perizinan peran pengguna dan memvalidasi wewenang eksekusi aksi secara dinamis.
    """
    @classmethod
    def get_permissions(cls, conn) -> Dict[str, Dict[str, bool]]:
        try:
            row = conn.execute("SELECT * FROM settings WHERE id = 'global'").fetchone()
            if row and "role_permissions_json" in row.keys() and row["role_permissions_json"]:
                loaded = json.loads(row["role_permissions_json"])
                if isinstance(loaded, dict) and len(loaded) > 0:
                    merged = {}
                    for r, default_perms in DEFAULT_ROLE_PERMISSIONS.items():
                        merged[r] = {**default_perms, **loaded.get(r, {})}
                    return merged
        except Exception:
            pass
        return DEFAULT_ROLE_PERMISSIONS

    @classmethod
    def save_permissions(cls, conn, permissions: Dict[str, Dict[str, bool]], admin_name: str) -> Dict[str, Dict[str, bool]]:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        current_perms = cls.get_permissions(conn)
        # Deep merge
        updated = {}
        for r, default_perms in DEFAULT_ROLE_PERMISSIONS.items():
            updated[r] = {**default_perms, **(permissions.get(r) or {})}
        
        # Ensure column exists
        try:
            cols = [col[1] for col in conn.execute("PRAGMA table_info(settings)").fetchall()]
            if "role_permissions_json" not in cols:
                conn.execute("ALTER TABLE settings ADD COLUMN role_permissions_json TEXT DEFAULT '{}'")
        except Exception:
            pass

        conn.execute("""
            UPDATE settings 
            SET role_permissions_json = ?, updated_at = ?, updated_by_name = ?
            WHERE id = 'global'
        """, (json.dumps(updated), now, admin_name))
        return updated

    @classmethod
    def has_permission(cls, conn, role: str, perm_key: str) -> bool:
        if role == "admin":
            return True  # Super administrator retains master access
        perms = cls.get_permissions(conn)
        role_perms = perms.get(role, {})
        return bool(role_perms.get(perm_key, False))


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
            if not PermissionService.has_permission(conn, user_role, "tally_submit"):
                raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user_role}' tidak memiliki izin 'tally_submit' untuk menyerahkan dokumen.")
            new_status = "waiting_admin"
            new_handler_role = "warehouse_admin"
            log_detail = f"Checker ({user['name']}) menyerahkan dokumen kedatangan ke Admin Warehouse"

        # 2. ACTION: admin_hold (Admin menahan dokumen)
        elif action == "admin_hold":
            if status not in ("waiting_admin", "waiting_admin_1"):
                raise HTTPException(status_code=400, detail=f"Dokumen berstatus '{status}' tidak dapat ditahan Admin. Dokumen harus dalam status Menunggu Verifikasi Admin.")
            if not PermissionService.has_permission(conn, user_role, "admin_hold"):
                raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user_role}' tidak memiliki izin 'admin_hold' untuk menahan dokumen.")
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
            if not PermissionService.has_permission(conn, user_role, "admin_verify"):
                raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user_role}' tidak memiliki izin 'admin_verify' untuk memverifikasi dokumen ke QC.")
            new_status = "waiting_qc"
            new_handler_role = "qc"
            log_detail = f"Admin Warehouse ({user['name']}) memverifikasi dokumen & meneruskan ke Tim QC untuk sampling/uji mutu"

        # 4. ACTION: return_to_checker (Admin mengembalikan ke Checker untuk revisi fisik)
        elif action == "return_to_checker":
            if status not in ("waiting_admin", "waiting_admin_1", "admin_hold"):
                raise HTTPException(status_code=400, detail=f"Dokumen berstatus '{status}' tidak dapat dikembalikan ke Checker.")
            if not PermissionService.has_permission(conn, user_role, "return_to_checker"):
                raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user_role}' tidak memiliki izin 'return_to_checker' untuk mengembalikan dokumen ke Checker.")
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
            if not PermissionService.has_permission(conn, user_role, "qc_hold"):
                raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user_role}' tidak memiliki izin 'qc_hold' untuk menahan uji mutu.")
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
            if not PermissionService.has_permission(conn, user_role, "qc_approve"):
                raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user_role}' tidak memiliki izin 'qc_approve' untuk menyetujui mutu material.")
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
            if not PermissionService.has_permission(conn, user_role, "qc_reject"):
                raise HTTPException(status_code=403, detail=f"Akses ditolak. Role '{user_role}' tidak memiliki izin 'qc_reject' untuk menolak mutu material.")
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
