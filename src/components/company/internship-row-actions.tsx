"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { closeOpportunityAction, duplicateOpportunityAction, deleteOpportunityAction } from "@/lib/opportunities/actions";
import { EditInternshipDialog } from "@/components/company/edit-internship-dialog";
import type { InternshipDraft } from "@/lib/ai";
import { MoreHorizontal, Users, ExternalLink, Pencil, Copy, XCircle, Eye, Trash2, PlayCircle } from "lucide-react";

// Wider than the shared default (which lets "View public listing" wrap) and
// roomier row padding — the shared component's compact defaults are built
// for short single-word items, not this menu's longest label.
const MENU_CONTENT_CLASS = "min-w-[196px]";
const MENU_ITEM_CLASS = "px-2.5 py-1.5 gap-2";

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
        <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
          {status === "draft" ? (
            <>
              <DropdownMenuItem className={MENU_ITEM_CLASS} render={<Link href={`/company/opportunities/${opportunityId}/setup`} />}>
                <PlayCircle className="size-4" aria-hidden="true" />
                Continue setup
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS} render={<Link href={`/opportunities/${opportunityId}`} />}>
                <Eye className="size-4" aria-hidden="true" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={handleDuplicate} disabled={isPending}>
                <Copy className="size-4" aria-hidden="true" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={MENU_ITEM_CLASS}
                onClick={() => setDeleteOpen(true)}
                disabled={isPending}
                variant="destructive"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete draft
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                className={MENU_ITEM_CLASS}
                render={<Link href={`/company/candidates?opportunity=${encodeURIComponent(opportunityId)}`} />}
              >
                <Users className="size-4" aria-hidden="true" />
                View candidates
              </DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM_CLASS} render={<Link href={`/opportunities/${opportunityId}`} />}>
                <ExternalLink className="size-4" aria-hidden="true" />
                {status === "published" ? "View public listing" : "View listing"}
              </DropdownMenuItem>
              {status === "published" && (
                <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => setEditOpen(true)} disabled={isPending}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit details
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={handleDuplicate} disabled={isPending}>
                <Copy className="size-4" aria-hidden="true" />
                Duplicate
              </DropdownMenuItem>
              {status === "published" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={handleClose} disabled={isPending} variant="destructive">
                    <XCircle className="size-4" aria-hidden="true" />
                    Close internship
                  </DropdownMenuItem>
                </>
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
