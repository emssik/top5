/**
 * Print data as JSON (for --json flag) or formatted table.
 */
export function printResult(data: unknown, opts: { json?: boolean; formatFn?: () => string }): void {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2))
  } else if (opts.formatFn) {
    console.log(opts.formatFn())
  }
}

/**
 * Simple text table with column alignment.
 * columns: array of { header, key, width?, align? }
 */
export interface Column<T> {
  header: string
  value: (row: T, index: number) => string
  width?: number
  align?: 'left' | 'right'
}

export function formatTable<T>(rows: T[], columns: Column<T>[]): string {
  if (rows.length === 0) return '  (none)'

  // Calculate column widths
  const widths = columns.map((col) => {
    const headerLen = col.header.length
    const maxDataLen = rows.reduce((max, row, idx) => Math.max(max, col.value(row, idx).length), 0)
    return col.width ?? Math.max(headerLen, maxDataLen)
  })

  // Header line
  const header = columns
    .map((col, i) => pad(col.header, widths[i], col.align ?? 'left'))
    .join('  ')

  // Data lines
  const lines = rows.map((row, rowIdx) =>
    columns
      .map((col, i) => pad(col.value(row, rowIdx), widths[i], col.align ?? 'left'))
      .join('  ')
  )

  return ['  ' + header, ...lines.map((l) => '  ' + l)].join('\n')
}

function pad(str: string, width: number, align: 'left' | 'right'): string {
  if (str.length >= width) return str
  const padding = ' '.repeat(width - str.length)
  return align === 'right' ? padding + str : str + padding
}

export function warn(message: string): void {
  console.error(`Warning: ${message}`)
}

export function die(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}
