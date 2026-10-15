import { ChevronLeft, ChevronRight } from "lucide-react";

function pages(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  if (cur > 3) out.push("...");
  for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) out.push(p);
  if (cur < total - 2) out.push("...");
  out.push(total);
  return out;
}

export default function Pager({ page, total, limit, onChange, testId = "pager" }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const btn = "h-8 min-w-8 px-2 rounded-md border text-xs font-medium transition-colors";
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4" data-testid={testId}>
      <div className="text-xs text-slate-500" data-testid={`${testId}-info`}>Menampilkan {from} - {to} dari {total} data</div>
      <div className="flex items-center gap-1.5">
        <button className={`${btn} bg-white hover:bg-slate-100 disabled:opacity-40`} disabled={page <= 1} onClick={() => onChange(page - 1)} data-testid={`${testId}-prev`}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages(page, totalPages).map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-1 text-xs text-slate-400">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`${btn} ${p === page ? "bg-blue-700 border-blue-700 text-white" : "bg-white hover:bg-slate-100 text-slate-700"}`}
              data-testid={`${testId}-page-${p}`}
            >
              {p}
            </button>
          )
        )}
        <button className={`${btn} bg-white hover:bg-slate-100 disabled:opacity-40`} disabled={page >= totalPages} onClick={() => onChange(page + 1)} data-testid={`${testId}-next`}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
