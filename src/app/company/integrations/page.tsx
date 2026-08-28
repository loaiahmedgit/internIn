import { CompanyPageContainer, CompanyPageHeader } from "@/components/company/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight } from "lucide-react";
import {
  TeamsIcon,
  SlackIcon,
  LoomIcon,
  ZoomIcon,
  GoogleCalendarIcon,
  OutlookIcon,
  CalendlyIcon,
  GoogleDriveIcon,
  JiraIcon,
  LinearIcon,
  TrelloIcon,
  NotionIcon,
  AsanaIcon,
  DropboxIcon,
  StripeIcon,
  OneDriveIcon,
  SharePointIcon,
  DocuSignIcon,
} from "@/components/company/brand-icons";

const CATEGORIES: {
  name: string;
  integrations: { name: string; description: string; icon: React.ComponentType }[];
}[] = [
  {
    name: "Communication",
    integrations: [
      { name: "Microsoft Teams", description: "Send candidate, intern and supervisor updates into selected Teams channels.", icon: TeamsIcon },
      { name: "Slack", description: "Post new submissions and offers to a Slack channel your team already watches.", icon: SlackIcon },
      { name: "Loom", description: "Share async video check-ins and feedback with interns instead of another meeting.", icon: LoomIcon },
    ],
  },
  {
    name: "Meetings & calendar",
    integrations: [
      { name: "Zoom", description: "Schedule and join candidate interviews and supervisor check-ins.", icon: ZoomIcon },
      { name: "Google Calendar", description: "Add interview slots and check-in reminders straight to your calendar.", icon: GoogleCalendarIcon },
      { name: "Outlook Calendar", description: "Same scheduling, synced with a Microsoft 365 calendar instead.", icon: OutlookIcon },
      { name: "Calendly", description: "Let candidates pick an interview slot from your team's availability directly.", icon: CalendlyIcon },
    ],
  },
  {
    name: "Work management",
    integrations: [
      { name: "Jira", description: "Sync approved internship tasks with the team's existing Jira workflow.", icon: JiraIcon },
      { name: "Linear", description: "Track internship deliverables alongside your product roadmap in Linear.", icon: LinearIcon },
      { name: "Trello", description: "Mirror an internship's weekly tasks onto a Trello board your team already uses.", icon: TrelloIcon },
      { name: "Asana", description: "Assign and track internship tasks inside an existing Asana project.", icon: AsanaIcon },
      { name: "Notion", description: "Use approved Notion pages as internship resources and program documentation.", icon: NotionIcon },
    ],
  },
  {
    name: "Files",
    integrations: [
      { name: "Google Drive", description: "Keep challenge deliverables and program documents in a shared Drive folder.", icon: GoogleDriveIcon },
      { name: "Dropbox", description: "Store challenge submissions and program files in a shared Dropbox folder.", icon: DropboxIcon },
      { name: "OneDrive", description: "Keep challenge deliverables and program documents in a shared OneDrive folder.", icon: OneDriveIcon },
      { name: "SharePoint", description: "Publish internship program documentation to a team SharePoint site.", icon: SharePointIcon },
    ],
  },
  {
    name: "Payments",
    integrations: [
      { name: "Stripe", description: "Pay the internship placement fee directly instead of the current manual step.", icon: StripeIcon },
    ],
  },
  {
    name: "Documents & signatures",
    integrations: [
      { name: "DocuSign", description: "Send and sign internship offer letters without leaving internIn.", icon: DocuSignIcon },
    ],
  },
];

export default function CompanyIntegrationsPage() {
  return (
    <CompanyPageContainer>
      <CompanyPageHeader
        eyebrow="Integrations"
        title="Connect your team's tools"
        description="Bring your existing tools into internIn so your team can manage internships without unnecessary context switching."
      />

      <div className="mt-8 space-y-8">
        {CATEGORIES.map((category) => (
          <section key={category.name}>
            <h2 className="text-sm font-semibold text-navy">{category.name}</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {category.integrations.map((integration) => (
                <Card key={integration.name} className="rounded-xl border border-navy/10 shadow-none ring-0">
                  <CardContent className="px-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex size-9 items-center justify-center rounded-lg border border-navy/10">
                        <integration.icon />
                      </div>
                      <Badge variant="secondary">Coming soon</Badge>
                    </div>
                    <p className="mt-3 text-sm font-medium text-navy">{integration.name}</p>
                    <p className="mt-1 text-xs text-navy/55">{integration.description}</p>
                    <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
                      Connect
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Card className="mt-8 rounded-xl border border-navy/10 shadow-none ring-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal/10">
              <ShieldCheck className="size-4 text-teal-ink" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-navy">Secure by design</p>
              <p className="text-xs text-navy/55">We use industry-standard encryption and follow best practices to keep your data safe.</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-navy/40">
            Learn more <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </CardContent>
      </Card>
    </CompanyPageContainer>
  );
}
