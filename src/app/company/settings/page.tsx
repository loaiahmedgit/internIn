import Link from "next/link";
import { eq } from "drizzle-orm";
import { Settings, Palette, Users, Bell, ShieldCheck } from "lucide-react";
import { getDb, schema } from "@/db";
import { requireCurrentCompanyMember } from "@/lib/auth";
import { hasPermission } from "@/lib/company/permissions";
import { CompanyPageContainer } from "@/components/company/page-shell";
import { HiringHeader } from "@/components/company/hiring-panels";
import {
  SettingsForm,
  TeamMemberAccess,
} from "@/components/company/settings-form";

const tabs = [
  {
    id: "general",
    title: "General",
    icon: Settings,
    description: "Update your workspace details and contact information.",
  },
  {
    id: "branding",
    title: "Branding",
    icon: Palette,
    description: "Manage your company identity on candidate-facing listings.",
  },
  {
    id: "team",
    title: "Team & roles",
    icon: Users,
    description: "Grant access based on responsibilities, not job titles.",
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    description: "Choose which hiring updates you receive by email.",
  },
  {
    id: "privacy",
    title: "Privacy & AI",
    icon: ShieldCheck,
    description: "Control AI assistance and understand candidate data access.",
  },
];
export default async function CompanySettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { membership } = await requireCurrentCompanyMember(null);
  const params = await searchParams;
  const tab = tabs.find((t) => t.id === params.tab) ?? tabs[0];
  const db = getDb();
  const [company] = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.id, membership.companyId));
  const canManage = hasPermission(membership, "workspace_admin");
  const members =
    tab.id === "team"
      ? await db
          .select({
            id: schema.companyMembers.id,
            name: schema.users.fullName,
            email: schema.users.email,
            role: schema.companyMembers.role,
            permissions: schema.companyMembers.permissions,
          })
          .from(schema.companyMembers)
          .innerJoin(
            schema.users,
            eq(schema.users.id, schema.companyMembers.userId),
          )
          .where(eq(schema.companyMembers.companyId, membership.companyId))
      : [];
  const navigation = (
    <nav
      aria-label="Settings sections"
      className="flex gap-1 overflow-x-auto rounded-xl border border-navy/10 p-2 lg:min-h-[460px] lg:flex-col"
    >
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`/company/settings?tab=${t.id}`}
          aria-current={t.id === tab.id ? "page" : undefined}
          className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-teal ${t.id === tab.id ? "bg-teal/8 text-teal-ink" : "text-navy/65 hover:bg-gray-light"}`}
        >
          <t.icon className="size-4 shrink-0" aria-hidden="true" />
          {t.title}
        </Link>
      ))}
    </nav>
  );
  if (tab.id !== "team")
    return (
      <CompanyPageContainer>
        <SettingsForm
          key={tab.id}
          tab={tab.id}
          company={company}
          member={membership}
          canManage={canManage}
          navigation={navigation}
          title={tab.title}
          description={tab.description}
        />
      </CompanyPageContainer>
    );
  return (
    <CompanyPageContainer>
      <HiringHeader
        title="Settings"
        description="Manage your workspace identity, team access, and hiring preferences."
      />
      <div className="mt-9 grid gap-7 lg:grid-cols-[200px_minmax(0,1fr)]">
        {navigation}
        <section className="min-w-0 lg:border-l lg:border-navy/8 lg:pl-7">
          <h2 className="text-base font-semibold text-navy">{tab.title}</h2>
          <p className="mt-1 mb-7 text-sm text-navy/60">{tab.description}</p>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-navy/65">
              Hiring Access manages postings and hiring. Hiring Reviewers can
              inspect evidence and review candidates. A member may have multiple
              permissions. Program Supervisor is reserved for the separate
              program-management experience.
            </p>
            {members.map((m) => (
              <TeamMemberAccess
                key={`${m.id}-${m.permissions?.join()}`}
                member={m}
                editable={canManage}
              />
            ))}
          </div>
        </section>
      </div>
    </CompanyPageContainer>
  );
}
