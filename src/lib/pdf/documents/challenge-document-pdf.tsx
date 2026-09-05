import { render } from "takumi-pdf";
import { PdfcnThemeProvider } from "@/components/pdf/theme-provider";
import { PageHeader } from "@/components/pdf/page-header/page-header";
import { PageFooter } from "@/components/pdf/page-footer/page-footer";
import { PageNumber } from "@/components/pdf/page-number/page-number";
import { PdfAlert } from "@/components/pdf/alert/alert";
import { Heading } from "@/components/pdf/heading/heading";
import { Text } from "@/components/pdf/text/text";
import { View } from "@/lib/pdf-primitives";
import { interninTheme } from "@/lib/pdf-themes/internin";
import type { DocumentContentSpec } from "@/lib/challenges/submission-model";

/**
 * Renders a challenge resource's DocumentContentSpec (the AI-authored
 * title + sections, see submission-model.ts) into a real, professional PDF
 * using pdfcn's actual Takumi component registry (@pdfcn/takumi/*, copied
 * into src/components/pdf/ and src/lib/pdf-themes/ via `npx shadcn add
 * @pdfcn/...`), themed with internIn's own brand tokens
 * (src/lib/pdf-themes/internin.ts). Takumi itself stays the renderer
 * underneath — no headless browser, native Node.js binding,
 * Vercel-Function-compatible. Replaces the previous pdf-lib manual
 * draw-and-wrap implementation.
 *
 * Falls back to a single "Overview" section built from the plain
 * name/description when no structured spec is available — the same
 * fallback behavior generatePdfBuffer had before this swap.
 */
export async function renderChallengeDocumentPdf(input: {
  name: string;
  description: string;
  spec?: DocumentContentSpec | null;
}): Promise<Uint8Array> {
  const title = input.spec?.title ?? input.name;
  const sections = input.spec?.sections?.length ? input.spec.sections : [{ heading: "Overview", paragraphs: [input.description] }];
  const { marginTop, marginRight, marginBottom, marginLeft } = interninTheme.spacing.page;

  return render(
    <PdfcnThemeProvider theme={interninTheme}>
      <View>
        <Heading level={1}>{title}</Heading>
        <PdfAlert variant="info" showIcon>
          This document was generated for a work-sample challenge on internIn. All names, figures, and scenarios are fictional and provided for evaluation purposes only.
        </PdfAlert>
        {sections.map((section, index) => (
          <View key={index} wrap={false}>
            <Heading level={2} keepWithNext>
              {section.heading}
            </Heading>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <Text key={paragraphIndex}>{paragraph}</Text>
            ))}
          </View>
        ))}
      </View>
    </PdfcnThemeProvider>,
    {
      size: interninTheme.page.size.toLowerCase() as "a4",
      margin: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
      header: (
        <PdfcnThemeProvider theme={interninTheme}>
          <PageHeader title="internIn" rightText="Challenge resource" variant="minimal" />
        </PdfcnThemeProvider>
      ),
      footer: (
        <PdfcnThemeProvider theme={interninTheme}>
          <PageFooter
            leftText="Synthetic content, generated for this challenge — for evaluation purposes only."
            rightText={<PageNumber format="Page {page} of {total}" align="right" />}
            variant="simple"
          />
        </PdfcnThemeProvider>
      ),
      outline: true,
      metadata: {
        title,
        description: "Generated challenge resource — internIn",
        creator: "internIn",
      },
    },
  );
}
