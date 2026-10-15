import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialSearch from "@/components/MaterialSearch";

export const GRID = "lg:grid lg:grid-cols-[44px_150px_minmax(180px,1fr)_120px_120px_138px_138px_150px_36px] lg:gap-2 lg:items-start";

function FieldError({ msg, testId }) {
  if (!msg) return null;
  return <p className="mt-1 text-[11px] leading-tight text-rose-600" data-testid={testId}>{msg}</p>;
}

function Cell({ label, children, className = "" }) {
  return (
    <div className={`mb-3 lg:mb-0 ${className}`}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:hidden">{label}</div>
      {children}
    </div>
  );
}

const inputCls = (err) =>
  `h-9 w-full rounded-md border bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${err ? "border-rose-400 bg-rose-50/40" : "border-slate-300"}`;

export default function TallyRow({ row, index, errors, pics, required, onChange, onRemove, canRemove }) {
  const e = (f) => errors[`${index}-${f}`];
  const tid = (f) => `tally-row-${index}-${f}`;
  const req = (f) => (required[f] ? " *" : "");
  return (
    <div className={`${GRID} rounded-lg border bg-white p-3 lg:border-0 lg:border-b lg:rounded-none lg:px-2 lg:py-2.5`} data-testid={`tally-editor-row-item-${index}`}>
      <div className="mb-3 flex items-center justify-between lg:mb-0 lg:block">
        <span className="inline-grid h-9 w-9 place-items-center rounded-md bg-slate-100 font-mono text-sm font-semibold text-slate-700" data-testid={tid("seq")}>{index + 1}</span>
        <button type="button" onClick={onRemove} disabled={!canRemove} className="lg:hidden rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" data-testid={`${tid("remove")}-mobile`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <Cell label="Kode Material *" className={row.material_code ? "" : "lg:col-span-2"}>
        <MaterialSearch
          value={row.material_code}
          error={e("material_code")}
          testId="tally-editor-material-code-input"
          onSelect={(m) => onChange({ material_code: m.code, material_name: m.name })}
          onClear={() => onChange({ material_code: "", material_name: "" })}
        />
        <FieldError msg={e("material_code")} testId={tid("material_code-error")} />
      </Cell>
      {row.material_code && (
        <Cell label="Nama Material">
          <div className="min-h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-800" title="Terisi otomatis dari Master Data" data-testid={tid("material_name")}>
            {row.material_name}
          </div>
        </Cell>
      )}
      <Cell label={`Batch Fisik${req("batch_fisik")}`}>
        <input className={inputCls(e("batch_fisik"))} value={row.batch_fisik} maxLength={100} onChange={(ev) => onChange({ batch_fisik: ev.target.value })} data-testid={tid("batch_fisik")} />
        <FieldError msg={e("batch_fisik")} testId={tid("batch_fisik-error")} />
      </Cell>
      <Cell label={`Supplier Batch${req("supplier_batch")}`}>
        <input className={inputCls(e("supplier_batch"))} value={row.supplier_batch} maxLength={100} onChange={(ev) => onChange({ supplier_batch: ev.target.value })} data-testid={tid("supplier_batch")} />
        <FieldError msg={e("supplier_batch")} testId={tid("supplier_batch-error")} />
      </Cell>
      <Cell label={`Expired Date${req("expired_date")}`}>
        <input type="date" className={inputCls(e("expired_date"))} value={row.expired_date} onChange={(ev) => onChange({ expired_date: ev.target.value })} data-testid={tid("expired_date")} />
        <FieldError msg={e("expired_date")} testId={tid("expired_date-error")} />
      </Cell>
      <Cell label={`Production Date${req("production_date")}`}>
        <input type="date" className={inputCls(e("production_date"))} value={row.production_date} onChange={(ev) => onChange({ production_date: ev.target.value })} data-testid={tid("production_date")} />
        <FieldError msg={e("production_date")} testId={tid("production_date-error")} />
      </Cell>
      <Cell label={`PIC${req("pic")}`}>
        <Select value={row.pic_id || undefined} onValueChange={(v) => onChange({ pic_id: v })}>
          <SelectTrigger className={`h-9 bg-white ${e("pic") ? "border-rose-400" : "border-slate-300"}`} data-testid={tid("pic")}>
            <SelectValue placeholder="Pilih PIC" />
          </SelectTrigger>
          <SelectContent>
            {pics.map((p) => <SelectItem key={p.id} value={p.id} data-testid={`${tid("pic")}-option-${p.id}`}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <FieldError msg={e("pic")} testId={tid("pic-error")} />
      </Cell>
      <div className="hidden lg:block">
        <button type="button" onClick={onRemove} disabled={!canRemove} title="Hapus baris" className="h-9 w-9 grid place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" data-testid={tid("remove")}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
