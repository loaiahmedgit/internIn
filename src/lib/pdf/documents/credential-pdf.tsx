import { render } from "takumi-pdf";
import { PdfcnThemeProvider } from "@/components/pdf/theme-provider";
import { PageHeader } from "@/components/pdf/page-header/page-header";
import { PageFooter } from "@/components/pdf/page-footer/page-footer";
import { PageNumber } from "@/components/pdf/page-number/page-number";
import { Section } from "@/components/pdf/section/section";
import { Heading } from "@/components/pdf/heading/heading";
import { Text } from "@/components/pdf/text/text";
import { View } from "@/lib/pdf-primitives";
import { interninTheme } from "@/lib/pdf-themes/internin";

const monthYear = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

export interface CredentialPdfInput {
  studentDisplayName: string;
  displayTitle: string;
  companyDisplayName: string;
  companyEndorsed: boolean;
  issuedAt: Date;
  demonstratedCriteria: string[];
  verificationCode: string;
  verificationUrl: string;
}

/**
 * Renders the issued credential's immutable snapshot into a real PDF using
 * pdfcn's Takumi component registry (same architecture as
 * renderChallengeDocumentPdf — no pdf-lib, no jsPDF, no headless browser).
 * Pure snapshot in, bytes out: this function never queries the DB — the
 * caller is responsible for only ever calling it with an `issued` (never
 * revoked/pending) credential's frozen fields (docs/12 §14, Phase 4C §14/§21).
 */
export async function renderCredentialPdf(input: CredentialPdfInput): Promise<Uint8Array> {
  const { marginTop, marginRight, marginBottom, marginLeft } = interninTheme.spacing.page;

  return render(
    <PdfcnThemeProvider theme={interninTheme}>
      <View>
        {/* Explicit top margin — without it this line visually collides with
            the page header's own bottom rule (found via real PDF visual
            inspection, not just byte-validity checks). */}
        <Text variant="sm" weight="semibold" color="primary" transform="uppercase" style={{ marginTop: interninTheme.spacing.sectionGap }}>
          Verified Challenge Credential
        </Text>
        <Heading level={1} noMargin>
          {input.studentDisplayName}
        </Heading>
        <Text color="mutedForeground" style={{ marginTop: 4 }}>
          has demonstrated evidence against the challenge rubric for
        </Text>
        <Heading level={2}>{input.displayTitle}</Heading>
        <Text color="mutedForeground" noMargin>
          Challenge context: {input.companyDisplayName}
        </Text>

        {input.companyEndorsed && (
          <Section variant="highlight" accentColor="primary" spacing="md">
            <Text weight="semibold" color="primary" noMargin>
              Company Endorsed
            </Text>
            <Text variant="xs" color="mutedForeground" noMargin>
              {input.companyDisplayName} has endorsed this credential, alongside internIn&apos;s own verification below.
            </Text>
          </Section>
        )}

        {input.demonstratedCriteria.length > 0 && (
          <View style={{ marginTop: interninTheme.spacing.sectionGap }}>
            <Text variant="sm" weight="semibold" color="mutedForeground" transform="uppercase">
              Demonstrated capabilities
            </Text>
            {input.demonstratedCriteria.map((criterion) => (
              <Text key={criterion} noMargin style={{ marginBottom: 4 }}>
                — {criterion}
              </Text>
            ))}
          </View>
        )}

        <Section variant="default" border padding="md" style={{ marginTop: interninTheme.spacing.sectionGap }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="xs" color="mutedForeground" noMargin>Issued</Text>
            <Text variant="sm" weight="medium" noMargin>{monthYear.format(input.issuedAt)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text variant="xs" color="mutedForeground" noMargin>Credential ID</Text>
            <Text variant="sm" weight="medium" noMargin>{input.verificationCode}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text variant="xs" color="mutedForeground" noMargin>Verification</Text>
            <Text variant="sm" weight="medium" noMargin>{input.verificationUrl}</Text>
          </View>
        </Section>

        <Text variant="xs" color="mutedForeground" style={{ marginTop: interninTheme.spacing.sectionGap }}>
          This credential verifies that the named student demonstrated evidence against the published challenge rubric. It does not represent an employment decision. Verified through internIn.
        </Text>
      </View>
    </PdfcnThemeProvider>,
    {
      size: interninTheme.page.size.toLowerCase() as "a4",
      margin: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
      header: (
        <PdfcnThemeProvider theme={interninTheme}>
          <PageHeader title="internIn" rightText="Verified Challenge Credential" variant="minimal" />
        </PdfcnThemeProvider>
      ),
      footer: (
        <PdfcnThemeProvider theme={interninTheme}>
          <PageFooter leftText={`Verify at ${input.verificationUrl}`} rightText={<PageNumber format="Page {page} of {total}" align="right" />} variant="simple" />
        </PdfcnThemeProvider>
      ),
      outline: true,
      metadata: {
        title: `Verified Challenge Credential — ${input.displayTitle}`,
        description: "internIn Verified Challenge Credential",
        creator: "internIn",
      },
    },
  );
}
