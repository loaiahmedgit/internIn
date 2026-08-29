"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { closeOpportunityAction, duplicateOpportunityAction, deleteOpportunityAction } from "@/lib/opportunities/actions";
import { EditInternshipDialog } from "@/components/company/edit-internship-dialog";
import type { InternshipDraft } from "@/lib/ai";
import { MoreHorizontal } from "lucide-react";

export function InternshipRowActions({
  opportunityId,
  status,
  role,
  editDetails,
}: {
  opportunityId: string;
  status: "draft" | "published" | "closed";
  role: string;
  editDetails: InternshipDraft;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleClose() {
    setError(null);
    startTransition(async () => {
      try {
        await closeOpportunityAction(opportunityId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't close this internship.");
      }
    });
  }

  function handleDuplicate() {
    setError(null);
    startTransition(async () => {
      try {
        const newId = await duplicateOpportunityAction(opportunityId);
        router.push(`/company/opportunities/${newId}/setup`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't duplicate this internship.");
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteOpportunityAction(opportunityId);
        setDeleteOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete this draft.");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${role}`} disabled={isPending} />}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "draft" ? (
            <>
              <DropdownMenuItem render={<Link href={`/company/opportunities/${opportunityId}/setup`} />}>
                Continue setup
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/opportunities/${opportunityId}`} />}>Preview</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} disabled={isPending} variant="destructive">
                Delete draft
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem render={<Link href={`/company/opportunities/${opportunityId}`} />}>View candidates</DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/opportunities/${opportunityId}`} />}>
                {status === "published" ? "View public listing" : "View listing"}
              </DropdownMenuItem>
              {status === "published" && (
                <DropdownMenuItem onClick={() => setEditOpen(true)} disabled={isPending}>
                  Edit details
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
                Duplicate
              </DropdownMenuItem>
              {status === "published" && (
                <DropdownMenuItem onClick={handleClose} disabled={isPending} variant="destructive">
                  Close internship
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditInternshipDialog opportunityId={opportunityId} initial={editDetails} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={deleteOpen} onOpenChange={(next) => !isPending && setDeleteOpen(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>
              &ldquo;{role}&rdquo; will be permanently removed. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
