/** Client-side file downloads (critique #10: exportable results). */

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCSV(
  filename: string,
  header: string[],
  rows: Array<Array<string | number>>,
): void {
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

export function downloadJSON(filename: string, data: unknown): void {
  downloadBlob(
    filename,
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }),
  );
}
