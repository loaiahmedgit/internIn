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

export async function signUp(formData: FormData) {
  const { email, password, fullName, role, companyName } = SignUpSchema.parse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    role: String(formData.get("role") ?? "student"),
    companyName: String(formData.get("companyName") ?? ""),
  });
  if (role === "company" && !companyName) {
    throw new Error("Company name is required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Sign up did not return a user.");

  const db = getDb();
  const [user] = await db
    .insert(schema.users)
    .values({ authUserId: data.user.id, email, role, fullName })
    .returning();

  if (role === "student") {
    await db.insert(schema.studentProfiles).values({ userId: user.id });
    redirect("/");
  } else {
    let slug = slugify(companyName);
    const existing = await db.select().from(schema.companies).where(eq(schema.companies.slug, slug));
    if (existing.length > 0) slug = `${slug}-${user.id.slice(0, 6)}`;

    const [company] = await db.insert(schema.companies).values({ name: companyName, slug }).returning();
    await db.insert(schema.companyMembers).values({ companyId: company.id, userId: user.id, role: "owner" });
    redirect("/company/dashboard");
  }
}

export async function signIn(formData: FormData) {
  const { email, password, redirectTo } = SignInSchema.parse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    redirectTo: String(formData.get("redirectTo") ?? ""),
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const safeRedirect = redirectTo.startsWith("/") && !redirectTo.startsWith("//")
    ? redirectTo
    : "/company/dashboard";
  redirect(safeRedirect);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
