const STYLES = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  waiting_admin: "bg-blue-50 text-blue-700 border-blue-200 font-medium",
  waiting_admin_1: "bg-blue-50 text-blue-700 border-blue-200 font-medium",
  admin_hold: "bg-amber-50 text-amber-800 border-amber-300 font-medium",
  waiting_qc: "bg-purple-50 text-purple-700 border-purple-200 font-medium",
  qc_hold: "bg-amber-50 text-amber-800 border-amber-300 font-medium",
  qc_rejected: "bg-rose-50 text-rose-700 border-rose-300 font-bold",
  waiting_gr: "bg-indigo-50 text-indigo-700 border-indigo-200 font-medium",
  gr_hold: "bg-amber-50 text-amber-800 border-amber-300 font-medium",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold",
  final: "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200 line-through",
};

const LABELS = {
  draft: "Draft (Checker)",
  waiting_admin: "Menunggu Admin WH",
  waiting_admin_1: "Menunggu Admin WH",
  admin_hold: "Pending Admin WH",
  waiting_qc: "Dalam Pemeriksaan QC",
  qc_hold: "Pending QC (Pemeriksaan)",
  qc_rejected: "Ditolak QC (Reject)",
  waiting_gr: "Siap Stock UU",
  gr_hold: "Pending Posting",
  completed: "Selesai (Stock Ter-UU)",
  final: "Selesai (Stock Ter-UU)",
  cancelled: "Dibatalkan",
};

export default function StatusBadge({ status, testId }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STYLES[status] || "bg-slate-100 text-slate-700 border-slate-200"}`}
      data-testid={testId || `status-badge-${status}`}
    >
      {LABELS[status] || status}
    </span>
  );
}
