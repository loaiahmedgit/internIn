import "server-only";
import ExcelJS from "exceljs";

/**
 * Real workbook reading for XLSX submissions/resources — parsed into a
 * compact structured summary (headers, row count, a few sample rows)
 * rather than dumped as raw/unbounded binary-adjacent text. CSV is handled
 * as plain text (document-adapter.ts) since it's already text; this is
 * specifically for the binary .xlsx format nothing in this repo could
 * read before.
 */
export async function extractSpreadsheetSummary(buffer: Buffer, extension: string): Promise<string | null> {
  if (extension.toLowerCase() !== ".xlsx") return null;

  const workbook = new ExcelJS.Workbook();
  // exceljs's own .d.ts resolves `Buffer` against a different @types/node
  // copy than this project's, so a real Node Buffer still fails structural
  // assignability here — a known ecosystem duplicate-type-declaration
  // quirk, not a real type error. `any` is the standard workaround.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const summaries: string[] = [];
  for (const sheet of workbook.worksheets.slice(0, 5)) {
    const rows: string[] = [];
    let rowCount = 0;
    sheet.eachRow((row, rowNumber) => {
      rowCount++;
      if (rowNumber <= 6) {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push(values.map((v) => String(v ?? "")).join(", "));
      }
    });
    summaries.push(`Sheet "${sheet.name}" (${rowCount} rows):\n${rows.join("\n")}`);
  }
  return summaries.join("\n\n");
}
