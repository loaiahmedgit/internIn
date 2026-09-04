"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const SignUpSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["student", "company"]),
  companyName: z.string().trim().max(160),
  jobTitle: z.string().trim().max(160).optional(),
  companyWebsite: z.string().trim().max(2000).optional(),
  companyIndustry: z.string().trim().max(160).optional(),
  companySize: z.string().trim().max(160).optional(),
});

const SignInSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
  redirectTo: z.string().max(2048),
});

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "company"
  );
}

/**
 * Note on redirect(): Next.js throws a special digest internally for
 * redirect() and requires it be called outside try/catch. Every action
 * below therefore validates and mutates first and returns `{ error }` for
 * any expected failure, then calls redirect() as the last, un-wrapped
 * statement — nothing left afterward can race with it or accidentally
 * catch it client-side.
 */
export async function signUp(formData: FormData): Promise<{ error: string } | void> {
  const parsed = SignUpSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    role: String(formData.get("role") ?? "student"),
    companyName: String(formData.get("companyName") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? "") || undefined,
    companyWebsite: String(formData.get("companyWebsite") ?? "") || undefined,
    companyIndustry: String(formData.get("companyIndustry") ?? "") || undefined,
    companySize: String(formData.get("companySize") ?? "") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { email, password, fullName, role, companyName, jobTitle, companyWebsite, companyIndustry, companySize } =
    parsed.data;
  if (role === "company" && (!companyName || !jobTitle || !companyWebsite || !companyIndustry)) {
    return { error: "Company name, your role, website, and industry are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Sign up did not return a user." };

  const db = getDb();
  const [user] = await db
    .insert(schema.users)
    .values({ authUserId: data.user.id, email, role, fullName })
    .returning();

  if (role === "student") {
    await db.insert(schema.studentProfiles).values({ userId: user.id });
  } else {
    let slug = slugify(companyName);
    const existing = await db.select().from(schema.companies).where(eq(schema.companies.slug, slug));
    if (existing.length > 0) slug = `${slug}-${user.id.slice(0, 6)}`;

    const [company] = await db
      .insert(schema.companies)
      .values({ name: companyName, slug, website: companyWebsite, industry: companyIndustry, size: companySize })
      .returning();
    await db
      .insert(schema.companyMembers)
      .values({ companyId: company.id, userId: user.id, role: "owner", jobTitle });
  }

  redirect(role === "student" ? "/" : "/company/dashboard");
}

const CompleteOAuthProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["student", "company"]),
  companyName: z.string().trim().max(160),
  jobTitle: z.string().trim().max(160).optional(),
  companyWebsite: z.string().trim().max(2000).optional(),
  companyIndustry: z.string().trim().max(160).optional(),
  companySize: z.string().trim().max(160).optional(),
});

/**
 * Completes a first-time OAuth sign-in (Google/LinkedIn/Microsoft): the
 * Supabase auth user already exists (created by the OAuth callback), but
 * our app-level `users` row doesn't yet — this is where the role the OAuth
 * provider has no concept of finally gets decided, same row-creation shape
 * as the email/password signUp action minus the password step.
 */
export async function completeOAuthProfile(formData: FormData): Promise<{ error: string } | void> {
  const parsed = CompleteOAuthProfileSchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    role: String(formData.get("role") ?? "student"),
    companyName: String(formData.get("companyName") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? "") || undefined,
    companyWebsite: String(formData.get("companyWebsite") ?? "") || undefined,
    companyIndustry: String(formData.get("companyIndustry") ?? "") || undefined,
    companySize: String(formData.get("companySize") ?? "") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { fullName, role, companyName, jobTitle, companyWebsite, companyIndustry, companySize } = parsed.data;
  if (role === "company" && (!companyName || !jobTitle || !companyWebsite || !companyIndustry)) {
    return { error: "Company name, your role, website, and industry are required." };
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { error: "Not signed in." };

  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.authUserId, authUser.id))
    .limit(1);
  if (existing) {
    redirect(existing.role === "company" ? "/company/dashboard" : "/student/dashboard");
  }

  const email = authUser.email;
  if (!email) return { error: "Your account has no email address to use." };

  const [user] = await db
    .insert(schema.users)
    .values({ authUserId: authUser.id, email, role, fullName })
    .returning();

  if (role === "student") {
    await db.insert(schema.studentProfiles).values({ userId: user.id });
  } else {
    let slug = slugify(companyName);
    const existingCompany = await db.select().from(schema.companies).where(eq(schema.companies.slug, slug));
    if (existingCompany.length > 0) slug = `${slug}-${user.id.slice(0, 6)}`;

    const [company] = await db
      .insert(schema.companies)
      .values({ name: companyName, slug, website: companyWebsite, industry: companyIndustry, size: companySize })
      .returning();
    await db
      .insert(schema.companyMembers)
      .values({ companyId: company.id, userId: user.id, role: "owner", jobTitle });
  }

  redirect(role === "student" ? "/student/dashboard" : "/company/dashboard");
}

export async function signIn(formData: FormData): Promise<{ error: string } | void> {
  const parsed = SignInSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    redirectTo: String(formData.get("redirectTo") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { email, password, redirectTo } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  if (redirectTo.startsWith("/") && !redirectTo.startsWith("//")) redirect(redirectTo);

  // No explicit redirect target — land on the dashboard for this user's
  // actual role, never a hardcoded default that sends students into the
  // company workspace (real bug: every email/password sign-in landed on
  // /company/dashboard regardless of role).
  const db = getDb();
  const [user] = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.authUserId, data.user.id)).limit(1);
  redirect(user?.role === "company" ? "/company/dashboard" : "/student/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
