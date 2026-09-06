"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MonthYearSelect } from "@/components/profile/month-year-select";
import { createClient } from "@/lib/supabase/client";
import {
  deleteCertificationAction,
  getCertificationAttachmentDownloadUrlAction,
  getCertificationAttachmentUploadUrlAction,
  upsertCertificationAction,
} from "@/lib/opportunities/student-profile-sections-actions";

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  issueDate: string | null;
  expiryDate: string | null;
  credentialUrl: string | null;
  credentialId: string | null;
  attachmentPath: string | null;
  attachmentFileName: string | null;
}

type Draft = Omit<CertificationItem, "id">;

function emptyDraft(): Draft {
  return { name: "", issuer: "", issueDate: "", expiryDate: "", credentialUrl: "", credentialId: "", attachmentPath: "", attachmentFileName: "" };
}

const CURRENT_YEAR = new Date().getFullYear();

export function CertificationsEditor({ items }: { items: CertificationItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [doesNotExpire, setDoesNotExpire] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft());
    setDoesNotExpire(false);
    setError(null);
    setOpen(true);
  }

  function openEdit(item: CertificationItem) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      issuer: item.issuer,
      issueDate: item.issueDate ?? "",
      expiryDate: item.expiryDate ?? "",
      credentialUrl: item.credentialUrl ?? "",
      credentialId: item.credentialId ?? "",
      attachmentPath: item.attachmentPath ?? "",
      attachmentFileName: item.attachmentFileName ?? "",
    });
    setDoesNotExpire(!item.expiryDate && Boolean(item.issueDate));
    setError(null);
    setOpen(true);
  }

  async function handleAttachment(file: File) {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported for the certificate.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("That file is too large — max 8MB.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { path, token } = await getCertificationAttachmentUploadUrlAction(file.name);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("student-certifications").uploadToSignedUrl(path, token, file);
      if (uploadError) throw new Error(`Couldn't upload "${file.name}": ${uploadError.message}`);
      setDraft((d) => ({ ...d, attachmentPath: path, attachmentFileName: file.name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
    }
  }

  async function viewAttachment() {
    if (!editingId) return;
    setError(null);
    try {
      const { url } = await getCertificationAttachmentDownloadUrlAction(editingId);
      window.open(url, "_blank", "noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that file.");
    }
  }

  function save() {
    setError(null);
    if (!draft.name.trim()) {
      setError("Certification name is required.");
      return;
    }
    if (!draft.issuer.trim()) {
      setError("Issuer is required.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertCertificationAction({
          id: editingId ?? undefined,
          name: draft.name,
          issuer: draft.issuer,
          issueDate: draft.issueDate || undefined,
          expiryDate: doesNotExpire ? undefined : draft.expiryDate || undefined,
          credentialUrl: draft.credentialUrl || undefined,
          credentialId: draft.credentialId || undefined,
          attachmentPath: draft.attachmentPath || undefined,
          attachmentFileName: draft.attachmentFileName || undefined,
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
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {item.credentialUrl && <a href={item.credentialUrl} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium text-teal-ink hover:underline">View credential →</a>}
                    {item.attachmentFileName && <span className="inline-flex items-center gap-1 text-xs text-navy/50"><FileText className="size-3" aria-hidden="true" />{item.attachmentFileName}</span>}
                  </div>
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
          <div>
            <label className="text-sm font-medium text-navy">Issued (optional)</label>
            <div className="mt-1.5">
              <MonthYearSelect value={draft.issueDate || null} onChange={(v) => setDraft((d) => ({ ...d, issueDate: v }))} minYear={CURRENT_YEAR - 60} maxYear={CURRENT_YEAR} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-navy/70">
            <input type="checkbox" checked={doesNotExpire} onChange={(e) => setDoesNotExpire(e.target.checked)} className="size-3.5 rounded border-navy/30 accent-teal" />
            This credential does not expire
          </label>
          {!doesNotExpire && (
            <div>
              <label className="text-sm font-medium text-navy">Expires (optional)</label>
              <div className="mt-1.5">
                <MonthYearSelect value={draft.expiryDate || null} onChange={(v) => setDraft((d) => ({ ...d, expiryDate: v }))} minYear={CURRENT_YEAR} maxYear={CURRENT_YEAR + 30} />
              </div>
            </div>
          )}
          <div>
            <label htmlFor="cert-url" className="text-sm font-medium text-navy">Credential URL (optional)</label>
            <Input id="cert-url" type="url" placeholder="https://…" value={draft.credentialUrl ?? ""} onChange={(e) => setDraft((d) => ({ ...d, credentialUrl: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="cert-id" className="text-sm font-medium text-navy">Credential ID (optional)</label>
            <Input id="cert-id" value={draft.credentialId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, credentialId: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label className="text-sm font-medium text-navy">Certificate PDF (optional)</label>
            {draft.attachmentFileName ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-gray-cool/60 bg-white px-2.5 py-2 text-sm text-navy">
                <FileText className="size-3.5 shrink-0 text-navy/50" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{draft.attachmentFileName}</span>
                {editingId && draft.attachmentPath === items.find((i) => i.id === editingId)?.attachmentPath && (
                  <button type="button" onClick={viewAttachment} className="shrink-0 text-xs font-medium text-teal-ink hover:underline">View</button>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="shrink-0 text-xs font-medium text-teal-ink hover:underline">Replace</button>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, attachmentPath: "", attachmentFileName: "" }))} aria-label="Remove certificate PDF" className="shrink-0 rounded-md p-1 text-navy/35 hover:bg-navy/5 hover:text-destructive">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-1.5 flex h-9 w-full items-center gap-1.5 rounded-lg border border-dashed border-gray-cool/60 bg-white px-2.5 text-sm text-navy/55 hover:border-teal/40"
              >
                <FileText className="size-3.5" aria-hidden="true" />
                {uploading ? "Uploading…" : "Upload certificate PDF"}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAttachment(f); e.target.value = ""; }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" onClick={save} disabled={isPending || uploading} className="h-9 bg-teal text-white hover:bg-teal-ink">{isPending ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="h-9">Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
