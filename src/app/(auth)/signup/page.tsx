"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { isRedirectError } from "@/lib/utils";

export default function SignUpPage() {
  const [role, setRole] = useState<"student" | "company">("student");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      await signUp(formData);
    } catch (e) {
      if (isRedirectError(e)) throw e;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-cool/60 bg-white p-7">
      <h1 className="text-xl font-bold text-navy">Create your account</h1>

      <div className="mt-5">
        <OAuthButtons />
      </div>
      <div className="mt-5 flex items-center gap-3 text-xs text-navy/40">
        <div className="h-px flex-1 bg-gray-cool/60" />
        or
        <div className="h-px flex-1 bg-gray-cool/60" />
      </div>

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
          <Label htmlFor="fullName">Your name</Label>
          <Input id="fullName" name="fullName" required className="mt-1.5" />
        </div>
        {role === "company" && (
          <>
            <div>
              <Label htmlFor="jobTitle">Your role</Label>
              <select
                id="jobTitle"
                name="jobTitle"
                required
                defaultValue=""
                className="mt-1.5 h-8 w-full rounded-lg border border-gray-cool/60 bg-transparent px-2.5 text-sm text-navy outline-none focus-visible:border-teal"
              >
                <option value="" disabled>
                  Select your role
                </option>
                <option value="Founder / Owner">Founder / Owner</option>
                <option value="HR / Talent Acquisition">HR / Talent Acquisition</option>
                <option value="Hiring Manager">Hiring Manager</option>
                <option value="Team Manager">Team Manager</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="companyName">Company name</Label>
              <Input id="companyName" name="companyName" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="companyWebsite">Company website</Label>
              <Input
                id="companyWebsite"
                name="companyWebsite"
                type="url"
                placeholder="https://…"
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="companyIndustry">Industry</Label>
              <Input id="companyIndustry" name="companyIndustry" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="companySize">Company size (optional)</Label>
              <Input id="companySize" name="companySize" placeholder="e.g. 1-10, 11-50…" className="mt-1.5" />
            </div>
          </>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={8} className="mt-1.5" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={pending} className="w-full bg-teal text-white hover:bg-teal/90">
          {pending ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-navy/60">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-teal hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
