export function fmtNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(undefined, opts);
}
