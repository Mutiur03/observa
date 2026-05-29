type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T>({ rows, columns, empty }: { rows: T[]; columns: Column<T>[]; empty: string }) {
  if (!rows.length) {
    return <div className="rounded-md border border-border bg-white p-8 text-center text-sm text-muted">{empty}</div>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted">
          <tr>{columns.map((column) => <th key={column.key} className="px-4 py-3">{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-b-0">
              {columns.map((column) => <td key={column.key} className="px-4 py-3">{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
