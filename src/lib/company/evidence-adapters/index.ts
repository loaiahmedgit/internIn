import "server-only";

export { extractDocumentText } from "./document-adapter";
export { extractSpreadsheetSummary } from "./spreadsheet-adapter";
export { fetchRepositorySummary } from "./repository-adapter";
export { fetchLinkText } from "./link-adapter";

/** Extensions every adapter here can actually turn into real evidence text. */
export function canExtractExtension(extension: string): boolean {
  return [".pdf", ".docx", ".txt", ".md", ".csv", ".json", ".xlsx"].includes(extension.toLowerCase());
}

export function isRepositoryUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "github.com" || host === "gitlab.com";
  } catch {
    return false;
  }
}
