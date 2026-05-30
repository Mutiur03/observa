type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T>({ rows, columns, empty }: { rows: T[]; columns: Column<T>[]; empty: string }) {
  if (!rows.length) {
    return <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted shadow-sm">{empty}</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-muted/80 text-xs uppercase tracking-[0.12em] text-muted">
          <tr>{columns.map((column) => <th key={column.key} scope="col" className="px-4 py-3">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/70 transition-colors hover:bg-surface-muted/60 last:border-b-0">
              {columns.map((column) => <td key={column.key} className="px-4 py-3 align-top text-ink">{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
