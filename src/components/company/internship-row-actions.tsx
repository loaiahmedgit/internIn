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
import { closeOpportunityAction, duplicateOpportunityAction } from "@/lib/opportunities/actions";
import { MoreHorizontal } from "lucide-react";

export function InternshipRowActions({
  opportunityId,
  status,
  role,
}: {
  opportunityId: string;
  status: "draft" | "published" | "closed";
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex items-center justify-end gap-1.5">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${role}`} disabled={isPending} />}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              <Link href={status === "draft" ? `/company/opportunities/${opportunityId}/setup` : `/company/opportunities/${opportunityId}`} />
            }
          >
            {status === "draft" ? "Continue setup" : "View candidates"}
          </DropdownMenuItem>
          {status === "published" && (
            <DropdownMenuItem render={<Link href={`/opportunities/${opportunityId}`} />}>View public listing</DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
            Duplicate internship
          </DropdownMenuItem>
          {status === "published" && (
            <DropdownMenuItem onClick={handleClose} disabled={isPending} variant="destructive">
              Close internship
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
