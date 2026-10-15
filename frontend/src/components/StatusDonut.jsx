import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { PackageCheck } from "lucide-react";

const ITEMS = [
  { key: "completed", label: "Stock Ter-UU", color: "#10b981" },
  { key: "waiting_qc", label: "Pemeriksaan QC", color: "#8b5cf6" },
  { key: "waiting_admin", label: "Verifikasi Admin WH", color: "#3b82f6" },
  { key: "draft", label: "Draft Checker", color: "#f59e0b" },
  { key: "cancelled", label: "Dibatalkan", color: "#ef4444" },
];

export default function StatusDonut({ counts = {} }) {
  const total = ITEMS.reduce((a, i) => a + (counts[i.key] || 0), 0);
  const data = total ? ITEMS.map((i) => ({ ...i, value: counts[i.key] || 0 })) : [{ key: "none", value: 1, color: "#e2e8f0" }];
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm" data-testid="dashboard-status-chart">
      <div className="flex items-center gap-2 font-display font-bold text-[#0B2149]"><PackageCheck className="h-5 w-5" /> Status Tally Sheet</div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-32 w-32 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={42} outerRadius={60} startAngle={90} endAngle={-270} stroke="none">
                {data.map((d) => <Cell key={d.key} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div><div className="font-display text-xl font-bold text-slate-900">{total}</div><div className="text-[10px] text-slate-500">Total</div></div>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {ITEMS.map((i) => (
            <div key={i.key} className="flex items-center justify-between text-xs" data-testid={`dashboard-status-${i.key}`}>
              <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />{i.label}</span>
              <span className="font-semibold text-slate-900">{counts[i.key] || 0} <span className="font-normal text-slate-500">({total ? Math.round(((counts[i.key] || 0) / total) * 100) : 0}%)</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
