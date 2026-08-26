import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// next/navigation's redirect() throws internally with this digest so Next.js's
// own runtime can perform the navigation. A client-side try/catch around a
// server action that calls redirect() must rethrow it, not treat it as a
// real error, or the redirect never completes and "NEXT_REDIRECT" renders
// on screen as if it were a user-facing message.
export function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
