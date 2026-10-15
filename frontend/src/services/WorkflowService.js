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
   * Determine available action triggers based on current status and user role
   */
  static getAvailableActions(status, role) {
    const isSuper = role === "admin";
    const isAdmin = isSuper || role === "warehouse_admin";
    const isQC = isSuper || role === "qc";
    const isChecker = isSuper || role === "checker";

    const actions = [];

    // Stage 1: Draft (Checker)
    if (status === "draft" && (isChecker || isSuper)) {
      actions.push({
        id: "submit_to_admin",
        label: "Kirim ke Admin Warehouse",
        variant: "primary",
        icon: "Send"
      });
    }

    // Stage 2: Admin Warehouse Verification
    if ((status === "waiting_admin" || status === "waiting_admin_1" || status === "admin_hold") && isAdmin) {
      actions.push({
        id: "send_to_qc",
        label: "Teruskan ke QC (Request Sampling)",
        variant: "purple",
        icon: "ShieldCheck"
      });
      actions.push({
        id: "admin_hold",
        label: "Tahan Dokumen (Hold Admin)",
        variant: "amber",
        icon: "Clock"
      });
      actions.push({
        id: "return_to_checker",
        label: "Kembalikan ke Checker (Revisi)",
        variant: "outline",
        icon: "RotateCcw"
      });
    }

    // Stage 3: QC Inspection (Approve langsung Stock Ter-UU, tanpa input COA)
    if ((status === "waiting_qc" || status === "qc_hold") && isQC) {
      actions.push({
        id: "qc_approve",
        label: "Lolos Uji Mutu / Stock Ter-UU",
        variant: "emerald",
        icon: "CheckCircle2"
      });
      actions.push({
        id: "qc_hold",
        label: "Tahan QC (Pending Lab/Sampling)",
        variant: "amber",
        icon: "Clock"
      });
      actions.push({
        id: "qc_reject",
        label: "Tolak Mutu (QC Reject)",
        variant: "rose",
        icon: "XCircle"
      });
    }

    return actions;
  }
}
