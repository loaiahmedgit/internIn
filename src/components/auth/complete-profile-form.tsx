"use client";

import { useState } from "react";
import { completeOAuthProfile } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isRedirectError } from "@/lib/utils";

export function CompleteProfileForm({ defaultFullName }: { defaultFullName: string }) {
  const [role, setRole] = useState<"student" | "company">("student");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await completeOAuthProfile(formData);
    } catch (e) {
      if (isRedirectError(e)) throw e;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRole("student")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            role === "student" ? "border-teal bg-teal/5 text-teal" : "border-gray-cool/60 text-navy/60"
          }`}
        >
          I&apos;m a student
        </button>
        <button
          type="button"
          onClick={() => setRole("company")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            role === "company" ? "border-teal bg-teal/5 text-teal" : "border-gray-cool/60 text-navy/60"
          }`}
        >
          I&apos;m a company
        </button>
      </div>

      <form action={handleSubmit} className="mt-5 space-y-4">
        <input type="hidden" name="role" value={role} />
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={defaultFullName} required className="mt-1.5" />
        </div>
        {role === "company" && (
          <div>
            <Label htmlFor="companyName">Company name</Label>
            <Input id="companyName" name="companyName" required className="mt-1.5" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={pending} className="w-full bg-teal text-white hover:bg-teal/90">
          {pending ? "Setting up…" : "Continue"}
        </Button>
      </form>
    </>
  );
}
