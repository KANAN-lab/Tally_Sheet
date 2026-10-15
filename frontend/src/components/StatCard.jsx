import { ArrowDown, ArrowUp } from "lucide-react";

export default function StatCard({ icon: Icon, color, label, value, change, caption, sub, testId, delay = 0, small }) {
  const up = change >= 0;
  return (
    <div
      className="fade-up rounded-xl border bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
      data-testid={testId}
    >
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 shrink-0 rounded-xl grid place-items-center text-white shadow-sm ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-600">{label}</div>
          <div className={`mt-1 font-display font-bold text-slate-900 ${small ? "text-lg leading-tight" : "text-2xl truncate"}`} data-testid={`${testId}-value`}>{value}</div>
          {change !== undefined && (
            <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
              {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
              {Math.abs(change)}%
            </div>
          )}
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
          {caption && <div className="mt-2 text-[11px] text-slate-400">{caption}</div>}
        </div>
      </div>
    </div>
  );
}
