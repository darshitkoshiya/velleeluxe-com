import { SIZE_CHART, SIZE_COLUMNS, toCm } from '@/lib/size-chart';

/** Size chart table. Shows inches with centimetres underneath. */
export function SizeChartTable({ caption = 'Body measurements' }: { caption?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[520px] border-collapse font-sans text-sm">
        <caption className="mb-3 text-left font-sans text-xs text-slateGrey">{caption} — inches / cm</caption>
        <thead>
          <tr className="border-b border-ink">
            <th scope="col" className="py-3 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.14em]">
              Size
            </th>
            {SIZE_COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="px-2 py-3 text-right text-[11px] font-medium uppercase tracking-[0.14em]">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SIZE_CHART.map((row) => (
            <tr key={row.size} className="border-b border-sand">
              <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
                {row.size}
              </th>
              {SIZE_COLUMNS.map((column) => (
                <td key={column.key} className="px-2 py-3 text-right text-ink">
                  {row[column.key]}&Prime;
                  <span className="block text-xs text-slateGrey">{toCm(row[column.key])} cm</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SizeChartTable;
