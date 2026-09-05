import type { PdfcnTheme } from "@/types/pdf-themes";

import { defaultPrimitives } from "./primitives";

/**
 * internIn theme preset — the app's own brand tokens (src/app/globals.css,
 * docs/10-brand-identity.md) applied to the pdfcn/Takumi component layer.
 * Based on pdfcn's own "corporate" preset's structure/spacing (closest
 * shape to internIn's product identity — sans throughout, structured,
 * business-document feel), with colors and typography swapped for
 * internIn's real brand: navy foreground, teal accent, no foreign blues.
 *
 * Font family is Helvetica (Takumi's built-in last-resort Latin font,
 * always available offline) rather than corporate's "Lato" — a challenge
 * resource is generated server-side on every save, so it must never depend
 * on an external Google Fonts fetch succeeding.
 */
export const interninTheme: PdfcnTheme = {
  colors: {
    accent: "#1ba59c",
    background: "#ffffff",
    border: "#c7cdd3",
    destructive: "#dc2626",
    foreground: "#213248",
    info: "#0f766e",
    muted: "#f3f5f7",
    mutedForeground: "#5b6b7d",
    primary: "#0f766e",
    primaryForeground: "#ffffff",
    success: "#16a34a",
    warning: "#d97706",
  },
  name: "internin",
  page: {
    orientation: "portrait",
    size: "A4",
  },
  primitives: defaultPrimitives,
  spacing: {
    componentGap: 13,
    page: {
      marginBottom: 52,
      marginLeft: 44,
      marginRight: 44,
      marginTop: 52,
    },
    paragraphGap: 9,
    sectionGap: 24,
  },
  typography: {
    body: {
      fontFamily: "Helvetica",
      fontSize: 11,
      lineHeight: 1.55,
    },
    heading: {
      fontFamily: "Helvetica",
      fontSize: {
        h1: 22,
        h2: 16,
        h3: 14,
        h4: 12,
        h5: 11,
        h6: 10,
      },
      fontWeight: 700,
      lineHeight: 1.25,
    },
  },
};
