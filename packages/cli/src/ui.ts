/**
 * Minimal terminal formatting with no dependency. Colour is disabled when the output
 * is not a TTY or NO_COLOR is set, so piped CLI output stays clean.
 */
const enabled = process.stdout.isTTY === true && !process.env.NO_COLOR;
const wrap = (code: string) => (text: string) => (enabled ? `\u001b[${code}m${text}\u001b[0m` : text);

export const dim = wrap('2');
export const bold = wrap('1');
export const red = wrap('31');
export const green = wrap('32');
export const yellow = wrap('33');
export const blue = wrap('34');

export const ok = (msg: string) => console.log(`${green('✓')} ${msg}`);
export const info = (msg: string) => console.log(`${blue('›')} ${msg}`);
export const warn = (msg: string) => console.log(`${yellow('!')} ${msg}`);

/** Errors go to stderr with a non-zero exit so scripts and CI can react to them. */
export function fail(message: string, hint?: string): never {
  process.stderr.write(`\n${red('✗')} ${message}\n${hint ? `${dim(`  ${hint}`)}\n` : ''}\n`);
  process.exit(1);
}

export function table(rows: Record<string, string | number>[]): void {
  if (rows.length === 0) { console.log(dim('  (nothing to show)')); return; }
  const columns = Object.keys(rows[0] as object);
  const widths = columns.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));

  const line = (cells: (string | number)[]) =>
    '  ' + cells.map((cell, i) => String(cell).padEnd(widths[i] as number)).join('  ');

  console.log(dim(line(columns)));
  console.log(dim('  ' + widths.map((w) => '─'.repeat(w)).join('  ')));
  for (const row of rows) console.log(line(columns.map((c) => row[c] ?? '')));
}

export function bytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
