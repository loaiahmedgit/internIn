import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";

export default async function CompleteProfilePage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/signin");

  const db = getDb();
  const [existing] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.authUserId, authUser.id))
    .limit(1);
  if (existing) redirect(existing.role === "company" ? "/company/dashboard" : "/student/dashboard");

  const suggestedName =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    "";

  return (
    <div className="rounded-xl border border-gray-cool/60 bg-white p-7">
      <h1 className="text-xl font-bold text-navy">One more step</h1>
      <p className="mt-1.5 text-sm text-navy/60">Tell us who you are so we can set up your account.</p>
      <CompleteProfileForm defaultFullName={suggestedName} />
    </div>
  );
}
