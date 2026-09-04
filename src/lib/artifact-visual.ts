import { FileSpreadsheet, FileText, File, Link as LinkIcon, Code2, Image as ImageIcon, Video, Music, Presentation } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SubmissionArtifactKind } from "@/lib/challenges/submission-model";

/**
 * One small, shared file-type -> {icon, color} mapping so every place that
 * lists a resource or submitted artifact (challenge-resources-list,
 * submission-summary, challenge-submission-form) renders the same colored
 * icon for the same kind of file, instead of three ad-hoc guesses.
 */
export interface ArtifactVisual {
  Icon: LucideIcon;
  iconClassName: string;
  bgClassName: string;
}

const VISUALS: Record<string, ArtifactVisual> = {
  pdf: { Icon: FileText, iconClassName: "text-red-600", bgClassName: "bg-red-50" },
  spreadsheet: { Icon: FileSpreadsheet, iconClassName: "text-emerald-600", bgClassName: "bg-emerald-50" },
  dataset: { Icon: FileSpreadsheet, iconClassName: "text-emerald-600", bgClassName: "bg-emerald-50" },
  document: { Icon: FileText, iconClassName: "text-blue-600", bgClassName: "bg-blue-50" },
  presentation: { Icon: Presentation, iconClassName: "text-orange-600", bgClassName: "bg-orange-50" },
  code: { Icon: Code2, iconClassName: "text-slate-600", bgClassName: "bg-slate-100" },
  code_repository: { Icon: Code2, iconClassName: "text-slate-600", bgClassName: "bg-slate-100" },
  figma: { Icon: File, iconClassName: "text-purple-600", bgClassName: "bg-purple-50" },
  image: { Icon: ImageIcon, iconClassName: "text-pink-600", bgClassName: "bg-pink-50" },
  video: { Icon: Video, iconClassName: "text-indigo-600", bgClassName: "bg-indigo-50" },
  audio: { Icon: Music, iconClassName: "text-indigo-600", bgClassName: "bg-indigo-50" },
  portfolio: { Icon: File, iconClassName: "text-purple-600", bgClassName: "bg-purple-50" },
  generic_link: { Icon: LinkIcon, iconClassName: "text-navy/60", bgClassName: "bg-navy/5" },
  text_response: { Icon: FileText, iconClassName: "text-navy/60", bgClassName: "bg-navy/5" },
};

const DEFAULT_VISUAL: ArtifactVisual = { Icon: File, iconClassName: "text-navy/50", bgClassName: "bg-navy/5" };

export function getArtifactVisual(artifactKind: SubmissionArtifactKind | string): ArtifactVisual {
  return VISUALS[artifactKind] ?? DEFAULT_VISUAL;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
