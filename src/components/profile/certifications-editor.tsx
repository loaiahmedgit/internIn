"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { deleteCertificationAction, upsertCertificationAction } from "@/lib/opportunities/student-profile-sections-actions";

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  issueDate: string | null;
  expiryDate: string | null;
  credentialUrl: string | null;
  credentialId: string | null;
}

function emptyDraft(): Omit<CertificationItem, "id"> {
  return { name: "", issuer: "", issueDate: "", expiryDate: "", credentialUrl: "", credentialId: "" };
}

export function CertificationsEditor({ items }: { items: CertificationItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<CertificationItem, "id">>(emptyDraft());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft());
    setError(null);
    setOpen(true);
  }

  function openEdit(item: CertificationItem) {
    setEditingId(item.id);
    setDraft({ ...item, issueDate: item.issueDate ?? "", expiryDate: item.expiryDate ?? "", credentialUrl: item.credentialUrl ?? "", credentialId: item.credentialId ?? "" });
    setError(null);
    setOpen(true);
  }

  function save() {
    setError(null);
    if (!draft.name.trim() || !draft.issuer.trim()) {
      setError("Name and issuer are required.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertCertificationAction({
          id: editingId ?? undefined,
          name: draft.name,
          issuer: draft.issuer,
          issueDate: draft.issueDate || undefined,
          expiryDate: draft.expiryDate || undefined,
          credentialUrl: draft.credentialUrl || undefined,
          credentialId: draft.credentialId || undefined,
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteCertificationAction(id);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <section id="certifications" className="scroll-mt-24 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="size-4 text-teal-ink" aria-hidden="true" />
            <h2 className="text-base font-semibold text-navy">Certifications</h2>
          </div>
          <SheetTrigger onClick={openAdd} className="flex items-center gap-1 text-sm font-medium text-teal-ink hover:underline">
            <Plus className="size-3.5" aria-hidden="true" />
            Add certification
          </SheetTrigger>
        </div>

        {items.length > 0 ? (
          <div className="mt-3 divide-y divide-navy/8">
            {items.map((item) => (
              <div key={item.id} className="group flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-navy">{item.name}</p>
                  <p className="text-sm text-navy/60">
                    {item.issuer}{item.issueDate ? ` · Issued ${item.issueDate}` : ""}
                  </p>
                  {item.credentialUrl && <a href={item.credentialUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-xs font-medium text-teal-ink hover:underline">View credential →</a>}
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} className="rounded-md p-1.5 text-navy/40 hover:bg-navy/5 hover:text-teal-ink">
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`} className="rounded-md p-1.5 text-navy/40 hover:bg-navy/5 hover:text-destructive">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-navy/55">Add certifications and credentials you&apos;ve earned.</p>
        )}
      </section>

      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-navy/8 px-5 py-4">
          <SheetTitle>{editingId ? "Edit certification" : "Add certification"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 px-5 py-5">
          <div>
            <label htmlFor="cert-name" className="text-sm font-medium text-navy">Certification name</label>
            <Input id="cert-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="cert-issuer" className="text-sm font-medium text-navy">Issuer</label>
            <Input id="cert-issuer" value={draft.issuer} onChange={(e) => setDraft((d) => ({ ...d, issuer: e.target.value }))} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cert-issued" className="text-sm font-medium text-navy">Issued (optional)</label>
              <Input id="cert-issued" placeholder="2026" value={draft.issueDate ?? ""} onChange={(e) => setDraft((d) => ({ ...d, issueDate: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <label htmlFor="cert-expiry" className="text-sm font-medium text-navy">Expires (optional)</label>
              <Input id="cert-expiry" placeholder="2028" value={draft.expiryDate ?? ""} onChange={(e) => setDraft((d) => ({ ...d, expiryDate: e.target.value }))} className="mt-1.5" />
            </div>
          </div>
          <div>
            <label htmlFor="cert-url" className="text-sm font-medium text-navy">Credential URL (optional)</label>
            <Input id="cert-url" type="url" placeholder="https://…" value={draft.credentialUrl ?? ""} onChange={(e) => setDraft((d) => ({ ...d, credentialUrl: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="cert-id" className="text-sm font-medium text-navy">Credential ID (optional)</label>
            <Input id="cert-id" value={draft.credentialId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, credentialId: e.target.value }))} className="mt-1.5" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" onClick={save} disabled={isPending} className="h-9 bg-teal text-white hover:bg-teal-ink">{isPending ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="h-9">Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
