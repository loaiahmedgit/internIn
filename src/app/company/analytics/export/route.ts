import { requireCurrentCompanyMember } from "@/lib/auth";
import { getHiringData } from "@/lib/company/hiring-data";
import { hiringCohort, hiringMetrics } from "@/lib/company/hiring-metrics";

export async function GET(request: Request) {
  const { membership } = await requireCurrentCompanyMember();
  const requested = Number(new URL(request.url).searchParams.get("window"));
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const data = await getHiringData(membership.companyId);
  const rows = hiringCohort(data.applications, days, new Date());
  const cell = (value: string | number) =>
    `"${String(value)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""')}"`;
  const csv = [
    [
      "Internship",
      "Application window (days)",
      "Applicants",
      "Active candidates",
      "To review",
      "Shortlisted",
      "Offer sent",
      "Archived",
      "Offers pending",
      "Offers accepted",
      "Time to hire (days)",
      "Offer acceptance (responded offers)",
    ],
    ...data.postings.map((p) => {
      const m = hiringMetrics(rows.filter((a) => a.opportunityId === p.id));
      return [
        p.role,
        days,
        m.applicants,
        m.active,
        m.toReview,
        m.shortlisted,
        m.offerSent,
        m.archived,
        m.pending,
        m.accepted,
        m.timeToHire?.toFixed(1) ?? "",
        m.acceptance === null ? "" : `${(m.acceptance * 100).toFixed(1)}%`,
      ];
    }),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="internin-hiring-${days}-days.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
