import { useEffect, useState } from "react";
import { Loader2, Search, SearchX, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { api } from "@/lib/api";

export default function MaterialSearch({ value, onSelect, onClear, error, testId, autoFocus }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api.get("/materials/search", { params: { q: term } })
        .then((r) => {
          setResults(r.data);
          setActive(0);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const choose = (m) => {
    onSelect(m);
    setQ("");
    setOpen(false);
  };

  const onKey = (e) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (value) {
    return (
      <div
        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 min-h-[36px] bg-blue-50/70 ${
          error ? "border-rose-400" : "border-blue-200"
        }`}
        data-testid={`${testId}-selected`}
      >
        <span className="font-mono text-xs font-bold text-blue-900" data-testid={`${testId}-selected-code`}>
          {value}
        </span>
        <button
          type="button"
          onClick={onClear}
          title="Ganti material"
          className="ml-auto rounded p-0.5 text-slate-400 hover:bg-white hover:text-rose-600 transition-colors"
          data-testid={`${testId}-clear`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const isOpen = open && Boolean(q.trim()) && !loading;

  return (
    <Popover open={isOpen} onOpenChange={setOpen} modal={false}>
      <PopoverAnchor asChild>
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={q}
            autoFocus={autoFocus}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => {
              if (q.trim()) setOpen(true);
            }}
            onKeyDown={onKey}
            placeholder="Ketik kode / deskripsi material..."
            className={`h-9 w-full rounded-md border bg-white pl-8 pr-8 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 ${
              error ? "border-rose-400" : "border-slate-300"
            }`}
            data-testid={testId}
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="z-[9999] p-0 w-[--radix-popover-trigger-width] min-w-[380px] max-w-[520px] max-h-72 overflow-y-auto bg-white border border-slate-200 shadow-2xl rounded-lg"
        data-testid={`${testId}-results`}
      >
        {results.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-rose-600" data-testid={`${testId}-not-found`}>
            <SearchX className="h-4 w-4 shrink-0" /> Material tidak ditemukan dalam Master Data
          </div>
        ) : (
          results.map((m, i) => (
            <button
              type="button"
              key={m.code}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(m);
              }}
              onMouseEnter={() => setActive(i)}
              className={`block w-full px-3 py-2 text-left border-b last:border-0 transition-colors ${
                i === active ? "bg-blue-50/80" : "bg-white hover:bg-slate-50"
              }`}
              data-testid={`${testId}-option-${m.code}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-blue-900">{m.code}</span>
                {m.uom && (
                  <span className="font-mono text-[10px] bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.5 rounded">
                    {m.uom}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-700 leading-snug mt-0.5">{m.name}</div>
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
