import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCurrentStudent } from "@/lib/auth";
import { StudentProfileForm } from "@/components/opportunities/student-profile-form";
import { STAGE_OPTIONS } from "@/lib/education-stages";
import { getProfileCompletion } from "@/lib/profile-completion";
import { CalendarDays, GraduationCap, MapPin, Pencil, Sparkles } from "lucide-react";

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
  const education = [profile?.major, profile?.university].filter(Boolean).join(" at ");
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

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header>
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.045em] text-navy sm:text-4xl">Profile</h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-navy/58 sm:text-base">Show companies what you are learning, what you can do, and what kind of role fits you.</p>
      </header>

      <section className="relative mt-7 overflow-hidden rounded-2xl border border-teal/14 bg-[linear-gradient(120deg,#ffffff_0%,#ffffff_62%,#edf9f7_100%)] p-6 shadow-[0_16px_44px_rgba(33,50,72,0.055)] sm:p-8" aria-labelledby="student-name">
        <div className="absolute -top-20 -right-16 size-64 rounded-full bg-teal/8 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-teal/12 text-2xl font-semibold text-teal-ink shadow-[0_8px_24px_rgba(33,50,72,0.09)]" aria-hidden="true">
            {user.fullName.split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="student-name" className="text-2xl font-semibold tracking-[-0.035em] text-navy sm:text-3xl">{user.fullName}</h2>
            <p className="mt-1.5 text-sm font-medium text-teal-ink">{focus ? `Interested in ${focus}` : stageLabel || "Student"}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-navy/58">
              {education ? <span className="flex items-center gap-2"><GraduationCap className="size-4" aria-hidden="true" />{education}</span> : null}
              {profile?.location ? <span className="flex items-center gap-2"><MapPin className="size-4" aria-hidden="true" />{profile.location}</span> : null}
              {profile?.availability ? <span className="flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" />{profile.availability}</span> : null}
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-navy/8 bg-white/80 p-4 backdrop-blur-sm md:w-56">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy"><Sparkles className="size-4 text-teal-ink" aria-hidden="true" />Profile strength</div>
            <p className="text-2xl font-semibold tracking-[-0.03em] text-navy tabular-nums">{profileCompletion.percent}%</p>
            <p className="text-xs leading-5 text-navy/50">{profileCompletion.missing.length > 0 ? `${profileCompletion.missing.length} details left to add` : "Your profile is ready to share"}</p>
            <a href="#profile-details" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-teal px-3 text-sm font-medium text-white transition-colors hover:bg-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-2"><Pencil className="size-3.5" aria-hidden="true" />Edit details</a>
          </div>
        </div>
      </section>

      <div id="profile-details" className="scroll-mt-24">
        <StudentProfileForm initial={{ educationStage: profile?.educationStage ?? "", university: profile?.university ?? "", major: profile?.major ?? "", graduationYear: profile?.graduationYear ? String(profile.graduationYear) : "", location: profile?.location ?? "", interests: (profile?.interests ?? []).join(", "), opportunityTypes: (profile?.opportunityTypes ?? []).join(", "), skills: (profile?.skills ?? []).join(", "), availability: profile?.availability ?? "", cvUrl: profile?.cvUrl ?? "", cvFileKey: profile?.cvFileKey ?? "" }} />
      </div>
    </div>
  );
}
