import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import type { ResourceContentSpec } from "./submission-model";

/**
 * Turns an AI-authored (or company-described) resource into REAL bytes —
 * the whole fix for "the challenge mentions Current_State_Workflow.pdf but
 * no such file exists". Content is synthesized deterministically from the
 * resource's own contentSpec (preferred, semantically real per the AI's own
 * design) or, failing that, its name/description (best-effort, still real
 * content, just less structured) — never an extra AI call, so generation
 * stays fast and doesn't depend on model reliability.
 *
 * Extensions this can actually back with real content: .csv .txt .md .json
 * (no library needed), .pdf (pdf-lib), .xlsx (exceljs), .docx (docx).
 * Anything else (image/video/audio/CAD/zip/repo) returns null — the caller
 * (saveChallengeVersionAction) marks that resource `generation_status:
 * "requires_upload"` rather than pretending a file exists.
 */

export interface GeneratedResourceFile {
  buffer: Uint8Array;
  mimeType: string;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function extensionFromName(name: string): string {
  const match = name.match(/\.[a-zA-Z0-9]+$/);
  return match ? match[0].toLowerCase() : "";
}

export function canGenerateExtension(extension: string): boolean {
  return extension in MIME_BY_EXTENSION;
}

export function mimeTypeForExtension(extension: string): string {
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/** Deterministic synthetic value — real data, not a placeholder string — shaped by the column's declared type. No randomness: same input always regenerates the same file. */
function syntheticCellValue(dataType: "text" | "number" | "date" | "boolean", columnName: string, rowIndex: number, hint?: string): string | number | boolean {
  switch (dataType) {
    case "number":
      return Math.round((((rowIndex + 1) * 37 + columnName.length * 13) % 500) * 1.7 * 100) / 100;
    case "boolean":
      return rowIndex % 2 === 0;
    case "date": {
      const base = new Date(Date.UTC(2026, 0, 1));
      base.setUTCDate(base.getUTCDate() + rowIndex);
      return base.toISOString().slice(0, 10);
    }
    case "text":
    default:
      return hint ? `${hint} #${rowIndex + 1}` : `${columnName} ${rowIndex + 1}`;
  }
}

function csvEscape(value: string | number | boolean): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function generateCsvContent(name: string, description: string, spec: ResourceContentSpec | null | undefined): string {
  if (spec?.kind === "spreadsheet") {
    const header = spec.columns.map((c) => c.name).join(",");
    const rows = Array.from({ length: spec.rowCount }, (_, rowIndex) =>
      spec.columns.map((c) => csvEscape(syntheticCellValue(c.dataType, c.name, rowIndex, spec.rowGenerationHint))).join(","),
    );
    return [header, ...rows].join("\n");
  }
  return `field,note\n"${name}","${description.replace(/"/g, '""')}"`;
}

function generateTextContent(description: string, spec: ResourceContentSpec | null | undefined): string {
  if (spec?.kind === "document") {
    return [spec.title, "", ...spec.sections.flatMap((s) => [s.heading, ...s.paragraphs, ""])].join("\n").trim();
  }
  return description;
}

function generateJsonContent(name: string, description: string, spec: ResourceContentSpec | null | undefined): string {
  if (spec?.kind === "structured_data") {
    return JSON.stringify({ schema: spec.schemaDescription, records: spec.sampleRecords }, null, 2);
  }
  return JSON.stringify({ name, description }, null, 2);
}

/** Naive word-wrap for pdf-lib, which draws single lines only. */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let remaining = paragraph;
    if (!remaining) {
      lines.push("");
      continue;
    }
    while (remaining.length > maxCharsPerLine) {
      let breakAt = remaining.lastIndexOf(" ", maxCharsPerLine);
      if (breakAt <= 0) breakAt = maxCharsPerLine;
      lines.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }
    lines.push(remaining);
  }
  return lines;
}

