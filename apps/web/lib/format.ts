export function fmtPct(x: number, digits = 2): string {
  return (x * 100).toFixed(digits) + " %";
}

export function fmtMoney(x: number): string {
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtGrowth(g: number, digits = 3): string {
  return (g >= 0 ? "+" : "") + (g * 100).toFixed(digits) + " %";
}
