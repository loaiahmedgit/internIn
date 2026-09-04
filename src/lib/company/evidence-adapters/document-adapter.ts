import "server-only";

/**
 * Real text extraction for document formats — PDF (already used for CVs,
 * generalized here) and DOCX (new, via mammoth — nothing in this repo
 * could read a docx before this). Plain text/markdown/csv/json just decode.
 * Returns null when the format has no extractor here (image/video/audio/
 * unknown) — the caller marks that "requires human review", never invents
 * a transcript.
 */
export async function extractDocumentText(buffer: Buffer, extension: string): Promise<string | null> {
  const ext = extension.toLowerCase();
  if (ext === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  if (ext === ".txt" || ext === ".md" || ext === ".csv" || ext === ".json") {
    return buffer.toString("utf8");
  }
  return null;
}
