export default function PageHeader({ title, subtitle, actions, testId = "page-header" }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between" data-testid={testId}>
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0B2149]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
