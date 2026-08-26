import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StudentProfileForm } from "@/components/opportunities/student-profile-form";

export default async function StudentPreferencesPage() {
  const { user } = await requireCurrentStudent();
  const db = getDb();

  const [profile] = await db
    .select()
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.userId, user.id))
    .limit(1);
  if (!profile?.educationStage) redirect("/student/onboarding");

  return (
    <div className="mx-auto max-w-2xl px-5 py-20 sm:px-8">
      <p className="text-xs font-medium tracking-[0.12em] text-teal-ink uppercase">Almost there</p>
      <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] text-navy">
        What are you looking for?
      </h1>
      <p className="mt-2 text-sm text-navy/68">
        Helps us match you with the right opportunities. Nothing here is required.
      </p>

      <StudentProfileForm
        variant="preferences"
        initial={{
          educationStage: profile.educationStage ?? "",
          university: profile.university ?? "",
          major: profile.major ?? "",
          graduationYear: profile.graduationYear ? String(profile.graduationYear) : "",
          location: profile.location ?? "",
          interests: (profile.interests ?? []).join(", "),
          opportunityTypes: (profile.opportunityTypes ?? []).join(", "),
          skills: (profile.skills ?? []).join(", "),
          availability: profile.availability ?? "",
          cvUrl: profile.cvUrl ?? "",
        }}
      />

      <Link href="/student/dashboard" className="mt-4 block text-center text-sm text-navy/50 underline underline-offset-2">
        Skip for now
      </Link>
    </div>
  );
}
