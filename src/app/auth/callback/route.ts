import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/signin?error=oauth_failed", request.url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/signin?error=oauth_failed", request.url));
  }

  const db = getDb();
  const [existingUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.authUserId, data.user.id))
    .limit(1);

  if (!existingUser) {
    return NextResponse.redirect(new URL("/auth/complete-profile", request.url));
  }

  const destination = existingUser.role === "company" ? "/company/dashboard" : "/student/dashboard";
  return NextResponse.redirect(new URL(destination, request.url));
}
