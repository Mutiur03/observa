type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T>({ rows, columns, empty }: { rows: T[]; columns: Column<T>[]; empty: string }) {
  if (!rows.length) {
    return <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted shadow-sm">{empty}</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="grid gap-3 p-3 md:hidden">
        {rows.map((row, index) => (
          <div key={index} className="rounded-md border border-border bg-surface p-3">
            {columns.map((column) => (
              <div key={column.key} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-border/70 py-2 text-sm last:border-b-0">
                <div className="text-xs font-semibold uppercase text-muted">{column.label || "Actions"}</div>
                <div className="min-w-0 break-words text-ink">{column.render(row)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-border bg-surface-muted/80 text-xs uppercase tracking-[0.12em] text-muted">
          <tr>{columns.map((column) => <th key={column.key} scope="col" className="px-4 py-3">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/70 transition-colors hover:bg-surface-muted/60 last:border-b-0">
              {columns.map((column) => <td key={column.key} className="max-w-[260px] break-words px-4 py-3 align-top text-ink">{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
