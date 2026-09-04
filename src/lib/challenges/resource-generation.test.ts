import { describe, expect, it } from "vitest";
import { canGenerateExtension, extensionFromName, generateResourceFile, mimeTypeForExtension } from "./resource-generation";

describe("extensionFromName / canGenerateExtension", () => {
  it("extracts a lowercase extension", () => {
    expect(extensionFromName("Dataset.CSV")).toBe(".csv");
    expect(extensionFromName("no-extension")).toBe("");
  });

  it("only claims to generate formats it can actually back with real bytes", () => {
    expect(canGenerateExtension(".csv")).toBe(true);
    expect(canGenerateExtension(".xlsx")).toBe(true);
    expect(canGenerateExtension(".pdf")).toBe(true);
    expect(canGenerateExtension(".docx")).toBe(true);
    expect(canGenerateExtension(".png")).toBe(false);
    expect(canGenerateExtension(".mp4")).toBe(false);
  });

  it("maps every generatable extension to a real mime type", () => {
    expect(mimeTypeForExtension(".csv")).toBe("text/csv");
    expect(mimeTypeForExtension(".pdf")).toBe("application/pdf");
  });
});

describe("generateResourceFile", () => {
  it("returns null for a format it cannot synthesize — never fabricates bytes for it", async () => {
    const result = await generateResourceFile({ name: "team_photo.png", description: "A photo of the team." });
    expect(result).toBeNull();
  });

  it("generates a real, non-empty CSV shaped by the content spec's columns", async () => {
    const result = await generateResourceFile({
      name: "customers.csv",
      description: "Synthetic customer records",
      contentSpec: {
        kind: "spreadsheet",
        columns: [
          { name: "id", dataType: "number" },
          { name: "signupDate", dataType: "date" },
          { name: "active", dataType: "boolean" },
        ],
        rowCount: 5,
      },
    });
    expect(result).not.toBeNull();
    const text = new TextDecoder().decode(result!.buffer);
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(6); // header + 5 rows
    expect(lines[0]).toBe("id,signupDate,active");
    expect(result!.mimeType).toBe("text/csv");
  });

  it("falls back to a real (if simpler) CSV when no content spec is given", async () => {
    const result = await generateResourceFile({ name: "notes.csv", description: "Plain notes" });
    expect(result).not.toBeNull();
    const text = new TextDecoder().decode(result!.buffer);
    expect(text).toContain("notes.csv");
    expect(text).toContain("Plain notes");
  });

  it("generates a real, non-trivial PDF from a document content spec", async () => {
    const result = await generateResourceFile({
      name: "brief.pdf",
      description: "fallback text",
      contentSpec: {
        kind: "document",
        title: "Scenario Brief",
        sections: [{ heading: "Background", paragraphs: ["The fictional company needs help.", "Everything here is synthetic."] }],
      },
    });
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("application/pdf");
    // A real PDF starts with the %PDF- magic bytes — this is not a text file wearing a .pdf extension.
    expect(new TextDecoder().decode(result!.buffer.slice(0, 5))).toBe("%PDF-");
    expect(result!.buffer.byteLength).toBeGreaterThan(500);
  });

  it("generates a real XLSX workbook (a real zip archive, not a text file)", async () => {
    const result = await generateResourceFile({
      name: "dataset.xlsx",
      description: "fallback",
      contentSpec: { kind: "spreadsheet", columns: [{ name: "value", dataType: "number" }], rowCount: 3 },
    });
    expect(result).not.toBeNull();
    // XLSX files are zip archives — real zip archives start with the "PK" signature.
    expect(result!.buffer[0]).toBe(0x50);
    expect(result!.buffer[1]).toBe(0x4b);
  });

  it("generates a real DOCX document (also a real zip archive)", async () => {
    const result = await generateResourceFile({
      name: "recommendation.docx",
      description: "fallback",
      contentSpec: { kind: "document", title: "Recommendation", sections: [{ heading: "Summary", paragraphs: ["Adopt the proposal."] }] },
    });
    expect(result).not.toBeNull();
    expect(result!.buffer[0]).toBe(0x50);
    expect(result!.buffer[1]).toBe(0x4b);
  });

  it("generates real structured JSON from a structured_data content spec", async () => {
    const result = await generateResourceFile({
      name: "records.json",
      description: "fallback",
      contentSpec: { kind: "structured_data", schemaDescription: "customer records", sampleRecords: [{ id: 1, name: "Test" }] },
    });
    expect(result).not.toBeNull();
    const parsed = JSON.parse(new TextDecoder().decode(result!.buffer));
    expect(parsed.records).toEqual([{ id: 1, name: "Test" }]);
  });
});
