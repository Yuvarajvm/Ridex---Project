import React from 'react'

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  containerClassName?: string
}

export const Table: React.FC<TableProps> = ({
  children,
  className = '',
  containerClassName = '',
  ...props
}) => {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm ${containerClassName}`}>
      <table className={`w-full text-left border-collapse text-sm text-slate-600 ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
}

export const TableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <thead className={`bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 ${className}`} {...props}>
    {children}
  </thead>
)

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <tbody className={`divide-y divide-slate-100 bg-white ${className}`} {...props}>
    {children}
  </tbody>
)

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <tr className={`hover:bg-slate-50/80 transition-colors ${className}`} {...props}>
    {children}
  </tr>
)

export const TableHeader: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <th className={`px-5 py-3.5 font-semibold text-slate-700 ${className}`} {...props}>
    {children}
  </th>
)

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <td className={`px-5 py-4 whitespace-nowrap text-slate-800 ${className}`} {...props}>
    {children}
  </td>
)
