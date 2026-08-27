"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { signIn } from "../(auth)/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Wordmark } from "@/components/ui/wordmark";

function SignInForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="flex h-dvh">
      <div className="flex w-full flex-col justify-center overflow-y-auto px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-navy/50 hover:text-navy/70">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to home
        </Link>

        <div className="mx-auto mt-10 w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block">
            <Wordmark size="sm" />
          </Link>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-navy">Welcome back.</h1>
          <p className="mt-1.5 text-sm text-navy/60">Sign in to continue where you left off.</p>

          <div className="mt-6">
            <OAuthButtons />
          </div>
          <div className="mt-6 flex items-center gap-3 text-xs text-navy/40">
            <div className="h-px flex-1 bg-gray-cool/60" />
            or
            <div className="h-px flex-1 bg-gray-cool/60" />
          </div>

          <form action={handleSubmit} className="mt-6 space-y-4">
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

          <p className="mt-6 text-center text-sm text-navy/60">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-teal hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>

      <div
        className="relative hidden overflow-hidden bg-navy lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      >
        <div className="flex flex-col items-center gap-4 px-10 text-center">
          <p className="max-w-xs text-sm text-white/60">
            Connecting ambition with opportunity through evidence, structure, and a fair first chance.
          </p>
        </div>
      </div>
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