async function generatePdfBuffer(name: string, description: string, spec: ResourceContentSpec | null | undefined): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 56;
  const lineHeight = 16;

  const title = spec?.kind === "document" ? spec.title : name;
  const bodyLines: { text: string; bold: boolean; size: number }[] = [];
  if (spec?.kind === "document") {
    for (const section of spec.sections) {
      bodyLines.push({ text: section.heading, bold: true, size: 13 });
      for (const paragraph of section.paragraphs) {
        for (const line of wrapText(paragraph, 90)) bodyLines.push({ text: line, bold: false, size: 11 });
      }
      bodyLines.push({ text: "", bold: false, size: 11 });
    }
  } else {
    for (const line of wrapText(description, 90)) bodyLines.push({ text: line, bold: false, size: 11 });
  }

  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;
  page.drawText(title, { x: margin, y, size: 18, font: boldFont, color: rgb(0.13, 0.2, 0.28) });
  y -= 28;

  for (const line of bodyLines) {
    if (y < margin) {
      page = doc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
    page.drawText(line.text, { x: margin, y, size: line.size, font: line.bold ? boldFont : font, color: rgb(0.1, 0.1, 0.12) });
    y -= lineHeight;
  }

  return doc.save();
}

async function generateXlsxBuffer(name: string, description: string, spec: ResourceContentSpec | null | undefined): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  if (spec?.kind === "spreadsheet") {
    const sheet = workbook.addWorksheet(spec.sheetName || "Data");
    sheet.columns = spec.columns.map((c) => ({ header: c.name, key: c.name, width: Math.max(12, c.name.length + 4) }));
    for (let rowIndex = 0; rowIndex < spec.rowCount; rowIndex++) {
      const row: Record<string, string | number | boolean> = {};
      for (const column of spec.columns) row[column.name] = syntheticCellValue(column.dataType, column.name, rowIndex, spec.rowGenerationHint);
      sheet.addRow(row);
    }
    sheet.getRow(1).font = { bold: true };
  } else {
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.columns = [{ header: "Name", key: "name", width: 24 }, { header: "Description", key: "description", width: 60 }];
    sheet.addRow({ name, description });
    sheet.getRow(1).font = { bold: true };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

async function generateDocxBuffer(name: string, description: string, spec: ResourceContentSpec | null | undefined): Promise<Uint8Array> {
  const children: Paragraph[] = [];
  if (spec?.kind === "document") {
    children.push(new Paragraph({ text: spec.title, heading: HeadingLevel.TITLE }));
    for (const section of spec.sections) {
      children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2 }));
      for (const paragraph of section.paragraphs) children.push(new Paragraph({ children: [new TextRun(paragraph)] }));
    }
  } else {
    children.push(new Paragraph({ text: name, heading: HeadingLevel.TITLE }));
    children.push(new Paragraph({ children: [new TextRun(description)] }));
  }
  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

/**
 * Generates a real file for a challenge resource. Returns null when the
 * extension isn't one this pipeline can back with real content — the
 * caller must then leave the resource as `requires_upload`, never invent
 * bytes for a format it can't genuinely produce.
 */
export async function generateResourceFile(input: {
  name: string;
  description: string;
  contentSpec?: ResourceContentSpec | null;
}): Promise<GeneratedResourceFile | null> {
  const extension = extensionFromName(input.name);
  if (!canGenerateExtension(extension)) return null;

  const mimeType = mimeTypeForExtension(extension);
  switch (extension) {
    case ".csv":
      return { buffer: new TextEncoder().encode(generateCsvContent(input.name, input.description, input.contentSpec)), mimeType };
    case ".txt":
    case ".md":
      return { buffer: new TextEncoder().encode(generateTextContent(input.description, input.contentSpec)), mimeType };
    case ".json":
      return { buffer: new TextEncoder().encode(generateJsonContent(input.name, input.description, input.contentSpec)), mimeType };
    case ".pdf":
      return { buffer: await generatePdfBuffer(input.name, input.description, input.contentSpec), mimeType };
    case ".xlsx":
      return { buffer: await generateXlsxBuffer(input.name, input.description, input.contentSpec), mimeType };
    case ".docx":
      return { buffer: await generateDocxBuffer(input.name, input.description, input.contentSpec), mimeType };
    default:
      return null;
  }
}
