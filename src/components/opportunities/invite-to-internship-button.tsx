"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inviteToInternshipAction } from "@/lib/opportunities/actions";
import { Sparkles } from "lucide-react";

export function InviteToInternshipButton({
  applicationId,
  candidateName,
  alreadyInvited,
}: {
  applicationId: string;
  candidateName: string;
  alreadyInvited: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [invited, setInvited] = useState(alreadyInvited);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await inviteToInternshipAction(applicationId);
        setInvited(true);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send the invite. Try again.");
      }
    });
  }

  if (invited) {
    return (
      <Button size="sm" disabled variant="outline">
        Invited to internship
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="bg-teal text-white hover:bg-teal/90" />}>
        <Sparkles className="mr-1.5 size-4" /> Invite to Internship
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite {candidateName} to an internship?</DialogTitle>
          <DialogDescription>
            This unlocks the Internship Program Builder and management workspace for this candidate. A
            <span className="font-medium text-foreground"> QAR 499 placement fee</span> applies — you only
            pay when you actually hire.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending} className="bg-teal text-white hover:bg-teal/90">
            {isPending ? "Confirming…" : "Confirm & invite — QAR 499"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
