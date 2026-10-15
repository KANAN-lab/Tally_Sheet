const STYLES = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  final: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};
const LABELS = { draft: "Draft", final: "Final", cancelled: "Cancelled" };

export default function StatusBadge({ status, testId }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${STYLES[status] || ""}`}
      data-testid={testId || `status-badge-${status}`}
    >
      {LABELS[status] || status}
    </span>
  );
}
