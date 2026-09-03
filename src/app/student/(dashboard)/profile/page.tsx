import { eq, inArray, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StudentProfileForm } from "@/components/opportunities/student-profile-form";
import { STAGE_OPTIONS } from "@/lib/education-stages";
import { getProfileCompletion } from "@/lib/profile-completion";
import {
  BadgeCheck,
  CalendarDays,
  FileText,
  GraduationCap,
  MapPin,
  Pencil,
  Sparkles,
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

export default async function StudentProfilePage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [profile] = await db
    .select()
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.userId, user.id))
    .limit(1);

  const stageLabel = STAGE_OPTIONS.find((o) => o.value === profile?.educationStage)?.label;
  const focus = profile?.interests?.[0] ?? profile?.major;
  const profileCompletion = getProfileCompletion({
    educationStage: profile?.educationStage ?? null,
    university: profile?.university ?? null,
    major: profile?.major ?? null,
    graduationYear: profile?.graduationYear ?? null,
    location: profile?.location ?? null,
    skills: profile?.skills ?? [],
    interests: profile?.interests ?? [],
    cvFileKey: profile?.cvFileKey ?? null,
  });

  // Verified work: completed internship programs a supervisor has signed
  // off on — real evidence, never shown until supervisorVerified is true.
  const verifiedPrograms = await db
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
    .orderBy(desc(schema.verifiedExperience.verifiedAt));

  // Completed challenges: submissions a company has actually evaluated
  // (candidate_evidence exists) — not just "submitted", genuinely reviewed.
  const applicationRows = await db
    .select({ id: schema.applications.id, role: schema.opportunities.role, companyName: schema.companies.name })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .innerJoin(schema.companies, eq(schema.opportunities.companyId, schema.companies.id))
    .where(eq(schema.applications.studentId, user.id));
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
  const evidenceRows = submissionIds.length
    ? await db
        .select({ submissionId: schema.candidateEvidence.submissionId })
        .from(schema.candidateEvidence)
        .where(inArray(schema.candidateEvidence.submissionId, submissionIds))
    : [];
  const evidencedSubmissionIds = new Set(evidenceRows.map((e) => e.submissionId));
  const versionIds = submissionRows.map((s) => s.challengeVersionId);
  const versionRows = versionIds.length
    ? await db
        .select({ id: schema.challengeVersions.id, title: schema.challengeVersions.title, skills: schema.challengeVersions.skills })
        .from(schema.challengeVersions)
        .where(inArray(schema.challengeVersions.id, versionIds))
    : [];
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

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-col gap-4 rounded-xl border border-navy/8 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-teal/10 text-lg font-semibold text-teal-ink" aria-hidden="true">
            {user.fullName.split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-navy">{user.fullName}</h1>
            <p className="mt-0.5 text-sm font-medium text-teal-ink">{focus ? `Interested in ${focus}` : stageLabel || "Student"}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy/56">
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
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <a
            href="#profile-details"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-navy/12 bg-white px-3.5 text-sm font-medium text-navy transition-colors hover:border-teal/25 hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit profile
          </a>
          {profileCompletion.percent < 100 && (
            <div className="w-full sm:w-40">
              <p className="text-xs text-navy/50">Profile {profileCompletion.percent}% complete</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-navy/8" aria-hidden="true">
                <div className="h-full rounded-full bg-teal" style={{ width: `${profileCompletion.percent}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="min-w-0 space-y-6">
          {evidence.length > 0 && (
            <section aria-labelledby="evidence-heading">
              <h2 id="evidence-heading" className="text-base font-semibold text-navy">Verified work</h2>
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
            </section>
          )}

          <section aria-labelledby="education-heading">
            <h2 id="education-heading" className="text-base font-semibold text-navy">Education</h2>
            {profile?.university || profile?.major ? (
              <div className="mt-3 rounded-xl border border-navy/10 bg-white p-4">
                <p className="text-sm font-medium text-navy">{profile.university || "University not set"}</p>
                <p className="mt-0.5 text-sm text-navy/58">
                  {[profile.major, profile.graduationYear ? `Expected ${profile.graduationYear}` : null].filter(Boolean).join(" · ")}
                </p>
                {profile.location && <p className="mt-0.5 text-xs text-navy/48">{profile.location}</p>}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-navy/15 px-4 py-3.5">
                <p className="text-sm text-navy/60">Add your education so companies know your background.</p>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="skills-heading">
            <h2 id="skills-heading" className="text-base font-semibold text-navy">Skills</h2>
            {skills.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-navy/8 bg-white px-2.5 py-1 text-xs text-navy/62">{skill}</span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-navy/55">
                No skills added yet. <a href="#profile-details" className="font-medium text-teal-ink hover:underline">Add skills →</a>
              </p>
            )}
          </section>

          <section aria-labelledby="cv-heading">
            <h2 id="cv-heading" className="text-base font-semibold text-navy">CV</h2>
            {profile?.cvFileKey || profile?.cvUrl ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-navy/10 bg-white p-3.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <FileText className="size-4 shrink-0 text-teal-ink" aria-hidden="true" />
                  <span className="min-w-0 text-sm font-medium text-navy">{profile.cvFileKey ? "CV on file" : "CV link added"}</span>
                </span>
                {profile.cvUrl ? (
                  <a href={profile.cvUrl} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-medium text-teal-ink hover:underline">View</a>
                ) : (
                  <a href="#profile-details" className="shrink-0 text-sm font-medium text-teal-ink hover:underline">Replace</a>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-navy/15 px-3.5 py-3">
                <p className="text-sm text-navy/60">Upload your CV to make applications faster.</p>
                <a href="#profile-details" className="mt-1.5 inline-block text-sm font-medium text-teal-ink hover:underline">Upload →</a>
              </div>
            )}
          </section>

          {(interests.length > 0 || opportunityTypes.length > 0) && (
            <section aria-labelledby="preferences-heading">
              <h2 id="preferences-heading" className="text-base font-semibold text-navy">Preferences</h2>
              <div className="mt-3 space-y-3 rounded-xl border border-navy/10 bg-white p-3.5">
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

          {evidence.length === 0 && (
            <section className="rounded-xl border border-dashed border-navy/15 px-3.5 py-4" aria-labelledby="no-evidence-heading">
              <p id="no-evidence-heading" className="flex items-center gap-1.5 text-sm font-medium text-navy">
                <Sparkles className="size-4 text-teal-ink" aria-hidden="true" />
                No verified work yet
              </p>
              <p className="mt-1 text-sm text-navy/58">Complete a company challenge or internship to start building real evidence here.</p>
            </section>
          )}
        </div>
      </div>

      <div id="profile-details" className="mt-9 scroll-mt-24 border-t border-navy/8 pt-7">
        <h2 className="text-base font-semibold text-navy">Edit your details</h2>
        <p className="mt-1 text-sm text-navy/55">This information stays private to internIn — companies see it through your applications and profile summary above.</p>
        <div className="mt-5">
          <StudentProfileForm
            initial={{
              educationStage: profile?.educationStage ?? "",
              university: profile?.university ?? "",
              major: profile?.major ?? "",
              graduationYear: profile?.graduationYear ? String(profile.graduationYear) : "",
              location: profile?.location ?? "",
              interests: (profile?.interests ?? []).join(", "),
              opportunityTypes: (profile?.opportunityTypes ?? []).join(", "),
              skills: (profile?.skills ?? []).join(", "),
              availability: profile?.availability ?? "",
              cvUrl: profile?.cvUrl ?? "",
              cvFileKey: profile?.cvFileKey ?? "",
            }}
          />
        </div>
      </div>
    </div>
  );
}
