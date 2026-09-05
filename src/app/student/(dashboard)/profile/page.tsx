import { eq, inArray, desc, asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StudentProfileForm } from "@/components/opportunities/student-profile-form";
import { ExperienceEditor } from "@/components/profile/experience-editor";
import { EducationEditor } from "@/components/profile/education-editor";
import { PortfolioEditor } from "@/components/profile/portfolio-editor";
import { CertificationsEditor } from "@/components/profile/certifications-editor";
import { ProfileLinksEditor } from "@/components/profile/profile-links-editor";
import { STAGE_OPTIONS } from "@/lib/education-stages";
import { getProfileCompletion } from "@/lib/profile-completion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Award,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  FileText,
  GraduationCap,
  ImageIcon,
  LayoutGrid,
  MapPin,
  Pencil,
  SlidersHorizontal,
} from "lucide-react";

const monthYear = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" });

/** One real, verified item for the evidence section — either a completed
 * internship program (verified_experience) or a company challenge with
 * evaluated evidence (candidate_evidence). Never invented: both come from
 * a supervisor/company action that already happened. */
type EvidenceItem = {
  key: string;
  kind: "internship" | "challenge";
  title: string;
  companyName: string;
  skills: string[];
  date: Date | null;
};

const NAV_ITEMS = [
  { href: "#overview", label: "Overview", icon: LayoutGrid },
  { href: "#experience", label: "Experience", icon: Briefcase },
  { href: "#education", label: "Education", icon: GraduationCap },
  { href: "#portfolio", label: "Portfolio", icon: ImageIcon },
  { href: "#certifications", label: "Certifications", icon: Award },
  { href: "#preferences", label: "Preferences", icon: SlidersHorizontal },
];

