import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/80", className)}
      {...props}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-6 flex-1 rounded bg-slate-200/90" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-8 flex-1 rounded bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
