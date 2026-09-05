import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StudentProfileForm } from "@/components/opportunities/student-profile-form";

export default async function StudentOnboardingPage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [profile] = await db
    .select()
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.userId, user.id))
    .limit(1);
  if (profile?.educationStage) redirect("/student/preferences");

  return (
    <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
      <p className="text-xs font-medium tracking-[0.12em] text-teal-ink uppercase">One more step</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
        Tell us a little about where you are now.
      </h1>
      <p className="mt-2 text-sm text-navy/68">
        Just enough to personalize opportunities — everything else is optional and editable later from your
        profile.
      </p>

      <StudentProfileForm
        variant="onboarding"
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
  );
}
