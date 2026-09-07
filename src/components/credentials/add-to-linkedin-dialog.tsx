"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * V1 stays manual/reliable — checked LinkedIn's current "Add profile
 * section → Licenses & certifications" form: it accepts free-text name +
 * issuing organization, an issue date, a credential ID, and a credential
 * URL, but there is no public, reliable prefill/deep-link mechanism for a
 * third party to populate it automatically (that requires a LinkedIn
 * partner integration, out of scope here). Rather than fabricate a
 * "successful" LinkedIn insertion, this gives the student the exact
 * values to paste in themselves.
 */
function CopyRow({ label, value }: { label: string; value: string }) {
  function copy() {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Couldn't copy"));
  }
  return (
    <div className="flex items-start justify-between gap-3 border-b border-navy/8 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-navy/45">{label}</p>
        <p className="mt-0.5 truncate text-sm text-navy">{value}</p>
      </div>
      <button type="button" onClick={copy} aria-label={`Copy ${label}`} className="mt-3 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-navy/50 hover:bg-navy/6 hover:text-navy">
        <Copy className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function AddToLinkedInDialog({
  credentialName,
  issueDateLabel,
  credentialId,
  credentialUrl,
}: {
  credentialName: string;
  issueDateLabel: string;
  credentialId: string;
  credentialUrl: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<button type="button" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-navy/12 bg-white px-3.5 text-sm font-medium text-navy transition-colors hover:border-teal/25 hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40" />}
      >
        <Share2 className="size-3.5" aria-hidden="true" />
        Add to LinkedIn
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to LinkedIn</DialogTitle>
          <DialogDescription>
            LinkedIn doesn&apos;t support adding certifications automatically from other sites. Copy these values into
            <span className="font-medium text-foreground"> Profile → Licenses &amp; certifications → Add</span> yourself.
          </DialogDescription>
        </DialogHeader>
        <div>
          <CopyRow label="Name" value={credentialName} />
          <CopyRow label="Issuing organization" value="internIn" />
          <CopyRow label="Issue date" value={issueDateLabel} />
          <CopyRow label="Credential ID" value={credentialId} />
          <CopyRow label="Credential URL" value={credentialUrl} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
