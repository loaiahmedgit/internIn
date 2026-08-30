"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HiringHeader } from "@/components/company/hiring-panels";
import {
  saveCompanySettings,
  saveTeamAccess,
  type SettingsResult,
} from "@/lib/company/settings-actions";
import {
  PERMISSION_LABELS,
  WORKSPACE_PERMISSIONS,
  permissionsFor,
} from "@/lib/company/permissions";

const inputClass =
  "mt-2 h-10 w-full rounded-md border border-navy/15 bg-white px-3 text-sm text-navy focus-visible:outline-2 focus-visible:outline-teal";
export function SettingsForm({
  tab,
  company,
  member,
  canManage,
  navigation,
  title,
  description,
}: {
  tab: string;
  navigation: ReactNode;
  title: string;
  description: string;
  canManage: boolean;
  company: {
    name: string;
    website: string | null;
    slug: string;
    logoUrl: string | null;
    industry: string | null;
    officeLocations: string | null;
    contactEmail: string | null;
    evidenceAiEnabled: boolean;
  };
  member: { submissionNotifications: boolean; offerNotifications: boolean };
}) {
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: SettingsResult, data: FormData) => {
      const result = await saveCompanySettings(tab, previous, data);
      if (result.success) setDirty(false);
      return result;
    },
    {} as SettingsResult,
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const warnNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (link && !window.confirm("Leave without saving your changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", warnNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", warnNavigation, true);
    };
  }, [dirty]);
  const editable = canManage || tab === "notifications";
  const field = (
    name: string,
    label: string,
    value: string | null,
    type = "text",
    helper?: string,
    readOnly = false,
  ) => (
    <label className="block text-sm font-medium text-navy" key={name}>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        readOnly={readOnly || !editable}
        autoComplete={
          name === "name" ? "organization" : type === "email" ? "email" : "off"
        }
        spellCheck={type === "email" || type === "url" ? false : undefined}
        className={`${inputClass} ${readOnly ? "text-navy/60" : ""}`}
      />
      {helper && (
        <span className="mt-2 block text-xs font-normal leading-relaxed text-navy/60">
          {helper}
        </span>
      )}
    </label>
  );
  const checkbox = (
    name: string,
    label: string,
    description: string,
    checked: boolean,
  ) => (
    <label
      key={name}
      className="flex cursor-pointer items-start gap-3 border-b border-navy/8 py-5 last:border-0"
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        disabled={!editable}
        className="mt-1 size-4 shrink-0 accent-teal-ink focus-visible:outline-2 focus-visible:outline-teal"
      />
      <span>
        <span className="block text-sm font-medium text-navy">{label}</span>
        <span className="mt-1 block text-sm leading-relaxed text-navy/60">
          {description}
        </span>
      </span>
    </label>
  );
  return (
    <form action={action} onChange={() => setDirty(true)} className="min-w-0">
      <HiringHeader
        title="Settings"
        description="Manage your workspace identity, team access, and hiring preferences."
        actions={
          editable ? (
            <Button
              type="submit"
              disabled={pending}
              className="bg-teal-ink text-white hover:bg-teal-ink/90"
            >
              <Save className="size-4" aria-hidden="true" />
              {pending ? "Saving…" : "Save changes"}
            </Button>
          ) : undefined
        }
      />
      <div className="mt-9 grid gap-7 lg:grid-cols-[200px_minmax(0,1fr)]">
        {navigation}
        <section className="min-w-0 lg:border-l lg:border-navy/8 lg:pl-7">
          <h2 className="text-base font-semibold text-navy">{title}</h2>
          <p className="mt-1 mb-7 text-sm text-navy/60">{description}</p>
          <fieldset disabled={pending}>
            {tab === "general" && (
              <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
                {field("name", "Company name", company.name)}
                {field("website", "Website", company.website, "url")}
                {field(
                  "workspaceUrl",
                  "Workspace URL",
                  "https://www.internin.app/company/dashboard",
                  "url",
                  "Your private workspace. Company identifier: " +
                    company.slug +
                    ".",
                  true,
                )}
                {field(
                  "officeLocations",
                  "Office locations",
                  company.officeLocations,
                  "text",
                  "List the locations your team operates from.",
                )}
                {field("industry", "Industry", company.industry)}
                {field(
                  "contactEmail",
                  "Contact email",
                  company.contactEmail,
                  "email",
                  "Company contact details; hiring alerts follow each member's notification preferences.",
                )}
              </div>
            )}
            {tab === "branding" && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border border-navy/10 bg-white">
                    {company.logoUrl ? (
                      <Image
                        unoptimized
                        src={company.logoUrl}
                        alt={`${company.name} logo`}
                        width={64}
                        height={64}
                        className="size-14 object-contain"
                      />
                    ) : (
                      <span className="text-lg font-semibold text-teal-ink">
                        {company.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-navy/60">
                    Your company logo is used on candidate-facing internship
                    listings.
                  </p>
                </div>
                {field(
                  "logoUrl",
                  "Company logo URL",
                  company.logoUrl,
                  "url",
                  "Use an HTTPS image address. Leave blank to use your company's initial.",
                )}
              </div>
            )}
            {tab === "notifications" && (
              <div>
                {checkbox(
                  "submissionNotifications",
                  "Challenge submissions",
                  "Email me when a candidate submits challenge work.",
                  member.submissionNotifications,
                )}
                {checkbox(
                  "offerNotifications",
                  "Offer responses",
                  "Email me when a candidate accepts or declines an offer.",
                  member.offerNotifications,
                )}
                <p className="mt-4 text-xs text-navy/60">
                  These preferences apply to your account. Candidate-facing
                  offer emails are unaffected.
                </p>
              </div>
            )}
            {tab === "privacy" && (
              <div>
                {checkbox(
                  "evidenceAiEnabled",
                  "AI evidence summaries",
                  "Allow authorized hiring reviewers to generate evidence summaries using the configured AI provider. Turning this off hides summaries and blocks new evaluations.",
                  company.evidenceAiEnabled,
                )}
                <div className="mt-6 space-y-3 text-sm leading-relaxed text-navy/65">
                  <h3 className="font-medium text-navy">
                    Human-reviewed hiring
                  </h3>
                  <p>
                    AI can organize CV and challenge evidence. It cannot select,
                    reject or send an offer to a candidate.
                  </p>
                  <h3 className="pt-3 font-medium text-navy">
                    Candidate data access
                  </h3>
                  <p>
                    Only members with hiring permissions can access candidate
                    records. Manage access in Team &amp; roles. Summaries use
                    the submitted content, and may send that content to the
                    configured AI provider when you request an evaluation.
                  </p>
                  <p>
                    Archived candidates remain available for history and export.
                    No automatic deletion or retention period is configured.
                  </p>
                </div>
              </div>
            )}
            {!editable && (
              <p className="mt-6 text-sm text-navy/65">
                Only Workspace Admins can change these settings.
              </p>
            )}
          </fieldset>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <p
              role={state.error ? "alert" : "status"}
              className={`text-sm ${state.error ? "text-red-700" : "text-teal-ink"}`}
            >
              {state.error ?? (dirty ? "Unsaved changes" : state.success)}
            </p>
          </div>
        </section>
      </div>
    </form>
  );
}

export function TeamMemberAccess({
  member,
  editable,
}: {
  member: {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[] | null;
  };
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveTeamAccess,
    {} as SettingsResult,
  );
  const granted = permissionsFor(member);
  return (
    <form action={action} className="rounded-xl border border-navy/10 p-5">
      <input type="hidden" name="memberId" value={member.id} />
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/8 text-sm text-teal-ink">
          {member.name[0]}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy">
            {member.name}
            {member.role === "owner" ? " · Owner" : ""}
          </p>
          <p className="truncate text-xs text-navy/60" title={member.email}>
            {member.email}
          </p>
        </div>
      </div>
      <fieldset disabled={!editable || member.role === "owner" || pending}>
        <legend className="sr-only">
          Workspace permissions for {member.name}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {WORKSPACE_PERMISSIONS.map((p) => (
            <label key={p} className="flex items-start gap-2 text-xs text-navy">
              <input
                className="size-4 shrink-0 accent-teal-ink"
                type="checkbox"
                name="permissions"
                value={p}
                defaultChecked={granted.includes(p)}
              />
              {PERMISSION_LABELS[p]}
            </label>
          ))}
        </div>
      </fieldset>
      {editable && member.role !== "owner" && (
        <Button
          type="submit"
          variant="outline"
          className="mt-4"
          disabled={pending}
        >
          {pending ? "Saving…" : "Update access"}
        </Button>
      )}
      <p
        className={`mt-3 text-xs ${state.error ? "text-red-700" : "text-teal-ink"}`}
        role={state.error ? "alert" : "status"}
      >
        {state.error ?? state.success}
      </p>
    </form>
  );
}
