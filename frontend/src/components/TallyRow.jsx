import { useState } from "react";
import { AlertCircle, Copy, Lock, Trash2 } from "lucide-react";
import MaterialSearch from "@/components/MaterialSearch";
import SupplierSearch from "@/components/SupplierSearch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const GRID = "lg:grid lg:grid-cols-[36px_135px_minmax(130px,1.2fr)_160px_80px_56px_110px_110px_130px_130px_115px_64px] lg:gap-2 lg:items-start";

function FieldError({ msg, testId }) {
  if (!msg) return null;
  return <p className="mt-1 text-[11px] leading-tight text-rose-600" data-testid={testId}>{msg}</p>;
}

function Cell({ label, children, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:hidden">{label}</div>
      {children}
    </div>
  );
}

const inputCls = (err) =>
  `h-9 w-full rounded-md border bg-white px-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 ${err ? "border-rose-400 bg-rose-50/40" : "border-slate-300"}`;

export default function TallyRow({
  row,
  index,
  errors = {},
  currentUser,
  required = {},
  onChange,
  onDuplicate,
  onRemove,
  canRemove
}) {
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const e = (f) => errors[`${index}-${f}`];
  const tid = (f) => `tally-row-${index}-${f}`;
  const req = (f) => (required[f] ? " *" : "");

  return (
    <div
      className={`${GRID} relative rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xs mb-3 lg:mb-0 lg:shadow-none lg:border-0 lg:border-b lg:rounded-none lg:px-2 lg:py-2.5 transition-colors hover:bg-slate-50/40`}
      style={{ zIndex: Math.max(1, 40 - index) }}
      data-testid={`tally-editor-row-item-${index}`}
    >
      {/* 1. Mobile Header (Only visible on mobile screens < lg) */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 lg:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 font-mono text-xs font-bold text-blue-700" data-testid={tid("seq")}>
            #{index + 1}
          </span>
          <span className="text-xs font-semibold text-slate-800 truncate">
            {row.material_code ? `Baris Material #${index + 1}` : "Input Material Baru"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onDuplicate && row.material_code && (
            <button
              type="button"
              onClick={onDuplicate}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              title="Duplikat baris"
              data-testid={`${tid("duplicate")}-mobile`}
            >
              <Copy className="h-3.5 w-3.5" /> Duplikat
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-20 transition-colors"
            data-testid={`${tid("remove")}-mobile`}
            title="Hapus baris"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 1. Desktop Seq Number Column (Col 1 in desktop grid) */}
      <div className="hidden lg:grid place-items-center">
        <span className="inline-grid h-9 w-9 place-items-center rounded-md bg-slate-100 font-mono text-xs font-semibold text-slate-700" data-testid={`${tid("seq")}-desktop`}>
          {index + 1}
        </span>
      </div>

      {/* Responsive Form Grid: 2 columns on mobile, transparent contents on desktop */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:contents">
        {/* 2. Kode Material */}
        <Cell label="Kode Material *" className={`col-span-2 ${row.material_code ? "lg:col-span-1" : "lg:col-span-2"}`}>
          <MaterialSearch
            value={row.material_code}
            error={e("material_code")}
            testId="tally-editor-material-code-input"
            onSelect={(m) => onChange({ material_code: m.code, material_name: m.name, uom: m.uom || "" })}
            onClear={() => onChange({ material_code: "", material_name: "", uom: "" })}
          />
          <FieldError msg={e("material_code")} testId={tid("material_code-error")} />
        </Cell>

        {/* 3. Nama Material */}
        {row.material_code && (
          <Cell label="Nama Material" className="col-span-2 lg:col-span-1">
            <div className="min-h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 line-clamp-2" title={row.material_name} data-testid={tid("material_name")}>
              {row.material_name}
            </div>
          </Cell>
        )}

        {/* 4. Supplier (From Master MKVZ) */}
        <Cell label="Supplier" className="col-span-2 lg:col-span-1">
          <SupplierSearch
            value={row.supplier_code}
            supplierName={row.supplier_name}
            error={e("supplier")}
            testId={tid("supplier")}
            onSelect={(s) => onChange({ supplier_code: s.code, supplier_name: s.name })}
            onClear={() => onChange({ supplier_code: "", supplier_name: "" })}
          />
        </Cell>

        {/* 5. Quantity (Qty) - Paired side-by-side with UOM on mobile */}
        <Cell label="Qty" className="col-span-1">
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0"
            className={`${inputCls(e("qty"))} text-right font-mono`}
            value={row.qty ?? ""}
            onChange={(ev) => onChange({ qty: ev.target.value === "" ? "" : parseFloat(ev.target.value) || 0 })}
            data-testid={tid("qty")}
          />
          <FieldError msg={e("qty")} testId={tid("qty-error")} />
        </Cell>

        {/* 6. UOM (Auto from Master Material) - Paired side-by-side with Qty on mobile */}
        <Cell label="UOM" className="col-span-1">
          <div
            className="h-9 grid place-items-center rounded-md border border-slate-200 bg-slate-50 px-1 font-mono text-xs font-semibold text-slate-700"
            title={row.uom ? `UOM: ${row.uom} (Otomatis dari Master Data)` : "UOM otomatis"}
            data-testid={tid("uom")}
          >
            {row.uom || "-"}
          </div>
        </Cell>

        {/* 7. Batch Fisik - Paired side-by-side with Produsen on mobile */}
        <Cell label={`Batch Fisik${req("batch_fisik")}`} className="col-span-1">
          <input
            className={inputCls(e("batch_fisik"))}
            value={row.batch_fisik}
            maxLength={100}
            onChange={(ev) => onChange({ batch_fisik: ev.target.value })}
            data-testid={tid("batch_fisik")}
          />
          <FieldError msg={e("batch_fisik")} testId={tid("batch_fisik-error")} />
        </Cell>

        {/* 8. Produsen - Paired side-by-side with Batch Fisik on mobile */}
        <Cell label={`Produsen${req("supplier_batch")}`} className="col-span-1">
          <input
            className={inputCls(e("supplier_batch"))}
            value={row.supplier_batch}
            maxLength={100}
            onChange={(ev) => onChange({ supplier_batch: ev.target.value })}
            data-testid={tid("supplier_batch")}
          />
          <FieldError msg={e("supplier_batch")} testId={tid("supplier_batch-error")} />
        </Cell>

        {/* 9. Expired Date - Paired side-by-side with Production Date on mobile */}
        <Cell label={`Expired Date${req("expired_date")}`} className="col-span-1">
          <input
            type="date"
            className={inputCls(e("expired_date"))}
            value={row.expired_date}
            onChange={(ev) => onChange({ expired_date: ev.target.value })}
            data-testid={tid("expired_date")}
          />
          <FieldError msg={e("expired_date")} testId={tid("expired_date-error")} />
        </Cell>

        {/* 10. Production Date - Paired side-by-side with Expired Date on mobile */}
        <Cell label={`Production Date${req("production_date")}`} className="col-span-1">
          <input
            type="date"
            className={inputCls(e("production_date"))}
            value={row.production_date}
            onChange={(ev) => onChange({ production_date: ev.target.value })}
            data-testid={tid("production_date")}
          />
          <FieldError msg={e("production_date")} testId={tid("production_date-error")} />
        </Cell>

        {/* 11. PIC (Mandatory, Automatically Filled with current User, Locked) */}
        <Cell label="PIC *" className="col-span-2 lg:col-span-1">
          <div
            className="h-9 flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100/80 px-2 text-xs text-slate-700 cursor-not-allowed"
            title="PIC otomatis terisi dengan akun Anda (tidak dapat diubah)"
            data-testid={tid("pic")}
          >
            <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-medium">{currentUser?.name || row.pic_name || "PIC"}</span>
          </div>
        </Cell>
      </div>

      {/* 12. Desktop Actions (Duplicate with Safety Control + Remove) */}
      <div className="hidden lg:flex items-center gap-0.5">
        {onDuplicate && (
          <Popover open={duplicateOpen} onOpenChange={setDuplicateOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={!row.material_code}
                title={row.material_code ? "Duplikat baris ini (kontrol aman)" : "Pilih material terlebih dahulu"}
                className="h-9 w-8 grid place-items-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                data-testid={tid("duplicate")}
              >
                <Copy className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 shadow-xl border-slate-200" align="end">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <span>Duplikat Baris Material #{index + 1}?</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Material, UOM, dan Supplier akan otomatis disalin ke baris baru di bawahnya. Anda dapat mengisi batch atau tanggal berbeda.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1 border-t">
                  <button
                    type="button"
                    onClick={() => setDuplicateOpen(false)}
                    className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateOpen(false);
                      onDuplicate();
                    }}
                    className="rounded bg-[#0B2149] px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-900"
                    data-testid={tid("duplicate-confirm")}
                  >
                    Duplikat
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          title="Hapus baris"
          className="h-9 w-8 grid place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 transition-colors"
          data-testid={tid("remove")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
