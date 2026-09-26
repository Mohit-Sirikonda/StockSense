// Quote every field. Text that spreadsheets can interpret as a formula is explicitly text.
export function csvCell(value: unknown): string {
  let text =
    value == null
      ? ''
      : typeof value === 'number'
        ? Number.isFinite(value)
          ? String(value)
          : ''
        : String(value);
  if (typeof value !== 'number' && (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeCSV(rows: unknown[][]): string {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
