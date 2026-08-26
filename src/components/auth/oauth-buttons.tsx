"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Provider = "google" | "linkedin_oidc" | "azure";

const LABELS: Record<Provider, string> = {
  google: "Google",
  linkedin_oidc: "LinkedIn",
  azure: "Microsoft",
};

export function OAuthButtons() {
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: Provider) {
    setError(null);
    setPendingProvider(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setPendingProvider(null);
    }
    // On success the browser navigates away to the provider — nothing else to do here.
  }

  return (
    <div className="space-y-2">
      {(Object.keys(LABELS) as Provider[]).map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full"
          disabled={pendingProvider !== null}
          onClick={() => handleOAuth(provider)}
        >
          {pendingProvider === provider ? "Redirecting…" : `Continue with ${LABELS[provider]}`}
        </Button>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
