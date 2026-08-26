"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { isRedirectError } from "@/lib/utils";

function SignInForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await signIn(formData);
    } catch (e) {
      if (isRedirectError(e)) throw e;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-cool/60 bg-white p-7">
      <h1 className="text-xl font-bold text-navy">Sign in</h1>

      <div className="mt-5">
        <OAuthButtons />
      </div>
      <div className="mt-5 flex items-center gap-3 text-xs text-navy/40">
        <div className="h-px flex-1 bg-gray-cool/60" />
        or
        <div className="h-px flex-1 bg-gray-cool/60" />
      </div>

      <form action={handleSubmit} className="mt-5 space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required className="mt-1.5" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={pending} className="w-full bg-teal text-white hover:bg-teal/90">
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-navy/60">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-teal hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
