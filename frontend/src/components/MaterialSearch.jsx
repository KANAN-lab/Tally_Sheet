import { useEffect, useRef, useState } from "react";
import { Loader2, Search, SearchX, X } from "lucide-react";
import { api } from "@/lib/api";

export default function MaterialSearch({ value, onSelect, onClear, error, testId, autoFocus }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api.get("/materials/search", { params: { q: term } })
        .then((r) => { setResults(r.data); setActive(0); })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (m) => {
    onSelect(m);
    setQ("");
    setOpen(false);
  };

  const onKey = (e) => {
    if (!open || !results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
    if (e.key === "Escape") setOpen(false);
  };

  if (value) {
    return (
      <div className={`flex items-center gap-2 rounded-md border px-2.5 py-2 bg-blue-50/60 ${error ? "border-rose-400" : "border-blue-200"}`} data-testid={`${testId}-selected`}>
        <span className="font-mono text-xs font-semibold text-blue-900" data-testid={`${testId}-selected-code`}>{value}</span>
        <button type="button" onClick={onClear} title="Ganti material" className="ml-auto rounded p-0.5 text-slate-500 hover:bg-white hover:text-rose-600" data-testid={`${testId}-clear`}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={box}>
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Ketik kode / deskripsi material..."
        className={`h-9 w-full rounded-md border bg-white pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${error ? "border-rose-400" : "border-slate-300"}`}
        data-testid={testId}
      />
      {loading && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      {open && q.trim() && !loading && (
        <div className="absolute z-40 mt-1 max-h-72 w-full min-w-[320px] overflow-auto rounded-lg border bg-white shadow-xl" data-testid={`${testId}-results`}>
          {results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-rose-600" data-testid={`${testId}-not-found`}>
              <SearchX className="h-4 w-4" /> Material tidak ditemukan dalam Master Data
            </div>
          ) : (
            results.map((m, i) => (
              <button
                type="button"
                key={m.code}
                onMouseDown={(e) => { e.preventDefault(); choose(m); }}
                onMouseEnter={() => setActive(i)}
                className={`block w-full px-3 py-2 text-left border-b last:border-0 ${i === active ? "bg-blue-50" : "bg-white"}`}
                data-testid={`${testId}-option-${m.code}`}
              >
                <div className="font-mono text-xs font-semibold text-blue-900">{m.code}</div>
                <div className="text-sm text-slate-700">{m.name}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
