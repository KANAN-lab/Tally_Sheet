export const ROLE_LABELS = {
  admin: "Super Administrator",
  warehouse_admin: "Admin Warehouse",
  checker: "Checker Gudang",
  qc: "Quality Control (QC)",
  user: "Viewer / Staff"
};

/**
 * OOP Workflow Service for incoming tally sheets.
 * Alur Bisnis Proses: Checker -> Admin Warehouse -> Quality Control (Stock Ter-UU)
 */
export class WorkflowService {
  static STAGES = [
    {
      id: "checker",
      label: "1. Checker",
      desc: "Hitung Fisik & Input SJ/PO",
      role: "checker"
    },
    {
      id: "admin",
      label: "2. Admin Warehouse",
      desc: "Verifikasi Dokumen & Request QC",
      role: "warehouse_admin"
    },
    {
      id: "qc",
      label: "3. Quality Control (QC)",
      desc: "Uji Mutu Fisik & Stock Ter-UU",
      role: "qc"
    }
  ];

  static getStages() {
    return this.STAGES;
  }

  static getActiveStageIndex(status) {
    if (!status || status === "draft") return 0;
    if (status === "waiting_admin" || status === "waiting_admin_1" || status === "admin_hold") return 1;
    if (status === "waiting_qc" || status === "qc_hold" || status === "qc_rejected") return 2;
    if (status === "completed") return 3; // All stages done
    return 0;
  }

  static isCompleted(status) {
    return status === "completed";
  }

  static isCancelled(status) {
    return status === "cancelled";
  }

  static isHold(status) {
    return status === "admin_hold" || status === "qc_hold";
  }

  static isReject(status) {
    return status === "qc_rejected";
  }

  /**
   * Determine available action triggers based on current status and user role / dynamic permissions
   */
  static getAvailableActions(status, userOrRole) {
    const role = typeof userOrRole === "string" ? userOrRole : (userOrRole?.role || "user");
    const perms = typeof userOrRole === "object" ? userOrRole?.permissions : null;

    const can = (permKey, fallback) => {
      if (perms && typeof perms[permKey] === "boolean") {
        return perms[permKey];
      }
      return fallback;
    };

    const isSuper = role === "admin";
    const isAdmin = isSuper || role === "warehouse_admin";
    const isQC = isSuper || role === "qc";
    const isChecker = isSuper || role === "checker";

    const actions = [];

    // Stage 1: Draft (Checker)
    if (status === "draft" && (isSuper || can("tally_submit", isChecker))) {
      actions.push({
        id: "submit_to_admin",
        label: "Kirim ke Admin Warehouse",
        variant: "primary",
        icon: "Send"
      });
    }

    // Stage 2: Admin Warehouse Verification
    if (status === "waiting_admin" || status === "waiting_admin_1" || status === "admin_hold") {
      if (isSuper || can("admin_verify", isAdmin)) {
        actions.push({
          id: "send_to_qc",
          label: "Teruskan ke QC (Request Sampling)",
          variant: "purple",
          icon: "ShieldCheck"
        });
      }
      if (isSuper || can("admin_hold", isAdmin)) {
        actions.push({
          id: "admin_hold",
          label: "Tahan Dokumen (Hold Admin)",
          variant: "amber",
          icon: "Clock"
        });
      }
      if (isSuper || can("return_to_checker", isAdmin)) {
        actions.push({
          id: "return_to_checker",
          label: "Kembalikan ke Checker (Revisi)",
          variant: "outline",
          icon: "RotateCcw"
        });
      }
    }

    // Stage 3: QC Inspection (Approve langsung Stock Ter-UU, tanpa input COA)
    if (status === "waiting_qc" || status === "qc_hold") {
      if (isSuper || can("qc_approve", isQC)) {
        actions.push({
          id: "qc_approve",
          label: "Lolos Uji Mutu / Stock Ter-UU",
          variant: "emerald",
          icon: "CheckCircle2"
        });
      }
      if (isSuper || can("qc_hold", isQC)) {
        actions.push({
          id: "qc_hold",
          label: "Tahan QC (Pending Lab/Sampling)",
          variant: "amber",
          icon: "Clock"
        });
      }
      if (isSuper || can("qc_reject", isQC)) {
        actions.push({
          id: "qc_reject",
          label: "Tolak Mutu (QC Reject)",
          variant: "rose",
          icon: "XCircle"
        });
      }
    }

    return actions;
  }
}
