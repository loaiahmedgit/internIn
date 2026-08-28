import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Hash, FileStack, KanbanSquare } from "lucide-react";

const INTEGRATIONS = [
  { name: "Microsoft Teams", description: "Get candidate and intern updates in a Teams channel.", icon: MessageSquare },
  { name: "Google Workspace", description: "Sync internship calendars and shared documents.", icon: Mail },
  { name: "Slack", description: "Post new submissions and offers to a Slack channel.", icon: Hash },
  { name: "Notion", description: "Mirror internship programs into a Notion workspace.", icon: FileStack },
  { name: "Jira", description: "Track internship tasks alongside your engineering board.", icon: KanbanSquare },
];

export default function CompanyIntegrationsPage() {
  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-teal-ink">Integrations</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">Integrations</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/60">
        Connect the tools your team already uses. None of these are wired up yet — this is a preview of what&apos;s
        coming.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((integration) => (
          <Card key={integration.name} className="rounded-xl border border-navy/10 shadow-none ring-0">
            <CardContent className="px-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-teal/10">
                  <integration.icon className="size-4 text-teal-ink" aria-hidden="true" />
                </div>
                <Badge variant="secondary">Coming soon</Badge>
              </div>
              <p className="mt-3 text-sm font-medium text-navy">{integration.name}</p>
              <p className="mt-1 text-xs text-navy/50">{integration.description}</p>
              <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
                Connect
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
