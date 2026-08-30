import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and redirects
 * unauthenticated users away from protected routes. Route protection lives
 * here (not just in page components) so a missing check in one page can't
 * silently expose a route.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isProtected =
    request.nextUrl.pathname.startsWith("/company/") ||
    request.nextUrl.pathname.startsWith("/company/dashboard") ||
    request.nextUrl.pathname.startsWith("/company/opportunities") ||
    request.nextUrl.pathname.startsWith("/company/submissions") ||
    request.nextUrl.pathname.startsWith("/company/offers") ||
    request.nextUrl.pathname.startsWith("/student/dashboard") ||
    request.nextUrl.pathname.startsWith("/student/applications") ||
    request.nextUrl.pathname.startsWith("/student/experience") ||
    request.nextUrl.pathname.startsWith("/student/profile") ||
    request.nextUrl.pathname.startsWith("/student/onboarding") ||
    request.nextUrl.pathname.startsWith("/student/preferences");

  // Keep public marketing and the local MVP demo available before Supabase
  // credentials are connected. Protected product routes still fail closed.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtected) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/signin";
      redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/signin";
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
