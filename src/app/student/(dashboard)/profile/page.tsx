import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StudentProfileForm } from "@/components/opportunities/student-profile-form";
import { STAGE_OPTIONS } from "@/lib/education-stages";
import { StudentPageHeader } from "@/components/dashboard/student-page-header";

export default async function StudentProfilePage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [profile] = await db
    .select()
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.userId, user.id))
    .limit(1);

  const stageLabel = STAGE_OPTIONS.find((o) => o.value === profile?.educationStage)?.label;
  const subtitle = [stageLabel, profile?.location].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
      <StudentPageHeader
        eyebrow="Your profile"
        title="Profile"
        description="Keep this simple — companies judge you on your Challenge submissions, not this form."
      />

      <div className="mt-8 flex items-center gap-4 rounded-xl border border-navy/10 bg-white p-6">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xl font-semibold text-teal-ink">
          {user.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-navy">{user.fullName}</p>
          <p className="text-sm text-navy/60">{subtitle || "Complete onboarding to fill this in"}</p>
        </div>
      </div>

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
  );
}
