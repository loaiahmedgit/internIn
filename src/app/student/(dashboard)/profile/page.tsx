import Link from "next/link";
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
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  ImageIcon,
  LayoutGrid,
  MapPin,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  User,
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
  href: string;
};

const NAV_ITEMS = [
  { href: "#overview", label: "Overview", icon: LayoutGrid },
  { href: "#experience", label: "Experience", icon: Briefcase },
  { href: "#education", label: "Education", icon: GraduationCap },
  { href: "#portfolio", label: "Portfolio", icon: ImageIcon },
  { href: "#certifications", label: "Certifications", icon: Award },
  { href: "#preferences", label: "Preferences", icon: SlidersHorizontal },
];

const cardClass = "rounded-2xl border border-black/[0.05] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_16px_-4px_rgba(16,24,40,0.08)]";

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
      href: "/student/experience",
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
          href: `/student/applications/${s.applicationId}`,
        };
      }),
  ].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  const skills = profile?.skills ?? [];
  const interests = profile?.interests ?? [];
  const opportunityTypes = profile?.opportunityTypes ?? [];

  const editTriggerClass =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-navy/12 bg-white px-3.5 text-sm font-medium text-navy transition-colors hover:border-teal/25 hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40";
  const initials = user.fullName.split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase();
  const railTitle = profile?.major ? `${profile.major} Student` : stageLabel || "Student";

  return (
    <Sheet>
      <div className="mx-auto w-[calc(100%-48px)] max-w-[1300px] py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
          {/* --- Left rail ------------------------------------------------ */}
          <div className="contents lg:flex lg:w-[258px] lg:shrink-0 lg:flex-col lg:gap-3 lg:sticky lg:top-6 lg:self-start">
            {/* Identity + section nav — ONE continuous card. */}
            <div className={`${cardClass} order-2 overflow-hidden lg:order-1`}>
              <div className="hidden p-5 text-center lg:block">
                <div className="mx-auto flex size-[76px] items-center justify-center rounded-full bg-teal/10 text-lg font-semibold text-teal-ink" aria-hidden="true">
                  {initials}
                </div>
                <h1 className="mt-3 text-base font-semibold text-navy">{user.fullName}</h1>
                <p className="mt-0.5 text-sm text-navy/60">{railTitle}</p>
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
              <nav aria-label="Profile sections" className="p-2 lg:border-t lg:border-navy/6 lg:pt-2">
                <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                  {NAV_ITEMS.map((item, i) => (
                    <li key={item.href} className="shrink-0 lg:shrink">
                      <a
                        href={item.href}
                        className={
                          i === 0
                            ? "flex items-center gap-2.5 rounded-lg bg-teal/8 px-3 py-2 text-sm font-medium text-teal-ink"
                            : "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-navy/64 transition-colors hover:bg-navy/4"
                        }
                      >
                        <item.icon className="size-4" aria-hidden="true" />
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <div className={`${cardClass} order-10 p-4 lg:order-2`}>
              <ProfileLinksEditor items={linkRows} />
            </div>

            <div className={`${cardClass} order-12 p-4 lg:order-3`}>
              <h2 className="text-sm font-semibold text-navy">Resume</h2>
              <p className="mt-0.5 text-xs text-navy/55">Optional supporting document for your profile.</p>
              {profile?.cvFileKey || profile?.cvUrl ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 rounded-lg bg-[#f6f8f9] px-3 py-2">
                    <FileText className="size-4 shrink-0 text-teal-ink" aria-hidden="true" />
                    <span className="min-w-0 truncate text-sm font-medium text-navy">{profile.cvFileKey ? "CV on file" : "CV link added"}</span>
                  </div>
                  {profile.cvUrl ? (
                    <a href={profile.cvUrl} target="_blank" rel="noreferrer" className={`${editTriggerClass} w-full`}>View CV</a>
                  ) : (
                    <SheetTrigger className={`${editTriggerClass} w-full`}>Upload new CV</SheetTrigger>
                  )}
                </div>
              ) : (
                <SheetTrigger className="mt-2 inline-block text-sm font-medium text-teal-ink hover:underline">Add resume →</SheetTrigger>
              )}
            </div>

            <div className={`${cardClass} order-13 p-4 lg:order-4`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-navy">Profile completeness</h2>
                <span className="text-sm font-semibold text-teal-ink">{profileCompletion.percent}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy/8">
                <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${profileCompletion.percent}%` }} />
              </div>
              {profileCompletion.missing.length > 0 && profileCompletion.percent < 100 && (
                <p className="mt-2 text-xs text-navy/50">
                  Keep going! Add {profileCompletion.missing.slice(0, 2).join(" and ").toLowerCase()} to complete your profile.
                </p>
              )}
            </div>
          </div>

          {/* --- Main content ----------------------------------------------- */}
          <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-3">
            <div className={`${cardClass} relative order-1 min-h-[196px] overflow-hidden p-5 sm:p-7 lg:order-1`}>
              <div className="pointer-events-none absolute -right-14 -top-20 size-80 rounded-full bg-teal/12 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full bg-teal/8 blur-3xl" aria-hidden="true" />
              <div className="relative flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-[-0.02em] text-navy">{user.fullName}</h1>
                  <p className="mt-1 text-sm font-medium text-teal-ink">{focus ? `Interested in ${focus}` : stageLabel || "Student"}</p>
                  {profile?.bio && <p className="mt-2 max-w-xl text-sm leading-6 text-navy/62">{profile.bio}</p>}

                  <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy/60">
                    {profile?.major || profile?.university ? (
                      <span className="flex items-start gap-2">
                        <GraduationCap className="mt-0.5 size-4 shrink-0 text-navy/40" aria-hidden="true" />
                        <span>
                          {profile?.major && <span className="block text-navy/78">{profile.major}</span>}
                          {profile?.university && <span className="block text-xs text-navy/50">{profile.university}</span>}
                        </span>
                      </span>
                    ) : null}
                    {profile?.location ? (
                      <span className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-navy/40" aria-hidden="true" />{profile.location}</span>
                    ) : null}
                    {profile?.availability ? (
                      <span className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0 text-navy/40" aria-hidden="true" />{profile.availability}</span>
                    ) : null}
                  </div>

                  {opportunityTypes.length > 0 && (
                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      {opportunityTypes.map((t) => (
                        <span key={t} className="rounded-full border border-navy/8 bg-[#f6f8f9] px-2.5 py-1 text-xs font-medium text-navy/62">{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <div className="w-full sm:w-40">
                    <div className="flex items-center justify-between text-xs text-navy/50">
                      <span>Profile completion</span>
                      <span className="font-semibold text-teal-ink">{profileCompletion.percent}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-navy/8">
                      <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${profileCompletion.percent}%` }} />
                    </div>
                  </div>
                  <SheetTrigger className={editTriggerClass}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit profile
                  </SheetTrigger>
                </div>
              </div>
            </div>

            <section id="overview" aria-labelledby="about-heading" className={`${cardClass} order-3 scroll-mt-24 p-5 lg:order-2`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-teal-ink" aria-hidden="true" />
                  <h2 id="about-heading" className="text-base font-semibold text-navy">About me</h2>
                </div>
                <SheetTrigger className="text-sm font-medium text-teal-ink hover:underline">Edit</SheetTrigger>
              </div>
              {profile?.bio ? (
                <p className="mt-2 text-sm leading-6 text-navy/72">{profile.bio}</p>
              ) : (
                <p className="mt-2 text-sm text-navy/55">
                  Tell companies what you&apos;re interested in, what you&apos;re learning, and what kind of work excites you.{" "}
                  <SheetTrigger className="font-medium text-teal-ink hover:underline">Add bio →</SheetTrigger>
                </p>
              )}
            </section>

            <section aria-labelledby="skills-heading" className={`${cardClass} order-4 p-5 lg:order-3`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-teal-ink" aria-hidden="true" />
                  <h2 id="skills-heading" className="text-base font-semibold text-navy">Skills</h2>
                </div>
                <SheetTrigger className="text-sm font-medium text-teal-ink hover:underline">Edit</SheetTrigger>
              </div>
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

            <section aria-labelledby="evidence-heading" className={`${cardClass} order-5 p-5 lg:order-4`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-teal-ink" aria-hidden="true" />
                  <h2 id="evidence-heading" className="text-base font-semibold text-navy">Verified work &amp; challenges</h2>
                </div>
                {evidence.length > 0 && (
                  <Link href="/student/applications" className="text-sm font-medium text-teal-ink hover:underline">View all →</Link>
                )}
              </div>
              {evidence.length > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {evidence.map((item) => (
                    <div key={item.key} className="rounded-xl border border-navy/8 bg-[#fafcfc] p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-ink" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy">{item.title}</p>
                          <p className="mt-0.5 text-xs text-navy/55">
                            {item.kind === "internship" ? "Internship" : "Company challenge"}
                            {item.companyName ? ` · ${item.companyName}` : ""}
                          </p>
                        </div>
                      </div>
                      {item.date && <p className="mt-2 text-xs text-navy/45">{monthYear.format(item.date)}</p>}
                      <Link href={item.href} className="mt-2 inline-block text-xs font-medium text-teal-ink hover:underline">View evidence →</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-navy/58">Your completed company challenges and verified internship work will appear here.</p>
                  <Link href="/student/opportunities" className="mt-1.5 inline-block text-sm font-medium text-teal-ink hover:underline">Explore internships →</Link>
                </div>
              )}
            </section>

            <div className="order-6 lg:order-5">
              <ExperienceEditor items={experienceRows} />
            </div>

            <div className="order-7 lg:order-6">
              <EducationEditor items={educationRows} />
            </div>

            <div className="order-8 lg:order-7">
              <PortfolioEditor items={portfolioRows} />
            </div>

            <div className="order-9 lg:order-8">
              <CertificationsEditor items={certificationRows} />
            </div>

            {(interests.length > 0 || opportunityTypes.length > 0) && (
              <section id="preferences" aria-labelledby="preferences-heading" className={`${cardClass} order-11 scroll-mt-24 p-5 lg:order-9`}>
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
