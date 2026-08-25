"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { completeInternshipProgramAction } from "@/lib/opportunities/program-actions";

export function CompleteProgramButton({ programId, internName }: { programId: string; internName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await completeInternshipProgramAction(programId);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't complete the program. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-teal text-white hover:bg-teal/90" />}>
        Mark internship complete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete {internName}&apos;s internship?</DialogTitle>
          <DialogDescription>
            This generates {internName}&apos;s Verified Experience record from completed tasks and the
            role&apos;s skills, and can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending} className="bg-teal text-white hover:bg-teal/90">
            {isPending ? "Completing…" : "Confirm & complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