export default async function StudentProfilePage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  // None of these depend on each other — fetch every profile section in
  // parallel instead of a serial waterfall of round trips.
  const [
    [profile],
    verifiedPrograms,
    applicationRows,
    experienceRows,
    educationRows,
    portfolioRows,
    certificationRows,
    linkRows,
  ] = await Promise.all([
    db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.userId, user.id)).limit(1),
    db
      .select({
        id: schema.verifiedExperience.id,
        skillsDemonstrated: schema.verifiedExperience.skillsDemonstrated,
        verifiedAt: schema.verifiedExperience.verifiedAt,
        role: schema.opportunities.role,
        companyName: schema.companies.name,
      })
      .from(schema.verifiedExperience)
      .innerJoin(schema.internshipPrograms, eq(schema.verifiedExperience.programId, schema.internshipPrograms.id))
      .innerJoin(schema.internshipOffers, eq(schema.internshipPrograms.offerId, schema.internshipOffers.id))
      .innerJoin(schema.applications, eq(schema.internshipOffers.applicationId, schema.applications.id))
      .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
      .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
      .where(eq(schema.applications.studentId, user.id))
      .orderBy(desc(schema.verifiedExperience.verifiedAt)),
    db
      .select({ id: schema.applications.id, role: schema.opportunities.role, companyName: schema.companies.name })
      .from(schema.applications)
      .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
      .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
      .where(eq(schema.applications.studentId, user.id)),
    db.select().from(schema.studentExperience).where(eq(schema.studentExperience.studentId, user.id)).orderBy(asc(schema.studentExperience.sortOrder)),
    db.select().from(schema.studentEducation).where(eq(schema.studentEducation.studentId, user.id)).orderBy(asc(schema.studentEducation.sortOrder)),
    db.select().from(schema.studentPortfolioItems).where(eq(schema.studentPortfolioItems.studentId, user.id)).orderBy(asc(schema.studentPortfolioItems.sortOrder)),
    db.select().from(schema.studentCertifications).where(eq(schema.studentCertifications.studentId, user.id)).orderBy(asc(schema.studentCertifications.sortOrder)),
    db.select().from(schema.studentProfileLinks).where(eq(schema.studentProfileLinks.studentId, user.id)).orderBy(asc(schema.studentProfileLinks.sortOrder)),
  ]);

  const stageLabel = STAGE_OPTIONS.find((o) => o.value === profile?.educationStage)?.label;
  const focus = profile?.interests?.[0] ?? profile?.major;
  const profileCompletion = getProfileCompletion({
    educationStage: profile?.educationStage ?? null,
    university: profile?.university ?? null,
    major: profile?.major ?? null,
    graduationYear: profile?.graduationYear ?? null,
    location: profile?.location ?? null,
    bio: profile?.bio ?? null,
    skills: profile?.skills ?? [],
    interests: profile?.interests ?? [],
    experienceCount: experienceRows.length,
    portfolioCount: portfolioRows.length,
  });

  // Completed challenges: submissions a company has actually evaluated
  // (candidate_evidence exists) — not just "submitted", genuinely reviewed.
  const applicationIds = applicationRows.map((a) => a.id);
  const submissionRows = applicationIds.length
    ? await db
        .select({
          id: schema.submissions.id,
          applicationId: schema.submissions.applicationId,
          challengeVersionId: schema.submissions.challengeVersionId,
          submittedAt: schema.submissions.submittedAt,
        })
        .from(schema.submissions)
        .where(inArray(schema.submissions.applicationId, applicationIds))
    : [];
  const submissionIds = submissionRows.map((s) => s.id);
  const versionIds = submissionRows.map((s) => s.challengeVersionId);
  const [evidenceRows, versionRows] = await Promise.all([
    submissionIds.length
      ? db
          .select({ submissionId: schema.candidateEvidence.submissionId })
          .from(schema.candidateEvidence)
          .where(inArray(schema.candidateEvidence.submissionId, submissionIds))
      : Promise.resolve([]),
    versionIds.length
      ? db
          .select({ id: schema.challengeVersions.id, title: schema.challengeVersions.title, skills: schema.challengeVersions.skills })
          .from(schema.challengeVersions)
          .where(inArray(schema.challengeVersions.id, versionIds))
      : Promise.resolve([]),
  ]);
  const evidencedSubmissionIds = new Set(evidenceRows.map((e) => e.submissionId));
  const versionById = new Map(versionRows.map((v) => [v.id, v]));
  const applicationById = new Map(applicationRows.map((a) => [a.id, a]));

  const evidence: EvidenceItem[] = [
    ...verifiedPrograms.map((v) => ({
      key: `program-${v.id}`,
      kind: "internship" as const,
      title: v.role,
      companyName: v.companyName,
      skills: v.skillsDemonstrated,
      date: v.verifiedAt,
    })),
    ...submissionRows
      .filter((s) => evidencedSubmissionIds.has(s.id))
      .map((s) => {
        const application = applicationById.get(s.applicationId);
        const version = versionById.get(s.challengeVersionId);
        return {
          key: `challenge-${s.id}`,
          kind: "challenge" as const,
          title: version?.title ?? application?.role ?? "Company challenge",
          companyName: application?.companyName ?? "",
          skills: version?.skills ?? [],
          date: s.submittedAt,
        };
      }),
  ].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  const skills = profile?.skills ?? [];
  const interests = profile?.interests ?? [];
  const opportunityTypes = profile?.opportunityTypes ?? [];

  const editTriggerClass =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-navy/12 bg-white px-3.5 text-sm font-medium text-navy transition-colors hover:border-teal/25 hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40";
  const initials = user.fullName.split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase();

  return (
    <Sheet>
      <div className="mx-auto max-w-[min(94vw,1360px)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/* --- Left rail ------------------------------------------------ */}
          <div className="contents lg:flex lg:w-[264px] lg:shrink-0 lg:flex-col lg:gap-6 lg:sticky lg:top-6 lg:self-start">
            <div className="hidden rounded-2xl border border-black/[0.04] bg-white p-5 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] lg:block lg:order-1">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-teal/10 text-lg font-semibold text-teal-ink" aria-hidden="true">
                {initials}
              </div>
              <h1 className="mt-3 text-base font-semibold tracking-[-0.01em] text-navy">{user.fullName}</h1>
              <p className="mt-0.5 text-sm text-teal-ink">{focus ? `Interested in ${focus}` : stageLabel || "Student"}</p>
              {profile?.location && (
                <p className="mt-1.5 flex items-center justify-center gap-1 text-xs text-navy/50">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {profile.location}
                </p>
              )}
              <SheetTrigger className={`${editTriggerClass} mt-4 w-full`}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit profile
              </SheetTrigger>
            </div>

            <nav aria-label="Profile sections" className="order-2 rounded-2xl border border-black/[0.04] bg-white p-2 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] lg:order-2">
              <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href} className="shrink-0 lg:shrink">
                    <a href={item.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-navy/68 transition-colors hover:bg-teal/6 hover:text-teal-ink">
                      <item.icon className="size-4" aria-hidden="true" />
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="order-10 lg:order-3">
              <ProfileLinksEditor items={linkRows} />
            </div>

            <div className="order-12 rounded-2xl border border-black/[0.04] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] lg:order-4">
              <h2 className="text-sm font-semibold text-navy">Resume</h2>
              {profile?.cvFileKey || profile?.cvUrl ? (
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-teal-ink" aria-hidden="true" />
                    <span className="min-w-0 truncate text-sm font-medium text-navy">{profile.cvFileKey ? "CV on file" : "CV link added"}</span>
                  </span>
                  {profile.cvUrl ? (
                    <a href={profile.cvUrl} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-medium text-teal-ink hover:underline">View</a>
                  ) : (
                    <SheetTrigger className="shrink-0 text-sm font-medium text-teal-ink hover:underline">Replace</SheetTrigger>
                  )}
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-xs text-navy/55">Optional supporting document for your profile.</p>
                  <SheetTrigger className="mt-1.5 inline-block text-sm font-medium text-teal-ink hover:underline">Add resume →</SheetTrigger>
                </div>
              )}
            </div>

            <div className="order-13 rounded-2xl border border-black/[0.04] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] lg:order-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-navy">Profile completeness</h2>
                <span className="text-sm font-semibold text-teal-ink">{profileCompletion.percent}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy/8">
                <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${profileCompletion.percent}%` }} />
              </div>
              {profileCompletion.missing.length > 0 && profileCompletion.percent < 100 && (
                <p className="mt-2 text-xs text-navy/50">Next: {profileCompletion.missing[0]}</p>
              )}
            </div>
          </div>

          {/* --- Main content ----------------------------------------------- */}
          <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-6">
            <div className="relative order-1 overflow-hidden rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] sm:p-6 lg:order-1">
              <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-teal/6 blur-3xl" aria-hidden="true" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-[-0.02em] text-navy">{user.fullName}</h1>
                  <p className="mt-1 text-sm font-medium text-teal-ink">{focus ? `Interested in ${focus}` : stageLabel || "Student"}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy/56">
                    {profile?.major || profile?.university ? (
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="size-3.5" aria-hidden="true" />
                        {[profile?.major, profile?.university].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    {profile?.location ? (
                      <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden="true" />{profile.location}</span>
                    ) : null}
                    {profile?.availability ? (
                      <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden="true" />{profile.availability}</span>
                    ) : null}
                  </div>
                  {(stageLabel || opportunityTypes.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {stageLabel && <span className="rounded-full border border-teal/20 bg-teal/6 px-2.5 py-1 text-xs font-medium text-teal-ink">{stageLabel}</span>}
                      {opportunityTypes.slice(0, 2).map((t) => (
                        <span key={t} className="rounded-full border border-navy/8 bg-[#f6f8f9] px-2.5 py-1 text-xs text-navy/58">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <SheetTrigger className={editTriggerClass}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit profile
                  </SheetTrigger>
                  {profileCompletion.percent < 100 && (
                    <p className="text-xs text-navy/50">Profile {profileCompletion.percent}% complete</p>
                  )}
                </div>
              </div>
            </div>

            <section id="overview" aria-labelledby="about-heading" className="order-3 scroll-mt-24 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] lg:order-2">
              <h2 id="about-heading" className="text-base font-semibold text-navy">About me</h2>
              {profile?.bio ? (
                <p className="mt-2 text-sm leading-6 text-navy/72">{profile.bio}</p>
              ) : (
                <p className="mt-2 text-sm text-navy/55">
                  Tell companies who you are. <SheetTrigger className="font-medium text-teal-ink hover:underline">Add a bio →</SheetTrigger>
                </p>
              )}
            </section>

            <section aria-labelledby="evidence-heading" className="order-5 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] lg:order-3">
              <h2 id="evidence-heading" className="text-base font-semibold text-navy">Verified work &amp; challenges</h2>
              {evidence.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {evidence.map((item) => (
                    <div key={item.key} className="rounded-xl border border-navy/10 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy">{item.title}</p>
                          <p className="mt-0.5 text-xs text-navy/55">
                            {item.kind === "internship" ? "Internship" : "Company challenge"}
                            {item.companyName ? ` · ${item.companyName}` : ""}
                          </p>
                        </div>
                        {item.date && <p className="shrink-0 text-xs text-navy/45">{monthYear.format(item.date)}</p>}
                      </div>
                      {item.skills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {item.skills.slice(0, 6).map((skill) => (
                            <span key={skill} className="rounded-full border border-navy/7 bg-[#f6f8f9] px-2.5 py-1 text-xs text-navy/58">{skill}</span>
                          ))}
                        </div>
                      )}
                      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-teal-ink">
                        <BadgeCheck className="size-3.5" aria-hidden="true" />
                        Company verified
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-navy/58">Your verified internship work and completed company challenges will appear here as companies review your submissions.</p>
              )}
            </section>

            <section aria-labelledby="skills-heading" className="order-4 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] lg:order-4">
              <h2 id="skills-heading" className="text-base font-semibold text-navy">Skills</h2>
              {skills.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {skills.map((skill) => (
                    <span key={skill} className="rounded-full border border-navy/8 bg-white px-2.5 py-1 text-xs text-navy/62">{skill}</span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-navy/55">
                  No skills added yet. <SheetTrigger className="font-medium text-teal-ink hover:underline">Add skills →</SheetTrigger>
                </p>
              )}
            </section>

            <div className="order-8 lg:order-5">
              <PortfolioEditor items={portfolioRows} />
            </div>

            <div className="order-6 lg:order-6">
              <ExperienceEditor items={experienceRows} />
            </div>

            <div className="order-7 lg:order-7">
              <EducationEditor items={educationRows} />
            </div>

            <div className="order-9 lg:order-8">
              <CertificationsEditor items={certificationRows} />
            </div>

            {(interests.length > 0 || opportunityTypes.length > 0) && (
              <section id="preferences" aria-labelledby="preferences-heading" className="order-11 scroll-mt-24 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)] lg:order-9">
                <h2 id="preferences-heading" className="text-base font-semibold text-navy">Preferences</h2>
                <div className="mt-3 space-y-3">
                  {interests.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-navy/45">Interested in</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {interests.map((item) => (
                          <span key={item} className="rounded-full bg-[#f6f8f9] px-2.5 py-1 text-xs text-navy/58">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {opportunityTypes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-navy/45">Looking for</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {opportunityTypes.map((item) => (
                          <span key={item} className="rounded-full bg-[#f6f8f9] px-2.5 py-1 text-xs text-navy/58">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md data-[side=right]:lg:max-w-lg">
        <SheetHeader className="border-b border-navy/8 px-5 py-4">
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>This information stays private to internIn — companies see it through your applications and profile summary.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 px-5 py-5">
          <StudentProfileForm
            initial={{
              educationStage: profile?.educationStage ?? "",
              university: profile?.university ?? "",
              major: profile?.major ?? "",
              graduationYear: profile?.graduationYear ? String(profile.graduationYear) : "",
              location: profile?.location ?? "",
              bio: profile?.bio ?? "",
              interests: (profile?.interests ?? []).join(", "),
              opportunityTypes: (profile?.opportunityTypes ?? []).join(", "),
              skills: (profile?.skills ?? []).join(", "),
              availability: profile?.availability ?? "",
              cvUrl: profile?.cvUrl ?? "",
              cvFileKey: profile?.cvFileKey ?? "",
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
